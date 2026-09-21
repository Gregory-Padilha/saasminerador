import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { runOfferAnalysisPipeline } from '@/lib/offer/analysis-pipeline';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'ID de job inválido.' }, { status: 400 });
    }

    const job = await dbService.getAnalysisJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job de análise não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    console.error('[GET /api/offers/analyze/jobs/[id] Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao obter dados do job de análise.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const body = await req.json();
    const { action, offerId } = body;

    const job = await dbService.getAnalysisJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job de análise não encontrado.' }, { status: 404 });
    }

    if (action === 'cancel') {
      const updated = await dbService.updateAnalysisJob(jobId, {
        status: 'cancelled',
        stage_message: 'Análise cancelada pelo usuário.',
      });
      return NextResponse.json({ success: true, job: updated });
    }

    if (action === 'resume' || action === 'update') {
      const updated = await dbService.updateAnalysisJob(jobId, {
        status: 'running',
        mode: 'update',
        stage_message: 'Retomando análise em modo de atualização...',
      });

      runOfferAnalysisPipeline(jobId, { mode: 'update', offerId: offerId || job.offer_id || undefined }).catch(
        (err) => console.error(`[BACKGROUND RESUME PIPELINE ERROR] Job ${jobId}:`, err)
      );

      return NextResponse.json({ success: true, job: updated });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/offers/analyze/jobs/[id] Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao processar ação no job.' },
      { status: 500 }
    );
  }
}
