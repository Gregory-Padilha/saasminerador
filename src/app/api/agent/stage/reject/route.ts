import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, all } = body || {};

    if (all) {
      await dbService.clearStagedOffers('PENDING_APPROVAL');
      return NextResponse.json({
        success: true,
        message: 'Todas as ofertas pendentes da fila foram descartadas com sucesso.',
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID da oferta minerada é obrigatório para descarte.' },
        { status: 400 }
      );
    }

    const removed = await dbService.rejectStagedOffer(id);
    return NextResponse.json({
      success: true,
      removed,
      message: 'Oferta descartada da fila com sucesso.',
    });
  } catch (err: any) {
    console.error('[POST /api/agent/stage/reject Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao descartar oferta da fila.' },
      { status: 500 }
    );
  }
}
