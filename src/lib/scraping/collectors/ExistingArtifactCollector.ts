// ==============================================================================
// OFFER MINER - EXISTING ARTIFACT COLLECTOR
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, FieldProvenance } from '@/types';

export interface ExistingArtifactHarvest {
  status: 'FOUND' | 'PARTIAL' | 'NOT_FOUND';
  fieldsLoaded: string[];
  provenanceMap: Record<string, FieldProvenance>;
  data: {
    pageTitle?: string | null;
    headline?: string | null;
    subheadline?: string | null;
    promise?: string | null;
    price?: number | null;
    currency?: string;
    frontOptionsCount?: number | null;
    checkoutUrl?: string | null;
    checkoutProvider?: string | null;
    checkoutPrice?: number | null;
    orderBumpsCount?: number | null;
    activeAdsCount?: number | null;
    uniqueCreativesCount?: number | null;
    oldestAdDate?: string | null;
  };
}

export async function collectFromExistingArtifacts(offer: Offer): Promise<ExistingArtifactHarvest> {
  const fieldsLoaded: string[] = [];
  const provenanceMap: Record<string, FieldProvenance> = {};
  const data: ExistingArtifactHarvest['data'] = {};

  try {
    // 1. Inspect existing LP capture
    const lpCaptures = await dbService.getLandingPageCaptures(offer.id);
    const validLpCapture = lpCaptures.find(
      (c) => c.capture_status === 'ready' || c.capture_status === 'analyzed' || (c.raw_data && c.raw_data.analysis)
    );

    if (validLpCapture) {
      const now = validLpCapture.captured_at || new Date().toISOString();
      const analysis = validLpCapture.raw_data?.analysis;

      if (validLpCapture.page_title) {
        data.pageTitle = validLpCapture.page_title;
        fieldsLoaded.push('page_title');
        provenanceMap['page_title'] = {
          field: 'page_title',
          value: validLpCapture.page_title,
          source: 'LANDING_PAGE',
          observedAt: now,
          type: 'OBSERVED',
        };
      }

      if (analysis) {
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

        const subheadlines = Array.isArray(analysis.copy?.subheadlines) ? analysis.copy.subheadlines : [];
        if (subheadlines.length > 0) {
          data.subheadline = subheadlines[0];
          fieldsLoaded.push('subheadline');
          provenanceMap['subheadline'] = {
            field: 'subheadline',
            value: subheadlines[0],
            source: 'LANDING_PAGE',
            observedAt: now,
            type: 'OBSERVED',
          };
        }

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

        const commPrice = analysis.commerce?.currentPrice;
        if (typeof commPrice === 'number' && commPrice > 0) {
          data.price = commPrice;
          data.currency = analysis.commerce?.currency || 'BRL';
          fieldsLoaded.push('price');
          provenanceMap['price'] = {
            field: 'price',
            value: commPrice,
            source: 'LANDING_PAGE',
            observedAt: now,
            type: 'OBSERVED',
          };
        }

        const frontOpts = analysis.commerce?.frontOptions;
        if (Array.isArray(frontOpts) && frontOpts.length > 0) {
          data.frontOptionsCount = frontOpts.length;
          fieldsLoaded.push('front_options_count');
          provenanceMap['front_options_count'] = {
            field: 'front_options_count',
            value: frontOpts.length,
            source: 'LANDING_PAGE',
            observedAt: now,
            type: 'OBSERVED',
          };
        }
      }
    }

    // 2. Inspect existing Checkout capture
    const checkoutCaptures = await dbService.getCheckoutCaptures(offer.id);
    const validCheckoutCapture = checkoutCaptures.find(
      (c) => c.status === 'verified' || c.status === 'not_checked' || c.provider
    );

    if (validCheckoutCapture) {
      const now = validCheckoutCapture.captured_at || new Date().toISOString();

      if (validCheckoutCapture.provider && validCheckoutCapture.provider !== 'Unknown') {
        data.checkoutProvider = validCheckoutCapture.provider;
        fieldsLoaded.push('checkout_provider');
        provenanceMap['checkout_provider'] = {
          field: 'checkout_provider',
          value: validCheckoutCapture.provider,
          source: 'CHECKOUT',
          observedAt: now,
          type: 'OBSERVED',
        };
      }

      if (typeof validCheckoutCapture.front_price === 'number' && validCheckoutCapture.front_price > 0) {
        data.checkoutPrice = validCheckoutCapture.front_price;
        fieldsLoaded.push('checkout_price');
        provenanceMap['checkout_price'] = {
          field: 'checkout_price',
          value: validCheckoutCapture.front_price,
          source: 'CHECKOUT',
          observedAt: now,
          type: 'OBSERVED',
        };
      }

      const bumpsCount = validCheckoutCapture.order_bumps_count;
      if (typeof bumpsCount === 'number') {
        data.orderBumpsCount = bumpsCount;
        fieldsLoaded.push('order_bumps_count');
        provenanceMap['order_bumps_count'] = {
          field: 'order_bumps_count',
          value: bumpsCount,
          source: 'CHECKOUT',
          observedAt: now,
          type: 'OBSERVED',
        };
      }
    }

    // 3. Inspect existing Ads and Creatives
    const existingAds = await dbService.getOfferAds(offer.id);
    if (existingAds.length > 0) {
      data.activeAdsCount = existingAds.length;
      fieldsLoaded.push('active_ads_count');
      provenanceMap['active_ads_count'] = {
        field: 'active_ads_count',
        value: existingAds.length,
        source: 'META_ADS_CLUSTER',
        observedAt: new Date().toISOString(),
        type: 'OBSERVED',
      };
    }

    const existingCreatives = await dbService.getCreativesByOffer(offer.id);
    if (existingCreatives.length > 0) {
      data.uniqueCreativesCount = existingCreatives.length;
      fieldsLoaded.push('unique_creatives_count');
      provenanceMap['unique_creatives_count'] = {
        field: 'unique_creatives_count',
        value: existingCreatives.length,
        source: 'META_ADS',
        observedAt: new Date().toISOString(),
        type: 'OBSERVED',
      };
    }

    const status = fieldsLoaded.length > 3 ? 'FOUND' : fieldsLoaded.length > 0 ? 'PARTIAL' : 'NOT_FOUND';

    return {
      status,
      fieldsLoaded,
      provenanceMap,
      data,
    };
  } catch (err) {
    console.error('[EXISTING ARTIFACT COLLECTOR ERROR]:', err);
    return {
      status: 'NOT_FOUND',
      fieldsLoaded: [],
      provenanceMap: {},
      data: {},
    };
  }
}
