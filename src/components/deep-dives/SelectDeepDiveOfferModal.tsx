'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Offer, DeepDive } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { getOfferScaleTier } from '@/lib/scale-tier';
import { formatCurrency } from '@/lib/utils';
import {
  Search,
  X,
  Flame,
  Globe,
  ShoppingCart,
  CheckCircle2,
  Plus,
  Bookmark,
  Layers,
  Sparkles,
  Star,
  Check,
} from 'lucide-react';

interface SelectDeepDiveOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOffer: (offerId: string, priority: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA') => Promise<void>;
  existingDeepDives: DeepDive[];
}

export function SelectDeepDiveOfferModal({
  isOpen,
  onClose,
  onSelectOffer,
  existingDeepDives,
}: SelectDeepDiveOfferModalProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScaleFilter, setSelectedScaleFilter] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA'>('MEDIA');
  const [submittingOfferId, setSubmittingOfferId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      dbService.getOffers().then((data) => {
        setOffers(data);
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  const existingOfferIds = useMemo(() => {
    return new Set(existingDeepDives.map((d) => d.offer_id));
  }, [existingDeepDives]);

  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = o.product_name?.toLowerCase().includes(q);
        const matchesAdvertiser = o.advertiser?.toLowerCase().includes(q);
        const matchesNiche = o.niche?.toLowerCase().includes(q);
        if (!matchesName && !matchesAdvertiser && !matchesNiche) return false;
      }

      if (selectedScaleFilter !== 'all') {
        const tier = getOfferScaleTier(o.active_ads_count).tier;
        if (selectedScaleFilter === 'FULL_SCALE' && tier !== 'FULL_SCALE') return false;
        if (selectedScaleFilter === 'HIGH_SCALE' && tier !== 'HIGH_SCALE') return false;
        if (selectedScaleFilter === 'SCALING' && tier !== 'SCALING') return false;
        if (selectedScaleFilter === 'with_lp' && !o.landing_page_url) return false;
        if (selectedScaleFilter === 'with_checkout' && !o.checkout_url) return false;
        if (selectedScaleFilter === 'favorites' && !o.favorite) return false;
      }

      return true;
    });
  }, [offers, searchQuery, selectedScaleFilter]);

  if (!isOpen) return null;

  const handleSelect = async (offerId: string) => {
    if (existingOfferIds.has(offerId)) return;
    setSubmittingOfferId(offerId);
    try {
      await onSelectOffer(offerId, selectedPriority);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingOfferId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Adicionar Oferta à Oficina</h3>
              <p className="text-xs text-slate-400">
                Selecione uma oferta cadastrada para iniciar a bancada de investigação estratégica.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Priority Selection */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por oferta, anunciante ou nicho..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Quick Preset Badges */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'FULL_SCALE', label: '🔥 Full Escala' },
                { id: 'HIGH_SCALE', label: '🔴 Escala Alta' },
                { id: 'SCALING', label: '🟡 Em Escala' },
                { id: 'with_lp', label: '🌐 Com LP' },
                { id: 'with_checkout', label: '💳 Com Checkout' },
                { id: 'favorites', label: '⭐ Favoritas' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedScaleFilter(filter.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    selectedScaleFilter === filter.id
                      ? 'bg-orange-500 text-white font-bold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Selection */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <span className="text-xs font-semibold text-slate-300">
              Prioridade da Investigação:
            </span>
            <div className="flex items-center gap-1.5">
              {(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPriority(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    selectedPriority === p
                      ? p === 'CRITICA'
                        ? 'bg-red-500 text-white'
                        : p === 'ALTA'
                        ? 'bg-orange-500 text-white'
                        : p === 'MEDIA'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List of Offers */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando ofertas catalogadas...
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="py-16 text-center text-slate-500 italic">
              Nenhuma oferta encontrada para estes critérios.
            </div>
          ) : (
            filteredOffers.map((o) => {
              const isAlreadyIn = existingOfferIds.has(o.id);
              const tier = getOfferScaleTier(o.active_ads_count).tier;

              return (
                <div
                  key={o.id}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-4 ${
                    isAlreadyIn
                      ? 'bg-slate-950/40 border-slate-850 opacity-60'
                      : 'bg-slate-950 hover:bg-slate-850 border-slate-800 hover:border-orange-500/40'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-white truncate">
                        {o.product_name}
                      </span>
                      {tier === 'FULL_SCALE' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          🔥 FULL ESCALA
                        </span>
                      )}
                      {tier === 'HIGH_SCALE' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          🔴 ESCALA ALTA
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap font-mono">
                      <span>Anunciante: <strong className="text-slate-200">{o.advertiser || '—'}</strong></span>
                      <span>•</span>
                      <span>Nicho: <strong className="text-slate-200">{o.niche || 'Geral'}</strong></span>
                      <span>•</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(o.price)}</span>
                      <span>•</span>
                      <span className="text-white font-bold">{o.active_ads_count ?? '—'} ads</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isAlreadyIn ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Já na Oficina
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSelect(o.id)}
                        disabled={submittingOfferId === o.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        {submittingOfferId === o.id ? 'Adicionando...' : 'Estudar Oferta'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
