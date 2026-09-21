export type OfficeEventType =
  | 'MISSION_STARTED'
  | 'PHASE_STARTED'
  | 'PHASE_COMPLETED'
  | 'AGENT_ASSIGNED'
  | 'AGENT_STARTED'
  | 'AGENT_WAITING'
  | 'AGENT_IDLE'
  | 'TOOL_STARTED'
  | 'TOOL_COMPLETED'
  | 'KNOWLEDGE_RETRIEVED'
  | 'DELIVERABLE_SUBMITTED'
  | 'HEAD_REVIEW_STARTED'
  | 'REVISION_REQUESTED'
  | 'REVISION_COMPLETED'
  | 'DEPARTMENT_APPROVED'
  | 'MEETING_STARTED'
  | 'MEETING_COMPLETED'
  | 'HYPOTHESIS_CREATED'
  | 'HYPOTHESIS_REJECTED'
  | 'DECISION_CREATED'
  | 'DIRECTOR_REVIEW_STARTED'
  | 'OFFER_PROJECT_CREATED'
  | 'MISSION_COMPLETED'
  | 'AGENT_FAILED'
  | 'MISSION_FAILED';

export interface OfficeEvent {
  id: string;
  missionId: string;
  type: OfficeEventType;
  agentRole?: string;
  department?: 'market' | 'offer' | 'gtm' | 'executive';
  phase?: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export type AgentVisualState =
  | 'OFF_DUTY'
  | 'IDLE'
  | 'WALKING'
  | 'WAITING'
  | 'RESEARCHING'
  | 'USING_TOOL'
  | 'WRITING'
  | 'SUBMITTED'
  | 'REVIEWING'
  | 'REVISION_REQUESTED'
  | 'MEETING'
  | 'APPROVED'
  | 'ERROR';

export interface VisualAgentState {
  roleId: string;
  name: string;
  department: 'market' | 'offer' | 'gtm' | 'executive';
  state: AgentVisualState;
  currentTask: string;
  currentLocation: 'desk' | 'meeting' | 'library' | 'corridor' | 'executive_room';
  activeToolLabel?: string;
  toolCategory?: string;
}

export interface LiveOfficeVisualState {
  missionId: string;
  phase: string;
  progress?: number;
  agents: Record<string, VisualAgentState>;
  departmentStatuses: {
    market: 'IDLE' | 'WORKING' | 'APPROVED';
    offer: 'IDLE' | 'WORKING' | 'APPROVED';
    gtm: 'IDLE' | 'WORKING' | 'APPROVED';
  };
  meetingRoomState: {
    isMeetingActive: boolean;
    title?: string;
    participants: string[];
  };
  caseFileMetrics: {
    evidenceCount: number;
    hypothesesCount: number;
    activeThesesCount: number;
    rejectedCount: number;
    contradictionsCount: number;
    decisionsCount: number;
  };
  lastEventTimestamp?: string;
}

/**
 * Pure state reducer computing visual office state from events sequence
 */
export function reduceOfficeEvents(events: OfficeEvent[], missionId: string): LiveOfficeVisualState {
  // Initial default state for 13 agents
  const initialAgents: Record<string, VisualAgentState> = {
    'director': { roleId: 'director', name: 'Diretor de Inteligência', department: 'executive', state: 'IDLE', currentTask: 'Aguardando síntese', currentLocation: 'executive_room' },
    'head-market': { roleId: 'head-market', name: 'Head de Mercado', department: 'market', state: 'IDLE', currentTask: 'Aguardando especialistas', currentLocation: 'desk' },
    'head-offer': { roleId: 'head-offer', name: 'Head de Oferta', department: 'offer', state: 'IDLE', currentTask: 'Aguardando especialistas', currentLocation: 'desk' },
    'head-gtm': { roleId: 'head-gtm', name: 'Head de GTM', department: 'gtm', state: 'IDLE', currentTask: 'Aguardando especialistas', currentLocation: 'desk' },
    'market-signal-miner': { roleId: 'market-signal-miner', name: 'Minerador de Sinais', department: 'market', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'audience-positioning-researcher': { roleId: 'audience-positioning-researcher', name: 'Pesquisador de Público', department: 'market', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'evidence-auditor': { roleId: 'evidence-auditor', name: 'Auditor de Evidências', department: 'market', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'offer-dna-analyst': { roleId: 'offer-dna-analyst', name: 'Analista de DNA', department: 'offer', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'product-mechanism-architect': { roleId: 'product-mechanism-architect', name: 'Arquiteto de Produto', department: 'offer', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'pricing-monetization-strategist': { roleId: 'pricing-monetization-strategist', name: 'Estrategista de Pricing', department: 'offer', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'creative-strategist': { roleId: 'creative-strategist', name: 'Estrategista de Criativos', department: 'gtm', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'copy-lp-strategist': { roleId: 'copy-lp-strategist', name: 'Estrategista de Copy/LP', department: 'gtm', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
    'validation-scale-strategist': { roleId: 'validation-scale-strategist', name: 'Estrategista de Validação', department: 'gtm', state: 'IDLE', currentTask: 'Disponível', currentLocation: 'desk' },
  };

  const state: LiveOfficeVisualState = {
    missionId,
    phase: 'BRIEF',
    agents: initialAgents,
    departmentStatuses: { market: 'IDLE', offer: 'IDLE', gtm: 'IDLE' },
    meetingRoomState: { isMeetingActive: false, participants: [] },
    caseFileMetrics: {
      evidenceCount: 0,
      hypothesesCount: 3,
      activeThesesCount: 1,
      rejectedCount: 0,
      contradictionsCount: 0,
      decisionsCount: 0,
    },
  };

  events.forEach((ev) => {
    state.lastEventTimestamp = ev.timestamp;

    if (ev.type === 'PHASE_STARTED' && ev.phase) {
      state.phase = ev.phase;
    }

    if (ev.agentRole && state.agents[ev.agentRole]) {
      const agent = state.agents[ev.agentRole];

      switch (ev.type) {
        case 'AGENT_STARTED':
          agent.state = 'RESEARCHING';
          agent.currentTask = ev.message;
          agent.currentLocation = 'desk';
          if (agent.department !== 'executive') {
            state.departmentStatuses[agent.department] = 'WORKING';
          }
          break;

        case 'TOOL_STARTED':
          agent.state = 'USING_TOOL';
          agent.activeToolLabel = ev.message;
          agent.toolCategory = ev.metadata?.toolCategory || 'offers';
          if (ev.metadata?.toolCategory === 'knowledge') {
            agent.currentLocation = 'library';
          }
          break;

        case 'TOOL_COMPLETED':
          agent.state = 'RESEARCHING';
          agent.currentLocation = 'desk';
          agent.activeToolLabel = undefined;
          state.caseFileMetrics.evidenceCount += (ev.metadata?.evidenceCount || 1);
          break;

        case 'DELIVERABLE_SUBMITTED':
          agent.state = 'SUBMITTED';
          agent.currentTask = 'Entregável Enviado ao Head';
          agent.currentLocation = 'desk';
          break;

        case 'HEAD_REVIEW_STARTED':
          agent.state = 'REVIEWING';
          agent.currentTask = 'Revisando Entregas do Departamento';
          agent.currentLocation = 'desk';
          break;

        case 'DEPARTMENT_APPROVED':
          agent.state = 'APPROVED';
          agent.currentTask = 'Departamento Aprovado';
          if (agent.department !== 'executive') {
            state.departmentStatuses[agent.department] = 'APPROVED';
          }
          break;

        case 'MEETING_STARTED':
          state.meetingRoomState = {
            isMeetingActive: true,
            title: ev.message,
            participants: ev.metadata?.participants || ['head-market', 'head-offer', 'head-gtm', 'evidence-auditor'],
          };
          if (state.meetingRoomState.participants.includes(ev.agentRole)) {
            agent.state = 'MEETING';
            agent.currentLocation = 'meeting';
            agent.currentTask = 'Em Reunião na Mesa de Validação';
          }
          break;

        case 'MEETING_COMPLETED':
          state.meetingRoomState = { isMeetingActive: false, participants: [] };
          if (agent.currentLocation === 'meeting') {
            agent.state = 'IDLE';
            agent.currentLocation = 'desk';
          }
          break;

        case 'DIRECTOR_REVIEW_STARTED':
          if (ev.agentRole === 'director') {
            agent.state = 'REVIEWING';
            agent.currentTask = 'Sintetizando Offer Project Definitivo';
            agent.currentLocation = 'executive_room';
          }
          break;

        case 'MISSION_COMPLETED':
          agent.state = 'APPROVED';
          agent.currentTask = 'Projeto Concluído';
          break;
      }
    }

    if (ev.type === 'DECISION_CREATED') {
      state.caseFileMetrics.decisionsCount++;
    }
  });

  return state;
}
