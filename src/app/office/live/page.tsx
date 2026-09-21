'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IsometricImageCanvas } from '@/components/ai-office/IsometricImageCanvas';
import { OfficeErrorBoundary } from '@/components/ai-office/OfficeErrorBoundary';
import { reduceOfficeEvents, LiveOfficeVisualState } from '@/lib/ai-office/events';
import {
  Building2,
  ArrowLeft,
  Plus,
} from 'lucide-react';

export default function StandaloneLiveIdleOfficePage() {
  const router = useRouter();

  // Idle Visual State for 13 agents
  const [visualState] = useState<LiveOfficeVisualState>(() =>
    reduceOfficeEvents([], 'idle')
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. TOP NAVIGATION HEADER */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/office"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Voltar para a Home do Escritório"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Voltar ao Escritório</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                ESCRITÓRIO AO VIVO (MODO IDLE)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                SISTEMA OPERACIONAL
              </span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">
              13 Agentes No Escritório
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Estado Geral</span>
            <span className="font-semibold text-emerald-400 font-mono">Idle / Leisure</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Custos LLM Extra</span>
            <span className="font-mono font-bold text-amber-300">$0,00</span>
          </div>

          <Link
            href="/office"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>NOVA MISSÃO</span>
          </Link>
        </div>
      </header>

      {/* 2. UNIFIED FULLSCREEN ISOMETRIC CANVAS */}
      <main className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center">
        <OfficeErrorBoundary widgetName="StandaloneIdleCanvas">
          <div className="w-full h-[calc(100vh-120px)] min-h-[640px]">
            <IsometricImageCanvas
              visualState={visualState}
              events={[]}
              showNavHeader={false}
            />
          </div>
        </OfficeErrorBoundary>
      </main>
    </div>
  );
}
