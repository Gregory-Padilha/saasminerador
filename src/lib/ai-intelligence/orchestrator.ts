import { ProviderId, AIProviderAdapter, StreamMessageParams, AISourceReference, AnalysisMode } from './types';
import { geminiProviderAdapter } from './providers/gemini';
import { openAIProviderAdapter } from './providers/openai';
import { anthropicProviderAdapter } from './providers/anthropic';

const ADAPTER_MAP: Record<ProviderId, AIProviderAdapter> = {
  gemini: geminiProviderAdapter,
  openai: openAIProviderAdapter,
  anthropic: anthropicProviderAdapter,
};

/**
 * Get Provider Adapter by ProviderId
 */
export function getProviderAdapter(providerId?: ProviderId): AIProviderAdapter {
  const targetId = providerId || 'gemini';
  const adapter = ADAPTER_MAP[targetId];
  if (!adapter) {
    throw new Error(`Provedor de IA não suportado: "${targetId}". Escolha entre: openai, gemini ou anthropic.`);
  }
  return adapter;
}

/**
 * Resolve target Model ID based on Provider & Analysis Mode (Fast vs Deep)
 */
export function resolveModel(providerId: ProviderId, mode: AnalysisMode, customModel?: string): string {
  if (customModel && customModel.trim()) return customModel.trim();
  const adapter = getProviderAdapter(providerId);
  const models = adapter.getDefaultModels();
  return mode === 'deep' ? models.deepModel : models.fastModel;
}

/**
 * Central Multi-Provider Orchestrator Loop
 * Performs strict deterministic routing to the requested provider adapter. Zero silent fallback!
 */
export async function runAiIntelligenceLoop(params: StreamMessageParams): Promise<{
  fullText: string;
  sources: AISourceReference[];
  toolCallsCount: number;
  durationMs: number;
  providerUsed: ProviderId;
  modelUsed: string;
}> {
  const requestedProvider = params.provider || 'gemini';
  const adapter = getProviderAdapter(requestedProvider);

  // STRICT ROUTING & ZERO SILENT FALLBACK: Validate server key presence
  if (!adapter.isConfigured()) {
    const envKey =
      requestedProvider === 'openai'
        ? 'OPENAI_API_KEY'
        : requestedProvider === 'anthropic'
        ? 'ANTHROPIC_API_KEY'
        : 'GEMINI_API_KEY';
    throw new Error(
      `O provedor selecionado (${adapter.displayName}) não possui chave de API configurada no servidor. Defina a variável ${envKey} no arquivo .env.local e reinicie o servidor.`
    );
  }

  const resolvedModel = resolveModel(requestedProvider, params.mode, params.model);
  const result = await adapter.runLoop(params, resolvedModel);

  return {
    ...result,
    providerUsed: requestedProvider,
    modelUsed: resolvedModel,
  };
}
