import { OfficeMissionBrief } from './mission-brief';

export type TransformationDimension =
  | 'AUDIENCE'
  | 'MARKET'
  | 'POSITIONING'
  | 'ANGLE'
  | 'HOOK'
  | 'PROMISE'
  | 'MECHANISM'
  | 'PRODUCT'
  | 'FORMAT'
  | 'DELIVERABLES'
  | 'PRICE'
  | 'MONETIZATION'
  | 'CREATIVE_SYSTEM'
  | 'LP_ARCHITECTURE';

export interface MissionContract {
  missionId: string;
  missionType: 'CREATE_FROM_ZERO' | 'MODEL_EXISTING_OFFER';
  objective: string;
  primaryOfferId?: string;
  referenceOfferIds: string[];
  searchWholeCatalog: boolean;
  targetMarket: 'Brasil' | 'Estados Unidos' | 'Espanhol' | 'Outro';
  targetCurrency: 'BRL' | 'USD' | 'EUR';
  nicheDirection?: string;
  subniche?: string;
  avoidedNiches: string[];
  audienceDirection?: string;
  allowAudienceDiscovery: boolean;
  facelessPreference: 'Obrigatório' | 'Preferível' | 'Indiferente';
  preferredFormats: string[];
  excludedFormats: string[];
  productionComplexity: 'Baixa' | 'Média' | 'Indiferente';
  ticketOption: string;
  ticketMin?: number;
  ticketMax?: number;
  monetizationPreferences: string[];
  priorities: string[];
  constraints?: string;
  depth: 'ECONOMICO' | 'BALANCEADO' | 'PROFUNDO';
}

export interface CandidateOfferFinding {
  offerId?: string;
  title?: string;
  niche?: string;
  price?: string | number;
  adsCount?: number;
  summary?: string;
  confidence?: 'ALTA' | 'MÉDIA' | 'BAIXA';
}

export interface StructuredFinding {
  title: string;
  summary?: string;
  category?: string;
  details?: Record<string, any>;
  candidates?: CandidateOfferFinding[];
}

export function normalizeOfficeFinding(value: any): StructuredFinding | null {
  if (!value || typeof value !== 'object') return null;
  if (value.title || value.summary) {
    return {
      title: value.title || 'Achado Estruturado',
      summary: value.summary || '',
      category: value.category,
      details: value.details,
      candidates: value.candidates,
    };
  }
  return null;
}

export interface ModelingTransformationContract {
  sourceOfferId: string;
  maximumChanges: number;
  allowedDimensions: TransformationDimension[];
  lockedDimensions: TransformationDimension[];
  explicitInstructions: string;
  preserveUnchangedDimensions: boolean;
}

export type TransformationStatusType =
  | 'MANDATORY_NEW'
  | 'PRESERVED'
  | 'STRATEGIC_CHANGE'
  | 'LOCALIZED'
  | 'ADAPTED'
  | 'LOCKED';

export interface DimensionState {
  dimension: string;
  label: string;
  status: TransformationStatusType;
  originalValue: string;
  newValue: string;
  why?: string;
  evidence?: string;
  impact?: string;
  rationale?: string;
}

export interface TransformationMatrix {
  sourceOfferId: string;
  maximumChangesAllowed: number;
  changesUsedCount: number;
  identityChangesCount?: number;
  localizationAdaptationsCount?: number;
  isBudgetValid: boolean;
  dimensions: DimensionState[];
}

export function buildMissionContract(missionId: string, brief: OfficeMissionBrief): MissionContract {
  const marketCurrencyMap: Record<string, 'BRL' | 'USD' | 'EUR'> = {
    Brasil: 'BRL',
    'Estados Unidos': 'USD',
    Espanhol: 'USD',
    Outro: 'USD',
  };

  const depthMap: Record<string, 'ECONOMICO' | 'BALANCEADO' | 'PROFUNDO'> = {
    ECONOMICO: 'ECONOMICO',
    BALANCEADO: 'BALANCEADO',
    PROFUNDO: 'PROFUNDO',
  };

  const marketInput = (brief as any).targetMarket || brief.market || 'Brasil';
  const currencyInput = (brief as any).targetCurrency || marketCurrencyMap[marketInput] || 'BRL';

  return {
    missionId,
    missionType: brief.missionType,
    objective: brief.objective,
    primaryOfferId: brief.primaryOfferId,
    referenceOfferIds: brief.referenceOfferIds || [],
    searchWholeCatalog: brief.searchWholeCatalog ?? true,
    targetMarket: marketInput as any,
    targetCurrency: currencyInput as any,
    nicheDirection: brief.niche,
    avoidedNiches: brief.avoidedNiches || [],
    audienceDirection: brief.audienceDirection,
    allowAudienceDiscovery: brief.allowAudienceDiscovery ?? true,
    facelessPreference: brief.facelessPreference || 'Preferível',
    preferredFormats: brief.preferredFormats || [],
    excludedFormats: brief.excludedFormats || [],
    productionComplexity: brief.productionComplexity || 'Baixa',
    ticketOption: brief.ticketOption || 'R$20–30',
    ticketMin: brief.ticketMin,
    ticketMax: brief.ticketMax,
    monetizationPreferences: brief.monetizationPreferences || [],
    priorities: brief.priorities || [],
    constraints: brief.constraints,
    depth: depthMap[brief.budgetProfile] || 'BALANCEADO',
  };
}

export function buildTransformationContract(
  brief: OfficeMissionBrief,
  customMaxChanges?: number
): ModelingTransformationContract | null {
  if (brief.missionType !== 'MODEL_EXISTING_OFFER' || !brief.primaryOfferId) {
    return null;
  }

  // Parse objective string for explicit change limits (e.g. "trocando 2 coisas no máximo")
  let maxChanges = customMaxChanges || 2;
  const match = brief.objective.match(/(\d+)\s*(coisas|mudanças|alterações|itens)/i);
  if (match && match[1]) {
    maxChanges = parseInt(match[1], 10);
  }

  const allowed: TransformationDimension[] = [];
  const objLower = brief.objective.toLowerCase();

  if (brief.market !== 'Brasil' || objLower.includes('mercado') || objLower.includes('país') || objLower.includes('eua')) {
    allowed.push('MARKET');
  }
  if (objLower.includes('público') || objLower.includes('audiência') || objLower.includes('avatar')) {
    allowed.push('AUDIENCE');
  }
  if (objLower.includes('posicionamento') || objLower.includes('ângulo')) {
    allowed.push('POSITIONING');
  }

  if (allowed.length === 0) {
    allowed.push('MARKET', 'POSITIONING');
  }

  const cappedAllowed = allowed.slice(0, maxChanges);

  const allDimensions: TransformationDimension[] = [
    'MARKET',
    'AUDIENCE',
    'POSITIONING',
    'ANGLE',
    'HOOK',
    'PROMISE',
    'MECHANISM',
    'PRODUCT',
    'FORMAT',
    'DELIVERABLES',
    'PRICE',
    'MONETIZATION',
    'CREATIVE_SYSTEM',
    'LP_ARCHITECTURE',
  ];

  const locked = allDimensions.filter((d) => !cappedAllowed.includes(d));

  return {
    sourceOfferId: brief.primaryOfferId,
    maximumChanges: maxChanges,
    allowedDimensions: cappedAllowed,
    lockedDimensions: locked,
    explicitInstructions: brief.objective,
    preserveUnchangedDimensions: true,
  };
}
