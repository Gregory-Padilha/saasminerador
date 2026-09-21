'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Offer } from '@/types';
import { StatusBadge, FacelessBadge } from '@/components/ui/StatusBadge';
import { TrendBadge } from '@/components/ui/TrendBadge';
import { DossierCompletenessBadge } from '@/components/ui/DossierCompletenessBadge';
import { buildOfferReadModel } from '@/lib/offer/read-model';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Star,
  Eye,
  Flame,
  ExternalLink,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Compass,
  Columns,
  Sliders,
  RefreshCw,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOfferScaleTier } from '@/lib/scale-tier';

interface DataTableProps {
  offers: Offer[];
  selectedIds: string[];
  onSelectRow: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onToggleFavorite: (offer: Offer) => void;
  onToggleWatchlist: (offer: Offer) => void;
  onToggleDeepDive: (offer: Offer) => void;
  onEditOffer: (offer: Offer) => void;
  onDeleteOffer: (offer: Offer) => void;
  onScrapeOffer?: (offer: Offer) => void;
  onViewReconciliation?: (offer: Offer) => void;
}

export function DataTable({
  offers,
  selectedIds,
  onSelectRow,
  onSelectAll,
  onToggleFavorite,
  onToggleWatchlist,
  onToggleDeepDive,
  onEditOffer,
  onDeleteOffer,
  onScrapeOffer,
  onViewReconciliation,
}: DataTableProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    favorite: true,
    watchlist: true,
    product: true,
    niche: true,
    price: true,
    ads: true,
    creatives: true,
    days: true,
    trend: true,
    faceless: true,
    completeness: true,
    status: true,
    imported_at: true,
    actions: true,
  });
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalPages = Math.ceil(offers.length / pageSize) || 1;
  const paginatedOffers = offers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const allSelected =
    paginatedOffers.length > 0 &&
    paginatedOffers.every((o) => selectedIds.includes(o.id));

  const handleRowClick = (offerId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('[role="menu"]')
    ) {
      return;
    }
    router.push(`/offers/${offerId}`);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      {/* Top Table Control Bar */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 select-none">
        <span className="font-semibold text-slate-300">
          Base de Ofertas Mineradas ({offers.length} registros)
        </span>

        {/* Column Config Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsColMenuOpen(!isColMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition font-medium"
          >
            <Sliders className="w-3 h-3 text-slate-400" />
            <span>Colunas Visíveis</span>
          </button>

          {isColMenuOpen && (
            <div className="absolute right-0 top-8 z-30 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-1 animate-in fade-in duration-100 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 block">
                Alternar Colunas
              </span>
              {[
                { key: 'watchlist', label: 'Acompanhando (Olho)' },
                { key: 'niche', label: 'Nicho & Subnicho' },
                { key: 'price', label: 'Preço' },
                { key: 'ads', label: 'Ads Ativos' },
                { key: 'creatives', label: 'Criativos Distintos' },
                { key: 'days', label: 'Dias Rodando' },
                { key: 'trend', label: 'Tendência' },
                { key: 'faceless', label: 'Faceless' },
                { key: 'completeness', label: 'Dossiê (%)' },
                { key: 'status', label: 'Status de Pesquisa' },
                { key: 'imported_at', label: 'Data de Captura' },
              ].map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800 cursor-pointer text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key] ?? true}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
              <th className="w-10 px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                />
              </th>
              {visibleColumns.favorite && <th className="w-8 px-1 py-3.5 text-center">★</th>}
              {visibleColumns.watchlist && <th className="w-8 px-1 py-3.5 text-center">👁</th>}
              {visibleColumns.product && <th className="px-4 py-3.5">Produto & Anunciante</th>}
              {visibleColumns.niche && <th className="px-4 py-3.5">Nicho</th>}
              {visibleColumns.price && <th className="px-4 py-3.5">Preço</th>}
              {visibleColumns.ads && <th className="px-4 py-3.5">Ads</th>}
              {visibleColumns.creatives && <th className="px-4 py-3.5">Criativos</th>}
              {visibleColumns.days && <th className="px-4 py-3.5">Dias</th>}
              {visibleColumns.trend && <th className="px-4 py-3.5">Tendência</th>}
              {visibleColumns.faceless && <th className="px-4 py-3.5">Tipo</th>}
              {visibleColumns.completeness && <th className="px-4 py-3.5">Dossiê</th>}
              {visibleColumns.status && <th className="px-4 py-3.5">Status</th>}
              {visibleColumns.imported_at && <th className="px-4 py-3.5">Última Captura</th>}
              {visibleColumns.actions && <th className="px-4 py-3.5 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {paginatedOffers.map((offer, rowIndex) => {
              const isSelected = selectedIds.includes(offer.id);
              const readModel = buildOfferReadModel(offer);

              return (
                <tr
                  key={offer.id}
                  onClick={(e) => handleRowClick(offer.id, e)}
                  className={cn(
                    'group hover:bg-slate-800/40 transition-colors cursor-pointer',
                    isSelected && 'bg-blue-900/10'
                  )}
                >
                  {/* Select Checkbox */}
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectRow(offer.id, e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                  </td>

                  {/* Favorite Star */}
                  {visibleColumns.favorite && (
                    <td className="px-1 py-3.5 text-center">
                      <button
                        onClick={() => onToggleFavorite(offer)}
                        className="p-1 rounded text-slate-400 hover:text-amber-400 transition"
                        title={offer.favorite ? 'Remover dos favoritos' : 'Favoritar oferta'}
                      >
                        <Star
                          className={cn(
                            'w-4 h-4 transition-colors',
                            offer.favorite
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-400 group-hover:text-slate-300'
                          )}
                        />
                      </button>
                    </td>
                  )}

                  {/* Watchlist Toggle */}
                  {visibleColumns.watchlist && (
                    <td className="px-1 py-3.5 text-center">
                      <button
                        onClick={() => onToggleWatchlist(offer)}
                        className="p-1 rounded text-slate-400 hover:text-cyan-400 transition"
                        title={offer.watching ? 'Acompanhando' : 'Acompanhar oferta'}
                      >
                        <Eye
                          className={cn(
                            'w-4 h-4 transition-colors',
                            offer.watching
                              ? 'text-cyan-400 fill-cyan-400/20'
                              : 'text-slate-400 group-hover:text-slate-300'
                          )}
                        />
                      </button>
                    </td>
                  )}

                  {/* Product & Advertiser */}
                  {visibleColumns.product && (
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white group-hover:text-blue-400 transition truncate text-sm">
                          {offer.product_name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate mt-0.5">
                          {offer.advertiser || 'Anunciante não informado'}
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Niche */}
                  {visibleColumns.niche && (
                    <td className="px-4 py-3.5">
                      {offer.niche ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/60 truncate max-w-[130px]">
                          {offer.niche}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}

                  {/* Price */}
                  {visibleColumns.price && (
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white font-mono tabular-numbers text-sm">
                          {formatCurrency(readModel.metrics.price)}
                        </span>
                        {readModel.price_conflict && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono"
                            title={readModel.price_conflict.description}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            LP: R$ {readModel.price_conflict.conflictingValue}
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Active Ads */}
                  {visibleColumns.ads && (() => {
                    const scaleInfo = getOfferScaleTier(offer.active_ads_count);
                    return (
                      <td className="px-4 py-3.5">
                        {offer.active_ads_count !== null && offer.active_ads_count !== undefined ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className={cn("inline-flex items-center px-2 py-0.5 rounded-md font-mono font-semibold tabular-numbers text-xs border", scaleInfo.badgeClass || "bg-blue-500/10 text-blue-400 border-blue-500/20")}>
                              {scaleInfo.tier === 'FULL_SCALE' && '🔥 '}
                              {offer.active_ads_count} ads
                            </div>
                            {scaleInfo.badgeLabel && (
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap", scaleInfo.badgeClass)} title={scaleInfo.tooltip}>
                                {scaleInfo.badgeLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    );
                  })()}

                  {/* Creatives Count */}
                  {visibleColumns.creatives && (
                    <td className="px-4 py-3.5">
                      {offer.captured_creatives_count && offer.captured_creatives_count > 0 ? (
                        <span className="font-mono text-xs text-emerald-400 font-semibold tabular-numbers flex items-center gap-1" title={`${offer.captured_creatives_count} criativos salvos (estimado: ${offer.estimated_unique_creatives ?? '—'})`}>
                          {offer.captured_creatives_count} cr <span className="text-[9px] px-1 py-0.2 bg-emerald-500/10 rounded">salvos</span>
                        </span>
                      ) : offer.estimated_unique_creatives !== null && offer.estimated_unique_creatives !== undefined ? (
                        <span className="font-mono text-xs text-indigo-300 font-semibold tabular-numbers">
                          {offer.estimated_unique_creatives} cr
                        </span>
                      ) : offer.creatives && offer.creatives.length > 0 ? (
                        <span className="font-mono text-xs text-indigo-300 font-semibold tabular-numbers">
                          {offer.creatives.length} cr
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}

                  {/* Days Running */}
                  {visibleColumns.days && (
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-300 tabular-numbers">
                        {readModel.metrics.days_running !== null && readModel.metrics.days_running !== undefined
                          ? `${readModel.metrics.days_running}d`
                          : '—'}
                      </span>
                    </td>
                  )}

                  {/* Trend */}
                  {visibleColumns.trend && (
                    <td className="px-4 py-3.5">
                      <TrendBadge trend={offer.trend} size="sm" />
                    </td>
                  )}

                  {/* Faceless */}
                  {visibleColumns.faceless && (
                    <td className="px-4 py-3.5">
                      <FacelessBadge faceless={offer.faceless} size="sm" />
                    </td>
                  )}

                  {/* Dossier Completeness */}
                  {visibleColumns.completeness && (
                    <td className="px-4 py-3.5">
                      <DossierCompletenessBadge offer={offer} size="sm" />
                    </td>
                  )}

                  {/* Status */}
                  {visibleColumns.status && (
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={readModel.data_status}
                        breakdown={readModel.stages}
                        missingRequirements={readModel.missing_requirements}
                        size="sm"
                      />
                    </td>
                  )}

                  {/* Date */}
                  {visibleColumns.imported_at && (
                    <td className="px-4 py-3.5 text-slate-400 tabular-numbers whitespace-nowrap">
                      {formatDate(offer.last_seen_at || offer.last_imported_at || offer.created_at)}
                    </td>
                  )}

                  {/* Quick Actions */}
                  {visibleColumns.actions && (
                    <td className="px-4 py-3.5 text-right whitespace-nowrap relative">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Open LP */}
                        {offer.landing_page_url && (
                          <a
                            href={offer.landing_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-750 transition"
                            title="Página de Vendas"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Open Meta Ads */}
                        {offer.meta_ads_url && (
                          <a
                            href={offer.meta_ads_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-750 transition"
                            title="Meta Ads Library"
                          >
                            <Compass className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Context Menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === offer.id ? null : offer.id);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {activeMenuId === offer.id && (
                            <div
                              className={cn(
                                "absolute right-0 z-30 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 text-xs text-slate-300 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-left",
                                rowIndex >= paginatedOffers.length - 3 ? "bottom-full mb-1" : "top-8"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  router.push(`/offers/${offer.id}`);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                                <span>Abrir Workspace</span>
                              </button>

                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  router.push(`/compare?ids=${offer.id}`);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition"
                              >
                                <Columns className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Comparar Oferta</span>
                              </button>

                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onToggleDeepDive(offer);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition"
                              >
                                <Flame className="w-3.5 h-3.5 text-orange-400" />
                                <span>{offer.in_deep_dive ? 'Remover Deep Dive' : 'Marcar Deep Dive'}</span>
                              </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    if (onScrapeOffer) onScrapeOffer(offer);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-600/20 text-emerald-300 font-medium transition"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Raspar & Enriquecer</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    if (onViewReconciliation) onViewReconciliation(offer);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition"
                                >
                                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Ver Última Raspagem</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    onEditOffer(offer);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Editar</span>
                                </button>

                              <div className="border-t border-slate-800 my-1" />

                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onDeleteOffer(offer);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400 select-none">
        <div className="flex items-center gap-2">
          <span>Itens por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="ml-2">
            Página <span className="font-semibold text-white">{currentPage}</span> de{' '}
            <span className="font-semibold text-white">{totalPages}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 transition"
          >
            <span>Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
