import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    const activeJob = await dbService.getActiveCaptureJob(offerId);

    if (!activeJob) {
      return NextResponse.json({ message: 'Nenhum job de captura ativo para cancelar.' });
    }

    await dbService.cancelCaptureJob(activeJob.id);

    return NextResponse.json({
      message: 'Job de captura cancelado com sucesso.',
      jobId: activeJob.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao cancelar job de captura.' },
      { status: 500 }
    );
  }
}
