import { LiveOfficeVisualState } from '../events';

export type AgentOpState = 'IDLE' | 'WORKING' | 'CALL' | 'ERROR';

export interface IsoAgent {
  id: string;
  name: string;
  shortName: string;
  department: 'executive' | 'market' | 'offer' | 'gtm';
  zoneId: 'executive' | 'litigation' | 'contracts' | 'intake' | 'research';
  roleTitle: string;
  isoX: number;
  isoY: number;
  status: AgentOpState;
  taskSnippet: string;
  speechBubbleText?: string;
  activeTool?: string;
  suitColor: number;
  hairColor: number;
}

export interface IsoRoomZone {
  id: 'executive' | 'litigation' | 'contracts' | 'intake' | 'research';
  name: string;
  title: string;
  color: number;
  floorType: 'hardwood' | 'carpet' | 'marble' | 'tile';
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const OFFICE_ZONES: Record<string, IsoRoomZone> = {
  executive: {
    id: 'executive',
    name: 'Executive Suite',
    title: 'SALA DA DIRETORIA (BOSS)',
    color: 0xa855f7,
    floorType: 'hardwood',
    minX: 2,
    minY: 2,
    maxX: 10,
    maxY: 10,
  },
  litigation: {
    id: 'litigation',
    name: 'Litigation & Court Operations / Mercado',
    title: 'MERCADO & EVIDÊNCIAS',
    color: 0x06b6d4,
    floorType: 'carpet',
    minX: 12,
    minY: 2,
    maxX: 28,
    maxY: 10,
  },
  contracts: {
    id: 'contracts',
    name: 'Contracts & Corporate Law / Oferta',
    title: 'ARQUITETURA DE OFERTA',
    color: 0x6366f1,
    floorType: 'marble',
    minX: 2,
    minY: 12,
    maxX: 10,
    maxY: 28,
  },
  intake: {
    id: 'intake',
    name: 'Client Intake & Operations / GTM',
    title: 'GO-TO-MARKET & INTAKE',
    color: 0x10b981,
    floorType: 'tile',
    minX: 12,
    minY: 12,
    maxX: 20,
    maxY: 20,
  },
  research: {
    id: 'research',
    name: 'Research, Strategy & Processing',
    title: 'BIBLIOTECA & PESQUISA',
    color: 0xf59e0b,
    floorType: 'hardwood',
    minX: 22,
    minY: 12,
    maxX: 28,
    maxY: 28,
  },
};

export const INITIAL_ISO_AGENTS: IsoAgent[] = [
  // 1. Executive Suite (Boss - 1 agent)
  {
    id: 'director',
    name: 'Diretor de Inteligência',
    shortName: 'Director',
    department: 'executive',
    zoneId: 'executive',
    roleTitle: 'Chief Intelligence Officer',
    isoX: 5,
    isoY: 5,
    status: 'IDLE',
    taskSnippet: 'Sintetizando teses estratégicas',
    speechBubbleText: 'Revisando relatórios de mercado...',
    suitColor: 0xa855f7,
    hairColor: 0x1e293b,
  },

  // 2. Litigation & Court Operations / Mercado (4 agents)
  {
    id: 'head-market',
    name: 'Head de Mercado',
    shortName: 'Head Mercado',
    department: 'market',
    zoneId: 'litigation',
    roleTitle: 'Senior Litigator & Market Lead',
    isoX: 15,
    isoY: 4,
    status: 'WORKING',
    taskSnippet: 'Mapeando benchmarks de mercado',
    speechBubbleText: 'Analisando volume de anúncios ativos...',
    suitColor: 0x06b6d4,
    hairColor: 0x475569,
  },
  {
    id: 'market-signal-miner',
    name: 'Minerador de Sinais',
    shortName: 'Signal Miner',
    department: 'market',
    zoneId: 'litigation',
    roleTitle: 'Signal Mining Specialist',
    isoX: 20,
    isoY: 4,
    status: 'WORKING',
    taskSnippet: 'Extraindo padrões de Meta Ads',
    speechBubbleText: '3 novos sinais identificados!',
    suitColor: 0x06b6d4,
    hairColor: 0xd97706,
  },
  {
    id: 'audience-positioning-researcher',
    name: 'Pesquisador de Público',
    shortName: 'Audience',
    department: 'market',
    zoneId: 'litigation',
    roleTitle: 'Audience Profiler',
    isoX: 15,
    isoY: 8,
    status: 'CALL',
    taskSnippet: 'Qualificando persona e dores',
    speechBubbleText: 'Entrevistando avatar de compra...',
    suitColor: 0x06b6d4,
    hairColor: 0x0284c7,
  },
  {
    id: 'evidence-auditor',
    name: 'Auditor de Evidências',
    shortName: 'Auditor',
    department: 'market',
    zoneId: 'litigation',
    roleTitle: 'Evidence Compliance Auditor',
    isoX: 22,
    isoY: 8,
    status: 'WORKING',
    taskSnippet: 'Validando provas factuais',
    speechBubbleText: 'Auditando métricas de longevidade',
    suitColor: 0x06b6d4,
    hairColor: 0x334155,
  },

  // 3. Contracts & Corporate Law / Oferta (4 agents)
  {
    id: 'head-offer',
    name: 'Head de Oferta',
    shortName: 'Head Oferta',
    department: 'offer',
    zoneId: 'contracts',
    roleTitle: 'Senior Contract Architect',
    isoX: 4,
    isoY: 15,
    status: 'WORKING',
    taskSnippet: 'Estruturando mecanismo único',
    speechBubbleText: 'Refinando promessa principal...',
    suitColor: 0x6366f1,
    hairColor: 0x4338ca,
  },
  {
    id: 'offer-dna-analyst',
    name: 'Analista de DNA',
    shortName: 'Offer DNA',
    department: 'offer',
    zoneId: 'contracts',
    roleTitle: 'DNA Offer Specialist',
    isoX: 7,
    isoY: 15,
    status: 'WORKING',
    taskSnippet: 'Decompondo esteira de produtos',
    speechBubbleText: 'Mapeando entregáveis e bônus',
    suitColor: 0x6366f1,
    hairColor: 0x8b5cf6,
  },
  {
    id: 'product-mechanism-architect',
    name: 'Arquiteto de Produto',
    shortName: 'Product',
    department: 'offer',
    zoneId: 'contracts',
    roleTitle: 'Product Delivery Architect',
    isoX: 4,
    isoY: 22,
    status: 'IDLE',
    taskSnippet: 'Formatando formato de produto',
    suitColor: 0x6366f1,
    hairColor: 0x059669,
  },
  {
    id: 'pricing-monetization-strategist',
    name: 'Estrategista de Pricing',
    shortName: 'Pricing',
    department: 'offer',
    zoneId: 'contracts',
    roleTitle: 'Monetization Strategist',
    isoX: 7,
    isoY: 22,
    status: 'WORKING',
    taskSnippet: 'Calculando tickets e order bumps',
    speechBubbleText: 'Calculando elasticidade de preço R$ 27 - R$ 97',
    suitColor: 0x6366f1,
    hairColor: 0xb45309,
  },

  // 4. Client Intake & Operations / GTM (4 agents)
  {
    id: 'head-gtm',
    name: 'Head de GTM',
    shortName: 'Head GTM',
    department: 'gtm',
    zoneId: 'intake',
    roleTitle: 'Go-To-Market Intake Lead',
    isoX: 14,
    isoY: 14,
    status: 'CALL',
    taskSnippet: 'Orquestrando campanha de tráfego',
    speechBubbleText: 'Alinhando funil de aquisição...',
    suitColor: 0x10b981,
    hairColor: 0x047857,
  },
  {
    id: 'creative-strategist',
    name: 'Estrategista de Criativos',
    shortName: 'Creative',
    department: 'gtm',
    zoneId: 'intake',
    roleTitle: 'Creative Director & Hooks Lead',
    isoX: 17,
    isoY: 14,
    status: 'WORKING',
    taskSnippet: 'Criando variações de hooks',
    speechBubbleText: 'Desenhando 5 novas variações visuais',
    suitColor: 0x10b981,
    hairColor: 0xec4899,
  },
  {
    id: 'copy-lp-strategist',
    name: 'Estrategista de Copy/LP',
    shortName: 'Copy / LP',
    department: 'gtm',
    zoneId: 'intake',
    roleTitle: 'Copywriting & LP Specialist',
    isoX: 14,
    isoY: 18,
    status: 'WORKING',
    taskSnippet: 'Redigindo headlines e VSL script',
    speechBubbleText: 'Escrevendo a headline principal da LP',
    suitColor: 0x10b981,
    hairColor: 0xeab308,
  },
  {
    id: 'validation-scale-strategist',
    name: 'Estrategista de Validação',
    shortName: 'Validation',
    department: 'gtm',
    zoneId: 'intake',
    roleTitle: 'Validation & Scaling Strategist',
    isoX: 17,
    isoY: 18,
    status: 'IDLE',
    taskSnippet: 'Preparando plano de validação',
    suitColor: 0x10b981,
    hairColor: 0x0284c7,
  },
];

/**
 * Maps live office events into the store format
 */
export function mapLiveVisualStateToIsoAgents(
  agents: IsoAgent[],
  liveState: LiveOfficeVisualState
): IsoAgent[] {
  return agents.map((ag) => {
    const liveAgent = liveState.agents[ag.id];
    if (!liveAgent) return ag;

    let opStatus: AgentOpState = 'IDLE';
    if (liveAgent.state === 'RESEARCHING' || liveAgent.state === 'WRITING') opStatus = 'WORKING';
    if (liveAgent.state === 'USING_TOOL') opStatus = 'CALL';
    if (liveAgent.state === 'ERROR') opStatus = 'ERROR';

    return {
      ...ag,
      status: opStatus,
      taskSnippet: liveAgent.currentTask || ag.taskSnippet,
      speechBubbleText: liveAgent.activeToolLabel
        ? `Usando: ${liveAgent.activeToolLabel}`
        : ag.speechBubbleText,
    };
  });
}
