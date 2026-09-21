import { NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const offers = await dbService.getOffers();

    const catalog = offers.map((o) => {
      let domain = '';
      if (o.landing_page_url) {
        try {
          domain = new URL(o.landing_page_url).hostname.replace('www.', '');
        } catch {
          domain = '';
        }
      }

      return {
        id: o.id,
        name: o.product_name,
        advertiser: o.advertiser || null,
        niche: o.niche || null,
        subniche: o.subniche || null,
        price: o.price ?? null,
        landingPageUrl: o.landing_page_url || null,
        domain: domain || null,
        metaAdSeedId: o.meta_ad_seed_id || null,
        metaAdsUrl: o.meta_ads_url || (o as any).meta_ad_url || null,
        activeAdsCount: o.active_ads_count ?? null,
        daysRunning: o.days_running ?? null,
      };
    });

    const knownDomains = Array.from(
      new Set(catalog.map((c) => c.domain).filter(Boolean))
    );
    const knownNames = Array.from(
      new Set(catalog.map((c) => c.name.toLowerCase().trim()).filter(Boolean))
    );
    const knownMetaAdIds = Array.from(
      new Set(catalog.map((c) => c.metaAdSeedId).filter(Boolean))
    );

    return NextResponse.json({
      success: true,
      total: catalog.length,
      knownDomainsCount: knownDomains.length,
      knownNamesCount: knownNames.length,
      knownMetaAdIdsCount: knownMetaAdIds.length,
      knownDomains,
      knownNames,
      knownMetaAdIds,
      offers: catalog,
    });
  } catch (err: any) {
    console.error('[GET /api/agent/catalog Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao recuperar catálogo compartilhado.' },
      { status: 500 }
    );
  }
}
