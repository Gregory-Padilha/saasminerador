'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Offer } from '@/types';
import { offerEvents } from '@/lib/events/offer-events';
import {
  getDashboardSummary,
  DashboardSummary,
  PeriodFilter,
} from '@/lib/dashboard/aggregator';
import { ImportDropdown } from '@/components/imports/ImportDropdown';
import { JsonImportModal } from '@/components/imports/JsonImportModal';
import {
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Eye,
  Star,
  Flame,
  Globe,
  UploadCloud,
  ArrowRight,
  PieChart,
  BarChart3,
  Package,
  Activity,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw,
  FileText,
  DollarSign,
  Image as ImageIcon,
  SlidersHorizontal,
} from 'lucide-react';

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  // Featured Offers active tab
  const [featuredTab, setFeaturedTab] = useState<
    'topAds' | 'longestRunning' | 'newWithVolume' | 'mostCreatives' | 'recentlyUpdated'
  >('topAds');

  useEffect(() => {
    loadSummary(period, true);

    const unsub = offerEvents.subscribe(() => {
      loadSummary(period, false);
    });
    return () => unsub();
  }, [period]);

  const loadSummary = async (p: PeriodFilter, showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const data = await getDashboardSummary(p);
      setSummary(data);
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  const handlePeriodChange = (p: PeriodFilter) => {
    setPeriod(p);
    startTransition(() => {
      loadSummary(p);
    });
  };

  const formattedLastUpdated = summary?.lastUpdated
    ? new Date(summary.lastUpdated).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <AppShell>
      <div className="space-y-10 pb-16">
        {/* ================================================================== */}
        {/* 1. HEADER & PERIOD SELECTOR */}
        {/* ================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Central de Inteligência
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                Offer Miner v2
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Visão consolidada das ofertas, criativos, landing pages e movimentos observados na sua base.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Last updated indicator */}
            {formattedLastUpdated && (
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline-block mr-1">
                Última atualização: {formattedLastUpdated}
              </span>
            )}

            {/* Period Selector Filter */}
            <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => handlePeriodChange('7d')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === '7d'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7 dias
              </button>
              <button
                onClick={() => handlePeriodChange('30d')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === '30d'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                30 dias
              </button>
              <button
                onClick={() => handlePeriodChange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todo período
              </button>
            </div>

            {/* Import Action */}
            <ImportDropdown
              onOpenJsonImport={() => setIsJsonModalOpen(true)}
              className="shrink-0"
            />
          </div>
        </div>

        {/* ================================================================== */}
        {/* 2. TOP 6 KPI CARDS */}
        {/* ================================================================== */}
        {isLoading || !summary ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-900 border border-slate-800/80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {/* KPI 1: TOTAL DA BASE */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2 relative group overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total da Base
                </span>
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white font-mono block">
                  {summary.kpis.totalBase}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {summary.kpis.activeOffers} ativas · {summary.kpis.archivedOffers} arquivadas
                </span>
              </div>
            </div>

            {/* KPI 2: NOVAS OFERTAS */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2 relative group overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Novas Ofertas
                </span>
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white font-mono block">
                  {summary.kpis.newOffersPeriod}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {period === '7d'
                    ? 'últimos 7 dias'
                    : period === '30d'
                    ? 'últimos 30 dias'
                    : 'todo o período'}
                </span>
              </div>
            </div>

            {/* KPI 3: ADS ATIVOS MAPEADOS */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2 relative group overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Ads Ativos
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white font-mono block">
                  {summary.kpis.totalActiveAdsMapped}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  somatório da base
                </span>
              </div>
            </div>

            {/* KPI 4: CRIATIVOS CAPTURADOS */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2 relative group overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Criativos
                </span>
                <ImageIcon className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white font-mono block">
                  {summary.kpis.capturedCreativesCount}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  arquivos catalogados
                </span>
              </div>
            </div>

            {/* KPI 5: LANDING PAGES MAPEADAS */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2 relative group overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  LPs Mapeadas
                </span>
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white font-mono block">
                  {summary.kpis.lpsMappedCount} <span className="text-slate-500 font-normal text-lg">/ {summary.kpis.lpsAvailableCount}</span>
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {summary.kpis.lpsMappedPercentage}% das LPs conhecidas
                </span>
              </div>
            </div>

            {/* KPI 6: ACOMPANHANDO */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2 relative group overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Acompanhando
                </span>
                <Eye className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white font-mono block">
                  {summary.kpis.watchingCount}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  ofertas sob observação
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* 3. SECTION: O QUE MUDOU (HISTORICAL MOVEMENT FEED) */}
        {/* ================================================================== */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                O Que Mudou
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Eventos e comparações históricas reais
            </span>
          </div>

          {isLoading || !summary ? (
            <div className="h-16 rounded-xl bg-slate-950/60 animate-pulse" />
          ) : summary.recentChanges.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-850">
              <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <span>Ainda não há histórico suficiente para detectar mudanças.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {summary.recentChanges.map((chg) => (
                <Link
                  key={chg.id}
                  href={`/offers/${chg.offerId}`}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 transition flex flex-col justify-between gap-2.5 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors">
                        {chg.productName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {chg.niche}
                      </span>
                    </div>

                    {chg.changeType === 'ads_increase' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                        <TrendingUp className="w-3 h-3" /> +Ads
                      </span>
                    )}
                    {chg.changeType === 'ads_decrease' && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                        <TrendingDown className="w-3 h-3" /> -Ads
                      </span>
                    )}
                    {chg.changeType === 'price_change' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                        <DollarSign className="w-3 h-3" /> Preço
                      </span>
                    )}
                    {chg.changeType === 'lp_unavailable' && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                        <AlertTriangle className="w-3 h-3" /> LP
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs font-mono">
                    <span className="text-slate-400 text-[11px]">
                      {chg.oldValue} → <strong className="text-white">{chg.newValue}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(chg.changedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* 4. SECTION: OFERTAS EM EVIDÊNCIA (8 COLS) + MINHA PESQUISA (4 COLS) */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* OFERTAS EM EVIDÊNCIA (8 cols) */}
          <div className="lg:col-span-8 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Ofertas em Evidência
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setFeaturedTab('topAds')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    featuredTab === 'topAds'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mais Anúncios
                </button>
                <button
                  onClick={() => setFeaturedTab('longestRunning')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    featuredTab === 'longestRunning'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mais Longevas
                </button>
                <button
                  onClick={() => setFeaturedTab('newWithVolume')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    featuredTab === 'newWithVolume'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Novas com Volume
                </button>
                <button
                  onClick={() => setFeaturedTab('mostCreatives')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    featuredTab === 'mostCreatives'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mais Criativos
                </button>
              </div>
            </div>

            {/* Compact Offer Cards List */}
            {isLoading || !summary ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-950 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(summary.featuredOffers[featuredTab] || []).map((o) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3 text-xs group"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/offers/${o.id}`}
                        className="font-bold text-white hover:text-blue-400 transition-colors truncate block"
                      >
                        {o.product_name}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-blue-400 font-medium truncate">{o.niche || 'Sem classificação'}</span>
                        <span>•</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {formatCurrency(o.price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono text-[11px]">
                        <span className="text-white font-bold block">
                          {o.active_ads_count ?? '—'} ads
                        </span>
                        <span className="text-slate-400 text-[10px] block">
                          {o.days_running ?? '—'} dias rodando
                        </span>
                      </div>

                      <Link
                        href={`/offers/${o.id}`}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 font-semibold text-[11px] transition flex items-center gap-1"
                      >
                        <span>Dossiê</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MINHA PESQUISA (4 cols) */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                    Minha Pesquisa
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400">Atalhos diretos</span>
              </div>

              {isLoading || !summary ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-slate-950 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Link
                    href="/offers?quickFilter=favorites"
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Favoritas
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-400 text-sm px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      {summary.userResearch.favoritesCount}
                    </span>
                  </Link>

                  <Link
                    href="/offers?quickFilter=deep_dive"
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-orange-500/50 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame className="w-4 h-4 text-orange-400 fill-orange-400/20" />
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Deep Dives
                      </span>
                    </div>
                    <span className="font-mono font-bold text-orange-400 text-sm px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                      {summary.userResearch.deepDivesCount}
                    </span>
                  </Link>

                  <Link
                    href="/offers?quickFilter=watching"
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Acompanhando
                      </span>
                    </div>
                    <span className="font-mono font-bold text-blue-400 text-sm px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      {summary.userResearch.watchingCount}
                    </span>
                  </Link>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-center">
              <Link
                href="/offers"
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1.5"
              >
                <span>Explorar todas as ofertas no Explorer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 5. SECTION: INTELIGÊNCIA DE MERCADO */}
        {/* ================================================================== */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Inteligência de Mercado
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Distribuições reais calculadas da base
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
            {/* TOP NICHOS (6 cols) */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Top Nichos
                </span>
                <span className="text-[11px] text-slate-400">Distribuição & Preço</span>
              </div>

              {isLoading || !summary ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-slate-950 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {summary.marketIntelligence.topNiches.map((n) => {
                    const maxCount = summary.marketIntelligence.topNiches[0]?.count || 1;
                    const pct = Math.round((n.count / maxCount) * 100);
                    return (
                      <Link
                        key={n.niche}
                        href={`/offers?niche=${encodeURIComponent(n.niche)}`}
                        className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 hover:border-blue-500/40 transition block group"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                            {n.niche}
                          </span>
                          <span className="font-mono text-slate-300 font-semibold">
                            {n.count} ofertas
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>
                            Ticket médio:{' '}
                            <strong className="text-emerald-400 font-mono">
                              {n.avgPrice ? formatCurrency(n.avgPrice) : '—'}
                            </strong>
                          </span>
                          <span>
                            Mediana ads:{' '}
                            <strong className="text-slate-200 font-mono">{n.medianAds} ads</strong>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FAIXAS DE PREÇO (3 cols) */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Faixas de Preço
                </span>
                <span className="text-[11px] text-slate-400">Distribuição</span>
              </div>

              {isLoading || !summary ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 rounded-xl bg-slate-950 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Média</span>
                      <strong className="font-mono text-emerald-400 text-sm">
                        {summary.marketIntelligence.priceDistribution.avgPrice
                          ? formatCurrency(summary.marketIntelligence.priceDistribution.avgPrice)
                          : '—'}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Mediana</span>
                      <strong className="font-mono text-cyan-400 text-sm">
                        {summary.marketIntelligence.priceDistribution.medianPrice
                          ? formatCurrency(summary.marketIntelligence.priceDistribution.medianPrice)
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {summary.marketIntelligence.priceDistribution.ranges.map((r) => (
                      <div key={r.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-medium">{r.label}</span>
                          <span className="font-mono text-slate-400">
                            {r.count} ({r.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${r.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* VOLUME DE ADS (3 cols) */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Volume de Ads
                </span>
                <span className="text-[11px] text-slate-400">Escala</span>
              </div>

              {isLoading || !summary ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 rounded-xl bg-slate-950 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {summary.marketIntelligence.adsDistribution.map((r) => (
                    <div key={r.range} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">{r.range}</span>
                        <span className="font-mono text-slate-400">
                          {r.count} ofertas ({r.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${r.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORMATOS DE PRODUTO (6 cols) */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Formatos de Produto
                </span>
                <span className="text-[11px] text-slate-400">Normalizados</span>
              </div>

              {isLoading || !summary ? (
                <div className="h-20 rounded-xl bg-slate-950 animate-pulse" />
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {summary.marketIntelligence.productTypes.map((pt) => (
                    <div
                      key={pt.type}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-200 truncate mr-2">
                        {pt.type}
                      </span>
                      <span className="font-mono text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[11px] shrink-0">
                        {pt.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORMATOS DE CRIATIVO (6 cols) */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Formatos de Criativo
                </span>
                <span className="text-[11px] text-slate-400">Mídias observadas</span>
              </div>

              {isLoading || !summary ? (
                <div className="h-20 rounded-xl bg-slate-950 animate-pulse" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {summary.marketIntelligence.creativeFormats.map((cf) => (
                    <div
                      key={cf.format}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-850 text-center space-y-1"
                    >
                      <span className="text-xs font-medium text-slate-300 block">
                        {cf.format}
                      </span>
                      <span className="font-mono text-lg font-extrabold text-cyan-400 block">
                        {cf.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 6. SECTION: BASE & PENDÊNCIAS (6 COLS) + ATIVIDADE RECENTE (6 COLS) */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* BASE & PENDÊNCIAS (6 cols) */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Base & Pendências
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">Qualidade dos dados</span>
            </div>

            {isLoading || !summary ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-slate-950 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {summary.baseIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/offers?quickFilter=${issue.filterKey}`}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-850 hover:border-amber-500/40 transition flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          issue.severity === 'error'
                            ? 'bg-rose-500'
                            : issue.severity === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-blue-400'
                        }`}
                      />
                      <span className="font-semibold text-slate-200 group-hover:text-white">
                        {issue.label}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs">
                      {issue.count}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ATIVIDADE RECENTE (6 cols) */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Atividade Recente
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Últimas ações</span>
            </div>

            {isLoading || !summary ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-slate-950 animate-pulse" />
                ))}
              </div>
            ) : summary.recentActivity.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Nenhuma atividade registrada recentemente.
              </div>
            ) : (
              <div className="space-y-2.5">
                {summary.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-850 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      {act.offerId ? (
                        <Link
                          href={`/offers/${act.offerId}`}
                          className="font-bold text-white hover:text-blue-400 transition-colors block truncate"
                        >
                          {act.title}
                        </Link>
                      ) : (
                        <span className="font-bold text-white block">{act.title}</span>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {act.description}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {formatDate(act.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JSON Import Modal */}
      <JsonImportModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        onSuccess={() => loadSummary(period, false)}
      />
    </AppShell>
  );
}
