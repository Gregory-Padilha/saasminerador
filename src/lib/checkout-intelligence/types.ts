// ==============================================================================
// OFFER MINER - CHECKOUT INTELLIGENCE TYPES
// ==============================================================================

export type CheckoutStatus =
  | 'not_checked'
  | 'checking'
  | 'verified'
  | 'failed'
  | 'unavailable'
  | 'blocked'
  | 'url_not_found'
  | 'not_confirmed';

export type OrderBumpsStatus =
  | 'not_checked'
  | 'verified_none'
  | 'verified_found'
  | 'failed'
  | 'limited_verification';

export type CheckoutProvider =
  | 'GGCheckout'
  | 'Kiwify'
  | 'Hotmart'
  | 'Kirvano'
  | 'PerfectPay'
  | 'Eduzz'
  | 'Monetizze'
  | 'Braip'
  | 'Ticto'
  | 'Stripe'
  | 'Wiapy'
  | 'CartPanda'
  | 'WooCommerce'
  | 'Shopify'
  | 'Checkout próprio'
  | 'Custom'
  | 'Unknown';

export type CheckoutErrorCode =
  | 'CTA_NOT_FOUND'
  | 'CTA_CLICK_FAILED'
  | 'POPUP_FAILED'
  | 'CHECKOUT_NOT_FOUND'
  | 'CHECKOUT_NOT_CONFIRMED'
  | 'CHECKOUT_BLOCKED'
  | 'CHECKOUT_TIMEOUT'
  | 'BUMP_EXTRACTION_FAILED'
  | 'CHECKOUT_URL_NOT_DISCOVERED'
  | 'FAILED_REDIRECT_TO_LP'
  | 'CHECKOUT_ACCESS_FAILED';

export interface CtaCandidateInfo {
  text: string;
  href: string | null;
  target: string | null;
  tagName: string;
  hasOnClick: boolean;
  isNearPrice: boolean;
  score: number;
}

export interface CheckoutResolutionDiagnostic {
  offerId: string;
  landingPageUrl: string;
  checkoutUrlSource?: 'MANUAL' | 'CHECKOUT_STORED' | 'LP_CTA' | 'CTA_DISCOVERY' | 'FUNNEL' | 'HISTORY' | 'NONE';
  selectedUrlReason?: string;
  ctaCandidates: CtaCandidateInfo[];
  selectedCta: CtaCandidateInfo | null;
  clickExecuted: boolean;
  navigationType: 'popup' | 'redirect' | 'same_tab' | 'iframe' | 'none';
  redirectChain: string[];
  finalUrl: string | null;
  pageTitle: string | null;
  checkoutConfirmed: boolean;
  domSignals: {
    hasBuyerForm: boolean;
    hasPaymentFields: boolean;
    hasOrderSummary: boolean;
    hasPrice: boolean;
    detectedProviderDomain: string | null;
    buyerFieldsCount: number;
    paymentKeywordsCount: number;
  };
  provider: CheckoutProvider | null;
  checkoutPrice: number | null;
  lpPrice: number | null;
  priceMismatch: boolean;
  bumpCandidatesCount: number;
  acceptedBumpsCount: number;
  screenshotUrl: string | null;
  errorCode: CheckoutErrorCode | null;
  userMessage: string;
  capturedAt: string;
}

export interface CheckoutOrderBumpDetected {
  id: string;
  offer_id: string;
  checkout_capture_id?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  is_preselected: boolean | null;
  input_type: 'checkbox' | 'radio' | 'toggle' | 'button';
  source_text: string;
  position?: number;
  screenshot_path?: string;
  created_at: string;
}

export interface CheckoutResolutionResult {
  offerId: string;
  originalUrl: string | null;
  resolvedCheckoutUrl: string | null;
  source: 'MANUAL' | 'CHECKOUT_STORED' | 'LP_CTA' | 'CTA_DISCOVERY' | 'FUNNEL' | 'HISTORY' | 'NAVIGATION' | 'XLSX' | 'NONE';
  selectedUrlReason?: string;
  ctaSelectedText?: string;
  isDistinctFromLp: boolean;
  status: CheckoutStatus;
  userFriendlyMessage: string;
  diagnostic?: CheckoutResolutionDiagnostic;
}

export interface CheckoutCaptureResult {
  id: string;
  offerId: string;
  checkoutUrl: string;
  finalUrl: string;
  provider: CheckoutProvider | null;
  status: CheckoutStatus;
  bumpsStatus: OrderBumpsStatus;
  checkoutPrice: number | null;
  lpPrice: number | null;
  currency: string;
  orderBumps: CheckoutOrderBumpDetected[];
  summary: {
    checkoutPrice: number | null;
    bumpsSum: number;
    potentialObservedTicket: number | null;
  };
  priceMismatch: boolean;
  fullPageScreenshotUrl?: string | null;
  diagnostic?: CheckoutResolutionDiagnostic;
  errorCode?: CheckoutErrorCode | null;
  errorMessage?: string | null;
  capturedAt: string;
}
