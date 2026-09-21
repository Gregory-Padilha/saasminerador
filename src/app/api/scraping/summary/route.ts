import { NextResponse } from 'next/server';
import { getScrapingSummary } from '@/lib/scraping/queue';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await getScrapingSummary();
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    console.error('[GET /api/scraping/summary Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao carregar sumário de raspagem.' },
      { status: 500 }
    );
  }
}
