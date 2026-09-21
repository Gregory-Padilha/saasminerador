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

  const { searchParams } = new URL(req.url);
  const rawArgs: Record<string, any> = {};

  if (searchParams.has('query')) rawArgs.query = searchParams.get('query');
  if (searchParams.has('niche')) rawArgs.niche = [searchParams.get('niche')!];
  if (searchParams.has('minAds')) rawArgs.minAds = Number(searchParams.get('minAds'));
  if (searchParams.has('maxAds')) rawArgs.maxAds = Number(searchParams.get('maxAds'));
  if (searchParams.has('minPrice')) rawArgs.minPrice = Number(searchParams.get('minPrice'));
  if (searchParams.has('maxPrice')) rawArgs.maxPrice = Number(searchParams.get('maxPrice'));
  if (searchParams.has('limit')) rawArgs.limit = Number(searchParams.get('limit'));
  if (searchParams.has('cursor')) rawArgs.cursor = searchParams.get('cursor');

  try {
    const data = await executeAiTool('search_offers', rawArgs);
    return NextResponse.json({ version: '1', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
