'use client';

import React from 'react';
import Link from 'next/link';
import { DeepDive, DeepDiveStatus, DeepDivePriority } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getOfferScaleTier } from '@/lib/scale-tier';
import { calculateDossierCompleteness } from '@/lib/dossier';
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Globe,
  ShoppingCart,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  Clock,
  ChevronDown,
  Flame,
  FileText,
  DollarSign,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';

interface WorkbenchHeaderProps {
  deepDive: DeepDive;
  onUpdateStatus: (status: DeepDiveStatus) => Promise<void>;
  onUpdatePriority: (priority: DeepDivePriority) => Promise<void>;
  isSaving?: boolean;
}

export function WorkbenchHeader({
  deepDive,
  onUpdateStatus,
  onUpdatePriority,
  isSaving,
}: WorkbenchHeaderProps) {
  const offer = deepDive.offer;
  if (!offer) return null;

  const dossierComp = calculateDossierCompleteness(offer);
  const investigationPct = deepDive.investigation_progress ?? 0;
  const tier = getOfferScaleTier(offer.active_ads_count).tier;

  const startSnap = deepDive.start_snapshot;
  const currentAds = offer.active_ads_count;
  const startAds = startSnap?.active_ads_count;

  return (
    <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link
            href="/deep-dives"
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            title="Voltar para Oficina"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Bancada de Investigação
          </span>

          {isSaving !== undefined && (
            <span className="text-xs font-mono font-medium transition text-slate-400 flex items-center gap-1">
              {isSaving ? (
                <>
                  <RotateCcw className="w-3 h-3 animate-spin text-amber-400" />
                  <span className="text-amber-400">Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Salvo ✓</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/offers/${offer.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-xs font-semibold transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Abrir Dossiê
          </Link>

          {offer.landing_page_url && (
            <a
              href={offer.landing_page_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              Landing Page
            </a>
          )}

          {offer.checkout_url && (
            <a
              href={offer.checkout_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Checkout
            </a>
          )}

          <Link
            href={`/compare?offers=${offer.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            Comparar
          </Link>

          {offer.meta_ads_url && (
            <a
              href={offer.meta_ads_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              Meta Ads
            </a>
          )}
        </div>
      </div>

      {/* Main Title & Status Control Row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            {tier === 'FULL_SCALE' && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                🔥 FULL ESCALA
              </span>
            )}
            {tier === 'HIGH_SCALE' && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                🔴 ESCALA ALTA
              </span>
            )}

            <span className="text-xs font-semibold text-blue-400">
              {offer.niche || 'Geral'} {offer.subniche ? `› ${offer.subniche}` : ''}
            </span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            {offer.product_name}
          </h1>

          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap font-mono">
            {offer.advertiser && (
              <span>
                Anunciante: <strong className="text-slate-200">{offer.advertiser}</strong>
              </span>
            )}
            <span>•</span>
            <span>Tipo: <strong className="text-slate-200">{offer.product_type || 'Digital'}</strong></span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">{formatCurrency(offer.price)}</span>
          </div>
        </div>

        {/* Pipeline & Priority Dropdowns */}
        <div className="flex items-center gap-3 flex-wrap bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Estágio na Oficina
            </label>
            <select
              value={deepDive.status}
              onChange={(e) => onUpdateStatus(e.target.value as DeepDiveStatus)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-orange-500"
            >
              <option value="BACKLOG">📋 1. NA FILA</option>
              <option value="EM_ANALISE">🧪 2. NA BANCADA</option>
              <option value="SINTETIZANDO">🔬 3. SINTETIZANDO</option>
              <option value="CONCLUIDO">✅ 4. CONCLUÍDO (CASE)</option>
              <option value="ARQUIVADO">📦 5. ARQUIVADO</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Prioridade Estudo
            </label>
            <select
              value={deepDive.priority}
              onChange={(e) => onUpdatePriority(e.target.value as DeepDivePriority)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-orange-500"
            >
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </div>
        </div>
      </div>

      {/* Snapshot Bar & Dual Progress Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
        {/* Snapshot evolution */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Snapshot Inicial ({startSnap?.captured_at ? formatDate(startSnap.captured_at) : 'Início'})
            </span>
            <span className="text-xs font-mono font-bold text-slate-200 block mt-0.5">
              {startAds !== undefined && startAds !== null ? `${startAds} ads` : 'Não registrado'}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Momento Atual
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 block mt-0.5">
              {currentAds !== undefined && currentAds !== null ? `${currentAds} ads` : '—'}
            </span>
          </div>
        </div>

        {/* Dossier Data % */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Dados Coletados (Dossiê)
            </span>
            <span className="font-mono font-bold text-blue-400">{dossierComp.percentage}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${dossierComp.percentage}%` }}
            />
          </div>
        </div>

        {/* Investigation Checklist % */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Progresso Investigação
            </span>
            <span className="font-mono font-bold text-orange-400">{investigationPct}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-orange-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${investigationPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
