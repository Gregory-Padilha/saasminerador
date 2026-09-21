import { NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export async function GET() {
  try {
    const patterns = await dbService.getResearchPatterns();
    return NextResponse.json({ success: true, patterns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saved = await dbService.saveResearchPattern(body);
    return NextResponse.json({ success: true, pattern: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const patternId = searchParams.get('id');
    if (!patternId) {
      return NextResponse.json({ success: false, error: 'id é obrigatório' }, { status: 400 });
    }
    await dbService.deleteResearchPattern(patternId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
