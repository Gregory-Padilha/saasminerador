import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hypotheses = await dbService.getDeepDiveHypotheses(id);
    return NextResponse.json({ success: true, hypotheses });
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

    const created = await dbService.createDeepDiveHypothesis({
      ...body,
      deep_dive_id: id,
    });

    return NextResponse.json({ success: true, hypothesis: created });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hypothesisId = searchParams.get('hypothesisId');
    if (!hypothesisId) {
      return NextResponse.json({ success: false, error: 'hypothesisId é obrigatório' }, { status: 400 });
    }
    const updates = await req.json();
    const updated = await dbService.updateDeepDiveHypothesis(hypothesisId, updates);
    return NextResponse.json({ success: true, hypothesis: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hypothesisId = searchParams.get('hypothesisId');
    if (!hypothesisId) {
      return NextResponse.json({ success: false, error: 'hypothesisId é obrigatório' }, { status: 400 });
    }
    await dbService.deleteDeepDiveHypothesis(hypothesisId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
