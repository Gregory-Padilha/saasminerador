'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { dbService } from '@/lib/supabase/db';
import {
  DeepDive,
  DeepDiveStatus,
  DeepDivePriority,
  DeepDiveInsight,
  ResearchPattern,
} from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SelectDeepDiveOfferModal } from '@/components/deep-dives/SelectDeepDiveOfferModal';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getOfferScaleTier } from '@/lib/scale-tier';
import { calculateDossierCompleteness } from '@/lib/dossier';
import {
  BookOpen,
  Plus,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ArrowRight,
  Sparkles,
  Search,
  Tag,
  LayoutGrid,
  Kanban as KanbanIcon,
  Award,
  Brain,
  Layers,
  FileText,
  Filter,
} from 'lucide-react';

type ActiveView = 'oficina' | 'kanban' | 'cases' | 'insights' | 'patroes';

function DeepDivesContent() {
  const [deepDives, setDeepDives] = useState<DeepDive[]>([]);
  const [allInsights, setAllInsights] = useState<DeepDiveInsight[]>([]);
  const [allPatterns, setAllPatterns] = useState<ResearchPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active View Tab
  const [activeView, setActiveView] = useState<ActiveView>('oficina');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Filters for Insights & Cases tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [insightCategoryFilter, setInsightCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getDeepDives();
      setDeepDives(data);

      const insightsData = await dbService.getDeepDiveInsights();
      setAllInsights(insightsData);

      const patternsData = await dbService.getResearchPatterns();
      setAllPatterns(patternsData);
    } catch (err) {
      console.error('Error loading deep dives data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDeepDive = async (offerId: string, priority: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA') => {
    await dbService.createDeepDive(offerId, priority);
    await loadData();
  };

  const handleUpdateStatus = async (id: string, status: DeepDiveStatus) => {
    await dbService.updateDeepDive(id, { status });
    await loadData();
  };

  const handleDeleteDeepDive = async (id: string) => {
    await dbService.deleteDeepDive(id);
    await loadData();
  };

  // Grouped datasets
  const activeBancadas = useMemo(() => {
    return deepDives.filter((d) => d.status === 'EM_ANALISE' || d.status === 'SINTETIZANDO');
  }, [deepDives]);

  const filaDeepDives = useMemo(() => {
    return deepDives.filter((d) => d.status === 'BACKLOG');
  }, [deepDives]);

  const concludedCases = useMemo(() => {
    return deepDives.filter((d) => d.status === 'CONCLUIDO');
  }, [deepDives]);

  const archivedDeepDives = useMemo(() => {
    return deepDives.filter((d) => d.status === 'ARQUIVADO');
  }, [deepDives]);

  // Filtered Insights in Library
  const filteredInsights = useMemo(() => {
    return allInsights.filter((i) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchTitle = i.title?.toLowerCase().includes(q);
        const matchDesc = i.description?.toLowerCase().includes(q);
        const matchOffer = i.offer_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchOffer) return false;
      }
      if (insightCategoryFilter !== 'all' && i.category !== insightCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [allInsights, searchQuery, insightCategoryFilter]);

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Main Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <PageHeader
            title="OFICINA DE DEEP DIVES"
            description="Desmonte ofertas, identifique padrões e transforme dados em inteligência aplicável."
            badge={
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-semibold border border-orange-500/20 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                OFICINA DE INTELIGÊNCIA
              </span>
            }
          />

          <button
            onClick={() => setIsSelectorOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-lg shadow-orange-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            + NOVO DEEP DIVE
          </button>
        </div>

        {/* Top KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Na Fila</span>
            <span className="text-xl font-black font-mono text-white block">{filaDeepDives.length}</span>
            <span className="text-[10px] text-slate-500">Aguardando análise</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Em Investigação</span>
            <span className="text-xl font-black font-mono text-orange-400 block">{activeBancadas.length}</span>
            <span className="text-[10px] text-slate-500">Na bancada ativa</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Sintetizando</span>
            <span className="text-xl font-black font-mono text-indigo-400 block">
              {deepDives.filter((d) => d.status === 'SINTETIZANDO').length}
            </span>
            <span className="text-[10px] text-slate-500">Fase de conclusão</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Concluídos</span>
            <span className="text-xl font-black font-mono text-emerald-400 block">{concludedCases.length}</span>
            <span className="text-[10px] text-slate-500">Cases finalizados</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Insights Extraídos</span>
            <span className="text-xl font-black font-mono text-cyan-400 block">{allInsights.length}</span>
            <span className="text-[10px] text-slate-500">Biblioteca global</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Padrões Identificados</span>
            <span className="text-xl font-black font-mono text-purple-400 block">{allPatterns.length}</span>
            <span className="text-[10px] text-slate-500">Observações estratégicas</span>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap pb-px">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'oficina', label: 'Oficina (Bancadas)', icon: LayoutGrid },
              { id: 'kanban', label: 'Kanban Operacional', icon: KanbanIcon },
              { id: 'cases', label: `Cases Concluídos (${concludedCases.length})`, icon: Award },
              { id: 'insights', label: `Biblioteca de Insights (${allInsights.length})`, icon: Sparkles },
              { id: 'patroes', label: `Padrões Descobertos (${allPatterns.length})`, icon: Brain },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as ActiveView)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? 'border-orange-500 text-white bg-slate-900/50'
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

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* VIEW 1: OFICINA (DEFAULT WORKBENCH VIEW) */}
            {activeView === 'oficina' && (
              <div className="space-y-8">
                {/* 1. BANCADAS ATIVAS (PROMINENT CARDS) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      Bancadas Ativas em Investigação ({activeBancadas.length})
                    </h3>
                  </div>

                  {activeBancadas.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
                      <h4 className="text-sm font-bold text-white">Nenhuma bancada ativa no momento</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Sua oficina está aguardando o início de novas investigações. Escolha uma oferta da fila ou adicione uma nova.
                      </p>
                      <button
                        onClick={() => setIsSelectorOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold"
                      >
                        <Plus className="w-4 h-4" />
                        Iniciar Primeiro Deep Dive
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeBancadas.map((item) => {
                        const offer = item.offer;
                        if (!offer) return null;

                        const dossierComp = calculateDossierCompleteness(offer);
                        const tier = getOfferScaleTier(offer.active_ads_count).tier;

                        return (
                          <div
                            key={item.id}
                            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-orange-500/40 transition-all shadow-xl space-y-4 flex flex-col justify-between group"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {tier === 'FULL_SCALE' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      🔥 FULL ESCALA
                                    </span>
                                  )}
                                  {tier === 'HIGH_SCALE' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      🔴 ESCALA ALTA
                                    </span>
                                  )}
                                  <span className="text-xs font-semibold text-slate-400">
                                    {offer.niche || 'Geral'}
                                  </span>
                                </div>

                                <button
                                  onClick={() => handleDeleteDeepDive(item.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition"
                                  title="Remover da Oficina"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <Link
                                href={`/deep-dives/${offer.id}`}
                                className="font-extrabold text-base text-white hover:text-orange-400 transition-colors block leading-tight line-clamp-2"
                              >
                                {offer.product_name}
                              </Link>

                              <div className="text-xs text-slate-400 truncate">
                                {offer.advertiser || 'Anunciante não informado'}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
                                <span className="font-bold text-emerald-400">{formatCurrency(offer.price)}</span>
                                <span className="text-white font-bold">{offer.active_ads_count ?? '—'} ads</span>
                                <span className="text-slate-400">{offer.days_running ?? '—'}d</span>
                              </div>

                              {/* Progress metrics */}
                              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Dossiê</span>
                                  <span className="font-mono font-bold text-blue-400">{dossierComp.percentage}%</span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Investigação</span>
                                  <span className="font-mono font-bold text-orange-400">{item.investigation_progress ?? 0}%</span>
                                </div>
                              </div>
                            </div>

                            <Link
                              href={`/deep-dives/${offer.id}`}
                              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/10"
                            >
                              CONTINUAR INVESTIGAÇÃO
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. FILA DE INVESTIGAÇÃO (BACKLOG) */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Fila de Investigação ({filaDeepDives.length})
                  </h3>

                  {filaDeepDives.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                      Nenhuma oferta na fila de investigação.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {filaDeepDives.map((item) => {
                        const offer = item.offer;
                        if (!offer) return null;

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 flex flex-col justify-between group hover:border-slate-700 transition"
                          >
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                                {offer.niche || 'Geral'}
                              </span>
                              <h4 className="font-bold text-xs text-white line-clamp-1">{offer.product_name}</h4>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {offer.active_ads_count ?? '—'} ads • {formatCurrency(offer.price)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'EM_ANALISE')}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-orange-600 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition text-center"
                              >
                                Iniciar Estudo
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: KANBAN OPERACIONAL */}
            {activeView === 'kanban' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                {[
                  { id: 'BACKLOG', label: '1. Na Fila', color: 'border-slate-800 bg-slate-900/60' },
                  { id: 'EM_ANALISE', label: '2. Na Bancada', color: 'border-orange-500/40 bg-orange-950/10' },
                  { id: 'SINTETIZANDO', label: '3. Sintetizando', color: 'border-indigo-500/40 bg-indigo-950/10' },
                  { id: 'CONCLUIDO', label: '4. Concluído', color: 'border-emerald-500/40 bg-emerald-950/10' },
                ].map((col) => {
                  const columnItems = deepDives.filter((d) => d.status === col.id);

                  return (
                    <div key={col.id} className={`p-4 rounded-2xl border ${col.color} space-y-3 min-h-[500px]`}>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          {col.label}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {columnItems.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {columnItems.map((item) => {
                          const offer = item.offer;
                          if (!offer) return null;

                          return (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 shadow-sm hover:border-slate-700 transition"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-[10px] uppercase font-bold text-orange-400 truncate">
                                  {offer.niche || 'Geral'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  P: {item.priority}
                                </span>
                              </div>

                              <Link
                                href={`/deep-dives/${offer.id}`}
                                className="font-bold text-xs text-white hover:text-orange-400 block line-clamp-2"
                              >
                                {offer.product_name}
                              </Link>

                              <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-400">
                                <span>{offer.active_ads_count ?? '—'} ads</span>
                                <span className="text-emerald-400 font-bold">{formatCurrency(offer.price)}</span>
                              </div>

                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                                <select
                                  value={item.status}
                                  onChange={(e) => handleUpdateStatus(item.id, e.target.value as DeepDiveStatus)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] font-bold text-slate-300 focus:outline-none"
                                >
                                  <option value="BACKLOG">Na Fila</option>
                                  <option value="EM_ANALISE">Na Bancada</option>
                                  <option value="SINTETIZANDO">Sintetizando</option>
                                  <option value="CONCLUIDO">Concluído</option>
                                  <option value="ARQUIVADO">Arquivar</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW 3: CASES CONCLUÍDOS */}
            {activeView === 'cases' && (
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  Galeria de Cases Concluídos ({concludedCases.length})
                </h3>

                {concludedCases.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 italic text-slate-500 text-xs">
                    Nenhum case concluído até o momento. Finalize suas bancadas para exibi-las aqui.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {concludedCases.map((item) => {
                      const offer = item.offer;
                      if (!offer) return null;
                      const summary = item.case_summary;

                      return (
                        <div
                          key={item.id}
                          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl hover:border-emerald-500/40 transition flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                CASE ESTUDADO
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {item.completed_at ? formatDate(item.completed_at) : 'Concluído'}
                              </span>
                            </div>

                            <h4 className="font-extrabold text-base text-white">{offer.product_name}</h4>
                            <p className="text-xs text-slate-400">{offer.niche || 'Geral'}</p>

                            {summary?.main_promise && (
                              <p className="text-xs text-slate-300 italic border-l-2 border-emerald-500 pl-2">
                                "{summary.main_promise}"
                              </p>
                            )}

                            {/* Snapshot Evolution */}
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-mono">
                              <div>
                                <span className="text-[9px] uppercase text-slate-500 block">Início</span>
                                <span className="text-slate-300 font-bold">
                                  {item.start_snapshot?.active_ads_count ?? '—'} ads
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-slate-500 block">Conclusão</span>
                                <span className="text-emerald-400 font-bold">
                                  {item.end_snapshot?.active_ads_count ?? offer.active_ads_count ?? '—'} ads
                                </span>
                              </div>
                            </div>
                          </div>

                          <Link
                            href={`/deep-dives/${offer.id}`}
                            className="w-full py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white text-xs font-bold transition text-center"
                          >
                            Abrir Case Completo
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 4: INSIGHTS LIBRARY */}
            {activeView === 'insights' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar insights por título, palavra-chave ou oferta..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <select
                    value={insightCategoryFilter}
                    onChange={(e) => setInsightCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="all">Todas as Categorias</option>
                    <option value="Criativo">Criativo</option>
                    <option value="Copy">Copy</option>
                    <option value="Oferta">Oferta</option>
                    <option value="Landing Page">Landing Page</option>
                    <option value="Checkout">Checkout</option>
                    <option value="Pricing">Pricing</option>
                    <option value="Order Bump">Order Bump</option>
                    <option value="Público">Público</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredInsights.map((ins) => (
                    <div
                      key={ins.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl hover:border-cyan-500/40 transition flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {ins.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">
                            {ins.offer_name}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-white">{ins.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{ins.description}</p>
                      </div>

                      {ins.deep_dive_id && (
                        <Link
                          href={`/deep-dives/${ins.deep_dive_id}`}
                          className="text-xs font-bold text-cyan-400 hover:underline inline-flex items-center gap-1 pt-2 border-t border-slate-800/80"
                        >
                          Ver Deep Dive <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 5: PADRÕES DESCOBERTOS */}
            {activeView === 'patroes' && (
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Biblioteca de Padrões Observados ({allPatterns.length})
                </h3>

                {allPatterns.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 italic text-slate-500 text-xs">
                    Nenhum padrão cadastrado ainda. Padrões observados em múltiplos Deep Dives serão consolidados nesta biblioteca.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allPatterns.map((pat) => (
                      <div key={pat.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {pat.category}
                        </span>
                        <h4 className="font-bold text-sm text-white">{pat.title}</h4>
                        <p className="text-xs text-slate-300">{pat.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Modal for Selector */}
        {isSelectorOpen && (
          <SelectDeepDiveOfferModal
            isOpen={isSelectorOpen}
            onClose={() => setIsSelectorOpen(false)}
            onSelectOffer={handleCreateDeepDive}
            existingDeepDives={deepDives}
          />
        )}
      </div>
    </AppShell>
  );
}

export default function DeepDivesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando Oficina...</div>}>
      <DeepDivesContent />
    </Suspense>
  );
}
