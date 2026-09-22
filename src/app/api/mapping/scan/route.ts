// ==============================================================================
// OFFER MINER - AUTOMATIC LIGHTWEIGHT MAPPING BASE SCAN & CLASSIFICATION
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/auth/require-workspace';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMappingStats } from '@/lib/mapping/stats';
import { dbService } from '@/lib/supabase/db';
import { isLandingPageMapped } from '@/types';

export const runtime = 'nodejs';

/**
 * Executes a lightweight, non-destructive audit and classification of the workspace's offers.
 * Automatically triggered on entering /mapping to ensure accurate counters and eliminate limbo.
 *
 * CRITICAL INVARIANT:
 * - Does NOT open browsers, run network scraping, or download creatives.
 * - Does NOT reset legitimate SUCCESS statuses.
 * - Fast execution (~50-200ms).
 */
export async function POST(req: NextRequest) {
  let wsCtx;
  try {
    wsCtx = await requireWorkspace();
  } catch (authErr: any) {
    return NextResponse.json(
      { success: false, error: authErr.message || 'Não autorizado.', code: 'UNAUTHORIZED' },
      { status: authErr.statusCode || 401 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch workspace offers
    const { data: offers, error } = await supabase
      .from('offers')
      .select('id, product_name, status, landing_page_url, landing_page_url_status, lp_mapping_status, lp_mapped_at, lp_last_error, checkout_url, checkout_discovery_status, checkout_mapping_status, checkout_mapped_at, checkout_last_error, data_scraping_status')
      .eq('workspace_id', wsCtx.workspaceId);

    if (error) {
      console.warn('[POST /api/mapping/scan] Supabase query warning:', error.message);
    }

    const offerList = (offers || []) as any[];
    let reconciledCount = 0;

    // 2. Classify and repair states non-destructively
    for (const offer of offerList) {
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // Landing page status check
      if (!offer.lp_mapping_status) {
        if (offer.status === 'MAPEADA' || offer.status === 'VALIDADA') {
          updates.lp_mapping_status = 'SUCCESS';
          updates.lp_mapped_at = offer.lp_mapped_at || new Date().toISOString();
        } else if (offer.landing_page_url_status === 'UNAVAILABLE' || offer.landing_page_url_status === 'DNS_NOT_RESOLVED') {
          updates.lp_mapping_status = 'FAILED';
        } else {
          updates.lp_mapping_status = 'NOT_MAPPED';
        }
        needsUpdate = true;
      }

      // Checkout discovery status check
      if (!offer.checkout_discovery_status) {
        if (offer.checkout_url && offer.checkout_url.trim().length > 0) {
          updates.checkout_discovery_status = 'FOUND';
        } else {
          updates.checkout_discovery_status = 'NOT_PROCESSED';
        }
        needsUpdate = true;
      }

      // Checkout mapping status check
      if (!offer.checkout_mapping_status) {
        if (offer.checkout_discovery_status === 'FOUND' || updates.checkout_discovery_status === 'FOUND') {
          updates.checkout_mapping_status = 'NOT_MAPPED';
        } else {
          updates.checkout_mapping_status = 'NOT_MAPPED';
        }
        needsUpdate = true;
      }

      // Data scraping status check
      if (!offer.data_scraping_status) {
        updates.data_scraping_status = 'NOT_PROCESSED';
        needsUpdate = true;
      }

      if (needsUpdate) {
        reconciledCount++;
        await supabase
          .from('offers')
          .update(updates)
          .eq('id', offer.id)
          .eq('workspace_id', wsCtx.workspaceId);
      }
    }

    // 3. Stale jobs watchdog: flag jobs running without heartbeat > 90s as STALE
    const ninetySecsAgo = new Date(Date.now() - 90 * 1000).toISOString();
    await supabase
      .from('mapping_jobs')
      .update({
        status: 'STALE',
        error_message: 'Execução interrompida ou sem resposta do worker há mais de 90 segundos.',
        completed_at: new Date().toISOString(),
      })
      .eq('status', 'RUNNING')
      .lt('updated_at', ninetySecsAgo);

    // 4. Compute canonical stats
    const summary = await getMappingStats(wsCtx.workspaceId, supabase);

    return NextResponse.json({
      success: true,
      scanned_at: new Date().toISOString(),
      total_offers: offerList.length,
      reconciled_offers: reconciledCount,
      summary,
    });
  } catch (err: any) {
    console.error('[POST /api/mapping/scan Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao executar varredura da base.' },
      { status: 500 }
    );
  }
}
