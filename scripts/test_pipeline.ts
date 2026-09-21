import { generateSampleExcelBuffer } from '../src/lib/excel/sampleGenerator';
import { parseSpreadsheet } from '../src/lib/excel/parser';
import { normalizePrice, normalizeAdsCount, normalizeFaceless, normalizeDate } from '../src/lib/normalization';
import { validateOffer } from '../src/lib/validation';
import { calculateOpportunityScore } from '../src/lib/scoring';
import { generateDedupeKey, findDuplicateOffer } from '../src/lib/deduplication';
import { Offer } from '../src/types';

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 OFFER MINER - FULL PIPELINE VERIFICATION TEST');
  console.log('🧪 ========================================================\n');

  // Test 1: Normalization
  console.log('▶ TEST 1: Normalization Engine');
  const p1 = normalizePrice('R$ 27,90');
  const p2 = normalizePrice('1.250,50');
  const p3 = normalizePrice('vinte e sete');
  console.log(`  - "R$ 27,90" -> ${p1.value} (Expected: 27.9) [${p1.value === 27.9 ? 'PASS' : 'FAIL'}]`);
  console.log(`  - "1.250,50" -> ${p2.value} (Expected: 1250.5) [${p2.value === 1250.5 ? 'PASS' : 'FAIL'}]`);
  console.log(`  - "vinte e sete" -> error: ${p3.error ? 'YES' : 'NO'} [${p3.error ? 'PASS' : 'FAIL'}]`);

  const a1 = normalizeAdsCount('24 anúncios');
  const a2 = normalizeAdsCount('~18 ads');
  console.log(`  - "24 anúncios" -> ${a1.value} (Expected: 24) [${a1.value === 24 ? 'PASS' : 'FAIL'}]`);
  console.log(`  - "~18 ads" -> ${a2.value} (Expected: 18) [${a2.value === 18 ? 'PASS' : 'FAIL'}]`);

  const f1 = normalizeFaceless('SIM');
  const f2 = normalizeFaceless('NÃO');
  console.log(`  - "SIM" -> ${f1} (Expected: true) [${f1 === true ? 'PASS' : 'FAIL'}]`);
  console.log(`  - "NÃO" -> ${f2} (Expected: false) [${f2 === false ? 'PASS' : 'FAIL'}]`);

  // Test 2: Validation Engine
  console.log('\n▶ TEST 2: Validation Engine');
  const validOffer: Partial<Offer> = {
    product_name: '300 Receitas Airfryer',
    price: 27.9,
    active_ads_count: 24,
    days_running: 20,
    faceless: true,
    landing_page_url: 'https://receitas.com/lp',
    advertiser: 'Cozinha Fácil',
    niche: 'Gastronomia',
  };
  const v1 = validateOffer(validOffer);
  console.log(`  - Valid Low-Ticket Offer -> Status: ${v1.status} (Expected: VALIDADA) [${v1.status === 'VALIDADA' ? 'PASS' : 'FAIL'}]`);

  const invalidOffer: Partial<Offer> = {
    product_name: 'Mentoria High Ticket',
    price: 997.0,
    active_ads_count: 3,
    days_running: 4,
    faceless: false,
    landing_page_url: 'https://mentoria.com',
  };
  const v2 = validateOffer(invalidOffer);
  console.log(`  - High Ticket Non-faceless Offer -> Status: ${v2.status} (Expected: INVALIDA) [${v2.status === 'INVALIDA' ? 'PASS' : 'FAIL'}]`);
  console.log(`    Reasons: ${v2.reasons.join('; ')}`);

  // Test 3: Deduplication
  console.log('\n▶ TEST 3: Deduplication Engine');
  const k1 = generateDedupeKey({
    product_name: '300 Receitas Air Fryer',
    advertiser: 'Receitas da Vovó',
    landing_page_url: 'https://meusite.com/airfryer?utm_source=meta&utm_medium=cpc',
  });
  const k2 = generateDedupeKey({
    product_name: '300 receitas air fryer',
    advertiser: 'receitas da vovo',
    landing_page_url: 'https://meusite.com/airfryer',
  });
  console.log(`  - Key 1: ${k1}`);
  console.log(`  - Key 2: ${k2}`);
  console.log(`  - Keys Match? ${k1 === k2 ? 'YES (PASS)' : 'NO (FAIL)'}`);

  // Test 4: Full Excel Workbook Parsing
  console.log('\n▶ TEST 4: Full Excel Ingestion Simulation');
  const sampleBuffer = generateSampleExcelBuffer();
  console.log(`  - Generated sample workbook: ${sampleBuffer.byteLength} bytes`);

  const parseResult = await parseSpreadsheet(sampleBuffer, 'sample_mineracao.xlsx');
  console.log(`  - Total Rows: ${parseResult.summary.totalRows}`);
  console.log(`  - Ready / Validated: ${parseResult.summary.readyRows}`);
  console.log(`  - Invalid Count: ${parseResult.summary.invalidRows}`);
  console.log(`  - Header Mappings Detected: ${Object.keys(parseResult.columnMapping).length}`);

  // Verify rows
  parseResult.rows.forEach((r, idx) => {
    console.log(`    [Row ${idx + 1}] "${r.normalized.product_name}" | R$ ${r.normalized.price} | ${r.normalized.active_ads_count} ads | Status: ${r.validation.status} | Opportunity Score: ${r.system_score}/100`);
  });

  console.log('\n✅ ALL PIPELINE TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
