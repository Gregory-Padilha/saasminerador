// ==============================================================================
// OFFER MINER - DATABASE URL AUDIT & SAFE BATCH REPAIR ENGINE
// ==============================================================================

import { dbService } from '../src/lib/supabase/db';
import {
  normalizeUrl,
  canonicalizeUrlForComparison,
  extractHostname,
  classifyUrl,
  CHECKOUT_HOSTNAMES,
} from '../src/lib/url-field-mapping';
import { checkDns, checkHttp } from '../src/lib/landing-page/resolver';

export interface AuditOfferResult {
  id: string;
  name: string;
  sourceFile?: string | null;
  previousLpUrl: string | null;
  newLpUrl: string | null;
  previousDomain: string | null;
  newDomain: string | null;
  metaAdsUrl: string | null;
  checkoutUrl: string | null;
  adsCount: number;
  adDestinations: string[];
  classification:
    | 'CORRETA'
    | 'REPARADA_META_ADS_COMO_LP'
    | 'REPARADA_RECUPERADA_DOS_ADS'
    | 'REPARADA_CHECKOUT_DIRETO'
    | 'REPARADA_DOMINIO_EXTRAIDO'
    | 'LP_OFFLINE_SEM_ADS'
    | 'SEM_URL_LP';
  repairReason?: string;
}

async function auditAndRepairDatabase() {
  console.log('================================================================');
  console.log('🔍 INICIANDO AUDITORIA E REPARO DA BASE DE DADOS DO OFFER MINER');
  console.log('================================================================\n');

  const offers = await dbService.getOffers();
  console.log(`Total de ofertas encontradas no banco: ${offers.length}\n`);

  const auditReport: AuditOfferResult[] = [];
  let correctedCount = 0;
  let offlineCount = 0;
  let correctCount = 0;
  let noUrlCount = 0;
  let recoveredFromAdsCount = 0;
  let directCheckoutCount = 0;

  for (const offer of offers) {
    const rawData = offer.raw_data || {};
    const ads = await dbService.getOfferAds(offer.id);
    const adDestinations = ads
      .map((a) => a.destination_url)
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

    const originalLpUrl = offer.landing_page_url;
    let newLpUrl: string | null = originalLpUrl ?? null;
    let newDomain: string | null = offer.landing_page_domain || (originalLpUrl ? extractHostname(originalLpUrl) : null);
    let newMetaAdsUrl: string | null = offer.meta_ads_url ?? null;
    let newCheckoutUrl: string | null = offer.checkout_url ?? null;
    let classification: AuditOfferResult['classification'] = 'CORRETA';
    let repairReason: string | undefined;

    // 1. Check if landing_page_url is actually a Meta Ads Library URL
    if (originalLpUrl && classifyUrl(originalLpUrl) === 'META_ADS_LIBRARY') {
      if (!newMetaAdsUrl) {
        newMetaAdsUrl = originalLpUrl;
      }
      newLpUrl = null;
      newDomain = null;
      classification = 'REPARADA_META_ADS_COMO_LP';
      repairReason = 'URL da biblioteca Meta Ads estava indevidamente salva como Landing Page.';
      correctedCount++;
    }

    // 2. Check if landing_page_url is a Checkout URL
    else if (originalLpUrl && classifyUrl(originalLpUrl) === 'CHECKOUT') {
      if (!newCheckoutUrl) {
        newCheckoutUrl = originalLpUrl;
      }
      newLpUrl = null;
      classification = 'REPARADA_CHECKOUT_DIRETO';
      repairReason = 'URL de checkout estava indevidamente salva como Landing Page.';
      correctedCount++;
    }

    // 3. If landing_page_url exists, test DNS / HTTP
    else if (originalLpUrl) {
      const normUrl = normalizeUrl(originalLpUrl);
      const host = extractHostname(normUrl);
      newDomain = host;

      const dnsResult = await checkDns(host);
      if (dnsResult.resolved) {
        // Domain is alive and working
        classification = 'CORRETA';
        correctCount++;
      } else {
        // Domain failed DNS! Let's check ad destinations for recovery
        if (adDestinations.length > 0) {
          // Group destinations
          const destCounts = new Map<string, number>();
          for (const d of adDestinations) {
            const normD = normalizeUrl(d);
            if (normD) {
              destCounts.set(normD, (destCounts.get(normD) || 0) + 1);
            }
          }
          const sortedDests = Array.from(destCounts.entries()).sort((a, b) => b[1] - a[1]);
          const topDest = sortedDests[0];

          if (topDest) {
            const topDestUrl = topDest[0];
            const topDestHost = extractHostname(topDestUrl);
            const isCheckout = classifyUrl(topDestUrl) === 'CHECKOUT';

            if (isCheckout) {
              newCheckoutUrl = topDestUrl;
              classification = 'REPARADA_CHECKOUT_DIRETO';
              repairReason = `Domínio original offline (${host}). Todos os anúncios apontam para checkout (${topDestHost}).`;
              directCheckoutCount++;
              correctedCount++;
            } else {
              // Test top destination candidate
              const candDns = await checkDns(topDestHost);
              if (candDns.resolved) {
                newLpUrl = topDestUrl;
                newDomain = topDestHost;
                classification = 'REPARADA_RECUPERADA_DOS_ADS';
                repairReason = `Domínio original offline (${host}). Recuperada LP ativa dos anúncios: ${topDestUrl} (${topDest[1]} anúncios).`;
                recoveredFromAdsCount++;
                correctedCount++;
              } else {
                classification = 'LP_OFFLINE_SEM_ADS';
                offlineCount++;
              }
            }
          } else {
            classification = 'LP_OFFLINE_SEM_ADS';
            offlineCount++;
          }
        } else {
          classification = 'LP_OFFLINE_SEM_ADS';
          offlineCount++;
        }
      }
    } else {
      classification = 'SEM_URL_LP';
      noUrlCount++;
    }

    // Apply database repair updates if needed
    const updates: Record<string, any> = {};
    let hasUpdates = false;

    if (newLpUrl !== offer.landing_page_url) {
      updates.landing_page_url = newLpUrl;
      hasUpdates = true;
    }
    if (newDomain !== offer.landing_page_domain && newDomain) {
      updates.landing_page_domain = newDomain;
      hasUpdates = true;
    }
    if (newMetaAdsUrl !== offer.meta_ads_url && newMetaAdsUrl) {
      updates.meta_ads_url = newMetaAdsUrl;
      hasUpdates = true;
    }
    if (newCheckoutUrl !== offer.checkout_url && newCheckoutUrl) {
      updates.checkout_url = newCheckoutUrl;
      hasUpdates = true;
    }

    if (classification === 'REPARADA_RECUPERADA_DOS_ADS' && newLpUrl) {
      updates.landing_page_url_resolved = newLpUrl;
      updates.landing_page_resolution_source = 'META_AD_DESTINATION';
      updates.landing_page_url_status = 'RECOVERED_FROM_ADS';
      updates.landing_page_url_last_checked_at = new Date().toISOString();
      hasUpdates = true;
    } else if (classification === 'REPARADA_CHECKOUT_DIRETO') {
      updates.landing_page_flow_type = 'DIRECT_TO_CHECKOUT';
      updates.landing_page_url_status = 'DIRECT_TO_CHECKOUT';
      updates.landing_page_url_last_checked_at = new Date().toISOString();
      hasUpdates = true;
    } else if (classification === 'LP_OFFLINE_SEM_ADS') {
      updates.landing_page_url_status = 'DNS_NOT_RESOLVED';
      updates.landing_page_url_last_checked_at = new Date().toISOString();
      hasUpdates = true;
    }

    if (hasUpdates) {
      await dbService.updateOffer(offer.id, updates);
    }

    auditReport.push({
      id: offer.id,
      name: offer.product_name,
      sourceFile: offer.source_file_name,
      previousLpUrl: originalLpUrl ?? null,
      newLpUrl,
      previousDomain: offer.landing_page_domain ?? null,
      newDomain,
      metaAdsUrl: newMetaAdsUrl ?? null,
      checkoutUrl: newCheckoutUrl ?? null,
      adsCount: ads.length,
      adDestinations: Array.from(new Set(adDestinations)),
      classification,
      repairReason,
    });
  }

  console.log('================================================================');
  console.log('📊 RELATÓRIO DE AUDITORIA E REPARO DE URLs');
  console.log('================================================================');
  console.log(`• Total de Ofertas Auditadas:       ${offers.length}`);
  console.log(`• Ofertas com LP Válida e Ativa:     ${correctCount}`);
  console.log(`• Ofertas Reparadas Automaticamente: ${correctedCount}`);
  console.log(`  - Meta Ads salvos como LP corrigidos:   ${auditReport.filter((r) => r.classification === 'REPARADA_META_ADS_COMO_LP').length}`);
  console.log(`  - LPs recuperadas dos Anúncios:         ${recoveredFromAdsCount}`);
  console.log(`  - Funis direto para checkout ajustados: ${directCheckoutCount}`);
  console.log(`• Ofertas com Domínio Offline:       ${offlineCount}`);
  console.log(`• Ofertas sem URL de LP:             ${noUrlCount}`);
  console.log('================================================================\n');

  const repairs = auditReport.filter((r) => r.classification.startsWith('REPARADA_'));
  if (repairs.length > 0) {
    console.log('📋 DETALHE DOS REPAROS REALIZADOS:');
    repairs.forEach((rep, idx) => {
      console.log(`\n[Reparo #${idx + 1}] Oferta: "${rep.name}" (ID: ${rep.id})`);
      console.log(`  Tipo: ${rep.classification}`);
      console.log(`  Motivo: ${rep.repairReason}`);
      console.log(`  URL Anterior: ${rep.previousLpUrl || '(nenhuma)'}`);
      console.log(`  Nova URL:     ${rep.newLpUrl || '(nenhuma)'}`);
      console.log(`  Novo Domínio: ${rep.newDomain || '(nenhum)'}`);
    });
  }
}

auditAndRepairDatabase().catch((err) => {
  console.error('Erro na auditoria da base:', err);
  process.exit(1);
});
