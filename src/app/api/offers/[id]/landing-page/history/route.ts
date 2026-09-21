import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { compareLandingPageCaptures } from '@/lib/landing-page/diff';

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

    const { searchParams } = new URL(req.url);
    const fromId = searchParams.get('from');
    const toId = searchParams.get('to');

    const captures = await dbService.getLandingPageCaptures(offerId);

    // If comparison requested between two specific captures
    if (fromId && toId) {
      const prevCapture = captures.find((c) => c.id === fromId);
      const currCapture = captures.find((c) => c.id === toId);

      if (!prevCapture || !currCapture) {
        return NextResponse.json(
          { error: 'Uma ou ambas as capturas não foram encontradas.' },
          { status: 404 }
        );
      }

      const prevSections = await dbService.getLandingPageSections(fromId);
      const currSections = await dbService.getLandingPageSections(toId);

      const diff = compareLandingPageCaptures(
        prevCapture,
        currCapture,
        prevSections,
        currSections
      );

      return NextResponse.json({
        success: true,
        diff,
        previousCapture: prevCapture,
        currentCapture: currCapture,
        captures,
      });
    }

    // Default: return all captures and compute diff between latest two if available
    let defaultDiff = null;
    let prevCapture = null;
    let currCapture = null;

    if (captures.length >= 2) {
      currCapture = captures[0];
      prevCapture = captures[1];
      const prevSections = await dbService.getLandingPageSections(prevCapture.id);
      const currSections = await dbService.getLandingPageSections(currCapture.id);
      defaultDiff = compareLandingPageCaptures(
        prevCapture,
        currCapture,
        prevSections,
        currSections
      );
    }

    return NextResponse.json({
      success: true,
      capturesCount: captures.length,
      captures,
      diff: defaultDiff,
      previousCapture: prevCapture,
      currentCapture: currCapture,
    });
  } catch (err: any) {
    console.error('[GET /api/offers/[id]/landing-page/history Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar histórico de capturas.' },
      { status: 500 }
    );
  }
}
