import React from 'react';
import { OfferTrend, OfferDecision } from '@/types';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TrendBadge({
  trend,
  growthPct,
  size = 'sm',
  className,
}: {
  trend?: OfferTrend;
  growthPct?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const isSm = size === 'sm';

  switch (trend) {
    case 'AUMENTANDO':
    case 'CRESCENDO_FORTE':
    case 'CRESCENDO':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 font-semibold rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
            isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
            className
          )}
          title="Aumento no volume de anúncios ativos entre capturas"
        >
          <TrendingUp className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>Ads aumentando {growthPct ? `(+${growthPct}%)` : ''}</span>
        </span>
      );

    case 'DIMINUINDO':
    case 'CAINDO':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 font-medium rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30',
            isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
            className
          )}
          title="Redução no volume de anúncios ativos entre capturas"
        >
          <TrendingDown className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>Ads diminuindo {growthPct ? `(${growthPct}%)` : ''}</span>
        </span>
      );

    case 'ESTAVEL':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 font-medium rounded-md bg-slate-800 text-slate-300 border border-slate-700/60',
            isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
            className
          )}
          title="Volume estável de anúncios ativos entre capturas"
        >
          <Minus className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>Ads estáveis</span>
        </span>
      );

    case 'SEM_HISTORICO':
    case 'NOVO':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 font-medium rounded-md bg-slate-900 text-slate-400 border border-slate-800',
            isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
            className
          )}
          title="Aguardando nova captura para comparar volume"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span>Sem histórico suficiente</span>
        </span>
      );
  }
}

export function DecisionBadge({
  decision,
  size = 'sm',
  className,
}: {
  decision?: OfferDecision;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (!decision) return null;

  const isSm = size === 'sm';

  const styles: Record<OfferDecision, string> = {
    Modelar: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Testar: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    'Deep Dive': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    Interessante: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    Observar: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    Ignorar: 'bg-slate-800 text-slate-400 border-slate-700',
    Arquivada: 'bg-slate-900 text-slate-500 border-slate-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-md border tracking-wide uppercase',
        styles[decision] || 'bg-slate-800 text-slate-300 border-slate-700',
        isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      {decision}
    </span>
  );
}
