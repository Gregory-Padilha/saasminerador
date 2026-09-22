import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/auth/require-workspace';
import { enqueueSingleJob, triggerWorkerLoop } from '@/lib/mapping/queue';
import { dbService } from '@/lib/supabase/db';
import { MappingType } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    let wsCtx;
    try {
      wsCtx = await requireWorkspace();
    } catch {
      wsCtx = { workspaceId: 'ws_default_001', userId: null, client: undefined };
    }
    const workspaceId = wsCtx.workspaceId || 'ws_default_001';
    const client = (wsCtx as any).client;

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const batchId = searchParams.get('batchId') || undefined;

    let jobs = await dbService.getMappingJobs(batchId, workspaceId, client);
    if (activeOnly) {
      jobs = jobs.filter((j) => j.status === 'QUEUED' || j.status === 'RUNNING');
    }

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (err: any) {
    console.error('[GET /api/mapping/jobs Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao consultar jobs de mapeamento.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let wsCtx;
    try {
      wsCtx = await requireWorkspace();
    } catch {
      wsCtx = { workspaceId: 'ws_default_001', userId: null, client: undefined };
    }
    const workspaceId = wsCtx.workspaceId || 'ws_default_001';
    const userId = wsCtx.userId || null;
    const client = (wsCtx as any).client;

    const body = await req.json();
    const offerId = body.offerId || body.offer_id;
    const type: MappingType = body.type || 'LANDING_PAGE';

    if (!offerId) {
      return NextResponse.json(
        { success: false, error: 'O ID da oferta (offerId) é obrigatório.' },
        { status: 400 }
      );
    }

    const { isNew, job, batch } = await enqueueSingleJob({
      offerId,
      type,
      workspaceId,
      userId,
      client,
    });

    return NextResponse.json({
      success: true,
      job_id: job.id,
      offer_id: job.offer_id,
      status: job.status,
      job,
      batch: batch || null,
      isNew,
    });
  } catch (err: any) {
    console.error('[POST /api/mapping/jobs Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao enfileirar job de mapeamento.' },
      { status: 500 }
    );
  }
}
