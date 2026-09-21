// ==============================================================================
// META ADS - PAGE LOADER & ACCESS DETECTOR
// ==============================================================================

import { Page, Response } from 'playwright';
import path from 'path';
import fs from 'fs';
import { CaptureDiagnosticReport, CaptureProgressCallback } from './types';

export interface NetworkCaptureState {
  mp4Urls: Set<string>;
  mp4Buffers: Map<string, Buffer>;
  hlsUrls: Set<string>;
  imageUrls: Set<string>;
  responseCount: number;
}

export function setupNetworkListeners(page: Page): NetworkCaptureState {
  const state: NetworkCaptureState = {
    mp4Urls: new Set<string>(),
    mp4Buffers: new Map<string, Buffer>(),
    hlsUrls: new Set<string>(),
    imageUrls: new Set<string>(),
    responseCount: 0,
  };

  page.on('response', async (response: Response) => {
    state.responseCount++;
    const url = response.url();
    const contentType = (response.headers()['content-type'] || '').toLowerCase();
    const status = response.status();

    if (status >= 200 && status < 400) {
      // Check for video streams
      const isVideo =
        contentType.includes('video/mp4') ||
        contentType.includes('video/') ||
        url.includes('.mp4') ||
        url.includes('video.fpoa') ||
        url.includes('.fbcdn.net/v/');

      if (isVideo) {
        state.mp4Urls.add(url);
        // Attempt to buffer video response body directly from the network stream
        try {
          const body = await response.body().catch(() => null);
          if (body && body.length > 50000) {
            state.mp4Buffers.set(url, body);
            console.log(
              `[PAGE LOADER NETWORK] Buffered MP4 binary response (${(body.length / 1024 / 1024).toFixed(2)} MB): ${url.slice(0, 60)}...`
            );
          }
        } catch {}
      }

      // Check for HLS streams
      if (
        contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/x-mpegurl') ||
        url.includes('.m3u8')
      ) {
        state.hlsUrls.add(url);
      }

      // Check for high-res images
      if (
        (contentType.startsWith('image/jpeg') ||
          contentType.startsWith('image/png') ||
          contentType.startsWith('image/webp')) &&
        (url.includes('scontent') || url.includes('fbcdn.net')) &&
        !url.includes('emoji') &&
        !url.includes('sprite') &&
        !url.includes('rsrc.php')
      ) {
        state.imageUrls.add(url);
      }
    }
  });

  return state;
}

export async function loadMetaAdsPage(
  page: Page,
  sourceUrl: string,
  onProgress?: CaptureProgressCallback
): Promise<{
  report: Partial<CaptureDiagnosticReport>;
  networkState: NetworkCaptureState;
}> {
  console.log('[PAGE LOADER] Setting up network listeners and navigating to:', sourceUrl);

  const networkState = setupNetworkListeners(page);

  onProgress?.({
    step: 'opening_url',
    message: 'Abrindo Biblioteca de Anúncios da Meta...',
    progressPercent: 10,
  });

  let httpResponse: Response | null = null;
  try {
    httpResponse = await page.goto(sourceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
  } catch (gotoErr: any) {
    console.warn('[PAGE LOADER] page.goto warning/timeout:', gotoErr.message);
  }

  onProgress?.({
    step: 'waiting_dom',
    message: 'Aguardando renderização dos componentes...',
    progressPercent: 20,
  });

  // Wait a moment for Meta's client-side React hydration
  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  const httpStatus = httpResponse ? httpResponse.status() : 200;
  const httpStatusText = httpResponse ? httpResponse.statusText() : 'OK';
  const pageTitle = await page.title().catch(() => 'Meta Ads Library');

  console.log('[PAGE LOADER] Navigated to:', {
    finalUrl,
    httpStatus,
    pageTitle,
  });

  onProgress?.({
    step: 'page_loaded',
    message: 'Página carregada. Verificando acesso e permissões...',
    progressPercent: 25,
  });

  return {
    report: {
      originalUrl: sourceUrl,
      finalUrl,
      httpStatus,
      httpStatusText,
      pageTitle,
    },
    networkState,
  };
}

export async function detectAccessState(page: Page): Promise<{
  isLoginRequired: boolean;
  isCaptchaRequired: boolean;
  isBlocked: boolean;
  reason?: string;
}> {
  const currentUrl = page.url().toLowerCase();

  // 1. Check if redirected to hard login page
  if (
    currentUrl.includes('/login.php') ||
    currentUrl.includes('/checkpoint/') ||
    currentUrl.includes('/security/')
  ) {
    return {
      isLoginRequired: true,
      isCaptchaRequired: false,
      isBlocked: true,
      reason: 'Redirecionado para página de autenticação obrigatória.',
    };
  }

  // 2. Check for real login forms inside the main content (not top bar buttons)
  const hasLoginForm = await page
    .evaluate(() => {
      const pwInput = document.querySelector('input[type="password"]');
      const loginForm = document.querySelector(
        'form[action*="login"], form[id*="login_form"], #loginform'
      );
      return !!(pwInput && loginForm);
    })
    .catch(() => false);

  if (hasLoginForm) {
    return {
      isLoginRequired: true,
      isCaptchaRequired: false,
      isBlocked: true,
      reason: 'Formulário de login detectado.',
    };
  }

  // 3. Check for CAPTCHA/Challenge
  const hasCaptcha = await page
    .evaluate(() => {
      const captchaElements = document.querySelectorAll(
        'iframe[src*="captcha"], #captcha, .g-recaptcha, div[class*="captcha"]'
      );
      return captchaElements.length > 0;
    })
    .catch(() => false);

  if (hasCaptcha) {
    return {
      isLoginRequired: false,
      isCaptchaRequired: true,
      isBlocked: true,
      reason: 'Desafio CAPTCHA detectado.',
    };
  }

  return {
    isLoginRequired: false,
    isCaptchaRequired: false,
    isBlocked: false,
  };
}

export async function dismissConsent(page: Page): Promise<boolean> {
  try {
    const clicked = await page.evaluate(() => {
      const selectors = [
        'button[data-testid*="cookie-policy-dialog-accept-button"]',
        'button[data-testid*="cookie-banner-accept"]',
        'button:has-text("Permitir todos os cookies")',
        'button:has-text("Aceitar todos")',
        'button:has-text("Accept all")',
        'button:has-text("Allow all cookies")',
        'button:has-text("Aceitar cookies essenciais e opcionais")',
        'button:has-text("Permitir apenas cookies essenciais")',
      ];

      for (const sel of selectors) {
        try {
          const btn = document.querySelector(sel) as HTMLButtonElement | null;
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        } catch {}
      }

      // Also search standard buttons by text
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const b of buttons) {
        const txt = (b.textContent || '').trim().toLowerCase();
        if (
          txt.includes('permitir todos') ||
          txt.includes('aceitar todos') ||
          txt.includes('accept all') ||
          txt.includes('permitir apenas')
        ) {
          b.click();
          return true;
        }
      }
      return false;
    });

    if (clicked) {
      console.log('[PAGE LOADER] Dismissed cookie consent dialog.');
      await page.waitForTimeout(1000);
      return true;
    }
  } catch (err) {
    console.warn('[PAGE LOADER] Consent check warning:', err);
  }
  return false;
}

export async function saveDiagnosticSnapshot(
  page: Page,
  offerId: string
): Promise<{ screenshotUrl: string; htmlUrl: string }> {
  try {
    const diagDir = path.join(process.cwd(), 'public', 'diagnostics', offerId);
    if (!fs.existsSync(diagDir)) {
      fs.mkdirSync(diagDir, { recursive: true });
    }

    const screenshotPath = path.join(diagDir, 'page-loaded.png');
    const htmlPath = path.join(diagDir, 'page.html');

    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});

    const content = await page.content().catch(() => '');
    if (content) {
      fs.writeFileSync(htmlPath, content, 'utf-8');
    }

    return {
      screenshotUrl: `/diagnostics/${offerId}/page-loaded.png`,
      htmlUrl: `/diagnostics/${offerId}/page.html`,
    };
  } catch (err) {
    console.warn('[PAGE LOADER] Failed to save diagnostic snapshots:', err);
    return { screenshotUrl: '', htmlUrl: '' };
  }
}
