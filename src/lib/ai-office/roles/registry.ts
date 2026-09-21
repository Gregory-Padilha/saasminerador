export type DepartmentId = 'market' | 'offer' | 'gtm' | 'executive';
export type AgentLevel = 'director' | 'head' | 'specialist';

export interface OfficeRoleDefinition {
  id: string;
  name: string;
  title: string;
  department: DepartmentId;
  level: AgentLevel;
  description: string;
  roleFile: string;
  defaultModelTier: 'specialist' | 'head' | 'director';
}

export const OFFICE_ROLES: Record<string, OfficeRoleDefinition> = {
  // Director
  'director': {
    id: 'director',
    name: 'Director of Offer Intelligence',
    title: 'Diretor de Inteligência de Ofertas',
    department: 'executive',
    level: 'director',
    description: 'Toma a decisão final, revisa contradições dos Heads e assina o Offer Project definitivo.',
    roleFile: 'director.md',
    defaultModelTier: 'director',
  },

  // Heads
  'head-market': {
    id: 'head-market',
    name: 'Head of Market & Validation',
    title: 'Head de Mercado & Validação',
    department: 'market',
    level: 'head',
    description: 'Valida se existe evidência suficiente de mercado antes de construir qualquer tese.',
    roleFile: 'head-market.md',
    defaultModelTier: 'head',
  },
  'head-offer': {
    id: 'head-offer',
    name: 'Head of Offer Architecture',
    title: 'Head de Arquitetura de Oferta',
    department: 'offer',
    level: 'head',
    description: 'Define qual oferta, produto e mecanismo realmente devem ser construídos.',
    roleFile: 'head-offer.md',
    defaultModelTier: 'head',
  },
  'head-gtm': {
    id: 'head-gtm',
    name: 'Head of Go-To-Market',
    title: 'Head de Go-To-Market',
    department: 'gtm',
    level: 'head',
    description: 'Estrutura a comunicação, criativos, Landing Page e monetização de checkout.',
    roleFile: 'head-gtm.md',
    defaultModelTier: 'head',
  },

  // Department 1: Market & Validation Specialists
  'market-signal-miner': {
    id: 'market-signal-miner',
    name: 'Market Signal Miner',
    title: 'Minerador de Sinais de Mercado',
    department: 'market',
    level: 'specialist',
    description: 'Mapeia volume de anúncios, longevidade, continuidade e sinais de escala no catálogo.',
    roleFile: 'market-signal-miner.md',
    defaultModelTier: 'specialist',
  },
  'audience-positioning-researcher': {
    id: 'audience-positioning-researcher',
    name: 'Audience & Positioning Researcher',
    title: 'Pesquisador de Público & Posicionamento',
    department: 'market',
    level: 'specialist',
    description: 'Mapeia públicos, dores, desejos, recortes demográficos e posicionamentos do setor.',
    roleFile: 'audience-positioning-researcher.md',
    defaultModelTier: 'specialist',
  },
  'evidence-auditor': {
    id: 'evidence-auditor',
    name: 'Evidence Auditor',
    title: 'Auditor de Evidências',
    department: 'market',
    level: 'specialist',
    description: 'Tenta refutar hipóteses fracas, aponta ausência de dados e inconsistências factuais.',
    roleFile: 'evidence-auditor.md',
    defaultModelTier: 'specialist',
  },

  // Department 2: Offer Architecture Specialists
  'offer-dna-analyst': {
    id: 'offer-dna-analyst',
    name: 'Offer DNA Analyst',
    title: 'Analista de DNA da Oferta',
    department: 'offer',
    level: 'specialist',
    description: 'Extrai o motor comercial e elementos transferíveis das ofertas de referência.',
    roleFile: 'offer-dna-analyst.md',
    defaultModelTier: 'specialist',
  },
  'product-mechanism-architect': {
    id: 'product-mechanism-architect',
    name: 'Product & Mechanism Architect',
    title: 'Arquiteto de Produto & Mecanismo',
    department: 'offer',
    level: 'specialist',
    description: 'Desenha a solução, formato do entregável (faceless), entregáveis e mecanismo único.',
    roleFile: 'product-mechanism-architect.md',
    defaultModelTier: 'specialist',
  },
  'pricing-monetization-strategist': {
    id: 'pricing-monetization-strategist',
    name: 'Pricing & Monetization Strategist',
    title: 'Estrategista de Precificação & Monetização',
    department: 'offer',
    level: 'specialist',
    description: 'Estrutura ticket de entrada, ancoragem, bumps e lógica de AOV no checkout.',
    roleFile: 'pricing-monetization-strategist.md',
    defaultModelTier: 'specialist',
  },

  // Department 3: Go-To-Market Specialists
  'creative-strategist': {
    id: 'creative-strategist',
    name: 'Creative Strategist',
    title: 'Estrategista de Criativos',
    department: 'gtm',
    level: 'specialist',
    description: 'Extrai ganchos, formatos e estrutura visual para criar novos roteiros de anúncios.',
    roleFile: 'creative-strategist.md',
    defaultModelTier: 'specialist',
  },
  'copy-lp-strategist': {
    id: 'copy-lp-strategist',
    name: 'Copy & Landing Page Strategist',
    title: 'Estrategista de Copy & Landing Page',
    department: 'gtm',
    level: 'specialist',
    description: 'Constrói a narrativa comercial, headline e blueprint estruturado da Landing Page.',
    roleFile: 'copy-lp-strategist.md',
    defaultModelTier: 'specialist',
  },
  'validation-scale-strategist': {
    id: 'validation-scale-strategist',
    name: 'Validation & Scale Strategist',
    title: 'Estrategista de Validação & Escala',
    department: 'gtm',
    level: 'specialist',
    description: 'Crie o plano de teste mínimo com isolamento de variáveis e métricas de decisão.',
    roleFile: 'validation-scale-strategist.md',
    defaultModelTier: 'specialist',
  },
};
