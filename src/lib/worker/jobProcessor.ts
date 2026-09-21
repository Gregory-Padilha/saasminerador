import path from 'path';
import fs from 'fs';
import { dbService } from '@/lib/supabase/db';
import { CreativeCaptureJob, OfferCreative, OfferCaptureScope, CaptureJobStatus, CaptureDebugData } from '@/types';
import { scrapeMetaAdsLibrary } from './browser';
import { downloadMediaBuffer, computeSha256, convertM3u8ToMp4, extractVideoThumbnail } from './downloader';
import { uploadMediaToStorage } from './storage';
import { CAPTURE_CONFIG } from './config';

export async function processCreativeCaptureJob(
  jobId: string,
  mode: 'capture' | 'discovery_only' = 'capture'
): Promise<CreativeCaptureJob | null> {
  const job = await dbService.getCaptureJob(jobId);
  if (!job) return null;
  if (job.status === 'cancelled' || job.status === 'completed') return job;

  const offer = await dbService.getOfferById(job.offer_id);
  if (!offer) {
    return await dbService.updateCaptureJob(jobId, {
      status: 'failed',
      error_code: 'OFFER_NOT_FOUND',
      error_message: 'Oferta associada ao job não foi encontrada no banco.',
      finished_at: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  await dbService.updateCaptureJob(jobId, {
    status: 'starting_browser',
    started_at: now,
    progress: 5,
    mode,
  });

  const scope: OfferCaptureScope = {
    offerId: offer.id,
    productName: offer.product_name,
    advertiser: offer.advertiser,
    landingPageUrl: offer.landing_page_url,
    landingPageDomain: offer.landing_page_domain,
    metaAdsUrl: job.source_url,
    headline: offer.headline,
    niche: offer.niche,
  };

  try {
    // 1. Execute Browser Discovery with Stage Tracking
    const discovery = await scrapeMetaAdsLibrary(
      job.source_url,
      scope,
      jobId,
      async (stageStatus: CaptureJobStatus, progressPct: number, debugPartial?: Partial<CaptureDebugData>) => {
        // Check if job was cancelled
        const currentCheck = await dbService.getCaptureJob(jobId);
        if (currentCheck?.status === 'cancelled') {
          return;
        }

        await dbService.updateCaptureJob(jobId, {
          status: stageStatus,
          progress: progressPct,
          debug_data: debugPartial ? ({ ...job.debug_data, ...debugPartial } as any) : undefined,
        });
      }
    );

    // Check cancellation
    const currentJobCheck = await dbService.getCaptureJob(jobId);
    if (currentJobCheck?.status === 'cancelled') {
      return currentJobCheck;
    }

    // Handle blocking / intervention
    if (discovery.requiresIntervention || discovery.status === 'blocked_login' || discovery.status === 'blocked_captcha') {
      return await dbService.updateCaptureJob(jobId, {
        status: discovery.status,
        error_code: discovery.errorCode || 'ACCESS_REQUIRES_INTERVENTION',
        error_message: discovery.errorMessage || discovery.interventionReason || 'Intervenção necessária.',
        debug_data: discovery.debugData,
        finished_at: new Date().toISOString(),
        progress: 100,
      });
    }

    // Handle no ads found
    if (discovery.status === 'no_ads_found' || discovery.ads.length === 0) {
      return await dbService.updateCaptureJob(jobId, {
        status: 'no_ads_found',
        error_code: 'NO_ADS_DETECTED',
        error_message: 'Página carregada, mas nenhum anúncio ativo da oferta foi identificado.',
        debug_data: discovery.debugData,
        ads_detected: 0,
        ads_processed: 0,
        finished_at: new Date().toISOString(),
        progress: 100,
      });
    }

    const discoveredAds = discovery.ads;
    const totalAds = discoveredAds.length;
    const videoCountDiscovered = discoveredAds.filter((a) => a.mediaType === 'video').length;
    const imageCountDiscovered = discoveredAds.filter((a) => a.mediaType === 'image').length;

    // 2. DISCOVERY ONLY MODE: Finish here with full debug report without downloading files
    if (mode === 'discovery_only') {
      return await dbService.updateCaptureJob(jobId, {
        status: 'completed',
        progress: 100,
        ads_detected: totalAds,
        ads_processed: totalAds,
        videos_detected: videoCountDiscovered,
        images_detected: imageCountDiscovered,
        debug_data: discovery.debugData,
        finished_at: new Date().toISOString(),
      });
    }

    // 3. CAPTURE MODE: Download, Hash, Deduplicate & Store in Storage
    await dbService.updateCaptureJob(jobId, {
      status: 'downloading_media',
      ads_detected: totalAds,
      videos_detected: videoCountDiscovered,
      images_detected: imageCountDiscovered,
      debug_data: discovery.debugData,
      progress: 75,
    });

    // Load existing creatives for deduplication
    const existingCreatives = await dbService.getCreativesByOffer(job.offer_id);
    const existingHashes = new Set(existingCreatives.map((c) => c.file_hash).filter(Boolean));
    const existingMetaIds = new Set(existingCreatives.map((c) => c.meta_ad_id).filter(Boolean));

    let processedCount = 0;
    let newCount = 0;
    let existingCount = 0;
    let failedCount = 0;
    let videoCount = 0;
    let imageCount = 0;

    const tmpDir = path.join(process.cwd(), '.tmp', 'offer-miner', jobId);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    for (let i = 0; i < discoveredAds.length; i++) {
      // Check cancellation between items
      const check = await dbService.getCaptureJob(jobId);
      if (check?.status === 'cancelled') {
        break;
      }

      const item = discoveredAds[i];
      processedCount++;

      try {
        const isVideo = item.mediaType === 'video';
        const metaAdId = item.metaAdId || `ad_${Date.now()}_${i + 1}`;
        const ext = isVideo ? 'mp4' : 'webp';
        const fileName = `${isVideo ? 'video' : 'image'}-${String(i + 1).padStart(2, '0')}.${ext}`;
        const localFilePath = path.join(tmpDir, fileName);

        let mediaBuffer: Buffer | null = null;
        let mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
        let thumbnailBuffer: Buffer | null = null;

        // Download media
        if (item.mediaUrl.includes('.m3u8')) {
          const converted = await convertM3u8ToMp4(item.mediaUrl, localFilePath);
          if (converted && fs.existsSync(localFilePath)) {
            mediaBuffer = fs.readFileSync(localFilePath);
            mimeType = 'video/mp4';
          }
        } else {
          const dlResult = await downloadMediaBuffer(item.mediaUrl);
          if (dlResult) {
            mediaBuffer = dlResult.buffer;
            mimeType = dlResult.contentType || mimeType;
            fs.writeFileSync(localFilePath, mediaBuffer);
          }
        }

        if (!mediaBuffer) {
          failedCount++;
          // Save failed record for audit & original link fallback
          await dbService.saveCreative({
            offer_id: job.offer_id,
            capture_job_id: jobId,
            meta_ad_id: metaAdId,
            meta_ad_url: item.metaAdUrl || job.source_url,
            media_type: item.mediaType,
            capture_status: 'failed',
            error_message: 'Não foi possível obter os bytes da mídia.',
            primary_text: item.primaryText || '',
            headline: item.headline || '',
          });
          continue;
        }

        // Compute SHA-256 for absolute deduplication
        const fileHash = computeSha256(mediaBuffer);

        // Deduplication Check
        if (existingHashes.has(fileHash)) {
          existingCount++;
          // Update last_seen_at for the matching existing creative
          const existing = existingCreatives.find((c) => c.file_hash === fileHash);
          if (existing) {
            await dbService.saveCreative({
              ...existing,
              last_seen_at: new Date().toISOString(),
              capture_job_id: jobId,
            });
          }
          continue;
        }

        // Generate Thumbnail for Video
        if (isVideo && fs.existsSync(localFilePath)) {
          const thumbPath = path.join(tmpDir, `thumb-${String(i + 1).padStart(2, '0')}.jpg`);
          const thumbGenerated = await extractVideoThumbnail(localFilePath, thumbPath);
          if (thumbGenerated && fs.existsSync(thumbPath)) {
            thumbnailBuffer = fs.readFileSync(thumbPath);
          }
        } else if (!isVideo && mediaBuffer) {
          thumbnailBuffer = mediaBuffer;
        }

        // Upload to Supabase Storage / Local Uploads
        await dbService.updateCaptureJob(jobId, {
          status: 'uploading_storage',
          progress: Math.min(95, 75 + Math.round((i / discoveredAds.length) * 20)),
        });

        const mediaStoragePath = `offer-creatives/${offer.user_id || 'anonymous'}/${job.offer_id}/${metaAdId}/${fileName}`;
        const uploadResult = await uploadMediaToStorage(mediaStoragePath, mediaBuffer, mimeType);

        let thumbnailStoragePath: string | null = null;
        if (thumbnailBuffer) {
          const thumbStoragePath = `offer-creatives/${offer.user_id || 'anonymous'}/${job.offer_id}/${metaAdId}/thumbnail.jpg`;
          const thumbUpload = await uploadMediaToStorage(thumbStoragePath, thumbnailBuffer, 'image/jpeg');
          if (thumbUpload.success) {
            thumbnailStoragePath = thumbUpload.storagePath;
          }
        }

        // Save Creative in Database
        await dbService.saveCreative({
          user_id: offer.user_id,
          offer_id: job.offer_id,
          capture_job_id: jobId,
          meta_ad_id: metaAdId,
          meta_ad_url: item.metaAdUrl || job.source_url,
          media_type: item.mediaType,
          mime_type: mimeType,
          storage_path: uploadResult.storagePath,
          thumbnail_path: thumbnailStoragePath,
          original_media_url: item.mediaUrl,
          file_hash: fileHash,
          file_size: mediaBuffer.length,
          first_captured_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          is_active: true,
          capture_status: 'completed',
          headline: item.headline || '',
          primary_text: item.primaryText || '',
          notes: item.matchReason ? `Identificado via: ${item.matchReason}` : '',
        });

        newCount++;
        existingHashes.add(fileHash);
        if (isVideo) videoCount++;
        else imageCount++;
      } catch (itemErr: any) {
        console.error(`[JOB ${jobId}] Error processing creative ${i + 1}:`, itemErr);
        failedCount++;
      }
    }

    // Clean temporary files
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}

    // 4. Update Offer Summary Counters
    const allOfferCreatives = await dbService.getCreativesByOffer(job.offer_id);
    const totalStoredVideos = allOfferCreatives.filter((c) => c.media_type === 'video' && c.storage_path).length;
    const totalStoredImages = allOfferCreatives.filter((c) => c.media_type === 'image' && c.storage_path).length;

    await dbService.updateOffer(job.offer_id, {
      captured_creatives_count: allOfferCreatives.length,
      captured_videos_count: totalStoredVideos,
      captured_images_count: totalStoredImages,
    });

    const finalStatus: CaptureJobStatus = failedCount > 0 && newCount === 0 ? 'completed_with_errors' : 'completed';

    const finishedJob = await dbService.updateCaptureJob(jobId, {
      status: finalStatus,
      progress: 100,
      ads_processed: processedCount,
      new_creatives: newCount,
      existing_creatives: existingCount,
      failed_creatives: failedCount,
      videos_detected: videoCount,
      images_detected: imageCount,
      debug_data: discovery.debugData,
      finished_at: new Date().toISOString(),
    });

    console.log(`[JOB COMPLETED] ${jobId} -> New: ${newCount}, Existing: ${existingCount}, Failed: ${failedCount}`);
    return finishedJob;
  } catch (err: any) {
    console.error(`[JOB FATAL ERROR] ${jobId}:`, err);
    return await dbService.updateCaptureJob(jobId, {
      status: 'failed',
      error_code: 'WORKER_UNHANDLED_EXCEPTION',
      error_message: err.message || 'Erro inesperado durante o processamento do job.',
      finished_at: new Date().toISOString(),
    });
  }
}
