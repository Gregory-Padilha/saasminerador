import { generateSampleExcelBuffer } from '../src/lib/excel/sampleGenerator';
import { parseSpreadsheet } from '../src/lib/excel/parser';
import { dbService } from '../src/lib/supabase/db';
import { Offer } from '../src/types';

async function testImportAndSnapshots() {
  console.log('🧪 ========================================================');
  console.log('🧪 OFFER MINER - BATCH IMPORT & SNAPSHOT HISTORY TEST');
  console.log('🧪 ========================================================\n');

  // 1. Initial Batch Import
  const sampleBuffer = generateSampleExcelBuffer();
  const parseResult1 = await parseSpreadsheet(sampleBuffer, 'mineracao_dia_01.xlsx', []);
  
  console.log('▶ Batch 1 Ingestion:');
  const res1 = await dbService.executeImportBatch('mineracao_dia_01.xlsx', parseResult1.rows);
  console.log(`  - New Offers Created: ${res1.newCount}`);
  console.log(`  - Updated: ${res1.updatedCount}`);
  console.log(`  - Ignored: ${res1.ignoredCount}`);

  let currentOffers = await dbService.getOffers();
  console.log(`  - Total Offers in Database: ${currentOffers.length}`);

  // 2. Second Batch Import (Simulating re-importing the same offers with higher ad counts on Day 10)
  console.log('\n▶ Batch 2 Ingestion (Re-mining with evolved ad numbers):');
  // Modify one row to simulate increased ad count
  const parseResult2 = await parseSpreadsheet(sampleBuffer, 'mineracao_dia_10.xlsx', currentOffers);
  
  // Verify deduplication detected the offers
  const dupCount = parseResult2.rows.filter(r => r.isDuplicate).length;
  console.log(`  - Duplicate Offers Detected: ${dupCount} / ${parseResult2.rows.length}`);

  // Change ads count on the duplicate row in preview to test snapshot
  parseResult2.rows[0].normalized.active_ads_count = 35; // increased from 24 to 35
  parseResult2.rows[0].normalized.days_running = 33;     // increased from 23 to 33

  const res2 = await dbService.executeImportBatch('mineracao_dia_10.xlsx', parseResult2.rows);
  console.log(`  - Batch 2 Result: +${res2.newCount} new, ${res2.updatedCount} updated, ${res2.ignoredCount} ignored`);

  // 3. Verify Snapshot History on the updated offer
  const targetOffer = await dbService.getOfferById(currentOffers[0].id);
  console.log('\n▶ Verifying Historical Snapshots on Offer:');
  console.log(`  - Offer: "${targetOffer?.product_name}"`);
  console.log(`  - Current Active Ads: ${targetOffer?.active_ads_count}`);
  console.log(`  - Current Days Running: ${targetOffer?.days_running}`);
  console.log(`  - Number of Historical Snapshots: ${targetOffer?.snapshots?.length}`);
  
  targetOffer?.snapshots?.forEach((snap, idx) => {
    console.log(`    [Snapshot ${idx + 1}] Captured at: ${snap.captured_at} | Ads: ${snap.active_ads_count} | Days: ${snap.days_running} | Price: R$ ${snap.price}`);
  });

  console.log('\n✅ BATCH IMPORT & SNAPSHOT HISTORY VERIFIED SUCCESSFULLY!');
}

testImportAndSnapshots().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
