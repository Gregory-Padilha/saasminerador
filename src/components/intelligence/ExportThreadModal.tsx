'use client';

import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, X, FileText, Code2, Sparkles, AlertCircle, Layers } from 'lucide-react';
import { ContextExportService } from '@/lib/export/context-export-service';
import { ExportFormat } from '@/lib/export/types';

interface ExportThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
}

export function ExportThreadModal({ isOpen, onClose, threadId }: ExportThreadModalProps) {
  const [scope, setScope] = useState<'conversa' | 'conversa_sources' | 'full'>('full');
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>({
    attachedOffers: true,
    creativeIntelligence: true,
    sources: true,
    savedInsights: true,
    knowledgeReferences: true,
    toolOutputs: true,
  });

  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('ai-context.md');
  const [tokenEstimate, setTokenEstimate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && threadId) {
      generateExportData();
    }
  }, [isOpen, threadId, scope, format, checkboxes]);

  const generateExportData = async () => {
    setIsLoading(true);
    try {
      const res = await ContextExportService.exportThreadContext({
        threadId,
        scope,
        format,
        checkboxes,
      });
      setContent(res.content);
      setFileName(res.fileName);
      setTokenEstimate(res.tokenEstimate);
    } catch (err) {
      console.error('Erro ao gerar exportação:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!content) return;
    const blob = new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isLargePayload = tokenEstimate > 30000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">EXPORTAR CONVERSA & CONTEXTO</h3>
              <p className="text-xs text-slate-400">Gere AI Context Packs para Claude, ChatGPT, Gemini ou outro agente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Options */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Conteúdo do Pacote</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope('conversa')}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  scope === 'conversa'
                    ? 'bg-purple-600/15 border-purple-500 text-purple-300 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                <div className="font-semibold text-white">Conversa</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Mensagens cronológicas</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('conversa_sources')}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  scope === 'conversa_sources'
                    ? 'bg-purple-600/15 border-purple-500 text-purple-300 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                <div className="font-semibold text-white">Conversa + Fontes</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Com evidências e LPs</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('full')}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  scope === 'full'
                    ? 'bg-purple-600/15 border-purple-500 text-purple-300 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                <div className="font-semibold text-white">Contexto Completo</div>
                <div className="text-[10px] text-purple-400 mt-0.5">Recomendado para LLM</div>
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Formato do Arquivo</label>
            <div className="flex items-center gap-3">
              <label
                onClick={() => setFormat('markdown')}
                className={`flex-1 p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-bold transition ${
                  format === 'markdown' ? 'bg-purple-600/15 border-purple-500 text-purple-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>Markdown (.md)</span>
                </div>
                <span className="text-[10px] text-purple-400 font-mono">Recomendado</span>
              </label>

              <label
                onClick={() => setFormat('json')}
                className={`flex-1 p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-bold transition ${
                  format === 'json' ? 'bg-purple-600/15 border-purple-500 text-purple-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  <span>JSON (.json)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Estruturado</span>
              </label>
            </div>
          </div>

          {/* Checkbox Options */}
          {scope === 'full' && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Módulos a Incluir</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'attachedOffers', label: 'Oferta atual' },
                  { key: 'creativeIntelligence', label: 'Creative Intelligence' },
                  { key: 'sources', label: 'Sources & Evidências' },
                  { key: 'savedInsights', label: 'Insights salvos' },
                  { key: 'knowledgeReferences', label: 'Knowledge references' },
                  { key: 'toolOutputs', label: 'Tool outputs relevantes' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-slate-800 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={!!checkboxes[item.key]}
                      onChange={(e) => setCheckboxes({ ...checkboxes, [item.key]: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Token Estimate & Warning */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300">Tamanho estimado do contexto:</span>
            </div>
            <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20">
              ~{tokenEstimate.toLocaleString('pt-BR')} tokens
            </span>
          </div>

          {isLargePayload && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Contexto elevado para a área de transferência. Recomendado baixar o arquivo `.md`.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            disabled={isLoading || !content}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? 'Copiado!' : 'Copiar Contexto'}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={isLoading || !content}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Baixar {format === 'json' ? '.json' : '.md'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
