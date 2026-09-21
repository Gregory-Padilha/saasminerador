// ==============================================================================
// OFFER MINER - COMMERCIAL OFFER MAPPER & PROVENANCE RESOLVER
// ==============================================================================

import { Offer, OfferDeliverable, OfferBonus, OfferOrderBump, OfferUpsell, OfferFrontendOption } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { calculateFrontendPricing, FrontendPricingSummary } from '@/lib/pricing';

export type VerificationStatus = 'verified' | 'unverified' | 'not_found' | 'unavailable';

export interface CommercialOfferSummary {
  // 1. Entry Product (Front-end)
  entryProduct: {
    name: string;
    currentPrice: number | null;
    originalPrice: number | null;
    discountPercent: number | null;
    productType: string;
    format: string;
    mainCta: string | null;
    otherCtas: string[];
    guaranteeDays: number | null;
    guaranteeText: string | null;
    guaranteeType: 'Incondicional' | 'Condicional' | 'Não determinado';
    checkoutPlatform: string | null;
    checkoutUrl: string | null;
    source: 'LP' | 'CHECKOUT' | 'ADS' | 'XLSX' | 'MANUAL';
  };

  // Multi-Option Front-End Pricing
  frontendPricing: FrontendPricingSummary;
  frontendOptions: OfferFrontendOption[];

  // 2. Deliverables & Bonuses
  deliverables: Array<
    OfferDeliverable & {
      format: string;
      source: 'LP' | 'CHECKOUT' | 'ADS' | 'XLSX' | 'MANUAL';
      evidenceText?: string;
      evidenceSection?: string;
    }
  >;
  bonuses: Array<
    OfferBonus & {
      claimedValue?: number | null;
      source: 'LP' | 'CHECKOUT' | 'ADS' | 'XLSX' | 'MANUAL';
      evidenceText?: string;
      evidenceSection?: string;
    }
  >;

  // 3. Funnel & Statuses
  checkoutStatus: VerificationStatus;
  orderBumpsStatus: VerificationStatus;
  upsellsStatus: VerificationStatus;

  orderBumps: OfferOrderBump[];
  upsells: OfferUpsell[];

  // 4. Observed & Maximum Potential Ticket
  observedTicket: number | null;
  maxPotentialTicket: number | null;
  isMaxPotentialDetermined: boolean;

  // 5. Conflicts & Sources Coverage
  conflicts: Array<{
    field: string;
    title: string;
    description: string;
    sourceA: { name: string; value: string };
    sourceB: { name: string; value: string };
  }>;
  sourcesCoverage: {
    metaAds: boolean;
    landingPage: boolean;
    checkout: boolean;
    postPurchase: boolean;
    history: boolean;
  };
}

/**
 * Smart deliverable format detector
 */
export function detectDeliverableFormat(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('pdf') || t.includes('apostila') || t.includes('e-book') || t.includes('ebook') || t.includes('guia') || t.includes('livro')) {
    return 'PDF / Ebook';
  }
  if (t.includes('planilha') || t.includes('excel') || t.includes('dashboard') || t.includes('calculadora')) {
    return 'Planilha';
  }
  if (t.includes('template') || t.includes('modelo') || t.includes('canva') || t.includes('artes')) {
    return 'Template';
  }
  if (t.includes('vídeo') || t.includes('video') || t.includes('aula') || t.includes('curso') || t.includes('vsl')) {
    return 'Vídeo / Aula';
  }
  if (t.includes('card') || t.includes('flashcard') || t.includes('ficha')) {
    return 'Flashcards';
  }
  if (t.includes('áudio') || t.includes('mp3') || t.includes('podcast')) {
    return 'Áudio';
  }
  if (t.includes('imprimível') || t.includes('printable') || t.includes('molde')) {
    return 'Printable / Molde';
  }
  if (t.includes('pack') || t.includes('kit') || t.includes('combo')) {
    return 'Pack / Kit';
  }
  if (t.includes('acesso') || t.includes('plataforma') || t.includes('sistema') || t.includes('web')) {
    return 'Acesso Web';
  }
  return 'Material Digital';
}

/**
 * Builds the full Commercial Offer Map from offer data, LP analysis, and checkout information.
 */
export function getCommercialOfferSummary(offer: Offer): CommercialOfferSummary {
  const extra = offer.extra_data || {};
  const lpAnalysis = extra.latest_lp_analysis || null;
  const rawLpCommerce = lpAnalysis?.commerce || null;

  // Multi-Option Front-End Pricing
  const rawFrontOpts = offer.frontend_options || rawLpCommerce?.frontOptions || [];

  // 1. Entry Product Data & Source Precedence
  // Priority: 1. LP Front Options (min) / LP Commerce -> 2. XLSX Seed -> 3. Fallback
  let currentPrice = offer.price ?? rawLpCommerce?.currentPrice ?? null;
  let productSource: 'LP' | 'CHECKOUT' | 'ADS' | 'XLSX' | 'MANUAL' = Boolean(offer.price) ? 'XLSX' : Boolean(rawLpCommerce?.currentPrice) ? 'LP' : 'MANUAL';

  const frontendPricing = calculateFrontendPricing(rawFrontOpts, currentPrice);

  if (frontendPricing.min !== null && frontendPricing.count > 0) {
    currentPrice = frontendPricing.min;
    productSource = 'LP';
  } else if (rawLpCommerce?.currentPrice != null) {
    currentPrice = rawLpCommerce.currentPrice;
    productSource = 'LP';
  }

  let originalPrice = rawLpCommerce?.originalPrice ?? null;
  let discountPercent = rawLpCommerce?.discountPercent ?? null;

  if (originalPrice && currentPrice && originalPrice > currentPrice && !discountPercent) {
    discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }

  // CTAs
  const firstCtaObj = offer.ctas && offer.ctas.length > 0 ? offer.ctas[0].text : null;
  const mainCta = firstCtaObj || (offer as any).cta || (lpAnalysis?.sections ? lpAnalysis.sections.find((s: any) => s.type === 'cta')?.headline : null) || 'QUERO MEU ACESSO';
  const otherCtas: string[] = rawLpCommerce?.ctas || [];

  // Guarantee
  const guaranteeDays = offer.guarantee ? parseInt(offer.guarantee, 10) || 7 : (rawLpCommerce?.guaranteeDays ?? null);
  const guaranteeText = rawLpCommerce?.guaranteeText || (guaranteeDays ? `${guaranteeDays} dias de garantia incondicional` : null);
  let guaranteeType: 'Incondicional' | 'Condicional' | 'Não determinado' = 'Não determinado';
  if (guaranteeText) {
    if (/incondicional|risco zero/i.test(guaranteeText)) {
      guaranteeType = 'Incondicional';
    } else if (/condicional/i.test(guaranteeText)) {
      guaranteeType = 'Condicional';
    } else {
      guaranteeType = 'Incondicional';
    }
  }

  // Checkout Platform & URL
  const checkoutPlatform = offer.checkout_platform || rawLpCommerce?.checkoutPlatform || null;
  const checkoutUrl = offer.checkout_url || (rawLpCommerce?.checkoutUrls?.[0]) || null;

  // 2. Deliverables
  const deliverablesList: CommercialOfferSummary['deliverables'] = [];
  const existingDeliverables = offer.deliverables || [];

  existingDeliverables.forEach((d, idx) => {
    deliverablesList.push({
      ...d,
      format: detectDeliverableFormat(d.title || d.name || ''),
      source: (d.source as any) || 'MANUAL',
      evidenceText: (d as any).evidenceText || (d as any).sourceText,
      evidenceSection: (d as any).sourceSection,
    });
  });

  // Auto-fill from LP if manual list is empty
  if (deliverablesList.length === 0 && rawLpCommerce?.deliverables) {
    rawLpCommerce.deliverables.forEach((d: any, idx: number) => {
      deliverablesList.push({
        id: `lp_del_${idx}`,
        offer_id: offer.id,
        title: d.name,
        description: d.description || '',
        order_index: idx,
        format: detectDeliverableFormat(d.name),
        source: 'LP',
        evidenceText: `Extraído da LP: "${d.name}"`,
        evidenceSection: 'Seção de Conteúdo / Entregáveis',
      });
    });
  }

  // 3. Bonuses
  const bonusesList: CommercialOfferSummary['bonuses'] = [];
  const existingBonuses = offer.bonuses || [];

  existingBonuses.forEach((b, idx) => {
    bonusesList.push({
      ...b,
      claimedValue: b.claimed_value || b.advertised_value || null,
      source: (b.source as any) || 'MANUAL',
      evidenceText: (b as any).evidenceText || (b as any).sourceText,
      evidenceSection: (b as any).sourceSection,
    });
  });

  // Auto-fill bonuses from LP if manual list is empty
  if (bonusesList.length === 0 && rawLpCommerce?.bonuses) {
    rawLpCommerce.bonuses.forEach((b: any, idx: number) => {
      bonusesList.push({
        id: `lp_bon_${idx}`,
        offer_id: offer.id,
        title: b.name,
        description: b.description || '',
        claimedValue: b.advertisedValue || null,
        order_index: idx,
        source: 'LP',
        evidenceText: `Prometido na LP: "${b.name}"`,
        evidenceSection: 'Seção de Bônus Exclusivos',
      });
    });
  }

  // 4. Bumps & Upsells
  const orderBumps = offer.order_bumps || [];
  const upsells = offer.upsells || [];

  // Verification Statuses (Strict Consistency Rule)
  const isCheckoutVerified = Boolean(extra.checkout_verified && extra.checkout_status === 'verified');
  const checkoutStatus: VerificationStatus = isCheckoutVerified ? 'verified' : 'unverified';

  const orderBumpsStatus: VerificationStatus = isCheckoutVerified
    ? (orderBumps.length > 0 ? 'verified' : 'not_found')
    : 'unverified';

  const upsellsStatus: VerificationStatus = extra.post_purchase_checked
    ? (upsells.length > 0 ? 'verified' : 'not_found')
    : 'unverified';

  // 5. Observed & Maximum Tickets
  const bumpSum = orderBumps.reduce((acc, b) => acc + (b.price || 0), 0);
  const upsellSum = upsells.reduce((acc, u) => acc + (u.price || 0), 0);

  const observedTicket = currentPrice;
  const isMaxPotentialDetermined = extra.checkout_checked && extra.post_purchase_checked;
  const maxPotentialTicket = isMaxPotentialDetermined
    ? (currentPrice || 0) + bumpSum + upsellSum
    : (currentPrice || 0) + bumpSum + upsellSum; // Display confirmed total or current ticket

  // 6. Conflicts
  const conflicts: CommercialOfferSummary['conflicts'] = [];
  const xlsxPrice = offer.raw_data?.price || offer.raw_data?.Preço || null;
  const lpPrice = rawLpCommerce?.currentPrice || null;

  if (xlsxPrice && lpPrice && Number(xlsxPrice) !== Number(lpPrice)) {
    conflicts.push({
      field: 'price',
      title: 'Conflito de Preço Detectado',
      description: 'O valor registrado no arquivo XLSX difere do valor identificado na Landing Page.',
      sourceA: { name: 'XLSX / Base', value: formatCurrency(Number(xlsxPrice)) },
      sourceB: { name: 'Landing Page', value: formatCurrency(Number(lpPrice)) },
    });
  }

  // 7. Sources Coverage
  const sourcesCoverage = {
    metaAds: Boolean(offer.meta_ads_url || (offer.active_ads_count && offer.active_ads_count > 0)),
    landingPage: Boolean(lpAnalysis || offer.landing_page_url_status === 'AVAILABLE'),
    checkout: Boolean(extra.checkout_checked || checkoutStatus === 'verified'),
    postPurchase: Boolean(extra.post_purchase_checked),
    history: Boolean(offer.snapshots && offer.snapshots.length > 1),
  };

  // Multi-Option Front-End Pricing is computed above as frontendPricing


  return {
    entryProduct: {
      name: offer.product_name || 'Produto sem nome',
      currentPrice,
      originalPrice,
      discountPercent,
      productType: offer.product_type || 'Digital',
      format: detectDeliverableFormat(offer.product_name || offer.product_type || ''),
      mainCta,
      otherCtas,
      guaranteeDays,
      guaranteeText,
      guaranteeType,
      checkoutPlatform,
      checkoutUrl,
      source: productSource,
    },
    frontendPricing,
    frontendOptions: frontendPricing.options,
    deliverables: deliverablesList,
    bonuses: bonusesList,
    checkoutStatus,
    orderBumpsStatus,
    upsellsStatus,
    orderBumps,
    upsells,
    observedTicket,
    maxPotentialTicket,
    isMaxPotentialDetermined,
    conflicts,
    sourcesCoverage,
  };
}
