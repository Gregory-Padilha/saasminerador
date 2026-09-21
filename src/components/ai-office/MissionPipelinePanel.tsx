'use client';

import React from 'react';
import { OfficeEvent, LiveOfficeVisualState } from '@/lib/ai-office/events';
import { computeMissionPipelineSteps, MissionStepProgress } from '@/lib/ai-office/mission-pipeline';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Layers,
  Sparkles,
  ArrowRight,
  Shield,
  Building2,
  User,
} from 'lucide-react';

interface MissionPipelinePanelProps {
  events: OfficeEvent[];
  visualState: LiveOfficeVisualState;
  missionTitle?: string;
  missionGoal?: string;
}

export function MissionPipelinePanel({ events, visualState, missionTitle, missionGoal }: MissionPipelinePanelProps) {
  const steps = computeMissionPipelineSteps(events, visualState);
  const completedCount = steps.filter((s) => s.status === 'COMPLETED').length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'market':
        return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
      case 'offer':
        return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10';
      case 'gtm':
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      default:
        return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <span className="text-xs font-bold text-purple-400 font-mono uppercase tracking-widest px-2.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
            FLUXO OPERACIONAL DE 11 ETAPAS
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {missionTitle || 'Linha de Produção da Missão'}
          </h2>
          {missionGoal && <p className="text-xs text-slate-400 max-w-2xl">{missionGoal}</p>}
        </div>

        {/* Progress Pill */}
        <div className="flex items-center gap-4 bg-slate-950 px-5 py-3 rounded-2xl border border-slate-800 self-start md:self-auto">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono block">Progresso Geral</span>
            <span className="text-lg font-extrabold font-mono text-purple-400">{progressPercent}% Concluído</span>
          </div>
          <div className="w-24 bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 11 Steps Operational Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {steps.map((step) => {
          const isCompleted = step.status === 'COMPLETED';
          const isInProgress = step.status === 'IN_PROGRESS';
          const isBlocked = step.status === 'BLOCKED';

          return (
            <div
              key={step.id}
              className={`p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden ${
                isCompleted
                  ? 'bg-slate-950/90 border-emerald-500/40 text-slate-200'
                  : isInProgress
                  ? 'bg-purple-950/20 border-purple-500/50 text-white shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
                  : isBlocked
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                  : 'bg-slate-950/50 border-slate-800/80 text-slate-400 opacity-80'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  ETAPA {step.id.toString().padStart(2, '0')}
                </span>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
                    isCompleted
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : isInProgress
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 animate-pulse'
                      : isBlocked
                      ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  {isInProgress && <Play className="w-3 h-3 text-purple-400" />}
                  {isBlocked && <AlertCircle className="w-3 h-3 text-rose-400" />}
                  {step.status}
                </span>
              </div>

              {/* Title */}
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">{step.title}</h4>
                <span className="text-[11px] text-slate-400 font-mono mt-1 block flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-500" />
                  <span>{step.responsibleAgentName}</span>
                </span>
              </div>

              {/* Output Snippet */}
              {step.outputSummary && (
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Saída / Tarefa:</span>
                  <p className="text-[11px] font-mono text-slate-300 line-clamp-2 bg-slate-900/80 p-2 rounded-xl border border-slate-800/60">
                    {step.outputSummary}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
