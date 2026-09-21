'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Star,
  Eye,
  Flame,
  Trash2,
  Archive,
  ChevronDown,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { OfferStatus } from '@/types';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  isAllFavorites?: boolean;
  isAllWatching?: boolean;
  isProcessing?: boolean;
  onClearSelection: () => void;
  onBulkFavorite: (favorite: boolean) => Promise<void> | void;
  onBulkWatchlist: (watching: boolean) => Promise<void> | void;
  onBulkDeepDive: () => Promise<void> | void;
  onBulkScrape?: () => Promise<void> | void;
  onBulkChangeStatus: (status: OfferStatus) => Promise<void> | void;
  onBulkArchive: () => Promise<void> | void;
  onBulkDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  isAllFavorites = false,
  isAllWatching = false,
  isProcessing = false,
  onClearSelection,
  onBulkFavorite,
  onBulkWatchlist,
  onBulkDeepDive,
  onBulkScrape,
  onBulkChangeStatus,
  onBulkArchive,
  onBulkDelete,
}: BulkActionBarProps) {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    }
    if (isStatusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStatusMenuOpen]);

  if (selectedCount === 0) return null;

  const statusOptions: { key: OfferStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'NOVA', label: 'Nova', icon: Sparkles },
    { key: 'DADOS_PARCIAIS', label: 'Dados Parciais', icon: AlertCircle },
    { key: 'MAPEADA', label: 'Mapeada', icon: CheckCircle2 },
    { key: 'ANALISADA', label: 'Analisada', icon: FileCheck2 },
    { key: 'ACOMPANHANDO', label: 'Acompanhando', icon: Eye },
    { key: 'ARQUIVADA', label: 'Arquivada', icon: Archive },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-slate-700/90 shadow-2xl rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200 select-none max-w-[95vw]">
      {/* 1. Counter Pill */}
      <div className="flex items-center gap-2 pr-2.5 sm:pr-3 border-r border-slate-800">
        <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center tabular-numbers">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
          {selectedCount === 1 ? '1 selecionada' : `${selectedCount} selecionadas`}
        </span>
      </div>

      {/* 2. Actions List */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {/* Favoritar / Remover dos Favoritos */}
        <button
          onClick={() => onBulkFavorite(!isAllFavorites)}
          disabled={isProcessing}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition disabled:opacity-50',
            isAllFavorites
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-800'
          )}
          title={isAllFavorites ? 'Remover todas dos favoritos' : 'Adicionar todas aos favoritos'}
        >
          <Star className={cn('w-3.5 h-3.5', isAllFavorites ? 'fill-amber-400 text-amber-400' : 'text-slate-400')} />
          <span className="hidden sm:inline">
            {isAllFavorites ? 'Remover Favoritos' : 'Favoritar'}
          </span>
        </button>

        {/* Acompanhar / Parar de Acompanhar */}
        <button
          onClick={() => onBulkWatchlist(!isAllWatching)}
          disabled={isProcessing}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition disabled:opacity-50',
            isAllWatching
              ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-purple-400 hover:bg-slate-800'
          )}
          title={isAllWatching ? 'Parar de acompanhar todas' : 'Acompanhar todas'}
        >
          <Eye className={cn('w-3.5 h-3.5', isAllWatching ? 'text-purple-400' : 'text-slate-400')} />
          <span className="hidden sm:inline">
            {isAllWatching ? 'Parar Acompanhar' : 'Acompanhar'}
          </span>
        </button>

        {/* Deep Dive */}
        <button
          onClick={() => onBulkDeepDive()}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-orange-400 hover:bg-slate-800 transition disabled:opacity-50"
          title="Adicionar ao Deep Dive"
        >
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline">Deep Dive</span>
        </button>

        {/* Raspar Dados (Enriquecimento) */}
        {onBulkScrape && (
          <button
            onClick={() => onBulkScrape()}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
            title="Executar raspagem e enriquecimento nas ofertas selecionadas"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Raspar Dados</span>
          </button>
        )}

        {/* Alterar Status (Dropdown Único) */}
        <div className="relative" ref={statusMenuRef}>
          <button
            onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
            title="Alterar Status de Pesquisa"
          >
            <span>Alterar status</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isStatusMenuOpen && (
            <div className="absolute bottom-11 left-0 z-50 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 block">
                Novo Status
              </span>
              {statusOptions.map((opt) => {
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setIsStatusMenuOpen(false);
                      onBulkChangeStatus(opt.key);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:bg-slate-800 hover:text-white transition"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-slate-400" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Arquivar */}
        <button
          onClick={() => onBulkArchive()}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition disabled:opacity-50"
          title="Arquivar ofertas selecionadas"
        >
          <Archive className="w-3.5 h-3.5 text-slate-400" />
          <span>Arquivar</span>
        </button>

        {/* Excluir (Destaque Vermelho) */}
        <button
          onClick={onBulkDelete}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
          title="Excluir ofertas selecionadas"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Excluir</span>
        </button>
      </div>

      {/* 3. Close Button (Clear Selection) */}
      <button
        onClick={onClearSelection}
        disabled={isProcessing}
        className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition ml-1 disabled:opacity-50"
        title="Desmarcar todas"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Processing overlay indicator */}
      {isProcessing && (
        <div className="absolute inset-0 bg-slate-900/80 rounded-2xl flex items-center justify-center gap-2 backdrop-blur-xs text-xs font-semibold text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Executando...</span>
        </div>
      )}
    </div>
  );
}
