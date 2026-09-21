'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  sectionName?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[SECTION_ERROR_BOUNDARY] ${this.props.sectionName || 'Section'}:`, error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-3 text-xs text-slate-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{this.props.sectionName || 'Seção do Projeto'} — Indisponível no momento</span>
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition flex items-center gap-1 font-mono text-[11px]"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tentar Novamente</span>
            </button>
          </div>
          <p className="text-slate-400">
            {this.props.fallbackMessage || 'Ocorreu um problema ao renderizar os dados desta seção. As demais abas continuam operando normalmente.'}
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-rose-300 overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
