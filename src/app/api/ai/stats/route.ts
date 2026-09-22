import { NextRequest, NextResponse } from 'next/server';
import { executeAiTool } from '@/lib/ai-tools/registry';
import { verifyGatewayAuth } from '@/lib/ai-tools/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const auth = verifyGatewayAuth(authHeader);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing Bearer token' }, { status: 401 });
  }

  try {
    const token = authHeader?.replace('Bearer ', '').trim();
    const data = await executeAiTool('get_dashboard_stats', {}, {
      authMethod: auth.authMethod,
      token: auth.authMethod === 'oauth_token' ? token : undefined,
      staticToken: auth.authMethod === 'static_token' ? token : undefined,
    });
    return NextResponse.json({ version: '1', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
