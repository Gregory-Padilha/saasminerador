import { z } from 'zod';

export const ScaleTierEnum = z.enum(['NORMAL', 'SCALING', 'HIGH_SCALE', 'FULL_SCALE']);

export const SearchOffersSchema = z.object({
  query: z.string().optional(),
  niche: z.array(z.string()).optional(),
  subniche: z.array(z.string()).optional(),
  productType: z.array(z.string()).optional(),
  minAds: z.number().optional(),
  maxAds: z.number().optional(),
  minDays: z.number().optional(),
  maxDays: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  scaleTier: z.array(ScaleTierEnum).optional(),
  faceless: z.boolean().optional(),
  hasLandingPage: z.boolean().optional(),
  landingPageMapped: z.boolean().optional(),
  hasCheckout: z.boolean().optional(),
  checkoutMapped: z.boolean().optional(),
  favorite: z.boolean().optional(),
  deepDive: z.boolean().optional(),
  source: z.array(z.string()).optional(),
  sort: z.enum([
    'created_at',
    'last_imported_at',
    'score',
    'system_score',
    'price',
    'active_ads_count',
    'days_running',
    'product_name',
  ]).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const GetOfferSchema = z.object({
  offerId: z.string().min(1, 'offerId é obrigatório'),
  include: z.array(z.enum([
    'overview',
    'advertiser',
    'pricing',
    'creativeSummary',
    'landingPage',
    'checkout',
    'copy',
    'audience',
    'history',
    'deepDive',
    'mappingStatus',
  ])).optional(),
});

export const GetOfferContextSchema = z.object({
  offerId: z.string().min(1, 'offerId é obrigatório'),
  depth: z.enum(['summary', 'standard', 'deep']).default('standard'),
});

export const GetOffersContextSchema = z.object({
  offerIds: z.array(z.string()).min(1, 'Pelo menos um offerId é necessário').max(15, 'Máximo 15 ofertas por chamada batch'),
  depth: z.enum(['summary', 'standard', 'deep']).default('standard'),
});

export const ListCreativesSchema = z.object({
  offerId: z.string().min(1, 'offerId é obrigatório'),
  type: z.enum(['video', 'image', 'all']).default('all'),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const GetCreativeSchema = z.object({
  creativeId: z.string().min(1, 'creativeId é obrigatório'),
});

export const GetLandingPageAnalysisSchema = z.object({
  offerId: z.string().min(1, 'offerId é obrigatório'),
  includeSections: z.boolean().default(true),
  includePricing: z.boolean().default(true),
  includeCopy: z.boolean().default(true),
  includeLinks: z.boolean().default(false),
});

export const GetCheckoutAnalysisSchema = z.object({
  offerId: z.string().min(1, 'offerId é obrigatório'),
});

export const CompareOffersSchema = z.object({
  offerIds: z.array(z.string()).min(1).max(3, 'O comparador MCP aceita no máximo 3 ofertas por requisição'),
});

export const GetDashboardStatsSchema = z.object({});

export const GetMappingStatusSchema = z.object({
  offerId: z.string().optional(),
});

export const SearchDeepDivesSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['BACKLOG', 'EM_ANALISE', 'SINTETIZANDO', 'CONCLUIDO', 'ARQUIVADO']).optional(),
  priority: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const GetDeepDiveSchema = z.object({
  deepDiveId: z.string().optional(),
  offerId: z.string().optional(),
}).refine((data) => data.deepDiveId || data.offerId, {
  message: 'Forneça pelo menos deepDiveId ou offerId',
});

export const SearchInsightsSchema = z.object({
  query: z.string().optional(),
  category: z.enum([
    'Criativo',
    'Copy',
    'Oferta',
    'Landing Page',
    'Checkout',
    'Pricing',
    'Order Bump',
    'Público',
    'Escala',
    'Produto',
  ]).optional(),
  tags: z.array(z.string()).optional(),
  niche: z.string().optional(),
  offerId: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export const SearchPatternsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  niche: z.string().optional(),
});

export const GetOfferHistorySchema = z.object({
  offerId: z.string().min(1, 'offerId é obrigatório'),
});

export const SearchKnowledgeSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  knowledge_type: z.string().optional(),
  trust_status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(6),
});

export const GetKnowledgeDocumentSchema = z.object({
  documentId: z.string().min(1, 'documentId é obrigatório'),
});

export const ListKnowledgeDocumentsSchema = z.object({
  category: z.string().optional(),
  knowledge_type: z.string().optional(),
  trust_status: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

