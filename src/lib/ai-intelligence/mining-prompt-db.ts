import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { MiningPromptConfig } from './mining-prompt-types';

export interface MiningPromptRecord {
  id: string;
  name: string;
  configJson: MiningPromptConfig;
  generatedPrompt: string;
  refinedPrompt?: string;
  model: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const memoryMiningPrompts: Map<string, MiningPromptRecord> = new Map();

export const miningPromptDbService = {
  async saveMiningPrompt(record: MiningPromptRecord): Promise<MiningPromptRecord> {
    const updated = { ...record, updatedAt: new Date().toISOString() };
    memoryMiningPrompts.set(updated.id, updated);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('mining_prompt_configs').upsert({
          id: updated.id,
          name: updated.name,
          config_json: updated.configJson,
          generated_prompt: updated.generatedPrompt,
          refined_prompt: updated.refinedPrompt,
          model: updated.model,
          version: updated.version,
          updated_at: updated.updatedAt,
        });
      } catch (err) {
        console.error('Supabase mining_prompt_configs save error:', err);
      }
    }

    return updated;
  },

  async getMiningPrompt(id: string): Promise<MiningPromptRecord | null> {
    if (memoryMiningPrompts.has(id)) {
      return memoryMiningPrompts.get(id)!;
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase.from('mining_prompt_configs').select('*').eq('id', id).single();
        if (data) {
          const rec: MiningPromptRecord = {
            id: data.id,
            name: data.name,
            configJson: data.config_json,
            generatedPrompt: data.generated_prompt,
            refinedPrompt: data.refined_prompt,
            model: data.model,
            version: data.version,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          memoryMiningPrompts.set(rec.id, rec);
          return rec;
        }
      } catch {}
    }

    return null;
  },

  async listMiningPrompts(): Promise<MiningPromptRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase
          .from('mining_prompt_configs')
          .select('*')
          .order('updated_at', { ascending: false });
        if (data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            name: d.name,
            configJson: d.config_json,
            generatedPrompt: d.generated_prompt,
            refinedPrompt: d.refined_prompt,
            model: d.model,
            version: d.version,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch {}
    }

    return Array.from(memoryMiningPrompts.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async deleteMiningPrompt(id: string): Promise<boolean> {
    memoryMiningPrompts.delete(id);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('mining_prompt_configs').delete().eq('id', id);
      } catch {}
    }

    return true;
  },
};
