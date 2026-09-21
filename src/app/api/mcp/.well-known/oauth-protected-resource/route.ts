import { NextResponse } from 'next/server';
import { getSupabaseAuthIssuer } from '@/lib/ai-tools/auth';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Cache-Control': 'public, max-age=3600',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const publicUrl = process.env.MCP_PUBLIC_URL?.trim() || 'http://localhost:3000/api/mcp';
  const issuer = getSupabaseAuthIssuer() || 'https://supabase.co/auth/v1';

  let canonicalResource = publicUrl;
  try {
    const parsed = new URL(publicUrl);
    canonicalResource = `${parsed.origin}/api/mcp`;
  } catch {
    // fallback
  }

  const metadata = {
    resource: canonicalResource,
    authorization_servers: [issuer],
    scopes_supported: ['openid', 'email', 'profile'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${publicUrl.replace(/\/api\/mcp\/?$/, '')}/docs/AI_GATEWAY.md`,
  };

  return NextResponse.json(metadata, { headers: CORS_HEADERS });
}
