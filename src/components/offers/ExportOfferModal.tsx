'use client';

import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, X, FileText, Code2, Sparkles, AlertCircle, Layers } from 'lucide-react';
import { ContextExportService } from '@/lib/export/context-export-service';
import { ExportFormat } from '@/lib/export/types';

interface ExportOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: string;
  offerName: string;
}

export function ExportOfferModal({ isOpen, onClose, offerId, offerName }: ExportOfferModalProps) {
  const [scope, setScope] = useState<'compact' | 'dossier'>('dossier');
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeAllCreatives, setIncludeAllCreatives] = useState<boolean>(false);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<Record<string, boolean>>({
    landingPage: true,
    checkout: true,
    creatives: true,
    history: true,
    audience: true,
    copy: true,
    notes: true,
  });

  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('offer-dossier.md');
  const [tokenEstimate, setTokenEstimate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && offerId) {
      generateExportData();
    }
  }, [isOpen, offerId, scope, format, includeAllCreatives, selectedCheckboxes]);

  const generateExportData = async () => {
    setIsLoading(true);
    try {
      const res = await ContextExportService.exportOfferContext({
        offerId,
        scope,
        format,
        includeAllCreatives,
        selectedCheckboxes,
      });
      setContent(res.content);
      setFileName(res.fileName);
      setTokenEstimate(res.tokenEstimate);
    } catch (err) {
      console.error('Erro ao gerar exportação da oferta:', err);
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
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">EXPORTAR CONTEXTO DA OFERTA</h3>
              <p className="text-xs text-slate-400">Gere um AI Context Pack de &quot;{offerName}&quot;</p>
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
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Formato do Pacote</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('compact')}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  scope === 'compact'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                <div className="font-semibold text-white">Contexto Compacto</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Resumo rápido para prompts</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('dossier')}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  scope === 'dossier'
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                <div className="font-semibold text-white">Dossiê Completo</div>
                <div className="text-[10px] text-blue-400 mt-0.5">Visão 360° factual completa</div>
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Formato de Saída</label>
            <div className="flex items-center gap-3">
              <label
                onClick={() => setFormat('markdown')}
                className={`flex-1 p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-bold transition ${
                  format === 'markdown' ? 'bg-blue-600/15 border-blue-500 text-blue-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Markdown (.md)</span>
                </div>
                <span className="text-[10px] text-blue-400 font-mono">Recomendado</span>
              </label>

              <label
                onClick={() => setFormat('json')}
                className={`flex-1 p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-bold transition ${
                  format === 'json' ? 'bg-blue-600/15 border-blue-500 text-blue-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span>JSON (.json)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Estruturado</span>
              </label>
            </div>
          </div>

          {/* Checkbox Options */}
          {scope === 'dossier' && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Seções Incluídas</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'landingPage', label: 'Landing Page' },
                  { key: 'checkout', label: 'Checkout' },
                  { key: 'creatives', label: 'Criativos & Mídias' },
                  { key: 'history', label: 'Histórico & Snapshots' },
                  { key: 'audience', label: 'Público & Avatar' },
                  { key: 'copy', label: 'Copy & Headlines' },
                  { key: 'notes', label: 'Notas Manuais' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-slate-800 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={!!selectedCheckboxes[item.key]}
                      onChange={(e) => setSelectedCheckboxes({ ...selectedCheckboxes, [item.key]: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {selectedCheckboxes.creatives && (
                <label className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 cursor-pointer text-purple-300 hover:text-white text-xs font-semibold mt-2">
                  <input
                    type="checkbox"
                    checked={includeAllCreatives}
                    onChange={(e) => setIncludeAllCreatives(e.target.checked)}
                    className="rounded border-purple-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Incluir todos os criativos salvos (pode gerar arquivo extenso)</span>
                </label>
              )}
            </div>
          )}

          {/* Token Estimate & Warning */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">Tamanho estimado do contexto:</span>
            </div>
            <span className="font-mono font-bold text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
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
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Baixar {format === 'json' ? '.json' : '.md'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
