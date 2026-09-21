'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Offer, DossierCompleteness } from '@/types';
import { calculateDossierCompleteness } from '@/lib/dossier';
import { cn } from '@/lib/utils';
import { FileCheck, CheckCircle2, Circle, X } from 'lucide-react';

interface DossierCompletenessBadgeProps {
  offer?: Partial<Offer>;
  completeness?: DossierCompleteness;
  size?: 'sm' | 'md';
  className?: string;
}

export function DossierCompletenessBadge({
  offer,
  completeness: propCompleteness,
  size = 'sm',
  className,
}: DossierCompletenessBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const data = propCompleteness || (offer ? calculateDossierCompleteness(offer) : null);

  const togglePopover = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      const popoverHeight = 340;
      const margin = 16;

      // Smart X positioning (flip left if near right edge)
      let left = rect.left;
      if (rect.left + popoverWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.right - popoverWidth);
      }

      // Smart Y positioning (flip top if near bottom edge)
      let top = rect.bottom + 8;
      if (rect.bottom + popoverHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popoverHeight - 8);
      }

      setCoords({ top, left });
    }

    setIsOpen(!isOpen);
  };

  if (!data) return null;

  const isHigh = data.percentage >= 80;
  const isMid = data.percentage >= 50 && data.percentage < 80;

  const popoverContent = isOpen && mounted ? (
    createPortal(
      <>
        {/* Backdrop for click outside */}
        <div
          className="fixed inset-0 z-[100]"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        />

        {/* Floating Portal Popover with Viewport Collision Guard */}
        <div
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          className="fixed z-[101] w-72 sm:w-80 p-4 rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100vh-32px)] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                Completude do Dossiê
              </h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Campos Preenchidos</span>
              <span className="font-mono font-bold text-cyan-400">
                {data.completedCount} de {data.totalCount} ({data.percentage}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${data.percentage}%` }}
              />
            </div>
          </div>

          {/* Fields Breakdown */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {data.filledFields.map((f) => (
              <div key={f} className="flex items-center gap-2 text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{f}</span>
              </div>
            ))}
            {data.missingFields.map((f) => (
              <div key={f} className="flex items-center gap-2 text-[11px] text-slate-500">
                <Circle className="w-3 h-3 shrink-0" />
                <span className="truncate">{f} (ausente)</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 text-[10px] text-slate-400 leading-tight">
            💡 <em>Representa apenas a completude das informações coletadas pelo minerador. Não mede qualidade nem garantia de lucro.</em>
          </div>
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
          'inline-flex items-center gap-1.5 font-mono text-xs font-semibold rounded-lg border transition hover:scale-105 active:scale-95 text-left shrink-0',
          isHigh
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : isMid
            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
            : 'bg-slate-800 text-slate-400 border-slate-700',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          className
        )}
        title="Clique para ver o detalhamento de campos preenchidos no dossiê"
      >
        <FileCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
        <span>Dossiê: {data.percentage}%</span>
        <span className="text-[10px] text-slate-400 font-normal">
          ({data.completedCount}/{data.totalCount})
        </span>
      </button>

      {popoverContent}
    </div>
  );
}
