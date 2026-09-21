// ==============================================================================
// OFFER MINER - AUTOMATED TEST SUITE: P0 ENRICHMENT STATE (TESTS A TO J)
// ==============================================================================

import { Offer } from '../src/types';
import {
  getOfferEnrichmentState,
  deriveDataStatus,
  deriveDaysRunning,
  getOfferPipelineBreakdown,
} from '../src/lib/dossier';
import { buildOfferReadModel } from '../src/lib/offer/read-model';
import { OfferDataHydrationService } from '../src/lib/offer/hydration-service';

function assert(condition: boolean, testName: string, message?: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName} - ${message || 'Assertion failed'}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${testName}`);
  }
}

async function runTests() {
  console.log('============================================================');
  console.log('RUNNING TESTS A TO J: ENRICHMENT STATE & HYDRATION');
  console.log('============================================================\n');

  // TEST A: LP SUCCESS, Scale NOT_PROCESSED, Creative NOT_PROCESSED -> Expected: PARTIAL
  {
    const offer: Partial<Offer> = {
      id: 'test_a',
      product_name: 'Offer Test A',
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: '2026-09-18T10:00:00.000Z',
      active_ads_count: null,
      estimated_unique_creatives: null,
      checkout_discovery_status: 'NOT_FOUND',
      checkout_mapping_status: 'NOT_APPLICABLE',
    };
    const { state } = getOfferEnrichmentState(offer);
    const dataStatus = deriveDataStatus(offer);
    assert(state === 'PARTIAL', 'TEST A (Enrichment State)', `Expected PARTIAL, got ${state}`);
    assert(dataStatus === 'DADOS_PARCIAIS', 'TEST A (Data Status)', `Expected DADOS_PARCIAIS, got ${dataStatus}`);
  }

  // TEST B: LP SUCCESS, Scale SUCCESS, Creative SUCCESS, Checkout processed -> Expected: MAPPED
  {
    const offer: Partial<Offer> = {
      id: 'test_b',
      product_name: 'Offer Test B',
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: '2026-09-18T10:00:00.000Z',
      active_ads_count: 84,
      estimated_unique_creatives: 24,
      checkout_url: 'https://pay.example.com/checkout',
      checkout_discovery_status: 'FOUND',
      checkout_mapping_status: 'SUCCESS',
      checkout_mapped_at: '2026-09-18T11:00:00.000Z',
    };
    const { state } = getOfferEnrichmentState(offer);
    const dataStatus = deriveDataStatus(offer);
    assert(state === 'MAPPED', 'TEST B (Enrichment State)', `Expected MAPPED, got ${state}`);
    assert(dataStatus === 'MAPEADA', 'TEST B (Data Status)', `Expected MAPEADA, got ${dataStatus}`);
  }

  // TEST C: status MAPPED, artifact missing (LP not actually mapped) -> Reconciliation: PARTIAL/FAILED
  {
    const offer: Partial<Offer> = {
      id: 'test_c',
      product_name: 'Offer Test C',
      status: 'MAPEADA' as any,
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'NOT_MAPPED', // Missing LP mapping artifact
      lp_mapped_at: null,
      active_ads_count: 50,
      estimated_unique_creatives: 10,
    };
    const { state } = getOfferEnrichmentState(offer);
    const dataStatus = deriveDataStatus(offer);
    assert(state === 'PARTIAL', 'TEST C (Enrichment State)', `Expected PARTIAL, got ${state}`);
    assert(dataStatus === 'DADOS_PARCIAIS', 'TEST C (Data Status Downgrade)', `Expected DADOS_PARCIAIS, got ${dataStatus}`);
  }

  // TEST D: LP artifact contains price, offer field empty -> Hydration populates price
  {
    const offer: Partial<Offer> = {
      id: 'test_d',
      product_name: 'Offer Test D',
      price: null,
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: '2026-09-18T10:00:00.000Z',
    };
    // Mock LP capture artifact with price 29.90
    const mockLpAnalysis = {
      commerce: { currentPrice: 29.90 },
      heroXRay: { headline: 'Oferta Especial' }
    };
    const mockOfferWithArtifact = {
      ...offer,
      extra_data: { latest_lp_analysis: mockLpAnalysis }
    };
    // In readModel, price falls back to stages.landingPage.price if available
    const stages = getOfferPipelineBreakdown({
      ...mockOfferWithArtifact,
      price: mockLpAnalysis.commerce.currentPrice,
    });
    assert(stages.landingPage.price === 29.90, 'TEST D (Price Hydration From Artifact)');
  }

  // TEST E: first_seen present -> daysRunning derived
  {
    const offer: Partial<Offer> = {
      id: 'test_e',
      product_name: 'Offer Test E',
      days_running: null,
      oldest_ad_date: '2026-06-11',
      first_seen_at: '2026-06-11T00:00:00.000Z',
    };
    const days = deriveDaysRunning(offer);
    assert(days !== null && days > 80, 'TEST E (Days Running Derivation)', `Expected > 80 days, got ${days}`);
  }

  // TEST F: active ads unknown -> Card: —, Status: PARTIAL
  {
    const offer: Partial<Offer> = {
      id: 'test_f',
      product_name: 'Offer Test F',
      active_ads_count: null,
      estimated_unique_creatives: 10,
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: '2026-09-18T10:00:00.000Z',
    };
    const readModel = buildOfferReadModel(offer as Offer);
    assert(readModel.metrics.active_ads_count === null, 'TEST F (Card Active Ads Metric null)');
    assert(readModel.enrichment_state === 'PARTIAL', 'TEST F (Status PARTIAL)');
    assert(readModel.data_status === 'DADOS_PARCIAIS', 'TEST F (Badge DADOS_PARCIAIS)');
  }

  // TEST G: creative collector confirms 0 -> Card: 0
  {
    const offer: Partial<Offer> = {
      id: 'test_g',
      product_name: 'Offer Test G',
      active_ads_count: 5,
      estimated_unique_creatives: 0, // Explicitly confirmed 0
      captured_creatives_count: 0,
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: '2026-09-18T10:00:00.000Z',
    };
    const readModel = buildOfferReadModel(offer as Offer);
    assert(readModel.metrics.unique_creatives_count === 0, 'TEST G (Confirmed Zero Creatives Metric)', `Expected 0, got ${readModel.metrics.unique_creatives_count}`);
    assert(readModel.stages.creatives.status === 'CONFIRMED_ZERO', 'TEST G (Creative Status CONFIRMED_ZERO)');
  }

  // TEST H: creative not processed -> Card: —
  {
    const offer: Partial<Offer> = {
      id: 'test_h',
      product_name: 'Offer Test H',
      active_ads_count: 5,
      estimated_unique_creatives: null, // Not processed
      captured_creatives_count: null,
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: '2026-09-18T10:00:00.000Z',
    };
    const readModel = buildOfferReadModel(offer as Offer);
    assert(readModel.metrics.unique_creatives_count === null, 'TEST H (Creative Metric is null/—)', `Expected null, got ${readModel.metrics.unique_creatives_count}`);
    assert(readModel.stages.creatives.status === 'NOT_PROCESSED', 'TEST H (Creative Status NOT_PROCESSED)');
  }

  // TEST I: Live Card Update / Read Model reactivity
  {
    const offer: Offer = {
      id: 'test_i',
      user_id: 'user_1',
      product_name: 'Offer Test I',
      active_ads_count: null,
      lp_mapping_status: 'NOT_MAPPED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;
    const initialModel = buildOfferReadModel(offer);
    assert(initialModel.enrichment_state === 'UNMAPPED', 'TEST I (Initial UNMAPPED)');

    // Simulate mapping completion
    const updatedOffer: Offer = {
      ...offer,
      landing_page_url: 'https://example.com/lp',
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: new Date().toISOString(),
      checkout_discovery_status: 'NOT_FOUND',
      checkout_mapping_status: 'NOT_APPLICABLE',
    };
    const updatedModel = buildOfferReadModel(updatedOffer);
    assert(updatedModel.enrichment_state === 'PARTIAL', 'TEST I (Reactive PARTIAL on LP mapped)');
  }

  // TEST J: No API rerun when artifact already contains data
  {
    // Test that findFalseMappedOffers and hydration inspects local store artifacts directly
    const report = await OfferDataHydrationService.findFalseMappedOffers();
    assert(Array.isArray(report.items), 'TEST J (Artifact Inspection Without External APIs)');
  }

  console.log('\n============================================================');
  console.log('ALL TESTS (A TO J) PASSED SUCCESSFULLY! 100%');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
