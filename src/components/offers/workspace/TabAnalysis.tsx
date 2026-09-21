'use client';

import React, { useState } from 'react';
import { Offer, OfferAnalysis, OfferDecision } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { DecisionBadge } from '@/components/ui/DecisionBadge';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Shield,
  Zap,
  Save,
  Check,
  Compass,
  ArrowRight,
} from 'lucide-react';

interface TabAnalysisProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

const ALL_DECISIONS: OfferDecision[] = [
  'Ignorar',
  'Observar',
  'Interessante',
  'Deep Dive',
  'Modelar',
  'Testar',
  'Arquivada',
];

export function TabAnalysis({ offer, onOfferUpdated }: TabAnalysisProps) {
  const analysis: Partial<OfferAnalysis> = offer.analysis || {};

  const [whyInteresting, setWhyInteresting] = useState(analysis.why_interesting || '');
  const [strengths, setStrengths] = useState(analysis.strengths || '');
  const [weaknesses, setWeaknesses] = useState(analysis.weaknesses || '');
  const [whatToModel, setWhatToModel] = useState(analysis.what_to_model || '');
  const [whatNotToCopy, setWhatNotToCopy] = useState(analysis.what_not_to_copy || '');
  const [differentiationIdeas, setDifferentiationIdeas] = useState(analysis.differentiation_ideas || '');
  const [adaptationIdeas, setAdaptationIdeas] = useState(analysis.adaptation_ideas || '');
  const [riskScore, setRiskScore] = useState<'Baixo' | 'Medio' | 'Alto'>(analysis.risk_score || 'Baixo');
  const [potentialScore, setPotentialScore] = useState<'Baixo' | 'Medio' | 'Alto'>(analysis.potential_score || 'Alto');
  const [decision, setDecision] = useState<OfferDecision>(offer.decision || analysis.decision || 'Observar');

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedAnalysis = await dbService.updateOfferAnalysis(offer.id, {
        why_interesting: whyInteresting,
        strengths,
        weaknesses,
        what_to_model: whatToModel,
        what_not_to_copy: whatNotToCopy,
        differentiation_ideas: differentiationIdeas,
        adaptation_ideas: adaptationIdeas,
        risk_score: riskScore,
        potential_score: potentialScore,
        decision,
      });

      onOfferUpdated({
        ...offer,
        analysis: updatedAnalysis,
        decision,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveAnalysis} className="space-y-6">
      {/* Executive Decision Header */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            Engenharia Reversa & Decisão Estratégica
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Avaliação aprofundada para decidir se vale a pena modelar, testar ou descartar esta oferta
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700">
            <span className="text-xs font-semibold text-slate-300">Decisão Final:</span>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as OfferDecision)}
              className="bg-transparent text-xs font-bold text-blue-400 focus:outline-none cursor-pointer"
            >
              {ALL_DECISIONS.map((d) => (
                <option key={d} value={d} className="bg-slate-900 text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Salvando...' : savedSuccess ? 'Análise Salva!' : 'Salvar Análise Estratégica'}
          </button>
        </div>
      </div>

      {/* Risco vs Potencial Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-xs font-bold text-slate-200">Nível de Risco</span>
              <p className="text-[10px] text-slate-400">Complexidade operacional / bloqueio</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {(['Baixo', 'Medio', 'Alto'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRiskScore(r)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                  riskScore === r
                    ? r === 'Baixo'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : r === 'Medio'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-xs font-bold text-slate-200">Potencial de Escala</span>
              <p className="text-[10px] text-slate-400">Tamanho do mercado e interesse</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {(['Baixo', 'Medio', 'Alto'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPotentialScore(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                  potentialScore === p
                    ? p === 'Alto'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : p === 'Medio'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Strategic Questionnaire Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Why interesting */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
            1. Por que essa oferta chamou atenção?
          </label>
          <textarea
            rows={3}
            value={whyInteresting}
            onChange={(e) => setWhyInteresting(e.target.value)}
            placeholder="Ex: Crescimento rápido de 5 para 28 anúncios em 3 semanas no nicho de alfabetização infantil com criativos faceless muito simples..."
            className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed"
          />
        </div>

        {/* Strengths */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">
            2. Pontos Fortes da Operação
          </label>
          <textarea
            rows={3}
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="Ex: Promessa clara, mockup 3D chamativo na dobra 1, preço acessível de R$27 com checkout PIX de 1 clique..."
            className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed"
          />
        </div>

        {/* Weaknesses */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider">
            3. Pontos Fracos / Brechas Competitivas
          </label>
          <textarea
            rows={3}
            value={weaknesses}
            onChange={(e) => setWeaknesses(e.target.value)}
            placeholder="Ex: Não possui order bumps no checkout, página um pouco lenta no mobile, falta prova social em vídeo..."
            className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed"
          />
        </div>

        {/* What to model */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider">
            4. O que eu MODELARIA?
          </label>
          <textarea
            rows={3}
            value={whatToModel}
            onChange={(e) => setWhatToModel(e.target.value)}
            placeholder="Ex: A estrutura do gancho nos criativos ('Seu filho ainda tem dificuldade em ler?'), o formato de apostila de 350 atividades e a ancoragem de preço..."
            className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed"
          />
        </div>

        {/* What NOT to copy */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
            5. O que eu NÃO COPIARIA?
          </label>
          <textarea
            rows={3}
            value={whatNotToCopy}
            onChange={(e) => setWhatNotToCopy(e.target.value)}
            placeholder="Ex: O design poluído da seção de garantia, a falta de esteira de upsell e as imagens genéricas de banco..."
            className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed"
          />
        </div>

        {/* Differentiation & Adaptation ideas */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider">
            6. Ideias de Diferenciação & Outros Nichos
          </label>
          <textarea
            rows={3}
            value={differentiationIdeas}
            onChange={(e) => setDifferentiationIdeas(e.target.value)}
            placeholder="Ex: Criar versão específica para TDAH / Autismo, adicionar 2 order bumps de R$ 14,90 e incluir jogos interativos em vídeo..."
            className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed"
          />
        </div>
      </div>
    </form>
  );
}
