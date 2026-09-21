// ==============================================================================
// OFFER MINER - LANDING PAGE COPY REPOSITORY EXTRACTOR
// ==============================================================================

import { RawPageDomData } from './extract';

export interface ExtractedCopyData {
  headlines: string[];
  subheadlines: string[];
  promises: string[];
  benefits: string[];
  painPoints: string[];
  objections: string[];
  testimonials: string[];
  guarantees: string[];
  ctas: string[];
  faqs: Array<{ question: string; answer: string }>;
  urgency: string[];
}

export function extractStructuredCopy(dom: RawPageDomData): ExtractedCopyData {
  const headlines = dom.h1s.map((h) => h.text).filter(Boolean);
  const subheadlines = dom.h2s.map((h) => h.text).filter(Boolean);

  const ctasSet = new Set<string>();
  dom.buttons.forEach((b) => {
    if (b.text && b.text.length > 2 && b.text.length < 100) {
      ctasSet.add(b.text);
    }
  });

  const promises: string[] = [];
  const benefits: string[] = [];
  const painPoints: string[] = [];
  const objections: string[] = [];
  const testimonials: string[] = [];
  const guarantees: string[] = [];
  const urgency: string[] = [];

  // Extract from list items (great source for benefits and deliverables)
  dom.lists.forEach((l) => {
    l.items.forEach((item) => {
      if (item.length > 5 && item.length < 250) {
        if (/não\s*precisa|mesmo\s*que|sem\s*precisar/i.test(item)) {
          objections.push(item);
        } else {
          benefits.push(item);
        }
      }
    });
  });

  // Extract from paragraphs
  dom.paragraphs.forEach((p) => {
    const text = p.text;
    if (text.length < 15) return;

    if (/garantia|risco\s*zero|reembolso|devolvemos\s*seu/i.test(text)) {
      if (!guarantees.includes(text)) guarantees.push(text);
    } else if (/apenas\s*hoje|tempo\s*limitado|últimas\s*vagas|vagas\s*encerrando/i.test(text)) {
      if (!urgency.includes(text)) urgency.push(text);
    } else if (/você\s*vai\s*aprender|o\s*método\s*que|passo\s*a\s*passo\s*para/i.test(text)) {
      if (!promises.includes(text)) promises.push(text);
    } else if (/cansado\s*de|se\s*você\s*sofre|o\s*grande\s*problema|muitas\s*pessoas\s*erram/i.test(text)) {
      if (!painPoints.includes(text)) painPoints.push(text);
    } else if (/"|“|aluna|depoimento|resultado|consegui\s*fazer/i.test(text) && text.length > 30) {
      if (!testimonials.includes(text)) testimonials.push(text);
    }
  });

  return {
    headlines: headlines.slice(0, 10),
    subheadlines: subheadlines.slice(0, 15),
    promises: promises.slice(0, 10),
    benefits: benefits.slice(0, 30),
    painPoints: painPoints.slice(0, 10),
    objections: objections.slice(0, 10),
    testimonials: testimonials.slice(0, 10),
    guarantees: guarantees.slice(0, 5),
    ctas: Array.from(ctasSet).slice(0, 15),
    faqs: dom.faqItems.slice(0, 20),
    urgency: urgency.slice(0, 5),
  };
}
