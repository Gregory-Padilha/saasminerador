import { NextRequest, NextResponse } from 'next/server';
import { executeAiTool } from '@/lib/ai-tools/registry';
import { verifyGatewayAuth } from '@/lib/ai-tools/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const auth = verifyGatewayAuth(authHeader);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing Bearer token' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const data = await executeAiTool('compare_offers', body);
    return NextResponse.json({ version: '1', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
