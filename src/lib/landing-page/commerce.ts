// ==============================================================================
// OFFER MINER - LANDING PAGE COMMERCE EXTRACTOR (MULTI-FRONT PRICING, GUARANTEE, DELIVERABLES, BONUSES)
// ==============================================================================

import { RawPageDomData } from './extract';
import { LandingPageLink } from './types';
import { OfferFrontendOption } from '@/types';
import { calculateFrontendPricing } from '@/lib/pricing';

export interface ExtractedCommerceData {
  originalPrice?: number | null;
  currentPrice?: number | null;
  discountPercent?: number | null;
  currency: string;
  guaranteeDays?: number | null;
  guaranteeText?: string | null;
  checkoutPlatform?: string | null;
  checkoutUrls: string[];
  deliverables: Array<{ name: string; description?: string }>;
  bonuses: Array<{ name: string; description?: string; advertisedValue?: number }>;
  frontOptions?: OfferFrontendOption[];
}

export function extractCommerceData(
  dom: RawPageDomData,
  links: LandingPageLink[]
): ExtractedCommerceData {
  let originalPrice: number | null = null;
  let currentPrice: number | null = null;
  let discountPercent: number | null = null;
  const currency = 'BRL';

  const fullText = dom.fullText;
  const frontOptions: OfferFrontendOption[] = [];

  // 1. Process CTA-First Pricing Containers
  if (dom.pricingContainers && dom.pricingContainers.length > 0) {
    console.log(`[PRICING DETECTOR] Commercial Pricing Containers Found: ${dom.pricingContainers.length}`);

    dom.pricingContainers.forEach((container, idx) => {
      let optCurrPrice: number | null = null;
      let optOrigPrice: number | null = null;

      if (container.dePor) {
        optOrigPrice = container.dePor.original;
        optCurrPrice = container.dePor.current;
        console.log(`[PRICING DETECTOR] Card #${idx + 1} De/Por Found: Original=R$ ${optOrigPrice}, Current=R$ ${optCurrPrice}`);
      } else if (container.prices.length > 0) {
        // Filter out installment values if present
        const nonInstPrices = container.installments
          ? container.prices.filter((p) => Math.abs(p - (container.installments?.value || 0)) > 0.01)
          : container.prices;

        if (nonInstPrices.length === 1) {
          optCurrPrice = nonInstPrices[0];
        } else if (nonInstPrices.length > 1) {
          // In a single card with multiple prices (e.g., De R$ 127,90 por R$ 37,90)
          // The current price is the minimum non-installment price, and higher price is original anchor
          optCurrPrice = Math.min(...nonInstPrices);
          const higherPrice = Math.max(...nonInstPrices);
          if (higherPrice > optCurrPrice) {
            optOrigPrice = higherPrice;
          }
        } else {
          optCurrPrice = container.prices[0];
        }
      }

      // Reject non-commercial containers: Earnings / Faturamento copy arguments
      const titleText = (container.title || '').toLowerCase();
      const textSnippet = (container.text || '').toLowerCase();
      const isEarningsArgument =
        /faturar|faturamento|ganhar|ganho|possibilidade\s*de\s*ganho|potencial|renda\s*extra|lucro|retorno|custo\s*por\s*dia|investimento\s*diário|menos\s*que\s*um\s*café|quanto\s*vale/i.test(
          titleText + ' ' + textSnippet.slice(0, 200)
        );
      const hasCommercialPlanKeyword = /plano|pacote|opcao|opção|kit|combo|versão|versao|básico|basico|completo|pro|vip|premium|standard|essencial|profissional/i.test(
        titleText
      );

      if (isEarningsArgument && !hasCommercialPlanKeyword) {
        console.log(`[REJECTED CONTAINER] Candidate "${container.title}" | Reason: EARNINGS_VALUE_ARGUMENT`);
        return;
      }

      // Reject internal anchor link scroll buttons (#comprar) when multi-containers exist and card lacks plan identity
      const isAnchorScrollUrl = Boolean(container.ctaUrl && container.ctaUrl.includes('#'));
      if (isAnchorScrollUrl && !hasCommercialPlanKeyword && (dom.pricingContainers?.length || 0) > 1) {
        console.log(`[REJECTED CONTAINER] Candidate "${container.title}" | Reason: INTERNAL_ANCHOR_SCROLL_ONLY`);
        return;
      }

      if (optCurrPrice && optCurrPrice > 0) {
        // Check for deduplication (same price + same title + same CTA)
        const isDuplicate = frontOptions.some(
          (existing) =>
            Math.abs(existing.current_price - (optCurrPrice || 0)) < 0.01 &&
            (existing.name === container.title || existing.cta_url === container.ctaUrl)
        );

        if (isDuplicate) {
          console.log(`[REJECTED PRICE] Candidate R$ ${optCurrPrice} | Reason: DUPLICATE (Same card fingerprint)`);
          return;
        }

        const name = container.title || (dom.pricingContainers!.length === 1 ? 'Plano Principal' : `Plano ${idx + 1}`);

        frontOptions.push({
          id: `front-opt-${frontOptions.length + 1}`,
          offer_id: '',
          name,
          description: container.text.slice(0, 300),
          current_price: optCurrPrice,
          original_price: optOrigPrice,
          currency,
          billing_type: 'one_time',
          installments: container.installments?.count || null,
          installment_value: container.installments?.value || null,
          cta_text: container.ctaText || null,
          cta_url: container.ctaUrl || null,
          position_index: frontOptions.length + 1,
          is_featured: container.isFeatured || false,
          is_default: frontOptions.length === 0,
          source: 'LANDING_PAGE',
          source_section: 'pricing',
          source_text: container.text.slice(0, 150),
        });

        console.log(`[ACCEPTED FRONT OPTION] #${frontOptions.length}: "${name}" -> R$ ${optCurrPrice} (Original: ${optOrigPrice ? 'R$ ' + optOrigPrice : 'N/A'})`);
      }
    });
  }

  // 2. Fallback Heuristics (ONLY when no structural commercial cards/CTAs were detected)
  // SAFETY RULE: Fallback yields AT MOST 1 option to prevent raw page text values from polluting options
  if (frontOptions.length === 0) {
    console.log('[PRICING DETECTOR] No commercial cards found via CTAs. Running strict single-option fallback...');

    const dePorMatch = fullText.match(
      /de\s*(?:r\$)?\s*(\d+[\.,]\d{2}|\d+)\s*(?:por|por\s*apenas|para)\s*(?:r\$)?\s*(\d+[\.,]\d{2}|\d+)/i
    );

    if (dePorMatch) {
      const orig = parseFloat(dePorMatch[1].replace(',', '.'));
      const curr = parseFloat(dePorMatch[2].replace(',', '.'));
      if (curr > 0) {
        frontOptions.push({
          id: 'front-opt-1',
          offer_id: '',
          name: 'Opção Única',
          current_price: curr,
          original_price: orig > curr ? orig : null,
          currency,
          billing_type: 'one_time',
          position_index: 1,
          is_featured: false,
          is_default: true,
          source: 'LANDING_PAGE',
          source_section: 'pricing',
          source_text: dePorMatch[0],
        });
        console.log(`[ACCEPTED FALLBACK OPTION] Single De/Por -> R$ ${curr} (Original: R$ ${orig})`);
      }
    } else {
      const matches = Array.from(fullText.matchAll(/(?:r\$|por\s*apenas\s*r\$|apenas\s*r\$)\s*(\d+[\.,]\d{2})/gi));
      let fallbackPrice: number | null = null;
      let fallbackText = '';

      for (const m of matches) {
        const val = parseFloat(m[1].replace(',', '.'));
        const index = m.index || 0;
        const preText = fullText.slice(Math.max(0, index - 40), index);

        // Reject bonus, FAQ, installment, total value, anchor text
        if (/bônus|bonus|presente|avaliado\s*em|valor\s*de|total|\d+\s*x\s*(?:de)?|parcela|economize|garantia/i.test(preText)) {
          console.log(`[REJECTED PRICE] R$ ${val} | Reason: NON_COMMERCIAL_CONTEXT (${preText.trim()})`);
          continue;
        }

        if (val > 0 && val < 50000) {
          fallbackPrice = val;
          fallbackText = preText;
          break; // Take the first clean commercial price candidate only!
        }
      }

      if (fallbackPrice) {
        frontOptions.push({
          id: 'front-opt-1',
          offer_id: '',
          name: 'Opção Única',
          current_price: fallbackPrice,
          original_price: null,
          currency,
          billing_type: 'one_time',
          position_index: 1,
          is_featured: false,
          is_default: true,
          source: 'LANDING_PAGE',
          source_section: 'pricing',
          source_text: fallbackText,
        });
        console.log(`[ACCEPTED FALLBACK OPTION] Single Clean Price -> R$ ${fallbackPrice}`);
      }
    }
  }

  // 3. Compute Aggregated Pricing Metrics
  const pricingSummary = calculateFrontendPricing(frontOptions);
  currentPrice = pricingSummary.min; // Minimum price as legacy front_price
  originalPrice =
    frontOptions[0]?.original_price ||
    (pricingSummary.max && pricingSummary.max > (pricingSummary.min || 0) ? pricingSummary.max : null);

  if (originalPrice && currentPrice && originalPrice > currentPrice) {
    discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }

  // 4. GUARANTEE EXTRACTION
  let guaranteeDays: number | null = null;
  let guaranteeText: string | null = null;

  const guaranteeMatch = fullText.match(
    /(\d+)\s*dias\s*de\s*garantia|garantia\s*incondicional\s*de\s*(\d+)\s*dias/i
  );
  if (guaranteeMatch) {
    guaranteeDays = parseInt(guaranteeMatch[1] || guaranteeMatch[2], 10);
    guaranteeText = `${guaranteeDays} dias de garantia incondicional`;
  } else if (/garantia\s*incondicional|risco\s*zero/i.test(fullText)) {
    guaranteeDays = 7;
    guaranteeText = 'Garantia incondicional (7 dias)';
  }

  // 5. CHECKOUT PLATFORM & URLS
  const checkoutLinks = links.filter((l) => l.link_type === 'checkout');
  const checkoutUrls = checkoutLinks.map((l) => l.url);
  const detectedPlatform = checkoutLinks.find((l) => l.checkout_platform)?.checkout_platform || null;

  // 6. DELIVERABLES EXTRACTION
  const deliverables: Array<{ name: string; description?: string }> = [];
  (dom.lists || []).forEach((list) => {
    const isDeliverableList = list.items.some(
      (item) =>
        /molde|aula|módulo|acesso|guia|manual|pdf|vídeo|passo\s*a\s*passo|arquivo/i.test(item) &&
        !/bônus|bonus/i.test(item)
    );

    if (isDeliverableList) {
      list.items.forEach((item) => {
        if (item.length > 4 && item.length < 200 && !deliverables.some((d) => d.name === item)) {
          deliverables.push({ name: item });
        }
      });
    }
  });

  // 7. BONUSES EXTRACTION
  const bonuses: Array<{ name: string; description?: string; advertisedValue?: number }> = [];
  (dom.lists || []).forEach((list) => {
    const isBonusList = list.items.some((item) => /bônus|bonus|grátis|presente/i.test(item));
    if (isBonusList) {
      list.items.forEach((item) => {
        if (/bônus|bonus|grátis/i.test(item) && item.length > 4 && item.length < 250) {
          let val: number | undefined;
          const valMatch = item.match(/(?:valor|de|custa)\s*(?:r\$)?\s*(\d+[\.,]\d{2}|\d+)/i);
          if (valMatch) {
            val = parseFloat(valMatch[1].replace(',', '.'));
          }
          bonuses.push({ name: item, advertisedValue: val });
        }
      });
    }
  });

  [...(dom.h2s || []), ...(dom.h3s || [])].forEach((h) => {
    if (h && h.text && /bônus\s*#?\d*|bonus\s*#?\d*/i.test(h.text)) {
      if (!bonuses.some((b) => b.name === h.text)) {
        bonuses.push({ name: h.text });
      }
    }
  });

  return {
    originalPrice,
    currentPrice,
    discountPercent,
    currency,
    guaranteeDays,
    guaranteeText,
    checkoutPlatform: detectedPlatform,
    checkoutUrls,
    deliverables: deliverables.slice(0, 15),
    bonuses: bonuses.slice(0, 10),
    frontOptions,
  };
}
