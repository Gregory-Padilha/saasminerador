import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { captureMetaAdsCreatives } from '@/lib/meta-ads/capture';
import { CaptureMode, CaptureProgressEvent } from '@/lib/meta-ads/types';
import { Offer } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max duration for browser capture

// Helper to validate UUID
function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) || id.length >= 10;
}

// Known aliases for Meta Ads Library URL in raw or extra data
const META_ADS_ALIASES = [
  'meta_ads_url',
  'url meta ads library',
  'meta ads library',
  'meta ads',
  'biblioteca de anúncios',
  'biblioteca de anuncios',
  'url biblioteca',
  'link anúncios',
  'link anuncios',
  'link meta ads',
  'meta ads link',
  'ad library url',
  'ad_library_url',
  'url meta',
  'url da biblioteca',
  'ads library',
  'link_meta_ads',
  'meta',
];

function extractMetaAdsUrlFromAliases(offer: Offer): string | null {
  if (offer.meta_ads_url && offer.meta_ads_url.trim().startsWith('http')) {
    return offer.meta_ads_url.trim();
  }

  // Check raw_data
  if (offer.raw_data && typeof offer.raw_data === 'object') {
    for (const [key, val] of Object.entries(offer.raw_data)) {
      const lowerKey = key.toLowerCase().trim();
      if (typeof val === 'string' && val.trim().startsWith('http')) {
        if (META_ADS_ALIASES.some((alias) => lowerKey.includes(alias) || alias.includes(lowerKey))) {
          return val.trim();
        }
        if (val.includes('facebook.com/ads/library') || val.includes('meta.com/ads/library')) {
          return val.trim();
        }
      }
    }
  }

  // Check extra_data
  if (offer.extra_data && typeof offer.extra_data === 'object') {
    for (const [key, val] of Object.entries(offer.extra_data)) {
      const lowerKey = key.toLowerCase().trim();
      if (typeof val === 'string' && val.trim().startsWith('http')) {
        if (META_ADS_ALIASES.some((alias) => lowerKey.includes(alias) || alias.includes(lowerKey))) {
          return val.trim();
        }
        if (val.includes('facebook.com/ads/library') || val.includes('meta.com/ads/library')) {
          return val.trim();
        }
      }
    }
  }

  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;

    // 1. Audit / Debug log
    console.log('[CAPTURE DIRECT API]', {
      receivedOfferId: offerId,
      timestamp: new Date().toISOString(),
    });

    // 2. Validate Offer ID
    if (!isValidUUID(offerId)) {
      return NextResponse.json(
        {
          error: 'ID de oferta inválido.',
          code: 'INVALID_OFFER_ID',
          receivedId: offerId,
        },
        { status: 400 }
      );
    }

    // Parse optional body payload sent by client for fallback/sync
    let clientOfferPayload: Partial<Offer> | null = null;
    let requestedMode: CaptureMode = 'capture';
    try {
      const body = await req.json();
      if (body) {
        if (body.offer && typeof body.offer === 'object') {
          clientOfferPayload = body.offer;
        }
        if (body.mode === 'discovery_only') {
          requestedMode = 'discovery_only';
        }
      }
    } catch {
      // Body is optional
    }

    let offer: Offer | null = null;

    // 3. Query Supabase directly if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('offers')
          .select(`
            *,
            snapshots:offer_snapshots(*),
            creatives:offer_creatives(*)
          `)
          .eq('id', offerId)
          .maybeSingle();

        if (error && (error.code === '42501' || error.message?.includes('permission'))) {
          return NextResponse.json(
            {
              error: 'Acesso negado ao registro da oferta.',
              code: 'OFFER_ACCESS_DENIED',
              details: error.message,
            },
            { status: 403 }
          );
        }

        if (data) {
          offer = data as Offer;
        }
      } catch (sbErr) {
        console.warn('[CAPTURE DIRECT API] Supabase query exception:', sbErr);
      }
    }

    // 4. If not found in Supabase, check unified dbService
    if (!offer) {
      offer = await dbService.getOfferById(offerId);
    }

    // 5. If still not found, check if client provided valid offer payload and auto-sync
    if (!offer && clientOfferPayload && clientOfferPayload.id === offerId) {
      console.log('[CAPTURE DIRECT API] Restoring/syncing offer from client payload for ID:', offerId);
      offer = await dbService.saveOffer(clientOfferPayload);
    }

    // 6. If offer does not exist anywhere, return 404 with structured error
    if (!offer) {
      return NextResponse.json(
        {
          error: 'Oferta não encontrada no banco de dados.',
          code: 'OFFER_NOT_FOUND',
          details: { offerId },
        },
        { status: 404 }
      );
    }

    // 7. Verify and Backfill Meta Ads URL
    let metaAdsUrl = offer.meta_ads_url;
    if (!metaAdsUrl || !metaAdsUrl.trim()) {
      const aliasUrl = extractMetaAdsUrlFromAliases(offer);
      if (aliasUrl) {
        metaAdsUrl = aliasUrl;
        offer.meta_ads_url = aliasUrl;
        await dbService.updateOffer(offer.id, { meta_ads_url: aliasUrl });
      }
    }

    if (!metaAdsUrl || !metaAdsUrl.trim()) {
      return NextResponse.json(
        {
          error: 'Esta oferta não possui uma URL da Meta Ads Library cadastrada.',
          code: 'META_ADS_URL_MISSING',
          details: {
            offerId: offer.id,
            productName: offer.product_name,
          },
        },
        { status: 422 }
      );
    }

    // 8. Check if Client requested Server-Sent Events (SSE) Streaming
    const acceptHeader = req.headers.get('accept') || '';
    const isStreamRequested =
      acceptHeader.includes('text/event-stream') || req.nextUrl.searchParams.get('stream') === 'true';

    if (isStreamRequested) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: CaptureProgressEvent | { step: string; result: any }) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch {}
          };

          try {
            const captureResult = await captureMetaAdsCreatives({
              offer: offer!,
              metaAdsUrl: metaAdsUrl!,
              options: {
                mode: requestedMode,
                maxAds: 50,
                onProgress: (prog) => sendEvent(prog),
              },
            });

            sendEvent({ step: 'done', result: captureResult });
            controller.close();
          } catch (err: any) {
            sendEvent({
              step: 'failed',
              result: {
                success: false,
                errorCode: 'BROWSER_FAILED',
                errorMessage: err.message || 'Erro durante a captura no backend.',
              },
            });
            controller.close();
          }
        },
      });

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    // 9. Synchronous in-process capture execution (returns full JSON response)
    const result = await captureMetaAdsCreatives({
      offer,
      metaAdsUrl,
      options: {
        mode: requestedMode,
        maxAds: 50,
      },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err: any) {
    console.error('[CAPTURE DIRECT API Fatal Error]:', err);
    return NextResponse.json(
      {
        error: err.message || 'Erro interno durante a captura.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    if (!isValidUUID(offerId)) {
      return NextResponse.json(
        {
          error: 'ID de oferta inválido.',
          code: 'INVALID_OFFER_ID',
        },
        { status: 400 }
      );
    }

    const ads = await dbService.getOfferAds(offerId);
    const creatives = await dbService.getCreativesByOffer(offerId);

    const uniqueHashes = new Set(
      ads
        .flatMap((a) => a.media.map((m) => m.file_hash))
        .filter((h) => Boolean(h) && !h.startsWith('card-screenshot-'))
    );

    return NextResponse.json({
      ads,
      creatives,
      count: ads.length || creatives.length,
      uniqueCreativesCount: uniqueHashes.size || ads.length || creatives.length,
      videosCount: ads.filter((a) => a.media.some((m) => m.media_type === 'video')).length,
      imagesCount: ads.filter((a) => a.media.some((m) => m.media_type === 'image')).length,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || 'Erro ao consultar criativos da oferta.',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}

