import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { CAPTURE_CONFIG } from './config';
import { CaptureDebugData, OfferCaptureScope, CaptureJobStatus } from '@/types';

export interface DiscoveredAdMedia {
  metaAdId?: string;
  metaAdUrl?: string;
  advertiser?: string;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  thumbnailUrl?: string;
  headline?: string;
  primaryText?: string;
  destinationUrl?: string;
  startedAt?: string;
  matchReason?: string;
  detectedVia: 'dom' | 'network' | 'hybrid';
}

export interface BrowserDiscoveryResult {
  status: CaptureJobStatus;
  errorCode?: string;
  errorMessage?: string;
  requiresIntervention: boolean;
  interventionReason?: string;
  ads: DiscoveredAdMedia[];
  debugData: CaptureDebugData;
}

// -----------------------------------------------------------------------------
// HELPER: Ensure directory exists
// -----------------------------------------------------------------------------
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// -----------------------------------------------------------------------------
// HELPER: Save diagnostic files (Screenshot & HTML)
// -----------------------------------------------------------------------------
async function saveDiagnostics(
  page: Page,
  jobId: string
): Promise<{ screenshotUrl: string | null; htmlUrl: string | null }> {
  try {
    const publicDiagDir = path.resolve(process.cwd(), 'public', 'diagnostics', jobId);
    const dataDiagDir = path.resolve(process.cwd(), '.data', 'diagnostics', jobId);
    ensureDir(publicDiagDir);
    ensureDir(dataDiagDir);

    const screenshotFile = 'page-loaded.png';
    const htmlFile = 'page.html';

    const publicScreenshotPath = path.join(publicDiagDir, screenshotFile);
    const dataScreenshotPath = path.join(dataDiagDir, screenshotFile);

    const publicHtmlPath = path.join(publicDiagDir, htmlFile);
    const dataHtmlPath = path.join(dataDiagDir, htmlFile);

    // Capture full screenshot
    await page.screenshot({ path: publicScreenshotPath, fullPage: false }).catch(() => {});
    if (fs.existsSync(publicScreenshotPath)) {
      fs.copyFileSync(publicScreenshotPath, dataScreenshotPath);
    }

    // Capture HTML snapshot
    const htmlContent = await page.content().catch(() => '');
    if (htmlContent) {
      fs.writeFileSync(publicHtmlPath, htmlContent, 'utf-8');
      fs.writeFileSync(dataHtmlPath, htmlContent, 'utf-8');
    }

    return {
      screenshotUrl: `/diagnostics/${jobId}/${screenshotFile}`,
      htmlUrl: `/diagnostics/${jobId}/${htmlFile}`,
    };
  } catch (err) {
    console.warn('[DIAGNOSTICS] Error saving snapshot:', err);
    return { screenshotUrl: null, htmlUrl: null };
  }
}

// -----------------------------------------------------------------------------
// HELPER: Check for consent modal/dialog and dismiss if standard
// -----------------------------------------------------------------------------
async function dismissConsent(page: Page) {
  try {
    const consentButtons = await page.$$('button, div[role="button"]');
    for (const btn of consentButtons) {
      const text = (await btn.innerText().catch(() => '')).toLowerCase();
      if (
        text.includes('permitir todos os cookies') ||
        text.includes('allow all cookies') ||
        text.includes('aceitar todos') ||
        text.includes('only essential') ||
        text.includes('apenas essenciais') ||
        text.includes('decline optional') ||
        text.includes('recusar opcionais')
      ) {
        console.log('[BROWSER] Dismissing cookie consent dialog:', text);
        await btn.click().catch(() => {});
        await page.waitForTimeout(1500);
        break;
      }
    }
  } catch {}
}

// -----------------------------------------------------------------------------
// HELPER: Check real login wall vs public page
// -----------------------------------------------------------------------------
function evaluateAccessState(finalUrl: string, bodyText: string, pageTitle: string): {
  isBlocked: boolean;
  type?: 'login' | 'captcha' | 'access_denied';
  reason?: string;
} {
  const lowerUrl = finalUrl.toLowerCase();
  const lowerTitle = pageTitle.toLowerCase();
  const lowerBody = bodyText.toLowerCase();

  // 1. Explicit Checkpoint / CAPTCHA
  if (
    lowerUrl.includes('/checkpoint/') ||
    lowerTitle.includes('checkpoint') ||
    lowerTitle.includes('security check') ||
    lowerBody.includes('desafio de segurança') ||
    lowerBody.includes('recaptcha') ||
    lowerBody.includes('hcaptcha')
  ) {
    return {
      isBlocked: true,
      type: 'captcha',
      reason: 'A Meta apresentou um checkpoint ou desafio de segurança (CAPTCHA).',
    };
  }

  // 2. Explicit Redirect to Facebook Login Page (NOT just the ads library with a header login button)
  if (
    lowerUrl.includes('facebook.com/login') ||
    lowerUrl.includes('facebook.com/recover') ||
    (lowerTitle.includes('entrar no facebook') && !lowerUrl.includes('/ads/library'))
  ) {
    return {
      isBlocked: true,
      type: 'login',
      reason: 'A página foi redirecionada para a tela de autenticação obrigatória do Facebook.',
    };
  }

  // 3. Access Denied / Temporarily Blocked
  if (
    lowerBody.includes('acesso temporariamente bloqueado') ||
    lowerBody.includes('you are temporarily blocked') ||
    lowerBody.includes('rate limit exceeded')
  ) {
    return {
      isBlocked: true,
      type: 'access_denied',
      reason: 'Acesso temporariamente bloqueado pela plataforma da Meta.',
    };
  }

  return { isBlocked: false };
}

// -----------------------------------------------------------------------------
// MAIN FUNCTION: Scrape Meta Ads Library with Full Audit & Observability
// -----------------------------------------------------------------------------
export async function scrapeMetaAdsLibrary(
  sourceUrl: string,
  scope: OfferCaptureScope,
  jobId: string,
  onStatusUpdate?: (status: CaptureJobStatus, progress: number, debugPartial?: Partial<CaptureDebugData>) => Promise<void>
): Promise<BrowserDiscoveryResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  const interceptedVideos: { url: string; contentType: string }[] = [];
  const interceptedHls: string[] = [];
  const interceptedImages: string[] = [];

  let finalUrl = sourceUrl;
  let httpStatus: number | null = null;
  let httpStatusText: string | null = null;
  let pageTitle = '';
  let bodyTextSample = '';

  try {
    // 1. Starting browser
    await onStatusUpdate?.('starting_browser', 5);

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    } catch (launchErr: any) {
      console.error('[BROWSER LAUNCH ERROR]:', launchErr);
      const debugData: CaptureDebugData = {
        originalUrl: sourceUrl,
        finalUrl: sourceUrl,
        httpStatus: null,
        httpStatusText: null,
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
        workerError: launchErr.message,
        executionTimeMs: Date.now() - startTime,
      };

      return {
        status: 'browser_start_failed',
        errorCode: 'CHROMIUM_LAUNCH_FAILED',
        errorMessage: `Falha ao iniciar o navegador Chromium: ${launchErr.message}`,
        requiresIntervention: false,
        ads: [],
        debugData,
      };
    }

    context = await browser.newContext({
      userAgent: CAPTURE_CONFIG.USER_AGENT,
      viewport: CAPTURE_CONFIG.VIEWPORT,
      locale: 'pt-BR',
      extraHTTPHeaders: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const page = await context.newPage();

    // 2. Attach Network Interception Listeners
    page.on('response', (response) => {
      try {
        const url = response.url();
        const contentType = (response.headers()['content-type'] || '').toLowerCase();

        // Video responses
        if (
          contentType.includes('video/mp4') ||
          url.includes('.mp4')
        ) {
          if (!url.includes('blob:') && !url.includes('telemetry') && !url.includes('logging')) {
            interceptedVideos.push({ url, contentType });
          }
        }

        // HLS playlists
        if (
          contentType.includes('application/x-mpegurl') ||
          contentType.includes('application/vnd.apple.mpegurl') ||
          url.includes('.m3u8')
        ) {
          interceptedHls.push(url);
        }

        // Creative images from CDN
        if (
          (contentType.includes('image/') || url.includes('.jpg') || url.includes('.png') || url.includes('.webp')) &&
          url.includes('fbcdn.net') &&
          !url.includes('emoji') &&
          !url.includes('icon') &&
          !url.includes('1x1')
        ) {
          interceptedImages.push(url);
        }
      } catch {}
    });

    // 3. Opening URL
    await onStatusUpdate?.('opening_url', 10);
    console.log('[BROWSER] Navigating to exact source URL:', sourceUrl);

    let gotoResponse = null;
    try {
      gotoResponse = await page.goto(sourceUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    } catch (navErr: any) {
      console.warn('[BROWSER] Navigation warning / timeout:', navErr.message);
    }

    finalUrl = page.url();
    httpStatus = gotoResponse?.status() || null;
    httpStatusText = gotoResponse?.statusText() || null;
    pageTitle = await page.title().catch(() => '');

    console.log('[BROWSER] Navigation finished:', {
      finalUrl,
      httpStatus,
      pageTitle,
    });

    // 4. Waiting DOM & initial dynamic rendering
    await onStatusUpdate?.('waiting_dom', 20);
    await page.waitForTimeout(4000);

    bodyTextSample = (await page.evaluate(() => document.body.innerText || '').catch(() => '')).slice(0, 1000);

    // 5. Check Access / Login / CAPTCHA
    await onStatusUpdate?.('checking_access', 25);
    const accessCheck = evaluateAccessState(finalUrl, bodyTextSample, pageTitle);

    if (accessCheck.isBlocked) {
      console.warn('[BROWSER BLOCKED]:', accessCheck.reason);
      const { screenshotUrl, htmlUrl } = await saveDiagnostics(page, jobId);

      const debugData: CaptureDebugData = {
        originalUrl: sourceUrl,
        finalUrl,
        httpStatus,
        httpStatusText,
        pageTitle,
        loginDetected: accessCheck.type === 'login',
        captchaDetected: accessCheck.type === 'captcha',
        consentDetected: false,
        bodyTextSample: bodyTextSample.slice(0, 800),
        videoElementsCount: 0,
        imageElementsCount: 0,
        possibleAdCardsCount: 0,
        metaAdIdsFound: [],
        mp4ResponsesCount: interceptedVideos.length,
        hlsResponsesCount: interceptedHls.length,
        iframesCount: 0,
        screenshotUrl,
        htmlUrl,
        executionTimeMs: Date.now() - startTime,
        workerError: accessCheck.reason,
      };

      const blockedStatus: CaptureJobStatus =
        accessCheck.type === 'login'
          ? 'blocked_login'
          : accessCheck.type === 'captcha'
          ? 'blocked_captcha'
          : 'manual_intervention_required';

      return {
        status: blockedStatus,
        errorCode: 'ACCESS_REQUIRES_INTERVENTION',
        errorMessage: accessCheck.reason,
        requiresIntervention: true,
        interventionReason: accessCheck.reason,
        ads: [],
        debugData,
      };
    }

    // 6. Page Loaded & Dismiss Consent
    await onStatusUpdate?.('page_loaded', 30);
    await onStatusUpdate?.('handling_consent', 35);
    await dismissConsent(page);

    // 7. Scroll Results to trigger lazy-loading
    await onStatusUpdate?.('scrolling_results', 40);
    const maxScrolls = Math.min(CAPTURE_CONFIG.MAX_SCROLL_ITERATIONS, 10);
    for (let s = 0; s < maxScrolls; s++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(1000);
    }

    // Take diagnostic snapshot after scroll
    const { screenshotUrl, htmlUrl } = await saveDiagnostics(page, jobId);

    // 8. Discovering Ad Cards & Extracting Media from DOM
    await onStatusUpdate?.('discovering_ad_cards', 50);

    const domInspection = await page.evaluate(() => {
      const extractedAds: {
        metaAdId?: string;
        metaAdUrl?: string;
        advertiser?: string;
        mediaType: 'video' | 'image';
        mediaUrl: string;
        thumbnailUrl?: string;
        headline?: string;
        primaryText?: string;
        destinationUrl?: string;
        startedAt?: string;
      }[] = [];

      const iframes = Array.from(document.querySelectorAll('iframe')).map((f) => f.src);
      const allAdIds = new Set<string>();

      // Extract from all video elements
      const videoEls = Array.from(document.querySelectorAll('video'));
      videoEls.forEach((v) => {
        let src = v.src || v.currentSrc;
        if (!src) {
          const sourceEl = v.querySelector('source');
          if (sourceEl) src = sourceEl.src;
        }

        const poster = v.poster || undefined;

        // Traverse DOM hierarchy up to 12 levels to find container text & links
        let parent: HTMLElement | null = v.parentElement;
        let cardText = '';
        let destinationUrl: string | undefined;
        let adId: string | undefined;
        let advertiserName: string | undefined;
        let depth = 0;

        while (parent && depth < 12) {
          const text = parent.innerText || '';
          if (
            text.length > 40 &&
            (text.includes('ID') ||
              text.includes('Biblioteca') ||
              text.includes('Veiculado') ||
              text.includes('Ativo') ||
              text.includes('Ver detalhes'))
          ) {
            cardText = text;

            // Extract ID
            const idMatch =
              text.match(/(?:ID da biblioteca|Library ID|ID do anúncio|ID)[:\s]+(\d+)/i) ||
              text.match(/Biblioteca[:\s]+(\d+)/i);
            if (idMatch) {
              adId = idMatch[1];
              allAdIds.add(adId);
            }

            // Extract advertiser
            const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
            if (lines.length > 0 && !lines[0].includes('ID') && !lines[0].includes('Ativo')) {
              advertiserName = lines[0];
            }

            // Extract destination links
            const links = Array.from(parent.querySelectorAll('a'));
            for (const a of links) {
              const href = a.href || '';
              if (href.includes('l.facebook.com/l.php?u=')) {
                try {
                  const parsed = new URL(href);
                  const u = parsed.searchParams.get('u');
                  if (u) destinationUrl = decodeURIComponent(u);
                } catch {}
              } else if (href.startsWith('http') && !href.includes('facebook.com') && !href.includes('meta.com')) {
                destinationUrl = href;
              }
            }
            break;
          }
          parent = parent.parentElement;
          depth++;
        }

        if (src && !src.startsWith('blob:')) {
          extractedAds.push({
            metaAdId: adId,
            advertiser: advertiserName,
            mediaType: 'video',
            mediaUrl: src,
            thumbnailUrl: poster,
            primaryText: cardText.slice(0, 400),
            destinationUrl,
          });
        }
      });

      // Extract from large creative images
      const imgEls = Array.from(document.querySelectorAll('img'));
      imgEls.forEach((img) => {
        const src = img.src || img.currentSrc;
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;

        if (
          src &&
          width >= 200 &&
          height >= 200 &&
          !src.includes('emoji') &&
          !src.includes('icon') &&
          !src.includes('avatar') &&
          src.includes('fbcdn.net')
        ) {
          let parent: HTMLElement | null = img.parentElement;
          let cardText = '';
          let destinationUrl: string | undefined;
          let adId: string | undefined;
          let advertiserName: string | undefined;
          let depth = 0;

          while (parent && depth < 10) {
            const text = parent.innerText || '';
            if (text.length > 40 && (text.includes('ID') || text.includes('Veiculado') || text.includes('Ativo'))) {
              cardText = text;
              const idMatch = text.match(/(?:ID da biblioteca|Library ID|ID)[:\s]+(\d+)/i);
              if (idMatch) {
                adId = idMatch[1];
                allAdIds.add(adId);
              }
              const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
              if (lines.length > 0 && !lines[0].includes('ID')) {
                advertiserName = lines[0];
              }
              break;
            }
            parent = parent.parentElement;
            depth++;
          }

          extractedAds.push({
            metaAdId: adId,
            advertiser: advertiserName,
            mediaType: 'image',
            mediaUrl: src,
            primaryText: cardText.slice(0, 400),
            destinationUrl,
          });
        }
      });

      return {
        extractedAds,
        iframesCount: iframes.length,
        iframeUrls: iframes,
        allAdIds: Array.from(allAdIds),
        videoCount: videoEls.length,
        imageCount: imgEls.length,
      };
    });

    // 9. Extracting Ad IDs & Media Pairing
    await onStatusUpdate?.('extracting_ad_ids', 60);
    await onStatusUpdate?.('detecting_media', 70);

    const rawDiscovered: DiscoveredAdMedia[] = domInspection.extractedAds.map((a) => ({
      ...a,
      detectedVia: 'dom' as const,
    }));

    // Add unique network intercepted videos not yet in DOM list
    const seenMediaUrls = new Set(rawDiscovered.map((a) => a.mediaUrl));
    interceptedVideos.forEach((vid, idx) => {
      if (!seenMediaUrls.has(vid.url)) {
        seenMediaUrls.add(vid.url);
        rawDiscovered.push({
          metaAdId: domInspection.allAdIds[idx] || undefined,
          mediaType: 'video',
          mediaUrl: vid.url,
          detectedVia: 'network',
        });
      }
    });

    console.log(`[BROWSER] Total raw media candidates detected: ${rawDiscovered.length}`);

    // 10. Filter by Offer Scope
    const inScopeAds: DiscoveredAdMedia[] = [];
    const outOfScopeCount = 0;
    const matchReasons: Record<string, number> = {};

    // Prepare scope tokens
    const productTokens = (scope.productName || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 3 && !['para', 'com', 'sem', 'como', 'mais', 'tudo'].includes(t));

    const landingDomain = scope.landingPageDomain?.toLowerCase().replace(/^www\./, '');
    const scopeAdvertiser = scope.advertiser?.toLowerCase().trim();

    for (const ad of rawDiscovered) {
      let matched = false;
      let reason = 'URL_SCOPE';

      // 1. Direct URL Scope (if Meta Ads URL was already filtered for this offer)
      if (scope.metaAdsUrl.includes('view_all_page_id') || scope.metaAdsUrl.includes('q=') || scope.metaAdsUrl.includes('id=')) {
        matched = true;
        reason = 'URL_SCOPE';
      }

      // 2. Landing page domain match
      if (ad.destinationUrl && landingDomain && ad.destinationUrl.toLowerCase().includes(landingDomain)) {
        matched = true;
        reason = 'LANDING_DOMAIN_MATCH';
      }

      // 3. Advertiser match
      if (ad.advertiser && scopeAdvertiser && (ad.advertiser.toLowerCase().includes(scopeAdvertiser) || scopeAdvertiser.includes(ad.advertiser.toLowerCase()))) {
        matched = true;
        reason = 'ADVERTISER_MATCH';
      }

      // 4. Product text match in primary copy
      if (ad.primaryText && productTokens.length > 0) {
        const lowerText = ad.primaryText.toLowerCase();
        const matchesToken = productTokens.some((t) => lowerText.includes(t));
        if (matchesToken) {
          matched = true;
          reason = 'PRODUCT_TEXT_MATCH';
        }
      }

      // Always include if matched or if in standard URL scope
      if (matched) {
        inScopeAds.push({ ...ad, matchReason: reason });
        matchReasons[reason] = (matchReasons[reason] || 0) + 1;
      }
    }

    // Limit to configured MAX_ADS_PER_JOB
    const finalAds = inScopeAds.slice(0, CAPTURE_CONFIG.MAX_ADS_PER_JOB);

    const debugData: CaptureDebugData = {
      originalUrl: sourceUrl,
      finalUrl,
      httpStatus,
      httpStatusText,
      pageTitle,
      loginDetected: false,
      captchaDetected: false,
      consentDetected: false,
      bodyTextSample: bodyTextSample.slice(0, 800),
      videoElementsCount: domInspection.videoCount,
      imageElementsCount: domInspection.imageCount,
      possibleAdCardsCount: rawDiscovered.length,
      metaAdIdsFound: domInspection.allAdIds,
      mp4ResponsesCount: interceptedVideos.length,
      mp4SampleUrls: interceptedVideos.slice(0, 3).map((v) => v.url),
      hlsResponsesCount: interceptedHls.length,
      iframesCount: domInspection.iframesCount,
      iframeUrls: domInspection.iframeUrls.slice(0, 3),
      scopeMatchResults: {
        totalDetected: rawDiscovered.length,
        inScope: finalAds.length,
        outOfScope: outOfScopeCount,
        reasons: matchReasons,
      },
      screenshotUrl,
      htmlUrl,
      executionTimeMs: Date.now() - startTime,
    };

    console.log('[BROWSER] Discovery completed successfully:', {
      inScopeAdsCount: finalAds.length,
      videoCount: finalAds.filter((a) => a.mediaType === 'video').length,
      imageCount: finalAds.filter((a) => a.mediaType === 'image').length,
    });

    if (finalAds.length === 0) {
      return {
        status: 'no_ads_found',
        errorCode: 'NO_ADS_DETECTED',
        errorMessage: 'A página foi carregada com sucesso, mas nenhum anúncio ativo foi identificado para esta busca.',
        requiresIntervention: false,
        ads: [],
        debugData,
      };
    }

    return {
      status: 'completed',
      requiresIntervention: false,
      ads: finalAds,
      debugData,
    };
  } catch (fatalErr: any) {
    console.error('[BROWSER FATAL ERROR]:', fatalErr);
    const debugData: CaptureDebugData = {
      originalUrl: sourceUrl,
      finalUrl,
      httpStatus,
      httpStatusText,
      pageTitle,
      loginDetected: false,
      captchaDetected: false,
      consentDetected: false,
      bodyTextSample: bodyTextSample.slice(0, 800),
      videoElementsCount: 0,
      imageElementsCount: 0,
      possibleAdCardsCount: 0,
      metaAdIdsFound: [],
      mp4ResponsesCount: interceptedVideos.length,
      hlsResponsesCount: interceptedHls.length,
      iframesCount: 0,
      workerError: fatalErr.message,
      executionTimeMs: Date.now() - startTime,
    };

    return {
      status: 'failed',
      errorCode: 'DISCOVERY_EXCEPTION',
      errorMessage: fatalErr.message || 'Erro inesperado durante a análise do navegador.',
      requiresIntervention: false,
      ads: [],
      debugData,
    };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
