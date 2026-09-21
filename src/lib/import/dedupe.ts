// ==============================================================================
// OFFER MINER - MULTI-LEVEL DEDUPLICATION & URL CANONICALIZATION ENGINE
// ==============================================================================

import { NormalizedOfferImportRecord, NormalizationReport, ImportDedupeStatus } from './types';
import { Offer } from '@/types';
import { generateDedupeKey } from '../deduplication';
import { extractDomain } from '../utils';

/**
 * Known marketing/tracking query parameters that should be stripped for deduplication.
 * Product-specific query parameters (e.g., id, p, sku, product_id, page_id) MUST BE PRESERVED.
 */
const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'ttclid',
  'twclid',
  'ref',
  'src',
  'source',
  'aff',
  'affiliate',
  'aff_id',
  'ad_id',
  'adset_id',
  'campaign_id',
  'pixel_id',
  'fbc',
  'fbp',
  '_gl',
  '_ga',
  'gad_source',
  'gbraid',
  'wbraid',
]);

/**
 * Normalizes and canonicalizes URLs across landing pages, checkouts, and ad libraries.
 * Strips tracking parameters while strictly preserving product identifiers.
 */
export function canonicalizeOfferUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    let urlToParse = trimmed;
    // Prepend https:// if protocol is missing
    if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
      urlToParse = `https://${urlToParse}`;
    }

    const parsed = new URL(urlToParse);

    // Normalize protocol to https
    parsed.protocol = 'https:';

    // Normalize hostname (lowercase, strip www.)
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    parsed.hostname = hostname;

    // Strip default ports
    if (parsed.port === '80' || parsed.port === '443') {
      parsed.port = '';
    }

    // Filter query parameters: strip tracking parameters, retain product/identifying parameters
    const searchParams = new URLSearchParams(parsed.search);
    const cleanedParams = new URLSearchParams();

    // Specific logic for Meta Ads Library URLs: preserve id, view_all_page_id, active_status
    const isMetaAds = hostname.includes('facebook.com') || hostname.includes('meta.com');
    if (isMetaAds && parsed.pathname.includes('/ads/library')) {
      const adId = searchParams.get('id');
      const pageId = searchParams.get('view_all_page_id');
      if (adId) cleanedParams.set('id', adId);
      if (pageId) cleanedParams.set('view_all_page_id', pageId);
    } else {
      for (const [key, value] of searchParams.entries()) {
        const lowerKey = key.toLowerCase();
        if (!TRACKING_QUERY_PARAMS.has(lowerKey)) {
          cleanedParams.set(key, value);
        }
      }
    }

    parsed.search = cleanedParams.toString() ? `?${cleanedParams.toString()}` : '';

    // Strip trailing slash on pathname unless path is just "/"
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.substring(0, pathname.length - 1);
    }
    parsed.pathname = pathname;

    // Strip hash fragment
    parsed.hash = '';

    return parsed.toString().toLowerCase();
  } catch {
    // Fallback normalization if URL parsing fails
    return trimmed
      .toLowerCase()
      .split('#')[0]
      .split('?')[0]
      .replace(/\/$/, '');
  }
}

/**
 * Normalizes text tokens by removing accents, lowercasing, and removing non-alphanumeric chars.
 */
export function cleanToken(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Computes a deterministic multi-signal canonical fingerprint for an offer record.
 * Follows strict priority order and GUARANTEES that two different products from the same
 * advertiser are NEVER collapsed into the same fingerprint.
 */
export function canonicalOfferFingerprint(record: NormalizedOfferImportRecord): string {
  // 1. External Offer ID (if present in extra_data or raw)
  const externalId =
    record.extra_data?.external_offer_id ||
    record.extra_data?.external_id ||
    record.raw_data?.external_offer_id ||
    record.raw_data?.external_id ||
    record.raw_data?.offer_id;
  if (externalId) {
    return `ext_id::${cleanToken(String(externalId))}`;
  }

  const cleanProduct = cleanToken(record.offer_name);
  const cleanAdv = cleanToken(record.advertiser);
  const cleanLp = canonicalizeOfferUrl(record.landing_page_url);
  const cleanCheckout = canonicalizeOfferUrl(record.checkout_url);
  const cleanMeta = canonicalizeOfferUrl(record.meta_ads_url);
  const pageId = record.meta_page_id || record.extra_data?.meta_page_id;
  const metaAdId =
    record.extra_data?.meta_ad_id ||
    (cleanMeta ? cleanMeta.match(/[?&]id=(\d+)/i)?.[1] : null);

  // 2. Specific Meta Ad ID (if present and paired with product/advertiser/url)
  if (metaAdId && cleanProduct) {
    return `meta_ad_prod::${metaAdId}__${cleanProduct}`;
  }
  if (metaAdId && cleanAdv) {
    return `meta_ad_adv::${metaAdId}__${cleanAdv}`;
  }
  if (metaAdId) {
    return `meta_ad::${metaAdId}`;
  }

  // 3. Advertiser + Product Name (Strict: Different products from same advertiser stay distinct!)
  if (cleanAdv && cleanProduct) {
    return `adv_prod::${cleanAdv}__${cleanProduct}`;
  }

  // 4. Exact Canonical Landing Page URL + Product Name
  if (cleanLp && cleanLp.length > 12 && cleanProduct) {
    return `lp_prod::${cleanLp}__${cleanProduct}`;
  }

  // 5. Meta Page ID + Product Name
  if (pageId && cleanProduct) {
    return `page_prod::${pageId}__${cleanProduct}`;
  }

  // 6. Specific Meta Ads Ad URL (has ?id=...)
  if (cleanMeta && cleanMeta.includes('?id=')) {
    return `meta_ad_url::${cleanMeta}`;
  }

  // 7. Exact Canonical Landing Page URL (without product)
  if (cleanLp && cleanLp.length > 12) {
    return `lp::${cleanLp}`;
  }

  // 8. Exact Canonical Checkout URL
  if (cleanCheckout && cleanCheckout.length > 15) {
    return `chk::${cleanCheckout}`;
  }

  // 9. Domain + Product Name
  const domain = cleanToken(extractDomain(record.landing_page_url));
  if (domain && cleanProduct) {
    return `dom_prod::${domain}__${cleanProduct}`;
  }

  // 10. Product name only if long and distinctive
  if (cleanProduct && cleanProduct.length >= 8) {
    return `prod::${cleanProduct}`;
  }

  // 11. Page ID only if no product name exists
  if (pageId) {
    return `page::${pageId}`;
  }

  // Fallback: raw json hash or random token
  return `raw::${cleanToken(JSON.stringify(record.raw_data)).slice(0, 40)}`;
}

/**
 * Result of within-batch consolidation.
 */
export interface ConsolidatedBatchItem {
  record: NormalizedOfferImportRecord;
  report: NormalizationReport;
  fingerprint: string;
  occurrenceCount: number;
  originalIndices: number[];
}

/**
 * Level 2 Deduplication: Consolidates duplicates occurring within the same import batch.
 * If the exact same offer appears multiple times in the incoming JSON, it is merged into
 * a single candidate record with an occurrence count badge.
 */
export function consolidateBatchRecords(
  records: NormalizedOfferImportRecord[],
  reports: NormalizationReport[]
): {
  consolidatedItems: ConsolidatedBatchItem[];
  duplicatesConsolidatedCount: number;
} {
  const map = new Map<string, ConsolidatedBatchItem>();
  let duplicatesCount = 0;

  records.forEach((rec, idx) => {
    const rep = reports[idx] || {
      sourceFieldMap: {},
      ignoredFields: [],
      warnings: [],
      errors: [],
      record: rec,
    };

    const fp = canonicalOfferFingerprint(rec);

    if (map.has(fp)) {
      duplicatesCount++;
      const existing = map.get(fp)!;
      existing.occurrenceCount += 1;
      existing.originalIndices.push(idx + 1);

      // Merge non-null fields if the subsequent occurrence has more recent or complete information
      if (!existing.record.active_ads_count && rec.active_ads_count) {
        existing.record.active_ads_count = rec.active_ads_count;
      }
      if (!existing.record.front_price && rec.front_price) {
        existing.record.front_price = rec.front_price;
      }
      if (!existing.record.meta_ads_url && rec.meta_ads_url) {
        existing.record.meta_ads_url = rec.meta_ads_url;
      }
      if (!existing.record.landing_page_url && rec.landing_page_url) {
        existing.record.landing_page_url = rec.landing_page_url;
      }
      if (!existing.record.checkout_url && rec.checkout_url) {
        existing.record.checkout_url = rec.checkout_url;
      }
      if (!existing.record.days_running && rec.days_running) {
        existing.record.days_running = rec.days_running;
      }
    } else {
      map.set(fp, {
        record: { ...rec },
        report: { ...rep },
        fingerprint: fp,
        occurrenceCount: 1,
        originalIndices: [idx + 1],
      });
    }
  });

  return {
    consolidatedItems: Array.from(map.values()),
    duplicatesConsolidatedCount: duplicatesCount,
  };
}

/**
 * Level 3 Deduplication: Compares a candidate record against existing database offers.
 */
export function detectDuplicateMultiLevel(
  candidate: NormalizedOfferImportRecord,
  existingOffers: Offer[]
): {
  status: ImportDedupeStatus;
  existingOffer: Offer | null;
  matchReason?: string;
  fingerprint: string;
} {
  const fp = canonicalOfferFingerprint(candidate);

  if (!existingOffers || existingOffers.length === 0) {
    return { status: 'NEW', existingOffer: null, fingerprint: fp };
  }

  // 1. Meta Ad ID Match (e.g. ?id=865473736608989)
  const candAdId =
    candidate.extra_data?.meta_ad_id ||
    (candidate.meta_ads_url ? candidate.meta_ads_url.match(/[?&]id=(\d+)/i)?.[1] : null);

  if (candAdId) {
    const metaAdIdMatch = existingOffers.find((o) => {
      const existingAdId =
        o.extra_data?.meta_ad_id ||
        (o.meta_ads_url ? o.meta_ads_url.match(/[?&]id=(\d+)/i)?.[1] : null);
      return existingAdId === candAdId;
    });
    if (metaAdIdMatch) {
      return {
        status: 'EXISTING',
        existingOffer: metaAdIdMatch,
        matchReason: `Meta Ad ID idêntico já cadastrado (${candAdId})`,
        fingerprint: fp,
      };
    }
  }

  // 2. Meta Page ID Match (Only if same product or candidate has no product name)
  const cleanCandProduct = cleanToken(candidate.offer_name);
  const cleanCandAdv = cleanToken(candidate.advertiser);

  if (candidate.meta_page_id) {
    const pageIdMatch = existingOffers.find((o) => {
      const matchesPage =
        (o.raw_data?.meta_page_id && String(o.raw_data.meta_page_id) === String(candidate.meta_page_id)) ||
        (o.meta_ads_url && o.meta_ads_url.includes(candidate.meta_page_id!));
      if (!matchesPage) return false;
      // If candidate has a specific product name and existing has a different product name, do not match as same offer
      if (cleanCandProduct && o.product_name) {
        return cleanToken(o.product_name) === cleanCandProduct;
      }
      return true;
    });
    if (pageIdMatch) {
      return {
        status: 'EXISTING',
        existingOffer: pageIdMatch,
        matchReason: `Meta Page ID correspondente: ${candidate.meta_page_id}`,
        fingerprint: fp,
      };
    }
  }

  // 2. Exact Canonical Landing Page URL
  if (candidate.landing_page_url) {
    const cleanCandLp = canonicalizeOfferUrl(candidate.landing_page_url);
    if (cleanCandLp.length > 15) {
      const lpMatch = existingOffers.find((o) => {
        if (!o.landing_page_url) return false;
        return canonicalizeOfferUrl(o.landing_page_url) === cleanCandLp;
      });
      if (lpMatch) {
        return {
          status: 'EXISTING',
          existingOffer: lpMatch,
          matchReason: 'URL da Página de Vendas (LP) já cadastrada',
          fingerprint: fp,
        };
      }
    }
  }

  // 3. Exact Canonical Checkout URL
  if (candidate.checkout_url) {
    const cleanCandChk = canonicalizeOfferUrl(candidate.checkout_url);
    if (cleanCandChk.length > 20) {
      const chkMatch = existingOffers.find((o) => {
        if (!o.checkout_url) return false;
        return canonicalizeOfferUrl(o.checkout_url) === cleanCandChk;
      });
      if (chkMatch) {
        return {
          status: 'POSSIBLE_DUPLICATE',
          existingOffer: chkMatch,
          matchReason: 'Mesma URL de Checkout encontrada em outra oferta',
          fingerprint: fp,
        };
      }
    }
  }

  // 4. Exact Meta Ads Specific URL
  if (candidate.meta_ads_url) {
    const cleanCandMeta = canonicalizeOfferUrl(candidate.meta_ads_url);
    if (cleanCandMeta.includes('?id=')) {
      const metaMatch = existingOffers.find((o) => {
        if (!o.meta_ads_url) return false;
        return canonicalizeOfferUrl(o.meta_ads_url) === cleanCandMeta;
      });
      if (metaMatch) {
        return {
          status: 'EXISTING',
          existingOffer: metaMatch,
          matchReason: 'URL idêntica da Biblioteca do Meta Ads',
          fingerprint: fp,
        };
      }
    }
  }

  // 5. Canonical Key (Advertiser + Product Name)
  if (cleanCandProduct && cleanCandAdv) {
    const nameAdvMatch = existingOffers.find((o) => {
      return cleanToken(o.product_name) === cleanCandProduct && cleanToken(o.advertiser) === cleanCandAdv;
    });
    if (nameAdvMatch) {
      return {
        status: 'EXISTING',
        existingOffer: nameAdvMatch,
        matchReason: 'Mesmo nome de produto e mesmo anunciante',
        fingerprint: fp,
      };
    }
  }

  // 6. Dedupe Key from legacy deduplication
  const candidateKey = generateDedupeKey({
    product_name: candidate.offer_name,
    advertiser: candidate.advertiser,
    landing_page_url: candidate.landing_page_url,
  });
  const exactKeyMatch = existingOffers.find((o) => o.dedupe_key === candidateKey);
  if (exactKeyMatch) {
    return {
      status: 'EXISTING',
      existingOffer: exactKeyMatch,
      matchReason: 'Identificador canônico (Nome + Anunciante + Domínio) idêntico',
      fingerprint: fp,
    };
  }

  // 7. Partial match: Same product name (without advertiser) if distinctive
  if (cleanCandProduct && cleanCandProduct.length > 10) {
    const nameMatch = existingOffers.find((o) => cleanToken(o.product_name) === cleanCandProduct);
    if (nameMatch) {
      return {
        status: 'POSSIBLE_DUPLICATE',
        existingOffer: nameMatch,
        matchReason: 'Nome similar de oferta já existente',
        fingerprint: fp,
      };
    }
  }

  return { status: 'NEW', existingOffer: null, fingerprint: fp };
}
