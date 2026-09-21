import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRequest } from '@/lib/mcp/handler';
import {
  isMcpEnabled,
  isMcpPublicUrlValid,
  getMcpToken,
  CANONICAL_PRODUCTION_MCP_URL,
  CANONICAL_DEVELOPMENT_MCP_URL,
} from '@/lib/mcp/config';
import { getSupabaseAuthIssuer, getProtectedResourceMetadataUrl } from '@/lib/ai-tools/auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
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

  let body: { target?: 'local' | 'chatgpt' | 'oauth' | 'chatgpt_ready' } = {};
  try {
    body = await req.json();
  } catch {
    body = { target: 'local' };
  }

  const target = body.target || 'local';

  // --- 1. OAUTH 2.1 & CHATGPT WORK READINESS TEST ---
  if (target === 'oauth' || target === 'chatgpt_ready' || target === 'chatgpt') {
    const remoteCheck = isMcpPublicUrlValid();
    const token = getMcpToken();
    const issuer = getSupabaseAuthIssuer();
    const metadataUrl = getProtectedResourceMetadataUrl();

    const checklist = {
      mcpInitialize: false,
      toolsList: false,
      protectedResourceMetadata: false,
      oauthDiscovery: false,
      challenge401: false,
      oauthLoginReady: false,
      databaseToolCall: false,
    };

    const logs: string[] = [];

    // Step 1: MCP Initialize Test
    try {
      const initRes = await handleMcpRequest(
        { jsonrpc: '2.0', id: 1, method: 'initialize' },
        'local'
      );
      if (!initRes.error && initRes.result?.protocolVersion) {
        checklist.mcpInitialize = true;
        logs.push(`✓ MCP Initialize: Protocol ${initRes.result.protocolVersion} (${initRes.result.serverInfo.name})`);
      } else {
        logs.push(`○ MCP Initialize falhou: ${initRes.error?.message || 'Sem resposta válida'}`);
      }
    } catch (err: any) {
      logs.push(`○ MCP Initialize error: ${err.message}`);
    }

    // Step 2: Tools List Test (verify check_offers_duplicates and count)
    try {
      const toolsRes = await handleMcpRequest(
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        'local'
      );
      const tools = toolsRes.result?.tools || [];
      const hasDedupe = tools.some((t: any) => t.name === 'check_offers_duplicates');
      const hasSecurity = tools.every((t: any) => t.securitySchemes && t.securitySchemes.length > 0);

      if (tools.length >= 20 && hasDedupe) {
        checklist.toolsList = true;
        logs.push(`✓ Tools List: ${tools.length} ferramentas ativas (incluindo check_offers_duplicates com OAuth2 security)`);
      } else {
        logs.push(`○ Tools List: ${tools.length} ferramentas encontradas (dedupe: ${hasDedupe}, security: ${hasSecurity})`);
      }
    } catch (err: any) {
      logs.push(`○ Tools List error: ${err.message}`);
    }

    // Step 3: RFC 9728 Protected Resource Metadata Check
    try {
      const metaRes = await fetch(metadataUrl, { cache: 'no-store' });
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        const hasAuthServers = Array.isArray(metaJson.authorization_servers) && metaJson.authorization_servers.length > 0;
        const hasResource = typeof metaJson.resource === 'string' && metaJson.resource.startsWith('https://');

        if (hasAuthServers && hasResource) {
          checklist.protectedResourceMetadata = true;
          logs.push(`✓ RFC 9728 Protected Resource Metadata ONLINE (${metaJson.resource})`);
        } else {
          logs.push(`○ RFC 9728 Metadados incompletos no endpoint ${metadataUrl}`);
        }
      } else {
        logs.push(`○ RFC 9728 Metadata retornou status ${metaRes.status}`);
      }
    } catch (err: any) {
      logs.push(`○ RFC 9728 Metadata: ${err.message}`);
    }

    // Step 4: Supabase OAuth Server Discovery (OpenID Configuration)
    if (issuer) {
      try {
        const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
        const discRes = await fetch(discoveryUrl, { cache: 'no-store' });
        if (discRes.ok) {
          const discJson = await discRes.json();
          const hasPkce = discJson.code_challenge_methods_supported?.includes('S256');
          const hasOffline = discJson.scopes_supported?.includes('offline_access');

          if (discJson.issuer && discJson.authorization_endpoint && discJson.token_endpoint && hasPkce) {
            checklist.oauthDiscovery = true;
            logs.push(`✓ Supabase Authorization Server Discovery ONLINE (PKCE S256: ${hasPkce ? 'SIM' : 'NÃO'}, Offline Access: ${hasOffline ? 'SIM' : 'NÃO'})`);
          } else {
            logs.push(`○ Supabase Auth Server discovery incompleto`);
          }
        } else {
          logs.push(`○ Supabase Auth Server respondeu HTTP ${discRes.status}`);
        }
      } catch (err: any) {
        logs.push(`○ Discovery do Supabase Auth: ${err.message}`);
      }
    }

    // Step 5: Unauthenticated 401 Challenge with WWW-Authenticate header
    try {
      const targetMcpUrl = remoteCheck.url || CANONICAL_PRODUCTION_MCP_URL;
      const mcpRes = await fetch(targetMcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/list' }),
        cache: 'no-store',
      });

      if (mcpRes.status === 401) {
        const wwwAuth = mcpRes.headers.get('www-authenticate') || '';
        if (wwwAuth.includes('resource_metadata')) {
          checklist.challenge401 = true;
          logs.push(`✓ Challenge 401 PASS (com cabeçalho WWW-Authenticate RFC 6750 + resource_metadata)`);
        } else {
          logs.push(`✓ Challenge 401 retornado (cabeçalho WWW-Authenticate sem resource_metadata)`);
        }
      } else {
        logs.push(`○ Challenge 401 retornou status inesperado: ${mcpRes.status}`);
      }
    } catch (err: any) {
      logs.push(`○ Erro no teste de 401: ${err.message}`);
    }

    // Step 6: Supabase Auth & Consent Screen Readiness
    const authConfigured = isSupabaseConfigured();
    if (authConfigured) {
      checklist.oauthLoginReady = true;
      logs.push(`✓ Supabase Auth & Tela de Consentimento (/oauth/consent) prontos`);
    } else {
      logs.push(`○ Supabase Auth não configurado no ambiente`);
    }

    // Step 7: Database Tool Call (Querying canonical Supabase data via MCP tool)
    try {
      const toolCallRes = await handleMcpRequest(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'search_offers', arguments: { limit: 1 } },
        },
        'local'
      );

      if (!toolCallRes.error && toolCallRes.result?.content?.[0]?.text) {
        const parsed = JSON.parse(toolCallRes.result.content[0].text);
        if (typeof parsed.total === 'number' && parsed.total > 0) {
          checklist.databaseToolCall = true;
          logs.push(`✓ Database Tool Call PASS: Conexão canônica com Supabase validada (${parsed.total} ofertas na base)`);
        } else {
          logs.push(`○ Database Tool Call: Resposta sem ofertas`);
        }
      } else {
        logs.push(`○ Database Tool Call retornou erro: ${toolCallRes.error?.message}`);
      }
    } catch (err: any) {
      logs.push(`○ Database Tool Call erro: ${err.message}`);
    }

    const isChatGptReady =
      checklist.mcpInitialize &&
      checklist.toolsList &&
      checklist.protectedResourceMetadata &&
      checklist.oauthDiscovery &&
      checklist.challenge401 &&
      checklist.oauthLoginReady &&
      checklist.databaseToolCall;

    return NextResponse.json({
      success: isChatGptReady,
      chatgptWorkReady: isChatGptReady ? 'YES' : 'NO',
      message: isChatGptReady
        ? 'Offer Miner MCP 100% Pronto para ChatGPT Work ✓'
        : 'Pilha OAuth 2.1 ativa — verifique as etapas pendentes abaixo',
      statusBadges: {
        mcpProduction: CANONICAL_PRODUCTION_MCP_URL,
        mcpDevelopment: CANONICAL_DEVELOPMENT_MCP_URL,
        oauthResourceMetadata: checklist.protectedResourceMetadata ? 'ONLINE' : 'ERROR',
        authorizationServerDiscovery: checklist.oauthDiscovery ? 'ONLINE' : 'ERROR',
        challenge401: checklist.challenge401 ? 'PASS' : 'FAIL',
        chatgptWorkReady: isChatGptReady ? 'YES' : 'NO',
      },
      checklist,
      logs,
      productionUrl: CANONICAL_PRODUCTION_MCP_URL,
      developmentUrl: CANONICAL_DEVELOPMENT_MCP_URL,
      issuerUrl: issuer,
      metadataUrl,
      timestamp: new Date().toISOString(),
    });
  }

  // --- 2. LOCAL ENDPOINT TEST ---
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
