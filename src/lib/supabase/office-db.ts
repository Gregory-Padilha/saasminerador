import { supabase, isSupabaseConfigured } from './client';
import { OfficeCaseFile } from '../ai-office/case-file';
import { MissionCostSummary } from '../ai-office/cost-tracker';
import { OfficeMissionBrief } from '../ai-office/mission-brief';

export interface OfficeMissionRecord {
  id: string;
  title: string;
  mode: 'MODEL_EXISTING_OFFER' | 'CREATE_FROM_ZERO';
  status: 'DRAFT' | 'PLANNING' | 'RESEARCHING' | 'ARCHITECTING' | 'GTM' | 'REVIEW' | 'DIRECTOR_REVIEW' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'CANCELLED';
  profileId: 'openai_balanced' | 'anthropic_office' | 'gemini_economy';
  budgetMode: 'ECONOMY' | 'BALANCED' | 'DEEP';
  goal: string;
  attachedOfferIds: string[];
  caseFile: OfficeCaseFile;
  missionBrief?: OfficeMissionBrief;
  costSummary?: MissionCostSummary;
  offerProjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeAgentRunRecord {
  id: string;
  missionId: string;
  agentRole: string;
  agentTitle: string;
  department: string;
  status: 'IDLE' | 'WAITING' | 'RESEARCHING' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED' | 'FAILED';
  inputSummary?: string;
  outputFindings?: any;
  revisionNote?: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
}

export interface OfficeOfferProjectRecord {
  id: string;
  missionId: string;
  projectName: string;
  workingName: string;
  market: string;
  niche: string;
  subniche?: string;
  status: 'DRAFT' | 'APPROVED' | 'TESTING' | 'VALIDATED' | 'REJECTED';
  offerSpec: any; // Full OfferSpec object
  decisionLedger: any[];
  referenceOfferIds: string[];
  createdAt: string;
  updatedAt: string;
}

import { OfficeEvent } from '../ai-office/events';

// In-memory fallback for server-side or local persistence
const memoryMissions: Map<string, OfficeMissionRecord> = new Map();
const memoryAgentRuns: Map<string, OfficeAgentRunRecord[]> = new Map();
const memoryProjects: Map<string, OfficeOfferProjectRecord> = new Map();
const memoryEvents: Map<string, OfficeEvent[]> = new Map();

export const officeDbService = {
  // Mission CRUD
  async saveMission(mission: OfficeMissionRecord): Promise<OfficeMissionRecord> {
    memoryMissions.set(mission.id, { ...mission, updatedAt: new Date().toISOString() });

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('office_missions').upsert({
          id: mission.id,
          title: mission.title,
          mode: mission.mode,
          status: mission.status,
          profile_id: mission.profileId,
          budget_mode: mission.budgetMode,
          goal: mission.goal,
          attached_offer_ids: mission.attachedOfferIds,
          case_file: mission.caseFile,
          mission_brief: mission.missionBrief,
          cost_summary: mission.costSummary,
          offer_project_id: mission.offerProjectId,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Supabase office_missions save error:', err);
      }
    }

    return mission;
  },

  async getMission(id: string): Promise<OfficeMissionRecord | null> {
    if (memoryMissions.has(id)) {
      return memoryMissions.get(id)!;
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase.from('office_missions').select('*').eq('id', id).single();
        if (data) {
          const record: OfficeMissionRecord = {
            id: data.id,
            title: data.title,
            mode: data.mode,
            status: data.status,
            profileId: data.profile_id,
            budgetMode: data.budget_mode,
            goal: data.goal,
            attachedOfferIds: data.attached_offer_ids || [],
            caseFile: data.case_file,
            missionBrief: data.mission_brief,
            costSummary: data.cost_summary,
            offerProjectId: data.offer_project_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          memoryMissions.set(record.id, record);
          return record;
        }
      } catch (err) {
        console.error('Supabase getMission error:', err);
      }
    }

    return null;
  },

  async listMissions(): Promise<OfficeMissionRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase.from('office_missions').select('*').order('updated_at', { ascending: false });
        if (data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            title: d.title,
            mode: d.mode,
            status: d.status,
            profileId: d.profile_id,
            budgetMode: d.budget_mode,
            goal: d.goal,
            attachedOfferIds: d.attached_offer_ids || [],
            caseFile: d.case_file,
            missionBrief: d.mission_brief,
            costSummary: d.cost_summary,
            offerProjectId: d.offer_project_id,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {
        console.error('Supabase listMissions error:', err);
      }
    }

    return Array.from(memoryMissions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  // Agent Runs Log
  async recordAgentRun(run: OfficeAgentRunRecord): Promise<void> {
    const runs = memoryAgentRuns.get(run.missionId) || [];
    memoryAgentRuns.set(run.missionId, [...runs, run]);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('office_agent_runs').insert({
          id: run.id,
          mission_id: run.missionId,
          agent_role: run.agentRole,
          agent_title: run.agentTitle,
          department: run.department,
          status: run.status,
          input_summary: run.inputSummary,
          output_findings: run.outputFindings,
          revision_note: run.revisionNote,
          duration_ms: run.durationMs,
          input_tokens: run.inputTokens,
          output_tokens: run.outputTokens,
          cost_usd: run.costUsd,
          created_at: run.createdAt,
        });
      } catch (err) {
        console.error('Supabase office_agent_runs insert error:', err);
      }
    }
  },

  async getAgentRunsForMission(missionId: string): Promise<OfficeAgentRunRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase
          .from('office_agent_runs')
          .select('*')
          .eq('mission_id', missionId)
          .order('created_at', { ascending: true });
        if (data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            missionId: d.mission_id,
            agentRole: d.agent_role,
            agentTitle: d.agent_title,
            department: d.department,
            status: d.status,
            inputSummary: d.input_summary,
            outputFindings: d.output_findings,
            revisionNote: d.revision_note,
            durationMs: d.duration_ms,
            inputTokens: d.input_tokens,
            outputTokens: d.output_tokens,
            costUsd: d.cost_usd,
            createdAt: d.created_at,
          }));
        }
      } catch {}
    }

    return memoryAgentRuns.get(missionId) || [];
  },

  // Offer Project CRUD
  async saveOfferProject(project: OfficeOfferProjectRecord): Promise<OfficeOfferProjectRecord> {
    memoryProjects.set(project.id, { ...project, updatedAt: new Date().toISOString() });

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('office_offer_projects').upsert({
          id: project.id,
          mission_id: project.missionId,
          project_name: project.projectName,
          working_name: project.workingName,
          market: project.market,
          niche: project.niche,
          subniche: project.subniche,
          status: project.status,
          offer_spec: project.offerSpec,
          decision_ledger: project.decisionLedger,
          reference_offer_ids: project.referenceOfferIds,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Supabase office_offer_projects save error:', err);
      }
    }

    return project;
  },

  async getOfferProject(id: string): Promise<OfficeOfferProjectRecord | null> {
    if (memoryProjects.has(id)) {
      return memoryProjects.get(id)!;
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase.from('office_offer_projects').select('*').eq('id', id).single();
        if (data) {
          const record: OfficeOfferProjectRecord = {
            id: data.id,
            missionId: data.mission_id,
            projectName: data.project_name,
            workingName: data.working_name,
            market: data.market,
            niche: data.niche,
            subniche: data.subniche,
            status: data.status,
            offerSpec: data.offer_spec,
            decisionLedger: data.decision_ledger || [],
            referenceOfferIds: data.reference_offer_ids || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          memoryProjects.set(record.id, record);
          return record;
        }
      } catch {}
    }

    return null;
  },

  async listOfferProjects(): Promise<OfficeOfferProjectRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase.from('office_offer_projects').select('*').order('updated_at', { ascending: false });
        if (data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            missionId: d.mission_id,
            projectName: d.project_name,
            workingName: d.working_name,
            market: d.market,
            niche: d.niche,
            subniche: d.subniche,
            status: d.status,
            offerSpec: d.offer_spec,
            decisionLedger: d.decision_ledger || [],
            referenceOfferIds: d.reference_offer_ids || [],
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch {}
    }

    return Array.from(memoryProjects.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  // Office Events
  async recordOfficeEvent(event: OfficeEvent): Promise<void> {
    const list = memoryEvents.get(event.missionId) || [];
    memoryEvents.set(event.missionId, [...list, event]);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('office_events').insert({
          id: event.id,
          mission_id: event.missionId,
          type: event.type,
          agent_role: event.agentRole,
          department: event.department,
          phase: event.phase,
          message: event.message,
          metadata: event.metadata,
          created_at: event.timestamp,
        });
      } catch (err) {
        // Fallback silently if table does not exist yet
      }
    }
  },

  async getOfficeEventsForMission(missionId: string): Promise<OfficeEvent[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase
          .from('office_events')
          .select('*')
          .eq('mission_id', missionId)
          .order('created_at', { ascending: true });
        if (data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            missionId: d.mission_id,
            type: d.type,
            agentRole: d.agent_role,
            department: d.department,
            phase: d.phase,
            message: d.message,
            metadata: d.metadata,
            timestamp: d.created_at,
          }));
        }
      } catch {}
    }

    return memoryEvents.get(missionId) || [];
  },
};
