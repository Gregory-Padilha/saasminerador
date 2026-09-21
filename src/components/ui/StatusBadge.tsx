import React from 'react';
import { OfferStatus, ResearchStatus, OfferPipelineBreakdown } from '@/types';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Eye,
  Archive,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: OfferStatus | string;
  size?: 'sm' | 'md';
  className?: string;
  breakdown?: OfferPipelineBreakdown;
  missingRequirements?: string[];
}

export function StatusBadge({
  status,
  size = 'sm',
  className,
  breakdown,
  missingRequirements,
}: StatusBadgeProps) {
  const isSm = size === 'sm';

  const renderBadgeContent = () => {
    switch (status) {
      case 'ANALYZING':
      case 'ANALISANDO':
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            <Clock className={cn('animate-spin', isSm ? 'w-3 h-3 text-blue-400' : 'w-3.5 h-3.5 text-blue-400')} />
            ANALISANDO...
          </span>
        );

      case 'NOVA':
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            <Sparkles className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            NOVA
          </span>
        );

      case 'DADOS_PARCIAIS':
      case 'REVISAR':
      case 'INVALIDA':
      case 'FORA_DOS_CRITERIOS':
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            <AlertCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            {status === 'FORA_DOS_CRITERIOS' ? 'REVISAR' : 'DADOS PARCIAIS'}
          </span>
        );

      case 'MAPEADA':
      case 'VALIDADA':
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            <CheckCircle2 className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            MAPEADA
          </span>
        );

      case 'ANALISADA':
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            <FileCheck2 className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            ANALISADA
          </span>
        );

      case 'ACOMPANHANDO':
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            <Eye className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            ACOMPANHANDO
          </span>
        );

      case 'ARQUIVADA':
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            <Archive className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            ARQUIVADA
          </span>
        );

      default:
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold rounded-full bg-slate-800/80 text-slate-400 border border-slate-750',
              isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              className
            )}
          >
            {String(status)}
          </span>
        );
    }
  };

  const badgeContent = renderBadgeContent();

  if (!breakdown) {
    return badgeContent;
  }

  return (
    <div className="relative group/badge inline-flex items-center">
      {badgeContent}

      {/* Floating Pipeline Checklist Tooltip */}
      <div className="absolute left-0 top-full mt-1.5 hidden group-hover/badge:flex flex-col z-50 w-64 p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl text-[11px] text-slate-200 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-800 flex items-center justify-between">
          <span>Pipeline de Enriquecimento</span>
          <span className={status === 'MAPEADA' ? 'text-cyan-400 font-bold' : 'text-amber-400 font-semibold'}>
            {status === 'MAPEADA' ? 'MAPEADA ✓' : 'DADOS PARCIAIS'}
          </span>
        </div>

        <div className="space-y-1.5">
          {/* Landing Page */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              {breakdown.landingPage.isMapped ? (
                <span className="text-emerald-400 font-bold">✓</span>
              ) : (
                <span className="text-rose-400 font-bold">✕</span>
              )}
              Landing Page
            </span>
            <span className={breakdown.landingPage.isMapped ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
              {breakdown.landingPage.isMapped ? 'Mapeada' : 'Pendente'}
            </span>
          </div>

          {/* Preço Front */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              {breakdown.landingPage.price !== null ? (
                <span className="text-emerald-400 font-bold">✓</span>
              ) : (
                <span className="text-slate-500 font-bold">—</span>
              )}
              Preço
            </span>
            <span className={breakdown.landingPage.price !== null ? 'text-slate-200 font-semibold tabular-numbers' : 'text-slate-500'}>
              {breakdown.landingPage.price !== null
                ? `R$ ${breakdown.landingPage.price.toFixed(2).replace('.', ',')}`
                : 'Não identificado'}
            </span>
          </div>

          {/* Scale */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              {breakdown.scale.isVerified ? (
                <span className="text-emerald-400 font-bold">✓</span>
              ) : (
                <span className="text-rose-400 font-bold">✕</span>
              )}
              Ads Ativos
            </span>
            <span className={breakdown.scale.isVerified ? 'text-blue-400 font-medium tabular-numbers' : 'text-slate-500'}>
              {breakdown.scale.label}
            </span>
          </div>

          {/* Criativos */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              {breakdown.creatives.isVerified ? (
                <span className="text-emerald-400 font-bold">✓</span>
              ) : (
                <span className="text-rose-400 font-bold">✕</span>
              )}
              Criativos
            </span>
            <span className={breakdown.creatives.isVerified ? 'text-purple-300 font-medium tabular-numbers' : 'text-slate-500'}>
              {breakdown.creatives.label}
            </span>
          </div>

          {/* Checkout */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              {breakdown.checkout.isProcessed ? (
                <span className="text-emerald-400 font-bold">✓</span>
              ) : (
                <span className="text-amber-400 font-bold">✕</span>
              )}
              Checkout
            </span>
            <span className={breakdown.checkout.isProcessed ? 'text-emerald-400 font-medium truncate max-w-[130px]' : 'text-slate-500 truncate max-w-[130px]'}>
              {breakdown.checkout.label}
            </span>
          </div>
        </div>

        {missingRequirements && missingRequirements.length > 0 && status !== 'MAPEADA' && (
          <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-amber-300/90 space-y-0.5">
            <span className="font-semibold block text-amber-400">Pendente para Mapeada:</span>
            {missingRequirements.map((req, idx) => (
              <div key={idx} className="flex items-center gap-1 text-slate-400">
                <span className="text-amber-400">•</span>
                <span>{req}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const ValidationStatusBadge = StatusBadge;

export function FacelessBadge({ faceless, size = 'sm' }: { faceless?: boolean | null; size?: 'sm' | 'md' }) {
  const isSm = size === 'sm';
  if (faceless === true) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-medium rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20',
          isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        )}
      >
        <ShieldCheck className="w-3 h-3" />
        FACELESS
      </span>
    );
  }
  if (faceless === false) {
    return (
      <span
        className={cn(
          'inline-flex items-center font-medium rounded bg-slate-800/60 text-slate-400 border border-slate-700/40',
          isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        )}
      >
        ESPECIALISTA
      </span>
    );
  }
  return <span className="text-slate-500 font-mono text-xs">—</span>;
}
