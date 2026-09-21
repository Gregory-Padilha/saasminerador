// ==============================================================================
// OFFER MINER - LANDING PAGE FACTUAL DIFF COMPARATOR
// ==============================================================================

import { LandingPageCapture, LandingPageDiff, LandingPageSection } from './types';

export function compareLandingPageCaptures(
  prevCapture: LandingPageCapture,
  currCapture: LandingPageCapture,
  prevSections: LandingPageSection[] = [],
  currSections: LandingPageSection[] = []
): LandingPageDiff {
  const summary: string[] = [];

  const prevAnalysis = prevCapture.raw_data?.analysis || {};
  const currAnalysis = currCapture.raw_data?.analysis || {};

  // 1. Price comparison
  const prevPrice = prevAnalysis.commerce?.currentPrice;
  const currPrice = currAnalysis.commerce?.currentPrice;
  const priceChanged = prevPrice !== undefined && currPrice !== undefined && prevPrice !== currPrice;

  if (priceChanged) {
    summary.push(
      `Preço alterado: R$ ${prevPrice?.toFixed(2)} → R$ ${currPrice?.toFixed(2)}`
    );
  }

  // 2. Headline comparison
  const prevHeadline = prevAnalysis.heroXRay?.headline || prevCapture.page_title;
  const currHeadline = currAnalysis.heroXRay?.headline || currCapture.page_title;
  const headlineChanged =
    Boolean(prevHeadline) && Boolean(currHeadline) && prevHeadline !== currHeadline;

  if (headlineChanged) {
    summary.push(`Headline principal alterada na Hero`);
  }

  // 3. CTA comparison
  const prevCta = prevAnalysis.heroXRay?.cta_primary?.text;
  const currCta = currAnalysis.heroXRay?.cta_primary?.text;
  const ctaChanged = Boolean(prevCta) && Boolean(currCta) && prevCta !== currCta;

  if (ctaChanged) {
    summary.push(`CTA principal alterado: "${prevCta}" → "${currCta}"`);
  }

  // 4. Sections added / removed
  const prevSecTypes = new Set(prevSections.map((s) => s.section_type));
  const currSecTypes = new Set(currSections.map((s) => s.section_type));

  const sectionsAdded: string[] = [];
  const sectionsRemoved: string[] = [];

  currSecTypes.forEach((t) => {
    if (!prevSecTypes.has(t)) {
      sectionsAdded.push(t);
      summary.push(`Nova seção detectada: ${t.toUpperCase()}`);
    }
  });

  prevSecTypes.forEach((t) => {
    if (!currSecTypes.has(t)) {
      sectionsRemoved.push(t);
      summary.push(`Seção removida: ${t.toUpperCase()}`);
    }
  });

  // 5. Bonuses comparison
  const prevBonuses = (prevAnalysis.commerce?.bonuses || []).map((b: any) => b.name);
  const currBonuses = (currAnalysis.commerce?.bonuses || []).map((b: any) => b.name);

  const bonusesAdded = currBonuses.filter((b: string) => !prevBonuses.includes(b));
  const bonusesRemoved = prevBonuses.filter((b: string) => !currBonuses.includes(b));

  if (bonusesAdded.length > 0) {
    summary.push(`${bonusesAdded.length} novo(s) bônus adicionado(s)`);
  }
  if (bonusesRemoved.length > 0) {
    summary.push(`${bonusesRemoved.length} bônus removido(s)`);
  }

  if (summary.length === 0) {
    summary.push('Nenhuma alteração estrutural ou comercial significativa detectada.');
  }

  return {
    previousCaptureId: prevCapture.id,
    currentCaptureId: currCapture.id,
    previousDate: prevCapture.captured_at,
    currentDate: currCapture.captured_at,
    priceChanged,
    oldPrice: prevPrice,
    newPrice: currPrice,
    headlineChanged,
    oldHeadline: prevHeadline,
    newHeadline: currHeadline,
    ctaChanged,
    oldCta: prevCta,
    newCta: currCta,
    sectionsAdded,
    sectionsRemoved,
    bonusesAdded,
    bonusesRemoved,
    summary,
  };
}
