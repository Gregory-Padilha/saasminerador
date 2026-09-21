// ==============================================================================
// META ADS LIBRARY - TYPES & DOMAIN MODELS
// ==============================================================================

import { OfferAdWithMedia } from '@/types';

export type CaptureMode = 'capture' | 'discovery_only';

export type CaptureStepName =
  | 'starting_browser'
  | 'opening_url'
  | 'waiting_dom'
  | 'checking_access'
  | 'page_loaded'
  | 'handling_consent'
  | 'scrolling_results'
  | 'discovering_ad_cards'
  | 'extracting_ad_ids'
  | 'detecting_media'
  | 'downloading_media'
  | 'uploading_storage'
  | 'completed'
  | 'completed_with_errors'
  | 'blocked_login'
  | 'blocked_captcha'
  | 'manual_intervention_required'
  | 'no_ads_found'
  | 'invalid_meta_url'
  | 'timeout'
  | 'failed';

export interface CaptureProgressEvent {
  step: CaptureStepName;
  message: string;
  progressPercent: number;
  totalAds?: number;
  processedAds?: number;
  totalVideos?: number;
  totalImages?: number;
  currentDownload?: number;
  totalDownloads?: number;
  debugData?: CaptureDiagnosticReport;
}

export type CaptureProgressCallback = (event: CaptureProgressEvent) => void;

export interface DiscoveredMediaCandidate {
  type: 'video' | 'image' | 'hls';
  sourceUrl: string;
  posterUrl?: string;
  mimeType?: string;
  detectedVia: 'dom' | 'network';
  width?: number;
  height?: number;
}

export interface DiscoveredAdCard {
  metaAdId: string;
  advertiser?: string;
  status?: string;
  startedAt?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  cta?: string;
  destinationUrl?: string;
  adUrl?: string;
  cardScreenshotPath?: string;
  cardScreenshotUrl?: string;
  mediaCandidates: DiscoveredMediaCandidate[];
  matchReason?: string;
  inScope?: boolean;
}

export interface OfferCaptureScope {
  offerId: string;
  productName: string;
  advertiser?: string | null;
  landingPageUrl?: string | null;
  landingPageDomain?: string | null;
  metaAdsUrl: string;
  headline?: string | null;
  niche?: string | null;
}

export interface CaptureDiagnosticReport {
  originalUrl: string;
  finalUrl: string;
  httpStatus: number | null;
  httpStatusText: string | null;
  pageTitle: string;
  loginDetected: boolean;
  captchaDetected: boolean;
  consentDetected: boolean;
  bodyTextSample: string;
  videoElementsCount: number;
  imageElementsCount: number;
  possibleAdCardsCount: number;
  metaAdIdsFound: string[];
  mp4ResponsesCount: number;
  mp4SampleUrls?: string[];
  hlsResponsesCount: number;
  hlsSampleUrls?: string[];
  iframesCount: number;
  iframeUrls?: string[];
  scopeMatchResults?: {
    totalDetected: number;
    inScope: number;
    outOfScope: number;
    reasons: Record<string, number>;
  };
  screenshotUrl?: string | null;
  htmlUrl?: string | null;
  executionTimeMs?: number;
  error?: string | null;
}

export interface CapturedCreativeResult {
  id: string;
  metaAdId: string;
  mediaType: 'video' | 'image';
  mimeType: string;
  storagePath: string;
  mediaUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  originalMediaUrl: string;
  fileHash: string;
  fileSize: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  headline?: string;
  primaryText?: string;
  destinationUrl?: string;
  startedAt?: string;
  isNew: boolean;
}

export interface CaptureResult {
  success: boolean;
  mode: CaptureMode;
  offerId: string;
  sourceUrl: string;
  adsDetected: number;
  adsInScope: number;
  uniqueCreativesCount: number;
  videosCount: number;
  imagesCount: number;
  newCreativesCount: number;
  existingCreativesCount: number;
  failedCreativesCount: number;
  ads: OfferAdWithMedia[];
  creatives: CapturedCreativeResult[];
  diagnosticReport: CaptureDiagnosticReport;
  errorMessage?: string;
  errorCode?: string;
}

export interface CaptureOptions {
  mode?: CaptureMode;
  maxAds?: number;
  maxScrollIterations?: number;
  timeoutMs?: number;
  onProgress?: CaptureProgressCallback;
}
