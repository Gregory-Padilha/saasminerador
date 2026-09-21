import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { notifyGlobalSync } from '@/lib/events/offer-events';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, all } = body || {};

    if (all) {
      const result = await dbService.approveAllStagedOffers();
      if (result.approvedCount > 0) {
        try {
          notifyGlobalSync('offer_imported');
        } catch {
          // ignore
        }
      }
      return NextResponse.json({
        success: true,
        approvedCount: result.approvedCount,
        offers: result.offers,
        message: `${result.approvedCount} oferta(s) aprovada(s) e adicionada(s) ao catálogo principal com sucesso!`,
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID da oferta minerada é obrigatório para aprovação.' },
        { status: 400 }
      );
    }

    const res = await dbService.approveStagedOffer(id);
    if (!res.success || !res.offer) {
      return NextResponse.json(
        { success: false, error: 'Oferta em staging não encontrada ou já aprovada.' },
        { status: 404 }
      );
    }

    try {
      notifyGlobalSync('offer_imported');
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      offer: res.offer,
      message: `Oferta "${res.offer.product_name}" aprovada e inserida no catálogo com sucesso!`,
    });
  } catch (err: any) {
    console.error('[POST /api/agent/stage/approve Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao aprovar oferta minerada.' },
      { status: 500 }
    );
  }
}
