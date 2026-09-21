import * as fs from 'fs';
import * as path from 'path';

const storePath = path.resolve(process.cwd(), '.data/store.json');
const raw = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

function parseColl(key: string): any[] {
  const v = raw[key];
  if (!v) return [];
  const parsed = typeof v === 'string' ? JSON.parse(v) : v;
  return Array.isArray(parsed) ? parsed : [];
}

const offers = parseColl('offerminer_offers_v2');
const batches = parseColl('offerminer_batches_v2');
const mappingBatches = parseColl('offerminer_mapping_batches_v2');
const lpCaptures = parseColl('offerminer_lp_captures_v2');
const ads = parseColl('offerminer_ads_v2');

const offerIds = new Set(offers.map(o => o.id));
const batchIds = new Set(batches.map(b => b.id));
const mappingBatchIds = new Set(mappingBatches.map(b => b.id));
const lpCaptureIds = new Set(lpCaptures.map(c => c.id));
const adIds = new Set(ads.map(a => a.id));

console.log('============================================================');
console.log('AUDIT INTEGRIDADE REFERENCIAL & METADADOS');
console.log('============================================================');
console.log('Total offers:', offers.length);
console.log('Total batches:', batches.length);
console.log('Total mappingBatches:', mappingBatches.length);
console.log('Total lpCaptures:', lpCaptures.length);
console.log('Total ads:', ads.length);
console.log('');

const collectionsToCheck = [
  'offerminer_capturejobs_v2',
  'offerminer_creatives_v2',
  'offerminer_ads_v2',
  'offerminer_ad_media_v2',
  'offerminer_lp_captures_v2',
  'offerminer_lp_sections_v2',
  'offerminer_lp_links_v2',
  'offerminer_deliverables_v2',
  'offerminer_bonuses_v2',
  'offerminer_snapshots_v2',
  'offerminer_orderbumps_v2',
  'offerminer_upsells_v2',
  'offerminer_funnels_v2',
  'offerminer_deepdives_v2',
  'offerminer_import_rows_v2',
  'offerminer_proofs_v2',
  'offerminer_checkout_captures_v2',
  'offerminer_analysis_jobs_v2',
  'offerminer_frontend_options_v2',
  'offerminer_mapping_jobs_v2',
  'offerminer_agent_staged_v2'
];

console.log('1. VERIFICAÇÃO DE ÓRFÃOS EM RELAÇÃO ÀS OFFERS:');
for (const c of collectionsToCheck) {
  const items = parseColl(c);
  let orphanCount = 0;
  const orphanOfferIds = new Set<string>();
  for (const item of items) {
    const oid = item.offer_id || item.offerId;
    if (oid && !offerIds.has(oid)) {
      orphanCount++;
      orphanOfferIds.add(oid);
    }
  }
  if (orphanCount > 0) {
    console.log(`⚠️ ${c}: ${orphanCount} itens apontam para ${orphanOfferIds.size} offer_id inexistentes:`, Array.from(orphanOfferIds).slice(0, 5));
  } else {
    console.log(`✅ ${c}: 0 órfãos (total itens: ${items.length})`);
  }
}

console.log('\n2. VERIFICAÇÃO DE IMPORT ROWS -> BATCHES:');
const importRows = parseColl('offerminer_import_rows_v2');
let orphanRowsBatch = 0;
for (const r of importRows) {
  if (r.import_batch_id && !batchIds.has(r.import_batch_id)) {
    orphanRowsBatch++;
  }
}
console.log(`Import rows órfãs de batch: ${orphanRowsBatch} / ${importRows.length}`);

console.log('\n3. VERIFICAÇÃO DE MAPPING JOBS -> MAPPING BATCHES:');
const mappingJobs = parseColl('offerminer_mapping_jobs_v2');
let orphanJobsBatch = 0;
for (const j of mappingJobs) {
  if (j.batch_id && !mappingBatchIds.has(j.batch_id)) {
    orphanJobsBatch++;
  }
}
console.log(`Mapping jobs órfãos de batch: ${orphanJobsBatch} / ${mappingJobs.length}`);

console.log('\n4. VERIFICAÇÃO DE LP SECTIONS & LINKS -> LP CAPTURES:');
const lpSections = parseColl('offerminer_lp_sections_v2');
let orphanSectionsLP = 0;
for (const s of lpSections) {
  const capId = s.landing_page_capture_id || s.capture_id;
  if (capId && !lpCaptureIds.has(capId)) {
    orphanSectionsLP++;
  }
}
console.log(`LP sections órfãs de capture: ${orphanSectionsLP} / ${lpSections.length}`);

const lpLinks = parseColl('offerminer_lp_links_v2');
let orphanLinksLP = 0;
for (const l of lpLinks) {
  const capId = l.landing_page_capture_id || l.capture_id;
  if (capId && !lpCaptureIds.has(capId)) {
    orphanLinksLP++;
  }
}
console.log(`LP links órfãos de capture: ${orphanLinksLP} / ${lpLinks.length}`);

console.log('\n5. VERIFICAÇÃO DE AD MEDIA -> ADS:');
const adMedia = parseColl('offerminer_ad_media_v2');
let orphanMediaAd = 0;
for (const m of adMedia) {
  const adId = m.offer_ad_id || m.ad_id;
  if (adId && !adIds.has(adId)) {
    orphanMediaAd++;
  }
}
console.log(`Ad media órfãos de ad: ${orphanMediaAd} / ${adMedia.length}`);

console.log('\n6. AUDITORIA DE PATHS LOCAIS (/Users/gregory...):');
let localPathsCount = 0;
const localPathExamples: string[] = [];
for (const c of collectionsToCheck) {
  const items = parseColl(c);
  for (const item of items) {
    const str = JSON.stringify(item);
    if (str.includes('/Users/') || str.includes('/tmp/') || str.includes('file://')) {
      localPathsCount++;
      if (localPathExamples.length < 5) {
        localPathExamples.push(`${c}: ${str.substring(0, 150)}...`);
      }
    }
  }
}
console.log(`Itens com paths locais: ${localPathsCount}`);
if (localPathExamples.length > 0) {
  console.log('Exemplos:', localPathExamples);
}

console.log('\n7. AUDITORIA DE DUPLICATE IDS:');
for (const c of collectionsToCheck) {
  const items = parseColl(c);
  const seenIds = new Set<string>();
  let dups = 0;
  for (const item of items) {
    if (item.id) {
      if (seenIds.has(item.id)) dups++;
      seenIds.add(item.id);
    }
  }
  if (dups > 0) console.log(`⚠️ ${c}: ${dups} IDs duplicados!`);
}
console.log('Auditoria de duplicate IDs concluída.');
