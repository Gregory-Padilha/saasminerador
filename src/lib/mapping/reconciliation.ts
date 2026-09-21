// ==============================================================================
// OFFER MINER - MAPPING RECONCILIATION SERVICE
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, isLandingPageMapped, isCheckoutMapped } from '@/types';
import { deriveDataStatus } from '@/lib/dossier';

export interface OfferReconciliationDetail {
  offerId: string;
  productName: string;
  advertiser?: string | null;
  oldLpStatus?: string | null;
  newLpStatus: string;
  oldCheckoutStatus?: string | null;
  newCheckoutStatus: string;
  oldDataStatus: string;
  newDataStatus: string;
  reason: string;
}

export interface ReconciliationReport {
  timestamp: string;
  dryRun: boolean;
  totalOffers: number;
  validLpMappingsPreserved: number;
  validCheckoutMappingsPreserved: number;
  falsePositiveLpFound: number;
  falsePositiveCheckoutFound: number;
  lpResetToNotMapped: number;
  checkoutResetToNotMapped: number;
  details: OfferReconciliationDetail[];
}

export class MappingReconciliationService {
  /**
   * Audits all offers in the database and optionally executes non-destructive state reconciliation.
   * In dryRun mode (default = true), returns the exact detailed report without applying DB mutations.
   */
  static async reconcileAll(dryRun: boolean = true): Promise<ReconciliationReport> {
    const offers = await dbService.getOffers();
    const details: OfferReconciliationDetail[] = [];

    let totalOffers = offers.length;
    let validLpMappingsPreserved = 0;
    let validCheckoutMappingsPreserved = 0;
    let falsePositiveLpFound = 0;
    let falsePositiveCheckoutFound = 0;
    let lpResetToNotMapped = 0;
    let checkoutResetToNotMapped = 0;

    for (const offer of offers) {
      // Fetch genuine artifacts
      const lpCaptures = await dbService.getLandingPageCaptures(offer.id);
      const validLpCaptures = lpCaptures.filter(
        (c) => c.capture_status === 'ready' || c.capture_status === 'analyzed'
      );
      const hasLpCaptures = validLpCaptures.length > 0;
      const hasLpAnalysis = Boolean((offer.extra_data as any)?.latest_lp_analysis);
      const hasGenuineLpArtifact = hasLpCaptures || hasLpAnalysis;

      const checkoutCaptures = await dbService.getCheckoutCaptures(offer.id);
      const hasVerifiedCheckoutCapture = checkoutCaptures.some((c) => c.status === 'verified');
      const hasVerifiedCheckoutExtra = (offer.extra_data as any)?.checkout_verified === true;
      const hasGenuineCheckoutArtifact = hasVerifiedCheckoutCapture || hasVerifiedCheckoutExtra;

      let newLpStatus = offer.lp_mapping_status || 'NOT_MAPPED';
      let newCheckoutStatus = offer.checkout_mapping_status || 'NOT_MAPPED';
      let newDataStatus = offer.status;
      let isLpFalsePositive = false;
      let isCheckoutFalsePositive = false;
      const reasons: string[] = [];

      // 1. LP Audit
      if (hasGenuineLpArtifact) {
        validLpMappingsPreserved++;
        newLpStatus = 'SUCCESS';
      } else {
        if (offer.lp_mapping_status === 'SUCCESS' || offer.status === 'MAPEADA') {
          isLpFalsePositive = true;
          falsePositiveLpFound++;
          lpResetToNotMapped++;
          newLpStatus = offer.lp_last_error ? 'FAILED' : 'NOT_MAPPED';
          reasons.push('LP marcada como mapeada sem existir captura/análise real no banco.');
        }
      }

      // 2. Checkout Audit
      if (hasGenuineCheckoutArtifact) {
        validCheckoutMappingsPreserved++;
        newCheckoutStatus = 'SUCCESS';
      } else {
        if (offer.checkout_mapping_status === 'SUCCESS') {
          isCheckoutFalsePositive = true;
          falsePositiveCheckoutFound++;
          checkoutResetToNotMapped++;
          newCheckoutStatus = 'NOT_MAPPED';
          reasons.push('Checkout marcado como mapeado sem existir análise ou confirmação real.');
        }
      }

      // 3. Data Status Derivation
      const tempOffer: Partial<Offer> = {
        ...offer,
        lp_mapping_status: newLpStatus as any,
        lp_mapped_at: newLpStatus === 'SUCCESS' ? (offer.lp_mapped_at || new Date().toISOString()) : null,
      };
      newDataStatus = deriveDataStatus(tempOffer);

      if (isLpFalsePositive || isCheckoutFalsePositive || offer.status !== newDataStatus) {
        details.push({
          offerId: offer.id,
          productName: offer.product_name,
          advertiser: offer.advertiser,
          oldLpStatus: offer.lp_mapping_status || 'NOT_MAPPED',
          newLpStatus,
          oldCheckoutStatus: offer.checkout_mapping_status || 'NOT_MAPPED',
          newCheckoutStatus,
          oldDataStatus: offer.status,
          newDataStatus,
          reason: reasons.join(' ') || 'Recalculated derived status based on genuine artifacts.',
        });

        if (!dryRun) {
          await dbService.updateOffer(offer.id, {
            lp_mapping_status: newLpStatus as any,
            lp_mapped_at: newLpStatus === 'SUCCESS' ? (offer.lp_mapped_at || new Date().toISOString()) : null,
            checkout_mapping_status: newCheckoutStatus as any,
            checkout_mapped_at: newCheckoutStatus === 'SUCCESS' ? (offer.checkout_mapped_at || new Date().toISOString()) : null,
            status: newDataStatus as any,
          });
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      dryRun,
      totalOffers,
      validLpMappingsPreserved,
      validCheckoutMappingsPreserved,
      falsePositiveLpFound,
      falsePositiveCheckoutFound,
      lpResetToNotMapped,
      checkoutResetToNotMapped,
      details,
    };
  }
}
