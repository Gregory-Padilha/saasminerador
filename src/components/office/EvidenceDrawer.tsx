'use client';

import React from 'react';
import { X, Layers, ExternalLink, HelpCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  decision: any | null;
}

export function EvidenceDrawer({ isOpen, onClose, decision }: EvidenceDrawerProps) {
  if (!isOpen || !decision) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-xl bg-slate-950 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              EXPLORADOR DE EVIDÊNCIAS
            </span>
            <h3 className="text-lg font-bold text-white">{decision.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Badge & Decision Type */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Tipo de Decisão: {decision.decisionType}</span>
          <span className={`text-xs font-bold font-mono px-3 py-1 rounded-full border ${
            decision.status === 'APPROVED' || decision.status === 'VALIDATED'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : decision.status === 'HYPOTHESIS'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            ● {decision.status}
          </span>
        </div>

        {/* Value & Rationale */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Decisão Escolhida:</h4>
          <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-purple-200 font-semibold text-sm">
            {typeof decision.value === 'string' ? decision.value : JSON.stringify(decision.value)}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            Por que esta escolha foi feita? (Justificativa):
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed p-4 rounded-2xl bg-slate-900 border border-slate-800">
            {decision.rationale}
          </p>
        </div>

        {/* Evidence References */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-400" />
            Fontes & Ofertas de Referência:
          </h4>
          <div className="space-y-2">
            {decision.evidenceRefs && decision.evidenceRefs.length > 0 ? (
              decision.evidenceRefs.map((ref: string, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 flex items-center justify-between">
                  <span>📎 {ref}</span>
                  <span className="text-[10px] text-purple-300 font-mono">Catálogo</span>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-xl bg-slate-900 text-xs text-slate-500">
                Padrão inferido com base na inteligência agregada do setor.
              </div>
            )}
          </div>
        </div>

        {/* Alternatives Considered */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Alternativas Descartadas:</h4>
          <div className="space-y-2">
            {decision.alternativesConsidered && decision.alternativesConsidered.length > 0 ? (
              decision.alternativesConsidered.map((alt: string, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 line-through opacity-80">
                  ✕ {alt}
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500">Nenhuma alternativa explícita rejeitada.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
