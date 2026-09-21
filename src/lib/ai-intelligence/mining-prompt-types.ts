import { z } from 'zod';

export interface MiningPromptConfig {
  id?: string;
  name: string;
  targetOffers: number;
  country: string;
  language: string;
  platform: string;

  // Section B: Niche
  nicheMode: 'ANY_NICHE' | 'SPECIFIC_NICHE';
  niche?: string;
  subniche?: string;
  keywords: string[];
  excludeKeywords: string[];
  allowAdjacentNiches: boolean;

  // Section C: Product Type
  digitalOnly: boolean;
  facelessPreference: 'Required' | 'Preferred' | 'Any';
  allowedFormats: string[];
  excludedFormats: string[];
  expertPresence: 'Allow' | 'Disallow' | 'Any';

  // Section D: Price
  minFrontPrice?: number;
  maxFrontPrice?: number;
  unknownPriceAction: 'Reject' | 'Allow';

  // Section E: Meta Ads
  minActiveAds?: number;
  maxActiveAds?: number;
  minDaysActive?: number;
  maxDaysActive?: number;
  minUniqueCreatives?: number;
  maxUniqueCreatives?: number;
  minAdVariations?: number;
  requireActiveAds: boolean;

  // Section F: Funnel
  requireLandingPage: boolean;
  requireCheckout: boolean;
  requirePriceVisible: boolean;
  requireProductIdentifiable: boolean;
  requireMetaAdsLink: boolean;
  requireDestinationUrl: boolean;

  // Section G: Validation
  validationStrictness: 'FAST' | 'STANDARD' | 'STRICT';

  // Section H: Token Economy
  tokenEconomyMode: 'ULTRA_FAST' | 'BALANCED' | 'DEEP';

  // Section I: Deduplication
  excludeMinedOffers: boolean;
  dedupeSignals: string[];

  // Section J: Output
  outputFormat: 'XLSX' | 'CSV' | 'JSON' | 'MARKDOWN';
  filename?: string;
  outputFields: string[];

  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_OUTPUT_FIELDS: string[] = [
  'offer_name',
  'advertiser',
  'niche',
  'subniche',
  'active_ads_count',
  'unique_creatives_count',
  'days_active',
  'first_seen',
  'last_seen',
  'front_price',
  'currency',
  'meta_ads_url',
  'meta_page_id',
  'landing_page_url',
  'checkout_url',
  'product_format',
  'faceless',
  'notes',
];

export const DEFAULT_MINING_CONFIG: MiningPromptConfig = {
  name: 'Nova Mineração de Ofertas',
  targetOffers: 15,
  country: 'Brasil',
  language: 'Português',
  platform: 'Meta Ads Library',

  nicheMode: 'ANY_NICHE',
  niche: '',
  subniche: '',
  keywords: [],
  excludeKeywords: [],
  allowAdjacentNiches: true,

  digitalOnly: true,
  facelessPreference: 'Preferred',
  allowedFormats: ['PDF', 'Ebook', 'Printable', 'Templates', 'Cards', 'Planilhas', 'Guias'],
  excludedFormats: ['Produto Físico', 'Curso de Expert', 'SaaS', 'Comunidade'],
  expertPresence: 'Disallow',

  minFrontPrice: 10,
  maxFrontPrice: 50,
  unknownPriceAction: 'Allow',

  minActiveAds: 5,
  maxActiveAds: 50,
  minDaysActive: 10,
  maxDaysActive: 60,
  minUniqueCreatives: 5,
  maxUniqueCreatives: 50,
  minAdVariations: undefined,
  requireActiveAds: true,

  requireLandingPage: true,
  requireCheckout: false,
  requirePriceVisible: false,
  requireProductIdentifiable: true,
  requireMetaAdsLink: true,
  requireDestinationUrl: true,

  validationStrictness: 'STANDARD',
  tokenEconomyMode: 'ULTRA_FAST',

  excludeMinedOffers: true,
  dedupeSignals: ['offerTitle', 'advertiser', 'domain', 'landingPageDomain', 'metaPageId'],

  outputFormat: 'XLSX',
  filename: '',
  outputFields: [...DEFAULT_OUTPUT_FIELDS],
};

export interface MiningPreset {
  id: string;
  name: string;
  description: string;
  configPatch: Partial<MiningPromptConfig>;
}

export const MINING_PRESETS: MiningPreset[] = [
  {
    id: 'low_ticket_validado',
    name: 'Low Ticket Validado',
    description: 'Digital, Faceless, Front R$10–50, 5–50 Ads ativos, 10–60 dias, rápido e desduplicado.',
    configPatch: {
      targetOffers: 15,
      digitalOnly: true,
      facelessPreference: 'Required',
      minFrontPrice: 10,
      maxFrontPrice: 50,
      minActiveAds: 5,
      maxActiveAds: 50,
      minDaysActive: 10,
      maxDaysActive: 60,
      minUniqueCreatives: 5,
      maxUniqueCreatives: 50,
      expertPresence: 'Disallow',
      validationStrictness: 'FAST',
      tokenEconomyMode: 'ULTRA_FAST',
      excludeMinedOffers: true,
      outputFormat: 'XLSX',
    },
  },
  {
    id: 'big_offers',
    name: 'Big Offers',
    description: 'Ofertas em escala alta: mínimo de 100 anúncios ativos, sem limite de dias.',
    configPatch: {
      targetOffers: 10,
      digitalOnly: true,
      minActiveAds: 100,
      maxActiveAds: undefined,
      minDaysActive: undefined,
      maxDaysActive: undefined,
      minFrontPrice: undefined,
      maxFrontPrice: undefined,
      validationStrictness: 'FAST',
      tokenEconomyMode: 'ULTRA_FAST',
      excludeMinedOffers: true,
      outputFormat: 'XLSX',
    },
  },
  {
    id: 'big_offers_extreme',
    name: 'Big Offers Extreme',
    description: 'Ofertas em escala extrema: mínimo de 200 anúncios ativos.',
    configPatch: {
      targetOffers: 5,
      digitalOnly: true,
      minActiveAds: 200,
      maxActiveAds: undefined,
      minDaysActive: undefined,
      maxDaysActive: undefined,
      validationStrictness: 'FAST',
      tokenEconomyMode: 'ULTRA_FAST',
      excludeMinedOffers: true,
      outputFormat: 'XLSX',
    },
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Começar com campos limpos para configuração livre.',
    configPatch: {
      nicheMode: 'ANY_NICHE',
      niche: '',
      subniche: '',
      keywords: [],
      excludeKeywords: [],
      minActiveAds: undefined,
      maxActiveAds: undefined,
      minDaysActive: undefined,
      maxDaysActive: undefined,
      minFrontPrice: undefined,
      maxFrontPrice: undefined,
    },
  },
];

export function validateMiningConfig(config: MiningPromptConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.name || !config.name.trim()) {
    errors.push('O nome da missão é obrigatório.');
  }

  if (config.targetOffers <= 0) {
    errors.push('A quantidade de ofertas deve ser maior que 0.');
  }

  // Contradiction checks
  if (
    config.minActiveAds !== undefined &&
    config.maxActiveAds !== undefined &&
    config.minActiveAds > config.maxActiveAds
  ) {
    errors.push(`Contradição: Anúncios ativos mínimos (${config.minActiveAds}) maior que máximo (${config.maxActiveAds}).`);
  }

  if (
    config.minDaysActive !== undefined &&
    config.maxDaysActive !== undefined &&
    config.minDaysActive > config.maxDaysActive
  ) {
    errors.push(`Contradição: Dias ativos mínimos (${config.minDaysActive}) maior que máximo (${config.maxDaysActive}).`);
  }

  if (
    config.minFrontPrice !== undefined &&
    config.maxFrontPrice !== undefined &&
    config.minFrontPrice > config.maxFrontPrice
  ) {
    errors.push(`Contradição: Preço mínimo (R$ ${config.minFrontPrice}) maior que preço máximo (R$ ${config.maxFrontPrice}).`);
  }

  if (
    config.minUniqueCreatives !== undefined &&
    config.maxUniqueCreatives !== undefined &&
    config.minUniqueCreatives > config.maxUniqueCreatives
  ) {
    errors.push(`Contradição: Criativos mínimos (${config.minUniqueCreatives}) maior que máximo (${config.maxUniqueCreatives}).`);
  }

  return { valid: errors.length === 0, errors };
}
