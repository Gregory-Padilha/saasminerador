'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { dbService } from '@/lib/supabase/db';
import { Offer } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, FacelessBadge } from '@/components/ui/StatusBadge';
import { DossierCompletenessBadge } from '@/components/ui/DossierCompletenessBadge';
import { TrendBadge } from '@/components/ui/TrendBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Compass,
  Search,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  Star,
  Eye,
  ExternalLink,
  ArrowRight,
  Flame,
  CheckCircle2,
  Layers,
  RotateCcw,
} from 'lucide-react';

type SortOption =
  | 'recent'
  | 'oldest'
  | 'ads_desc'
  | 'ads_asc'
  | 'price_desc'
  | 'price_asc'
  | 'days_desc'
  | 'days_asc'
  | 'creatives_desc'
  | 'last_seen'
  | 'name_asc';

function RadarContent() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('all');
  const [selectedProductType, setSelectedProductType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [facelessFilter, setFacelessFilter] = useState<'all' | 'faceless' | 'expert'>('all');
  const [hasLpOnly, setHasLpOnly] = useState(false);
  const [hasCheckoutOnly, setHasCheckoutOnly] = useState(false);
  const [hasBumpsOnly, setHasBumpsOnly] = useState(false);
  const [hasUpsellsOnly, setHasUpsellsOnly] = useState(false);
  const [watchingOnly, setWatchingOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Price & Ads ranges
  const [minAds, setMinAds] = useState<number | ''>('');
  const [maxAds, setMaxAds] = useState<number | ''>('');
  const [minDays, setMinDays] = useState<number | ''>('');
  const [maxDays, setMaxDays] = useState<number | ''>('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  // Quick Filter preset
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getOffers();
      setOffers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Distinct values for dropdowns
  const niches = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.niche) set.add(o.niche);
    });
    return Array.from(set).sort();
  }, [offers]);

  const productTypes = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.product_type) set.add(o.product_type);
    });
    return Array.from(set).sort();
  }, [offers]);

  const formats = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.ad_format) set.add(o.ad_format);
    });
    return Array.from(set).sort();
  }, [offers]);

  // Apply Quick Filter Presets
  const applyPreset = (presetName: string) => {
    if (activePreset === presetName) {
      // Toggle off
      resetFilters();
      return;
    }

    resetFilters();
    setActivePreset(presetName);

    switch (presetName) {
      case '10_30_days':
        setMinDays(10);
        setMaxDays(30);
        break;
      case '20_plus_ads':
        setMinAds(20);
        break;
      case '30_plus_ads':
        setMinAds(30);
        break;
      case 'price_20_30':
        setMinPrice(20);
        setMaxPrice(30);
        break;
      case 'price_30_40':
        setMinPrice(30);
        setMaxPrice(40);
        break;
      case 'faceless_only':
        setFacelessFilter('faceless');
        break;
      case 'with_lp':
        setHasLpOnly(true);
        break;
      case 'with_checkout':
        setHasCheckoutOnly(true);
        break;
      case 'with_bumps':
        setHasBumpsOnly(true);
        break;
      case 'with_upsells':
        setHasUpsellsOnly(true);
        break;
      case 'watching':
        setWatchingOnly(true);
        break;
      case 'no_deep_dive':
        // Filter in memo
        break;
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedNiche('all');
    setSelectedProductType('all');
    setSelectedStatus('all');
    setSelectedFormat('all');
    setFacelessFilter('all');
    setHasLpOnly(false);
    setHasCheckoutOnly(false);
    setHasBumpsOnly(false);
    setHasUpsellsOnly(false);
    setWatchingOnly(false);
    setFavoritesOnly(false);
    setMinAds('');
    setMaxAds('');
    setMinDays('');
    setMaxDays('');
    setMinPrice('');
    setMaxPrice('');
    setActivePreset(null);
  };

  // Filtered & Sorted offers
  const filteredOffers = useMemo(() => {
    return offers
      .filter((o) => {
        // Search text
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = o.product_name?.toLowerCase().includes(q);
          const matchAdv = o.advertiser?.toLowerCase().includes(q);
          const matchNiche = o.niche?.toLowerCase().includes(q);
          const matchSubniche = o.subniche?.toLowerCase().includes(q);
          const matchHeadline = o.headline?.toLowerCase().includes(q);
          const matchPromise = o.promise?.toLowerCase().includes(q);
          if (!matchName && !matchAdv && !matchNiche && !matchSubniche && !matchHeadline && !matchPromise) {
            return false;
          }
        }

        // Niche
        if (selectedNiche !== 'all' && o.niche !== selectedNiche) return false;

        // Product Type
        if (selectedProductType !== 'all' && o.product_type !== selectedProductType) return false;

        // Status
        if (selectedStatus !== 'all' && o.status !== selectedStatus) return false;

        // Ad Format
        if (selectedFormat !== 'all' && o.ad_format !== selectedFormat) return false;

        // Faceless
        if (facelessFilter === 'faceless' && o.faceless !== true) return false;
        if (facelessFilter === 'expert' && o.faceless !== false) return false;

        // Boolean toggles
        if (hasLpOnly && !o.landing_page_url) return false;
        if (hasCheckoutOnly && !o.checkout_url) return false;
        if (hasBumpsOnly && (!o.order_bumps || o.order_bumps.length === 0)) return false;
        if (hasUpsellsOnly && (!o.upsells || o.upsells.length === 0)) return false;
        if (watchingOnly && !o.watching) return false;
        if (favoritesOnly && !o.favorite) return false;
        if (activePreset === 'no_deep_dive' && o.in_deep_dive) return false;

        // Numerical ranges
        if (minAds !== '' && (o.active_ads_count ?? 0) < Number(minAds)) return false;
        if (maxAds !== '' && (o.active_ads_count ?? 0) > Number(maxAds)) return false;

        if (minDays !== '' && (o.days_running ?? 0) < Number(minDays)) return false;
        if (maxDays !== '' && (o.days_running ?? 0) > Number(maxDays)) return false;

        if (minPrice !== '' && (o.price ?? 0) < Number(minPrice)) return false;
        if (maxPrice !== '' && (o.price ?? 0) > Number(maxPrice)) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent':
            return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
          case 'oldest':
            return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
          case 'ads_desc':
            return (b.active_ads_count ?? 0) - (a.active_ads_count ?? 0);
          case 'ads_asc':
            return (a.active_ads_count ?? 0) - (b.active_ads_count ?? 0);
          case 'price_desc':
            return (b.price ?? 0) - (a.price ?? 0);
          case 'price_asc':
            return (a.price ?? 0) - (b.price ?? 0);
          case 'days_desc':
            return (b.days_running ?? 0) - (a.days_running ?? 0);
          case 'days_asc':
            return (a.days_running ?? 0) - (b.days_running ?? 0);
          case 'creatives_desc':
            return (b.estimated_unique_creatives ?? 0) - (a.estimated_unique_creatives ?? 0);
          case 'last_seen':
            return new Date(b.last_seen_at || b.created_at).getTime() - new Date(a.last_seen_at || a.created_at).getTime();
          case 'name_asc':
            return (a.product_name || '').localeCompare(b.product_name || '');
          default:
            return 0;
        }
      });
  }, [
    offers,
    searchQuery,
    selectedNiche,
    selectedProductType,
    selectedStatus,
    selectedFormat,
    facelessFilter,
    hasLpOnly,
    hasCheckoutOnly,
    hasBumpsOnly,
    hasUpsellsOnly,
    watchingOnly,
    favoritesOnly,
    minAds,
    maxAds,
    minDays,
    maxDays,
    minPrice,
    maxPrice,
    activePreset,
    sortBy,
  ]);

  const handleToggleFavorite = async (id: string, current: boolean) => {
    const nextVal = await dbService.toggleFavorite(id, current);
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, favorite: nextVal } : o)));
  };

  const handleToggleWatchlist = async (id: string, current: boolean) => {
    const nextVal = await dbService.toggleWatchlist(id, current);
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, watching: nextVal } : o)));
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        <PageHeader
          title="Radar de Ofertas Mineradas"
          description="Central de pesquisa e filtros facetados: explore o banco de inteligência com base em dados operacionais e fatos da mineração."
          badge={
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              Pesquisa Facetada
            </span>
          }
        />

        {/* Quick Filter Presets */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Filtros Rápidos:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { id: '10_30_days', label: '10–30 Dias Rodando' },
              { id: '20_plus_ads', label: '20+ Ads Ativos' },
              { id: '30_plus_ads', label: '30+ Ads Ativos' },
              { id: 'price_20_30', label: 'Faixa R$ 20–30' },
              { id: 'price_30_40', label: 'Faixa R$ 30–40' },
              { id: 'faceless_only', label: 'Apenas Faceless' },
              { id: 'with_lp', label: 'Com Landing Page' },
              { id: 'with_checkout', label: 'Com Checkout' },
              { id: 'with_bumps', label: 'Com Order Bump' },
              { id: 'with_upsells', label: 'Com Upsell' },
              { id: 'watching', label: 'Acompanhando' },
              { id: 'no_deep_dive', label: 'Sem Deep Dive' },
            ].map((p) => {
              const isActive = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Search & Facet Filters Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          {/* Top Line: Search + Sort + Reset */}
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por produto, anunciante, nicho, headline, promessa..."
                className="w-full pl-9.5 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="recent">Mais Recentes</option>
                  <option value="oldest">Mais Antigas</option>
                  <option value="ads_desc">Mais Ads Ativos</option>
                  <option value="ads_asc">Menos Ads Ativos</option>
                  <option value="price_desc">Maior Preço</option>
                  <option value="price_asc">Menor Preço</option>
                  <option value="days_desc">Mais Dias Rodando</option>
                  <option value="days_asc">Menos Dias Rodando</option>
                  <option value="creatives_desc">Mais Criativos</option>
                  <option value="last_seen">Última Captura</option>
                  <option value="name_asc">Nome (A-Z)</option>
                </select>
              </div>

              <button
                onClick={resetFilters}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                title="Limpar todos os filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Secondary Filters Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-800/80">
            {/* Nicho */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Nicho
              </label>
              <select
                value={selectedNiche}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todos os Nichos</option>
                {niches.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Produto */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Tipo Produto
              </label>
              <select
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todos os Tipos</option>
                {productTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Status de Pesquisa */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Status Pesquisa
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todos os Status</option>
                <option value="NOVA">Nova</option>
                <option value="DADOS_PARCIAIS">Dados Parciais</option>
                <option value="MAPEADA">Mapeada</option>
                <option value="ANALISADA">Analisada</option>
                <option value="ACOMPANHANDO">Acompanhando</option>
                <option value="ARQUIVADA">Arquivada</option>
              </select>
            </div>

            {/* Formato de Criativo */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Formato Criativo
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todos os Formatos</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Faceless */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Operação Faceless
              </label>
              <select
                value={facelessFilter}
                onChange={(e) => setFacelessFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Qualquer Formato</option>
                <option value="faceless">Apenas Faceless</option>
                <option value="expert">Com Especialista</option>
              </select>
            </div>

            {/* Faixa de Preço */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Preço (R$)
              </label>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Info Counter */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-slate-400">
            Mostrando <strong className="text-white">{filteredOffers.length}</strong> de {offers.length} ofertas catalogadas
          </span>
        </div>

        {/* Table of Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOffers.length === 0 ? (
          <EmptyState
            title="Nenhuma oferta encontrada com esses filtros"
            description="Tente ajustar ou limpar seus parâmetros de busca para visualizar as ofertas mineradas."
            actionText="Limpar Filtros"
            onAction={resetFilters}
          />
        ) : (
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Produto & Anunciante</th>
                    <th className="py-3 px-3">Nicho / Tipo</th>
                    <th className="py-3 px-3 text-right">Preço</th>
                    <th className="py-3 px-3 text-center">Ads Ativos</th>
                    <th className="py-3 px-3 text-center">Criativos</th>
                    <th className="py-3 px-3 text-center">Dias</th>
                    <th className="py-3 px-3 text-center">Status Pesquisa</th>
                    <th className="py-3 px-3 text-center">Dossiê</th>
                    <th className="py-3 pl-4 pr-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOffers.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-850/60 transition group cursor-pointer"
                    >
                      {/* Product Name & Advertiser */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(o.id, o.favorite);
                            }}
                            className={`p-1 rounded transition ${
                              o.favorite ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-slate-400'
                            }`}
                            title={o.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>

                          <div className="min-w-0">
                            <Link
                              href={`/offers/${o.id}`}
                              className="font-bold text-white group-hover:text-blue-400 transition-colors block truncate"
                            >
                              {o.product_name}
                            </Link>
                            <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                              {o.advertiser || 'Anunciante não informado'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Niche / Type */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-200 block truncate">
                          {o.niche || 'Geral'}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {o.product_type || o.ad_format || 'Ebook'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-400">
                        {formatCurrency(o.price)}
                      </td>

                      {/* Active Ads */}
                      <td className="py-3.5 px-3 text-center font-mono tabular-nums font-bold text-white">
                        {o.active_ads_count !== null && o.active_ads_count !== undefined
                          ? `${o.active_ads_count} ads`
                          : '—'}
                      </td>

                      {/* Unique Creatives */}
                      <td className="py-3.5 px-3 text-center font-mono tabular-nums text-indigo-300 font-semibold">
                        {o.estimated_unique_creatives !== null && o.estimated_unique_creatives !== undefined
                          ? o.estimated_unique_creatives
                          : '—'}
                      </td>

                      {/* Days Running */}
                      <td className="py-3.5 px-3 text-center font-mono tabular-nums text-slate-300">
                        {o.days_running !== null && o.days_running !== undefined
                          ? `${o.days_running}d`
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <StatusBadge status={o.status} />
                      </td>

                      {/* Dossier Completeness */}
                      <td className="py-3.5 px-3 text-center">
                        <DossierCompletenessBadge offer={o} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWatchlist(o.id, o.watching);
                            }}
                            className={`p-1.5 rounded-lg border transition ${
                              o.watching
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                            }`}
                            title={o.watching ? 'Acompanhando' : 'Acompanhar oferta'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {o.landing_page_url && (
                            <a
                              href={o.landing_page_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                              title="Abrir Landing Page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <Link
                            href={`/offers/${o.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-xs font-semibold transition"
                          >
                            Dossiê
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando Radar...</div>}>
      <RadarContent />
    </Suspense>
  );
}
