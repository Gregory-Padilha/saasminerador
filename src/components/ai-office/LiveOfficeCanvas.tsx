'use client';

import React, { useState, useEffect } from 'react';
import { LiveOfficeVisualState, VisualAgentState } from '@/lib/ai-office/events';
import { OFFICE_LAYOUT, Point2D } from '@/lib/ai-office/live/office-layout';
import { CharacterSprite } from './CharacterSprite';
import {
  Building2,
  Users,
  BookOpen,
  FileCheck,
  Briefcase,
  Layers,
  Sparkles,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

interface LiveOfficeCanvasProps {
  visualState: LiveOfficeVisualState;
  onSelectAgent: (roleId: string) => void;
  onSelectDepartment: (deptKey: 'market' | 'offer' | 'gtm' | 'executive') => void;
  onOpenCaseFile: () => void;
  selectedAgentId?: string;
  zoomLevel?: number; // 80, 100, 120
}

export function LiveOfficeCanvas({
  visualState,
  onSelectAgent,
  onSelectDepartment,
  onOpenCaseFile,
  selectedAgentId,
  zoomLevel = 100,
}: LiveOfficeCanvasProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Compute character coordinates based on state & location
  const getAgentPosition = (agent: VisualAgentState): Point2D => {
    const layout = OFFICE_LAYOUT[agent.roleId];
    if (!layout) return { x: 50, y: 50 };

    switch (agent.currentLocation) {
      case 'meeting':
        return layout.meetingPosition;
      case 'library':
        return layout.libraryPosition;
      case 'desk':
      default:
        return layout.deskPosition;
    }
  };

  const scale = zoomLevel / 100;

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-4 min-h-[640px] flex flex-col justify-center items-center select-none">
      {/* Background Grid & Ambient Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      {/* Office Floor Plan Outer Container */}
      <div
        className="relative w-full max-w-[1200px] h-[600px] transition-transform duration-300 ease-out"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        {/* FLOOR TILES & SECTIONS */}

        {/* 1. EXECUTIVE ROOM (Top Center) */}
        <div
          onClick={() => onSelectDepartment('executive')}
          className="absolute top-[5%] left-[38%] w-[24%] h-[24%] bg-purple-950/20 border border-purple-500/30 rounded-lg p-3 hover:border-purple-500/60 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-purple-400 uppercase flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-purple-400" />
              SALA DA DIRETORIA
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              SÍNTESE DE TESES
            </span>
          </div>

          {/* Director Desk Graphic */}
          <div className="absolute top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-28 h-10 bg-slate-900 border border-purple-500/40 rounded-md shadow-inner flex items-center justify-center">
            <div className="w-8 h-4 bg-purple-500/20 border border-purple-500/40 rounded flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            </div>
          </div>
        </div>

        {/* 2. MARKET & VALIDATION DEPARTMENT (Top Left) */}
        <div
          onClick={() => onSelectDepartment('market')}
          className={`absolute top-[18%] left-[5%] w-[30%] h-[38%] bg-cyan-950/20 border rounded-lg p-3 hover:border-cyan-500/60 transition-colors cursor-pointer group ${
            visualState.departmentStatuses.market === 'APPROVED'
              ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'border-cyan-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <Users className="w-3 h-3 text-cyan-400" />
              DEPT. MERCADO & VALIDAÇÃO
            </span>
            {visualState.departmentStatuses.market === 'APPROVED' ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> APROVADO
              </span>
            ) : (
              <span className="text-[9px] text-cyan-300/70">4 AGENTES</span>
            )}
          </div>

          {/* Department Floor Desks */}
          <div className="relative w-full h-full">
            {/* Head Desk */}
            <div className="absolute top-[10%] left-[40%] w-16 h-8 bg-slate-900 border border-cyan-500/40 rounded shadow-sm" />
            {/* Specialist Desks */}
            <div className="absolute top-[40%] left-[20%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
            <div className="absolute top-[40%] left-[60%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
            <div className="absolute top-[70%] left-[40%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
          </div>
        </div>

        {/* 3. OFFER ARCHITECTURE DEPARTMENT (Top Right) */}
        <div
          onClick={() => onSelectDepartment('offer')}
          className={`absolute top-[28%] right-[5%] w-[30%] h-[38%] bg-indigo-950/20 border rounded-lg p-3 hover:border-indigo-500/60 transition-colors cursor-pointer group ${
            visualState.departmentStatuses.offer === 'APPROVED'
              ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'border-indigo-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-indigo-400" />
              DEPT. ARQUITETURA DE OFERTA
            </span>
            {visualState.departmentStatuses.offer === 'APPROVED' ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> APROVADO
              </span>
            ) : (
              <span className="text-[9px] text-indigo-300/70">4 AGENTES</span>
            )}
          </div>

          <div className="relative w-full h-full">
            {/* Head Desk */}
            <div className="absolute top-[50%] right-[10%] w-16 h-8 bg-slate-900 border border-indigo-500/40 rounded shadow-sm" />
            {/* Specialist Desks */}
            <div className="absolute top-[20%] right-[30%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
            <div className="absolute top-[20%] right-[65%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
            <div className="absolute top-[75%] right-[30%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
          </div>
        </div>

        {/* 4. GO-TO-MARKET DEPARTMENT (Bottom Left) */}
        <div
          onClick={() => onSelectDepartment('gtm')}
          className={`absolute bottom-[5%] left-[5%] w-[30%] h-[35%] bg-emerald-950/20 border rounded-lg p-3 hover:border-emerald-500/60 transition-colors cursor-pointer group ${
            visualState.departmentStatuses.gtm === 'APPROVED'
              ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
              <Briefcase className="w-3 h-3 text-emerald-400" />
              DEPT. GO-TO-MARKET
            </span>
            {visualState.departmentStatuses.gtm === 'APPROVED' ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> APROVADO
              </span>
            ) : (
              <span className="text-[9px] text-emerald-300/70">4 AGENTES</span>
            )}
          </div>

          <div className="relative w-full h-full">
            {/* Head Desk */}
            <div className="absolute top-[15%] left-[40%] w-16 h-8 bg-slate-900 border border-emerald-500/40 rounded shadow-sm" />
            {/* Specialist Desks */}
            <div className="absolute top-[45%] left-[20%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
            <div className="absolute top-[45%] left-[60%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
            <div className="absolute top-[75%] left-[40%] w-14 h-7 bg-slate-900 border border-slate-700 rounded shadow-sm" />
          </div>
        </div>

        {/* 5. MEETING ROOM / REVIEW BOARD (Bottom Center) */}
        <div className="absolute bottom-[5%] left-[38%] w-[24%] h-[24%] bg-slate-900/60 border border-amber-500/30 rounded-lg p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              MESA DE VALIDAÇÃO
            </span>
            {visualState.meetingRoomState.isMeetingActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                EM REVISÃO
              </span>
            )}
          </div>

          {/* Oval Meeting Table */}
          <div className="absolute top-[55%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-32 h-14 bg-amber-950/30 border border-amber-500/40 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-[9px] font-semibold text-amber-300/80 tracking-wide">
              {visualState.meetingRoomState.isMeetingActive ? 'REUNIÃO EM ANDAMENTO' : 'SALA DE REUNIÃO'}
            </span>
          </div>
        </div>

        {/* 6. KNOWLEDGE LIBRARY (Top Right) */}
        <div className="absolute top-[5%] right-[5%] w-[25%] h-[20%] bg-blue-950/20 border border-blue-500/30 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase flex items-center gap-1.5">
              <BookOpen className="w-3 h-3 text-blue-400" />
              BIBLIOTECA DE CONHECIMENTO
            </span>
            <span className="text-[9px] text-blue-300/60">ACERVO DO CÉREBRO</span>
          </div>

          {/* Bookshelf graphic */}
          <div className="w-full h-8 bg-slate-900 border border-blue-500/30 rounded flex items-center px-3 gap-2">
            <div className="w-3 h-5 bg-blue-500/30 rounded-sm border border-blue-400/40" />
            <div className="w-3 h-6 bg-cyan-500/30 rounded-sm border border-cyan-400/40" />
            <div className="w-3 h-4 bg-indigo-500/30 rounded-sm border border-indigo-400/40" />
            <div className="w-3 h-5 bg-purple-500/30 rounded-sm border border-purple-400/40" />
            <span className="text-[9px] text-slate-400 ml-auto font-mono">search_knowledge</span>
          </div>
        </div>

        {/* 7. CASE FILE LIVE TERMINAL (Center) */}
        <div
          onClick={onOpenCaseFile}
          className="absolute top-[42%] left-[38%] w-[24%] h-[20%] bg-slate-900/90 border border-slate-700 hover:border-slate-500 rounded-lg p-3 cursor-pointer shadow-xl transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5 group-hover:text-blue-400">
              <FileCheck className="w-3.5 h-3.5 text-blue-400" />
              CASE FILE LIVE
            </span>
            <span className="text-[9px] text-slate-400 group-hover:underline">VER DETALHES →</span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-slate-950 p-1 rounded border border-slate-800">
              <span className="block text-[8px] text-slate-400 uppercase">Evidências</span>
              <span className="text-xs font-bold text-cyan-400">{visualState.caseFileMetrics.evidenceCount}</span>
            </div>
            <div className="bg-slate-950 p-1 rounded border border-slate-800">
              <span className="block text-[8px] text-slate-400 uppercase">Hipóteses</span>
              <span className="text-xs font-bold text-indigo-400">{visualState.caseFileMetrics.hypothesesCount}</span>
            </div>
            <div className="bg-slate-950 p-1 rounded border border-slate-800">
              <span className="block text-[8px] text-slate-400 uppercase">Teses Ativas</span>
              <span className="text-xs font-bold text-purple-400">{visualState.caseFileMetrics.activeThesesCount}</span>
            </div>
            <div className="bg-slate-950 p-1 rounded border border-slate-800">
              <span className="block text-[8px] text-slate-400 uppercase">Rejeitadas</span>
              <span className="text-xs font-bold text-slate-400">{visualState.caseFileMetrics.rejectedCount}</span>
            </div>
            <div className="bg-slate-950 p-1 rounded border border-slate-800">
              <span className="block text-[8px] text-slate-400 uppercase">Contradições</span>
              <span className="text-xs font-bold text-amber-400">{visualState.caseFileMetrics.contradictionsCount}</span>
            </div>
            <div className="bg-slate-950 p-1 rounded border border-slate-800">
              <span className="block text-[8px] text-slate-400 uppercase">Decisões</span>
              <span className="text-xs font-bold text-emerald-400">{visualState.caseFileMetrics.decisionsCount}</span>
            </div>
          </div>
        </div>

        {/* 8. AGENT CHARACTERS PLACEMENT */}
        {Object.values(visualState.agents).map((agent) => {
          const pos = getAgentPosition(agent);

          return (
            <div
              key={agent.roleId}
              className="absolute pointer-events-auto"
              style={{
                top: `${pos.y}%`,
                left: `${pos.x}%`,
                transition: prefersReducedMotion ? 'none' : 'top 1s ease-in-out, left 1s ease-in-out',
              }}
            >
              <CharacterSprite
                agent={agent}
                onClick={() => onSelectAgent(agent.roleId)}
                isSelected={selectedAgentId === agent.roleId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
