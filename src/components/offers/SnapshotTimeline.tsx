'use client';

import React from 'react';
import { OfferSnapshot } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, History, Calendar, Layers } from 'lucide-react';

interface SnapshotTimelineProps {
  snapshots?: OfferSnapshot[];
  currentAds?: number | null;
  currentDays?: number | null;
  currentPrice?: number | null;
}

export function SnapshotTimeline({
  snapshots = [],
  currentAds,
  currentDays,
  currentPrice,
}: SnapshotTimelineProps) {
  if (snapshots.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
        <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-300 font-medium">
          Primeira captura registrada
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Ao reimportar novas minerações contendo esta oferta, o histórico de evolução dos anúncios será exibido aqui.
        </p>
      </div>
    );
  }

  // Sort chronological for progression analysis
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">
            Evolução Histórica da Oferta ({sorted.length} capturas)
          </h3>
        </div>
      </div>

      {/* Visual Timeline Cards */}
      <div className="relative pl-6 border-l-2 border-slate-800 space-y-4 my-3">
        {sorted.map((snap, index) => {
          const prevSnap = index > 0 ? sorted[index - 1] : null;
          const adsDiff =
            prevSnap &&
            snap.active_ads_count !== null &&
            snap.active_ads_count !== undefined &&
            prevSnap.active_ads_count !== null &&
            prevSnap.active_ads_count !== undefined
              ? snap.active_ads_count - prevSnap.active_ads_count
              : null;

          return (
            <div key={snap.id} className="relative group">
              {/* Timeline dot */}
              <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-blue-500 group-hover:scale-125 transition-transform" />

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">
                      Captura: {formatDate(snap.captured_at)}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span>{snap.days_running ?? '—'} dias rodando</span>
                      <span>•</span>
                      <span>{formatCurrency(snap.price)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-sm font-bold text-white tabular-numbers">
                      {snap.active_ads_count ?? '—'} ads
                    </span>
                  </div>

                  {adsDiff !== null && adsDiff !== 0 && (
                    <div
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${
                        adsDiff > 0
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {adsDiff > 0 ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+{adsDiff}</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>{adsDiff}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
