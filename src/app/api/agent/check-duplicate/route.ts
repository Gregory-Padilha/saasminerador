import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

function normalize(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url') || '';
    const name = searchParams.get('name') || '';
    const metaAdId = searchParams.get('metaAdId') || searchParams.get('adId') || '';

    if (!url && !name && !metaAdId) {
      return NextResponse.json(
        { success: false, error: 'Pelo menos um parâmetro (url, name ou metaAdId) deve ser fornecido.' },
        { status: 400 }
      );
    }

    const offers = await dbService.getOffers();

    let duplicateOffer = null;
    let matchReason = '';

    const normName = normalize(name);
    let targetDomain = '';
    if (url) {
      try {
        targetDomain = new URL(url).hostname.replace('www.', '').toLowerCase();
      } catch {
        targetDomain = '';
      }
    }

    for (const o of offers) {
      // 1. Meta Ad ID match
      if (metaAdId && (o.meta_ad_seed_id === metaAdId || o.meta_ads_url?.includes(metaAdId))) {
        duplicateOffer = o;
        matchReason = `Meta Ad ID idêntico (${metaAdId})`;
        break;
      }

      // 2. Exact Landing Page URL match
      if (url && o.landing_page_url) {
        const normLp = normalize(o.landing_page_url);
        const normTarget = normalize(url);
        if (normLp === normTarget || normLp.includes(normTarget) || normTarget.includes(normLp)) {
          duplicateOffer = o;
          matchReason = `URL da Landing Page correspondente (${o.landing_page_url})`;
          break;
        }
      }

      // 3. Same domain + exact or very similar product name
      if (targetDomain && o.landing_page_url) {
        try {
          const offerDomain = new URL(o.landing_page_url).hostname.replace('www.', '').toLowerCase();
          if (offerDomain === targetDomain && normName && normalize(o.product_name) === normName) {
            duplicateOffer = o;
            matchReason = `Mesmo domínio (${targetDomain}) e mesmo nome de produto (${o.product_name})`;
            break;
          }
        } catch {
          // ignore
        }
      }

      // 4. Exact product name match if name is specific (> 6 chars)
      if (normName && normName.length > 6 && normalize(o.product_name) === normName) {
        duplicateOffer = o;
        matchReason = `Nome do produto idêntico (${o.product_name})`;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      isDuplicate: Boolean(duplicateOffer),
      matchReason: matchReason || null,
      existingOffer: duplicateOffer
        ? {
            id: duplicateOffer.id,
            name: duplicateOffer.product_name,
            advertiser: duplicateOffer.advertiser,
            niche: duplicateOffer.niche,
            price: duplicateOffer.price,
            landingPageUrl: duplicateOffer.landing_page_url,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[GET /api/agent/check-duplicate Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao verificar duplicata.' },
      { status: 500 }
    );
  }
}
