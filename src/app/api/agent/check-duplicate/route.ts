import { NextRequest, NextResponse } from 'next/server';
import { OfferDuplicateService } from '@/lib/offer/offer-duplicate-service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url') || searchParams.get('landing_page_url') || '';
    const checkoutUrl = searchParams.get('checkout_url') || '';
    const name = searchParams.get('name') || searchParams.get('offer_name') || '';
    const advertiser = searchParams.get('advertiser') || '';
    const metaAdId = searchParams.get('metaAdId') || searchParams.get('adId') || searchParams.get('meta_ad_id') || '';
    const metaAdsUrl = searchParams.get('meta_ads_url') || '';

    if (!url && !name && !metaAdId && !checkoutUrl && !metaAdsUrl) {
      return NextResponse.json(
        { success: false, error: 'Pelo menos um parâmetro (url, name, checkout_url, meta_ad_id) deve ser fornecido.' },
        { status: 400 }
      );
    }

    const checkResult = await OfferDuplicateService.checkOne({
      offer_name: name || null,
      advertiser: advertiser || null,
      landing_page_url: url || null,
      checkout_url: checkoutUrl || null,
      meta_ads_url: metaAdsUrl || null,
      meta_ad_id: metaAdId || null,
    });

    const isDuplicate = checkResult.status === 'DUPLICATE';
    const isPossible = checkResult.status === 'POSSIBLE_DUPLICATE';
    const matched = checkResult.matches[0] || null;

    return NextResponse.json({
      success: true,
      status: checkResult.status,
      isDuplicate,
      isPossibleDuplicate: isPossible,
      confidenceBasis: checkResult.confidence_basis,
      matchReason: checkResult.confidence_basis.join(', ') || null,
      matches: checkResult.matches,
      existingOffer: matched
        ? {
            id: matched.offer_id,
            name: matched.offer_name,
            advertiser: matched.advertiser,
            landingPageUrl: matched.landing_page_url,
            activeAdsCount: matched.active_ads_count,
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body.candidates)) {
      const bulkResult = await OfferDuplicateService.checkMany({
        candidates: body.candidates,
      });
      return NextResponse.json({ success: true, ...bulkResult });
    }

    const checkResult = await OfferDuplicateService.checkOne(body);
    return NextResponse.json({ success: true, ...checkResult });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
