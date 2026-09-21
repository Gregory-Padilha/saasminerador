// ==============================================================================
// OFFER MINER - LANDING PAGE DATA COLLECTOR
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, FieldProvenance } from '@/types';

export interface LandingPageHarvest {
  status: 'SUCCESS' | 'PARTIAL' | 'NOT_AVAILABLE' | 'FAILED';
  fieldsLoaded: string[];
  provenanceMap: Record<string, FieldProvenance>;
  data: {
    pageTitle?: string | null;
    productName?: string | null;
    advertiser?: string | null;
    headline?: string | null;
    subheadline?: string | null;
    promise?: string | null;
    description?: string | null;
    productType?: string | null;
    productFormat?: string | null;
    frontPrice?: number | null;
    oldPrice?: number | null;
    currency?: string;
    ctaTexts?: string[];
    deliverables?: Array<{ name: string; description?: string }>;
    bonuses?: Array<{ name: string; description?: string; value?: number }>;
    guaranteeDays?: number | null;
    guaranteeText?: string | null;
    faqs?: Array<{ question: string; answer: string }>;
    socialProof?: string[];
    audienceLanguage?: string[];
    painPoints?: string[];
    desiredOutcomes?: string[];
    mechanism?: string | null;
    niche?: string | null;
    subniche?: string | null;
    nicheSignals?: string[];
    checkoutLinks?: string[];
    contactInfo?: string | null;
  };
  error?: string;
}

/**
 * Classifies niche and subniche based on text signals, title, headline and product name.
 */
export function classifyNicheFromSignals(
  text: string,
  productName: string,
  headline?: string
): { niche: string | null; subniche: string | null; signals: string[] } {
  const combined = `${productName} ${headline || ''} ${text}`.toLowerCase();
  const signals: string[] = [];

  // 1. Idiomas / Cursos de Línguas
  if (/alemão|alemao|ingles|inglês|espanhol|italiano|frances|francês|idioma|fluencia|pronuncia|gramatical/i.test(combined)) {
    signals.push('idiomas', 'curso de língua');
    let sub = 'Geral';
    if (/alemão|alemao/i.test(combined)) sub = 'Alemão';
    else if (/ingles|inglês/i.test(combined)) sub = 'Inglês';
    else if (/espanhol/i.test(combined)) sub = 'Espanhol';
    return { niche: 'Idiomas', subniche: sub, signals };
  }

  // 2. Saúde / Terapia / Psicologia / CAPS
  if (/caps|terapêutica|terapeutica|terapia|psicologia|saúde mental|saude mental|pacientes|emocional|acolhimento/i.test(combined)) {
    signals.push('saúde mental', 'terapia', 'dinâmicas');
    let sub = 'Terapia & CAPS';
    if (/caps/i.test(combined)) sub = 'Dinâmicas para CAPS';
    else if (/psicologia/i.test(combined)) sub = 'Psicologia Clínica';
    return { niche: 'Saúde & Bem-Estar', subniche: sub, signals };
  }

  // 3. Educação / Pedagogia / Alfabetização / Atividades Infantis
  if (
    /frações|fracoes|lapbook|bncc|pedagogia|pedagógica|pedagogica|alfabetização|alfabetizacao|fonológica|fonologica|ensino fundamental|educação infantil|educacao infantil|rotina escolar|sala de aula|professores|atividades escolares/i.test(
      combined
    )
  ) {
    signals.push('educação', 'material pedagógico');
    let sub = 'Recursos Pedagógicos';
    if (/frações|fracoes|matemática|matematica/i.test(combined)) sub = 'Matemática / Ensino Fundamental';
    else if (/fonológica|fonologica|alfabetização/i.test(combined)) sub = 'Alfabetização & Fonologia';
    else if (/computação|computacional|bncc/i.test(combined)) sub = 'Tecnologia & Computação BNCC';
    else if (/educação infantil/i.test(combined)) sub = 'Educação Infantil';
    return { niche: 'Educação', subniche: sub, signals };
  }

  // 4. Negócios / Marketing / Renda Extra
  if (/marketing|vendas|afiliado|dropshipping|renda extra|tráfego|trafego|plp|copywriting/i.test(combined)) {
    signals.push('negócios', 'vendas');
    return { niche: 'Negócios & Carreira', subniche: 'Marketing Digital', signals };
  }

  // 5. Relacionamento / Desenvolvimento Pessoal
  if (/autoestima|relacionamento|conquista|desenvolvimento pessoal|produtividade|hábito/i.test(combined)) {
    signals.push('desenvolvimento pessoal');
    return { niche: 'Desenvolvimento Pessoal', subniche: 'Autoajuda & Relacionamentos', signals };
  }

  return { niche: null, subniche: null, signals };
}

export async function collectLandingPageData(offer: Offer): Promise<LandingPageHarvest> {
  const fieldsLoaded: string[] = [];
  const provenanceMap: Record<string, FieldProvenance> = {};
  const data: LandingPageHarvest['data'] = {};
  const now = new Date().toISOString();

  const targetUrl = offer.landing_page_url;
  if (!targetUrl || targetUrl.trim() === '') {
    return {
      status: 'NOT_AVAILABLE',
      fieldsLoaded: [],
      provenanceMap: {},
      data: {},
      error: 'Oferta não possui landing_page_url definida.',
    };
  }

  try {
    // 1. First: Inspect already existing LP capture artifacts
    const lpCaptures = await dbService.getLandingPageCaptures(offer.id);
    const existingCapture = lpCaptures.find(
      (c) => c.capture_status === 'ready' || c.capture_status === 'analyzed' || (c.raw_data && c.raw_data.analysis)
    );

    let fullPageText = '';

    if (existingCapture) {
      if (existingCapture.page_title) {
        data.pageTitle = existingCapture.page_title;
        fieldsLoaded.push('page_title');
        provenanceMap['page_title'] = {
          field: 'page_title',
          value: existingCapture.page_title,
          source: 'LANDING_PAGE',
          observedAt: existingCapture.captured_at || now,
          type: 'OBSERVED',
        };
      }

      const analysis = existingCapture.raw_data?.analysis;
      if (analysis) {
        // Headline
        const heroHeadline = analysis.heroXRay?.headline;
        const copyHeadlines = Array.isArray(analysis.copy?.headlines) ? analysis.copy.headlines : [];
        const primaryHeadline = heroHeadline || copyHeadlines[0];
        if (primaryHeadline) {
          data.headline = primaryHeadline;
          fieldsLoaded.push('headline');
          provenanceMap['headline'] = {
            field: 'headline',
            value: primaryHeadline,
            source: 'LANDING_PAGE',
            observedAt: now,
            type: 'OBSERVED',
          };
        }

        // Subheadline
        const copySubheadlines = Array.isArray(analysis.copy?.subheadlines) ? analysis.copy.subheadlines : [];
        if (copySubheadlines.length > 0) {
          data.subheadline = copySubheadlines[0];
          fieldsLoaded.push('subheadline');
          provenanceMap['subheadline'] = {
            field: 'subheadline',
            value: copySubheadlines[0],
            source: 'LANDING_PAGE',
            observedAt: now,
            type: 'OBSERVED',
          };
        }

        // Promise
        const heroPromise = analysis.heroXRay?.promise;
        const copyPromises = Array.isArray(analysis.copy?.promises) ? analysis.copy.promises : [];
        const primaryPromise = heroPromise || copyPromises[0];
        if (primaryPromise) {
          data.promise = primaryPromise;
          fieldsLoaded.push('promise');
          provenanceMap['promise'] = {
            field: 'promise',
            value: primaryPromise,
            source: 'LANDING_PAGE',
            observedAt: now,
            type: 'OBSERVED',
          };
        }

        // Commerce / Prices
        const comm = analysis.commerce;
        if (comm) {
          if (typeof comm.currentPrice === 'number' && comm.currentPrice > 0) {
            data.frontPrice = comm.currentPrice;
            data.currency = comm.currency || 'BRL';
            fieldsLoaded.push('front_price');
            provenanceMap['front_price'] = {
              field: 'front_price',
              value: comm.currentPrice,
              source: 'LANDING_PAGE',
              observedAt: now,
              type: 'OBSERVED',
            };
          }

          if (typeof comm.originalPrice === 'number' && comm.originalPrice > (comm.currentPrice || 0)) {
            data.oldPrice = comm.originalPrice;
            fieldsLoaded.push('old_price');
            provenanceMap['old_price'] = {
              field: 'old_price',
              value: comm.originalPrice,
              source: 'LANDING_PAGE',
              observedAt: now,
              type: 'OBSERVED',
            };
          }

          if (Array.isArray(comm.checkoutUrls) && comm.checkoutUrls.length > 0) {
            data.checkoutLinks = comm.checkoutUrls;
          }
        }

        // Copy elements
        const copy = analysis.copy;
        if (copy) {
          if (Array.isArray(copy.ctas) && copy.ctas.length > 0) {
            data.ctaTexts = copy.ctas;
          }
          if (Array.isArray(copy.painPoints) && copy.painPoints.length > 0) {
            data.painPoints = copy.painPoints;
          }
          if (Array.isArray(copy.guarantees) && copy.guarantees.length > 0) {
            data.guaranteeText = copy.guarantees[0];
            fieldsLoaded.push('guarantee');
            provenanceMap['guarantee'] = {
              field: 'guarantee',
              value: copy.guarantees[0],
              source: 'LANDING_PAGE',
              observedAt: now,
              type: 'OBSERVED',
            };
          }
        }

        // Construct full text sample for semantic analysis
        fullPageText = [
          existingCapture.page_title,
          data.headline,
          data.subheadline,
          data.promise,
          ...(copyHeadlines || []),
          ...(copySubheadlines || []),
        ]
          .filter(Boolean)
          .join(' ');
      }
    }

    // 2. Semantic Niche Classification from LP text and Product Name
    const classification = classifyNicheFromSignals(
      fullPageText,
      offer.product_name,
      data.headline || undefined
    );

    if (classification.niche) {
      data.niche = classification.niche;
      data.subniche = classification.subniche;
      data.nicheSignals = classification.signals;
      fieldsLoaded.push('niche');
      provenanceMap['niche'] = {
        field: 'niche',
        value: classification.niche,
        source: 'LANDING_PAGE',
        observedAt: now,
        type: 'INFERRED',
        evidenceQuote: `Sinais detectados: ${classification.signals.join(', ')} | Subnicho: ${classification.subniche || 'Nenhum'}`,
      };

      if (classification.subniche) {
        fieldsLoaded.push('subniche');
        provenanceMap['subniche'] = {
          field: 'subniche',
          value: classification.subniche,
          source: 'LANDING_PAGE',
          observedAt: now,
          type: 'INFERRED',
        };
      }
    }

    const status = fieldsLoaded.length > 0 ? 'SUCCESS' : 'PARTIAL';

    return {
      status,
      fieldsLoaded,
      provenanceMap,
      data,
    };
  } catch (err: any) {
    console.error('[LP DATA COLLECTOR ERROR]:', err);
    return {
      status: 'FAILED',
      fieldsLoaded: [],
      provenanceMap: {},
      data: {},
      error: err.message || 'Falha ao coletar dados da landing page.',
    };
  }
}
