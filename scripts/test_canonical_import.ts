// ==============================================================================
// TEST: CANONICAL OFFER IMPORT PIPELINE, DEDUPE, AND DATABASE READ-BACK
// ==============================================================================

import { dbService } from '../src/lib/supabase/db';
import { OfferImportService } from '../src/lib/import/offer-import-service';
import { DEFAULT_VALIDATION_SETTINGS } from '../src/lib/validation';
import { Offer } from '../src/types';

async function runImportTests() {
  console.log('============================================================');
  console.log('STARTING CANONICAL IMPORT PIPELINE VERIFICATION');
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

  const timestamp = Date.now();
  const testOfferName = `IMPORT_TEST_CANONICAL_${timestamp}`;
  const testLpUrl = `https://example.com/import-test-${timestamp}`;

  // 1. Initial State Check
  console.log('--- TEST 1: Initial Catalog State ---');
  const initialOffers = await dbService.getOffers();
  console.log(`Initial offers in store: ${initialOffers.length}`);
  const existingTestMatch = initialOffers.find((o) => o.product_name === testOfferName);
  assert('Test offer does not pre-exist in catalog', !existingTestMatch);

  // 2. Parsing & Validation
  console.log('\n--- TEST 2: Parsing & Validation of Canonical Offer ---');
  const singleJsonPayload = JSON.stringify([
    {
      offer_name: testOfferName,
      advertiser: 'Import QA Automated',
      niche: 'Negócios Digitais',
      subniche: 'Marketing',
      landing_page_url: testLpUrl,
      active_ads_count: 7,
      unique_creatives_count: 5,
      front_price: 47.9,
      faceless: true,
    },
  ]);

  const parseResult = OfferImportService.processJson(
    singleJsonPayload,
    initialOffers,
    DEFAULT_VALIDATION_SETTINGS
  );

  assert('JSON parsed successfully', parseResult.success);
  assert('Total items identified: 1', parseResult.totalCount === 1);
  assert('Valid items count: 1', parseResult.validCount === 1);
  assert('Item dedupeStatus is NEW', parseResult.previewItems[0].dedupeStatus === 'NEW');
  assert('active_ads_count (7) != unique_creatives_count (5)', parseResult.previewItems[0].normalized.active_ads_count !== parseResult.previewItems[0].normalized.unique_creatives_count);

  // 3. RLS Security Hardening: Unauthenticated Anon Client Rejection
  console.log('\n--- TEST 3: RLS Security Hardening - Rejection of Anon Inserts ---');
  let anonRejected = false;
  try {
    // Calling executeImportBatch with the anon client must throw IMPORT_DB_FAILED
    await dbService.executeImportBatch(
      'teste_anon.json',
      [
        {
          tempId: 'temp_anon',
          rowIndex: 1,
          raw: {},
          normalized: {
            product_name: 'TEST ANON OFFER',
            advertiser: 'Anon Tester',
          } as Partial<Offer>,
          validation: { isValid: true, status: 'VALIDADA', reasons: [], warnings: [] },
          hasErrors: false,
          errors: [],
        },
      ],
      1,
      { workspace_id: 'ws_default_001' }
    );
  } catch (err: any) {
    anonRejected = true;
    console.log('Expected RLS rejection caught:', err.message);
    assert('Unauthenticated/anon insert threw IMPORT_DB_FAILED error', err.message.includes('IMPORT_DB_FAILED'));
  }
  assert('Anon client is strictly prevented from inserting and cannot fake success', anonRejected);

  // 4. Authenticated / Workspace-Scoped Pipeline Execution
  console.log('\n--- TEST 4: Authorized Workspace Pipeline & Read-Back ---');
  // Create a mock authenticated client that verifies workspace_id and read-back
  const inMemoryWorkspaceOffers: any[] = [];
  const inMemoryBatches: any[] = [];

  const mockAuthClient: any = {
    from: (table: string) => ({
      insert: async (rows: any | any[]) => {
        const rowArray = Array.isArray(rows) ? rows : [rows];
        for (const r of rowArray) {
          if (!r.workspace_id) {
            return { error: { code: '23502', message: `null value in column "workspace_id" of relation "${table}"` } };
          }
          if (table === 'offers') inMemoryWorkspaceOffers.push(r);
          if (table === 'import_batches') inMemoryBatches.push(r);
        }
        return { data: rowArray, error: null };
      },
      update: (changes: any) => ({
        eq: (col1: string, val1: any) => ({
          eq: (col2: string, val2: any) => {
            const item = inMemoryWorkspaceOffers.find((o) => o[col1] === val1 && o[col2] === val2);
            if (item) Object.assign(item, changes);
            return Promise.resolve({ data: item, error: null });
          },
        }),
      }),
      select: () => ({
        in: (col: string, vals: any[]) => ({
          eq: (wsCol: string, wsVal: any) => {
            const matches = inMemoryWorkspaceOffers.filter((o) => vals.includes(o[col]) && o[wsCol] === wsVal);
            return Promise.resolve({ data: matches, error: null });
          },
        }),
      }),
    }),
  };

  const importResult = await OfferImportService.executeImport({
    batchType: 'JSON_PASTE',
    fileName: 'teste_autorizado.json',
    previewItems: parseResult.previewItems,
    existingOffers: initialOffers,
    workspaceId: 'ws_default_001',
    userId: 'user_owner_001',
    client: mockAuthClient,
  });

  console.log('Authorized import result:', {
    batchId: importResult.batchId,
    newOffersCount: importResult.newOffersCount,
    updatedOffersCount: importResult.updatedOffersCount,
    ignoredDuplicatesCount: importResult.ignoredDuplicatesCount,
    persistedOfferIds: importResult.persistedOfferIds?.length,
  });

  assert('newOffersCount is 1', importResult.newOffersCount === 1);
  assert('persistedOfferIds contains 1 ID', importResult.persistedOfferIds?.length === 1);
  assert('Batch was recorded with workspace_id ws_default_001', inMemoryBatches[0]?.workspace_id === 'ws_default_001');

  const persistedId = importResult.persistedOfferIds![0];
  const foundOffer = inMemoryWorkspaceOffers.find((o) => o.id === persistedId);

  assert('Newly imported offer exists in mock store by ID', Boolean(foundOffer));
  assert('Offer has workspace_id ws_default_001', foundOffer?.workspace_id === 'ws_default_001');
  assert('Offer has correct product_name', foundOffer?.product_name === testOfferName);
  assert('Offer has active_ads_count = 7', foundOffer?.active_ads_count === 7);
  assert('Offer has unique_creatives_count = 5', foundOffer?.unique_creatives_count === 5);
  assert('Offer starts with lp_mapping_status NOT_MAPPED', foundOffer?.lp_mapping_status === 'NOT_MAPPED');
  assert('Offer starts with checkout_discovery_status NOT_PROCESSED', foundOffer?.checkout_discovery_status === 'NOT_PROCESSED');
  assert('Offer starts with checkout_mapping_status NOT_MAPPED', foundOffer?.checkout_mapping_status === 'NOT_MAPPED');

  // 5. Duplicate Re-import Prevention
  console.log('\n--- TEST 5: Duplicate Re-import Prevention ---');
  const catalogWithNew = [...initialOffers, foundOffer];
  const reimportParse = OfferImportService.processJson(
    singleJsonPayload,
    catalogWithNew,
    DEFAULT_VALIDATION_SETTINGS
  );

  assert('Re-imported item detected as EXISTING duplicate', reimportParse.previewItems[0].dedupeStatus === 'EXISTING');
  assert('Duplicate count is 1', reimportParse.duplicateCount === 1);
  assert('Valid NEW count is 0', reimportParse.validCount === 0);

  const reimportExec = await OfferImportService.executeImport({
    batchType: 'JSON_PASTE',
    fileName: 'teste_reimport.json',
    previewItems: reimportParse.previewItems,
    existingOffers: catalogWithNew,
    workspaceId: 'ws_default_001',
    userId: 'user_owner_001',
    client: mockAuthClient,
  });

  assert('Re-import result has newOffersCount === 0', reimportExec.newOffersCount === 0);
  assert('Re-import result has ignoredDuplicatesCount === 1', reimportExec.ignoredDuplicatesCount === 1);

  // 6. Mixed Batch (2 NEW, 1 DUPLICATE, 1 INVALID)
  console.log('\n--- TEST 6: Mixed Batch Processing ---');
  const mixedPayload = JSON.stringify([
    {
      offer_name: `MIXED_NEW_1_${timestamp}`,
      advertiser: 'Advertiser 1',
      landing_page_url: `https://example.com/mixed-1-${timestamp}`,
      active_ads_count: 10,
      faceless: true,
    },
    {
      offer_name: `MIXED_NEW_2_${timestamp}`,
      advertiser: 'Advertiser 2',
      landing_page_url: `https://example.com/mixed-2-${timestamp}`,
      active_ads_count: 15,
      faceless: true,
    },
    {
      offer_name: testOfferName, // Duplicate of existing
      advertiser: 'Import QA Automated',
      landing_page_url: testLpUrl,
      active_ads_count: 7,
      faceless: true,
    },
    {
      offer_name: '   ', // Invalid: empty identity
      advertiser: '',
      active_ads_count: 0,
    },
  ]);

  const mixedParse = OfferImportService.processJson(
    mixedPayload,
    catalogWithNew,
    DEFAULT_VALIDATION_SETTINGS
  );

  const mixedExec = await OfferImportService.executeImport({
    batchType: 'JSON_PASTE',
    fileName: 'mixed_test.json',
    previewItems: mixedParse.previewItems,
    existingOffers: catalogWithNew,
    workspaceId: 'ws_default_001',
    userId: 'user_owner_001',
    client: mockAuthClient,
  });

  console.log('Mixed batch execution:', {
    newOffersCount: mixedExec.newOffersCount,
    ignoredDuplicatesCount: mixedExec.ignoredDuplicatesCount,
    invalidCount: mixedExec.invalidCount,
  });

  assert('Mixed batch inserted exactly 2 new offers', mixedExec.newOffersCount === 2);
  assert('Mixed batch ignored exactly 1 duplicate', mixedExec.ignoredDuplicatesCount === 1);
  assert('Mixed batch rejected exactly 1 invalid offer', mixedExec.invalidCount === 1);

  console.log('\n============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runImportTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
