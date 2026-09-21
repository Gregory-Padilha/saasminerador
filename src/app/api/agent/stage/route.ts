import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

function extractJsonArrayOrObject(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // 2. Extract from markdown code block ```json ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Extract bracketed [ ... ]
  const arrayMatch = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // continue
    }
  }

  // 4. Extract single object { ... }
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // continue
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get('status') as any) || 'PENDING_APPROVAL';
    const all = searchParams.get('all') === 'true';

    const staged = await dbService.getStagedOffers(all ? undefined : filter);
    return NextResponse.json({
      success: true,
      total: staged.length,
      staged,
    });
  } catch (err: any) {
    console.error('[GET /api/agent/stage Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao buscar ofertas mineradas em staging.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body = await req.json();

    // If body contains a raw text or string payload
    if (typeof body === 'string' || body.rawText || body.text) {
      const textToParse = typeof body === 'string' ? body : (body.rawText || body.text);
      const parsed = extractJsonArrayOrObject(textToParse);
      if (parsed) {
        body = parsed;
      }
    }

    let itemsToStage: any[] = [];

    if (Array.isArray(body)) {
      itemsToStage = body;
    } else if (body && Array.isArray(body.offers)) {
      itemsToStage = body.offers;
    } else if (body && Array.isArray(body.items)) {
      itemsToStage = body.items;
    } else if (body && (body.product_name || body.productName || body.title || body.nome || body.name)) {
      itemsToStage = [body];
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhuma oferta válida encontrada no payload. Envie um objeto com product_name ou um array de ofertas.',
        },
        { status: 400 }
      );
    }

    const normalizedOffers = itemsToStage.map((item) => {
      let price: number | null = null;
      const rawPrice = item.price ?? item.preco ?? item.front_price;
      if (typeof rawPrice === 'number' && !isNaN(rawPrice)) {
        price = rawPrice;
      } else if (typeof rawPrice === 'string') {
        const clean = parseFloat(rawPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(clean) && clean > 0) price = clean;
      }

      let activeAds: number | null = null;
      const rawAds = item.active_ads_count ?? item.activeAds ?? item.anuncios_ativos;
      if (typeof rawAds === 'number' && !isNaN(rawAds)) {
        activeAds = rawAds;
      }

      return {
        product_name: (
          item.product_name ||
          item.productName ||
          item.nome ||
          item.name ||
          item.title ||
          'Oferta Minerada'
        ).trim(),
        advertiser: (
          item.advertiser ||
          item.anunciante ||
          item.pagina ||
          item.page_name ||
          'Anunciante Desconhecido'
        ).trim(),
        price,
        currency: item.currency || 'BRL',
        landing_page_url: item.landing_page_url || item.landingPageUrl || item.lp_url || item.url || null,
        checkout_url: item.checkout_url || item.checkoutUrl || null,
        meta_ads_url: item.meta_ads_url || item.metaAdsUrl || item.ad_url || null,
        active_ads_count: activeAds,
        niche: item.niche || item.nicho || null,
        subniche: item.subniche || item.subnicho || null,
        headline: item.headline || item.manchete || null,
        promise: item.promise || item.promessa || null,
        source: 'BROWSER_USE_AGENT',
        raw_data: item,
      };
    });

    const result = await dbService.stageOffersBatch(normalizedOffers);

    return NextResponse.json({
      success: true,
      count: result.count,
      staged: result.staged,
      message: `${result.count} oferta(s) minerada(s) enviada(s) para a fila de aprovação!`,
    });
  } catch (err: any) {
    console.error('[POST /api/agent/stage Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao processar ofertas para staging.' },
      { status: 500 }
    );
  }
}
