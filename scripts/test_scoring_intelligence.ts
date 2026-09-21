/**
 * Test suite for the Offer Miner Scoring & Intelligence Engine
 * Run with: npx tsx scripts/test_scoring_intelligence.ts
 */

import {
  calculateDiscoveryScore,
  calculateMomentumScore,
  calculateOpportunityScore,
  validateOffer,
} from '../src/lib/scoring';
import { Offer, OfferSnapshot, UserSettings } from '../src/types';

const defaultSettings: UserSettings = {
  min_price: 10,
  max_price: 50,
  min_ads: 5,
  max_ads: 50,
  min_days: 10,
  max_days: 30,
  require_faceless: true,
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

console.log('====================================================');
console.log('🧪 RUNNING OFFER MINER SCORING INTELLIGENCE TESTS');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. DISCOVERY SCORE - EXAMPLE FROM PROMPT (SECTION 53)
// ----------------------------------------------------
console.log('--- 1. Discovery Score: Prompt Golden Example ---');

const goldenOffer: Partial<Offer> = {
  product_name: 'Kit 500 Atividades',
  advertiser: 'EducaKids',
  niche: 'Educação Infantil',
  subniche: 'Atividades Prontas',
  product_type: 'Ebook / PDF',
  price: 27.9,
  active_ads_count: 26,
  estimated_unique_creatives: 12,
  days_running: 21,
  oldest_ad_date: '2026-08-22',
  faceless: true,
  meta_ads_url: 'https://facebook.com/ads/library/?id=12345',
  landing_page_url: 'https://educakids.com.br/kit500',
  headline: '500 Atividades Educativas Prontas para Imprimir',
  ad_format: 'Carrossel / Imagem',
  work_score: 8,
};

const discoveryResult = calculateDiscoveryScore(goldenOffer);
console.log('Golden Offer Breakdown:', {
  total: discoveryResult.total,
  adsScore: discoveryResult.adsScore,
  daysScore: discoveryResult.daysScore,
  creativesScore: discoveryResult.creativesScore,
  completenessScore: discoveryResult.completenessScore,
  workScore: discoveryResult.workScore,
  priorityLabel: discoveryResult.priorityLabel,
});

assert(
  discoveryResult.adsScore === 32,
  'Ads Score for 26 ads should be 32/35',
  discoveryResult.adsScore
);
assert(
  discoveryResult.daysScore === 25,
  'Days Score for 21 days should be 25/25',
  discoveryResult.daysScore
);
assert(
  discoveryResult.creativesScore === 15,
  'Creatives Score for 12 creatives should be 15/15',
  discoveryResult.creativesScore
);
assert(
  discoveryResult.completenessScore === 10,
  'Completeness Score for 15/15 fields should be 10/10',
  discoveryResult.completenessScore
);
assert(
  discoveryResult.workScore === 12,
  'Work Score Pts for 8/10 should be 12/15',
  discoveryResult.workScore
);
assert(
  discoveryResult.total === 94 && discoveryResult.priorityLabel === 'EXCEPCIONAL',
  'Total Discovery Score should be 94/100 (32+25+15+10+12) and classified as EXCEPCIONAL',
  discoveryResult.total
);

// Also test golden example where completeness is 90% (80-90% -> 9 pts) -> 32+25+15+9+12 = 93 pts (from Section 53)
const goldenOffer90Pct: Partial<Offer> = {
  ...goldenOffer,
  subniche: undefined, // 14 of 15 fields filled = 93.3% -> 9.3 -> rounded 9 pts
};
const discoveryResult93 = calculateDiscoveryScore(goldenOffer90Pct);
assert(
  discoveryResult93.total === 93,
  'Golden Example with 14/15 fields (93%) gives exact 93/100 as specified in prompt section 53',
  discoveryResult93.total
);

// ----------------------------------------------------
// 2. MOMENTUM SCORE & OPPORTUNITY - 1 SNAPSHOT (SECTION 14 & 67)
// ----------------------------------------------------
console.log('\n--- 2. Single Snapshot: No Momentum Allowed ---');

const singleSnapshot: OfferSnapshot[] = [
  {
    id: 'snap-1',
    offer_id: 'offer-1',
    active_ads_count: 26,
    estimated_unique_creatives: 12,
    price: 27.9,
    days_running: 21,
    captured_at: '2026-09-12T10:00:00Z',
  },
];

const singleMomentum = calculateMomentumScore(singleSnapshot);
assert(
  singleMomentum.momentumScore === null,
  'Momentum Score with 1 snapshot must be NULL (no fake scores)',
  singleMomentum.momentumScore
);
assert(
  singleMomentum.trend === 'SEM_HISTORICO',
  'Momentum Trend with 1 snapshot must be SEM_HISTORICO',
  singleMomentum.trend
);

const singleOpportunity = calculateOpportunityScore(discoveryResult.total, singleMomentum.momentumScore);
assert(
  singleOpportunity === null,
  'Opportunity Score with 1 snapshot must be NULL (awaiting history)',
  singleOpportunity
);

// ----------------------------------------------------
// 3. MOMENTUM & OPPORTUNITY - 2 SNAPSHOTS (SECTION 54 & 55)
// ----------------------------------------------------
console.log('\n--- 3. Two Snapshots: Real Momentum Calculation ---');

const twoSnapshots: OfferSnapshot[] = [
  {
    id: 'snap-1',
    offer_id: 'offer-1',
    active_ads_count: 26,
    estimated_unique_creatives: 12,
    price: 27.9,
    days_running: 21,
    captured_at: '2026-09-12T10:00:00Z',
  },
  {
    id: 'snap-2',
    offer_id: 'offer-1',
    active_ads_count: 35,
    estimated_unique_creatives: 15,
    price: 27.9,
    days_running: 26,
    captured_at: '2026-09-17T10:00:00Z',
  },
];

const twoMomentum = calculateMomentumScore(twoSnapshots);
console.log('Two Snapshots Momentum:', twoMomentum);

assert(
  twoMomentum.trend === 'CRESCENDO',
  'Trend from 26 -> 35 ads (+34.6%) should be CRESCENDO',
  twoMomentum.trend
);
assert(
  twoMomentum.deltaAds === 9,
  'Delta Ads should be +9',
  twoMomentum.deltaAds
);
assert(
  twoMomentum.momentumScore === 70,
  'Momentum score for +34.6% growth should be 70 pts',
  twoMomentum.momentumScore
);

const twoOpportunity = calculateOpportunityScore(93, twoMomentum.momentumScore);
console.log('Two Snapshots Opportunity Score (93 * 0.70 + 70 * 0.30):', twoOpportunity);

assert(
  twoOpportunity === 86,
  'Opportunity Score for 93 discovery + 70 momentum should be exactly 86 pts',
  twoOpportunity
);

// ----------------------------------------------------
// 4. VALIDATION STATUS TESTS (SECTIONS 24-28)
// ----------------------------------------------------
console.log('\n--- 4. Validation Engine Semantics ---');

// Valid offer
const validOffer: Offer = {
  id: 'o1',
  product_name: 'Guia de Produtividade',
  price: 37,
  active_ads_count: 15,
  days_running: 14,
  faceless: true,
  landing_page_url: 'https://exemplo.com/lp',
  status: 'VALIDADA',
  validation_status: 'VALIDADA',
  discovery_score: 80,
  work_score: 7,
  favorite: false,
  watching: false,
  in_deep_dive: false,
  dedupe_key: 'dedupe_o1',
  created_at: '2026-09-12',
  updated_at: '2026-09-12',
};

const v1 = validateOffer(validOffer, defaultSettings);
assert(
  v1.status === 'VALIDADA' && v1.reasons.length === 0,
  'Compliant offer must be status VALIDADA',
  v1
);

// Missing critical field -> REVISAR
const missingFieldOffer: Offer = {
  ...validOffer,
  price: null as any,
};
const v2 = validateOffer(missingFieldOffer, defaultSettings);
assert(
  v2.status === 'REVISAR' && v2.warnings.some((w) => w.includes('Preço')),
  'Offer with missing price must be status REVISAR (not invalid)',
  v2
);

// Out of criteria -> INVALIDA / FORA_DOS_CRITERIOS
const outOfCriteriaOffer: Offer = {
  ...validOffer,
  price: 97, // Above max_price 50
  active_ads_count: 2, // Below min_ads 5
};
const v3 = validateOffer(outOfCriteriaOffer, defaultSettings);
assert(
  v3.status === 'INVALIDA' && v3.reasons.length >= 2,
  'Offer with R$ 97 and 2 ads must be INVALIDA with specific failure reasons',
  v3
);

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
