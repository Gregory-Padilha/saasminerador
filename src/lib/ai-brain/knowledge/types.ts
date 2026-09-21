export type KnowledgeCategory =
  | 'OFERTAS & PRODUTO'
  | 'COPY & POSICIONAMENTO'
  | 'CRIATIVOS'
  | 'LANDING PAGES'
  | 'TRÁFEGO & ESCALA'
  | 'PESQUISA & MINERAÇÃO'
  | 'FUNIS & MONETIZAÇÃO'
  | 'PÚBLICO & MERCADO'
  | 'OPERAÇÃO'
  | 'ESTUDOS DE CASO'
  | 'FRAMEWORKS'
  | 'OUTROS';

export type KnowledgeType =
  | 'FRAMEWORK'
  | 'PLAYBOOK'
  | 'ESTUDO DE CASO'
  | 'CONCEITO'
  | 'ESTRATÉGIA'
  | 'SOP'
  | 'PESQUISA'
  | 'TRANSCRIÇÃO'
  | 'ANOTAÇÃO'
  | 'OPINIÃO / REFERÊNCIA';

export type TrustStatus = 'VALIDADO' | 'REFERÊNCIA' | 'EXPERIMENTAL' | 'ARQUIVADO';

export type KnowledgeStatus = 'RAW' | 'PROCESSED' | 'REVIEWED' | 'VALIDATED' | 'ARCHIVED';

export type SourceType = 'FILE' | 'PASTED_TEXT' | 'VIDEO' | 'URL';

export type IngestionStage =
  | 'INGEST'
  | 'EXTRACT'
  | 'TRANSCRIBE'
  | 'NORMALIZE'
  | 'ANALYZE'
  | 'INDEX'
  | 'READY'
  | 'FAILED';

export interface KnowledgeSource {
  id: string;
  sourceType: SourceType;
  originalName: string;
  sourceUrl?: string;
  author?: string;
  duration?: number; // seconds
  thumbnail?: string;
  storagePath?: string;
  mimeType?: string;
  hash: string;
  rawContent?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface StructuredKnowledgeFicha {
  summary: string;
  when_to_use?: string;
  when_not_to_use?: string;
  prerequisites?: string;
  risks?: string;
  key_concepts?: string[];
  suggested_tags?: string[];
}

export interface KnowledgeDocument {
  id: string;
  sourceId: string;
  title: string;
  originalTitle: string;
  description?: string;
  canonicalMarkdown: string;
  category: KnowledgeCategory;
  knowledgeType: KnowledgeType;
  knowledgeStatus: KnowledgeStatus;
  trustStatus: TrustStatus;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceAuthor?: string;
  tags: string[];
  topics?: string[];
  frameworksMentioned?: string[];
  entities?: string[];
  collections?: string[];
  language: string;
  channel?: string;
  market?: string;
  stage?: string;
  fileName?: string;
  mimeType?: string;
  processingStatus: IngestionStage;
  rawTranscript?: string;
  structuredFicha?: StructuredKnowledgeFicha;
  chunkCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  section: string;
  category: KnowledgeCategory;
  knowledgeType: KnowledgeType;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  tags: string[];
  sourceType: SourceType;
  sourceUrl?: string;
  version: number;
  createdAt: string;
}

export interface IngestionJob {
  id: string;
  sourceId: string;
  stage: IngestionStage;
  statusText: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface KnowledgeUsageRecord {
  id: string;
  documentId: string;
  missionId?: string;
  threadId?: string;
  agentRole?: string;
  query?: string;
  createdAt: string;
}

export interface KnowledgeSearchResult {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  score: number;
  matchType: 'KEYWORD' | 'SEMANTIC' | 'HYBRID';
}
