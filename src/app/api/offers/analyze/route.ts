import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { validateMetaAdsLibraryUrl } from '@/lib/meta-ads/url-utils';
import { detectExistingOfferAdvanced, generateDedupeKey } from '@/lib/deduplication';
import { executeAtomicStep } from '@/lib/offer/atomic-analysis-runner';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Offer } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const jobs = await dbService.getAnalysisJobs(supabase);
    return NextResponse.json({ success: true, jobs });
  } catch (err: any) {
    console.error('[GET /api/offers/analyze Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao obter jobs de análise.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const body = await req.json();
    const { url, mode = 'new', offerId } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Por favor, informe a URL da Meta Ads Library.' },
        { status: 400 }
      );
    }

    // 1. Strict Meta Ads Library URL Validation
    const validation = validateMetaAdsLibraryUrl(url);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.error || 'Este link não parece ser uma URL válida da Meta Ads Library.',
          isValidUrl: false,
        },
        { status: 400 }
      );
    }

    const cleanUrl = validation.normalizedUrl || url.trim();

    // 2. Check if a job is ALREADY running for the same Meta Ads URL
    const existingJobs = await dbService.getAnalysisJobs(supabase);
    const activeRunningJob = existingJobs.find(
      (j) => j.status === 'running' && j.input_url.trim().toLowerCase() === cleanUrl.toLowerCase()
    );

    if (activeRunningJob) {
      return NextResponse.json({
        success: false,
        isAlreadyRunning: true,
        userMessage: 'Esta oferta já está sendo analisada no momento.',
        jobId: activeRunningJob.id,
        job: activeRunningJob,
      });
    }

    // 3. Deduplication Check (Before DB Creation in 'new' mode)
    const existingOffers = await dbService.getOffers(undefined, supabase);
    let targetOffer: Offer | null = null;

    if (mode === 'update' && offerId) {
      targetOffer = await dbService.getOfferById(offerId);
    } else {
      const duplicateResult = detectExistingOfferAdvanced({
        candidateOffer: {
          meta_ads_url: cleanUrl,
        },
        metaAdsUrl: cleanUrl,
        existingOffers,
      });

      if (duplicateResult.isDuplicate && duplicateResult.existingOffer && mode === 'new') {
        return NextResponse.json({
          success: false,
          isDuplicate: true,
          userMessage: `Oferta já cadastrada: "${duplicateResult.existingOffer.product_name}".`,
          existingOffer: duplicateResult.existingOffer,
          existingOfferId: duplicateResult.existingOffer.id,
        });
      }

      if (duplicateResult.isDuplicate && duplicateResult.existingOffer) {
        targetOffer = duplicateResult.existingOffer;
      }
    }

    // 4. Create Persistent Offer Record IMMEDIATELY (T+0 canonical persistence)
    const now = new Date().toISOString();
    if (!targetOffer) {
      const dedupeKey = generateDedupeKey({
        meta_ads_url: cleanUrl,
      });

      targetOffer = await dbService.saveOffer({
        workspace_id: 'ws_default_001',
        product_name: 'Analisando Anúncios (Meta Ads)...',
        advertiser: 'Identificando Anunciante...',
        meta_ads_url: cleanUrl,
        status: 'ANALYZING',
        source: 'MANUAL_META_URL',
        lp_mapping_status: 'NOT_MAPPED',
        checkout_mapping_status: 'NOT_MAPPED',
        dedupe_key: dedupeKey,
        created_at: now,
        updated_at: now,
        extra_data: {
          meta_ads_url_original: url,
        },
      }, supabase);
    } else {
      await dbService.updateOffer(targetOffer.id, {
        status: 'ANALYZING',
        updated_at: now,
      }, supabase);
    }

    // 5. Create Analysis Job in DB bound to targetOffer.id with initial heartbeat
    const job = await dbService.createAnalysisJob({
      workspace_id: 'ws_default_001',
      user_id: user?.id || null,
      offer_id: targetOffer.id,
      input_url: cleanUrl,
      meta_ads_url_original: url,
      status: 'running',
      current_step: 'RESOLVE_META',
      progress_percent: 10,
      attempt: 1,
      max_attempts: 3,
      current_stage: 'validating_url',
      stage_message: 'Oferta registrada. Iniciando análise passo a passo...',
      mode,
      progress_data: {
        workspace_id: 'ws_default_001',
        offer_id: targetOffer.id,
        product_name: targetOffer.product_name,
        advertiser: targetOffer.advertiser,
        current_step: 'RESOLVE_META',
        progress_percent: 10,
        logs: [
          {
            timestamp: now,
            stage: 'validating_url',
            message: 'URL validada e oferta cadastrada no banco de dados com sucesso.',
          },
        ],
      },
    }, supabase);

    // 6. Synchronous Worker Execution (Bounded Serverless Dispatch)
    // Runs atomic steps synchronously before HTTP response to ensure immediate progress,
    // persisting at least Step 1 (RESOLVE_META) and advancing as far as possible (all 7 steps ~3s).
    const startTime = Date.now();
    const MAX_SYNC_DURATION_MS = 6000;
    let currentJob = job;
    let currentOffer = targetOffer;

    while (currentJob.status === 'running' && Date.now() - startTime < MAX_SYNC_DURATION_MS) {
      try {
        const stepResult = await executeAtomicStep(currentJob.id, supabase);
        currentJob = stepResult.job;
        currentOffer = stepResult.offer || currentOffer;
        if (stepResult.isCompleted) {
          break;
        }
      } catch (stepErr: any) {
        console.error('[Analyze Sync Execution Error]:', stepErr);
        break;
      }
    }

    return NextResponse.json({
      success: true,
      jobId: currentJob.id,
      job: currentJob,
      offer: currentOffer,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/analyze Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao iniciar análise de oferta.' },
      { status: 500 }
    );
  }
}

