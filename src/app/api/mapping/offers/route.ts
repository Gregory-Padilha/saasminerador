import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/auth/require-workspace';
import { dbService } from '@/lib/supabase/db';
import { Offer, isLandingPageMapped, MappingJob } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    let wsCtx;
    try {
      wsCtx = await requireWorkspace();
    } catch {
      wsCtx = { workspaceId: 'ws_default_001', userId: null, client: undefined };
    }
    const workspaceId = wsCtx.workspaceId || 'ws_default_001';
    const client = (wsCtx as any).client;

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') as 'LANDING_PAGE' | 'CHECKOUT') || 'LANDING_PAGE';
    const statusFilter = searchParams.get('status') || 'all'; // 'all' | 'pending' | 'queued' | 'running' | 'mapped' | 'partial' | 'failed' | 'not_found' | 'not_processed'
    const search = (searchParams.get('search') || '').toLowerCase();
    const niche = searchParams.get('niche') || 'all';

    const allOffers = await dbService.getOffers(client, workspaceId);
    const activeJobs = await dbService.getActiveMappingJobs(workspaceId, client);

    const activeJobMap = new Map<string, MappingJob>();
    for (const job of activeJobs) {
      if (job.type === type) {
        activeJobMap.set(job.offer_id, job);
      }
    }

    // Enrich each offer with canonical status and active job details
    const enrichedOffers = allOffers.map((offer) => {
      let isEligible = false;
      let mappingStatus: 'NOT_PROCESSED' | 'QUEUED' | 'RUNNING' | 'MAPPED' | 'PARTIAL' | 'FAILED' | 'STALE' | 'NO_URL' = 'NOT_PROCESSED';
      let statusMessage = '';
      let targetUrl = '';
      const activeJob = activeJobMap.get(offer.id);

      if (type === 'LANDING_PAGE') {
        targetUrl = offer.landing_page_url || '';
        const hasUrl = Boolean(targetUrl && targetUrl.trim() !== '');
        const isCaptured = isLandingPageMapped(offer);
        const isFailed =
          offer.lp_mapping_status === 'FAILED' ||
          offer.landing_page_url_status === 'UNAVAILABLE' ||
          offer.landing_page_url_status === 'DNS_NOT_RESOLVED' ||
          offer.landing_page_url_status === 'INVALID_URL';

        if (activeJob) {
          mappingStatus = activeJob.status as any;
          statusMessage = activeJob.current_step || 'Processando em tempo real...';
          isEligible = false;
        } else if (!hasUrl) {
          mappingStatus = 'NO_URL';
          statusMessage = 'Sem URL de Landing Page cadastrada.';
        } else if (isCaptured) {
          mappingStatus = offer.lp_mapping_status === 'PARTIAL' ? 'PARTIAL' : 'MAPPED';
          statusMessage = 'Landing Page mapeada com sucesso.';
          isEligible = false;
        } else if (isFailed) {
          mappingStatus = 'FAILED';
          statusMessage = offer.lp_last_error || 'Falha em mapeamento anterior.';
          isEligible = true;
        } else {
          mappingStatus = 'NOT_PROCESSED';
          statusMessage = 'Aguardando mapeamento da Landing Page.';
          isEligible = true;
        }
      } else {
        // CHECKOUT
        targetUrl = offer.checkout_url || '';
        const hasUrl = Boolean(targetUrl && targetUrl.trim() !== '');
        const isSameAsLp = Boolean(offer.landing_page_url && targetUrl.trim() === offer.landing_page_url.trim());

        if (activeJob) {
          mappingStatus = activeJob.status as any;
          statusMessage = activeJob.current_step || 'Analisando checkout em tempo real...';
          isEligible = false;
        } else if (!hasUrl) {
          mappingStatus = 'NO_URL';
          statusMessage = 'Nenhuma URL de checkout descoberta.';
        } else if (isSameAsLp) {
          mappingStatus = 'NO_URL';
          statusMessage = 'URL de checkout é idêntica à LP.';
        } else {
          const isVerified = offer.checkout_mapping_status === 'SUCCESS';
          const isFailed = offer.checkout_mapping_status === 'FAILED';
          const isPartial = offer.checkout_mapping_status === 'PARTIAL';

          if (isVerified) {
            mappingStatus = 'MAPPED';
            statusMessage = 'Checkout analisado e verificado.';
            isEligible = false;
          } else if (isPartial) {
            mappingStatus = 'PARTIAL';
            statusMessage = 'Checkout analisado com avisos.';
            isEligible = false;
          } else if (isFailed) {
            mappingStatus = 'FAILED';
            statusMessage = offer.checkout_last_error || 'Análise anterior sem verificação completa.';
            isEligible = true;
          } else {
            mappingStatus = 'NOT_PROCESSED';
            statusMessage = 'Checkout real descoberto, aguardando análise.';
            isEligible = true;
          }
        }
      }

      return {
        offer,
        targetUrl,
        mappingStatus,
        statusMessage,
        isEligible,
        activeJob: activeJob || null,
        currentStep: activeJob?.current_step || (mappingStatus === 'MAPPED' ? 'Concluído' : statusMessage),
        progressPercent: activeJob ? activeJob.progress_percent : (mappingStatus === 'MAPPED' ? 100 : 0),
        lastHeartbeatAt: activeJob?.last_heartbeat_at || null,
        startedAt: activeJob?.started_at || null,
      };
    });

    // Apply filtering
    const filtered = enrichedOffers.filter((item) => {
      // Status filter
      if (statusFilter === 'pending') {
        if (item.mappingStatus !== 'NOT_PROCESSED' && item.mappingStatus !== 'QUEUED') return false;
      } else if (statusFilter === 'queued') {
        if (item.mappingStatus !== 'QUEUED') return false;
      } else if (statusFilter === 'running') {
        if (item.mappingStatus !== 'RUNNING') return false;
      } else if (statusFilter === 'mapped') {
        if (item.mappingStatus !== 'MAPPED') return false;
      } else if (statusFilter === 'partial') {
        if (item.mappingStatus !== 'PARTIAL') return false;
      } else if (statusFilter === 'failed') {
        if (item.mappingStatus !== 'FAILED' && item.mappingStatus !== 'STALE') return false;
      } else if (statusFilter === 'not_found') {
        if (item.offer.checkout_discovery_status !== 'NOT_FOUND') return false;
      } else if (statusFilter === 'not_processed') {
        if (item.offer.checkout_discovery_status !== 'NOT_PROCESSED') return false;
      }

      // Niche filter
      if (niche !== 'all' && item.offer.niche !== niche) return false;

      // Search filter
      if (search) {
        const matchName = (item.offer.product_name || '').toLowerCase().includes(search);
        const matchAdv = (item.offer.advertiser || '').toLowerCase().includes(search);
        const matchUrl = (item.targetUrl || '').toLowerCase().includes(search);
        if (!matchName && !matchAdv && !matchUrl) return false;
      }

      return true;
    });

    // Sort order: RUNNING first -> QUEUED -> FAILED/STALE -> NOT_PROCESSED -> PARTIAL -> MAPPED
    const priorityMap: Record<string, number> = {
      RUNNING: 1,
      QUEUED: 2,
      FAILED: 3,
      STALE: 3,
      NOT_PROCESSED: 4,
      PARTIAL: 5,
      MAPPED: 6,
      NO_URL: 7,
    };

    filtered.sort((a, b) => {
      const pA = priorityMap[a.mappingStatus] || 99;
      const pB = priorityMap[b.mappingStatus] || 99;
      if (pA !== pB) return pA - pB;
      // Secondary: recently updated or created
      return new Date(b.offer.updated_at || b.offer.created_at).getTime() - new Date(a.offer.updated_at || a.offer.created_at).getTime();
    });

    return NextResponse.json({
      success: true,
      type,
      total: enrichedOffers.length,
      count: filtered.length,
      offers: filtered,
    });
  } catch (err: any) {
    console.error('[GET /api/mapping/offers Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao consultar ofertas elegíveis.' },
      { status: 500 }
    );
  }
}

