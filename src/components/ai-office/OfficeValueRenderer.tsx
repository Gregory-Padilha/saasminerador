'use client';

import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Clock,
  TrendingUp,
  Layers,
  ChevronDown,
  ChevronRight,
  Code2,
} from 'lucide-react';

export function isRenderablePrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function formatOfficeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (isRenderablePrimitive(value)) return String(value);
  if (typeof value === 'object') {
    if ('summary' in (value as any) && typeof (value as any).summary === 'string') {
      return (value as any).summary;
    }
    if ('title' in (value as any) && typeof (value as any).title === 'string') {
      return (value as any).title;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

interface OfficeValueRendererProps {
  value: unknown;
  context?: {
    componentName?: string;
    missionId?: string;
    agentRole?: string;
  };
  compact?: boolean;
}

export function OfficeValueRenderer({ value, context, compact }: OfficeValueRendererProps) {
  const [showJsonDetails, setShowJsonDetails] = useState(false);

  // 1. Null / Undefined
  if (value === null || value === undefined) {
    return <span className="text-slate-500 italic text-xs">-</span>;
  }

  // 2. Primitives (String, Number, Boolean)
  if (isRenderablePrimitive(value)) {
    return <span className="text-slate-200">{String(value)}</span>;
  }

  // 3. Array of items
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500 italic text-xs">Nenhum item registrado.</span>;
    }
    return (
      <div className="space-y-2 w-full">
        {value.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="text-purple-400 font-bold text-xs mt-0.5">•</span>
            <div className="flex-1">
              <OfficeValueRenderer value={item} context={context} compact={compact} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 4. Objects
  if (typeof value === 'object') {
    const obj = value as Record<string, any>;

    if (obj.title || obj.summary || obj.name) {
      const titleText = obj.title || obj.name || obj.category || 'Dado Estruturado';
      const summaryText = obj.summary || obj.description || obj.rationale || obj.contents || '';

      return (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 w-full">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-300">{titleText}</span>
            <button
              onClick={() => setShowJsonDetails(!showJsonDetails)}
              className="text-[10px] text-slate-400 hover:text-purple-300 flex items-center gap-1 font-mono"
            >
              <Code2 className="w-3 h-3" />
              {showJsonDetails ? 'Ocultar JSON' : 'Ver JSON'}
            </button>
          </div>
          {summaryText && <p className="text-slate-300 leading-relaxed">{summaryText}</p>}

          {showJsonDetails && (
            <pre className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-purple-300 overflow-x-auto max-h-40">
              {JSON.stringify(value, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    return (
      <pre className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-40">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <span className="text-slate-300">{String(value)}</span>;
}
