// ==============================================================================
// OFFER MINER - DYNAMIC LANDING PAGE SECTION SEGMENTATION & CLASSIFICATION
// ==============================================================================

import { RawPageDomData } from './extract';
import { LandingPageSection } from './types';

export function segmentAndClassifySections(
  dom: RawPageDomData,
  captureId: string,
  offerId: string
): LandingPageSection[] {
  const sections: LandingPageSection[] = [];

  // Combine key structural headings as section boundaries
  const boundaries: Array<{
    heading: string;
    selector: string;
    top: number;
    type?: string;
  }> = [];

  // Add Hero at top 0
  const heroHeading = dom.h1s[0]?.text || dom.title || 'Início da Página (Hero)';
  boundaries.push({
    heading: heroHeading,
    selector: dom.h1s[0]?.selector || 'body > div:first-child',
    top: 0,
    type: 'hero',
  });

  // Add all H2s and distinct H1s as candidate boundaries
  dom.h1s.slice(1).forEach((h) => {
    if (h.top > 600) boundaries.push({ heading: h.text, selector: h.selector, top: h.top });
  });

  dom.h2s.forEach((h) => {
    if (h.top > 400 && !boundaries.some((b) => Math.abs(b.top - h.top) < 150)) {
      boundaries.push({ heading: h.text, selector: h.selector, top: h.top });
    }
  });

  // Add FAQ if present and not already mapped
  if (dom.faqItems.length > 0) {
    const faqHeading = dom.h2s.find((h) => /dúvidas|perguntas|faq/i.test(h.text));
    if (!faqHeading) {
      boundaries.push({
        heading: 'Perguntas Frequentes (FAQ)',
        selector: 'details, .faq',
        top: Math.round(dom.pageHeight * 0.75),
        type: 'faq',
      });
    }
  }

  // Sort boundaries strictly by top offset
  boundaries.sort((a, b) => a.top - b.top);

  // Group text content and classify each section segment
  boundaries.forEach((b, idx) => {
    const nextBoundary = boundaries[idx + 1];
    const top = b.top;
    const bottom = nextBoundary ? nextBoundary.top : dom.pageHeight;

    // Collect all paragraphs and lists within [top, bottom]
    const sectionParas = dom.paragraphs
      .filter((p) => p.top >= top - 50 && p.top < bottom)
      .map((p) => p.text);
    const sectionLists = dom.lists
      .filter((l) => l.top >= top - 50 && l.top < bottom)
      .flatMap((l) => l.items);
    const sectionButtons = dom.buttons
      .filter((btn) => btn.top >= top - 50 && btn.top < bottom)
      .map((btn) => `[CTA: ${btn.text}]`);

    const textContent = [...sectionParas, ...sectionLists, ...sectionButtons].join('\n\n');

    // Classify section type
    const sectionType = b.type || classifySectionType(b.heading, textContent, idx);

    sections.push({
      id: `sec-${captureId}-${idx + 1}`,
      landing_page_capture_id: captureId,
      offer_id: offerId,
      section_type: sectionType,
      position_index: idx + 1,
      heading: b.heading,
      text_content: textContent.slice(0, 3000) || b.heading,
      dom_selector: b.selector,
      top_offset: top,
      bottom_offset: bottom,
      raw_data: {
        paragraphsCount: sectionParas.length,
        listsCount: sectionLists.length,
        buttonsCount: sectionButtons.length,
      },
    });
  });

  return sections;
}

export function classifySectionType(heading: string, text: string, index: number): string {
  if (index === 0) return 'hero';

  const combined = (heading + ' ' + text).toLowerCase();

  if (/faq|perguntas\s*frequentes|dúvidas\s*frequentes|perguntas\s*comuns/i.test(combined)) {
    return 'faq';
  }
  if (/bônus|bonus|você\s*também\s*recebe|bônus\s*exclusivo/i.test(combined)) {
    return 'bonuses';
  }
  if (/garantia|dias\s*de\s*garantia|risco\s*zero|satisfação\s*garantida/i.test(combined)) {
    return 'guarantee';
  }
  if (/preço|investimento|de\s*r\$|por\s*r\$|valor\s*especial|planos|escolha\s*seu/i.test(combined)) {
    return 'pricing';
  }
  if (/o\s*que\s*você\s*recebe|conteúdo|módulos|o\s*que\s*está\s*incluso|dentro\s*do|você\s*vai\s*aprender/i.test(combined)) {
    return 'deliverables';
  }
  if (/depoimento|o\s*que\s*dizem|alunas|alunos|clientes|avaliações|resultados\s*de/i.test(combined)) {
    return 'testimonials';
  }
  if (/mockup|veja\s*por\s*dentro|demonstração|fotos\s*do\s*produto/i.test(combined)) {
    return 'mockups';
  }
  if (/problema|dor|cansado|dificuldade|você\s*já\s*tentou|o\s*grande\s*erro|frustrado/i.test(combined)) {
    return 'problem';
  }
  if (/solução|apresento|conheça|o\s*método|como\s*funciona|a\s*resposta/i.test(combined)) {
    return 'solution';
  }
  if (/benefício|vantagens|por\s*que\s*escolher|motivos|o\s*que\s*você\s*ganha/i.test(combined)) {
    return 'benefits';
  }
  if (/sobre\s*mim|quem\s*sou|quem\s*é|sobre\s*o\s*autor|conheça\s*seu\s*instrutor/i.test(combined)) {
    return 'about';
  }
  if (/comparação|tradicional\s*vs|antes\s*vs|diferença/i.test(combined)) {
    return 'comparison';
  }
  if (/vagas\s*limitadas|últimas\s*horas|cronômetro|encerrando|tempo\s*restante/i.test(combined)) {
    return 'urgency';
  }
  if (/quero\s*meu|comprar\s*agora|comece\s*agora|garanta\s*sua\s*vaga|aproveite\s*agora/i.test(combined)) {
    return 'cta';
  }
  if (/direitos\s*reservados|termos\s*de\s*uso|política\s*de\s*privacidade|cnpj/i.test(combined)) {
    return 'footer';
  }

  return 'unknown';
}
