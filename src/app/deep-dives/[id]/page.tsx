'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { dbService } from '@/lib/supabase/db';
import {
  DeepDive,
  DeepDiveStatus,
  DeepDivePriority,
  DeepDiveInsight,
  DeepDiveHypothesis,
  DeepDiveTest,
  DeepDiveCreativeTag,
  DeepDiveLpSectionNote,
  DeepDiveCaseSummary,
} from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { WorkbenchHeader } from '@/components/deep-dives/WorkbenchHeader';
import { WorkbenchCreativesTab } from '@/components/deep-dives/WorkbenchCreativesTab';
import { WorkbenchLpTab } from '@/components/deep-dives/WorkbenchLpTab';
import { WorkbenchHypothesesTab } from '@/components/deep-dives/WorkbenchHypothesesTab';
import { WorkbenchInsightsTab } from '@/components/deep-dives/WorkbenchInsightsTab';
import { WorkbenchNotebookTab } from '@/components/deep-dives/WorkbenchNotebookTab';
import { WorkbenchCaseSummaryTab } from '@/components/deep-dives/WorkbenchCaseSummaryTab';
import { formatCurrency } from '@/lib/utils';
import {
  LayoutGrid,
  Video,
  Globe,
  Tag,
  ShoppingCart,
  FileText,
  Users,
  Brain,
  Sparkles,
  BookOpen,
  Award,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';

type WorkbenchTabKey =
  | 'overview'
  | 'creatives'
  | 'landing_page'
  | 'offer_stack'
  | 'checkout'
  | 'copy'
  | 'audience'
  | 'hypotheses'
  | 'insights'
  | 'notebook'
  | 'case_summary';

export default function DeepDiveWorkbenchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [deepDive, setDeepDive] = useState<DeepDive | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTabKey>('overview');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadDeepDive();
  }, [id]);

  const loadDeepDive = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getDeepDiveById(id);
      if (data) {
        setDeepDive(data);
      } else {
        // If not found directly, create deep dive for offer ID
        const created = await dbService.createDeepDive(id);
        const full = await dbService.getDeepDiveById(created.id);
        setDeepDive(full || created);
      }
    } catch (err) {
      console.error('Error loading deep dive:', err);
    } fontally: {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: DeepDiveStatus) => {
    if (!deepDive) return;
    setIsSaving(true);
    try {
      const updated = await dbService.updateDeepDive(deepDive.id, { status });
      setDeepDive((prev) => (prev ? { ...prev, ...updated, status } : null));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePriority = async (priority: DeepDivePriority) => {
    if (!deepDive) return;
    setIsSaving(true);
    try {
      const updated = await dbService.updateDeepDive(deepDive.id, { priority });
      setDeepDive((prev) => (prev ? { ...prev, ...updated, priority } : null));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNotes = async (notes: Record<string, string>) => {
    if (!deepDive) return;
    setIsSaving(true);
    try {
      const updated = await dbService.updateDeepDive(deepDive.id, { notes });
      setDeepDive((prev) => (prev ? { ...prev, ...updated, notes } : null));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCreativeTags = async (creative_tags: Record<string, DeepDiveCreativeTag>) => {
    if (!deepDive) return;
    setIsSaving(true);
    try {
      const updated = await dbService.updateDeepDive(deepDive.id, { creative_tags });
      setDeepDive((prev) => (prev ? { ...prev, ...updated, creative_tags } : null));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLpSectionNotes = async (lp_section_notes: DeepDiveLpSectionNote[]) => {
    if (!deepDive) return;
    setIsSaving(true);
    try {
      const updated = await dbService.updateDeepDive(deepDive.id, { lp_section_notes });
      setDeepDive((prev) => (prev ? { ...prev, ...updated, lp_section_notes } : null));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateChecklist = async (checklist: Record<string, boolean>) => {
    if (!deepDive) return;
    setIsSaving(true);
    try {
      const updated = await dbService.updateDeepDive(deepDive.id, { checklist });
      setDeepDive((prev) => (prev ? { ...prev, ...updated, checklist } : null));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCaseSummary = async (case_summary: DeepDiveCaseSummary) => {
    if (!deepDive) return;
    setIsSaving(true);
    try {
      const updated = await dbService.updateDeepDive(deepDive.id, { case_summary });
      setDeepDive((prev) => (prev ? { ...prev, ...updated, case_summary } : null));
    } finally {
      setIsSaving(false);
    }
  };

  // Hypotheses CRUD
  const handleCreateHypothesis = async (data: Partial<DeepDiveHypothesis>) => {
    if (!deepDive) return;
    await dbService.createDeepDiveHypothesis(data);
    const refreshed = await dbService.getDeepDiveHypotheses(deepDive.id);
    setDeepDive((prev) => (prev ? { ...prev, hypotheses: refreshed } : null));
  };

  const handleUpdateHypothesis = async (hypoId: string, data: Partial<DeepDiveHypothesis>) => {
    if (!deepDive) return;
    await dbService.updateDeepDiveHypothesis(hypoId, data);
    const refreshed = await dbService.getDeepDiveHypotheses(deepDive.id);
    setDeepDive((prev) => (prev ? { ...prev, hypotheses: refreshed } : null));
  };

  const handleDeleteHypothesis = async (hypoId: string) => {
    if (!deepDive) return;
    await dbService.deleteDeepDiveHypothesis(hypoId);
    const refreshed = await dbService.getDeepDiveHypotheses(deepDive.id);
    setDeepDive((prev) => (prev ? { ...prev, hypotheses: refreshed } : null));
  };

  // Insights CRUD
  const handleCreateInsight = async (data: Partial<DeepDiveInsight>) => {
    if (!deepDive) return;
    await dbService.createDeepDiveInsight(data);
    const refreshed = await dbService.getDeepDiveInsights(deepDive.id);
    setDeepDive((prev) => (prev ? { ...prev, insights: refreshed } : null));
  };

  const handleDeleteInsight = async (insightId: string) => {
    if (!deepDive) return;
    await dbService.deleteDeepDiveInsight(insightId);
    const refreshed = await dbService.getDeepDiveInsights(deepDive.id);
    setDeepDive((prev) => (prev ? { ...prev, insights: refreshed } : null));
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!deepDive || !deepDive.offer) {
    return (
      <AppShell>
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 my-8 space-y-3">
          <h2 className="text-lg font-bold text-white">Bancada não encontrada</h2>
          <p className="text-xs text-slate-400">
            A oferta informada não existe ou foi excluída do sistema.
          </p>
          <Link
            href="/deep-dives"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Oficina
          </Link>
        </div>
      </AppShell>
    );
  }

  const offer = deepDive.offer;

  const workbenchTabs = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutGrid },
    { id: 'creatives', label: `Criativos (${offer.ads?.length || 0})`, icon: Video },
    { id: 'landing_page', label: 'Landing Page', icon: Globe },
    { id: 'offer_stack', label: 'Estrutura Oferta', icon: Tag },
    { id: 'checkout', label: 'Checkout & Bumps', icon: ShoppingCart },
    { id: 'copy', label: 'Copy & Hooks', icon: FileText },
    { id: 'audience', label: 'Público Alvo', icon: Users },
    { id: 'hypotheses', label: `Hipóteses (${deepDive.hypotheses?.length || 0})`, icon: Brain },
    { id: 'insights', label: `Insights (${deepDive.insights?.length || 0})`, icon: Sparkles },
    { id: 'notebook', label: 'Caderno Livre', icon: BookOpen },
    { id: 'case_summary', label: 'Checklist & Resumo', icon: Award },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-6 pb-16">
        {/* Header Component */}
        <WorkbenchHeader
          deepDive={deepDive}
          onUpdateStatus={handleUpdateStatus}
          onUpdatePriority={handleUpdatePriority}
          isSaving={isSaving}
        />

        {/* Workbench Tabs Navigation Bar */}
        <div className="border-b border-slate-800">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-px">
            {workbenchTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as WorkbenchTabKey)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? 'border-orange-500 text-white bg-slate-900/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Mapa da Oferta Tile */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-orange-400" />
                Mapa Factual da Oferta
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Preço Front</span>
                  <span className="text-sm font-black font-mono text-emerald-400 block">{formatCurrency(offer.price)}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Ads Ativos</span>
                  <span className="text-sm font-black font-mono text-white block">{offer.active_ads_count ?? '—'} ads</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Status LP</span>
                  <span className="text-xs font-mono font-bold text-cyan-400 block truncate mt-1">
                    {offer.landing_page_url ? 'Mapeada ✓' : 'Pendente'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Checkout Bumps</span>
                  <span className="text-xs font-mono font-bold text-indigo-300 block mt-1">
                    {offer.order_bumps?.length || 0} bumps
                  </span>
                </div>
              </div>
            </div>

            {/* 6 Visual Shortcut Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { id: 'creatives', title: 'Criativos', count: `${offer.ads?.length || 0} mídias`, icon: Video, color: 'text-indigo-400' },
                { id: 'landing_page', title: 'Landing Page', count: offer.landing_page_url ? 'Mapeada' : 'Pendente', icon: Globe, color: 'text-cyan-400' },
                { id: 'checkout', title: 'Checkout', count: `${offer.order_bumps?.length || 0} bumps`, icon: ShoppingCart, color: 'text-emerald-400' },
                { id: 'copy', title: 'Copy & Hooks', count: offer.headline ? 'Headline OK' : 'Parcial', icon: FileText, color: 'text-amber-400' },
                { id: 'hypotheses', title: 'Hipóteses', count: `${deepDive.hypotheses?.length || 0} ativas`, icon: Brain, color: 'text-purple-400' },
              ].map((tile) => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.id}
                    onClick={() => setActiveTab(tile.id as WorkbenchTabKey)}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-orange-500/40 text-left transition space-y-2 group shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={`w-5 h-5 ${tile.color}`} />
                      <span className="text-xs font-mono text-slate-400 font-bold group-hover:text-white transition">
                        {tile.count}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-white block group-hover:text-orange-400 transition">
                      {tile.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: CRIATIVOS */}
        {activeTab === 'creatives' && (
          <WorkbenchCreativesTab
            deepDive={deepDive}
            onUpdateCreativeTags={handleUpdateCreativeTags}
          />
        )}

        {/* Tab 3: LANDING PAGE */}
        {activeTab === 'landing_page' && (
          <WorkbenchLpTab
            deepDive={deepDive}
            onUpdateLpSectionNotes={handleUpdateLpSectionNotes}
          />
        )}

        {/* Tab 4: ESTRUTURA OFERTA */}
        {activeTab === 'offer_stack' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-400" />
              Análise Qualitativa da Oferta Comercial
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-200">O que torna esta oferta atraente?</span>
                <p className="text-xs text-slate-400">
                  Ex: Preço de R$ 10,00 remove qualquer atrito de decisão financeira no consumidor.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-200">Qual é a principal âncora de valor?</span>
                <p className="text-xs text-slate-400">
                  Ex: Volume massivo (365 receitas) cria percepção de abundância.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: CHECKOUT */}
        {activeTab === 'checkout' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              Análise de Monetização & Order Bumps
            </h3>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-200">Order Bumps Mapeados:</span>
              {offer.order_bumps && offer.order_bumps.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {offer.order_bumps.map((b) => (
                    <div key={b.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="text-white font-bold">{b.name || 'Bump'}</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(b.price)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Nenhum bump detectado automaticamente.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: COPY */}
        {activeTab === 'copy' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Copy & Elementos de Persuasão
            </h3>

            {offer.headline && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Headline Mapeada:</span>
                <p className="text-sm font-bold text-white">"{offer.headline}"</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: PÚBLICO */}
        {activeTab === 'audience' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Perfil de Público & Nicho
            </h3>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-200">Nicho Mapeado:</span>
              <p className="text-xs font-mono text-cyan-300 font-bold">{offer.niche || 'Geral'}</p>
            </div>
          </div>
        )}

        {/* Tab 8: HIPÓTESES */}
        {activeTab === 'hypotheses' && (
          <WorkbenchHypothesesTab
            deepDive={deepDive}
            hypotheses={deepDive.hypotheses || []}
            onCreateHypothesis={handleCreateHypothesis}
            onUpdateHypothesis={handleUpdateHypothesis}
            onDeleteHypothesis={handleDeleteHypothesis}
          />
        )}

        {/* Tab 9: INSIGHTS */}
        {activeTab === 'insights' && (
          <WorkbenchInsightsTab
            deepDive={deepDive}
            insights={deepDive.insights || []}
            onCreateInsight={handleCreateInsight}
            onDeleteInsight={handleDeleteInsight}
          />
        )}

        {/* Tab 10: CADERNO LIVRE */}
        {activeTab === 'notebook' && (
          <WorkbenchNotebookTab
            deepDive={deepDive}
            onUpdateNotes={handleUpdateNotes}
          />
        )}

        {/* Tab 11: CHECKLIST & RESUMO DO CASE */}
        {activeTab === 'case_summary' && (
          <WorkbenchCaseSummaryTab
            deepDive={deepDive}
            onUpdateChecklist={handleUpdateChecklist}
            onUpdateCaseSummary={handleUpdateCaseSummary}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </div>
    </AppShell>
  );
}
