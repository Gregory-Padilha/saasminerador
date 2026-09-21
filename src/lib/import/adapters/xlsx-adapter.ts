// ==============================================================================
// OFFER MINER - XLSX OFFER IMPORT ADAPTER
// ==============================================================================

import { NormalizedOfferImportRecord } from '../types';
import { ImportPreviewRow } from '@/types';

export class XlsxOfferImportAdapter {
  /**
   * Adapts existing ImportPreviewRow array from parseSpreadsheet into canonical NormalizedOfferImportRecord array.
   */
  static adaptRows(previewRows: ImportPreviewRow[]): NormalizedOfferImportRecord[] {
    return previewRows.map((item) => {
      const norm = item.normalized;
      return {
        offer_name: norm.product_name || '',
        advertiser: norm.advertiser || null,
        niche: norm.niche || null,
        subniche: norm.subniche || null,
        product_type: norm.product_type || null,
        active_ads_count: norm.active_ads_count ?? null,
        unique_creatives_count: norm.estimated_unique_creatives ?? null,
        oldest_ad_date: norm.oldest_ad_date || null,
        newest_ad_date: norm.newest_ad_date || null,
        days_running: norm.days_running ?? null,
        front_price: norm.price ?? null,
        currency: norm.currency || 'BRL',
        meta_ads_url: norm.meta_ads_url || null,
        meta_page_id: null,
        landing_page_url: norm.landing_page_url || null,
        checkout_url: norm.checkout_url || null,
        product_format: norm.ad_format || null,
        faceless: norm.faceless ?? null,
        headline: norm.headline || null,
        subheadline: norm.subheadline || null,
        notes: norm.notes || null,
        score: norm.score ?? null,
        source: 'XLSX_IMPORT',
        raw_data: item.raw || {},
        extra_data: item.extraData || {},
      };
    });
  }
}
