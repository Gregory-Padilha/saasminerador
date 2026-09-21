'use client';

import React, { useState, useMemo } from 'react';
import { Offer } from '@/types';
import { getOfferScaleTier } from '@/lib/scale-tier';
import { formatCurrency } from '@/lib/utils';
import {
  X,
  Search,
  Check,
  Plus,
  Flame,
  Globe,
  ShoppingCart,
  UserX,
  Star,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';

interface SelectOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  allOffers: Offer[];
  selectedOfferIds: string[];
  onSelectOffer: (offer: Offer) => void;
  targetSlotIndex?: number | null;
}

export function SelectOfferModal({
  isOpen,
  onClose,
  allOffers,
  selectedOfferIds,
  onSelectOffer,
  targetSlotIndex,
}: SelectOfferModalProps) {
  const [search, setSearch] = useState('');
  const [scaleFilter, setScaleFilter] = useState<string | null>(null);
  const [quickFilters, setQuickFilters] = useState<{
    faceless?: boolean;
    hasLp?: boolean;
    hasCheckout?: boolean;
    favorite?: boolean;
  }>({});
  const [sortBy, setSortBy] = useState<'recent' | 'ads' | 'days' | 'creatives' | 'alpha'>('recent');

  const isMaxReached = selectedOfferIds.length >= 3 && targetSlotIndex === undefined;

  const filteredOffers = useMemo(() => {
    let list = [...allOffers];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.product_name?.toLowerCase().includes(q) ||
          o.advertiser?.toLowerCase().includes(q) ||
          o.niche?.toLowerCase().includes(q) ||
          o.subniche?.toLowerCase().includes(q) ||
          o.product_type?.toLowerCase().includes(q) ||
          o.landing_page_domain?.toLowerCase().includes(q)
      );
    }

    // Scale Filter
    if (scaleFilter) {
      list = list.filter((o) => {
        const tierInfo = getOfferScaleTier(o.active_ads_count);
        return tierInfo.tier === scaleFilter;
      });
    }

    // Quick boolean filters
    if (quickFilters.faceless) {
      list = list.filter((o) => o.faceless === true);
    }
    if (quickFilters.hasLp) {
      list = list.filter((o) => Boolean(o.landing_page_url));
    }
    if (quickFilters.hasCheckout) {
      list = list.filter((o) => Boolean(o.checkout_url || o.checkout_platform));
    }
    if (quickFilters.favorite) {
      list = list.filter((o) => o.favorite === true || (o as any).is_favorite === true);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'ads') return (b.active_ads_count || 0) - (a.active_ads_count || 0);
      if (sortBy === 'days') return (b.days_running || 0) - (a.days_running || 0);
      if (sortBy === 'creatives') {
        const aC = a.estimated_unique_creatives || a.creatives?.length || 0;
        const bC = b.estimated_unique_creatives || b.creatives?.length || 0;
        return bC - aC;
      }
      if (sortBy === 'alpha') return (a.product_name || '').localeCompare(b.product_name || '');
      // default: recent
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return list;
  }, [allOffers, search, scaleFilter, quickFilters, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                ADICIONAR OFERTA À COMPARAÇÃO
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {selectedOfferIds.length} / 3 selecionadas
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione até 3 ofertas para comparar métricas, funil e posicionamento lado a lado.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Max 3 Limit Warning */}
        {isMaxReached && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
            <span className="text-xs text-amber-300 font-medium">
              ⚠️ Limite de 3 ofertas atingido (3/3). Para adicionar outra, remova uma oferta da comparação.
            </span>
          </div>
        )}

        {/* Search & Quick Filters Toolbar */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
          {/* Search bar & Sort */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto, anunciante, nicho, domínio..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-blue-500 w-full sm:w-auto"
              >
                <option value="recent">Mais recentes</option>
                <option value="ads">Mais ads ativos</option>
                <option value="days">Mais dias rodando</option>
                <option value="creatives">Mais criativos</option>
                <option value="alpha">A-Z</option>
              </select>
            </div>
          </div>

          {/* Quick Filters Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            {/* Scale Tiers */}
            <button
              onClick={() => setScaleFilter(scaleFilter === 'FULL_SCALE' ? null : 'FULL_SCALE')}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                scaleFilter === 'FULL_SCALE'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              Full Escala
            </button>

            <button
              onClick={() => setScaleFilter(scaleFilter === 'HIGH_SCALE' ? null : 'HIGH_SCALE')}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                scaleFilter === 'HIGH_SCALE'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Escala Alta
            </button>

            <button
              onClick={() => setScaleFilter(scaleFilter === 'SCALING' ? null : 'SCALING')}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                scaleFilter === 'SCALING'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Em Escala
            </button>

            <button
              onClick={() => setScaleFilter(scaleFilter === 'NORMAL' ? null : 'NORMAL')}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                scaleFilter === 'NORMAL'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Normal
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1 shrink-0" />

            <button
              onClick={() => setQuickFilters((q) => ({ ...q, faceless: !q.faceless }))}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                quickFilters.faceless
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <UserX className="w-3 h-3 text-purple-400" />
              Faceless
            </button>

            <button
              onClick={() => setQuickFilters((q) => ({ ...q, hasLp: !q.hasLp }))}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                quickFilters.hasLp
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3 h-3 text-blue-400" />
              Com LP
            </button>

            <button
              onClick={() => setQuickFilters((q) => ({ ...q, hasCheckout: !q.hasCheckout }))}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                quickFilters.hasCheckout
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShoppingCart className="w-3 h-3 text-emerald-400" />
              Com Checkout
            </button>

            <button
              onClick={() => setQuickFilters((q) => ({ ...q, favorite: !q.favorite }))}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all shrink-0 ${
                quickFilters.favorite
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Star className="w-3 h-3 text-amber-400" />
              Favoritas
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredOffers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs">Nenhuma oferta encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredOffers.map((offer) => {
                const isSelected = selectedOfferIds.includes(offer.id);
                const scaleInfo = getOfferScaleTier(offer.active_ads_count);

                return (
                  <div
                    key={offer.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-blue-500/5 border-blue-500/40 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scaleInfo.badgeClass} ${scaleInfo.textClass} flex items-center gap-1`}
                        >
                          <span>{scaleInfo.icon}</span>
                          <span>{scaleInfo.label}</span>
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 truncate max-w-[120px]">
                          {offer.niche || 'Geral'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {offer.product_name}
                      </h4>

                      <p className="text-[11px] text-slate-400 truncate">
                        {offer.advertiser || 'Anunciante não informado'}
                      </p>
                    </div>

                    {/* Stats bar */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-3 text-slate-300">
                        <span className="font-mono font-bold text-emerald-400">
                          {formatCurrency(offer.price)}
                        </span>
                        <span className="font-mono text-slate-400">
                          {offer.active_ads_count || 0} ads
                        </span>
                        <span className="font-mono text-slate-400">
                          {offer.days_running || 0}d
                        </span>
                      </div>

                      {isSelected ? (
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Na comparação
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            if (isMaxReached) return;
                            onSelectOffer(offer);
                            if (selectedOfferIds.length + 1 >= 3 && targetSlotIndex === undefined) {
                              onClose();
                            }
                          }}
                          disabled={isMaxReached}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                            isMaxReached
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
