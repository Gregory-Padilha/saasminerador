import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { notifyGlobalSync } from '@/lib/events/offer-events';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const productName = (
      body.product_name ||
      body.productName ||
      body.nome ||
      body.name ||
      body.title ||
      ''
    ).trim();

    if (!productName) {
      return NextResponse.json(
        { success: false, error: 'Nome do produto é obrigatório para ingestão.' },
        { status: 400 }
      );
    }

    const advertiser = (
      body.advertiser ||
      body.anunciante ||
      body.pagina ||
      body.page_name ||
      'Anunciante Desconhecido'
    ).trim();

    const landingPageUrl = body.landing_page_url || body.landingPageUrl || body.lp_url || body.url || null;
    const checkoutUrl = body.checkout_url || body.checkoutUrl || null;
    const metaAdsUrl = body.meta_ads_url || body.metaAdsUrl || body.ad_url || null;

    let price: number | null = null;
    const rawPrice = body.price || body.preco || body.front_price;
    if (typeof rawPrice === 'number' && !isNaN(rawPrice)) {
      price = rawPrice;
    } else if (typeof rawPrice === 'string') {
      const parsed = parseFloat(rawPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) price = parsed;
    }

    let activeAdsCount: number | null = null;
    const rawAds = body.active_ads_count || body.activeAds || body.anuncios_ativos;
    if (typeof rawAds === 'number' && !isNaN(rawAds)) {
      activeAdsCount = rawAds;
    }

    const niche = body.niche || body.nicho || null;
    const subniche = body.subniche || body.subnicho || null;
    const headline = body.headline || body.manchete || null;
    const promise = body.promise || body.promessa || null;

    // Check duplicate by landing page or exact name
    const existingOffers = await dbService.getOffers();
    const existing = existingOffers.find((o) => {
      if (landingPageUrl && o.landing_page_url && o.landing_page_url.toLowerCase().trim() === landingPageUrl.toLowerCase().trim()) {
        return true;
      }
      if (o.product_name.toLowerCase().trim() === productName.toLowerCase()) {
        return true;
      }
      return false;
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        isExisting: true,
        message: 'Oferta já cadastrada no banco. Nenhum registro duplicado criado.',
        offerId: existing.id,
        offer: existing,
      });
    }

    // Create canonical offer in database
    const created = await dbService.saveOffer({
      product_name: productName,
      advertiser,
      niche,
      subniche,
      price,
      currency: 'BRL',
      landing_page_url: landingPageUrl,
      checkout_url: checkoutUrl,
      meta_ads_url: metaAdsUrl,
      active_ads_count: activeAdsCount,
      headline,
      promise,
      status: 'DADOS_PARCIAIS',
      source: 'AGENT_MINED',
      lp_mapping_status: 'NOT_MAPPED',
      checkout_mapping_status: 'NOT_MAPPED',
      data_scraping_status: 'NOT_PROCESSED',
    });

    // Notify realtime listeners
    try {
      notifyGlobalSync('offer_imported');
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      isExisting: false,
      message: `Oferta "${productName}" minerada com sucesso pelo Agente e adicionada ao banco!`,
      offerId: created.id,
      offer: created,
    });
  } catch (err: any) {
    console.error('[POST /api/agent/ingest Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao ingerir oferta minerada pelo agente.' },
      { status: 500 }
    );
  }
}
