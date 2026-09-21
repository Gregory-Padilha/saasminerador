'use client';

import React, { useState } from 'react';
import { Offer } from '@/types';
import { dbService } from '@/lib/supabase/db';
import {
  FileText,
  Quote,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Edit2,
  Save,
  Tag,
  ShieldCheck,
  Flame,
} from 'lucide-react';

interface TabCopyProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

export function TabCopy({ offer, onOfferUpdated }: TabCopyProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const lpAnalysis = (offer as any).extra_data?.latest_lp_analysis;

  const [headline, setHeadline] = useState(offer.headline || lpAnalysis?.heroXRay?.headline || '');
  const [subheadline, setSubheadline] = useState(offer.subheadline || lpAnalysis?.heroXRay?.subheadline || '');
  const [promise, setPromise] = useState(offer.promise || lpAnalysis?.copy?.promises?.[0] || '');
  const [problem, setProblem] = useState(offer.problem || lpAnalysis?.copy?.painPoints?.[0] || '');
  const [transformation, setTransformation] = useState(offer.transformation || '');
  const [mechanism, setMechanism] = useState(offer.mechanism || '');
  const [bigIdea, setBigIdea] = useState(offer.big_idea || '');

  React.useEffect(() => {
    const freshLp = (offer as any).extra_data?.latest_lp_analysis;
    setHeadline(offer.headline || freshLp?.heroXRay?.headline || '');
    setSubheadline(offer.subheadline || freshLp?.heroXRay?.subheadline || '');
    setPromise(offer.promise || freshLp?.copy?.promises?.[0] || '');
    setProblem(offer.problem || freshLp?.copy?.painPoints?.[0] || '');
    setTransformation(offer.transformation || '');
    setMechanism(offer.mechanism || '');
    setBigIdea(offer.big_idea || '');
  }, [offer]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await dbService.updateOffer(offer.id, {
        headline,
        subheadline,
        promise,
        problem,
        transformation,
        mechanism,
        big_idea: bigIdea,
      });
      if (updated) {
        onOfferUpdated(updated);
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Hooks extracted from creatives or stored
  const hooksList =
    offer.hooks_list && offer.hooks_list.length > 0
      ? offer.hooks_list
      : (offer.creatives || [])
          .map((c) => c.hook || c.headline)
          .filter(Boolean) as string[];

  const lpCopy = lpAnalysis?.copy;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Quote className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Registro Factual de Copywriting & Mensagens
            </h3>
          </div>

          <button
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
          >
            {isEditing ? (
              <>
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                Editar Copy
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Catalogação objetiva dos ganchos, promessas, argumentos e mecanismos utilizados na comunicação da oferta.
        </p>

        {/* Core Positioning Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Headline Principal */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">
                1. Headline Principal
              </span>
              {lpAnalysis?.heroXRay?.headline && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Fonte: LP
                </span>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Insira a headline principal..."
              />
            ) : headline ? (
              <p className="text-sm font-bold text-white italic leading-relaxed">
                &ldquo;{headline}&rdquo;
              </p>
            ) : (
              <span className="text-xs text-slate-500 italic">Headline não informada</span>
            )}
          </div>

          {/* Subheadline */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">
                2. Subheadline / Apoio
              </span>
              {lpAnalysis?.heroXRay?.subheadline && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Fonte: LP
                </span>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Insira a subheadline..."
              />
            ) : subheadline ? (
              <p className="text-xs text-slate-300 leading-relaxed">{subheadline}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Subheadline não informada</span>
            )}
          </div>

          {/* Promessa Central */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                3. Promessa Central
              </span>
              {lpAnalysis?.copy?.promises?.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Fonte: LP
                </span>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={promise}
                onChange={(e) => setPromise(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Qual o resultado primário prometido?"
              />
            ) : promise ? (
              <p className="text-xs font-semibold text-emerald-300 leading-relaxed">{promise}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Promessa não informada</span>
            )}
          </div>

          {/* Problema / Dor Primária */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">
                4. Dor / Problema Alvo
              </span>
              {lpAnalysis?.copy?.painPoints?.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Fonte: LP
                </span>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Qual o problema atacado?"
              />
            ) : problem ? (
              <p className="text-xs text-slate-300 leading-relaxed">{problem}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Problema não especificado</span>
            )}
          </div>

          {/* Mecanismo Único */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[10px] uppercase font-bold text-purple-400 block tracking-wider">
              5. Mecanismo / Método
            </span>
            {isEditing ? (
              <input
                type="text"
                value={mechanism}
                onChange={(e) => setMechanism(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Ex: Método 3 Passos, Protocolo X..."
              />
            ) : mechanism ? (
              <p className="text-xs text-purple-300 font-semibold">{mechanism}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Mecanismo não informado</span>
            )}
          </div>

          {/* Big Idea */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
              6. Big Idea
            </span>
            {isEditing ? (
              <input
                type="text"
                value={bigIdea}
                onChange={(e) => setBigIdea(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Conceito central inovador..."
              />
            ) : bigIdea ? (
              <p className="text-xs text-amber-300 font-semibold">{bigIdea}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Big Idea não informada</span>
            )}
          </div>
        </div>
      </div>

      {/* Blocos de Copy Mapeados na Landing Page */}
      {lpCopy && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Blocos de Copy Mapeados na Landing Page
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Extração Factual LP
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Benefícios detectados */}
            {lpCopy.benefits && lpCopy.benefits.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Benefícios & Bullets Detectados ({lpCopy.benefits.length})
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {lpCopy.benefits.slice(0, 5).map((b: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* FAQs detectadas */}
            {lpCopy.faqs && lpCopy.faqs.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-cyan-400 block tracking-wider">
                  Perguntas Frequentes (FAQ) ({lpCopy.faqs.length})
                </span>
                <div className="space-y-2 text-xs">
                  {lpCopy.faqs.slice(0, 3).map((f: any, i: number) => (
                    <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 space-y-0.5">
                      <p className="font-semibold text-white">{f.question}</p>
                      <p className="text-slate-400 text-[11px]">{f.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hooks Identificados */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Ganchos (Hooks) Mapeados nos Anúncios
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {hooksList.length} gancho(s)
          </span>
        </div>

        {hooksList.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Nenhum hook específico cadastrado para esta oferta ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {hooksList.map((hk, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3 text-xs"
              >
                <span className="w-5 h-5 rounded-md bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  #{idx + 1}
                </span>
                <p className="text-slate-200 italic leading-relaxed">&ldquo;{hk}&rdquo;</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
