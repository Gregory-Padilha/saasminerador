// ==============================================================================
// OFFER MINER - DEDUPLICATION ENGINE
// ==============================================================================

import { Offer } from '@/types';
import { extractDomain } from './utils';

/**
 * Removes accents and special diacritics
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes a string token for deduplication: lowercase, no accents, trimmed
 */
function cleanToken(str?: string | null): string {
  if (!str) return '';
  return removeAccents(String(str).toLowerCase())
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Generates a consistent dedupe_key from advertiser, product_name, and landing page domain
 */
export function generateDedupeKey(params: {
  product_name?: string | null;
  advertiser?: string | null;
  landing_page_url?: string | null;
  meta_ads_url?: string | null;
}): string {
  const cleanProduct = cleanToken(params.product_name);
  const cleanAdvertiser = cleanToken(params.advertiser);
  const domain = cleanToken(extractDomain(params.landing_page_url));

  // If we have advertiser and product, that's primary
  if (cleanAdvertiser && cleanProduct) {
    return `${cleanAdvertiser}__${cleanProduct}__${domain}`;
  }

  // If advertiser is missing, use product + domain
  if (cleanProduct && domain) {
    return `unknown_adv__${cleanProduct}__${domain}`;
  }

  // Fallback to product only
  if (cleanProduct) {
    return `product__${cleanProduct}`;
  }

  // Fallback to domain
  if (domain) {
    return `domain__${domain}`;
  }

  return `empty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Checks if a candidate offer matches an existing offer in the user's database
 */
export function findDuplicateOffer(
  candidateKey: string,
  candidateOffer: Partial<Offer>,
  existingOffers: Offer[]
): Offer | undefined {
  if (!existingOffers || existingOffers.length === 0) return undefined;

  // 1. Exact dedupe_key match
  const exactKeyMatch = existingOffers.find((o) => o.dedupe_key === candidateKey);
  if (exactKeyMatch) return exactKeyMatch;

  // 2. High confidence match: Same normalized product name & same advertiser
  const cleanCandProduct = cleanToken(candidateOffer.product_name);
  const cleanCandAdvertiser = cleanToken(candidateOffer.advertiser);

  if (cleanCandProduct && cleanCandAdvertiser) {
    const productAdvMatch = existingOffers.find((o) => {
      const oProduct = cleanToken(o.product_name);
      const oAdv = cleanToken(o.advertiser);
      return oProduct === cleanCandProduct && oAdv === cleanCandAdvertiser;
    });
    if (productAdvMatch) return productAdvMatch;
  }

  // 3. Same clean landing page URL if URL is distinctive
  if (candidateOffer.landing_page_url) {
    const cleanCandUrl = candidateOffer.landing_page_url.toLowerCase().split('?')[0].replace(/\/$/, '');
    if (cleanCandUrl.length > 15) {
      const urlMatch = existingOffers.find((o) => {
        if (!o.landing_page_url) return false;
        const oUrl = o.landing_page_url.toLowerCase().split('?')[0].replace(/\/$/, '');
        return oUrl === cleanCandUrl;
      });
      if (urlMatch) return urlMatch;
    }
  }

  return undefined;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  existingOffer: Offer | null;
  matchReason?: 'meta_ad_ids' | 'meta_ads_url' | 'dedupe_key' | 'product_and_advertiser' | 'landing_page_url';
  matchedAdIdsCount?: number;
}

/**
 * Advanced Duplicate Detection for Meta Ads URL analysis pipeline.
 * Checks Meta Ad IDs, Meta Ads URL, Dedupe Key, Advertiser + Product Name, and LP URL.
 */
export function detectExistingOfferAdvanced(params: {
  candidateOffer: Partial<Offer>;
  metaAdIds?: string[];
  metaAdsUrl?: string | null;
  existingOffers: Offer[];
}): DuplicateDetectionResult {
  const { candidateOffer, metaAdIds = [], metaAdsUrl, existingOffers } = params;
  if (!existingOffers || existingOffers.length === 0) {
    return { isDuplicate: false, existingOffer: null };
  }

  // 1. Meta Ad IDs Overlap Check (Strongest evidence)
  if (metaAdIds.length > 0) {
    for (const offer of existingOffers) {
      const existingAdIds: string[] = [];
      if (offer.ads && offer.ads.length > 0) {
        offer.ads.forEach((ad) => existingAdIds.push(ad.meta_ad_id));
      }
      if (offer.raw_data?.meta_ad_ids && Array.isArray(offer.raw_data.meta_ad_ids)) {
        existingAdIds.push(...offer.raw_data.meta_ad_ids);
      }

      const matchCount = metaAdIds.filter((id) => existingAdIds.includes(id)).length;
      if (matchCount > 0 && matchCount >= Math.min(2, metaAdIds.length)) {
        return {
          isDuplicate: true,
          existingOffer: offer,
          matchReason: 'meta_ad_ids',
          matchedAdIdsCount: matchCount,
        };
      }
    }
  }

  // 2. Exact Meta Ads URL Match
  if (metaAdsUrl) {
    const cleanCandidateMetaUrl = metaAdsUrl.trim().toLowerCase();
    const metaUrlMatch = existingOffers.find((o) => {
      if (!o.meta_ads_url) return false;
      return o.meta_ads_url.trim().toLowerCase() === cleanCandidateMetaUrl;
    });

    if (metaUrlMatch) {
      return {
        isDuplicate: true,
        existingOffer: metaUrlMatch,
        matchReason: 'meta_ads_url',
      };
    }
  }

  // 3. Dedupe Key / Advertiser + Product Name / LP Match
  const candidateKey = generateDedupeKey({
    product_name: candidateOffer.product_name,
    advertiser: candidateOffer.advertiser,
    landing_page_url: candidateOffer.landing_page_url,
  });

  const duplicateByDedupe = findDuplicateOffer(candidateKey, candidateOffer, existingOffers);
  if (duplicateByDedupe) {
    return {
      isDuplicate: true,
      existingOffer: duplicateByDedupe,
      matchReason: 'product_and_advertiser',
    };
  }

  return { isDuplicate: false, existingOffer: null };
}
