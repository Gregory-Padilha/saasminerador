import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { Offer, isLandingPageMapped } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') as 'LANDING_PAGE' | 'CHECKOUT') || 'LANDING_PAGE';
    const statusFilter = searchParams.get('status') || 'pending'; // 'pending' | 'mapped' | 'failed' | 'all'
    const search = (searchParams.get('search') || '').toLowerCase();
    const niche = searchParams.get('niche') || 'all';

    const allOffers = await dbService.reconcileAllOffers();

    // Map status for each offer
    const enrichedOffers = await Promise.all(
      allOffers.map(async (offer) => {
        let isEligible = false;
        let mappingStatus: 'PENDING' | 'MAPPED' | 'FAILED' | 'NO_URL' = 'NO_URL';
        let statusMessage = '';
        let targetUrl = '';

        if (type === 'LANDING_PAGE') {
          targetUrl = offer.landing_page_url || '';
          const hasUrl = Boolean(targetUrl && targetUrl.trim() !== '');
          const isCaptured = isLandingPageMapped(offer);
          const isFailed =
            offer.lp_mapping_status === 'FAILED' ||
            offer.landing_page_url_status === 'UNAVAILABLE' ||
            offer.landing_page_url_status === 'DNS_NOT_RESOLVED' ||
            offer.landing_page_url_status === 'INVALID_URL';

          if (!hasUrl) {
            mappingStatus = 'NO_URL';
            statusMessage = 'Sem URL de Landing Page cadastrada.';
          } else if (isCaptured) {
            mappingStatus = 'MAPPED';
            statusMessage = 'Landing Page mapeada com sucesso.';
            isEligible = false;
          } else if (isFailed) {
            mappingStatus = 'FAILED';
            statusMessage = offer.lp_last_error || 'Falha em mapeamento anterior. Elegível para reprocessamento.';
            isEligible = true;
          } else {
            mappingStatus = 'PENDING';
            statusMessage = 'Aguardando mapeamento inicial da Landing Page.';
            isEligible = true;
          }
        } else {
          // CHECKOUT
          targetUrl = offer.checkout_url || '';
          const hasUrl = Boolean(targetUrl && targetUrl.trim() !== '');
          const isSameAsLp = Boolean(offer.landing_page_url && targetUrl.trim() === offer.landing_page_url.trim());

          if (!hasUrl) {
            mappingStatus = 'NO_URL';
            statusMessage = 'Nenhuma URL de checkout descoberta.';
          } else if (isSameAsLp) {
            mappingStatus = 'NO_URL';
            statusMessage = 'URL de checkout é idêntica à LP (inativa para checkout automático).';
          } else {
            const isVerified = offer.checkout_mapping_status === 'SUCCESS';
            const isFailed = offer.checkout_mapping_status === 'FAILED';

            if (isVerified) {
              mappingStatus = 'MAPPED';
              statusMessage = 'Checkout analisado e verificado.';
              isEligible = false;
            } else if (isFailed) {
              mappingStatus = 'FAILED';
              statusMessage = offer.checkout_last_error || 'Análise anterior sem verificação completa.';
              isEligible = true;
            } else {
              mappingStatus = 'PENDING';
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
        };
      })
    );

    // Apply filtering
    const filtered = enrichedOffers.filter((item) => {
      // Status filter
      if (statusFilter === 'pending') {
        if (item.mappingStatus !== 'PENDING') return false;
      } else if (statusFilter === 'mapped') {
        if (item.mappingStatus !== 'MAPPED') return false;
      } else if (statusFilter === 'not_found') {
        if (item.offer.checkout_discovery_status !== 'NOT_FOUND') return false;
      } else if (statusFilter === 'not_processed') {
        if (item.offer.checkout_discovery_status !== 'NOT_PROCESSED') return false;
      } else if (statusFilter === 'failed') {
        if (item.mappingStatus !== 'FAILED') return false;
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
