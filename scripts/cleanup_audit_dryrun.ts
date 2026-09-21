// ==============================================================================
// OFFER MINER - SAFE CLEANUP & AUDIT DRY RUN SCRIPT
// ==============================================================================

import fs from 'fs';
import path from 'path';

interface OfferCandidate {
  id: string;
  name: string;
  advertiser?: string | null;
  created_at: string;
  source_file_name?: string | null;
  batch_id?: string | null;
  dedupe_key?: string | null;
  category: 'CONFIRMED_TEST_FIXTURE' | 'CONFIRMED_DUPLICATE_FROM_JSON_BATCH' | 'INVALID_JSON_IMPORT' | 'POSSIBLE_DUPLICATE' | 'LEGITIMATE_OFFER';
  reason: string;
  safe_to_delete: boolean;
  canonical_offer_id?: string | null;
  related_records: {
    snapshots: number;
    import_rows: number;
    other: number;
  };
}

export async function runCleanupAudit(executeDelete: boolean = false) {
  const storePath = path.resolve('.data/store.json');
  if (!fs.existsSync(storePath)) {
    console.error('Store file not found at:', storePath);
    return;
  }

  const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  const offersRaw: any[] = store['offerminer_offers_v2'] ? JSON.parse(store['offerminer_offers_v2']) : [];
  const snapshotsRaw: any[] = store['offerminer_snapshots_v2'] ? JSON.parse(store['offerminer_snapshots_v2']) : [];
  const rowsRaw: any[] = store['offerminer_import_rows_v2'] ? JSON.parse(store['offerminer_import_rows_v2']) : [];

  const candidates: OfferCandidate[] = [];

  const userProblemBatchId = '59bbf552-850c-4469-a218-146e841e3113';

  // Test signatures
  const isTestFixture = (o: any) => {
    const id = (o.id || '').toLowerCase();
    const name = (o.product_name || '').toLowerCase();
    const adv = (o.advertiser || '').toLowerCase();
    const file = (o.source_file_name || '').toLowerCase();

    if (id.startsWith('offer_mapped_test') || id.startsWith('test_') || id.includes('test_9')) {
      return { isTest: true, reason: 'ID prefix test artifact (offer_mapped_test_* / test_*)' };
    }
    if (name.includes('test') || name.includes('teste')) {
      return { isTest: true, reason: `Nome contém marcador explícito de teste: "${o.product_name}"` };
    }
    if (name.includes('oferta colada diretamente')) {
      return { isTest: true, reason: `Fixture de teste de colagem: "${o.product_name}"` };
    }
    if (adv === 'mapeador master' || adv === 'anunciante teste' || adv.startsWith('anunciante ')) {
      return { isTest: true, reason: `Anunciante de teste: "${o.advertiser}"` };
    }
    if (file === 'update_mapped.json' || file === 'batch_10.json' || file === 'single_offer.json') {
      return { isTest: true, reason: `Arquivo de fixture de testes: "${o.source_file_name}"` };
    }
    return { isTest: false, reason: '' };
  };

  for (const o of offersRaw) {
    const snapsCount = snapshotsRaw.filter((s) => s.offer_id === o.id).length;
    const rowsCount = rowsRaw.filter((r) => r.offer_id === o.id).length;

    const testCheck = isTestFixture(o);
    if (testCheck.isTest) {
      candidates.push({
        id: o.id,
        name: o.product_name || '<<NO NAME>>',
        advertiser: o.advertiser,
        created_at: o.created_at,
        source_file_name: o.source_file_name,
        batch_id: o.source_import_batch_id,
        dedupe_key: o.dedupe_key,
        category: 'CONFIRMED_TEST_FIXTURE',
        reason: testCheck.reason,
        safe_to_delete: true,
        related_records: {
          snapshots: snapsCount,
          import_rows: rowsCount,
          other: 0,
        },
      });
      continue;
    }

    if (o.source_import_batch_id === userProblemBatchId) {
      if (!o.product_name || o.product_name.trim() === '') {
        candidates.push({
          id: o.id,
          name: o.product_name || '<<NO NAME / OFERTA SEM NOME>>',
          advertiser: o.advertiser,
          created_at: o.created_at,
          source_file_name: o.source_file_name,
          batch_id: o.source_import_batch_id,
          dedupe_key: o.dedupe_key,
          category: 'INVALID_JSON_IMPORT',
          reason: 'Importação JSON incompleta: sem nome de oferta e sem anunciante (UI exibiu Oferta Sem Nome)',
          safe_to_delete: true,
          related_records: {
            snapshots: snapsCount,
            import_rows: rowsCount,
            other: 0,
          },
        });
        continue;
      }
    }

    // Otherwise legitimate offer
    candidates.push({
      id: o.id,
      name: o.product_name || '<<NO NAME>>',
      advertiser: o.advertiser,
      created_at: o.created_at,
      source_file_name: o.source_file_name,
      batch_id: o.source_import_batch_id,
      dedupe_key: o.dedupe_key,
      category: 'LEGITIMATE_OFFER',
      reason: 'Oferta legítima do catálogo de mineração',
      safe_to_delete: false,
      related_records: {
        snapshots: snapsCount,
        import_rows: rowsCount,
        other: 0,
      },
    });
  }

  const confirmedFixtures = candidates.filter((c) => c.category === 'CONFIRMED_TEST_FIXTURE');
  const invalidImports = candidates.filter((c) => c.category === 'INVALID_JSON_IMPORT');
  const confirmedDuplicates = candidates.filter((c) => c.category === 'CONFIRMED_DUPLICATE_FROM_JSON_BATCH');
  const possibleDuplicates = candidates.filter((c) => c.category === 'POSSIBLE_DUPLICATE');
  const legitimateOffers = candidates.filter((c) => c.category === 'LEGITIMATE_OFFER');

  console.log('============================================================');
  console.log('OFFER MINER — SAFE CLEANUP AUDIT DRY RUN REPORT');
  console.log('============================================================\n');
  console.log(`Total Records Audited: ${offersRaw.length}`);
  console.log(`- Confirmed test fixtures: ${confirmedFixtures.length}`);
  console.log(`- Confirmed JSON duplicates: ${confirmedDuplicates.length}`);
  console.log(`- Invalid imports: ${invalidImports.length}`);
  console.log(`- Possible duplicates: ${possibleDuplicates.length}`);
  console.log(`- Legitimate offers preserved: ${legitimateOffers.length}`);
  console.log('------------------------------------------------------------\n');

  // Save detailed audit JSON report to .data/
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditFilePath = path.resolve(`.data/cleanup_audit_${timestamp}.json`);

  const auditData = {
    executed_at: new Date().toISOString(),
    mode: executeDelete ? 'EXECUTE_DELETE' : 'DRY_RUN',
    summary: {
      total_audited: offersRaw.length,
      confirmed_test_fixtures: confirmedFixtures.length,
      confirmed_json_duplicates: confirmedDuplicates.length,
      invalid_json_imports: invalidImports.length,
      possible_duplicates: possibleDuplicates.length,
      legitimate_offers_preserved: legitimateOffers.length,
      to_delete_count: confirmedFixtures.length + invalidImports.length + confirmedDuplicates.length,
    },
    fixtures_to_delete: confirmedFixtures,
    invalid_imports_to_delete: invalidImports,
    preserved_offers: legitimateOffers.map((o) => ({
      id: o.id,
      name: o.name,
      advertiser: o.advertiser,
      created_at: o.created_at,
    })),
  };

  fs.writeFileSync(auditFilePath, JSON.stringify(auditData, null, 2), 'utf-8');
  console.log(`📄 Audit report saved to: ${auditFilePath}\n`);

  if (!executeDelete) {
    console.log('ℹ️ DRY RUN ONLY: No records were deleted. Run with --execute to perform safe cleanup.');
    return auditData;
  }

  // EXECUTE DELETE IF REQUESTED
  console.log('⚠️ EXECUTING SAFE CLEANUP...');
  const idsToDelete = new Set([
    ...confirmedFixtures.map((c) => c.id),
    ...invalidImports.map((c) => c.id),
    ...confirmedDuplicates.map((c) => c.id),
  ]);

  const preservedOffersList = offersRaw.filter((o) => !idsToDelete.has(o.id));
  const preservedSnapshotsList = snapshotsRaw.filter((s) => !idsToDelete.has(s.offer_id));
  const preservedRowsList = rowsRaw.filter((r) => !idsToDelete.has(r.offer_id));

  store['offerminer_offers_v2'] = JSON.stringify(preservedOffersList);
  store['offerminer_snapshots_v2'] = JSON.stringify(preservedSnapshotsList);
  store['offerminer_import_rows_v2'] = JSON.stringify(preservedRowsList);

  // Also remove the corrupted user batch record if desired, or keep for audit
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');

  console.log(`✅ Safe cleanup complete!`);
  console.log(`- Deleted: ${idsToDelete.size} records`);
  console.log(`- Preserved: ${preservedOffersList.length} legitimate offers`);

  return auditData;
}

if (require.main === module) {
  const isExecute = process.argv.includes('--execute');
  runCleanupAudit(isExecute).catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
}
