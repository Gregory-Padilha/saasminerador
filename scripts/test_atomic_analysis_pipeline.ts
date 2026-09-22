// ==============================================================================
// TEST: ATOMIC OFFER ANALYSIS PIPELINE & STALENESS WATCHDOG
// ==============================================================================

import { dbService } from '../src/lib/supabase/db';
import { executeAtomicStep } from '../src/lib/offer/atomic-analysis-runner';
import { validateMetaAdsLibraryUrl } from '../src/lib/meta-ads/url-utils';

async function runPipelineTests() {
  console.log('============================================================');
  console.log('RUNNING OFFER MINER ANALYSIS PIPELINE VALIDATION');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (desc: string, condition: boolean) => {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  };

  // TEST 1: URL Validation
  console.log('--- TEST 1: Meta Ads URL Validation ---');
  const validUrl = 'https://www.facebook.com/ads/library/?id=123456789012345';
  const invalidUrl = 'https://google.com/search?q=test';
  assert('Valid Meta Ads Library URL is accepted', validateMetaAdsLibraryUrl(validUrl).isValid);
  assert('Non-Meta URL is rejected', !validateMetaAdsLibraryUrl(invalidUrl).isValid);

  // TEST 2: Immediate Offer Creation at T+0
  console.log('\n--- TEST 2: Canonical Offer Creation (T+0) ---');
  const testMetaUrl = 'https://www.facebook.com/ads/library/?id=999888777&q=Curso+de+Produtividade';
  const testOffer = await dbService.saveOffer({
    workspace_id: 'ws_default_001',
    product_name: 'Analisando Anúncios (Meta Ads)...',
    advertiser: 'Identificando Anunciante...',
    meta_ads_url: testMetaUrl,
    status: 'ANALYZING',
    source: 'MANUAL_META_URL',
    lp_mapping_status: 'NOT_MAPPED',
    checkout_mapping_status: 'NOT_MAPPED',
  });

  assert('Offer created immediately with status ANALYZING', testOffer.status === 'ANALYZING');
  assert('Offer has workspace_id ws_default_001', testOffer.workspace_id === 'ws_default_001');

  // TEST 3: Job Creation with Heartbeat & Step Tracking
  console.log('\n--- TEST 3: Analysis Job Persistence ---');
  const testJob = await dbService.createAnalysisJob({
    workspace_id: 'ws_default_001',
    offer_id: testOffer.id,
    input_url: testMetaUrl,
    status: 'running',
    current_step: 'RESOLVE_META',
    progress_percent: 10,
    attempt: 1,
    max_attempts: 3,
  });

  assert('Job created with status running', testJob.status === 'running');
  assert('Job initial step is RESOLVE_META', testJob.current_step === 'RESOLVE_META');
  assert('Job initial progress is 10%', testJob.progress_percent === 10);
  assert('Job has recent heartbeat', Boolean(testJob.last_heartbeat_at));

  // TEST 4: Execute Atomic Steps Sequentially
  console.log('\n--- TEST 4: Step-by-Step Atomic Runner Execution ---');
  let currentJobId = testJob.id;
  let stepsRun = 0;
  let isDone = false;

  while (!isDone && stepsRun < 10) {
    const stepResult = await executeAtomicStep(currentJobId);
    stepsRun++;
    console.log(
      `  Step ${stepsRun}: ${stepResult.stepExecuted} -> Next: ${stepResult.nextStep} (${stepResult.progressPercent}%) - ${stepResult.message.slice(0, 60)}`
    );

    if (stepResult.isCompleted || stepResult.nextStep === 'COMPLETED') {
      isDone = true;
    }
  }

  const finalJob = await dbService.getAnalysisJob(currentJobId);
  const finalOffer = await dbService.getOfferById(testOffer.id);

  assert('Pipeline completed all atomic steps in finite iterations', isDone);
  assert('Final job status is completed', finalJob?.status === 'completed');
  assert('Final job progress percent is 100', finalJob?.progress_percent === 100);
  assert(
    'Final offer status is valid (MAPEADA or DADOS_PARCIAIS)',
    finalOffer?.status === 'MAPEADA' || finalOffer?.status === 'DADOS_PARCIAIS'
  );
  assert('Offer preserves active_ads_count invariant', (finalOffer?.active_ads_count ?? 0) >= 1);

  // TEST 5: Staleness Watchdog (5-minute limit)
  console.log('\n--- TEST 5: Staleness Watchdog Auto-Recovery ---');
  const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const staleJob = await dbService.createAnalysisJob({
    workspace_id: 'ws_default_001',
    offer_id: testOffer.id,
    input_url: testMetaUrl,
    status: 'running',
    current_step: 'MAP_LANDING_PAGE',
    progress_percent: 40,
    started_at: sixMinutesAgo,
  });

  // Manually backdate heartbeat to 6 minutes ago
  await dbService.updateAnalysisJob(staleJob.id, {
    last_heartbeat_at: sixMinutesAgo,
    updated_at: sixMinutesAgo,
  });

  // getAnalysisJobs runs staleness detection
  const allJobs = await dbService.getAnalysisJobs();
  const recoveredJob = allJobs.find((j) => j.id === staleJob.id);

  assert('Stale job is automatically detected as stale', recoveredJob?.status === 'stale');
  assert(
    'Stale job is NOT counted as running in healthy filter',
    !allJobs.some(
      (j) =>
        j.id === staleJob.id &&
        (j.status === 'running' || j.status === 'queued') &&
        Date.now() - new Date(j.last_heartbeat_at!).getTime() < 300_000
    )
  );

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPipelineTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
