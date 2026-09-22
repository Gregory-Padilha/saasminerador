// ==============================================================================
// OFFER MINER - CANONICAL OFFER DUPLICATE SERVICE (DOMAIN SERVICE)
// ==============================================================================
// Provides fast, factual, and strictly non-subjective deduplication of offer
// candidates against the Offer Miner catalog for autonomous agents (e.g. GPT Work).
//
// Rules Hierarchy:
// - STRONG IDENTIFIERS (DUPLICATE):
//   1. Explicit external ID match
//   2. Canonical landing page URL match
//   3. Canonical checkout URL match
//   4. Same Meta Ad ID already associated with an offer or creative
// - MEDIUM SIGNAL (DUPLICATE):
//   - Same normalized advertiser AND same normalized offer name
// - WEAK SIGNAL (POSSIBLE_DUPLICATE):
//   - Same advertiser + similar name without confirmed identical URL
//   - Similar name across catalog
// - NEGATIVE CONSTRAINTS (NEVER DUPLICATE BY THESE ALONE):
//   - Same advertiser alone
//   - Same domain alone
//   - Same niche alone
//   - Same price alone
//   - Meta Page ID alone
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { canonicalizeOfferUrl as baseCanonicalizeOfferUrl } from '@/lib/import/dedupe';
import { Offer } from '@/types';

export interface CheckOfferDuplicateInput {
  offer_name?: string | null;
  advertiser?: string | null;
  landing_page_url?: string | null;
  checkout_url?: string | null;
  meta_ads_url?: string | null;
  meta_ad_id?: string | null;
  meta_page_id?: string | null;
}

export type DuplicateConfidenceBasis =
  | 'SAME_LANDING_PAGE'
  | 'SAME_CHECKOUT'
  | 'SAME_EXTERNAL_ID'
  | 'SAME_META_AD'
  | 'SAME_ADVERTISER_AND_NAME'
  | 'SIMILAR_NAME';

export interface MatchedOfferSummary {
  offer_id: string;
  offer_name: string;
  advertiser: string | null;
  landing_page_url: string | null;
  active_ads_count: number | null;
}

export interface CheckOfferDuplicateResult {
  status: 'NEW' | 'DUPLICATE' | 'POSSIBLE_DUPLICATE';
  confidence_basis: DuplicateConfidenceBasis[];
  matches: MatchedOfferSummary[];
}

export interface CandidateOfferInput {
  candidate_id: string;
  offer_name?: string | null;
  advertiser?: string | null;
  landing_page_url?: string | null;
  checkout_url?: string | null;
  meta_ads_url?: string | null;
  meta_ad_id?: string | null;
  meta_page_id?: string | null;
}

export interface CheckOffersDuplicatesInput {
  candidates: CandidateOfferInput[];
}

export interface CandidateDedupeResult {
  candidate_id: string;
  status: 'NEW' | 'DUPLICATE' | 'POSSIBLE_DUPLICATE';
  matched_offer_id: string | null;
  matched_offer_name: string | null;
  reason: string | null;
}

export interface CheckOffersDuplicatesResult {
  results: CandidateDedupeResult[];
  summary: {
    checked: number;
    new: number;
    duplicates: number;
    possible_duplicates: number;
  };
}

// ----------------------------------------------------------------------------
// Normalization Helpers
// ----------------------------------------------------------------------------

export function canonicalizeOfferUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  return baseCanonicalizeOfferUrl(rawUrl);
}

export function normalizeOfferName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeAdvertiser(adv?: string | null): string {
  if (!adv || typeof adv !== 'string') return '';
  return adv
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function extractMetaAdId(urlOrId?: string | null): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  if (/^\d{8,20}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const idParam = parsed.searchParams.get('id');
    if (idParam && /^\d{8,20}$/.test(idParam)) return idParam;
  } catch {}

  const match = trimmed.match(/[?&]id=(\d{8,20})/);
  if (match) return match[1];

  return null;
}

export function isSimilarOfferName(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const a = normalizeOfferName(nameA);
  const b = normalizeOfferName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Prefix / containment match (e.g. "mapa do amor" and "mapa do amor 2 0")
  if (a.startsWith(b) || b.startsWith(a)) {
    return true;
  }

  const tokensA = a.split(' ').filter((t) => t.length > 2);
  const tokensB = b.split(' ').filter((t) => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 && intersection / union >= 0.6;
}

// ----------------------------------------------------------------------------
// Catalog Indexing for High-Performance Batch Lookups
// ----------------------------------------------------------------------------

interface IndexedCatalog {
  offers: Offer[];
  byCanonicalLp: Map<string, Offer>;
  byCanonicalCheckout: Map<string, Offer>;
  byMetaAdId: Map<string, Offer>;
  byAdvAndName: Map<string, Offer>;
  byNormalizedAdv: Map<string, Offer[]>;
  byNormalizedName: Map<string, Offer[]>;
}

function buildCatalogIndex(offers: Offer[]): IndexedCatalog {
  const byCanonicalLp = new Map<string, Offer>();
  const byCanonicalCheckout = new Map<string, Offer>();
  const byMetaAdId = new Map<string, Offer>();
  const byAdvAndName = new Map<string, Offer>();
  const byNormalizedAdv = new Map<string, Offer[]>();
  const byNormalizedName = new Map<string, Offer[]>();

  for (const offer of offers) {
    // 1. Landing page index
    const cleanLp = canonicalizeOfferUrl(offer.landing_page_url || offer.landing_page_url_original);
    if (cleanLp && cleanLp.length > 10) {
      if (!byCanonicalLp.has(cleanLp)) {
        byCanonicalLp.set(cleanLp, offer);
      }
    }

    // 2. Checkout index
    const cleanCheckout = canonicalizeOfferUrl(offer.checkout_url);
    if (cleanCheckout && cleanCheckout.length > 10) {
      if (!byCanonicalCheckout.has(cleanCheckout)) {
        byCanonicalCheckout.set(cleanCheckout, offer);
      }
    }

    // 3. Meta Ad ID index (from creatives and offer URL)
    if (Array.isArray(offer.creatives)) {
      for (const creative of offer.creatives) {
        if (creative.meta_ad_id) {
          byMetaAdId.set(String(creative.meta_ad_id).trim(), offer);
        }
        const adIdFromUrl = extractMetaAdId(creative.meta_ad_url || creative.ad_url);
        if (adIdFromUrl) {
          byMetaAdId.set(adIdFromUrl, offer);
        }
      }
    }
    const offerAdId = extractMetaAdId(offer.meta_ads_url);
    if (offerAdId) {
      byMetaAdId.set(offerAdId, offer);
    }

    // 4. Advertiser + Name index
    const normAdv = normalizeAdvertiser(offer.advertiser);
    const normName = normalizeOfferName(offer.product_name || offer.offer_name);
    if (normAdv && normName) {
      const advNameKey = `${normAdv}__${normName}`;
      if (!byAdvAndName.has(advNameKey)) {
        byAdvAndName.set(advNameKey, offer);
      }
    }

    // 5. Group by advertiser
    if (normAdv) {
      const existing = byNormalizedAdv.get(normAdv) || [];
      existing.push(offer);
      byNormalizedAdv.set(normAdv, existing);
    }

    // 6. Group by name
    if (normName) {
      const existing = byNormalizedName.get(normName) || [];
      existing.push(offer);
      byNormalizedName.set(normName, existing);
    }
  }

  return {
    offers,
    byCanonicalLp,
    byCanonicalCheckout,
    byMetaAdId,
    byAdvAndName,
    byNormalizedAdv,
    byNormalizedName,
  };
}

// ----------------------------------------------------------------------------
// Candidate Evaluation
// ----------------------------------------------------------------------------

interface InternalMatchEvaluation {
  status: 'NEW' | 'DUPLICATE' | 'POSSIBLE_DUPLICATE';
  confidence_basis: DuplicateConfidenceBasis[];
  matched_offer: Offer | null;
  primary_reason: string | null;
  all_matches: Offer[];
}

function evaluateCandidateAgainstIndex(
  candidate: CheckOfferDuplicateInput,
  index: IndexedCatalog
): InternalMatchEvaluation {
  const confidence_basis: DuplicateConfidenceBasis[] = [];
  const matchedOffersMap = new Map<string, Offer>();

  const candLp = canonicalizeOfferUrl(candidate.landing_page_url);
  const candCheckout = canonicalizeOfferUrl(candidate.checkout_url);
  const candMetaAdId = candidate.meta_ad_id?.trim() || extractMetaAdId(candidate.meta_ads_url);
  const candNormName = normalizeOfferName(candidate.offer_name);
  const candNormAdv = normalizeAdvertiser(candidate.advertiser);

  let primaryStrongReason: string | null = null;

  // 1. Check Canonical Landing Page URL (STRONG)
  if (candLp && candLp.length > 10) {
    const match = index.byCanonicalLp.get(candLp);
    if (match) {
      confidence_basis.push('SAME_LANDING_PAGE');
      matchedOffersMap.set(match.id, match);
      if (!primaryStrongReason) primaryStrongReason = 'SAME_CANONICAL_LANDING_PAGE';
    }
  }

  // 2. Check Canonical Checkout URL (STRONG)
  if (candCheckout && candCheckout.length > 10) {
    const match = index.byCanonicalCheckout.get(candCheckout);
    if (match) {
      confidence_basis.push('SAME_CHECKOUT');
      matchedOffersMap.set(match.id, match);
      if (!primaryStrongReason) primaryStrongReason = 'SAME_CANONICAL_CHECKOUT';
    }
  }

  // 3. Check Meta Ad ID (STRONG)
  if (candMetaAdId) {
    const match = index.byMetaAdId.get(candMetaAdId);
    if (match) {
      confidence_basis.push('SAME_META_AD');
      matchedOffersMap.set(match.id, match);
      if (!primaryStrongReason) primaryStrongReason = 'SAME_META_AD';
    }
  }

  // 4. Check Advertiser + Name (MEDIUM SIGNAL -> DUPLICATE)
  if (candNormAdv && candNormName) {
    const key = `${candNormAdv}__${candNormName}`;
    const match = index.byAdvAndName.get(key);
    if (match) {
      confidence_basis.push('SAME_ADVERTISER_AND_NAME');
      matchedOffersMap.set(match.id, match);
      if (!primaryStrongReason) primaryStrongReason = 'SAME_ADVERTISER_AND_NAME';
    }
  }

  // If any strong or medium exact advertiser+name matched -> DUPLICATE
  if (matchedOffersMap.size > 0 && primaryStrongReason) {
    const allMatches = Array.from(matchedOffersMap.values());
    return {
      status: 'DUPLICATE',
      confidence_basis: Array.from(new Set(confidence_basis)),
      matched_offer: allMatches[0],
      primary_reason: primaryStrongReason,
      all_matches: allMatches,
    };
  }

  // 5. Weak / Ambiguous Check: Same advertiser + Similar Name (POSSIBLE_DUPLICATE)
  if (candNormAdv) {
    const advOffers = index.byNormalizedAdv.get(candNormAdv) || [];
    for (const off of advOffers) {
      const offName = normalizeOfferName(off.product_name || off.offer_name);
      if (candNormName && isSimilarOfferName(candNormName, offName)) {
        confidence_basis.push('SIMILAR_NAME');
        return {
          status: 'POSSIBLE_DUPLICATE',
          confidence_basis: ['SIMILAR_NAME'],
          matched_offer: off,
          primary_reason: 'SAME_ADVERTISER_AND_SIMILAR_NAME',
          all_matches: [off],
        };
      }
    }
  }

  // 6. Similar name across catalog (when name is sufficiently specific)
  if (candNormName && candNormName.length >= 8) {
    for (const off of index.offers) {
      const offName = normalizeOfferName(off.product_name || off.offer_name);
      if (offName === candNormName) {
        // Same name across different advertiser without common URL
        return {
          status: 'POSSIBLE_DUPLICATE',
          confidence_basis: ['SIMILAR_NAME'],
          matched_offer: off,
          primary_reason: 'IDENTICAL_NAME_DIFFERENT_ADVERTISER',
          all_matches: [off],
        };
      }
    }
  }

  // No match
  return {
    status: 'NEW',
    confidence_basis: [],
    matched_offer: null,
    primary_reason: null,
    all_matches: [],
  };
}

// ----------------------------------------------------------------------------
// OfferDuplicateService Implementation
// ----------------------------------------------------------------------------

export class OfferDuplicateService {
  /**
   * Checks a single offer candidate against the existing Offer Miner database
   */
  static async checkOne(input: CheckOfferDuplicateInput, client?: any): Promise<CheckOfferDuplicateResult> {
    const offers = await dbService.getOffers(undefined, client);
    const index = buildCatalogIndex(offers);
    const evaluation = evaluateCandidateAgainstIndex(input, index);

    const matches: MatchedOfferSummary[] = evaluation.all_matches.map((o) => ({
      offer_id: o.id,
      offer_name: o.product_name || o.offer_name || 'Sem título',
      advertiser: o.advertiser || null,
      landing_page_url: o.landing_page_url || null,
      active_ads_count: o.active_ads_count ?? null,
    }));

    return {
      status: evaluation.status,
      confidence_basis: evaluation.confidence_basis,
      matches,
    };
  }

  /**
   * Bulk check up to 50 candidates in a single optimized pass.
   * Also performs intra-batch session deduplication.
   */
  static async checkMany(input: CheckOffersDuplicatesInput, client?: any): Promise<CheckOffersDuplicatesResult> {
    const candidates = Array.isArray(input.candidates) ? input.candidates.slice(0, 50) : [];
    if (candidates.length === 0) {
      return {
        results: [],
        summary: {
          checked: 0,
          new: 0,
          duplicates: 0,
          possible_duplicates: 0,
        },
      };
    }

    const offers = await dbService.getOffers(undefined, client);
    const index = buildCatalogIndex(offers);

    // Intra-session dedupe tracker for the current batch
    const seenBatchLps = new Map<string, { candidate_id: string; offer_name: string }>();
    const seenBatchCheckouts = new Map<string, { candidate_id: string; offer_name: string }>();
    const seenBatchMetaAdIds = new Map<string, { candidate_id: string; offer_name: string }>();

    const results: CandidateDedupeResult[] = [];
    let duplicateCount = 0;
    let possibleDuplicateCount = 0;
    let newCount = 0;

    for (const cand of candidates) {
      const cleanLp = canonicalizeOfferUrl(cand.landing_page_url);
      const cleanCheckout = canonicalizeOfferUrl(cand.checkout_url);
      const metaAdId = cand.meta_ad_id?.trim() || extractMetaAdId(cand.meta_ads_url);

      // 1. Check intra-batch duplication first
      if (cleanLp && cleanLp.length > 10 && seenBatchLps.has(cleanLp)) {
        const prior = seenBatchLps.get(cleanLp)!;
        results.push({
          candidate_id: cand.candidate_id,
          status: 'DUPLICATE',
          matched_offer_id: null,
          matched_offer_name: prior.offer_name,
          reason: 'DUPLICATE_CANDIDATE_IN_SAME_BATCH',
        });
        duplicateCount++;
        continue;
      }

      if (metaAdId && seenBatchMetaAdIds.has(metaAdId)) {
        const prior = seenBatchMetaAdIds.get(metaAdId)!;
        results.push({
          candidate_id: cand.candidate_id,
          status: 'DUPLICATE',
          matched_offer_id: null,
          matched_offer_name: prior.offer_name,
          reason: 'DUPLICATE_META_AD_IN_SAME_BATCH',
        });
        duplicateCount++;
        continue;
      }

      // 2. Check catalog index
      const evaluation = evaluateCandidateAgainstIndex(cand, index);

      if (evaluation.status === 'DUPLICATE') {
        duplicateCount++;
        results.push({
          candidate_id: cand.candidate_id,
          status: 'DUPLICATE',
          matched_offer_id: evaluation.matched_offer?.id ?? null,
          matched_offer_name: evaluation.matched_offer?.product_name || evaluation.matched_offer?.offer_name || null,
          reason: evaluation.primary_reason,
        });
      } else if (evaluation.status === 'POSSIBLE_DUPLICATE') {
        possibleDuplicateCount++;
        results.push({
          candidate_id: cand.candidate_id,
          status: 'POSSIBLE_DUPLICATE',
          matched_offer_id: evaluation.matched_offer?.id ?? null,
          matched_offer_name: evaluation.matched_offer?.product_name || evaluation.matched_offer?.offer_name || null,
          reason: evaluation.primary_reason,
        });
      } else {
        newCount++;
        results.push({
          candidate_id: cand.candidate_id,
          status: 'NEW',
          matched_offer_id: null,
          matched_offer_name: null,
          reason: null,
        });

        // Register in intra-batch trackers
        const nameDesc = cand.offer_name || cand.candidate_id;
        if (cleanLp && cleanLp.length > 10) {
          seenBatchLps.set(cleanLp, { candidate_id: cand.candidate_id, offer_name: nameDesc });
        }
        if (cleanCheckout && cleanCheckout.length > 10) {
          seenBatchCheckouts.set(cleanCheckout, { candidate_id: cand.candidate_id, offer_name: nameDesc });
        }
        if (metaAdId) {
          seenBatchMetaAdIds.set(metaAdId, { candidate_id: cand.candidate_id, offer_name: nameDesc });
        }
      }
    }

    return {
      results,
      summary: {
        checked: candidates.length,
        new: newCount,
        duplicates: duplicateCount,
        possible_duplicates: possibleDuplicateCount,
      },
    };
  }
}
