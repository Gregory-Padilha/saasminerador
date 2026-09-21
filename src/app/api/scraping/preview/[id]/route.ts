import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const offer = await dbService.getOfferById(id);

    if (!offer) {
      return NextResponse.json(
        { success: false, error: 'Oferta não encontrada.' },
        { status: 404 }
      );
    }

    const report = offer.data_scraping_reconciliation || null;

    return NextResponse.json({
      success: true,
      offer,
      report,
      provenanceMap: offer.provenance_map || report?.provenanceMap || {},
      conflicts: report?.conflicts || [],
    });
  } catch (err: any) {
    console.error('[GET /api/scraping/preview Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao buscar preview de reconciliação.' },
      { status: 500 }
    );
  }
}
