import { NextRequest, NextResponse } from 'next/server';
import { runAiIntelligenceLoop } from '@/lib/ai-intelligence/orchestrator';
import { aiDbService } from '@/lib/ai-intelligence/db';
import { aiRunsService } from '@/lib/ai-intelligence/runs';
import { AnalysisMode, AISourceReference, ProviderId, AIMessage } from '@/lib/ai-intelligence/types';

export const runtime = 'nodejs';

/**
 * P0 Server-Sent Events (SSE) Streaming Chat Endpoint for AI Intelligence / OFFER MINER BRAIN
 * Supports Instant Assistant Shell Persistence, Real-Time Chunk Streaming, Normalized Events, and Full Reload Recovery.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      threadId: rawThreadId,
      message,
      provider = 'gemini',
      mode = 'quick',
      attachedOfferIds = [],
      model,
    } = body as {
      threadId?: string;
      message: string;
      provider?: ProviderId;
      mode?: AnalysisMode;
      attachedOfferIds?: string[];
      model?: string;
    };

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 });
    }

    const threadId = rawThreadId || `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // 1. Ensure Thread Exists or Create it
    let thread = await aiDbService.getThreadById(threadId);
    if (!thread) {
      const generatedTitle = message.trim().length > 40 ? `${message.trim().substring(0, 40)}...` : message.trim();
      thread = {
        id: threadId,
        title: generatedTitle,
        provider,
        model: model || 'default',
        mode,
        pinned: false,
        archived: false,
        attachedOfferIds,
        createdAt: now,
        updatedAt: now,
        lastMessageSnippet: message.trim(),
      };
      await aiDbService.saveThread(thread);
    } else {
      thread.provider = provider;
      thread.mode = mode;
      thread.updatedAt = now;
      thread.lastMessageSnippet = message.trim();
      if (attachedOfferIds.length > 0) {
        thread.attachedOfferIds = Array.from(new Set([...thread.attachedOfferIds, ...attachedOfferIds]));
      }
      await aiDbService.saveThread(thread);
    }

    // 2. Save User Message to DB Immediately
    const userMsgId = `msg_${Date.now()}_usr`;
    await aiDbService.saveMessage({
      id: userMsgId,
      threadId,
      role: 'user',
      content: message.trim(),
      createdAt: now,
      metadata: { provider, mode, attachedOfferIds },
    });

    // 3. PERSIST ASSISTANT MESSAGE IN DB BEFORE AI EXECUTION LOOP
    const assistantMsgId = `msg_${Date.now()}_ast`;
    const initialAssistantMsg: AIMessage = {
      id: assistantMsgId,
      threadId,
      role: 'assistant',
      content: '',
      createdAt: now,
      metadata: {
        provider,
        model: model || 'default',
        mode,
        status: 'RUNNING',
      },
    };
    await aiDbService.saveMessage(initialAssistantMsg);

    // 4. Create AI Execution Run (P0 Stream Recovery & Idempotency Engine)
    const run = await aiRunsService.createRun({
      threadId,
      userMessageId: userMsgId,
      assistantMessageId: assistantMsgId,
      provider,
      model: model || 'default',
      mode,
    });

    // 5. Retrieve Chat History for Context
    const existingMessages = await aiDbService.getMessages(threadId);
    const history = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Create SSE Response Stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = async (event: string, data: any) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            await aiRunsService.recordEvent(run.id, event as any, data);
          } catch {}
        };

        // Handshake events
        await sendEvent('run_created', { runId: run.id, threadId, assistantMsgId });
        await sendEvent('thread', { threadId, runId: run.id, title: thread.title, provider, mode });

        let fullAssistantText = '';
        let detectedSources: AISourceReference[] = [];
        const toolCallsLog: any[] = [];
        let lastPersistMs = Date.now();

        try {
          const result = await runAiIntelligenceLoop({
            threadId,
            provider,
            messages: history,
            mode,
            attachedOfferIds,
            model,
            onStatus: (statusText) => {
              sendEvent('status', { status: statusText });
            },
            onToolStart: (toolName, toolArgs) => {
              sendEvent('tool_start', { toolName, args: toolArgs });
            },
            onToolEnd: (toolName, durationMs, summary, isError) => {
              toolCallsLog.push({ toolName, durationMs, summary, isError });
              sendEvent('tool_end', { toolName, durationMs, summary, isError });
            },
            onToken: (token) => {
              fullAssistantText += token;
              sendEvent('text_delta', { delta: token, token });

              // Periodically checkpoint text in DB every 1.5s
              if (Date.now() - lastPersistMs > 1500) {
                lastPersistMs = Date.now();
                aiDbService.saveMessage({
                  ...initialAssistantMsg,
                  content: fullAssistantText,
                  createdAt: new Date().toISOString(),
                  metadata: {
                    ...initialAssistantMsg.metadata,
                    status: 'RUNNING',
                  },
                }).catch(() => {});
              }
            },
            onSources: (sources) => {
              detectedSources = sources;
              sendEvent('sources', { sources });
            },
          });

          // Final save of Assistant Message to DB with complete text & metadata
          const finalAssistantMsg: AIMessage = {
            id: assistantMsgId,
            threadId,
            role: 'assistant',
            content: result.fullText || fullAssistantText,
            createdAt: new Date().toISOString(),
            metadata: {
              provider: result.providerUsed,
              model: result.modelUsed,
              mode,
              sources: result.sources || detectedSources,
              durationMs: result.durationMs,
              toolCallsCount: result.toolCallsCount,
              status: 'COMPLETE',
            },
          };
          await aiDbService.saveMessage(finalAssistantMsg);

          // Update Run Record to COMPLETED
          await aiRunsService.updateRun(run.id, {
            status: 'COMPLETED',
            user_message_id: userMsgId,
            assistant_message_id: assistantMsgId,
            completed_at: new Date().toISOString(),
          });

          await sendEvent('complete', {
            threadId,
            runId: run.id,
            assistantMessageId: assistantMsgId,
            provider: result.providerUsed,
            model: result.modelUsed,
            mode,
            durationMs: result.durationMs,
            toolCallsCount: result.toolCallsCount,
            sourcesCount: (result.sources || detectedSources).length,
          });
        } catch (err: any) {
          await aiRunsService.updateRun(run.id, {
            status: 'FAILED',
            error_message: err.message || 'Erro no processamento da IA',
            completed_at: new Date().toISOString(),
          });

          // Save error metadata on Assistant Message
          await aiDbService.saveMessage({
            id: assistantMsgId,
            threadId,
            role: 'assistant',
            content: fullAssistantText || `⚠️ Erro no processamento da IA (${provider.toUpperCase()}): ${err.message}`,
            createdAt: new Date().toISOString(),
            metadata: {
              provider,
              mode,
              status: 'ERROR',
              error: err.message,
            },
          });

          await sendEvent('error', { runId: run.id, error: err.message || 'Erro no processamento da IA' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno no AI Intelligence' }, { status: 500 });
  }
}
