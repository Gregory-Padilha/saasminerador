export type ProviderId = 'openai' | 'gemini' | 'anthropic';
export type AnalysisMode = 'quick' | 'deep';

export interface ProviderModelConfig {
  fastModel: string;
  deepModel: string;
}

export interface AISourceReference {
  type: 'offer' | 'creative' | 'landing_page' | 'checkout' | 'order_bump' | 'deep_dive' | 'insight' | 'pattern' | 'snapshot';
  id: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, any>;
}

export interface AIToolCallRecord {
  id: string;
  threadId: string;
  messageId?: string;
  toolName: string;
  arguments: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  durationMs?: number;
  resultSummary?: string;
  createdAt: string;
}

export interface AIMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: {
    provider?: ProviderId;
    model?: string;
    mode?: AnalysisMode;
    status?: string;
    error?: string;
    sources?: AISourceReference[];
    toolCalls?: AIToolCallRecord[];
    toolCallsCount?: number;
    attachedOfferIds?: string[];
    durationMs?: number;
    tokens?: {
      prompt?: number;
      completion?: number;
      total?: number;
    };
    suggestedActions?: string[];
  };
}

export interface AIThread {
  id: string;
  title: string;
  provider: ProviderId;
  model: string;
  mode: AnalysisMode;
  pinned: boolean;
  archived: boolean;
  attachedOfferIds: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageSnippet?: string;
}

export interface AIUsageRecord {
  id: string;
  threadId?: string;
  provider: ProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  toolCallsCount: number;
  durationMs: number;
  createdAt: string;
}

export interface StreamMessageParams {
  threadId: string;
  provider?: ProviderId;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  mode: AnalysisMode;
  attachedOfferIds?: string[];
  model?: string;
  onStatus?: (statusText: string) => void;
  onToolStart?: (toolName: string, args: Record<string, any>) => void;
  onToolEnd?: (toolName: string, durationMs: number, summary: string, isError?: boolean) => void;
  onToken?: (token: string) => void;
  onSources?: (sources: AISourceReference[]) => void;
}

export type AIProviderStatus = 'NOT_CONFIGURED' | 'CONFIGURED' | 'CHECKING' | 'ONLINE' | 'DEGRADED' | 'ERROR';

export interface AIProviderHealthResult {
  provider: ProviderId;
  name: string;
  status: AIProviderStatus;
  keyConfigured: boolean;
  keyMasked: string | null;
  fastModel: string;
  deepModel: string;
  toolLayer: {
    status: string;
    ready: boolean;
    count: number;
  };
  database: {
    status: string;
  };
  message: string;
  latencyMs?: number;
}

export interface ProviderDiagnosticResult {
  success: boolean;
  code: string;
  message: string;
  steps: Record<string, { pass: boolean; label: string; error?: string; latencyMs?: number; summary?: any }>;
  details: {
    provider: ProviderId;
    name: string;
    fastModel: string;
    deepModel: string;
    keyConfigured: boolean;
    keyMasked: string | null;
    toolLayerReady: boolean;
    toolsAvailable: number;
    totalLatencyMs?: number;
  };
}

export interface AIProviderAdapter {
  id: ProviderId;
  name: string;
  displayName: string;
  isConfigured(): boolean;
  getMaskedKey(): string | null;
  getDefaultModels(): ProviderModelConfig;
  checkHealth(forceFresh?: boolean): Promise<AIProviderHealthResult>;
  runDiagnostic(mode?: AnalysisMode): Promise<ProviderDiagnosticResult>;
  runLoop(
    params: StreamMessageParams,
    resolvedModel: string
  ): Promise<{
    fullText: string;
    sources: AISourceReference[];
    toolCallsCount: number;
    durationMs: number;
  }>;
}


