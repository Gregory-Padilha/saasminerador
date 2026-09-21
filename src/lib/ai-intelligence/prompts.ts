import { buildOfferBrainSystemPrompt, BrainSystemPromptParams } from '@/lib/ai-brain';

/**
 * Dynamically builds the Offer Intelligence Brain system prompt
 */
export function getOfferBrainSystemPrompt(params?: BrainSystemPromptParams): string {
  return buildOfferBrainSystemPrompt(params);
}

/**
 * Versioned System Prompt Fallback for Offer Miner AI Intelligence Analyst
 * Version: offer-miner-analyst-v2
 */
export const SYSTEM_PROMPT_ANALYST_V1 = buildOfferBrainSystemPrompt();

