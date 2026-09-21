'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { dbService } from '@/lib/supabase/db';
import { Offer } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { TrendBadge } from '@/components/ui/TrendBadge';
import { DossierCompletenessBadge } from '@/components/ui/DossierCompletenessBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

function WatchlistContent() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getOffers({ onlyWatching: true });
      setOffers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWatchlist = async (offer: Offer) => {
    await dbService.toggleWatchlist(offer.id, true);
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        <PageHeader
          title="Acompanhando — Monitoramento Temporal"
          description="Acompanhe a evolução de volume de anúncios ativos, variações objetivas entre capturas e tendências temporais das ofertas selecionadas."
          badge={
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold border border-cyan-500/20 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              Acompanhamento Ativo
            </span>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
            <Eye className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">Nenhuma oferta em acompanhamento</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Ao pesquisar ou minerar ofertas, clique no ícone de olho (Acompanhar) para adicioná-las a esta lista de monitoramento de evolução.
            </p>
            <Link
              href="/offers"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
            >
              Ver Todas as Ofertas
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {offers.length} Oferta(s) Sendo Acompanhada(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Produto & Anunciante</th>
                    <th className="py-3 px-4 text-center">Preço</th>
                    <th className="py-3 px-4 text-center">Ads Atual</th>
                    <th className="py-3 px-4 text-center">Ads Anterior</th>
                    <th className="py-3 px-4 text-center">Variação</th>
                    <th className="py-3 px-4 text-center">Dias</th>
                    <th className="py-3 px-4 text-center">Tendência</th>
                    <th className="py-3 px-4 text-center">Última Captura</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {offers.map((offer) => {
                    const sortedSnaps = offer.snapshots
                      ? [...offer.snapshots].sort(
                          (a, b) =>
                            new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
                        )
                      : [];
                    const previousSnap =
                      sortedSnaps.length >= 2 ? sortedSnaps[sortedSnaps.length - 2] : null;
                    const prevAds = previousSnap?.active_ads_count ?? null;
                    const currentAds = offer.active_ads_count ?? null;
                    const delta =
                      prevAds !== null && currentAds !== null ? currentAds - prevAds : null;
                    const deltaPct =
                      prevAds !== null && prevAds > 0 && currentAds !== null
                        ? Math.round(((currentAds - prevAds) / prevAds) * 100)
                        : null;

                    return (
                      <tr key={offer.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            href={`/offers/${offer.id}`}
                            className="font-bold text-white hover:text-blue-400 transition-colors block text-sm"
                          >
                            {offer.product_name}
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{offer.advertiser || 'Anunciante não informado'}</span>
                            {offer.niche && (
                              <>
                                <span>•</span>
                                <span className="text-slate-300">{offer.niche}</span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                          {formatCurrency(offer.price)}
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-white">
                          {currentAds !== null ? `${currentAds} ads` : '—'}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-slate-400">
                          {prevAds !== null ? `${prevAds} ads` : '—'}
                        </td>

                        <td className="py-3 px-4 text-center font-mono">
                          {delta !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                delta > 0
                                  ? 'text-emerald-400'
                                  : delta < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                              {deltaPct !== null ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct}%)` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-slate-300">
                          {offer.days_running !== null && offer.days_running !== undefined
                            ? `${offer.days_running}d`
                            : '—'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <TrendBadge trend={offer.trend} size="sm" />
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                          {formatDate(
                            offer.last_seen_at || offer.last_imported_at || offer.created_at
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/offers/${offer.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-semibold border border-blue-500/20 transition-colors"
                            >
                              Dossiê
                              <ArrowRight className="w-3 h-3" />
                            </Link>

                            <button
                              onClick={() => handleToggleWatchlist(offer)}
                              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800"
                              title="Remover de Acompanhamento"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando ofertas em acompanhamento...</div>}>
      <WatchlistContent />
    </Suspense>
  );
}
