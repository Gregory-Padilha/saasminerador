import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    if (!batchId) {
      return NextResponse.json({ error: 'ID do lote inválido.' }, { status: 400 });
    }

    const batch = await dbService.getMappingBatchById(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Lote de mapeamento não encontrado.' }, { status: 404 });
    }

    const jobs = await dbService.getMappingJobs(batchId);

    return NextResponse.json({
      success: true,
      batch,
      jobs,
    });
  } catch (err: any) {
    console.error('[GET /api/mapping/batches/[id] Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao buscar detalhes do lote.' },
      { status: 500 }
    );
  }
}
