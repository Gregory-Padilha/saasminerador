'use client';

import React, { useState } from 'react';
import { DeepDive, DeepDiveCaseSummary, DeepDiveStatus } from '@/types';
import {
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Award,
  BookOpen,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface WorkbenchCaseSummaryTabProps {
  deepDive: DeepDive;
  onUpdateChecklist: (checklist: Record<string, boolean>) => Promise<void>;
  onUpdateCaseSummary: (summary: DeepDiveCaseSummary) => Promise<void>;
  onUpdateStatus: (status: DeepDiveStatus) => Promise<void>;
}

const CHECKLIST_ITEMS = [
  { id: 'understand_product', label: '1. Entendi o produto e entregáveis' },
  { id: 'analyze_top_creatives', label: '2. Analisei os melhores criativos' },
  { id: 'analyze_hero_section', label: '3. Analisei a seção Hero da LP' },
  { id: 'analyze_lp_structure', label: '4. Analisei a estrutura completa da LP' },
  { id: 'analyze_pricing_front', label: '5. Analisei o pricing do Front-end' },
  { id: 'analyze_checkout_flow', label: '6. Analisei o fluxo de Checkout' },
  { id: 'analyze_order_bumps', label: '7. Analisei os Order Bumps' },
  { id: 'register_hypothesis', label: '8. Registrei pelo menos 1 hipótese' },
  { id: 'extract_insights', label: '9. Extraí insights estruturados' },
  { id: 'register_tests', label: '10. Registrei ideias para testar' },
];

export function WorkbenchCaseSummaryTab({
  deepDive,
  onUpdateChecklist,
  onUpdateCaseSummary,
  onUpdateStatus,
}: WorkbenchCaseSummaryTabProps) {
  const offer = deepDive.offer;
  const currentChecklist = deepDive.checklist || {};
  const currentSummary = deepDive.case_summary || {
    what_sells: '',
    main_promise: '',
    mechanism: '',
    perceived_value: '',
    price_structure: '',
    creative_pattern: '',
    lp_structure: '',
    checkout_monetization: '',
    key_insights: '',
    test_ideas: '',
    concluded_at: new Date().toISOString(),
  };

  const [formSummary, setFormSummary] = useState<DeepDiveCaseSummary>(currentSummary);
  const [isSaving, setIsSaving] = useState(false);
  const [showIncompleteNotice, setShowIncompleteNotice] = useState(false);

  const completedCount = CHECKLIST_ITEMS.filter((i) => currentChecklist[i.id] === true).length;
  const progressPct = Math.round((completedCount / CHECKLIST_ITEMS.length) * 100);

  const handleToggleCheckitem = async (id: string) => {
    const updated = { ...currentChecklist, [id]: !currentChecklist[id] };
    await onUpdateChecklist(updated);
  };

  const handleSaveSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateCaseSummary({
        ...formSummary,
        concluded_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConcludeDeepDive = async () => {
    if (progressPct < 100 && !showIncompleteNotice) {
      setShowIncompleteNotice(true);
      return;
    }

    await onUpdateCaseSummary({
      ...formSummary,
      concluded_at: new Date().toISOString(),
    });
    await onUpdateStatus('CONCLUIDO');
  };

  return (
    <div className="space-y-6">
      {/* 1. Operational Checklist Panel */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-orange-400" />
              Checklist Operacional da Investigação ({progressPct}% concluído)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Marque as etapas executadas para manter o controle factual do estudo.
            </p>
          </div>

          <div className="text-right">
            <span className="text-base font-black font-mono text-orange-400">
              {completedCount} / {CHECKLIST_ITEMS.length}
            </span>
            <span className="text-[10px] text-slate-500 block uppercase">Etapas concluídas</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {CHECKLIST_ITEMS.map((item) => {
            const isChecked = currentChecklist[item.id] === true;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleToggleCheckitem(item.id)}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition flex items-center gap-2 ${
                  isChecked
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${
                    isChecked
                      ? 'bg-orange-500 border-orange-400 text-white'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {isChecked && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="line-clamp-2">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Case Synthesis Form */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Ficha de Resumo do Case de Inteligência
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sintetize os pilares estratégicos que sustentam esta oferta em um estudo pesquisável.
            </p>
          </div>

          <button
            onClick={handleSaveSummary}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar Resumo'}
          </button>
        </div>

        <form onSubmit={handleSaveSummary} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              O que esta oferta vende?
            </label>
            <input
              type="text"
              value={formSummary.what_sells || ''}
              onChange={(e) => setFormSummary({ ...formSummary, what_sells: e.target.value })}
              placeholder="Ex: Ebook com 365 receitas sem açúcar + 3 bônus de cardápios"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Qual é a principal promessa?
            </label>
            <input
              type="text"
              value={formSummary.main_promise || ''}
              onChange={(e) => setFormSummary({ ...formSummary, main_promise: e.target.value })}
              placeholder="Ex: Emagrecer comendo doces sem açúcar todos os dias"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Qual é o mecanismo único?
            </label>
            <input
              type="text"
              value={formSummary.mechanism || ''}
              onChange={(e) => setFormSummary({ ...formSummary, mechanism: e.target.value })}
              placeholder="Ex: Método de substituição inteligente de ingredientes sem adoçantes amargos"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Como gera valor percebido?
            </label>
            <input
              type="text"
              value={formSummary.perceived_value || ''}
              onChange={(e) => setFormSummary({ ...formSummary, perceived_value: e.target.value })}
              placeholder="Ex: Volume extremo (365 receitas) com preço ridiculamente baixo (R$ 10)"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Padrão dominante nos Criativos:
            </label>
            <input
              type="text"
              value={formSummary.creative_pattern || ''}
              onChange={(e) => setFormSummary({ ...formSummary, creative_pattern: e.target.value })}
              placeholder="Ex: Demonstração rápida do prato pronto + narração simples"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Como o Checkout monetiza?
            </label>
            <input
              type="text"
              value={formSummary.checkout_monetization || ''}
              onChange={(e) => setFormSummary({ ...formSummary, checkout_monetization: e.target.value })}
              placeholder="Ex: 3 Order Bumps de R$ 9,90 aumentam o ticket médio em 150%"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </form>

        {/* Conclude Deep Dive Action Banner */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4 flex-wrap bg-slate-950/60 p-4 rounded-xl">
          <div>
            <span className="text-xs font-bold text-white block">
              Pronto para transformar esta oferta em Case Concluído?
            </span>
            <p className="text-[11px] text-slate-400">
              O estudo ficará salvo na galeria de Cases da Oficina com o snapshot de início e término.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {showIncompleteNotice && (
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Esta investigação possui {progressPct}% do checklist concluído.</span>
              </div>
            )}

            <button
              onClick={handleConcludeDeepDive}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              {showIncompleteNotice ? 'Concluir Mesmo Assim' : 'Concluir e Salvar Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
