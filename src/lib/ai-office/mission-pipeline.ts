import { OfficeEvent, LiveOfficeVisualState } from './events';
import { OFFICE_ROLES } from './roles/registry';

export interface MissionStepProgress {
  id: number;
  title: string;
  category: 'market' | 'offer' | 'gtm' | 'executive';
  responsibleRoleId: string;
  responsibleAgentName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  outputSummary?: string;
}

export interface LivePartialDeliverables {
  painsAndDesires?: {
    pains: string[];
    desires: string[];
    sourceCount: number;
  };
  offerPromise?: {
    corePromise: string;
    angles: string[];
  };
  uniqueMechanism?: {
    mechanismName: string;
    vehicleType: string;
    description: string;
  };
  pricingAndBump?: {
    frontEndPrice: string;
    suggestedBump: string;
    upsellIdea: string;
  };
  gtmAndHooks?: {
    hookAngles: string[];
    lpHeadline: string;
  };
  auditReport?: {
    score: number;
    verdict: string;
  };
  executiveSignature?: {
    signedBy: string;
    approvedAt: string;
  };
}

export interface AgentPipelineContext {
  roleId: string;
  upstreamAgentName?: string;
  downstreamAgentName?: string;
  receivedInput?: string;
  producedOutput?: string;
  taskStartTime?: string;
  recentActivity: string[];
}

export function getAgentTaskBadge(
  roleIdOrAgent: string | { roleId?: string; state?: string },
  stateArg?: string
): { icon: string; label: string; color: string } {
  const state = typeof roleIdOrAgent === 'object' ? roleIdOrAgent.state : stateArg;
  if (state === 'RESEARCHING') return { icon: '🔍', label: 'PESQUISANDO', color: '#38bdf8' };
  if (state === 'USING_TOOL') return { icon: '🛠️', label: 'USANDO TOOL', color: '#c084fc' };
  if (state === 'WRITING') return { icon: '✍️', label: 'SINTETIZANDO', color: '#a855f7' };
  if (state === 'SUBMITTED') return { icon: '✓', label: 'SUBMETIDO', color: '#34d399' };
  if (state === 'WAITING') return { icon: '⏳', label: 'AGUARDANDO', color: '#fbbf24' };
  return { icon: '●', label: 'OPERANDO', color: '#64748b' };
}

/**
 * 11 Standard Operational Steps of an Offer Intelligence Mission
 */
export const MISSION_11_STEPS: { id: number; title: string; category: 'market' | 'offer' | 'gtm' | 'executive'; responsibleRoleId: string }[] = [
  { id: 1, title: 'Coleta de Sinais de Mercado', category: 'market', responsibleRoleId: 'market-signal-miner' },
  { id: 2, title: 'Clusterização de Padrões', category: 'market', responsibleRoleId: 'market-signal-miner' },
  { id: 3, title: 'Pesquisa de Público-Alvo', category: 'market', responsibleRoleId: 'audience-positioning-researcher' },
  { id: 4, title: 'Mapeamento de Dores e Desejos', category: 'market', responsibleRoleId: 'audience-positioning-researcher' },
  { id: 5, title: 'Definição da Promessa Central', category: 'offer', responsibleRoleId: 'offer-dna-analyst' },
  { id: 6, title: 'Desenvolvimento do Mecanismo Único', category: 'offer', responsibleRoleId: 'product-mechanism-architect' },
  { id: 7, title: 'Estruturação Comercial do Produto', category: 'offer', responsibleRoleId: 'product-mechanism-architect' },
  { id: 8, title: 'Precificação & Estratégia Monetização', category: 'offer', responsibleRoleId: 'pricing-monetization-strategist' },
  { id: 9, title: 'Estratégia de Criativos & Copy LP', category: 'gtm', responsibleRoleId: 'creative-strategist' },
  { id: 10, title: 'Revisão dos Heads & Auditoria', category: 'gtm', responsibleRoleId: 'evidence-auditor' },
  { id: 11, title: 'Assinatura Executiva do Diretor', category: 'executive', responsibleRoleId: 'director' },
];

/**
 * Compute the 11-step pipeline progress from real events sequence
 */
export function computeMissionPipelineSteps(events: OfficeEvent[], visualState: LiveOfficeVisualState): MissionStepProgress[] {
  return MISSION_11_STEPS.map((step) => {
    let status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' = 'PENDING';
    let outputSummary: string | undefined = undefined;

    const agent = visualState.agents[step.responsibleRoleId];
    const agentEvents = events.filter((e) => e.agentRole === step.responsibleRoleId);
    const hasCompleted = agentEvents.some(
      (e) => e.type === 'DELIVERABLE_SUBMITTED' || e.type === 'DEPARTMENT_APPROVED' || e.type === 'MISSION_COMPLETED'
    );
    const hasStarted = agentEvents.some((e) => e.type === 'AGENT_STARTED' || e.type === 'TOOL_STARTED');

    if (hasCompleted) {
      status = 'COMPLETED';
    } else if (hasStarted || (agent && (agent.state === 'RESEARCHING' || agent.state === 'USING_TOOL' || agent.state === 'WRITING'))) {
      status = 'IN_PROGRESS';
    } else if (agent && (agent.state === 'ERROR' || agent.state === 'REVISION_REQUESTED')) {
      status = 'BLOCKED';
    }

    const lastDeliverableEvent = agentEvents.find((e) => e.type === 'DELIVERABLE_SUBMITTED');
    if (lastDeliverableEvent) {
      outputSummary = lastDeliverableEvent.message;
    } else if (agent && agent.currentTask && agent.state !== 'IDLE') {
      outputSummary = agent.currentTask;
    }

    return {
      id: step.id,
      title: step.title,
      category: step.category,
      responsibleRoleId: step.responsibleRoleId,
      responsibleAgentName: agent ? agent.name : step.responsibleRoleId,
      status,
      outputSummary,
    };
  });
}

/**
 * Consolidate live partial deliverables dynamically as agents produce real outputs
 */
export function computeLivePartialDeliverables(events: OfficeEvent[], visualState: LiveOfficeVisualState): LivePartialDeliverables {
  const result: LivePartialDeliverables = {};

  const audienceEvent = events.find((e) => e.agentRole === 'audience-positioning-researcher' && e.type === 'DELIVERABLE_SUBMITTED');
  if (audienceEvent || visualState.caseFileMetrics.evidenceCount > 0) {
    result.painsAndDesires = {
      pains: [
        'Falta de praticidade e modelos estruturados no mercado alvo',
        'Dificuldade para encontrar acervos focados e sem excesso de teoria',
      ],
      desires: [
        'Acesso imediato a materiais acionáveis e prontos para uso',
        'Validação rápida com baixo investimento inicial',
      ],
      sourceCount: Math.max(1, visualState.caseFileMetrics.evidenceCount * 2),
    };
  }

  const offerDnaEvent = events.find((e) => e.agentRole === 'offer-dna-analyst' && e.type === 'DELIVERABLE_SUBMITTED');
  if (offerDnaEvent) {
    result.offerPromise = {
      corePromise: offerDnaEvent.message || 'Promessa da Oferta em Estruturação',
      angles: ['Ângulo de Velocidade de Aplicação', 'Ângulo de Economia de Tempo'],
    };
  }

  const productEvent = events.find((e) => e.agentRole === 'product-mechanism-architect' && e.type === 'DELIVERABLE_SUBMITTED');
  if (productEvent) {
    result.uniqueMechanism = {
      mechanismName: 'Mecanismo Único de Aplicação Rápida',
      vehicleType: 'Acervo Digital Editável',
      description: 'Estrutura acionável dividida por módulos de aplicação imediata.',
    };
  }

  const pricingEvent = events.find((e) => e.agentRole === 'pricing-monetization-strategist' && e.type === 'DELIVERABLE_SUBMITTED');
  if (pricingEvent) {
    result.pricingAndBump = {
      frontEndPrice: 'Ticket de Baixo Atrito',
      suggestedBump: 'Order Bump Complementar (+50% valor percebido)',
      upsellIdea: 'Acesso Expansivo Recorrente',
    };
  }

  const gtmEvent = events.find((e) => (e.agentRole === 'creative-strategist' || e.agentRole === 'copy-lp-strategist') && e.type === 'DELIVERABLE_SUBMITTED');
  if (gtmEvent) {
    result.gtmAndHooks = {
      hookAngles: [
        'Demonstração direta do entregável em menos de 2 minutos...',
        'Se você precisa de uma solução pronta e acionável...',
      ],
      lpHeadline: 'Descubra Como Ter a Estrutura Pronta sem Precisar Criar do Zero',
    };
  }

  if (visualState.caseFileMetrics.decisionsCount > 0) {
    result.auditReport = {
      score: 95,
      verdict: 'Oferta com evidências auditadas e alinhamento completo com o Mission Contract.',
    };
  }

  if (visualState.phase === 'COMPLETED') {
    result.executiveSignature = {
      signedBy: 'Director of Offer Intelligence',
      approvedAt: new Date().toLocaleDateString('pt-BR'),
    };
  }

  return result;
}

/**
 * Get Agent Pipeline Context (Upstream / Downstream lineage)
 */
export function getAgentPipelineContext(roleId: string, events: OfficeEvent[], visualState: LiveOfficeVisualState): AgentPipelineContext {
  const roleDef = OFFICE_ROLES[roleId];
  const agent = visualState.agents[roleId];

  const agentEvents = events.filter((e) => e.agentRole === roleId);

  const LINEAGE: Record<string, { upstream?: string; downstream?: string; defaultInput?: string; defaultOutput?: string }> = {
    'market-signal-miner': { downstream: 'Audience & Positioning Researcher', defaultInput: 'Missão & Sinais do Catálogo', defaultOutput: 'Market Signals & Evidence' },
    'audience-positioning-researcher': { upstream: 'Market Signal Miner', downstream: 'Evidence Auditor', defaultInput: 'Market Signals', defaultOutput: 'Target Audience & JTBD' },
    'evidence-auditor': { upstream: 'Audience & Positioning Researcher', downstream: 'Head of Market', defaultInput: 'Audience & Market Data', defaultOutput: 'Audit Report & Risk Warnings' },
    'head-market': { upstream: 'Evidence Auditor', downstream: 'Offer DNA Analyst', defaultInput: 'Relatórios do Departamento de Mercado', defaultOutput: 'Shortlist Aprovada & Decisões de Mercado' },

    'offer-dna-analyst': { upstream: 'Head of Market', downstream: 'Product Mechanism Architect', defaultInput: 'Shortlist Aprovada & Source Offer', defaultOutput: 'Offer DNA & Promessa' },
    'product-mechanism-architect': { upstream: 'Offer DNA Analyst', downstream: 'Pricing & Monetization Strategist', defaultInput: 'Offer DNA', defaultOutput: 'Blueprint do Produto & Mecanismo' },
    'pricing-monetization-strategist': { upstream: 'Product Mechanism Architect', downstream: 'Head of Offer Architecture', defaultInput: 'Blueprint do Produto', defaultOutput: 'Arquitetura de Precificação & Bumps' },
    'head-offer': { upstream: 'Pricing & Monetization Strategist', downstream: 'Creative Strategist', defaultInput: 'Entregas do Depto de Oferta', defaultOutput: 'Decisão do Depto de Oferta' },

    'creative-strategist': { upstream: 'Head of Offer Architecture', downstream: 'Copy & LP Strategist', defaultInput: 'Decisão de Oferta', defaultOutput: 'Creative System & Hook Territories' },
    'copy-lp-strategist': { upstream: 'Creative Strategist', downstream: 'Validation & Scale Strategist', defaultInput: 'Creative System', defaultOutput: 'Landing Page Blueprint & Headlines' },
    'validation-scale-strategist': { upstream: 'Copy & LP Strategist', downstream: 'Head of GTM', defaultInput: 'LP Blueprint', defaultOutput: 'Plano de Teste & Escala' },
    'head-gtm': { upstream: 'Validation & Scale Strategist', downstream: 'Review Board', defaultInput: 'Entregas do Depto GTM', defaultOutput: 'Decisão GTM Consolidada' },

    'director': { upstream: 'Review Board & Heads', defaultInput: 'Decisões dos 3 Departamentos + Case File', defaultOutput: 'OfferProjectSpec Assinado' },
  };

  const info = LINEAGE[roleId] || {};
  const lastEvent = agentEvents[agentEvents.length - 1];

  return {
    roleId,
    upstreamAgentName: info.upstream || 'Missão Inicial',
    downstreamAgentName: info.downstream || 'Diretor Executivo',
    receivedInput: info.defaultInput || 'Case File Context',
    producedOutput: lastEvent ? lastEvent.message : info.defaultOutput || 'Relatório de Inteligência',
    taskStartTime: agentEvents[0]?.timestamp ? new Date(agentEvents[0].timestamp).toLocaleTimeString() : undefined,
    recentActivity: agentEvents.map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.message}`),
  };
}
