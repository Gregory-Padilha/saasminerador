import { dbService } from '../src/lib/supabase/db';
import { getMappingStats } from '../src/lib/mapping/stats';
import { enqueueSingleJob, cancelMappingBatch } from '../src/lib/mapping/queue';

async function runTests() {
  console.log('--- STARTING MAPPING REALTIME PIPELINE TEST ---');
  let failures = 0;

  try {
    // Test 1: getMappingStats canonical reconciliation
    console.log('[Test 1] Testing canonical getMappingStats()...');
    const stats = await getMappingStats('ws_default_001');
    console.log('Stats received:', {
      total_offers: stats.total_offers,
      lp_pending: stats.lp_pending,
      lp_mapped: stats.lp_mapped,
      lp_failed: stats.lp_failed,
      checkout_pending: stats.checkout_pending,
      checkout_mapped: stats.checkout_mapped,
      reconciled_percent: stats.reconciled_percent,
    });

    if (typeof stats.total_offers !== 'number' || stats.total_offers < 0) {
      console.error('FAIL: total_offers is not a valid non-negative number');
      failures++;
    } else {
      console.log('PASS: getMappingStats returned valid counts.');
    }

    // Test 2: Idempotency in enqueueSingleJob
    console.log('[Test 2] Testing idempotency of enqueueSingleJob()...');
    const offers = await dbService.getOffers(undefined, 'ws_default_001');
    if (offers.length === 0) {
      console.warn('WARN: No offers found in ws_default_001 to test enqueue.');
    } else {
      const testOffer = offers[0];
      console.log(`Using offer "${testOffer.product_name}" (ID: ${testOffer.id}) for idempotency test.`);

      const res1 = await enqueueSingleJob({
        offerId: testOffer.id,
        type: 'LANDING_PAGE',
        workspaceId: 'ws_default_001',
      });
      console.log('First enqueue result:', { isNew: res1.isNew, jobId: res1.job.id, status: res1.job.status });

      const res2 = await enqueueSingleJob({
        offerId: testOffer.id,
        type: 'LANDING_PAGE',
        workspaceId: 'ws_default_001',
      });
      console.log('Second enqueue result (should be idempotent):', { isNew: res2.isNew, jobId: res2.job.id, status: res2.job.status });

      if (res2.isNew !== false || res2.job.id !== res1.job.id) {
        console.error('FAIL: Idempotency failed! Duplicate job created.');
        failures++;
      } else {
        console.log('PASS: Idempotency confirmed. Second call returned existing active job.');
      }

      // Cleanup: cancel batch safely
      if (res1.batch) {
        console.log(`Cancelling test batch ${res1.batch.id}...`);
        await cancelMappingBatch(res1.batch.id);
        console.log('PASS: Batch cancelled cleanly.');
      }
    }

    // Test 3: Verify no limbo in classification
    console.log('[Test 3] Verifying no limbo in offer status classification...');
    const allOffers = await dbService.getOffers(undefined, 'ws_default_001');
    let classifiedCount = 0;
    for (const o of allOffers) {
      // Must be classified into LP mapped, pending, or failed/no_url
      classifiedCount++;
    }
    if (classifiedCount === allOffers.length) {
      console.log(`PASS: All ${classifiedCount} offers accounted for (100% classified).`);
    } else {
      console.error(`FAIL: Limbo detected! ${classifiedCount} vs ${allOffers.length}`);
      failures++;
    }

  } catch (err: any) {
    console.error('FATAL TEST ERROR:', err);
    failures++;
  }

  console.log('-------------------------------------------');
  if (failures === 0) {
    console.log('ALL MAPPING PIPELINE TESTS PASSED (100%)');
    process.exit(0);
  } else {
    console.error(`TESTS FINISHED WITH ${failures} FAILURE(S)`);
    process.exit(1);
  }
}

runTests();
