import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { analyzeAndMapLandingPage } from '@/lib/landing-page/sync';
import { LPAnalyzeProgressEvent } from '@/lib/landing-page/types';

export const runtime = 'nodejs';

import { resolveLandingPageUrl } from '@/lib/landing-page/resolver';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    if (!offerId) {
      return NextResponse.json({ error: 'ID de oferta inválido.' }, { status: 400 });
    }

    const offer = await dbService.getOfferById(offerId);
    if (!offer) {
      return NextResponse.json({ error: 'Oferta não encontrada.' }, { status: 404 });
    }

    // 1. Resolve and validate URL first
    const resolution = await resolveLandingPageUrl(offer);

    const isStream = req.nextUrl.searchParams.get('stream') === 'true';

    // 2. If URL cannot be resolved, return structured error gracefully
    if (!resolution.resolvedUrl || resolution.status === 'DNS_NOT_RESOLVED' || resolution.status === 'UNAVAILABLE' || resolution.status === 'INVALID_URL') {
      console.warn(`[LP ANALYZE API] Cannot analyze: URL unavailable (${resolution.status}) for offer ${offerId}`);

      if (isStream) {
        const encoder = new TextEncoder();
        const customStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  step: 'failed',
                  message: resolution.userFriendlyMessage,
                  progressPercent: 100,
                  result: { error: resolution.userFriendlyMessage, resolution },
                })}\n\n`
              )
            );
            controller.close();
          },
        });

        return new Response(customStream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        });
      }

      return NextResponse.json({
        success: false,
        status: resolution.status,
        error: resolution.userFriendlyMessage,
        resolution,
      }, { status: 200 });
    }

    const targetUrl = resolution.resolvedUrl;
    console.log(`[LP ANALYZE API] Starting mapping for offer ${offerId} with resolved URL: ${targetUrl}`);

    // 3. SSE Streaming Mode
    if (isStream) {
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: LPAnalyzeProgressEvent) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch {}
          };

          try {
            const result = await analyzeAndMapLandingPage(
              offerId,
              targetUrl,
              offer.user_id,
              (prog) => sendEvent(prog)
            );

            sendEvent({
              step: 'done',
              message: 'Mapeamento concluído com sucesso!',
              progressPercent: 100,
              result,
            });
          } catch (err: any) {
            console.error('[LP ANALYZE STREAM ERROR]:', err);
            sendEvent({
              step: 'failed',
              message: err.message || 'Falha ao analisar a Landing Page.',
              progressPercent: 100,
              result: { error: err.message },
            });
          } finally {
            try {
              controller.close();
            } catch {}
          }
        },
      });

      return new Response(customStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    // 4. Direct JSON mode
    const result = await analyzeAndMapLandingPage(offerId, targetUrl, offer.user_id);
    const updatedOffer = await dbService.getOfferById(offerId);

    return NextResponse.json({
      success: true,
      result,
      resolution,
      offer: updatedOffer,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/[id]/landing-page/analyze Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao analisar a Landing Page.' },
      { status: 500 }
    );
  }
}
