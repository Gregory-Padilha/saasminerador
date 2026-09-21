'use client';

import React from 'react';
import { Offer } from '@/types';
import { FileSpreadsheet, Code2, Database, Tag, Calendar, Layers } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';

interface TabRawDataProps {
  offer: Offer;
}

export function TabRawData({ offer }: TabRawDataProps) {
  const rawData = offer.raw_data || {};
  const extraData = offer.extra_data || {};
  const rawEntries = Object.entries(rawData);
  const extraEntries = Object.entries(extraData);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Source Meta Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Metadados de Origem da Mineração (Excel / Ingestão)
            </h3>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            Fonte da Verdade
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Arquivo de Origem</span>
            <span className="font-mono text-white block truncate">{offer.source_file_name || 'Importação Direta'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Aba / Linha</span>
            <span className="font-mono text-slate-200 block">
              {offer.sheet_name || 'Planilha'} {offer.row_number ? `(Linha #${offer.row_number})` : ''}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Deduplication Key</span>
            <span className="font-mono text-slate-300 block truncate" title={offer.dedupe_key}>
              {offer.dedupe_key || '—'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Data de Ingestão</span>
            <span className="font-mono text-slate-200 block">
              {offer.created_at ? formatDateTime(offer.created_at) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Raw Excel Columns Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Colunas Brutas Capturadas na Planilha ({rawEntries.length})
            </h3>
          </div>
        </div>

        {rawEntries.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Nenhum dado bruto armazenado no campo raw_data para este registro.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0">
                    <th className="py-2.5 px-4 w-1/3">Cabeçalho Original</th>
                    <th className="py-2.5 px-4">Valor Bruto Extraído</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rawEntries.map(([k, v]) => (
                    <tr key={k} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-300 bg-slate-950/40">
                        {k}
                      </td>
                      <td className="py-2.5 px-4 text-slate-200 font-mono break-all">
                        {v !== null && v !== undefined && v !== '' ? (
                          String(v)
                        ) : (
                          <span className="text-slate-600 italic">— vazio —</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Extra Data / JSON Viewer */}
      {extraEntries.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Code2 className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Campos Adicionais / Extra Data JSON
            </h3>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
            {JSON.stringify(extraData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
