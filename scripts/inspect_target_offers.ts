import { dbService } from '../src/lib/supabase/db';
import { OfferDataScrapingService } from '../src/lib/scraping/service';

async function main() {
  const offers = await dbService.getOffers();
  const targetNames = [
    'Lapbook Aprendendo Frações',
    'Aulas de Alemão Gratuitas',
    'Pack com +200 Dinâmicas Terapêuticas para CAPS',
    'Caderno de Consciência Fonológica',
    'Dinâmicas de Computação para BNCC',
  ];

  console.log(`Total offers in db: ${offers.length}`);

  const targets = offers.filter((o) =>
    targetNames.some((t) => o.product_name.toLowerCase().includes(t.toLowerCase()))
  );

  console.log(`Found ${targets.length} target offers:`);
  for (const t of targets) {
    console.log(`\n========================================`);
    console.log(`ID: ${t.id}`);
    console.log(`Name: ${t.product_name}`);
    console.log(`Advertiser: ${t.advertiser}`);
    console.log(`Niche: ${t.niche}`);
    console.log(`Price: ${t.price}`);
    console.log(`Active Ads: ${t.active_ads_count}`);
    console.log(`Creatives: ${t.unique_creatives_count || t.captured_creatives_count}`);
    console.log(`Days running: ${t.days_running}`);
    console.log(`LP URL: ${t.landing_page_url}`);
    console.log(`Checkout URL: ${t.checkout_url}`);
    console.log(`Meta Seed ID: ${t.meta_ad_seed_id}`);
    console.log(`Mapping Status: ${t.mapping_status} (LP: ${t.lp_mapping_status}, Checkout: ${t.checkout_mapping_status})`);
    console.log(`Scraping Status: ${t.data_scraping_status}`);
  }
}

main().catch(console.error);
