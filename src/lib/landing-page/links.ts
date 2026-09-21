// ==============================================================================
// OFFER MINER - LANDING PAGE LINKS & CHECKOUT PLATFORM EXTRACTOR
// ==============================================================================

import { RawPageDomData } from './extract';
import { LandingPageLink } from './types';

export function extractAndClassifyLinks(
  dom: RawPageDomData,
  captureId: string,
  offerId: string,
  baseDomain?: string
): LandingPageLink[] {
  const uniqueUrls = new Map<string, LandingPageLink>();

  dom.links.forEach((l, idx) => {
    const url = l.href.trim();
    if (!url || url.startsWith('javascript:') || url === '#') return;

    let domain = '';
    let isExternal = true;

    try {
      const parsed = new URL(url);
      domain = parsed.hostname.toLowerCase();
      if (baseDomain && domain.includes(baseDomain.toLowerCase())) {
        isExternal = false;
      }
    } catch {
      domain = '';
      isExternal = false;
    }

    // Determine link type and checkout platform
    const { linkType, checkoutPlatform } = classifyLink(url, domain, l.text);

    const record: LandingPageLink = {
      id: `link-${captureId}-${idx + 1}`,
      capture_id: captureId,
      offer_id: offerId,
      text: l.text || (checkoutPlatform ? `Checkout (${checkoutPlatform})` : 'Link'),
      url,
      domain: domain || null,
      link_type: linkType,
      checkout_platform: checkoutPlatform,
      is_external: isExternal,
    };

    if (!uniqueUrls.has(url)) {
      uniqueUrls.set(url, record);
    }
  });

  return Array.from(uniqueUrls.values());
}

export function classifyLink(
  url: string,
  domain: string,
  text: string
): {
  linkType:
    | 'checkout'
    | 'cta'
    | 'whatsapp'
    | 'instagram'
    | 'facebook'
    | 'youtube'
    | 'policy'
    | 'terms'
    | 'contact'
    | 'internal'
    | 'external';
  checkoutPlatform?:
    | 'kiwify'
    | 'hotmart'
    | 'kirvano'
    | 'perfectpay'
    | 'monetizze'
    | 'eduzz'
    | 'stripe'
    | 'custom'
    | null;
} {
  const u = url.toLowerCase();
  const d = domain.toLowerCase();
  const t = text.toLowerCase();

  // 1. Checkout platforms
  if (d.includes('kiwify') || u.includes('pay.kiwify.com.br')) {
    return { linkType: 'checkout', checkoutPlatform: 'kiwify' };
  }
  if (d.includes('hotmart') || u.includes('pay.hotmart.com')) {
    return { linkType: 'checkout', checkoutPlatform: 'hotmart' };
  }
  if (d.includes('kirvano')) {
    return { linkType: 'checkout', checkoutPlatform: 'kirvano' };
  }
  if (d.includes('perfectpay') || u.includes('go.perfectpay.com.br')) {
    return { linkType: 'checkout', checkoutPlatform: 'perfectpay' };
  }
  if (d.includes('monetizze') || u.includes('app.monetizze.com.br')) {
    return { linkType: 'checkout', checkoutPlatform: 'monetizze' };
  }
  if (d.includes('eduzz') || u.includes('sun.eduzz.com')) {
    return { linkType: 'checkout', checkoutPlatform: 'eduzz' };
  }
  if (d.includes('stripe') || u.includes('buy.stripe.com')) {
    return { linkType: 'checkout', checkoutPlatform: 'stripe' };
  }
  if (/checkout|pagamento|carrinho|compra/i.test(u) || /comprar|garantir\s*acesso|quero\s*meu/i.test(t)) {
    return { linkType: 'checkout', checkoutPlatform: 'custom' };
  }

  // 2. WhatsApp
  if (d.includes('wa.me') || d.includes('whatsapp.com') || u.includes('api.whatsapp.com')) {
    return { linkType: 'whatsapp' };
  }

  // 3. Social
  if (d.includes('instagram.com')) return { linkType: 'instagram' };
  if (d.includes('facebook.com')) return { linkType: 'facebook' };
  if (d.includes('youtube.com') || d.includes('youtu.be')) return { linkType: 'youtube' };

  // 4. Policy & Terms
  if (/politica|privacidade|privacy/i.test(u) || /política\s*de\s*privacidade/i.test(t)) {
    return { linkType: 'policy' };
  }
  if (/termos|terms|condicoes|tos/i.test(u) || /termos\s*de\s*uso/i.test(t)) {
    return { linkType: 'terms' };
  }
  if (/contato|suporte|fale-conosco|mailto:/i.test(u)) {
    return { linkType: 'contact' };
  }

  // 5. Internal CTA / anchor
  if (url.startsWith('#') || (!d && url.startsWith('/'))) {
    return { linkType: 'cta' };
  }

  return { linkType: 'external' };
}
