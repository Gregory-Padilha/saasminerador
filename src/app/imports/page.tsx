'use client';

import React, { useState, useEffect } from 'react';
import { dbService } from '@/lib/supabase/db';
import { ImportBatch, ImportPreviewRow, ImportSummary, Offer, UserSettings, ParseResult } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Dropzone } from '@/components/imports/Dropzone';
import { ImportPreview } from '@/components/imports/ImportPreview';
import { ColumnMappingModal } from '@/components/imports/ColumnMappingModal';
import { ImportReportModal } from '@/components/imports/ImportReportModal';
import { parseSpreadsheet } from '@/lib/excel/parser';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  UploadCloud,
  History,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { JsonImportModal } from '@/components/imports/JsonImportModal';

export default function ImportsPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [existingOffers, setExistingOffers] = useState<Offer[]>([]);
  const [settings, setSettings] = useState<UserSettings | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Active Import Session State
  const [currentBuffer, setCurrentBuffer] = useState<ArrayBuffer | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  // Modals
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    fileName: string;
    totalRows: number;
    newCount: number;
    updatedCount: number;
    ignoredCount: number;
    invalidCount: number;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedBatches, fetchedOffers, fetchedSettings] = await Promise.all([
        dbService.getBatches(),
        dbService.getOffers(),
        dbService.getSettings(),
      ]);
      setBatches(fetchedBatches);
      setExistingOffers(fetchedOffers);
      setSettings(fetchedSettings);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileLoaded = async (buffer: ArrayBuffer, fileName: string) => {
    setCurrentBuffer(buffer);
    setCurrentFileName(fileName);
    setIsParsing(true);

    try {
      const result = await parseSpreadsheet(
        buffer,
        fileName,
        existingOffers,
        settings
      );
      setParseResult(result);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar planilha.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplyCustomMapping = async (newMapping: Record<string, string>) => {
    if (!currentBuffer) return;
    setIsParsing(true);
    try {
      const result = await parseSpreadsheet(
        currentBuffer,
        currentFileName,
        existingOffers,
        settings,
        newMapping,
        parseResult?.detectedHeaderRowIndex
      );
      setParseResult(result);
    } catch (err: any) {
      alert(err.message || 'Erro ao remapear planilha.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleHeaderRowChange = async (newHeaderRowIndex: number) => {
    if (!currentBuffer) return;
    setIsParsing(true);
    try {
      const result = await parseSpreadsheet(
        currentBuffer,
        currentFileName,
        existingOffers,
        settings,
        parseResult?.columnMapping,
        newHeaderRowIndex
      );
      setParseResult(result);
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar linha de cabeçalho.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async (rowsToImport: ImportPreviewRow[]) => {
    setIsSaving(true);
    try {
      const result = await dbService.executeImportBatch(currentFileName, rowsToImport);

      setReportData({
        fileName: currentFileName,
        totalRows: rowsToImport.length,
        newCount: result.newCount,
        updatedCount: result.updatedCount,
        ignoredCount: result.ignoredCount,
        invalidCount: result.batch.invalid_rows,
      });

      // Reset import session and reload data
      setParseResult(null);
      setCurrentBuffer(null);
      loadData();
    } catch (err: any) {
      alert('Erro ao salvar no banco: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelImport = () => {
    setParseResult(null);
    setCurrentBuffer(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Importações de Mineração"
        description="Faça upload dos arquivos gerados pelo ChatGPT Work (.xlsx, .xls, .csv) ou importe via JSON (.json ou texto colado)."
        actions={
          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
          >
            <FileCode className="w-4 h-4" />
            <span>Importar JSON</span>
          </button>
        }
      />

      {/* Main Container */}
      <div className="space-y-8">
        {parseResult ? (
          /* Step 2: Tabbed Preview & Validation screen */
          <ImportPreview
            parseResult={parseResult}
            onConfirmImport={handleConfirmImport}
            onApplyMapping={handleApplyCustomMapping}
            onHeaderRowChange={handleHeaderRowChange}
            onCancel={handleCancelImport}
            isSubmitting={isSaving}
            isParsing={isParsing}
          />
        ) : (
          /* Step 1: Upload Dropzone */
          <Dropzone onFileLoaded={handleFileLoaded} isLoading={isParsing} />
        )}

        {/* Import History Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Histórico de Lotes Importados
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {batches.length} lotes
            </span>
          </div>

          {batches.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhum lote importado ainda. Arraste seu primeiro arquivo acima para iniciar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Data da Importação</th>
                    <th className="px-5 py-3">Arquivo</th>
                    <th className="px-5 py-3">Total Linhas</th>
                    <th className="px-5 py-3">Novas Ofertas</th>
                    <th className="px-5 py-3">Atualizadas</th>
                    <th className="px-5 py-3">Duplicadas</th>
                    <th className="px-5 py-3">Inválidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-800/40 transition"
                    >
                      <td className="px-5 py-3.5 text-slate-300 tabular-numbers whitespace-nowrap font-medium">
                        {formatDateTime(batch.created_at)}
                      </td>

                      <td className="px-5 py-3.5 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          {batch.import_type === 'JSON_FILE' || batch.import_type === 'JSON_PASTE' || batch.file_name.toLowerCase().endsWith('.json') || batch.file_name.includes('JSON') ? (
                            <>
                              <FileCode className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {batch.file_name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                JSON
                              </span>
                            </>
                          ) : (
                            <>
                              <FileSpreadsheet className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {batch.file_name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                XLSX
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-slate-300">
                        {batch.total_rows}
                      </td>

                      <td className="px-5 py-3.5 font-mono font-semibold text-emerald-400">
                        +{batch.imported_rows}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-blue-400">
                        {batch.updated_rows}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-amber-400">
                        {batch.duplicate_rows}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-rose-400">
                        {batch.invalid_rows}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Column Mapping Modal */}
      {parseResult && (
        <ColumnMappingModal
          isOpen={isMappingOpen}
          headers={parseResult.headers}
          currentMapping={parseResult.columnMapping}
          onClose={() => setIsMappingOpen(false)}
          onApplyMapping={handleApplyCustomMapping}
        />
      )}

      {/* Report Modal */}
      {reportData && (
        <ImportReportModal
          isOpen={!!reportData}
          report={reportData}
          onClose={() => setReportData(null)}
        />
      )}

      {/* JSON Import Modal */}
      <JsonImportModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        onSuccess={loadData}
      />
    </AppShell>
  );
}
