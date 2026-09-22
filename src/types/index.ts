// ==============================================================================
// OFFER MINER - TYPES DEFINITIONS (OFFER INTELLIGENCE PLATFORM)
// ==============================================================================

export type DataStatus = 'ANALYZING' | 'NOVA' | 'DADOS_PARCIAIS' | 'MAPEADA' | 'ANALISADA';

export type OfferEnrichmentState =
  | 'UNMAPPED'
  | 'MAPPING'
  | 'PARTIAL'
  | 'MAPPED'
  | 'STALE'
  | 'FAILED';

export interface OfferPipelineBreakdown {
  scale: {
    status: 'NOT_PROCESSED' | 'RUNNING' | 'SUCCESS' | 'UNKNOWN' | 'UNAVAILABLE' | 'FAILED';
    activeAdsCount: number | null;
    isVerified: boolean;
    label: string;
  };
  creatives: {
    status: 'NOT_PROCESSED' | 'RUNNING' | 'SUCCESS' | 'CONFIRMED_ZERO' | 'UNAVAILABLE' | 'FAILED';
    count: number | null;
    isVerified: boolean;
    label: string;
  };
  landingPage: {
    status: 'NOT_MAPPED' | 'RUNNING' | 'SUCCESS' | 'BLOCKED' | 'FAILED';
    isMapped: boolean;
    hasArtifact: boolean;
    price: number | null;
    label: string;
  };
  checkout: {
    discoveryStatus: 'NOT_PROCESSED' | 'RUNNING' | 'FOUND' | 'NOT_FOUND' | 'BLOCKED' | 'FAILED';
    mappingStatus: 'NOT_MAPPED' | 'NOT_APPLICABLE' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
    isProcessed: boolean;
    checkoutUrl?: string | null;
    platform?: string | null;
    label: string;
  };
}

export interface OfferReadModel {
  id: string;
  product_name: string;
  advertiser?: string | null;
  enrichment_state: OfferEnrichmentState;
  data_status: DataStatus;
  badge_label: string;
  stages: OfferPipelineBreakdown;
  metrics: {
    price: number | null;
    active_ads_count: number | null;
    days_running: number | null;
    unique_creatives_count: number | null;
    captured_creatives_count: number | null;
  };
  missing_requirements: string[];
  can_be_mapped: boolean;
  scraping_status?: OfferDataScrapingStatus;
  reconciliation?: OfferReconciliationReport | null;
  price_conflict?: OfferFieldConflict | null;
}

export type ResearchStatus =
  | DataStatus
  | 'ACOMPANHANDO'
  | 'ARQUIVADA';

export type OfferStatus =
  | ResearchStatus
  | 'VALIDADA'
  | 'REVISAR'
  | 'INVALIDA'
  | 'FORA_DOS_CRITERIOS';

export type OfferFrontendOptionType = 'single' | 'package' | 'bump' | 'subscription' | 'other';

export type MappingType = 'LANDING_PAGE' | 'CHECKOUT';
export type BatchStatus = 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type MappingJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'FAILED_TIMEOUT' | 'SKIPPED' | 'CANCELLED';

export interface MappingBatch {
  id: string;
  name: string;
  type: MappingType;
  status: BatchStatus;
  concurrency: number;
  total_items: number;
  processed_items: number;
  success_count: number;
  partial_count: number;
  failed_count: number;
  current_offer_id?: string | null;
  current_offer_name?: string | null;
  current_step?: string | null;
  current_progress_percent?: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at: string;
}

export interface MappingJob {
  id: string;
  batch_id: string;
  offer_id: string;
  offer_name: string;
  advertiser?: string | null;
  target_url: string;
  type: MappingType;
  status: MappingJobStatus;
  current_step?: string | null;
  progress_percent?: number;
  error_message?: string | null;
  attempts: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ==============================================================================
// DATA SCRAPING & ENRICHMENT TYPES (STAGE 2 - FACTUAL EXTRACTION & RECONCILIATION)
// ==============================================================================

export type OfferDataScrapingStatus =
  | 'NOT_PROCESSED'
  | 'QUEUED'
  | 'RUNNING'
  | 'PARTIAL'
  | 'SUCCESS'
  | 'FAILED'
  | 'BLOCKED'
  | 'STALE';

export type ScrapingJobStep =
  | 'QUEUED'
  | 'LOADING_ARTIFACTS'
  | 'SCRAPING_LP'
  | 'SCRAPING_META_ADS'
  | 'CLUSTERING_ADS'
  | 'PROCESSING_CREATIVES'
  | 'SCRAPING_CHECKOUT'
  | 'RECONCILING'
  | 'PERSISTING'
  | 'COMPLETE';

export type ConfidenceType = 'OBSERVED' | 'DERIVED' | 'INFERRED' | 'UNKNOWN';

export interface FieldProvenance<T = any> {
  field: string;
  value: T;
  source:
    | 'LANDING_PAGE'
    | 'META_ADS'
    | 'META_ADS_CLUSTER'
    | 'CHECKOUT'
    | 'IMPORT'
    | 'HISTORY'
    | 'MANUAL'
    | 'INFERRED';
  sourceUrl?: string | null;
  observedAt: string;
  type: ConfidenceType;
  evidenceQuote?: string | null;
}

export interface OfferFieldConflict {
  field: string;
  primaryValue: any;
  primarySource: string;
  conflictingValue: any;
  conflictingSource: string;
  description: string;
  detectedAt: string;
}

export interface OfferReconciliationReport {
  offerId: string;
  status: OfferDataScrapingStatus;
  scrapedAt: string;
  version: string;
  durationMs: number;
  fieldsEnrichedCount: number;
  totalTrackedFields: number;
  provenanceMap: Record<string, FieldProvenance>;
  conflicts: OfferFieldConflict[];
  collectorsBreakdown: {
    existingArtifacts: { status: string; fieldsLoaded: string[] };
    landingPage: { status: string; fieldsLoaded: string[]; error?: string };
    metaAds: { status: string; adId?: string; clusterAdsCount?: number; error?: string };
    creatives: { status: string; uniqueCreativesCount?: number; error?: string };
    checkout: { status: string; provider?: string; price?: number; bumpsCount?: number; error?: string };
  };
  unresolvedReasons?: string[];
}

export interface ScrapingBatch {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  total_items: number;
  processed_items: number;
  success_count: number;
  partial_count: number;
  failed_count: number;
  current_offer_id?: string | null;
  current_offer_name?: string | null;
  current_step?: string | null;
  current_progress_percent?: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at: string;
}

export interface ScrapingJob {
  id: string;
  batch_id: string;
  offer_id: string;
  offer_name: string;
  advertiser?: string | null;
  target_urls: {
    landing_page?: string | null;
    meta_ads?: string | null;
    checkout?: string | null;
  };
  status: OfferDataScrapingStatus;
  current_step?: ScrapingJobStep | null;
  progress_percent?: number;
  error_message?: string | null;
  report?: OfferReconciliationReport | null;
  attempts: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapingSummary {
  totalOffers: number;
  notProcessedCount: number;
  queuedCount: number;
  runningCount: number;
  partialCount: number;
  successCount: number;
  failedCount: number;
  staleCount: number;
  activeBatch?: ScrapingBatch | null;
  recentBatches: ScrapingBatch[];
}

export type LpMappingStatus =
  | 'NOT_MAPPED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export type CheckoutDiscoveryStatus =
  | 'NOT_PROCESSED'
  | 'RUNNING'
  | 'FOUND'
  | 'NOT_FOUND'
  | 'INVALID'
  | 'BLOCKED'
  | 'FAILED';

export type CheckoutMappingStatus =
  | 'NOT_MAPPED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'PARTIAL'
  | 'PENDING'
  | 'NOT_READY'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export type OfferMappingOperationalState =
  | 'UNMAPPED'
  | 'LP_PENDING'
  | 'LP_RUNNING'
  | 'LP_MAPPED'
  | 'CHECKOUT_DISCOVERY_PENDING'
  | 'CHECKOUT_FOUND'
  | 'CHECKOUT_MAPPING_PENDING'
  | 'FULLY_MAPPED'
  | 'PARTIAL'
  | 'FAILED'
  | 'BLOCKED';

export interface MappingSummary {
  total_offers: number;
  lp_pending: number;
  lp_mapped: number;
  lp_failed: number;

  // Discovery Breakdown for LP Mapped (Sum equals lp_mapped)
  discovery_found: number;
  discovery_not_found: number;
  discovery_not_processed: number;
  discovery_invalid: number;
  discovery_blocked: number;
  discovery_failed: number;

  // Checkout Mapping Breakdown for FOUND (Sum equals discovery_found)
  checkout_pending: number;
  checkout_mapped: number;
  checkout_failed: number;

  failed_count: number;
  processing_count: number;
}

export type OfferDecision = 'Ignorar' | 'Observar' | 'Interessante' | 'Deep Dive' | 'Modelar' | 'Testar' | 'Arquivada';

export type OfferTrend =
  | 'AUMENTANDO'
  | 'ESTAVEL'
  | 'DIMINUINDO'
  | 'SEM_HISTORICO'
  | 'CRESCENDO_FORTE'
  | 'CRESCENDO'
  | 'CAINDO'
  | 'NOVO';

export type ActivityStatus = 'Ativa' | 'Não vista recentemente' | 'Possivelmente encerrada';

export interface DossierCompleteness {
  percentage: number; // 0-100%
  completedCount: number;
  totalCount: number;
  filledFields: string[];
  missingFields: string[];
}

export interface UserSettings {
  id?: string;
  user_id?: string;
  min_price: number;
  max_price: number;
  min_ads: number;
  max_ads: number;
  min_days: number;
  max_days: number;
  require_faceless: boolean;
}

export type CaptureJobStatus =
  | 'queued'
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
  | 'browser_start_failed'
  | 'failed'
  | 'cancelled';

export interface CaptureDebugData {
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
  workerError?: string | null;
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

export interface CreativeCaptureJob {
  id: string;
  user_id?: string | null;
  offer_id: string;
  status: CaptureJobStatus;
  source_url: string;
  started_at?: string | null;
  finished_at?: string | null;
  progress: number;
  ads_detected: number;
  ads_processed: number;
  videos_detected: number;
  images_detected: number;
  new_creatives: number;
  existing_creatives: number;
  failed_creatives: number;
  error_code?: string | null;
  error_message?: string | null;
  debug_data?: CaptureDebugData | null;
  mode?: 'capture' | 'discovery_only';
  created_at: string;
  updated_at: string;
}

export type OfferAnalysisStage =
  | 'validating_url'
  | 'opening_meta'
  | 'discovering_ads'
  | 'identifying_offer'
  | 'saving_ads'
  | 'capturing_creatives'
  | 'resolving_landing_page'
  | 'capturing_landing_page'
  | 'mapping_landing_page'
  | 'syncing_offer_data'
  | 'resolving_checkout'
  | 'mapping_checkout'
  | 'building_funnel'
  | 'finalizing';

export type OfferAnalysisJobStatus =
  | 'queued'
  | 'running'
  | 'retrying'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'cancelled'
  | 'stale';

export interface OfferAnalysisJobProgressData {
  offer_id?: string | null;
  advertiser?: string | null;
  product_name?: string | null;
  ads_count?: number;
  ads_processed?: number;
  creatives_count?: number;
  videos_count?: number;
  images_count?: number;
  unique_creatives_count?: number;
  landing_page_url?: string | null;
  landing_page_status?: string | null;
  checkout_url?: string | null;
  checkout_status?: string | null;
  checkout_provider?: string | null;
  order_bumps_count?: number;
  front_price?: number | null;
  deliverables_count?: number;
  bonuses_count?: number;
  duplicate_detected?: boolean;
  existing_offer_id?: string | null;
  existing_offer_name?: string | null;
  current_step?: string;
  progress_percent?: number;
  last_heartbeat_at?: string;
  attempt?: number;
  max_attempts?: number;
  workspace_id?: string;
  cta_links?: string[];
  final_status?: string;
  last_error?: string;
  error_code?: string | null;
  error_message_safe?: string | null;
  warnings?: string[];
  logs?: Array<{ timestamp: string; stage: OfferAnalysisStage | string; message: string }>;
}

export interface OfferAnalysisJob {
  id: string;
  workspace_id?: string;
  user_id?: string | null;
  offer_id?: string | null;
  input_url: string;
  meta_ads_url_original: string;
  status: OfferAnalysisJobStatus;
  current_stage: OfferAnalysisStage;
  stage_message?: string;
  current_step?: string;
  progress_percent?: number;
  last_heartbeat_at?: string;
  attempt?: number;
  max_attempts?: number;
  progress_data: OfferAnalysisJobProgressData;
  started_at: string;
  completed_at?: string | null;
  failed_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  error_message_safe?: string | null;
  mode?: 'new' | 'update';
  created_at: string;
  updated_at: string;
}

export interface OfferAd {
  id: string;
  user_id?: string | null;
  offer_id: string;
  meta_ad_id: string;
  meta_ad_url?: string | null;
  advertiser?: string | null;
  status?: string | null;
  ad_status?: string | null;
  started_at?: string | null;
  primary_text?: string | null;
  headline?: string | null;
  description?: string | null;
  cta?: string | null;
  destination_url?: string | null;
  card_screenshot_path?: string | null;
  card_screenshot_url?: string | null;
  card_screenshot_display_url?: string | null;
  capture_status?: 'detected' | 'extracting_media' | 'downloading' | 'stored' | 'media_failed' | 'no_media' | 'completed' | string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  raw_data?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface OfferAdMedia {
  id: string;
  user_id?: string | null;
  offer_id: string;
  offer_ad_id: string;
  media_type: 'video' | 'image';
  mime_type: string;
  original_url?: string | null;
  storage_path?: string | null;
  thumbnail_path?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  media_display_url?: string | null;
  thumbnail_display_url?: string | null;
  file_hash: string;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  is_primary?: boolean;
  capture_status?: 'completed' | 'failed' | 'media_unmatched' | string | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OfferAdWithMedia extends OfferAd {
  media: OfferAdMedia[];
  isDuplicateCreative?: boolean;
  duplicateCount?: number;
}

export interface OfferCreative {
  id: string;
  user_id?: string | null;
  offer_id: string;
  capture_job_id?: string | null;
  meta_ad_id?: string | null;
  meta_ad_url?: string | null;
  media_type?: 'video' | 'image' | 'carousel' | string | null;
  mime_type?: string | null;
  storage_path?: string | null;
  thumbnail_path?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  original_media_url?: string | null;
  file_hash?: string | null;
  file_size?: number | null;
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  ad_url?: string | null;
  format?: string | null;
  hook?: string | null;
  angle?: string | null;
  headline?: string | null;
  primary_text?: string | null;
  cta?: string | null;
  started_at?: string | null;
  first_captured_at?: string | null;
  last_seen_at?: string | null;
  is_active?: boolean | null;
  capture_status?: 'completed' | 'failed' | 'unsupported_protected_media' | 'file_too_large' | string | null;
  status?: string | null;
  notes?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OfferDeliverable {
  id: string;
  offer_id: string;
  title: string;
  name?: string;
  description?: string;
  order_index?: number;
  source?: string;
  capture_id?: string;
  created_at?: string;
}

export interface OfferBonus {
  id: string;
  offer_id: string;
  title: string;
  name?: string;
  description?: string;
  claimed_value?: number;
  advertised_value?: number;
  order_index?: number;
  source?: string;
  capture_id?: string;
  created_at?: string;
}

export interface LandingPageCapture {
  id: string;
  user_id?: string | null;
  offer_id: string;
  url: string;
  final_url?: string | null;
  domain?: string | null;
  http_status?: number | null;
  page_title?: string | null;
  captured_at: string;
  desktop_screenshot_path?: string | null;
  desktop_screenshot_url?: string | null;
  mobile_screenshot_path?: string | null;
  mobile_screenshot_url?: string | null;
  full_page_screenshot_path?: string | null;
  full_page_screenshot_url?: string | null;
  hero_screenshot_path?: string | null;
  hero_screenshot_url?: string | null;
  html_snapshot_path?: string | null;
  capture_status: 'pending' | 'capturing' | 'ready' | 'analyzed' | 'failed';
  error_message?: string | null;
  raw_data?: Record<string, any> | null;
  created_at?: string;
}

export interface LandingPageSection {
  id: string;
  landing_page_capture_id: string;
  offer_id: string;
  section_type:
    | 'hero'
    | 'problem'
    | 'solution'
    | 'benefits'
    | 'deliverables'
    | 'mockups'
    | 'social_proof'
    | 'testimonials'
    | 'bonuses'
    | 'guarantee'
    | 'pricing'
    | 'faq'
    | 'cta'
    | 'about'
    | 'comparison'
    | 'urgency'
    | 'scarcity'
    | 'footer'
    | 'unknown'
    | string;
  position_index: number;
  heading?: string | null;
  text_content?: string | null;
  dom_selector?: string | null;
  top_offset?: number | null;
  bottom_offset?: number | null;
  screenshot_path?: string | null;
  screenshot_url?: string | null;
  raw_data?: Record<string, any> | null;
  created_at?: string;
}

export interface LandingPageLink {
  id: string;
  capture_id: string;
  offer_id: string;
  text?: string | null;
  url: string;
  domain?: string | null;
  link_type:
    | 'checkout'
    | 'cta'
    | 'whatsapp'
    | 'instagram'
    | 'facebook'
    | 'youtube'
    | 'policy'
    | 'terms'
    | 'contact'
    | 'internal'
    | 'external'
    | string;
  checkout_platform?:
    | 'kiwify'
    | 'hotmart'
    | 'kirvano'
    | 'perfectpay'
    | 'monetizze'
    | 'eduzz'
    | 'stripe'
    | 'custom'
    | null;
  section_type?: string | null;
  is_external: boolean;
  created_at?: string;
}

export interface LandingPageHeroXRay {
  eyebrow?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  paragraph?: string | null;
  cta_primary?: { text: string; url?: string } | null;
  cta_secondary?: { text: string; url?: string } | null;
  main_image_url?: string | null;
  mockup_detected?: boolean;
  video_detected?: boolean;
  social_proof?: string | null;
  rating?: string | null;
  clients_count?: string | null;
  badges?: string[];
  guarantee?: string | null;
  price?: string | null;
  discount?: string | null;
  urgency?: string | null;
  scarcity?: string | null;
  logos?: string[];
}

export interface LandingPageAnalysisResult {
  capture: LandingPageCapture;
  heroXRay: LandingPageHeroXRay;
  sections: LandingPageSection[];
  copy: {
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
  };
  elements: {
    hasVsl: boolean;
    hasVideo: boolean;
    hasImages: boolean;
    hasMockups: boolean;
    hasTestimonials: boolean;
    hasReviews: boolean;
    hasRating: boolean;
    hasTimer: boolean;
    hasFaq: boolean;
    hasGuarantee: boolean;
    hasPriceTable: boolean;
    hasBadges: boolean;
    hasCheckout: boolean;
    hasWhatsApp: boolean;
    hasStickyCta: boolean;
    hasPopup: boolean;
  };
  links: LandingPageLink[];
  commerce: {
    originalPrice?: number | null;
    currentPrice?: number | null;
    discountPercent?: number | null;
    currency?: string;
    guaranteeDays?: number | null;
    guaranteeText?: string | null;
    checkoutPlatform?: string | null;
    checkoutUrls: string[];
    deliverables: Array<{ name: string; description?: string }>;
    bonuses: Array<{ name: string; description?: string; advertisedValue?: number }>;
    frontOptions?: OfferFrontendOption[];
  };
  provenance: Record<string, { source: string; evidenceText: string; selector?: string }>;
}

export interface LandingPageDiff {
  previousCaptureId: string;
  currentCaptureId: string;
  previousDate: string;
  currentDate: string;
  priceChanged: boolean;
  oldPrice?: number | null;
  newPrice?: number | null;
  headlineChanged: boolean;
  oldHeadline?: string | null;
  newHeadline?: string | null;
  ctaChanged: boolean;
  oldCta?: string | null;
  newCta?: string | null;
  sectionsAdded: string[];
  sectionsRemoved: string[];
  bonusesAdded: string[];
  bonusesRemoved: string[];
  summary: string[];
}

export type LandingPageUrlStatus =
  | 'PENDING'
  | 'RESOLVING'
  | 'AVAILABLE'
  | 'REDIRECTED'
  | 'RECOVERED_FROM_ADS'
  | 'DIRECT_TO_CHECKOUT'
  | 'DNS_NOT_RESOLVED'
  | 'CONNECTION_REFUSED'
  | 'TIMEOUT'
  | 'SSL_ERROR'
  | 'HTTP_404'
  | 'HTTP_403'
  | 'HTTP_5XX'
  | 'CLOUDFLARE_CHALLENGE'
  | 'UNAVAILABLE'
  | 'INVALID_URL'
  | 'NEEDS_MANUAL_URL'
  | 'CAPTURED'
  | 'ERROR';

export type LandingPageResolutionSource =
  | 'MANUAL_OVERRIDE'
  | 'RESOLVED_ORIGINAL'
  | 'WWW_FALLBACK'
  | 'HTTP_FALLBACK'
  | 'META_AD_DESTINATION'
  | 'PREVIOUS_CAPTURE'
  | 'XLSX_HYPERLINK'
  | 'XLSX_VALUE'
  | 'HISTORICAL'
  | 'SCRAPER_REDIRECT'
  | 'RECOVERED'
  | 'NONE';

export interface LandingPageCandidateUrl {
  url: string;
  domain: string;
  count: number;
  isCheckout: boolean;
  status?: string;
  httpStatus?: number;
  resolvedIp?: string;
}

export interface LandingPageUrlResolutionDiagnostic {
  originalUrl: string;
  normalizedUrl: string;
  dnsRoot: {
    hostname: string;
    resolved: boolean;
    ips?: string[];
    error?: string;
  };
  dnsWww?: {
    hostname: string;
    resolved: boolean;
    ips?: string[];
    error?: string;
  };
  httpCheck?: {
    checkedUrl: string;
    status?: number;
    statusText?: string;
    ok: boolean;
    finalUrl?: string;
    error?: string;
  };
  adDestinationsCount: number;
  adCandidates: LandingPageCandidateUrl[];
  checkedAt: string;
}

export interface LandingPageUrlResolution {
  originalUrl: string;
  normalizedUrl: string;
  resolvedUrl: string | null;
  finalUrl?: string | null;
  domain?: string | null;
  status: LandingPageUrlStatus;
  source: LandingPageResolutionSource;
  checkoutUrl?: string | null;
  flowType: 'LP_TO_CHECKOUT' | 'DIRECT_TO_CHECKOUT' | 'UNKNOWN';
  candidates: LandingPageCandidateUrl[];
  diagnostic: LandingPageUrlResolutionDiagnostic;
  errorMessage?: string | null;
  userFriendlyMessage: string;
}

export interface OfferFrontendOption {
  id: string;
  offer_id: string;
  landing_page_capture_id?: string | null;
  name?: string | null;
  description?: string | null;
  current_price: number;
  original_price?: number | null;
  currency?: string | null;
  billing_type?: string | null;
  billing_period?: string | null;
  installments?: number | null;
  installment_value?: number | null;
  cta_text?: string | null;
  cta_url?: string | null;
  position_index: number;
  is_featured?: boolean | null;
  is_default?: boolean | null;
  source?: string | null;
  source_section?: string | null;
  source_text?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OfferOrderBump {
  id: string;
  offer_id: string;
  name: string;
  price: number;
  description?: string;
}

export interface OfferUpsell {
  id: string;
  offer_id: string;
  name: string;
  price: number;
  url?: string;
  description?: string;
}

export interface ProvenanceItem {
  source_type: 'LANDING_PAGE' | 'META_ADS' | 'CHECKOUT' | 'XLSX' | 'MANUAL';
  source_text?: string | null;
  source_section?: string | null;
  evidence_quote?: string | null;
  captured_at?: string | null;
  capture_id?: string | null;
}

export interface OfferProof {
  id: string;
  offer_id: string;
  proof_type: 'testimonial' | 'review' | 'rating' | 'customer_count' | 'badge' | 'social_proof' | string;
  title?: string | null;
  quote?: string | null;
  author?: string | null;
  rating?: string | null;
  source?: string | null;
  screenshot_url?: string | null;
  created_at?: string;
}

export interface OfferBenefit {
  id: string;
  offer_id: string;
  text: string;
  source_section?: string | null;
  source_text?: string | null;
  capture_id?: string | null;
  created_at?: string;
}

export interface OfferObjection {
  id: string;
  offer_id: string;
  objection: string;
  answer?: string | null;
  source_section?: string | null;
  created_at?: string;
}

export interface OfferCTA {
  id: string;
  offer_id: string;
  text: string;
  url?: string | null;
  section?: string | null;
  position?: number | null;
  is_checkout_link?: boolean;
  created_at?: string;
}

export interface OfferFunnelStep {
  id: string;
  offer_id: string;
  step_type: 'meta_ad' | 'landing_page' | 'checkout' | 'order_bump' | 'upsell' | 'downsell' | 'thank_you' | 'quiz' | 'advertorial' | 'whatsapp' | string;
  title: string;
  price?: number | null;
  url?: string | null;
  domain?: string | null;
  provider?: string | null;
  source?: string | null;
  source_link_text?: string | null;
  verified_at?: string | null;
  notes?: string | null;
  order_index: number;
}

export interface OfferAnalysis {
  id: string;
  offer_id: string;
  strengths?: string;
  weaknesses?: string;
  why_interesting?: string;
  what_to_model?: string;
  what_not_to_copy?: string;
  differentiation_ideas?: string;
  adaptation_ideas?: string;
  risk_score?: 'Baixo' | 'Medio' | 'Alto';
  potential_score?: 'Baixo' | 'Medio' | 'Alto';
  decision?: OfferDecision;
  updated_at: string;
}

export type ActiveAdsSource =
  | 'META_ADS_LIBRARY'
  | 'WORKER_IMPORT'
  | 'MANUAL_VERIFIED'
  | 'HISTORICAL_SNAPSHOT'
  | 'XLSX_IMPORT'
  | 'JSON_IMPORT'
  | 'JSON_PASTE';

/**
  * Creative metrics payload.
  * EXPLICITLY OMITS active_ads_count to enforce at compile-time that creative routines cannot alter scale metrics.
  */
export interface CreativeMetricsUpdate {
  captured_ads_count?: number | null;
  captured_unique_creatives?: number | null;
  unique_creatives_count?: number | null;
  captured_creatives_count?: number | null;
  captured_videos_count?: number | null;
  captured_images_count?: number | null;
  stored_media_count?: number | null;
  oldest_ad_date?: string | null;
  days_running?: number | null;
  last_creatives_capture_at?: string | null;
}

export interface Offer {
  id: string;
  workspace_id?: string;
  user_id?: string;
  source?: string | null;
  product_name: string;
  offer_name?: string | null;
  advertiser?: string | null;
  niche?: string | null;
  subniche?: string | null;
  product_type?: string | null;
  price?: number | null;
  currency?: string;
  active_ads_count?: number | null;
  active_ads_count_source?: ActiveAdsSource | null;
  active_ads_count_observed_at?: string | null;
  unique_creatives_count?: number | null;
  stored_media_count?: number | null;
  estimated_unique_creatives?: number | null;
  oldest_ad_date?: string | null;
  newest_ad_date?: string | null;
  days_running?: number | null;
  faceless?: boolean | null;
  meta_ads_url?: string | null;
  landing_page_url?: string | null;
  landing_page_url_original?: string | null;
  landing_page_url_resolved?: string | null;
  landing_page_url_status?: LandingPageUrlStatus | null;
  landing_page_url_last_checked_at?: string | null;
  landing_page_flow_type?: 'LP_TO_CHECKOUT' | 'DIRECT_TO_CHECKOUT' | 'UNKNOWN' | null;
  manual_override_url?: string | null;
  landing_page_resolution_source?: LandingPageResolutionSource | null;
  landing_page_url_source?: LandingPageResolutionSource | null;
  landing_page_resolution_diagnostic?: LandingPageUrlResolutionDiagnostic | null;
  lp_mapping_status?: LpMappingStatus | null;
  lp_mapped_at?: string | null;
  lp_last_attempt_at?: string | null;
  lp_last_error?: string | null;
  mapped_source_url?: string | null;
  mapper_version?: string | null;
  checkout_url?: string | null;
  checkout_discovery_status?: CheckoutDiscoveryStatus | null;
  checkout_discovery_at?: string | null;
  checkout_discovery_error?: string | null;
  checkout_mapping_status?: CheckoutMappingStatus | null;
  checkout_mapped_at?: string | null;
  checkout_last_attempt_at?: string | null;
  checkout_last_error?: string | null;
  landing_page_domain?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  promise?: string | null;
  problem?: string | null;
  transformation?: string | null;
  mechanism?: string | null;
  big_idea?: string | null;
  target_audience?: string | null;
  ad_format?: string | null;
  guarantee?: string | null;
  lp_type?: string | null;
  checkout_platform?: string | null;
  hooks_list?: string[];
  angles_list?: string[];
  audience_profile?: {
    avatar?: string;
    buyer_persona?: string;
    core_problem?: string;
    core_desire?: string;
    buying_context?: string;
    awareness_level?: string;
    language_tone?: string;
  } | null;
  notes?: string | null;
  front_options_count?: number | null;
  front_price_min?: number | null;
  front_price_max?: number | null;
  front_price_avg?: number | null;
  score?: number | null;
  work_score?: number | null;
  system_score?: number | null;
  discovery_score?: number | null;
  opportunity_score?: number | null;
  momentum_score?: number | null;
  trend?: OfferTrend;
  activity_status?: ActivityStatus;
  status: OfferStatus;
  validation_status?: OfferStatus;
  decision?: OfferDecision;
  favorite: boolean;
  watching: boolean;
  in_deep_dive: boolean;
  archived?: boolean;
  archived_at?: string | null;
  archived_by_user?: boolean;
  dedupe_key: string;
  source_file_name?: string | null;
  sheet_name?: string | null;
  row_number?: number | null;
  source_import_batch_id?: string | null;
  source_import_row_id?: string | null;
  raw_data?: Record<string, any> | null;
  extra_data?: Record<string, any> | null;
  first_seen_at?: string;
  last_seen_at?: string;
  first_imported_at?: string;
  last_imported_at?: string;
  created_at: string;
  updated_at: string;
  is_demo_data?: boolean;
  captured_ads_count?: number | null;
  captured_unique_creatives?: number | null;
  captured_creatives_count?: number | null;
  captured_videos_count?: number | null;
  captured_images_count?: number | null;
  last_creatives_capture_at?: string | null;

  // Data Scraping & Enrichment fields (Stage 2)
  data_scraping_status?: OfferDataScrapingStatus | null;
  data_scraping_started_at?: string | null;
  data_scraping_completed_at?: string | null;
  data_scraping_version?: string | null;
  data_scraping_last_error?: string | null;
  data_scraping_source_version?: string | null;
  data_scraping_reconciliation?: OfferReconciliationReport | null;
  locked_fields?: string[];
  meta_ad_seed_id?: string | null;
  meta_page_id?: string | null;
  scale_tier?: string | null;

  // Computed & populated relations
  calculated_days_running?: number;
  capture_jobs?: CreativeCaptureJob[];
  snapshots?: OfferSnapshot[];
  ads?: OfferAdWithMedia[];
  creatives?: OfferCreative[];
  deliverables?: OfferDeliverable[];
  bonuses?: OfferBonus[];
  order_bumps?: OfferOrderBump[];
  upsells?: OfferUpsell[];
  funnel_steps?: OfferFunnelStep[];
  proofs?: OfferProof[];
  benefits?: OfferBenefit[];
  objections?: OfferObjection[];
  ctas?: OfferCTA[];
  frontend_options?: OfferFrontendOption[];
  provenance_map?: Record<string, ProvenanceItem>;
  analysis?: OfferAnalysis;
  tags?: string[];
  lp_sections?: string[];
}

export interface OfferSnapshot {
  id: string;
  offer_id: string;
  active_ads_count?: number | null;
  estimated_unique_creatives?: number | null;
  days_running?: number | null;
  oldest_ad_date?: string | null;
  price?: number | null;
  captured_at: string;
  import_batch_id?: string | null;
}

export interface ImportBatch {
  id: string;
  user_id?: string;
  file_name: string;
  import_type?: 'XLSX' | 'JSON_FILE' | 'JSON_PASTE' | 'MANUAL';
  file_size?: number;
  sheet_count?: number;
  total_rows: number;
  successful_rows?: number;
  warning_rows?: number;
  error_rows?: number;
  imported_rows: number;
  updated_rows: number;
  duplicate_rows: number;
  invalid_rows: number;
  metadata_json?: Record<string, any>;
  created_at: string;
}

export interface ImportRow {
  id: string;
  import_batch_id: string;
  sheet_name: string;
  row_number: number;
  raw_data: Record<string, any>;
  normalized_data: Record<string, any>;
  import_status: 'inserted' | 'updated' | 'ignored' | 'error';
  offer_id?: string | null;
  error_message?: string | null;
  created_at: string;
}

export type DeepDiveStatus =
  | 'BACKLOG'
  | 'EM_ANALISE'
  | 'SINTETIZANDO'
  | 'CONCLUIDO'
  | 'ARQUIVADO'
  // Legacy aliases for backwards compatibility
  | 'Fila'
  | 'Pesquisando'
  | 'Analisando'
  | 'Pronta'
  | 'Modelar'
  | 'Descartada';

export type DeepDivePriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA' | 'Baixa' | 'Media' | 'Alta';

export interface DeepDiveSnapshot {
  active_ads_count: number | null;
  days_running: number | null;
  price: number | null;
  creatives_count: number | null;
  captured_at: string;
}

export type CreativeTagType = 'REFERENCIA' | 'HOOK_FORTE' | 'VISUAL_INTERESSANTE' | 'FORMATO_TESTAR' | 'IGNORAR';

export interface DeepDiveCreativeTag {
  creative_id: string;
  tag: CreativeTagType;
  note: string;
  is_primary: boolean;
  updated_at: string;
}

export interface DeepDiveLpSectionNote {
  section: 'Hero' | 'Promessa' | 'Prova' | 'Preço' | 'Bônus' | 'Garantia' | 'CTA' | 'FAQ' | string;
  text: string;
  note: string;
  updated_at: string;
}

export interface DeepDiveOfferObservation {
  attractive_reason?: string;
  anchor_reason?: string;
  differential_reason?: string;
  perceived_value_reason?: string;
}

export interface DeepDiveCheckoutAnalysis {
  bumps_complementary?: string;
  bumps_extension?: string;
  price_proportional?: string;
}

export interface DeepDiveHypothesis {
  id: string;
  deep_dive_id: string;
  title: string;
  description?: string;
  status: 'ABERTA' | 'CONFIRMADA' | 'REFUTADA' | 'INCONCLUSIVA';
  evidence?: string[];
  created_at: string;
}

export type InsightCategory =
  | 'Criativo'
  | 'Copy'
  | 'Oferta'
  | 'Landing Page'
  | 'Checkout'
  | 'Pricing'
  | 'Order Bump'
  | 'Público'
  | 'Escala'
  | 'Produto';

export interface DeepDiveInsight {
  id: string;
  deep_dive_id: string;
  offer_id: string;
  offer_name?: string;
  title: string;
  description: string;
  category: InsightCategory;
  tags: string[];
  applicability?: string;
  created_at: string;
}

export interface DeepDiveTest {
  id: string;
  deep_dive_id: string;
  title: string;
  description?: string;
  status: 'IDEIA' | 'PARA_TESTAR' | 'TESTADO' | 'DESCARTADO';
  created_at: string;
}

export interface ResearchPattern {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  deep_dive_ids: string[];
  created_at: string;
}

export interface DeepDiveCaseSummary {
  what_sells: string;
  main_promise: string;
  mechanism: string;
  perceived_value: string;
  price_structure: string;
  creative_pattern: string;
  lp_structure: string;
  checkout_monetization: string;
  key_insights: string;
  test_ideas: string;
  concluded_at: string;
}

export interface DeepDive {
  id: string;
  user_id?: string;
  offer_id: string;
  offer?: Offer;
  status: DeepDiveStatus;
  priority: DeepDivePriority;
  tags?: string[];
  start_snapshot?: DeepDiveSnapshot | null;
  end_snapshot?: DeepDiveSnapshot | null;
  notes?: Record<string, string> | string | null;
  creative_tags?: Record<string, DeepDiveCreativeTag> | null;
  lp_section_notes?: DeepDiveLpSectionNote[] | null;
  offer_observations?: DeepDiveOfferObservation | null;
  checkout_analysis?: DeepDiveCheckoutAnalysis | null;
  hypotheses?: DeepDiveHypothesis[] | null;
  insights?: DeepDiveInsight[] | null;
  tests?: DeepDiveTest[] | null;
  checklist?: Record<string, boolean> | null;
  investigation_progress?: number;
  case_summary?: DeepDiveCaseSummary | null;
  last_activity_text?: string | null;
  last_insight_text?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at: string;
}

export interface SavedView {
  id: string;
  user_id?: string;
  name: string;
  filters: Partial<OfferFiltersState>;
  created_at: string;
}

export interface ValidationDetail {
  isValid: boolean;
  status: OfferStatus;
  reasons: string[];
  warnings: string[];
}

export type DuplicateAction = 'update' | 'ignore' | 'create_new';

export interface ImportPreviewRow {
  tempId: string;
  rowIndex: number;
  sheetName: string;
  raw: Record<string, any>;
  normalized: Partial<Offer>;
  extraData: Record<string, any>;
  dedupe_key: string;
  isDuplicate: boolean;
  duplicateOfferId?: string;
  existingOffer?: Offer | null;
  duplicateAction: DuplicateAction;
  validation: ValidationDetail;
  system_score: number | null;
  hasErrors: boolean;
  errors: string[];
}

export interface ImportSummary {
  fileName: string;
  totalSheets: number;
  sheetNames: string[];
  totalRows: number;
  readyRows: number;
  duplicateRows: number;
  invalidRows: number;
  errorRows: number;
}

export interface SheetParseInfo {
  sheetName: string;
  rowCount: number;
  headers: string[];
}

export interface DetectedHeaderInfo {
  original: string;
  normalized: string;
  index: number;
  mappedField: string | null;
  confidence: number;
  label: string;
}

export interface HeaderCandidate {
  rowIndex: number;
  preview: string[];
  score: number;
}

export interface RawSheetData {
  sheetName: string;
  headerRowIndex: number;
  detectedHeaders: DetectedHeaderInfo[];
  rawRows: Record<string, any>[];
  confidence: number;
  headerCandidates: HeaderCandidate[];
}

export interface ParseResult {
  fileName: string;
  sheetNames: string[];
  sheetsInfo: SheetParseInfo[];
  headers: string[];
  columnMapping: Record<string, string>; // rawHeader -> systemKey
  columnMappingDetails?: Record<string, { key: string | null; confidence: number; label: string }>;
  unmappedHeaders: string[];
  rows: ImportPreviewRow[];
  summary: ImportSummary;
  rawSheetsData?: RawSheetData[];
  detectedHeaderRowIndex?: number;
}

export interface OfferFiltersState {
  search: string;
  niche: string;
  subniche: string;
  productType: string;
  scaleTier?: 'all' | 'FULL_SCALE' | 'HIGH_SCALE' | 'SCALING' | 'NORMAL';
  minPrice?: number;
  maxPrice?: number;
  minAds?: number;
  maxAds?: number;
  minDays?: number;
  maxDays?: number;
  minCreatives?: number;
  maxCreatives?: number;
  maturityRange?: string;
  adsRange?: string;
  priceRange?: string;
  faceless?: boolean | 'all';
  status?: OfferStatus | 'all';
  decision?: OfferDecision | 'all';
  trend?: OfferTrend | 'all';
  adFormat?: string;
  minScore?: number;
  selectedNiches?: string[];
  selectedProductTypes?: string[];
  lpStatusFilter?: 'all' | 'with_lp' | 'without_lp' | 'SUCCESS' | 'PENDING' | 'PARTIAL' | 'FAILED';
  checkoutStatusFilter?: 'all' | 'with_checkout' | 'without_checkout' | 'FOUND' | 'NOT_FOUND' | 'NOT_PROCESSED' | 'SUCCESS' | 'PENDING' | 'FAILED';
  orderBumpsFilter?: 'all' | 'with_bumps' | 'without_bumps';
  sourceFilter?: 'all' | 'xlsx' | 'manual';
  dateAddedFilter?: 'all' | 'today' | '7d' | '30d';
  onlyFavorites: boolean;
  onlyWatching: boolean;
  onlyDeepDive: boolean;
  quickFilter?:
    | 'all'
    | 'opportunities'
    | 'new'
    | 'scaling'
    | 'favorites'
    | 'watching'
    | 'deep_dive'
    | 'price_20_30'
    | 'ads_20_plus'
    | 'days_20_plus'
    | 'faceless'
    | 'with_lp'
    | 'without_lp'
    | 'with_checkout'
    | 'without_checkout'
    | 'unmapped_lp'
    | 'full_scale'
    | 'scale_high'
    | 'scale_normal'
    | 'ads_100_plus'
    | 'ads_30_plus'
    | 'lp_unavailable'
    | 'missing_price'
    | 'missing_meta_url';
  sortBy:
    | 'created_at'
    | 'last_imported_at'
    | 'score'
    | 'system_score'
    | 'momentum_score'
    | 'price'
    | 'active_ads_count'
    | 'days_running'
    | 'estimated_unique_creatives'
    | 'product_name';
  sortOrder: 'asc' | 'desc';
}

export interface DiscoveryScoreBreakdown {
  total: number;
  adsScore: number;
  daysScore: number;
  creativesScore: number;
  completenessScore: number;
  completenessPercentage: number;
  completedFieldsCount: number;
  totalFieldsCount: number;
  workScore: number;
  rawWorkScore: number | null;
  priorityLabel: 'EXCEPCIONAL' | 'FORTE' | 'INTERESSANTE' | 'OBSERVAR' | 'BAIXA_PRIORIDADE';
  explanation: {
    ads: string;
    days: string;
    creatives: string;
    completeness: string;
    work: string;
  };
}

export interface MomentumCalculationResult {
  momentumScore: number | null;
  trend: OfferTrend;
  statusText: string;
  growthPct: number | null;
  deltaAds: number | null;
  currentAds: number | null;
  previousAds: number | null;
  snapshotCount: number;
}

export interface NicheIntelligence {
  niche: string;
  offerCount: number;
  validCount: number;
  avgPrice: number;
  avgAds: number;
  avgScore: number;
  topFormats: { format: string; count: number }[];
  topOffers: Offer[];
}

export interface McpServerConfig {
  enabled: boolean;
  tokenConfigured: boolean;
  endpointUrl: string;
  version: string;
  toolsCount: number;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  parametersSchema: Record<string, any>;
}

export interface McpLogEntry {
  id: string;
  timestamp: string;
  tool: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface McpHealthResult {
  status: 'ok' | 'disabled' | 'unconfigured';
  version: string;
  toolsCount: number;
  uptimeSeconds: number;
}

// ==============================================================================
// MAPPING CANONICAL PREDICATES & OPERATIONAL DERIVATIONS
// ==============================================================================

/**
 * Predicate to check if an offer's Landing Page has been genuinely mapped.
 * Returns true ONLY IF:
 * 1. lp_mapping_status === 'SUCCESS'
 * 2. lp_mapped_at is non-empty
 * 3. source URL exists
 * 4. If mapped_source_url is present, it matches current source URL (not stale)
 * 5. If extra_data evidence check is provided/needed, verified artifact exists
 */
export function isLandingPageMapped(
  offer: Partial<Offer> & { landing_page_captures_count?: number },
  requireArtifactEvidence: boolean = false
): boolean {
  if (!offer) return false;
  if (offer.lp_mapping_status !== 'SUCCESS') return false;
  if (!offer.lp_mapped_at) return false;

  const currentUrl = offer.landing_page_url || offer.landing_page_url_original;
  if (!currentUrl || currentUrl.trim() === '') return false;

  // Stale check if mapped_source_url is tracked
  if (offer.mapped_source_url && offer.mapped_source_url.trim() !== currentUrl.trim()) {
    return false;
  }

  if (requireArtifactEvidence) {
    const extra = (offer.extra_data as any) || {};
    const hasAnalysisArtifact = Boolean(extra.latest_lp_analysis || extra.lp_artifact || extra.lp_mapped_artifact);
    const hasCaptures = Boolean(offer.landing_page_captures_count && offer.landing_page_captures_count > 0);
    if (!hasAnalysisArtifact && !hasCaptures) {
      return false;
    }
  }

  return true;
}

/**
 * Predicate to check if an offer's Checkout has been genuinely mapped.
 * Returns true ONLY IF:
 * 1. checkout_mapping_status === 'SUCCESS'
 * 2. checkout_mapped_at is non-empty
 * 3. true checkout_url exists and DOES NOT equal landing_page_url (Critical Invariant)
 */
export function isCheckoutMapped(
  offer: Partial<Offer>,
  requireArtifactEvidence: boolean = false
): boolean {
  if (!offer) return false;
  if (offer.checkout_mapping_status !== 'SUCCESS') return false;
  if (!offer.checkout_mapped_at) return false;

  const checkoutUrl = offer.checkout_url;
  if (!checkoutUrl || checkoutUrl.trim() === '') return false;

  // Invariant: checkout URL can NEVER be landing page URL
  const lpUrl = offer.landing_page_url || offer.landing_page_url_original;
  if (lpUrl && checkoutUrl.trim() === lpUrl.trim()) {
    return false;
  }

  if (requireArtifactEvidence) {
    const extra = (offer.extra_data as any) || {};
    const hasCheckoutVerified = extra.checkout_verified === true || Boolean(extra.latest_checkout_analysis);
    if (!hasCheckoutVerified) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates the fine-grained derived operational mapping state for an offer.
 */
export function getOfferMappingOperationalState(offer: Partial<Offer>): OfferMappingOperationalState {
  if (!offer) return 'UNMAPPED';

  const lpMapped = isLandingPageMapped(offer);
  const checkoutMapped = isCheckoutMapped(offer);

  if (offer.lp_mapping_status === 'FAILED' || offer.checkout_mapping_status === 'FAILED') {
    return 'FAILED';
  }
  if (offer.lp_mapping_status === 'BLOCKED' || offer.checkout_mapping_status === 'BLOCKED') {
    return 'BLOCKED';
  }

  if (lpMapped) {
    if (checkoutMapped) return 'FULLY_MAPPED';
    if (offer.checkout_discovery_status === 'NOT_FOUND') return 'FULLY_MAPPED';
    if (offer.checkout_mapping_status === 'NOT_APPLICABLE') return 'FULLY_MAPPED';
    if (offer.checkout_discovery_status === 'FOUND') return 'CHECKOUT_FOUND';
    if (offer.checkout_mapping_status === 'RUNNING') return 'CHECKOUT_MAPPING_PENDING';
    return 'LP_MAPPED';
  }

  if (offer.lp_mapping_status === 'RUNNING') return 'LP_RUNNING';
  if (offer.lp_mapping_status === 'QUEUED') return 'LP_PENDING';

  return 'UNMAPPED';
}

export interface AgentStagedOffer {
  id: string;
  product_name: string;
  advertiser: string;
  price: number | null;
  currency?: string;
  niche?: string | null;
  subniche?: string | null;
  landing_page_url?: string | null;
  checkout_url?: string | null;
  meta_ads_url?: string | null;
  active_ads_count?: number | null;
  headline?: string | null;
  promise?: string | null;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  mined_at: string;
  source?: string;
  raw_data?: any;
}
