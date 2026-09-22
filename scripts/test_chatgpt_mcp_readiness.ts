// ==============================================================================
// VERIFICATION SCRIPT: CHATGPT WORK MCP PRODUCTION READINESS & OAUTH 2.1
// ==============================================================================
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

import { handleMcpRequest } from '../src/lib/mcp/handler';
import {
  CANONICAL_PRODUCTION_MCP_URL,
  CANONICAL_RESOURCE_METADATA_URL,
  SUPABASE_OAUTH_ISSUER,
  getMcpPublicUrl,
} from '../src/lib/mcp/config';
import { getProtectedResourceMetadataUrl, getWwwAuthenticateHeader } from '../src/lib/ai-tools/auth';
import { isSupabaseConfigured } from '../src/lib/supabase/client';

async function runMcpReadinessVerification() {
  console.log('\n============================================================');
  console.log('OFFER MINER MCP - CHATGPT WORK PRODUCTION READINESS AUDIT');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Canonical Production URL (No trycloudflare dependency)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Canonical Endpoint URL ---');
  const publicUrl = getMcpPublicUrl();
  assert(
    publicUrl === 'https://saasmineracao.netlify.app/api/mcp',
    'TEST 1.1: Production MCP URL is https://saasmineracao.netlify.app/api/mcp',
    `Got: ${publicUrl}`
  );
  assert(
    !publicUrl.includes('trycloudflare.com'),
    'TEST 1.2: Zero runtime dependence on trycloudflare.com in canonical URL'
  );

  // --------------------------------------------------------------------------
  // TEST 2: MCP Initialize Handshake
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: MCP Initialize Protocol Handshake ---');
  const initRes = await handleMcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'initialize' },
    'remote'
  );
  assert(!initRes.error, 'TEST 2.1: MCP initialize executed without error');
  assert(
    initRes.result?.protocolVersion === '2024-11-05',
    'TEST 2.2: MCP protocolVersion is 2024-11-05',
    `Got: ${initRes.result?.protocolVersion}`
  );
  assert(
    initRes.result?.serverInfo?.name === 'Offer Miner MCP',
    'TEST 2.3: serverInfo.name is Offer Miner MCP'
  );

  // --------------------------------------------------------------------------
  // TEST 3: Tools List Discovery & Security Schemes
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Tools Discovery & Security Schemes ---');
  const toolsRes = await handleMcpRequest(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    'remote'
  );
  assert(!toolsRes.error, 'TEST 3.1: tools/list executed without error');

  const tools = toolsRes.result?.tools || [];
  assert(tools.length === 26, `TEST 3.2: Exactly 26 tools discovered (got ${tools.length})`);

  const dedupeTool = tools.find((t: any) => t.name === 'check_offers_duplicates');
  assert(Boolean(dedupeTool), 'TEST 3.3: check_offers_duplicates is present in tools list');
  assert(dedupeTool?.title === 'Check Offer Duplicates', 'TEST 3.4: check_offers_duplicates has title "Check Offer Duplicates"');
  assert(
    dedupeTool?.annotations?.readOnlyHint === true &&
      dedupeTool?.annotations?.destructiveHint === false &&
      dedupeTool?.annotations?.openWorldHint === false,
    'TEST 3.5: check_offers_duplicates declares readOnlyHint: true, destructiveHint: false, openWorldHint: false'
  );
  assert(
    Array.isArray(dedupeTool?._meta?.ui?.visibility) &&
      dedupeTool?._meta?.ui?.visibility.includes('model') &&
      dedupeTool?._meta?.ui?.visibility.includes('app'),
    'TEST 3.6: check_offers_duplicates UI visibility includes ["model", "app"]'
  );

  // Assert inputSchema does NOT contain any union array types like ['string', 'null']
  const candProps = dedupeTool?.inputSchema?.properties?.candidates?.items?.properties || {};
  const hasInvalidUnion = Object.values(candProps).some((p: any) => Array.isArray(p?.type));
  assert(!hasInvalidUnion, 'TEST 3.7: check_offers_duplicates inputSchema has clean JSON Schema types (no type unions)');

  // Assert outputSchema
  assert(
    dedupeTool?.outputSchema?.properties?.results && dedupeTool?.outputSchema?.properties?.summary,
    'TEST 3.8: check_offers_duplicates defines explicit outputSchema with results and summary'
  );

  // Assert top tier position (index <= 1)
  const dedupeIndex = tools.findIndex((t: any) => t.name === 'check_offers_duplicates');
  assert(dedupeIndex <= 1, `TEST 3.9: check_offers_duplicates is prioritized at position ${dedupeIndex + 1} of ${tools.length}`);

  const allHaveSecurity = tools.every(
    (t: any) =>
      Array.isArray(t.securitySchemes) &&
      t.securitySchemes.some((s: any) => s.type === 'oauth2' && s.scopes.includes('openid'))
  );
  assert(allHaveSecurity, 'TEST 3.10: All tools declare securitySchemes: oauth2 with scopes');

  // --------------------------------------------------------------------------
  // TEST 4: Protected Resource Metadata (RFC 9728) Live Verification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: RFC 9728 Protected Resource Metadata ---');
  const metadataUrl = getProtectedResourceMetadataUrl();
  assert(
    metadataUrl === 'https://saasmineracao.netlify.app/.well-known/oauth-protected-resource',
    'TEST 4.1: Metadata URL is canonical /.well-known/oauth-protected-resource',
    `Got: ${metadataUrl}`
  );

  try {
    const metaFetch = await fetch(metadataUrl, { cache: 'no-store' });
    assert(metaFetch.status === 200, `TEST 4.2: Protected resource metadata returned HTTP 200 (got ${metaFetch.status})`);

    const metaJson = await metaFetch.json();
    assert(
      metaJson.resource === 'https://saasmineracao.netlify.app/api/mcp',
      'TEST 4.3: Metadata resource is https://saasmineracao.netlify.app/api/mcp',
      `Got: ${metaJson.resource}`
    );
    assert(
      Array.isArray(metaJson.authorization_servers) &&
        metaJson.authorization_servers.includes('https://hofrcxldtmdjchbhdcno.supabase.co/auth/v1'),
      'TEST 4.4: authorization_servers contains Supabase Auth Issuer',
      `Got: ${JSON.stringify(metaJson.authorization_servers)}`
    );
    assert(
      Array.isArray(metaJson.scopes_supported) &&
        metaJson.scopes_supported.includes('offline_access'),
      'TEST 4.5: scopes_supported includes offline_access for persistent ChatGPT Work sessions',
      `Got: ${JSON.stringify(metaJson.scopes_supported)}`
    );
  } catch (err: any) {
    assert(false, 'TEST 4.2: Failed to fetch metadata', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Supabase OAuth Server Discovery (OpenID Configuration)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Supabase OAuth Server Discovery ---');
  try {
    const discRes = await fetch(`${SUPABASE_OAUTH_ISSUER}/.well-known/openid-configuration`, {
      cache: 'no-store',
    });
    assert(discRes.status === 200, `TEST 5.1: Supabase discovery returned HTTP 200 (got ${discRes.status})`);

    const discJson = await discRes.json();
    assert(
      discJson.issuer === 'https://hofrcxldtmdjchbhdcno.supabase.co/auth/v1',
      'TEST 5.2: Issuer matches Supabase project hofrcxldtmdjchbhdcno'
    );
    assert(
      Boolean(discJson.authorization_endpoint),
      'TEST 5.3: authorization_endpoint is present'
    );
    assert(
      Boolean(discJson.token_endpoint),
      'TEST 5.4: token_endpoint is present'
    );
    assert(
      discJson.code_challenge_methods_supported?.includes('S256'),
      'TEST 5.5: PKCE S256 is supported by Supabase OAuth Server'
    );
    assert(
      discJson.grant_types_supported?.includes('refresh_token'),
      'TEST 5.6: Refresh token is supported for persistent connections'
    );
  } catch (err: any) {
    assert(false, 'TEST 5.1: Failed to query Supabase OpenID discovery', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Unauthenticated 401 Challenge (HTTP & MCP Meta)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: 401 Challenge on Live Production MCP ---');
  try {
    const unauthRes = await fetch('https://saasmineracao.netlify.app/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 401, method: 'tools/list' }),
      cache: 'no-store',
    });

    assert(
      unauthRes.status === 401,
      `TEST 6.1: Unauthenticated request returns HTTP 401 (got ${unauthRes.status})`
    );

    const wwwAuthHeader = unauthRes.headers.get('www-authenticate') || '';
    assert(
      wwwAuthHeader.includes('Bearer') &&
        wwwAuthHeader.includes('resource_metadata="https://saasmineracao.netlify.app/.well-known/oauth-protected-resource"'),
      'TEST 6.2: WWW-Authenticate header matches RFC 6750 + RFC 9728 specification',
      `Got header: ${wwwAuthHeader}`
    );

    const unauthBody = await unauthRes.json();
    assert(
      unauthBody._meta && unauthBody._meta['mcp/www_authenticate'],
      'TEST 6.3: JSON body includes _meta["mcp/www_authenticate"] for ChatGPT Work',
      `Got body: ${JSON.stringify(unauthBody)}`
    );
  } catch (err: any) {
    assert(false, 'TEST 6.1: Failed live 401 challenge test', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Bulk Dedupe Tool Call with 10 Candidates (GPT Work Simulation)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Bulk Dedupe Simulation (10 candidates in 1 tool call) ---');
  const candidates10 = [
    {
      candidate_id: 'cand-01',
      offer_name: 'Escolhida Para Sempre',
      advertiser: 'Cardosomundo',
      landing_page_url: 'https://ocardosomundo.com/escolhida-para-sempre-vsl-lead3-velan/?utm_source=fb',
    },
    {
      candidate_id: 'cand-02',
      offer_name: 'Mapa do Amor',
      advertiser: 'Fernanda Pereira',
    },
    {
      candidate_id: 'cand-03',
      offer_name: 'Escolhida Para Sempre Edicao Ouro',
      advertiser: 'Cardosomundo',
    },
    {
      candidate_id: 'cand-04',
      offer_name: 'Curso de Culinaria Fit 100% Inédito 2026',
      advertiser: 'Chef Inovador ABC',
      landing_page_url: 'https://culinariafitinedita2026.com.br',
    },
    {
      candidate_id: 'cand-05',
      offer_name: 'Metodo Ingles em 30 Dias Inédito',
      advertiser: 'Teacher Desconhecido',
      landing_page_url: 'https://metodoingles30diasinedito.com',
    },
    {
      candidate_id: 'cand-06',
      offer_name: 'Guia de Investimentos Cripto Alpha',
      advertiser: 'Investimentos Alpha',
      landing_page_url: 'https://investimentosalpha2026.com',
    },
    {
      candidate_id: 'cand-07',
      offer_name: 'Protocolo Zero Ansiedade Natural',
      advertiser: 'Dra Natural',
      landing_page_url: 'https://protocolozeroansiedade.com',
    },
    {
      candidate_id: 'cand-08',
      offer_name: 'Segredos da Confeitaria Francesa',
      advertiser: 'Patisserie Nova',
      landing_page_url: 'https://confeitariafrancesasegredos.com',
    },
    {
      candidate_id: 'cand-09',
      offer_name: 'Manual do Copywriter High Ticket',
      advertiser: 'Agencia Elite',
      landing_page_url: 'https://copywriterhighticketmanual.com',
    },
    {
      candidate_id: 'cand-10',
      offer_name: 'Plano Definitivo de Trafego Pago',
      advertiser: 'Gestor Pro',
      landing_page_url: 'https://planodefinitivotrafego.com',
    },
  ];

  const dedupeCallRes = await handleMcpRequest(
    {
      jsonrpc: '2.0',
      id: 777,
      method: 'tools/call',
      params: {
        name: 'check_offers_duplicates',
        arguments: { candidates: candidates10 },
      },
    },
    'remote'
  );

  assert(!dedupeCallRes.error, 'TEST 7.1: Bulk check_offers_duplicates executed without error');
  const dedupeOutput = JSON.parse(dedupeCallRes.result?.content?.[0]?.text || '{}');

  assert(
    dedupeOutput.summary && dedupeOutput.summary.checked === 10,
    'TEST 7.2: Exactly 10 candidates checked in single tool call',
    `Got: ${dedupeOutput.summary?.checked}`
  );

  const cand1 = dedupeOutput.results?.find((r: any) => r.candidate_id === 'cand-01');
  const cand2 = dedupeOutput.results?.find((r: any) => r.candidate_id === 'cand-02');
  const cand4 = dedupeOutput.results?.find((r: any) => r.candidate_id === 'cand-04');

  assert(
    cand1?.status === 'DUPLICATE',
    'TEST 7.3: Candidate 1 (Escolhida Para Sempre) identified as DUPLICATE',
    `Got: ${cand1?.status} (${cand1?.reason})`
  );
  assert(
    cand2?.status === 'DUPLICATE' || cand2?.status === 'POSSIBLE_DUPLICATE',
    'TEST 7.4: Candidate 2 (Mapa do Amor) identified as DUPLICATE / POSSIBLE_DUPLICATE',
    `Got: ${cand2?.status}`
  );
  assert(
    cand4?.status === 'NEW',
    'TEST 7.5: Candidate 4 (Inédito) identified as NEW',
    `Got: ${cand4?.status}`
  );

  // --------------------------------------------------------------------------
  // TEST 8: Database Tool Call with Real Supabase Data
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Live Database Query via MCP (search_offers) ---');
  const searchRes = await handleMcpRequest(
    {
      jsonrpc: '2.0',
      id: 888,
      method: 'tools/call',
      params: {
        name: 'search_offers',
        arguments: { limit: 1 },
      },
    },
    'remote'
  );

  assert(!searchRes.error, 'TEST 8.1: search_offers tool call executed without error');
  const searchOutput = JSON.parse(searchRes.result?.content?.[0]?.text || '{}');
  assert(
    typeof searchOutput.total === 'number' && searchOutput.total >= 97,
    `TEST 8.2: search_offers reports valid catalog count from Supabase Cloud (got ${searchOutput.total} offers >= 97)`
  );

  // --------------------------------------------------------------------------
  // TEST 9: Static Token Still Valid for CLI / Cursor
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Static Bearer Token for CLI / Cursor ---');
  const staticToken = process.env.OFFER_MINER_MCP_TOKEN;
  assert(Boolean(staticToken), 'TEST 9.1: OFFER_MINER_MCP_TOKEN is configured in environment');

  console.log('\n============================================================');
  console.log(`MCP READINESS AUDIT RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log(`CHATGPT WORK READY: ${failed === 0 ? 'YES ✓' : 'NO ✗'}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMcpReadinessVerification().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
