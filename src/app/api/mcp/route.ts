import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRequest } from '@/lib/mcp/handler';
import { isMcpEnabled, checkRateLimit, SERVER_INFO } from '@/lib/mcp/config';
import { verifyGatewayAuthAsync, getWwwAuthenticateHeader, getProtectedResourceMetadataUrl } from '@/lib/ai-tools/auth';
import { MCP_TOOLS } from '@/lib/mcp/tools';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Forwarded-Proto, X-Forwarded-Host',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
};

/**
 * Handle OPTIONS preflight for CORS (ChatGPT / Gemini / Remote Agents)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Main MCP Endpoint - Handles POST JSON-RPC with Hybrid OAuth 2.1 / Bearer Auth
 */
export async function POST(req: NextRequest) {
  // 1. Check if MCP is enabled
  if (!isMcpEnabled()) {
    return NextResponse.json(
      { error: 'MCP Server is disabled. Set MCP_ENABLED=true in .env' },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  // 2. Authenticate Hybrid (Supabase OAuth 2.1 JWT OR Static OFFER_MINER_MCP_TOKEN)
  const authHeader = req.headers.get('authorization');
  const authResult = await verifyGatewayAuthAsync(authHeader);

  if (!authResult.valid) {
    const wwwAuth = authResult.wwwAuthenticateHeader || getWwwAuthenticateHeader();
    const metaUrl = getProtectedResourceMetadataUrl();

    let jsonRpcId: any = null;
    try {
      const cloned = req.clone();
      const parsedBody = await cloned.json();
      if (parsedBody && typeof parsedBody === 'object' && 'id' in parsedBody) {
        jsonRpcId = parsedBody.id;
      }
    } catch {
      // not JSON-RPC body
    }

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: jsonRpcId,
        error: {
          code: -32001,
          message: 'Authentication required. OAuth 2.1 Protected Resource.',
          data: {
            reason: authResult.reason,
            resource_metadata: metaUrl,
          },
        },
        _meta: {
          'mcp/www_authenticate': wwwAuth,
        },
        resource_metadata: metaUrl,
      },
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          'WWW-Authenticate': wwwAuth,
        },
      }
    );
  }

  // 3. Rate Limiting Check (120 req/min)
  const token = authHeader?.replace('Bearer ', '').trim() || 'default';
  const rateLimit = checkRateLimit(token);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded (120 requests/minute)' },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          'Retry-After': String(rateLimit.resetInSeconds),
        },
      }
    );
  }

  // 4. Determine Origin (Local vs Remote)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const reqOrigin: 'local' | 'remote' = host.includes('localhost') || host.includes('127.0.0.1') ? 'local' : 'remote';

  // 5. Parse JSON Body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const authContext = {
    authMethod: authResult.authMethod || 'none',
    token: authResult.authMethod === 'oauth_token' ? token : undefined,
    staticToken: authResult.authMethod === 'static_token' ? token : undefined,
    userId: authResult.userId || undefined,
    email: authResult.email || undefined,
    workspaceId: 'ws_default_001',
  };

  // Handle single request or batch requests
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((singleReq) => handleMcpRequest(singleReq, reqOrigin, authContext))
    );
    return NextResponse.json(responses, { headers: CORS_HEADERS });
  }

  const response = await handleMcpRequest(body, reqOrigin, authContext);
  return NextResponse.json(response, { headers: CORS_HEADERS });
}

/**
 * GET - Information endpoint or SSE setup
 */
export async function GET(req: NextRequest) {
  if (!isMcpEnabled()) {
    return NextResponse.json(
      { error: 'MCP Server is disabled' },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  const authHeader = req.headers.get('authorization');
  const authResult = await verifyGatewayAuthAsync(authHeader);

  return NextResponse.json(
    {
      server: SERVER_INFO,
      status: 'online',
      transport: 'streamable-http',
      mode: 'read-only',
      authMode: authResult.authMode,
      authMethod: authResult.authMethod,
      authenticated: authResult.valid,
      toolsCount: MCP_TOOLS.length,
      tools: MCP_TOOLS.map((t: any) => ({ name: t.name, description: t.description })),
    },
    { headers: CORS_HEADERS }
  );
}
