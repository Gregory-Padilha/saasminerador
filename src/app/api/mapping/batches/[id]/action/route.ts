import { NextRequest, NextResponse } from 'next/server';
import {
  pauseMappingBatch,
  resumeMappingBatch,
  cancelMappingBatch,
  reprocessFailedMappingBatch,
} from '@/lib/mapping/queue';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    if (!batchId) {
      return NextResponse.json({ error: 'ID do lote inválido.' }, { status: 400 });
    }

    const body = await req.json();
    const action = body.action as 'pause' | 'resume' | 'cancel' | 'reprocess_failed';

    if (!action) {
      return NextResponse.json({ error: 'Ação não informada.' }, { status: 400 });
    }

    let updatedBatch: any = null;
    let newJobs: any[] = [];

    if (action === 'pause') {
      updatedBatch = await pauseMappingBatch(batchId);
    } else if (action === 'resume') {
      updatedBatch = await resumeMappingBatch(batchId);
    } else if (action === 'cancel') {
      updatedBatch = await cancelMappingBatch(batchId);
    } else if (action === 'reprocess_failed') {
      const result = await reprocessFailedMappingBatch(batchId);
      if (result) {
        updatedBatch = result.batch;
        newJobs = result.jobs;
      }
    } else {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      batch: updatedBatch,
      jobs: newJobs,
    });
  } catch (err: any) {
    console.error('[POST /api/mapping/batches/[id]/action Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao executar ação no lote.' },
      { status: 500 }
    );
  }
}
