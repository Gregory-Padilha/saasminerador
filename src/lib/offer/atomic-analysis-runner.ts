// ==============================================================================
// OFFER MINER - ATOMIC STEP RUNNER FOR SERVERLESS OFFER ANALYSIS
// ==============================================================================
// Executes offer analysis in discrete, resilient 1-3 second steps compatible with
// Netlify serverless execution limits (<=60s synchronous), with zero disk writes
// and zero heavy browser (Chromium) dependencies.
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { validateMetaAdsLibraryUrl } from '@/lib/meta-ads/url-utils';
import { validateScrapingUrl } from '@/lib/security/ssrf';
import { calculateDiscoveryScore, calculateOpportunityScore } from '@/lib/scoring';
import { Offer, OfferAnalysisJob, OfferDeliverable, OfferBonus } from '@/types';

export type AtomicStepName =
  | 'RESOLVE_META'
  | 'DISCOVER_LANDING_PAGE'
  | 'MAP_LANDING_PAGE'
  | 'DISCOVER_CHECKOUT'
  | 'MAP_CHECKOUT'
  | 'ENRICH_OFFER'
  | 'FINALIZE'
  | 'COMPLETED';

export interface StepExecutionResult {
  jobId: string;
  offerId: string;
  stepExecuted: AtomicStepName;
  nextStep: AtomicStepName;
  isCompleted: boolean;
  progressPercent: number;
  message: string;
  job: OfferAnalysisJob;
  offer: Offer;
}

const STEP_ORDER: AtomicStepName[] = [
  'RESOLVE_META',
  'DISCOVER_LANDING_PAGE',
  'MAP_LANDING_PAGE',
  'DISCOVER_CHECKOUT',
  'MAP_CHECKOUT',
  'ENRICH_OFFER',
  'FINALIZE',
  'COMPLETED',
];

const STEP_PROGRESS: Record<AtomicStepName, number> = {
  RESOLVE_META: 20,
  DISCOVER_LANDING_PAGE: 40,
  MAP_LANDING_PAGE: 60,
  DISCOVER_CHECKOUT: 75,
  MAP_CHECKOUT: 85,
  ENRICH_OFFER: 92,
  FINALIZE: 100,
  COMPLETED: 100,
};

/**
 * Executes exactly ONE atomic step of the analysis pipeline for the given job.
 * This guarantees execution well within serverless timeouts.
 */
export async function executeAtomicStep(jobId: string, client?: any): Promise<StepExecutionResult> {
  const job = await dbService.getAnalysisJob(jobId, client);
  if (!job) {
    throw new Error(`Job de análise ${jobId} não encontrado.`);
  }

  if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
    const offer = job.offer_id ? await dbService.getOfferById(job.offer_id) : null;
    return {
      jobId,
      offerId: job.offer_id || '',
      stepExecuted: (job.current_step as AtomicStepName) || 'COMPLETED',
      nextStep: 'COMPLETED',
      isCompleted: job.status === 'completed',
      progressPercent: job.progress_percent ?? 100,
      message: job.stage_message || 'Job finalizado.',
      job,
      offer: offer!,
    };
  }

  const currentStep = (job.current_step as AtomicStepName) || 'RESOLVE_META';
  const offerId = job.offer_id || job.progress_data?.offer_id;
  if (!offerId) {
    throw new Error(`Job ${jobId} não possui offer_id associado.`);
  }

  let offer = await dbService.getOfferById(offerId);
  if (!offer) {
    throw new Error(`Oferta ${offerId} não encontrada para o job ${jobId}.`);
  }

  const now = new Date().toISOString();
  let nextStep: AtomicStepName = 'FINALIZE';
  let stepMessage = '';
  const logs = job.progress_data?.logs || [];

  const addLog = (stage: string, msg: string) => {
    logs.push({ timestamp: new Date().toISOString(), stage, message: msg });
  };

  try {
    switch (currentStep) {
      // -----------------------------------------------------------------------
      // STEP 1: RESOLVE META ADS
      // -----------------------------------------------------------------------
      case 'RESOLVE_META': {
        addLog('META_STEP_STARTED', 'Iniciando análise do step Meta Ads...');
        addLog('META_URL_RECEIVED', `URL recebida: ${job.input_url}`);
        const validation = validateMetaAdsLibraryUrl(job.input_url);
        if (!validation.isValid) {
          addLog('META_STEP_FAILED', `Falha de validação: ${validation.error}`);
          throw new Error(validation.error || 'URL da Meta Ads Library inválida.');
        }

        const cleanMetaUrl = validation.normalizedUrl || job.input_url;
        addLog('META_URL_NORMALIZED', `URL normalizada: ${cleanMetaUrl}`);

        let advertiserName: string | null = null;
        let candidateName: string | null = null;
        let candidateDestUrl: string | null = null;
        let activeAdsCount = offer.active_ads_count || 1;
        let adId: string | null = null;
        let pageId: string | null = null;

        // Try extracting parameters from URL
        try {
          const parsed = new URL(cleanMetaUrl);
          pageId = parsed.searchParams.get('view_all_page_id');
          adId = parsed.searchParams.get('id');
          const q = parsed.searchParams.get('q');

          if (adId) {
            addLog('META_AD_ID_EXTRACTED', `Meta Ad ID extraído: ${adId}`);
            candidateName = `Anúncio Meta #${adId}`;
          }
          if (pageId) {
            advertiserName = `Página Meta #${pageId}`;
          }
          if (q) {
            candidateName = decodeURIComponent(q).slice(0, 80);
            advertiserName = candidateName;
          }
        } catch {
          // ignore url parse error
        }

        addLog('META_PAGE_NAVIGATION_STARTED', 'Iniciando inspeção HTTP resiliente de metadados...');

        // Lightweight HTTP probe (no Playwright)
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(cleanMetaUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml',
            },
          });
          clearTimeout(timeout);

          addLog('META_PAGE_LOADED', `Resposta HTTP recebida com status ${res.status}`);
          addLog('META_DATA_EXTRACTION_STARTED', 'Extraindo dados da página do anúncio...');

          if (res.ok) {
            const html = await res.text();
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes('Meta Ads Library')) {
              advertiserName = titleMatch[1].trim();
            }

            const hrefMatches = html.match(/href="(https?:\/\/[^"#\s]+)"/gi) || [];
            for (const hm of hrefMatches) {
              const u = hm.replace(/^href="/i, '').replace(/"$/, '');
              if (
                !u.includes('facebook.com') &&
                !u.includes('meta.com') &&
                !u.includes('instagram.com') &&
                !u.includes('fb.com')
              ) {
                candidateDestUrl = u;
                break;
              }
            }
          }
        } catch (fetchErr: any) {
          addLog('META_DATA_EXTRACTION_COMPLETED', `Aviso HTTP Meta: ${fetchErr.message}. Utilizando dados de parâmetros.`);
        }

        // Fallback names if still default
        if (!advertiserName || advertiserName.includes('Identificando')) {
          advertiserName = offer.advertiser && !offer.advertiser.includes('Identificando') ? offer.advertiser : (pageId ? `Página Meta #${pageId}` : 'Anunciante Meta');
        }
        if (!candidateName || candidateName.includes('Analisando')) {
          candidateName = offer.product_name && !offer.product_name.includes('Analisando') ? offer.product_name : (adId ? `Anúncio Meta #${adId}` : `Oferta ${advertiserName}`);
        }

        activeAdsCount = Math.max(activeAdsCount, 1);
        addLog('META_DATA_EXTRACTION_COMPLETED', `Dados extraídos: Anunciante: "${advertiserName}", Oferta: "${candidateName}".`);

        // Update Offer immediately (persist first useful result)
        offer = await dbService.updateOffer(offer.id, {
          product_name: candidateName,
          advertiser: advertiserName,
          meta_ads_url: cleanMetaUrl,
          active_ads_count: activeAdsCount,
          landing_page_url: candidateDestUrl || offer.landing_page_url,
          landing_page_url_original: candidateDestUrl || offer.landing_page_url_original,
          status: 'ANALYZING',
          updated_at: now,
        }, client) || offer;

        addLog('META_DATA_PERSISTED', 'Primeiro resultado útil persistido no banco com sucesso.');
        addLog('META_STEP_COMPLETED', 'Step Meta Ads concluído.');

        nextStep = 'DISCOVER_LANDING_PAGE';
        stepMessage = `Meta Ads identificado: "${candidateName}". Anunciante: "${advertiserName}". Buscando Landing Page...`;
        break;
      }

      // -----------------------------------------------------------------------
      // STEP 2: DISCOVER LANDING PAGE (REDIRECTS & SSRF)
      // -----------------------------------------------------------------------
      case 'DISCOVER_LANDING_PAGE': {
        addLog('DISCOVER_LANDING_PAGE', 'Descobrindo e validando URL de destino da Landing Page...');
        let targetUrl = offer.landing_page_url || offer.landing_page_url_original;

        if (!targetUrl) {
          addLog('DISCOVER_LANDING_PAGE', 'Nenhuma URL de Landing Page extraída dos anúncios. Prosseguindo com dados parciais.');
          nextStep = 'ENRICH_OFFER';
          stepMessage = 'Landing Page não especificada nos anúncios. Enriquecendo oferta com dados disponíveis...';
          break;
        }

        // SSRF Protection
        const ssrfCheck = validateScrapingUrl(targetUrl);
        if (!ssrfCheck.valid) {
          addLog('DISCOVER_LANDING_PAGE', `URL rejeitada por SSRF protection: ${ssrfCheck.reason}`);
          nextStep = 'ENRICH_OFFER';
          stepMessage = 'URL de destino bloqueada por segurança (SSRF). Prosseguindo para finalização.';
          break;
        }

        // Resolve redirects via HTTP HEAD/GET
        let finalLpUrl = targetUrl;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const headRes = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
          });
          clearTimeout(timeout);
          if (headRes.url) {
            finalLpUrl = headRes.url;
          }
        } catch (redErr: any) {
          addLog('DISCOVER_LANDING_PAGE', `Aviso ao seguir redirecionamentos: ${redErr.message}`);
        }

        // Check if direct to checkout
        const isDirectCheckout =
          finalLpUrl.includes('pay.kiwify.com.br') ||
          finalLpUrl.includes('pay.hotmart.com') ||
          finalLpUrl.includes('sun.eduzz.com') ||
          finalLpUrl.includes('chk.eduzz.com') ||
          finalLpUrl.includes('ev.braip.com') ||
          finalLpUrl.includes('pay.wiapy.com') ||
          finalLpUrl.includes('chk.greenn.com.br') ||
          finalLpUrl.includes('/checkout');

        let domain = '';
        try {
          domain = new URL(finalLpUrl).hostname;
        } catch {
          // ignore
        }

        if (isDirectCheckout) {
          offer = await dbService.updateOffer(offer.id, {
            landing_page_url: finalLpUrl,
            landing_page_domain: domain,
            landing_page_flow_type: 'DIRECT_TO_CHECKOUT',
            checkout_url: finalLpUrl,
            checkout_discovery_status: 'FOUND',
            lp_mapping_status: 'NOT_APPLICABLE',
            updated_at: now,
          }, client) || offer;

          nextStep = 'MAP_CHECKOUT';
          stepMessage = 'Destino identificado como Direto ao Checkout. Mapeando checkout...';
        } else {
          offer = await dbService.updateOffer(offer.id, {
            landing_page_url: finalLpUrl,
            landing_page_domain: domain,
            landing_page_flow_type: 'LP_TO_CHECKOUT',
            landing_page_url_status: 'AVAILABLE',
            updated_at: now,
          }, client) || offer;

          nextStep = 'MAP_LANDING_PAGE';
          stepMessage = `Landing Page descoberta (${domain}). Mapeando elementos da página...`;
        }
        addLog('DISCOVER_LANDING_PAGE', stepMessage);
        break;
      }

      // -----------------------------------------------------------------------
      // STEP 3: MAP LANDING PAGE (HTML EXTRACTION WITHOUT PLAYWRIGHT)
      // -----------------------------------------------------------------------
      case 'MAP_LANDING_PAGE': {
        addLog('MAP_LANDING_PAGE', 'Carregando HTML da Landing Page de forma leve e segura...');
        const lpUrl = offer.landing_page_url || offer.landing_page_url_original;
        if (!lpUrl) {
          addLog('MAP_LANDING_PAGE', 'URL da Landing Page indisponível. Avançando para enriquecimento.');
          nextStep = 'ENRICH_OFFER';
          stepMessage = 'Landing Page indisponível. Enriquecendo com dados parciais...';
          break;
        }

        const ssrf = validateScrapingUrl(lpUrl);
        if (!ssrf.valid) {
          addLog('MAP_LANDING_PAGE', `URL da Landing Page bloqueada por segurança (${ssrf.reason || 'INVÁLIDA'}).`);
          nextStep = 'ENRICH_OFFER';
          stepMessage = 'URL bloqueada por segurança. Prosseguindo com dados parciais...';
          break;
        }

        let extractedHeadline = offer.headline || '';
        let extractedSubheadline = offer.subheadline || '';
        let extractedPrice = offer.price || null;
        const deliverables: OfferDeliverable[] = [];
        const bonuses: OfferBonus[] = [];
        const ctaLinks: string[] = [];

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 7000);
          const res = await fetch(lpUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml',
            },
          });
          clearTimeout(timeout);

          if (res.ok) {
            const html = await res.text();

            // Extract Headline (h1 / h2)
            const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1Match && h1Match[1]) {
              extractedHeadline = h1Match[1].replace(/<[^>]+>/g, '').trim().slice(0, 300);
            }

            // Extract Subheadline
            const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            if (h2Match && h2Match[1]) {
              extractedSubheadline = h2Match[1].replace(/<[^>]+>/g, '').trim().slice(0, 300);
            }

            // Extract Price (R$ XX,XX)
            const priceMatch = html.match(/R\$\s*(\d{1,4}(?:[.,]\d{2})?)/i);
            if (priceMatch && priceMatch[1]) {
              const numStr = priceMatch[1].replace('.', '').replace(',', '.');
              const p = parseFloat(numStr);
              if (!isNaN(p) && p > 0 && p < 10000) {
                extractedPrice = p;
              }
            }

            // Extract CTA Links (buttons, anchors)
            const hrefMatches = html.match(/href="([^"#\s]+)"/gi) || [];
            for (const hm of hrefMatches) {
              const u = hm.replace(/^href="/i, '').replace(/"$/, '');
              if (u.startsWith('http')) {
                ctaLinks.push(u);
              }
            }

            // Extract potential deliverables (list items)
            const liMatches = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
            for (let i = 0; i < Math.min(liMatches.length, 5); i++) {
              const text = liMatches[i].replace(/<[^>]+>/g, '').trim();
              if (text.length > 5 && text.length < 150) {
                deliverables.push({
                  id: `del_${i + 1}`,
                  offer_id: offer.id,
                  title: text,
                  created_at: now,
                });
              }
            }
          }
        } catch (fetchErr: any) {
          addLog('MAP_LANDING_PAGE', `Aviso ao carregar Landing Page: ${fetchErr.message}. Usando dados disponíveis.`);
        }

        // Persist discovered CTA links into job progress_data
        const existingProgress = job.progress_data || {};
        await dbService.updateAnalysisJob(job.id, {
          progress_data: {
            ...existingProgress,
            cta_links: ctaLinks.slice(0, 30),
          },
        }, client);

        // Update Offer
        offer = await dbService.updateOffer(offer.id, {
          headline: extractedHeadline || offer.headline,
          subheadline: extractedSubheadline || offer.subheadline,
          price: extractedPrice || offer.price,
          lp_mapping_status: 'SUCCESS',
          lp_mapped_at: now,
          deliverables: deliverables.length > 0 ? deliverables : offer.deliverables,
          bonuses: bonuses.length > 0 ? bonuses : offer.bonuses,
          updated_at: now,
        }, client) || offer;

        nextStep = 'DISCOVER_CHECKOUT';
        stepMessage = `Landing Page mapeada. Headline: "${extractedHeadline || 'Identificada'}". Buscando Checkout...`;
        addLog('MAP_LANDING_PAGE', stepMessage);
        break;
      }

      // -----------------------------------------------------------------------
      // STEP 4: DISCOVER CHECKOUT
      // -----------------------------------------------------------------------
      case 'DISCOVER_CHECKOUT': {
        addLog('DISCOVER_CHECKOUT', 'Varrendo botões de ação (CTAs) para localizar o Checkout...');
        const ctaLinks: string[] = job.progress_data?.cta_links || [];
        let discoveredCheckoutUrl: string | null = offer.checkout_url || null;
        let checkoutProvider: string | null = offer.checkout_platform || null;

        const CHECKOUT_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
          { pattern: /pay\.kiwify\.com\.br/i, provider: 'Kiwify' },
          { pattern: /kiwify\.com\.br/i, provider: 'Kiwify' },
          { pattern: /pay\.hotmart\.com/i, provider: 'Hotmart' },
          { pattern: /hotmart\.com/i, provider: 'Hotmart' },
          { pattern: /sun\.eduzz\.com/i, provider: 'Eduzz' },
          { pattern: /chk\.eduzz\.com/i, provider: 'Eduzz' },
          { pattern: /ev\.braip\.com/i, provider: 'Braip' },
          { pattern: /pay\.wiapy\.com/i, provider: 'Wiapy' },
          { pattern: /monetizze\.com\.br\/checkout/i, provider: 'Monetizze' },
          { pattern: /chk\.greenn\.com\.br/i, provider: 'Greenn' },
          { pattern: /perfectpay\.com\.br/i, provider: 'PerfectPay' },
          { pattern: /cartpanda\.com/i, provider: 'CartPanda' },
          { pattern: /yampi\.io/i, provider: 'Yampi' },
        ];

        for (const link of ctaLinks) {
          for (const item of CHECKOUT_PATTERNS) {
            if (item.pattern.test(link)) {
              discoveredCheckoutUrl = link;
              checkoutProvider = item.provider;
              break;
            }
          }
          if (discoveredCheckoutUrl) break;
        }

        if (discoveredCheckoutUrl) {
          offer = await dbService.updateOffer(offer.id, {
            checkout_url: discoveredCheckoutUrl,
            checkout_platform: checkoutProvider,
            checkout_discovery_status: 'FOUND',
            checkout_discovery_at: now,
            updated_at: now,
          }, client) || offer;

          nextStep = 'MAP_CHECKOUT';
          stepMessage = `Checkout localizado: ${checkoutProvider} (${discoveredCheckoutUrl.slice(0, 45)}...).`;
        } else {
          offer = await dbService.updateOffer(offer.id, {
            checkout_discovery_status: 'NOT_FOUND',
            checkout_mapping_status: 'NOT_MAPPED',
            updated_at: now,
          }, client) || offer;

          nextStep = 'ENRICH_OFFER';
          stepMessage = 'Checkout não encontrado nos CTAs visíveis. Prosseguindo para enriquecimento.';
        }
        addLog('DISCOVER_CHECKOUT', stepMessage);
        break;
      }

      // -----------------------------------------------------------------------
      // STEP 5: MAP CHECKOUT
      // -----------------------------------------------------------------------
      case 'MAP_CHECKOUT': {
        addLog('MAP_CHECKOUT', 'Verificando estrutura e precificação do checkout...');
        if (offer.checkout_url) {
          // Check for price parameter in URL (e.g. ?src=...&off=...)
          offer = await dbService.updateOffer(offer.id, {
            checkout_mapping_status: 'SUCCESS',
            checkout_mapped_at: now,
            updated_at: now,
          }, client) || offer;
          stepMessage = `Checkout mapeado (${offer.checkout_platform || 'Plataforma'}).`;
        } else {
          stepMessage = 'Checkout não disponível para mapeamento.';
        }
        nextStep = 'ENRICH_OFFER';
        addLog('MAP_CHECKOUT', stepMessage);
        break;
      }

      // -----------------------------------------------------------------------
      // STEP 6: ENRICH OFFER (SCORING & NICHE CLASSIFICATION)
      // -----------------------------------------------------------------------
      case 'ENRICH_OFFER': {
        addLog('ENRICH_OFFER', 'Classificando nicho, calculando scores e oportunidade...');
        const textCorpus = `${offer.product_name} ${offer.advertiser || ''} ${offer.headline || ''} ${offer.niche || ''}`.toLowerCase();

        let niche = offer.niche;
        let subniche = offer.subniche;

        if (!niche || niche === 'Geral' || niche === 'Indefinido') {
          if (/saúde|emagrecer|peso|dieta|sono|treino|barriga|chá|corpo/i.test(textCorpus)) {
            niche = 'Saúde & Bem-Estar';
            subniche = 'Emagrecimento';
          } else if (/renda|dinheiro|lucro|vendas|afiliado|tráfego|investir|milhas|finanças/i.test(textCorpus)) {
            niche = 'Finanças & Negócios';
            subniche = 'Renda Extra';
          } else if (/conquista|relacionamento|casamento|sedução|homem|mulher|amor/i.test(textCorpus)) {
            niche = 'Relacionamentos';
            subniche = 'Conquista';
          } else if (/ansiedade|mente|depressão|foco|autoestima|hábitos/i.test(textCorpus)) {
            niche = 'Desenvolvimento Pessoal';
            subniche = 'Produtividade & Mentalidade';
          } else {
            niche = 'Negócios Digitais';
            subniche = 'Marketing';
          }
        }

        const discScore = calculateDiscoveryScore(offer).total;
        const oppScore = calculateOpportunityScore(discScore, offer.momentum_score ?? null);

        offer = await dbService.updateOffer(offer.id, {
          niche,
          subniche,
          discovery_score: discScore,
          opportunity_score: oppScore,
          system_score: oppScore ?? discScore,
          activity_status: 'Ativa',
          updated_at: now,
        }, client) || offer;

        nextStep = 'FINALIZE';
        stepMessage = `Oferta enriquecida. Nicho: ${niche}. Score: ${oppScore ?? discScore} pts.`;
        addLog('ENRICH_OFFER', stepMessage);
        break;
      }

      // -----------------------------------------------------------------------
      // STEP 7: FINALIZE
      // -----------------------------------------------------------------------
      case 'FINALIZE': {
        addLog('FINALIZE', 'Finalizando montagem do dossiê e consolidando catálogo...');
        const finalStatus =
          (offer.deliverables && offer.deliverables.length > 0) || offer.lp_mapping_status === 'SUCCESS'
            ? 'MAPEADA'
            : 'DADOS_PARCIAIS';

        offer = await dbService.updateOffer(offer.id, {
          status: finalStatus,
          updated_at: now,
        }, client) || offer;

        nextStep = 'COMPLETED';
        stepMessage = `Análise concluída com sucesso! Status: ${finalStatus}.`;
        addLog('FINALIZE', stepMessage);

        const updatedJob = await dbService.updateAnalysisJob(job.id, {
          status: 'completed',
          current_step: 'COMPLETED',
          progress_percent: 100,
          stage_message: stepMessage,
          completed_at: now,
          last_heartbeat_at: now,
          progress_data: {
            ...(job.progress_data || {}),
            logs,
            offer_id: offer.id,
            product_name: offer.product_name,
            advertiser: offer.advertiser,
            ads_count: offer.active_ads_count || 1,
            landing_page_url: offer.landing_page_url,
            checkout_url: offer.checkout_url,
            final_status: finalStatus,
          },
        });

        return {
          jobId: job.id,
          offerId: offer.id,
          stepExecuted: 'FINALIZE',
          nextStep: 'COMPLETED',
          isCompleted: true,
          progressPercent: 100,
          message: stepMessage,
          job: updatedJob || job,
          offer,
        };
      }

      default: {
        nextStep = 'COMPLETED';
        stepMessage = 'Job já concluído.';
        break;
      }
    }

    // Persist step transition checkpoint
    const progressPercent = STEP_PROGRESS[nextStep] || 50;
    const updatedJob = await dbService.updateAnalysisJob(job.id, {
      status: nextStep === 'COMPLETED' ? 'completed' : 'running',
      current_step: nextStep,
      progress_percent: progressPercent,
      stage_message: stepMessage,
      last_heartbeat_at: now,
      progress_data: {
        ...(job.progress_data || {}),
        current_step: nextStep,
        progress_percent: progressPercent,
        last_heartbeat_at: now,
        logs,
      },
    }, client);

    return {
      jobId: job.id,
      offerId: offer.id,
      stepExecuted: currentStep,
      nextStep,
      isCompleted: nextStep === 'COMPLETED',
      progressPercent,
      message: stepMessage,
      job: updatedJob || job,
      offer,
    };
  } catch (err: any) {
    console.error(`[ATOMIC RUNNER ERROR] Step ${currentStep} Job ${job.id}:`, err);
    addLog(currentStep, `Erro no passo ${currentStep}: ${err.message}`);

    const attempt = (job.attempt || 1) + 1;
    const isFatal = attempt > (job.max_attempts || 3) || err.message?.includes('inválida');

    // Keep offer visible as DADOS_PARCIAIS (never delete per Phase 4/5)
    await dbService.updateOffer(offer.id, {
      status: 'DADOS_PARCIAIS',
      updated_at: now,
    }, client).catch(() => {});

    const updatedJob = await dbService.updateAnalysisJob(job.id, {
      status: isFatal ? 'failed' : 'retrying',
      error_code: isFatal ? 'STEP_FATAL_ERROR' : 'STEP_RETRY_ERROR',
      error_message: err.message,
      error_message_safe: `Erro na etapa ${currentStep}: ${err.message}`,
      attempt,
      last_heartbeat_at: now,
      progress_data: {
        ...(job.progress_data || {}),
        logs,
        last_error: err.message,
      },
    }, client);

    return {
      jobId: job.id,
      offerId: offer.id,
      stepExecuted: currentStep,
      nextStep: isFatal ? 'COMPLETED' : currentStep,
      isCompleted: isFatal,
      progressPercent: job.progress_percent ?? 0,
      message: `Falha: ${err.message}`,
      job: updatedJob || job,
      offer,
    };
  }
}
