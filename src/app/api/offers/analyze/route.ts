import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { validateMetaAdsLibraryUrl } from '@/lib/meta-ads/url-resolver';
import { runOfferAnalysisPipeline } from '@/lib/offer/analysis-pipeline';
import { detectExistingOfferAdvanced, generateDedupeKey } from '@/lib/deduplication';
import { Offer } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const jobs = await dbService.getAnalysisJobs();
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
    const existingJobs = await dbService.getAnalysisJobs();
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
    const existingOffers = await dbService.getOffers();
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

    // 4. Create Persistent Offer Record IMMEDIATELY (if not already existing)
    const now = new Date().toISOString();
    if (!targetOffer) {
      const dedupeKey = generateDedupeKey({
        meta_ads_url: cleanUrl,
      });

      targetOffer = await dbService.saveOffer({
        product_name: 'Analisando Anúncios (Meta Ads)...',
        advertiser: 'Identificando Anunciante...',
        meta_ads_url: cleanUrl,
        status: 'ANALYZING',
        source: 'MANUAL_META_URL',
        dedupe_key: dedupeKey,
        created_at: now,
        updated_at: now,
        extra_data: {
          meta_ads_url_original: url,
        },
      });
    } else {
      await dbService.updateOffer(targetOffer.id, {
        status: 'ANALYZING',
        updated_at: now,
      });
    }

    // 5. Create Analysis Job in DB bound to targetOffer.id
    const job = await dbService.createAnalysisJob({
      input_url: cleanUrl,
      meta_ads_url_original: url,
      status: 'queued',
      current_stage: 'validating_url',
      stage_message: 'Validação concluída. Oferta registrada e agendando análise...',
      mode,
      offer_id: targetOffer.id,
      progress_data: {
        offer_id: targetOffer.id,
        product_name: targetOffer.product_name,
        advertiser: targetOffer.advertiser,
        logs: [
          {
            timestamp: now,
            stage: 'validating_url',
            message: 'URL validada e oferta cadastrada no banco de dados com sucesso.',
          },
        ],
      },
    });

    // 6. Trigger Orchestrated Pipeline in Background with targetOffer.id
    runOfferAnalysisPipeline(job.id, { mode, offerId: targetOffer.id }).catch((err) => {
      console.error(`[BACKGROUND PIPELINE ERROR] Job ${job.id}:`, err);
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      job,
      offer: targetOffer,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/analyze Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao iniciar análise de oferta.' },
      { status: 500 }
    );
  }
}

