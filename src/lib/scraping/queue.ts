// ==============================================================================
// OFFER MINER - DATA SCRAPING BATCH & QUEUE WORKER
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { ScrapingBatch, ScrapingJob, ScrapingSummary, Offer } from '@/types';
import { OfferDataScrapingService } from './service';
import { notifyGlobalSync } from '@/lib/events/offer-events';

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

declare global {
  var __scrapingQueueRunning: boolean | undefined;
}

/**
 * Triggers or resumes the background scraping worker loop.
 */
export async function triggerScrapingWorkerLoop(): Promise<void> {
  if (globalThis.__scrapingQueueRunning) {
    return;
  }
  globalThis.__scrapingQueueRunning = true;

  runScrapingWorkerLoop().catch((err) => {
    console.error('[SCRAPING WORKER LOOP FATAL ERROR]:', err);
    globalThis.__scrapingQueueRunning = false;
  });
}

async function runScrapingWorkerLoop(): Promise<void> {
  try {
    console.log('[SCRAPING WORKER LOOP] Engine started.');

    while (true) {
      // 1. Fetch active running batch
      const batches = await dbService.getScrapingBatches();
      const activeBatch = batches.find((b) => b.status === 'RUNNING');

      if (!activeBatch) {
        console.log('[SCRAPING WORKER LOOP] No active running batches found. Worker sleeping.');
        break;
      }

      // 2. Fetch jobs for active batch
      const jobs = await dbService.getScrapingJobs(activeBatch.id);
      const queuedJob = jobs.find((j) => j.status === 'QUEUED');

      if (!queuedJob) {
        // Batch completed!
        activeBatch.status = 'COMPLETED';
        activeBatch.completed_at = new Date().toISOString();
        activeBatch.updated_at = new Date().toISOString();
        activeBatch.current_offer_id = null;
        activeBatch.current_offer_name = null;
        activeBatch.current_step = `Lote de raspagem concluído! (${activeBatch.success_count} enriquecidas, ${activeBatch.partial_count} parciais, ${activeBatch.failed_count} falhas)`;
        activeBatch.current_progress_percent = 100;
        await dbService.saveScrapingBatch(activeBatch);

        console.log(`[SCRAPING WORKER LOOP] Batch ${activeBatch.id} (${activeBatch.name}) COMPLETED.`);
        notifyGlobalSync('scraping_batch_completed');
        continue;
      }

      // 3. Mark job as RUNNING
      queuedJob.status = 'RUNNING';
      queuedJob.started_at = new Date().toISOString();
      queuedJob.attempts = (queuedJob.attempts || 0) + 1;
      queuedJob.current_step = 'LOADING_ARTIFACTS';
      queuedJob.progress_percent = 10;
      await dbService.saveScrapingJob(queuedJob);

      activeBatch.current_offer_id = queuedJob.offer_id;
      activeBatch.current_offer_name = queuedJob.offer_name;
      activeBatch.current_step = `Raspando [${activeBatch.processed_items + 1}/${activeBatch.total_items}]: ${queuedJob.offer_name}`;
      activeBatch.current_progress_percent = Math.round(
        (activeBatch.processed_items / activeBatch.total_items) * 100
      );
      await dbService.saveScrapingBatch(activeBatch);
      notifyGlobalSync('scraping_batch_updated');

      console.log(`[SCRAPING WORKER LOOP] Item [${activeBatch.processed_items + 1}/${activeBatch.total_items}] START: "${queuedJob.offer_name}"`);

      // 4. Execute scraping service for this offer
      try {
        const report = await OfferDataScrapingService.scrapeAndEnrichOffer(
          queuedJob.offer_id,
          {
            onProgress: (step, percent, message) => {
              queuedJob.current_step = step;
              queuedJob.progress_percent = percent;
              activeBatch.current_step = `[${queuedJob.offer_name}] ${message}`;
              // Fire async update
              dbService.saveScrapingJob(queuedJob).catch(() => {});
            },
          }
        );

        queuedJob.status = report.status;
        queuedJob.current_step = 'COMPLETE';
        queuedJob.progress_percent = 100;
        queuedJob.completed_at = new Date().toISOString();
        queuedJob.report = report;
        await dbService.saveScrapingJob(queuedJob);

        activeBatch.processed_items += 1;
        if (report.status === 'SUCCESS') {
          activeBatch.success_count += 1;
        } else if (report.status === 'PARTIAL') {
          activeBatch.partial_count += 1;
        } else {
          activeBatch.failed_count += 1;
        }
        await dbService.saveScrapingBatch(activeBatch);
      } catch (err: any) {
        console.error(`[SCRAPING WORKER LOOP] Error on job ${queuedJob.id}:`, err);
        queuedJob.status = 'FAILED';
        queuedJob.error_message = err.message || 'Falha durante raspagem.';
        queuedJob.completed_at = new Date().toISOString();
        await dbService.saveScrapingJob(queuedJob);

        activeBatch.processed_items += 1;
        activeBatch.failed_count += 1;
        await dbService.saveScrapingBatch(activeBatch);
      }

      notifyGlobalSync('scraping_batch_updated');
    }
  } catch (loopErr) {
    console.error('[SCRAPING WORKER LOOP FATAL CRASH]:', loopErr);
  } finally {
    globalThis.__scrapingQueueRunning = false;
  }
}

/**
 * Creates and queues a new scraping batch.
 */
export async function createScrapingBatch(
  offerIds: string[],
  customName?: string
): Promise<{ batch: ScrapingBatch; jobs: ScrapingJob[] }> {
  const allOffers = await dbService.getOffers();
  const selectedOffers = allOffers.filter((o) => offerIds.includes(o.id));

  if (selectedOffers.length === 0) {
    throw new Error('Nenhuma oferta válida selecionada para o lote de raspagem.');
  }

  const now = new Date().toISOString();
  const batchId = generateId('batch_scrape');
  const batchName =
    customName ||
    `Lote Raspagem & Enriquecimento (${selectedOffers.length} ofertas) - ${new Date().toLocaleTimeString('pt-BR')}`;

  const batch: ScrapingBatch = {
    id: batchId,
    name: batchName,
    status: 'RUNNING',
    total_items: selectedOffers.length,
    processed_items: 0,
    success_count: 0,
    partial_count: 0,
    failed_count: 0,
    current_offer_id: null,
    current_offer_name: null,
    current_step: 'Iniciando lote...',
    current_progress_percent: 0,
    created_at: now,
    started_at: now,
    updated_at: now,
  };

  const jobs: ScrapingJob[] = selectedOffers.map((o, idx) => ({
    id: generateId(`job_scr_${idx + 1}`),
    batch_id: batchId,
    offer_id: o.id,
    offer_name: o.product_name || o.offer_name || 'Oferta sem nome',
    advertiser: o.advertiser,
    target_urls: {
      landing_page: o.landing_page_url,
      meta_ads: o.meta_ads_url,
      checkout: o.checkout_url,
    },
    status: 'QUEUED',
    current_step: 'QUEUED',
    progress_percent: 0,
    attempts: 0,
    created_at: now,
    updated_at: now,
  }));

  await dbService.saveScrapingBatch(batch);
  for (const j of jobs) {
    await dbService.saveScrapingJob(j);
  }

  // Trigger background worker
  triggerScrapingWorkerLoop().catch(() => {});

  return { batch, jobs };
}

/**
 * Calculates scraping statistics for dashboard and central counters.
 */
export async function getScrapingSummary(): Promise<ScrapingSummary> {
  const allOffers = await dbService.getOffers();
  const batches = await dbService.getScrapingBatches();
  const activeBatch = batches.find((b) => b.status === 'RUNNING' || b.status === 'PAUSED') || null;

  let notProcessedCount = 0;
  let queuedCount = 0;
  let runningCount = 0;
  let partialCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let staleCount = 0;

  for (const o of allOffers) {
    const status = o.data_scraping_status || 'NOT_PROCESSED';
    switch (status) {
      case 'NOT_PROCESSED':
        notProcessedCount++;
        break;
      case 'QUEUED':
        queuedCount++;
        break;
      case 'RUNNING':
        runningCount++;
        break;
      case 'PARTIAL':
        partialCount++;
        break;
      case 'SUCCESS':
        successCount++;
        break;
      case 'FAILED':
        failedCount++;
        break;
      case 'STALE':
        staleCount++;
        break;
    }
  }

  return {
    totalOffers: allOffers.length,
    notProcessedCount,
    queuedCount,
    runningCount,
    partialCount,
    successCount,
    failedCount,
    staleCount,
    activeBatch,
    recentBatches: batches.slice(0, 10),
  };
}
