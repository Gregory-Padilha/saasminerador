import fs from 'fs';
import path from 'path';

// Force test isolation so real .data/store.json is NEVER modified
process.env.IS_TEST_RUN = 'true';
const TEST_STORE_PATH = path.join(process.cwd(), '.data', 'test_p0_smart_json_store.json');
process.env.TEST_STORE_PATH = TEST_STORE_PATH;

// Initialize clean test store with empty array
if (!fs.existsSync(path.dirname(TEST_STORE_PATH))) {
  fs.mkdirSync(path.dirname(TEST_STORE_PATH), { recursive: true });
}
fs.writeFileSync(TEST_STORE_PATH, JSON.stringify({ offers: [], importBatches: [], importRows: [], snapshots: [] }, null, 2));

import {
  tryStrictJsonParse,
  fixMarkdownEscapes,
  detectTopLevelObjectSequence,
  unwrapMarkdownUrl,
  normalizeProtocolUrl,
  parseLocalizedDate,
  extractMetaAdId,
  smartRepairJson,
} from '../src/lib/import/smart-json-ingestion';
import { OfferImportService } from '../src/lib/import/offer-import-service';
import { dbService } from '../src/lib/supabase/db';

const realUserSnippet = `{
  "pagina": "Kit Kids Escolar",
  "anuncios\\_ativos": "Yes",
  "tipo\\_material": "Lapbook Aprendendo Frações",
  "promessa": "Material pedagógico interativo para ensino de frações",
  "data\\_inicio": "11 de jun de 2026",
  "link\\_destino": "KITKIDSESCOLAR.COM.BR",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=865473736608989](https://www.facebook.com/ads/library/?id=865473736608989)"
},
{
  "pagina": "Clube de Alemão",
  "anuncios\\_ativos": "Yes",
  "tipo\\_material": "Aulas de Alemão Gratuitas",
  "promessa": "Aprenda alemão do zero com aulas gratuitas",
  "data\\_inicio": "18 de jun de 2026",
  "link\\_destino": "clubedealemao.com.br",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=865473736608990](https://www.facebook.com/ads/library/?id=865473736608990)"
},
{
  "pagina": "Bianca Ribeiro",
  "anuncios\\_ativos": "Yes",
  "tipo\\_material": "Pack com +200 Dinâmicas Terapêuticas para CAPS",
  "promessa": "Recursos terapêuticos e dinâmicas para CAPS",
  "data\\_inicio": "13 de ago de 2026",
  "link\\_destino": "biancaribeiro.com.br",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=865473736608991](https://www.facebook.com/ads/library/?id=865473736608991)"
},
{
  "pagina": "Clube da Pedagogia",
  "anuncios\\_ativos": "Yes",
  "tipo\\_material": "Caderno de Consciência Fonológica – 1º e 2º Ano",
  "promessa": "Atividades práticas de consciência fonológica",
  "data\\_inicio": "24 de jul de 2026",
  "link\\_destino": "clubedapedagogia.com.br",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=865473736608992](https://www.facebook.com/ads/library/?id=865473736608992)"
},
{
  "pagina": "Geovanna Santos",
  "anuncios\\_ativos": "Yes",
  "tipo\\_material": "Dinâmicas de Computação para BNCC",
  "promessa": "Dinâmicas alinhadas à BNCC de computação",
  "data\\_inicio": "21 de ago de 2026",
  "link\\_destino": "geovannasantos.com.br",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=865473736608993](https://www.facebook.com/ads/library/?id=865473736608993)"
}`;

async function runTests() {
  console.log('============================================================');
  console.log('OFFER MINER - P0 SMART JSON INGESTION VALIDATION SUITE');
  console.log('============================================================\n');

  const report: Record<string, string> = {};

  // 1. STRICT PARSE INITIAL
  const strictResult = tryStrictJsonParse(realUserSnippet);
  if (!strictResult.success) {
    report['STRICT PARSE'] = 'FAIL EXPECTED';
    console.log('✓ Test 1: Strict parse failed as expected.');
  } else {
    report['STRICT PARSE'] = 'UNEXPECTED PASS';
    console.error('✗ Test 1: Strict parse unexpectedly succeeded!');
  }

  // 2. ESCAPED UNDERSCORES
  const escapeFix = fixMarkdownEscapes(realUserSnippet);
  if (escapeFix.count > 0 && !escapeFix.text.includes('\\_')) {
    report['ESCAPED UNDERSCORES'] = 'PASS';
    console.log(`✓ Test 2: Escaped underscores fixed (${escapeFix.count} occurrences).`);
  } else {
    report['ESCAPED UNDERSCORES'] = 'FAIL';
  }

  // 3. TOP-LEVEL OBJECT SEQUENCE
  const seqDetect = detectTopLevelObjectSequence(escapeFix.text);
  if (seqDetect.isSequence && seqDetect.objectCount === 5) {
    report['TOP-LEVEL OBJECT SEQUENCE'] = 'PASS';
    console.log(`✓ Test 3: Top-level sequence of ${seqDetect.objectCount} objects correctly detected.`);
  } else {
    report['TOP-LEVEL OBJECT SEQUENCE'] = 'FAIL';
  }

  // 4. SMART REPAIR
  const repairResult = smartRepairJson(realUserSnippet);
  if (repairResult.success && repairResult.isRepaired && Array.isArray(repairResult.data) && repairResult.data.length === 5) {
    report['SMART REPAIR'] = 'PASS';
    console.log('✓ Test 4: Smart repair succeeded with 5 parsed objects.');
  } else {
    report['SMART REPAIR'] = 'FAIL';
  }

  // 5. MARKDOWN LINKS
  const mdUrlSample = '[https://www.facebook.com/ads/library/?id=865473736608989](https://www.facebook.com/ads/library/?id=865473736608989)';
  const unwrapped = unwrapMarkdownUrl(mdUrlSample);
  if (unwrapped === 'https://www.facebook.com/ads/library/?id=865473736608989') {
    report['MARKDOWN LINKS'] = 'PASS';
    console.log('✓ Test 5: Markdown URL correctly unwrapped.');
  } else {
    report['MARKDOWN LINKS'] = 'FAIL';
  }

  // 6. PT-BR DATES
  const sampleDate = parseLocalizedDate('11 de jun de 2026');
  if (sampleDate === '2026-06-11') {
    report['PT-BR DATES'] = 'PASS';
    console.log(`✓ Test 6: PT-BR localized date parsed to ${sampleDate}.`);
  } else {
    report['PT-BR DATES'] = 'FAIL';
  }

  // 7. PROCESS JSON PIPELINE (FIRST IMPORT)
  const processResult1 = OfferImportService.processJson(realUserSnippet, []);
  if (processResult1.totalCount === 5) {
    report['OFFERS DETECTED'] = '5';
    console.log('✓ Test 7: Exactly 5 offers detected in preview.');
  } else {
    report['OFFERS DETECTED'] = `${processResult1.totalCount} (EXPECTED 5)`;
  }

  // Verify Offer Names and Advertisers
  const expectedOffers = [
    { offer: 'Lapbook Aprendendo Frações', advertiser: 'Kit Kids Escolar', date: '2026-06-11', lp: 'https://kitkidsescolar.com.br' },
    { offer: 'Aulas de Alemão Gratuitas', advertiser: 'Clube de Alemão', date: '2026-06-18', lp: 'https://clubedealemao.com.br' },
    { offer: 'Pack com +200 Dinâmicas Terapêuticas para CAPS', advertiser: 'Bianca Ribeiro', date: '2026-08-13', lp: 'https://biancaribeiro.com.br' },
    { offer: 'Caderno de Consciência Fonológica – 1º e 2º Ano', advertiser: 'Clube da Pedagogia', date: '2026-07-24', lp: 'https://clubedapedagogia.com.br' },
    { offer: 'Dinâmicas de Computação para BNCC', advertiser: 'Geovanna Santos', date: '2026-08-21', lp: 'https://geovannasantos.com.br' },
  ];

  let nameMappingPass = true;
  let advertiserMappingPass = true;
  let activeAdsCountNullPass = true;
  let adStatusActivePass = true;
  let lpCanonicalizedPass = true;

  processResult1.previewItems.forEach((item, idx) => {
    const exp = expectedOffers[idx];
    if (item.normalized.offer_name !== exp.offer) {
      console.error(`Mismatch offer name #${idx + 1}: got "${item.normalized.offer_name}", expected "${exp.offer}"`);
      nameMappingPass = false;
    }
    if (item.normalized.advertiser !== exp.advertiser) {
      console.error(`Mismatch advertiser #${idx + 1}: got "${item.normalized.advertiser}", expected "${exp.advertiser}"`);
      advertiserMappingPass = false;
    }
    if (item.normalized.active_ads_count !== null) {
      console.error(`Mismatch active_ads_count #${idx + 1}: got ${item.normalized.active_ads_count}, expected null!`);
      activeAdsCountNullPass = false;
    }
    if (item.normalized.extra_data?.source_ad_active !== true) {
      console.error(`Mismatch source_ad_active #${idx + 1}: got ${item.normalized.extra_data?.source_ad_active}`);
      adStatusActivePass = false;
    }
    if (item.normalized.landing_page_url !== exp.lp) {
      console.error(`Mismatch landing page #${idx + 1}: got "${item.normalized.landing_page_url}", expected "${exp.lp}"`);
      lpCanonicalizedPass = false;
    }
  });

  report['OFFER NAME MAPPING'] = nameMappingPass ? 'PASS' : 'FAIL';
  report['ADVERTISER MAPPING'] = advertiserMappingPass ? 'PASS' : 'FAIL';
  report['ACTIVE STATUS VS ACTIVE COUNT'] = activeAdsCountNullPass && adStatusActivePass ? 'PASS' : 'FAIL';
  report['LANDING PAGE CANONICALIZATION'] = lpCanonicalizedPass ? 'PASS' : 'FAIL';

  // 8. PERSIST FIRST IMPORT
  const batch1Result = await OfferImportService.executeImport({
    batchType: 'JSON_PASTE',
    fileName: 'snippet_teste_real.json',
    previewItems: processResult1.previewItems,
    clientImportRequestId: 'req_test_1',
  });

  console.log(`✓ Test 8: First import persisted: ${batch1Result.newOffersCount} new offers.`);

  // 9. DOUBLE CLICK TEST
  const doubleClickResult = await OfferImportService.executeImport({
    batchType: 'JSON_PASTE',
    fileName: 'snippet_teste_real.json',
    previewItems: processResult1.previewItems,
    clientImportRequestId: 'req_test_1',
  });

  if (doubleClickResult.batchId === batch1Result.batchId) {
    report['DOUBLE CLICK PROTECTION'] = 'PASS';
    console.log('✓ Test 9: Double click returned cached batch (1 batch).');
  } else {
    report['DOUBLE CLICK PROTECTION'] = 'FAIL';
  }

  // 10. VERIFY MAPPING INITIALIZATION STATUS
  const savedOffers = await dbService.getOffers();
  let mappingInitPass = true;
  for (const o of savedOffers) {
    if (o.lp_mapping_status !== 'NOT_MAPPED') mappingInitPass = false;
    if (o.checkout_discovery_status !== 'NOT_PROCESSED') mappingInitPass = false;
    if (o.checkout_mapping_status !== 'NOT_MAPPED') mappingInitPass = false;
  }
  report['MAPPING INITIALIZATION'] = mappingInitPass ? 'PASS' : 'FAIL';
  console.log(`✓ Test 10: Mapping initialization checked (${savedOffers.length} offers): ${mappingInitPass ? 'PASS' : 'FAIL'}.`);

  // 11. REIMPORT TEST (IMPORT SAME BLOCK AGAIN)
  const processResult2 = OfferImportService.processJson(realUserSnippet, savedOffers);
  const batch2Result = await OfferImportService.executeImport({
    batchType: 'JSON_PASTE',
    fileName: 'snippet_teste_real.json',
    previewItems: processResult2.previewItems,
    clientImportRequestId: 'req_test_2',
  });

  if (batch2Result.newOffersCount === 0) {
    report['SECOND IMPORT NEW RECORDS'] = '0';
    report['DUPLICATE PROTECTION'] = 'PASS';
    console.log(`✓ Test 11: Reimport created 0 new offers (${batch2Result.ignoredDuplicatesCount} duplicates ignored).`);
  } else {
    report['SECOND IMPORT NEW RECORDS'] = `${batch2Result.newOffersCount} (FAILED)`;
    report['DUPLICATE PROTECTION'] = 'FAIL';
  }

  // Cleanup test store
  try {
    if (fs.existsSync(TEST_STORE_PATH)) {
      fs.unlinkSync(TEST_STORE_PATH);
    }
  } catch {
    // ignore
  }

  console.log('\n============================================================');
  console.log('FINAL EXECUTION REPORT:');
  console.log('============================================================');
  for (const [k, v] of Object.entries(report)) {
    console.log(`${k}: ${v}`);
  }
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
