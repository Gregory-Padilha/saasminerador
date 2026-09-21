'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Crown,
  Layers,
  Flame,
  Globe,
  Tag,
  ShieldAlert,
  Sliders,
  DollarSign,
  Users,
  Target,
  Zap,
  BookOpen,
  Check,
  Building2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import {
  OfficeMissionBrief,
  DEFAULT_MISSION_BRIEF,
  MISSION_PRESETS,
  validateMissionBrief,
} from '@/lib/ai-office/mission-brief';
import { dbService } from '@/lib/supabase/db';
import { Offer } from '@/types';
import { getOfferScaleTier } from '@/lib/scale-tier';
import { formatCurrency } from '@/lib/utils';

interface MissionBriefWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'MODEL_EXISTING_OFFER' | 'CREATE_FROM_ZERO';
  initialPrimaryOfferId?: string;
  initialReferenceOfferIds?: string[];
}

const STEPS = [
  { step: 1, title: 'MISSÃO', desc: 'Objetivo Principal' },
  { step: 2, title: 'REFERÊNCIAS', desc: 'Ofertas do Catálogo' },
  { step: 3, title: 'DIREÇÃO', desc: 'Estratégia & Produto' },
  { step: 4, title: 'REVISÃO', desc: 'Briefing Final' },
];

const NICHE_SUGGESTIONS = [
  'Educação',
  'Saúde',
  'Culinária',
  'Artesanato',
  'Finanças',
  'Relacionamento',
  'Concursos',
  'Infantil',
  'Produtividade',
  'Desenvolvimento Pessoal',
];

const PREFERRED_FORMAT_OPTIONS = [
  'PDF / Ebook',
  'Imprimível',
  'Templates',
  'Cards',
  'Planilhas',
  'Biblioteca',
  'Ferramenta',
  'Prompts',
  'Calculadora',
  'Guia',
  'Outro',
  'Indiferente',
];

const EXCLUDED_FORMAT_OPTIONS = [
  'Curso em vídeo',
  'Expert',
  'Comunidade',
  'Produto físico',
  'SaaS',
];

const MISSION_PRIORITIES = [
  'Evidência de mercado',
  'Facilidade de produção',
  'Facilidade de anunciar',
  'Facilidade de demonstrar em criativo',
  'Baixa complexidade operacional',
  'Potencial de diferenciação',
  'Possibilidade de adaptação internacional',
  'Monetização / AOV',
  'Rapidez para colocar no mercado',
];

export function MissionBriefWizardModal({
  isOpen,
  onClose,
  initialMode,
  initialPrimaryOfferId,
  initialReferenceOfferIds = [],
}: MissionBriefWizardModalProps) {
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [brief, setBrief] = useState<OfficeMissionBrief>(() => {
    const base = { ...DEFAULT_MISSION_BRIEF };
    if (initialMode) base.missionType = initialMode;
    if (initialPrimaryOfferId) {
      base.primaryOfferId = initialPrimaryOfferId;
      base.referenceOfferIds = Array.from(new Set([...initialReferenceOfferIds, initialPrimaryOfferId]));
    } else if (initialReferenceOfferIds.length > 0) {
      base.referenceOfferIds = initialReferenceOfferIds;
    }
    return base;
  });

  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offerSearchQuery, setOfferSearchQuery] = useState('');
  const [offerScaleFilter, setOfferScaleFilter] = useState('all');
  const [avoidedInput, setAvoidedInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setBrief((prev) => ({
        ...prev,
        missionType: initialMode || prev.missionType,
        primaryOfferId: initialPrimaryOfferId || prev.primaryOfferId,
        referenceOfferIds: initialPrimaryOfferId
          ? Array.from(new Set([...initialReferenceOfferIds, initialPrimaryOfferId]))
          : initialReferenceOfferIds.length > 0
          ? initialReferenceOfferIds
          : prev.referenceOfferIds,
      }));
      setStep(1);
      setValidationError(null);
      fetchOffers();
    }
  }, [isOpen, initialMode, initialPrimaryOfferId, JSON.stringify(initialReferenceOfferIds)]);

  const fetchOffers = async () => {
    if (allOffers.length > 0) return;
    setLoadingOffers(true);
    try {
      const data = await dbService.getOffers();
      setAllOffers(data || []);
    } catch (err) {
      console.error('Error fetching offers for picker:', err);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Filtered Offers for Step 2 Offer Picker
  const filteredOffers = useMemo(() => {
    return allOffers.filter((o) => {
      const q = offerSearchQuery.toLowerCase().trim();
      if (q) {
        const nameMatch = o.product_name?.toLowerCase().includes(q);
        const advMatch = o.advertiser?.toLowerCase().includes(q);
        const nicheMatch = o.niche?.toLowerCase().includes(q);
        if (!nameMatch && !advMatch && !nicheMatch) return false;
      }

      if (offerScaleFilter !== 'all') {
        const tier = getOfferScaleTier(o.active_ads_count).tier;
        if (offerScaleFilter === 'FULL_SCALE' && tier !== 'FULL_SCALE') return false;
        if (offerScaleFilter === 'HIGH_SCALE' && tier !== 'HIGH_SCALE') return false;
        if (offerScaleFilter === 'SCALING' && tier !== 'SCALING') return false;
        if (offerScaleFilter === 'faceless' && !o.faceless) return false;
        if (offerScaleFilter === 'mapped' && !o.landing_page_url) return false;
        if (offerScaleFilter === 'checkout' && !o.checkout_url) return false;
        if (offerScaleFilter === 'favorites' && !o.favorite) return false;
      }

      return true;
    });
  }, [allOffers, offerSearchQuery, offerScaleFilter]);

  // Selected offers detail map
  const selectedOffersList = useMemo(() => {
    return brief.referenceOfferIds
      .map((id) => allOffers.find((o) => o.id === id))
      .filter(Boolean) as Offer[];
  }, [brief.referenceOfferIds, allOffers]);

  if (!isOpen) return null;

  // Preset Applicator
  const applyPreset = (presetPatch: Partial<OfficeMissionBrief>) => {
    setBrief((prev) => ({
      ...prev,
      ...presetPatch,
    }));
  };

  // Step Validation & Navigation
  const handleNextStep = () => {
    const val = validateMissionBrief(step, brief);
    if (!val.valid) {
      setValidationError(val.error || 'Por favor preencha os campos obrigatórios.');
      return;
    }
    setValidationError(null);
    if (step < 4) setStep(step + 1);
  };

  const handlePrevStep = () => {
    setValidationError(null);
    if (step > 1) setStep(step - 1);
  };

  // Final Submit Handler
  const handleSubmitMission = async () => {
    const val = validateMissionBrief(4, brief);
    if (!val.valid) {
      setValidationError(val.error || 'Verifique as informações do brief.');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const title =
        brief.missionName?.trim() ||
        (brief.missionType === 'MODEL_EXISTING_OFFER'
          ? 'Modelagem de Oferta Existente'
          : 'Criação de Oferta do Zero');

      const attachedOfferIds = Array.from(
        new Set([
          ...(brief.primaryOfferId ? [brief.primaryOfferId] : []),
          ...(brief.referenceOfferIds || []),
        ])
      );

      const res = await fetch('/api/office/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          mode: brief.missionType,
          goal: brief.objective,
          attachedOfferIds,
          missionBrief: brief,
        }),
      });

      const data = await res.json();
      if (data.mission) {
        onClose();
        if (typeof window !== 'undefined') {
          localStorage.setItem('office_view_open', 'true');
        }
        router.push(`/office/live/${data.mission.id}`);
      } else {
        setValidationError(data.error || 'Falha ao criar a missão.');
      }
    } catch (err: any) {
      console.error('Error initiating mission brief:', err);
      setValidationError('Erro de conexão ao iniciar missão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Offer Selection Helpers
  const toggleOfferSelection = (offerId: string) => {
    setBrief((prev) => {
      const exists = prev.referenceOfferIds.includes(offerId);
      let updatedRefs = exists
        ? prev.referenceOfferIds.filter((id) => id !== offerId)
        : [...prev.referenceOfferIds, offerId];

      if (updatedRefs.length > 5) {
        updatedRefs = updatedRefs.slice(0, 5);
      }

      let updatedPrimary = prev.primaryOfferId;
      if (exists && prev.primaryOfferId === offerId) {
        updatedPrimary = updatedRefs[0] || undefined;
      } else if (!prev.primaryOfferId && updatedRefs.length > 0) {
        updatedPrimary = updatedRefs[0];
      }

      return {
        ...prev,
        primaryOfferId: updatedPrimary,
        referenceOfferIds: updatedRefs,
      };
    });
  };

  const setPrimaryOffer = (offerId: string) => {
    setBrief((prev) => {
      const refs = prev.referenceOfferIds.includes(offerId)
        ? prev.referenceOfferIds
        : [offerId, ...prev.referenceOfferIds].slice(0, 5);
      return {
        ...prev,
        primaryOfferId: offerId,
        referenceOfferIds: refs,
      };
    });
  };

  // Multi-input tag helpers
  const addAvoidedNiche = () => {
    if (!avoidedInput.trim()) return;
    if (!brief.avoidedNiches.includes(avoidedInput.trim())) {
      setBrief((prev) => ({
        ...prev,
        avoidedNiches: [...prev.avoidedNiches, avoidedInput.trim()],
      }));
    }
    setAvoidedInput('');
  };

  const removeAvoidedNiche = (tag: string) => {
    setBrief((prev) => ({
      ...prev,
      avoidedNiches: prev.avoidedNiches.filter((t) => t !== tag),
    }));
  };

  const toggleArrayItem = (key: 'preferredFormats' | 'excludedFormats' | 'monetizationPreferences' | 'priorities', value: string, max?: number) => {
    setBrief((prev) => {
      const list = prev[key] as string[];
      const exists = list.includes(value);
      if (exists) {
        return { ...prev, [key]: list.filter((v) => v !== value) };
      } else {
        if (max && list.length >= max) return prev;
        return { ...prev, [key]: [...list, value] };
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className="w-full max-w-[950px] bg-[#0B0F17] border border-slate-800/90 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* WIZARD HEADER & STEPPER */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800/80 bg-slate-950/60 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  MISSION BRIEF WIZARD
                </span>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Briefing Estratégico do Escritório
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Bar */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 pt-2">
            {STEPS.map((s) => {
              const isActive = step === s.step;
              const isDone = step > s.step;
              return (
                <div
                  key={s.step}
                  onClick={() => {
                    if (isDone) setStep(s.step);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-lg shadow-amber-500/5'
                      : isDone
                      ? 'bg-slate-900/80 border-emerald-500/30 text-emerald-400 hover:bg-slate-900'
                      : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                      isActive
                        ? 'bg-amber-500 text-slate-950'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : s.step}
                  </div>
                  <div className="hidden sm:block overflow-hidden">
                    <span className="text-xs font-bold block truncate">{s.title}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{s.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* VALIDATION ERROR BANNER */}
        {validationError && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* STEP CONTENT CONTAINER */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* =========================================================================
              ETAPA 1: MISSÃO
             ========================================================================= */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  O que o escritório deve fazer?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Selecione o tipo principal de missão e descreva em linguagem natural o objetivo que os 13 agentes devem buscar.
                </p>
              </div>

              {/* MISSION TYPE CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 1: CRIAR DO ZERO */}
                <div
                  onClick={() => setBrief((prev) => ({ ...prev, missionType: 'CREATE_FROM_ZERO' }))}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 relative ${
                    brief.missionType === 'CREATE_FROM_ZERO'
                      ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/50 text-white'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-400 tracking-wide font-mono uppercase">
                      CARD 1
                    </span>
                    {brief.missionType === 'CREATE_FROM_ZERO' && (
                      <CheckCircle2 className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">CRIAR OFERTA DO ZERO</h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Encontre uma oportunidade usando a inteligência de todo o Offer Miner e construa uma nova oferta completa.
                    </p>
                  </div>
                </div>

                {/* CARD 2: MODELAR EXISTENTE */}
                <div
                  onClick={() => setBrief((prev) => ({ ...prev, missionType: 'MODEL_EXISTING_OFFER' }))}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 relative ${
                    brief.missionType === 'MODEL_EXISTING_OFFER'
                      ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/50 text-white'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-400 tracking-wide font-mono uppercase">
                      CARD 2
                    </span>
                    {brief.missionType === 'MODEL_EXISTING_OFFER' && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">MODELAR OFERTA EXISTENTE</h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Desmonte uma oferta validada, identifique o que sustenta sua lógica comercial e crie uma nova tese sem cloná-la.
                    </p>
                  </div>
                </div>
              </div>

              {/* QUICK PRESETS BAR */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Presets Rápidos de Configuração (Opcional):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.briefPatch)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition space-y-1 group"
                    >
                      <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 block">
                        {preset.title}
                      </span>
                      <span className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* OBJECTIVE TEXTAREA */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  OBJETIVO DA MISSÃO <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={brief.objective}
                  onChange={(e) => setBrief((prev) => ({ ...prev, objective: e.target.value }))}
                  placeholder={
                    brief.missionType === 'CREATE_FROM_ZERO'
                      ? 'Ex.: Quero encontrar uma oportunidade digital faceless, simples de produzir, com ticket baixo e potencial para Meta Ads. Não precisa ficar preso a um nicho específico.'
                      : 'Ex.: Quero preservar a lógica comercial dessa oferta, mas criar algo para outro público e com posicionamento diferente.'
                  }
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition leading-relaxed"
                />
              </div>

              {/* INTERNAL MISSION NAME */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    NOME INTERNO DA MISSÃO (Opcional)
                  </label>
                  <span className="text-[10px] text-slate-500">Se vazio: gerar automaticamente depois</span>
                </div>
                <input
                  type="text"
                  value={brief.missionName || ''}
                  onChange={(e) => setBrief((prev) => ({ ...prev, missionName: e.target.value }))}
                  placeholder="Ex.: Nova Oferta Educação"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* =========================================================================
              ETAPA 2: REFERÊNCIAS
             ========================================================================= */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  {brief.missionType === 'MODEL_EXISTING_OFFER'
                    ? 'Selecione a Oferta Principal a Modelar'
                    : 'Quer dar algumas referências ao escritório?'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {brief.missionType === 'MODEL_EXISTING_OFFER'
                    ? 'Na modelagem existente, selecione obrigatoriamente 1 Oferta Principal e até 4 referências secundárias para guiar os agentes.'
                    : 'Essas ofertas não serão copiadas. Elas servirão como fontes de inteligência para público, produto, pricing, criativos ou estrutura comercial.'}
                </p>
              </div>

              {/* SEARCH WHOLE CATALOG CHECKBOX */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">
                    ✓ Deixar o escritório pesquisar todo o catálogo
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Selecionar uma oferta NÃO limita o escritório a ela. O escritório continuará buscando outras oportunidades no catálogo.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={brief.searchWholeCatalog}
                  onChange={(e) =>
                    setBrief((prev) => ({ ...prev, searchWholeCatalog: e.target.checked }))
                  }
                  className="w-5 h-5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900"
                />
              </div>

              {/* SELECTED OFFERS SECTION */}
              {brief.referenceOfferIds.length > 0 && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                      OFERTAS SELECIONADAS ({brief.referenceOfferIds.length}/5)
                    </span>
                    {brief.missionType === 'MODEL_EXISTING_OFFER' && !brief.primaryOfferId && (
                      <span className="text-[10px] text-rose-400 font-bold">
                        ⚠️ Defina 1 Oferta Principal
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {selectedOffersList.map((off) => {
                      const isPrimary = brief.primaryOfferId === off.id;
                      return (
                        <div
                          key={off.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                            isPrimary
                              ? 'bg-amber-500/15 border-amber-500/60 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {isPrimary && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                PRINCIPAL
                              </span>
                            )}
                            <div className="truncate">
                              <h5 className="text-xs font-bold text-white truncate">
                                {off.product_name}
                              </h5>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>{off.advertiser || 'Anunciante N/I'}</span>
                                <span>•</span>
                                <span>{off.active_ads_count || 0} ads ativos</span>
                                <span>•</span>
                                <span>{formatCurrency(off.price || 0)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {brief.missionType === 'MODEL_EXISTING_OFFER' && !isPrimary && (
                              <button
                                type="button"
                                onClick={() => setPrimaryOffer(off.id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold"
                              >
                                [ Definir como Principal ]
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleOfferSelection(off.id)}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* OFFER PICKER */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-200 block">OFFER PICKER</span>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono">
                    {[
                      { id: 'all', label: 'Todas' },
                      { id: 'FULL_SCALE', label: 'Full Scale' },
                      { id: 'HIGH_SCALE', label: 'Alta Escala' },
                      { id: 'faceless', label: 'Faceless' },
                      { id: 'mapped', label: 'Mapeadas' },
                      { id: 'checkout', label: 'Com Checkout' },
                      { id: 'favorites', label: 'Favoritas' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOfferScaleFilter(f.id)}
                        className={`px-2.5 py-1 rounded-full border transition whitespace-nowrap ${
                          offerScaleFilter === f.id
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={offerSearchQuery}
                    onChange={(e) => setOfferSearchQuery(e.target.value)}
                    placeholder="Buscar por nome da oferta, anunciante ou nicho..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  {offerSearchQuery && (
                    <button
                      onClick={() => setOfferSearchQuery('')}
                      className="absolute right-3.5 top-3 text-slate-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Offers Results Compact List */}
                {loadingOffers ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Carregando catálogo de ofertas...
                  </div>
                ) : filteredOffers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 border border-slate-800 rounded-2xl">
                    Nenhuma oferta encontrada com os filtros selecionados.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {filteredOffers.slice(0, 30).map((off) => {
                      const isSelected = brief.referenceOfferIds.includes(off.id);
                      const isPrimary = brief.primaryOfferId === off.id;
                      const tier = getOfferScaleTier(off.active_ads_count);

                      return (
                        <div
                          key={off.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/40 text-white'
                              : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-slate-400 font-bold text-xs">
                              {off.product_name ? off.product_name.charAt(0) : 'O'}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <h5 className="text-xs font-bold text-white truncate">
                                  {off.product_name}
                                </h5>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${tier.badgeClass} ${tier.textClass}`}>
                                  {tier.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>{off.advertiser || 'Anunciante N/I'}</span>
                                <span>•</span>
                                <span>{off.active_ads_count || 0} ads</span>
                                <span>•</span>
                                <span>{formatCurrency(off.price || 0)}</span>
                                {off.faceless && <span className="text-amber-400 font-bold">• Faceless</span>}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleOfferSelection(off.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {isSelected ? '✓ Selecionada' : '+ Selecionar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              ETAPA 3: DIREÇÃO ESTRATÉGICA
             ========================================================================= */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Dê uma direção estratégica para o escritório
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Defina mercado, nichos, restrições, ticket e prioridades de análise.
                </p>
              </div>

              {/* SEÇÃO A: MERCADO & NICHO */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                  SEÇÃO A — MERCADO & NICHO
                </h4>

                {/* MERCADO PRINCIPAL */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">MERCADO PRINCIPAL:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Brasil', 'Estados Unidos', 'Espanhol', 'Outro'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBrief((prev) => ({ ...prev, market: m as any }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                          brief.market === m
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* NICHO */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">NICHO:</label>
                  <input
                    type="text"
                    value={brief.niche || ''}
                    onChange={(e) => setBrief((prev) => ({ ...prev, niche: e.target.value }))}
                    placeholder="Qualquer (ou especifique o nicho desejado)"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-500">Sugestões:</span>
                    {NICHE_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setBrief((prev) => ({ ...prev, niche: sug }))}
                        className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-[10px] text-slate-400 hover:text-amber-300"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* EVITAR NICHOS */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">EVITAR NICHOS (Multi-input):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={avoidedInput}
                      onChange={(e) => setAvoidedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAvoidedNiche();
                        }
                      }}
                      placeholder="Ex.: 'não quero saúde', 'evitar relacionamento'..."
                      className="flex-1 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={addAvoidedNiche}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-amber-400"
                    >
                      + Adicionar
                    </button>
                  </div>
                  {brief.avoidedNiches.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {brief.avoidedNiches.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-bold flex items-center gap-1"
                        >
                          <span>{tag}</span>
                          <button onClick={() => removeAvoidedNiche(tag)} className="hover:text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SEÇÃO B: TIPO DE PRODUTO */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                  SEÇÃO B — TIPO DE PRODUTO
                </h4>

                {/* FACELESS */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">FACELESS:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Obrigatório', 'Preferível', 'Indiferente'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setBrief((prev) => ({ ...prev, facelessPreference: f as any }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                          brief.facelessPreference === f
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FORMATO PREFERIDO */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">FORMATO PREFERIDO (Multi-select):</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PREFERRED_FORMAT_OPTIONS.map((fmt) => {
                      const isSelected = brief.preferredFormats.includes(fmt);
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => toggleArrayItem('preferredFormats', fmt)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{fmt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* NÃO QUERO */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">NÃO QUERO (Multi-select):</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {EXCLUDED_FORMAT_OPTIONS.map((fmt) => {
                      const isSelected = brief.excludedFormats.includes(fmt);
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => toggleArrayItem('excludedFormats', fmt)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                            isSelected
                              ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {isSelected ? '✕ ' : ''}{fmt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* COMPLEXIDADE DE PRODUÇÃO */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">COMPLEXIDADE DE PRODUÇÃO:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Baixa', label: 'BAIXA', sub: '"Quero conseguir produzir rapidamente."' },
                      { id: 'Média', label: 'MÉDIA', sub: '"Aceito uma entrega mais elaborada se a tese justificar."' },
                      { id: 'Indiferente', label: 'INDIFERENTE', sub: 'Sem restrição de tempo/produção.' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBrief((prev) => ({ ...prev, productionComplexity: item.id as any }))}
                        className={`p-3 rounded-xl border text-left transition space-y-1 ${
                          brief.productionComplexity === item.id
                            ? 'bg-amber-500/20 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold block">{item.label}</span>
                        <span className="text-[10px] text-slate-500 block leading-tight">{item.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SEÇÃO C: ECONOMIA */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                  SEÇÃO C — ECONOMIA
                </h4>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">TICKET DO FRONT:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Até R$20', 'R$20–30', 'R$30–50', 'R$50+', 'Definir faixa', 'Indiferente'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBrief((prev) => ({ ...prev, ticketOption: t as any }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                          brief.ticketOption === t
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {brief.ticketOption === 'Definir faixa' && (
                    <div className="flex items-center gap-3 pt-2">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-slate-400">Min (R$):</span>
                        <input
                          type="number"
                          value={brief.ticketMin || ''}
                          onChange={(e) => setBrief((prev) => ({ ...prev, ticketMin: Number(e.target.value) }))}
                          placeholder="19.90"
                          className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-slate-400">Max (R$):</span>
                        <input
                          type="number"
                          value={brief.ticketMax || ''}
                          onChange={(e) => setBrief((prev) => ({ ...prev, ticketMax: Number(e.target.value) }))}
                          placeholder="47.00"
                          className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* MONETIZAÇÃO */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">MONETIZAÇÃO (Checkboxes opcionais):</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Pode usar order bumps',
                      'Pode propor upsell futuro',
                      'Preferir front simples',
                      'Indiferente',
                    ].map((opt) => {
                      const isChecked = brief.monetizationPreferences.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleArrayItem('monetizationPreferences', opt)}
                            className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-950"
                          />
                          <span className="text-xs text-slate-300 font-medium">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SEÇÃO D: PÚBLICO & RESTRIÇÕES */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                  SEÇÃO D — PÚBLICO & RESTRIÇÕES
                </h4>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">PÚBLICO DESEJADO (Opcional):</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-amber-300 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={brief.allowAudienceDiscovery}
                        onChange={(e) =>
                          setBrief((prev) => ({ ...prev, allowAudienceDiscovery: e.target.checked }))
                        }
                        className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 bg-slate-900"
                      />
                      <span>✓ Deixar escritório identificar públicos</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={brief.audienceDirection || ''}
                    onChange={(e) => setBrief((prev) => ({ ...prev, audienceDirection: e.target.value }))}
                    placeholder="Ex.: Mães de crianças de 2–5 anos..."
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">RESTRIÇÕES (Textarea):</label>
                  <textarea
                    rows={2}
                    value={brief.constraints || ''}
                    onChange={(e) => setBrief((prev) => ({ ...prev, constraints: e.target.value }))}
                    placeholder="Ex.: Não quero aparecer em vídeo. Precisa ser simples de entregar. Não depender de aplicativo..."
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* SEÇÃO E: PRIORIDADE DA MISSÃO */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                    SEÇÃO E — PRIORIDADE DA MISSÃO
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Selecione até 3 ({brief.priorities.length}/3)
                  </span>
                </div>
                <p className="text-xs text-slate-400">O que deve pesar mais na busca do escritório?</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {MISSION_PRIORITIES.map((p) => {
                    const isSelected = brief.priorities.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleArrayItem('priorities', p, 3)}
                        className={`p-2.5 rounded-xl border text-xs text-left transition font-medium ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}{p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO F: PROFUNDIDADE DA MISSÃO */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                  SEÇÃO F — PROFUNDIDADE DA MISSÃO
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'ECONOMICO',
                      title: 'ECONÔMICO',
                      desc: 'Menos candidatos, menos revisões e menor uso de API.',
                    },
                    {
                      id: 'BALANCEADO',
                      title: 'BALANCEADO',
                      desc: 'Boa pesquisa com custo controlado.',
                    },
                    {
                      id: 'PROFUNDO',
                      title: 'PROFUNDO',
                      desc: 'Mais referências, investigação e revisão.',
                    },
                  ].map((prof) => (
                    <div
                      key={prof.id}
                      onClick={() => setBrief((prev) => ({ ...prev, budgetProfile: prof.id as any }))}
                      className={`p-4 rounded-xl border cursor-pointer transition space-y-1.5 ${
                        brief.budgetProfile === prof.id
                          ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-extrabold block text-amber-300 font-mono">
                        {prof.title}
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{prof.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span className="font-bold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    Agentes previstos nesta missão:
                  </span>
                  <span className="font-mono text-amber-300 font-bold">
                    13 agentes disponíveis | 9–13 previstos
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ETAPA 4: REVISÃO & WORKFLOW REAL
             ========================================================================= */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Revisão do Briefing & Fluxo dos 13 Agentes
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Confira o briefing estratégico que será transmitido ao Escritório de Inteligência.
                </p>
              </div>

              {/* BRIEFING SUMMARY CARD */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-extrabold text-amber-400 font-mono uppercase tracking-wider">
                    RESUMO DO BRIEFING ESTRATÉGICO
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {brief.missionType}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">MISSÃO:</span>
                    <span className="text-white font-medium">
                      {brief.missionType === 'MODEL_EXISTING_OFFER' ? 'Modelar Oferta Existente' : 'Criar Oferta do Zero'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold block">NOME INTERNO:</span>
                    <span className="text-white font-medium">
                      {brief.missionName || '(Automático)'}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-bold block">OBJETIVO PRINCIPAL:</span>
                    <p className="text-slate-200 mt-0.5 leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800">
                      {brief.objective}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold block">MERCADO & NICHO:</span>
                    <span className="text-white font-medium">
                      {brief.market} | Nicho: {brief.niche || 'Aberto / Qualquer'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold block">REFERÊNCIAS SELECIONADAS:</span>
                    <span className="text-white font-medium">
                      {brief.referenceOfferIds.length} oferta(s) selecionada(s)
                      {brief.searchWholeCatalog ? ' + Pesquisar todo o catálogo' : ''}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold block">FORMATO & FACELESS:</span>
                    <span className="text-white font-medium">
                      {brief.facelessPreference} | Formatos: {brief.preferredFormats.join(', ') || 'Indiferente'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold block">COMPLEXIDADE & TICKET:</span>
                    <span className="text-white font-medium">
                      Complexidade {brief.productionComplexity} | Ticket: {brief.ticketOption}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-bold block">PRIORIDADES DA BUSCA:</span>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {brief.priorities.map((p) => (
                        <span key={p} className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* REAL WORKFLOW PREVIEW */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                  O QUE O ESCRITÓRIO VAI FAZER (FLUXO REAL)
                </span>

                {brief.missionType === 'CREATE_FROM_ZERO' ? (
                  <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">1. Mapear mercado</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">2. Encontrar referências</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">3. Detectar padrões</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">4. Gerar teses de oportunidade</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">5. Eliminar teses fracas</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">6. Estruturar finalistas</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">7. Construir produto</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">8. Criar posicionamento</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">9. Pricing / monetização</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">10. Criativos</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">11. LP</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">12. Review Board</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">13. Diretor</li>
                    <li className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">14. Criar Offer Project</li>
                  </ol>
                ) : (
                  <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">1. Desmontar oferta principal</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">2. Extrair Offer DNA</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">3. Investigar evidências</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">4. Separar estrutura de expressão</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">5. Gerar transformation paths</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">6. Criar novas teses</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">7. Arquitetar produto</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">8. GTM</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">9. Review Board</li>
                    <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">10. Diretor</li>
                    <li className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">11. Criar Offer Project</li>
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>

        {/* WIZARD FOOTER CTAS */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 1 ? onClose : handlePrevStep}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{step === 1 ? 'Cancelar' : 'Voltar'}</span>
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
            >
              <span>Continuar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitMission}
              disabled={isSubmitting}
              className="px-7 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-xl shadow-amber-500/30 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Transmitindo Briefing...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>INICIAR ESCRITÓRIO ↗</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
