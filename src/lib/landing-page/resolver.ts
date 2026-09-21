// ==============================================================================
// OFFER MINER - LANDING PAGE URL RESOLVER & RECOVERY ENGINE
// ==============================================================================

import dns from 'dns';
import { Offer, LandingPageUrlStatus, LandingPageResolutionSource, LandingPageCandidateUrl, LandingPageUrlResolution, LandingPageUrlResolutionDiagnostic } from '@/types';
import { dbService } from '@/lib/supabase/db';
import {
  canonicalizeUrlForComparison,
  extractHostname,
  classifyUrl,
  getCurrentLandingPageUrl,
} from '@/lib/url-field-mapping';

const CHECKOUT_DOMAINS = [
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
];

/**
 * 1. Normalize Landing Page URL
 * Handles whitespace, quotes, invisible chars, missing protocol, duplicate slashes
 */
export function normalizeLandingPageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  // 1. Remove unicode zero-width spaces, invisible characters, newlines, tabs, and quotes
  let cleaned = rawUrl
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  if (!cleaned) return '';

  // 2. Prepend https:// if protocol is missing
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    // Normalize duplicate slashes in pathname (e.g. //path -> /path)
    parsed.pathname = parsed.pathname.replace(/\/+/g, '/');
    return parsed.toString();
  } catch (err) {
    // If URL parsing fails, return cleaned string
    return cleaned;
  }
}

/**
 * 2. Classify navigation and network errors into structured statuses and friendly messages
 */
export function classifyNavigationError(error: any): { status: LandingPageUrlStatus; userFriendlyMessage: string } {
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  const code = (error?.code || '').toUpperCase();

  if (
    msg.includes('err_name_not_resolved') ||
    msg.includes('enotfound') ||
    code === 'ENOTFOUND' ||
    msg.includes('eai_again')
  ) {
    return {
      status: 'DNS_NOT_RESOLVED',
      userFriendlyMessage: 'Não foi possível localizar o domínio desta página na internet.',
    };
  }

  if (
    msg.includes('err_connection_refused') ||
    msg.includes('econnrefused') ||
    code === 'ECONNREFUSED'
  ) {
    return {
      status: 'CONNECTION_REFUSED',
      userFriendlyMessage: 'O servidor da página recusou a conexão.',
    };
  }

  if (
    msg.includes('err_connection_reset') ||
    msg.includes('econnreset') ||
    code === 'ECONNRESET'
  ) {
    return {
      status: 'UNAVAILABLE',
      userFriendlyMessage: 'A conexão foi interrompida ou reiniciada pelo servidor da landing page.',
    };
  }

  if (
    msg.includes('err_timed_out') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    code === 'ETIMEDOUT'
  ) {
    return {
      status: 'TIMEOUT',
      userFriendlyMessage: 'A página demorou tempo excessivo para responder.',
    };
  }

  if (
    msg.includes('err_cert_') ||
    msg.includes('ssl') ||
    msg.includes('depth_zero_self_signed_cert') ||
    msg.includes('unable_to_verify_leaf_signature')
  ) {
    return {
      status: 'SSL_ERROR',
      userFriendlyMessage: 'Falha de certificado de segurança (SSL/TLS) na página.',
    };
  }

  if (msg.includes('404') || msg.includes('not found')) {
    return {
      status: 'HTTP_404',
      userFriendlyMessage: 'Página de vendas não encontrada (Erro 404).',
    };
  }

  if (msg.includes('403') || msg.includes('forbidden') || msg.includes('access denied')) {
    return {
      status: 'HTTP_403',
      userFriendlyMessage: 'A página recusou o acesso automatizado (Erro 403 Forbidden).',
    };
  }

  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return {
      status: 'HTTP_5XX',
      userFriendlyMessage: 'O servidor da página apresentou instabilidade interna (5xx).',
    };
  }

  if (msg.includes('cloudflare') || msg.includes('challenge') || msg.includes('turnstile')) {
    return {
      status: 'CLOUDFLARE_CHALLENGE',
      userFriendlyMessage: 'A página está protegida por verificação de segurança Cloudflare.',
    };
  }

  if (msg.includes('login') || msg.includes('auth')) {
    return {
      status: 'UNAVAILABLE',
      userFriendlyMessage: 'Acesso restrito ou requer autenticação.',
    };
  }

  return {
    status: 'UNAVAILABLE',
    userFriendlyMessage: 'Não foi possível carregar a landing page no momento.',
  };
}

/**
 * 3. DNS Preflight Lookup with Timeout
 */
export async function checkDns(hostname: string, timeoutMs = 4000): Promise<{ resolved: boolean; ips: string[]; error?: string }> {
  try {
    // Strip port if present
    const cleanHost = hostname.split(':')[0].toLowerCase();
    const lookupPromise = dns.promises.lookup(cleanHost, { all: true });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs)
    );

    const addresses = await Promise.race([lookupPromise, timeoutPromise]);
    const ips = (addresses as dns.LookupAddress[]).map((a) => a.address);

    return {
      resolved: ips.length > 0,
      ips,
    };
  } catch (err: any) {
    return {
      resolved: false,
      ips: [],
      error: err.code || err.message || 'DNS_FAILED',
    };
  }
}

/**
 * 4. Lightweight HTTP Preflight Check
 */
export async function checkHttp(
  url: string,
  timeoutMs = 6000
): Promise<{ status?: number; statusText?: string; ok: boolean; finalUrl?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } catch (headErr: any) {
      // If HEAD is blocked or fails, try lightweight GET
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Range: 'bytes=0-4096',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const ok = res.status >= 200 && res.status < 400;
    return {
      status: res.status,
      statusText: res.statusText,
      ok,
      finalUrl: res.url || url,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'TIMEOUT' : err.message,
    };
  }
}

/**
 * 5. Check if URL is a known Checkout platform
 */
export function isCheckoutUrl(urlStr: string): { isCheckout: boolean; platform: string | null } {
  try {
    const parsed = new URL(normalizeLandingPageUrl(urlStr));
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    for (const d of CHECKOUT_DOMAINS) {
      if (host === d || host.endsWith('.' + d)) {
        let platform = d.replace(/^(pay\.|checkout\.|app\.|sun\.|ev\.)/, '').split('.')[0];
        return { isCheckout: true, platform };
      }
    }

    if (
      path.includes('/checkout') ||
      path.includes('/pay/') ||
      path.includes('/comprar') ||
      parsed.searchParams.has('checkout')
    ) {
      return { isCheckout: true, platform: 'custom' };
    }

    return { isCheckout: false, platform: null };
  } catch {
    return { isCheckout: false, platform: null };
  }
}

/**
 * 6. Central Landing Page URL Resolver
 * Deterministic resolution pipeline:
 * Manual Override -> Normalized Original -> DNS Root -> DNS WWW -> Ad Destinations Recovery -> Diagnostic
 */
export async function resolveLandingPageUrl(
  offer: Offer,
  options: { forceReverify?: boolean } = {}
): Promise<LandingPageUrlResolution> {
  const originalUrl = offer.landing_page_url_original || offer.landing_page_url || '';
  const manualOverrideUrl = offer.manual_override_url || null;

  console.log(`[LP RESOLVE] Starting URL resolution for offer "${offer.product_name}" (ID: ${offer.id})`);
  console.log(`[LP RESOLVE] Original: "${originalUrl}" | Manual Override: "${manualOverrideUrl || 'None'}"`);

  // Target candidate to test initially
  const rawTarget = manualOverrideUrl || originalUrl;
  const normalizedTarget = normalizeLandingPageUrl(rawTarget);

  const checkedAt = new Date().toISOString();
  const diagnostic: LandingPageUrlResolutionDiagnostic = {
    originalUrl,
    normalizedUrl: normalizedTarget,
    dnsRoot: { hostname: '', resolved: false },
    dnsWww: undefined,
    httpCheck: undefined,
    adDestinationsCount: 0,
    adCandidates: [],
    checkedAt,
  };

  // If no URL at all exists
  if (!normalizedTarget) {
    console.log(`[LP RESOLVE] No URL provided in offer.`);
    return {
      originalUrl: '',
      normalizedUrl: '',
      resolvedUrl: null,
      finalUrl: null,
      domain: null,
      status: 'NEEDS_MANUAL_URL',
      source: 'NONE',
      checkoutUrl: offer.checkout_url || null,
      flowType: 'UNKNOWN',
      candidates: [],
      diagnostic,
      errorMessage: 'Nenhuma URL de Landing Page informada na oferta.',
      userFriendlyMessage: 'Landing page não informada para esta oferta.',
    };
  }

  // Parse hostname for testing
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedTarget);
  } catch (err: any) {
    console.warn(`[LP RESOLVE] Invalid URL syntax: "${normalizedTarget}"`);
    return {
      originalUrl,
      normalizedUrl: normalizedTarget,
      resolvedUrl: null,
      finalUrl: null,
      domain: null,
      status: 'INVALID_URL',
      source: 'NONE',
      checkoutUrl: offer.checkout_url || null,
      flowType: 'UNKNOWN',
      candidates: [],
      diagnostic,
      errorMessage: 'Sintaxe de URL inválida.',
      userFriendlyMessage: 'A URL informada possui formato inválido.',
    };
  }

  const hostname = parsedUrl.hostname;
  diagnostic.dnsRoot.hostname = hostname;

  // --------------------------------------------------------------------------
  // STEP 1: DNS PREFLIGHT ON ROOT HOSTNAME
  // --------------------------------------------------------------------------
  console.log(`[LP RESOLVE] Checking DNS for root hostname: ${hostname}...`);
  const dnsRootResult = await checkDns(hostname);
  diagnostic.dnsRoot = {
    hostname,
    resolved: dnsRootResult.resolved,
    ips: dnsRootResult.ips,
    error: dnsRootResult.error,
  };

  if (dnsRootResult.resolved) {
    console.log(`[LP RESOLVE] DNS Root SUCCESS (${dnsRootResult.ips.join(', ')}). Checking HTTP preflight...`);
    const httpCheck = await checkHttp(normalizedTarget);
    diagnostic.httpCheck = {
      checkedUrl: normalizedTarget,
      status: httpCheck.status,
      statusText: httpCheck.statusText,
      ok: httpCheck.ok,
      finalUrl: httpCheck.finalUrl,
      error: httpCheck.error,
    };

    if (httpCheck.ok) {
      const finalUrl = httpCheck.finalUrl || normalizedTarget;
      const isOverride = !!manualOverrideUrl;
      const source: LandingPageResolutionSource = isOverride ? 'MANUAL_OVERRIDE' : 'RESOLVED_ORIGINAL';

      console.log(`[LP RESOLVE] Resolution SUCCESS -> ${finalUrl} (Source: ${source})`);

      // Update offer resolution metadata in DB
      await dbService.updateOffer(offer.id, {
        landing_page_url_original: originalUrl,
        landing_page_url_resolved: finalUrl,
        landing_page_url_status: 'AVAILABLE',
        landing_page_url_last_checked_at: checkedAt,
        landing_page_domain: hostname,
        landing_page_resolution_source: source,
        landing_page_resolution_diagnostic: diagnostic,
      });

      return {
        originalUrl,
        normalizedUrl: normalizedTarget,
        resolvedUrl: finalUrl,
        finalUrl,
        domain: hostname,
        status: 'AVAILABLE',
        source,
        checkoutUrl: offer.checkout_url || null,
        flowType: 'LP_TO_CHECKOUT',
        candidates: [],
        diagnostic,
        userFriendlyMessage: 'Landing page disponível e respondendo normalmente.',
      };
    } else {
      console.warn(`[LP RESOLVE] DNS resolved but HTTP returned status ${httpCheck.status} / error: ${httpCheck.error}`);
    }
  } else {
    console.warn(`[LP RESOLVE] DNS Root FAILED for "${hostname}": ${dnsRootResult.error}`);
  }

  // --------------------------------------------------------------------------
  // STEP 2: TEST WWW VARIANT (OR STRIP WWW)
  // --------------------------------------------------------------------------
  const isWww = hostname.startsWith('www.');
  const altHostname = isWww ? hostname.replace(/^www\./, '') : `www.${hostname}`;
  diagnostic.dnsWww = { hostname: altHostname, resolved: false };

  console.log(`[LP RESOLVE] Testing safe hostname variant: "${altHostname}"...`);
  const dnsWwwResult = await checkDns(altHostname);
  diagnostic.dnsWww = {
    hostname: altHostname,
    resolved: dnsWwwResult.resolved,
    ips: dnsWwwResult.ips,
    error: dnsWwwResult.error,
  };

  if (dnsWwwResult.resolved) {
    const altUrlObj = new URL(normalizedTarget);
    altUrlObj.hostname = altHostname;
    const altUrl = altUrlObj.toString();

    console.log(`[LP RESOLVE] DNS Variant SUCCESS (${altHostname}). Checking HTTP...`);
    const httpWwwCheck = await checkHttp(altUrl);

    if (httpWwwCheck.ok) {
      const finalUrl = httpWwwCheck.finalUrl || altUrl;
      console.log(`[LP RESOLVE] Resolution SUCCESS via WWW Fallback -> ${finalUrl}`);

      await dbService.updateOffer(offer.id, {
        landing_page_url_original: originalUrl,
        landing_page_url_resolved: finalUrl,
        landing_page_url_status: 'AVAILABLE',
        landing_page_url_last_checked_at: checkedAt,
        landing_page_domain: altHostname,
        landing_page_resolution_source: 'WWW_FALLBACK',
        landing_page_resolution_diagnostic: diagnostic,
      });

      return {
        originalUrl,
        normalizedUrl: normalizedTarget,
        resolvedUrl: finalUrl,
        finalUrl,
        domain: altHostname,
        status: 'AVAILABLE',
        source: 'WWW_FALLBACK',
        checkoutUrl: offer.checkout_url || null,
        flowType: 'LP_TO_CHECKOUT',
        candidates: [],
        diagnostic,
        userFriendlyMessage: `Página localizada através da variação ${altHostname}.`,
      };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3: RECOVERY FROM META ADS DESTINATION URLS
  // --------------------------------------------------------------------------
  console.log(`[LP RESOLVE] Original & WWW failed. Searching destination URLs in Meta Ads for offer ${offer.id}...`);
  const ads = await dbService.getOfferAds(offer.id);
  diagnostic.adDestinationsCount = ads.length;

  const rawDestinations = ads
    .map((a) => a.destination_url)
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

  // Group candidate destinations by normalized URL
  const destinationMap = new Map<string, { url: string; count: number; domain: string; isCheckout: boolean }>();

  for (const rawDest of rawDestinations) {
    const normalized = normalizeLandingPageUrl(rawDest);
    if (!normalized) continue;

    try {
      const parsed = new URL(normalized);
      const chk = isCheckoutUrl(normalized);
      const existing = destinationMap.get(normalized);
      if (existing) {
        existing.count += 1;
      } else {
        destinationMap.set(normalized, {
          url: normalized,
          count: 1,
          domain: parsed.hostname,
          isCheckout: chk.isCheckout,
        });
      }
    } catch {}
  }

  const allCandidates = Array.from(destinationMap.values()).sort((a, b) => b.count - a.count);
  diagnostic.adCandidates = allCandidates;

  console.log(`[LP RESOLVE] Found ${allCandidates.length} unique candidates in Meta Ads.`);

  // 3a. Check if ALL ads go directly to Checkout
  const allAreCheckouts = allCandidates.length > 0 && allCandidates.every((c) => c.isCheckout);
  if (allAreCheckouts) {
    const primaryCheckout = allCandidates[0].url;
    console.log(`[LP RESOLVE] DIRECT_TO_CHECKOUT flow detected. Checkout: ${primaryCheckout}`);

    await dbService.updateOffer(offer.id, {
      landing_page_url_original: originalUrl,
      landing_page_url_resolved: primaryCheckout,
      landing_page_url_status: 'DIRECT_TO_CHECKOUT',
      landing_page_url_last_checked_at: checkedAt,
      landing_page_flow_type: 'DIRECT_TO_CHECKOUT',
      checkout_url: primaryCheckout,
      landing_page_resolution_source: 'META_AD_DESTINATION',
      landing_page_resolution_diagnostic: diagnostic,
    });

    return {
      originalUrl,
      normalizedUrl: normalizedTarget,
      resolvedUrl: primaryCheckout,
      finalUrl: primaryCheckout,
      domain: allCandidates[0].domain,
      status: 'DIRECT_TO_CHECKOUT',
      source: 'META_AD_DESTINATION',
      checkoutUrl: primaryCheckout,
      flowType: 'DIRECT_TO_CHECKOUT',
      candidates: allCandidates,
      diagnostic,
      userFriendlyMessage: 'Esta oferta envia os anúncios diretamente para o checkout (Funil Direto).',
    };
  }

  // 3b. Test up to 5 non-checkout LP candidates
  const lpCandidates = allCandidates.filter((c) => !c.isCheckout).slice(0, 5);
  for (const candidate of lpCandidates) {
    console.log(`[LP RESOLVE] Testing ad candidate (${candidate.count} ads): "${candidate.url}"...`);
    const candDns = await checkDns(candidate.domain);
    if (candDns.resolved) {
      const candHttp = await checkHttp(candidate.url);
      if (candHttp.ok) {
        const finalUrl = candHttp.finalUrl || candidate.url;
        console.log(`[LP RESOLVE] Candidate SUCCESS -> ${finalUrl} (Recovered from Ads)`);

        await dbService.updateOffer(offer.id, {
          landing_page_url_original: originalUrl,
          landing_page_url_resolved: finalUrl,
          landing_page_url_status: 'RECOVERED_FROM_ADS',
          landing_page_url_last_checked_at: checkedAt,
          landing_page_domain: candidate.domain,
          landing_page_flow_type: 'LP_TO_CHECKOUT',
          landing_page_resolution_source: 'META_AD_DESTINATION',
          landing_page_resolution_diagnostic: diagnostic,
        });

        return {
          originalUrl,
          normalizedUrl: normalizedTarget,
          resolvedUrl: finalUrl,
          finalUrl,
          domain: candidate.domain,
          status: 'RECOVERED_FROM_ADS',
          source: 'META_AD_DESTINATION',
          checkoutUrl: offer.checkout_url || null,
          flowType: 'LP_TO_CHECKOUT',
          candidates: allCandidates,
          diagnostic,
          userFriendlyMessage: 'Página de vendas recuperada através dos anúncios da Meta.',
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 4: ALL RESOLUTION ATTEMPTS FAILED -> STRUCTURED DEAD/OFFLINE STATE
  // --------------------------------------------------------------------------
  const failureStatus: LandingPageUrlStatus = !dnsRootResult.resolved ? 'DNS_NOT_RESOLVED' : 'UNAVAILABLE';
  const friendlyMsg = !dnsRootResult.resolved
    ? `Não foi possível localizar o domínio "${hostname}".`
    : `A página "${normalizedTarget}" está temporariamente indisponível.`;

  console.warn(`[LP RESOLVE] Resolution FAILED. Status: ${failureStatus} | ${friendlyMsg}`);

  await dbService.updateOffer(offer.id, {
    landing_page_url_original: originalUrl,
    landing_page_url_resolved: null,
    landing_page_url_status: failureStatus,
    landing_page_url_last_checked_at: checkedAt,
    landing_page_resolution_source: 'NONE',
    landing_page_resolution_diagnostic: diagnostic,
  });

  return {
    originalUrl,
    normalizedUrl: normalizedTarget,
    resolvedUrl: null,
    finalUrl: null,
    domain: hostname,
    status: failureStatus,
    source: 'NONE',
    checkoutUrl: offer.checkout_url || null,
    flowType: 'UNKNOWN',
    candidates: allCandidates,
    diagnostic,
    errorMessage: !dnsRootResult.resolved ? `DNS_NOT_RESOLVED: ${hostname}` : `HTTP_UNAVAILABLE: ${normalizedTarget}`,
    userFriendlyMessage: friendlyMsg,
  };
}

export interface ReconcileResult {
  offerId: string;
  originalUrl: string | null;
  resolvedUrl: string | null;
  isDivergent: boolean;
  status: LandingPageUrlStatus;
  dominantCandidate: LandingPageCandidateUrl | null;
  allCandidates: LandingPageCandidateUrl[];
  message: string;
}

/**
 * Reconciles an offer's registered URLs with captured ad destinations
 */
export async function reconcileOfferUrls(offerId: string): Promise<ReconcileResult> {
  const offer = await dbService.getOfferById(offerId);
  if (!offer) {
    throw new Error(`Oferta não encontrada: ${offerId}`);
  }

  const ads = await dbService.getOfferAds(offerId);
  const originalUrl = offer.landing_page_url_original || offer.landing_page_url || null;
  const canonicalOriginal = canonicalizeUrlForComparison(originalUrl);

  const rawDestinations = ads
    .map((a) => a.destination_url)
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

  const destinationMap = new Map<string, LandingPageCandidateUrl>();

  for (const rawDest of rawDestinations) {
    const normalized = normalizeLandingPageUrl(rawDest);
    if (!normalized) continue;

    try {
      const parsed = new URL(normalized);
      const chk = isCheckoutUrl(normalized);
      const existing = destinationMap.get(normalized);
      if (existing) {
        existing.count += 1;
      } else {
        destinationMap.set(normalized, {
          url: normalized,
          count: 1,
          domain: parsed.hostname,
          isCheckout: chk.isCheckout,
        });
      }
    } catch {}
  }

  const allCandidates = Array.from(destinationMap.values()).sort((a, b) => b.count - a.count);
  const dominantCandidate = allCandidates[0] || null;

  if (!dominantCandidate) {
    return {
      offerId,
      originalUrl,
      resolvedUrl: offer.landing_page_url_resolved || originalUrl,
      isDivergent: false,
      status: offer.landing_page_url_status || 'PENDING',
      dominantCandidate: null,
      allCandidates: [],
      message: 'Nenhum destino de anúncio encontrado para reconciliação.',
    };
  }

  const canonicalDominant = canonicalizeUrlForComparison(dominantCandidate.url);
  const isDivergent = !!canonicalOriginal && canonicalOriginal !== canonicalDominant;

  // If dominant is a checkout and all are checkouts
  if (allCandidates.every((c) => c.isCheckout)) {
    return {
      offerId,
      originalUrl,
      resolvedUrl: dominantCandidate.url,
      isDivergent,
      status: 'DIRECT_TO_CHECKOUT',
      dominantCandidate,
      allCandidates,
      message: 'Todos os anúncios apontam diretamente para checkout.',
    };
  }

  return {
    offerId,
    originalUrl,
    resolvedUrl: isDivergent ? dominantCandidate.url : (offer.landing_page_url_resolved || originalUrl),
    isDivergent,
    status: isDivergent ? 'RECOVERED_FROM_ADS' : (offer.landing_page_url_status || 'AVAILABLE'),
    dominantCandidate,
    allCandidates,
    message: isDivergent
      ? `Divergência detectada: ${dominantCandidate.count} anúncios apontam para ${dominantCandidate.domain}`
      : 'URLs dos anúncios coincidem com a landing page cadastrada.',
  };
}

export {
  getCurrentLandingPageUrl,
  canonicalizeUrlForComparison,
  extractHostname,
  classifyUrl,
} from '@/lib/url-field-mapping';

