'use client';

import React, { useState } from 'react';
import { Offer, OfferSnapshot } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';
import { TrendBadge } from '@/components/ui/TrendBadge';
import {
  TrendingUp,
  Clock,
  Plus,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Info,
} from 'lucide-react';

interface TabHistoryProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

export function TabHistory({ offer, onOfferUpdated }: TabHistoryProps) {
  const [snapshots, setSnapshots] = useState<OfferSnapshot[]>(offer.snapshots || []);
  const [isAddingSnapshot, setIsAddingSnapshot] = useState(false);
  const [newAdsCount, setNewAdsCount] = useState(offer.active_ads_count || 10);
  const [newPrice, setNewPrice] = useState(offer.price || 27.9);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const snap = await dbService.addSnapshot(offer.id, Number(newAdsCount), Number(newPrice));
      const updatedList = [snap, ...snapshots];
      setSnapshots(updatedList);

      const refreshed = await dbService.getOfferById(offer.id);
      if (refreshed) {
        onOfferUpdated(refreshed);
      }
      setIsAddingSnapshot(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Sort chronological for chart
  const sortedSnaps = [...snapshots].sort(
    (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
  );

  // Variation computation
  const latestAds = offer.active_ads_count ?? 0;
  const previousSnap = sortedSnaps.length >= 2 ? sortedSnaps[sortedSnaps.length - 2] : null;
  const prevAds = previousSnap?.active_ads_count ?? null;

  let deltaAds: number | null = null;
  let deltaPct: number | null = null;
  if (prevAds !== null && prevAds > 0) {
    deltaAds = latestAds - prevAds;
    deltaPct = Math.round(((latestAds - prevAds) / prevAds) * 100);
  }

  // Chart bounds
  const maxAdsVal = Math.max(...sortedSnaps.map((s) => s.active_ads_count || 0), latestAds, 10);
  const chartHeight = 160;

  return (
    <div className="space-y-6">
      {/* Top Strip: Key Evolution Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Current Ads & Trend */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Captura Atual
            </span>
            <TrendBadge trend={offer.trend} />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {latestAds} <span className="text-xs font-normal text-slate-400 font-sans">anúncios</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Última leitura: {formatDate(offer.last_seen_at || offer.last_imported_at || offer.created_at)}
          </div>
        </div>

        {/* Metric 2: Previous Capture */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Captura Anterior
          </span>
          <div className="text-2xl font-black text-slate-300 font-mono mt-2">
            {prevAds !== null ? `${prevAds} ads` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {previousSnap ? `Em ${formatDate(previousSnap.captured_at)}` : 'Sem snapshot anterior'}
          </div>
        </div>

        {/* Metric 3: Delta Variation */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Variação Recente
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            {deltaAds !== null ? (
              <>
                <span
                  className={`text-2xl font-black font-mono flex items-center ${
                    deltaAds > 0
                      ? 'text-emerald-400'
                      : deltaAds < 0
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {deltaAds > 0 ? `+${deltaAds}` : deltaAds}
                </span>
                <span
                  className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                    deltaAds > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : deltaAds < 0
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {deltaPct !== null ? `${deltaPct > 0 ? '+' : ''}${deltaPct}%` : ''}
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-500 font-mono">1ª Captura</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Comparativo entre capturas</div>
        </div>

        {/* Metric 4: Tendência Observada */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Tendência Observada
            </span>
          </div>
          <div className="mt-2">
            <TrendBadge trend={offer.trend} />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {offer.snapshots && offer.snapshots.length >= 2
              ? 'Calculada com base na evolução entre capturas'
              : 'Requer 2 ou mais capturas no histórico'}
          </div>
        </div>
      </div>

      {/* Evolution Chart (SVG) */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Evolução de Anúncios Ativos ao Longo do Tempo
            </h3>
          </div>

          <button
            onClick={() => setIsAddingSnapshot(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar Nova Captura
          </button>
        </div>

        {/* Chart Area */}
        {sortedSnaps.length >= 2 ? (
          <div className="pt-4 pb-2">
            <div className="relative h-44 w-full flex items-end">
              {/* Background horizontal grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-slate-700 w-full" />
                <div className="border-b border-slate-700 w-full" />
                <div className="border-b border-slate-700 w-full" />
                <div className="border-b border-slate-700 w-full" />
              </div>

              {/* Bar/Point columns */}
              <div className="relative z-10 w-full flex items-end justify-between px-4">
                {sortedSnaps.map((snap, i) => {
                  const ads = snap.active_ads_count || 0;
                  const heightPct = Math.max(12, Math.round((ads / maxAdsVal) * 100));
                  return (
                    <div key={snap.id || i} className="flex flex-col items-center group">
                      {/* Tooltip value */}
                      <span className="text-[11px] font-mono font-bold text-slate-300 opacity-80 group-hover:opacity-100 group-hover:text-blue-400 mb-1 transition-all">
                        {ads}
                      </span>
                      {/* Bar */}
                      <div
                        className="w-10 rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400 group-hover:from-blue-500 group-hover:to-cyan-300 transition-all shadow-md"
                        style={{ height: `${(heightPct / 100) * chartHeight}px` }}
                      />
                      {/* Date label */}
                      <span className="text-[10px] font-mono text-slate-400 mt-2">
                        {formatDate(snap.captured_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl bg-slate-950/50 border border-dashed border-slate-800">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-300">1 Captura Registrada</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Quando esta oferta for importada novamente em planilhas futuras ou você registrar uma nova leitura manual, a curva de expansão aparecerá aqui.
            </p>
          </div>
        )}
      </div>

      {/* Manual Snapshot Modal Form */}
      {isAddingSnapshot && (
        <form
          onSubmit={handleAddSnapshot}
          className="p-5 rounded-xl bg-slate-900 border border-blue-500/40 shadow-xl space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Registrar Snapshot Manual
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingSnapshot(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Quantidade de Anúncios Ativos Hoje
              </label>
              <input
                type="number"
                min="0"
                required
                value={newAdsCount}
                onChange={(e) => setNewAdsCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Preço no Checkout Hoje (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingSnapshot(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              {isSaving ? 'Salvando...' : 'Salvar Snapshot'}
            </button>
          </div>
        </form>
      )}

      {/* Snapshot Log Table */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
          Registro Histórico de Capturas ({snapshots.length})
        </h4>

        <div className="space-y-2">
          {snapshots.map((snap, idx) => (
            <div
              key={snap.id || idx}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px] font-bold">
                  #{snapshots.length - idx}
                </span>
                <div>
                  <span className="font-semibold text-white">
                    {snap.active_ads_count ?? '—'} anúncios ativos
                  </span>
                  {snap.price && (
                    <span className="text-slate-400 ml-2 font-mono">
                      ({formatCurrency(snap.price)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                <span>{formatDateTime(snap.captured_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
