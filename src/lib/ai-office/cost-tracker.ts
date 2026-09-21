export interface AgentRunCostRecord {
  agentRole: string;
  department: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  toolCallsCount: number;
  durationMs: number;
  estimatedCostUsd: number;
  timestamp: string;
}

export interface MissionCostSummary {
  missionId: string;
  profileId: string;
  totalLlmCalls: number;
  maxLlmCallsCeiling: number; // default 20
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCostUsd: number;
  agentRunRecords: AgentRunCostRecord[];
}

// Pricing table (USD per 1M tokens)
const PRICING_TABLE: Record<string, { input: number; output: number; cachedInput?: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60, cachedInput: 0.075 },
  'gpt-4o': { input: 2.50, output: 10.00, cachedInput: 1.25 },
  'claude-3-5-haiku-20241022': { input: 1.00, output: 5.00, cachedInput: 0.10 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, cachedInput: 0.30 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30, cachedInput: 0.01875 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00, cachedInput: 0.3125 },
};

export function calculateCallCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0
): number {
  const rates = PRICING_TABLE[model] || { input: 1.0, output: 4.0, cachedInput: 0.5 };
  const uncachedInput = Math.max(0, inputTokens - cachedInputTokens);
  
  const uncachedCost = (uncachedInput / 1_000_000) * rates.input;
  const cachedCost = (cachedInputTokens / 1_000_000) * (rates.cachedInput || rates.input * 0.5);
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return Number((uncachedCost + cachedCost + outputCost).toFixed(6));
}

export function createMissionCostTracker(missionId: string, profileId: string): MissionCostSummary {
  return {
    missionId,
    profileId,
    totalLlmCalls: 0,
    maxLlmCallsCeiling: 20,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCostUsd: 0,
    agentRunRecords: [],
  };
}

export function recordAgentRunInCostTracker(
  tracker: MissionCostSummary,
  record: Omit<AgentRunCostRecord, 'estimatedCostUsd' | 'timestamp'>
): MissionCostSummary {
  const cost = calculateCallCostUsd(
    record.model,
    record.inputTokens,
    record.outputTokens,
    record.cachedInputTokens || 0
  );

  const fullRecord: AgentRunCostRecord = {
    ...record,
    estimatedCostUsd: cost,
    timestamp: new Date().toISOString(),
  };

  return {
    ...tracker,
    totalLlmCalls: tracker.totalLlmCalls + 1,
    totalInputTokens: tracker.totalInputTokens + record.inputTokens,
    totalOutputTokens: tracker.totalOutputTokens + record.outputTokens,
    totalCachedTokens: tracker.totalCachedTokens + (record.cachedInputTokens || 0),
    totalCostUsd: Number((tracker.totalCostUsd + cost).toFixed(6)),
    agentRunRecords: [...tracker.agentRunRecords, fullRecord],
  };
}
