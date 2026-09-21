import fs from 'fs';
import path from 'path';

interface Offer {
  id: string;
  product_name: string;
  advertiser?: string | null;
  created_at: string;
  source?: string | null;
  source_type?: string | null;
  extra_data?: any;
  [key: string]: any;
}

const dataDir = path.resolve(process.cwd(), '.data');
const storeFile = path.join(dataDir, 'store.json');

export function runCleanup(isDryRun: boolean = true) {
  console.log(`\n============================================================`);
  console.log(`EXECUTING P0 CLEANUP (${isDryRun ? 'DRY RUN' : 'APPLYING CHANGES'})`);
  console.log(`============================================================\n`);

  if (!fs.existsSync(storeFile)) {
    throw new Error(`Store file not found at ${storeFile}`);
  }

  const rawContent = fs.readFileSync(storeFile, 'utf-8');
  const store: Record<string, string> = JSON.parse(rawContent);

  const offers: Offer[] = JSON.parse(store['offerminer_offers_v2'] || '[]');
  console.log(`Initial total offers in catalog: ${offers.length}`);

  const isBadOffer = (o: Offer): { isBad: boolean; reason: string } => {
    const name = (o.product_name || '').trim();
    if (!name || name === 'Oferta Sem Nome' || name === 'Sem nome' || name === '<<Sem Nome>>') {
      return { isBad: true, reason: 'NAMELESS_OR_PLACEHOLDER_FROM_BROKEN_IMPORT' };
    }
    const lower = name.toLowerCase();
    if (lower.includes('test 9') || lower.includes('previamente mapeada')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_TEST_9' };
    }
    if (lower.includes('central mapping') || lower.includes('test 14')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_TEST_14' };
    }
    if (lower.includes('colada diretamente')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_COLADA_DIRETAMENTE' };
    }
    if (lower.includes('checkout test') || lower.includes('test 6')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_TEST_6' };
    }
    if (lower.includes('landing page test') || lower.includes('test 5')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_TEST_5' };
    }
    if (lower.includes('métricas separação test 7') || lower.includes('test 7')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_TEST_7' };
    }
    if (lower.includes('oferta em lote test 2') || lower.includes('test 2 -')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_TEST_2' };
    }
    if (lower.includes('oratória test 1') || lower.includes('test 1 -')) {
      return { isBad: true, reason: 'CONFIRMED_TEST_FIXTURE_TEST_1' };
    }
    if (o.source_type === 'TEST' || (o.extra_data && o.extra_data.is_test)) {
      return { isBad: true, reason: 'FLAGGED_TEST_DATA' };
    }
    return { isBad: false, reason: 'LEGITIMATE' };
  };

  const badOffers: { offer: Offer; reason: string }[] = [];
  const legitimateOffers: Offer[] = [];

  for (const o of offers) {
    const check = isBadOffer(o);
    if (check.isBad) {
      badOffers.push({ offer: o, reason: check.reason });
    } else {
      legitimateOffers.push(o);
    }
  }

  console.log(`Bad offers identified: ${badOffers.length}`);
  console.log(`Legitimate offers identified: ${legitimateOffers.length}`);

  // Mandatory Sanity Checks before any deletion
  const desafioJejum = legitimateOffers.find(
    (o) => o.product_name && o.product_name.includes('Desafio Jejum 5 em 7')
  );
  if (!desafioJejum) {
    throw new Error('FATAL SANITY CHECK FAILED: "Desafio Jejum 5 em 7" was not found in legitimate offers list! Aborting.');
  }

  const badOfferIds = new Set(badOffers.map((b) => b.offer.id));
  const badNamesCount: Record<string, number> = {};
  for (const b of badOffers) {
    const key = b.offer.product_name || '<<SEM NOME / EMPTY>>';
    badNamesCount[key] = (badNamesCount[key] || 0) + 1;
  }

  console.log('\nBreakdown of Bad Offers to delete:');
  for (const [name, count] of Object.entries(badNamesCount)) {
    console.log(`  - "${name}": ${count}`);
  }

  // Audit and clean related tables
  const dependentCleanups: Record<string, number> = {};
  const cleanedStore: Record<string, string> = { ...store };

  // 1. Clean offers
  cleanedStore['offerminer_offers_v2'] = JSON.stringify(legitimateOffers);

  // 2. Clean batches
  const batches = JSON.parse(store['offerminer_batches_v2'] || '[]');
  const badBatchIds = new Set<string>();
  const legitimateBatches = batches.filter((b: any) => {
    const isBadBatch =
      b.id === '59bbf552-850c-4469-a218-146e841e3113' ||
      (b.file_name && (b.file_name.includes('test') || b.file_name.includes('reimport_c')));
    if (isBadBatch) {
      badBatchIds.add(b.id);
      return false;
    }
    return true;
  });
  dependentCleanups['offerminer_batches_v2'] = batches.length - legitimateBatches.length;
  cleanedStore['offerminer_batches_v2'] = JSON.stringify(legitimateBatches);

  // 3. Clean import rows
  const importRows = JSON.parse(store['offerminer_import_rows_v2'] || '[]');
  const legitimateImportRows = importRows.filter((r: any) => {
    if (r.offer_id && badOfferIds.has(r.offer_id)) return false;
    if (r.batch_id && badBatchIds.has(r.batch_id)) return false;
    if (r.raw_data && JSON.stringify(r.raw_data).includes('Test')) return false;
    return true;
  });
  dependentCleanups['offerminer_import_rows_v2'] = importRows.length - legitimateImportRows.length;
  cleanedStore['offerminer_import_rows_v2'] = JSON.stringify(legitimateImportRows);

  // 4. Clean other tables
  const otherKeys = Object.keys(store).filter(
    (k) =>
      k.startsWith('offerminer_') &&
      !['offerminer_offers_v2', 'offerminer_batches_v2', 'offerminer_import_rows_v2'].includes(k)
  );

  for (const k of otherKeys) {
    try {
      const rows = JSON.parse(store[k] || '[]');
      if (Array.isArray(rows)) {
        const cleanedRows = rows.filter(
          (r: any) => !badOfferIds.has(r.offer_id) && !badOfferIds.has(r.id)
        );
        const removedCount = rows.length - cleanedRows.length;
        if (removedCount > 0) {
          dependentCleanups[k] = removedCount;
          cleanedStore[k] = JSON.stringify(cleanedRows);
        }
      }
    } catch {}
  }

  console.log('\nDependent rows cleaned across tables:', JSON.stringify(dependentCleanups, null, 2));

  // Compute Full Scale / High Scale counts before and after
  const countScale = (list: Offer[]) => {
    let fullScale = 0;
    let highScale = 0;
    let scaling = 0;
    let normal = 0;
    for (const o of list) {
      const ads = o.active_ads_count || 0;
      if (ads >= 100) fullScale++;
      else if (ads >= 50) highScale++;
      else if (ads >= 20) scaling++;
      else normal++;
    }
    return { fullScale, highScale, scaling, normal };
  };

  const scaleBefore = countScale(offers);
  const scaleAfter = countScale(legitimateOffers);

  console.log('\nScale breakdown before cleanup:', scaleBefore);
  console.log('Scale breakdown after cleanup:', scaleAfter);

  // Generate audit log artifact
  const auditLog = {
    timestamp: new Date().toISOString(),
    isDryRun,
    summary: {
      totalBefore: offers.length,
      badOffersIdentified: badOffers.length,
      badOffersDeleted: isDryRun ? 0 : badOffers.length,
      legitimateOffersPreserved: legitimateOffers.length,
      legitimateOffersDeleted: 0,
      totalAfter: isDryRun ? offers.length : legitimateOffers.length,
      scaleBefore,
      scaleAfter,
    },
    countsByFixtureName: {
      'Oferta Previamente Mapeada Test 9': {
        before: badNamesCount['Oferta Previamente Mapeada Test 9'] || 0,
        after: 0,
      },
      'Oferta Sem Nome': {
        before: badNamesCount['<<SEM NOME / EMPTY>>'] || 0,
        after: 0,
      },
      'Central Mapping Test': {
        before: Object.entries(badNamesCount)
          .filter(([k]) => k.includes('Central Mapping Test'))
          .reduce((acc, [, v]) => acc + v, 0),
        after: 0,
      },
      'Oferta Colada Diretamente': {
        before: badNamesCount['Oferta Colada Diretamente'] || 0,
        after: 0,
      },
      'Oferta Com Checkout Test 6': {
        before: badNamesCount['Oferta Com Checkout Test 6'] || 0,
        after: 0,
      },
      'Oferta Com Landing Page Test 5': {
        before: badNamesCount['Oferta Com Landing Page Test 5'] || 0,
        after: 0,
      },
      'Other Test Fixtures (Lote Test 2, Métricas Test 7, Oratória Test 1)': {
        before:
          badOffers.length -
          ((badNamesCount['Oferta Previamente Mapeada Test 9'] || 0) +
            (badNamesCount['<<SEM NOME / EMPTY>>'] || 0) +
            Object.entries(badNamesCount)
              .filter(([k]) => k.includes('Central Mapping Test'))
              .reduce((acc, [, v]) => acc + v, 0) +
            (badNamesCount['Oferta Colada Diretamente'] || 0) +
            (badNamesCount['Oferta Com Checkout Test 6'] || 0) +
            (badNamesCount['Oferta Com Landing Page Test 5'] || 0)),
        after: 0,
      },
    },
    deletedOffers: badOffers.map((b) => ({
      id: b.offer.id,
      name: b.offer.product_name || '<<Sem Nome>>',
      advertiser: b.offer.advertiser,
      created_at: b.offer.created_at,
      source: b.offer.source,
      reason: b.reason,
    })),
    deletedDependentRows: dependentCleanups,
    deletedBatchIds: Array.from(badBatchIds),
  };

  const auditFilePath = path.join(dataDir, 'cleanup_bad_offers_2026-09-18.json');
  fs.writeFileSync(auditFilePath, JSON.stringify(auditLog, null, 2), 'utf-8');
  console.log(`\nAudit log written to: ${auditFilePath}`);

  if (!isDryRun) {
    fs.writeFileSync(storeFile, JSON.stringify(cleanedStore, null, 2), 'utf-8');
    console.log(`\nSUCCESS: Store file successfully updated! Cleaned catalog now has exactly ${legitimateOffers.length} legitimate offers.`);
  }

  return auditLog;
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  runCleanup(isDryRun);
}
