import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { createScrapingBatch, triggerScrapingWorkerLoop } from '@/lib/scraping/queue';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Trigger worker loop in case there's an interrupted queue
    triggerScrapingWorkerLoop().catch(() => {});

    const batches = await dbService.getScrapingBatches();

    if (activeOnly) {
      const activeBatch = batches.find((b) => b.status === 'RUNNING' || b.status === 'PAUSED');
      let activeJobs: any[] = [];
      if (activeBatch) {
        activeJobs = await dbService.getScrapingJobs(activeBatch.id);
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
    console.error('[GET /api/scraping/batches Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao consultar lotes de raspagem.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let offerIds: string[] = body.offerIds || [];
    const customName: string | undefined = body.name;

    // Check if a scraping batch is currently running
    const existingBatches = await dbService.getScrapingBatches();
    const runningBatch = existingBatches.find((b) => b.status === 'RUNNING');
    if (runningBatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Já existe um lote de raspagem em execução ("${runningBatch.name}"). Aguarde a conclusão do lote atual.`,
          runningBatchId: runningBatch.id,
        },
        { status: 400 }
      );
    }

    // Auto-select pending offers if offerIds not provided ("Raspar Pendentes")
    if (offerIds.length === 0) {
      const allOffers = await dbService.getOffers();
      const pendingOffers = allOffers.filter((o) => {
        const s = o.data_scraping_status || 'NOT_PROCESSED';
        // At least one useful source URL (LP, Meta Ads, Checkout)
        const hasSource = Boolean(o.landing_page_url || o.meta_ads_url || o.checkout_url);
        return hasSource && (s === 'NOT_PROCESSED' || s === 'PARTIAL' || s === 'STALE' || s === 'FAILED');
      });
      offerIds = pendingOffers.map((o) => o.id);
    }

    if (offerIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhuma oferta pendente encontrada para raspagem.',
        },
        { status: 400 }
      );
    }

    const { batch, jobs } = await createScrapingBatch(offerIds, customName);

    return NextResponse.json({
      success: true,
      batch,
      jobs,
    });
  } catch (err: any) {
    console.error('[POST /api/scraping/batches Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao criar lote de raspagem.' },
      { status: 500 }
    );
  }
}
