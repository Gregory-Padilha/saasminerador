import { NextRequest, NextResponse } from 'next/server';
import { executeAiTool } from '@/lib/ai-tools/registry';
import { verifyGatewayAuth } from '@/lib/ai-tools/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get('authorization');
  const auth = verifyGatewayAuth(authHeader);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing Bearer token' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'all';
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;

  try {
    const data = await executeAiTool('list_creatives', { offerId: id, type, limit });
    return NextResponse.json({ version: '1', data });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
