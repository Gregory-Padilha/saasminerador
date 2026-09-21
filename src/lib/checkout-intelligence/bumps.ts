// ==============================================================================
// OFFER MINER - ORDER BUMP DETECTOR & EXTRACTOR ENGINE (MULTI-FRAME & STRATEGY)
// ==============================================================================

import { Page, Frame } from 'playwright';
import { CheckoutOrderBumpDetected } from './types';

const BUMP_KEYWORDS = [
  'quero comprar também',
  'quero comprar tambem',
  'oferta especial',
  'oferta especial para você',
  'oferta especial para voce',
  'adicionar ao meu pedido',
  'adicionar ao pedido',
  'adicionar oferta',
  'adicionar também',
  'adicionar tambem',
  'sim, quero',
  'sim! quero',
  'sim, adicionar',
  'leve também',
  'leve tambem',
  'levar junto',
  'completa seu pedido',
  'completar pedido',
  'desconto exclusivo',
  'garantir material',
  'adicionar por',
  'por apenas r$',
  'order bump',
  'produto adicional',
  'acrescentar',
];

const EXCLUDED_KEYWORDS = [
  'aceito os termos',
  'termos de uso',
  'política de privacidade',
  'politica de privacidade',
  'desejo receber',
  'salvar cartão',
  'salvar cartao',
  'salvar dados',
  'forma de pagamento',
  'lembrar meus dados',
  'endereço de cobrança',
  'mesmo endereço',
  'cartão de crédito',
  'cartao de credito',
  'boleto bancário',
  'pix à vista',
];

export interface BumpExtractionDiagnostic {
  totalSelectableFound: number;
  totalCommercialCandidates: number;
  acceptedBumpsCount: number;
  rejectionLogs: Array<{
    candidateText: string;
    reason: string;
  }>;
}

/**
 * Scans page DOM (across all frames) for Order Bump elements using multi-strategy analysis
 */
export async function extractOrderBumpsFromPage(
  page: Page,
  offerId: string,
  checkoutCaptureId: string,
  mainProductName?: string | null
): Promise<{ bumps: CheckoutOrderBumpDetected[]; diagnostic: BumpExtractionDiagnostic }> {
  const diagnostic: BumpExtractionDiagnostic = {
    totalSelectableFound: 0,
    totalCommercialCandidates: 0,
    acceptedBumpsCount: 0,
    rejectionLogs: [],
  };

  const allDetected: CheckoutOrderBumpDetected[] = [];
  const seenTitles = new Set<string>();

  try {
    // 1. Scroll page down and up to trigger lazy rendering of bump cards
    await page.evaluate(async () => {
      const scrollStep = Math.max(200, Math.floor(window.innerHeight * 0.5));
      const totalHeight = document.body.scrollHeight || 2000;
      for (let y = 0; y < totalHeight; y += scrollStep) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      window.scrollTo(0, 0);
    }).catch(() => {});

    await page.waitForTimeout(600);

    // 2. Collect all valid frames (main frame + child iframes)
    const frames: Frame[] = page.frames().filter((f) => !f.isDetached());

    for (let fIdx = 0; fIdx < frames.length; fIdx++) {
      const frame = frames[fIdx];
      try {
        const frameResult = await frame.evaluate(
          ({ offerId, captureId, bumpKeywords, excludedKeywords, mainProduct }) => {
            const detected: any[] = [];
            const rejectionLogs: Array<{ candidateText: string; reason: string }> = [];
            const frameSeen = new Set<string>();

            let selectableFound = 0;
            let commercialFound = 0;

            // Strategy Selector Queries
            const cardQuery =
              '.orderbump-card, [class*="orderbump"], [class*="order-bump"], [class*="bump-card"], [class*="addon"], [class*="adicional"], [class*="extra-item"], [class*="gg-checkout"], [class*="gg-addon"], [data-order-bump], [data-bump]';
            const inputQuery =
              'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="switch"], [aria-checked], .checkbox-custom, .gg-checkbox';
            const buttonQuery =
              'button, a[role="button"], div[role="button"], [class*="btn"], [class*="button"]';

            // Gather elements from all strategies
            const rawElements = Array.from(
              document.querySelectorAll(`${cardQuery}, ${inputQuery}, ${buttonQuery}`)
            );

            selectableFound = rawElements.length;

            for (let i = 0; i < rawElements.length; i++) {
              const el = rawElements[i] as HTMLElement;

              // Find tightest container box containing title & price (up to 4 parent levels)
              let container: HTMLElement = el;
              let current: HTMLElement | null = el.parentElement;
              let level = 0;

              while (current && current.tagName !== 'BODY' && level < 4) {
                const txt = (current.innerText || '').trim();
                container = current;
                // Stop if container text contains both a title and a price match
                if (txt.length > 20 && /(?:r\$|\+r\$|\+\s*r\$)\s*\d+[\.,]\d{2}/i.test(txt)) {
                  break;
                }
                current = current.parentElement;
                level++;
              }

              const containerText = (container.innerText || el.innerText || el.textContent || '').trim();
              if (!containerText || containerText.length < 5) {
                rejectionLogs.push({ candidateText: containerText.slice(0, 50), reason: 'TEXT_TOO_SHORT' });
                continue;
              }

              if (containerText.length > 1500) {
                // Try fallback to immediate element text if container is huge
                const elementText = (el.innerText || '').trim();
                if (elementText.length > 5 && elementText.length < 600) {
                  // Use element text instead of huge body container
                } else {
                  rejectionLogs.push({ candidateText: containerText.slice(0, 50), reason: 'CONTAINER_TOO_LARGE' });
                  continue;
                }
              }

              const lowerText = containerText.toLowerCase();

              // Check exclusions
              let isExcluded = false;
              for (const exKey of excludedKeywords) {
                if (lowerText.includes(exKey)) {
                  isExcluded = true;
                  rejectionLogs.push({ candidateText: containerText.slice(0, 60), reason: `EXCLUDED_KEYWORD: ${exKey}` });
                  break;
                }
              }
              if (isExcluded) continue;

              // Extract price
              let priceVal: number | null = null;
              let originalPriceVal: number | null = null;

              // Match prices like "De R$ 24,90 Por R$ 9,90" or "R$ 9,90"
              const priceMatches = Array.from(
                containerText.matchAll(/(?:por\s*apenas|por|r\$|\+r\$|\+\s*r\$)\s*r?\$?\s*(\d+[\.,]\d{2})/gi)
              );

              if (priceMatches.length > 0) {
                const lastMatch = priceMatches[priceMatches.length - 1];
                priceVal = parseFloat(lastMatch[1].replace(',', '.'));
                if (priceMatches.length > 1) {
                  originalPriceVal = parseFloat(priceMatches[0][1].replace(',', '.'));
                }
              } else {
                const fallbackPrice = containerText.match(/r\$\s*(\d+[\.,]\d{2})/i);
                if (fallbackPrice) {
                  priceVal = parseFloat(fallbackPrice[1].replace(',', '.'));
                }
              }

              // Check if contains bump keyword or price + action phrase
              let hasBumpKeyword = false;
              for (const bKey of bumpKeywords) {
                if (lowerText.includes(bKey)) {
                  hasBumpKeyword = true;
                  break;
                }
              }

              // If has price + (bump keyword OR button/checkbox action context)
              const isCommercialCandidate =
                hasBumpKeyword ||
                (priceVal !== null && (lowerText.includes('quero') || lowerText.includes('adicionar') || lowerText.includes('sim') || lowerText.includes('+')));

              if (!isCommercialCandidate) {
                if (priceVal === null) {
                  rejectionLogs.push({ candidateText: containerText.slice(0, 60), reason: 'NO_PRICE_FOUND' });
                } else {
                  rejectionLogs.push({ candidateText: containerText.slice(0, 60), reason: 'NON_COMMERCIAL_CONTEXT' });
                }
                continue;
              }

              commercialFound++;

              // Parse Product Title and Description from text lines
              const rawLines = containerText
                .split('\n')
                .map((l) => l.trim())
                .filter(
                  (l) =>
                    l.length > 2 &&
                    !/^(de r\$|por apenas|por r\$|r\$|adicionar|oferta especial|sim,|quero comprar|adicionado)/i.test(l)
                );

              let title = rawLines[0] || 'Order Bump';

              // Clean leading "+" or bullet points
              title = title.replace(/^[\+\-\*\•\s]+/, '').trim();

              // Verify title is not main product name
              if (
                mainProduct &&
                mainProduct.length > 3 &&
                title.toLowerCase().includes(mainProduct.toLowerCase())
              ) {
                rejectionLogs.push({ candidateText: title, reason: 'MAIN_PRODUCT_MATCH' });
                continue;
              }

              const description = rawLines.slice(1, 3).join(' ').slice(0, 200) || undefined;

              // Check pre-selection
              let isPreselected = false;
              if (el instanceof HTMLInputElement) {
                isPreselected = el.checked;
              } else if (el.getAttribute('aria-checked') === 'true') {
                isPreselected = true;
              } else if (lowerText.includes('adicionado') || lowerText.includes('remover')) {
                isPreselected = true;
              }

              const titleKey = title.toLowerCase();
              if (title.length > 2 && !frameSeen.has(titleKey)) {
                frameSeen.add(titleKey);
                detected.push({
                  id: `ob_${i}_${Date.now()}`,
                  offer_id: offerId,
                  checkout_capture_id: captureId,
                  name: title.slice(0, 140),
                  description,
                  price: priceVal || 0,
                  currency: 'BRL',
                  is_preselected: isPreselected,
                  input_type: el.tagName === 'INPUT' ? (el as HTMLInputElement).type : 'checkbox',
                  source_text: containerText.slice(0, 300),
                  position: detected.length + 1,
                  created_at: new Date().toISOString(),
                });
              }
            }

            return {
              detected,
              selectableFound,
              commercialFound,
              rejectionLogs,
            };
          },
          {
            offerId,
            captureId: checkoutCaptureId,
            bumpKeywords: BUMP_KEYWORDS,
            excludedKeywords: EXCLUDED_KEYWORDS,
            mainProduct: mainProductName || null,
          }
        );

        diagnostic.totalSelectableFound += frameResult.selectableFound || 0;
        diagnostic.totalCommercialCandidates += frameResult.commercialFound || 0;
        if (frameResult.rejectionLogs) {
          diagnostic.rejectionLogs.push(...frameResult.rejectionLogs.slice(0, 15));
        }

        if (frameResult.detected && frameResult.detected.length > 0) {
          for (const item of frameResult.detected) {
            const key = item.name.toLowerCase();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              allDetected.push(item);
            }
          }
        }
      } catch (fErr) {
        console.warn(`[CHECKOUT BUMPS] Frame evaluation error (frame ${fIdx}):`, fErr);
      }
    }

    diagnostic.acceptedBumpsCount = allDetected.length;
    return { bumps: allDetected, diagnostic };
  } catch (err) {
    console.warn('[CHECKOUT BUMPS] General extraction error:', err);
    return { bumps: [], diagnostic };
  }
}
