import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await dbService.unarchiveOffer(id);
    return NextResponse.json({ success, message: 'Oferta desarquivada com sucesso.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao desarquivar oferta.' }, { status: 500 });
  }
}
