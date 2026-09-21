'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Offer } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Users,
  ExternalLink,
  Layers,
  ArrowRight,
  Globe,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface TabAdvertiserProps {
  offer: Offer;
}

export function TabAdvertiser({ offer }: TabAdvertiserProps) {
  const [otherOffers, setOtherOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOtherOffers();
  }, [offer.advertiser, offer.id]);

  const loadOtherOffers = async () => {
    if (!offer.advertiser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const all = await dbService.getOffers();
      const matches = all.filter(
        (o) =>
          o.advertiser &&
          o.advertiser.toLowerCase() === offer.advertiser?.toLowerCase() &&
          o.id !== offer.id
      );
      setOtherOffers(matches);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const domain = offer.landing_page_url
    ? (() => {
        try {
          return new URL(offer.landing_page_url).hostname.replace('www.', '');
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Advertiser Profile Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {offer.advertiser || 'Anunciante Não Identificado'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Operação no nicho de <strong className="text-slate-300">{offer.niche || 'Geral'}</strong>
              </p>
            </div>
          </div>

          {offer.meta_ads_url && (
            <a
              href={offer.meta_ads_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver na Meta Ads Library
            </a>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Domínio da Operação
            </span>
            <span className="text-xs font-mono font-bold text-white block truncate">
              {domain || offer.landing_page_domain || '—'}
            </span>
            {domain && (
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-400 hover:underline inline-flex items-center gap-1 mt-1"
              >
                Visitar site
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Primeira Captura
            </span>
            <span className="text-xs font-mono font-bold text-slate-200 block">
              {offer.first_seen_at || offer.oldest_ad_date
                ? formatDate(offer.first_seen_at || offer.oldest_ad_date)
                : '—'}
            </span>
            <span className="text-[10px] text-slate-500">Primeira vez visto no radar</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Última Atividade
            </span>
            <span className="text-xs font-mono font-bold text-slate-200 block">
              {offer.last_seen_at || offer.updated_at
                ? formatDate(offer.last_seen_at || offer.updated_at)
                : '—'}
            </span>
            <span className="text-[10px] text-slate-500">Última atualização registrada</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Ofertas no Banco
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 block">
              {otherOffers.length + 1} produto(s)
            </span>
            <span className="text-[10px] text-slate-500">Total desse anunciante</span>
          </div>
        </div>
      </div>

      {/* Outras Ofertas Desse Anunciante */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Outras Ofertas desse Anunciante no Banco ({otherOffers.length})
            </h3>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : otherOffers.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Nenhuma outra oferta deste mesmo anunciante foi catalogada no banco até o momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {otherOffers.map((o) => (
              <div
                key={o.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <Link
                    href={`/offers/${o.id}`}
                    className="font-bold text-white text-xs block truncate group-hover:text-blue-400 transition-colors"
                  >
                    {o.product_name}
                  </Link>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span className="text-emerald-400 font-mono font-bold">
                      {formatCurrency(o.price)}
                    </span>
                    <span>•</span>
                    <span>{o.active_ads_count ?? '—'} ads</span>
                    <span>•</span>
                    <span>{o.days_running ?? '—'}d</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={o.status} />
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
        )}
      </div>
    </div>
  );
}
