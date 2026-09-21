import fs from 'fs';
import path from 'path';
import { dbService } from '@/lib/supabase/db';
import { launchBrowser, createPage, dismissPopups } from '@/lib/landing-page/browser';
import { resolveCheckoutFromLandingPage, resolveCheckoutUrlStatic, resolveCurrentCheckoutUrl, isKnownCheckoutUrl } from './resolver';
import { canonicalizeUrlForComparison } from '@/lib/url-field-mapping';
import { detectCheckoutProvider } from './provider';
import { extractOrderBumpsFromPage } from './bumps';
import { notifyOfferUpdated } from '@/lib/events/offer-events';
import {
  CheckoutCaptureResult,
  CheckoutOrderBumpDetected,
  OrderBumpsStatus,
  CheckoutStatus,
  CheckoutResolutionDiagnostic,
} from './types';
import { Offer, OfferOrderBump } from '@/types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Main Checkout Intelligence Execution Engine:
 * 1. Resolves real Checkout URL via stored checkout_url or CTA navigation
 * 2. Confirms Checkout page DOM signals (buyer form & payment fields)
 * 3. Assigns provider (only if confirmed checkout)
 * 4. Extracts Checkout front price (separate from LP price)
 * 5. Extracts Order Bumps ONLY if checkout_status === 'verified'
 * 6. Generates full diagnostic report & screenshots
 */
export async function mapCheckout(offerId: string): Promise<CheckoutCaptureResult> {
  const now = new Date().toISOString();
  const captureId = `chk_${generateId()}`;

  // 1. Fetch Offer
  const offer = await dbService.getOfferById(offerId);
  if (!offer) {
    throw new Error('Oferta não encontrada para mapear checkout.');
  }

  console.log(`[CHECKOUT INTELLIGENCE] Starting Checkout Mapping for "${offer.product_name}" (ID: ${offer.id})`);

  // 2. Pre-condition Check: Require explicit valid checkout_url distinct from LP
  const staticRes = resolveCurrentCheckoutUrl(offer);
  let diagnostic: CheckoutResolutionDiagnostic;
  let activeBrowser: any = null;
  let activePage: any = null;

  let detectedBumps: CheckoutOrderBumpDetected[] = [];
  let checkoutPrice: number | null = null;
  let fullPageScreenshotUrl: string | null = null;

  if (!staticRes.resolvedCheckoutUrl) {
    console.warn(
      `[CHECKOUT MAPPER ABORTED BEFORE BROWSER] No stored checkout_url found for "${offer.product_name}" (ID: ${offer.id}). Skipping browser launch.`
    );

    diagnostic = {
      offerId: offer.id,
      landingPageUrl: offer.landing_page_url || '',
      checkoutUrlSource: 'NONE',
      selectedUrlReason: 'Checkout não mapeado: URL de checkout ainda não foi descoberta.',
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
      errorCode: 'CHECKOUT_URL_NOT_DISCOVERED',
      userMessage: 'Checkout não mapeado: URL de checkout ainda não foi descoberta.',
      capturedAt: now,
    };
  } else {
    // Valid Checkout URL found! Freeze target URL and launch browser directly.
    const targetUrl = staticRes.resolvedCheckoutUrl;
    console.log(`[CHECKOUT INTELLIGENCE DIAGNOSTIC LOGS]:`);
    console.log(`  - LANDING PAGE URL:           ${offer.landing_page_url || '—'}`);
    console.log(`  - STORED CHECKOUT URL:       ${offer.checkout_url || '—'}`);
    console.log(`  - JOB TARGET URL:            ${targetUrl}`);
    console.log(`  - BROWSER OPENING URL:       ${targetUrl}`);

    try {
      activeBrowser = await launchBrowser();
      const { page } = await createPage(activeBrowser);
      activePage = page;

      console.log(`[CHECKOUT INTELLIGENCE] Navigating DIRECTLY to checkout URL: ${targetUrl}`);
      await activePage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await activePage.waitForTimeout(1500);
      await dismissPopups(activePage);

      const finalUrl = activePage.url();
      const pageTitle = (await activePage.title()) || '';
      const bodyText = await activePage.evaluate(() => document.body.innerText || '');

      console.log(`  - BROWSER FINAL URL:         ${finalUrl}`);

      const providerResult = detectCheckoutProvider(finalUrl, pageTitle, bodyText);

      // Anti-regression safeguard: Ensure finalUrl did NOT redirect back to LP!
      const isRedirectedToLp = Boolean(
        offer.landing_page_url && finalUrl.toLowerCase().includes(offer.landing_page_url.toLowerCase()) && !providerResult.isConfirmedCheckout
      );

      diagnostic = {
        offerId: offer.id,
        landingPageUrl: offer.landing_page_url || '',
        checkoutUrlSource: staticRes.source as any,
        selectedUrlReason: `URL de checkout válida (${targetUrl}) utilizada diretamente.`,
        ctaCandidates: [],
        selectedCta: null,
        clickExecuted: false,
        navigationType: 'redirect',
        redirectChain: [targetUrl, finalUrl],
        finalUrl,
        pageTitle,
        checkoutConfirmed: providerResult.isConfirmedCheckout && !isRedirectedToLp,
        domSignals: providerResult.domSignals,
        provider: providerResult.isConfirmedCheckout ? providerResult.provider : null,
        checkoutPrice: null,
        lpPrice: offer.price || null,
        priceMismatch: false,
        bumpCandidatesCount: 0,
        acceptedBumpsCount: 0,
        screenshotUrl: null,
        errorCode: providerResult.isConfirmedCheckout
          ? null
          : isRedirectedToLp
          ? 'FAILED_REDIRECT_TO_LP'
          : 'CHECKOUT_NOT_CONFIRMED',
        userMessage: providerResult.isConfirmedCheckout
          ? `Checkout confirmado com sucesso (${providerResult.provider}).`
          : isRedirectedToLp
          ? 'A navegação redirecionou de volta para a Landing Page sem apresentar campos de checkout.'
          : 'Página acessada não contém elementos válidos de compra (formulário comprador ou meios de pagamento).',
        capturedAt: now,
      };
    } catch (err: any) {
      if (activeBrowser) {
        await activeBrowser.close().catch(() => {});
        activeBrowser = null;
        activePage = null;
      }
      console.warn(`[CHECKOUT INTELLIGENCE] Failed direct access to checkout URL ${targetUrl}:`, err.message);

      diagnostic = {
        offerId: offer.id,
        landingPageUrl: offer.landing_page_url || '',
        checkoutUrlSource: staticRes.source as any,
        selectedUrlReason: `Falha ao conectar à URL de checkout (${targetUrl}): ${err.message}`,
        ctaCandidates: [],
        selectedCta: null,
        clickExecuted: false,
        navigationType: 'none',
        redirectChain: [targetUrl],
        finalUrl: targetUrl,
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
        errorCode: 'CHECKOUT_ACCESS_FAILED',
        userMessage: `Falha de conexão ao acessar a URL do checkout: ${err.message}`,
        capturedAt: now,
      };
    }
  }

  // 3. Handle Failure / Unconfirmed Checkout States
  if (!diagnostic.finalUrl || !diagnostic.checkoutConfirmed) {
    if (activeBrowser) {
      await activeBrowser.close().catch(() => {});
    }
    console.warn(`[CHECKOUT INTELLIGENCE] Checkout NOT confirmed for "${offer.product_name}". Status: ${diagnostic.errorCode || 'not_confirmed'}`);

    const failureStatus: CheckoutStatus =
      diagnostic.errorCode === 'CTA_NOT_FOUND' || diagnostic.errorCode === 'CHECKOUT_NOT_FOUND'
        ? 'url_not_found'
        : diagnostic.errorCode === 'CHECKOUT_BLOCKED'
        ? 'blocked'
        : 'not_confirmed';

    const failedResult: CheckoutCaptureResult = {
      id: captureId,
      offerId,
      checkoutUrl: diagnostic.finalUrl || '',
      finalUrl: diagnostic.finalUrl || '',
      provider: null,
      status: failureStatus,
      bumpsStatus: 'not_checked', // NEVER set verified_none if checkout is unverified!
      checkoutPrice: null,
      lpPrice: offer.price || null,
      currency: 'BRL',
      orderBumps: [],
      summary: {
        checkoutPrice: null,
        bumpsSum: 0,
        potentialObservedTicket: offer.price || null,
      },
      priceMismatch: false,
      diagnostic,
      errorCode: diagnostic.errorCode || 'CHECKOUT_NOT_CONFIRMED',
      errorMessage: diagnostic.userMessage || 'Não foi possível confirmar a página de checkout real.',
      capturedAt: now,
    };

    const extra = offer.extra_data || {};
    const updatedExtra = {
      ...extra,
      checkout_checked: false,
      checkout_verified: false,
      checkout_status: failureStatus,
      checkout_diagnostic: diagnostic,
      latest_checkout_capture: failedResult,
    };

    await dbService.updateOffer(offerId, {
      checkout_platform: null,
      extra_data: updatedExtra,
    });

    await dbService.saveCheckoutCapture({
      id: captureId,
      offer_id: offerId,
      checkout_url: diagnostic.finalUrl || '',
      final_url: diagnostic.finalUrl || '',
      provider: null,
      status: failureStatus,
      bumps_status: 'not_checked',
      front_price: null,
      currency: 'BRL',
      order_bumps_count: 0,
      captured_at: now,
      raw_data: { diagnostic },
      error_message: diagnostic.userMessage,
    });

    notifyOfferUpdated(offerId);
    return failedResult;
  }

  // 4. CONFIRMED CHECKOUT - Extract Price, Order Bumps across frames, and Screenshot
  console.log(`[CHECKOUT INTELLIGENCE] Extracting Bumps & Price for Confirmed Checkout Page: ${diagnostic.finalUrl} (Provider: ${diagnostic.provider})`);

  try {
    if (!activeBrowser || !activePage) {
      activeBrowser = await launchBrowser();
      const { page } = await createPage(activeBrowser);
      activePage = page;
      await activePage.goto(diagnostic.finalUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await activePage.waitForTimeout(1500);
      await dismissPopups(activePage);
    }

    const bodyText = await activePage.evaluate(() => document.body.innerText || '');

    // Extract Checkout Front Price
    const priceMatches = bodyText.match(/(?:r\$|total|subtotal|por\s*apenas)\s*(\d+[\.,]\d{2})/gi);
    if (priceMatches && priceMatches.length > 0) {
      const parsed = parseFloat(priceMatches[0].replace(/[^0-9,\.]/g, '').replace(',', '.'));
      if (parsed > 0 && parsed < 50000) {
        checkoutPrice = parsed;
      }
    }
    diagnostic.checkoutPrice = checkoutPrice;

    // Extract Order Bumps across all frames
    const bumpResult = await extractOrderBumpsFromPage(activePage, offerId, captureId, offer.product_name);
    detectedBumps = bumpResult.bumps;
    diagnostic.bumpCandidatesCount = bumpResult.diagnostic.totalCommercialCandidates;
    diagnostic.acceptedBumpsCount = bumpResult.bumps.length;

    console.log(`[CHECKOUT BUMPS] Found ${detectedBumps.length} accepted bumps (Selectable DOM items scanned: ${bumpResult.diagnostic.totalSelectableFound})`);

    // Screenshot Capture
    try {
      const uploadDir = path.resolve(process.cwd(), 'public/uploads/checkouts');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const fileName = `checkout_${offerId}_${Date.now()}.png`;
      const filePath = path.join(uploadDir, fileName);

      await activePage.screenshot({ path: filePath, fullPage: true }).catch(() => {});
      fullPageScreenshotUrl = `/uploads/checkouts/${fileName}`;
      diagnostic.screenshotUrl = fullPageScreenshotUrl;
    } catch (scrErr) {
      console.warn('[CHECKOUT INTELLIGENCE] Screenshot error:', scrErr);
    }

    await activeBrowser.close();
    activeBrowser = null;
    activePage = null;
  } catch (err: any) {
    if (activeBrowser) {
      await activeBrowser.close().catch(() => {});
      activeBrowser = null;
      activePage = null;
    }
    console.error('[CHECKOUT INTELLIGENCE] Extraction error:', err);
  }

  // 5. Compute Order Bumps Status & Ticket Summary
  const bumpsSum = detectedBumps.reduce((acc, b) => acc + (b.price || 0), 0);
  const bumpsStatus: OrderBumpsStatus = detectedBumps.length > 0 ? 'verified_found' : 'verified_none';
  const priceMismatch = Boolean(offer.price && checkoutPrice && Math.abs(offer.price - checkoutPrice) > 0.05);

  const potentialObservedTicket = (checkoutPrice || offer.price || 0) + bumpsSum;

  // 6. Deduplicate and Sync Bumps with DB
  const existingBumps = offer.order_bumps || [];
  const mergedBumps: OfferOrderBump[] = [...existingBumps];

  detectedBumps.forEach((db) => {
    if (!mergedBumps.some((b) => b.name.toLowerCase() === db.name.toLowerCase())) {
      mergedBumps.push({
        id: db.id,
        offer_id: offerId,
        name: db.name,
        price: db.price,
        description: db.description,
      });
    }
  });

  await dbService.updateOrderBumps(offerId, mergedBumps);

  // 7. Save Capture Record & Update Offer
  const captureRecord = {
    id: captureId,
    offer_id: offerId,
    checkout_url: diagnostic.finalUrl,
    final_url: diagnostic.finalUrl,
    provider: diagnostic.provider,
    status: 'verified',
    bumps_status: bumpsStatus,
    front_price: checkoutPrice,
    currency: 'BRL',
    order_bumps_count: detectedBumps.length,
    full_page_screenshot_url: fullPageScreenshotUrl,
    price_mismatch: priceMismatch,
    captured_at: now,
    raw_data: {
      diagnostic,
      detectedBumps,
    },
  };

  await dbService.saveCheckoutCapture(captureRecord);

  const extra = offer.extra_data || {};
  const updatedExtra = {
    ...extra,
    checkout_checked: true,
    checkout_verified: true,
    checkout_status: 'verified',
    checkout_url: diagnostic.finalUrl,
    checkout_platform: diagnostic.provider,
    checkout_capture_id: captureId,
    checkout_diagnostic: diagnostic,
    latest_checkout_capture: captureRecord,
  };

  await dbService.updateOffer(offerId, {
    checkout_url: diagnostic.finalUrl,
    checkout_platform: diagnostic.provider,
    extra_data: updatedExtra,
    order_bumps: mergedBumps,
  });

  notifyOfferUpdated(offerId);

  return {
    id: captureId,
    offerId,
    checkoutUrl: diagnostic.finalUrl,
    finalUrl: diagnostic.finalUrl,
    provider: diagnostic.provider,
    status: 'verified',
    bumpsStatus,
    checkoutPrice,
    lpPrice: offer.price || null,
    currency: 'BRL',
    orderBumps: detectedBumps,
    summary: {
      checkoutPrice,
      bumpsSum,
      potentialObservedTicket,
    },
    priceMismatch,
    fullPageScreenshotUrl,
    diagnostic,
    capturedAt: now,
  };
}

/**
 * Dedicated CHECKOUT DISCOVERY Engine:
 * Scans Landing Page CTAs to discover and persist a real distinct checkout URL.
 * Does NOT map order bumps or price — simply discovers the checkout URL.
 */
export async function discoverCheckout(offerId: string) {
  const offer = await dbService.getOfferById(offerId);
  if (!offer) {
    throw new Error('Oferta não encontrada para descobrir checkout.');
  }

  console.log(`[CHECKOUT DISCOVERY] Scanning LP CTAs for offer "${offer.product_name}" (ID: ${offer.id})`);

  const diagnostic = await resolveCheckoutFromLandingPage(offer);

  const isRealCheckoutFound =
    diagnostic.checkoutConfirmed ||
    (diagnostic.finalUrl &&
      isKnownCheckoutUrl(diagnostic.finalUrl) &&
      canonicalizeUrlForComparison(diagnostic.finalUrl) !== canonicalizeUrlForComparison(offer.landing_page_url));

  if (isRealCheckoutFound && diagnostic.finalUrl) {
    console.log(`[CHECKOUT DISCOVERY SUCCESS] Found real Checkout URL: ${diagnostic.finalUrl}`);
    await dbService.updateOffer(offerId, {
      checkout_url: diagnostic.finalUrl,
      checkout_discovery_status: 'FOUND',
      checkout_mapping_status: 'PENDING',
      extra_data: {
        ...(offer.extra_data || {}),
        checkout_discovery_diagnostic: diagnostic,
      },
    });
    notifyOfferUpdated(offerId);
    return { success: true, checkoutUrl: diagnostic.finalUrl, diagnostic };
  } else {
    console.warn(`[CHECKOUT DISCOVERY NOT FOUND] No distinct checkout URL discovered for "${offer.product_name}"`);
    await dbService.updateOffer(offerId, {
      checkout_url: null,
      checkout_discovery_status: 'NOT_FOUND',
      checkout_mapping_status: 'NOT_READY',
      extra_data: {
        ...(offer.extra_data || {}),
        checkout_discovery_diagnostic: diagnostic,
      },
    });
    notifyOfferUpdated(offerId);
    return { success: false, checkoutUrl: null, diagnostic };
  }
}
