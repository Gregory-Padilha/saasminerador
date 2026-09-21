// ==============================================================================
// OFFER MINER - UNIFIED IMPORT ENGINE TYPES & INTERFACES
// ==============================================================================

import { Offer, OfferStatus, ValidationDetail, DuplicateAction } from '@/types';

export type ImportBatchType = 'XLSX' | 'JSON_FILE' | 'JSON_PASTE' | 'MANUAL';

export type ImportDedupeStatus = 'NEW' | 'EXISTING' | 'POSSIBLE_DUPLICATE';

export interface CanonicalOfferInput {
  // Identity
  offer_name?: string | null;
  product_name?: string | null;
  advertiser?: string | null;
  niche?: string | null;
  subniche?: string | null;
  product_type?: string | null;

  // Scale & Volume (Strictly Separated!)
  active_ads_count?: number | null;
  unique_creatives_count?: number | null;

  // Lifecycle
  first_seen?: string | null;
  last_seen?: string | null;
  days_active?: number | null;
  days_running?: number | null;
  oldest_ad_date?: string | null;

  // Commercial
  front_price?: number | null;
  price?: number | null;
  currency?: string | null;

  // Links & Meta
  meta_ads_url?: string | null;
  meta_page_id?: string | null;
  landing_page_url?: string | null;
  checkout_url?: string | null;

  // Product & Creative details
  product_format?: string | null;
  ad_format?: string | null;
  faceless?: boolean | null;
  headline?: string | null;
  subheadline?: string | null;

  // Source & Notes
  source?: string | null;
  notes?: string | null;
  score?: number | null;

  // Fallback / Extra data
  [key: string]: any;
}

export interface NormalizedOfferImportRecord {
  // Primary Offer Identity
  offer_name: string;
  advertiser: string | null;
  niche: string | null;
  subniche: string | null;
  product_type: string | null;

  // Metrics (Separation of Active Ads vs Creatives is invariant)
  active_ads_count: number | null;
  unique_creatives_count: number | null;

  // Dates & Running Time
  oldest_ad_date: string | null;
  newest_ad_date: string | null;
  days_running: number | null;

  // Price & Currency
  front_price: number | null;
  currency: string;

  // URLs & IDs
  meta_ads_url: string | null;
  meta_page_id: string | null;
  landing_page_url: string | null;
  checkout_url: string | null;

  // Copy & Format
  product_format: string | null;
  faceless: boolean | null;
  headline: string | null;
  subheadline: string | null;
  notes: string | null;
  score: number | null;

  // Provenance & Raw
  source: string | null;
  raw_data: Record<string, any>;
  extra_data: Record<string, any>;
}

export interface NormalizationReport {
  record: NormalizedOfferImportRecord;
  warnings: string[];
  errors: string[];
  ignoredFields: string[];
  weakIdentification: boolean;
  sourceFieldMap?: Record<string, string>;
  recognizedFields?: string[];
  unrecognizedFields?: string[];
}

export interface ImportPreviewItem {
  tempId: string;
  index: number;
  raw: Record<string, any>;
  normalized: NormalizedOfferImportRecord;
  dedupe_key: string;
  fingerprint?: string;
  dedupeStatus: ImportDedupeStatus;
  matchReason?: string;
  existingOffer?: Offer | null;
  duplicateAction: DuplicateAction;
  validation: ValidationDetail;
  ignoredFields: string[];
  warnings: string[];
  errors: string[];
  sourceFieldMap?: Record<string, string>;
  occurrenceCount?: number;
  originalIndices?: number[];
}

export interface PreparedImportPlan {
  planId: string;
  clientImportRequestId?: string;
  newRecords: ImportPreviewItem[];
  updates: ImportPreviewItem[];
  duplicates: ImportPreviewItem[];
  invalid: ImportPreviewItem[];
  warnings: string[];
  totalRawRecords: number;
  totalConsolidatedRecords: number;
}

export interface JsonParseResult {
  success: boolean;
  records: NormalizedOfferImportRecord[];
  previewItems: ImportPreviewItem[];
  preparedPlan?: PreparedImportPlan;
  ignoredFieldsSummary: string[];
  isOfferMinerExport: boolean;
  exportType?: string;
  schemaVersion?: string;
  errorMessage?: string;
  errorPosition?: {
    line: number;
    column: number;
  };
  totalCount: number;
  validCount: number;
  warningCount: number;
  invalidCount: number;
  duplicateCount: number;
  duplicatesConsolidatedCount?: number;
  isRepaired?: boolean;
  isSequenceOfObjects?: boolean;
  repairedJsonText?: string;
  repairs?: string[];

  // Document & Collection Inspection
  detectedDocument?: {
    type: 'SINGLE_OFFER' | 'OFFER_ARRAY' | 'SEQUENCE_OF_OBJECTS' | 'OFFER_MINER_EXPORT' | 'WORKER_MINING_RESULT' | 'GENERIC_WRAPPER' | 'UNKNOWN';
    summary: string;
    metadataFields: string[];
    schemaVersion?: string;
    hasIdentitySignals: boolean;
  };
  candidateCollections?: Array<{
    path: string;
    count: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    score: number;
    sampleKeys: string[];
    isAutoSelected: boolean;
    reason?: string;
  }>;
  selectedCollectionPath?: string;
  globalMetadata?: Record<string, any>;
  recognizedFieldsCount?: number;
  unrecognizedFieldsCount?: number;
  unrecognizedFields?: string[];
}

export interface ImportBatchExecutionResult {
  batchId: string;
  fileName: string;
  type: ImportBatchType;
  totalRecords: number;
  newOffersCount: number;
  updatedOffersCount: number;
  ignoredDuplicatesCount: number;
  invalidCount: number;
  errorsList: Array<{ index: number; name: string; message: string }>;
}
