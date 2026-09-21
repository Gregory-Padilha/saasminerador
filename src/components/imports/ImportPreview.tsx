'use client';

import React, { useState } from 'react';
import {
  ParseResult,
  ImportPreviewRow,
  ImportSummary,
  DuplicateAction,
  RawSheetData,
} from '@/types';
import { StatusBadge, FacelessBadge } from '@/components/ui/StatusBadge';
import { SYSTEM_COLUMNS } from '@/lib/excel/aliases';
import { formatCurrency } from '@/lib/utils';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ArrowRight,
  Sliders,
  Table,
  Layers,
  History,
  Sparkles,
  Info,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportPreviewProps {
  parseResult: ParseResult;
  onConfirmImport: (rows: ImportPreviewRow[]) => void;
  onApplyMapping: (newMapping: Record<string, string>) => void;
  onHeaderRowChange?: (newHeaderRowIndex: number) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isParsing?: boolean;
}

export function ImportPreview({
  parseResult,
  onConfirmImport,
  onApplyMapping,
  onHeaderRowChange,
  onCancel,
  isSubmitting = false,
  isParsing = false,
}: ImportPreviewProps) {
  const { summary, headers, columnMapping, columnMappingDetails, rawSheetsData, detectedHeaderRowIndex } = parseResult;

  // Tabs: 'raw' | 'mapping' | 'normalized'
  const [activeTab, setActiveTab] = useState<'raw' | 'mapping' | 'normalized'>('raw');
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [showCandidateSelector, setShowCandidateSelector] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>(parseResult.rows);
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({ ...columnMapping });
  const [globalDuplicateAction, setGlobalDuplicateAction] = useState<DuplicateAction>('update');
  const [selectedRawData, setSelectedRawData] = useState<{
    rowIndex: number;
    sheetName?: string;
    rawData: Record<string, any>;
    extraData?: Record<string, any>;
  } | null>(null);

  // Synchronize previewRows if parseResult updates
  React.useEffect(() => {
    setPreviewRows(parseResult.rows);
    setLocalMapping({ ...parseResult.columnMapping });
  }, [parseResult]);

  const currentRawSheet: RawSheetData | undefined = rawSheetsData && rawSheetsData[activeSheetIndex]
    ? rawSheetsData[activeSheetIndex]
    : rawSheetsData && rawSheetsData[0];

  // Check if product_name is mapped
  const hasProductNameMapped = Object.values(localMapping).includes('product_name');

  const handleGlobalDuplicateChange = (action: DuplicateAction) => {
    setGlobalDuplicateAction(action);
    setPreviewRows((prev) =>
      prev.map((r) => (r.isDuplicate ? { ...r, duplicateAction: action } : r))
    );
  };

  const handleRowDuplicateChange = (tempId: string, action: DuplicateAction) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, duplicateAction: action } : r))
    );
  };

  const handleMappingFieldChange = (excelHeader: string, newField: string) => {
    const updated = { ...localMapping };
    if (!newField || newField === '' || newField === 'extra_data' || newField === 'ignore') {
      delete updated[excelHeader];
    } else {
      updated[excelHeader] = newField;
    }
    setLocalMapping(updated);
  };

  const handleSaveLocalMapping = () => {
    onApplyMapping(localMapping);
  };

  const readyToImportCount = previewRows.filter(
    (r) => !r.hasErrors && (!r.isDuplicate || r.duplicateAction !== 'ignore')
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Overview Bar */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Importador XLSX Offer Miner
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                Linha de Header: #{((detectedHeaderRowIndex ?? 0) + 1)}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {summary.fileName}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCandidateSelector(!showCandidateSelector)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Trocar Linha de Cabeçalho</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showCandidateSelector && 'rotate-180')} />
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-slate-800 transition"
          >
            Trocar Arquivo
          </button>
        </div>
      </div>

      {/* Header Inspector & Candidate Row Selector Dropdown */}
      {showCandidateSelector && currentRawSheet && (
        <div className="p-5 rounded-2xl bg-slate-950 border border-blue-500/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Detecção da Linha de Cabeçalho (Score & Confiança)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Header ativo na linha: <strong className="text-blue-400">#{currentRawSheet.headerRowIndex + 1}</strong>
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              Selecione qual linha do Excel contém os títulos reais das colunas da tabela:
            </p>

            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {currentRawSheet.headerCandidates && currentRawSheet.headerCandidates.length > 0 ? (
                currentRawSheet.headerCandidates.map((cand) => {
                  const isCurrent = cand.rowIndex === currentRawSheet.headerRowIndex;
                  return (
                    <div
                      key={cand.rowIndex}
                      className={cn(
                        'p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition',
                        isCurrent
                          ? 'bg-blue-600/10 border-blue-500/40 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-400 font-mono">
                            Linha {cand.rowIndex + 1}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            Score: {cand.score} pts
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                              ✓ Selecionado
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-xl">
                          {cand.preview.slice(0, 7).join(' | ') || '(Linha vazia)'}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent || isParsing}
                        onClick={() => {
                          if (onHeaderRowChange) {
                            onHeaderRowChange(cand.rowIndex);
                          }
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition',
                          isCurrent
                            ? 'bg-slate-800 text-slate-500 cursor-default'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                        )}
                      >
                        {isCurrent ? 'Linha Ativa' : 'Usar esta linha como cabeçalho'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-slate-500 text-xs">
                  Nenhum outro candidato encontrado nas primeiras 20 linhas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Linhas Lidas (Excel)
          </span>
          <span className="text-2xl font-bold text-white tabular-numbers mt-1 block">
            {summary.totalRows}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
            Prontas / Válidas
          </span>
          <span className="text-2xl font-bold text-emerald-300 tabular-numbers mt-1 block">
            {summary.readyRows}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
            Duplicatas
          </span>
          <span className="text-2xl font-bold text-amber-300 tabular-numbers mt-1 block">
            {summary.duplicateRows}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
            Inválidas / Atenção
          </span>
          <span className="text-2xl font-bold text-rose-300 tabular-numbers mt-1 block">
            {summary.invalidRows}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            A Importar
          </span>
          <span className="text-2xl font-bold text-blue-400 tabular-numbers mt-1 block">
            {readyToImportCount}
          </span>
        </div>
      </div>

      {/* Missing Required Field Alert */}
      {!hasProductNameMapped && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">
              Coluna &quot;Produto&quot; não identificada
            </h4>
            <p className="text-xs text-rose-300">
              Para importar ofertas com integridade, precisamos saber qual coluna do Excel representa o nome do Produto.
              Abra a aba <button onClick={() => setActiveTab('mapping')} className="underline font-bold text-white hover:text-rose-200">2. Mapeamento de Colunas</button> e selecione o campo Produto.
            </p>
          </div>
        </div>
      )}

      {/* Main 3-Tab Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition',
              activeTab === 'raw'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            )}
          >
            <Table className="w-3.5 h-3.5" />
            <span>1. Dados do Excel (Raw)</span>
            <span className="px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono">
              {currentRawSheet?.rawRows.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mapping')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition',
              activeTab === 'mapping'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>2. Mapeamento de Colunas</span>
            <span className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-mono',
              hasProductNameMapped ? 'bg-black/30' : 'bg-rose-500/20 text-rose-300'
            )}>
              {headers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('normalized')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition',
              activeTab === 'normalized'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. Prévia Normalizada</span>
            <span className="px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono">
              {previewRows.length}
            </span>
          </button>
        </div>

        {/* Multi-Sheet Selector (if applicable) */}
        {summary.sheetNames && summary.sheetNames.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">Planilha:</span>
            <select
              value={activeSheetIndex}
              onChange={(e) => setActiveSheetIndex(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
            >
              {summary.sheetNames.map((sheet, idx) => (
                <option key={sheet} value={idx}>
                  {sheet} ({rawSheetsData?.[idx]?.rawRows.length ?? 0} linhas)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DADOS DO EXCEL (RAW - 1:1 COM O ARQUIVO ORIGINAL) */}
      {/* ========================================================================= */}
      {activeTab === 'raw' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-0 animate-in fade-in duration-150">
          <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Tabela Original do Excel</span>
                <span className="text-emerald-400 font-normal">● 100% dos dados originais</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Colunas e células exatamente como foram gravadas no arquivo, sem nenhuma alteração ou suposição.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Cabeçalho lido na linha #{((currentRawSheet?.headerRowIndex ?? 0) + 1)}
            </span>
          </div>

          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-950 text-[11px] font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 z-10">
                <tr>
                  <th className="px-3 py-3 w-12 text-center text-slate-500">Linha</th>
                  {currentRawSheet?.detectedHeaders.map((headerInfo) => (
                    <th key={headerInfo.original} className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-white font-bold">{headerInfo.original}</span>
                        <span className="text-[10px] text-slate-500 font-mono lowercase">
                          {headerInfo.normalized}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {currentRawSheet && currentRawSheet.rawRows.length > 0 ? (
                  currentRawSheet.rawRows.map((rawRow, idx) => {
                    const excelLineNumber = currentRawSheet.headerRowIndex + 2 + idx;
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="px-3 py-3 text-center text-slate-500 font-mono">
                          {excelLineNumber}
                        </td>
                        {currentRawSheet.detectedHeaders.map((h) => {
                          const val = rawRow[h.original];
                          return (
                            <td key={h.original} className="px-4 py-3 text-slate-300 max-w-[280px] truncate">
                              {val !== null && val !== undefined && String(val).trim() !== '' ? (
                                <span>{String(val)}</span>
                              ) : (
                                <span className="text-slate-600 italic">null</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={(currentRawSheet?.detectedHeaders.length || 1) + 1}
                      className="p-8 text-center text-slate-500 text-xs"
                    >
                      Nenhum dado encontrado após a linha de cabeçalho.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MAPEAMENTO DE COLUNAS */}
      {/* ========================================================================= */}
      {activeTab === 'mapping' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-0 animate-in fade-in duration-150">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Mapeamento das Colunas do Excel para o Offer Miner
              </h3>
              <p className="text-[11px] text-slate-400">
                Confira a associação automática ou selecione manualmente o campo correto em cada coluna.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveLocalMapping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aplicar e Re-processar Planilha</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Coluna Original do Excel</th>
                  <th className="px-5 py-3">Normalizado</th>
                  <th className="px-5 py-3">Confiança</th>
                  <th className="px-5 py-3">Campo do Offer Miner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {headers.map((excelHeader) => {
                  const detail = columnMappingDetails?.[excelHeader];
                  const currentMappedField = localMapping[excelHeader] || '';
                  const confidence = detail?.confidence ?? (currentMappedField ? 100 : 0);

                  return (
                    <tr key={excelHeader} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-semibold text-white">
                        <span className="font-mono text-xs">{excelHeader}</span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                        {detail?.label ? excelHeader.toLowerCase().trim() : '—'}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[11px] font-mono font-semibold',
                            confidence >= 90
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : confidence >= 70
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          )}
                        >
                          {confidence}%
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <select
                          value={currentMappedField}
                          onChange={(e) => handleMappingFieldChange(excelHeader, e.target.value)}
                          className={cn(
                            'w-full max-w-sm px-3 py-1.5 bg-slate-950 border rounded-lg text-xs font-medium focus:outline-none transition',
                            currentMappedField === 'product_name'
                              ? 'border-blue-500 text-blue-200'
                              : currentMappedField
                              ? 'border-emerald-500/50 text-emerald-200'
                              : 'border-slate-700 text-slate-400'
                          )}
                        >
                          <option value="">Preservar em extra_data (Não Mapeado)</option>
                          {SYSTEM_COLUMNS.map((col) => (
                            <option key={col.key} value={col.key}>
                              {col.label} {col.required ? '(* Obrigatório)' : ''} — [{col.key}]
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRÉVIA NORMALIZADA */}
      {/* ========================================================================= */}
      {activeTab === 'normalized' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Duplicate Strategy Controls */}
          {summary.duplicateRows > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Copy className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-200">
                    {summary.duplicateRows} oferta(s) já existente(s) identificada(s)
                  </p>
                  <p className="text-[11px] text-amber-300/80">
                    Escolha como deseja tratar as ofertas duplicadas nesta importação:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-amber-500/30">
                <button
                  type="button"
                  onClick={() => handleGlobalDuplicateChange('update')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-semibold rounded-md transition',
                    globalDuplicateAction === 'update'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-amber-300 hover:bg-amber-500/20'
                  )}
                >
                  Atualizar + Snapshot (Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => handleGlobalDuplicateChange('ignore')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-semibold rounded-md transition',
                    globalDuplicateAction === 'ignore'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-amber-300 hover:bg-amber-500/20'
                  )}
                >
                  Ignorar
                </button>
                <button
                  type="button"
                  onClick={() => handleGlobalDuplicateChange('create_new')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-semibold rounded-md transition',
                    globalDuplicateAction === 'create_new'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-amber-300 hover:bg-amber-500/20'
                  )}
                >
                  Criar Nova
                </button>
              </div>
            </div>
          )}

          {/* Normalized Data Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Linhas Normalizadas (Campos Internos do Banco)
              </span>
              <span className="text-xs text-slate-400">
                Clique em &quot;Ver Raw&quot; para inspecionar as células brutas e colunas extras preservadas
              </span>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 z-10">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Nicho</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Landing Page</th>
                    <th className="px-4 py-3">Domínio</th>
                    <th className="px-4 py-3">Ads</th>
                    <th className="px-4 py-3">Dias</th>
                    <th className="px-4 py-3">Faceless</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Condição & Duplicata</th>
                    <th className="px-4 py-3 text-center">Raw Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {previewRows.map((row) => {
                    const norm = row.normalized;
                    const existing = row.existingOffer;

                    return (
                      <tr
                        key={row.tempId}
                        className={cn(
                          'hover:bg-slate-800/40 transition',
                          row.isDuplicate && 'bg-amber-500/5',
                          row.validation.status === 'INVALIDA' && 'bg-rose-500/5'
                        )}
                      >
                        <td className="px-4 py-3.5 text-center text-slate-400 font-mono">
                          {row.rowIndex}
                        </td>

                        <td className="px-4 py-3.5 max-w-[200px]">
                          <div className="font-semibold text-white truncate">
                            {norm.product_name ? (
                              norm.product_name
                            ) : (
                              <span className="text-rose-400 italic font-normal">Nome não informado</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {norm.advertiser || '—'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-slate-300">{norm.niche || '—'}</span>
                        </td>

                        <td className="px-4 py-3.5 font-mono font-semibold text-white">
                          {formatCurrency(norm.price)}
                        </td>

                        <td className="px-4 py-3.5 max-w-[180px]">
                          {norm.landing_page_url ? (
                            <a
                              href={norm.landing_page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] truncate block"
                              title={norm.landing_page_url}
                            >
                              {norm.landing_page_url}
                            </a>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">Não informada</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 max-w-[140px]">
                          {norm.landing_page_domain ? (
                            <span className="text-slate-300 font-mono text-[11px] truncate block" title={norm.landing_page_domain}>
                              {norm.landing_page_domain}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 font-mono text-blue-300">
                          {norm.active_ads_count !== null && norm.active_ads_count !== undefined
                            ? `${norm.active_ads_count} ads`
                            : '—'}
                        </td>

                        <td className="px-4 py-3.5 text-slate-300">
                          {norm.days_running !== null && norm.days_running !== undefined
                            ? `${norm.days_running}d`
                            : '—'}
                        </td>

                        <td className="px-4 py-3.5">
                          <FacelessBadge faceless={norm.faceless} size="sm" />
                        </td>

                        <td className="px-4 py-3.5">
                          <StatusBadge status={row.validation.status} size="sm" />
                        </td>

                        <td className="px-4 py-3.5 max-w-[260px]">
                          {row.isDuplicate && existing ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <History className="w-3 h-3" />
                                <span>Duplicata detectada:</span>
                                <span className="text-slate-300 font-normal">
                                  {existing.active_ads_count ?? '—'} ads ({existing.days_running ?? '—'}d)
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-[10px]">
                                <select
                                  value={row.duplicateAction}
                                  onChange={(e) =>
                                    handleRowDuplicateChange(
                                      row.tempId,
                                      e.target.value as DuplicateAction
                                    )
                                  }
                                  className="px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-200 text-[11px]"
                                >
                                  <option value="update">Atualizar + Snapshot</option>
                                  <option value="ignore">Ignorar linha</option>
                                  <option value="create_new">Criar como nova</option>
                                </select>
                              </div>
                            </div>
                          ) : row.validation.reasons.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.validation.reasons.map((r, i) => (
                                <span
                                  key={i}
                                  className="inline-block text-[10px] text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded mr-1"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          ) : row.validation.warnings.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.validation.warnings.map((w, i) => (
                                <span
                                  key={i}
                                  className="inline-block text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded mr-1"
                                >
                                  {w}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-medium">
                              ✓ Pronto para gravar
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedRawData({
                                rowIndex: row.rowIndex,
                                sheetName: row.sheetName,
                                rawData: row.raw,
                                extraData: row.extraData,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-semibold text-slate-300 border border-slate-700 transition"
                          >
                            Ver Raw
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Global Bottom Actions Footer */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-400">
          {!hasProductNameMapped ? (
            <span className="text-rose-400 font-medium">
              ⚠️ Mapeie a coluna &quot;Produto&quot; para liberar a importação no banco.
            </span>
          ) : (
            <span>
              Serão processadas <strong className="text-white">{readyToImportCount}</strong> ofertas válidas com snapshot histórico automático.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onConfirmImport(previewRows)}
            disabled={isSubmitting || readyToImportCount === 0 || !hasProductNameMapped}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Gravando no Banco...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>IMPORTAR OFERTAS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Raw Data Inspector Modal */}
      {selectedRawData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Dados Originais do Excel (Linha #{selectedRawData.rowIndex})
                </h3>
                <p className="text-xs text-slate-400">
                  Planilha: {selectedRawData.sheetName || 'Principal'} • Nenhuma informação foi perdida.
                </p>
              </div>
              <button
                onClick={() => setSelectedRawData(null)}
                className="px-3 py-1 text-xs font-semibold text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
              >
                Fechar
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <div>
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                  Células Lidas (raw_data)
                </h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                        <th className="pb-2">Coluna Original</th>
                        <th className="pb-2">Valor Lido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {Object.entries(selectedRawData.rawData).map(([col, val]) => (
                        <tr key={col}>
                          <td className="py-2 text-slate-400 font-semibold pr-4">{col}</td>
                          <td className="py-2 text-white break-all">{val !== null && val !== undefined ? String(val) : <span className="text-slate-600 italic">null</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedRawData.extraData && Object.keys(selectedRawData.extraData).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                    Colunas Extras Preservadas (extra_data)
                  </h4>
                  <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-amber-300/90 overflow-x-auto">
                    {JSON.stringify(selectedRawData.extraData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
