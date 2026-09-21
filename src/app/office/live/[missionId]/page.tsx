'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IsometricImageCanvas } from '@/components/ai-office/IsometricImageCanvas';
import { MissionPipelinePanel } from '@/components/ai-office/MissionPipelinePanel';
import { LiveDeliverablesPanel } from '@/components/ai-office/LiveDeliverablesPanel';
import { OfficeValueRenderer } from '@/components/ai-office/OfficeValueRenderer';
import { OfficeErrorBoundary } from '@/components/ai-office/OfficeErrorBoundary';
import { reduceOfficeEvents, OfficeEvent, LiveOfficeVisualState } from '@/lib/ai-office/events';
import { OFFICE_ROLES } from '@/lib/ai-office/roles/registry';
import {
  Play,
  Pause,
  Building2,
  FileText,
  Activity,
  Layers,
  ArrowLeft,
  X,
  Sparkles,
  FileCheck,
  CheckCircle2,
  ListOrdered,
  ExternalLink,
} from 'lucide-react';

interface LiveOfficePageProps {
  params: Promise<{ missionId: string }>;
}

export default function LiveOfficePage({ params }: LiveOfficePageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const missionId = resolvedParams.missionId;

  // View state: 'OFFICE' | 'PIPELINE' | 'DELIVERABLES' | 'CASEFILE' | 'ACTIVITY'
  const [activeView, setActiveView] = useState<'OFFICE' | 'PIPELINE' | 'DELIVERABLES' | 'CASEFILE' | 'ACTIVITY'>('OFFICE');

  // Controls & Playback
  const [isPlaying, setIsPlaying] = useState(true);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(1);

  // Events & State Reducer
  const [rawEvents, setRawEvents] = useState<OfficeEvent[]>([]);
  const [visualState, setVisualState] = useState<LiveOfficeVisualState>(() =>
    reduceOfficeEvents([], missionId)
  );

  // Inspector & Mission Info
  const [missionTitle, setMissionTitle] = useState('Carregando Missão...');
  const [missionGoal, setMissionGoal] = useState('');
  const [missionStatus, setMissionStatus] = useState<string>('PENDING');
  const [offerProjectId, setOfferProjectId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Auto navigation state
  const [cancelAutoNav, setCancelAutoNav] = useState(false);
  const [navCountdown, setNavCountdown] = useState<number | null>(null);

  // Fetch Mission Data & Events
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const resMission = await fetch(`/api/office/missions/${missionId}`);
        if (resMission.ok) {
          const mData = await resMission.json();
          if (mData.mission && isMounted) {
            setMissionTitle(mData.mission.title || 'Nova Oferta de Inteligência');
            setMissionGoal(mData.mission.goal || '');
            setMissionStatus(mData.mission.status || 'PENDING');
            if (mData.mission.offerProjectId) {
              setOfferProjectId(mData.mission.offerProjectId);
            }
          }
        }

        const resEvents = await fetch(`/api/office/events?missionId=${missionId}`);
        if (resEvents.ok) {
          const eData = await resEvents.json();
          if (eData.events && isMounted) {
            setRawEvents(eData.events);
            const nextVisualState = reduceOfficeEvents(eData.events, missionId);
            setVisualState(nextVisualState);
          }
        }
      } catch (err) {
        console.error('Error fetching office live data:', err);
      }
    }

    loadData();

    const interval = setInterval(() => {
      if (isPlaying) {
        loadData();
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 2000 / replaySpeed);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [missionId, isPlaying, replaySpeed]);

  // Handle Auto Navigation when Completed with offerProjectId
  useEffect(() => {
    if (offerProjectId && (missionStatus === 'COMPLETED' || visualState.phase === 'COMPLETED' || visualState.progress === 100) && !cancelAutoNav) {
      if (navCountdown === null) {
        setNavCountdown(1.5);
      }
      const timer = setTimeout(() => {
        router.push(`/office/projects/${offerProjectId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [offerProjectId, missionStatus, visualState.phase, visualState.progress, cancelAutoNav, router, navCountdown]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeAgentsCount = Object.values(visualState.agents).filter(
    (a) => a.state === 'RESEARCHING' || a.state === 'USING_TOOL' || a.state === 'WRITING'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. MISSION HEADER */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/office"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Voltar para a Lista de Missões"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Voltar às Missões</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                ESCRITÓRIO AO VIVO
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">{missionTitle}</h1>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="flex items-center gap-6 text-xs">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Fase Atual</span>
            <span className="font-semibold text-purple-300 font-mono">{visualState.phase}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Tempo Decorrido</span>
            <span className="font-mono font-semibold text-slate-200">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Agentes Ativos</span>
            <span className="font-semibold text-cyan-400 font-mono">{activeAgentsCount} / 13</span>
          </div>
        </div>
      </header>

      {/* 2. CONTROLS BAR & VIEW SWITCHER */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 flex items-center justify-between text-xs">
        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          <button
            onClick={() => setActiveView('OFFICE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'OFFICE'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            MAPA 2.5D
          </button>
          <button
            onClick={() => setActiveView('PIPELINE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'PIPELINE'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            PAINEL DA MISSÃO (11 ETAPAS)
          </button>
          <button
            onClick={() => setActiveView('DELIVERABLES')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'DELIVERABLES'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            ENTREGÁVEIS AO VIVO
          </button>
          <button
            onClick={() => setActiveView('ACTIVITY')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'ACTIVITY'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            EVENTOS ({rawEvents.length})
          </button>
          <button
            onClick={() => setActiveView('CASEFILE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'CASEFILE'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            CASE FILE
          </button>
        </div>

        {/* Playback & Operational Controls */}
        <div className="flex items-center gap-3">
          {(missionStatus === 'COMPLETED' || visualState.phase === 'COMPLETED') ? (
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 font-mono">
              <span className="text-[10px] text-slate-500 uppercase px-1">Replay:</span>
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setReplaySpeed(s as any)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    replaySpeed === s
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                isPlaying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'PAUSAR EXECUÇÃO' : 'CONTINUAR EXECUÇÃO'}
            </button>
          )}

          {offerProjectId && (
            <Link
              href={`/office/projects/${offerProjectId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>VER OFERTA COMPLETA</span>
            </Link>
          )}
        </div>
      </div>

      {/* AUTO NAV & COMPLETION BANNER */}
      {offerProjectId && (missionStatus === 'COMPLETED' || visualState.phase === 'COMPLETED') && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-6 py-3 flex items-center justify-between z-30 backdrop-blur-md animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">✓ OFERTA COMPLETA CRIADA COM SUCESSO!</span>
                <span className="text-xs text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded font-mono border border-emerald-500/30">
                  {cancelAutoNav ? 'Navegação manual' : 'Redirecionando em ~1.5s...'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Os 13 agentes concluíram a síntese. Todos os gates de qualidade passaram.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!cancelAutoNav ? (
              <button
                onClick={() => setCancelAutoNav(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition"
              >
                Continuar assistindo
              </button>
            ) : null}

            <Link
              href={`/office/projects/${offerProjectId}`}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <span>Abrir Projeto Agora</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE VIEW */}
      <main className="flex-1 p-4 sm:p-6 relative flex flex-col items-center">
        <OfficeErrorBoundary widgetName="LiveOfficeMainView">
          {activeView === 'OFFICE' && (
            <div className="w-full h-[calc(100vh-140px)] min-h-[640px]">
              <IsometricImageCanvas
                visualState={visualState}
                events={rawEvents}
                activeMissionTitle={missionTitle}
                showNavHeader={false}
              />
            </div>
          )}

          {/* 11-STEP MISSION PIPELINE VIEW */}
          {activeView === 'PIPELINE' && (
            <div className="w-full max-w-5xl">
              <MissionPipelinePanel
                events={rawEvents}
                visualState={visualState}
                missionTitle={missionTitle}
                missionGoal={missionGoal}
              />
            </div>
          )}

          {/* LIVE DELIVERABLES VIEW */}
          {activeView === 'DELIVERABLES' && (
            <div className="w-full max-w-5xl">
              <LiveDeliverablesPanel
                events={rawEvents}
                visualState={visualState}
              />
            </div>
          )}

          {/* CASE FILE VIEW */}
          {activeView === 'CASEFILE' && (
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                CASE FILE COMPLETO DA MISSÃO
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase block font-mono">Evidências Catalogadas</span>
                  <span className="text-2xl font-extrabold text-cyan-400 font-mono">
                    {visualState.caseFileMetrics.evidenceCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase block font-mono">Hipóteses Ativas</span>
                  <span className="text-2xl font-extrabold text-indigo-400 font-mono">
                    {visualState.caseFileMetrics.hypothesesCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase block font-mono">Teses Ativas</span>
                  <span className="text-2xl font-extrabold text-purple-400 font-mono">
                    {visualState.caseFileMetrics.activeThesesCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase block font-mono">Teses Rejeitadas</span>
                  <span className="text-2xl font-extrabold text-slate-400 font-mono">
                    {visualState.caseFileMetrics.rejectedCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase block font-mono">Contradições</span>
                  <span className="text-2xl font-extrabold text-amber-400 font-mono">
                    {visualState.caseFileMetrics.contradictionsCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase block font-mono">Decisões Tomadas</span>
                  <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                    {visualState.caseFileMetrics.decisionsCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVITY LOG VIEW */}
          {activeView === 'ACTIVITY' && (
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                EVENT LOG OPERACIONAL
              </h2>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {rawEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nenhum evento registrado ainda.</p>
                ) : (
                  rawEvents.map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex items-start gap-3 font-mono"
                    >
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase">
                        {ev.type}
                      </span>
                      <div className="text-slate-300 flex-1">
                        <OfficeValueRenderer value={ev.message} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </OfficeErrorBoundary>
      </main>
    </div>
  );
}
