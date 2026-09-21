import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { mapCheckout } from '@/lib/checkout-intelligence/extract';
import { resolveCheckoutUrlStatic } from '@/lib/checkout-intelligence/resolver';

export const runtime = 'nodejs';

export async function GET(
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

    const resolution = resolveCheckoutUrlStatic(offer);
    const captures = await dbService.getCheckoutCaptures(offerId);
    const latestCapture = captures[0] || null;

    return NextResponse.json({
      success: true,
      offerId,
      resolution,
      latestCapture,
      capturesCount: captures.length,
    });
  } catch (err: any) {
    console.error('[GET /api/offers/[id]/checkout Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao consultar status do checkout.' },
      { status: 500 }
    );
  }
}

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

    let action = 'map';
    try {
      const body = await req.json();
      if (body?.action) action = body.action;
    } catch {
      // Body may be empty for standard POST calls
    }

    if (action === 'discover') {
      const { discoverCheckout } = await import('@/lib/checkout-intelligence/extract');
      const discoveryResult = await discoverCheckout(offerId);
      return NextResponse.json({
        success: discoveryResult.success,
        result: discoveryResult,
      });
    }

    // Default: Checkout Mapping
    const staticRes = resolveCheckoutUrlStatic(offer);
    if (!staticRes.resolvedCheckoutUrl) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'CHECKOUT_URL_NOT_DISCOVERED',
          error: 'Checkout não mapeado: URL de checkout ainda não foi descoberta.',
          message: 'URL de checkout não identificada. Execute a descoberta de checkout primeiro.',
        },
        { status: 400 }
      );
    }

    const result = await mapCheckout(offerId);

    return NextResponse.json({
      success: result.status === 'verified',
      result,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/[id]/checkout Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao executar Checkout Intelligence.' },
      { status: 500 }
    );
  }
}
