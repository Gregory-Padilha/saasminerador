'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Offer } from '@/types';
import { StatusBadge, FacelessBadge } from '@/components/ui/StatusBadge';
import { deriveDataStatus } from '@/lib/dossier';
import { buildOfferReadModel } from '@/lib/offer/read-model';
import { TrendBadge } from '@/components/ui/TrendBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Star,
  Eye,
  Flame,
  ExternalLink,
  MoreHorizontal,
  Edit2,
  Trash2,
  Globe,
  ShoppingCart,
  Radio,
  Sparkles,
  ArrowRight,
  Layers,
  Calendar,
  DollarSign,
  Tv,
  Image as ImageIcon,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { getOfferScaleTier } from '@/lib/scale-tier';

export type CardDensity = 'compact' | 'standard' | 'detailed';

interface OfferCardProps {
  offer: Offer;
  selected: boolean;
  density?: CardDensity;
  onSelect: (selected: boolean) => void;
  onToggleFavorite: (offer: Offer) => void;
  onToggleWatchlist: (offer: Offer) => void;
  onToggleDeepDive: (offer: Offer) => void;
  onEditOffer: (offer: Offer) => void;
  onDeleteOffer: (offer: Offer) => void;
  onScrapeOffer?: (offer: Offer) => void;
  onViewReconciliation?: (offer: Offer) => void;
}

export function OfferCard({
  offer,
  selected,
  density = 'standard',
  onSelect,
  onToggleFavorite,
  onToggleWatchlist,
  onToggleDeepDive,
  onEditOffer,
  onDeleteOffer,
  onScrapeOffer,
  onViewReconciliation,
}: OfferCardProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const scaleInfo = getOfferScaleTier(offer.active_ads_count);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('[role="menu"]')
    ) {
      return;
    }
    router.push(`/offers/${offer.id}`);
  };

  const isCompact = density === 'compact';
  const isDetailed = density === 'detailed';
  const readModel = React.useMemo(() => buildOfferReadModel(offer), [offer]);
  const dataStatus = readModel.data_status;
  const isArchived = offer.archived === true || offer.status === 'ARQUIVADA';

  return (
    <div
      onClick={handleCardClick}
      className="group relative rounded-2xl p-[1px] transition-all duration-300 cursor-pointer select-none text-left h-full flex flex-col min-w-[260px]"
    >
      {/* LAYER 1: ATMOSPHERIC OUTER FLAME AURA BLUR */}
      <div
        className={cn(
          'absolute -inset-[1px] rounded-2xl blur-xs pointer-events-none transition-opacity duration-300 overflow-hidden',
          scaleInfo.flameAuraClass,
          scaleInfo.flickerClass
        )}
      >
        <div className={cn('absolute inset-[-100%] m-auto aspect-square', scaleInfo.conicGradientClass, scaleInfo.spinSpeedClass)} />
      </div>

      {/* LAYER 2: ANIMATED FIERY BORDER CONTOUR MASK */}
      <div className={cn('absolute inset-0 rounded-2xl overflow-hidden pointer-events-none', scaleInfo.flickerClass)}>
        <div className={cn('absolute inset-[-100%] m-auto aspect-square', scaleInfo.conicGradientClass, scaleInfo.spinSpeedClass)} />
      </div>

      {/* LAYER 3: INNER CARD CONTENT SHELL */}
      <div
        className={cn(
          'relative z-10 flex flex-col justify-between rounded-[15px] w-full h-full transition-all duration-200 text-left overflow-hidden',
          selected
            ? 'bg-slate-900 border-2 border-blue-500/90 shadow-xl shadow-blue-500/25'
            : scaleInfo.innerBgClass,
          isCompact ? 'p-3 space-y-2' : isDetailed ? 'p-4 sm:p-4.5 space-y-3' : 'p-3.5 sm:p-4 space-y-2.5'
        )}
      >
        {/* 1. TOP BAR: Checkbox, Status, Scale Badge, Quick Actions */}
        <div className="flex items-center justify-between gap-1.5 h-7 shrink-0">
          <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(e.target.checked);
              }}
              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0"
              title="Selecionar oferta"
            />
            <StatusBadge
              status={dataStatus}
              breakdown={readModel.stages}
              missingRequirements={readModel.missing_requirements}
              size="sm"
            />
            {scaleInfo.badgeLabel && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-bold transition-all shrink-0',
                  scaleInfo.badgeClass
                )}
                title={scaleInfo.tooltip}
              >
                {scaleInfo.badgeLabel}
              </span>
            )}
            {isArchived && <StatusBadge status="ARQUIVADA" size="sm" />}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Favorite */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(offer);
              }}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                offer.favorite
                  ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                  : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800/80'
              )}
              title={offer.favorite ? 'Remover dos favoritos' : 'Favoritar'}
            >
              <Star className={cn('w-3.5 h-3.5', offer.favorite && 'fill-amber-400')} />
            </button>

            {/* Watchlist */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist(offer);
              }}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                offer.watching
                  ? 'text-purple-400 bg-purple-400/10 hover:bg-purple-400/20'
                  : 'text-slate-500 hover:text-purple-400 hover:bg-slate-800/80'
              )}
              title={offer.watching ? 'Parar de acompanhar' : 'Acompanhar oferta'}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {/* Deep Dive */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleDeepDive(offer);
              }}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                offer.in_deep_dive
                  ? 'text-orange-400 bg-orange-400/10 hover:bg-orange-400/20'
                  : 'text-slate-500 hover:text-orange-400 hover:bg-slate-800/80'
              )}
              title={offer.in_deep_dive ? 'Em Deep Dive' : 'Adicionar ao Deep Dive'}
            >
              <Flame className={cn('w-3.5 h-3.5', offer.in_deep_dive && 'fill-orange-400')} />
            </button>

            {/* Context Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                title="Mais opções"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {isMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-7 z-30 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in duration-100 text-xs"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      router.push(`/offers/${offer.id}`);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:bg-slate-800 hover:text-white transition"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                    <span>Abrir Dossiê</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      router.push(`/intelligence?from=/offers&offerId=${offer.id}`);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-purple-300 hover:bg-purple-600/20 transition font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Analisar com IA</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      if (onScrapeOffer) onScrapeOffer(offer);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-emerald-300 hover:bg-emerald-600/20 transition font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Raspar & Enriquecer</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      if (onViewReconciliation) onViewReconciliation(offer);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:bg-slate-800 hover:text-white transition"
                  >
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ver Última Raspagem</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onEditOffer(offer);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:bg-slate-800 hover:text-white transition"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Editar Oferta</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDeleteOffer(offer);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. IDENTITY AREA: Product Title, Advertiser, Taxonomy Chips, Optional Headline */}
        <div className="space-y-1 shrink-0">
          {/* Product Title: Reserved 2-line height */}
          <div className={cn('flex items-start overflow-hidden', isCompact ? 'h-9' : 'h-10')}>
            <h3
              className={cn(
                'font-bold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug w-full',
                isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
              )}
              title={offer.product_name}
            >
              {offer.product_name || 'Oferta Sem Nome'}
            </h3>
          </div>

          {/* Advertiser: Reserved 1-line height */}
          <div className="h-4.5 flex items-center overflow-hidden">
            <p className="text-[11px] text-slate-400 font-medium truncate w-full" title={offer.advertiser || 'Sem anunciante'}>
              {offer.advertiser || <span className="text-slate-500/70">Anunciante não identificado</span>}
            </p>
          </div>

          {/* Taxonomy Chips: Reserved 1-line height with single horizontal row */}
          <div className="h-6 flex items-center gap-1.5 flex-nowrap overflow-hidden pt-0.5">
            {offer.niche ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 truncate shrink-0 max-w-[110px]">
                {offer.niche}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500/70 shrink-0">Nicho —</span>
            )}

            {offer.subniche && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 truncate shrink-0 max-w-[100px]">
                {offer.subniche}
              </span>
            )}

            {offer.product_type && isDetailed && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 truncate shrink-0 max-w-[90px]">
                {offer.product_type}
              </span>
            )}
          </div>

          {/* Optional Headline or Description: Fixed reserved slot */}
          {!isCompact && (
            <div className={cn('flex items-center pt-1 border-t border-slate-800/50 overflow-hidden', isDetailed ? 'h-9' : 'h-7')}>
              {offer.headline ? (
                <p className="text-[11px] text-slate-400/90 italic line-clamp-2 leading-tight w-full" title={offer.headline}>
                  "{offer.headline}"
                </p>
              ) : (
                <span className="text-[10px] text-slate-500/40 italic truncate w-full">—</span>
              )}
            </div>
          )}
        </div>

        {/* 3. FLEX SPACER: Guarantees lower sections are strictly anchored on the exact same baseline */}
        <div className="flex-1 min-h-[4px]" />

        {/* 4. METRICS & SECONDARY ROW */}
        <div className="space-y-2 shrink-0">
          {/* Standardized 4-Column Metrics Grid */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
            {/* Preço / Front-End */}
            <div
              className="flex flex-col justify-between p-1.5 h-[46px] rounded-lg bg-slate-900/80 border border-slate-800/50 overflow-hidden"
              title={
                (offer.front_options_count || offer.frontend_options?.length || 1) > 1 && offer.front_price_avg
                  ? `${offer.front_options_count || offer.frontend_options?.length} opções front-end. Média: ${formatCurrency(offer.front_price_avg)}`
                  : undefined
              }
            >
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between gap-0.5">
                <span className="flex items-center gap-0.5 truncate">
                  <DollarSign className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  Preço
                </span>
              </span>
              <span className="text-xs font-bold text-slate-100 tabular-numbers truncate">
                {(offer.front_options_count || offer.frontend_options?.length || 1) > 1 && offer.front_price_min && offer.front_price_max && offer.front_price_min < offer.front_price_max ? (
                  <>
                    {formatCurrency(offer.front_price_min)}–{formatCurrency(offer.front_price_max)}
                  </>
                ) : (
                  formatCurrency(readModel.metrics.price)
                )}
              </span>
            </div>

            {/* Ads Ativos */}
            <div
              className={cn(
                "flex flex-col justify-between p-1.5 h-[46px] rounded-lg border transition-colors overflow-hidden",
                scaleInfo.cardHeaderClass || "bg-slate-900/80 border-slate-800/50"
              )}
              title={scaleInfo.tooltip}
            >
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-0.5 truncate">
                {scaleInfo.tier === 'FULL_SCALE' || scaleInfo.tier === 'HIGH_SCALE' ? (
                  <Flame className={cn("w-2.5 h-2.5 shrink-0", scaleInfo.textClass)} />
                ) : scaleInfo.tier === 'SCALING' ? (
                  <Sparkles className={cn("w-2.5 h-2.5 shrink-0", scaleInfo.textClass)} />
                ) : (
                  <Radio className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                )}
                Ads
              </span>
              <span className={cn("text-xs font-bold tabular-numbers truncate flex items-center gap-0.5", scaleInfo.textClass || "text-blue-300")}>
                {scaleInfo.tier === 'FULL_SCALE' && '🔥'}
                {readModel.metrics.active_ads_count !== null && readModel.metrics.active_ads_count !== undefined
                  ? readModel.metrics.active_ads_count
                  : '—'}
              </span>
            </div>

            {/* Dias Rodando */}
            <div className="flex flex-col justify-between p-1.5 h-[46px] rounded-lg bg-slate-900/80 border border-slate-800/50 overflow-hidden">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-0.5 truncate">
                <Calendar className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                Dias
              </span>
              <span className="text-xs font-bold text-amber-300 tabular-numbers truncate">
                {readModel.metrics.days_running !== null && readModel.metrics.days_running !== undefined
                  ? `${readModel.metrics.days_running}d`
                  : '—'}
              </span>
            </div>

            {/* Criativos */}
            <div className="flex flex-col justify-between p-1.5 h-[46px] rounded-lg bg-slate-900/80 border border-slate-800/50 overflow-hidden">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-0.5 truncate">
                <ImageIcon className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                Criativos
              </span>
              <span className="text-xs font-bold text-slate-200 tabular-numbers truncate">
                {offer.captured_creatives_count && offer.captured_creatives_count > 0 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5 truncate" title={`${offer.captured_creatives_count} criativos salvos`}>
                    {offer.captured_creatives_count}
                    <span className="text-[8px] font-semibold text-emerald-400/90 px-0.5 py-0.1 bg-emerald-500/10 rounded shrink-0">salvos</span>
                  </span>
                ) : readModel.metrics.unique_creatives_count !== null && readModel.metrics.unique_creatives_count !== undefined ? (
                  readModel.metrics.unique_creatives_count
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>

          {/* Price Conflict Alert if detected */}
          {readModel.price_conflict && (
            <div
              className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 flex items-center justify-between gap-1.5"
              title={readModel.price_conflict.description}
            >
              <span className="flex items-center gap-1 truncate">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">LP: R$ {readModel.price_conflict.conflictingValue} vs Checkout: R$ {readModel.price_conflict.primaryValue}</span>
              </span>
              <span className="text-[9px] text-amber-400/80 font-mono shrink-0">Conflito</span>
            </div>
          )}

          {/* Secondary Indicators Row: Faceless, Trend, Last Seen */}
          <div className="flex items-center justify-between gap-1.5 text-[10px] h-5 pt-0.5">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <FacelessBadge faceless={offer.faceless} size="sm" />
              <TrendBadge trend={offer.trend} size="sm" />
            </div>

            <div className="text-[10px] text-slate-400 tabular-numbers font-medium shrink-0">
              {offer.last_imported_at || offer.created_at
                ? formatDate(offer.last_imported_at || offer.created_at)
                : '—'}
            </div>
          </div>

          {/* Detailed Domain */}
          {isDetailed && (
            <div className="h-5 flex items-center gap-1 text-[10px] text-slate-400 truncate pt-1 border-t border-slate-800/50">
              <Globe className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{offer.landing_page_domain || 'Sem domínio registrado'}</span>
            </div>
          )}
        </div>

        {/* 5. FOOTER: Anchored at Bottom */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 h-9 shrink-0 mt-auto">
          {/* Main CTA: Dossiê */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/offers/${offer.id}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 text-xs font-semibold border border-blue-500/20 transition active:scale-95"
          >
            <span>Dossiê</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* External Quick Links */}
          <div className="flex items-center gap-1 min-w-[80px] justify-end">
            {offer.meta_ads_url ? (
              <a
                href={offer.meta_ads_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 border border-slate-800 hover:border-blue-500/30 transition"
                title="Abrir Meta Ads Library"
              >
                <Tv className="w-3.5 h-3.5" />
              </a>
            ) : null}

            {offer.landing_page_url ? (
              <a
                href={offer.landing_page_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-cyan-600/20 text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/30 transition"
                title="Abrir Landing Page"
              >
                <Globe className="w-3.5 h-3.5" />
              </a>
            ) : null}

            {offer.checkout_url ? (
              <a
                href={offer.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/30 transition"
                title="Abrir Checkout"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
