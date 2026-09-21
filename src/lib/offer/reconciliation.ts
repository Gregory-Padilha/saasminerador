import { dbService } from '@/lib/supabase/db';
import { Offer, ActiveAdsSource } from '@/types';

export interface ActiveAdsAuditDetail {
  offerId: string;
  productName: string;
  currentActiveAds: number | null;
  capturedAds: number | null;
  uniqueCreatives: number | null;
  status: 'CONFIRMED_CORRUPTION' | 'POSSIBLE_CORRUPTION' | 'NO_EVIDENCE';
  trustedValue: number | null;
  trustedSource: ActiveAdsSource | null;
  reason: string;
  proposedAction: string;
}

export interface ActiveAdsReconciliationReport {
  totalOffers: number;
  confirmedCorruptions: number;
  possibleCorruptions: number;
  noEvidence: number;
  restoredCount: number;
  details: ActiveAdsAuditDetail[];
}

export class ActiveAdsReconciliationService {
  /**
   * Audits all database offers for active_ads_count corruption caused by creative sync overwrite.
   * Restores confirmed corruptions from trusted historical snapshots when dryRun is false.
   */
  static async reconcileAll(dryRun = true): Promise<ActiveAdsReconciliationReport> {
    const offers = await dbService.getOffers();
    const details: ActiveAdsAuditDetail[] = [];

    let confirmedCount = 0;
    let possibleCount = 0;
    let noEvidenceCount = 0;
    let restoredCount = 0;

    for (const offer of offers) {
      const activeAds = offer.active_ads_count ?? null;
      const capturedAds = offer.captured_ads_count ?? (offer.ads?.length || null);
      const uniqueCreatives = offer.captured_unique_creatives ?? offer.unique_creatives_count ?? null;
      const snapshots = offer.snapshots || [];

      // Extract historical active_ads_count values from snapshots
      const historicalSnaps = snapshots
        .map((s) => s.active_ads_count)
        .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));

      const maxHistoricalSnap = historicalSnaps.length > 0 ? Math.max(...historicalSnaps) : null;
      const previousTrusted = maxHistoricalSnap && maxHistoricalSnap > (activeAds || 0) ? maxHistoricalSnap : null;

      let status: 'CONFIRMED_CORRUPTION' | 'POSSIBLE_CORRUPTION' | 'NO_EVIDENCE' = 'NO_EVIDENCE';
      let trustedValue: number | null = null;
      let trustedSource: ActiveAdsSource | null = null;
      let reason = '';
      let proposedAction = '';

      if (previousTrusted !== null && activeAds !== null && capturedAds !== null && activeAds <= capturedAds) {
        status = 'CONFIRMED_CORRUPTION';
        confirmedCount++;
        trustedValue = previousTrusted;
        trustedSource = 'HISTORICAL_SNAPSHOT';
        reason = `O campo active_ads_count foi sobrescrito para ${activeAds} (igual a contagem de ads capturados ${capturedAds}), enquanto o histórico de snapshots comprova o valor real de ${previousTrusted} ads ativos.`;
        proposedAction = `Restaurar active_ads_count para ${previousTrusted} a partir do histórico validado (HISTORICAL_SNAPSHOT).`;
      } else if (activeAds !== null && capturedAds !== null && activeAds === capturedAds && activeAds <= 50) {
        status = 'POSSIBLE_CORRUPTION';
        possibleCount++;
        reason = `active_ads_count (${activeAds}) coincide com a contagem de ads capturados (${capturedAds}), porém não há snapshot histórico superior registrado.`;
        proposedAction = `Manter valor e sinalizar ACTIVE_ADS_NEEDS_REFRESH para re-verificação.`;
      } else {
        noEvidenceCount++;
        reason = 'Métricas coerentes. Nenhuma evidência de corrupção.';
        proposedAction = 'Nenhuma ação necessária.';
      }

      const detail: ActiveAdsAuditDetail = {
        offerId: offer.id,
        productName: offer.product_name,
        currentActiveAds: activeAds,
        capturedAds,
        uniqueCreatives,
        status,
        trustedValue,
        trustedSource,
        reason,
        proposedAction,
      };

      details.push(detail);

      // Execute restoration if confirmed corruption and not dry run
      if (!dryRun && status === 'CONFIRMED_CORRUPTION' && trustedValue !== null) {
        await dbService.updateActiveAdsCount(
          offer.id,
          trustedValue,
          trustedSource || 'HISTORICAL_SNAPSHOT'
        );
        restoredCount++;
        console.log(
          `[RECONCILIATION RESTORED] Offer "${offer.product_name}" (${offer.id}): active_ads_count restored ${activeAds} -> ${trustedValue}`
        );
      }
    }

    return {
      totalOffers: offers.length,
      confirmedCorruptions: confirmedCount,
      possibleCorruptions: possibleCount,
      noEvidence: noEvidenceCount,
      restoredCount,
      details: details.filter((d) => d.status !== 'NO_EVIDENCE'),
    };
  }
}
