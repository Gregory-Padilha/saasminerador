// import 'server-only';

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ViewportConfig } from './types';
import { classifyNavigationError } from './resolver';

export const DEFAULT_DESKTOP_VIEWPORT: ViewportConfig = {
  width: 1440,
  height: 1000,
  isMobile: false,
  deviceScaleFactor: 1,
};

export const DEFAULT_MOBILE_VIEWPORT: ViewportConfig = {
  width: 390,
  height: 844,
  isMobile: true,
  deviceScaleFactor: 1,
};

const USER_AGENT_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const USER_AGENT_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

export async function launchBrowser(): Promise<Browser> {
  return await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

export async function createPage(
  browser: Browser,
  viewport: ViewportConfig = DEFAULT_DESKTOP_VIEWPORT
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    userAgent: viewport.isMobile ? USER_AGENT_MOBILE : USER_AGENT_DESKTOP,
    isMobile: Boolean(viewport.isMobile),
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  return { context, page };
}

export async function navigateAndPrepareLP(
  page: Page,
  url: string
): Promise<{
  finalUrl: string;
  domain: string;
  httpStatus: number;
  pageTitle: string;
}> {
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  console.log(`[LP BROWSER] Navigating to: ${url}`);
  let response = null;
  try {
    response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 35000,
    });
  } catch (navErr: any) {
    const classified = classifyNavigationError(navErr);
    const err = new Error(classified.userFriendlyMessage);
    (err as any).status = classified.status;
    (err as any).originalError = navErr.message;
    throw err;
  }

  const httpStatus = response?.status() || 200;
  const finalUrl = page.url() || url;
  const pageTitle = (await page.title()) || domain;

  try {
    domain = new URL(finalUrl).hostname;
  } catch {}

  // Wait briefly for hydration
  await page.waitForTimeout(1000);

  // Dismiss common popups & cookie banners if present
  await dismissPopups(page);

  // Progressive scroll down to trigger lazy loaded images & sections
  await progressiveScroll(page);

  // Scroll back to top for clean hero snapshot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);

  return { finalUrl, domain, httpStatus, pageTitle };
}

export async function dismissPopups(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Aceitar")',
    'button:has-text("Concordar")',
    'button:has-text("Entendi")',
    'button:has-text("OK")',
    'button[aria-label*="close" i]',
    'button[aria-label*="fechar" i]',
    '.cookie-banner button',
    '#cookie-law-info-bar button',
    '.modal-close',
  ];

  for (const sel of selectors) {
    try {
      const locator = page.locator(sel).first();
      if ((await locator.count()) > 0 && (await locator.isVisible())) {
        await locator.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {}
  }
}

export async function progressiveScroll(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 15000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await page.waitForTimeout(500);
  } catch (err) {
    console.warn('[LP BROWSER] Scroll warning:', err);
  }
}
