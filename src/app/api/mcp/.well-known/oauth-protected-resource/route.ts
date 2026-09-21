import { NextResponse } from 'next/server';
import { getSupabaseAuthIssuer } from '@/lib/ai-tools/auth';

import { getMcpPublicUrl, CANONICAL_PRODUCTION_MCP_URL } from '@/lib/mcp/config';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const publicUrl = getMcpPublicUrl() || CANONICAL_PRODUCTION_MCP_URL;
  const issuer = getSupabaseAuthIssuer();

  let canonicalResource = publicUrl;
  try {
    const parsed = new URL(publicUrl);
    canonicalResource = `${parsed.origin}/api/mcp`;
  } catch {
    canonicalResource = CANONICAL_PRODUCTION_MCP_URL;
  }

  const metadata = {
    resource: canonicalResource,
    authorization_servers: [issuer],
    scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${canonicalResource.replace(/\/api\/mcp\/?$/, '')}/docs/AI_GATEWAY.md`,
  };

  return NextResponse.json(metadata, { headers: CORS_HEADERS });
}
