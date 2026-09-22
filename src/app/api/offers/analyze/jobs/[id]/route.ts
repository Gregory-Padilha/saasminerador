import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { executeAtomicStep } from '@/lib/offer/atomic-analysis-runner';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

    const supabase = await createServerSupabaseClient();
    const job = await dbService.getAnalysisJob(jobId, supabase);
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
      }, supabase);

      if (job.offer_id) {
        await dbService.updateOffer(job.offer_id, {
          status: 'DADOS_PARCIAIS',
          updated_at: new Date().toISOString(),
        }, supabase).catch(() => {});
      }

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

    const supabase = await createServerSupabaseClient();
    const job = await dbService.getAnalysisJob(jobId, supabase);
    if (!job) {
      return NextResponse.json({ error: 'Job de análise não encontrado.' }, { status: 404 });
    }

    // Cancel action
    if (action === 'cancel') {
      const updated = await dbService.updateAnalysisJob(jobId, {
        status: 'cancelled',
        stage_message: 'Análise cancelada pelo usuário.',
      }, supabase);
      return NextResponse.json({ success: true, job: updated });
    }

    // Retry action (re-uses existing offer_id, increments attempt, triggers Step 1)
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
      await dbService.updateAnalysisJob(jobId, {
        status: 'running',
        current_step: 'RESOLVE_META',
        attempt: currentAttempt + 1,
        last_heartbeat_at: now,
        stage_message: `Reiniciando análise (tentativa ${currentAttempt + 1}/${maxAttempts})...`,
        error_code: null,
      }, supabase);

      // Execute Step 1 immediately on retry
      const stepResult = await executeAtomicStep(jobId, supabase);

      return NextResponse.json({
        success: true,
        job: stepResult.job,
        offer: stepResult.offer,
      });
    }

    // Step action
    if (action === 'step') {
      const result = await executeAtomicStep(jobId, supabase);
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
