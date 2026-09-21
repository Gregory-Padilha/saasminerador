// ==============================================================================
// OFFER MINER - OFFER DATA HYDRATION & RECONCILIATION SERVICE
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, OfferEnrichmentState } from '@/types';
import {
  deriveDataStatus,
  deriveDaysRunning,
  getOfferEnrichmentState,
  getOfferPipelineBreakdown,
} from '@/lib/dossier';
import { buildOfferReadModel } from '@/lib/offer/read-model';
import { offerEvents } from '@/lib/events/offer-events';

export interface FalseMappedItem {
  offerId: string;
  productName: string;
  advertiser?: string | null;
  currentBadge: string;
  lpStatus: string;
  scaleStatus: string;
  creativeStatus: string;
  checkoutStatus: string;
  missingFields: string[];
  recommendedState: OfferEnrichmentState;
  recommendedDataStatus: string;
}

export interface FalseMappedReport {
  timestamp: string;
  totalOffersAudited: number;
  totalFalseMapped: number;
  items: FalseMappedItem[];
}

export interface ReconcileResult {
  timestamp: string;
  dryRun: boolean;
  totalOffers: number;
  hydratedCount: number;
  downgradedCount: number;
  preservedMappedCount: number;
  details: {
    offerId: string;
    productName: string;
    changes: string[];
    oldStatus: string;
    newStatus: string;
    enrichmentState: OfferEnrichmentState;
  }[];
}

export class OfferDataHydrationService {
  /**
   * Hydrates an offer using data already present in its canonical artifacts
   * (LP captures, checkout captures, snapshots, creatives) without re-calling external APIs.
   */
  static async hydrateOffer(offerId: string): Promise<{
    updated: boolean;
    offer: Offer;
    changes: string[];
  }> {
    const offer = await dbService.getOfferById(offerId);
    if (!offer) {
      throw new Error(`Offer with ID ${offerId} not found`);
    }

    const changes: string[] = [];
    const updates: Partial<Offer> = {};

    // 1. Hydrate Days Running from first_seen or oldest_ad_date
    if (offer.days_running === null || offer.days_running === undefined) {
      const derivedDays = deriveDaysRunning(offer);
      if (derivedDays !== null && derivedDays > 0) {
        updates.days_running = derivedDays;
        changes.push(`Dias rodando hidratado para ${derivedDays}d a partir da data de início`);
      }
    }

    // 2. Hydrate LP Artifact Data (Price, Headline)
    const lpCaptures = await dbService.getLandingPageCaptures(offerId);
    const validLp = lpCaptures.find(
      (c) => c.capture_status === 'analyzed' || c.capture_status === 'ready'
    );

    if (validLp && validLp.raw_data?.analysis) {
      const commerce = validLp.raw_data.analysis.commerce;
      const heroXRay = validLp.raw_data.analysis.heroXRay;

      // Price hydration if missing on offer
      if (
        (offer.price === null || offer.price === undefined) &&
        commerce?.currentPrice !== null &&
        commerce?.currentPrice !== undefined
      ) {
        updates.price = commerce.currentPrice;
        changes.push(`Preço R$ ${commerce.currentPrice} recuperado da análise da Landing Page`);
      }

      // Headline hydration if missing on offer
      if (
        (!offer.headline || offer.headline.trim() === '') &&
        heroXRay?.headline &&
        heroXRay.headline.trim() !== ''
      ) {
        updates.headline = heroXRay.headline.trim();
        changes.push(`Headline recuperada da análise da Landing Page: "${heroXRay.headline.trim()}"`);
      }
    }

    // 3. Hydrate Creatives Count if creatives exist in DB
    const creatives = await dbService.getCreativesByOffer(offerId);
    if (creatives.length > 0 && (!offer.captured_creatives_count || offer.captured_creatives_count === 0)) {
      updates.captured_creatives_count = creatives.length;
      changes.push(`${creatives.length} criativos persistidos recuperados do banco`);
    }

    // 4. Hydrate Scale from Snapshots if active_ads_count is missing
    if (offer.active_ads_count === null || offer.active_ads_count === undefined) {
      const snaps = (offer.snapshots || []).filter(
        (s) => s.active_ads_count !== null && s.active_ads_count !== undefined
      );
      if (snaps.length > 0) {
        // Sort newest first
        snaps.sort(
          (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        );
        updates.active_ads_count = snaps[0].active_ads_count;
        changes.push(`Volume de ${snaps[0].active_ads_count} ads ativos recuperado do histórico`);
      }
    }

    // 5. Evaluate and reconcile derived status
    const hypotheticalOffer = { ...offer, ...updates };
    const { state: newEnrichmentState } = getOfferEnrichmentState(hypotheticalOffer);
    const newStatus = deriveDataStatus(hypotheticalOffer);

    if (offer.status !== newStatus) {
      updates.status = newStatus;
      changes.push(`Status de dados atualizado de ${offer.status} para ${newStatus} (${newEnrichmentState})`);
    }

    if (changes.length > 0) {
      await dbService.updateOffer(offerId, updates);
      offerEvents.notifyGlobalSync('offer_hydrated');
    }

    return {
      updated: changes.length > 0,
      offer: { ...offer, ...updates },
      changes,
    };
  }

  /**
   * Finds all offers in the database that currently present a false "MAPEADA" badge.
   * Definition of False Mapped:
   * - Has status 'MAPEADA' (or derives 'MAPEADA')
   * - But either active_ads_count is null, creatives are not collected,
   *   or required artifacts are missing.
   */
  static async findFalseMappedOffers(): Promise<FalseMappedReport> {
    const offers = await dbService.getOffers();
    const items: FalseMappedItem[] = [];

    for (const offer of offers) {
      const isCurrentlyMapped = offer.status === 'MAPEADA';
      const { state, breakdown, missingRequirements } = getOfferEnrichmentState(offer);
      const recommendedDataStatus = deriveDataStatus(offer);

      if (isCurrentlyMapped && state !== 'MAPPED') {
        items.push({
          offerId: offer.id,
          productName: offer.product_name,
          advertiser: offer.advertiser,
          currentBadge: 'MAPEADA',
          lpStatus: breakdown.landingPage.status,
          scaleStatus: breakdown.scale.status,
          creativeStatus: breakdown.creatives.status,
          checkoutStatus: breakdown.checkout.discoveryStatus,
          missingFields: missingRequirements,
          recommendedState: state,
          recommendedDataStatus,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalOffersAudited: offers.length,
      totalFalseMapped: items.length,
      items,
    };
  }

  /**
   * Reconciles all catalog offers:
   * 1. Hydrates missing denormalized fields from artifacts without calling external APIs.
   * 2. Re-evaluates enrichment state.
   * 3. Downgrades incomplete offers from MAPEADA to DADOS_PARCIAIS.
   * 4. Preserves genuinely complete offers as MAPEADA.
   */
  static async reconcileAllOffers(dryRun: boolean = true): Promise<ReconcileResult> {
    const offers = await dbService.getOffers();
    let hydratedCount = 0;
    let downgradedCount = 0;
    let preservedMappedCount = 0;
    const details: ReconcileResult['details'] = [];

    for (const offer of offers) {
      const hydrationRes = await this.hydrateOffer(offer.id);
      const activeOffer = hydrationRes.offer;

      const { state, missingRequirements } = getOfferEnrichmentState(activeOffer);
      const expectedStatus = deriveDataStatus(activeOffer);

      const isDowngraded = offer.status === 'MAPEADA' && expectedStatus !== 'MAPEADA';
      if (isDowngraded) downgradedCount++;
      if (offer.status === 'MAPEADA' && expectedStatus === 'MAPEADA') preservedMappedCount++;
      if (hydrationRes.updated) hydratedCount++;

      if (hydrationRes.changes.length > 0 || isDowngraded) {
        details.push({
          offerId: offer.id,
          productName: offer.product_name,
          changes: hydrationRes.changes,
          oldStatus: offer.status,
          newStatus: expectedStatus,
          enrichmentState: state,
        });

        if (!dryRun && offer.status !== expectedStatus) {
          await dbService.updateOffer(offer.id, {
            status: expectedStatus,
          });
        }
      }
    }

    if (!dryRun) {
      offerEvents.notifyGlobalSync('reconciliation_completed');
    }

    return {
      timestamp: new Date().toISOString(),
      dryRun,
      totalOffers: offers.length,
      hydratedCount,
      downgradedCount,
      preservedMappedCount,
      details,
    };
  }
}
