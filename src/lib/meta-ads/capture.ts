// ==============================================================================
// META ADS - MASTER IN-PROCESS CAPTURE ORCHESTRATOR
// ==============================================================================

import { Offer, OfferCreative, OfferAdWithMedia, OfferAd } from '@/types';
import { dbService } from '@/lib/supabase/db';
import {
  CaptureOptions,
  CaptureResult,
  CaptureDiagnosticReport,
  CapturedCreativeResult,
  OfferCaptureScope,
} from './types';
import { createPlaywrightSession, closePlaywrightSession, PlaywrightSession } from './browser';
import {
  loadMetaAdsPage,
  detectAccessState,
  dismissConsent,
  saveDiagnosticSnapshot,
} from './page-loader';
import { discoverAds } from './ad-discovery';
import { enrichAdMedia } from './media-discovery';
import { filterAdsByOfferScope } from './offer-scope';
import {
  createTempDir,
  cleanupTempDir,
  captureCardScreenshot,
  processMediaDownload,
} from './media-download';
import { uploadAdCardScreenshot, uploadAdMedia } from './storage';

function parseMetaStartedAt(rawDate?: string | null): Date | null {
  if (!rawDate) return null;
  const clean = rawDate.trim().toLowerCase();

  const ptMatch = clean.match(/(\d{1,2})\s+de\s+([a-zçáéíóú]+)\.?(?:\s+de)?\s+(\d{4})/i);
  if (ptMatch) {
    const day = parseInt(ptMatch[1], 10);
    const monthStr = ptMatch[2].slice(0, 3);
    const year = parseInt(ptMatch[3], 10);

    const monthsMap: Record<string, number> = {
      jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
      jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
    };
    const month = monthsMap[monthStr] !== undefined ? monthsMap[monthStr] : 0;
    return new Date(Date.UTC(year, month, day));
  }

  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

export async function captureMetaAdsCreatives(params: {
  offer: Offer;
  metaAdsUrl: string;
  options?: CaptureOptions;
}): Promise<CaptureResult> {
  const { offer, metaAdsUrl, options = {} } = params;
  const mode = options.mode || 'capture';
  const maxAds = options.maxAds || 300;
  const onProgress = options.onProgress;
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  console.log(`[META-ADS CAPTURE START] Offer: "${offer.product_name}" (${offer.id}), Mode: ${mode}`);

  onProgress?.({
    step: 'starting_browser',
    message: 'Inicializando Playwright Chromium no backend...',
    progressPercent: 5,
  });

  let session: PlaywrightSession | null = null;
  let tempDir: string | null = null;

  try {
    // 1. Launch Playwright
    session = await createPlaywrightSession();

    // 2. Load page & monitor network
    const { report: initialReport, networkState } = await loadMetaAdsPage(
      session.page,
      metaAdsUrl,
      onProgress
    );

    // 3. Check access barriers
    onProgress?.({
      step: 'checking_access',
      message: 'Validando acesso público à Biblioteca...',
      progressPercent: 22,
    });

    const accessState = await detectAccessState(session.page);
    if (accessState.isBlocked) {
      const diagSnap = await saveDiagnosticSnapshot(session.page, offer.id);
      const errCode = accessState.isLoginRequired
        ? 'META_PAGE_LOGIN_REQUIRED'
        : 'META_PAGE_BLOCKED';

      console.warn(`[META-ADS CAPTURE BLOCKED] Reason: ${accessState.reason}`);

      onProgress?.({
        step: accessState.isLoginRequired ? 'blocked_login' : 'blocked_captcha',
        message: accessState.reason || 'Acesso bloqueado pela Meta.',
        progressPercent: 100,
      });

      return {
        success: false,
        mode,
        offerId: offer.id,
        sourceUrl: metaAdsUrl,
        adsDetected: 0,
        adsInScope: 0,
        uniqueCreativesCount: 0,
        videosCount: 0,
        imagesCount: 0,
        newCreativesCount: 0,
        existingCreativesCount: 0,
        failedCreativesCount: 0,
        ads: [],
        creatives: [],
        diagnosticReport: {
          originalUrl: metaAdsUrl,
          finalUrl: initialReport.finalUrl || metaAdsUrl,
          httpStatus: initialReport.httpStatus || 403,
          httpStatusText: initialReport.httpStatusText || 'Forbidden',
          pageTitle: initialReport.pageTitle || '',
          loginDetected: accessState.isLoginRequired,
          captchaDetected: accessState.isCaptchaRequired,
          consentDetected: false,
          bodyTextSample: '',
          videoElementsCount: 0,
          imageElementsCount: 0,
          possibleAdCardsCount: 0,
          metaAdIdsFound: [],
          mp4ResponsesCount: networkState.mp4Urls.size,
          hlsResponsesCount: networkState.hlsUrls.size,
          iframesCount: 0,
          screenshotUrl: diagSnap.screenshotUrl,
          htmlUrl: diagSnap.htmlUrl,
          executionTimeMs: Date.now() - startTime,
          error: accessState.reason,
        },
        errorCode: errCode,
        errorMessage: accessState.reason,
      };
    }

    // 4. Dismiss cookie consent if present
    await dismissConsent(session.page);

    // 5. Save diagnostic screenshots & HTML
    const diagSnap = await saveDiagnosticSnapshot(session.page, offer.id);

    // 6. Discover Ad Cards & DOM Media
    const discovery = await discoverAds(
      session.page,
      { maxAds, maxScrollIterations: options.maxScrollIterations || 20 },
      onProgress
    );

    // 7. Correlate with Network Streams
    const { enrichedCards, totalVideos, totalImages } = enrichAdMedia(
      discovery.cards,
      networkState
    );

    // 8. Filter by Offer Scope
    const scope: OfferCaptureScope = {
      offerId: offer.id,
      productName: offer.product_name,
      advertiser: offer.advertiser,
      landingPageUrl: offer.landing_page_url,
      landingPageDomain: offer.landing_page_domain,
      metaAdsUrl: metaAdsUrl,
      headline: offer.headline,
      niche: offer.niche,
    };

    const { inScopeCards, stats: scopeStats } = filterAdsByOfferScope(enrichedCards, scope);

    console.log(`[META-ADS CAPTURE] Found ${inScopeCards.length} ads in scope.`);

    const diagnosticReport: CaptureDiagnosticReport = {
      originalUrl: metaAdsUrl,
      finalUrl: initialReport.finalUrl || metaAdsUrl,
      httpStatus: initialReport.httpStatus || 200,
      httpStatusText: initialReport.httpStatusText || 'OK',
      pageTitle: initialReport.pageTitle || '',
      loginDetected: false,
      captchaDetected: false,
      consentDetected: false,
      bodyTextSample: discovery.bodyTextSample,
      videoElementsCount: discovery.videoElementsCount,
      imageElementsCount: discovery.imageElementsCount,
      possibleAdCardsCount: enrichedCards.length,
      metaAdIdsFound: enrichedCards.map((c) => c.metaAdId),
      mp4ResponsesCount: networkState.mp4Urls.size,
      mp4SampleUrls: Array.from(networkState.mp4Urls).slice(0, 5),
      hlsResponsesCount: networkState.hlsUrls.size,
      hlsSampleUrls: Array.from(networkState.hlsUrls).slice(0, 5),
      iframesCount: 0,
      scopeMatchResults: {
        totalDetected: scopeStats.total,
        inScope: scopeStats.inScope,
        outOfScope: scopeStats.outOfScope,
        reasons: scopeStats.reasons,
      },
      screenshotUrl: diagSnap.screenshotUrl,
      htmlUrl: diagSnap.htmlUrl,
      executionTimeMs: Date.now() - startTime,
    };

    // If DISCOVERY ONLY, return immediately without downloading or modifying database
    if (mode === 'discovery_only') {
      console.log('[META-ADS CAPTURE] Discovery completed successfully.');
      onProgress?.({
        step: 'completed',
        message: `Inspeção concluída! ${inScopeCards.length} anúncios detectados no escopo da oferta.`,
        progressPercent: 100,
        totalAds: inScopeCards.length,
        totalVideos,
        totalImages,
        debugData: diagnosticReport,
      });

      return {
        success: true,
        mode,
        offerId: offer.id,
        sourceUrl: metaAdsUrl,
        adsDetected: enrichedCards.length,
        adsInScope: inScopeCards.length,
        uniqueCreativesCount: inScopeCards.length,
        videosCount: totalVideos,
        imagesCount: totalImages,
        newCreativesCount: 0,
        existingCreativesCount: 0,
        failedCreativesCount: 0,
        ads: [],
        creatives: [],
        diagnosticReport,
      };
    }

    // =========================================================================
    // 9. IMMEDIATE PERSISTENCE OF DETECTED ADS (RULE: NEVER LOSE DETECTED ADS)
    // =========================================================================
    onProgress?.({
      step: 'discovering_ad_cards',
      message: `${inScopeCards.length} anúncios detectados. Criando registros no banco de dados...`,
      progressPercent: 40,
      totalAds: inScopeCards.length,
    });

    const savedAdsMap = new Map<string, OfferAd>();

    for (const card of inScopeCards) {
      console.log(`[AD DETECTED] ID: ${card.metaAdId}`);
      const savedAd = await dbService.saveOfferAd({
        offer_id: offer.id,
        user_id: offer.user_id,
        meta_ad_id: card.metaAdId,
        meta_ad_url: card.adUrl || `https://www.facebook.com/ads/library/?id=${card.metaAdId}`,
        advertiser: card.advertiser || offer.advertiser,
        status: card.status || 'Ativo',
        started_at: card.startedAt,
        primary_text: card.primaryText,
        headline: card.headline,
        description: card.description,
        cta: card.cta,
        destination_url: card.destinationUrl,
        capture_status: 'detected',
        raw_data: {
          matchReason: card.matchReason,
          mediaCandidatesCount: card.mediaCandidates.length,
        },
      });

      console.log(`[AD UPSERT] Database ID: ${savedAd.id} for Meta Ad: ${card.metaAdId}`);
      savedAdsMap.set(card.metaAdId, savedAd);
    }

    // =========================================================================
    // 10. SEQUENTIAL CARD-BY-CARD MEDIA PROCESSING & STORAGE
    // =========================================================================
    tempDir = await createTempDir(requestId);
    const capturedResults: CapturedCreativeResult[] = [];
    let newCount = 0;
    let existingCount = 0;
    let failedCount = 0;

    const totalCards = inScopeCards.length;
    console.log(`[META-ADS CAPTURE] Processing ${totalCards} ad cards sequentially...`);

    for (let cardIdx = 0; cardIdx < totalCards; cardIdx++) {
      const card = inScopeCards[cardIdx];
      const cardNum = cardIdx + 1;
      const progressPercent = 45 + Math.floor((cardNum / (totalCards || 1)) * 50);

      onProgress?.({
        step: 'downloading_media',
        message: `Processando anúncio ${cardNum} de ${totalCards} (ID: ${card.metaAdId})...`,
        progressPercent,
        currentDownload: cardNum,
        totalDownloads: totalCards,
        totalAds: totalCards,
        totalVideos,
        totalImages,
      });

      const savedAd = savedAdsMap.get(card.metaAdId)!;

      try {
        // A. Capture card element screenshot as guaranteed visual fallback
        let cardScreenshotPath: string | undefined;
        let cardScreenshotUrl: string | undefined;

        if (session && session.page) {
          const localCardPath = await captureCardScreenshot(session.page, card.metaAdId, tempDir);
          if (localCardPath) {
            const screenUpload = await uploadAdCardScreenshot(
              offer.user_id,
              offer.id,
              card.metaAdId,
              localCardPath
            );
            cardScreenshotPath = screenUpload.cardScreenshotPath;
            cardScreenshotUrl = screenUpload.cardScreenshotUrl;

            // Update ad with screenshot
            await dbService.saveOfferAd({
              id: savedAd.id,
              offer_id: offer.id,
              card_screenshot_path: cardScreenshotPath,
              card_screenshot_url: cardScreenshotUrl,
            });
            console.log(`[CARD SCREENSHOT SAVED] Ad ${card.metaAdId}: ${cardScreenshotUrl}`);
          }
        }

        // B. Sort media candidates (prioritize video over image)
        const sortedCandidates = [...card.mediaCandidates].sort((a, b) => {
          if (a.type === 'video' && b.type !== 'video') return -1;
          if (b.type === 'video' && a.type !== 'video') return 1;
          return 0;
        });

        let mediaSaved = false;

        for (const candidate of sortedCandidates) {
          try {
            console.log(`[MEDIA CANDIDATE] Ad ${card.metaAdId} (${candidate.type}) -> URL: ${candidate.sourceUrl.slice(0, 80)}...`);

            // Check if we have a direct in-memory binary buffer from Playwright network interception
            const bufferedBuffer = candidate.type === 'video'
              ? networkState.mp4Buffers.get(candidate.sourceUrl)
              : undefined;

            if (bufferedBuffer) {
              console.log(
                `[MEDIA BUFFER HIT] Using ${(bufferedBuffer.length / 1024 / 1024).toFixed(2)} MB buffer for Ad ${card.metaAdId}`
              );
            }

            const dlResult = await processMediaDownload(
              candidate.type === 'video' ? 'video' : 'image',
              candidate.sourceUrl,
              candidate.posterUrl,
              tempDir,
              card.metaAdId,
              bufferedBuffer
            );

            if (!dlResult) {
              console.warn(`[MEDIA VALIDATION FAILED] Candidate rejected for Ad ${card.metaAdId}`);
              continue;
            }

            console.log(
              `[MEDIA DOWNLOAD SUCCESS] Ad ${card.metaAdId} - Size: ${dlResult.fileSize} bytes, Codec: ${dlResult.codecName}, Duration: ${dlResult.durationSeconds || 'N/A'}`
            );

            // Upload to Storage
            const uploadRes = await uploadAdMedia(
              offer.user_id,
              offer.id,
              card.metaAdId,
              candidate.type === 'video' ? 'video' : 'image',
              dlResult.localFilePath,
              dlResult.thumbnailLocalPath
            );

            console.log(`[STORAGE UPLOAD] Ad ${card.metaAdId} -> ${uploadRes.mediaUrl}`);

            // Save to offer_ad_media table
            const savedMedia = await dbService.saveOfferAdMedia({
              offer_id: offer.id,
              user_id: offer.user_id,
              offer_ad_id: savedAd.id,
              media_type: candidate.type === 'video' ? 'video' : 'image',
              mime_type: dlResult.mimeType,
              original_url: candidate.sourceUrl,
              storage_path: uploadRes.storagePath,
              thumbnail_path: uploadRes.thumbnailPath,
              media_url: uploadRes.mediaUrl,
              thumbnail_url: uploadRes.thumbnailUrl,
              file_hash: dlResult.fileHash,
              file_size: dlResult.fileSize,
              width: dlResult.width,
              height: dlResult.height,
              duration_seconds: dlResult.durationSeconds,
              is_primary: true,
              capture_status: 'completed',
            });

            console.log(`[MEDIA INSERT] Saved media ID: ${savedMedia.id} for ad: ${savedAd.id}`);

            // Update offer_ads status to completed
            await dbService.saveOfferAd({
              id: savedAd.id,
              offer_id: offer.id,
              meta_ad_id: card.metaAdId,
              capture_status: 'completed',
            });

            // Also save legacy OfferCreative for backward compatibility
            const savedCreative = await dbService.saveCreative({
              offer_id: offer.id,
              user_id: offer.user_id,
              meta_ad_id: card.metaAdId,
              meta_ad_url: card.adUrl || metaAdsUrl,
              media_type: candidate.type === 'video' ? 'video' : 'image',
              mime_type: dlResult.mimeType,
              storage_path: uploadRes.storagePath,
              thumbnail_path: uploadRes.thumbnailPath,
              media_url: uploadRes.mediaUrl,
              thumbnail_url: uploadRes.thumbnailUrl,
              original_media_url: candidate.sourceUrl,
              file_hash: dlResult.fileHash,
              file_size: dlResult.fileSize,
              duration_seconds: dlResult.durationSeconds,
              width: dlResult.width,
              height: dlResult.height,
              primary_text: card.primaryText,
              headline: card.headline,
              started_at: card.startedAt,
              first_captured_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
              capture_status: 'completed',
              status: card.status || 'Ativo',
            });

            capturedResults.push({
              id: savedCreative.id,
              metaAdId: card.metaAdId,
              mediaType: candidate.type === 'video' ? 'video' : 'image',
              mimeType: dlResult.mimeType,
              storagePath: uploadRes.storagePath,
              mediaUrl: uploadRes.mediaUrl,
              thumbnailPath: uploadRes.thumbnailPath,
              thumbnailUrl: uploadRes.thumbnailUrl,
              originalMediaUrl: candidate.sourceUrl,
              fileHash: dlResult.fileHash,
              fileSize: dlResult.fileSize,
              headline: card.headline,
              primaryText: card.primaryText,
              startedAt: card.startedAt,
              isNew: true,
            });

            mediaSaved = true;
            newCount++;
            console.log(`[COMPLETE] Ad ${card.metaAdId} processed successfully.`);
            break;
          } catch (mediaDlErr) {
            console.warn(`[MEDIA DL ERROR] Ad ${card.metaAdId}:`, mediaDlErr);
          }
        }

        if (!mediaSaved) {
          // If no media candidate succeeded, record fallback
          await dbService.saveOfferAdMedia({
            offer_id: offer.id,
            user_id: offer.user_id,
            offer_ad_id: savedAd.id,
            media_type: 'image',
            mime_type: 'image/webp',
            storage_path: cardScreenshotPath,
            media_url: cardScreenshotUrl,
            file_hash: `card-screenshot-${card.metaAdId}`,
            is_primary: true,
            capture_status: cardScreenshotUrl ? 'media_unmatched' : 'failed',
          });

          await dbService.saveOfferAd({
            id: savedAd.id,
            offer_id: offer.id,
            meta_ad_id: card.metaAdId,
            capture_status: cardScreenshotUrl ? 'media_unmatched' : 'media_failed',
          });

          failedCount++;
          console.warn(`[MEDIA UNMATCHED] Ad ${card.metaAdId} saved with screenshot fallback.`);
        }
      } catch (cardErr) {
        console.error(`[CARD PROCESS ERROR] Ad ${card.metaAdId}:`, cardErr);
        failedCount++;
      }
    }

    // =========================================================================
    // 11. RE-QUERY COMPLETE ADS & COMPUTE DISTINCT CREATIVES & DATES
    // =========================================================================
    const allAdsWithMedia: OfferAdWithMedia[] = await dbService.getOfferAds(offer.id);
    const uniqueHashes = new Set(
      allAdsWithMedia
        .flatMap((a) => a.media.map((m) => m.file_hash))
        .filter((h) => Boolean(h) && !h.startsWith('card-screenshot-'))
    );

    const totalUniqueCreatives = uniqueHashes.size > 0 ? uniqueHashes.size : allAdsWithMedia.length;
    const videoAds = allAdsWithMedia.filter((a) => a.media.some((m) => m.media_type === 'video'));
    const imageAds = allAdsWithMedia.filter((a) => a.media.some((m) => m.media_type === 'image'));

    // Extract all started_at dates to find earliest ad date and compute days running
    const parsedStartDates = allAdsWithMedia
      .map((a) => parseMetaStartedAt(a.started_at))
      .filter((d): d is Date => d !== null);

    let oldestAdDateIso: string | null = offer.oldest_ad_date || null;
    let computedDaysRunning: number | null = offer.days_running || null;

    if (parsedStartDates.length > 0) {
      const minTimestamp = Math.min(...parsedStartDates.map((d) => d.getTime()));
      const minDate = new Date(minTimestamp);
      oldestAdDateIso = minDate.toISOString();
      const diffMs = Date.now() - minTimestamp;
      computedDaysRunning = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const storedMediaCount = allAdsWithMedia
      .flatMap((a) => a.media)
      .filter((m) => Boolean(m.storage_path) || Boolean(m.media_url)).length;

    await dbService.updateCreativeMetrics(offer.id, {
      captured_ads_count: allAdsWithMedia.length,
      captured_unique_creatives: totalUniqueCreatives,
      unique_creatives_count: totalUniqueCreatives,
      captured_videos_count: videoAds.length,
      captured_images_count: imageAds.length,
      captured_creatives_count: allAdsWithMedia.length,
      stored_media_count: storedMediaCount,
      oldest_ad_date: oldestAdDateIso,
      days_running: computedDaysRunning,
      last_creatives_capture_at: new Date().toISOString(),
    });

    onProgress?.({
      step: 'completed',
      message: `Captura concluída! ${allAdsWithMedia.length} anúncios processados (${totalUniqueCreatives} criativos distintos).`,
      progressPercent: 100,
      totalAds: allAdsWithMedia.length,
      totalVideos: videoAds.length,
      totalImages: imageAds.length,
      debugData: diagnosticReport,
    });

    return {
      success: true,
      mode,
      offerId: offer.id,
      sourceUrl: metaAdsUrl,
      adsDetected: enrichedCards.length,
      adsInScope: inScopeCards.length,
      uniqueCreativesCount: totalUniqueCreatives,
      videosCount: videoAds.length,
      imagesCount: imageAds.length,
      newCreativesCount: newCount,
      existingCreativesCount: existingCount,
      failedCreativesCount: failedCount,
      ads: allAdsWithMedia,
      creatives: capturedResults,
      diagnosticReport,
    };
  } catch (fatalErr: any) {
    console.error('[META-ADS CAPTURE FATAL ERROR]:', fatalErr);
    return {
      success: false,
      mode,
      offerId: offer.id,
      sourceUrl: metaAdsUrl,
      adsDetected: 0,
      adsInScope: 0,
      uniqueCreativesCount: 0,
      videosCount: 0,
      imagesCount: 0,
      newCreativesCount: 0,
      existingCreativesCount: 0,
      failedCreativesCount: 0,
      ads: [],
      creatives: [],
      diagnosticReport: {
        originalUrl: metaAdsUrl,
        finalUrl: metaAdsUrl,
        httpStatus: 500,
        httpStatusText: 'Error',
        pageTitle: '',
        loginDetected: false,
        captchaDetected: false,
        consentDetected: false,
        bodyTextSample: '',
        videoElementsCount: 0,
        imageElementsCount: 0,
        possibleAdCardsCount: 0,
        metaAdIdsFound: [],
        mp4ResponsesCount: 0,
        hlsResponsesCount: 0,
        iframesCount: 0,
        executionTimeMs: Date.now() - startTime,
        error: fatalErr.message,
      },
      errorCode: 'BROWSER_FAILED',
      errorMessage: fatalErr.message || 'Falha na execução do Playwright.',
    };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
    if (session) {
      await closePlaywrightSession(session);
    }
  }
}
