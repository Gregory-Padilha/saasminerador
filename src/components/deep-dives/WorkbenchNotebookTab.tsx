'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DeepDive } from '@/types';
import {
  FileText,
  Save,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface WorkbenchNotebookTabProps {
  deepDive: DeepDive;
  onUpdateNotes: (notes: Record<string, string>) => Promise<void>;
}

export function WorkbenchNotebookTab({
  deepDive,
  onUpdateNotes,
}: WorkbenchNotebookTabProps) {
  const initialNotes = typeof deepDive.notes === 'object' && deepDive.notes !== null
    ? deepDive.notes
    : { notebook: typeof deepDive.notes === 'string' ? deepDive.notes : '' };

  const [notes, setNotes] = useState<Record<string, string>>({
    observacoes: initialNotes.observacoes || initialNotes.notebook || '',
    perguntas: initialNotes.perguntas || '',
    conclusoes: initialNotes.conclusoes || '',
  });

  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFieldChange = (key: string, value: string) => {
    const updated = { ...notes, [key]: value };
    setNotes(updated);
    setSavingState('saving');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await onUpdateNotes(updated);
        setSavingState('saved');
        setTimeout(() => setSavingState('idle'), 2000);
      } catch (err) {
        console.error('Auto-save notes error:', err);
        setSavingState('idle');
      }
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Caderno de Investigação Livre</h3>
            <p className="text-xs text-slate-400">
              Escreva livremente suas impressões, perguntas e conclusões sobre esta oferta.
            </p>
          </div>
        </div>

        <div className="text-xs font-mono font-medium flex items-center gap-1.5">
          {savingState === 'saving' && (
            <span className="text-amber-400 flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              Salvando...
            </span>
          )}
          {savingState === 'saved' && (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Salvo ✓
            </span>
          )}
          {savingState === 'idle' && (
            <span className="text-slate-400">Salvo automaticamente</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field 1: Observações Gerais */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-200">
            📝 Observações Gerais & Estratégia
          </label>
          <p className="text-[11px] text-slate-400">
            Descreva o que chamou sua atenção no posicionamento, linguagem e mecânica da oferta.
          </p>
          <textarea
            rows={10}
            value={notes.observacoes || ''}
            onChange={(e) => handleFieldChange('observacoes', e.target.value)}
            placeholder="Digite aqui suas observações principais..."
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-sans placeholder-slate-600 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Field 2: Perguntas Abertas & Pontos a Investigar */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-200">
            ❓ Perguntas Abertas & Dúvidas
          </label>
          <p className="text-[11px] text-slate-400">
            O que ainda não está claro? Ex: 'Como tratam reembolso?', 'Como é a entrega no WhatsApp?'
          </p>
          <textarea
            rows={10}
            value={notes.perguntas || ''}
            onChange={(e) => handleFieldChange('perguntas', e.target.value)}
            placeholder="Registre suas perguntas para responder ao longo da pesquisa..."
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-sans placeholder-slate-600 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Field 3: Conclusões Finais (Full Width) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-200">
            🎯 Conclusões & Pontos de Aprendizado
          </label>
          <p className="text-[11px] text-slate-400">
            Resuma a principal lição desta oferta e o que pode ser modelado para suas operações.
          </p>
          <textarea
            rows={6}
            value={notes.conclusoes || ''}
            onChange={(e) => handleFieldChange('conclusoes', e.target.value)}
            placeholder="Principais conclusões extraídas..."
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-sans placeholder-slate-600 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
    </div>
  );
}
