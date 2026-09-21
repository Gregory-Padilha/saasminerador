import { dbService } from '@/lib/supabase/db';
import { resolveLandingPageUrl } from '@/lib/landing-page/resolver';
import { analyzeAndMapLandingPage } from '@/lib/landing-page/sync';
import { mapCheckout } from '@/lib/checkout-intelligence/extract';
import { MappingBatch, MappingJob, MappingType, MappingSummary, isLandingPageMapped } from '@/types';
import { deriveDataStatus } from '@/lib/dossier';

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

// Global flag to prevent concurrent worker loops on the same Node.js process
declare global {
  var __mappingQueueRunning: boolean | undefined;
}

/**
 * Triggers or resumes the background queue worker loop on the server.
 */
export async function triggerWorkerLoop(): Promise<void> {
  if (globalThis.__mappingQueueRunning) {
    return;
  }
  globalThis.__mappingQueueRunning = true;

  // Run in background without blocking caller
  runWorkerLoop().catch((err) => {
    console.error('[MAPPING WORKER LOOP FATAL ERROR]:', err);
    globalThis.__mappingQueueRunning = false;
  });
}

async function runWorkerLoop(): Promise<void> {
  try {
    console.log('[MAPPING WORKER LOOP] Engine started.');

    while (true) {
      // 1. Fetch active running batch
      const batches = await dbService.getMappingBatches();
      const activeBatch = batches.find((b) => b.status === 'RUNNING');

      if (!activeBatch) {
        console.log('[MAPPING WORKER LOOP] No active running batches found. Worker sleeping.');
        break;
      }

      // 2. Fetch jobs for the active batch
      const jobs = await dbService.getMappingJobs(activeBatch.id);
      const queuedJob = jobs.find((j) => j.status === 'QUEUED');

      if (!queuedJob) {
        // All items processed in this batch!
        const hasFailures = jobs.some((j) => j.status === 'FAILED' || j.status === 'FAILED_TIMEOUT');
        activeBatch.status = 'COMPLETED';
        activeBatch.completed_at = new Date().toISOString();
        activeBatch.updated_at = new Date().toISOString();
        activeBatch.current_offer_id = null;
        activeBatch.current_offer_name = null;
        activeBatch.current_step = hasFailures
          ? `Lote concluído com avisos/falhas (${activeBatch.failed_count} falhas)`
          : `Lote concluído com sucesso (${activeBatch.success_count} concluídas)!`;
        activeBatch.current_progress_percent = 100;
        await dbService.saveMappingBatch(activeBatch);
        console.log(`[MAPPING WORKER LOOP] Batch ${activeBatch.id} (${activeBatch.name}) COMPLETED.`);
        continue;
      }

      // 3. Mark job as RUNNING
      queuedJob.status = 'RUNNING';
      queuedJob.started_at = new Date().toISOString();
      queuedJob.attempts = (queuedJob.attempts || 0) + 1;
      queuedJob.current_step = 'Iniciando processamento...';
      queuedJob.progress_percent = 10;
      await dbService.saveMappingJob(queuedJob);

      activeBatch.current_offer_id = queuedJob.offer_id;
      activeBatch.current_offer_name = queuedJob.offer_name;
      activeBatch.current_step = `Processando [${activeBatch.processed_items + 1}/${activeBatch.total_items}]: ${queuedJob.offer_name}`;
      activeBatch.current_progress_percent = Math.round(((activeBatch.processed_items) / activeBatch.total_items) * 100);
      await dbService.saveMappingBatch(activeBatch);

      console.log(`[MAPPING WORKER LOOP] Item [${activeBatch.processed_items + 1}/${activeBatch.total_items}] START: "${queuedJob.offer_name}" (${queuedJob.type})`);

      // 4. Process job based on type
      try {
        if (activeBatch.type === 'LANDING_PAGE') {
          await executeLandingPageJob(activeBatch, queuedJob);
        } else if (activeBatch.type === 'CHECKOUT') {
          await executeCheckoutJob(activeBatch, queuedJob);
        }
      } catch (err: any) {
        console.error(`[MAPPING WORKER LOOP] Uncaught error processing job ${queuedJob.id}:`, err);
        queuedJob.status = 'FAILED';
        queuedJob.error_message = err.message || 'Erro inesperado durante a execução.';
        queuedJob.completed_at = new Date().toISOString();
        await dbService.saveMappingJob(queuedJob);

        activeBatch.failed_count = (activeBatch.failed_count || 0) + 1;
        activeBatch.processed_items = (activeBatch.processed_items || 0) + 1;
        await dbService.saveMappingBatch(activeBatch);
      }

      // Small delay between items to allow system/network breathing
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  } finally {
    globalThis.__mappingQueueRunning = false;
  }
}

/**
 * Executes a single Landing Page mapping job with 60s timeout protection.
 */
async function executeLandingPageJob(batch: MappingBatch, job: MappingJob): Promise<void> {
  const offer = await dbService.getOfferById(job.offer_id);
  if (!offer) {
    job.status = 'FAILED';
    job.error_message = 'Oferta não encontrada no banco de dados.';
    job.completed_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    batch.failed_count = (batch.failed_count || 0) + 1;
    batch.processed_items = (batch.processed_items || 0) + 1;
    await dbService.saveMappingBatch(batch);
    return;
  }

  // 1. Resolve and validate LP URL first
  const resolution = await resolveLandingPageUrl(offer);
  if (!resolution.resolvedUrl || resolution.status === 'DNS_NOT_RESOLVED' || resolution.status === 'UNAVAILABLE' || resolution.status === 'INVALID_URL') {
    job.status = 'FAILED';
    job.error_message = resolution.userFriendlyMessage || `URL da LP indisponível (${resolution.status})`;
    job.completed_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    batch.failed_count = (batch.failed_count || 0) + 1;
    batch.processed_items = (batch.processed_items || 0) + 1;
    await dbService.saveMappingBatch(batch);
    return;
  }

  const targetUrl = resolution.resolvedUrl;
  job.target_url = targetUrl;
  job.current_step = 'Conectando à Landing Page e capturando DOM...';
  job.progress_percent = 25;
  await dbService.saveMappingJob(job);

  // 2. Execute LP Mapping with 60s timeout
  const timeoutMs = 60000;
  let isTimeout = false;

  const mappingPromise = analyzeAndMapLandingPage(
    offer.id,
    targetUrl,
    offer.user_id,
    (prog) => {
      job.current_step = prog.message || job.current_step;
      job.progress_percent = Math.max(job.progress_percent || 25, Math.min(95, prog.progressPercent || 50));
      dbService.saveMappingJob(job).catch(() => {});
    }
  );

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      isTimeout = true;
      reject(new Error('TIMEOUT_EXCEEDED: Mapeamento de LP excedeu limite de 60s.'));
    }, timeoutMs);
  });

  let result: any;
  try {
    result = await Promise.race([mappingPromise, timeoutPromise]);
  } catch (err: any) {
    if (isTimeout) {
      job.status = 'FAILED_TIMEOUT';
      job.error_message = 'Timeout de 60 segundos atingido ao mapear a Landing Page.';
    } else {
      job.status = 'FAILED';
      job.error_message = err.message || 'Falha ao mapear Landing Page.';
    }
    job.completed_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    batch.failed_count = (batch.failed_count || 0) + 1;
    batch.processed_items = (batch.processed_items || 0) + 1;
    await dbService.saveMappingBatch(batch);
    return;
  }

  // 3. Complete LP Mapping
  const updatedOffer = await dbService.getOfferById(offer.id);

  // CHECKOUT URL ENRICHMENT SAFETY:
  // If LP mapping discovered a checkout_url, ensure it is saved on the offer's checkout_url field
  if (result?.checkoutUrl && updatedOffer && (!updatedOffer.checkout_url || updatedOffer.checkout_url.trim() === '')) {
    await dbService.updateOffer(updatedOffer.id, { checkout_url: result.checkoutUrl });
  }

  job.status = result?.hasErrors ? 'PARTIAL' : 'SUCCESS';
  job.progress_percent = 100;
  job.current_step = 'Landing Page mapeada com sucesso!';
  job.completed_at = new Date().toISOString();
  await dbService.saveMappingJob(job);

  // Update offer persistent single source of truth state
  const updatedLpMappedAt = new Date().toISOString();
  const calculatedStatus =
    offer.status === 'VALIDADA'
      ? 'VALIDADA'
      : deriveDataStatus({
          ...offer,
          lp_mapping_status: job.status as any,
          lp_mapped_at: updatedLpMappedAt,
        });

  await dbService.updateOffer(offer.id, {
    lp_mapping_status: job.status as any,
    lp_mapped_at: updatedLpMappedAt,
    lp_last_error: null,
    status: calculatedStatus,
    landing_page_url_status: 'CAPTURED',
  });
  await dbService.reconcileMappingState(offer);

  if (result?.hasErrors) {
    batch.partial_count = (batch.partial_count || 0) + 1;
  } else {
    batch.success_count = (batch.success_count || 0) + 1;
  }
  batch.processed_items = (batch.processed_items || 0) + 1;
  await dbService.saveMappingBatch(batch);
}

/**
 * Executes a single Checkout Intelligence job with 60s timeout protection.
 */
async function executeCheckoutJob(batch: MappingBatch, job: MappingJob): Promise<void> {
  const offer = await dbService.getOfferById(job.offer_id);
  if (!offer) {
    job.status = 'FAILED';
    job.error_message = 'Oferta não encontrada no banco de dados.';
    job.completed_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    batch.failed_count = (batch.failed_count || 0) + 1;
    batch.processed_items = (batch.processed_items || 0) + 1;
    await dbService.saveMappingBatch(batch);
    return;
  }

  // CRITICAL PROTECTION RULE:
  // Only process if real checkout_url exists and is NOT equal to landing_page_url!
  if (!offer.checkout_url || offer.checkout_url.trim() === '') {
    job.status = 'SKIPPED';
    job.error_message = 'Nenhuma URL de checkout cadastrada na oferta.';
    job.completed_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    batch.failed_count = (batch.failed_count || 0) + 1;
    batch.processed_items = (batch.processed_items || 0) + 1;
    await dbService.saveMappingBatch(batch);
    return;
  }

  if (offer.landing_page_url && offer.checkout_url.trim() === offer.landing_page_url.trim()) {
    console.warn(`[CHECKOUT JOB ABORTED] Checkout URL matches Landing Page URL for offer ${offer.id}. Skipping.`);
    job.status = 'SKIPPED';
    job.error_message = 'ABORTADO: A URL de checkout é idêntica à URL da Landing Page.';
    job.completed_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    batch.failed_count = (batch.failed_count || 0) + 1;
    batch.processed_items = (batch.processed_items || 0) + 1;
    await dbService.saveMappingBatch(batch);
    return;
  }

  job.target_url = offer.checkout_url;
  job.current_step = 'Conectando ao Checkout e identificando Order Bumps / Meios de Pagamento...';
  job.progress_percent = 30;
  await dbService.saveMappingJob(job);

  // Execute Checkout mapping with 60s timeout
  const timeoutMs = 60000;
  let isTimeout = false;

  const checkoutPromise = mapCheckout(offer.id);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      isTimeout = true;
      reject(new Error('TIMEOUT_EXCEEDED: Mapeamento de Checkout excedeu limite de 60s.'));
    }, timeoutMs);
  });

  let result: any;
  try {
    result = await Promise.race([checkoutPromise, timeoutPromise]);
  } catch (err: any) {
    if (isTimeout) {
      job.status = 'FAILED_TIMEOUT';
      job.error_message = 'Timeout de 60 segundos atingido ao analisar o Checkout.';
    } else {
      job.status = 'FAILED';
      job.error_message = err.message || 'Falha ao analisar Checkout Intelligence.';
    }
    job.completed_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    batch.failed_count = (batch.failed_count || 0) + 1;
    batch.processed_items = (batch.processed_items || 0) + 1;
    await dbService.saveMappingBatch(batch);

    await dbService.updateOffer(offer.id, {
      checkout_mapping_status: 'FAILED',
      checkout_last_error: job.error_message,
    });
    return;
  }

  const isVerified = result?.status === 'verified';
  job.status = isVerified ? 'SUCCESS' : 'PARTIAL';
  job.progress_percent = 100;
  job.current_step = isVerified ? 'Checkout mapeado e verificado com sucesso!' : 'Checkout analisado com avisos.';
  job.completed_at = new Date().toISOString();
  await dbService.saveMappingJob(job);

  await dbService.updateOffer(offer.id, {
    checkout_mapping_status: isVerified ? 'SUCCESS' : 'PARTIAL',
    checkout_mapped_at: new Date().toISOString(),
    checkout_last_error: isVerified ? null : 'Checkout analisado com avisos',
  });
  await dbService.reconcileMappingState(offer);

  if (isVerified) {
    batch.success_count = (batch.success_count || 0) + 1;
  } else {
    batch.partial_count = (batch.partial_count || 0) + 1;
  }
  batch.processed_items = (batch.processed_items || 0) + 1;
  await dbService.saveMappingBatch(batch);
}

/**
 * Creates a new Mapping Batch and enqueues jobs for selected offer IDs.
 */
export async function createMappingBatch(
  type: MappingType,
  offerIds: string[],
  customName?: string
): Promise<{ batch: MappingBatch; jobs: MappingJob[] }> {
  const now = new Date().toISOString();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seqStr = Math.floor(100 + Math.random() * 900);
  const batchId = generateId('batch');
  const batchName = customName || `${type === 'LANDING_PAGE' ? 'Lote Landing Pages' : 'Lote Checkouts'} #${dateStr}-${seqStr}`;

  const allOffers = await dbService.reconcileAllOffers();
  const selectedOffers = allOffers.filter((o) => offerIds.includes(o.id));

  const batch: MappingBatch = {
    id: batchId,
    name: batchName,
    type,
    status: 'RUNNING',
    concurrency: 1,
    total_items: selectedOffers.length,
    processed_items: 0,
    success_count: 0,
    partial_count: 0,
    failed_count: 0,
    current_offer_id: null,
    current_offer_name: null,
    current_step: 'Aguardando início do lote...',
    current_progress_percent: 0,
    created_at: now,
    started_at: now,
    completed_at: null,
    updated_at: now,
  };

  const jobs: MappingJob[] = selectedOffers.map((offer) => ({
    id: generateId('job'),
    batch_id: batchId,
    offer_id: offer.id,
    offer_name: offer.product_name || 'Oferta Sem Nome',
    advertiser: offer.advertiser || null,
    target_url: type === 'LANDING_PAGE' ? (offer.landing_page_url || '') : (offer.checkout_url || ''),
    type,
    status: 'QUEUED',
    current_step: 'Aguardando na fila...',
    progress_percent: 0,
    error_message: null,
    attempts: 0,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  }));

  await dbService.saveMappingBatch(batch);
  for (const job of jobs) {
    await dbService.saveMappingJob(job);
  }

  // Trigger worker loop
  triggerWorkerLoop().catch(() => {});

  return { batch, jobs };
}

/**
 * Pauses a running batch.
 */
export async function pauseMappingBatch(batchId: string): Promise<MappingBatch | null> {
  const batch = await dbService.getMappingBatchById(batchId);
  if (!batch) return null;
  batch.status = 'PAUSED';
  batch.current_step = 'Lote pausado pelo usuário.';
  await dbService.saveMappingBatch(batch);
  return batch;
}

/**
 * Resumes a paused batch.
 */
export async function resumeMappingBatch(batchId: string): Promise<MappingBatch | null> {
  const batch = await dbService.getMappingBatchById(batchId);
  if (!batch) return null;
  batch.status = 'RUNNING';
  batch.current_step = 'Retomando processamento do lote...';
  await dbService.saveMappingBatch(batch);
  triggerWorkerLoop().catch(() => {});
  return batch;
}

/**
 * Cancels a batch and marks all QUEUED jobs as CANCELLED.
 */
export async function cancelMappingBatch(batchId: string): Promise<MappingBatch | null> {
  const batch = await dbService.getMappingBatchById(batchId);
  if (!batch) return null;
  batch.status = 'CANCELLED';
  batch.completed_at = new Date().toISOString();
  batch.current_step = 'Lote cancelado pelo usuário.';
  await dbService.saveMappingBatch(batch);

  const jobs = await dbService.getMappingJobs(batchId);
  for (const job of jobs) {
    if (job.status === 'QUEUED' || job.status === 'RUNNING') {
      job.status = 'CANCELLED';
      job.completed_at = new Date().toISOString();
      await dbService.saveMappingJob(job);
    }
  }

  return batch;
}

/**
 * Creates a new batch or restarts jobs that failed in a previous batch.
 */
export async function reprocessFailedMappingBatch(batchId: string): Promise<{ batch: MappingBatch; jobs: MappingJob[] } | null> {
  const oldBatch = await dbService.getMappingBatchById(batchId);
  if (!oldBatch) return null;

  const jobs = await dbService.getMappingJobs(batchId);
  const failedJobs = jobs.filter((j) => j.status === 'FAILED' || j.status === 'FAILED_TIMEOUT' || j.status === 'PARTIAL');

  if (failedJobs.length === 0) return null;

  const failedOfferIds = failedJobs.map((j) => j.offer_id);
  return createMappingBatch(oldBatch.type, failedOfferIds, `Reprocessamento ${oldBatch.name}`);
}

/**
 * Computes live summary statistics for the Mapping Center.
 */
export async function computeMappingSummary(): Promise<MappingSummary> {
  const offers = await dbService.reconcileAllOffers();

  let total_offers = offers.length;
  let lp_pending = 0;
  let lp_mapped = 0;
  let lp_failed = 0;

  let discovery_found = 0;
  let discovery_not_found = 0;
  let discovery_not_processed = 0;
  let discovery_invalid = 0;
  let discovery_blocked = 0;
  let discovery_failed = 0;

  let checkout_pending = 0;
  let checkout_mapped = 0;
  let checkout_failed = 0;

  let failed_count = 0;
  let processing_count = 0;

  for (const offer of offers) {
    const hasLpUrl = Boolean(offer.landing_page_url && offer.landing_page_url.trim() !== '');
    const isLpCaptured = isLandingPageMapped(offer);
    const isLpFailed =
      offer.lp_mapping_status === 'FAILED' ||
      offer.landing_page_url_status === 'UNAVAILABLE' ||
      offer.landing_page_url_status === 'DNS_NOT_RESOLVED' ||
      offer.landing_page_url_status === 'INVALID_URL';

    if (isLpCaptured) {
      lp_mapped++;

      // Discovery status breakdown
      const disc = offer.checkout_discovery_status || 'NOT_PROCESSED';
      if (disc === 'FOUND') discovery_found++;
      else if (disc === 'NOT_FOUND') discovery_not_found++;
      else if (disc === 'NOT_PROCESSED') discovery_not_processed++;
      else if (disc === 'INVALID') discovery_invalid++;
      else if (disc === 'BLOCKED') discovery_blocked++;
      else if (disc === 'FAILED') discovery_failed++;

      if (disc === 'FOUND') {
        const chkStatus = offer.checkout_mapping_status;
        if (chkStatus === 'SUCCESS') checkout_mapped++;
        else if (chkStatus === 'FAILED') checkout_failed++;
        else checkout_pending++;
      }
    } else if (isLpFailed) {
      lp_failed++;
      failed_count++;
    } else {
      lp_pending++;
    }
  }

  // Active batches check
  const batches = await dbService.getMappingBatches();
  const runningBatch = batches.find((b) => b.status === 'RUNNING');
  if (runningBatch) {
    processing_count = runningBatch.total_items - runningBatch.processed_items;
  }

  return {
    total_offers,
    lp_pending,
    lp_mapped,
    lp_failed,
    discovery_found,
    discovery_not_found,
    discovery_not_processed,
    discovery_invalid,
    discovery_blocked,
    discovery_failed,
    checkout_pending,
    checkout_mapped,
    checkout_failed,
    failed_count,
    processing_count,
  };
}
