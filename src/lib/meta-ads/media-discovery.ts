// ==============================================================================
// META ADS - MEDIA DISCOVERY & NETWORK CORRELATION
// ==============================================================================

import { DiscoveredAdCard, DiscoveredMediaCandidate } from './types';
import { NetworkCaptureState } from './page-loader';

export function enrichAdMedia(
  cards: DiscoveredAdCard[],
  networkState: NetworkCaptureState
): {
  enrichedCards: DiscoveredAdCard[];
  totalVideos: number;
  totalImages: number;
} {
  const mp4List = Array.from(networkState.mp4Urls);
  let networkMp4Index = 0;
  let totalVideos = 0;
  let totalImages = 0;

  const enrichedCards = cards.map((card) => {
    const candidates: DiscoveredMediaCandidate[] = [];
    const seenUrls = new Set<string>();

    // 1. Add DOM media candidates strictly from this card (filtering out small icons & avatars)
    for (const m of card.mediaCandidates) {
      if (m.sourceUrl && !seenUrls.has(m.sourceUrl)) {
        seenUrls.add(m.sourceUrl);
        candidates.push(m);
      }
    }

    // Filter out UI assets, advertiser avatars, and sprites
    const filteredCandidates = candidates.filter((c) => {
      const url = c.sourceUrl.toLowerCase();
      if (
        url.includes('emoji') ||
        url.includes('sprite') ||
        url.includes('rsrc.php') ||
        url.includes('s100x100') ||
        url.includes('s50x50') ||
        url.includes('s60x60') ||
        url.includes('s75x75') ||
        url.includes('p50x50') ||
        url.includes('p100x100') ||
        url.includes('t1.30497-1') ||
        url.includes('c379.0.1290')
      ) {
        return false;
      }
      return true;
    });

    for (const c of filteredCandidates) {
      if (c.type === 'video') totalVideos++;
      else if (c.type === 'image') totalImages++;
    }

    return {
      ...card,
      mediaCandidates: filteredCandidates,
    };
  });

  console.log(
    `[MEDIA DISCOVERY] Total media discovered: ${totalVideos} videos, ${totalImages} images across ${enrichedCards.length} cards.`
  );

  return {
    enrichedCards,
    totalVideos,
    totalImages,
  };
}
