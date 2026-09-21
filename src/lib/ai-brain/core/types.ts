export type StrategicIntent =
  | 'DISCOVER'
  | 'MODEL'
  | 'ANALYZE'
  | 'COMPARE'
  | 'DIAGNOSE'
  | 'EXPLORE_NICHE'
  | 'RESEARCH_CREATIVE'
  | 'RESEARCH_MONETIZATION'
  | 'GENERAL';

export interface WorkingContextState {
  activeOfferIds: string[];
  activeNiche?: string;
  activeDeepDiveIds?: string[];
  lastIntent?: StrategicIntent;
}

export interface BrainSystemPromptParams {
  intent?: StrategicIntent;
  attachedOfferIds?: string[];
  messages?: Array<{ role: string; content: string }>;
  workingContext?: WorkingContextState;
}
