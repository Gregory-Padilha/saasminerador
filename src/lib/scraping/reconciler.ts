// ==============================================================================
// OFFER MINER - OFFER ENRICHMENT RECONCILER
// ==============================================================================

import {
  Offer,
  FieldProvenance,
  OfferFieldConflict,
  OfferReconciliationReport,
  OfferDataScrapingStatus,
} from '@/types';
import { ExistingArtifactHarvest } from './collectors/ExistingArtifactCollector';
import { LandingPageHarvest } from './collectors/LandingPageDataCollector';
import { MetaAdsHarvest } from './collectors/MetaAdsDataCollector';
import { CreativeHarvest } from './collectors/CreativeDataCollector';
import { CheckoutHarvest } from './collectors/CheckoutDataCollector';
import { deriveDaysRunning } from '@/lib/dossier';

export interface ReconciliationInput {
  currentOffer: Offer;
  existingArtifacts: ExistingArtifactHarvest;
  lp: LandingPageHarvest;
  meta: MetaAdsHarvest;
  creative: CreativeHarvest;
  checkout: CheckoutHarvest;
}

export interface ReconciliationOutput {
  patch: Partial<Offer>;
  report: OfferReconciliationReport;
  status: OfferDataScrapingStatus;
}

/**
 * Reconciles multi-collector observations against canonical offer fields.
 * Applies strict priority order, enforces domain write-whitelists, detects conflicts,
 * and preserves user locked fields.
 */
export function reconcileOfferData(input: ReconciliationInput): ReconciliationOutput {
  const { currentOffer, existingArtifacts, lp, meta, creative, checkout } = input;
  const now = new Date().toISOString();
  const startTime = Date.now();

  const patch: Partial<Offer> = {};
  const provenanceMap: Record<string, FieldProvenance> = {
    ...(currentOffer.provenance_map as any || {}),
  };
  const conflicts: OfferFieldConflict[] = [];
  const lockedFields = new Set<string>(currentOffer.locked_fields || []);

  const isLocked = (field: string): boolean => lockedFields.has(field);

  // --------------------------------------------------------------------------
  // 1. PRICE RECONCILIATION & CONFLICT DETECTION
  // Priority: Confirmed Checkout Price > LP Purchase Price > Existing > Unknown
  // --------------------------------------------------------------------------
  if (!isLocked('price')) {
    const checkoutPrice = checkout.data.frontPrice ?? existingArtifacts.data.checkoutPrice ?? null;
    const lpPrice = lp.data.frontPrice ?? existingArtifacts.data.price ?? null;

    if (checkoutPrice && lpPrice && Math.abs(checkoutPrice - lpPrice) > 0.05) {
      // Conflict detected!
      conflicts.push({
        field: 'price',
        primaryValue: checkoutPrice,
        primarySource: 'CHECKOUT',
        conflictingValue: lpPrice,
        conflictingSource: 'LANDING_PAGE',
        description: `Preço no checkout (R$ ${checkoutPrice.toFixed(2)}) difere do anunciado na LP (R$ ${lpPrice.toFixed(2)})`,
        detectedAt: now,
      });

      // Resolved to checkout price (source of truth for payment)
      patch.price = checkoutPrice;
      patch.currency = checkout.data.currency || 'BRL';
      provenanceMap['price'] = {
        field: 'price',
        value: checkoutPrice,
        source: 'CHECKOUT',
        observedAt: now,
        type: 'OBSERVED',
        evidenceQuote: `Valor cobrado no checkout (conflito com LP anunciando R$ ${lpPrice.toFixed(2)})`,
      };
    } else if (checkoutPrice) {
      patch.price = checkoutPrice;
      patch.currency = checkout.data.currency || 'BRL';
      provenanceMap['price'] = {
        field: 'price',
        value: checkoutPrice,
        source: 'CHECKOUT',
        observedAt: now,
        type: 'OBSERVED',
      };
    } else if (lpPrice) {
      patch.price = lpPrice;
      patch.currency = lp.data.currency || 'BRL';
      provenanceMap['price'] = {
        field: 'price',
        value: lpPrice,
        source: 'LANDING_PAGE',
        observedAt: now,
        type: 'OBSERVED',
      };
    }
  }

  // --------------------------------------------------------------------------
  // 2. ACTIVE ADS COUNT RECONCILIATION
  // Priority: Confirmed Meta Ads Cluster > Trusted Worker Import > History > Unknown
  // Rule: NEVER map creative count to active ads. NEVER map "Yes" to 1.
  // --------------------------------------------------------------------------
  if (!isLocked('active_ads_count')) {
    const metaClusterAds = meta.cluster.activeAdsCount;
    const existingAdsCount = existingArtifacts.data.activeAdsCount;

    if (typeof metaClusterAds === 'number') {
      patch.active_ads_count = metaClusterAds;
      provenanceMap['active_ads_count'] = {
        field: 'active_ads_count',
        value: metaClusterAds,
        source: 'META_ADS_CLUSTER',
        observedAt: now,
        type: 'OBSERVED',
        evidenceQuote: `Cluster identificou ${metaClusterAds} anúncios ativos para esta oferta.`,
      };
    } else if (typeof existingAdsCount === 'number') {
      patch.active_ads_count = existingAdsCount;
      provenanceMap['active_ads_count'] = {
        field: 'active_ads_count',
        value: existingAdsCount,
        source: 'META_ADS_CLUSTER',
        observedAt: now,
        type: 'OBSERVED',
      };
    } else if (currentOffer.active_ads_count !== undefined && currentOffer.active_ads_count !== null) {
      // Retain existing trusted numeric count
      patch.active_ads_count = currentOffer.active_ads_count;
    } else {
      // Explicitly null / unknown - DO NOT FABRICATE
      patch.active_ads_count = null;
    }
  }

  // --------------------------------------------------------------------------
  // 3. CREATIVES METRICS RECONCILIATION
  // Separate from active ads count
  // --------------------------------------------------------------------------
  if (!isLocked('unique_creatives_count')) {
    const uniqueCount = creative.data.uniqueCreativesCount ?? existingArtifacts.data.uniqueCreativesCount ?? null;
    if (typeof uniqueCount === 'number') {
      patch.unique_creatives_count = uniqueCount;
      patch.captured_unique_creatives = uniqueCount;
      patch.captured_videos_count = creative.data.videoCreativesCount;
      patch.captured_images_count = creative.data.imageCreativesCount;
      patch.stored_media_count = creative.data.storedMediaCount;
      provenanceMap['unique_creatives_count'] = {
        field: 'unique_creatives_count',
        value: uniqueCount,
        source: 'META_ADS',
        observedAt: now,
        type: 'OBSERVED',
      };
    }
  }

  // --------------------------------------------------------------------------
  // 4. NICHE & SUBNICHE RECONCILIATION
  // Priority: LP Semantic Classification > Existing Offer Niche > Unknown
  // --------------------------------------------------------------------------
  if (!isLocked('niche')) {
    if (lp.data.niche) {
      patch.niche = lp.data.niche;
      provenanceMap['niche'] = lp.provenanceMap['niche'] || {
        field: 'niche',
        value: lp.data.niche,
        source: 'LANDING_PAGE',
        observedAt: now,
        type: 'INFERRED',
      };
    }
    if (lp.data.subniche && !isLocked('subniche')) {
      patch.subniche = lp.data.subniche;
      provenanceMap['subniche'] = lp.provenanceMap['subniche'] || {
        field: 'subniche',
        value: lp.data.subniche,
        source: 'LANDING_PAGE',
        observedAt: now,
        type: 'INFERRED',
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. FIRST SEEN & DAYS RUNNING RECONCILIATION
  // Priority: Earliest Meta ad date > Earliest import date > Existing
  // --------------------------------------------------------------------------
  if (!isLocked('first_seen_at')) {
    const metaOldest = meta.cluster.earliestAdStartDate;
    const existingOldest = currentOffer.oldest_ad_date || currentOffer.first_seen_at;

    const resolvedOldest = metaOldest || existingOldest || null;
    if (resolvedOldest) {
      patch.oldest_ad_date = resolvedOldest;
      patch.first_seen_at = resolvedOldest;

      // Deterministically derive days_running
      const dummyOffer: Offer = {
        ...currentOffer,
        oldest_ad_date: resolvedOldest,
        first_seen_at: resolvedOldest,
      };
      const days = deriveDaysRunning(dummyOffer);
      if (typeof days === 'number') {
        patch.days_running = days;
        patch.calculated_days_running = days;
        provenanceMap['days_running'] = {
          field: 'days_running',
          value: days,
          source: 'HISTORY',
          observedAt: now,
          type: 'DERIVED',
          evidenceQuote: `Derivado a partir da data de início ${resolvedOldest}`,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. COPY & CONTENT RECONCILIATION (HEADLINE, SUBHEADLINE, PROMISE)
  // Source: LP Collector / Existing Artifacts
  // --------------------------------------------------------------------------
  if (!isLocked('headline')) {
    const headline = lp.data.headline || existingArtifacts.data.headline;
    if (headline) {
      patch.headline = headline;
      provenanceMap['headline'] = {
        field: 'headline',
        value: headline,
        source: 'LANDING_PAGE',
        observedAt: now,
        type: 'OBSERVED',
      };
    }
  }

  if (!isLocked('subheadline')) {
    const subheadline = lp.data.subheadline || existingArtifacts.data.subheadline;
    if (subheadline) {
      patch.subheadline = subheadline;
    }
  }

  if (!isLocked('promise')) {
    const promise = lp.data.promise || existingArtifacts.data.promise;
    if (promise) {
      patch.promise = promise;
      provenanceMap['promise'] = {
        field: 'promise',
        value: promise,
        source: 'LANDING_PAGE',
        observedAt: now,
        type: 'OBSERVED',
      };
    }
  }

  // --------------------------------------------------------------------------
  // 7. CHECKOUT PLATFORM & ORDER BUMPS RECONCILIATION
  // Source: Checkout Collector / Existing Artifacts
  // --------------------------------------------------------------------------
  if (!isLocked('checkout_platform')) {
    const platform = checkout.data.platform || existingArtifacts.data.checkoutProvider;
    if (platform) {
      patch.checkout_platform = platform;
      provenanceMap['checkout_platform'] = {
        field: 'checkout_platform',
        value: platform,
        source: 'CHECKOUT',
        observedAt: now,
        type: 'OBSERVED',
      };
    }
  }

  // --------------------------------------------------------------------------
  // 8. FINAL STATUS EVALUATION
  // --------------------------------------------------------------------------
  const unresolvedReasons: string[] = [];

  if (patch.active_ads_count === null || patch.active_ads_count === undefined) {
    unresolvedReasons.push('ACTIVE_ADS_NOT_CONFIRMED');
  }
  if (!patch.unique_creatives_count && !currentOffer.unique_creatives_count) {
    unresolvedReasons.push('CREATIVES_NOT_COLLECTED');
  }
  if (checkout.status === 'FAILED') {
    unresolvedReasons.push('CHECKOUT_FAILED');
  }
  if (lp.status === 'FAILED') {
    unresolvedReasons.push('LP_FAILED');
  }

  const fieldsEnrichedCount = Object.keys(patch).filter((k) => (patch as any)[k] !== null && (patch as any)[k] !== undefined).length;
  const totalTrackedFields = 15;

  let finalStatus: OfferDataScrapingStatus = 'PARTIAL';
  if (unresolvedReasons.length === 0 && fieldsEnrichedCount >= 6) {
    finalStatus = 'SUCCESS';
  } else if (fieldsEnrichedCount === 0 && (lp.status === 'FAILED' || meta.status === 'FAILED')) {
    finalStatus = 'FAILED';
  } else {
    finalStatus = 'PARTIAL';
  }

  const durationMs = Date.now() - startTime;

  const report: OfferReconciliationReport = {
    offerId: currentOffer.id,
    status: finalStatus,
    scrapedAt: now,
    version: '2.0.0',
    durationMs,
    fieldsEnrichedCount,
    totalTrackedFields,
    provenanceMap,
    conflicts,
    collectorsBreakdown: {
      existingArtifacts: {
        status: existingArtifacts.status,
        fieldsLoaded: existingArtifacts.fieldsLoaded,
      },
      landingPage: {
        status: lp.status,
        fieldsLoaded: lp.fieldsLoaded,
        error: lp.error,
      },
      metaAds: {
        status: meta.status,
        adId: meta.data.seedAdId || undefined,
        clusterAdsCount: meta.cluster.activeAdsCount || undefined,
        error: meta.error,
      },
      creatives: {
        status: creative.status,
        uniqueCreativesCount: creative.data.uniqueCreativesCount || undefined,
        error: creative.error,
      },
      checkout: {
        status: checkout.status,
        provider: checkout.data.platform || undefined,
        price: checkout.data.frontPrice || undefined,
        bumpsCount: checkout.data.bumpsCount || undefined,
        error: checkout.error,
      },
    },
    unresolvedReasons: unresolvedReasons.length > 0 ? unresolvedReasons : undefined,
  };

  patch.data_scraping_status = finalStatus;
  patch.data_scraping_completed_at = now;
  patch.data_scraping_version = '2.0.0';
  patch.data_scraping_reconciliation = report;
  patch.provenance_map = provenanceMap as any;

  return {
    patch,
    report,
    status: finalStatus,
  };
}
