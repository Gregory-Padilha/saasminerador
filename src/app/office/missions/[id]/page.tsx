'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Brain,
  Layers,
  ChevronRight,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { OfficeMissionRecord, OfficeAgentRunRecord, OfficeOfferProjectRecord } from '@/lib/supabase/office-db';
import { OfficeValueRenderer } from '@/components/ai-office/OfficeValueRenderer';
import { OfficeErrorBoundary } from '@/components/ai-office/OfficeErrorBoundary';

export default function MissionWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const missionId = params?.id as string;

  const [mission, setMission] = useState<OfficeMissionRecord | null>(null);
  const [agentRuns, setAgentRuns] = useState<OfficeAgentRunRecord[]>([]);
  const [project, setProject] = useState<OfficeOfferProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const [selectedAgentInspect, setSelectedAgentInspect] = useState<OfficeAgentRunRecord | null>(null);

  useEffect(() => {
    fetchMissionDetails();
    const interval = setInterval(fetchMissionDetails, 3000);
    return () => clearInterval(interval);
  }, [missionId]);

  const fetchMissionDetails = async () => {
    try {
      const res = await fetch(`/api/office/missions/${missionId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.mission) setMission(data.mission);
      if (data.agentRuns) setAgentRuns(data.agentRuns);
      if (data.project) setProject(data.project);
    } catch (err) {
      console.error('Error fetching mission details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleControlAction = async (action: 'advance' | 'pause' | 'cancel') => {
    setIsAdvancing(true);
    try {
      await fetch(`/api/office/missions/${missionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchMissionDetails();
    } catch (err) {
      console.error('Control action error:', err);
    } finally {
      setIsAdvancing(false);
    }
  };

  if (loading && !mission) {
    return (
      <div className="min-h-screen bg-[#090D14] text-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-amber-400 font-bold text-xs font-mono">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Carregando Missão do Escritório...</span>
        </div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-[#090D14] text-slate-100 p-10 font-sans space-y-4">
        <h2 className="text-xl font-bold text-white">Missão Não Encontrada</h2>
        <button onClick={() => router.push('/office')} className="px-4 py-2 bg-slate-900 border border-slate-800 text-xs font-bold rounded-xl text-amber-400">
          Voltar ao Escritório
        </button>
      </div>
    );
  }

  const stages = [
    { id: 'PLANNING', label: 'Brief & Plano' },
    { id: 'RESEARCHING', label: 'Mercado & Sinais' },
    { id: 'ARCHITECTING', label: 'Oferta & Produto' },
    { id: 'GTM', label: 'Estratégia GTM' },
    { id: 'DIRECTOR_REVIEW', label: 'Revisão do Diretor' },
    { id: 'COMPLETED', label: 'Offer Project' },
  ];

  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30">
      {/* Topbar Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/90 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/office')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition flex items-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Escritório</span>
          </button>
          <span className="text-slate-700">/</span>
          <span className="font-bold text-xs text-white truncate max-w-xs">{mission.title}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            ● {mission.status}
          </span>

          <button
            onClick={() => router.push(`/office/live/${missionId}`)}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition flex items-center gap-1.5 shadow-md shadow-purple-500/20"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>🏢 Escritório ao Vivo</span>
          </button>

          {mission.status !== 'COMPLETED' && (
            <button
              onClick={() => handleControlAction('advance')}
              disabled={isAdvancing}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>{isAdvancing ? 'Avançando...' : 'Avançar Fase'}</span>
            </button>
          )}

          {mission.offerProjectId && (
            <button
              onClick={() => router.push(`/office/projects/${mission.offerProjectId}`)}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abrir Offer Project ↗</span>
            </button>
          )}
        </div>
      </header>

      {/* Progress Timeline Stepper */}
      <div className="border-b border-slate-800/80 bg-slate-950/40 px-6 py-3 overflow-x-auto flex items-center gap-4 text-xs font-mono">
        {stages.map((st, idx) => {
          const isDone = stages.findIndex((s) => s.id === mission.status) > idx || mission.status === 'COMPLETED';
          const isCurrent = mission.status === st.id;
          return (
            <div key={st.id} className="flex items-center gap-2 flex-shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isDone ? 'bg-emerald-500 text-slate-950' : isCurrent ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {idx + 1}
              </span>
              <span className={isCurrent ? 'text-amber-300 font-bold' : isDone ? 'text-slate-200' : 'text-slate-500'}>
                {st.label}
              </span>
              {idx < stages.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-700" />}
            </div>
          );
        })}
      </div>

      {/* Main Workspace Body: Left Content + Right Activity Stream */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        {/* Left 2 Cols: Center Canvas (Findings & Department Outputs) */}
        <div className="lg:col-span-2 overflow-y-auto p-6 space-y-6">
          <OfficeErrorBoundary widgetName="MissionGoal">
            {/* Mission Brief Box */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Objetivo da Missão</h3>
              <p className="text-sm text-slate-100 leading-relaxed font-semibold">{mission.goal}</p>
            </div>
          </OfficeErrorBoundary>

          {/* Department Findings Showcase */}
          {mission.caseFile.marketFindings && (
            <OfficeErrorBoundary widgetName="MarketFindings">
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  1. Departamento de Mercado & Validação
                </h4>
                <div className="space-y-3 text-xs text-slate-300">
                  <span className="font-bold text-white block">Sinais Observados & Ofertas Candidatas:</span>
                  <OfficeValueRenderer
                    value={mission.caseFile.marketFindings.marketSignals}
                    context={{ componentName: 'MarketFindings', missionId }}
                  />
                </div>
              </div>
            </OfficeErrorBoundary>
          )}

          {mission.caseFile.offerFindings && (
            <OfficeErrorBoundary widgetName="OfferFindings">
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  2. Departamento de Arquitetura de Oferta
                </h4>
                <div className="space-y-3 text-xs text-slate-300">
                  <span className="font-bold text-white block">Conceito do Produto & Precificação:</span>
                  <OfficeValueRenderer
                    value={mission.caseFile.offerFindings.productBlueprint}
                    context={{ componentName: 'OfferFindings', missionId }}
                  />
                </div>
              </div>
            </OfficeErrorBoundary>
          )}

          {mission.caseFile.gtmFindings && (
            <OfficeErrorBoundary widgetName="GtmFindings">
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  3. Departamento de Go-To-Market
                </h4>
                <div className="space-y-3 text-xs text-slate-300">
                  <span className="font-bold text-white block">Creative System & LP Blueprint:</span>
                  <OfficeValueRenderer
                    value={mission.caseFile.gtmFindings.lpBlueprint}
                    context={{ componentName: 'GtmFindings', missionId }}
                  />
                </div>
              </div>
            </OfficeErrorBoundary>
          )}
        </div>

        {/* Right 1 Col: Office Activity Stream & Agent Run Logs */}
        <div className="border-l border-slate-800 bg-slate-950/60 overflow-y-auto p-6 space-y-4">
          <OfficeErrorBoundary widgetName="AgentRunsActivity">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              Atividade dos Agentes ({agentRuns.length})
            </h3>

            <div className="space-y-3">
              {agentRuns.map((run) => (
                <div
                  key={run.id}
                  onClick={() => setSelectedAgentInspect(run)}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{run.agentTitle}</span>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        run.status === 'APPROVED' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      ✓ {run.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2">
                    <OfficeValueRenderer value={run.inputSummary} compact />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                    <span>Tokens: {run.inputTokens + run.outputTokens}</span>
                    <span>Custo: ${run.costUsd.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </OfficeErrorBoundary>
        </div>
      </div>

      {/* Inspector Modal for Selected Agent Run */}
      {selectedAgentInspect && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase">INSPECTOR DE CORRIDAS</span>
                <h3 className="text-lg font-bold text-white">{selectedAgentInspect.agentTitle}</h3>
              </div>
              <button
                onClick={() => setSelectedAgentInspect(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-lg"
              >
                Fechar ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 font-bold block mb-1">Entregável do Especialista:</span>
                <OfficeValueRenderer
                  value={selectedAgentInspect.outputFindings}
                  context={{ componentName: 'AgentRunInspector', missionId, agentRole: selectedAgentInspect.agentRole }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
