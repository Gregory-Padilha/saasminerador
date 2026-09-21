'use client';

import React, { useState } from 'react';
import { Offer } from '@/types';
import { calculateDiscoveryScore } from '@/lib/scoring';
import { formatCurrency } from '@/lib/utils';
import {
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhyThisOfferProps {
  offer: Offer;
  className?: string;
}

export function WhyThisOfferButton({ offer, className }: WhyThisOfferProps) {
  const [isOpen, setIsOpen] = useState(false);
  const breakdown = calculateDiscoveryScore(offer);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 text-[11px] font-semibold border border-blue-500/20 transition active:scale-95',
          className
        )}
        title="Ver por que esta oferta se destaca"
      >
        <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
        <span>Por que esta oferta?</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Por que esta oferta?</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                    {offer.product_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400">Classificação Discovery</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-300 font-mono">
                    {breakdown.priorityLabel}
                  </span>
                  <span className="text-base font-bold font-mono text-white">
                    {breakdown.total}/100
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Ads */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {offer.active_ads_count ?? '—'} anúncios ativos na Meta
                      </div>
                      <div className="text-[11px] text-slate-400">{breakdown.explanation.ads}</div>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold ml-2">
                      +{breakdown.adsScore} pts
                    </span>
                  </div>
                </div>

                {/* 2. Days */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {offer.days_running ?? '—'} dias rodando continuamente
                      </div>
                      <div className="text-[11px] text-slate-400">{breakdown.explanation.days}</div>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold ml-2">
                      +{breakdown.daysScore} pts
                    </span>
                  </div>
                </div>

                {/* 3. Creatives */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {offer.estimated_unique_creatives ?? '—'} criativos distintos estimados
                      </div>
                      <div className="text-[11px] text-slate-400">{breakdown.explanation.creatives}</div>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold ml-2">
                      +{breakdown.creativesScore} pts
                    </span>
                  </div>
                </div>

                {/* 4. Completeness */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        Dados {breakdown.completenessPercentage}% completos ({breakdown.completedFieldsCount}/15 campos)
                      </div>
                      <div className="text-[11px] text-slate-400">{breakdown.explanation.completeness}</div>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold ml-2">
                      +{breakdown.completenessScore} pts
                    </span>
                  </div>
                </div>

                {/* 5. Work Score */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        Nota do Minerador Work: {breakdown.rawWorkScore !== null ? `${breakdown.rawWorkScore.toFixed(1)}/10` : '—'}
                      </div>
                      <div className="text-[11px] text-slate-400">{breakdown.explanation.work}</div>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold ml-2">
                      +{breakdown.workScore} pts
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 italic pt-3 border-t border-slate-800 leading-normal">
                * Este checklist é calculado de forma puramente objetiva e observacional a partir dos sinais coletados. Não representa garantia de faturamento ou ROI.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
