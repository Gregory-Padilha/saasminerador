// ==============================================================================
// OFFER MINER - LANDING PAGE VISUAL CAPTURER (DESKTOP, MOBILE, FULL PAGE, HERO)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Page, Browser } from 'playwright';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { dbService } from '@/lib/supabase/db';
import {
  launchBrowser,
  createPage,
  navigateAndPrepareLP,
  DEFAULT_DESKTOP_VIEWPORT,
  DEFAULT_MOBILE_VIEWPORT,
} from './browser';
import { VisualCaptureResult, LandingPageCapture } from './types';

async function convertToSafeWebp(rawPngBuffer: Buffer, quality = 85): Promise<Buffer> {
  const metadata = await sharp(rawPngBuffer).metadata();
  const width = metadata.width || 1440;
  const height = metadata.height || 1000;

  // WebP has a strict dimension limit of 16383 x 16383 px
  if (width > 15000 || height > 15000) {
    const scale = Math.min(15000 / width, 15000 / height);
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    return await sharp(rawPngBuffer)
      .resize({ width: targetWidth, height: targetHeight, fit: 'inside' })
      .webp({ quality })
      .toBuffer();
  }

  return await sharp(rawPngBuffer).webp({ quality }).toBuffer();
}

export async function captureLandingPageVisuals(
  offerId: string,
  landingPageUrl: string,
  userId?: string | null
): Promise<VisualCaptureResult> {
  const safeUserId = userId || 'default-user';
  const captureId = `lp-cap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const capturedAt = new Date().toISOString();

  // Local target directory: public/uploads/landing-pages/{offerId}/{captureId}/
  const localTargetDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'landing-pages',
    offerId,
    captureId
  );
  if (!fs.existsSync(localTargetDir)) {
    fs.mkdirSync(localTargetDir, { recursive: true });
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();

    // 1. DESKTOP CAPTURES (Viewport, Full Page & Hero)
    const { context: desktopCtx, page: desktopPage } = await createPage(
      browser,
      DEFAULT_DESKTOP_VIEWPORT
    );

    const { finalUrl, domain, httpStatus, pageTitle } = await navigateAndPrepareLP(
      desktopPage,
      landingPageUrl
    );

    // Desktop Viewport Screenshot
    const rawDesktopBuf = await desktopPage.screenshot({ type: 'png' });
    const desktopWebp = await convertToSafeWebp(rawDesktopBuf, 90);
    const desktopFilename = 'desktop.webp';
    const desktopDiskPath = path.join(localTargetDir, desktopFilename);
    fs.writeFileSync(desktopDiskPath, desktopWebp);

    // Full Page Desktop Screenshot
    const rawFullPageBuf = await desktopPage.screenshot({ fullPage: true, type: 'png' });
    const fullPageWebp = await convertToSafeWebp(rawFullPageBuf, 85);
    const fullPageFilename = 'full-page.webp';
    const fullPageDiskPath = path.join(localTargetDir, fullPageFilename);
    fs.writeFileSync(fullPageDiskPath, fullPageWebp);

    // Hero Section Screenshot (Top 900px)
    const rawHeroBuf = await desktopPage.screenshot({
      clip: { x: 0, y: 0, width: 1440, height: 900 },
      type: 'png',
    });
    const heroWebp = await convertToSafeWebp(rawHeroBuf, 90);
    const heroFilename = 'hero.webp';
    const heroDiskPath = path.join(localTargetDir, heroFilename);
    fs.writeFileSync(heroDiskPath, heroWebp);

    await desktopCtx.close();

    // 2. MOBILE CAPTURE
    const { context: mobileCtx, page: mobilePage } = await createPage(
      browser,
      DEFAULT_MOBILE_VIEWPORT
    );
    await navigateAndPrepareLP(mobilePage, landingPageUrl);

    const rawMobileBuf = await mobilePage.screenshot({ fullPage: true, type: 'png' });
    const mobileWebp = await convertToSafeWebp(rawMobileBuf, 85);
    const mobileFilename = 'mobile-full.webp';
    const mobileDiskPath = path.join(localTargetDir, mobileFilename);
    fs.writeFileSync(mobileDiskPath, mobileWebp);

    await mobileCtx.close();

    // 3. STORAGE PATHS & URLS
    const bucketName = 'landing-pages';
    const storagePrefix = `${safeUserId}/${offerId}/${captureId}`;

    let desktopScreenshotPath = `${storagePrefix}/${desktopFilename}`;
    let desktopScreenshotUrl = `/uploads/landing-pages/${offerId}/${captureId}/${desktopFilename}`;

    let fullPageScreenshotPath = `${storagePrefix}/${fullPageFilename}`;
    let fullPageScreenshotUrl = `/uploads/landing-pages/${offerId}/${captureId}/${fullPageFilename}`;

    let heroScreenshotPath = `${storagePrefix}/${heroFilename}`;
    let heroScreenshotUrl = `/uploads/landing-pages/${offerId}/${captureId}/${heroFilename}`;

    let mobileScreenshotPath = `${storagePrefix}/${mobileFilename}`;
    let mobileScreenshotUrl = `/uploads/landing-pages/${offerId}/${captureId}/${mobileFilename}`;

    // Upload to Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const uploads = [
          { path: desktopScreenshotPath, buf: desktopWebp },
          { path: fullPageScreenshotPath, buf: fullPageWebp },
          { path: heroScreenshotPath, buf: heroWebp },
          { path: mobileScreenshotPath, buf: mobileWebp },
        ];

        for (const item of uploads) {
          const { error } = await supabase.storage
            .from(bucketName)
            .upload(item.path, item.buf, { contentType: 'image/webp', upsert: true });

          if (!error) {
            const { data: pubData } = supabase.storage.from(bucketName).getPublicUrl(item.path);
            if (item.path === desktopScreenshotPath) desktopScreenshotUrl = pubData.publicUrl;
            if (item.path === fullPageScreenshotPath) fullPageScreenshotUrl = pubData.publicUrl;
            if (item.path === heroScreenshotPath) heroScreenshotUrl = pubData.publicUrl;
            if (item.path === mobileScreenshotPath) mobileScreenshotUrl = pubData.publicUrl;
          }
        }
      } catch (sbErr) {
        console.warn('[LP STORAGE] Supabase upload warning, using local files:', sbErr);
      }
    }

    // 4. PERSIST CAPTURE RECORD IN DATABASE
    const captureRecord: Partial<LandingPageCapture> = {
      id: captureId,
      user_id: safeUserId,
      offer_id: offerId,
      url: landingPageUrl,
      final_url: finalUrl,
      domain,
      http_status: httpStatus,
      page_title: pageTitle,
      captured_at: capturedAt,
      desktop_screenshot_path: desktopScreenshotPath,
      desktop_screenshot_url: desktopScreenshotUrl,
      mobile_screenshot_path: mobileScreenshotPath,
      mobile_screenshot_url: mobileScreenshotUrl,
      full_page_screenshot_path: fullPageScreenshotPath,
      full_page_screenshot_url: fullPageScreenshotUrl,
      hero_screenshot_path: heroScreenshotPath,
      hero_screenshot_url: heroScreenshotUrl,
      capture_status: 'ready',
    };

    await dbService.saveLandingPageCapture(captureRecord);

    return {
      captureId,
      url: landingPageUrl,
      finalUrl,
      domain,
      httpStatus,
      pageTitle,
      desktopScreenshotPath,
      desktopScreenshotUrl,
      mobileScreenshotPath,
      mobileScreenshotUrl,
      fullPageScreenshotPath,
      fullPageScreenshotUrl,
      heroScreenshotPath,
      heroScreenshotUrl,
      capturedAt,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
