'use client';

import React from 'react';
import { OfficeEvent, LiveOfficeVisualState } from '@/lib/ai-office/events';
import { computeLivePartialDeliverables } from '@/lib/ai-office/mission-pipeline';
import {
  FileCheck,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Layers,
  Flame,
  Lightbulb,
  Tag,
  PenTool,
  CheckCircle2,
} from 'lucide-react';

interface LiveDeliverablesPanelProps {
  events: OfficeEvent[];
  visualState: LiveOfficeVisualState;
}

export function LiveDeliverablesPanel({ events, visualState }: LiveDeliverablesPanelProps) {
  const d = computeLivePartialDeliverables(events, visualState);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            RESULTADOS EM CONSTRUÇÃO
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Entregáveis em Tempo Real
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Insumos consolidados autonomamente à medida que os agentes progridem na missão.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Sincronização Ao Vivo</span>
        </div>
      </div>

      {/* Grid of Dynamic Live Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Dores e Desejos (Market) */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Flame className="w-4 h-4 text-cyan-400" />
              1. Dores & Desejos Mapeados
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Signal Miner & Audience</span>
          </div>

          {d.painsAndDesires ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-mono text-[10px] uppercase block mb-1">Dores Recorrentes:</span>
                <ul className="space-y-1 text-slate-200">
                  {d.painsAndDesires.pains.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-slate-400 font-mono text-[10px] uppercase block mb-1">Desejos Validados:</span>
                <ul className="space-y-1 text-slate-200">
                  {d.painsAndDesires.desires.map((des, i) => (
                    <li key={i} className="flex items-start gap-1.5 bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{des}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-4">Aguardando mapeamento pelo Signal Miner...</div>
          )}
        </div>

        {/* 2. Promessa Central & Posicionamento (Offer DNA) */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-indigo-400" />
              2. Promessa Central & Ângulos
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Offer DNA Analyst</span>
          </div>

          {d.offerPromise ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-mono text-[10px] uppercase block mb-1">Promessa Central:</span>
                <p className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 font-bold leading-relaxed">
                  "{d.offerPromise.corePromise}"
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-mono text-[10px] uppercase block mb-1">Ângulos de Posicionamento:</span>
                <ul className="space-y-1 text-slate-200">
                  {d.offerPromise.angles.map((ang, i) => (
                    <li key={i} className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-slate-300">
                      {i + 1}. {ang}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-4">Aguardando definição da promessa pelo Offer DNA...</div>
          )}
        </div>

        {/* 3. Mecanismo Único & Veículo (Product Architect) */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              3. Mecanismo Único & Veículo
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Product Architect</span>
          </div>

          {d.uniqueMechanism ? (
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-200 space-y-1">
                <span className="text-[10px] text-purple-400 block font-bold">MECANISMO:</span>
                <span className="font-extrabold text-sm">{d.uniqueMechanism.mechanismName}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 space-y-1">
                <span className="text-[10px] text-slate-500 block font-bold">VEÍCULO DE ENTREGA:</span>
                <span>{d.uniqueMechanism.vehicleType}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-4">Aguardando arquitetura de produto...</div>
          )}
        </div>

        {/* 4. Precificação & Order Bumps (Pricing Strategist) */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              4. Precificação & Monetização
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Pricing Strategist</span>
          </div>

          {d.pricingAndBump ? (
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300">
                <span>Front-End:</span>
                <span className="font-extrabold text-sm">{d.pricingAndBump.frontEndPrice}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
                {d.pricingAndBump.suggestedBump}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
                {d.pricingAndBump.upsellIdea}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-4">Aguardando cálculo de precificação...</div>
          )}
        </div>
      </div>
    </div>
  );
}
