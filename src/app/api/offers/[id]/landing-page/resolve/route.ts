import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { resolveLandingPageUrl, normalizeLandingPageUrl } from '@/lib/landing-page/resolver';

export const runtime = 'nodejs';

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

    const body = await req.json().catch(() => ({}));
    const { forceReverify, manualOverrideUrl } = body;

    let offerToResolve = offer;

    // If a manual override URL is passed, update it first
    if (typeof manualOverrideUrl === 'string') {
      const cleanOverride = manualOverrideUrl.trim() ? normalizeLandingPageUrl(manualOverrideUrl) : null;
      const updated = await dbService.updateOffer(offerId, {
        manual_override_url: cleanOverride,
      });
      if (updated) offerToResolve = updated;
    }

    const resolution = await resolveLandingPageUrl(offerToResolve, { forceReverify: true });
    const updatedOffer = await dbService.getOfferById(offerId);

    return NextResponse.json({
      success: true,
      resolution,
      offer: updatedOffer,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/[id]/landing-page/resolve Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao resolver URL da Landing Page.' },
      { status: 500 }
    );
  }
}
