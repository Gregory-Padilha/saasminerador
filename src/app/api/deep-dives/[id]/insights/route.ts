import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const insights = await dbService.getDeepDiveInsights(id);
    return NextResponse.json({ success: true, insights });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const newInsight = await dbService.createDeepDiveInsight({
      ...body,
      deep_dive_id: id,
    });

    return NextResponse.json({ success: true, insight: newInsight });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const insightId = searchParams.get('insightId');
    if (!insightId) {
      return NextResponse.json({ success: false, error: 'insightId é obrigatório' }, { status: 400 });
    }
    await dbService.deleteDeepDiveInsight(insightId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
