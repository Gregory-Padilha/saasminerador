'use client';

import React, { useState } from 'react';
import { Offer } from '@/types';
import { dbService } from '@/lib/supabase/db';
import {
  Users,
  Target,
  Heart,
  AlertTriangle,
  Compass,
  Edit2,
  Save,
  Brain,
  MessageSquare,
} from 'lucide-react';

interface TabAudienceProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

export function TabAudience({ offer, onOfferUpdated }: TabAudienceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [targetAudience, setTargetAudience] = useState(offer.target_audience || '');
  const [buyerPersona, setBuyerPersona] = useState(offer.audience_profile?.buyer_persona || '');
  const [coreProblem, setCoreProblem] = useState(offer.audience_profile?.core_problem || offer.problem || '');
  const [coreDesire, setCoreDesire] = useState(offer.audience_profile?.core_desire || offer.transformation || '');
  const [buyingContext, setBuyingContext] = useState(offer.audience_profile?.buying_context || '');
  const [awarenessLevel, setAwarenessLevel] = useState(offer.audience_profile?.awareness_level || '');
  const [languageTone, setLanguageTone] = useState(offer.audience_profile?.language_tone || '');

  React.useEffect(() => {
    setTargetAudience(offer.target_audience || '');
    setBuyerPersona(offer.audience_profile?.buyer_persona || '');
    setCoreProblem(offer.audience_profile?.core_problem || offer.problem || '');
    setCoreDesire(offer.audience_profile?.core_desire || offer.transformation || '');
    setBuyingContext(offer.audience_profile?.buying_context || '');
    setAwarenessLevel(offer.audience_profile?.awareness_level || '');
    setLanguageTone(offer.audience_profile?.language_tone || '');
  }, [offer]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await dbService.updateOffer(offer.id, {
        target_audience: targetAudience,
        audience_profile: {
          avatar: targetAudience,
          buyer_persona: buyerPersona,
          core_problem: coreProblem,
          core_desire: coreDesire,
          buying_context: buyingContext,
          awareness_level: awarenessLevel,
          language_tone: languageTone,
        },
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Público-Alvo & Perfil do Comprador
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
                Editar Público
              </>
            )}
          </button>
        </div>

        {/* Audience Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avatar / Público Principal */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Avatar / Quem Compra
              </span>
            </div>
            {isEditing ? (
              <textarea
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Ex: Mães de crianças de 3 a 7 anos, alfabetizadoras..."
              />
            ) : targetAudience ? (
              <p className="text-xs font-semibold text-white leading-relaxed">{targetAudience}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Público principal não informado</span>
            )}
          </div>

          {/* Contexto de Compra */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Momento / Contexto de Compra
              </span>
            </div>
            {isEditing ? (
              <textarea
                value={buyingContext}
                onChange={(e) => setBuyingContext(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Ex: Volta às aulas, férias, falta de tempo..."
              />
            ) : buyingContext ? (
              <p className="text-xs text-slate-200 leading-relaxed">{buyingContext}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Contexto não informado</span>
            )}
          </div>

          {/* Dor / Problema Específico */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Dor / Situação de Frustração
              </span>
            </div>
            {isEditing ? (
              <textarea
                value={coreProblem}
                onChange={(e) => setCoreProblem(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Ex: Filho com dificuldade nas telas, falta de tempo para criar materiais..."
              />
            ) : coreProblem ? (
              <p className="text-xs text-slate-300 leading-relaxed">{coreProblem}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Dor não informada</span>
            )}
          </div>

          {/* Desejo / Sonho */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Desejo / Transformação Buscada
              </span>
            </div>
            {isEditing ? (
              <textarea
                value={coreDesire}
                onChange={(e) => setCoreDesire(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Ex: Ensinar em casa sem brigas, economia de tempo..."
              />
            ) : coreDesire ? (
              <p className="text-xs text-slate-300 leading-relaxed">{coreDesire}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Desejo não informado</span>
            )}
          </div>

          {/* Nível de Consciência */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Nível de Consciência do Público
              </span>
            </div>
            {isEditing ? (
              <select
                value={awarenessLevel}
                onChange={(e) => setAwarenessLevel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="Inconsciente">Inconsciente (Topo de Funil)</option>
                <option value="Consciente do Problema">Consciente do Problema</option>
                <option value="Consciente da Solução">Consciente da Solução</option>
                <option value="Consciente do Produto">Consciente do Produto</option>
                <option value="Totalmente Consciente">Totalmente Consciente</option>
              </select>
            ) : awarenessLevel ? (
              <span className="inline-block px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold">
                {awarenessLevel}
              </span>
            ) : (
              <span className="text-xs text-slate-500 italic">Não determinado na comunicação</span>
            )}
          </div>

          {/* Tom de Linguagem */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Linguagem & Tom Utilizado
              </span>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={languageTone}
                onChange={(e) => setLanguageTone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                placeholder="Ex: Acolhedor, prático, direto, materno..."
              />
            ) : languageTone ? (
              <p className="text-xs text-slate-200">{languageTone}</p>
            ) : (
              <span className="text-xs text-slate-500 italic">Tom não especificado</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
