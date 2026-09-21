import { AIThread, AIMessage, AIToolCallRecord, AIUsageRecord } from './types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// In-memory fallback store
const inMemoryThreads: Map<string, AIThread> = new Map();
const inMemoryMessages: Map<string, AIMessage[]> = new Map();
const inMemoryToolCalls: Map<string, AIToolCallRecord[]> = new Map();
const inMemoryUsage: AIUsageRecord[] = [];

export const aiDbService = {
  // --- THREADS ---
  async getThreads(): Promise<AIThread[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('ai_threads')
          .select('*')
          .order('updated_at', { ascending: false });

        if (!error && data) {
          return data.map((t: any) => ({
            id: t.id,
            title: t.title,
            provider: t.provider || 'gemini',
            model: t.model || 'gemini-2.5-flash',
            mode: t.mode || 'quick',
            pinned: Boolean(t.pinned),
            archived: Boolean(t.archived),
            attachedOfferIds: t.attached_offer_ids || [],
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            lastMessageSnippet: t.last_message_snippet,
          }));
        }
      } catch (err) {
        console.warn('Supabase ai_threads fetch error, falling back to local memory:', err);
      }
    }

    return Array.from(inMemoryThreads.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getThreadById(id: string): Promise<AIThread | null> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('ai_threads')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            title: data.title,
            provider: data.provider || 'gemini',
            model: data.model || 'gemini-2.5-flash',
            mode: data.mode || 'quick',
            pinned: Boolean(data.pinned),
            archived: Boolean(data.archived),
            attachedOfferIds: data.attached_offer_ids || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            lastMessageSnippet: data.last_message_snippet,
          };
        }
      } catch {
        // Fallthrough to inMemory
      }
    }

    return inMemoryThreads.get(id) || null;
  },

  async saveThread(thread: AIThread): Promise<AIThread> {
    inMemoryThreads.set(thread.id, thread);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_threads').upsert({
          id: thread.id,
          title: thread.title,
          provider: thread.provider,
          model: thread.model,
          mode: thread.mode,
          pinned: thread.pinned,
          archived: thread.archived,
          attached_offer_ids: thread.attachedOfferIds,
          created_at: thread.createdAt,
          updated_at: thread.updatedAt,
          last_message_snippet: thread.lastMessageSnippet,
        });
      } catch (err) {
        console.warn('Failed to upsert thread into Supabase:', err);
      }
    }

    return thread;
  },

  async deleteThread(id: string): Promise<boolean> {
    inMemoryThreads.delete(id);
    inMemoryMessages.delete(id);
    inMemoryToolCalls.delete(id);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_threads').delete().eq('id', id);
      } catch (err) {
        console.warn('Failed to delete thread from Supabase:', err);
      }
    }

    return true;
  },

  // --- MESSAGES ---
  async getMessages(threadId: string): Promise<AIMessage[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('ai_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((m: any) => ({
            id: m.id,
            threadId: m.thread_id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
            metadata: m.metadata || {},
          }));
        }
      } catch (err) {
        console.warn('Supabase ai_messages fetch error, falling back to local memory:', err);
      }
    }

    return inMemoryMessages.get(threadId) || [];
  },

  async saveMessage(message: AIMessage): Promise<AIMessage> {
    const list = inMemoryMessages.get(message.threadId) || [];
    list.push(message);
    inMemoryMessages.set(message.threadId, list);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_messages').insert({
          id: message.id,
          thread_id: message.threadId,
          role: message.role,
          content: message.content,
          created_at: message.createdAt,
          metadata: message.metadata,
        });
      } catch (err) {
        console.warn('Failed to save message to Supabase:', err);
      }
    }

    return message;
  },

  // --- TOOL CALLS ---
  async saveToolCall(call: AIToolCallRecord): Promise<void> {
    const list = inMemoryToolCalls.get(call.threadId) || [];
    list.push(call);
    inMemoryToolCalls.set(call.threadId, list);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_tool_calls').insert({
          id: call.id,
          thread_id: call.threadId,
          message_id: call.messageId,
          tool_name: call.toolName,
          arguments: call.arguments,
          status: call.status,
          duration_ms: call.durationMs,
          result_summary: call.resultSummary,
          created_at: call.createdAt,
        });
      } catch (err) {
        console.warn('Failed to save tool call to Supabase:', err);
      }
    }
  },

  async getToolCalls(threadId: string): Promise<AIToolCallRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('ai_tool_calls')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((c: any) => ({
            id: c.id,
            threadId: c.thread_id,
            messageId: c.message_id,
            toolName: c.tool_name,
            arguments: c.arguments || {},
            status: c.status,
            durationMs: c.duration_ms,
            resultSummary: c.result_summary,
            createdAt: c.created_at,
          }));
        }
      } catch {
        // Fallback
      }
    }

    return inMemoryToolCalls.get(threadId) || [];
  },

  // --- USAGE ---
  async saveUsage(record: AIUsageRecord): Promise<void> {
    inMemoryUsage.push(record);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_usage').insert({
          id: record.id,
          thread_id: record.threadId,
          provider: record.provider,
          model: record.model,
          prompt_tokens: record.promptTokens,
          completion_tokens: record.completionTokens,
          total_tokens: record.totalTokens,
          tool_calls_count: record.toolCallsCount,
          duration_ms: record.durationMs,
          created_at: record.createdAt,
        });
      } catch (err) {
        console.warn('Failed to save usage record to Supabase:', err);
      }
    }
  },
};
