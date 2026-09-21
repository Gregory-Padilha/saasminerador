import { Page, Browser } from 'playwright';
import { Offer } from '@/types';
import {
  CheckoutResolutionResult,
  CheckoutResolutionDiagnostic,
  CtaCandidateInfo,
  CheckoutStatus,
} from './types';
import { canonicalizeUrlForComparison, extractHostname } from '@/lib/url-field-mapping';
import { launchBrowser, createPage, dismissPopups } from '@/lib/landing-page/browser';
import { detectCheckoutProvider } from './provider';
import {
  KNOWN_CHECKOUT_DOMAINS,
  PURCHASE_KEYWORDS,
  NON_COMMERCIAL_KEYWORDS,
  isKnownCheckoutUrl,
  resolveCurrentCheckoutUrl,
  resolveCheckoutUrlStatic,
} from './url-resolver';

export {
  KNOWN_CHECKOUT_DOMAINS,
  PURCHASE_KEYWORDS,
  NON_COMMERCIAL_KEYWORDS,
  isKnownCheckoutUrl,
  resolveCurrentCheckoutUrl,
  resolveCheckoutUrlStatic,
};

/**
 * FULL CTA RESOLUTION ENGINE (PLAYWRIGHT FALLBACK)
 * Opens LP in Playwright, detects purchase CTAs, executes real click,
 * captures popup / tab / redirects, and verifies final checkout page.
 */
export async function resolveCheckoutFromLandingPage(
  offer: Offer,
  browserInstance?: Browser
): Promise<CheckoutResolutionDiagnostic> {
  const now = new Date().toISOString();
  const lpUrl = offer.landing_page_url || offer.landing_page_url_original || '';
  const lpCanonical = canonicalizeUrlForComparison(lpUrl);

  const diagnostic: CheckoutResolutionDiagnostic = {
    offerId: offer.id,
    landingPageUrl: lpUrl,
    checkoutUrlSource: 'CTA_DISCOVERY',
    selectedUrlReason: 'Descoberta realizada por CTA da Landing Page (Fallback).',
    ctaCandidates: [],
    selectedCta: null,
    clickExecuted: false,
    navigationType: 'none',
    redirectChain: [],
    finalUrl: null,
    pageTitle: null,
    checkoutConfirmed: false,
    domSignals: {
      hasBuyerForm: false,
      hasPaymentFields: false,
      hasOrderSummary: false,
      hasPrice: false,
      detectedProviderDomain: null,
      buyerFieldsCount: 0,
      paymentKeywordsCount: 0,
    },
    provider: null,
    checkoutPrice: null,
    lpPrice: offer.price || null,
    priceMismatch: false,
    bumpCandidatesCount: 0,
    acceptedBumpsCount: 0,
    screenshotUrl: null,
    errorCode: null,
    userMessage: '',
    capturedAt: now,
  };

  if (!lpUrl) {
    diagnostic.errorCode = 'CTA_NOT_FOUND';
    diagnostic.userMessage = 'Nenhuma Landing Page cadastrada para resolver o checkout.';
    return diagnostic;
  }

  let localBrowser: Browser | null = null;
  let activeBrowser = browserInstance;

  try {
    if (!activeBrowser) {
      localBrowser = await launchBrowser();
      activeBrowser = localBrowser;
    }

    const { context, page } = await createPage(activeBrowser);
    diagnostic.redirectChain.push(lpUrl);

    // 1. Navigate to Landing Page
    console.log(`[CHECKOUT RESOLVER] Opening LP for fallback discovery: ${lpUrl}`);
    await page.goto(lpUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1500);
    await dismissPopups(page);

    // 2. Scan Page DOM for CTA Candidates with improved commercial scoring
    const candidates = await page.evaluate(
      ({ lpCanonical, purchaseKeywords, nonCommercialKeywords, knownDomains }) => {
        const found: any[] = [];
        const elements = Array.from(
          document.querySelectorAll('a[href], button, [role="button"], [class*="btn"], [class*="cta"]')
        );

        elements.forEach((el) => {
          const text = (el.textContent || (el as HTMLInputElement).value || '').trim();
          const href = (el as HTMLAnchorElement).href || el.getAttribute('href') || null;
          const target = el.getAttribute('target') || null;
          const hasOnClick = Boolean(el.getAttribute('onclick')) || Boolean((el as any).onclick);

          if (!text && !href) return;
          const lowerText = text.toLowerCase();
          const lowerHref = (href || '').toLowerCase();

          // Skip internal anchor jumps on same page if text is empty or non-checkout
          if (lowerHref.includes('#') && !lowerHref.includes('pay') && !lowerHref.includes('checkout') && !text) {
            return;
          }

          let score = 0;
          if (purchaseKeywords.some((k) => lowerText.includes(k))) score += 20;
          if (knownDomains.some((d) => lowerHref.includes(d))) score += 40;
          if (nonCommercialKeywords.some((k) => lowerText.includes(k))) score -= 30; // Heavy penalty for non-commercial CTAs!
          if (target === '_blank') score += 5;
          if (hasOnClick) score += 5;

          if (score > 0 || (href && knownDomains.some((d) => lowerHref.includes(d)))) {
            found.push({
              text: text.slice(0, 80),
              href,
              target,
              tagName: el.tagName,
              hasOnClick,
              isNearPrice: false,
              score,
            });
          }
        });

        return found.sort((a, b) => b.score - a.score).slice(0, 10);
      },
      {
        lpCanonical,
        purchaseKeywords: PURCHASE_KEYWORDS,
        nonCommercialKeywords: NON_COMMERCIAL_KEYWORDS,
        knownDomains: KNOWN_CHECKOUT_DOMAINS,
      }
    );

    diagnostic.ctaCandidates = candidates;

    if (candidates.length === 0) {
      diagnostic.errorCode = 'CTA_NOT_FOUND';
      diagnostic.userMessage = 'Nenhum botão de compra ou link de checkout identificado na Landing Page.';
      if (localBrowser) await localBrowser.close();
      return diagnostic;
    }

    const topCta = candidates[0];
    diagnostic.selectedCta = topCta;
    console.log(`[CHECKOUT RESOLVER] Selected CTA candidate: "${topCta.text}" -> ${topCta.href || 'JS Click'} (Score: ${topCta.score})`);

    // 3. Prepare listeners for Popup / Navigation / Redirects
    let targetPage: Page = page;

    const popupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);

    // Locate CTA element in Playwright to execute click
    let clicked = false;
    try {
      if (topCta.href && isKnownCheckoutUrl(topCta.href)) {
        console.log(`[CHECKOUT RESOLVER] CTA href points directly to known checkout: ${topCta.href}`);
        await page.goto(topCta.href, { waitUntil: 'domcontentloaded', timeout: 35000 });
        clicked = true;
        diagnostic.clickExecuted = true;
        diagnostic.navigationType = 'redirect';
      } else {
        const locator = page
          .locator(`a:has-text("${topCta.text}"), button:has-text("${topCta.text}"), [role="button"]:has-text("${topCta.text}")`)
          .first();

        if ((await locator.count()) > 0) {
          console.log(`[CHECKOUT RESOLVER] Executing real Playwright click on CTA "${topCta.text}"`);
          diagnostic.clickExecuted = true;
          await locator.click({ timeout: 5000 }).catch(() => {});
          clicked = true;
        }
      }
    } catch (clickErr: any) {
      console.warn('[CHECKOUT RESOLVER] Click error:', clickErr.message);
    }

    // Check if new tab/popup opened
    const popupPage = await popupPromise;
    if (popupPage) {
      console.log('[CHECKOUT RESOLVER] CTA opened new popup tab!');
      targetPage = popupPage;
      diagnostic.navigationType = 'popup';
      await targetPage.waitForLoadState('domcontentloaded').catch(() => {});
    } else {
      diagnostic.navigationType = 'same_tab';
      await page.waitForTimeout(3000);
    }

    // 4. Capture Final Destination URL & Title
    const finalUrl = targetPage.url();
    const pageTitle = (await targetPage.title()) || '';
    const bodyText = await targetPage.evaluate(() => document.body.innerText || '');

    diagnostic.finalUrl = finalUrl;
    diagnostic.pageTitle = pageTitle;
    diagnostic.redirectChain.push(finalUrl);

    // 5. Confirm Checkout Page via DOM Signals
    const providerResult = detectCheckoutProvider(finalUrl, pageTitle, bodyText);
    diagnostic.checkoutConfirmed = providerResult.isConfirmedCheckout;
    diagnostic.provider = providerResult.provider;
    diagnostic.domSignals = providerResult.domSignals;

    if (!providerResult.isConfirmedCheckout) {
      diagnostic.errorCode = 'CHECKOUT_NOT_CONFIRMED';
      diagnostic.userMessage = 'O botão de compra foi clicado, mas a página de destino não contém os elementos reais de um checkout.';
    } else {
      diagnostic.userMessage = `Checkout verificado com sucesso (${providerResult.provider}).`;
    }

    if (localBrowser) {
      await localBrowser.close();
    }

    return diagnostic;
  } catch (err: any) {
    if (localBrowser) {
      await localBrowser.close().catch(() => {});
    }
    console.error('[CHECKOUT RESOLVER Engine Error]:', err);
    diagnostic.errorCode = 'CTA_CLICK_FAILED';
    diagnostic.userMessage = err.message || 'Falha ao executar navegação até o checkout.';
    return diagnostic;
  }
}
