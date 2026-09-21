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

  try {
    const data = await executeAiTool('get_offer', { offerId: id });
    return NextResponse.json({ version: '1', data });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
