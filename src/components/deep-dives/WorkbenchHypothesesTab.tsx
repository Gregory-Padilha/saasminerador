'use client';

import React, { useState } from 'react';
import { DeepDive, DeepDiveHypothesis } from '@/types';
import {
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface WorkbenchHypothesesTabProps {
  deepDive: DeepDive;
  hypotheses: DeepDiveHypothesis[];
  onCreateHypothesis: (data: Partial<DeepDiveHypothesis>) => Promise<void>;
  onUpdateHypothesis: (id: string, data: Partial<DeepDiveHypothesis>) => Promise<void>;
  onDeleteHypothesis: (id: string) => Promise<void>;
}

const STATUS_BADGES: Record<
  DeepDiveHypothesis['status'],
  { label: string; color: string }
> = {
  ABERTA: { label: '⏳ Aberta', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  CONFIRMADA: { label: '✅ Confirmada', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  REFUTADA: { label: '❌ Refutada', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  INCONCLUSIVA: { label: '❓ Inconclusiva', color: 'bg-slate-800 text-slate-400 border-slate-700' },
};

export function WorkbenchHypothesesTab({
  deepDive,
  hypotheses,
  onCreateHypothesis,
  onUpdateHypothesis,
  onDeleteHypothesis,
}: WorkbenchHypothesesTabProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const evidence = evidenceText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await onCreateHypothesis({
        deep_dive_id: deepDive.id,
        title: title.trim(),
        description: description.trim(),
        status: 'ABERTA',
        evidence,
      });

      setTitle('');
      setDescription('');
      setEvidenceText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Form (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              Registrar Nova Hipótese
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Crie suposições fundamentadas sobre o motivo da escala, estratégia de oferta ou conversão.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Título da Hipótese *:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: A escala vem principalmente da promessa de quantidade"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Detalhamento (Opcional):
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: A ancoragem de 365 receitas gera percepção de volume irresistível..."
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Evidências Observadas (uma por linha):
              </label>
              <textarea
                rows={3}
                value={evidenceText}
                onChange={(e) => setEvidenceText(e.target.value)}
                placeholder="- 28 anúncios ativos&#10;- 6 criativos com mesmo hook&#10;- Mockup mostrando empilhamento"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/20 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Salvar Hipótese
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Hypotheses List (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Hipóteses da Investigação ({hypotheses.length})
        </h4>

        {hypotheses.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-2xl">
            Nenhuma hipótese registrada ainda. Adicione a primeira hipótese ao lado.
          </div>
        ) : (
          <div className="space-y-3">
            {hypotheses.map((h) => {
              const badge = STATUS_BADGES[h.status];

              return (
                <div
                  key={h.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm hover:border-slate-700 transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{h.title}</h4>
                    </div>

                    <button
                      onClick={() => onDeleteHypothesis(h.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition"
                      title="Excluir hipótese"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {h.description && (
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {h.description}
                    </p>
                  )}

                  {h.evidence && h.evidence.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                        Evidências:
                      </span>
                      <ul className="space-y-1 text-xs font-mono text-slate-300">
                        {h.evidence.map((ev, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-purple-400 font-bold">•</span>
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Status Change Selector */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Mudar Status:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['ABERTA', 'CONFIRMADA', 'REFUTADA', 'INCONCLUSIVA'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => onUpdateHypothesis(h.id, { status: st })}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                            h.status === st
                              ? STATUS_BADGES[st].color
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
