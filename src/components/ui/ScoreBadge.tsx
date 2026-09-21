'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Offer, DiscoveryScoreBreakdown, OfferTrend } from '@/types';
import { calculateDiscoveryScore } from '@/lib/scoring';
import {
  Sparkles,
  Zap,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';

interface ScoreBadgeProps {
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  offer?: Partial<Offer>;
  showExplanation?: boolean;
  showLabel?: boolean;
  discoveryScore?: number | null;
  momentumScore?: number | null;
}

export function WorkScoreBadge({ score, size = 'sm', className }: ScoreBadgeProps) {
  if (score === null || score === undefined || isNaN(score)) {
    return <span className="text-slate-500 text-xs font-mono">—</span>;
  }

  const isHigh = score >= 8.0;
  const isMid = score >= 6.0 && score < 8.0;

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold font-mono tabular-numbers rounded border',
        isHigh
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : isMid
          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
          : 'bg-slate-800/80 text-slate-300 border-slate-700/50',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        className
      )}
      title={`Nota do Work: ${score.toFixed(1)}/10 (Avaliação inicial subjetiva do minerador)`}
    >
      {score.toFixed(1)}
    </span>
  );
}

export function DiscoveryScoreBadge({
  score,
  offer,
  size = 'sm',
  showLabel = false,
  className,
}: ScoreBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const breakdown: DiscoveryScoreBreakdown | null = offer ? calculateDiscoveryScore(offer) : null;
  const finalScore = breakdown ? breakdown.total : (score ?? null);

  if (finalScore === null || isNaN(finalScore)) {
    return <span className="text-slate-500 font-mono text-xs">—</span>;
  }

  const isExceptional = finalScore >= 90;
  const isStrong = finalScore >= 80 && finalScore < 90;
  const isInteresting = finalScore >= 70 && finalScore < 80;
  const isObserving = finalScore >= 60 && finalScore < 70;

  const label = isExceptional
    ? 'EXCEPCIONAL'
    : isStrong
    ? 'FORTE'
    : isInteresting
    ? 'INTERESSANTE'
    : isObserving
    ? 'OBSERVAR'
    : 'BAIXA PRIORIDADE';

  const togglePopover = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      const popoverHeight = 360;
      const margin = 16;

      let left = rect.left;
      if (rect.left + popoverWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.right - popoverWidth);
      }

      let top = rect.bottom + 8;
      if (rect.bottom + popoverHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popoverHeight - 8);
      }

      setCoords({ top, left });
    }

    setIsOpen(!isOpen);
  };

  const popoverContent = isOpen && mounted ? (
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[100]"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        />
        <div
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          className="fixed z-[101] w-72 sm:w-80 p-4 rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100vh-32px)] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                Detalhamento do Discovery Score
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Classificação Final</span>
            <span
              className={cn(
                'font-mono font-bold px-2 py-0.5 rounded text-xs border',
                isExceptional
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : isStrong
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : isInteresting
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              )}
            >
              {finalScore}/100 • {label}
            </span>
          </div>

          {breakdown ? (
            <div className="py-3 space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Composição dos 5 Pilares
              </span>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">1. Anúncios Ativos</span>
                    <span className="font-mono text-cyan-400 font-semibold">{breakdown.adsScore}/30 pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(breakdown.adsScore / 30) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">2. Dias Rodando</span>
                    <span className="font-mono text-cyan-400 font-semibold">{breakdown.daysScore}/25 pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(breakdown.daysScore / 25) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">3. Criativos Distintos</span>
                    <span className="font-mono text-cyan-400 font-semibold">{breakdown.creativesScore}/20 pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(breakdown.creativesScore / 20) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">4. Completude do Dossiê</span>
                    <span className="font-mono text-cyan-400 font-semibold">{breakdown.completenessScore}/15 pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(breakdown.completenessScore / 15) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">5. Nota do Work</span>
                    <span className="font-mono text-cyan-400 font-semibold">{breakdown.workScore}/10 pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(breakdown.workScore / 10) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400 text-[11px]">
              Pontuação Discovery pré-calculada: <strong className="text-white">{finalScore}/100</strong>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 leading-tight">
            💡 <em>O Discovery Score é um algoritmo proprietário do Offer Miner que pondera o potencial objetivo da oferta baseando-se no volume de tráfego, longevidade e estrutura do funil.</em>
          </div>
        </div>
      </>,
      document.body
    )
  ) : null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePopover}
        className={cn(
          'inline-flex items-center gap-1.5 font-bold font-mono tabular-numbers rounded-lg border transition hover:scale-105 active:scale-95 text-left shrink-0',
          isExceptional
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
            : isStrong
            ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
            : isInteresting
            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
            : isObserving
            ? 'bg-slate-800 text-slate-300 border-slate-700'
            : 'bg-slate-850 text-slate-400 border-slate-750',
          size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          className
        )}
        title="Clique para ver o detalhamento dos 5 componentes do Discovery Score"
      >
        <Sparkles className={cn('w-3 h-3 shrink-0', isExceptional ? 'text-amber-400' : 'text-blue-400')} />
        <span>{finalScore}</span>
        <span className="text-[10px] text-slate-400 font-normal">/100</span>
      </button>

      {showLabel && (
        <span
          className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider',
            isExceptional
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : isStrong
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : isInteresting
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          )}
        >
          {label}
        </span>
      )}

      {popoverContent}
    </div>
  );
}

export function OpportunityScoreBadge({
  score,
  discoveryScore,
  momentumScore,
  size = 'sm',
  className,
}: {
  score?: number | null;
  discoveryScore?: number | null;
  momentumScore?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (score === null || score === undefined || isNaN(score)) {
    return (
      <span
        className="inline-flex items-center text-slate-400 text-xs font-mono"
        title="Opportunity Score requer histórico de Momentum (>= 2 capturas)"
      >
        —
      </span>
    );
  }

  const isHot = score >= 85;
  const isGood = score >= 70 && score < 85;

  const togglePopover = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 300;
      const popoverHeight = 240;
      const margin = 16;

      let left = rect.left;
      if (rect.left + popoverWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.right - popoverWidth);
      }

      let top = rect.bottom + 8;
      if (rect.bottom + popoverHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popoverHeight - 8);
      }

      setCoords({ top, left });
    }

    setIsOpen(!isOpen);
  };

  const popoverContent = isOpen && mounted ? (
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[100]"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        />
        <div
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          className="fixed z-[101] w-72 p-4 rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100vh-32px)] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              Fórmula Opportunity Score
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-3 space-y-2 font-sans">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Discovery Score (70%)</span>
              <span className="font-mono text-white font-semibold">
                {discoveryScore ?? '—'} × 0.70 = {discoveryScore ? (discoveryScore * 0.7).toFixed(1) : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Momentum Score (30%)</span>
              <span className="font-mono text-white font-semibold">
                {momentumScore ?? '—'} × 0.30 = {momentumScore ? (momentumScore * 0.3).toFixed(1) : '—'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
              <span className="text-white">OPPORTUNITY SCORE</span>
              <span className="font-mono text-base text-blue-400">{score}/100</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-800/60 leading-tight">
            * Combinação ponderada de qualidade de entrada e velocidade de tração observada.
          </p>
        </div>
      </>,
      document.body
    )
  ) : null;

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePopover}
        className={cn(
          'inline-flex items-center gap-1 font-bold font-mono tabular-numbers rounded-md border transition hover:scale-105 active:scale-95 shrink-0',
          isHot
            ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-300 border-blue-500/40 shadow-sm'
            : isGood
            ? 'bg-slate-800 text-cyan-300 border-slate-700'
            : 'bg-slate-850 text-slate-400 border-slate-750',
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
          className
        )}
        title="Clique para ver a fórmula do Opportunity Score (Discovery 70% + Momentum 30%)"
      >
        <Sparkles className={cn('w-3 h-3', isHot ? 'text-amber-400' : 'text-slate-400')} />
        <span>{score}</span>
        <span className="text-[10px] text-slate-400 font-normal">/100</span>
      </button>

      {popoverContent}
    </div>
  );
}
