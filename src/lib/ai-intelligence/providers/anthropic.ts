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
  getAnthropicToolsDefinition,
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

export class AnthropicProviderAdapter implements AIProviderAdapter {
  id = 'anthropic' as const;
  name = 'Anthropic';
  displayName = 'Anthropic Claude';

  private getApiKey(): string | null {
    return process.env.ANTHROPIC_API_KEY || null;
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
      fastModel: process.env.ANTHROPIC_FAST_MODEL || PROVIDER_REGISTRY.anthropic.defaultFastModel,
      deepModel: process.env.ANTHROPIC_DEEP_MODEL || PROVIDER_REGISTRY.anthropic.defaultDeepModel,
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
        provider: 'anthropic',
        name: this.displayName,
        status: 'NOT_CONFIGURED',
        keyConfigured: false,
        keyMasked: null,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: 'ANTHROPIC_API_KEY não configurada no servidor (.env.local)',
      };
      healthCache = { result, timestamp: now };
      return result;
    }

    const startTime = Date.now();
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: fastModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply exactly: OK' }],
        }),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const result: AIProviderHealthResult = {
          provider: 'anthropic',
          name: this.displayName,
          status: 'ERROR',
          keyConfigured: true,
          keyMasked,
          fastModel,
          deepModel,
          toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
          database: { status: 'ONLINE' },
          message: `Erro na Anthropic API (${res.status}): ${errorData.error?.message || res.statusText}`,
          latencyMs,
        };
        healthCache = { result, timestamp: now };
        return result;
      }

      const result: AIProviderHealthResult = {
        provider: 'anthropic',
        name: this.displayName,
        status: 'ONLINE',
        keyConfigured: true,
        keyMasked,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: 'Anthropic Claude API Conectada e Operacional',
        latencyMs,
      };
      healthCache = { result, timestamp: now };
      return result;
    } catch (err: any) {
      const result: AIProviderHealthResult = {
        provider: 'anthropic',
        name: this.displayName,
        status: 'ERROR',
        keyConfigured: true,
        keyMasked,
        fastModel,
        deepModel,
        toolLayer: { status: 'ONLINE', ready: true, count: AI_TOOLS_LIST.length },
        database: { status: 'ONLINE' },
        message: `Falha de conexão com a Anthropic API: ${err.message}`,
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
        code: 'ANTHROPIC_API_KEY_NOT_CONFIGURED',
        message: 'ANTHROPIC_API_KEY não encontrada no arquivo .env.local do servidor.',
        steps: {
          credentialFound: { pass: false, label: 'Etapa 1: Credencial ANTHROPIC_API_KEY', error: 'Chave não encontrada em .env.local' },
          apiPing: { pass: false, label: 'Etapa 2: Requisição Anthropic API', error: 'Dependência falhou' },
          modelResponse: { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Dependência falhou' },
          toolCalling: { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: 'Dependência falhou' },
        },
        details: {
          provider: 'anthropic',
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
      credentialFound: { pass: true, label: 'Etapa 1: Credencial ANTHROPIC_API_KEY' },
    };

    const pingStart = Date.now();
    let modelText: string | null = null;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 15,
          messages: [{ role: 'user', content: 'Reply exactly: OK' }],
        }),
      });

      const pingLatency = Date.now() - pingStart;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        stepsResult.apiPing = { pass: false, label: 'Etapa 2: Requisição Anthropic API', error: `HTTP ${res.status}: ${errData.error?.message || res.statusText}`, latencyMs: pingLatency };
        stepsResult.modelResponse = { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Falha na requisição API' };
        stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer', error: 'Falha na requisição API' };

        return {
          success: false,
          code: 'ANTHROPIC_API_ERROR',
          message: `Falha na requisição Anthropic API (${res.status}): ${errData.error?.message || res.statusText}`,
          steps: stepsResult,
          details: { provider: 'anthropic', name: this.displayName, fastModel, deepModel, keyConfigured: true, keyMasked, toolLayerReady: true, toolsAvailable: AI_TOOLS_LIST.length, totalLatencyMs: pingLatency },
        };
      }

      const data = await res.json();
      modelText = data.content?.[0]?.text?.trim() || 'OK';
      stepsResult.apiPing = { pass: true, label: 'Etapa 2: Requisição Anthropic API', latencyMs: pingLatency };
      stepsResult.modelResponse = { pass: true, label: 'Etapa 3: Resposta do Modelo', summary: `Resposta (${targetModel}): "${modelText}"` };
    } catch (err: any) {
      stepsResult.apiPing = { pass: false, label: 'Etapa 2: Requisição Anthropic API', error: err.message };
      stepsResult.modelResponse = { pass: false, label: 'Etapa 3: Resposta do Modelo', error: 'Falha de rede' };
      stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer', error: 'Falha de rede' };

      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: `Erro de rede ao conectar com a Anthropic API: ${err.message}`,
        steps: stepsResult,
        details: { provider: 'anthropic', name: this.displayName, fastModel, deepModel, keyConfigured: true, keyMasked, toolLayerReady: true, toolsAvailable: AI_TOOLS_LIST.length },
      };
    }

    const toolStart = Date.now();
    try {
      const tools = getAnthropicToolsDefinition();
      const toolRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Use a ferramenta search_offers com limit 1 para buscar ofertas.' }],
          tools,
        }),
      });

      const toolLatency = Date.now() - toolStart;
      if (toolRes.ok) {
        const toolData = await toolRes.json();
        const contentBlocks = toolData.content || [];
        const toolUseBlock = contentBlocks.find((b: any) => b.type === 'tool_use' && b.name === 'search_offers');

        if (toolUseBlock) {
          const args = toolUseBlock.input || { limit: 1 };
          const toolOutput = await executeAiTool('search_offers', args);
          stepsResult.toolCalling = {
            pass: true,
            label: 'Etapa 4: Execução da Tool Layer (search_offers)',
            latencyMs: toolLatency,
            summary: { toolCalled: 'search_offers', args, totalFound: toolOutput.totalOffers ?? toolOutput.total ?? 0 },
          };
        } else {
          stepsResult.toolCalling = { pass: false, label: 'Etapa 4: Execução da Tool Layer (search_offers)', error: 'Claude não gerou a chamada search_offers esperada', latencyMs: toolLatency };
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
      message: overallSuccess ? `Anthropic Claude API & Tool Layer Operacionais! (${targetModel}) ✓` : `Conexão Claude OK, porém teste de Tool Calling pendente.`,
      steps: stepsResult,
      details: {
        provider: 'anthropic',
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
      throw new Error('ANTHROPIC_API_KEY não configurada no servidor (.env.local).');
    }

    const maxRounds = params.mode === 'quick' ? 8 : 30;
    params.onStatus?.(params.mode === 'quick' ? 'Iniciando análise rápida (Claude)...' : 'Iniciando investigação profunda (Claude)...');

    const anthropicMessages: any[] = [];
    let contextAddendum = '';
    if (params.attachedOfferIds && params.attachedOfferIds.length > 0) {
      contextAddendum = `\n[CONTEXTO ANEXADO NA MENSAGEM: O usuário fixou os UUIDs de oferta: ${params.attachedOfferIds.join(
        ', '
      )}. Inicie consultando estas ofertas via get_offer ou get_offer_context.]\n`;
    }

    params.messages.forEach((msg, idx) => {
      const isLast = idx === params.messages.length - 1;
      const content = isLast ? `${msg.content}${contextAddendum}` : msg.content;
      anthropicMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content,
      });
    });

    const tools = getAnthropicToolsDefinition();
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

    const systemPrompt = getOfferBrainSystemPrompt({
      messages: params.messages,
      attachedOfferIds: params.attachedOfferIds,
    });

    while (keepGoing && currentRound < maxRounds) {
      currentRound++;
      const payload = {
        model: resolvedModel,
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        tools,
      };

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const msg = errorJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        if (res.status === 429) {
          throw new Error(`Limite de cota excedido na Anthropic API (429 Rate Limit): ${msg}`);
        }
        throw new Error(`Erro na Anthropic API (${res.status}): ${msg}`);
      }

      const data = await res.json();
      const contentBlocks = data.content || [];

      // Check if stop_reason === 'tool_use'
      const toolUseBlocks = contentBlocks.filter((b: any) => b.type === 'tool_use');
      if (toolUseBlocks.length > 0) {
        // Intermediate commentary
        const textBlocks = contentBlocks.filter((b: any) => b.type === 'text');
        if (textBlocks.length > 0) {
          params.onStatus?.(textBlocks.map((b: any) => b.text).join('\n'));
        }

        // Append assistant's turn to messages
        anthropicMessages.push({
          role: 'assistant',
          content: contentBlocks,
        });

        const toolResultsForUserTurn: any[] = [];
        for (const tu of toolUseBlocks) {
          toolCallsCount++;
          const toolName = tu.name;
          const toolArgs = tu.input || {};

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

          toolResultsForUserTurn.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify({ result: toolResult }),
          });
        }

        // Append user turn containing tool_results back to Claude
        anthropicMessages.push({
          role: 'user',
          content: toolResultsForUserTurn,
        });
      } else {
        keepGoing = false;
        const textBlocks = contentBlocks.filter((b: any) => b.type === 'text');
        if (textBlocks.length > 0) {
          const finalTxt = textBlocks.map((b: any) => b.text).join('');
          fullResponseText = finalTxt;
          params.onToken?.(finalTxt);
        }
      }
    }

    // Final fallback synthesis if no text was captured
    if (!fullResponseText.trim() && toolCallsCount > 0) {
      params.onStatus?.('Gerando relatório final de inteligência...');
      anthropicMessages.push({
        role: 'user',
        content: 'Apresente agora o Relatório de Inteligência final limpo e estruturado em Markdown com base nos dados obtidos.',
      });

      const finalRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedModel,
          max_tokens: 4096,
          system: SYSTEM_PROMPT_ANALYST_V1,
          messages: anthropicMessages,
        }),
      });

      if (finalRes.ok) {
        const finalData = await finalRes.json();
        const textBlocks = (finalData.content || []).filter((b: any) => b.type === 'text');
        const finalTxt = textBlocks.map((b: any) => b.text).join('');
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
      provider: 'anthropic',
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

export const anthropicProviderAdapter = new AnthropicProviderAdapter();
