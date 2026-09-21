// ==============================================================================
// OFFER MINER - LANDING PAGE INTELLIGENCE TYPES
// ==============================================================================

export type {
  LandingPageCapture,
  LandingPageSection,
  LandingPageLink,
  LandingPageHeroXRay,
  LandingPageAnalysisResult,
  LandingPageDiff,
  LandingPageUrlStatus,
  LandingPageResolutionSource,
  LandingPageCandidateUrl,
  LandingPageUrlResolutionDiagnostic,
  LandingPageUrlResolution,
  OfferDeliverable,
  OfferBonus,
} from '@/types';

export interface ViewportConfig {
  width: number;
  height: number;
  isMobile?: boolean;
  deviceScaleFactor?: number;
}

export interface CaptureOptions {
  viewportDesktop?: ViewportConfig;
  viewportMobile?: ViewportConfig;
  timeoutMs?: number;
  waitForNetworkIdle?: boolean;
}

export interface VisualCaptureResult {
  captureId: string;
  url: string;
  finalUrl: string;
  domain: string;
  httpStatus: number;
  pageTitle: string;
  desktopScreenshotPath: string;
  desktopScreenshotUrl: string;
  mobileScreenshotPath: string;
  mobileScreenshotUrl: string;
  fullPageScreenshotPath: string;
  fullPageScreenshotUrl: string;
  heroScreenshotPath: string;
  heroScreenshotUrl: string;
  htmlSnapshotPath?: string;
  capturedAt: string;
}

export interface LPAnalyzeProgressEvent {
  step:
    | 'opening_url'
    | 'waiting_dom'
    | 'handling_popups'
    | 'capturing_visuals'
    | 'analyzing_dom'
    | 'extracting_hero'
    | 'mapping_sections'
    | 'extracting_copy'
    | 'extracting_links'
    | 'identifying_commerce'
    | 'syncing_dossier'
    | 'done'
    | 'failed';
  message: string;
  progressPercent: number;
  result?: any;
}
