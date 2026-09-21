'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Code2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  widgetName?: string;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class OfficeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[OFFICE_UI_ERROR_BOUNDARY] Error in ${this.props.widgetName || 'Widget'}:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 text-slate-200 text-xs space-y-3 shadow-lg my-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{this.props.fallbackTitle || 'Não foi possível exibir este bloco.'}</span>
            </div>
            <button
              onClick={this.handleReset}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
            >
              <RefreshCcw className="w-3 h-3" />
              Tentar Novamente
            </button>
          </div>

          <p className="text-slate-400 text-[11px]">
            A missão continua sendo processada normalmente no backend. Este erro de renderização foi isolado e não prejudica os agentes.
          </p>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">
              Widget: {this.props.widgetName || 'Office Component'}
            </span>
            <button
              onClick={() => this.setState({ showDetails: !this.state.showDetails })}
              className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
            >
              <Code2 className="w-3 h-3" />
              {this.state.showDetails ? 'Ocultar Diagnóstico' : 'Ver Diagnóstico'}
            </button>
          </div>

          {this.state.showDetails && this.state.error && (
            <pre className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-300 overflow-x-auto">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
