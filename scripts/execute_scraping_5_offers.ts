import { dbService } from '../src/lib/supabase/db';
import { OfferDataScrapingService } from '../src/lib/scraping/service';

async function main() {
  const targetIds = [
    '10834507-ebd2-4d7e-aeea-b10a9a30ed3c', // Lapbook Aprendendo Frações
    'a25915a6-86ef-468e-8eb5-34ae8f2a93f4', // Aulas de Alemão Gratuitas
    '29884b22-944f-4707-b3fb-64040b6e9829', // Pack com +200 Dinâmicas Terapêuticas para CAPS
    '56be4ed3-8d69-4b26-aa69-48894843e0fd', // Caderno de Consciência Fonológica – 1º e 2º Ano
    '78d71394-c4db-45aa-b33d-d3ab3226d895', // Dinâmicas de Computação para BNCC
  ];

  console.log('=== INICIANDO RASPAGEM & ENRIQUECIMENTO DAS 5 OFERTAS ===\n');

  for (const id of targetIds) {
    const beforeOffer = await dbService.getOfferById(id);
    console.log(`------------------------------------------------------------`);
    console.log(`OFERTA: ${beforeOffer?.product_name}`);
    console.log(`BEFORE:`);
    console.log(`  - Preço: R$ ${beforeOffer?.price ?? '—'}`);
    console.log(`  - Nicho: ${beforeOffer?.niche ?? '—'} (Subnicho: ${beforeOffer?.subniche ?? '—'})`);
    console.log(`  - Active Ads: ${beforeOffer?.active_ads_count ?? '—'}`);
    console.log(`  - Criativos: ${beforeOffer?.captured_creatives_count ?? beforeOffer?.unique_creatives_count ?? '—'}`);
    console.log(`  - Dias Ativo: ${beforeOffer?.days_running ?? '—'}`);
    console.log(`  - Status Scraping: ${beforeOffer?.data_scraping_status ?? 'NOT_PROCESSED'}`);
    console.log(`  - Checkout Platform: ${beforeOffer?.checkout_platform ?? '—'}`);
    console.log(`  - Meta Seed ID: ${beforeOffer?.meta_ad_seed_id ?? '—'}`);

    const result = await OfferDataScrapingService.scrapeAndEnrichOffer(id);

    const afterOffer = await dbService.getOfferById(id);
    console.log(`\nRESULTADO DA EXECUÇÃO:`);
    console.log(`  - Status: ${result.status}`);
    console.log(`  - Enriched Fields: ${result.fieldsEnrichedCount}`);
    console.log(`  - Conflicts: ${result.conflicts?.length || 0}`);
    if (result.conflicts?.length) {
      console.log(`    Conflicts detail:`, JSON.stringify(result.conflicts, null, 2));
    }
    console.log(`AFTER:`);
    console.log(`  - Preço: R$ ${afterOffer?.price ?? '—'}`);
    console.log(`  - Nicho: ${afterOffer?.niche ?? '—'} (Subnicho: ${afterOffer?.subniche ?? '—'})`);
    console.log(`  - Active Ads: ${afterOffer?.active_ads_count ?? '—'}`);
    console.log(`  - Criativos: ${afterOffer?.captured_creatives_count ?? afterOffer?.unique_creatives_count ?? '—'}`);
    console.log(`  - Dias Ativo: ${afterOffer?.days_running ?? '—'}`);
    console.log(`  - Status Scraping: ${afterOffer?.data_scraping_status}`);
    console.log(`  - Checkout Platform: ${afterOffer?.checkout_platform ?? '—'}`);
    console.log(`  - Meta Seed ID: ${afterOffer?.meta_ad_seed_id ?? '—'}`);
    console.log(`  - Offer Name: ${afterOffer?.product_name}`);
    console.log(`  - Scale Tier: ${afterOffer?.scale_tier ?? '—'}`);
    console.log(`  - Bumps: ${afterOffer?.order_bumps?.length ?? 0}`);
    console.log(`------------------------------------------------------------\n`);
  }

  console.log('=== PROCESSAMENTO FINALIZADO ===');
}

main().catch(console.error);
