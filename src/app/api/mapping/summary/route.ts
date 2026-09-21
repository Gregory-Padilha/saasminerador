import { NextResponse } from 'next/server';
import { computeMappingSummary } from '@/lib/mapping/queue';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await computeMappingSummary();
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    console.error('[GET /api/mapping/summary Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao calcular estatísticas da central.' },
      { status: 500 }
    );
  }
}
