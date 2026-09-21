'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OfficeMissionRecord } from '@/lib/supabase/office-db';
import { IsometricImageCanvas } from './IsometricImageCanvas';
import { reduceOfficeEvents, LiveOfficeVisualState } from '@/lib/ai-office/events';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Play,
  Sparkles,
  Users,
  Compass,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface ExpandableOfficePanelProps {
  activeMission?: OfficeMissionRecord | null;
  onOpenNewMission: () => void;
}

export function ExpandableOfficePanel({ activeMission, onOpenNewMission }: ExpandableOfficePanelProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [visualState, setVisualState] = useState<LiveOfficeVisualState>(() =>
    reduceOfficeEvents([], activeMission?.id || 'idle')
  );
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Load persistence from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('office_view_open');
      if (saved === 'true') {
        setIsExpanded(true);
      }
    }
  }, []);

  // Fetch real mission events if an active mission is running
  useEffect(() => {
    if (!activeMission?.id) {
      setVisualState(reduceOfficeEvents([], 'idle'));
      return;
    }

    let isMounted = true;
    async function loadEvents() {
      try {
        const res = await fetch(`/api/office/events?missionId=${activeMission!.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.events && isMounted) {
            setVisualState(reduceOfficeEvents(data.events, activeMission!.id));
          }
        }
      } catch (err) {
        console.error('Error fetching office panel events:', err);
      }
    }

    loadEvents();
    const interval = setInterval(loadEvents, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeMission?.id]);

  const toggleExpand = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('office_view_open', nextState ? 'true' : 'false');
    }
  };

  const handleFullscreenRoute = () => {
    if (activeMission?.id) {
      router.push(`/office/live/${activeMission.id}`);
    } else {
      router.push('/office/live');
    }
  };

  const hasActiveMission = Boolean(activeMission);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
      {/* 1. COMPACT PREVIEW BAR (COLLAPSED / HEADER STATE) */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            {hasActiveMission ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ● ESCRITÓRIO AO VIVO EM EXECUÇÃO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                ● ESCRITÓRIO ABERTO (IDLE)
              </span>
            )}

            <span className="text-xs font-mono text-slate-400 font-semibold">
              13 Agentes Disponíveis
            </span>
          </div>

          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              {hasActiveMission ? activeMission!.title : 'Escritório Digital de Inteligência'}
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              {hasActiveMission
                ? activeMission!.goal
                : 'Os 13 agentes estão no escritório em modo livre (Idle). Abra o mapa interativo para assistir a operação ao vivo.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={toggleExpand}
            className={`px-5 py-3 rounded-2xl font-extrabold text-xs transition-all shadow-lg flex items-center gap-2 ${
              isExpanded
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : hasActiveMission
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>
              {isExpanded
                ? 'Recolher Escritório'
                : hasActiveMission
                ? '◉ ACOMPANHAR AO VIVO'
                : '🏢 ABRIR ESCRITÓRIO'}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. EXPANDED CANVAS AREA (65-75vh Height) */}
      {isExpanded && (
        <div className="p-4 sm:p-6 bg-slate-950 space-y-3 animate-in fade-in duration-200">
          {/* Sticky Mini Toolbar on Canvas Top */}
          <div className="flex items-center justify-between bg-slate-900/90 p-2.5 px-4 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-purple-400" />
                ESCRITÓRIO REAL (HABBO PIXEL ART)
              </span>
              <span className="w-px h-3.5 bg-slate-800" />
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  hasActiveMission
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}
              >
                {hasActiveMission ? '● LIVE' : '● IDLE'}
              </span>
              <span className="text-slate-400 text-[11px] font-mono hidden sm:inline">
                13 Agentes No Escritório (Diretoria, Heads, Mercado, Oferta, GTM, Copa, Arcade)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(100)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-semibold text-slate-300"
              >
                Fit
              </button>
              <button
                onClick={() => setZoomLevel(110)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-semibold text-slate-300"
              >
                100%
              </button>

              <button
                onClick={handleFullscreenRoute}
                className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1"
                title="Abrir em Tela Cheia"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Tela Cheia</span>
              </button>

              <button
                onClick={toggleExpand}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                title="Recolher"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive PixiJS Natural Image Canvas */}
          <div className="w-full h-[65vh] min-h-[580px] max-h-[720px] rounded-2xl overflow-hidden border border-slate-800 bg-[#090d14]">
            <IsometricImageCanvas
              visualState={visualState}
              zoomLevel={zoomLevel}
              onSelectAgent={(roleId) => {
                if (hasActiveMission) {
                  router.push(`/office/live/${activeMission!.id}`);
                } else {
                  router.push('/office/live');
                }
              }}
            />
          </div>

          {/* Bottom Footer Caption */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 pt-1">
            <span>
              {hasActiveMission
                ? `Fase Ativa: ${activeMission!.status}  |  13 Agentes operando em tempo real`
                : 'Escritório em modo livre  |  Nenhuma missão em execução'}
            </span>
            <span className="text-amber-400 font-semibold">$0,00 Custos Adicionais Idle</span>
          </div>
        </div>
      )}
    </div>
  );
}
