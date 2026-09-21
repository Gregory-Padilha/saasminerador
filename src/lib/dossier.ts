// ==============================================================================
// OFFER MINER - DOSSIER COMPLETENESS & FACTUAL UTILS
// ==============================================================================

import {
  Offer,
  DossierCompleteness,
  DataStatus,
  OfferEnrichmentState,
  OfferPipelineBreakdown,
  isLandingPageMapped,
  isCheckoutMapped,
} from '@/types';

/**
 * Key factual dimensions expected in a complete offer dossier.
 */
export const DOSSIER_FIELDS = [
  { key: 'product_name', label: 'Nome do Produto' },
  { key: 'advertiser', label: 'Anunciante' },
  { key: 'niche', label: 'Nicho' },
  { key: 'subniche', label: 'Subnicho' },
  { key: 'product_type', label: 'Tipo de Produto' },
  { key: 'price', label: 'Preço' },
  { key: 'active_ads_count', label: 'Volume de Ads' },
  { key: 'estimated_unique_creatives', label: 'Criativos Distintos' },
  { key: 'days_running', label: 'Dias Rodando' },
  { key: 'faceless', label: 'Operação Faceless' },
  { key: 'meta_ads_url', label: 'Meta Ads Library URL' },
  { key: 'landing_page_url', label: 'Página de Vendas (LP)' },
  { key: 'headline', label: 'Headline Principal' },
  { key: 'promise', label: 'Promessa Central' },
  { key: 'ad_format', label: 'Formato de Criativo' },
] as const;

/**
 * Calculates factual completeness of an offer dossier.
 * This measures purely how many expected data fields have been captured (e.g. 11/15 = 73%).
 * It does NOT judge quality, profitability, or ROI.
 */
export function calculateDossierCompleteness(offer: Partial<Offer>): DossierCompleteness {
  const filledFields: string[] = [];
  const missingFields: string[] = [];

  for (const field of DOSSIER_FIELDS) {
    const val = (offer as any)[field.key];
    if (val !== null && val !== undefined && val !== '') {
      filledFields.push(field.label);
    } else {
      missingFields.push(field.label);
    }
  }

  const completedCount = filledFields.length;
  const totalCount = DOSSIER_FIELDS.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return {
    percentage,
    completedCount,
    totalCount,
    filledFields,
    missingFields,
  };
}

/**
 * Derives days running from explicit days_running field or oldest_ad_date / first_seen.
 * Ensures that if a start date is present, days_running is calculated deterministically.
 */
export function deriveDaysRunning(offer: Partial<Offer>): number | null {
  if (
    offer.days_running !== null &&
    offer.days_running !== undefined &&
    typeof offer.days_running === 'number' &&
    offer.days_running > 0
  ) {
    return offer.days_running;
  }

  const rawDate =
    offer.oldest_ad_date ||
    (offer as any).first_seen_at ||
    (offer as any).first_seen;

  if (!rawDate) return null;

  try {
    const timestamp = new Date(rawDate).getTime();
    if (isNaN(timestamp)) return null;

    const diffMs = Date.now() - timestamp;
    if (diffMs < 0) return 1; // Future dates or same day clamp to 1

    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

/**
 * Detailed breakdown of each individual pipeline stage for an offer.
 */
export function getOfferPipelineBreakdown(offer: Partial<Offer>): OfferPipelineBreakdown {
  // 1. SCALE
  const activeAds = offer.active_ads_count;
  const hasValidScale = activeAds !== null && activeAds !== undefined;
  const scaleStage: OfferPipelineBreakdown['scale'] = {
    status: hasValidScale ? 'SUCCESS' : 'NOT_PROCESSED',
    activeAdsCount: hasValidScale ? activeAds : null,
    isVerified: hasValidScale,
    label: hasValidScale ? `${activeAds} ads ativos` : 'Não coletado',
  };

  // 2. CREATIVES
  const capturedCount = offer.captured_creatives_count;
  const uniqueCount = offer.estimated_unique_creatives;
  let creativesStatus: OfferPipelineBreakdown['creatives']['status'] = 'NOT_PROCESSED';
  let creativesCount: number | null = null;
  let creativesVerified = false;
  let creativesLabel = 'Não coletado';

  if (capturedCount && capturedCount > 0) {
    creativesStatus = 'SUCCESS';
    creativesCount = capturedCount;
    creativesVerified = true;
    creativesLabel = `${capturedCount} criativos salvos`;
  } else if (uniqueCount !== null && uniqueCount !== undefined) {
    if (uniqueCount === 0) {
      creativesStatus = 'CONFIRMED_ZERO';
      creativesCount = 0;
      creativesVerified = true;
      creativesLabel = '0 criativos confirmados';
    } else {
      creativesStatus = 'SUCCESS';
      creativesCount = uniqueCount;
      creativesVerified = true;
      creativesLabel = `${uniqueCount} criativos`;
    }
  }

  const creativesStage: OfferPipelineBreakdown['creatives'] = {
    status: creativesStatus,
    count: creativesCount,
    isVerified: creativesVerified,
    label: creativesLabel,
  };

  // 3. LANDING PAGE
  const lpMapped = isLandingPageMapped(offer);
  let lpStatus: OfferPipelineBreakdown['landingPage']['status'] = 'NOT_MAPPED';
  let lpLabel = 'Não mapeada';

  if (lpMapped) {
    lpStatus = 'SUCCESS';
    lpLabel = 'Mapeada';
  } else if (offer.lp_mapping_status === 'RUNNING') {
    lpStatus = 'RUNNING';
    lpLabel = 'Mapeando...';
  } else if (offer.lp_mapping_status === 'BLOCKED') {
    lpStatus = 'BLOCKED';
    lpLabel = 'Bloqueada';
  } else if (offer.lp_mapping_status === 'FAILED') {
    lpStatus = 'FAILED';
    lpLabel = 'Falha no mapeamento';
  }

  const landingPageStage: OfferPipelineBreakdown['landingPage'] = {
    status: lpStatus,
    isMapped: lpMapped,
    hasArtifact: lpMapped,
    price: offer.price ?? null,
    label: lpLabel,
  };

  // 4. CHECKOUT
  const checkoutDiscovery = offer.checkout_discovery_status || 'NOT_PROCESSED';
  const checkoutMapping = offer.checkout_mapping_status || 'NOT_MAPPED';
  let checkoutProcessed = false;
  let checkoutLabel = 'Não processado';

  if (checkoutDiscovery === 'NOT_FOUND' || checkoutMapping === 'NOT_APPLICABLE') {
    checkoutProcessed = true;
    checkoutLabel = 'Não aplicável (sem checkout direto)';
  } else if (checkoutDiscovery === 'FOUND') {
    if (checkoutMapping === 'SUCCESS' || isCheckoutMapped(offer)) {
      checkoutProcessed = true;
      checkoutLabel = 'Mapeado';
    } else if (checkoutMapping === 'RUNNING') {
      checkoutProcessed = false;
      checkoutLabel = 'Mapeando checkout...';
    } else {
      checkoutProcessed = false;
      checkoutLabel = 'Checkout encontrado (mapeamento pendente)';
    }
  } else if (checkoutDiscovery === 'RUNNING') {
    checkoutProcessed = false;
    checkoutLabel = 'Buscando checkout...';
  }

  const checkoutStage: OfferPipelineBreakdown['checkout'] = {
    discoveryStatus: checkoutDiscovery as any,
    mappingStatus: checkoutMapping as any,
    isProcessed: checkoutProcessed,
    checkoutUrl: offer.checkout_url || null,
    platform: (offer.extra_data as any)?.checkout_platform || null,
    label: checkoutLabel,
  };

  return {
    scale: scaleStage,
    creatives: creativesStage,
    landingPage: landingPageStage,
    checkout: checkoutStage,
  };
}

/**
 * Derives the comprehensive OfferEnrichmentState for the catalog.
 * Invariants enforced:
 * - Badge 'MAPEADA' requires ALL canonical pillars: Scale, Creatives, Landing Page, and Checkout.
 * - If active_ads_count is null and no scale observation exists, state is PARTIAL.
 * - If creatives have not been collected, state is PARTIAL.
 * - If landing page is not mapped, state cannot be MAPPED.
 */
export function getOfferEnrichmentState(offer: Partial<Offer>): {
  state: OfferEnrichmentState;
  breakdown: OfferPipelineBreakdown;
  missingRequirements: string[];
} {
  const breakdown = getOfferPipelineBreakdown(offer);
  const missingRequirements: string[] = [];

  // Check active jobs
  if (
    offer.lp_mapping_status === 'RUNNING' ||
    offer.checkout_mapping_status === 'RUNNING' ||
    offer.status === 'ANALYZING'
  ) {
    return {
      state: 'MAPPING',
      breakdown,
      missingRequirements: ['Etapa em execução'],
    };
  }

  // Evaluate Landing Page
  if (!breakdown.landingPage.isMapped) {
    missingRequirements.push('Landing page não mapeada');
  }

  // Evaluate Scale (Mandatory in Offer Miner)
  if (!breakdown.scale.isVerified || breakdown.scale.activeAdsCount === null) {
    missingRequirements.push('Volume de ads ativos não coletado');
  }

  // Evaluate Creatives
  if (!breakdown.creatives.isVerified) {
    missingRequirements.push('Criativos não coletados');
  }

  // Evaluate Checkout
  if (!breakdown.checkout.isProcessed) {
    missingRequirements.push('Checkout pendente de processamento');
  }

  // If all mandatory requirements met -> MAPPED
  if (missingRequirements.length === 0) {
    return {
      state: 'MAPPED',
      breakdown,
      missingRequirements: [],
    };
  }

  // If none of the stages have succeeded/processed -> UNMAPPED
  const anyStageProcessed =
    breakdown.landingPage.isMapped ||
    breakdown.scale.isVerified ||
    breakdown.creatives.isVerified ||
    breakdown.checkout.isProcessed;

  if (!anyStageProcessed) {
    return {
      state: 'UNMAPPED',
      breakdown,
      missingRequirements,
    };
  }

  // Some stages completed, but critical data remains missing -> PARTIAL
  return {
    state: 'PARTIAL',
    breakdown,
    missingRequirements,
  };
}

/**
 * Derives the objective Data Status for catalog presentation and backward compatibility.
 * CRITICAL RULE: MAPEADA can ONLY be returned if getOfferEnrichmentState(offer) === 'MAPPED'.
 * Landing page mapping alone NEVER grants 'MAPEADA' status!
 */
export function deriveDataStatus(offer: Partial<Offer>): DataStatus {
  if (offer.status === 'ANALYZING') {
    return 'ANALYZING';
  }

  if (offer.status === 'ANALISADA' || (offer.analysis && Object.keys(offer.analysis).length > 0)) {
    return 'ANALISADA';
  }

  const { state } = getOfferEnrichmentState(offer);

  if (state === 'MAPPED') {
    return 'MAPEADA';
  }

  if (state === 'MAPPING') {
    return 'ANALYZING';
  }

  if (state === 'PARTIAL') {
    return 'DADOS_PARCIAIS';
  }

  const completeness = calculateDossierCompleteness(offer);

  // Partial data if essential metadata fields exist or completeness is >= 30%
  const hasSomeCoreData =
    Boolean(offer.price) ||
    Boolean(offer.advertiser) ||
    Boolean(offer.landing_page_url || offer.landing_page_url_original) ||
    Boolean(offer.meta_ads_url);

  if (completeness.percentage >= 30 || hasSomeCoreData) {
    return 'DADOS_PARCIAIS';
  }

  return 'NOVA';
}

/**
 * Alias / Backward compatible helper for deriveDataStatus.
 * Guaranteed to NEVER return 'ARQUIVADA' or 'ACOMPANHANDO'.
 */
export function deriveResearchStatus(offer: Partial<Offer>): DataStatus {
  return deriveDataStatus(offer);
}

