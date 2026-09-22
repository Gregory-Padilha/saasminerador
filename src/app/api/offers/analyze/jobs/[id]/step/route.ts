import { NextRequest, NextResponse } from 'next/server';
import { executeAtomicStep } from '@/lib/offer/atomic-analysis-runner';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'ID do job não fornecido.' }, { status: 400 });
    }

    const job = await dbService.getAnalysisJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job de análise não encontrado.' }, { status: 404 });
    }

    // If already completed or failed, return immediately
    if (job.status === 'completed' || job.status === 'cancelled') {
      const offer = job.offer_id ? await dbService.getOfferById(job.offer_id) : null;
      return NextResponse.json({
        success: true,
        isCompleted: true,
        nextStep: 'COMPLETED',
        progressPercent: 100,
        job,
        offer,
      });
    }

    // Execute exactly one atomic step
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
  } catch (err: any) {
    console.error('[POST /api/offers/analyze/jobs/[id]/step Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao executar etapa de análise.' },
      { status: 500 }
    );
  }
}
