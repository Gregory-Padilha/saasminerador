// ==============================================================================
// OFFER MINER - OFFER READ MODEL (SINGLE SOURCE OF TRUTH)
// ==============================================================================

import { Offer, OfferReadModel } from '@/types';
import {
  getOfferEnrichmentState,
  deriveDataStatus,
  deriveDaysRunning,
  getOfferPipelineBreakdown,
} from '@/lib/dossier';

/**
 * Builds the canonical read model for an offer.
 * Unifies raw fields, denormalized metrics, pipeline stages breakdown, and enrichment status.
 * This guarantees cards, table rows, and dossiers read consistent derived metrics without discrepancies.
 */
export function buildOfferReadModel(offer: Offer): OfferReadModel {
  const { state: enrichmentState, missingRequirements } = getOfferEnrichmentState(offer);
  const dataStatus = deriveDataStatus(offer);
  const stages = getOfferPipelineBreakdown(offer);
  const daysRunning = deriveDaysRunning(offer);

  let badgeLabel = 'DADOS PARCIAIS';
  switch (enrichmentState) {
    case 'MAPPED':
      badgeLabel = 'MAPEADA';
      break;
    case 'MAPPING':
      badgeLabel = 'MAPEANDO...';
      break;
    case 'PARTIAL':
      badgeLabel = 'DADOS PARCIAIS';
      break;
    case 'UNMAPPED':
      badgeLabel = 'NÃO MAPEADA';
      break;
    case 'FAILED':
      badgeLabel = 'FALHA';
      break;
    case 'STALE':
      badgeLabel = 'DESATUALIZADA';
      break;
  }

  // If status is ANALISADA with dossier, preserve ANALISADA label
  if (dataStatus === 'ANALISADA') {
    badgeLabel = 'ANALISADA';
  } else if (offer.data_scraping_status === 'SUCCESS') {
    badgeLabel = 'ENRIQUECIDA';
  }

  const priceConflict = offer.data_scraping_reconciliation?.conflicts?.find(
    (c) => c.field === 'price'
  ) || null;

  return {
    id: offer.id,
    product_name: offer.product_name,
    advertiser: offer.advertiser,
    enrichment_state: enrichmentState,
    data_status: dataStatus,
    badge_label: badgeLabel,
    stages,
    metrics: {
      price: offer.price ?? stages.landingPage.price,
      active_ads_count: offer.active_ads_count ?? stages.scale.activeAdsCount,
      days_running: daysRunning,
      unique_creatives_count: offer.unique_creatives_count ?? stages.creatives.count,
      captured_creatives_count: offer.captured_creatives_count ?? null,
    },
    missing_requirements: missingRequirements,
    can_be_mapped:
      !stages.landingPage.isMapped ||
      (stages.checkout.discoveryStatus === 'FOUND' && !stages.checkout.isProcessed),
    scraping_status: offer.data_scraping_status || 'NOT_PROCESSED',
    reconciliation: offer.data_scraping_reconciliation || null,
    price_conflict: priceConflict,
  };
}
