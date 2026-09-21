import { dbService } from '@/lib/supabase/db';
import { Offer } from '@/types';

export interface SourceOfferContextPack {
  isAvailable: boolean;
  missionId?: string;
  offerId: string;
  productName: string;
  advertiser: string;
  niche: string;
  subniche?: string;
  activeAdsCount: number;
  daysRunning: number;
  priceFormatted: string;
  currency: string;
  numericPrice?: number;

  promiseSummary: string;
  headline?: string;
  subheadline?: string;
  offerType: string;

  landingPageUrl?: string;
  landingPageAnalysis?: {
    headline?: string;
    sectionsCount?: number;
    copyHighlights?: string[];
  };

  checkoutUrl?: string;
  checkoutAnalysis?: {
    priceObserved?: string;
    orderBumpsObserved?: string[];
  };

  creativeSummary?: {
    totalCapturedCount: number;
    hookPatterns?: string[];
  };

  dnaSummary?: {
    positioning?: string;
    perceivedMechanism?: string;
  };

  rawOfferData: Partial<Offer>;
}

export function assertSourcePackLineage(
  pack: SourceOfferContextPack | null,
  expectedMissionId: string,
  expectedSourceOfferId?: string
): void {
  if (!pack) return;
  if (pack.missionId && pack.missionId !== expectedMissionId) {
    throw new Error(
      `SOURCE_CONTEXT_MISMATCH: Pack missionId '${pack.missionId}' does not match current mission '${expectedMissionId}'.`
    );
  }
  if (expectedSourceOfferId && pack.offerId && pack.offerId !== expectedSourceOfferId) {
    throw new Error(
      `SOURCE_CONTEXT_MISMATCH: Pack offerId '${pack.offerId}' does not match mission primaryOfferId '${expectedSourceOfferId}'.`
    );
  }
}

export async function buildSourceOfferContextPack(
  primaryOfferId?: string,
  missionId?: string
): Promise<SourceOfferContextPack | null> {
  if (!primaryOfferId || !primaryOfferId.trim()) {
    return null;
  }

  try {
    const allOffers = await dbService.getOffers();
    const offer = allOffers.find((o) => o.id === primaryOfferId || o.product_name?.toLowerCase().includes(primaryOfferId.toLowerCase()));
    if (!offer) {
      return {
        isAvailable: false,
        missionId,
        offerId: primaryOfferId,
        productName: primaryOfferId,
        advertiser: 'NOT_AVAILABLE',
        niche: 'NOT_AVAILABLE',
        activeAdsCount: 0,
        daysRunning: 0,
        priceFormatted: 'NOT_AVAILABLE',
        currency: 'BRL',
        promiseSummary: 'NOT_AVAILABLE',
        offerType: 'NOT_AVAILABLE',
        rawOfferData: {},
      };
    }

    const price = offer.price ? `R$ ${offer.price}` : 'NOT_AVAILABLE';
    const landingPageAnalysis = offer.landing_page_url
      ? {
          headline: offer.headline || 'Página de Vendas Ativa',
          sectionsCount: 5,
          copyHighlights: offer.promise ? [offer.promise] : [],
        }
      : undefined;

    const checkoutAnalysis = offer.checkout_url
      ? {
          priceObserved: price,
          orderBumpsObserved: offer.bonuses?.map((b: any) => b.name) || [],
        }
      : undefined;

    const creativeSummary = {
      totalCapturedCount: offer.active_ads_count || offer.creatives?.length || 0,
      hookPatterns: offer.creatives?.slice(0, 3).map((c: any) => c.title || c.headline || 'Anúncio ativo') || [],
    };

    return {
      isAvailable: true,
      missionId,
      offerId: offer.id,
      productName: offer.product_name,
      advertiser: offer.advertiser || 'Anunciante N/I',
      niche: offer.niche || 'Geral',
      subniche: offer.subniche || undefined,
      activeAdsCount: offer.active_ads_count || 0,
      daysRunning: offer.days_running || 30,
      priceFormatted: price,
      currency: 'BRL',
      numericPrice: offer.price || undefined,

      promiseSummary: offer.promise || offer.headline || 'Promessa da Oferta Base',
      headline: offer.headline || undefined,
      subheadline: offer.subheadline || undefined,
      offerType: offer.product_type || 'Digital',

      landingPageUrl: offer.landing_page_url || undefined,
      landingPageAnalysis,

      checkoutUrl: offer.checkout_url || undefined,
      checkoutAnalysis,

      creativeSummary,

      dnaSummary: {
        positioning: offer.niche ? `Oferta validada de ${offer.niche}` : undefined,
        perceivedMechanism: offer.headline || undefined,
      },

      rawOfferData: offer,
    };
  } catch (err) {
    console.error('Error building SourceOfferContextPack:', err);
    return null;
  }
}
