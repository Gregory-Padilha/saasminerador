'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { dbService } from '@/lib/supabase/db';
import { Offer } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, FacelessBadge } from '@/components/ui/StatusBadge';
import { TrendBadge } from '@/components/ui/TrendBadge';
import { getOfferScaleTier } from '@/lib/scale-tier';
import { formatCurrency, formatDate } from '@/lib/utils';
import { SelectOfferModal } from '@/components/offers/SelectOfferModal';
import {
  Sliders,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  TrendingUp,
  Clock,
  Video,
  DollarSign,
  Globe,
  ShoppingCart,
  UserX,
  FileText,
  Users,
  Package,
  ShieldCheck,
  Tag,
} from 'lucide-react';

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number | null>(null);

  // Dimension Category Filter & Accordions
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    summary: true,
    scale: true,
    product: true,
    lp: false,
    checkout: false,
    creatives: false,
    copy: false,
    audience: false,
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const offers = await dbService.getOffers();
      setAllOffers(offers);

      // Parse IDs from URL query params ?ids=... or ?offers=...
      const rawIds = searchParams.get('ids') || searchParams.get('offers');
      if (rawIds) {
        const idList = rawIds.split(',').map((s) => s.trim()).filter(Boolean);
        const matches = offers.filter((o) => idList.includes(o.id));
        if (matches.length > 0) {
          setSelectedOffers(matches.slice(0, 3)); // STRICT CAP AT 3
          return;
        }
      }

      // Default: pick first 2 offers for a rich initial presentation
      setSelectedOffers(offers.slice(0, 2));
    } catch (err) {
      console.error('Error loading offers for comparison:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUrl = (list: Offer[]) => {
    const ids = list.map((o) => o.id).join(',');
    if (ids) {
      router.replace(`/compare?offers=${ids}`);
    } else {
      router.replace('/compare');
    }
  };

  const handleOpenAddModal = (slotIndex?: number) => {
    setTargetSlotIndex(slotIndex ?? null);
    setIsModalOpen(true);
  };

  const handleSelectOfferFromModal = (offer: Offer) => {
    if (targetSlotIndex !== null && targetSlotIndex !== undefined) {
      // Replacing offer in a specific slot index
      const next = [...selectedOffers];
      next[targetSlotIndex] = offer;
      const capped = next.slice(0, 3);
      setSelectedOffers(capped);
      updateUrl(capped);
    } else {
      // Appending offer (strict cap at 3)
      if (selectedOffers.length >= 3) return;
      const next = [...selectedOffers, offer];
      setSelectedOffers(next);
      updateUrl(next);
    }
  };

  const handleRemoveOffer = (offerId: string) => {
    const next = selectedOffers.filter((o) => o.id !== offerId);
    setSelectedOffers(next);
    updateUrl(next);
  };

  const handleClearAll = () => {
    setSelectedOffers([]);
    updateUrl([]);
  };

  const toggleBlock = (key: string) => {
    setExpandedBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Compute Factual Highlights across selected offers (strictly when >= 2 offers)
  const factualHighlights = useMemo(() => {
    if (selectedOffers.length < 2) return null;

    // 1. Max Ads
    let maxAdsOffer: Offer | null = null;
    let isAdsTie = false;
    let maxAdsVal = -1;

    // 2. Max Days
    let maxDaysOffer: Offer | null = null;
    let isDaysTie = false;
    let maxDaysVal = -1;

    // 3. Max Creatives
    let maxCreativesOffer: Offer | null = null;
    let isCreativesTie = false;
    let maxCreativesVal = -1;

    // 4. Min Price
    let minPriceOffer: Offer | null = null;
    let isPriceTie = false;
    let minPriceVal = Infinity;

    selectedOffers.forEach((o) => {
      // Ads
      const ads = o.active_ads_count ?? 0;
      if (ads > maxAdsVal) {
        maxAdsVal = ads;
        maxAdsOffer = o;
        isAdsTie = false;
      } else if (ads === maxAdsVal && ads > 0) {
        isAdsTie = true;
      }

      // Days
      const days = o.days_running ?? 0;
      if (days > maxDaysVal) {
        maxDaysVal = days;
        maxDaysOffer = o;
        isDaysTie = false;
      } else if (days === maxDaysVal && days > 0) {
        isDaysTie = true;
      }

      // Creatives
      const creatives = o.estimated_unique_creatives || o.creatives?.length || 0;
      if (creatives > maxCreativesVal) {
        maxCreativesVal = creatives;
        maxCreativesOffer = o;
        isCreativesTie = false;
      } else if (creatives === maxCreativesVal && creatives > 0) {
        isCreativesTie = true;
      }

      // Price
      const price = o.front_price_min || o.price || Infinity;
      if (price < minPriceVal) {
        minPriceVal = price;
        minPriceOffer = o;
        isPriceTie = false;
      } else if (price === minPriceVal && price !== Infinity) {
        isPriceTie = true;
      }
    });

    return {
      maxAds: { offer: maxAdsOffer as Offer | null, val: maxAdsVal, isTie: isAdsTie },
      maxDays: { offer: maxDaysOffer as Offer | null, val: maxDaysVal, isTie: isDaysTie },
      maxCreatives: { offer: maxCreativesOffer as Offer | null, val: maxCreativesVal, isTie: isCreativesTie },
      minPrice: { offer: minPriceOffer as Offer | null, val: minPriceVal, isTie: isPriceTie },
    };
  }, [selectedOffers]);

  // Render slot array (always max 3 slots representation)
  const slotCount = 3;
  const slots = Array.from({ length: slotCount }).map((_, idx) => selectedOffers[idx] || null);

  return (
    <AppShell>
      <div className="space-y-6 pb-16 max-w-7xl mx-auto">
        {/* Page Header */}
        <PageHeader
          title="Matriz Comparativa de Ofertas"
          description="Compare métricas, tráfego, precificação, landing page e funil de até 3 ofertas lado a lado com dados 100% factuais."
          badge={
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" />
              Inteligência Comparativa (Máx 3)
            </span>
          }
          actions={
            selectedOffers.length > 0 ? (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Comparação
              </button>
            ) : undefined
          }
        />

        {/* LOADING STATE */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse p-5 space-y-4"
              >
                <div className="h-4 w-24 bg-slate-800 rounded" />
                <div className="h-6 w-3/4 bg-slate-800 rounded" />
                <div className="h-12 bg-slate-800/50 rounded-xl" />
              </div>
            ))}
          </div>
        ) : selectedOffers.length === 0 ? (
          /* EMPTY STATE */
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-5 max-w-2xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/5">
              <Sliders className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">COMPARE OFERTAS LADO A LADO</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Descubra diferenças reais de volume de anúncios, longevidade, precificação front-end,
                estrutura de landing page, checkout e criativos.
              </p>
            </div>

            <button
              onClick={() => handleOpenAddModal()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Selecionar primeira oferta
            </button>
          </div>
        ) : (
          /* ACTIVE COMPARISON WORKSPACE */
          <div className="space-y-6">
            {/* 1. HEADER CARDS GRID (SLOTS 1, 2, 3) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {slots.map((offer, idx) => {
                if (!offer) {
                  // EMPTY SLOT CARD
                  return (
                    <div
                      key={`empty-slot-${idx}`}
                      onClick={() => handleOpenAddModal(idx)}
                      className="p-6 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 transition-all flex flex-col items-center justify-center text-center space-y-3 cursor-pointer min-h-[260px] group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-800/80 group-hover:bg-blue-500/10 text-slate-500 group-hover:text-blue-400 border border-slate-700 group-hover:border-blue-500/30 flex items-center justify-center transition-all">
                        <Plus className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">
                          Slot {idx + 1} Livre
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Clique para adicionar oferta
                        </span>
                      </div>
                    </div>
                  );
                }

                // FILLED OFFER HEADER CARD
                const scaleInfo = getOfferScaleTier(offer.active_ads_count);

                return (
                  <div
                    key={offer.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 relative shadow-lg overflow-hidden group"
                  >
                    {/* Tier Accent Header Strip */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${scaleInfo.badgeClass} ${scaleInfo.textClass} flex items-center gap-1.5`}
                      >
                        <span>{scaleInfo.icon}</span>
                        <span>{scaleInfo.label}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenAddModal(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Trocar esta oferta"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveOffer(offer.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                          title="Remover da comparação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title & Advertiser */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                        {offer.niche || 'Geral'}{' '}
                        {offer.subniche ? `• ${offer.subniche}` : ''}
                      </span>
                      <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                        {offer.product_name}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        {offer.advertiser || 'Anunciante não informado'}
                      </p>
                    </div>

                    {/* Core Metrics Pill Grid */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                      <div>
                        <span className="text-[10px] font-medium text-slate-500 block uppercase">Preço</span>
                        <span className="text-xs font-mono font-bold text-emerald-400 block mt-0.5">
                          {formatCurrency(offer.price)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-slate-500 block uppercase">Ads</span>
                        <span className="text-xs font-mono font-bold text-white block mt-0.5">
                          {offer.active_ads_count ?? '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-slate-500 block uppercase">Dias</span>
                        <span className="text-xs font-mono font-bold text-slate-300 block mt-0.5">
                          {offer.days_running ? `${offer.days_running}d` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Mini Indicators & Dossier Link */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center gap-0.5 ${
                            offer.landing_page_url ? 'text-blue-400' : 'text-slate-600'
                          }`}
                        >
                          <Globe className="w-3 h-3" />
                          <span>LP</span>
                        </span>

                        <span
                          className={`flex items-center gap-0.5 ${
                            offer.checkout_url || offer.checkout_platform
                              ? 'text-emerald-400'
                              : 'text-slate-600'
                          }`}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>Checkout</span>
                        </span>

                        {offer.faceless && (
                          <span className="text-purple-400 flex items-center gap-0.5">
                            <UserX className="w-3 h-3" />
                            <span>Faceless</span>
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/offers/${offer.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Abrir Dossiê
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. FACTUAL QUICK SUMMARY BANNER (Shown when >= 2 offers selected) */}
            {factualHighlights && selectedOffers.length >= 2 && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-lg space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold text-white tracking-wider uppercase">
                    Destaques Factuais da Comparação
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Maior Volume */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-red-400" />
                      Maior Volume Observado
                    </span>
                    {factualHighlights.maxAds.isTie ? (
                      <span className="text-xs font-bold text-amber-400 block">
                        Empate ({factualHighlights.maxAds.val} ads)
                      </span>
                    ) : factualHighlights.maxAds.offer ? (
                      <div>
                        <span className="text-xs font-bold text-white block truncate">
                          {factualHighlights.maxAds.offer.product_name}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-red-400 block">
                          {factualHighlights.maxAds.val} anúncios ativos
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Sem dados</span>
                    )}
                  </div>

                  {/* Maior Longevidade */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Maior Longevidade
                    </span>
                    {factualHighlights.maxDays.isTie ? (
                      <span className="text-xs font-bold text-amber-400 block">
                        Empate ({factualHighlights.maxDays.val} dias)
                      </span>
                    ) : factualHighlights.maxDays.offer ? (
                      <div>
                        <span className="text-xs font-bold text-white block truncate">
                          {factualHighlights.maxDays.offer.product_name}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-amber-400 block">
                          {factualHighlights.maxDays.val} dias rodando
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Sem dados</span>
                    )}
                  </div>

                  {/* Mais Criativos */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block flex items-center gap-1">
                      <Video className="w-3 h-3 text-indigo-400" />
                      Mais Criativos
                    </span>
                    {factualHighlights.maxCreatives.isTie ? (
                      <span className="text-xs font-bold text-amber-400 block">
                        Empate ({factualHighlights.maxCreatives.val} criativos)
                      </span>
                    ) : factualHighlights.maxCreatives.offer ? (
                      <div>
                        <span className="text-xs font-bold text-white block truncate">
                          {factualHighlights.maxCreatives.offer.product_name}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-indigo-400 block">
                          {factualHighlights.maxCreatives.val} criativos distintos
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Sem dados</span>
                    )}
                  </div>

                  {/* Menor Preço */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-400" />
                      Menor Preço Observado
                    </span>
                    {factualHighlights.minPrice.isTie ? (
                      <span className="text-xs font-bold text-amber-400 block">
                        Empate ({formatCurrency(factualHighlights.minPrice.val)})
                      </span>
                    ) : factualHighlights.minPrice.offer ? (
                      <div>
                        <span className="text-xs font-bold text-white block truncate">
                          {factualHighlights.minPrice.offer.product_name}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-emerald-400 block">
                          {formatCurrency(factualHighlights.minPrice.val)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Sem dados</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. CATEGORY DIMENSION TABS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-b border-slate-800">
              {[
                { id: 'ALL', label: 'Todas as Dimensões' },
                { id: 'summary', label: 'Resumo' },
                { id: 'scale', label: 'Escala & Tráfego' },
                { id: 'product', label: 'Produto & Oferta' },
                { id: 'lp', label: 'Landing Page' },
                { id: 'checkout', label: 'Checkout' },
                { id: 'creatives', label: 'Criativos' },
                { id: 'copy', label: 'Copy' },
                { id: 'audience', label: 'Público' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-2 rounded-t-xl font-medium transition-all shrink-0 border-b-2 ${
                    activeCategory === tab.id
                      ? 'bg-slate-900 text-blue-400 border-blue-500 font-semibold'
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 4. BLOCK ACCORDIONS MATRIX */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  {/* STICKY HEADER ROW ON SCROLL */}
                  <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-md">
                    <tr>
                      <th className="py-3.5 px-4 w-60 font-bold uppercase tracking-wider text-slate-400 text-[11px] bg-slate-950 sticky left-0 z-30 border-r border-slate-800">
                        Dimensão Comparativa
                      </th>
                      {selectedOffers.map((o) => (
                        <th
                          key={o.id}
                          className="py-3.5 px-5 w-1/3 min-w-[260px] border-r border-slate-800/80 last:border-r-0"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white truncate max-w-[200px]">
                              {o.product_name}
                            </span>
                            <span className="font-mono text-[11px] text-blue-400 font-bold">
                              {o.active_ads_count ?? 0} ads
                            </span>
                          </div>
                        </th>
                      ))}
                      {/* Fill empty header columns if < 3 offers selected */}
                      {Array.from({ length: 3 - selectedOffers.length }).map((_, i) => (
                        <th
                          key={`empty-th-${i}`}
                          className="py-3.5 px-5 w-1/3 min-w-[260px] border-r border-slate-800/80 last:border-r-0 text-slate-600 font-normal italic"
                        >
                          Slot Vazio
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {/* ============================================================== */}
                    {/* BLOCO 1 — RESUMO GENERAL */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'summary') && (
                      <BlockAccordionHeader
                        title="1. BLOCO — RESUMO DA OPERAÇÃO"
                        icon={<Layers className="w-4 h-4 text-blue-400" />}
                        isExpanded={expandedBlocks.summary}
                        onToggle={() => toggleBlock('summary')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'summary') &&
                      expandedBlocks.summary && (
                        <>
                          <MatrixRow
                            label="Preço Principal"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono font-bold text-emerald-400 text-sm">
                                {formatCurrency(o.price)}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Ads Ativos"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono font-bold text-white">
                                {o.active_ads_count !== null && o.active_ads_count !== undefined
                                  ? `${o.active_ads_count} anúncios`
                                  : 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Dias Rodando"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono text-slate-300">
                                {o.days_running !== null && o.days_running !== undefined
                                  ? `${o.days_running} dias`
                                  : 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Criativos Distintos"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono text-indigo-300 font-semibold">
                                {o.estimated_unique_creatives || o.creatives?.length
                                  ? `${o.estimated_unique_creatives || o.creatives?.length} criativos`
                                  : 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Operação Faceless"
                            offers={selectedOffers}
                            render={(o) => <FacelessBadge faceless={o.faceless} />}
                          />
                          <MatrixRow
                            label="Nicho & Subnicho"
                            offers={selectedOffers}
                            render={(o) => (
                              <div>
                                <span className="font-bold text-white">{o.niche || 'Não informado'}</span>
                                {o.subniche ? (
                                  <span className="text-[11px] text-slate-400 block mt-0.5">
                                    {o.subniche}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          />
                          <MatrixRow
                            label="Tipo de Produto"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="text-slate-300 font-medium">
                                {o.product_type || 'Digital'}
                              </span>
                            )}
                          />
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* BLOCO 2 — ESCALA & TRÁFEGO */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'scale') && (
                      <BlockAccordionHeader
                        title="2. BLOCO — ESCALA & TRÁFEGO"
                        icon={<TrendingUp className="w-4 h-4 text-red-400" />}
                        isExpanded={expandedBlocks.scale}
                        onToggle={() => toggleBlock('scale')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'scale') &&
                      expandedBlocks.scale && (
                        <>
                          <MatrixRow
                            label="Tier de Escala"
                            offers={selectedOffers}
                            render={(o) => {
                              const s = getOfferScaleTier(o.active_ads_count);
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${s.badgeClass} ${s.textClass}`}
                                >
                                  <span>{s.icon}</span>
                                  <span>{s.label}</span>
                                </span>
                              );
                            }}
                          />
                          <MatrixRow
                            label="Volume de Anúncios"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono font-bold text-white">
                                {o.active_ads_count !== null && o.active_ads_count !== undefined
                                  ? `${o.active_ads_count} ativos`
                                  : 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Tendência de Anúncios"
                            offers={selectedOffers}
                            render={(o) => <TrendBadge trend={o.trend} />}
                          />
                          <MatrixRow
                            label="Longevidade (Dias)"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono text-slate-300">
                                {o.days_running !== null && o.days_running !== undefined
                                  ? `${o.days_running} dias rodando`
                                  : 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Anunciante (Página)"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="text-slate-300 font-medium">
                                {o.advertiser || 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Data da Primeira Captura"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono text-slate-400">
                                {o.created_at ? formatDate(o.created_at) : 'Não informado'}
                              </span>
                            )}
                          />
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* BLOCO 3 — PRODUTO & OFERTA */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'product') && (
                      <BlockAccordionHeader
                        title="3. BLOCO — PRODUTO & ESTRUTURA DE OFERTA"
                        icon={<Package className="w-4 h-4 text-emerald-400" />}
                        isExpanded={expandedBlocks.product}
                        onToggle={() => toggleBlock('product')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'product') &&
                      expandedBlocks.product && (
                        <>
                          <MatrixRow
                            label="Precificação Front-end"
                            offers={selectedOffers}
                            render={(o) => {
                              const count = o.front_options_count || o.frontend_options?.length || 1;
                              const hasMulti =
                                count > 1 &&
                                o.front_price_min &&
                                o.front_price_max &&
                                o.front_price_min < o.front_price_max;

                              return hasMulti ? (
                                <div>
                                  <span className="text-emerald-400 font-mono font-bold block text-sm">
                                    {formatCurrency(o.front_price_min)} – {formatCurrency(o.front_price_max)}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block mt-0.5">
                                    {count} opções • Média {formatCurrency(o.front_price_avg)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-emerald-400 font-mono font-bold text-sm">
                                  {formatCurrency(o.price)}
                                </span>
                              );
                            }}
                          />
                          <MatrixRow
                            label="Entregáveis / Formato"
                            offers={selectedOffers}
                            render={(o) => (
                              <div className="space-y-0.5">
                                <span className="text-slate-200 font-medium block">
                                  {o.product_type || 'Digital (Ebook/Guia)'}
                                </span>
                                <span className="text-[11px] text-slate-400 block">
                                  {o.deliverables?.length || 1} item(ns) principal(is)
                                </span>
                              </div>
                            )}
                          />
                          <MatrixRow
                            label="Bônus Ofertados"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="text-amber-400 font-semibold">
                                {o.bonuses && o.bonuses.length > 0
                                  ? `${o.bonuses.length} bônus incluídos`
                                  : 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Garantia Incondicional"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="text-slate-300 font-medium">
                                {o.guarantee || '7 dias'}
                              </span>
                            )}
                          />
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* BLOCO 4 — LANDING PAGE */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'lp') && (
                      <BlockAccordionHeader
                        title="4. BLOCO — LANDING PAGE"
                        icon={<Globe className="w-4 h-4 text-blue-400" />}
                        isExpanded={expandedBlocks.lp}
                        onToggle={() => toggleBlock('lp')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'lp') &&
                      expandedBlocks.lp && (
                        <>
                          <MatrixRow
                            label="Domínio & URL"
                            offers={selectedOffers}
                            render={(o) =>
                              o.landing_page_url ? (
                                <a
                                  href={o.landing_page_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 font-mono text-[11px] hover:underline inline-flex items-center gap-1 truncate max-w-[200px]"
                                >
                                  {o.landing_page_domain || 'Abrir LP'}
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-slate-500">Não informado</span>
                              )
                            }
                          />
                          <MatrixRow
                            label="Headline Principal"
                            offers={selectedOffers}
                            render={(o) =>
                              o.headline ? (
                                <p className="text-slate-300 italic leading-relaxed text-[11px]">
                                  "{o.headline}"
                                </p>
                              ) : (
                                <span className="text-slate-500">Não informado</span>
                              )
                            }
                          />
                          <MatrixRow
                            label="Promessa Central"
                            offers={selectedOffers}
                            render={(o) =>
                              o.promise ? (
                                <p className="text-slate-200 leading-relaxed text-[11px]">
                                  {o.promise}
                                </p>
                              ) : (
                                <span className="text-slate-500">Não informado</span>
                              )
                            }
                          />
                          <MatrixRow
                            label="Status do Mapeamento LP"
                            offers={selectedOffers}
                            render={(o) => (
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  o.lp_mapping_status === 'SUCCESS'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {o.lp_mapping_status === 'SUCCESS' ? 'Mapeada' : 'Pendente'}
                              </span>
                            )}
                          />
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* BLOCO 5 — CHECKOUT */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'checkout') && (
                      <BlockAccordionHeader
                        title="5. BLOCO — CHECKOUT INTELLIGENCE"
                        icon={<ShoppingCart className="w-4 h-4 text-emerald-400" />}
                        isExpanded={expandedBlocks.checkout}
                        onToggle={() => toggleBlock('checkout')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'checkout') &&
                      expandedBlocks.checkout && (
                        <>
                          <MatrixRow
                            label="Provider / Plataforma"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="text-slate-200 font-semibold">
                                {o.checkout_platform || (o.checkout_url ? 'Descoberto' : 'Não informado')}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Order Bumps"
                            offers={selectedOffers}
                            render={(o) =>
                              o.order_bumps && o.order_bumps.length > 0 ? (
                                <div className="space-y-1">
                                  <span className="text-emerald-400 font-bold block text-[11px]">
                                    {o.order_bumps.length} order bump(s)
                                  </span>
                                  {o.order_bumps.map((b, i) => (
                                    <div key={i} className="text-[11px] text-slate-300">
                                      • {b.name} (<span className="text-emerald-400 font-mono">{formatCurrency(b.price)}</span>)
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">Sem order bump detectado</span>
                              )
                            }
                          />
                          <MatrixRow
                            label="Status Mapeamento Checkout"
                            offers={selectedOffers}
                            render={(o) => (
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  o.checkout_mapping_status === 'SUCCESS'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {o.checkout_mapping_status === 'SUCCESS' ? 'Mapeado' : 'Pendente'}
                              </span>
                            )}
                          />
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* BLOCO 6 — CRIATIVOS */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'creatives') && (
                      <BlockAccordionHeader
                        title="6. BLOCO — CRIATIVOS & MÍDIA"
                        icon={<Video className="w-4 h-4 text-indigo-400" />}
                        isExpanded={expandedBlocks.creatives}
                        onToggle={() => toggleBlock('creatives')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'creatives') &&
                      expandedBlocks.creatives && (
                        <>
                          <MatrixRow
                            label="Qtd Est. Criativos"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="font-mono text-indigo-300 font-bold">
                                {o.estimated_unique_creatives || o.creatives?.length
                                  ? `${o.estimated_unique_creatives || o.creatives?.length} criativos`
                                  : 'Não informado'}
                              </span>
                            )}
                          />
                          <MatrixRow
                            label="Formato de Mídia"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="text-slate-300 font-medium">
                                {o.ad_format || 'Vídeo / Imagem'}
                              </span>
                            )}
                          />
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* BLOCO 7 — COPY & POSICIONAMENTO */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'copy') && (
                      <BlockAccordionHeader
                        title="7. BLOCO — COPY & POSICIONAMENTO"
                        icon={<FileText className="w-4 h-4 text-purple-400" />}
                        isExpanded={expandedBlocks.copy}
                        onToggle={() => toggleBlock('copy')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'copy') &&
                      expandedBlocks.copy && (
                        <>
                          <MatrixRow
                            label="Headline / Gancho"
                            offers={selectedOffers}
                            render={(o) =>
                              o.headline ? (
                                <p className="text-slate-300 italic text-[11px]">"{o.headline}"</p>
                              ) : (
                                <span className="text-slate-500">Não informado</span>
                              )
                            }
                          />
                          <MatrixRow
                            label="Promessa Principal"
                            offers={selectedOffers}
                            render={(o) =>
                              o.promise ? (
                                <p className="text-slate-200 text-[11px]">{o.promise}</p>
                              ) : (
                                <span className="text-slate-500">Não informado</span>
                              )
                            }
                          />
                        </>
                      )}

                    {/* ============================================================== */}
                    {/* BLOCO 8 — PÚBLICO & AVATAR */}
                    {/* ============================================================== */}
                    {(activeCategory === 'ALL' || activeCategory === 'audience') && (
                      <BlockAccordionHeader
                        title="8. BLOCO — PÚBLICO & AVATAR"
                        icon={<Users className="w-4 h-4 text-amber-400" />}
                        isExpanded={expandedBlocks.audience}
                        onToggle={() => toggleBlock('audience')}
                      />
                    )}
                    {(activeCategory === 'ALL' || activeCategory === 'audience') &&
                      expandedBlocks.audience && (
                        <>
                          <MatrixRow
                            label="Operação Faceless / Expert"
                            offers={selectedOffers}
                            render={(o) => <FacelessBadge faceless={o.faceless} />}
                          />
                          <MatrixRow
                            label="Nicho Alvo"
                            offers={selectedOffers}
                            render={(o) => (
                              <span className="text-slate-200 font-semibold">
                                {o.niche || 'Geral'}
                              </span>
                            )}
                          />
                        </>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE SELEÇÃO DE OFERTAS */}
      <SelectOfferModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTargetSlotIndex(null);
        }}
        allOffers={allOffers}
        selectedOfferIds={selectedOffers.map((o) => o.id)}
        onSelectOffer={handleSelectOfferFromModal}
        targetSlotIndex={targetSlotIndex}
      />
    </AppShell>
  );
}

// Sub-component: Accordion Header Row in Table
function BlockAccordionHeader({
  title,
  icon,
  isExpanded,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      onClick={onToggle}
      className="bg-slate-950/90 border-y border-slate-800 cursor-pointer hover:bg-slate-950 transition-colors"
    >
      <td colSpan={4} className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-bold text-white tracking-wider uppercase">{title}</span>
          </div>
          <button className="text-slate-400 hover:text-white p-1">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// Sub-component: Matrix Row rendering up to 3 offer columns
function MatrixRow({
  label,
  offers,
  render,
}: {
  label: string;
  offers: Offer[];
  render: (offer: Offer) => React.ReactNode;
}) {
  return (
    <tr className="hover:bg-slate-850/50 transition-colors">
      {/* Sticky Label Column */}
      <td className="py-3.5 px-4 font-bold text-slate-300 bg-slate-950 sticky left-0 z-10 border-r border-slate-800 text-[11px] uppercase tracking-wider">
        {label}
      </td>

      {/* Active Offer Columns */}
      {offers.map((offer) => (
        <td
          key={offer.id}
          className="py-3.5 px-5 w-1/3 min-w-[260px] border-r border-slate-800/80 last:border-r-0 text-slate-200 text-xs align-top"
        >
          {render(offer)}
        </td>
      ))}

      {/* Empty slot placeholders if < 3 offers selected */}
      {Array.from({ length: 3 - offers.length }).map((_, i) => (
        <td
          key={`empty-td-${i}`}
          className="py-3.5 px-5 w-1/3 min-w-[260px] border-r border-slate-800/80 last:border-r-0 text-slate-600 italic text-[11px] align-top"
        >
          Não informado
        </td>
      ))}
    </tr>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando comparador...</div>}>
      <CompareContent />
    </Suspense>
  );
}
