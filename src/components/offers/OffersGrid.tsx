'use client';

import React, { useState } from 'react';
import { Offer } from '@/types';
import { OfferCard, CardDensity } from './OfferCard';
import {
  ChevronLeft,
  ChevronRight,
  Sliders,
  CheckSquare,
  Square,
  LayoutGrid,
  Grid3X3,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OffersGridProps {
  offers: Offer[];
  selectedIds: string[];
  density: CardDensity;
  onChangeDensity: (density: CardDensity) => void;
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

export function OffersGrid({
  offers,
  selectedIds,
  density,
  onChangeDensity,
  onSelectRow,
  onSelectAll,
  onToggleFavorite,
  onToggleWatchlist,
  onToggleDeepDive,
  onEditOffer,
  onDeleteOffer,
  onScrapeOffer,
  onViewReconciliation,
}: OffersGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  const totalPages = Math.ceil(offers.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedOffers = offers.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const allInPageSelected =
    paginatedOffers.length > 0 &&
    paginatedOffers.every((o) => selectedIds.includes(o.id));

  const handleToggleSelectPage = () => {
    if (allInPageSelected) {
      // Unselect page offers
      paginatedOffers.forEach((o) => {
        if (selectedIds.includes(o.id)) {
          onSelectRow(o.id, false);
        }
      });
    } else {
      // Select all page offers
      paginatedOffers.forEach((o) => {
        if (!selectedIds.includes(o.id)) {
          onSelectRow(o.id, true);
        }
      });
    }
  };

  const startIdx = (safeCurrentPage - 1) * pageSize + 1;
  const endIdx = Math.min(safeCurrentPage * pageSize, offers.length);

  return (
    <div className="space-y-4">
      {/* Grid Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-sm text-xs">
        {/* Left: Multi-select & Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSelectPage}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium transition"
            title={allInPageSelected ? 'Desmarcar página' : 'Selecionar ofertas desta página'}
          >
            {allInPageSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-500" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>Selecionar Página</span>
          </button>

          <span className="text-slate-600">|</span>

          <span className="text-slate-400">
            Mostrando <span className="font-semibold text-slate-200 tabular-numbers">{offers.length > 0 ? `${startIdx}–${endIdx}` : '0'}</span> de{' '}
            <span className="font-semibold text-slate-200 tabular-numbers">{offers.length}</span> ofertas
          </span>
        </div>

        {/* Right: Density & Page Size */}
        <div className="flex items-center gap-2.5">
          {/* Card Density Segmented Control */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onChangeDensity('compact')}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1',
                density === 'compact'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              title="Visualização Compacta (mais cards por tela)"
            >
              <Grid3X3 className="w-3 h-3" />
              <span>Compacto</span>
            </button>

            <button
              onClick={() => onChangeDensity('standard')}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1',
                density === 'standard'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              title="Visualização Padrão (equilibrada)"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Padrão</span>
            </button>

            <button
              onClick={() => onChangeDensity('detailed')}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1',
                density === 'detailed'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              title="Visualização Detalhada (com headline e domínio)"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Detalhado</span>
            </button>
          </div>

          {/* Page Size Select */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value={12}>12 / pág</option>
            <option value={24}>24 / pág</option>
            <option value={48}>48 / pág</option>
            <option value={96}>96 / pág</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div
        className={cn(
          'grid gap-4 sm:gap-5',
          density === 'compact'
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
        )}
      >
        {paginatedOffers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            selected={selectedIds.includes(offer.id)}
            density={density}
            onSelect={(selected) => onSelectRow(offer.id, selected)}
            onToggleFavorite={onToggleFavorite}
            onToggleWatchlist={onToggleWatchlist}
            onToggleDeepDive={onToggleDeepDive}
            onEditOffer={onEditOffer}
            onDeleteOffer={onDeleteOffer}
            onScrapeOffer={onScrapeOffer}
            onViewReconciliation={onViewReconciliation}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-8 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">
            Página <span className="font-semibold text-white tabular-numbers">{safeCurrentPage}</span> de{' '}
            <span className="font-semibold text-white tabular-numbers">{totalPages}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>

            {/* Page number buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                let pageNum = idx + 1;
                if (totalPages > 5 && safeCurrentPage > 3) {
                  pageNum = safeCurrentPage - 3 + idx;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'w-8 h-8 rounded-xl font-semibold transition tabular-numbers',
                      safeCurrentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              <span>Próxima</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
