// ==============================================================================
// OFFER MINER - LANDING PAGE ANALYSIS ORCHESTRATOR & DOSSIER SYNC
// ==============================================================================

import { Browser } from 'playwright';
import { dbService } from '@/lib/supabase/db';
import {
  launchBrowser,
  createPage,
  navigateAndPrepareLP,
  DEFAULT_DESKTOP_VIEWPORT,
} from './browser';
import { captureLandingPageVisuals } from './capture';
import { extractRawDomData, extractHeroXRay } from './extract';
import { segmentAndClassifySections } from './sections';
import { extractStructuredCopy } from './copy';
import { extractAndClassifyLinks } from './links';
import { extractCommerceData } from './commerce';
import {
  LandingPageAnalysisResult,
  LPAnalyzeProgressEvent,
} from './types';

export async function analyzeAndMapLandingPage(
  offerId: string,
  landingPageUrl: string,
  userId?: string | null,
  onProgress?: (event: LPAnalyzeProgressEvent) => void
): Promise<LandingPageAnalysisResult> {
  const emit = (step: LPAnalyzeProgressEvent['step'], message: string, progressPercent: number, result?: any) => {
    if (onProgress) {
      onProgress({ step, message, progressPercent, result });
    }
  };

  emit('opening_url', 'Abrindo Landing Page no navegador...', 10);

  // 1. First capture visuals
  emit('capturing_visuals', 'Capturando screenshots (Desktop, Mobile, Full-Page e Hero)...', 25);
  const visuals = await captureLandingPageVisuals(offerId, landingPageUrl, userId);

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const { context, page } = await createPage(browser, DEFAULT_DESKTOP_VIEWPORT);

    emit('waiting_dom', 'Aguardando renderização do DOM...', 40);
    await navigateAndPrepareLP(page, landingPageUrl);

    // 2. Extract DOM data
    emit('analyzing_dom', 'Analisando estrutura HTML e elementos da página...', 50);
    const domData = await extractRawDomData(page);

    // 3. Extract Hero Raio-X
    emit('extracting_hero', 'Extraindo Raio-X da Hero...', 60);
    const heroXRay = extractHeroXRay(domData);

    // 4. Segment Sections
    emit('mapping_sections', 'Segmentando e classificando seções da página...', 70);
    const sections = segmentAndClassifySections(domData, visuals.captureId, offerId);

    // 5. Extract Copy
    emit('extracting_copy', 'Estruturando repositório de copy...', 80);
    const copy = extractStructuredCopy(domData);

    // 6. Extract Links & Checkout
    emit('extracting_links', 'Extraindo links e identificando plataforma de checkout...', 85);
    const links = extractAndClassifyLinks(domData, visuals.captureId, offerId, visuals.domain);

    // 7. Extract Commerce Data
    emit('identifying_commerce', 'Extraindo preço, garantia, entregáveis e bônus...', 90);
    const commerce = extractCommerceData(domData, links);

    // 8. Commercial Elements Presence Map
    const elements = {
      hasVsl: domData.videos.some((v) => v.type === 'vsl_container' || v.type === 'pandavideo' || v.type === 'vturb'),
      hasVideo: domData.videos.length > 0,
      hasImages: domData.images.length > 0,
      hasMockups: heroXRay.mockup_detected || domData.images.some((i) => /mockup|box|capa/i.test(i.alt)),
      hasTestimonials: copy.testimonials.length > 0,
      hasReviews: Boolean(heroXRay.social_proof) || /avaliações|estrelas/i.test(domData.fullText),
      hasRating: Boolean(heroXRay.rating) || /4\.\d|5\.\d/i.test(domData.fullText),
      hasTimer: Boolean(heroXRay.urgency) || /cronômetro|tempo\s*restante|horas/i.test(domData.fullText),
      hasFaq: domData.faqItems.length > 0,
      hasGuarantee: Boolean(commerce.guaranteeText),
      hasPriceTable: Boolean(commerce.currentPrice),
      hasBadges: (heroXRay.badges || []).length > 0,
      hasCheckout: links.some((l) => l.link_type === 'checkout'),
      hasWhatsApp: links.some((l) => l.link_type === 'whatsapp'),
      hasStickyCta: domData.buttons.some((b) => b.isCta),
      hasPopup: false,
    };

    // 9. Provenance map
    const provenance: Record<string, { source: string; evidenceText: string; selector?: string }> = {
      headline: {
        source: 'landing_page',
        evidenceText: heroXRay.headline || domData.title,
        selector: domData.h1s[0]?.selector,
      },
      price: {
        source: 'landing_page',
        evidenceText: commerce.currentPrice ? `R$ ${commerce.currentPrice.toFixed(2)}` : 'Não detectado',
      },
      guarantee: {
        source: 'landing_page',
        evidenceText: commerce.guaranteeText || 'Não detectada',
      },
      checkout: {
        source: 'landing_page',
        evidenceText: commerce.checkoutPlatform || 'Custom',
      },
    };

    // Complete analysis payload
    const analysisResult: LandingPageAnalysisResult = {
      capture: {
        id: visuals.captureId,
        user_id: userId || 'default-user',
        offer_id: offerId,
        url: landingPageUrl,
        final_url: visuals.finalUrl,
        domain: visuals.domain,
        http_status: visuals.httpStatus,
        page_title: visuals.pageTitle,
        captured_at: visuals.capturedAt,
        desktop_screenshot_path: visuals.desktopScreenshotPath,
        desktop_screenshot_url: visuals.desktopScreenshotUrl,
        mobile_screenshot_path: visuals.mobileScreenshotPath,
        mobile_screenshot_url: visuals.mobileScreenshotUrl,
        full_page_screenshot_path: visuals.fullPageScreenshotPath,
        full_page_screenshot_url: visuals.fullPageScreenshotUrl,
        hero_screenshot_path: visuals.heroScreenshotPath,
        hero_screenshot_url: visuals.heroScreenshotUrl,
        capture_status: 'analyzed',
      },
      heroXRay,
      sections,
      copy,
      elements,
      links,
      commerce,
      provenance,
    };

    // 10. Persist structured records in DB
    emit('syncing_dossier', 'Sincronizando dados com o dossiê da oferta...', 95);

    // Update capture with analysis data
    await dbService.saveLandingPageCapture({
      ...analysisResult.capture,
      raw_data: { analysis: analysisResult },
      capture_status: 'analyzed',
    });

    // Save sections
    await dbService.saveLandingPageSections(visuals.captureId, offerId, sections);

    // Save links
    await dbService.saveLandingPageLinks(visuals.captureId, offerId, links);

    // Sync to Offer dossier
    await dbService.syncLandingPageToOffer(offerId, analysisResult);

    await context.close();

    emit('done', 'Mapeamento da Landing Page concluído com sucesso!', 100, analysisResult);

    return analysisResult;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
