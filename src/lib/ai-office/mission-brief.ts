import { z } from 'zod';

export const OfficeMissionBriefSchema = z.object({
  missionType: z.enum(['CREATE_FROM_ZERO', 'MODEL_EXISTING_OFFER']),
  missionName: z.string().optional(),
  objective: z.string().min(1, 'O objetivo da missão é obrigatório.'),

  primaryOfferId: z.string().optional(),
  referenceOfferIds: z.array(z.string()).default([]),
  searchWholeCatalog: z.boolean().default(true),

  market: z.enum(['Brasil', 'Estados Unidos', 'Espanhol', 'Outro']).default('Brasil'),
  niche: z.string().optional(),
  avoidedNiches: z.array(z.string()).default([]),

  audienceDirection: z.string().optional(),
  allowAudienceDiscovery: z.boolean().default(true),

  facelessPreference: z.enum(['Obrigatório', 'Preferível', 'Indiferente']).default('Preferível'),

  preferredFormats: z.array(z.string()).default([]),
  excludedFormats: z.array(z.string()).default([]),

  productionComplexity: z.enum(['Baixa', 'Média', 'Indiferente']).default('Baixa'),

  ticketOption: z.enum(['Até R$20', 'R$20–30', 'R$30–50', 'R$50+', 'Definir faixa', 'Indiferente']).default('R$20–30'),
  ticketMin: z.number().optional(),
  ticketMax: z.number().optional(),

  monetizationPreferences: z.array(z.string()).default([]),

  priorities: z.array(z.string()).max(3, 'Selecione no máximo 3 prioridades.').default([]),

  constraints: z.string().optional(),

  budgetProfile: z.enum(['ECONOMICO', 'BALANCEADO', 'PROFUNDO']).default('BALANCEADO'),
});

export type OfficeMissionBrief = z.infer<typeof OfficeMissionBriefSchema>;

export const DEFAULT_MISSION_BRIEF: OfficeMissionBrief = {
  missionType: 'CREATE_FROM_ZERO',
  missionName: '',
  objective: '',

  primaryOfferId: undefined,
  referenceOfferIds: [],
  searchWholeCatalog: true,

  market: 'Brasil',
  niche: '',
  avoidedNiches: [],

  audienceDirection: '',
  allowAudienceDiscovery: true,

  facelessPreference: 'Preferível',

  preferredFormats: [],
  excludedFormats: [],

  productionComplexity: 'Baixa',

  ticketOption: 'R$20–30',
  ticketMin: undefined,
  ticketMax: undefined,

  monetizationPreferences: ['Pode usar order bumps'],

  priorities: ['Evidência de mercado', 'Rapidez para colocar no mercado'],

  constraints: '',

  budgetProfile: 'BALANCEADO',
};

export interface MissionPreset {
  id: string;
  title: string;
  description: string;
  briefPatch: Partial<OfficeMissionBrief>;
}

export const MISSION_PRESETS: MissionPreset[] = [
  {
    id: 'lancar_rapido',
    title: 'LANÇAR RÁPIDO',
    description: 'Foco em produção simples, facilidade de teste e criativos rápidos.',
    briefPatch: {
      facelessPreference: 'Preferível',
      productionComplexity: 'Baixa',
      priorities: ['Rapidez para colocar no mercado', 'Facilidade de produção', 'Facilidade de demonstrar em criativo'],
      preferredFormats: ['PDF / Ebook', 'Templates', 'Cards'],
    },
  },
  {
    id: 'cacar_oportunidade',
    title: 'CAÇAR OPORTUNIDADE',
    description: 'Explora todo o mercado sem nicho fixo buscando teses escaláveis.',
    briefPatch: {
      niche: '',
      searchWholeCatalog: true,
      priorities: ['Evidência de mercado', 'Potencial de diferenciação', 'Baixa complexidade operacional'],
      budgetProfile: 'BALANCEADO',
    },
  },
  {
    id: 'modelar_big_offer',
    title: 'MODELAR BIG OFFER',
    description: 'Desmonta uma oferta validada e cria uma nova tese sobre sua estrutura commercial.',
    briefPatch: {
      missionType: 'MODEL_EXISTING_OFFER',
      priorities: ['Evidência de mercado', 'Monetização / AOV', 'Facilidade de demonstrar em criativo'],
      budgetProfile: 'PROFUNDO',
    },
  },
  {
    id: 'adaptar_eua',
    title: 'ADAPTAR PARA EUA',
    description: 'Foco em transpor e adaptar mecânicas brasileiras para o mercado americano.',
    briefPatch: {
      market: 'Estados Unidos',
      priorities: ['Possibilidade de adaptação internacional', 'Potencial de diferenciação', 'Facilidade de demonstrar em criativo'],
      ticketOption: 'R$50+',
    },
  },
];

export function validateMissionBrief(step: number, brief: OfficeMissionBrief): { valid: boolean; error?: string } {
  if (step >= 1) {
    if (!brief.objective || !brief.objective.trim()) {
      return { valid: false, error: 'Por favor, informe o objetivo da missão na Etapa 1.' };
    }
  }

  if (step >= 2) {
    if (brief.missionType === 'MODEL_EXISTING_OFFER') {
      if (!brief.primaryOfferId) {
        return { valid: false, error: 'Na modelagem de oferta existente, é OBRIGATÓRIO selecionar a Oferta Principal.' };
      }
    }
  }

  if (step >= 3) {
    if (brief.priorities.length > 3) {
      return { valid: false, error: 'Escolha no máximo 3 prioridades para a missão.' };
    }
  }

  return { valid: true };
}
