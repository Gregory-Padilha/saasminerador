// ==============================================================================
// OFFER MINER - CHECKOUT URL RESOLVER (PURE / BROWSER-SAFE)
// ==============================================================================

import { Offer } from '@/types';
import { CheckoutResolutionResult } from './types';
import { canonicalizeUrlForComparison, extractHostname } from '@/lib/url-field-mapping';

export const KNOWN_CHECKOUT_DOMAINS = [
  'pay.kiwify.com.br',
  'kiwify.com.br',
  'pay.hotmart.com',
  'hotmart.com',
  'pay.wiapy.com',
  'wiapy.com',
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
  'checkout.cartpanda.com',
  'cartpanda.com',
  'ggcheckout.app',
];

export const PURCHASE_KEYWORDS = [
  'comprar agora',
  'quero meu acesso',
  'quero começar',
  'garantir acesso',
  'comprar',
  'acesso imediato',
  'quero o plano',
  'quero receber agora',
  'garantir material',
  'continuar',
  'sim, eu quero',
  'acessar material',
  'adquirir',
  'finalizar compra',
  'aproveitar oferta',
  'começar agora',
];

export const NON_COMMERCIAL_KEYWORDS = [
  'assistir',
  'ver vídeo',
  'saiba mais',
  'conhecer',
  'ver conteúdo',
  'continuar lendo',
  'play',
  'depoimento',
  'comentário',
];

/**
 * Checks if a given URL is a known checkout URL based on domain or path
 */
export function isKnownCheckoutUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  const hostname = extractHostname(lower);

  if (KNOWN_CHECKOUT_DOMAINS.some((d) => hostname.includes(d) || lower.includes(d))) {
    return true;
  }
  if (/\/(checkout|pay|pagamento|finalizar-compra)\b/i.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Single Source of Truth to resolve current Checkout URL by canonical hierarchy:
 * 1. manual_override_url (if verified & distinct from LP)
 * 2. stored checkout_url (if distinct from LP)
 * 3. funnel steps checkout URL
 * 4. checkout URL from LP mapping / CTAs
 * 5. historical checkout capture URL
 * 6. fallback: discover via Landing Page CTAs
 */
export function resolveCurrentCheckoutUrl(offer: Offer): CheckoutResolutionResult {
  const lpUrl = offer.landing_page_url || offer.landing_page_url_original || '';
  const lpCanonical = canonicalizeUrlForComparison(lpUrl);

  const extra = offer.extra_data || {};
  const lpAnalysis = extra.latest_lp_analysis || (offer as any).landing_page_analysis || null;
  const lpCommerce = lpAnalysis?.commerce || null;

  // 1. Manual override
  const manualUrl = offer.manual_override_url || (offer as any).manual_checkout_url;
  if (manualUrl) {
    const manualCanonical = canonicalizeUrlForComparison(manualUrl);
    if (manualCanonical && manualCanonical !== lpCanonical) {
      return {
        offerId: offer.id,
        originalUrl: manualUrl,
        resolvedCheckoutUrl: manualUrl,
        source: 'MANUAL',
        selectedUrlReason: 'URL de checkout manual sobrescrita pelo usuário',
        isDistinctFromLp: true,
        status: 'not_checked',
        userFriendlyMessage: 'URL de checkout manual configurada.',
      };
    }
  }

  // 2. Current stored offer.checkout_url
  if (offer.checkout_url) {
    const checkoutCanonical = canonicalizeUrlForComparison(offer.checkout_url);
    if (checkoutCanonical && checkoutCanonical !== lpCanonical) {
      return {
        offerId: offer.id,
        originalUrl: offer.checkout_url,
        resolvedCheckoutUrl: offer.checkout_url,
        source: 'CHECKOUT_STORED',
        selectedUrlReason: 'checkout_url válida já existente na oferta',
        isDistinctFromLp: true,
        status: 'not_checked',
        userFriendlyMessage: 'URL de checkout registrada na oferta encontrada.',
      };
    }
  }

  // 3. Funnel steps checkout URL
  if (offer.funnel_steps && offer.funnel_steps.length > 0) {
    const checkoutStep = offer.funnel_steps.find(
      (fs) => fs.step_type === 'checkout' && fs.url && canonicalizeUrlForComparison(fs.url) !== lpCanonical
    );
    if (checkoutStep && checkoutStep.url) {
      return {
        offerId: offer.id,
        originalUrl: checkoutStep.url,
        resolvedCheckoutUrl: checkoutStep.url,
        source: 'FUNNEL',
        selectedUrlReason: 'URL de checkout encontrada na esteira do funil',
        isDistinctFromLp: true,
        status: 'not_checked',
        userFriendlyMessage: 'URL de checkout identificada na esteira do funil.',
      };
    }
  }

  // 4. CTAs or links from LP analysis
  if (lpCommerce?.checkoutUrls && lpCommerce.checkoutUrls.length > 0) {
    const validCtaUrl = lpCommerce.checkoutUrls.find((u: string) => {
      const c = canonicalizeUrlForComparison(u);
      return c && c !== lpCanonical;
    });

    if (validCtaUrl) {
      return {
        offerId: offer.id,
        originalUrl: validCtaUrl,
        resolvedCheckoutUrl: validCtaUrl,
        source: 'LP_CTA',
        selectedUrlReason: 'URL de checkout encontrada no mapeamento prévio da LP',
        isDistinctFromLp: true,
        status: 'not_checked',
        userFriendlyMessage: 'URL de checkout identificada via CTA do mapeamento da LP.',
      };
    }
  }

  // 5. Historical checkout captures (ONLY if checkout was verified & confirmed!)
  const latestCap = extra.latest_checkout_capture;
  if (
    latestCap?.checkoutUrl &&
    (latestCap.status === 'verified' || latestCap.diagnostic?.checkoutConfirmed === true)
  ) {
    const capCanonical = canonicalizeUrlForComparison(latestCap.checkoutUrl);
    const lpHost = extractHostname(lpUrl);
    const capHost = extractHostname(latestCap.checkoutUrl);

    if (capCanonical && capCanonical !== lpCanonical && lpHost !== capHost) {
      return {
        offerId: offer.id,
        originalUrl: latestCap.checkoutUrl,
        resolvedCheckoutUrl: latestCap.checkoutUrl,
        source: 'HISTORY',
        selectedUrlReason: 'URL de checkout verificada recuperada do histórico recente',
        isDistinctFromLp: true,
        status: 'not_checked',
        userFriendlyMessage: 'URL de checkout recuperada do histórico de capturas.',
      };
    }
  }

  return {
    offerId: offer.id,
    originalUrl: null,
    resolvedCheckoutUrl: null,
    source: 'NONE',
    selectedUrlReason: 'Nenhuma URL de checkout conhecida. Necessário descoberta via LP.',
    isDistinctFromLp: false,
    status: 'url_not_found',
    userFriendlyMessage: 'Nenhuma URL de checkout pré-existente identificada.',
  };
}

export function resolveCheckoutUrlStatic(offer: Offer): CheckoutResolutionResult {
  return resolveCurrentCheckoutUrl(offer);
}
