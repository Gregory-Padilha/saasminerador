'use client';

import React, { useState } from 'react';
import { SYSTEM_COLUMNS } from '@/lib/excel/aliases';
import { X, ArrowRight, Check, Sliders } from 'lucide-react';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  currentMapping: Record<string, string>;
  onApplyMapping: (newMapping: Record<string, string>) => void;
}

export function ColumnMappingModal({
  isOpen,
  onClose,
  headers,
  currentMapping,
  onApplyMapping,
}: ColumnMappingModalProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({ ...currentMapping });

  if (!isOpen) return null;

  const handleSelect = (header: string, sysKey: string) => {
    setMapping((prev) => ({
      ...prev,
      [header]: sysKey,
    }));
  };

  const handleSave = () => {
    onApplyMapping(mapping);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Mapeamento de Colunas</h3>
              <p className="text-xs text-slate-400">
                Associe as colunas da sua planilha aos campos do banco de inteligência.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mappings List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {headers.map((header) => {
            const mappedKey = mapping[header] || '';
            const isExtra = !mappedKey;

            return (
              <div
                key={header}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                    {header}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  {isExtra ? (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      extra_data (preservado)
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      Mapeado
                    </span>
                  )}
                </div>

                <div className="sm:w-72">
                  <select
                    value={mappedKey}
                    onChange={(e) => handleSelect(header, e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">Preservar em extra_data (Padrão)</option>
                    {SYSTEM_COLUMNS.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.label} {col.required ? '*' : ''} ({col.key})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            Aplicar Mapeamento
          </button>
        </div>
      </div>
    </div>
  );
}
