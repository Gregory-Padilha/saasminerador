'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { dbService } from '@/lib/supabase/db';
import { Offer } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, FacelessBadge } from '@/components/ui/StatusBadge';
import { TrendBadge } from '@/components/ui/TrendBadge';
import { DossierCompletenessBadge } from '@/components/ui/DossierCompletenessBadge';
import { formatCurrency } from '@/lib/utils';
import {
  Compass,
  Layers,
  ArrowRight,
  ExternalLink,
  Users,
  Tag,
  DollarSign,
  Package,
} from 'lucide-react';

interface NicheStats {
  niche: string;
  offerCount: number;
  avgPrice: number;
  avgAds: number;
  avgDays: number;
  topProductTypes: { type: string; count: number }[];
  topFormats: { format: string; count: number }[];
  topAdvertisers: { name: string; count: number }[];
  priceRanges: { range: string; count: number }[];
  offers: Offer[];
}

function NichesContent() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNicheName, setSelectedNicheName] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getOffers();
      setOffers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Group by Niche and compute factual market metrics
  const nicheIntelligenceList: NicheStats[] = useMemo(() => {
    const map: Record<string, Offer[]> = {};

    offers.forEach((o) => {
      const niche = o.niche || 'Outros';
      if (!map[niche]) map[niche] = [];
      map[niche].push(o);
    });

    return Object.entries(map)
      .map(([niche, items]) => {
        const totalCount = items.length;
        const validPriceItems = items.filter((i) => i.price !== null && i.price !== undefined);
        const avgPrice =
          validPriceItems.length > 0
            ? validPriceItems.reduce((acc, i) => acc + (i.price || 0), 0) / validPriceItems.length
            : 0;

        const validAdsItems = items.filter((i) => i.active_ads_count !== null && i.active_ads_count !== undefined);
        const avgAds =
          validAdsItems.length > 0
            ? validAdsItems.reduce((acc, i) => acc + (i.active_ads_count || 0), 0) / validAdsItems.length
            : 0;

        const validDaysItems = items.filter((i) => i.days_running !== null && i.days_running !== undefined);
        const avgDays =
          validDaysItems.length > 0
            ? validDaysItems.reduce((acc, i) => acc + (i.days_running || 0), 0) / validDaysItems.length
            : 0;

        // Product Types distribution
        const typeMap: Record<string, number> = {};
        items.forEach((i) => {
          const t = i.product_type || 'Digital';
          typeMap[t] = (typeMap[t] || 0) + 1;
        });
        const topProductTypes = Object.entries(typeMap)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);

        // Format distribution
        const formatMap: Record<string, number> = {};
        items.forEach((i) => {
          const fmt = i.ad_format || 'Imagem / Vídeo';
          formatMap[fmt] = (formatMap[fmt] || 0) + 1;
        });
        const topFormats = Object.entries(formatMap)
          .map(([format, count]) => ({ format, count }))
          .sort((a, b) => b.count - a.count);

        // Top Advertisers
        const advMap: Record<string, number> = {};
        items.forEach((i) => {
          if (i.advertiser) {
            advMap[i.advertiser] = (advMap[i.advertiser] || 0) + 1;
          }
        });
        const topAdvertisers = Object.entries(advMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Price ranges
        let under20 = 0;
        let p20_35 = 0;
        let p35_50 = 0;
        let over50 = 0;
        items.forEach((i) => {
          const p = i.price ?? 0;
          if (p < 20) under20++;
          else if (p <= 35) p20_35++;
          else if (p <= 50) p35_50++;
          else over50++;
        });

        const priceRanges = [
          { range: 'Até R$ 19,90', count: under20 },
          { range: 'R$ 20 – 35', count: p20_35 },
          { range: 'R$ 35 – 50', count: p35_50 },
          { range: 'Acima de R$ 50', count: over50 },
        ].filter((r) => r.count > 0);

        // Sort offers by active ads or most recent
        const sortedOffers = [...items].sort(
          (a, b) => (b.active_ads_count ?? 0) - (a.active_ads_count ?? 0)
        );

        return {
          niche,
          offerCount: totalCount,
          avgPrice,
          avgAds,
          avgDays,
          topProductTypes,
          topFormats,
          topAdvertisers,
          priceRanges,
          offers: sortedOffers,
        };
      })
      .sort((a, b) => b.offerCount - a.offerCount);
  }, [offers]);

  // Set default selected niche on first load
  useEffect(() => {
    if (nicheIntelligenceList.length > 0 && !selectedNicheName) {
      setSelectedNicheName(nicheIntelligenceList[0].niche);
    }
  }, [nicheIntelligenceList, selectedNicheName]);

  const activeNiche =
    nicheIntelligenceList.find((n) => n.niche === selectedNicheName) ||
    nicheIntelligenceList[0];

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        <PageHeader
          title="Inteligência de Mercado por Nicho"
          description="Estatísticas factuais agregadas por nicho: volume de ofertas mineradas, preço médio, densidade média de anúncios, dias no ar e anunciantes ativos."
          badge={
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              Niche Intelligence
            </span>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : nicheIntelligenceList.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400">Nenhum nicho catalogado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: List of Niches (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nichos Minerados ({nicheIntelligenceList.length})
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {offers.length} Ofertas Totais
                </span>
              </div>

              <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
                {nicheIntelligenceList.map((item) => {
                  const isSelected = activeNiche?.niche === item.niche;
                  return (
                    <button
                      key={item.niche}
                      type="button"
                      onClick={() => setSelectedNicheName(item.niche)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-slate-850 border-blue-500/60 shadow-lg ring-1 ring-blue-500/30'
                          : 'bg-slate-900/90 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white truncate max-w-[200px]">
                          {item.niche}
                        </h4>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {item.offerCount} ofertas
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Preço Médio</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {formatCurrency(item.avgPrice)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Média Ads</span>
                          <span className="font-mono font-bold text-white">
                            {Math.round(item.avgAds)} ads
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Média Dias</span>
                          <span className="font-mono font-bold text-slate-300">
                            {Math.round(item.avgDays)}d
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right side: Detailed Niche Intelligence Workspace (7 cols) */}
            {activeNiche && (
              <div className="lg:col-span-7 space-y-6">
                {/* Header of Active Niche */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                      Panorama de Mercado
                    </span>
                    <h2 className="text-xl font-black text-white mt-0.5">
                      {activeNiche.niche}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Base composta por {activeNiche.offerCount} ofertas mineradas
                    </p>
                  </div>

                  <Link
                    href={`/offers?niche=${encodeURIComponent(activeNiche.niche)}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    Ver todas no Explorer
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Preço Médio
                    </span>
                    <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                      {formatCurrency(activeNiche.avgPrice)}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Ticket no front-end</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Média Ads Ativos
                    </span>
                    <span className="text-xl font-black text-white font-mono mt-1 block">
                      {Math.round(activeNiche.avgAds)}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Volume de criativos</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Média Dias no Ar
                    </span>
                    <span className="text-xl font-black text-slate-200 font-mono mt-1 block">
                      {Math.round(activeNiche.avgDays)}d
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Longevidade das campanhas</span>
                  </div>
                </div>

                {/* Tipos de Produto & Faixas de Preço */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tipos de Produto */}
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-400" />
                      Tipos de Produto
                    </h3>
                    <div className="space-y-2">
                      {activeNiche.topProductTypes.map((t) => (
                        <div key={t.type} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{t.type}</span>
                          <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {t.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Faixas de Preço */}
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      Faixas de Preço
                    </h3>
                    <div className="space-y-2">
                      {activeNiche.priceRanges.map((r) => (
                        <div key={r.range} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{r.range}</span>
                          <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {r.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top Anunciantes no Nicho */}
                {activeNiche.topAdvertisers.length > 0 && (
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      Anunciantes Ativos ({activeNiche.niche})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeNiche.topAdvertisers.map((adv) => (
                        <div
                          key={adv.name}
                          className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-200 truncate mr-2">{adv.name}</span>
                          <span className="font-mono text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-[11px] shrink-0">
                            {adv.count} ofertas
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ofertas no Nicho */}
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Ofertas Catalogadas ({activeNiche.niche})
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {activeNiche.offers.slice(0, 6).map((o, idx) => (
                      <div
                        key={o.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                            #{idx + 1}
                          </span>
                          <div>
                            <Link
                              href={`/offers/${o.id}`}
                              className="font-bold text-white hover:text-blue-400 transition-colors block"
                            >
                              {o.product_name}
                            </Link>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="font-mono text-emerald-400 font-bold">
                                {formatCurrency(o.price)}
                              </span>
                              <span>•</span>
                              <span>{o.active_ads_count !== null && o.active_ads_count !== undefined ? `${o.active_ads_count} ads` : '—'}</span>
                              <span>•</span>
                              <span>{o.days_running !== null && o.days_running !== undefined ? `${o.days_running}d` : '—'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <DossierCompletenessBadge offer={o} size="sm" />
                          <Link
                            href={`/offers/${o.id}`}
                            className="p-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/20"
                            title="Abrir Dossiê"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function NichesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando inteligência por nicho...</div>}>
      <NichesContent />
    </Suspense>
  );
}
