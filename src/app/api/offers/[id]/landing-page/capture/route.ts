import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { captureLandingPageVisuals } from '@/lib/landing-page/capture';

export const runtime = 'nodejs';

import { resolveLandingPageUrl } from '@/lib/landing-page/resolver';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    if (!offerId) {
      return NextResponse.json({ error: 'ID de oferta inválido.' }, { status: 400 });
    }

    const offer = await dbService.getOfferById(offerId);
    if (!offer) {
      return NextResponse.json({ error: 'Oferta não encontrada.' }, { status: 404 });
    }

    // 1. Resolve and validate URL first
    const resolution = await resolveLandingPageUrl(offer);

    if (!resolution.resolvedUrl || resolution.status === 'DNS_NOT_RESOLVED' || resolution.status === 'UNAVAILABLE' || resolution.status === 'INVALID_URL') {
      console.warn(`[LP CAPTURE API] Cannot capture: URL unavailable (${resolution.status}) for offer ${offerId}`);
      return NextResponse.json({
        success: false,
        status: resolution.status,
        error: resolution.userFriendlyMessage,
        resolution,
      }, { status: 200 });
    }

    const targetUrl = resolution.resolvedUrl;
    console.log(`[LP CAPTURE API] Starting visual capture for offer ${offerId} with resolved URL: ${targetUrl}`);
    const result = await captureLandingPageVisuals(offerId, targetUrl, offer.user_id);

    const updatedCaptures = await dbService.getLandingPageCaptures(offerId);
    const updatedOffer = await dbService.getOfferById(offerId);

    return NextResponse.json({
      success: true,
      capture: result,
      captures: updatedCaptures,
      resolution,
      offer: updatedOffer,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/[id]/landing-page/capture Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao capturar screenshots da Landing Page.' },
      { status: 500 }
    );
  }
}
