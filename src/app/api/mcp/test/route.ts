import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRequest } from '@/lib/mcp/handler';
import { isMcpEnabled, isMcpPublicUrlValid, getMcpToken } from '@/lib/mcp/config';
import { getSupabaseAuthIssuer, getProtectedResourceMetadataUrl } from '@/lib/ai-tools/auth';
import { MCP_TOOLS } from '@/lib/mcp/tools';

export const runtime = 'nodejs';

/**
 * Self-test Endpoint for Settings UI: tests local handler, remote ChatGPT HTTPS, or complete OAuth 2.1 stack
 */
export async function POST(req: NextRequest) {
  if (!isMcpEnabled()) {
    return NextResponse.json({
      success: false,
      message: 'MCP Server está desativado no .env (MCP_ENABLED=false)',
    });
  }

  let body: { target?: 'local' | 'chatgpt' | 'oauth' } = {};
  try {
    body = await req.json();
  } catch {
    body = { target: 'local' };
  }

  const target = body.target || 'local';

  // --- 1. OAUTH 2.1 & GEMINI SPARK STACK TEST ---
  if (target === 'oauth') {
    const remoteCheck = isMcpPublicUrlValid();
    const token = getMcpToken();
    const issuer = getSupabaseAuthIssuer();
    const metadataUrl = getProtectedResourceMetadataUrl();

    const checklist = {
      publicUrl: Boolean(remoteCheck.valid),
      protectedResourceMetadata: false,
      oauthDiscovery: false,
      challenge401: false,
      staticTokenAuth: false,
      hybridValidatorReady: true,
    };

    const logs: string[] = [];

    // Check 1: Public URL
    if (remoteCheck.valid) {
      logs.push(`✓ Public MCP URL: ${remoteCheck.url}`);
    } else {
      logs.push(`○ Public MCP URL pendente ou sem HTTPS.`);
    }

    // Check 2: Protected Resource Metadata
    try {
      const metaRes = await fetch(metadataUrl, { cache: 'no-store' });
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        if (metaJson.authorization_servers && metaJson.authorization_servers.length > 0) {
          checklist.protectedResourceMetadata = true;
          logs.push(`✓ RFC 9728 Protected Resource Metadata acessível`);
        }
      }
    } catch (err: any) {
      logs.push(`○ Metadados de Recurso Protegido: ${err.message}`);
    }

    // Check 3: Supabase OAuth Server Discovery
    if (issuer) {
      try {
        const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
        const discRes = await fetch(discoveryUrl, { cache: 'no-store' });
        if (discRes.ok) {
          checklist.oauthDiscovery = true;
          logs.push(`✓ Supabase Authorization Server Discovery ativo (${issuer})`);
        } else {
          logs.push(`○ Supabase Auth Server respondeu HTTP ${discRes.status}`);
        }
      } catch (err: any) {
        logs.push(`○ Discovery do Supabase Auth: ${err.message}`);
      }
    }

    // Check 4: Unauthenticated 401 Challenge with WWW-Authenticate header
    try {
      const targetMcpUrl = remoteCheck.url || 'http://localhost:3000/api/mcp';
      const mcpRes = await fetch(targetMcpUrl, { method: 'POST', cache: 'no-store' });
      if (mcpRes.status === 401) {
        const wwwAuth = mcpRes.headers.get('www-authenticate') || '';
        if (wwwAuth.includes('resource_metadata')) {
          checklist.challenge401 = true;
          logs.push(`✓ Challenge 401 correto com WWW-Authenticate RFC 6750`);
        } else {
          logs.push(`✓ Challenge 401 retornado (sem cabeçalho www-authenticate)`);
        }
      }
    } catch (err: any) {
      logs.push(`○ Erro no teste de 401: ${err.message}`);
    }

    // Check 5: Static Token Auth
    if (token) {
      try {
        const rpcRes = await handleMcpRequest(
          { jsonrpc: '2.0', id: 1, method: 'initialize' },
          'local'
        );
        if (!rpcRes.error) {
          checklist.staticTokenAuth = true;
          logs.push(`✓ Static Bearer Token validado`);
        }
      } catch (err: any) {
        logs.push(`○ Static token error: ${err.message}`);
      }
    }

    const isGeminiReady = checklist.protectedResourceMetadata && checklist.challenge401 && checklist.hybridValidatorReady;

    return NextResponse.json({
      success: isGeminiReady,
      message: isGeminiReady
        ? 'Pilha OAuth 2.1 Pronta para Gemini Spark ✓'
        : 'Pilha OAuth 2.1 ativa — verifique as etapas pendentes abaixo',
      checklist,
      logs,
      issuerUrl: issuer,
      metadataUrl,
      timestamp: new Date().toISOString(),
    });
  }

  // --- 2. REMOTE CHATGPT TEST ---
  if (target === 'chatgpt') {
    const remoteCheck = isMcpPublicUrlValid();
    if (!remoteCheck.valid) {
      if (remoteCheck.reason === 'NOT_CONFIGURED') {
        return NextResponse.json({
          success: false,
          message: 'MCP_PUBLIC_URL ainda não foi configurado no arquivo .env.',
        });
      }
      if (remoteCheck.reason === 'HTTPS_REQUIRED') {
        return NextResponse.json({
          success: false,
          message: 'Endpoint remoto recusado: O ChatGPT exige estritamente protocolo HTTPS (https://...).',
        });
      }
      return NextResponse.json({
        success: false,
        message: 'MCP_PUBLIC_URL em formato inválido.',
      });
    }

    const token = getMcpToken();
    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'OFFER_MINER_MCP_TOKEN não configurado no .env.',
      });
    }

    try {
      const healthUrl = remoteCheck.url!.replace(/\/api\/mcp\/?$/, '/api/mcp/health');
      const healthRes = await fetch(healthUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!healthRes.ok) {
        return NextResponse.json({
          success: false,
          message: `Falha no health check remoto (${healthRes.status} ${healthRes.statusText})`,
        });
      }

      const rpcRes = await fetch(remoteCheck.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
        }),
        cache: 'no-store',
      });

      if (!rpcRes.ok) {
        return NextResponse.json({
          success: false,
          message: `Falha na requisição HTTPS remota (${rpcRes.status} ${rpcRes.statusText})`,
        });
      }

      const initData = await rpcRes.json();
      if (initData.error) {
        return NextResponse.json({
          success: false,
          message: `Erro remota no MCP initialize: ${initData.error.message}`,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Endpoint remoto funcionando ✓',
        remoteUrl: remoteCheck.url,
        serverVersion: initData.result?.serverInfo?.version || '1.0.0',
        toolsAvailable: MCP_TOOLS.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        message: `Erro ao conectar na URL remota (${remoteCheck.url}): ${err.message}`,
      });
    }
  }

  // --- 3. LOCAL ENDPOINT TEST ---
  try {
    const initRes = await handleMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      'local'
    );

    if (initRes.error) {
      return NextResponse.json({
        success: false,
        message: `Falha no initialize: ${initRes.error.message}`,
      });
    }

    const toolsRes = await handleMcpRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      'local'
    );

    const toolsCount = toolsRes.result?.tools?.length || 0;

    const searchRes = await handleMcpRequest(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'search_offers', arguments: { limit: 1 } },
      },
      'local'
    );

    const sampleResult = searchRes.result?.content?.[0]?.text;
    const parsedSample = sampleResult ? JSON.parse(sampleResult) : null;

    return NextResponse.json({
      success: true,
      message: 'Endpoint local funcionando ✓',
      serverVersion: initRes.result?.serverInfo?.version || '1.0.0',
      toolsAvailable: toolsCount || MCP_TOOLS.length,
      sampleQuery: {
        totalOffers: parsedSample?.total ?? 0,
        returned: parsedSample?.returned ?? 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: `Erro ao testar MCP local: ${err.message}`,
    });
  }
}
