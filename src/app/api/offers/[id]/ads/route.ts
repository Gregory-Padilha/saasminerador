import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { OfferAdWithMedia, OfferAdMedia } from '@/types';
import { resolveMediaStorageUrl } from '@/lib/meta-ads/url-resolver';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    if (!offerId) {
      return NextResponse.json({ error: 'ID de oferta inválido.' }, { status: 400 });
    }

    const rawAds: OfferAdWithMedia[] = await dbService.getOfferAds(offerId);
    const offer = await dbService.getOfferById(offerId);

    // Process each ad: resolve display URLs and clean up media arrays
    const ads: OfferAdWithMedia[] = await Promise.all(
      rawAds.map(async (ad) => {
        // Resolve card screenshot display URL
        const cardScreenshotDisplayUrl = await resolveMediaStorageUrl(
          ad.card_screenshot_path,
          ad.card_screenshot_url
        );

        // Filter and sort media items
        let mediaItems = [...(ad.media || [])];

        const hasCompletedMedia = mediaItems.some(
          (m) => m.capture_status === 'completed' || Boolean(m.storage_path)
        );

        if (hasCompletedMedia) {
          mediaItems = mediaItems.filter(
            (m) => m.capture_status === 'completed' || Boolean(m.storage_path)
          );
        }

        // Sort: primary first, then completed first
        mediaItems.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          if (a.storage_path && !b.storage_path) return -1;
          if (!a.storage_path && b.storage_path) return 1;
          return 0;
        });

        // Resolve display URLs for each media item
        const processedMedia: OfferAdMedia[] = await Promise.all(
          mediaItems.map(async (m) => {
            const mediaDisplayUrl = await resolveMediaStorageUrl(
              m.storage_path,
              m.media_url
            );

            const thumbnailDisplayUrl = await resolveMediaStorageUrl(
              m.thumbnail_path,
              m.thumbnail_url || (m.media_type === 'image' ? mediaDisplayUrl : null)
            );

            return {
              ...m,
              media_display_url: mediaDisplayUrl,
              thumbnail_display_url: thumbnailDisplayUrl,
            };
          })
        );

        return {
          ...ad,
          card_screenshot_display_url: cardScreenshotDisplayUrl,
          media: processedMedia,
        };
      })
    );

    const uniqueHashes = new Set(
      ads
        .flatMap((a) => a.media.map((m) => m.file_hash))
        .filter((h) => Boolean(h) && !h.startsWith('card-screenshot-'))
    );

    const videoAds = ads.filter((a) => {
      const primary = a.media[0];
      return primary ? primary.media_type === 'video' : false;
    });

    const imageAds = ads.filter((a) => {
      const primary = a.media[0];
      return primary ? primary.media_type === 'image' : false;
    });

    const storedMedia = ads.filter((a) =>
      a.media.some((m) => Boolean(m.media_display_url || m.storage_path || m.media_url))
    );

    return NextResponse.json({
      ads,
      count: ads.length,
      uniqueCreativesCount: uniqueHashes.size > 0 ? uniqueHashes.size : ads.length,
      videosCount: videoAds.length,
      imagesCount: imageAds.length,
      storedCount: storedMedia.length,
      offer,
    });
  } catch (err: any) {
    console.error('[GET /api/offers/[id]/ads Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar anúncios da oferta.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    const body = await req.json();

    if (!body || !body.meta_ad_id) {
      return NextResponse.json({ error: 'Dados do anúncio incompletos.' }, { status: 400 });
    }

    const savedAd = await dbService.saveOfferAd({
      ...body,
      offer_id: offerId,
    });

    if (body.media && Array.isArray(body.media)) {
      for (const m of body.media) {
        await dbService.saveOfferAdMedia({
          ...m,
          offer_id: offerId,
          offer_ad_id: savedAd.id,
        });
      }
    }

    const updatedAds = await dbService.getOfferAds(offerId);
    return NextResponse.json({ success: true, ad: savedAd, ads: updatedAds });
  } catch (err: any) {
    console.error('[POST /api/offers/[id]/ads Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar anúncio.' },
      { status: 500 }
    );
  }
}
