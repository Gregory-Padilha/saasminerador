// ==============================================================================
// META ADS - AD CARD & DOM DISCOVERY ENGINE
// ==============================================================================

import { Page } from 'playwright';
import { DiscoveredAdCard, DiscoveredMediaCandidate, CaptureProgressCallback } from './types';

export interface AdDiscoveryOptions {
  maxAds?: number;
  maxScrollIterations?: number;
}

export async function discoverAds(
  page: Page,
  options: AdDiscoveryOptions = {},
  onProgress?: CaptureProgressCallback
): Promise<{
  cards: DiscoveredAdCard[];
  bodyTextSample: string;
  videoElementsCount: number;
  imageElementsCount: number;
  metaReportedCount?: number;
}> {
  const maxAds = options.maxAds || 300;
  const maxScroll = options.maxScrollIterations || 35;

  console.log(`[AD DISCOVERY] Starting ad discovery (maxAds: ${maxAds}, maxScroll: ${maxScroll})...`);

  onProgress?.({
    step: 'waiting_dom',
    message: 'Aguardando renderização completa da Meta Ads Library...',
    progressPercent: 25,
  });

  // 1. Wait for Meta React app hydration and results container
  try {
    await page.waitForFunction(
      () => {
        const text = document.body ? document.body.innerText || '' : '';
        const videos = document.querySelectorAll('video').length;
        const images = document.querySelectorAll('img[src*="fbcdn.net"]').length;
        const hasId = /(?:Identificação da biblioteca|ID da biblioteca|Library ID)[:\s]+\d+/i.test(text);
        const hasResults = text.includes('resultados') || text.includes('results') || text.includes('Nenhum resultado');
        return (text.length > 1000 && (videos > 0 || images > 0 || hasId)) || hasResults;
      },
      { timeout: 15000 }
    );
  } catch (waitErr: any) {
    console.warn('[AD DISCOVERY] waitForFunction timeout, continuing with available DOM:', waitErr.message);
  }

  await page.waitForTimeout(2000);

  // Extract reported results count from header text (e.g., "~260 resultados")
  const metaReportedCount = await page.evaluate(() => {
    const text = document.body ? document.body.innerText || '' : '';
    const match = text.match(/~\s*(\d+[\.\,]?\d*)\s*resultados?|~(\d+[\.\,]?\d*)\s*results?|(\d+[\.\,]?\d*)\s*resultados?/i);
    if (match) {
      const rawNum = (match[1] || match[2] || match[3] || '').replace(/[\.\,]/g, '');
      const parsed = parseInt(rawNum, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return undefined;
  });

  if (metaReportedCount) {
    console.log(`[AD DISCOVERY] Meta reported results count in UI: ~${metaReportedCount}`);
  }

  onProgress?.({
    step: 'scrolling_results',
    message: 'Navegando e carregando anúncios dinâmicos...',
    progressPercent: 35,
  });

  let previousAdCount = 0;
  let consecutiveStalls = 0;

  // 2. Controlled viewport scrolling loop monitoring unique Ad IDs
  for (let i = 0; i < maxScroll; i++) {
    const currentCount = await page
      .evaluate(() => {
        const bodyText = document.body ? document.body.innerText || '' : '';
        const idMatches =
          bodyText.match(
            /(?:Identificação da biblioteca|ID da biblioteca|Library ID)[:\s]+(\d+)/gi
          ) || [];
        const uniqueIds = new Set(idMatches.map((m) => m.replace(/[^0-9]/g, '')));
        const videos = document.querySelectorAll('video').length;
        const images = document.querySelectorAll('img[src*="fbcdn.net"]').length;
        return Math.max(uniqueIds.size, videos + images);
      })
      .catch(() => 0);

    console.log(
      `[AD DISCOVERY] Scroll iteration ${i + 1}/${maxScroll} - current unique ad signals: ${currentCount}`
    );

    if (currentCount >= maxAds) {
      console.log(`[AD DISCOVERY] Reached target max ads limit (${maxAds}). Stopping scroll.`);
      break;
    }

    if (currentCount > 0 && currentCount === previousAdCount) {
      consecutiveStalls++;
      if (consecutiveStalls >= 4) {
        console.log('[AD DISCOVERY] No new items detected after 4 scroll iterations. Stopping scroll.');
        break;
      }
    } else if (currentCount === 0 && i >= 8) {
      console.log('[AD DISCOVERY] Zero items after 8 scroll iterations. Stopping scroll.');
      break;
    } else {
      consecutiveStalls = 0;
    }
    previousAdCount = currentCount;

    // Scroll by ~80% of window height
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8)).catch(() => {});
    await page.waitForTimeout(800 + Math.floor(Math.random() * 400));
  }

  onProgress?.({
    step: 'discovering_ad_cards',
    message: 'Analisando cards e extraindo identificadores dos anúncios...',
    progressPercent: 45,
  });

  // 3. Extract structured Ad Cards from DOM & tag card containers
  const extractionResult = await page.evaluate((maxLimit) => {
    const cardsList: Array<{
      metaAdId: string;
      advertiser?: string;
      status?: string;
      primaryText?: string;
      headline?: string;
      description?: string;
      cta?: string;
      destinationUrl?: string;
      startedAt?: string;
      adUrl?: string;
      mediaCandidates: Array<{
        type: 'video' | 'image';
        sourceUrl: string;
        posterUrl?: string;
        detectedVia: 'dom';
      }>;
    }> = [];

    const bodyText = document.body ? document.body.innerText || '' : '';
    const bodySample = bodyText.slice(0, 500);
    const videoCount = document.querySelectorAll('video').length;
    const imageCount = document.querySelectorAll('img').length;

    // Strategy 1: Find leaf elements containing Library ID label
    const idNodes = Array.from(document.querySelectorAll('span, div, p')).filter((n) => {
      const t = (n.textContent || '').trim();
      return (
        /(?:Identificação da biblioteca|ID da biblioteca|Library ID)[:\s]+(\d+)/i.test(t) &&
        t.length < 80
      );
    });

    const seenIds = new Set<string>();

    for (const node of idNodes) {
      if (cardsList.length >= maxLimit) break;

      const t = (node.textContent || '').trim();
      const match = t.match(
        /(?:Identificação da biblioteca|ID da biblioteca|Library ID)[:\s]+(\d+)/i
      );
      if (!match) continue;

      const adId = match[1];
      if (seenIds.has(adId)) continue;
      seenIds.add(adId);

      // Strict single-card boundary: Climb up until parent contains more than 1 Ad ID or reaches body
      let container: HTMLElement = node as HTMLElement;
      let current = node.parentElement;

      while (current && current.tagName !== 'BODY') {
        const idMatches =
          (current.innerText || '').match(
            /(?:Identificação da biblioteca|ID da biblioteca|Library ID)[:\s]+\d+/gi
          ) || [];
        if (idMatches.length > 1) {
          // current contains multiple cards; container is our single card!
          break;
        }
        container = current;
        current = current.parentElement;
      }

      // Tag the container element for Playwright element screenshots
      container.setAttribute('data-meta-ad-id', adId);

      const cardText = container ? container.innerText || '' : '';
      const lines = cardText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      // Find startedAt date
      const dateMatch = cardText.match(
        /(?:Veiculação iniciada em|Started running on|Início da veiculação)[:\s]+([^\n\r]+)/i
      );
      const startedAt = dateMatch ? dateMatch[1].trim() : undefined;

      // Status
      const status = cardText.includes('Inativo') || cardText.includes('Inactive') ? 'Inativo' : 'Ativo';

      // Find advertiser name from this card
      let advertiserName: string | undefined;
      const patrocinadoNode = Array.from(container.querySelectorAll('span, div, a')).find((el) => {
        const txt = (el.textContent || '').trim().toLowerCase();
        return txt === 'patrocinado' || txt === 'sponsored';
      });
      if (patrocinadoNode) {
        const prevEl =
          patrocinadoNode.parentElement?.previousElementSibling ||
          patrocinadoNode.previousElementSibling;
        if (prevEl && prevEl.textContent) {
          const advCandidate = prevEl.textContent.trim();
          if (advCandidate.length > 1 && advCandidate.length < 60) {
            advertiserName = advCandidate;
          }
        }
      }

      // Find destination links and CTA
      const links = Array.from(container.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      let destUrl: string | undefined;
      let adLink: string | undefined;
      let ctaText: string | undefined;

      for (const link of links) {
        const href = link.href;
        const linkText = (link.textContent || '').trim();

        if (href.includes('ads/library/?id=') || href.includes('ad_archive_id=')) {
          adLink = href;
        } else if (
          !href.includes('facebook.com') &&
          !href.includes('fb.com') &&
          !href.includes('instagram.com')
        ) {
          destUrl = href;
          if (linkText && linkText.length < 30) ctaText = linkText;
        } else if (href.includes('l.facebook.com/l.php')) {
          try {
            const parsed = new URL(href);
            const u = parsed.searchParams.get('u');
            destUrl = u ? decodeURIComponent(u) : href;
          } catch {
            destUrl = href;
          }
          if (linkText && linkText.length < 30) ctaText = linkText;
        }
      }

      // Comprehensive UI Denylist for Meta Ads Library interface text
      const UI_DENYLIST = [
        'abrir menu suspenso',
        'esse anúncio tem várias versões',
        'este anúncio tem várias versões',
        'ver detalhes do anúncio',
        'ver detalhes',
        'see ad details',
        'ver resumo',
        'baixo volume de impressões',
        'impressões:',
        'tempo total ativo',
        'biblioteca de anúncios',
        'identificação da biblioteca',
        'id da biblioteca',
        'library id',
        'veiculação iniciada em',
        'started running on',
        'início da veiculação',
        'patrocinado',
        'sponsored',
        'ativo',
        'inativo',
        'active',
        'inactive',
        'plataformas',
        'platforms',
        'saiba mais',
        'comprar agora',
        'cadastre-se',
        'obter cotação',
        'enviar mensagem',
        'ver anúncio',
        'compartilhar',
        'denunciar anúncio',
        'informações do anunciante',
        'sobre este anúncio',
        'sobre a biblioteca de anúncios',
        'termo de privacidade',
        'cookies',
      ];

      // Clean lines by stripping UI strings
      const cleanedLines = lines.filter((line) => {
        const lower = line.toLowerCase().trim();
        if (lower.length < 5) return false;
        return !UI_DENYLIST.some((denied) => lower.includes(denied));
      });

      // Distinguish primary text (copy) vs headline
      let primaryText: string | undefined;
      let headline: string | undefined;
      let description: string | undefined;

      if (cleanedLines.length > 0) {
        // Find longest text for primary copy
        const sortedByLen = [...cleanedLines].sort((a, b) => b.length - a.length);
        const longest = sortedByLen[0];

        if (longest && longest.length > 20) {
          primaryText = longest;
          // Headline is the first distinct line that is not the longest copy
          const otherLines = cleanedLines.filter((l) => l !== longest);
          if (otherLines.length > 0) {
            headline = otherLines[0];
            if (otherLines.length > 1) {
              description = otherLines[1];
            }
          }
        } else {
          primaryText = cleanedLines[0];
          if (cleanedLines.length > 1) {
            headline = cleanedLines[1];
          }
        }
      }

      // Collect media inside this card
      const mediaCandidates: Array<{
        type: 'video' | 'image';
        sourceUrl: string;
        posterUrl?: string;
        detectedVia: 'dom';
      }> = [];

      // Check <video>
      const vids = Array.from(container.querySelectorAll('video'));
      for (const v of vids) {
        const src = v.currentSrc || v.src;
        const poster = v.poster;
        if (src && src.startsWith('http')) {
          mediaCandidates.push({
            type: 'video',
            sourceUrl: src,
            posterUrl: poster && poster.startsWith('http') ? poster : undefined,
            detectedVia: 'dom',
          });
        }
      }

      // Check <img> (strictly excluding avatars, icons, emojis, sprites)
      const imgs = Array.from(container.querySelectorAll('img'));
      for (const img of imgs) {
        const src = img.currentSrc || img.src;
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;

        if (
          src &&
          src.startsWith('http') &&
          (src.includes('scontent') || src.includes('fbcdn.net')) &&
          !src.includes('emoji') &&
          !src.includes('rsrc.php') &&
          !src.includes('sprite') &&
          !src.includes('s100x100') &&
          !src.includes('s50x50') &&
          !src.includes('s60x60') &&
          !src.includes('s75x75') &&
          !src.includes('p50x50') &&
          !src.includes('p100x100') &&
          !src.includes('t1.30497-1') &&
          !src.includes('c379.0.1290') &&
          (width >= 200 || width === 0) &&
          (height >= 150 || height === 0)
        ) {
          mediaCandidates.push({
            type: 'image',
            sourceUrl: src,
            detectedVia: 'dom',
          });
        }
      }

      cardsList.push({
        metaAdId: adId,
        advertiser: advertiserName,
        status,
        primaryText,
        headline,
        description,
        cta: ctaText,
        startedAt,
        destinationUrl: destUrl,
        adUrl: adLink || `https://www.facebook.com/ads/library/?id=${adId}`,
        mediaCandidates,
      });
    }

    // Strategy 2: Fallback if no ID labels found
    if (cardsList.length === 0) {
      const allVideos = Array.from(document.querySelectorAll('video'));
      let fallbackIndex = 1;

      for (const v of allVideos) {
        if (cardsList.length >= maxLimit) break;
        const src = v.currentSrc || v.src;
        if (src && src.startsWith('http')) {
          const poster = v.poster;
          const parentEl = v.closest('div')?.parentElement;
          const parentText = parentEl ? (parentEl.innerText || '').slice(0, 200) : '';
          const fallbackId = `video-${Date.now()}-${fallbackIndex++}`;

          if (parentEl) parentEl.setAttribute('data-meta-ad-id', fallbackId);

          cardsList.push({
            metaAdId: fallbackId,
            status: 'Ativo',
            primaryText: parentText || 'Anúncio de Vídeo Meta Ads',
            mediaCandidates: [
              {
                type: 'video',
                sourceUrl: src,
                posterUrl: poster && poster.startsWith('http') ? poster : undefined,
                detectedVia: 'dom',
              },
            ],
          });
        }
      }
    }

    return {
      cards: cardsList,
      bodySample,
      videoCount,
      imageCount,
    };
  }, maxAds);

  console.log(`[AD DISCOVERY] Extracted ${extractionResult.cards.length} ad cards from DOM.`);

  return {
    cards: extractionResult.cards,
    bodyTextSample: extractionResult.bodySample,
    videoElementsCount: extractionResult.videoCount,
    imageElementsCount: extractionResult.imageCount,
    metaReportedCount,
  };
}
