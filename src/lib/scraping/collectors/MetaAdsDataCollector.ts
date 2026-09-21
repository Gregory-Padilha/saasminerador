// ==============================================================================
// OFFER MINER - META ADS DATA COLLECTOR & OFFER AD CLUSTERING ENGINE
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, FieldProvenance } from '@/types';

export interface OfferAdInstance {
  id: string;
  metaAdId: string;
  advertiser?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  startDate?: string | null;
  destinationUrl?: string | null;
  headline?: string | null;
  primaryText?: string | null;
  creativeType?: 'video' | 'image' | 'carousel' | 'unknown';
  mediaUrl?: string | null;
  matchScore: number;
  matchReasons: string[];
}

export interface OfferAdCluster {
  offerId: string;
  seedAdId: string | null;
  pageId?: string | null;
  advertiserName?: string | null;
  totalPageAdsObserved: number;
  clusterAds: OfferAdInstance[];
  activeAdsCount: number | null;
  earliestAdStartDate: string | null;
  clusterConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'SEED_ONLY' | 'NONE';
}

export interface MetaAdsHarvest {
  status: 'SUCCESS' | 'PARTIAL' | 'NOT_AVAILABLE' | 'FAILED';
  fieldsLoaded: string[];
  provenanceMap: Record<string, FieldProvenance>;
  cluster: OfferAdCluster;
  data: {
    seedAdId?: string | null;
    metaPageId?: string | null;
    advertiser?: string | null;
    activeAdsCount?: number | null;
    oldestAdDate?: string | null;
    newestAdDate?: string | null;
  };
  error?: string;
}

/**
 * Extracts a representative Meta Ad ID from a library URL.
 * e.g., facebook.com/ads/library/?id=865473736608989 -> "865473736608989"
 */
export function extractMetaSeedAdId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?&]id=(\d+)/i) || url.match(/[?&]ad_archive_id=(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Extracts a Meta Page ID from a library URL if available.
 * e.g., view_all_page_id=123456 or page_id=123456
 */
export function extractMetaPageId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?&]view_all_page_id=(\d+)/i) || url.match(/[?&]page_id=(\d+)/i);
  return match ? match[1] : null;
}

function normalize(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Evaluates whether an observed Meta ad instance belongs to the target offer cluster.
 * STRICT: Avoids absorbing all ads from the same advertiser page when selling multiple products.
 */
export function matchAdToOfferCluster(
  ad: {
    metaAdId: string;
    destinationUrl?: string | null;
    headline?: string | null;
    primaryText?: string | null;
    advertiser?: string | null;
  },
  offer: Offer,
  seedAdId: string | null
): { isMatch: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Direct Seed Ad ID match
  if (seedAdId && ad.metaAdId === seedAdId) {
    reasons.push('EXACT_SEED_AD_ID');
    score += 100;
  }

  // 2. Destination URL & Canonical Landing Page Match
  if (ad.destinationUrl && offer.landing_page_url) {
    const normAdUrl = normalize(ad.destinationUrl);
    const normLpUrl = normalize(offer.landing_page_url);

    try {
      const adDomain = new URL(ad.destinationUrl).hostname.replace('www.', '');
      const lpDomain = new URL(offer.landing_page_url).hostname.replace('www.', '');

      if (adDomain === lpDomain) {
        reasons.push('DESTINATION_DOMAIN_MATCH');
        score += 20;
      }
      if (normAdUrl.includes(normLpUrl) || normLpUrl.includes(normAdUrl)) {
        reasons.push('EXACT_LANDING_PAGE_MATCH');
        score += 30;
      }
    } catch {
      // url parse error fallback
      if (normAdUrl.includes(normLpUrl)) {
        reasons.push('URL_SUBSTRING_MATCH');
        score += 35;
      }
    }
  }

  // 3. Product Name tokens match
  if (offer.product_name) {
    const productTokens = normalize(offer.product_name)
      .split(/[\s,.\-_/\\|;:!?()[\]{}'"]+/)
      .filter((t) => t.length >= 4);

    const combinedAdText = `${normalize(ad.headline)} ${normalize(ad.primaryText)}`;
    const matchedTokens = productTokens.filter((t) => combinedAdText.includes(t));

    if (productTokens.length > 0 && matchedTokens.length >= Math.min(2, productTokens.length)) {
      reasons.push(`PRODUCT_TOKEN_MATCH(${matchedTokens.join(',')})`);
      score += 30;
    }
  }

  // 4. Headline similarity
  if (offer.headline && ad.headline) {
    const normOfferHl = normalize(offer.headline);
    const normAdHl = normalize(ad.headline);
    if (normAdHl.includes(normOfferHl) || normOfferHl.includes(normAdHl)) {
      reasons.push('HEADLINE_SUBSTRING_MATCH');
      score += 25;
    }
  }

  const isMatch = score >= 35;
  return { isMatch, score, reasons };
}

export async function collectMetaAdsData(offer: Offer): Promise<MetaAdsHarvest> {
  const fieldsLoaded: string[] = [];
  const provenanceMap: Record<string, FieldProvenance> = {};
  const now = new Date().toISOString();

  const metaUrl =
    offer.meta_ads_url ||
    (offer as any).meta_ad_url ||
    (offer as any).ad_url ||
    (offer as any).facebook_ads_url;
  const seedAdId = extractMetaSeedAdId(metaUrl) || offer.meta_ad_seed_id || null;
  const metaPageId = extractMetaPageId(metaUrl) || offer.meta_page_id || null;

  const cluster: OfferAdCluster = {
    offerId: offer.id,
    seedAdId,
    pageId: metaPageId,
    advertiserName: offer.advertiser || null,
    totalPageAdsObserved: 0,
    clusterAds: [],
    activeAdsCount: null,
    earliestAdStartDate: null,
    clusterConfidence: 'NONE',
  };

  const harvestData: MetaAdsHarvest['data'] = {
    seedAdId,
    metaPageId,
    advertiser: offer.advertiser || null,
    activeAdsCount: null,
    oldestAdDate: null,
    newestAdDate: null,
  };

  if (seedAdId) {
    fieldsLoaded.push('meta_ad_seed_id');
    provenanceMap['meta_ad_seed_id'] = {
      field: 'meta_ad_seed_id',
      value: seedAdId,
      source: 'META_ADS',
      observedAt: now,
      type: 'OBSERVED',
    };
  }

  if (metaPageId) {
    fieldsLoaded.push('meta_page_id');
    provenanceMap['meta_page_id'] = {
      field: 'meta_page_id',
      value: metaPageId,
      source: 'META_ADS',
      observedAt: now,
      type: 'OBSERVED',
    };
  }

  try {
    // 1. Check existing captured ads in database
    const existingAds = await dbService.getOfferAds(offer.id);
    cluster.totalPageAdsObserved = existingAds.length;

    const matchedAds: OfferAdInstance[] = [];

    for (const ad of existingAds) {
      const { isMatch, score, reasons } = matchAdToOfferCluster(
        {
          metaAdId: ad.meta_ad_id,
          destinationUrl: ad.destination_url,
          headline: ad.headline,
          primaryText: ad.primary_text,
          advertiser: ad.advertiser,
        },
        offer,
        seedAdId
      );

      if (isMatch) {
        matchedAds.push({
          id: ad.id,
          metaAdId: ad.meta_ad_id,
          advertiser: ad.advertiser,
          status: 'ACTIVE',
          startDate: ad.started_at,
          destinationUrl: ad.destination_url,
          headline: ad.headline,
          primaryText: ad.primary_text,
          matchScore: score,
          matchReasons: reasons,
        });
      }
    }

    cluster.clusterAds = matchedAds;

    // 2. Calculate confirmed active ads count
    if (matchedAds.length > 0) {
      cluster.activeAdsCount = matchedAds.length;
      harvestData.activeAdsCount = matchedAds.length;
      cluster.clusterConfidence = matchedAds.length > 3 ? 'HIGH' : 'MEDIUM';

      fieldsLoaded.push('active_ads_count');
      provenanceMap['active_ads_count'] = {
        field: 'active_ads_count',
        value: matchedAds.length,
        source: 'META_ADS_CLUSTER',
        observedAt: now,
        type: 'OBSERVED',
        evidenceQuote: `Cluster identificou ${matchedAds.length} anúncios ativos para esta oferta (de ${existingAds.length} na página).`,
      };

      // Resolve earliest ad start date in cluster
      const startDates = matchedAds
        .map((a) => a.startDate)
        .filter((d): d is string => Boolean(d))
        .sort();

      if (startDates.length > 0) {
        cluster.earliestAdStartDate = startDates[0];
        harvestData.oldestAdDate = startDates[0];
        fieldsLoaded.push('oldest_ad_date');
        provenanceMap['oldest_ad_date'] = {
          field: 'oldest_ad_date',
          value: startDates[0],
          source: 'META_ADS_CLUSTER',
          observedAt: now,
          type: 'OBSERVED',
        };
      }
    } else if (seedAdId) {
      // If we have a seed ad ID, we know the offer has at least this seed ad registered,
      // but without cluster execution we do not fabricate an active ads count number!
      cluster.clusterConfidence = 'SEED_ONLY';
      // Do NOT set active_ads_count = 1!
      harvestData.activeAdsCount = null;
    }

    const status: MetaAdsHarvest['status'] =
      matchedAds.length > 0 ? 'SUCCESS' : seedAdId ? 'PARTIAL' : 'NOT_AVAILABLE';

    return {
      status,
      fieldsLoaded,
      provenanceMap,
      cluster,
      data: harvestData,
    };
  } catch (err: any) {
    console.error('[META ADS DATA COLLECTOR ERROR]:', err);
    return {
      status: 'FAILED',
      fieldsLoaded,
      provenanceMap,
      cluster,
      data: harvestData,
      error: err.message || 'Falha ao coletar dados do Meta Ads.',
    };
  }
}
