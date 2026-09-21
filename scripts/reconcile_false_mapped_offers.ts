// ==============================================================================
// OFFER MINER - RECONCILE FALSE MAPPED OFFERS SCRIPT
// ==============================================================================

import { OfferDataHydrationService } from '../src/lib/offer/hydration-service';
import { dbService } from '../src/lib/supabase/db';
import { buildOfferReadModel } from '../src/lib/offer/read-model';

async function run() {
  console.log('============================================================');
  console.log('STAGE 1: AUDITING CURRENT STATE (DRY RUN)');
  console.log('============================================================');

  const dryRunReport = await OfferDataHydrationService.findFalseMappedOffers();
  console.log(`Audited: ${dryRunReport.totalOffersAudited} offers.`);
  console.log(`False Mapped Found: ${dryRunReport.totalFalseMapped} offers.\n`);

  dryRunReport.items.forEach((item, idx) => {
    console.log(`[${idx + 1}] "${item.productName}"`);
    console.log(`    Current: ${item.currentBadge} | Recommended: ${item.recommendedState} -> ${item.recommendedDataStatus}`);
    console.log(`    Stages: LP:${item.lpStatus} | Scale:${item.scaleStatus} | Creatives:${item.creativeStatus} | Checkout:${item.checkoutStatus}`);
    console.log(`    Missing: ${item.missingFields.join(', ')}`);
  });

  console.log('\n============================================================');
  console.log('STAGE 2: APPLYING RECONCILIATION & HYDRATION (LIVE)');
  console.log('============================================================');

  const liveResult = await OfferDataHydrationService.reconcileAllOffers(false);
  console.log(`Total Offers: ${liveResult.totalOffers}`);
  console.log(`Hydrated Offers: ${liveResult.hydratedCount}`);
  console.log(`Downgraded from MAPEADA to DADOS_PARCIAIS: ${liveResult.downgradedCount}`);
  console.log(`Preserved as MAPEADA (Truly Complete): ${liveResult.preservedMappedCount}`);

  console.log('\n============================================================');
  console.log('STAGE 3: VERIFYING 5 JSON REAL OFFERS');
  console.log('============================================================');

  const targets = [
    'Lapbook Aprendendo Frações',
    'Aulas de Alemão Gratuitas',
    'Pack com +200 Dinâmicas Terapêuticas para CAPS',
    'Caderno de Consciência Fonológica – 1º e 2º Ano',
    'Dinâmicas de Computação para BNCC',
  ];

  const allOffers = await dbService.getOffers();

  for (const target of targets) {
    const offer = allOffers.find((o) => o.product_name && o.product_name.includes(target));
    if (!offer) {
      console.error(`TARGET NOT FOUND: "${target}"`);
      continue;
    }
    const readModel = buildOfferReadModel(offer);
    console.log(`\nOFFER: ${offer.product_name}`);
    console.log(`  ID: ${offer.id}`);
    console.log(`  Status in DB: ${offer.status}`);
    console.log(`  ReadModel DataStatus: ${readModel.data_status}`);
    console.log(`  Badge Label: ${readModel.badge_label}`);
    console.log(`  Enrichment State: ${readModel.enrichment_state}`);
    console.log(`  Price: ${readModel.metrics.price !== null ? 'R$ ' + readModel.metrics.price : '—'}`);
    console.log(`  Ads: ${readModel.metrics.active_ads_count !== null ? readModel.metrics.active_ads_count : '—'}`);
    console.log(`  Days Running: ${readModel.metrics.days_running !== null ? readModel.metrics.days_running + 'd' : '—'}`);
    console.log(`  Creatives: ${readModel.metrics.unique_creatives_count !== null ? readModel.metrics.unique_creatives_count : '—'}`);
    console.log(`  Stages:`);
    console.log(`    - LP: ${readModel.stages.landingPage.status} (${readModel.stages.landingPage.label})`);
    console.log(`    - Scale: ${readModel.stages.scale.status} (${readModel.stages.scale.label})`);
    console.log(`    - Creatives: ${readModel.stages.creatives.status} (${readModel.stages.creatives.label})`);
    console.log(`    - Checkout: ${readModel.stages.checkout.discoveryStatus} (${readModel.stages.checkout.label})`);
    console.log(`  Missing Requirements: ${readModel.missing_requirements.join(', ')}`);
  }

  console.log('\n============================================================');
  console.log('RECONCILIATION COMPLETED SUCCESSFULLY!');
  console.log('============================================================');
}

run().catch((err) => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
