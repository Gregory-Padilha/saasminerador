// ==============================================================================
// OFFER MINER - JSON IMPORT RECONCILIATION & AUTO-REPAIR SERVICE
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { Offer, ImportBatch, ImportRow } from '@/types';
import { resolveImportedOfferName } from './offer-name-resolver';
import { normalizeProtocolUrl, extractMetaAdId, parseLocalizedDate } from './smart-json-ingestion';
import { isBadTestOffer } from '../supabase/db';

export interface ReconciliationReport {
  scannedBatches: number;
  scannedRows: number;
  missingOffersCount: number;
  repairedOffersCount: number;
  namesRepaired: string[];
  testFixturesSkipped: number;
}

/**
 * Scans all JSON import batches and rows, detects any rows marked as inserted whose
 * canonical Offer was purged or never saved into `offerminer_offers_v2`, and safely
 * recreates the canonical Offer without duplicating or resurrecting test fixtures.
 */
export function reconcileJsonImports(): ReconciliationReport {
  const dataDir = path.resolve(process.cwd(), '.data');
  const storePath = path.join(dataDir, 'store.json');

  if (!fs.existsSync(storePath)) {
    return {
      scannedBatches: 0,
      scannedRows: 0,
      missingOffersCount: 0,
      repairedOffersCount: 0,
      namesRepaired: [],
      testFixturesSkipped: 0,
    };
  }

  const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  const batches: ImportBatch[] = store['offerminer_batches_v2']
    ? JSON.parse(store['offerminer_batches_v2'])
    : [];
  const rows: ImportRow[] = store['offerminer_import_rows_v2']
    ? JSON.parse(store['offerminer_import_rows_v2'])
    : [];
  let offers: Offer[] = store['offerminer_offers_v2']
    ? JSON.parse(store['offerminer_offers_v2'])
    : [];

  const now = new Date().toISOString();
  let missingOffersCount = 0;
  let repairedOffersCount = 0;
  let testFixturesSkipped = 0;
  const namesRepaired: string[] = [];

  // Index existing offers by id
  const existingOfferIds = new Set(offers.map((o) => o.id));

  // Find JSON import rows with status inserted/updated
  const jsonRows = rows.filter((r) => {
    const raw = r.raw_data || {};
    return Boolean(
      raw.tipo_material ||
      raw.pagina ||
      raw.anuncios_ativos ||
      r.sheet_name === 'JSON_IMPORT' ||
      r.sheet_name?.includes('JSON')
    );
  });

  for (const row of jsonRows) {
    if (!row.offer_id) continue;

    // Check if canonical offer already exists in catalog
    if (existingOfferIds.has(row.offer_id)) {
      continue;
    }

    missingOffersCount++;

    // Resolve offer identity from raw data
    const resolved = resolveImportedOfferName(row.raw_data, row.normalized_data);

    if (!resolved.hasValidName || !resolved.offerName) {
      continue;
    }

    // Never revive test fixtures
    const tempOfferCheck = {
      product_name: resolved.offerName,
      advertiser: resolved.advertiser,
      source_type: 'JSON_IMPORT',
    };
    if (isBadTestOffer(tempOfferCheck)) {
      testFixturesSkipped++;
      continue;
    }

    const raw = row.raw_data || {};
    const norm = row.normalized_data || {};

    // Canonical LP URL
    let landingPageUrl = norm.landing_page_url || raw.link_destino || null;
    if (landingPageUrl) {
      landingPageUrl = normalizeProtocolUrl(landingPageUrl).url;
    }

    // Canonical Meta Ads URL & ID
    let metaAdsUrl = norm.meta_ads_url || raw.link_biblioteca || null;
    let metaAdId: string | null = null;
    if (metaAdsUrl) {
      metaAdId = extractMetaAdId(metaAdsUrl);
    }

    // First seen date parsing (e.g. "11 de jun de 2026")
    let firstSeen = norm.oldest_ad_date || null;
    if (!firstSeen && raw.data_inicio) {
      firstSeen = parseLocalizedDate(raw.data_inicio, 'pt-BR');
    }

    const headline = norm.headline || raw.promessa || null;
    const advertiser = resolved.advertiser || norm.advertiser || raw.pagina || null;

    const reconstructedOffer: Offer = {
      id: row.offer_id,
      source: 'JSON_PASTE',
      product_name: resolved.offerName,
      offer_name: resolved.offerName,
      advertiser,
      niche: norm.niche || null,
      subniche: norm.subniche || null,
      product_type: norm.product_type || null,
      price: norm.price || null,
      currency: 'BRL',
      active_ads_count: null, // "Yes" is status, never active_ads_count!
      estimated_unique_creatives: null,
      unique_creatives_count: null,
      oldest_ad_date: firstSeen,
      days_running: norm.days_running || null,
      faceless: null,
      meta_ads_url: metaAdsUrl,
      landing_page_url: landingPageUrl,
      landing_page_url_original: landingPageUrl,
      landing_page_url_source: landingPageUrl ? 'MANUAL_OVERRIDE' : 'NONE',
      landing_page_url_status: landingPageUrl ? 'PENDING' : 'NEEDS_MANUAL_URL',
      lp_mapping_status: 'NOT_MAPPED',
      lp_mapped_at: null,
      mapped_source_url: null,
      mapper_version: null,
      checkout_url: null,
      checkout_discovery_status: 'NOT_PROCESSED',
      checkout_discovery_at: null,
      checkout_mapping_status: 'NOT_MAPPED',
      checkout_mapped_at: null,
      headline,
      subheadline: null,
      ad_format: null,
      notes: null,
      score: null,
      work_score: null,
      discovery_score: 50,
      system_score: 50,
      opportunity_score: null,
      momentum_score: null,
      trend: 'SEM_HISTORICO',
      activity_status: 'Ativa',
      status: 'DADOS_PARCIAIS',
      decision: 'Observar',
      favorite: false,
      watching: false,
      in_deep_dive: false,
      archived: false,
      archived_at: null,
      archived_by_user: false,
      dedupe_key: `${resolved.offerName}_${advertiser || ''}_${landingPageUrl || ''}`,
      source_file_name: 'Texto colado via JSON',
      sheet_name: 'JSON_IMPORT',
      row_number: row.row_number,
      raw_data: raw,
      extra_data: {
        ...(norm.extra_data || {}),
        meta_ad_id: metaAdId,
        source_ad_active: true,
        ad_status: 'active',
        reconciled_at: now,
      },
      source_import_batch_id: row.import_batch_id,
      source_import_row_id: row.id,
      first_seen_at: firstSeen ? `${firstSeen}T00:00:00.000Z` : (row.created_at || now),
      last_seen_at: row.created_at || now,
      first_imported_at: row.created_at || now,
      last_imported_at: row.created_at || now,
      created_at: row.created_at || now,
      updated_at: now,
      is_demo_data: false,
    };

    offers.push(reconstructedOffer);
    existingOfferIds.add(row.offer_id);
    repairedOffersCount++;
    namesRepaired.push(`${advertiser} → ${resolved.offerName}`);

    // Update row normalized_data
    row.normalized_data = {
      ...(row.normalized_data || {}),
      product_name: resolved.offerName,
      offer_name: resolved.offerName,
      advertiser,
      landing_page_url: landingPageUrl,
      meta_ads_url: metaAdsUrl,
    };
    row.import_status = 'inserted';
  }

  if (repairedOffersCount > 0) {
    // Sort newest first
    offers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    store['offerminer_offers_v2'] = JSON.stringify(offers);
    store['offerminer_import_rows_v2'] = JSON.stringify(rows);
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  return {
    scannedBatches: batches.length,
    scannedRows: jsonRows.length,
    missingOffersCount,
    repairedOffersCount,
    namesRepaired,
    testFixturesSkipped,
  };
}
