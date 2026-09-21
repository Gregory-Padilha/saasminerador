'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight, Layers, RefreshCw, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ImportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: {
    fileName: string;
    totalRows: number;
    newCount: number;
    updatedCount: number;
    ignoredCount: number;
    invalidCount: number;
  };
}

export function ImportReportModal({
  isOpen,
  onClose,
  report,
}: ImportReportModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#06b6d4', '#8b5cf6'],
        });
      } catch {
        // ignore in non-browser or test env
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">
            Importação Concluída com Sucesso!
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Arquivo processado: <span className="text-slate-200 font-semibold">{report.fileName}</span>
          </p>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3 my-6">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Novas Ofertas
            </span>
            <span className="text-2xl font-bold text-emerald-400 tabular-numbers mt-1 block">
              +{report.newCount}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Ofertas Atualizadas
            </span>
            <span className="text-2xl font-bold text-blue-400 tabular-numbers mt-1 block">
              {report.updatedCount}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Duplicatas Ignoradas
            </span>
            <span className="text-2xl font-bold text-amber-400 tabular-numbers mt-1 block">
              {report.ignoredCount}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Inválidas Salvas
            </span>
            <span className="text-2xl font-bold text-slate-300 tabular-numbers mt-1 block">
              {report.invalidCount}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => {
              onClose();
              router.push('/offers');
            }}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition active:scale-95"
          >
            <Layers className="w-4 h-4" />
            <span>VER BANCO DE OFERTAS</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-sm font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
