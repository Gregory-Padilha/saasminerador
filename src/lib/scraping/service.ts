// ==============================================================================
// OFFER MINER - DATA SCRAPING & ENRICHMENT SERVICE
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, OfferReconciliationReport, ScrapingJobStep } from '@/types';
import { collectFromExistingArtifacts } from './collectors/ExistingArtifactCollector';
import { collectLandingPageData } from './collectors/LandingPageDataCollector';
import { collectMetaAdsData } from './collectors/MetaAdsDataCollector';
import { collectCreativeData } from './collectors/CreativeDataCollector';
import { collectCheckoutData } from './collectors/CheckoutDataCollector';
import { reconcileOfferData } from './reconciler';
import { notifyGlobalSync } from '@/lib/events/offer-events';

export interface ScrapingOptions {
  onProgress?: (step: ScrapingJobStep, percent: number, message: string) => void;
  forceRefresh?: boolean;
}

export class OfferDataScrapingService {
  /**
   * Executes the full scraping and enrichment pipeline for a single offer.
   */
  static async scrapeAndEnrichOffer(
    offerId: string,
    options: ScrapingOptions = {}
  ): Promise<OfferReconciliationReport> {
    const { onProgress } = options;

    const offer = await dbService.getOfferById(offerId);
    if (!offer) {
      throw new Error(`Oferta com ID ${offerId} não encontrada para raspagem.`);
    }

    console.log(`[SCRAPING SERVICE] Starting scrape and enrich for: "${offer.product_name}" (${offer.id})`);

    // Step 1: QUEUED / START
    onProgress?.('QUEUED', 5, 'Iniciando pipeline de raspagem...');

    // Mark offer as RUNNING
    await dbService.updateOffer(offer.id, {
      data_scraping_status: 'RUNNING',
      data_scraping_started_at: new Date().toISOString(),
    });

    // Step 2: LOADING_ARTIFACTS
    onProgress?.('LOADING_ARTIFACTS', 15, 'Carregando artefatos e histórico existentes...');
    const existingArtifacts = await collectFromExistingArtifacts(offer);

    // Step 3: SCRAPING_LP
    onProgress?.('SCRAPING_LP', 30, 'Extraindo dados comerciais e semânticos da Landing Page...');
    const lpHarvest = await collectLandingPageData(offer);

    // Step 4: SCRAPING_META_ADS & CLUSTERING_ADS
    onProgress?.('SCRAPING_META_ADS', 45, 'Identificando anúncios e sementes do Meta Ads...');
    const metaHarvest = await collectMetaAdsData(offer);

    onProgress?.('CLUSTERING_ADS', 60, 'Construindo cluster de anúncios específicos da oferta...');

    // Step 5: PROCESSING_CREATIVES
    onProgress?.('PROCESSING_CREATIVES', 70, 'Deduplicando e catalogando criativos...');
    const creativeHarvest = await collectCreativeData(offer, metaHarvest.cluster);

    // Step 6: SCRAPING_CHECKOUT
    onProgress?.('SCRAPING_CHECKOUT', 80, 'Verificando dados e order bumps do Checkout canônico...');
    const checkoutHarvest = await collectCheckoutData(offer);

    // Step 7: RECONCILING
    onProgress?.('RECONCILING', 90, 'Reconciliando fontes, detectando conflitos e calculando proveniência...');
    const { patch, report, status } = reconcileOfferData({
      currentOffer: offer,
      existingArtifacts,
      lp: lpHarvest,
      meta: metaHarvest,
      creative: creativeHarvest,
      checkout: checkoutHarvest,
    });

    // Step 8: PERSISTING
    onProgress?.('PERSISTING', 95, 'Persistindo dados enriquecidos no catálogo...');
    await dbService.updateOffer(offer.id, patch);

    // Save snapshot of enriched observation
    try {
      const activeAds = patch.active_ads_count ?? offer.active_ads_count;
      if (typeof activeAds === 'number') {
        await dbService.addSnapshot(offer.id, activeAds, patch.price ?? offer.price ?? null);
      }
    } catch (snapErr) {
      console.warn('[SCRAPING SERVICE] Snapshot creation warning:', snapErr);
    }

    // Step 9: COMPLETE
    onProgress?.('COMPLETE', 100, `Raspagem concluída com status ${status}!`);
    console.log(`[SCRAPING SERVICE] Finished for "${offer.product_name}": ${status} (${report.fieldsEnrichedCount} campos enriquecidos)`);

    // Emit live global sync event
    try {
      notifyGlobalSync('offer_enriched');
    } catch {
      // ignore
    }

    return report;
  }
}
