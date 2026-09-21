import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tests = await dbService.getDeepDiveTests(id);
    return NextResponse.json({ success: true, tests });
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

    const created = await dbService.createDeepDiveTest({
      ...body,
      deep_dive_id: id,
    });

    return NextResponse.json({ success: true, test: created });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('testId');
    if (!testId) {
      return NextResponse.json({ success: false, error: 'testId é obrigatório' }, { status: 400 });
    }
    const updates = await req.json();
    const updated = await dbService.updateDeepDiveTest(testId, updates);
    return NextResponse.json({ success: true, test: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('testId');
    if (!testId) {
      return NextResponse.json({ success: false, error: 'testId é obrigatório' }, { status: 400 });
    }
    await dbService.deleteDeepDiveTest(testId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
