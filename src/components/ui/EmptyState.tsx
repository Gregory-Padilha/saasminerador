import React from 'react';
import { LucideIcon, Database, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title = 'Seu banco de ofertas ainda está vazio.',
  description = 'Importe o Excel gerado pelo seu processo de mineração no ChatGPT Work para começar a analisar oportunidades.',
  icon: Icon = Database,
  actionText = 'IMPORTAR PRIMEIRA MINERAÇÃO',
  actionHref = '/imports',
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 my-4',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 shadow-inner">
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-slate-400 max-w-md leading-relaxed">
        {description}
      </p>

      {(actionHref || onAction) && (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              {actionText}
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              {actionText}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
