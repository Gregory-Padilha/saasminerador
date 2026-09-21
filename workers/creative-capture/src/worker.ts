import { dbService } from '@/lib/supabase/db';
import { processCreativeCaptureJob } from '@/lib/worker/jobProcessor';

const POLL_INTERVAL_MS = 3000;
let isRunning = true;

async function runWorkerLoop() {
  console.log('====================================================');
  console.log('OFFER MINER — CREATIVE CAPTURE WORKER STARTED');
  console.log('Polling for queued capture jobs...');
  console.log('====================================================');

  while (isRunning) {
    try {
      const job = await dbService.claimNextQueuedJob();
      if (job) {
        console.log(`[JOB CLAIMED] Starting capture job ${job.id} for offer ${job.offer_id}...`);
        const result = await processCreativeCaptureJob(job.id);
        console.log(`[JOB FINISHED] Job ${job.id} status: ${result?.status} (New: ${result?.new_creatives}, Existing: ${result?.existing_creatives})`);
      } else {
        // Sleep before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err) {
      console.error('[WORKER ERROR]:', err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('\nStopping worker gracefully...');
  isRunning = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nWorker received SIGTERM...');
  isRunning = false;
  process.exit(0);
});

runWorkerLoop();
