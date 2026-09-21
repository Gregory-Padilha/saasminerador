import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function runAudit() {
  const testUrl = process.argv[2] || 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=BR&q=alfabetizacao&search_type=keyword_unordered&media_type=all';
  console.log('====================================================');
  console.log('AUDIT META ADS LIBRARY WITH PLAYWRIGHT');
  console.log('Testing URL:', testUrl);
  console.log('====================================================');

  const outDir = path.resolve(process.cwd(), '.data', 'audit');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const page = await context.newPage();

  const networkResponses: { url: string; status: number; contentType: string }[] = [];
  const videoResponses: string[] = [];
  const hlsResponses: string[] = [];
  const imageResponses: string[] = [];

  page.on('response', (response) => {
    try {
      const url = response.url();
      const status = response.status();
      const contentType = (response.headers()['content-type'] || '').toLowerCase();

      networkResponses.push({ url, status, contentType });

      if (contentType.includes('video/mp4') || url.includes('.mp4')) {
        videoResponses.push(url);
      }
      if (contentType.includes('mpegurl') || url.includes('.m3u8')) {
        hlsResponses.push(url);
      }
      if (contentType.includes('image/') && url.includes('fbcdn.net')) {
        imageResponses.push(url);
      }
    } catch {}
  });

  console.log('[1/6] Navigating to URL...');
  const startTime = Date.now();
  let gotoResponse = null;
  try {
    gotoResponse = await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  } catch (err: any) {
    console.error('goto error:', err.message);
  }

  const finalUrl = page.url();
  const httpStatus = gotoResponse?.status() || null;
  const pageTitle = await page.title().catch(() => '');

  console.log('[2/6] Page navigation complete:', {
    finalUrl,
    httpStatus,
    pageTitle,
    durationMs: Date.now() - startTime,
  });

  // Wait 4 seconds for scripts & dynamic rendering
  console.log('[3/6] Waiting for dynamic scripts and lazy elements...');
  await page.waitForTimeout(4000);

  // Take initial screenshot
  const screenshot1Path = path.join(outDir, '01-initial-loaded.png');
  await page.screenshot({ path: screenshot1Path, fullPage: false });
  console.log('Saved screenshot 1:', screenshot1Path);

  // Check consent dialog
  const consentButtons = await page.$$('button, div[role="button"]');
  console.log(`Found ${consentButtons.length} clickable elements for consent/actions.`);
  for (const btn of consentButtons) {
    const text = (await btn.innerText().catch(() => '')).toLowerCase();
    if (
      text.includes('permitir todos os cookies') ||
      text.includes('allow all cookies') ||
      text.includes('aceitar todos') ||
      text.includes('only essential') ||
      text.includes('apenas essenciais')
    ) {
      console.log('Clicking consent button:', text);
      await btn.click().catch(() => {});
      await page.waitForTimeout(2000);
      break;
    }
  }

  // Scroll to load lazy ads
  console.log('[4/6] Scrolling to discover ads...');
  for (let s = 0; s < 5; s++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1000);
  }

  // Take post-scroll screenshot
  const screenshot2Path = path.join(outDir, '02-post-scroll.png');
  await page.screenshot({ path: screenshot2Path, fullPage: false });
  console.log('Saved screenshot 2:', screenshot2Path);

  // Save HTML dump
  const htmlContent = await page.content();
  const htmlPath = path.join(outDir, 'page.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`Saved HTML (${htmlContent.length} bytes):`, htmlPath);

  // Body text sample
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  console.log('[5/6] Body text sample (first 400 chars):');
  console.log('---');
  console.log(bodyText.substring(0, 400));
  console.log('---');

  // DOM analysis
  const domInfo = await page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video')).map((v) => ({
      src: v.src || v.currentSrc,
      poster: v.poster,
      width: v.videoWidth || v.clientWidth,
      height: v.videoHeight || v.clientHeight,
    }));

    const images = Array.from(document.querySelectorAll('img')).map((img) => ({
      src: img.src || img.currentSrc,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      alt: img.alt,
    }));

    const iframes = Array.from(document.querySelectorAll('iframe')).map((f) => f.src);

    // Search for library IDs or ad text
    const text = document.body.innerText || '';
    const idMatches = Array.from(text.matchAll(/(?:ID da biblioteca|Library ID|ID do anúncio|ID)[:\s]+(\d+)/gi)).map((m) => m[1]);

    // Search for card containers
    const possibleCards = Array.from(document.querySelectorAll('div[role="region"], div[data-testid], a[href*="ads/library"]')).length;

    return {
      videoCount: videos.length,
      videos,
      imageCount: images.length,
      largeImageCount: images.filter((i) => i.width >= 200 && i.height >= 200).length,
      iframeCount: iframes.length,
      idMatches: Array.from(new Set(idMatches)),
      possibleCards,
    };
  });

  console.log('[6/6] DOM & Network Analysis Results:');
  console.log({
    videoElements: domInfo.videoCount,
    videos: domInfo.videos,
    largeImages: domInfo.largeImageCount,
    iframes: domInfo.iframeCount,
    adIdsFound: domInfo.idMatches,
    possibleCards: domInfo.possibleCards,
    videoResponsesIntercepted: videoResponses.length,
    hlsResponsesIntercepted: hlsResponses.length,
    imageResponsesIntercepted: imageResponses.length,
    totalNetworkResponses: networkResponses.length,
  });

  await context.close();
  await browser.close();
}

runAudit().catch((err) => {
  console.error('Audit failed fatal:', err);
});
