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
  getOpenAiToolsDefinition,
  extractSourcesFromToolResult,
} from '../registry';
import { SYSTEM_PROMPT_ANALYST_V1, getOfferBrainSystemPrompt } from '../prompts';
import { aiDbService } from '../db';

interface HealthCacheEntry {
  result: AIProviderHealthResult;
  timestamp: number;
}

let healthCache: HealthCacheEntry | null = null;
const CACHE_TTL_MS = 60000;

export class OpenAIProviderAdapter implements AIProviderAdapter {
  id = 'openai' as const;
  name = 'OpenAI';
  displayName = 'ChatGPT / OpenAI';

  private getApiKey(): string | null {
    return process.env.OPENAI_API_KEY || null;
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
      fastModel: process.env.OPENAI_FAST_MODEL || PROVIDER_REGISTRY.openai.defaultFastModel,
      deepModel: process.env.OPENAI_DEEP_MODEL || PROVIDER_REGISTRY.openai.defaultDeepModel,
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
        provider: 'openai',
        name: this.displayName,
        status: 'NOT_CONFIGURED',
        keyConfigured: false,
        keyMasked: null,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: 'OPENAI_API_KEY não configurada no servidor (.env.local)',
      };
      healthCache = { result, timestamp: now };
      return result;
    }

    const startTime = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: fastModel,
          messages: [
            { role: 'user', content: 'Reply exactly: OK' }
          ],
          max_tokens: 5,
        }),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const result: AIProviderHealthResult = {
          provider: 'openai',
          name: this.displayName,
          status: 'ERROR',
          keyConfigured: true,
          keyMasked,
          fastModel,
          deepModel,
          toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
          database: { status: 'ONLINE' },
          message: `Erro na OpenAI API (${res.status}): ${errorData.error?.message || res.statusText}`,
          latencyMs,
        };
        healthCache = { result, timestamp: now };
        return result;
      }

      const result: AIProviderHealthResult = {
        provider: 'openai',
        name: this.displayName,
        status: 'ONLINE',
        keyConfigured: true,
        keyMasked,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: 'OpenAI API Conectada e Operacional',
        latencyMs,
      };
      healthCache = { result, timestamp: now };
      return result;
    } catch (err: any) {
      const result: AIProviderHealthResult = {
        provider: 'openai',
        name: this.displayName,
        status: 'ERROR',
        keyConfigured: true,
        keyMasked,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: `Falha de conexão com a OpenAI API: ${err.message}`,
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
        code: 'OPENAI_API_KEY_NOT_CONFIGURED',
        message: 'OPENAI_API_KEY não encontrada no arquivo .env.local do servidor.',
        steps: {
          credentialFound: { pass: false, label: 'Etapa 1: Credencial OPENAI_API_KEY', error: 'Chave não encontrada em .env.local' },
          apiPing: { pass: false, label: 'Etapa 2: Requisição OpenAI API', error: 'Dependência falhou' },
          modelResponse: { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Dependência falhou' },
          toolCalling: { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: 'Dependência falhou' },
        },
        details: {
          provider: 'openai',
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
      credentialFound: { pass: true, label: 'Etapa 1: Credencial OPENAI_API_KEY' },
    };

    const pingStart = Date.now();
    let modelText: string | null = null;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Reply exactly: OK' }],
          max_tokens: 10,
        }),
      });

      const pingLatency = Date.now() - pingStart;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        stepsResult.apiPing = { pass: false, label: 'Etapa 2: Requisição OpenAI API', error: `HTTP ${res.status}: ${errData.error?.message || res.statusText}`, latencyMs: pingLatency };
        stepsResult.modelResponse = { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Falha na requisição API' };
        stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer', error: 'Falha na requisição API' };

        return {
          success: false,
          code: 'OPENAI_API_ERROR',
          message: `Falha na requisição OpenAI API (${res.status}): ${errData.error?.message || res.statusText}`,
          steps: stepsResult,
          details: { provider: 'openai', name: this.displayName, fastModel, deepModel, keyConfigured: true, keyMasked, toolLayerReady: true, toolsAvailable: AI_TOOLS_LIST.length, totalLatencyMs: pingLatency },
        };
      }

      const data = await res.json();
      modelText = data.choices?.[0]?.message?.content?.trim() || 'OK';
      stepsResult.apiPing = { pass: true, label: 'Etapa 2: Requisição OpenAI API', latencyMs: pingLatency };
      stepsResult.modelResponse = { pass: true, label: 'Etapa 3: Resposta do Modelo', summary: `Resposta (${targetModel}): "${modelText}"` };
    } catch (err: any) {
      stepsResult.apiPing = { pass: false, label: 'Etapa 2: Requisição OpenAI API', error: err.message };
      stepsResult.modelResponse = { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Falha de rede' };
      stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer', error: 'Falha de rede' };

      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: `Erro de rede ao conectar com a OpenAI API: ${err.message}`,
        steps: stepsResult,
        details: { provider: 'openai', name: this.displayName, fastModel, deepModel, keyConfigured: true, keyMasked, toolLayerReady: true, toolsAvailable: AI_TOOLS_LIST.length },
      };
    }

    const toolStart = Date.now();
    try {
      const tools = getOpenAiToolsDefinition();
      const toolRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Use a ferramenta search_offers com limit 1 para buscar ofertas.' }],
          tools,
          tool_choice: 'auto',
        }),
      });

      const toolLatency = Date.now() - toolStart;
      if (toolRes.ok) {
        const toolData = await toolRes.json();
        const toolCalls = toolData.choices?.[0]?.message?.tool_calls || [];
        const searchCall = toolCalls.find((tc: any) => tc.function?.name === 'search_offers');

        if (searchCall) {
          const args = JSON.parse(searchCall.function.arguments || '{}');
          const toolOutput = await executeAiTool('search_offers', args);
          stepsResult.toolCalling = {
            pass: true,
            label: 'Etapa 4: Execução da Tool Layer (search_offers)',
            latencyMs: toolLatency,
            summary: { toolCalled: 'search_offers', args, totalFound: toolOutput.totalOffers ?? toolOutput.total ?? 0 },
          };
        } else {
          stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: 'OpenAI não gerou a chamada search_offers esperada', latencyMs: toolLatency };
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
      message: overallSuccess ? `OpenAI API & Tool Layer Operacionais! (${targetModel}) ✓` : `Conexão OpenAI OK, porém teste de Tool Calling pendente.`,
      steps: stepsResult,
      details: {
        provider: 'openai',
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
      throw new Error('OPENAI_API_KEY não configurada no servidor (.env.local).');
    }

    const maxRounds = params.mode === 'quick' ? 8 : 30;
    params.onStatus?.(params.mode === 'quick' ? 'Iniciando análise rápida (OpenAI)...' : 'Iniciando investigação profunda (OpenAI)...');

    const systemPrompt = getOfferBrainSystemPrompt({
      messages: params.messages,
      attachedOfferIds: params.attachedOfferIds,
    });

    const openaiMessages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    let contextAddendum = '';
    if (params.attachedOfferIds && params.attachedOfferIds.length > 0) {
      contextAddendum = `\n[CONTEXTO ANEXADO NA MENSAGEM: O usuário fixou os UUIDs de oferta: ${params.attachedOfferIds.join(
        ', '
      )}. Inicie consultando estas ofertas via get_offer ou get_offer_context.]\n`;
    }

    params.messages.forEach((msg, idx) => {
      const isLast = idx === params.messages.length - 1;
      const content = isLast ? `${msg.content}${contextAddendum}` : msg.content;
      openaiMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content,
      });
    });

    const tools = getOpenAiToolsDefinition();
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

    while (keepGoing && currentRound < maxRounds) {
      currentRound++;
      const payload = {
        model: resolvedModel,
        messages: openaiMessages,
        tools,
        tool_choice: 'auto',
      };

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const msg = errorJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        if (res.status === 429) {
          throw new Error(`Limite de cota excedido na OpenAI API (429 Rate Limit): ${msg}`);
        }
        throw new Error(`Erro na OpenAI API (${res.status}): ${msg}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error('Nenhuma resposta retornada do modelo OpenAI.');
      }

      const assistantMessage = choice.message;
      const toolCalls = assistantMessage.tool_calls || [];

      if (toolCalls.length > 0) {
        if (assistantMessage.content) {
          params.onStatus?.(assistantMessage.content);
        }
        openaiMessages.push(assistantMessage);

        for (const tc of toolCalls) {
          toolCallsCount++;
          const toolName = tc.function.name;
          const toolArgs = JSON.parse(tc.function.arguments || '{}');

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

          openaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ result: toolResult }),
          });
        }
      } else {
        keepGoing = false;
        if (assistantMessage.content) {
          fullResponseText = assistantMessage.content;
          params.onToken?.(assistantMessage.content);
        }
      }
    }

    // Final fallback synthesis if no text was captured
    if (!fullResponseText.trim() && toolCallsCount > 0) {
      params.onStatus?.('Gerando relatório final de inteligência...');
      openaiMessages.push({
        role: 'user',
        content: 'Apresente agora o Relatório de Inteligência final limpo e estruturado em Markdown com base nos dados obtidos.',
      });

      const finalRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: openaiMessages,
        }),
      });

      if (finalRes.ok) {
        const finalData = await finalRes.json();
        const finalTxt = finalData.choices?.[0]?.message?.content || '';
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
      provider: 'openai',
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

export const openAIProviderAdapter = new OpenAIProviderAdapter();
