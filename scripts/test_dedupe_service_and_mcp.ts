// ==============================================================================
// TEST SUITE: DEDUPE SERVICE & MCP INTEGRATION FOR GPT WORK
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

import { OfferDuplicateService, canonicalizeOfferUrl, normalizeOfferName } from '../src/lib/offer/offer-duplicate-service';
import { executeAiTool, AI_TOOLS_LIST } from '../src/lib/ai-tools/registry';
import { MCP_TOOLS, executeMcpTool } from '../src/lib/mcp/tools';
import { handleMcpRequest } from '../src/lib/mcp/handler';
import { dbService } from '../src/lib/supabase/db';
import { Offer } from '../src/types';

async function runTests() {
  console.log('\n============================================================');
  console.log('STARTING DEDUPE SERVICE & MCP VERIFICATION SUITE');
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

  // Seed sample offer in database if not present, to ensure deterministic tests
  const seedOfferId = 'test-offer-mapa-do-amor-123';
  const sampleOffer: Partial<Offer> = {
    id: seedOfferId,
    product_name: 'Mapa do Amor',
    offer_name: 'Mapa do Amor',
    advertiser: 'Fernanda Pereira',
    landing_page_url: 'https://example.com/mapa-do-amor',
    checkout_url: 'https://pay.kiwify.com.br/abc1234',
    meta_ads_url: 'https://www.facebook.com/ads/library/?id=9876543210',
    active_ads_count: 42,
    creatives: [
      {
        id: 'cr-1',
        offer_id: seedOfferId,
        meta_ad_id: '9876543210',
      } as any,
    ],
  };

  // Mock / inject into dbService for the test run
  const originalGetOffers = dbService.getOffers.bind(dbService);
  dbService.getOffers = async () => {
    const existing = await originalGetOffers();
    // Prepend seed offer if not present
    if (!existing.some((o) => o.id === seedOfferId)) {
      return [sampleOffer as Offer, ...existing];
    }
    return existing;
  };

  // --------------------------------------------------------------------------
  // TEST 1: Same LP with tracking params
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Same LP with tracking parameters ---');
  const res1 = await OfferDuplicateService.checkOne({
    offer_name: 'Mapa do Amor',
    advertiser: 'Fernanda Pereira',
    landing_page_url: 'https://example.com/mapa-do-amor?utm_source=facebook&fbclid=IwAR123',
  });

  assert(
    res1.status === 'DUPLICATE',
    'TEST 1: Status must be DUPLICATE',
    `Got status: ${res1.status}`
  );
  assert(
    res1.confidence_basis.includes('SAME_LANDING_PAGE'),
    'TEST 1: Confidence basis must include SAME_LANDING_PAGE',
    `Got basis: ${JSON.stringify(res1.confidence_basis)}`
  );
  assert(
    res1.matches.length > 0 && res1.matches[0].offer_name === 'Mapa do Amor',
    'TEST 1: Matched offer name is Mapa do Amor',
    `Got matches: ${JSON.stringify(res1.matches)}`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Same advertiser, different product
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Same advertiser, different product ---');
  const res2 = await OfferDuplicateService.checkOne({
    offer_name: 'Guia Reconquiste em 21 Dias',
    advertiser: 'Fernanda Pereira',
    landing_page_url: 'https://example.com/reconquiste',
  });

  assert(
    res2.status === 'NEW',
    'TEST 2: Status must be NEW (never DUPLICATE only by advertiser)',
    `Got status: ${res2.status}`
  );
  assert(
    res2.matches.length === 0,
    'TEST 2: No duplicate matches found',
    `Got matches: ${JSON.stringify(res2.matches)}`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Similar Name / Candidate "Mapa do Amor 2.0" without known URL
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Similar name ("Mapa do Amor 2.0") same advertiser, no URL ---');
  const res3 = await OfferDuplicateService.checkOne({
    offer_name: 'Mapa do Amor 2.0',
    advertiser: 'Fernanda Pereira',
    landing_page_url: null,
  });

  assert(
    res3.status === 'POSSIBLE_DUPLICATE',
    'TEST 3: Status must be POSSIBLE_DUPLICATE',
    `Got status: ${res3.status}`
  );
  assert(
    res3.confidence_basis.includes('SIMILAR_NAME'),
    'TEST 3: Confidence basis must include SIMILAR_NAME',
    `Got basis: ${JSON.stringify(res3.confidence_basis)}`
  );

  // --------------------------------------------------------------------------
  // TEST 4: Bulk check with 20 candidates in 1 single call
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Bulk check with 20 candidates ---');
  const candidates20 = Array.from({ length: 20 }).map((_, i) => {
    if (i === 0) {
      // Duplicate of seeded offer by canonical LP
      return {
        candidate_id: `cand-${i}`,
        offer_name: 'Mapa do Amor',
        advertiser: 'Fernanda Pereira',
        landing_page_url: 'https://example.com/mapa-do-amor?utm_source=tiktok',
      };
    } else if (i === 1) {
      // Duplicate of seeded offer by Meta Ad ID
      return {
        candidate_id: `cand-${i}`,
        offer_name: 'Outro Titulo',
        meta_ad_id: '9876543210',
      };
    } else if (i === 2) {
      // Possible duplicate
      return {
        candidate_id: `cand-${i}`,
        offer_name: 'Mapa do Amor Nova Edicao',
        advertiser: 'Fernanda Pereira',
      };
    } else if (i === 3) {
      // Duplicate of cand-0 in the same batch (intra-batch dedupe)
      return {
        candidate_id: `cand-${i}`,
        offer_name: 'Mapa do Amor Repetido no Lote',
        landing_page_url: 'https://example.com/mapa-do-amor',
      };
    } else {
      // Unique new candidates
      return {
        candidate_id: `cand-${i}`,
        offer_name: `Produto Inédito ${i}`,
        advertiser: `Anunciante ${i}`,
        landing_page_url: `https://dominio-inedito-${i}.com/lp`,
      };
    }
  });

  const res4 = await OfferDuplicateService.checkMany({
    candidates: candidates20,
  });

  assert(
    res4.results.length === 20,
    'TEST 4: Bulk check returned exactly 20 results in 1 call',
    `Got ${res4.results.length}`
  );
  assert(
    res4.summary.checked === 20,
    'TEST 4: Summary checked count is 20',
    `Got ${res4.summary.checked}`
  );
  assert(
    res4.results[0].status === 'DUPLICATE' && res4.results[0].reason === 'SAME_CANONICAL_LANDING_PAGE',
    'TEST 4: Candidate 0 is DUPLICATE by SAME_CANONICAL_LANDING_PAGE',
    `Got: ${res4.results[0].reason}`
  );
  assert(
    res4.results[1].status === 'DUPLICATE' && res4.results[1].reason === 'SAME_META_AD',
    'TEST 4: Candidate 1 is DUPLICATE by SAME_META_AD',
    `Got: ${res4.results[1].reason}`
  );
  assert(
    res4.results[2].status === 'POSSIBLE_DUPLICATE',
    'TEST 4: Candidate 2 is POSSIBLE_DUPLICATE',
    `Got: ${res4.results[2].status}`
  );
  assert(
    res4.results[4].status === 'NEW',
    'TEST 4: Candidate 4 is NEW',
    `Got: ${res4.results[4].status}`
  );

  // --------------------------------------------------------------------------
  // TEST 5: Determinism - same 20 candidates again
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Determinism on repeated run ---');
  const res5 = await OfferDuplicateService.checkMany({
    candidates: candidates20,
  });

  const identicalResults =
    JSON.stringify(res4.results) === JSON.stringify(res5.results) &&
    JSON.stringify(res4.summary) === JSON.stringify(res5.summary);

  assert(
    identicalResults,
    'TEST 5: Repeated bulk check produces 100% deterministic output',
    'Results differed between runs'
  );

  // --------------------------------------------------------------------------
  // TEST 6: search_offers remains fully functional
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Integrity of search_offers tool ---');
  const searchOffersResult = await executeAiTool('search_offers', { limit: 5 });

  assert(
    searchOffersResult && (typeof searchOffersResult.totalOffers === 'number' || Array.isArray(searchOffersResult.offers)),
    'TEST 6: search_offers executed successfully through Canonical AI Tool Layer'
  );

  // --------------------------------------------------------------------------
  // TEST 7: MCP Tools List includes check_offer_duplicate & check_offers_duplicates
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: MCP Tools List presence ---');
  const toolListReq = {
    jsonrpc: '2.0' as const,
    id: 101,
    method: 'tools/list',
  };

  const mcpListRes = await handleMcpRequest(toolListReq);
  const mcpTools = mcpListRes.result?.tools || [];
  const hasTool1 = mcpTools.some((t: any) => t.name === 'check_offer_duplicate');
  const hasTool2 = mcpTools.some((t: any) => t.name === 'check_offers_duplicates');

  assert(
    hasTool1 && hasTool2,
    'TEST 7: MCP Inspector / tools/list lists check_offer_duplicate and check_offers_duplicates',
    `Available tools: ${mcpTools.map((t: any) => t.name).join(', ')}`
  );

  // --------------------------------------------------------------------------
  // TEST 8: GPT Work calling tools/call for check_offers_duplicates via MCP
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: MCP tools/call execution for check_offers_duplicates ---');
  const mcpCallReq = {
    jsonrpc: '2.0' as const,
    id: 102,
    method: 'tools/call',
    params: {
      name: 'check_offers_duplicates',
      arguments: {
        candidates: [
          {
            candidate_id: 'work-test-1',
            offer_name: 'Mapa do Amor',
            advertiser: 'Fernanda Pereira',
            landing_page_url: 'https://example.com/mapa-do-amor?ref=ad1',
          },
          {
            candidate_id: 'work-test-2',
            offer_name: 'Oferta Completamente Nova 999',
            advertiser: 'Novo Anunciante ABC',
            landing_page_url: 'https://novapaginaabc.com',
          },
        ],
      },
    },
  };

  const mcpCallRes = await handleMcpRequest(mcpCallReq);
  assert(
    !mcpCallRes.error,
    'TEST 8: MCP tools/call executed without error',
    `Error: ${JSON.stringify(mcpCallRes.error)}`
  );

  const contentText = mcpCallRes.result?.content?.[0]?.text;
  assert(
    typeof contentText === 'string',
    'TEST 8: MCP returned text content'
  );

  if (contentText) {
    const parsedMcpOutput = JSON.parse(contentText);
    assert(
      parsedMcpOutput.summary && parsedMcpOutput.summary.checked === 2,
      'TEST 8: MCP payload has summary with checked: 2',
      `Got: ${JSON.stringify(parsedMcpOutput.summary)}`
    );
    assert(
      parsedMcpOutput.results[0].status === 'DUPLICATE' && parsedMcpOutput.results[1].status === 'NEW',
      'TEST 8: MCP output correctly identified candidate 1 as DUPLICATE and candidate 2 as NEW'
    );
  }

  // Restore dbService
  dbService.getOffers = originalGetOffers;

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
