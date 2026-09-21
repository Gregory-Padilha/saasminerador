import 'server-only';

import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface PlaywrightSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function createPlaywrightSession(): Promise<PlaywrightSession> {
  console.log('[META-ADS BROWSER] Launching Chromium in Node.js backend...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,1000',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  const page = await context.newPage();

  // Standard navigation timeout
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(45000);

  return { browser, context, page };
}

export async function closePlaywrightSession(session: PlaywrightSession | null) {
  if (!session) return;
  try {
    if (session.page && !session.page.isClosed()) {
      await session.page.close().catch(() => {});
    }
  } catch {}
  try {
    if (session.context) {
      await session.context.close().catch(() => {});
    }
  } catch {}
  try {
    if (session.browser && session.browser.isConnected()) {
      await session.browser.close().catch(() => {});
    }
  } catch {}
  console.log('[META-ADS BROWSER] Browser session closed cleanly.');
}
