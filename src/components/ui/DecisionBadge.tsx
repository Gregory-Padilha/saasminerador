'use client';

import React from 'react';
import { OfferDecision } from '@/types';
import {
  Eye,
  Flame,
  Sparkles,
  CheckCircle2,
  XCircle,
  Archive,
  HelpCircle,
  Target,
} from 'lucide-react';

interface DecisionBadgeProps {
  decision?: OfferDecision | null;
  size?: 'sm' | 'md';
}

export function DecisionBadge({ decision, size = 'sm' }: DecisionBadgeProps) {
  if (!decision) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-semibold border ${
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        } bg-slate-900 text-slate-500 border-slate-800`}
      >
        <HelpCircle className="w-3 h-3" />
        Pendente
      </span>
    );
  }

  const configs: Record<
    OfferDecision,
    { label: string; icon: React.ElementType; bg: string; text: string; border: string }
  > = {
    Modelar: {
      label: 'Modelar',
      icon: Target,
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    Testar: {
      label: 'Testar',
      icon: Sparkles,
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
    },
    'Deep Dive': {
      label: 'Deep Dive',
      icon: Flame,
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
    },
    Interessante: {
      label: 'Interessante',
      icon: Sparkles,
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
    },
    Observar: {
      label: 'Observar',
      icon: Eye,
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    },
    Ignorar: {
      label: 'Ignorar',
      icon: XCircle,
      bg: 'bg-slate-800/80',
      text: 'text-slate-400',
      border: 'border-slate-700',
    },
    Arquivada: {
      label: 'Arquivada',
      icon: Archive,
      bg: 'bg-slate-900',
      text: 'text-slate-500',
      border: 'border-slate-800',
    },
  };

  const config = configs[decision] || configs['Observar'];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold border ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {config.label}
    </span>
  );
}
