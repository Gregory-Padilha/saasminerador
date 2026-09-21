import { AgentLevel } from './roles/registry';

export type OfficeProfileId = 'openai_balanced' | 'anthropic_office' | 'gemini_economy';

export interface OfficeProfileMeta {
  id: OfficeProfileId;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  description: string;
  specialistModel: string;
  headModel: string;
  directorModel: string;
}

export const OFFICE_PROFILES: Record<OfficeProfileId, OfficeProfileMeta> = {
  openai_balanced: {
    id: 'openai_balanced',
    name: 'OpenAI Balanced',
    provider: 'openai',
    description: 'Equilíbrio ideal com Luna para especialistas, Terra para Heads e Sol para a síntese final do Diretor.',
    specialistModel: 'gpt-4o-mini', // mapped alias for specialist execution
    headModel: 'gpt-4o',           // mapped alias for head execution
    directorModel: 'gpt-4o',       // mapped alias for director execution
  },
  anthropic_office: {
    id: 'anthropic_office',
    name: 'Anthropic Office',
    provider: 'anthropic',
    description: 'Claude 3.5 Haiku para pesquisas de especialista e Claude 3.5 Sonnet para liderança estratégica.',
    specialistModel: 'claude-3-5-haiku-20241022',
    headModel: 'claude-3-5-sonnet-20241022',
    directorModel: 'claude-3-5-sonnet-20241022',
  },
  gemini_economy: {
    id: 'gemini_economy',
    name: 'Gemini Economy',
    provider: 'gemini',
    description: 'Gemini 2.5 Flash de altíssima eficiência para especialistas e 1.5 Pro para tomada de decisão.',
    specialistModel: 'gemini-2.5-flash',
    headModel: 'gemini-1.5-pro',
    directorModel: 'gemini-1.5-pro',
  },
};

export function getOfficeModelForRole(
  profileId: OfficeProfileId,
  level: AgentLevel,
  depth?: 'ECONOMICO' | 'BALANCEADO' | 'PROFUNDO',
  roleId?: string
): { provider: 'openai' | 'anthropic' | 'gemini'; model: string } {
  const profile = OFFICE_PROFILES[profileId] || OFFICE_PROFILES.openai_balanced;

  const strategicRoles = [
    'audience-positioning-researcher',
    'offer-dna-analyst',
    'product-mechanism-architect',
    'pricing-monetization-strategist',
    'creative-strategist',
    'copy-lp-strategist',
  ];

  let model = profile.specialistModel;

  if (level === 'head' || (depth === 'PROFUNDO' && roleId && strategicRoles.includes(roleId))) {
    model = profile.headModel;
  }
  if (level === 'director') {
    model = profile.directorModel;
  }

  return {
    provider: profile.provider,
    model,
  };
}
