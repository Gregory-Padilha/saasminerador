// ==============================================================================
// OFFER MINER - CANONICAL URL MAPPING, CLASSIFICATION & INTEGRITY ENGINE
// ==============================================================================

import { Offer, LandingPageUrlStatus, LandingPageResolutionSource } from '@/types';

export type UrlClassificationType =
  | 'LANDING_PAGE'
  | 'CHECKOUT'
  | 'META_ADS_LIBRARY'
  | 'SOCIAL'
  | 'WHATSAPP'
  | 'QUIZ'
  | 'ADVERTORIAL'
  | 'UNKNOWN'
  | 'INVALID';

export interface CanonicalUrlFields {
  landing_page_url?: string | null;
  landing_page_domain?: string | null;
  meta_ads_url?: string | null;
  checkout_url?: string | null;
  website_url?: string | null;
  advertiser_url?: string | null;
  facebook_page_url?: string | null;
  instagram_url?: string | null;
  destination_url?: string | null;
}

export const CHECKOUT_HOSTNAMES = [
  'pay.kiwify.com.br',
  'kiwify.com.br',
  'pay.hotmart.com',
  'hotmart.com',
  'checkout.kirvano.com',
  'kirvano.com',
  'checkout.perfectpay.com.br',
  'perfectpay.com.br',
  'sun.eduzz.com',
  'eduzz.com',
  'app.monetizze.com.br',
  'monetizze.com.br',
  'checkout.greenn.com.br',
  'greenn.com.br',
  'checkout.pepper.com.br',
  'pepper.com.br',
  'ev.braip.com',
  'braip.com',
  'buy.stripe.com',
  'checkout.stripe.com',
  'checkout.ticto.app',
  'ticto.com.br',
  'cakto.com.br',
  'pag.ae',
  'pagseguro.uol.com.br',
  'mpago.la',
  'mercadopago.com.br',
  'lastlink.com',
  'pay.lastlink.com',
  'hubla.app',
  'pay.hubla.app',
];

export const SOCIAL_HOSTNAMES = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'pinterest.com',
];

export const WHATSAPP_HOSTNAMES = [
  'wa.me',
  'api.whatsapp.com',
  'chat.whatsapp.com',
  'web.whatsapp.com',
  'whatsapp.com',
];

export const QUIZ_HOSTNAMES = [
  'typeform.com',
  'involve.me',
  'tally.so',
  'formspree.io',
  'jotform.com',
  'respostas.site',
];

/**
 * Normalizes a URL strictly without destroying tracking parameters (UTM, ref, etc.)
 * Strips zero-width characters, extra spaces, unescaped whitespace, quotes.
 * Prepends https:// if missing.
 */
export function normalizeUrl(raw?: any): string | null {
  if (raw === null || raw === undefined) return null;
  let str = String(raw)
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  if (!str) return null;

  // If already protocol-relative
  if (str.startsWith('//')) {
    str = 'https:' + str;
  } else if (!/^https?:\/\//i.test(str)) {
    // If it doesn't have a valid domain structure (e.g. just a word without dot or invalid), keep as is or prepend
    if (str.includes('.') && !str.includes(' ')) {
      str = 'https://' + str;
    } else {
      return str;
    }
  }

  try {
    const parsed = new URL(str);
    // Lowercase hostname only
    parsed.hostname = parsed.hostname.toLowerCase();
    let res = parsed.toString();
    if (!str.endsWith('/') && res.endsWith('/') && parsed.pathname === '/' && !parsed.search && !parsed.hash) {
      res = res.slice(0, -1);
    }
    return res;
  } catch {
    return str;
  }
}

/**
 * Canonicalizes a URL specifically for comparison and deduplication.
 * Removes tracking parameters (utm_*, fbclid, gclid, etc.) and trailing slashes.
 * Preserves the full path and query parameters that alter content.
 */
export function canonicalizeUrlForComparison(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return '';

  try {
    const url = new URL(normalized);
    const paramsToDelete: string[] = [];

    url.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (
        lower.startsWith('utm_') ||
        lower === 'fbclid' ||
        lower === 'gclid' ||
        lower === 'ttclid' ||
        lower === 'src' ||
        lower === 'sck' ||
        lower === 'ref' ||
        lower === 'preview' ||
        lower === 'vgo_ee'
      ) {
        paramsToDelete.push(key);
      }
    });

    paramsToDelete.forEach((k) => url.searchParams.delete(k));

    let clean = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    const remainingParams = url.searchParams.toString();
    if (remainingParams) {
      clean += `?${remainingParams}`;
    }
    return clean.toLowerCase();
  } catch {
    return String(rawUrl).trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Extracts clean hostname strictly without www. or protocol.
 * NEVER creates a URL from a domain — only extracts domain from a URL or raw hostname.
 */
export function extractHostname(urlOrHost?: string | null): string {
  if (!urlOrHost) return '';
  const str = String(urlOrHost).trim();
  if (!str) return '';

  try {
    let clean = str;
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return str
      .replace(/^(https?:\/\/)?(www\.)?/i, '')
      .split('/')[0]
      .split('?')[0]
      .split(':')[0]
      .toLowerCase();
  }
}

/**
 * Classifies a URL into its functional role in the marketing and sales ecosystem.
 */
export function classifyUrl(url?: string | null): UrlClassificationType {
  if (!url) return 'INVALID';
  const norm = normalizeUrl(url);
  if (!norm) return 'INVALID';

  try {
    const parsed = new URL(norm);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // 1. Meta Ads Library
    if (
      (host.includes('facebook.com') || host.includes('fb.com')) &&
      (pathname.includes('/ads/library') || pathname.includes('/ad_library'))
    ) {
      return 'META_ADS_LIBRARY';
    }

    // 2. WhatsApp links
    if (WHATSAPP_HOSTNAMES.some((w) => host === w || host.endsWith(`.${w}`))) {
      return 'WHATSAPP';
    }

    // 3. Social profiles
    if (SOCIAL_HOSTNAMES.some((s) => host === s || host.endsWith(`.${s}`))) {
      return 'SOCIAL';
    }

    // 4. Checkout gateways
    if (
      CHECKOUT_HOSTNAMES.some((c) => host === c || host.endsWith(`.${c}`)) ||
      pathname.includes('/checkout') ||
      pathname.includes('/pay/')
    ) {
      return 'CHECKOUT';
    }

    // 5. Quiz funnels
    if (QUIZ_HOSTNAMES.some((q) => host === q || host.endsWith(`.${q}`))) {
      return 'QUIZ';
    }

    // 6. Advertorial
    if (pathname.includes('advertorial') || pathname.includes('/artigo/') || pathname.includes('/noticia/')) {
      return 'ADVERTORIAL';
    }

    // Standard Landing page / sales page
    if (host.includes('.')) {
      return 'LANDING_PAGE';
    }

    return 'UNKNOWN';
  } catch {
    return 'INVALID';
  }
}

/**
 * Returns the single source of truth for the current operational Landing Page URL.
 * Prioritizes:
 * 1. manual_override_url
 * 2. landing_page_url_resolved (verified working)
 * 3. landing_page_url (canonical complete URL from XLSX)
 * 4. landing_page_url_original
 */
export function getCurrentLandingPageUrl(offer?: Partial<Offer> | null): string | null {
  if (!offer) return null;

  if (offer.manual_override_url && typeof offer.manual_override_url === 'string') {
    const norm = normalizeUrl(offer.manual_override_url);
    if (norm) return norm;
  }

  if (offer.landing_page_url_resolved && typeof offer.landing_page_url_resolved === 'string') {
    const norm = normalizeUrl(offer.landing_page_url_resolved);
    if (norm) return norm;
  }

  if (offer.landing_page_url && typeof offer.landing_page_url === 'string') {
    const classification = classifyUrl(offer.landing_page_url);
    if (classification === 'LANDING_PAGE' || classification === 'UNKNOWN') {
      const norm = normalizeUrl(offer.landing_page_url);
      if (norm) return norm;
    }
  }

  if (offer.landing_page_url_original && typeof offer.landing_page_url_original === 'string') {
    const classification = classifyUrl(offer.landing_page_url_original);
    if (classification === 'LANDING_PAGE' || classification === 'UNKNOWN') {
      const norm = normalizeUrl(offer.landing_page_url_original);
      if (norm) return norm;
    }
  }

  return null;
}
