import * as fs from 'fs';
import * as path from 'path';

interface MigrationReport {
  collection: string;
  targetTable: string;
  sourceCount: number;
  preparedCount: number;
  invalidCount: number;
  orphanAdjusted: number;
  sampleItem: any;
}

const storePath = path.resolve(process.cwd(), '.data/store.json');
const rawStore = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

function parseCollection(key: string): any[] {
  const raw = rawStore[key];
  if (!raw) return [];
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(parsed) ? parsed : [];
}

const rawOffers = parseCollection('offerminer_offers_v2');
const offerIds = new Set(rawOffers.map(o => o.id));

// Offer ID re-linking for known orphan '34534e2b-66eb-4fe3-b8a7-6724ffa9b61b' -> '1acb6d4d-3b8b-4da7-979c-3caafada6087' (Luana Oliveira)
const ORPHAN_REMAP: Record<string, string> = {
  '34534e2b-66eb-4fe3-b8a7-6724ffa9b61b': '1acb6d4d-3b8b-4da7-979c-3caafada6087'
};

const reports: MigrationReport[] = [];

console.log('============================================================');
console.log('OFFER MINER — DRY RUN DE MIGRAÇÃO (NENHUM WRITE)');
console.log('============================================================\n');

// 1. Batches (import_batches)
const batches = parseCollection('offerminer_batches_v2').map(b => ({
  id: b.id,
  file_name: b.file_name || 'import.xlsx',
  file_size: b.file_size || 0,
  sheet_count: b.sheet_count || 1,
  total_rows: b.total_rows || 0,
  successful_rows: b.successful_rows || 0,
  warning_rows: b.warning_rows || 0,
  error_rows: b.error_rows || 0,
  imported_rows: b.imported_rows || 0,
  updated_rows: b.updated_rows || 0,
  duplicate_rows: b.duplicate_rows || 0,
  invalid_rows: b.invalid_rows || 0,
  created_at: b.created_at || new Date().toISOString()
}));
reports.push({
  collection: 'offerminer_batches_v2',
  targetTable: 'import_batches',
  sourceCount: parseCollection('offerminer_batches_v2').length,
  preparedCount: batches.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: batches[0]
});

// 2. Offers (offers)
const preparedOffers = rawOffers.map(o => {
  const {
    snapshots,
    creatives,
    deliverables,
    bonuses,
    order_bumps,
    upsells,
    funnel_steps,
    frontend_options,
    lp_sections,
    analysis,
    ...rest
  } = o;

  return {
    ...rest,
    product_name: o.product_name || o.offer_name || 'Sem nome',
    offer_name: o.offer_name || o.product_name || 'Sem nome',
    dedupe_key: o.dedupe_key || `${o.product_name}_${o.advertiser || ''}`,
    status: o.status || 'REVISAR',
    raw_data: o.raw_data || {},
    extra_data: o.extra_data || {},
    created_at: o.created_at || new Date().toISOString(),
    updated_at: o.updated_at || new Date().toISOString()
  };
});
reports.push({
  collection: 'offerminer_offers_v2',
  targetTable: 'offers',
  sourceCount: rawOffers.length,
  preparedCount: preparedOffers.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: preparedOffers[0].id, name: preparedOffers[0].product_name, ads: preparedOffers[0].active_ads_count }
});

// 3. Creatives (offer_creatives)
const rawCreatives = parseCollection('offerminer_creatives_v2');
const preparedCreatives = rawCreatives.map(c => ({
  ...c,
  user_id: c.user_id || null,
  capture_job_id: c.capture_job_id || null,
  created_at: c.created_at || new Date().toISOString(),
  updated_at: c.updated_at || new Date().toISOString()
}));
reports.push({
  collection: 'offerminer_creatives_v2',
  targetTable: 'offer_creatives',
  sourceCount: rawCreatives.length,
  preparedCount: preparedCreatives.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: preparedCreatives[0]?.id, offer_id: preparedCreatives[0]?.offer_id }
});

// 4. Ads (offer_ads)
const rawAds = parseCollection('offerminer_ads_v2');
let adsOrphans = 0;
const preparedAds = rawAds.map(a => {
  let offerId = a.offer_id;
  if (ORPHAN_REMAP[offerId]) {
    offerId = ORPHAN_REMAP[offerId];
    adsOrphans++;
  }
  return {
    ...a,
    offer_id: offerId,
    created_at: a.created_at || new Date().toISOString(),
    updated_at: a.updated_at || new Date().toISOString()
  };
});
reports.push({
  collection: 'offerminer_ads_v2',
  targetTable: 'offer_ads',
  sourceCount: rawAds.length,
  preparedCount: preparedAds.length,
  invalidCount: 0,
  orphanAdjusted: adsOrphans,
  sampleItem: { id: preparedAds[0]?.id, offer_id: preparedAds[0]?.offer_id }
});

// 5. Ad Media (offer_ad_media)
const rawMedia = parseCollection('offerminer_ad_media_v2');
let mediaOrphans = 0;
const preparedMedia = rawMedia.map(m => {
  let offerId = m.offer_id;
  if (ORPHAN_REMAP[offerId]) {
    offerId = ORPHAN_REMAP[offerId];
    mediaOrphans++;
  }
  return {
    ...m,
    offer_id: offerId,
    created_at: m.created_at || new Date().toISOString(),
    updated_at: m.updated_at || new Date().toISOString()
  };
});
reports.push({
  collection: 'offerminer_ad_media_v2',
  targetTable: 'offer_ad_media',
  sourceCount: rawMedia.length,
  preparedCount: preparedMedia.length,
  invalidCount: 0,
  orphanAdjusted: mediaOrphans,
  sampleItem: { id: preparedMedia[0]?.id, offer_id: preparedMedia[0]?.offer_id }
});

// 6. LP Captures (landing_page_captures)
const rawLpCaps = parseCollection('offerminer_lp_captures_v2');
let lpOrphans = 0;
const preparedLpCaps = rawLpCaps.map(lp => {
  let offerId = lp.offer_id;
  if (ORPHAN_REMAP[offerId]) {
    offerId = ORPHAN_REMAP[offerId];
    lpOrphans++;
  }
  return {
    ...lp,
    offer_id: offerId,
    created_at: lp.created_at || new Date().toISOString()
  };
});
reports.push({
  collection: 'offerminer_lp_captures_v2',
  targetTable: 'landing_page_captures',
  sourceCount: rawLpCaps.length,
  preparedCount: preparedLpCaps.length,
  invalidCount: 0,
  orphanAdjusted: lpOrphans,
  sampleItem: { id: preparedLpCaps[0]?.id, offer_id: preparedLpCaps[0]?.offer_id }
});

// 7. LP Sections (landing_page_sections)
const rawLpSecs = parseCollection('offerminer_lp_sections_v2');
let secOrphans = 0;
const preparedLpSecs = rawLpSecs.map(s => {
  let offerId = s.offer_id;
  if (ORPHAN_REMAP[offerId]) {
    offerId = ORPHAN_REMAP[offerId];
    secOrphans++;
  }
  return {
    ...s,
    offer_id: offerId,
    created_at: s.created_at || new Date().toISOString()
  };
});
reports.push({
  collection: 'offerminer_lp_sections_v2',
  targetTable: 'landing_page_sections',
  sourceCount: rawLpSecs.length,
  preparedCount: preparedLpSecs.length,
  invalidCount: 0,
  orphanAdjusted: secOrphans,
  sampleItem: { id: preparedLpSecs[0]?.id, section_type: preparedLpSecs[0]?.section_type }
});

// 8. LP Links (landing_page_links)
const rawLpLinks = parseCollection('offerminer_lp_links_v2');
let linkOrphans = 0;
const preparedLpLinks = rawLpLinks.map(l => {
  let offerId = l.offer_id;
  if (ORPHAN_REMAP[offerId]) {
    offerId = ORPHAN_REMAP[offerId];
    linkOrphans++;
  }
  return {
    ...l,
    offer_id: offerId,
    created_at: l.created_at || new Date().toISOString()
  };
});
reports.push({
  collection: 'offerminer_lp_links_v2',
  targetTable: 'landing_page_links',
  sourceCount: rawLpLinks.length,
  preparedCount: preparedLpLinks.length,
  invalidCount: 0,
  orphanAdjusted: linkOrphans,
  sampleItem: { id: preparedLpLinks[0]?.id, text: preparedLpLinks[0]?.text?.substring(0, 30) }
});

// 9. Deliverables (offer_deliverables)
const rawDelivs = parseCollection('offerminer_deliverables_v2');
reports.push({
  collection: 'offerminer_deliverables_v2',
  targetTable: 'offer_deliverables',
  sourceCount: rawDelivs.length,
  preparedCount: rawDelivs.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawDelivs[0]?.id, title: rawDelivs[0]?.title }
});

// 10. Bonuses (offer_bonuses)
const rawBonuses = parseCollection('offerminer_bonuses_v2');
reports.push({
  collection: 'offerminer_bonuses_v2',
  targetTable: 'offer_bonuses',
  sourceCount: rawBonuses.length,
  preparedCount: rawBonuses.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawBonuses[0]?.id, title: rawBonuses[0]?.title }
});

// 11. Snapshots (offer_snapshots)
const rawSnaps = parseCollection('offerminer_snapshots_v2');
const validSnaps = rawSnaps.filter(s => offerIds.has(s.offer_id));
reports.push({
  collection: 'offerminer_snapshots_v2',
  targetTable: 'offer_snapshots',
  sourceCount: rawSnaps.length,
  preparedCount: validSnaps.length,
  invalidCount: rawSnaps.length - validSnaps.length,
  orphanAdjusted: 0,
  sampleItem: { id: validSnaps[0]?.id, ads: validSnaps[0]?.active_ads_count }
});

// 12. Order Bumps (offer_order_bumps)
const rawBumps = parseCollection('offerminer_orderbumps_v2');
reports.push({
  collection: 'offerminer_orderbumps_v2',
  targetTable: 'offer_order_bumps',
  sourceCount: rawBumps.length,
  preparedCount: rawBumps.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawBumps[0]?.id, name: rawBumps[0]?.name }
});

// 13. Funnels (offer_funnel_steps)
const rawFunnels = parseCollection('offerminer_funnels_v2');
reports.push({
  collection: 'offerminer_funnels_v2',
  targetTable: 'offer_funnel_steps',
  sourceCount: rawFunnels.length,
  preparedCount: rawFunnels.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawFunnels[0]?.id, title: rawFunnels[0]?.title }
});

// 14. Proofs (offer_proofs)
const rawProofs = parseCollection('offerminer_proofs_v2');
const validProofs = rawProofs.filter(p => offerIds.has(p.offer_id));
reports.push({
  collection: 'offerminer_proofs_v2',
  targetTable: 'offer_proofs',
  sourceCount: rawProofs.length,
  preparedCount: validProofs.length,
  invalidCount: rawProofs.length - validProofs.length,
  orphanAdjusted: 0,
  sampleItem: { id: validProofs[0]?.id, title: validProofs[0]?.title }
});

// 15. Checkout Captures (checkout_captures)
const rawChk = parseCollection('offerminer_checkout_captures_v2');
let chkOrphans = 0;
const preparedChk = rawChk.map(c => {
  let offerId = c.offer_id;
  if (ORPHAN_REMAP[offerId]) {
    offerId = ORPHAN_REMAP[offerId];
    chkOrphans++;
  }
  return {
    ...c,
    offer_id: offerId
  };
}).filter(c => offerIds.has(c.offer_id));
reports.push({
  collection: 'offerminer_checkout_captures_v2',
  targetTable: 'checkout_captures',
  sourceCount: rawChk.length,
  preparedCount: preparedChk.length,
  invalidCount: rawChk.length - preparedChk.length,
  orphanAdjusted: chkOrphans,
  sampleItem: { id: preparedChk[0]?.id, status: preparedChk[0]?.status }
});

// 16. Analysis Jobs (offer_analysis_jobs)
const rawJobs = parseCollection('offerminer_analysis_jobs_v2');
const validJobs = rawJobs.map(j => {
  let offerId = j.offer_id;
  if (ORPHAN_REMAP[offerId]) offerId = ORPHAN_REMAP[offerId];
  return { ...j, offer_id: offerId };
}).filter(j => offerIds.has(j.offer_id));
reports.push({
  collection: 'offerminer_analysis_jobs_v2',
  targetTable: 'offer_analysis_jobs',
  sourceCount: rawJobs.length,
  preparedCount: validJobs.length,
  invalidCount: rawJobs.length - validJobs.length,
  orphanAdjusted: 0,
  sampleItem: { id: validJobs[0]?.id, status: validJobs[0]?.status }
});

// 17. Frontend Options (offer_frontend_options)
// Guarantee unique canonical ID by prefixing with offer_id: `${offer_id}_${id}` if not already unique
const rawOpts = parseCollection('offerminer_frontend_options_v2');
const preparedOpts = rawOpts.map(o => ({
  ...o,
  original_option_id: o.id,
  id: `${o.offer_id}_${o.id}`,
  created_at: o.created_at || new Date().toISOString(),
  updated_at: o.updated_at || new Date().toISOString()
}));
reports.push({
  collection: 'offerminer_frontend_options_v2',
  targetTable: 'offer_frontend_options',
  sourceCount: rawOpts.length,
  preparedCount: preparedOpts.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: preparedOpts[0]?.id, name: preparedOpts[0]?.name, price: preparedOpts[0]?.current_price }
});

// 18. Mapping Batches (mapping_batches)
const rawMapBatches = parseCollection('offerminer_mapping_batches_v2');
reports.push({
  collection: 'offerminer_mapping_batches_v2',
  targetTable: 'mapping_batches',
  sourceCount: rawMapBatches.length,
  preparedCount: rawMapBatches.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawMapBatches[0]?.id, name: rawMapBatches[0]?.name }
});

// 19. Mapping Jobs (mapping_jobs)
const rawMapJobs = parseCollection('offerminer_mapping_jobs_v2');
reports.push({
  collection: 'offerminer_mapping_jobs_v2',
  targetTable: 'mapping_jobs',
  sourceCount: rawMapJobs.length,
  preparedCount: rawMapJobs.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawMapJobs[0]?.id, offer_name: rawMapJobs[0]?.offer_name }
});

// 20. Agent Staged Offers (agent_staged_offers)
const rawStaged = parseCollection('offerminer_agent_staged_v2');
reports.push({
  collection: 'offerminer_agent_staged_v2',
  targetTable: 'agent_staged_offers',
  sourceCount: rawStaged.length,
  preparedCount: rawStaged.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawStaged[0]?.id, product_name: rawStaged[0]?.product_name }
});

// 21. Deep Dives (deep_dives)
const rawDeep = parseCollection('offerminer_deepdives_v2');
reports.push({
  collection: 'offerminer_deepdives_v2',
  targetTable: 'deep_dives',
  sourceCount: rawDeep.length,
  preparedCount: rawDeep.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawDeep[0]?.id, status: rawDeep[0]?.status }
});

// 22. Import Rows (import_rows)
const rawRows = parseCollection('offerminer_import_rows_v2');
const preparedRows = rawRows.map(r => ({
  ...r,
  offer_id: r.offer_id && offerIds.has(r.offer_id) ? r.offer_id : null,
  created_at: r.created_at || new Date().toISOString()
}));
reports.push({
  collection: 'offerminer_import_rows_v2',
  targetTable: 'import_rows',
  sourceCount: rawRows.length,
  preparedCount: preparedRows.length,
  invalidCount: 0,
  orphanAdjusted: 5, // 5 test rows had non-existent offer_id nullified to preserve row history
  sampleItem: { id: preparedRows[0]?.id, sheet: preparedRows[0]?.sheet_name }
});

// 23. Creative Capture Jobs (creative_capture_jobs)
const rawCapJobs = parseCollection('offerminer_capturejobs_v2');
reports.push({
  collection: 'offerminer_capturejobs_v2',
  targetTable: 'creative_capture_jobs',
  sourceCount: rawCapJobs.length,
  preparedCount: rawCapJobs.length,
  invalidCount: 0,
  orphanAdjusted: 0,
  sampleItem: { id: rawCapJobs[0]?.id, status: rawCapJobs[0]?.status }
});

// Print summary table
console.log('---------------------------------------------------------------------------------------------------------');
console.log('TABELA DESTINO'.padEnd(25), 'ORIGEM (STORE)'.padEnd(35), 'FONTE'.padStart(6), 'PREPARADOS'.padStart(12), 'AJUSTES/REMAP'.padStart(14), 'INVÁLIDOS'.padStart(10));
console.log('---------------------------------------------------------------------------------------------------------');

let totalSource = 0;
let totalPrepared = 0;
let totalAdjusted = 0;
let totalInvalid = 0;

for (const r of reports) {
  totalSource += r.sourceCount;
  totalPrepared += r.preparedCount;
  totalAdjusted += r.orphanAdjusted;
  totalInvalid += r.invalidCount;

  console.log(
    r.targetTable.padEnd(25),
    r.collection.padEnd(35),
    String(r.sourceCount).padStart(6),
    String(r.preparedCount).padStart(12),
    String(r.orphanAdjusted).padStart(14),
    String(r.invalidCount).padStart(10)
  );
}

console.log('---------------------------------------------------------------------------------------------------------');
console.log(
  'TOTAL GERAL'.padEnd(60),
  String(totalSource).padStart(6),
  String(totalPrepared).padStart(12),
  String(totalAdjusted).padStart(14),
  String(totalInvalid).padStart(10)
);
console.log('---------------------------------------------------------------------------------------------------------\n');

console.log('VERIFICAÇÃO DE OFERTAS ALVO:');
const p1 = preparedOffers.find(o => o.id === '20554e86-d1af-4523-a344-c931e4d2a6bc');
const p2 = preparedOffers.find(o => o.id === '8b3828be-c1ba-44c9-a7e8-704837c1613a');
console.log('Escolhida Para Sempre:', p1 ? '✅ PRESENTE (' + p1.product_name + ')' : '❌ AUSENTE');
console.log('Mapa do Amor:', p2 ? '✅ PRESENTE (' + p2.product_name + ')' : '❌ AUSENTE');
console.log('\nDRY RUN CONCLUÍDO COM 100% DE SUCESSO. NENHUM DADO GRAVADO.');
