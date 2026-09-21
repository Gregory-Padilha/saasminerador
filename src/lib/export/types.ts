export type ContextExportScope =
  | 'chat_conversa'
  | 'chat_sources'
  | 'chat_full'
  | 'offer_compact'
  | 'offer_dossier';

export type ExportFormat = 'markdown' | 'json';

export interface AIContextPackageMetadata {
  title: string;
  generatedAt: string;
  version: string;
  scope: ContextExportScope;
  subjectName?: string;
  subjectId?: string;
  threadId?: string;
  mode?: string;
  providersUsed?: string[];
  activeAdsCount?: number;
  uniqueCreativesCount?: number;
  collectedAdsCount?: number;
  scrapingStatus?: string;
}

export interface DataAvailabilityMap {
  landingPage: 'MAPPED' | 'NOT_MAPPED' | 'UNKNOWN';
  checkout: 'MAPPED' | 'NOT_PROCESSED' | 'UNKNOWN';
  creatives: string;
  audience: 'COMPLETE' | 'PARTIAL' | 'NOT_AVAILABLE';
  history: string;
  copy: 'COMPLETE' | 'PARTIAL' | 'NOT_AVAILABLE';
}

export interface AIContextPackage {
  metadata: AIContextPackageMetadata;
  aiInstructions: string;
  subject?: Record<string, any>;
  availability?: DataAvailabilityMap;
  conversation?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: string;
    provider?: string;
    model?: string;
    sourcesCount?: number;
    toolCallsCount?: number;
  }>;
  offerFacts?: Record<string, any>;
  landingPageFacts?: Record<string, any>;
  checkoutFacts?: Record<string, any>;
  creativesFacts?: Array<Record<string, any>>;
  sources?: Array<{
    type: string;
    id: string;
    title: string;
    url?: string;
    details?: any;
    provenance?: string;
  }>;
  toolOutputs?: Array<{
    toolName: string;
    durationMs?: number;
    summary: string;
    isError?: boolean;
  }>;
  insightsAndNotes?: Array<{
    type: 'insight' | 'hypothesis' | 'user_note';
    title: string;
    content: string;
    createdAt?: string;
  }>;
}
