import * as fs from 'fs';
import * as path from 'path';

function sqlEscape(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function sqlDate(val: any): string {
  if (!val) return 'NULL';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'NULL';
  return `'${d.toISOString()}'::timestamptz`;
}

function sqlDateOnly(val: any): string {
  if (!val) return 'NULL';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return `'${val.trim()}'::date`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'NULL';
  return `'${d.toISOString().substring(0, 10)}'::date`;
}

function main() {
  const storePath = path.resolve(process.cwd(), '.data/store.json');
  if (!fs.existsSync(storePath)) {
    console.error('store.json not found');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  function parseColl(key: string): any[] {
    const v = raw[key];
    if (!v) return [];
    const parsed = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  }

  const offers = parseColl('offerminer_offers_v2');
  const batches = parseColl('offerminer_batches_v2');
  const creatives = parseColl('offerminer_creatives_v2');
  const ads = parseColl('offerminer_ads_v2');
  const lpCaptures = parseColl('offerminer_lp_captures_v2');
  const checkoutCaptures = parseColl('offerminer_checkout_captures_v2');
  const deepDives = parseColl('offerminer_deepdives_v2');

  const lines: string[] = [];
  lines.push('-- ==============================================================================');
  lines.push('-- OFFER MINER - CANONICAL DATA SEED (STORE -> SUPABASE CLOUD)');
  lines.push('-- ==============================================================================');
  lines.push('-- This script populates the 97 offers and essential related entities');
  lines.push('-- directly into Supabase Cloud under the default workspace.');
  lines.push('');
  lines.push('-- 1. ENSURE DEFAULT WORKSPACE EXISTS');
  lines.push(`INSERT INTO public.workspaces (id, name, slug) VALUES ('ws_default_001', 'Workspace Principal', 'principal') ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  // 2. Batches
  lines.push('-- 2. IMPORT BATCHES');
  for (const b of batches) {
    lines.push(
      `INSERT INTO public.import_batches (id, workspace_id, file_name, file_size, sheet_count, total_rows, successful_rows, warning_rows, error_rows, imported_rows, updated_rows, duplicate_rows, invalid_rows, created_at) VALUES (` +
      `${sqlEscape(b.id)}, 'ws_default_001', ${sqlEscape(b.file_name || 'import.xlsx')}, ${b.file_size || 0}, 1, ${b.total_rows || 0}, ${b.successful_rows || 0}, 0, 0, ${b.imported_rows || 0}, 0, 0, 0, ${sqlDate(b.created_at)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  lines.push('');

  // 3. Offers
  lines.push('-- 3. OFFERS (97 Canonical Records)');
  for (const o of offers) {
    const prodName = o.product_name || o.offer_name || 'Sem nome';
    const offName = o.offer_name || o.product_name || 'Sem nome';
    const dedupeKey = o.dedupe_key || `${prodName}_${o.advertiser || ''}`;

    lines.push(
      `INSERT INTO public.offers (` +
      `id, workspace_id, product_name, offer_name, advertiser, niche, subniche, product_type, price, currency, ` +
      `active_ads_count, estimated_unique_creatives, unique_creatives_count, oldest_ad_date, newest_ad_date, days_running, calculated_days_running, faceless, ` +
      `meta_ads_url, landing_page_url, landing_page_url_original, landing_page_url_resolved, landing_page_domain, landing_page_url_status, ` +
      `lp_mapping_status, checkout_url, checkout_platform, checkout_discovery_status, checkout_mapping_status, headline, subheadline, promise, ` +
      `system_score, opportunity_score, discovery_score, momentum_score, status, favorite, watching, deep_dive, is_draft, ` +
      `dedupe_key, created_at, updated_at` +
      `) VALUES (` +
      `${sqlEscape(o.id)}, 'ws_default_001', ${sqlEscape(prodName)}, ${sqlEscape(offName)}, ${sqlEscape(o.advertiser)}, ${sqlEscape(o.niche)}, ${sqlEscape(o.subniche)}, ${sqlEscape(o.product_type)}, ${sqlEscape(o.price)}, ${sqlEscape(o.currency || 'BRL')}, ` +
      `${sqlEscape(o.active_ads_count || 0)}, ${sqlEscape(o.estimated_unique_creatives || 0)}, ${sqlEscape(o.unique_creatives_count || 0)}, ${sqlDateOnly(o.oldest_ad_date)}, ${sqlDateOnly(o.newest_ad_date)}, ${sqlEscape(o.days_running || 0)}, ${sqlEscape(o.calculated_days_running || o.days_running || 0)}, ${sqlEscape(Boolean(o.faceless))}, ` +
      `${sqlEscape(o.meta_ads_url)}, ${sqlEscape(o.landing_page_url)}, ${sqlEscape(o.landing_page_url_original)}, ${sqlEscape(o.landing_page_url_resolved)}, ${sqlEscape(o.landing_page_domain)}, ${sqlEscape(o.landing_page_url_status || 'NOT_CHECKED')}, ` +
      `${sqlEscape(o.lp_mapping_status || 'NOT_MAPPED')}, ${sqlEscape(o.checkout_url)}, ${sqlEscape(o.checkout_platform)}, ${sqlEscape(o.checkout_discovery_status || 'NOT_PROCESSED')}, ${sqlEscape(o.checkout_mapping_status || 'NOT_MAPPED')}, ${sqlEscape(o.headline)}, ${sqlEscape(o.subheadline)}, ${sqlEscape(o.promise)}, ` +
      `${sqlEscape(o.system_score || 0)}, ${sqlEscape(o.opportunity_score || 0)}, ${sqlEscape(o.discovery_score || 0)}, ${sqlEscape(o.momentum_score || 0)}, ${sqlEscape(o.status || 'REVISAR')}, ${sqlEscape(Boolean(o.favorite))}, ${sqlEscape(Boolean(o.watching))}, ${sqlEscape(Boolean(o.deep_dive))}, ${sqlEscape(Boolean(o.is_draft))}, ` +
      `${sqlEscape(dedupeKey)}, ${sqlDate(o.created_at)}, ${sqlDate(o.updated_at)}` +
      `) ON CONFLICT (id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id, product_name = EXCLUDED.product_name, active_ads_count = EXCLUDED.active_ads_count;`
    );
  }
  lines.push('');

  // 4. Creatives
  lines.push('-- 4. OFFER CREATIVES');
  for (const c of creatives) {
    lines.push(
      `INSERT INTO public.offer_creatives (id, offer_id, creative_external_id, format, headline, body_copy, cta_text, media_url, thumbnail_url, started_at, first_captured_at, created_at) VALUES (` +
      `${sqlEscape(c.id)}, ${sqlEscape(c.offer_id)}, ${sqlEscape(c.creative_external_id)}, ${sqlEscape(c.format || 'IMAGE')}, ${sqlEscape(c.headline)}, ${sqlEscape(c.body_copy)}, ${sqlEscape(c.cta_text)}, ${sqlEscape(c.media_url)}, ${sqlEscape(c.thumbnail_url)}, ${sqlDateOnly(c.started_at)}, ${sqlDate(c.first_captured_at)}, ${sqlDate(c.created_at)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  lines.push('');

  // 5. Landing Page Captures
  lines.push('-- 5. LANDING PAGE CAPTURES');
  for (const lp of lpCaptures) {
    lines.push(
      `INSERT INTO public.landing_page_captures (id, offer_id, final_url, page_title, headline, status, created_at) VALUES (` +
      `${sqlEscape(lp.id)}, ${sqlEscape(lp.offer_id)}, ${sqlEscape(lp.final_url || lp.url)}, ${sqlEscape(lp.page_title || lp.title)}, ${sqlEscape(lp.headline)}, ${sqlEscape(lp.status || 'COMPLETED')}, ${sqlDate(lp.created_at)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  lines.push('');

  // 6. Checkout Captures
  lines.push('-- 6. CHECKOUT CAPTURES');
  for (const chk of checkoutCaptures) {
    lines.push(
      `INSERT INTO public.checkout_captures (id, offer_id, final_url, platform, status, created_at) VALUES (` +
      `${sqlEscape(chk.id)}, ${sqlEscape(chk.offer_id)}, ${sqlEscape(chk.final_url || chk.url)}, ${sqlEscape(chk.platform)}, ${sqlEscape(chk.status || 'COMPLETED')}, ${sqlDate(chk.created_at)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  lines.push('');

  // 7. Deep Dives
  lines.push('-- 7. DEEP DIVES');
  for (const dd of deepDives) {
    lines.push(
      `INSERT INTO public.deep_dives (id, workspace_id, offer_id, status, created_at, updated_at) VALUES (` +
      `${sqlEscape(dd.id)}, 'ws_default_001', ${sqlEscape(dd.offer_id)}, ${sqlEscape(dd.status || 'DRAFT')}, ${sqlDate(dd.created_at)}, ${sqlDate(dd.updated_at)}) ON CONFLICT (id) DO NOTHING;`
    );
  }

  const outPath = path.resolve(process.cwd(), 'supabase/migrations/20260922040000_seed_canonical_offers.sql');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`✅ Generated seed SQL with ${lines.length} lines at: ${outPath}`);
}

main();
