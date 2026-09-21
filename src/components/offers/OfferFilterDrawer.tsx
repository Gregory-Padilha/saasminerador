'use client';

import React, { useState } from 'react';
import { OfferFiltersState, OfferStatus } from '@/types';
import {
  X,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Flame,
  Globe,
  ShoppingCart,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Calendar,
  DollarSign,
  Clock,
  Video,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfferFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: OfferFiltersState;
  onChange: (newFilters: OfferFiltersState) => void;
  availableNiches: string[];
  availableProductTypes: string[];
  totalCount: number;
  filteredCount: number;
  activeFilterCount: number;
}

export function OfferFilterDrawer({
  isOpen,
  onClose,
  filters,
  onChange,
  availableNiches,
  availableProductTypes,
  totalCount,
  filteredCount,
  activeFilterCount,
}: OfferFilterDrawerProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    scale: true,
    ads: true,
    price: true,
    days: true,
    creatives: false,
    niche: true,
    productType: false,
    faceless: false,
    lp: false,
    checkout: false,
    orderBumps: false,
    source: false,
    dateAdded: false,
  });

  if (!isOpen) return null;

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const handleClearAll = () => {
    onChange({
      ...filters,
      scaleTier: 'all',
      minPrice: undefined,
      maxPrice: undefined,
      minAds: undefined,
      maxAds: undefined,
      minDays: undefined,
      maxDays: undefined,
      minCreatives: undefined,
      maxCreatives: undefined,
      niche: 'all',
      subniche: 'all',
      productType: 'all',
      faceless: 'all',
      status: 'all',
      lpStatusFilter: 'all',
      checkoutStatusFilter: 'all',
      orderBumpsFilter: 'all',
      sourceFilter: 'all',
      dateAddedFilter: 'all',
      selectedNiches: [],
      selectedProductTypes: [],
      quickFilter: 'all',
      onlyFavorites: false,
      onlyWatching: false,
      onlyDeepDive: false,
    });
  };

  const toggleNicheMulti = (nicheName: string) => {
    const current = filters.selectedNiches || [];
    const exists = current.includes(nicheName);
    const updated = exists ? current.filter((n) => n !== nicheName) : [...current, nicheName];
    onChange({
      ...filters,
      selectedNiches: updated,
      niche: updated.length === 1 ? updated[0] : 'all',
    });
  };

  const toggleProductTypeMulti = (ptName: string) => {
    const current = filters.selectedProductTypes || [];
    const exists = current.includes(ptName);
    const updated = exists ? current.filter((pt) => pt !== ptName) : [...current, ptName];
    onChange({
      ...filters,
      selectedProductTypes: updated,
      productType: updated.length === 1 ? updated[0] : 'all',
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-left animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  Filtros Avançados
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                      {activeFilterCount} ativos
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  Refine as ofertas por múltiplos critérios combinados.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Accordions List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 divide-y divide-slate-800/80">
            {/* 1. ESCALA / COR DO CARD */}
            <div className="pt-2">
              <button
                onClick={() => toggleSection('scale')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Escala / Cor do Card
                </span>
                {openSections.scale ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.scale && (
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  {[
                    { key: 'all', label: 'Todas as Escalas', color: 'bg-slate-800 text-slate-300 border-slate-700' },
                    { key: 'FULL_SCALE', label: '🔥 Full Escala (>200)', color: 'bg-orange-500/15 text-orange-300 border-orange-500/40' },
                    { key: 'HIGH_SCALE', label: '🔴 Escala Alta (101-200)', color: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
                    { key: 'SCALING', label: '🟡 Em Escala (31-100)', color: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
                    { key: 'NORMAL', label: '🟢 Normal (≤30)', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
                  ].map((sc) => (
                    <button
                      key={sc.key}
                      onClick={() => onChange({ ...filters, scaleTier: sc.key as any })}
                      className={cn(
                        'p-2.5 rounded-xl border font-semibold text-left transition flex items-center justify-between',
                        sc.color,
                        (filters.scaleTier || 'all') === sc.key && 'ring-2 ring-blue-500 shadow-md'
                      )}
                    >
                      <span className="truncate">{sc.label}</span>
                      {(filters.scaleTier || 'all') === sc.key && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. ANÚNCIOS ATIVOS */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('ads')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Anúncios Ativos
                </span>
                {openSections.ads ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.ads && (
                <div className="space-y-3 pt-2 text-xs">
                  {/* Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { min: undefined, max: undefined, label: 'Todos' },
                      { min: 0, max: 10, label: '0-10' },
                      { min: 11, max: 30, label: '11-30' },
                      { min: 31, max: 50, label: '31-50' },
                      { min: 51, max: 100, label: '51-100' },
                      { min: 101, max: 200, label: '101-200' },
                      { min: 201, max: undefined, label: '201+' },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => onChange({ ...filters, minAds: preset.min, maxAds: preset.max })}
                        className={cn(
                          'px-2.5 py-1 rounded-lg border text-xs font-medium transition',
                          filters.minAds === preset.min && filters.maxAds === preset.max
                            ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Range Inputs */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Mínimo Ads</label>
                      <input
                        type="number"
                        placeholder="Ex: 10"
                        value={filters.minAds ?? ''}
                        onChange={(e) => onChange({ ...filters, minAds: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Máximo Ads</label>
                      <input
                        type="number"
                        placeholder="Ex: 500"
                        value={filters.maxAds ?? ''}
                        onChange={(e) => onChange({ ...filters, maxAds: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. TEMPO RODANDO (DIAS) */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('days')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Tempo Rodando (Dias)
                </span>
                {openSections.days ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.days && (
                <div className="space-y-3 pt-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { min: undefined, max: undefined, label: 'Todos' },
                      { min: 0, max: 10, label: '0-10d' },
                      { min: 11, max: 30, label: '11-30d' },
                      { min: 31, max: 60, label: '31-60d' },
                      { min: 61, max: 90, label: '61-90d' },
                      { min: 90, max: undefined, label: '90d+' },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => onChange({ ...filters, minDays: preset.min, maxDays: preset.max })}
                        className={cn(
                          'px-2.5 py-1 rounded-lg border text-xs font-medium transition',
                          filters.minDays === preset.min && filters.maxDays === preset.max
                            ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Mínimo Dias</label>
                      <input
                        type="number"
                        placeholder="Ex: 30"
                        value={filters.minDays ?? ''}
                        onChange={(e) => onChange({ ...filters, minDays: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Máximo Dias</label>
                      <input
                        type="number"
                        placeholder="Ex: 365"
                        value={filters.maxDays ?? ''}
                        onChange={(e) => onChange({ ...filters, maxDays: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. PREÇO FRONT-END */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('price')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Preço Front-End (R$)
                </span>
                {openSections.price ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.price && (
                <div className="space-y-3 pt-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { min: undefined, max: undefined, label: 'Todos' },
                      { min: 0, max: 10, label: 'Até R$ 10' },
                      { min: 10, max: 20, label: 'R$ 10-20' },
                      { min: 20, max: 30, label: 'R$ 20-30' },
                      { min: 30, max: 50, label: 'R$ 30-50' },
                      { min: 50, max: undefined, label: 'R$ 50+' },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => onChange({ ...filters, minPrice: preset.min, maxPrice: preset.max })}
                        className={cn(
                          'px-2.5 py-1 rounded-lg border text-xs font-medium transition',
                          filters.minPrice === preset.min && filters.maxPrice === preset.max
                            ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Preço Mínimo</label>
                      <input
                        type="number"
                        placeholder="R$ 0,00"
                        value={filters.minPrice ?? ''}
                        onChange={(e) => onChange({ ...filters, minPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Preço Máximo</label>
                      <input
                        type="number"
                        placeholder="R$ 100,00"
                        value={filters.maxPrice ?? ''}
                        onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. NICHO & SUBNICHO */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('niche')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  Nichos ({availableNiches.length})
                </span>
                {openSections.niche ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.niche && (
                <div className="space-y-2 pt-2 text-xs">
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-800/80 rounded-xl p-2 bg-slate-950/60">
                    {availableNiches.map((nicheName) => {
                      const isSelected = (filters.selectedNiches || []).includes(nicheName);
                      return (
                        <label
                          key={nicheName}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-300 hover:text-white transition"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleNicheMulti(nicheName)}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate">{nicheName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 6. FORMATO DO PRODUTO */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('productType')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-400" />
                  Formato do Produto ({availableProductTypes.length})
                </span>
                {openSections.productType ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.productType && (
                <div className="space-y-2 pt-2 text-xs">
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-800/80 rounded-xl p-2 bg-slate-950/60">
                    {availableProductTypes.map((ptName) => {
                      const isSelected = (filters.selectedProductTypes || []).includes(ptName);
                      return (
                        <label
                          key={ptName}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-300 hover:text-white transition"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProductTypeMulti(ptName)}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate">{ptName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 7. LANDING PAGE ESTÁGIO */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('lp')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  Estágio de Landing Page
                </span>
                {openSections.lp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.lp && (
                <div className="grid grid-cols-2 gap-1.5 pt-2 text-xs">
                  {[
                    { key: 'all', label: 'Todas' },
                    { key: 'with_lp', label: 'Com LP' },
                    { key: 'without_lp', label: 'Sem LP' },
                    { key: 'SUCCESS', label: 'LP Mapeada (SUCCESS)' },
                    { key: 'PENDING', label: 'LP Pendente' },
                    { key: 'PARTIAL', label: 'LP Parcial' },
                    { key: 'FAILED', label: 'LP com Falha' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => onChange({ ...filters, lpStatusFilter: item.key as any })}
                      className={cn(
                        'p-2 rounded-xl border font-medium text-left transition text-xs',
                        (filters.lpStatusFilter || 'all') === item.key
                          ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 8. CHECKOUT ESTÁGIO */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('checkout')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-cyan-400" />
                  Estágio de Checkout
                </span>
                {openSections.checkout ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.checkout && (
                <div className="grid grid-cols-2 gap-1.5 pt-2 text-xs">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'with_checkout', label: 'Com Checkout' },
                    { key: 'without_checkout', label: 'Sem Checkout' },
                    { key: 'FOUND', label: 'Checkout Descoberto' },
                    { key: 'NOT_FOUND', label: 'Sem Checkout Detectado' },
                    { key: 'NOT_PROCESSED', label: 'A Descobrir' },
                    { key: 'SUCCESS', label: 'Checkout Mapeado' },
                    { key: 'PENDING', label: 'Checkout Pendente' },
                    { key: 'FAILED', label: 'Checkout com Falha' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => onChange({ ...filters, checkoutStatusFilter: item.key as any })}
                      className={cn(
                        'p-2 rounded-xl border font-medium text-left transition text-xs',
                        (filters.checkoutStatusFilter || 'all') === item.key
                          ? 'bg-cyan-600 text-white border-cyan-500 font-semibold'
                          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 9. FACELESS */}
            <div className="pt-4">
              <button
                onClick={() => toggleSection('faceless')}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white pb-2"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  Faceless (Sem Rosto)
                </span>
                {openSections.faceless ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.faceless && (
                <div className="grid grid-cols-3 gap-1.5 pt-2 text-xs">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: true, label: '🎭 Faceless' },
                    { key: false, label: '👤 Especialista' },
                  ].map((item) => (
                    <button
                      key={String(item.key)}
                      onClick={() => onChange({ ...filters, faceless: item.key as any })}
                      className={cn(
                        'p-2 rounded-xl border font-medium text-center transition text-xs',
                        filters.faceless === item.key
                          ? 'bg-pink-600 text-white border-pink-500 font-semibold'
                          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Tudo</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition text-center"
            >
              Aplicar Filtros ({filteredCount} ofertas)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
