import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import fs from 'fs';
import path from 'path';

export type AIRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AIRunRecord {
  id: string;
  thread_id: string;
  user_message_id?: string;
  assistant_message_id?: string;
  provider: string;
  model: string;
  mode: string;
  status: AIRunStatus;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  brain_version: string;
}

export interface AIRunEventRecord {
  id: string;
  run_id: string;
  sequence: number;
  type: 'text_delta' | 'tool_start' | 'tool_progress' | 'tool_result' | 'source_added' | 'status' | 'complete' | 'error';
  payload: any;
  created_at: string;
}

const RUNS_DIR = path.join(process.cwd(), 'scratch', 'runs');
const RUNS_FILE = path.join(RUNS_DIR, 'runs.json');
const EVENTS_FILE = path.join(RUNS_DIR, 'events.json');

function ensureRunsStorage() {
  if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
  }
  if (!fs.existsSync(RUNS_FILE)) {
    fs.writeFileSync(RUNS_FILE, JSON.stringify([]), 'utf-8');
  }
  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify([]), 'utf-8');
  }
}

function getLocalRuns(): AIRunRecord[] {
  ensureRunsStorage();
  try {
    const raw = fs.readFileSync(RUNS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalRuns(runs: AIRunRecord[]) {
  ensureRunsStorage();
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), 'utf-8');
}

function getLocalEvents(): AIRunEventRecord[] {
  ensureRunsStorage();
  try {
    const raw = fs.readFileSync(EVENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalEvents(events: AIRunEventRecord[]) {
  ensureRunsStorage();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

export class AIRunsService {
  async createRun(params: {
    threadId: string;
    userMessageId?: string;
    assistantMessageId?: string;
    provider: string;
    model: string;
    mode: string;
    brainVersion?: string;
  }): Promise<AIRunRecord> {
    const run: AIRunRecord = {
      id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      thread_id: params.threadId,
      user_message_id: params.userMessageId,
      assistant_message_id: params.assistantMessageId,
      provider: params.provider,
      model: params.model,
      mode: params.mode,
      status: 'RUNNING',
      started_at: new Date().toISOString(),
      brain_version: params.brainVersion || 'OM-BRAIN-2.0',
    };

    const runs = getLocalRuns();
    runs.unshift(run);
    saveLocalRuns(runs);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_runs').insert(run);
      } catch (err) {
        console.warn('Supabase createRun warning:', err);
      }
    }

    return run;
  }

  async updateRun(
    runId: string,
    updates: Partial<Omit<AIRunRecord, 'id'>>
  ): Promise<AIRunRecord | null> {
    const runs = getLocalRuns();
    const idx = runs.findIndex((r) => r.id === runId);
    let updated: AIRunRecord | null = null;
    if (idx >= 0) {
      runs[idx] = { ...runs[idx], ...updates };
      updated = runs[idx];
      saveLocalRuns(runs);
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_runs').update(updates).eq('id', runId);
      } catch (err) {
        console.warn('Supabase updateRun warning:', err);
      }
    }

    return updated;
  }

  async recordEvent(
    runId: string,
    type: AIRunEventRecord['type'],
    payload: any
  ): Promise<AIRunEventRecord> {
    const events = getLocalEvents();
    const runEvents = events.filter((e) => e.run_id === runId);
    const nextSeq = runEvents.length + 1;

    const eventRecord: AIRunEventRecord = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      run_id: runId,
      sequence: nextSeq,
      type,
      payload,
      created_at: new Date().toISOString(),
    };

    events.push(eventRecord);
    saveLocalEvents(events);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ai_run_events').insert(eventRecord);
      } catch (err) {
        // Silently handle if table not present in legacy env
      }
    }

    return eventRecord;
  }

  async getEventsForRun(runId: string, sinceSequence = 0): Promise<AIRunEventRecord[]> {
    const events = getLocalEvents();
    return events
      .filter((e) => e.run_id === runId && e.sequence > sinceSequence)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async getRunById(runId: string): Promise<AIRunRecord | null> {
    const runs = getLocalRuns();
    return runs.find((r) => r.id === runId) || null;
  }

  async getLatestRunForThread(threadId: string): Promise<AIRunRecord | null> {
    const runs = getLocalRuns();
    return runs.find((r) => r.thread_id === threadId) || null;
  }
}

export const aiRunsService = new AIRunsService();
