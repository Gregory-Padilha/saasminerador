'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Layers,
  UploadCloud,
  Sparkles,
  Columns,
  PieChart,
  Star,
  Eye,
  Flame,
  Settings,
  ArrowRight,
  X,
  Compass,
} from 'lucide-react';
import { dbService } from '@/lib/supabase/db';
import { Offer } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { APP_ROUTES } from '@/lib/routes';

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [offers, setOffers] = useState<Offer[]>([]);

  // Load offers on open
  useEffect(() => {
    if (isOpen) {
      dbService.getOffers().then(setOffers);
    }
  }, [isOpen]);

  // Global keydown listener for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectRoute = useCallback(
    (href: string) => {
      setIsOpen(false);
      setQuery('');
      router.push(href);
    },
    [router]
  );

  if (!isOpen) return null;

  const quickNav = [
    { name: 'Dashboard', href: APP_ROUTES.dashboard, icon: LayoutDashboard, category: 'Navegação' },
    { name: 'Banco de Ofertas (Explorer)', href: '/offers', icon: Layers, category: 'Navegação' },
    { name: 'Importar Nova Mineração', href: '/imports', icon: UploadCloud, category: 'Ações' },
    { name: 'Radar de Oportunidades', href: '/opportunities', icon: Sparkles, category: 'Inteligência' },
    { name: 'Comparador de Ofertas', href: '/compare', icon: Columns, category: 'Inteligência' },
    { name: 'Inteligência por Nichos', href: '/niches', icon: PieChart, category: 'Inteligência' },
    { name: 'Ofertas Favoritas', href: '/favorites', icon: Star, category: 'Pesquisa' },
    { name: 'Acompanhando (Watchlist)', href: '/watchlist', icon: Eye, category: 'Pesquisa' },
    { name: 'Esteira Deep Dives', href: '/deep-dives', icon: Flame, category: 'Pesquisa' },
    { name: 'Configurações de Validação', href: '/settings', icon: Settings, category: 'Sistema' },
  ];

  const filteredNav = quickNav.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  const matchedOffers = query.trim()
    ? offers
        .filter(
          (o) =>
            o.product_name.toLowerCase().includes(query.toLowerCase()) ||
            (o.advertiser || '').toLowerCase().includes(query.toLowerCase()) ||
            (o.niche || '').toLowerCase().includes(query.toLowerCase()) ||
            (o.headline || '').toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 6)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
          <Search className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite para buscar ofertas, nichos, anunciantes ou páginas..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {/* Matched Offers */}
          {matchedOffers.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 block">
                Ofertas Encontradas ({matchedOffers.length})
              </span>
              <div className="space-y-1">
                {matchedOffers.map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => handleSelectRoute(`/offers/${offer.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800/80 text-left transition group"
                  >
                    <div className="truncate pr-3">
                      <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition block truncate">
                        {offer.product_name}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate block">
                        {offer.niche || 'Geral'} • {offer.advertiser || 'Anunciante'} • {formatCurrency(offer.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono font-semibold border border-blue-500/20">
                        {offer.active_ads_count ?? '—'} ads
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Navigation Items */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 block">
              Comandos & Páginas
            </span>
            <div className="space-y-1">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleSelectRoute(item.href)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/80 text-left transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{item.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Use ↑ ↓ para navegar e ↵ para selecionar</span>
          <span>OFFER MINER Intelligence</span>
        </div>
      </div>
    </div>
  );
}
