import { dbService } from '@/lib/supabase/db';
import { resolveLandingPageUrl } from '@/lib/landing-page/resolver';
import { analyzeAndMapLandingPage } from '@/lib/landing-page/sync';
import { mapCheckout } from '@/lib/checkout-intelligence/extract';
import { MappingBatch, MappingJob, MappingType, MappingSummary, isLandingPageMapped } from '@/types';
import { deriveDataStatus } from '@/lib/dossier';
import { getMappingStats } from '@/lib/mapping/stats';

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

const MAX_CONCURRENT_WORKERS = 2; // Server-side limit: 2 concurrent browser workers
const STALE_JOB_TIMEOUT_MS = 90000; // 90s without heartbeat marks job as STALE

// Global flag to prevent concurrent worker loops on the same Node.js process
declare global {
  var __mappingQueueRunning: boolean | undefined;
  var __mappingActiveJobIds: Set<string> | undefined;
}

if (!globalThis.__mappingActiveJobIds) {
  globalThis.__mappingActiveJobIds = new Set<string>();
}

/**
 * Triggers or resumes the background queue worker loop on the server.
 */
export async function triggerWorkerLoop(workspaceId: string = 'ws_default_001'): Promise<void> {
  if (globalThis.__mappingQueueRunning) {
    return;
  }
  globalThis.__mappingQueueRunning = true;

  // Run in background without blocking caller
  runWorkerLoop(workspaceId).catch((err) => {
    console.error('[MAPPING WORKER LOOP FATAL ERROR]:', err);
    globalThis.__mappingQueueRunning = false;
  });
}

async function runWorkerLoop(workspaceId: string): Promise<void> {
  try {
    console.log(`[MAPPING WORKER LOOP] Engine started for workspace: ${workspaceId}.`);

    while (true) {
      // 1. Fetch active running batches
      const batches = await dbService.getMappingBatches(undefined, workspaceId);
      const activeBatch = batches.find((b) => b.status === 'RUNNING');

      if (!activeBatch) {
        // Also check if there are any orphaned QUEUED jobs that need a batch
        const orphanedJobs = await dbService.getMappingJobs(undefined, workspaceId);
        const hasQueued = orphanedJobs.some((j) => j.status === 'QUEUED');
        if (!hasQueued && (!globalThis.__mappingActiveJobIds || globalThis.__mappingActiveJobIds.size === 0)) {
          console.log('[MAPPING WORKER LOOP] No active running batches or queued jobs found. Worker sleeping.');
          break;
        }
      }

      // 2. Watchdog: check for stale running jobs (>90s without heartbeat)
      const allActiveJobs = await dbService.getActiveMappingJobs(workspaceId);
      const nowMs = Date.now();
      for (const job of allActiveJobs) {
        if (job.status === 'RUNNING' && job.last_heartbeat_at) {
          const lastHeartbeat = new Date(job.last_heartbeat_at).getTime();
          if (nowMs - lastHeartbeat > STALE_JOB_TIMEOUT_MS) {
            console.warn(`[MAPPING WATCHDOG] Job ${job.id} (${job.offer_name}) is STALE (>90s without heartbeat). Marking STALE.`);
            job.status = 'STALE';
            job.error_message = 'Execução sem resposta por mais de 90 segundos (STALE).';
            job.completed_at = new Date().toISOString();
            await dbService.saveMappingJob(job);
            globalThis.__mappingActiveJobIds?.delete(job.id);
          }
        }
      }

      // 3. Check current concurrency
      const activeRunningCount = globalThis.__mappingActiveJobIds ? globalThis.__mappingActiveJobIds.size : 0;
      const availableSlots = Math.max(0, MAX_CONCURRENT_WORKERS - activeRunningCount);

      if (availableSlots <= 0) {
        // Concurrency limit reached, wait and check again
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      // 4. Fetch queued jobs for the active batch or any queued jobs
      let queuedJobs: MappingJob[] = [];
      if (activeBatch) {
        const batchJobs = await dbService.getMappingJobs(activeBatch.id, workspaceId);
        queuedJobs = batchJobs.filter((j) => j.status === 'QUEUED');
      } else {
        const allJobs = await dbService.getMappingJobs(undefined, workspaceId);
        queuedJobs = allJobs.filter((j) => j.status === 'QUEUED');
      }

      if (queuedJobs.length === 0) {
        if (activeBatch && activeRunningCount === 0) {
          // All items processed in this batch!
          const batchJobs = await dbService.getMappingJobs(activeBatch.id, workspaceId);
          const hasFailures = batchJobs.some((j) => j.status === 'FAILED' || j.status === 'FAILED_TIMEOUT' || j.status === 'STALE');
          activeBatch.status = 'COMPLETED';
          activeBatch.completed_at = new Date().toISOString();
          activeBatch.updated_at = new Date().toISOString();
          activeBatch.current_offer_id = null;
          activeBatch.current_offer_name = null;
          activeBatch.current_step = hasFailures
            ? `Lote concluído com falhas/avisos (${activeBatch.failed_count} falhas)`
            : `Lote concluído com sucesso (${activeBatch.success_count} concluídas)!`;
          activeBatch.current_progress_percent = 100;
          await dbService.saveMappingBatch(activeBatch);
          console.log(`[MAPPING WORKER LOOP] Batch ${activeBatch.id} (${activeBatch.name}) COMPLETED.`);
          continue;
        }

        if (activeRunningCount === 0) {
          console.log('[MAPPING WORKER LOOP] All queued jobs finished. Loop complete.');
          break;
        }

        // Waiting for running jobs to finish
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      // 5. Pick up to `availableSlots` jobs to execute concurrently
      const jobsToStart = queuedJobs.slice(0, availableSlots);
      for (const job of jobsToStart) {
        globalThis.__mappingActiveJobIds?.add(job.id);

        // Mark as RUNNING immediately
        const nowIso = new Date().toISOString();
        job.status = 'RUNNING';
        job.started_at = nowIso;
        job.last_heartbeat_at = nowIso;
        job.attempts = (job.attempts || 0) + 1;
        job.current_step = 'Aguardando worker...';
        job.progress_percent = 0;
        await dbService.saveMappingJob(job);

        if (activeBatch) {
          activeBatch.current_offer_id = job.offer_id;
          activeBatch.current_offer_name = job.offer_name;
          activeBatch.current_step = `Processando: ${job.offer_name}`;
          activeBatch.current_progress_percent = Math.round(((activeBatch.processed_items) / Math.max(1, activeBatch.total_items)) * 100);
          await dbService.saveMappingBatch(activeBatch);
        }

        console.log(`[MAPPING WORKER] Starting Job ${job.id} for "${job.offer_name}" (${job.type})`);

        // Execute in background
        executeJobWrapper(job, activeBatch, workspaceId).finally(() => {
          globalThis.__mappingActiveJobIds?.delete(job.id);
        });
      }

      // Small delay between checks
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } finally {
    globalThis.__mappingQueueRunning = false;
  }
}

async function executeJobWrapper(job: MappingJob, batch: MappingBatch | null | undefined, workspaceId: string): Promise<void> {
  try {
    if (job.type === 'LANDING_PAGE') {
      await executeLandingPageJob(batch, job, workspaceId);
    } else if (job.type === 'CHECKOUT') {
      await executeCheckoutJob(batch, job, workspaceId);
    }
  } catch (err: any) {
    console.error(`[MAPPING WORKER] Uncaught error processing job ${job.id}:`, err);
    job.status = 'FAILED';
    job.error_message = err.message || 'Erro inesperado durante a execução.';
    job.completed_at = new Date().toISOString();
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      batch.current_progress_percent = Math.round((batch.processed_items / Math.max(1, batch.total_items)) * 100);
      await dbService.saveMappingBatch(batch);
    }
  }
}

/**
 * Executes a single Landing Page mapping job with factual steps and exact progress percentages.
 */
async function executeLandingPageJob(batch: MappingBatch | null | undefined, job: MappingJob, workspaceId: string): Promise<void> {
  const offer = await dbService.getOfferById(job.offer_id);
  if (!offer) {
    job.status = 'FAILED';
    job.error_message = 'Oferta não encontrada no banco de dados.';
    job.completed_at = new Date().toISOString();
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      await dbService.saveMappingBatch(batch);
    }
    return;
  }

  // 1. Resolve and validate LP URL first
  job.current_step = 'Abrindo página...';
  job.progress_percent = 15;
  job.last_heartbeat_at = new Date().toISOString();
  await dbService.saveMappingJob(job);

  const resolution = await resolveLandingPageUrl(offer);
  if (!resolution.resolvedUrl || resolution.status === 'DNS_NOT_RESOLVED' || resolution.status === 'UNAVAILABLE' || resolution.status === 'INVALID_URL') {
    job.status = 'FAILED';
    job.error_message = resolution.userFriendlyMessage || `URL da LP indisponível (${resolution.status})`;
    job.completed_at = new Date().toISOString();
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      await dbService.saveMappingBatch(batch);
    }
    return;
  }

  const targetUrl = resolution.resolvedUrl;
  job.target_url = targetUrl;
  job.current_step = 'Capturando screenshot e DOM...';
  job.progress_percent = 30;
  job.last_heartbeat_at = new Date().toISOString();
  await dbService.saveMappingJob(job);

  // 2. Execute LP Mapping with timeout protection
  const timeoutMs = 60000;
  let isTimeout = false;

  const mappingPromise = analyzeAndMapLandingPage(
    offer.id,
    targetUrl,
    offer.user_id,
    (prog) => {
      // Map factual steps to exact percentages
      let factualStep = prog.message || job.current_step;
      let pct = 30;

      switch (prog.step) {
        case 'opening_url':
          factualStep = 'Abrindo página...';
          pct = 15;
          break;
        case 'capturing_visuals':
          factualStep = 'Capturando screenshot e DOM...';
          pct = 30;
          break;
        case 'waiting_dom':
          factualStep = 'Carregando página...';
          pct = 35;
          break;
        case 'analyzing_dom':
          factualStep = 'Extraindo conteúdo...';
          pct = 45;
          break;
        case 'extracting_hero':
          factualStep = 'Extraindo hero...';
          pct = 50;
          break;
        case 'mapping_sections':
          factualStep = 'Extraindo copy...';
          pct = 60;
          break;
        case 'extracting_copy':
          factualStep = 'Identificando CTA...';
          pct = 65;
          break;
        case 'extracting_links':
          factualStep = 'Descobrindo checkout...';
          pct = 75;
          break;
        case 'identifying_commerce':
          factualStep = 'Identificando preços...';
          pct = 85;
          break;
        case 'syncing_dossier':
          factualStep = 'Persistindo dados...';
          pct = 90;
          break;
        default:
          pct = Math.max(job.progress_percent || 30, Math.min(95, prog.progressPercent || 50));
      }

      job.current_step = factualStep;
      job.progress_percent = pct;
      job.last_heartbeat_at = new Date().toISOString();
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
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      batch.current_progress_percent = Math.round((batch.processed_items / Math.max(1, batch.total_items)) * 100);
      await dbService.saveMappingBatch(batch);
    }
    return;
  }

  // 3. Complete LP Mapping
  const updatedOffer = await dbService.getOfferById(offer.id);

  // If LP mapping discovered a checkout_url, ensure it is saved on the offer's checkout_url field
  if (result?.checkoutUrl && updatedOffer && (!updatedOffer.checkout_url || updatedOffer.checkout_url.trim() === '')) {
    await dbService.updateOffer(updatedOffer.id, { checkout_url: result.checkoutUrl });
  }

  job.status = result?.hasErrors ? 'PARTIAL' : 'SUCCESS';
  job.progress_percent = 100;
  job.current_step = 'Concluído';
  job.completed_at = new Date().toISOString();
  job.last_heartbeat_at = new Date().toISOString();
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

  if (batch) {
    if (result?.hasErrors) {
      batch.partial_count = (batch.partial_count || 0) + 1;
    } else {
      batch.success_count = (batch.success_count || 0) + 1;
    }
    batch.processed_items = (batch.processed_items || 0) + 1;
    batch.current_progress_percent = Math.round((batch.processed_items / Math.max(1, batch.total_items)) * 100);
    await dbService.saveMappingBatch(batch);
  }
}

/**
 * Executes a single Checkout Intelligence job with factual steps and timeout protection.
 */
async function executeCheckoutJob(batch: MappingBatch | null | undefined, job: MappingJob, workspaceId: string): Promise<void> {
  const offer = await dbService.getOfferById(job.offer_id);
  if (!offer) {
    job.status = 'FAILED';
    job.error_message = 'Oferta não encontrada no banco de dados.';
    job.completed_at = new Date().toISOString();
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      await dbService.saveMappingBatch(batch);
    }
    return;
  }

  // CRITICAL PROTECTION RULE:
  // Only process if real checkout_url exists and is NOT equal to landing_page_url!
  if (!offer.checkout_url || offer.checkout_url.trim() === '') {
    job.status = 'SKIPPED';
    job.error_message = 'Nenhuma URL de checkout cadastrada na oferta.';
    job.completed_at = new Date().toISOString();
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      await dbService.saveMappingBatch(batch);
    }
    return;
  }

  if (offer.landing_page_url && offer.checkout_url.trim() === offer.landing_page_url.trim()) {
    console.warn(`[CHECKOUT JOB ABORTED] Checkout URL matches Landing Page URL for offer ${offer.id}. Skipping.`);
    job.status = 'SKIPPED';
    job.error_message = 'ABORTADO: A URL de checkout é idêntica à URL da Landing Page.';
    job.completed_at = new Date().toISOString();
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      await dbService.saveMappingBatch(batch);
    }
    return;
  }

  job.target_url = offer.checkout_url;
  job.current_step = 'Conectando ao Checkout...';
  job.progress_percent = 30;
  job.last_heartbeat_at = new Date().toISOString();
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
    job.last_heartbeat_at = new Date().toISOString();
    await dbService.saveMappingJob(job);

    if (batch) {
      batch.failed_count = (batch.failed_count || 0) + 1;
      batch.processed_items = (batch.processed_items || 0) + 1;
      await dbService.saveMappingBatch(batch);
    }

    await dbService.updateOffer(offer.id, {
      checkout_mapping_status: 'FAILED',
      checkout_last_error: job.error_message,
    });
    return;
  }

  const isVerified = result?.status === 'verified';
  job.status = isVerified ? 'SUCCESS' : 'PARTIAL';
  job.progress_percent = 100;
  job.current_step = isVerified ? 'Concluído' : 'Checkout analisado com avisos.';
  job.completed_at = new Date().toISOString();
  job.last_heartbeat_at = new Date().toISOString();
  await dbService.saveMappingJob(job);

  await dbService.updateOffer(offer.id, {
    checkout_mapping_status: isVerified ? 'SUCCESS' : 'PARTIAL',
    checkout_mapped_at: new Date().toISOString(),
    checkout_last_error: isVerified ? null : 'Checkout analisado com avisos',
  });
  await dbService.reconcileMappingState(offer);

  if (batch) {
    if (isVerified) {
      batch.success_count = (batch.success_count || 0) + 1;
    } else {
      batch.partial_count = (batch.partial_count || 0) + 1;
    }
    batch.processed_items = (batch.processed_items || 0) + 1;
    batch.current_progress_percent = Math.round((batch.processed_items / Math.max(1, batch.total_items)) * 100);
    await dbService.saveMappingBatch(batch);
  }
}

/**
 * Enqueues or returns an existing active job for a single offer.
 * Enforces idempotency (workspace_id + offer_id + job_type + active_status).
 */
export async function enqueueSingleJob(params: {
  offerId: string;
  type: MappingType;
  workspaceId?: string;
  userId?: string | null;
  client?: any;
}): Promise<{ isNew: boolean; job: MappingJob; batch?: MappingBatch }> {
  const workspaceId = params.workspaceId || 'ws_default_001';
  const now = new Date().toISOString();

  // 1. Idempotency Check: does an active job already exist?
  const existingJob = await dbService.getMappingJobByOfferId(params.offerId, params.type, workspaceId, params.client);
  if (existingJob && (existingJob.status === 'QUEUED' || existingJob.status === 'RUNNING')) {
    console.log(`[ENQUEUE IDEMPOTENCY] Job already active for offer ${params.offerId} (${existingJob.id} - ${existingJob.status})`);
    return { isNew: false, job: existingJob };
  }

  // 2. Fetch offer
  const offer = await dbService.getOfferById(params.offerId);
  if (!offer) {
    throw new Error('Oferta não encontrada para enfileirar mapeamento.');
  }

  // 3. Find or create active running batch
  const batches = await dbService.getMappingBatches(params.client, workspaceId);
  let targetBatch: MappingBatch | undefined = batches.find((b) => b.status === 'RUNNING' && b.type === params.type);

  if (!targetBatch) {
    targetBatch = {
      id: generateId('batch'),
      workspace_id: workspaceId,
      user_id: params.userId || undefined,
      name: `${params.type === 'LANDING_PAGE' ? 'Mapeamento LP' : 'Mapeamento Checkout'}: ${offer.product_name || 'Oferta'}`,
      type: params.type,
      status: 'RUNNING',
      concurrency: MAX_CONCURRENT_WORKERS,
      total_items: 1,
      processed_items: 0,
      success_count: 0,
      partial_count: 0,
      failed_count: 0,
      current_offer_id: offer.id,
      current_offer_name: offer.product_name,
      current_step: 'Aguardando worker...',
      current_progress_percent: 0,
      created_at: now,
      started_at: now,
      completed_at: null,
      updated_at: now,
    };
    await dbService.saveMappingBatch(targetBatch, params.client, workspaceId);
  } else {
    targetBatch.total_items = (targetBatch.total_items || 0) + 1;
    targetBatch.updated_at = now;
    await dbService.saveMappingBatch(targetBatch, params.client, workspaceId);
  }

  // 4. Create new QUEUED job
  const newJob: MappingJob = {
    id: generateId('job'),
    workspace_id: workspaceId,
    user_id: params.userId || undefined,
    batch_id: targetBatch.id,
    offer_id: offer.id,
    offer_name: offer.product_name || 'Oferta Sem Nome',
    advertiser: offer.advertiser || null,
    target_url: params.type === 'LANDING_PAGE' ? (offer.landing_page_url || '') : (offer.checkout_url || ''),
    type: params.type,
    status: 'QUEUED',
    current_step: 'Aguardando worker...',
    progress_percent: 0,
    error_message: null,
    attempts: 0,
    last_heartbeat_at: now,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  await dbService.saveMappingJob(newJob, params.client, workspaceId);

  // Trigger worker loop
  triggerWorkerLoop(workspaceId).catch(() => {});

  return { isNew: true, job: newJob, batch: targetBatch };
}

/**
 * Creates a new Mapping Batch and enqueues jobs for selected offer IDs.
 */
export async function createMappingBatch(
  type: MappingType,
  offerIds: string[],
  customName?: string,
  workspaceId: string = 'ws_default_001',
  userId?: string | null,
  client?: any
): Promise<{ batch: MappingBatch; jobs: MappingJob[] }> {
  const now = new Date().toISOString();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seqStr = Math.floor(100 + Math.random() * 900);
  const batchId = generateId('batch');
  const batchName = customName || `${type === 'LANDING_PAGE' ? 'Lote Landing Pages' : 'Lote Checkouts'} #${dateStr}-${seqStr}`;

  const allOffers = await dbService.getOffers(client, workspaceId);
  const selectedOffers = allOffers.filter((o) => offerIds.includes(o.id));

  // Check for already active jobs to prevent duplicate execution
  const activeJobs = await dbService.getActiveMappingJobs(workspaceId, client);
  const activeOfferIds = new Set(activeJobs.filter((j) => j.type === type).map((j) => j.offer_id));

  const eligibleOffers = selectedOffers.filter((o) => !activeOfferIds.has(o.id));

  const batch: MappingBatch = {
    id: batchId,
    workspace_id: workspaceId,
    user_id: userId || undefined,
    name: batchName,
    type,
    status: 'RUNNING',
    concurrency: MAX_CONCURRENT_WORKERS,
    total_items: eligibleOffers.length,
    processed_items: 0,
    success_count: 0,
    partial_count: 0,
    failed_count: 0,
    current_offer_id: null,
    current_offer_name: null,
    current_step: 'Aguardando worker...',
    current_progress_percent: 0,
    created_at: now,
    started_at: now,
    completed_at: null,
    updated_at: now,
  };

  const jobs: MappingJob[] = eligibleOffers.map((offer) => ({
    id: generateId('job'),
    workspace_id: workspaceId,
    user_id: userId || undefined,
    batch_id: batchId,
    offer_id: offer.id,
    offer_name: offer.product_name || 'Oferta Sem Nome',
    advertiser: offer.advertiser || null,
    target_url: type === 'LANDING_PAGE' ? (offer.landing_page_url || '') : (offer.checkout_url || ''),
    type,
    status: 'QUEUED',
    current_step: 'Aguardando worker...',
    progress_percent: 0,
    error_message: null,
    attempts: 0,
    last_heartbeat_at: now,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  }));

  await dbService.saveMappingBatch(batch, client, workspaceId);
  for (const job of jobs) {
    await dbService.saveMappingJob(job, client, workspaceId);
  }

  // Trigger worker loop
  triggerWorkerLoop(workspaceId).catch(() => {});

  return { batch, jobs };
}

/**
 * Pauses a running batch.
 */
export async function pauseMappingBatch(batchId: string, client?: any): Promise<MappingBatch | null> {
  const batch = await dbService.getMappingBatchById(batchId, client);
  if (!batch) return null;
  batch.status = 'PAUSED';
  batch.current_step = 'Lote pausado pelo usuário.';
  await dbService.saveMappingBatch(batch, client);
  return batch;
}

/**
 * Resumes a paused batch.
 */
export async function resumeMappingBatch(batchId: string, client?: any): Promise<MappingBatch | null> {
  const batch = await dbService.getMappingBatchById(batchId, client);
  if (!batch) return null;
  batch.status = 'RUNNING';
  batch.current_step = 'Retomando processamento do lote...';
  await dbService.saveMappingBatch(batch, client);
  triggerWorkerLoop(batch.workspace_id || 'ws_default_001').catch(() => {});
  return batch;
}

/**
 * Cancels a batch and marks all QUEUED or RUNNING jobs as CANCELLED.
 * Does NOT alter already COMPLETED/SUCCESS jobs.
 */
export async function cancelMappingBatch(batchId: string, client?: any): Promise<MappingBatch | null> {
  const batch = await dbService.getMappingBatchById(batchId, client);
  if (!batch) return null;
  batch.status = 'CANCELLED';
  batch.completed_at = new Date().toISOString();
  batch.current_step = 'Lote cancelado pelo usuário.';
  await dbService.saveMappingBatch(batch, client);

  const jobs = await dbService.getMappingJobs(batchId, batch.workspace_id, client);
  for (const job of jobs) {
    if (job.status === 'QUEUED' || job.status === 'RUNNING') {
      job.status = 'CANCELLED';
      job.completed_at = new Date().toISOString();
      await dbService.saveMappingJob(job, client);
      globalThis.__mappingActiveJobIds?.delete(job.id);
    }
  }

  return batch;
}

/**
 * Creates a new batch or restarts jobs that failed in a previous batch.
 */
export async function reprocessFailedMappingBatch(batchId: string, client?: any): Promise<{ batch: MappingBatch; jobs: MappingJob[] } | null> {
  const oldBatch = await dbService.getMappingBatchById(batchId, client);
  if (!oldBatch) return null;

  const jobs = await dbService.getMappingJobs(batchId, oldBatch.workspace_id, client);
  const failedJobs = jobs.filter((j) => j.status === 'FAILED' || j.status === 'FAILED_TIMEOUT' || j.status === 'PARTIAL' || j.status === 'STALE');

  if (failedJobs.length === 0) return null;

  const failedOfferIds = failedJobs.map((j) => j.offer_id);
  return createMappingBatch(oldBatch.type, failedOfferIds, `Reprocessamento ${oldBatch.name}`, oldBatch.workspace_id || 'ws_default_001', oldBatch.user_id, client);
}

/**
 * Computes live summary statistics for the Mapping Center using canonical getMappingStats.
 */
export async function computeMappingSummary(workspaceId: string = 'ws_default_001', client?: any): Promise<MappingSummary> {
  return getMappingStats(workspaceId, client);
}

