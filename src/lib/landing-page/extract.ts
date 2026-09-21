// ==============================================================================
// OFFER MINER - LANDING PAGE DOM & HERO RAIO-X EXTRACTOR
// ==============================================================================

import { Page } from 'playwright';
import { LandingPageHeroXRay } from './types';

export interface RawPricingContainer {
  title?: string;
  description?: string;
  text: string;
  top: number;
  prices: number[];
  dePor?: { original: number; current: number };
  installments?: { count: number; value: number };
  ctaText?: string;
  ctaUrl?: string;
  isFeatured?: boolean;
}

export interface RawPageDomData {
  title: string;
  metaDescription: string;
  metaOgImage: string;
  h1s: Array<{ text: string; selector: string; top: number }>;
  h2s: Array<{ text: string; selector: string; top: number }>;
  h3s: Array<{ text: string; selector: string; top: number }>;
  paragraphs: Array<{ text: string; selector: string; top: number }>;
  buttons: Array<{ text: string; href?: string; selector: string; top: number; isCta: boolean }>;
  links: Array<{ text: string; href: string; selector: string; top: number }>;
  images: Array<{ src: string; alt: string; top: number; width: number; height: number }>;
  videos: Array<{ type: string; src?: string; top: number }>;
  faqItems: Array<{ question: string; answer: string }>;
  lists: Array<{ items: string[]; top: number }>;
  pricingContainers?: RawPricingContainer[];
  fullText: string;
  pageHeight: number;
}

export async function extractRawDomData(page: Page): Promise<RawPageDomData> {
  return await page.evaluate(`
    (() => {
      const cleanText = (str) => (str || '').replace(/\\s+/g, ' ').trim();

      const title = document.title || '';
      const metaDescription =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        '';
      const metaOgImage =
        document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      // Headings
      const h1s = [];
      document.querySelectorAll('h1').forEach((el, i) => {
        const text = cleanText(el.innerText);
        if (text.length > 2) {
          const rect = el.getBoundingClientRect();
          h1s.push({ text, selector: 'h1:nth-of-type(' + (i + 1) + ')', top: Math.round(rect.top + window.scrollY) });
        }
      });

      const h2s = [];
      document.querySelectorAll('h2').forEach((el, i) => {
        const text = cleanText(el.innerText);
        if (text.length > 2) {
          const rect = el.getBoundingClientRect();
          h2s.push({ text, selector: 'h2:nth-of-type(' + (i + 1) + ')', top: Math.round(rect.top + window.scrollY) });
        }
      });

      const h3s = [];
      document.querySelectorAll('h3').forEach((el, i) => {
        const text = cleanText(el.innerText);
        if (text.length > 2) {
          const rect = el.getBoundingClientRect();
          h3s.push({ text, selector: 'h3:nth-of-type(' + (i + 1) + ')', top: Math.round(rect.top + window.scrollY) });
        }
      });

      // Paragraphs
      const paragraphs = [];
      document.querySelectorAll('p').forEach((el, i) => {
        const text = cleanText(el.innerText);
        if (text.length > 15) {
          const rect = el.getBoundingClientRect();
          paragraphs.push({ text, selector: 'p:nth-of-type(' + (i + 1) + ')', top: Math.round(rect.top + window.scrollY) });
        }
      });

      // Buttons and CTA Anchors
      const buttons = [];
      const btnCandidates = document.querySelectorAll('button, a.btn, a.button, a[class*="btn" i], a[class*="cta" i], a[class*="comprar" i], a[class*="checkout" i]');
      btnCandidates.forEach((el, i) => {
        const text = cleanText(el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '');
        const href = el.href || undefined;
        const rect = el.getBoundingClientRect();
        if (text.length > 2 || href) {
          buttons.push({
            text: text || 'Botão sem texto',
            href,
            selector: el.tagName.toLowerCase() + ':nth-of-type(' + (i + 1) + ')',
            top: Math.round(rect.top + window.scrollY),
            isCta: Boolean(href && !href.startsWith('#') && !href.startsWith('javascript:')),
          });
        }
      });

      // All links
      const links = [];
      document.querySelectorAll('a[href]').forEach((el, i) => {
        const a = el;
        const text = cleanText(a.innerText);
        const href = a.href;
        if (href && !href.startsWith('javascript:')) {
          const rect = a.getBoundingClientRect();
          links.push({
            text: text || a.title || 'Link',
            href,
            selector: 'a:nth-of-type(' + (i + 1) + ')',
            top: Math.round(rect.top + window.scrollY),
          });
        }
      });

      // Images
      const images = [];
      document.querySelectorAll('img[src]').forEach((el) => {
        const img = el;
        const src = img.src;
        const alt = cleanText(img.alt);
        const rect = img.getBoundingClientRect();
        if (src && !src.startsWith('data:image/svg') && rect.width > 30 && rect.height > 30) {
          images.push({
            src,
            alt,
            top: Math.round(rect.top + window.scrollY),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      });

      // Videos & Players (VSL, YouTube, Vimeo, Panda, Vturb, etc.)
      const videos = [];
      document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="pandavideo"], iframe[src*="vturb"], div[class*="vsl" i], div[id*="vsl" i]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const tagName = el.tagName.toLowerCase();
        let type = 'video_tag';
        let src;

        if (tagName === 'iframe') {
          const iframeSrc = el.src || '';
          if (iframeSrc.includes('youtube')) type = 'youtube';
          else if (iframeSrc.includes('vimeo')) type = 'vimeo';
          else if (iframeSrc.includes('pandavideo')) type = 'pandavideo';
          else if (iframeSrc.includes('vturb')) type = 'vturb';
          else type = 'iframe_player';
          src = iframeSrc;
        } else if (tagName === 'video') {
          src = el.src || el.currentSrc;
        } else {
          type = 'vsl_container';
        }

        videos.push({ type, src, top: Math.round(rect.top + window.scrollY) });
      });

      // FAQ Items
      const faqItems = [];
      document.querySelectorAll('details, .faq-item, [class*="accordion" i]').forEach((el) => {
        const summary = el.querySelector('summary, .faq-question, [class*="question" i], [class*="title" i]');
        const answerEl = el.querySelector('.faq-answer, [class*="answer" i], [class*="content" i], p');
        const qText = cleanText(summary ? summary.innerText : '');
        const aText = cleanText(answerEl ? answerEl.innerText : el.innerText.replace(qText, ''));
        if (qText && qText.length > 5 && aText && aText.length > 5) {
          faqItems.push({ question: qText, answer: aText });
        }
      });

      // Bullet Lists
      const lists = [];
      document.querySelectorAll('ul, ol').forEach((el) => {
        const items = [];
        el.querySelectorAll('li').forEach((li) => {
          const text = cleanText(li.innerText);
          if (text.length > 3) items.push(text);
        });
        if (items.length >= 2) {
          const rect = el.getBoundingClientRect();
          lists.push({ items, top: Math.round(rect.top + window.scrollY) });
        }
      });

      // Commercial CTA & Pricing Cards Detection (CTA-First Approach)
      const pricingContainers = [];
      const ctaCandidates = Array.from(
        document.querySelectorAll('a[href], button, [role="button"], input[type="submit"], [onclick*="checkout" i], [onclick*="location" i], [onclick*="open" i]')
      );

      const commercialCtaEls = [];

      ctaCandidates.forEach((el) => {
        const htmlEl = el;
        const ctaText = cleanText(htmlEl.innerText || htmlEl.getAttribute('title') || htmlEl.getAttribute('aria-label') || htmlEl.value || '');
        const href = htmlEl.href || htmlEl.getAttribute('data-href') || undefined;
        const onclick = htmlEl.getAttribute('onclick') || '';

        let score = 0;

        // 1. Text signals for purchase intent
        if (/comprar|compra|adquirir|garantir|garanta|escolher|assinar|inscrever|quero|receber|obter|aproveitar|iniciar|começar|acesso/i.test(ctaText)) {
          score += 4;
        }
        if (/plano|oferta|desconto|agora|sim!|hoje|passo|checkout|carrinho/i.test(ctaText)) {
          score += 2;
        }

        // 2. Destination signals (href or onclick)
        const destUrl = href || onclick;
        if (destUrl) {
          if (/checkout|pay|payment|kiwify|hotmart|wiapy|ggcheckout|kirvano|perfectpay|eduzz|monetizze|braip|ticto|doppus|cakto|greenn|octopay|cartpanda|yampi/i.test(destUrl)) {
            score += 6;
          } else if (!destUrl.startsWith('#') && !destUrl.startsWith('javascript:')) {
            score += 1;
          }
        }

        if (score >= 3) {
          commercialCtaEls.push({ el: htmlEl, ctaText, ctaUrl: href, score });
        }
      });

      const seenContainers = new Set();

      commercialCtaEls.forEach(({ el: ctaEl, ctaText, ctaUrl }) => {
        // Ascend DOM tree to find smallest pricing card container
        let current = ctaEl.parentElement;
        let cardContainer = null;
        let depth = 0;

        // ASCEND TO FIND THE SMALLEST ANCESTOR THAT CONTAINS A PRICE
        while (current && depth < 8) {
          const tag = current.tagName.toLowerCase();
          if (tag === 'body' || tag === 'main' || tag === 'html' || tag === 'section') break;

          const textLength = cleanText(current.innerText).length;
          const hasPrice = /r\\$\\s*\\d+/i.test(current.innerText);

          if (hasPrice && textLength > 25 && textLength < 2500) {
            cardContainer = current;
            break; // STOP IMMEDIATELY ON LOWEST CONTAINER CONTAINING PRICE!
          }

          current = current.parentElement;
          depth++;
        }

        if (!cardContainer) return;
        if (seenContainers.has(cardContainer)) return;

        const containerText = cleanText(cardContainer.innerText);

        // Check section exclusions (Bonus, FAQ, Guarantee, Testimonials, Earnings/Copy Arguments)
        let parentSection = cardContainer.parentElement;
        let isExcludedSection = false;
        let sectionDepth = 0;
        while (parentSection && sectionDepth < 5) {
          const secText = (parentSection.className + ' ' + parentSection.id).toLowerCase();
          const secHeader = parentSection.querySelector('h1, h2, h3, h4')?.textContent?.toLowerCase() || '';
          const fullSecContent = (secText + ' ' + secHeader).toLowerCase();

          // Reject non-pricing sections: Bonuses, Guarantee, FAQ, Testimonials, Deliverables, Earnings/Faturamento Copy
          if (/bônus|bonus|depoimento|testimonial|faq|garantia|guarantee|entregáveis|deliverables|faturar|faturamento|ganhar|ganho|possibilidade\s*de\s*ganho|potencial|renda\s*extra|lucro|retorno|quanto\s*você\s*pode/i.test(fullSecContent)) {
            // Exclude unless section explicitly mentions pricing/plano/pacote/comprar
            if (!/plano|pricing|pacote|escolha\s*seu|tabela\s*de\s*preço/i.test(fullSecContent)) {
              isExcludedSection = true;
              break;
            }
          }
          parentSection = parentSection.parentElement;
          sectionDepth++;
        }

        if (isExcludedSection) return;

        // Reject earnings / copy argument containers (e.g. "Quanto você pode faturar", "R$ 1 por dia", "Potencial de renda")
        const titleEl = cardContainer.querySelector('h1, h2, h3, h4, h5, [class*="title" i], [class*="name" i], [class*="header" i], strong, b');
        const title = titleEl ? cleanText(titleEl.innerText) : undefined;
        const checkTitle = (title || containerText).toLowerCase();

        if (/faturar|faturamento|ganhar|ganho|possibilidade\s*de\s*ganho|potencial|renda\s*extra|lucro|retorno|custo\s*por\s*dia|investimento\s*diário|menos\s*que\s*um\s*café|quanto\s*vale/i.test(checkTitle)) {
          if (!/plano|pacote|opcao|opção|kit|combo|versão|versao/i.test(checkTitle)) {
            return; // REJECT EARNINGS/COPY ARGUMENT CONTAINER
          }
        }

        // Reject internal anchor links (#comprar, #oferta, #checkout) that are just scroll buttons to pricing section
        const isAnchorScrollOnly = Boolean(ctaUrl && (ctaUrl.includes('#') || ctaUrl.startsWith('#')));
        const hasPlanIdentity = Boolean(title && /plano|pacote|opcao|opção|kit|combo|básico|basico|completo|pro|vip|premium|standard|essencial|profissional/i.test(title));
        if (isAnchorScrollOnly && !hasPlanIdentity) {
          return; // REJECT INLINE SCROLL BUTTONS WITH NO PLAN IDENTITY
        }

        const priceMatches = Array.from(containerText.matchAll(/(?:r\\$|por\\s*apenas\\s*r\\$|apenas\\s*r\\$)\\s*(\\d+[\\.,]\\d{2})/gi));
        const prices = [];
        priceMatches.forEach((m) => {
          const val = parseFloat(m[1].replace(',', '.'));
          if (val > 0 && val < 50000 && !prices.includes(val)) prices.push(val);
        });

        // Must have at least 1 price to be a valid pricing card
        if (prices.length === 0) return;

        seenContainers.add(cardContainer);

        const rect = cardContainer.getBoundingClientRect();
        const top = Math.round(rect.top + window.scrollY);

        // Extract De / Por within card
        let dePor = undefined;
        const dePorM = containerText.match(/de\\s*(?:r\\$)?\\s*(\\d+[\\.,]\\d{2}|\\d+)\\s*(?:por|por\\s*apenas|para)\\s*(?:r\\$)?\\s*(\\d+[\\.,]\\d{2}|\\d+)/i);
        if (dePorM) {
          dePor = {
            original: parseFloat(dePorM[1].replace(',', '.')),
            current: parseFloat(dePorM[2].replace(',', '.')),
          };
        }

        // Extract Installments within card
        let installments = undefined;
        const instM = containerText.match(/(\\d+)\\s*x\\s*(?:de\\s*)?(?:r\\$)?\\s*(\\d+[\\.,]\\d{2})/i);
        if (instM) {
          installments = {
            count: parseInt(instM[1], 10),
            value: parseFloat(instM[2].replace(',', '.')),
          };
        }

        const isFeatured = /mais\\s*vendido|recomendado|mais\\s*popular|popular|destaque|melhor\\s*custo|campeão/i.test(containerText);

        pricingContainers.push({
          title,
          text: containerText,
          top,
          prices,
          dePor,
          installments,
          ctaText: ctaText || undefined,
          ctaUrl: ctaUrl || undefined,
          isFeatured,
        });
      });

      const fullText = cleanText(document.body.innerText);
      const pageHeight = document.body.scrollHeight;

      return {
        title,
        metaDescription,
        metaOgImage,
        h1s,
        h2s,
        h3s,
        paragraphs,
        buttons,
        links,
        images,
        videos,
        faqItems,
        lists,
        pricingContainers,
        fullText,
        pageHeight,
      };
    })()
  `);
}

export function extractHeroXRay(dom: RawPageDomData): LandingPageHeroXRay {
  const heroCutoff = Math.min(1000, dom.pageHeight * 0.25);

  // 1. Headline (First H1 or prominent title in hero area)
  const heroH1 = dom.h1s.find((h) => h.top < heroCutoff) || dom.h1s[0];
  const headline = heroH1?.text || dom.title || '';

  // 2. Subheadline (First H2 in hero or paragraph immediately after H1)
  const heroH2 = dom.h2s.find((h) => h.top < heroCutoff && (!heroH1 || h.top > heroH1.top - 50));
  const heroPara = dom.paragraphs.find((p) => p.top < heroCutoff && (!heroH1 || p.top > heroH1.top));
  const subheadline = heroH2?.text || heroPara?.text || dom.metaDescription || null;

  // 3. Eyebrow (Short text preceding H1 in top 400px)
  const eyebrowCandidate = dom.paragraphs.find(
    (p) => heroH1 && p.top < heroH1.top && p.text.length < 100
  );
  const eyebrow = eyebrowCandidate?.text || null;

  // 4. Primary & Secondary CTA in Hero
  const heroButtons = dom.buttons.filter((b) => b.top < heroCutoff);
  const ctaPrimary = heroButtons[0]
    ? { text: heroButtons[0].text, url: heroButtons[0].href }
    : undefined;
  const ctaSecondary = heroButtons[1]
    ? { text: heroButtons[1].text, url: heroButtons[1].href }
    : undefined;

  // 5. Main Hero Image or Mockup
  const heroImages = dom.images.filter((img) => img.top < heroCutoff);
  const mainImage = heroImages[0]?.src || dom.metaOgImage || null;
  const mockupDetected = heroImages.some(
    (img) =>
      img.alt.toLowerCase().includes('mockup') ||
      img.alt.toLowerCase().includes('box') ||
      img.alt.toLowerCase().includes('produto') ||
      img.alt.toLowerCase().includes('capa')
  );

  // 6. Video in Hero
  const videoDetected = dom.videos.some((v) => v.top < heroCutoff);

  // 7. Social Proof in Hero (e.g. "4.9 estrelas", "1.200 avaliações")
  const heroText = dom.fullText.slice(0, 2000);
  let socialProof: string | null = null;
  const socialProofMatch = heroText.match(
    /(\d+[\.,]?\d*\s*(estrelas|avaliações|clientes|alunos|alunas|compradores|depoimentos))/i
  );
  if (socialProofMatch) {
    socialProof = socialProofMatch[0];
  }

  // 8. Guarantee in Hero
  let guarantee: string | null = null;
  const guaranteeMatch = heroText.match(/(\d+\s*dias\s*de\s*garantia|garantia\s*incondicional|risco\s*zero)/i);
  if (guaranteeMatch) {
    guarantee = guaranteeMatch[0];
  }

  // 9. Pricing in Hero (e.g. "R$ 19,90" or "De R$ 97 por R$ 19,90")
  let price: string | null = null;
  let discount: string | null = null;
  const priceMatches = Array.from(heroText.matchAll(/R\$\s*(\d+[\.,]\d{2})/gi));
  if (priceMatches.length > 0) {
    price = priceMatches[priceMatches.length - 1][0];
    if (priceMatches.length > 1) {
      discount = `De ${priceMatches[0][0]} por ${priceMatches[priceMatches.length - 1][0]}`;
    }
  }

  // 10. Urgency / Scarcity in Hero
  let urgency: string | null = null;
  let scarcity: string | null = null;
  if (/apenas\s*hoje|tempo\s*limitado|oferta\s*por\s*tempo/i.test(heroText)) {
    urgency = 'Oferta por tempo limitado identificada';
  }
  if (/vagas\s*limitadas|últimas\s*unidades|restam\s*apenas/i.test(heroText)) {
    scarcity = 'Gatilho de escassez identificado';
  }

  // 11. Badges & Seals
  const badges: string[] = [];
  if (/compra\s*segura/i.test(heroText)) badges.push('Compra Segura');
  if (/acesso\s*imediato/i.test(heroText)) badges.push('Acesso Imediato');
  if (/satisfação\s*garantida/i.test(heroText)) badges.push('Satisfação Garantida');
  if (/pagamento\s*único/i.test(heroText)) badges.push('Pagamento Único');

  return {
    eyebrow,
    headline,
    subheadline,
    paragraph: heroPara?.text || null,
    cta_primary: ctaPrimary,
    cta_secondary: ctaSecondary,
    main_image_url: mainImage,
    mockup_detected: mockupDetected,
    video_detected: videoDetected,
    social_proof: socialProof,
    guarantee,
    price,
    discount,
    urgency,
    scarcity,
    badges,
  };
}
