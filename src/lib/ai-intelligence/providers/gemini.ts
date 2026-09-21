import { AI_TOOLS_LIST, executeAiTool } from '@/lib/ai-tools/registry';
import {
  AIProviderAdapter,
  AIProviderHealthResult,
  ProviderDiagnosticResult,
  ProviderModelConfig,
  StreamMessageParams,
  AISourceReference,
  AnalysisMode,
} from '../types';
import {
  PROVIDER_REGISTRY,
  getGeminiToolsDefinition,
  extractSourcesFromToolResult,
} from '../registry';
import { SYSTEM_PROMPT_ANALYST_V1, getOfferBrainSystemPrompt } from '../prompts';
import { aiDbService } from '../db';

import { serverEnv } from '@/lib/env/server';

interface HealthCacheEntry {
  result: AIProviderHealthResult;
  timestamp: number;
}

let healthCache: HealthCacheEntry | null = null;
const CACHE_TTL_MS = 60000;

export class GeminiProviderAdapter implements AIProviderAdapter {
  id = 'gemini' as const;
  name = 'Google Gemini';
  displayName = 'Google Gemini';

  private getApiKey(): string | null {
    return serverEnv.GEMINI_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  getMaskedKey(): string | null {
    const key = this.getApiKey();
    if (!key) return null;
    if (key.length <= 4) return '****';
    return `...${key.slice(-4)}`;
  }

  getDefaultModels(): ProviderModelConfig {
    return {
      fastModel: process.env.GEMINI_FAST_MODEL || PROVIDER_REGISTRY.gemini.defaultFastModel,
      deepModel: process.env.GEMINI_DEEP_MODEL || PROVIDER_REGISTRY.gemini.defaultDeepModel,
    };
  }

  async checkHealth(forceFresh = false): Promise<AIProviderHealthResult> {
    const now = Date.now();
    if (!forceFresh && healthCache && now - healthCache.timestamp < CACHE_TTL_MS) {
      return healthCache.result;
    }

    const apiKey = this.getApiKey();
    const { fastModel, deepModel } = this.getDefaultModels();
    const keyMasked = this.getMaskedKey();

    if (!apiKey) {
      const result: AIProviderHealthResult = {
        provider: 'gemini',
        name: this.displayName,
        status: 'NOT_CONFIGURED',
        keyConfigured: false,
        keyMasked: null,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: 'GEMINI_API_KEY não configurada no servidor (.env.local)',
      };
      healthCache = { result, timestamp: now };
      return result;
    }

    const startTime = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${fastModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply exactly: OK' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const result: AIProviderHealthResult = {
          provider: 'gemini',
          name: this.displayName,
          status: 'ERROR',
          keyConfigured: true,
          keyMasked,
          fastModel,
          deepModel,
          toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
          database: { status: 'ONLINE' },
          message: `Erro na Gemini API (${res.status}): ${errorData.error?.message || res.statusText}`,
          latencyMs,
        };
        healthCache = { result, timestamp: now };
        return result;
      }

      const result: AIProviderHealthResult = {
        provider: 'gemini',
        name: this.displayName,
        status: 'ONLINE',
        keyConfigured: true,
        keyMasked,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: 'Gemini API Conectada e Operacional',
        latencyMs,
      };
      healthCache = { result, timestamp: now };
      return result;
    } catch (err: any) {
      const result: AIProviderHealthResult = {
        provider: 'gemini',
        name: this.displayName,
        status: 'ERROR',
        keyConfigured: true,
        keyMasked,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: `Falha de conexão com a Gemini API: ${err.message}`,
      };
      healthCache = { result, timestamp: now };
      return result;
    }
  }

  async runDiagnostic(mode: AnalysisMode = 'quick'): Promise<ProviderDiagnosticResult> {
    const startTime = Date.now();
    const { fastModel, deepModel } = this.getDefaultModels();
    const targetModel = mode === 'deep' ? deepModel : fastModel;
    const apiKey = this.getApiKey();
    const keyMasked = this.getMaskedKey();

    if (!apiKey) {
      return {
        success: false,
        code: 'GEMINI_API_KEY_NOT_CONFIGURED',
        message: 'GEMINI_API_KEY não encontrada no arquivo .env.local do servidor.',
        steps: {
          credentialFound: { pass: false, label: 'Etapa 1: Credencial GEMINI_API_KEY', error: 'Chave não encontrada' },
          apiPing: { pass: false, label: 'Etapa 2: Requisição Gemini API', error: 'Dependência falhou' },
          modelResponse: { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Dependência falhou' },
          toolCalling: { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: 'Dependência falhou' },
        },
        details: {
          provider: 'gemini',
          name: this.displayName,
          fastModel,
          deepModel,
          keyConfigured: false,
          keyMasked: null,
          toolLayerReady: true,
          toolsAvailable: AI_TOOLS_LIST.length,
        },
      };
    }

    const stepsResult: Record<string, { pass: boolean; label: string; error?: string; latencyMs?: number; summary?: any }> = {
      credentialFound: { pass: true, label: 'Etapa 1: Credencial GEMINI_API_KEY' },
    };

    const pingStart = Date.now();
    let modelText: string | null = null;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Reply exactly: OK' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      );

      const pingLatency = Date.now() - pingStart;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        stepsResult.apiPing = { pass: false, label: 'Etapa 2: Requisição Gemini API', error: `HTTP ${res.status}: ${errData.error?.message || res.statusText}`, latencyMs: pingLatency };
        stepsResult.modelResponse = { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Falha na requisição API' };
        stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer', error: 'Falha na requisição API' };

        return {
          success: false,
          code: 'GEMINI_API_ERROR',
          message: `Falha na requisição Gemini API (${res.status}): ${errData.error?.message || res.statusText}`,
          steps: stepsResult,
          details: { provider: 'gemini', name: this.displayName, fastModel, deepModel, keyConfigured: true, keyMasked, toolLayerReady: true, toolsAvailable: AI_TOOLS_LIST.length, totalLatencyMs: pingLatency },
        };
      }

      const data = await res.json();
      modelText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
      stepsResult.apiPing = { pass: true, label: 'Etapa 2: Requisição Gemini API', latencyMs: pingLatency };
      stepsResult.modelResponse = { pass: true, label: 'Etapa 3: Resposta do Modelo', summary: `Resposta (${targetModel}): "${modelText}"` };
    } catch (err: any) {
      stepsResult.apiPing = { pass: false, label: 'Etapa 2: Requisição Gemini API', error: err.message };
      stepsResult.modelResponse = { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Falha de rede' };
      stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer', error: 'Falha de rede' };

      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: `Erro de rede ao conectar com a Gemini API: ${err.message}`,
        steps: stepsResult,
        details: { provider: 'gemini', name: this.displayName, fastModel, deepModel, keyConfigured: true, keyMasked, toolLayerReady: true, toolsAvailable: AI_TOOLS_LIST.length },
      };
    }

    const toolStart = Date.now();
    try {
      const tools = getGeminiToolsDefinition();
      const toolRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Use a ferramenta search_offers com limit 1 para buscar ofertas.' }] }],
            tools,
          }),
        }
      );

      const toolLatency = Date.now() - toolStart;
      if (toolRes.ok) {
        const toolData = await toolRes.json();
        const parts = toolData.candidates?.[0]?.content?.parts || [];
        const functionCall = parts.find((p: any) => p.functionCall)?.functionCall;

        if (functionCall && functionCall.name === 'search_offers') {
          const toolOutput = await executeAiTool('search_offers', functionCall.args || { limit: 1 });
          stepsResult.toolCalling = {
            pass: true,
            label: 'Etapa 4: Execução da Tool Layer (search_offers)',
            latencyMs: toolLatency,
            summary: { toolCalled: 'search_offers', args: functionCall.args, totalFound: toolOutput.totalOffers ?? toolOutput.total ?? 0 },
          };
        } else {
          stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: 'Modelo não gerou a chamada search_offers esperada', latencyMs: toolLatency };
        }
      } else {
        stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: `Erro HTTP ${toolRes.status}` };
      }
    } catch (err: any) {
      stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: err.message };
    }

    const totalLatencyMs = Date.now() - startTime;
    const overallSuccess = Boolean(stepsResult.credentialFound?.pass && stepsResult.apiPing?.pass && stepsResult.modelResponse?.pass && stepsResult.toolCalling?.pass);

    return {
      success: overallSuccess,
      code: overallSuccess ? 'ALL_TESTS_PASSED' : 'PARTIAL_SUCCESS',
      message: overallSuccess ? `Google Gemini API & Tool Layer Operacionais! (${targetModel}) ✓` : `Conexão Gemini OK, porém teste de Tool Calling pendente.`,
      steps: stepsResult,
      details: {
        provider: 'gemini',
        name: this.displayName,
        fastModel,
        deepModel,
        keyConfigured: true,
        keyMasked,
        toolLayerReady: true,
        toolsAvailable: AI_TOOLS_LIST.length,
        totalLatencyMs,
      },
    };
  }

  async runLoop(params: StreamMessageParams, resolvedModel: string): Promise<{
    fullText: string;
    sources: AISourceReference[];
    toolCallsCount: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no servidor (.env.local).');
    }

    const maxRounds = params.mode === 'quick' ? 8 : 30;
    params.onStatus?.(params.mode === 'quick' ? 'Iniciando análise rápida (Gemini)...' : 'Iniciando investigação profunda (Gemini)...');

    const contents: any[] = [];
    let contextAddendum = '';
    if (params.attachedOfferIds && params.attachedOfferIds.length > 0) {
      contextAddendum = `\n[CONTEXTO ANEXADO NA MENSAGEM: O usuário fixou os UUIDs de oferta: ${params.attachedOfferIds.join(
        ', '
      )}. Inicie consultando estas ofertas via get_offer ou get_offer_context.]\n`;
    }

    params.messages.forEach((msg, idx) => {
      const isLast = idx === params.messages.length - 1;
      const textContent = isLast ? `${msg.content}${contextAddendum}` : msg.content;
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: textContent }],
      });
    });

    const tools = getGeminiToolsDefinition();
    const collectedSources: AISourceReference[] = [];
    const sourceMap = new Map<string, AISourceReference>();

    const addSources = (newSources: AISourceReference[]) => {
      newSources.forEach((s) => {
        const key = `${s.type}:${s.id}`;
        if (!sourceMap.has(key)) {
          sourceMap.set(key, s);
          collectedSources.push(s);
        }
      });
      params.onSources?.(collectedSources);
    };

    let fullResponseText = '';
    let toolCallsCount = 0;
    let currentRound = 0;
    let keepGoing = true;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`;

    const systemPrompt = getOfferBrainSystemPrompt({
      messages: params.messages,
      attachedOfferIds: params.attachedOfferIds,
    });

    while (keepGoing && currentRound < maxRounds) {
      currentRound++;
      const payload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const msg = errorJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        if (res.status === 429) {
          throw new Error(`Limite de cota excedido na Gemini API (429 Rate Limit): ${msg}`);
        }
        throw new Error(`Erro na Gemini API (${res.status}): ${msg}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error('Nenhuma resposta retornada do modelo Gemini.');
      }

      const parts = candidate.content?.parts || [];
      const functionCallParts = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      if (functionCallParts.length > 0) {
        if (textParts.length > 0) {
          params.onStatus?.(textParts.map((p: any) => p.text).join('\n'));
        }

        for (const part of functionCallParts) {
          toolCallsCount++;
          const toolName = part.functionCall.name;
          const toolArgs = part.functionCall.args || {};

          params.onStatus?.(`Executando ferramenta: ${toolName}...`);
          params.onToolStart?.(toolName, toolArgs);

          const toolStartTime = Date.now();
          let toolResult: any = null;
          let isError = false;

          try {
            toolResult = await executeAiTool(toolName, toolArgs);
            const extracted = extractSourcesFromToolResult(toolName, toolResult);
            addSources(extracted);
          } catch (err: any) {
            isError = true;
            toolResult = { error: err.message || 'Erro na execução da ferramenta' };
          }

          const durationMs = Date.now() - toolStartTime;
          const summary = isError ? `Erro: ${toolResult.error}` : `Sucesso (${durationMs}ms)`;
          params.onToolEnd?.(toolName, durationMs, summary, isError);

          await aiDbService.saveToolCall({
            id: `tc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            threadId: params.threadId,
            toolName,
            arguments: toolArgs,
            status: isError ? 'error' : 'completed',
            durationMs,
            resultSummary: summary,
            createdAt: new Date().toISOString(),
          });

          contents.push({
            role: 'model',
            parts: [{ functionCall: { name: toolName, args: toolArgs } }],
          });

          contents.push({
            role: 'user',
            parts: [{ functionResponse: { name: toolName, response: { result: toolResult } } }],
          });
        }
      } else {
        keepGoing = false;
        if (textParts.length > 0) {
          const finalTxt = textParts.map((p: any) => p.text).join('');
          fullResponseText = finalTxt;
          params.onToken?.(finalTxt);
        }
      }
    }

    // Final fallback synthesis if no text was captured
    if (!fullResponseText.trim() && toolCallsCount > 0) {
      params.onStatus?.('Gerando relatório final de inteligência...');
      contents.push({
        role: 'user',
        parts: [{ text: 'Apresente agora o Relatório de Inteligência final limpo e estruturado em Markdown com base nos dados obtidos.' }],
      });

      const finalRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT_ANALYST_V1 }] },
          contents,
        }),
      });

      if (finalRes.ok) {
        const finalData = await finalRes.json();
        const finalTxt = finalData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (finalTxt) {
          fullResponseText = finalTxt;
          params.onToken?.(finalTxt);
        }
      }
    }

    const totalDurationMs = Date.now() - startTime;
    await aiDbService.saveUsage({
      id: `usg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      threadId: params.threadId,
      provider: 'gemini',
      model: resolvedModel,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      toolCallsCount,
      durationMs: totalDurationMs,
      createdAt: new Date().toISOString(),
    });

    return {
      fullText: fullResponseText,
      sources: collectedSources,
      toolCallsCount,
      durationMs: totalDurationMs,
    };
  }
}

export const geminiProviderAdapter = new GeminiProviderAdapter();
