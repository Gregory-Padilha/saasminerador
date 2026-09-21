// ==============================================================================
// META ADS - OFFER CAPTURE SCOPE MATCHER
// ==============================================================================

import { DiscoveredAdCard, OfferCaptureScope } from './types';

const STOPWORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'nao', 'uma',
  'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'ao', 'ele',
  'das', 'seu', 'sua', 'ou', 'quando', 'muito', 'nos', 'ja', 'eu', 'tambem', 'so',
  'pelo', 'pela', 'ate', 'isso', 'ela', 'entre', 'depois', 'sem', 'mesmo', 'aos',
  'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'voce', 'essa', 'num', 'nem', 'suas',
  'meu', 'as', 'minha', 'numa', 'pelos', 'elas', 'qual', 'nos', 'lhe', 'deles',
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'kit', 'curso', 'metodo',
]);

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function extractKeywords(text: string | null | undefined): string[] {
  if (!text) return [];
  const normalized = normalizeString(text);
  return normalized
    .split(/[\s,.\-_/\\|;:!?()[\]{}'"]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

export function filterAdsByOfferScope(
  cards: DiscoveredAdCard[],
  scope: OfferCaptureScope
): {
  inScopeCards: DiscoveredAdCard[];
  outOfScopeCards: DiscoveredAdCard[];
  stats: {
    total: number;
    inScope: number;
    outOfScope: number;
    reasons: Record<string, number>;
  };
} {
  const normAdvertiser = normalizeString(scope.advertiser);
  const normDomain = normalizeString(scope.landingPageDomain);
  const productTokens = extractKeywords(scope.productName);

  // Check if Meta Ads URL is already filtered by page or specific ad ID
  const isUrlFiltered =
    scope.metaAdsUrl.includes('view_all_page_id=') ||
    scope.metaAdsUrl.includes('page_id=') ||
    scope.metaAdsUrl.includes('id=') ||
    scope.metaAdsUrl.includes('ad_archive_id=');

  const inScopeCards: DiscoveredAdCard[] = [];
  const outOfScopeCards: DiscoveredAdCard[] = [];
  const reasons: Record<string, number> = {};

  for (const card of cards) {
    let matchReason: string | null = null;

    // 1. Direct URL Scope match (if user opened an exact filtered page or ad ID)
    if (isUrlFiltered) {
      matchReason = 'URL_SCOPE';
    }

    // 2. Landing page domain match
    if (!matchReason && normDomain && card.destinationUrl) {
      const cardDestNorm = normalizeString(card.destinationUrl);
      if (cardDestNorm.includes(normDomain)) {
        matchReason = 'LANDING_DOMAIN_MATCH';
      }
    }

    // 3. Advertiser match
    if (!matchReason && normAdvertiser && card.advertiser) {
      const cardAdvNorm = normalizeString(card.advertiser);
      if (cardAdvNorm.includes(normAdvertiser) || normAdvertiser.includes(cardAdvNorm)) {
        matchReason = 'ADVERTISER_MATCH';
      }
    }

    // 4. Product keyword token match
    if (!matchReason && productTokens.length > 0) {
      const cardCombinedText = normalizeString(
        `${card.primaryText || ''} ${card.headline || ''}`
      );
      const matchingTokens = productTokens.filter((token) => cardCombinedText.includes(token));
      if (matchingTokens.length >= Math.min(2, productTokens.length)) {
        matchReason = 'PRODUCT_TEXT_MATCH';
      }
    }

    // Fallback: If URL is the registered source for this offer, default to in-scope
    if (!matchReason) {
      matchReason = 'SOURCE_URL_FALLBACK';
    }

    if (matchReason) {
      inScopeCards.push({
        ...card,
        inScope: true,
        matchReason,
      });
      reasons[matchReason] = (reasons[matchReason] || 0) + 1;
    } else {
      outOfScopeCards.push({
        ...card,
        inScope: false,
      });
      reasons['OUT_OF_SCOPE'] = (reasons['OUT_OF_SCOPE'] || 0) + 1;
    }
  }

  console.log(`[OFFER SCOPE] In-scope: ${inScopeCards.length}, Out-of-scope: ${outOfScopeCards.length}`);

  return {
    inScopeCards,
    outOfScopeCards,
    stats: {
      total: cards.length,
      inScope: inScopeCards.length,
      outOfScope: outOfScopeCards.length,
      reasons,
    },
  };
}
