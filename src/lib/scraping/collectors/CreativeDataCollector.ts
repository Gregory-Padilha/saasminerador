// ==============================================================================
// OFFER MINER - CREATIVE DATA COLLECTOR
// ==============================================================================

import { dbService } from '@/lib/supabase/db';
import { Offer, FieldProvenance } from '@/types';
import { OfferAdCluster } from './MetaAdsDataCollector';

export interface CreativeHarvest {
  status: 'SUCCESS' | 'PARTIAL' | 'NOT_AVAILABLE' | 'FAILED';
  fieldsLoaded: string[];
  provenanceMap: Record<string, FieldProvenance>;
  data: {
    collectedAdsCount: number;
    uniqueCreativesCount: number | null;
    videoCreativesCount: number;
    imageCreativesCount: number;
    storedMediaCount: number;
  };
  error?: string;
}

export async function collectCreativeData(
  offer: Offer,
  adCluster?: OfferAdCluster
): Promise<CreativeHarvest> {
  const fieldsLoaded: string[] = [];
  const provenanceMap: Record<string, FieldProvenance> = {};
  const now = new Date().toISOString();

  try {
    const existingCreatives = await dbService.getCreativesByOffer(offer.id);
    const offerAds = await dbService.getOfferAds(offer.id);
    const existingMedia = offerAds.flatMap((a) => a.media || []);

    // If adCluster is provided and has specific matched ad IDs, filter creatives by those ads
    let relevantCreatives = existingCreatives;
    if (adCluster && adCluster.clusterAds.length > 0) {
      const clusterAdIds = new Set(adCluster.clusterAds.map((a) => a.metaAdId));
      const filtered = existingCreatives.filter((c) => Boolean(c.meta_ad_id && clusterAdIds.has(c.meta_ad_id)));
      if (filtered.length > 0) {
        relevantCreatives = filtered;
      }
    }

    const collectedAdsCount = adCluster?.clusterAds.length || 0;
    let videoCount = 0;
    let imageCount = 0;

    // Deduplication by file_hash or media_url
    const seenHashes = new Set<string>();
    const uniqueCreativesList: typeof relevantCreatives = [];

    for (const c of relevantCreatives) {
      const key = c.file_hash || c.media_url || c.id;
      if (!seenHashes.has(key)) {
        seenHashes.add(key);
        uniqueCreativesList.push(c);
        if (c.media_type === 'video') videoCount++;
        else if (c.media_type === 'image') imageCount++;
      }
    }

    const uniqueCount = uniqueCreativesList.length;
    const storedMediaCount = existingMedia.length;

    const data: CreativeHarvest['data'] = {
      collectedAdsCount,
      uniqueCreativesCount: relevantCreatives.length > 0 ? uniqueCount : null,
      videoCreativesCount: videoCount,
      imageCreativesCount: imageCount,
      storedMediaCount,
    };

    if (relevantCreatives.length > 0) {
      fieldsLoaded.push('unique_creatives_count');
      provenanceMap['unique_creatives_count'] = {
        field: 'unique_creatives_count',
        value: uniqueCount,
        source: 'META_ADS',
        observedAt: now,
        type: 'OBSERVED',
        evidenceQuote: `Deduplicação de criativos: ${uniqueCount} únicos (${videoCount} vídeos, ${imageCount} imagens).`,
      };

      fieldsLoaded.push('video_count');
      provenanceMap['video_count'] = {
        field: 'video_count',
        value: videoCount,
        source: 'META_ADS',
        observedAt: now,
        type: 'OBSERVED',
      };

      fieldsLoaded.push('image_count');
      provenanceMap['image_count'] = {
        field: 'image_count',
        value: imageCount,
        source: 'META_ADS',
        observedAt: now,
        type: 'OBSERVED',
      };
    }

    const status: CreativeHarvest['status'] =
      uniqueCount > 0 ? 'SUCCESS' : offer.meta_ads_url ? 'PARTIAL' : 'NOT_AVAILABLE';

    return {
      status,
      fieldsLoaded,
      provenanceMap,
      data,
    };
  } catch (err: any) {
    console.error('[CREATIVE DATA COLLECTOR ERROR]:', err);
    return {
      status: 'FAILED',
      fieldsLoaded: [],
      provenanceMap: {},
      data: {
        collectedAdsCount: 0,
        uniqueCreativesCount: null,
        videoCreativesCount: 0,
        imageCreativesCount: 0,
        storedMediaCount: 0,
      },
      error: err.message || 'Falha ao coletar dados de criativos.',
    };
  }
}
