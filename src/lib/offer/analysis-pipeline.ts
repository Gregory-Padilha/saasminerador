// ==============================================================================
// OFFER MINER - META ADS URL ANALYSIS PIPELINE ORCHESTRATOR
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { validateMetaAdsLibraryUrl } from '@/lib/meta-ads/url-resolver';
import { launchBrowser, createPage } from '@/lib/landing-page/browser';
import { loadMetaAdsPage } from '@/lib/meta-ads/page-loader';
import { discoverAds } from '@/lib/meta-ads/ad-discovery';
import { captureMetaAdsCreatives } from '@/lib/meta-ads/capture';
import { detectExistingOfferAdvanced, generateDedupeKey } from '@/lib/deduplication';
import { analyzeAndMapLandingPage } from '@/lib/landing-page/sync';
import { mapCheckout } from '@/lib/checkout-intelligence/extract';
import { Offer, OfferAd, OfferAnalysisJob, OfferAnalysisStage } from '@/types';

export async function runOfferAnalysisPipeline(
  jobId: string,
  options?: { mode?: 'new' | 'update'; offerId?: string }
): Promise<OfferAnalysisJob> {
  const mode = options?.mode || 'new';
  let job = await dbService.getAnalysisJob(jobId);
  if (!job) {
    throw new Error(`Job de análise ${jobId} não encontrado.`);
  }

  const logs: Array<{ timestamp: string; stage: string; message: string }> =
    job.progress_data?.logs || [];

  const logMsg = (stage: OfferAnalysisStage | string, message: string) => {
    console.log(`[OFFER PIPELINE][${stage}] ${message}`);
    logs.push({ timestamp: new Date().toISOString(), stage, message });
  };

  const updateStage = async (
    stage: OfferAnalysisStage,
    message: string,
    extraProgress: Record<string, any> = {}
  ) => {
    logMsg(stage, message);
    const updated = await dbService.updateAnalysisJob(jobId, {
      current_stage: stage,
      stage_message: message,
      status: 'running',
      progress_data: {
        ...(job?.progress_data || {}),
        ...extraProgress,
        logs,
      },
    });
    if (updated) job = updated;
  };

  try {
    // -------------------------------------------------------------------------
    // STAGE 1: VALIDATING URL
    // -------------------------------------------------------------------------
    await updateStage('validating_url', 'Validando URL da Meta Ads Library...');
    const validation = validateMetaAdsLibraryUrl(job.input_url);
    if (!validation.isValid) {
      await dbService.updateAnalysisJob(jobId, {
        status: 'failed',
        error_code: 'INVALID_META_URL',
        error_message: validation.error || 'URL da Meta Ads Library inválida.',
        failed_at: new Date().toISOString(),
        progress_data: { ...job.progress_data, logs },
      });
      throw new Error(validation.error);
    }

    const metaAdsUrl = validation.normalizedUrl || job.input_url;

    // -------------------------------------------------------------------------
    // STAGE 2: OPENING META & STAGE 3: DISCOVERING ADS
    // -------------------------------------------------------------------------
    await updateStage('opening_meta', 'Abrindo navegador e conectando à Meta Ads Library...');

    const browser = await launchBrowser();
    let discoveredCards: any[] = [];

    try {
      const { page } = await createPage(browser);
      await updateStage('discovering_ads', 'Navegando e descobrindo anúncios ativos na biblioteca...');

      await loadMetaAdsPage(page, metaAdsUrl);
      const discoveryResult = await discoverAds(page, { maxAds: 100 });

      discoveredCards = discoveryResult.cards || [];
      await browser.close();
    } catch (browserErr: any) {
      await browser.close().catch(() => {});
      console.warn('[OFFER PIPELINE] Browser discovery warning:', browserErr.message);
    }

    const adIds = discoveredCards.map((c) => c.metaAdId).filter(Boolean);

    // Extract Advertiser & Candidate Product Name
    const advertiserCandidate = discoveredCards.find((c) => c.advertiser)?.advertiser || null;
    const firstHeadline = discoveredCards.find((c) => c.headline || c.primaryText);
    const candidateText = firstHeadline?.headline || firstHeadline?.primaryText || 'Oferta Meta Ads';
    const cleanProductName = candidateText.split('\n')[0].slice(0, 80).trim() || 'Oferta Meta Ads';

    // Extract Destination URLs from Ads
    const destinationUrls: string[] = discoveredCards
      .map((c) => c.destinationUrl)
      .filter((u): u is string => Boolean(u && u.startsWith('http')));

    const primaryDestUrl = destinationUrls[0] || null;

    await updateStage('identifying_offer', `Identificados ${discoveredCards.length} anúncios. Analisando oferta...`, {
      ads_count: discoveredCards.length,
      advertiser: advertiserCandidate,
      product_name: cleanProductName,
      landing_page_url: primaryDestUrl,
    });

    // -------------------------------------------------------------------------
    // STAGE 4: DUPLICATE CHECK & OFFER CREATION
    // -------------------------------------------------------------------------
    const existingOffers = await dbService.getOffers();
    const duplicateResult = detectExistingOfferAdvanced({
      candidateOffer: {
        product_name: cleanProductName,
        advertiser: advertiserCandidate,
        landing_page_url: primaryDestUrl,
      },
      metaAdIds: adIds,
      metaAdsUrl,
      existingOffers,
    });

    let targetOffer: Offer | null = null;

    if (duplicateResult.isDuplicate && duplicateResult.existingOffer && mode === 'new') {
      logMsg('identifying_offer', `Oferta existente duplicada encontrada: "${duplicateResult.existingOffer.product_name}"`);

      await dbService.updateAnalysisJob(jobId, {
        offer_id: duplicateResult.existingOffer.id,
        status: 'completed_with_warnings',
        current_stage: 'identifying_offer',
        stage_message: `Oferta já cadastrada: "${duplicateResult.existingOffer.product_name}"`,
        progress_data: {
          ...job.progress_data,
          duplicate_detected: true,
          existing_offer_id: duplicateResult.existingOffer.id,
          existing_offer_name: duplicateResult.existingOffer.product_name,
          ads_count: discoveredCards.length,
          advertiser: advertiserCandidate,
          product_name: duplicateResult.existingOffer.product_name,
          logs,
        },
      });

      return (await dbService.getAnalysisJob(jobId))!;
    }

    if (options?.offerId) {
      targetOffer = await dbService.getOfferById(options.offerId);
    } else if (duplicateResult.isDuplicate && duplicateResult.existingOffer) {
      targetOffer = duplicateResult.existingOffer;
    }

    const now = new Date().toISOString();

    if (!targetOffer) {
      const dedupeKey = generateDedupeKey({
        product_name: cleanProductName,
        advertiser: advertiserCandidate,
        landing_page_url: primaryDestUrl,
      });

      targetOffer = await dbService.saveOffer({
        product_name: cleanProductName,
        advertiser: advertiserCandidate,
        meta_ads_url: metaAdsUrl,
        landing_page_url: primaryDestUrl,
        landing_page_url_original: primaryDestUrl,
        active_ads_count: discoveredCards.length,
        status: 'ANALYZING',
        source: 'MANUAL_META_URL',
        dedupe_key: dedupeKey,
        extra_data: {
          meta_ads_url_original: job.input_url,
          meta_ad_ids: adIds,
          analysis_job_id: jobId,
        },
      });
    } else {
      const updatedName =
        cleanProductName && cleanProductName !== 'Oferta Meta Ads' && targetOffer.product_name.includes('Analisando')
          ? cleanProductName
          : targetOffer.product_name;

      const updatedAdv =
        advertiserCandidate && (targetOffer.advertiser || '').includes('Identificando')
          ? advertiserCandidate
          : targetOffer.advertiser || advertiserCandidate;

      await dbService.updateOffer(targetOffer.id, {
        product_name: updatedName,
        advertiser: updatedAdv,
        landing_page_url: primaryDestUrl || targetOffer.landing_page_url,
        landing_page_url_original: primaryDestUrl || targetOffer.landing_page_url_original,
        active_ads_count: Math.max(targetOffer.active_ads_count || 0, discoveredCards.length),
        status: 'ANALYZING',
        last_seen_at: now,
      });
    }

    await dbService.updateAnalysisJob(jobId, {
      offer_id: targetOffer.id,
      progress_data: {
        ...job.progress_data,
        offer_id: targetOffer.id,
        product_name: targetOffer.product_name,
        advertiser: targetOffer.advertiser,
      },
    });

    // -------------------------------------------------------------------------
    // STAGE 5: SAVING ADS TO DB
    // -------------------------------------------------------------------------
    await updateStage('saving_ads', `Persistindo ${discoveredCards.length} anúncios no banco de dados...`);

    const offerAdsToInsert: OfferAd[] = discoveredCards.map((card) => ({
      id: `ad_${targetOffer!.id}_${card.metaAdId}`,
      offer_id: targetOffer!.id,
      meta_ad_id: card.metaAdId,
      meta_ad_url: card.adUrl,
      advertiser: card.advertiser || targetOffer!.advertiser,
      status: card.status || 'Ativo',
      started_at: card.startedAt,
      primary_text: card.primaryText,
      headline: card.headline,
      description: card.description,
      cta: card.cta,
      destination_url: card.destinationUrl,
      capture_status: 'detected',
      first_seen_at: now,
      last_seen_at: now,
      created_at: now,
    }));

    if (offerAdsToInsert.length > 0) {
      for (const ad of offerAdsToInsert) {
        await dbService.saveOfferAd(ad);
      }
    }

    // -------------------------------------------------------------------------
    // STAGE 6: CAPTURING CREATIVES (MEDIA DOWNLOAD & STORAGE)
    // -------------------------------------------------------------------------
    await updateStage('capturing_creatives', 'Baixando mídias (vídeos/imagens) dos anúncios...');

    try {
      const creativeResult = await captureMetaAdsCreatives({
        offer: targetOffer,
        metaAdsUrl,
        options: {
          maxAds: 300,
          onProgress: (p) => {
            logMsg('capturing_creatives', p.message);
          },
        },
      });

      await updateStage('capturing_creatives', `Criativos capturados com sucesso.`, {
        creatives_count: creativeResult.uniqueCreativesCount,
        videos_count: creativeResult.videosCount,
        images_count: creativeResult.imagesCount,
        unique_creatives_count: creativeResult.uniqueCreativesCount,
      });
    } catch (creativeErr: any) {
      console.warn('[OFFER PIPELINE] Creative capture warning:', creativeErr.message);
      logMsg('capturing_creatives', `Aviso ao baixar mídias: ${creativeErr.message}`);
    }

    // Refresh offer state
    targetOffer = (await dbService.getOfferById(targetOffer.id)) || targetOffer;

    // -------------------------------------------------------------------------
    // STAGE 7: RESOLVING LANDING PAGE
    // -------------------------------------------------------------------------
    await updateStage('resolving_landing_page', 'Resolvendo a Landing Page de destino...');

    let resolvedLpUrl = targetOffer.landing_page_url || primaryDestUrl;

    if (resolvedLpUrl && (resolvedLpUrl.includes('pay.') || resolvedLpUrl.includes('kiwify') || resolvedLpUrl.includes('hotmart') || resolvedLpUrl.includes('wiapy'))) {
      targetOffer.landing_page_flow_type = 'DIRECT_TO_CHECKOUT';
      targetOffer.checkout_url = resolvedLpUrl;
      await dbService.updateOffer(targetOffer.id, {
        landing_page_flow_type: 'DIRECT_TO_CHECKOUT',
        checkout_url: resolvedLpUrl,
      });
      logMsg('resolving_landing_page', 'Fluxo identificado como Direto ao Checkout.');
    }

    // -------------------------------------------------------------------------
    // STAGE 8 & 9: CAPTURING & MAPPING LANDING PAGE
    // -------------------------------------------------------------------------
    if (resolvedLpUrl && targetOffer.landing_page_flow_type !== 'DIRECT_TO_CHECKOUT') {
      await updateStage('capturing_landing_page', `Capturando visualmente a Landing Page...`);

      try {
        await updateStage('mapping_landing_page', 'Extraindo copy, ofertas, bônus e entregáveis da LP...');
        const lpAnalysis = await analyzeAndMapLandingPage(
          targetOffer.id,
          resolvedLpUrl,
          job.user_id,
          (ev) => logMsg('mapping_landing_page', ev.message)
        );

        await updateStage('syncing_offer_data', 'Sincronizando dossiê da oferta com evidências extraídas...');
        await dbService.syncLandingPageToOffer(targetOffer.id, lpAnalysis);

        await updateStage('mapping_landing_page', 'Landing Page mapeada com sucesso.', {
          landing_page_url: resolvedLpUrl,
          landing_page_status: 'MAPEADA',
          deliverables_count: lpAnalysis.commerce.deliverables.length,
          bonuses_count: lpAnalysis.commerce.bonuses.length,
          front_price: lpAnalysis.commerce.currentPrice || targetOffer.price,
        });
      } catch (lpErr: any) {
        console.warn('[OFFER PIPELINE] LP analysis warning:', lpErr.message);
        logMsg('mapping_landing_page', `Aviso ao mapear Landing Page: ${lpErr.message}`);
      }
    }

    // Refresh offer state
    targetOffer = (await dbService.getOfferById(targetOffer.id)) || targetOffer;

    // -------------------------------------------------------------------------
    // STAGE 10: CHECKOUT INTELLIGENCE
    // -------------------------------------------------------------------------
    await updateStage('resolving_checkout', 'Localizando botão de compra e testando checkout...');

    try {
      await updateStage('mapping_checkout', 'Executando navegação de CTA e extraindo Order Bumps...');
      const checkoutResult = await mapCheckout(targetOffer.id);

      await updateStage('mapping_checkout', `Checkout verificado com sucesso (${checkoutResult.provider || 'N/D'}).`, {
        checkout_url: checkoutResult.checkoutUrl,
        checkout_status: checkoutResult.status,
        checkout_provider: checkoutResult.provider,
        order_bumps_count: checkoutResult.orderBumps.length,
        front_price: checkoutResult.checkoutPrice || targetOffer.price,
      });
    } catch (chkErr: any) {
      console.warn('[OFFER PIPELINE] Checkout intelligence warning:', chkErr.message);
      logMsg('mapping_checkout', `Aviso na análise de Checkout: ${chkErr.message}`);
    }

    // Refresh offer state
    targetOffer = (await dbService.getOfferById(targetOffer.id)) || targetOffer;

    // -------------------------------------------------------------------------
    // STAGE 11 & 12: FINALIZING & BUILDING FUNNEL
    // -------------------------------------------------------------------------
    await updateStage('building_funnel', 'Estruturando esteira de funil observada...');
    await updateStage('finalizing', 'Finalizando montagem do dossiê da oferta...');

    // Calculate final status
    const finalDataStatus =
      targetOffer.deliverables && targetOffer.deliverables.length > 0 ? 'MAPEADA' : 'DADOS_PARCIAIS';

    await dbService.updateOffer(targetOffer.id, {
      status: finalDataStatus,
    });

    const hasWarnings = logs.some((l) => l.message.includes('Aviso') || l.message.includes('warning'));
    const finalJobStatus = hasWarnings ? 'completed_with_warnings' : 'completed';

    const finalJob = await dbService.updateAnalysisJob(jobId, {
      offer_id: targetOffer.id,
      status: finalJobStatus,
      current_stage: 'finalizing',
      stage_message: 'Análise de oferta concluída!',
      completed_at: new Date().toISOString(),
      progress_data: {
        ...job.progress_data,
        offer_id: targetOffer.id,
        product_name: targetOffer.product_name,
        advertiser: targetOffer.advertiser,
        ads_count: targetOffer.active_ads_count || discoveredCards.length,
        landing_page_url: targetOffer.landing_page_url,
        checkout_url: targetOffer.checkout_url,
        checkout_provider: targetOffer.checkout_platform,
        front_price: targetOffer.price,
        order_bumps_count: targetOffer.order_bumps?.length || 0,
        deliverables_count: targetOffer.deliverables?.length || 0,
        bonuses_count: targetOffer.bonuses?.length || 0,
        logs,
      },
    });

    return finalJob!;
  } catch (err: any) {
    console.error(`[OFFER PIPELINE FATAL ERROR] Job ${jobId}:`, err);

    // Keep persistent offer in database with status DADOS_PARCIAIS (never delete)
    const targetId = options?.offerId || job?.offer_id;
    if (targetId) {
      await dbService.updateOffer(targetId, {
        status: 'DADOS_PARCIAIS',
      }).catch(() => {});
    }

    await dbService.updateAnalysisJob(jobId, {
      status: 'failed',
      error_code: 'PIPELINE_ERROR',
      error_message: err.message || 'Falha ao executar pipeline de análise da oferta.',
      failed_at: new Date().toISOString(),
      progress_data: { ...job?.progress_data, logs },
    });

    throw err;
  }
}
