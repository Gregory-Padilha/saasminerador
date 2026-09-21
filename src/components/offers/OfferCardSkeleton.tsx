'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CardDensity } from './OfferCard';

interface OfferCardSkeletonProps {
  count?: number;
  density?: CardDensity;
}

export function OfferCardSkeleton({ count = 8, density = 'standard' }: OfferCardSkeletonProps) {
  const isCompact = density === 'compact';
  const isDetailed = density === 'detailed';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col justify-between rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse',
            isCompact ? 'p-3.5 space-y-3' : isDetailed ? 'p-5 space-y-4' : 'p-4 sm:p-4.5 space-y-3.5'
          )}
        >
          {/* Top Bar Skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-800" />
              <div className="w-16 h-5 rounded-full bg-slate-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-slate-800" />
              <div className="w-6 h-6 rounded-lg bg-slate-800" />
              <div className="w-6 h-6 rounded-lg bg-slate-800" />
            </div>
          </div>

          {/* Title & Niche Skeleton */}
          <div className="space-y-2">
            <div className="w-4/5 h-4 rounded bg-slate-800" />
            <div className="w-3/5 h-3.5 rounded bg-slate-800/70" />
            <div className="flex gap-1.5 pt-1">
              <div className="w-14 h-4 rounded-md bg-slate-800" />
              <div className="w-20 h-4 rounded-md bg-slate-800" />
            </div>
          </div>

          {/* Metrics Grid Skeleton */}
          <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-10 rounded-lg bg-slate-800/60" />
            ))}
          </div>

          {/* Secondary info Skeleton */}
          <div className="flex items-center justify-between">
            <div className="w-20 h-4 rounded bg-slate-800" />
            <div className="w-16 h-3 rounded bg-slate-800" />
          </div>

          {/* Footer Skeleton */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <div className="w-20 h-7 rounded-xl bg-slate-800" />
            <div className="flex gap-1">
              <div className="w-7 h-7 rounded-lg bg-slate-800" />
              <div className="w-7 h-7 rounded-lg bg-slate-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
