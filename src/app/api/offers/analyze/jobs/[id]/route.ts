import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { executeAtomicStep } from '@/lib/offer/atomic-analysis-runner';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
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

    // Staleness watchdog check: 5 minutes limit without heartbeat
    const now = Date.now();
    const lastHeartbeat = new Date(
      job.last_heartbeat_at || job.updated_at || job.created_at
    ).getTime();
    const STALE_TIMEOUT_MS = 5 * 60 * 1000;

    if (
      (job.status === 'running' || job.status === 'queued') &&
      now - lastHeartbeat > STALE_TIMEOUT_MS
    ) {
      const staleJob = await dbService.updateAnalysisJob(jobId, {
        status: 'stale',
        error_code: 'TIMEOUT_STALE_WATCHDOG',
        stage_message:
          'Análise expirada (mais de 5 minutos sem comunicação com o worker). Você pode tentar novamente.',
      });
      return NextResponse.json({ success: true, job: staleJob });
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
    const { action } = body;

    const job = await dbService.getAnalysisJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job de análise não encontrado.' }, { status: 404 });
    }

    // Cancel action
    if (action === 'cancel') {
      const updated = await dbService.updateAnalysisJob(jobId, {
        status: 'cancelled',
        stage_message: 'Análise cancelada pelo usuário.',
      });
      return NextResponse.json({ success: true, job: updated });
    }

    // Retry action
    if (action === 'retry') {
      const currentAttempt = job.attempt || 1;
      const maxAttempts = job.max_attempts || 3;

      if (currentAttempt >= maxAttempts) {
        return NextResponse.json(
          {
            error: `Limite de tentativas excedido (${currentAttempt}/${maxAttempts}). Não é possível retentar automaticamente.`,
          },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const updated = await dbService.updateAnalysisJob(jobId, {
        status: 'running',
        attempt: currentAttempt + 1,
        last_heartbeat_at: now,
        stage_message: `Reiniciando análise (tentativa ${currentAttempt + 1}/${maxAttempts})...`,
        error_code: null,
      });

      return NextResponse.json({ success: true, job: updated });
    }

    // Step action
    if (action === 'step') {
      const result = await executeAtomicStep(jobId);
      return NextResponse.json({
        success: true,
        jobId: result.jobId,
        offerId: result.offerId,
        stepExecuted: result.stepExecuted,
        nextStep: result.nextStep,
        isCompleted: result.isCompleted,
        progressPercent: result.progressPercent,
        message: result.message,
        job: result.job,
        offer: result.offer,
      });
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
