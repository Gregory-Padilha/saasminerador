// ==============================================================================
// OFFER MINER - CHECKOUT DATA COLLECTOR
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, FieldProvenance } from '@/types';

export interface CheckoutHarvest {
  status: 'SUCCESS' | 'PARTIAL' | 'NOT_AVAILABLE' | 'FAILED';
  fieldsLoaded: string[];
  provenanceMap: Record<string, FieldProvenance>;
  data: {
    productName?: string | null;
    frontPrice?: number | null;
    currency?: string;
    installments?: number | null;
    installmentValue?: number | null;
    paymentMethods?: string[];
    bumpsCount?: number | null;
    bumpPrices?: number[];
    guaranteeDays?: number | null;
    platform?: string | null;
  };
  error?: string;
}

export async function collectCheckoutData(offer: Offer): Promise<CheckoutHarvest> {
  const fieldsLoaded: string[] = [];
  const provenanceMap: Record<string, FieldProvenance> = {};
  const data: CheckoutHarvest['data'] = {};
  const now = new Date().toISOString();

  const checkoutUrl = offer.checkout_url;

  // RULE: Only true checkout URL. Never fallback to landing page URL.
  const isTrueCheckout =
    checkoutUrl &&
    checkoutUrl.trim() !== '' &&
    (!offer.landing_page_url || checkoutUrl.trim() !== offer.landing_page_url.trim());

  if (!isTrueCheckout) {
    return {
      status: 'NOT_AVAILABLE',
      fieldsLoaded: [],
      provenanceMap: {},
      data: {},
      error: 'Oferta não possui checkout_url canônico válido e distinto da Landing Page.',
    };
  }

  try {
    // 1. Inspect existing checkout capture artifacts
    const captures = await dbService.getCheckoutCaptures(offer.id);
    const validCapture = captures.find((c) => c.status === 'verified' || c.provider);

    if (validCapture) {
      if (validCapture.provider && validCapture.provider !== 'Unknown') {
        data.platform = validCapture.provider;
        fieldsLoaded.push('checkout_platform');
        provenanceMap['checkout_platform'] = {
          field: 'checkout_platform',
          value: validCapture.provider,
          source: 'CHECKOUT',
          sourceUrl: checkoutUrl,
          observedAt: validCapture.captured_at || now,
          type: 'OBSERVED',
        };
      }

      if (typeof validCapture.front_price === 'number' && validCapture.front_price > 0) {
        data.frontPrice = validCapture.front_price;
        data.currency = validCapture.currency || 'BRL';
        fieldsLoaded.push('checkout_front_price');
        provenanceMap['checkout_front_price'] = {
          field: 'checkout_front_price',
          value: validCapture.front_price,
          source: 'CHECKOUT',
          sourceUrl: checkoutUrl,
          observedAt: validCapture.captured_at || now,
          type: 'OBSERVED',
        };
      }

      const diag = validCapture.raw_data?.diagnostic;
      if (diag) {
        if (diag.pageTitle) {
          data.productName = diag.pageTitle;
        }
        if (typeof diag.acceptedBumpsCount === 'number') {
          data.bumpsCount = diag.acceptedBumpsCount;
          fieldsLoaded.push('bumps_count');
          provenanceMap['bumps_count'] = {
            field: 'bumps_count',
            value: diag.acceptedBumpsCount,
            source: 'CHECKOUT',
            sourceUrl: checkoutUrl,
            observedAt: validCapture.captured_at || now,
            type: 'OBSERVED',
          };
        }
      } else if (typeof validCapture.order_bumps_count === 'number') {
        data.bumpsCount = validCapture.order_bumps_count;
        fieldsLoaded.push('bumps_count');
        provenanceMap['bumps_count'] = {
          field: 'bumps_count',
          value: validCapture.order_bumps_count,
          source: 'CHECKOUT',
          sourceUrl: checkoutUrl,
          observedAt: validCapture.captured_at || now,
          type: 'OBSERVED',
        };
      }

      // Check detected bumps
      const storedBumps = offer.order_bumps || [];
      if (storedBumps.length > 0) {
        data.bumpsCount = storedBumps.length;
        data.bumpPrices = storedBumps.map((b) => b.price).filter((p): p is number => typeof p === 'number');
      }
    }

    const status: CheckoutHarvest['status'] =
      fieldsLoaded.length > 0 ? 'SUCCESS' : 'PARTIAL';

    return {
      status,
      fieldsLoaded,
      provenanceMap,
      data,
    };
  } catch (err: any) {
    console.error('[CHECKOUT DATA COLLECTOR ERROR]:', err);
    return {
      status: 'FAILED',
      fieldsLoaded: [],
      provenanceMap: {},
      data: {},
      error: err.message || 'Falha ao coletar dados do checkout.',
    };
  }
}
