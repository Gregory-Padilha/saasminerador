// ==============================================================================
// OFFER MINER - CANONICAL MAPPING STATS & RECONCILIATION LAYER
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { supabase, isSupabaseConfigured, createAdminSupabaseClient } from '@/lib/supabase/client';
import { MappingSummary, Offer, isLandingPageMapped } from '@/types';

/**
 * Computes canonical, single-source-of-truth statistics for the Mapping Center.
 * Ensures 100% of workspace offers are classified with zero limbo and zero stale counts.
 */
export async function getMappingStats(
  workspaceId?: string,
  client?: any
): Promise<MappingSummary> {
  const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

  let offers: Offer[] = [];
  try {
    if (workspaceId && isSupabaseConfigured() && activeClient) {
      const { data, error } = await activeClient
        .from('offers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        offers = data as Offer[];
      } else {
        offers = await dbService.getOffers();
      }
    } else {
      offers = await dbService.getOffers();
    }
  } catch (err) {
    console.warn('[getMappingStats] Fallback to dbService.getOffers:', err);
    offers = await dbService.getOffers();
  }

  // Active jobs query
  let activeJobs: any[] = [];
  try {
    if (isSupabaseConfigured() && activeClient) {
      const { data } = await activeClient
        .from('mapping_jobs')
        .select('*')
        .in('status', ['QUEUED', 'RUNNING']);
      if (Array.isArray(data)) {
        activeJobs = data;
      }
    } else {
      activeJobs = (await dbService.getMappingJobs()).filter(
        (j) => j.status === 'QUEUED' || j.status === 'RUNNING'
      );
    }
  } catch {
    // ignore
  }

  const activeJobByOfferAndType = new Map<string, any>();
  for (const job of activeJobs) {
    activeJobByOfferAndType.set(`${job.offer_id}_${job.type}`, job);
  }

  const total_offers = offers.length;

  let lp_pending = 0;
  let lp_queued = 0;
  let lp_running = 0;
  let lp_mapped = 0;
  let lp_failed = 0;

  let discovery_found = 0;
  let discovery_not_found = 0;
  let discovery_not_processed = 0;
  let discovery_invalid = 0;
  let discovery_blocked = 0;
  let discovery_failed = 0;

  let checkout_pending = 0;
  let checkout_queued = 0;
  let checkout_running = 0;
  let checkout_mapped = 0;
  let checkout_failed = 0;

  let failed_count = 0;
  let stale_count = 0;

  const now = Date.now();
  const STALE_THRESHOLD_MS = 90 * 1000; // 90 seconds without heartbeat

  for (const offer of offers) {
    const activeLpJob = activeJobByOfferAndType.get(`${offer.id}_LANDING_PAGE`);
    const activeChkJob = activeJobByOfferAndType.get(`${offer.id}_CHECKOUT`);

    const isLpCaptured = isLandingPageMapped(offer);
    const isLpFailed =
      offer.lp_mapping_status === 'FAILED' ||
      offer.landing_page_url_status === 'UNAVAILABLE' ||
      offer.landing_page_url_status === 'DNS_NOT_RESOLVED' ||
      offer.landing_page_url_status === 'INVALID_URL';

    // 1. Landing Page Classification
    if (isLpCaptured) {
      lp_mapped++;
    } else if (activeLpJob?.status === 'RUNNING') {
      const lastBeat = activeLpJob.last_heartbeat_at
        ? new Date(activeLpJob.last_heartbeat_at).getTime()
        : new Date(activeLpJob.updated_at || activeLpJob.started_at || 0).getTime();
      if (now - lastBeat > STALE_THRESHOLD_MS) {
        stale_count++;
        lp_failed++;
        failed_count++;
      } else {
        lp_running++;
      }
    } else if (activeLpJob?.status === 'QUEUED') {
      lp_queued++;
    } else if (isLpFailed) {
      lp_failed++;
      failed_count++;
    } else {
      lp_pending++;
    }

    // 2. Checkout Discovery Classification
    const disc = offer.checkout_discovery_status || 'NOT_PROCESSED';
    if (disc === 'FOUND') discovery_found++;
    else if (disc === 'NOT_FOUND') discovery_not_found++;
    else if (disc === 'NOT_PROCESSED') discovery_not_processed++;
    else if (disc === 'INVALID') discovery_invalid++;
    else if (disc === 'BLOCKED') discovery_blocked++;
    else if (disc === 'FAILED') discovery_failed++;

    // 3. Checkout Mapping Classification
    const hasDistinctCheckoutUrl = Boolean(
      offer.checkout_url &&
        offer.checkout_url.trim() !== '' &&
        (!offer.landing_page_url || offer.checkout_url.trim() !== offer.landing_page_url.trim())
    );

    if (hasDistinctCheckoutUrl || disc === 'FOUND') {
      const chkStatus = offer.checkout_mapping_status;
      if (chkStatus === 'SUCCESS') {
        checkout_mapped++;
      } else if (activeChkJob?.status === 'RUNNING') {
        checkout_running++;
      } else if (activeChkJob?.status === 'QUEUED') {
        checkout_queued++;
      } else if (chkStatus === 'FAILED') {
        checkout_failed++;
        failed_count++;
      } else {
        checkout_pending++;
      }
    }
  }

  // Active batches check
  let processing_count = lp_running + lp_queued + checkout_running + checkout_queued;

  const reconciled_percent =
    total_offers > 0 ? Math.round(((lp_mapped + lp_pending + lp_failed + lp_running + lp_queued) / total_offers) * 100) : 100;

  return {
    total_offers,
    lp_pending,
    lp_queued,
    lp_running,
    lp_mapped,
    lp_failed,
    discovery_found,
    discovery_not_found,
    discovery_not_processed,
    discovery_invalid,
    discovery_blocked,
    discovery_failed,
    checkout_pending,
    checkout_queued,
    checkout_running,
    checkout_mapped,
    checkout_failed,
    failed_count,
    processing_count,
    stale_count,
    reconciled_percent,
  };
}
