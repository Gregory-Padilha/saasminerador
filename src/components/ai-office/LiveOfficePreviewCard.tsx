'use client';

import React from 'react';
import Link from 'next/link';
import { OfficeMissionRecord } from '@/lib/supabase/office-db';
import { Building2, ArrowRight, Sparkles, Layers, Users, Briefcase, Play } from 'lucide-react';

interface LiveOfficePreviewCardProps {
  activeMission?: OfficeMissionRecord | null;
  onOpenNewMission: () => void;
}

export function LiveOfficePreviewCard({ activeMission, onOpenNewMission }: LiveOfficePreviewCardProps) {
  if (!activeMission) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ESCRITÓRIO IDLE
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">13 Agentes Disponíveis</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-y border-slate-800/60">
          <div>
            <h3 className="text-base font-bold text-white">Escritório Aguardando Nova Missão</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione "Nova Missão" para iniciar a mineração de sinais de mercado e estruturar um novo produto.
            </p>
          </div>

          <button
            onClick={onOpenNewMission}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-md shadow-amber-500/20 flex items-center gap-1.5 whitespace-nowrap self-start md:self-auto"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>+ INICIAR NOVA MISSÃO</span>
          </button>
        </div>

        {/* Ambient Department Avatars */}
        <div className="grid grid-cols-4 gap-3 text-center text-[11px] pt-1">
          <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-purple-400 font-bold block mb-1">DIRETORIA</span>
            <span className="text-slate-400 text-xs">👤 Diretor</span>
          </div>
          <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-cyan-400 font-bold block mb-1">MERCADO</span>
            <span className="text-slate-400 text-xs">👤 👤 👤 👤</span>
          </div>
          <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-indigo-400 font-bold block mb-1">OFERTA</span>
            <span className="text-slate-400 text-xs">👤 👤 👤 👤</span>
          </div>
          <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold block mb-1">GTM</span>
            <span className="text-slate-400 text-xs">👤 👤 👤 👤</span>
          </div>
        </div>
      </div>
    );
  }

  // Active Mission Preview
  const phaseLabels: Record<string, string> = {
    PLANNING: 'Brief & Alinhamento',
    RESEARCHING: 'Mercado & Sinais',
    ARCHITECTING: 'Arquitetura de Oferta',
    GTM: 'Estratégia Go-To-Market',
    DIRECTOR_REVIEW: 'Sintese do Diretor',
    REVIEW: 'Revisão dos Heads',
  };

  const currentPhase = phaseLabels[activeMission.status] || activeMission.status;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/40 p-6 shadow-2xl space-y-5">
      {/* Live Badge & Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
            ● ESCRITÓRIO AO VIVO EM EXECUÇÃO
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
          Fase: {currentPhase}
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-white">{activeMission.title}</h3>
          <p className="text-xs text-slate-300 mt-1 line-clamp-1">{activeMission.goal}</p>
        </div>

        <Link
          href={`/office/live/${activeMission.id}`}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition shadow-lg shadow-purple-500/30 flex items-center gap-2 whitespace-nowrap self-start md:self-auto"
        >
          <Building2 className="w-4 h-4 text-white" />
          <span>ABRIR ESCRITÓRIO AO VIVO ↗</span>
        </Link>
      </div>

      {/* Mini Office Floor Map Avatars Preview */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-purple-400 font-bold text-[11px]">DIRETORIA</span>
            <span className="text-[9px] text-purple-300">SÍNTESE</span>
          </div>
          <div className="text-slate-200">👤 Diretor</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-bold text-[11px]">MERCADO</span>
            <span className="text-[9px] text-cyan-300">
              {activeMission.status === 'RESEARCHING' ? '● Trabalhando' : '✓ Concluído'}
            </span>
          </div>
          <div className="text-slate-200">👤 Head + 👤 👤 👤</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-indigo-400 font-bold text-[11px]">OFERTA</span>
            <span className="text-[9px] text-indigo-300">
              {activeMission.status === 'ARCHITECTING' ? '● Trabalhando' : activeMission.status === 'RESEARCHING' ? '○ Aguardando' : '✓ Concluído'}
            </span>
          </div>
          <div className="text-slate-200">👤 Head + 👤 👤 👤</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 font-bold text-[11px]">GTM</span>
            <span className="text-[9px] text-emerald-300">
              {activeMission.status === 'GTM' ? '● Trabalhando' : '○ Aguardando'}
            </span>
          </div>
          <div className="text-slate-200">👤 Head + 👤 👤 👤</div>
        </div>
      </div>

      {/* Counters Bar */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
        <span>13 Agentes Alocados</span>
        <span>Perfil: {activeMission.profileId}</span>
        <span className="text-purple-300 font-semibold">● Transmissão de Eventos Ativa</span>
      </div>
    </div>
  );
}
