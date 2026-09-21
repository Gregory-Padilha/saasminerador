import { NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export async function GET() {
  try {
    const deepDives = await dbService.getDeepDives();
    const insights = await dbService.getDeepDiveInsights();
    const patterns = await dbService.getResearchPatterns();

    const backlogCount = deepDives.filter((d) => d.status === 'BACKLOG').length;
    const emAnaliseCount = deepDives.filter((d) => d.status === 'EM_ANALISE').length;
    const sintetizandoCount = deepDives.filter((d) => d.status === 'SINTETIZANDO').length;
    const concluidoCount = deepDives.filter((d) => d.status === 'CONCLUIDO').length;
    const arquivadoCount = deepDives.filter((d) => d.status === 'ARQUIVADO').length;

    return NextResponse.json({
      success: true,
      deepDives,
      insights,
      patterns,
      stats: {
        backlogCount,
        emAnaliseCount,
        sintetizandoCount,
        concluidoCount,
        arquivadoCount,
        insightsCount: insights.length,
        patternsCount: patterns.length,
      },
    });
  } catch (err: any) {
    console.error('API /api/deep-dives GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offerId, priority } = body;

    if (!offerId) {
      return NextResponse.json({ success: false, error: 'offerId é obrigatório' }, { status: 400 });
    }

    const created = await dbService.createDeepDive(offerId, priority || 'MEDIA');

    return NextResponse.json({
      success: true,
      deepDive: created,
    });
  } catch (err: any) {
    console.error('API /api/deep-dives POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
