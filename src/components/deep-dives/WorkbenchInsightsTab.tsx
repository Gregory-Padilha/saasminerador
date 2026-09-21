'use client';

import React, { useState } from 'react';
import { DeepDive, DeepDiveInsight, InsightCategory } from '@/types';
import {
  Sparkles,
  Plus,
  Trash2,
  Tag,
  CheckCircle2,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

interface WorkbenchInsightsTabProps {
  deepDive: DeepDive;
  insights: DeepDiveInsight[];
  onCreateInsight: (data: Partial<DeepDiveInsight>) => Promise<void>;
  onDeleteInsight: (id: string) => Promise<void>;
}

const CATEGORIES: InsightCategory[] = [
  'Criativo',
  'Copy',
  'Oferta',
  'Landing Page',
  'Checkout',
  'Pricing',
  'Order Bump',
  'Público',
  'Escala',
  'Produto',
];

export function WorkbenchInsightsTab({
  deepDive,
  insights,
  onCreateInsight,
  onDeleteInsight,
}: WorkbenchInsightsTabProps) {
  const offer = deepDive.offer;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<InsightCategory>('Oferta');
  const [tagsInput, setTagsInput] = useState('');
  const [applicability, setApplicability] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      await onCreateInsight({
        deep_dive_id: deepDive.id,
        offer_id: offer?.id || deepDive.offer_id,
        offer_name: offer?.product_name || 'Oferta',
        title: title.trim(),
        description: description.trim(),
        category,
        tags,
        applicability: applicability.trim(),
      });

      setTitle('');
      setDescription('');
      setTagsInput('');
      setApplicability('');
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
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Extrair Novo Insight
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Transforme observações factuais da oferta em conclusões estratégicas aplicáveis.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Categoria do Insight *:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InsightCategory)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Título do Insight *:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Quantidade como principal âncora de valor"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Descrição e Explicação *:
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Oferecer 365 receitas cria valor percebido massivo que compensa o ticket baixo..."
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Como Aplicar nos Meus Projetos (Opcional):
              </label>
              <input
                type="text"
                value={applicability}
                onChange={(e) => setApplicability(e.target.value)}
                placeholder="Ex: Empilhar 100+ templates no front-end em vez de apenas 10"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Tags (separadas por vírgula):
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="quantidade, low ticket, mockup"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Salvar Insight
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Insights List (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Insights Extraídos ({insights.length})
        </h4>

        {insights.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-2xl">
            Nenhum insight extraído para esta oferta ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm hover:border-slate-700 transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {ins.category}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1">{ins.title}</h4>
                  </div>

                  <button
                    onClick={() => onDeleteInsight(ins.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition"
                    title="Excluir insight"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {ins.description}
                </p>

                {ins.applicability && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 font-medium space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Aplicação Prática:
                    </span>
                    <p>{ins.applicability}</p>
                  </div>
                )}

                {ins.tags && ins.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/80">
                    {ins.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
