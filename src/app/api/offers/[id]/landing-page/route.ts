import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

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

    const captures = await dbService.getLandingPageCaptures(offerId);
    const latestCapture = captures[0] || null;

    let sections: any[] = [];
    let links: any[] = [];

    if (latestCapture) {
      sections = await dbService.getLandingPageSections(latestCapture.id);
      links = await dbService.getLandingPageLinks(latestCapture.id);
    }

    const deliverables = await dbService.getOfferDeliverables(offerId);
    const bonuses = await dbService.getOfferBonuses(offerId);

    const latestAnalysis = latestCapture?.raw_data?.analysis || offer.extra_data?.latest_lp_analysis || null;

    const resolution = {
      originalUrl: offer.landing_page_url_original || offer.landing_page_url || '',
      resolvedUrl: offer.landing_page_url_resolved || offer.landing_page_url || null,
      status: offer.landing_page_url_status || (offer.landing_page_url ? 'PENDING' : 'NEEDS_MANUAL_URL'),
      source: offer.landing_page_resolution_source || 'RESOLVED_ORIGINAL',
      flowType: offer.landing_page_flow_type || 'LP_TO_CHECKOUT',
      lastCheckedAt: offer.landing_page_url_last_checked_at || null,
      manualOverrideUrl: offer.manual_override_url || null,
      diagnostic: offer.landing_page_resolution_diagnostic || null,
    };

    return NextResponse.json({
      success: true,
      offer,
      resolution,
      latestCapture,
      capturesCount: captures.length,
      captures,
      sections,
      links,
      deliverables,
      bonuses,
      analysis: latestAnalysis,
    });
  } catch (err: any) {
    console.error('[GET /api/offers/[id]/landing-page Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar dados da Landing Page.' },
      { status: 500 }
    );
  }
}
