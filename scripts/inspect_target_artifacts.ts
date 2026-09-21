import { dbService } from '../src/lib/supabase/db';

async function main() {
  const targetIds = [
    '10834507-ebd2-4d7e-aeea-b10a9a30ed3c',
    'a25915a6-86ef-468e-8eb5-34ae8f2a93f4',
    '29884b22-944f-4707-b3fb-64040b6e9829',
    '56be4ed3-8d69-4b26-aa69-48894843e0fd',
    '78d71394-c4db-45aa-b33d-d3ab3226d895',
  ];

  for (const id of targetIds) {
    const offer = await dbService.getOfferById(id);
    const lpCaptures = await dbService.getLandingPageCaptures(id);
    const checkoutCaptures = await dbService.getCheckoutCaptures(id);
    const ads = await dbService.getOfferAds(id);
    const creatives = await dbService.getCreativesByOffer(id);
    console.log(`\n=== Offer ${offer?.product_name} (${id}) ===`);
    console.log(`LP Captures: ${lpCaptures.length}`);
    console.log(`Checkout Captures: ${checkoutCaptures.length}`);
    console.log(`Ads: ${ads.length}`);
    console.log(`Creatives: ${creatives.length}`);
    console.log(`Meta URL: ${offer?.meta_ads_url || offer?.meta_ad_url || offer?.ad_url}`);
  }
}

main().catch(console.error);
