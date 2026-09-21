'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { OfferFiltersState, SavedView, Offer } from '@/types';
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Plus,
  Trash2,
  LayoutGrid,
  Table as TableIcon,
  X,
  Flame,
  Globe,
  ShoppingCart,
  Check,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dbService } from '@/lib/supabase/db';
import { OfferFilterDrawer } from './OfferFilterDrawer';
import { getOfferScaleTier } from '@/lib/scale-tier';

interface OfferFiltersProps {
  filters: OfferFiltersState;
  onChange: (newFilters: OfferFiltersState) => void;
  availableNiches: string[];
  availableProductTypes: string[];
  totalCount: number;
  filteredCount: number;
  allOffers?: Offer[];
  visibleColumns?: Record<string, boolean>;
  onToggleColumn?: (colKey: string) => void;
  viewMode?: 'cards' | 'table';
  onChangeViewMode?: (mode: 'cards' | 'table') => void;
}

export function OfferFilters({
  filters,
  onChange,
  availableNiches,
  availableProductTypes,
  totalCount,
  filteredCount,
  allOffers = [],
  visibleColumns,
  onToggleColumn,
  viewMode = 'cards',
  onChangeViewMode,
}: OfferFiltersProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [isSavingView, setIsSavingView] = useState(false);
  const [viewName, setViewName] = useState('');

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Load Saved Views
  useEffect(() => {
    dbService.getSavedViews().then(setSavedViews);
  }, []);

  // Sync localSearch if external search filter changes
  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

  // Debounced search trigger (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filtersRef.current.search) {
        onChange({ ...filtersRef.current, search: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onChange]);

  const handleClear = () => {
    setLocalSearch('');
    onChange({
      search: '',
      niche: 'all',
      subniche: 'all',
      productType: 'all',
      scaleTier: 'all',
      maturityRange: undefined,
      adsRange: undefined,
      priceRange: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minAds: undefined,
      maxAds: undefined,
      minDays: undefined,
      maxDays: undefined,
      minCreatives: undefined,
      maxCreatives: undefined,
      faceless: 'all',
      status: 'all',
      decision: 'all',
      trend: 'all',
      adFormat: 'all',
      minScore: undefined,
      selectedNiches: [],
      selectedProductTypes: [],
      lpStatusFilter: 'all',
      checkoutStatusFilter: 'all',
      orderBumpsFilter: 'all',
      sourceFilter: 'all',
      dateAddedFilter: 'all',
      onlyFavorites: false,
      onlyWatching: false,
      onlyDeepDive: false,
      quickFilter: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  };

  const handleQuickChip = (chipKey: OfferFiltersState['quickFilter']) => {
    if (filters.quickFilter === chipKey) {
      onChange({ ...filters, quickFilter: 'all' });
      return;
    }
    onChange({ ...filters, quickFilter: chipKey });
  };

  const handleSaveViewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) return;
    const newV = await dbService.saveView(viewName.trim(), filters);
    setSavedViews((prev) => [newV, ...prev]);
    setViewName('');
    setIsSavingView(false);
  };

  const handleApplySavedView = (view: SavedView) => {
    onChange({
      ...filters,
      ...view.filters,
    });
  };

  const handleDeleteSavedView = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await dbService.deleteSavedView(id);
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  };

  // Compute live counts for Quick Filters
  const counts = useMemo(() => {
    let fullScale = 0;
    let ads100 = 0;
    let ads30 = 0;
    let normalScale = 0;
    let new7d = 0;
    let watching = 0;
    let deepDive = 0;
    let favorites = 0;
    let price2030 = 0;
    let days20 = 0;
    let faceless = 0;
    let withLp = 0;
    let withCheckout = 0;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    allOffers.forEach((o) => {
      const ads = o.active_ads_count ?? 0;
      if (ads > 200) fullScale++;
      if (ads >= 100) ads100++;
      if (ads >= 30) ads30++;
      if (ads <= 30) normalScale++;

      if (new Date(o.created_at).getTime() >= sevenDaysAgo) new7d++;
      if (o.watching) watching++;
      if (o.in_deep_dive) deepDive++;
      if (o.favorite) favorites++;

      const p = o.price ?? 0;
      if (p >= 20 && p <= 30) price2030++;
      if ((o.days_running ?? 0) >= 20) days20++;
      if (o.faceless === true) faceless++;

      if (o.landing_page_url && o.landing_page_url.trim() !== '') withLp++;
      if (o.checkout_url && o.checkout_url.trim() !== '' && o.checkout_url.trim() !== o.landing_page_url?.trim()) withCheckout++;
    });

    return {
      fullScale,
      ads100,
      ads30,
      normalScale,
      new7d,
      watching,
      deepDive,
      favorites,
      price2030,
      days20,
      faceless,
      withLp,
      withCheckout,
    };
  }, [allOffers]);

  const quickChips = [
    { key: 'full_scale', label: '🔥 Full Escala', count: counts.fullScale, color: 'text-orange-400' },
    { key: 'ads_100_plus', label: '🔴 100+ Ads', count: counts.ads100, color: 'text-rose-400' },
    { key: 'ads_30_plus', label: '⚡ 30+ Ads', count: counts.ads30, color: 'text-amber-400' },
    { key: 'scale_normal', label: '🟢 Normal', count: counts.normalScale, color: 'text-emerald-400' },
    { key: 'new', label: '🆕 Novas (7D)', count: counts.new7d },
    { key: 'watching', label: '👁️ Acompanhando', count: counts.watching },
    { key: 'deep_dive', label: '🔬 Deep Dive', count: counts.deepDive },
    { key: 'favorites', label: '⭐ Favoritas', count: counts.favorites },
    { key: 'price_20_30', label: '💰 R$ 20–30', count: counts.price2030 },
    { key: 'days_20_plus', label: '🕐 20+ Dias', count: counts.days20 },
    { key: 'faceless', label: '🎭 Faceless', count: counts.faceless },
    { key: 'with_lp', label: '🌐 Com LP', count: counts.withLp },
    { key: 'with_checkout', label: '🛒 Com Checkout', count: counts.withCheckout },
  ] as const;

  // Active filters counting for badge and chips row
  const activeChips = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (filters.search) {
      list.push({
        id: 'search',
        label: `Busca: "${filters.search}"`,
        onRemove: () => {
          setLocalSearch('');
          onChange({ ...filters, search: '' });
        },
      });
    }

    if (filters.scaleTier && filters.scaleTier !== 'all') {
      const labels: Record<string, string> = {
        FULL_SCALE: '🔥 Full Escala (>200)',
        HIGH_SCALE: '🔴 Escala Alta (101-200)',
        SCALING: '🟡 Em Escala (31-100)',
        NORMAL: '🟢 Normal (≤30)',
      };
      list.push({
        id: 'scaleTier',
        label: labels[filters.scaleTier] || filters.scaleTier,
        onRemove: () => onChange({ ...filters, scaleTier: 'all' }),
      });
    }

    if (filters.quickFilter && filters.quickFilter !== 'all') {
      const chip = quickChips.find((c) => c.key === filters.quickFilter);
      list.push({
        id: 'quickFilter',
        label: chip ? chip.label : filters.quickFilter,
        onRemove: () => onChange({ ...filters, quickFilter: 'all' }),
      });
    }

    if (filters.niche && filters.niche !== 'all') {
      list.push({
        id: 'niche',
        label: `Nicho: ${filters.niche}`,
        onRemove: () => onChange({ ...filters, niche: 'all' }),
      });
    }

    (filters.selectedNiches || []).forEach((n) => {
      list.push({
        id: `selNiche_${n}`,
        label: `Nicho: ${n}`,
        onRemove: () => {
          const updated = (filters.selectedNiches || []).filter((item) => item !== n);
          onChange({ ...filters, selectedNiches: updated });
        },
      });
    });

    if (filters.productType && filters.productType !== 'all') {
      list.push({
        id: 'productType',
        label: `Formato: ${filters.productType}`,
        onRemove: () => onChange({ ...filters, productType: 'all' }),
      });
    }

    (filters.selectedProductTypes || []).forEach((pt) => {
      list.push({
        id: `selPt_${pt}`,
        label: `Formato: ${pt}`,
        onRemove: () => {
          const updated = (filters.selectedProductTypes || []).filter((item) => item !== pt);
          onChange({ ...filters, selectedProductTypes: updated });
        },
      });
    });

    if (filters.minAds !== undefined || filters.maxAds !== undefined) {
      list.push({
        id: 'adsRange',
        label: `Ads: ${filters.minAds ?? 0} a ${filters.maxAds ?? '∞'}`,
        onRemove: () => onChange({ ...filters, minAds: undefined, maxAds: undefined }),
      });
    }

    if (filters.minDays !== undefined || filters.maxDays !== undefined) {
      list.push({
        id: 'daysRange',
        label: `Dias: ${filters.minDays ?? 0} a ${filters.maxDays ?? '∞'}d`,
        onRemove: () => onChange({ ...filters, minDays: undefined, maxDays: undefined }),
      });
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      list.push({
        id: 'priceRange',
        label: `Preço: R$${filters.minPrice ?? 0} a R$${filters.maxPrice ?? '∞'}`,
        onRemove: () => onChange({ ...filters, minPrice: undefined, maxPrice: undefined }),
      });
    }

    if (filters.faceless !== undefined && filters.faceless !== 'all') {
      list.push({
        id: 'faceless',
        label: filters.faceless ? '🎭 Apenas Faceless' : '👤 Apenas Especialista',
        onRemove: () => onChange({ ...filters, faceless: 'all' }),
      });
    }

    if (filters.lpStatusFilter && filters.lpStatusFilter !== 'all') {
      list.push({
        id: 'lpStatusFilter',
        label: `LP: ${filters.lpStatusFilter}`,
        onRemove: () => onChange({ ...filters, lpStatusFilter: 'all' }),
      });
    }

    if (filters.checkoutStatusFilter && filters.checkoutStatusFilter !== 'all') {
      list.push({
        id: 'checkoutStatusFilter',
        label: `Checkout: ${filters.checkoutStatusFilter}`,
        onRemove: () => onChange({ ...filters, checkoutStatusFilter: 'all' }),
      });
    }

    if (filters.status && filters.status !== 'all') {
      list.push({
        id: 'status',
        label: `Status: ${filters.status}`,
        onRemove: () => onChange({ ...filters, status: 'all' }),
      });
    }

    if (filters.onlyFavorites) {
      list.push({
        id: 'onlyFavorites',
        label: '⭐ Favoritas',
        onRemove: () => onChange({ ...filters, onlyFavorites: false }),
      });
    }

    if (filters.onlyWatching) {
      list.push({
        id: 'onlyWatching',
        label: '👁️ Acompanhando',
        onRemove: () => onChange({ ...filters, onlyWatching: false }),
      });
    }

    if (filters.onlyDeepDive) {
      list.push({
        id: 'onlyDeepDive',
        label: '🔬 Deep Dive',
        onRemove: () => onChange({ ...filters, onlyDeepDive: false }),
      });
    }

    return list;
  }, [filters, quickChips]);

  const activeFilterCount = activeChips.length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm space-y-3.5 text-left">
      {/* 1. LINE 1: SEARCH BAR + STATUS TABS + TOOLBAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Fixed Width Search Bar to Prevent Compression ("Bu...") */}
        <div className="relative min-w-[280px] sm:min-w-[340px] flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por produto, anunciante, headline, nicho, domínio..."
            className="w-full pl-10 pr-8 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition shadow-inner"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Views Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {[
            { key: 'all' as const, label: 'Todas' },
            { key: 'NOVA' as const, label: 'Novas' },
            { key: 'DADOS_PARCIAIS' as const, label: 'Dados Parciais' },
            { key: 'MAPEADA' as const, label: 'Mapeadas' },
            { key: 'ANALISADA' as const, label: 'Analisadas' },
            { key: 'ACOMPANHANDO' as const, label: 'Acompanhando' },
            { key: 'ARQUIVADA' as const, label: 'Arquivadas' },
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => onChange({ ...filters, status: st.key as any })}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition',
                filters.status === st.key
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              )}
            >
              <span>{st.label}</span>
            </button>
          ))}
        </div>

        {/* Right Tools: View Toggle [Cards | Tabela], Saved Views, Advanced Filters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View Mode Toggle: [ Cards ] [ Tabela ] */}
          {onChangeViewMode && (
            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => onChangeViewMode('cards')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition',
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => onChangeViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition',
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Visualização em Tabela"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </button>
            </div>
          )}

          {/* Saved Views Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSavingView(!isSavingView)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-slate-950/80 text-slate-300 border-slate-800 hover:text-white transition"
              title="Visualizações Salvas"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Views</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {isSavingView && (
              <div className="absolute right-0 top-10 z-40 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Views Salvas
                </span>

                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {savedViews.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-2 text-center">
                      Nenhuma view salva ainda.
                    </p>
                  ) : (
                    savedViews.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          handleApplySavedView(v);
                          setIsSavingView(false);
                        }}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-200 group"
                      >
                        <span className="truncate">{v.name}</span>
                        <button
                          onClick={(e) => handleDeleteSavedView(v.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSaveViewSubmit} className="pt-2 border-t border-slate-800 flex gap-1">
                  <input
                    type="text"
                    placeholder="Salvar visão atual..."
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Advanced Filters Drawer Button with Badge */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition shadow-sm',
              activeFilterCount > 0
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20 font-bold'
                : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-white text-blue-600 rounded-full text-[10px] font-extrabold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort Dropdown */}
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="created_at">Mais Recentes</option>
            <option value="active_ads_count">Mais Ads Ativos</option>
            <option value="days_running">Mais Dias Rodando</option>
            <option value="price">Maior Preço</option>
            <option value="estimated_unique_creatives">Mais Criativos</option>
            <option value="product_name">Nome (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 2. LINE 2: QUICK FILTERS BAR WITH LIVE BADGE COUNTS */}
      <div className="relative group">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 select-none scrollbar-none">
          {quickChips.map((chip) => {
            const isSelected = filters.quickFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => handleQuickChip(chip.key as any)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0',
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md font-bold'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                )}
              >
                <span>{chip.label}</span>
                {chip.count !== undefined && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-numbers',
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'
                    )}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. LINE 3: ACTIVE FILTERS REMOVABLE CHIPS */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Filtros ativos:</span>

          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium"
            >
              <span>{chip.label}</span>
              <button
                onClick={chip.onRemove}
                className="text-blue-400 hover:text-white transition rounded p-0.5"
                title="Remover filtro"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <button
            onClick={handleClear}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition ml-2 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpar todos</span>
          </button>
        </div>
      )}

      {/* FOOTER RESULTS METRICS */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/50">
        <div>
          Mostrando <strong className="font-bold text-white tabular-numbers">{filteredCount}</strong> de{' '}
          <strong className="tabular-numbers text-slate-300">{totalCount}</strong> ofertas
        </div>

        {hasActiveFilters && (
          <span className="text-[11px] text-blue-400 font-medium">
            Filtros combinados aplicados
          </span>
        )}
      </div>

      {/* SLIDING RIGHT-SIDE DRAWER */}
      <OfferFilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        filters={filters}
        onChange={onChange}
        availableNiches={availableNiches}
        availableProductTypes={availableProductTypes}
        totalCount={totalCount}
        filteredCount={filteredCount}
        activeFilterCount={activeFilterCount}
      />
    </div>
  );
}
