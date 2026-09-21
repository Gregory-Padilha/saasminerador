import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { createMappingBatch, triggerWorkerLoop } from '@/lib/mapping/queue';
import { MappingType } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Trigger worker loop in case there's an interrupted queue waiting
    triggerWorkerLoop().catch(() => {});

    const batches = await dbService.getMappingBatches();

    if (activeOnly) {
      const activeBatch = batches.find((b) => b.status === 'RUNNING' || b.status === 'PAUSED');
      let activeJobs: any[] = [];
      if (activeBatch) {
        activeJobs = await dbService.getMappingJobs(activeBatch.id);
      }
      return NextResponse.json({
        success: true,
        activeBatch: activeBatch || null,
        jobs: activeJobs,
      });
    }

    return NextResponse.json({
      success: true,
      batches,
    });
  } catch (err: any) {
    console.error('[GET /api/mapping/batches Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao consultar lotes de mapeamento.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type: MappingType = body.type || 'LANDING_PAGE';
    let offerIds: string[] = body.offerIds || [];
    const customName: string | undefined = body.name;

    // Check if a batch is currently running
    const existingBatches = await dbService.getMappingBatches();
    const runningBatch = existingBatches.find((b) => b.status === 'RUNNING');
    if (runningBatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Já existe um lote em execução ("${runningBatch.name}"). Aguarde a conclusão ou pause/cancele o lote atual.`,
          runningBatchId: runningBatch.id,
        },
        { status: 400 }
      );
    }

    // If offerIds not specified, auto-select all pending offers of that type
    if (offerIds.length === 0) {
      const allOffers = await dbService.getOffers();
      if (type === 'LANDING_PAGE') {
        const pendingLpOffers = allOffers.filter(
          (o) => o.landing_page_url && o.landing_page_url.trim() !== '' && o.status !== 'MAPEADA' && o.status !== 'VALIDADA'
        );
        offerIds = pendingLpOffers.map((o) => o.id);
      } else {
        const pendingCheckoutOffers = allOffers.filter(
          (o) =>
            o.checkout_url &&
            o.checkout_url.trim() !== '' &&
            (!o.landing_page_url || o.checkout_url.trim() !== o.landing_page_url.trim()) &&
            o.checkout_mapping_status !== 'SUCCESS'
        );
        offerIds = pendingCheckoutOffers.map((o) => o.id);
      }
    }

    if (offerIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Nenhuma oferta pendente encontrada para mapeamento de ${type === 'LANDING_PAGE' ? 'Landing Page' : 'Checkout'}.`,
        },
        { status: 400 }
      );
    }

    const { batch, jobs } = await createMappingBatch(type, offerIds, customName);

    return NextResponse.json({
      success: true,
      batch,
      jobs,
    });
  } catch (err: any) {
    console.error('[POST /api/mapping/batches Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao criar lote de mapeamento.' },
      { status: 500 }
    );
  }
}
