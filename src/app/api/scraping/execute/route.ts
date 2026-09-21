import { NextRequest, NextResponse } from 'next/server';
import { OfferDataScrapingService } from '@/lib/scraping/service';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { offerId } = body;

    if (!offerId) {
      return NextResponse.json(
        { success: false, error: 'offerId é obrigatório.' },
        { status: 400 }
      );
    }

    const report = await OfferDataScrapingService.scrapeAndEnrichOffer(offerId);
    const updatedOffer = await dbService.getOfferById(offerId);

    return NextResponse.json({
      success: true,
      report,
      offer: updatedOffer,
    });
  } catch (err: any) {
    console.error('[POST /api/scraping/execute Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao executar raspagem da oferta.' },
      { status: 500 }
    );
  }
}
