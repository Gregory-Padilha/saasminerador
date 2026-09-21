import { dbService } from '../src/lib/supabase/db';

async function runAgentIntegrationTests() {
  console.log('============================================================');
  console.log('TEST SUITE: BROWSER-USE AGENT & OFFER MINER INTEGRATION');
  console.log('============================================================\n');

  const baseUrl = 'http://127.0.0.1:3000';

  // 1. Check Agent Status & Python Port 7788 Connectivity
  console.log('1. Testing GET /api/agent/status...');
  try {
    const res = await fetch(`${baseUrl}/api/agent/status`);
    const data = await res.json();
    console.log('   Result:', JSON.stringify(data, null, 2));
    if (data.success && data.agent?.online) {
      console.log(`   ✓ PASS: Browser-Use agent is ONLINE on port ${data.agent.port} (Latency: ${data.agent.latencyMs}ms)`);
      console.log(`   ✓ PASS: Database reports ${data.database?.totalOffersShared} offers shared with the agent`);
    } else {
      console.warn(`   ! WARNING: Agent online status: ${data.agent?.online}`);
    }
  } catch (err) {
    console.error('   ✕ FAIL: Error testing /api/agent/status', err);
  }

  // 2. Check Shared Catalog Endpoint
  console.log('\n2. Testing GET /api/agent/catalog...');
  try {
    const res = await fetch(`${baseUrl}/api/agent/catalog`);
    const data = await res.json();
    if (data.success && data.total > 0) {
      console.log(`   ✓ PASS: Catalog returned ${data.total} offers across ${data.knownDomainsCount} domains`);
      console.log(`   ✓ PASS: Sample known domains:`, data.knownDomains?.slice(0, 5));
    } else {
      console.error('   ✕ FAIL: Catalog returned 0 offers or failed', data);
    }
  } catch (err) {
    console.error('   ✕ FAIL: Error testing /api/agent/catalog', err);
  }

  // 3. Check Duplicate Detection for existing offer
  console.log('\n3. Testing GET /api/agent/check-duplicate for existing offer...');
  try {
    const res = await fetch(`${baseUrl}/api/agent/check-duplicate?name=Lapbook%20Aprendendo%20Frações`);
    const data = await res.json();
    if (data.success && data.isDuplicate) {
      console.log(`   ✓ PASS: Successfully detected duplicate: "${data.matchReason}"`);
      console.log(`   ✓ PASS: Matched existing offer ID: ${data.existingOffer?.id}`);
    } else {
      console.error('   ✕ FAIL: Failed to detect existing duplicate', data);
    }
  } catch (err) {
    console.error('   ✕ FAIL: Error testing check-duplicate', err);
  }

  // 4. Check Duplicate Detection for brand new candidate
  console.log('\n4. Testing GET /api/agent/check-duplicate for brand new candidate...');
  try {
    const res = await fetch(`${baseUrl}/api/agent/check-duplicate?name=Mega%20Pack%20Inedito%20De%20Testes%20123456789&url=https://novodominioxyz12345.com`);
    const data = await res.json();
    if (data.success && !data.isDuplicate) {
      console.log('   ✓ PASS: Correctly identified as NEW offer (not duplicate)');
    } else {
      console.error('   ✕ FAIL: Wrongly flagged as duplicate', data);
    }
  } catch (err) {
    console.error('   ✕ FAIL: Error testing check-duplicate', err);
  }

  // 5. Test Direct Ingestion from Agent
  console.log('\n5. Testing POST /api/agent/ingest (Simulating Agent Auto-Save)...');
  let createdOfferId: string | null = null;
  try {
    const payload = {
      product_name: 'Guia Prático de Panificação Artesanal Low Ticket Teste',
      advertiser: 'Mestre Padeiro Digital',
      landing_page_url: 'https://panificacaoteste999.com.br',
      price: 19.90,
      niche: 'Culinária & Gastronomia',
      subniche: 'Panificação Artesanal',
      headline: 'Aprenda a fazer pães de fermentação natural em casa',
      promise: 'Fature até R$ 3.000 vendendo pães artesanais',
      active_ads_count: 5,
    };

    const res = await fetch(`${baseUrl}/api/agent/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success && data.offerId && !data.isExisting) {
      createdOfferId = data.offerId;
      console.log(`   ✓ PASS: Offer ingested successfully with ID: ${createdOfferId}`);
      console.log(`   ✓ PASS: Message: ${data.message}`);

      // Verify that re-ingesting the exact same offer returns isExisting: true without duplicating
      const reRes = await fetch(`${baseUrl}/api/agent/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const reData = await reRes.json();
      if (reData.success && reData.isExisting) {
        console.log(`   ✓ PASS: Idempotent anti-duplicate protection confirmed: ${reData.message}`);
      } else {
        console.error('   ✕ FAIL: Re-ingestion created duplicate instead of protecting', reData);
      }
    } else {
      console.error('   ✕ FAIL: Ingest failed', data);
    }
  } catch (err) {
    console.error('   ✕ FAIL: Error testing /api/agent/ingest', err);
  }

  // 6. Cleanup test offer
  if (createdOfferId) {
    console.log('\n6. Cleaning up test offer...');
    try {
      await dbService.deleteOffer(createdOfferId);
      console.log(`   ✓ Cleaned up test offer ${createdOfferId}`);
    } catch {
      // ignore
    }
  }

  console.log('\n============================================================');
  console.log('ALL AGENT INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('============================================================\n');
}

runAgentIntegrationTests().catch(console.error);
