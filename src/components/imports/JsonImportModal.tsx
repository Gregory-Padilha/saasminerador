'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  UploadCloud,
  FileCode,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldCheck,
  Eye,
  Trash2,
  Copy,
  Check,
  Settings2,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn, formatCurrency } from '@/lib/utils';
import { Offer, UserSettings, DuplicateAction } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { OfferImportService } from '@/lib/import/offer-import-service';
import { ImportPreviewItem, JsonParseResult, ImportBatchExecutionResult } from '@/lib/import/types';
import { downloadJsonImportTemplate, SAMPLE_IMPORT_TEMPLATE } from '@/lib/import/template';
import {
  CustomFieldMap,
  TARGET_FIELD_OPTIONS,
  computeSchemaFingerprint,
  loadSavedMapping,
  saveCustomMapping,
  CanonicalFieldTarget,
} from '@/lib/import/field-mapper';

interface JsonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabMode = 'file' | 'paste';
type PresetMode = 'auto' | 'schema' | 'generic';

function formatDocType(type?: string): string {
  switch (type) {
    case 'SEQUENCE_OF_OBJECTS':
      return 'SEQUÊNCIA DE OFERTAS';
    case 'WORKER_MINING_RESULT':
      return 'Resultado de Mineração (Worker)';
    case 'OFFER_MINER_EXPORT':
      return 'Exportação do Offer Miner';
    case 'SINGLE_OFFER':
      return 'Oferta Única';
    case 'OFFER_ARRAY':
      return 'Lista Direta de Ofertas';
    case 'GENERIC_WRAPPER':
      return 'Encapsulador Genérico';
    default:
      return 'Estrutura JSON';
  }
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

export function JsonImportModal({ isOpen, onClose, onSuccess }: JsonImportModalProps) {
  const router = useRouter();

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<TabMode>('file');
  const [preset, setPreset] = useState<PresetMode>('auto');
  const [showFormatDocs, setShowFormatDocs] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste Text State
  const [jsonText, setJsonText] = useState('');
  const [currentRawContent, setCurrentRawContent] = useState('');
  const [formatError, setFormatError] = useState<string | null>(null);

  // Parsing & Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<JsonParseResult | null>(null);
  const [existingOffers, setExistingOffers] = useState<Offer[]>([]);
  const [settings, setSettings] = useState<UserSettings | undefined>(undefined);

  // Advanced Document & Collection State
  const [selectedCollectionPath, setSelectedCollectionPath] = useState<string | undefined>(undefined);
  const [customFieldMap, setCustomFieldMap] = useState<CustomFieldMap>({});
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showFieldMapperModal, setShowFieldMapperModal] = useState(false);
  const [showRepairsModal, setShowRepairsModal] = useState(false);

  // Preview Row Details Popover & Inspector
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<ImportPreviewItem | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'detected' | 'normalized' | 'raw'>('detected');

  // Submitting & Final Report
  const [isSaving, setIsSaving] = useState(false);
  const [reportResult, setReportResult] = useState<ImportBatchExecutionResult | null>(null);

  // Global Duplicate Action State
  const [globalDuplicateAction, setGlobalDuplicateAction] = useState<DuplicateAction>('ignore');

  // Load existing offers and settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadContext();
    } else {
      resetState();
    }
  }, [isOpen]);

  const loadContext = async () => {
    try {
      const [fetchedOffers, fetchedSettings] = await Promise.all([
        dbService.getOffers(),
        dbService.getSettings(),
      ]);
      setExistingOffers(fetchedOffers);
      setSettings(fetchedSettings);
    } catch (err) {
      console.error('Error loading context for JSON import:', err);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setJsonText('');
    setCurrentRawContent('');
    setParseResult(null);
    setFormatError(null);
    setSelectedPreviewItem(null);
    setReportResult(null);
    setIsSaving(false);
    setSelectedCollectionPath(undefined);
    setCustomFieldMap({});
    setShowStructureModal(false);
    setShowFieldMapperModal(false);
    setShowRepairsModal(false);
  };

  // Trigger analysis on raw JSON text
  const analyzeJson = (
    content: string,
    targetPath?: string,
    fieldMap?: CustomFieldMap
  ) => {
    setIsProcessing(true);
    setFormatError(null);
    setCurrentRawContent(content);

    try {
      const activePath = targetPath !== undefined ? targetPath : selectedCollectionPath;
      const activeMap = fieldMap !== undefined ? fieldMap : customFieldMap;

      const result = OfferImportService.processJson(content, existingOffers, settings, {
        targetCollectionPath: activePath,
        customFieldMap: activeMap,
      });

      setParseResult(result);

      if (result.selectedCollectionPath && targetPath === undefined) {
        setSelectedCollectionPath(result.selectedCollectionPath);
      }

      // Check if there are saved mappings for this schema fingerprint
      if (result.candidateCollections && result.candidateCollections.length > 0) {
        const fp = computeSchemaFingerprint(result.candidateCollections[0].sampleKeys);
        const saved = loadSavedMapping(fp);
        if (saved && Object.keys(customFieldMap).length === 0 && fieldMap === undefined) {
          setCustomFieldMap(saved);
        }
      }

      if (!result.success) {
        setFormatError(result.errorMessage || 'Erro desconhecido ao processar JSON.');
      }
    } catch (err: any) {
      setFormatError(err.message || 'Falha ao processar arquivo JSON.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      alert('Por favor selecione um arquivo no formato .json');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      analyzeJson(text);
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  };

  // Handle Pretty Print / Format JSON
  const handleFormatJson = () => {
    setFormatError(null);
    if (!jsonText.trim()) return;

    if (parseResult?.repairedJsonText) {
      setJsonText(parseResult.repairedJsonText);
      analyzeJson(parseResult.repairedJsonText);
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      analyzeJson(formatted);
    } catch (err: any) {
      setFormatError(`JSON inválido: ${err.message}`);
    }
  };

  // Duplicate Action Handlers
  const handleGlobalDuplicateChange = (action: DuplicateAction) => {
    setGlobalDuplicateAction(action);
    if (parseResult) {
      const updated = parseResult.previewItems.map((item) =>
        item.dedupeStatus === 'EXISTING' || item.dedupeStatus === 'POSSIBLE_DUPLICATE'
          ? { ...item, duplicateAction: action }
          : item
      );
      setParseResult({ ...parseResult, previewItems: updated });
    }
  };

  const handleRowDuplicateChange = (tempId: string, action: DuplicateAction) => {
    if (parseResult) {
      const updated = parseResult.previewItems.map((item) =>
        item.tempId === tempId ? { ...item, duplicateAction: action } : item
      );
      setParseResult({ ...parseResult, previewItems: updated });
    }
  };

  // Apply custom field mapping
  const handleApplyFieldMapping = (newMap: CustomFieldMap) => {
    setCustomFieldMap(newMap);
    setShowFieldMapperModal(false);

    // Save mapping to localStorage by fingerprint
    if (parseResult?.candidateCollections && parseResult.candidateCollections.length > 0) {
      const fp = computeSchemaFingerprint(parseResult.candidateCollections[0].sampleKeys);
      saveCustomMapping(fp, newMap);
    }

    if (currentRawContent) {
      analyzeJson(currentRawContent, selectedCollectionPath, newMap);
    }
  };

  // Execute Final Import
  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.previewItems.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const batchType = activeTab === 'file' ? 'JSON_FILE' : 'JSON_PASTE';
      const fileName = selectedFile?.name || (batchType === 'JSON_PASTE' ? 'Texto colado via JSON' : 'ofertas.json');
      const clientImportRequestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const result = await OfferImportService.executeImport({
        batchType,
        fileName,
        previewItems: parseResult.previewItems,
        existingOffers,
        globalMetadata: parseResult.globalMetadata,
        clientImportRequestId,
      });

      setReportResult(result);

      // Trigger celebratory confetti
      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
        });
      } catch {
        // ignore
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      alert('Erro ao persistir importação: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  // Download Error / Audit Report
  const handleDownloadErrorReport = () => {
    if (!parseResult) return;
    const itemsWithIssues = parseResult.previewItems.filter(
      (item) => item.errors.length > 0 || item.warnings.length > 0 || item.dedupeStatus !== 'NEW'
    );
    const reportPayload = {
      generated_at: new Date().toISOString(),
      detected_document: parseResult.detectedDocument,
      collection_path: parseResult.selectedCollectionPath,
      global_metadata: parseResult.globalMetadata,
      total_analyzed: parseResult.totalCount,
      valid_count: parseResult.validCount,
      warning_count: parseResult.warningCount,
      invalid_count: parseResult.invalidCount,
      duplicate_count: parseResult.duplicateCount,
      items: itemsWithIssues.map((item) => ({
        index: item.index,
        offer_name: item.normalized.offer_name,
        advertiser: item.normalized.advertiser,
        validation_status: item.validation.status,
        errors: item.errors,
        warnings: item.warnings,
        match_reason: item.matchReason,
        source_field_map: item.sourceFieldMap,
        raw_data: item.raw,
      })),
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_auditoria_importacao_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  // Filter items valid for import
  const validItemsToImport = (parseResult?.previewItems || []).filter((item) => {
    if (!item.validation.isValid) return false;
    if (item.dedupeStatus === 'EXISTING' || item.dedupeStatus === 'POSSIBLE_DUPLICATE') {
      return item.duplicateAction === 'update';
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* ================================================================== */}
        {/* MODAL HEADER */}
        {/* ================================================================== */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  IMPORTAR OFERTAS VIA JSON
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  JSON v2.0 Intelligent
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detecção automática de documentos de mineração, extração de coleções, dot-paths e validação segura.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Template Button */}
            <button
              type="button"
              onClick={downloadJsonImportTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition active:scale-95"
              title="Baixar exemplo com 2 ofertas válidas"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Baixar Exemplo JSON</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* MODAL BODY */}
        {/* ================================================================== */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step A: If reportResult exists -> Show Final Success Screen */}
          {reportResult ? (
            <div className="py-6 flex flex-col items-center text-center max-w-xl mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/10 animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  IMPORTAÇÃO CONCLUÍDA
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {reportResult.totalRecords} registros analisados e processados com segurança.
                </p>
              </div>

              {/* KPI Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Novas Ofertas
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-400 mt-1 block font-mono">
                    +{reportResult.newOffersCount}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Atualizadas
                  </span>
                  <span className="text-2xl font-extrabold text-blue-400 mt-1 block font-mono">
                    {reportResult.updatedOffersCount}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Duplicadas Ignoradas
                  </span>
                  <span className="text-2xl font-extrabold text-amber-400 mt-1 block font-mono">
                    {reportResult.ignoredDuplicatesCount}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Inválidas
                  </span>
                  <span className="text-2xl font-extrabold text-rose-400 mt-1 block font-mono">
                    {reportResult.invalidCount}
                  </span>
                </div>
              </div>

              {/* Notice of Non-mapped status */}
              <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-800/40 text-left text-xs text-blue-300 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Regra Canônica Aplicada:</span>
                  Todas as novas ofertas nasceram como <strong className="text-blue-200">LP NÃO MAPEADA</strong> e já estão disponíveis na Central de Mapeamentos.
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/offers');
                    router.refresh();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20 transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>Ver Ofertas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/mapping');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <span>Ver Mapeamentos</span>
                </button>

                {reportResult.invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrorReport}
                    className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-400" />
                    <span>Baixar Relatório de Erros</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Step B: Input Tabs & Options */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('file')}
                    className={cn(
                      'px-4 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer',
                      activeTab === 'file'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Arquivo JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('paste')}
                    className={cn(
                      'px-4 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer',
                      activeTab === 'paste'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Colar JSON</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFormatDocs(!showFormatDocs)}
                    className="text-xs text-slate-400 hover:text-blue-400 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    <span>{showFormatDocs ? 'Ocultar formato esperado' : 'Ver formato esperado'}</span>
                    {showFormatDocs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Format Expected Accordion */}
              {showFormatDocs && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                      Estrutura Canônica Suportada (Worker Schema v1.0 ou Array)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(SAMPLE_IMPORT_TEMPLATE, null, 2));
                        alert('Exemplo copiado para a área de transferência!');
                      }}
                      className="text-blue-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar Schema</span>
                    </button>
                  </div>
                  <p className="text-slate-400">
                    O importador reconhece automaticamente resultados de mineração com metadados, wrappers em português ou inglês e objetos aninhados (dot-paths como <code className="text-amber-300">meta_ads.anuncios_ativos</code> ou <code className="text-amber-300">funil.landing_page</code>).
                  </p>
                  <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto">
                    {JSON.stringify(SAMPLE_IMPORT_TEMPLATE, null, 2)}
                  </pre>
                </div>
              )}

              {/* Input Area */}
              {activeTab === 'file' ? (
                <div className="space-y-3">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-3xl p-8 text-center transition flex flex-col items-center justify-center gap-3 cursor-pointer',
                      isDragging
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/80'
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelected(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    <div className="w-14 h-14 rounded-2xl bg-slate-800 text-blue-400 flex items-center justify-center">
                      <UploadCloud className="w-7 h-7" />
                    </div>

                    <div>
                      <span className="text-sm font-semibold text-white block">
                        Clique para selecionar ou arraste seu arquivo .json
                      </span>
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        Suporta arquivos até 10 MB e até 500 ofertas por lote
                      </span>
                    </div>

                    {selectedFile && (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono">
                        <FileCode className="w-4 h-4 text-blue-400" />
                        <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setParseResult(null);
                          }}
                          className="text-[11px] text-rose-400 hover:underline cursor-pointer ml-1"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Cole seu JSON abaixo:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Formatar JSON</span>
                      </button>

                      {jsonText && (
                        <button
                          type="button"
                          onClick={() => {
                            setJsonText('');
                            setCurrentRawContent('');
                            setParseResult(null);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Limpar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={jsonText}
                    onChange={(e) => {
                      setJsonText(e.target.value);
                      if (e.target.value.trim().length > 5) {
                        analyzeJson(e.target.value);
                      } else {
                        setParseResult(null);
                      }
                    }}
                    placeholder="Cole aqui o resultado de mineração, um objeto JSON ou uma lista de ofertas..."
                    className="w-full rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition resize-y"
                  />
                </div>
              )}

              {/* Smart Repair Banner / Badge */}
              {parseResult?.isRepaired && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                      ⚡ JSON REPARADO AUTOMATICAMENTE
                    </span>
                    <span className="text-amber-200/90 text-xs">
                      Detectamos pequenos problemas de formatação e conseguimos corrigi-los.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRepairsModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold border border-amber-500/40 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Correções</span>
                    </button>

                    {activeTab === 'paste' && (
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Formatar JSON</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Syntax Error Alert */}
              {formatError && (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-rose-200">Erro no processamento do JSON</span>
                    <span>{formatError}</span>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* ESTRUTURA DETECTADA (NEW ARCHITECTURE SECTION) */}
              {/* ============================================================ */}
              {parseResult?.detectedDocument && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Estrutura Detectada
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {formatDocType(parseResult.detectedDocument.type)}
                      </span>
                      {parseResult.detectedDocument.schemaVersion && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Schema v{parseResult.detectedDocument.schemaVersion}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowStructureModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span>Ver estrutura detectada</span>
                      </button>

                      {parseResult.unrecognizedFields && parseResult.unrecognizedFields.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowFieldMapperModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/20 transition cursor-pointer"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>Mapear Campos ({parseResult.unrecognizedFields.length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Coleção Usada</span>
                      <span
                        className="font-mono text-cyan-400 font-bold truncate block mt-0.5"
                        title={parseResult.selectedCollectionPath || '$'}
                      >
                        {parseResult.isRepaired && (!parseResult.selectedCollectionPath || parseResult.selectedCollectionPath === '$')
                          ? 'Raiz reparada ($)'
                          : parseResult.selectedCollectionPath || 'Raiz ($)'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ofertas Encontradas</span>
                      <span className="font-mono text-emerald-400 font-bold block mt-0.5">
                        {parseResult.totalCount}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Metadados Globais</span>
                      <span className="font-mono text-purple-400 font-bold block mt-0.5">
                        {Object.keys(parseResult.globalMetadata || {}).length}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Campos Reconhecidos</span>
                      <span className="font-mono text-blue-400 font-bold block mt-0.5">
                        {parseResult.recognizedFieldsCount ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Não Reconhecidos</span>
                      <span
                        className={cn(
                          'font-mono font-bold block mt-0.5',
                          (parseResult.unrecognizedFieldsCount || 0) > 0 ? 'text-amber-400' : 'text-slate-500'
                        )}
                      >
                        {parseResult.unrecognizedFieldsCount ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Multiple Candidate Collections Picker */}
              {parseResult && parseResult.candidateCollections && parseResult.candidateCollections.length > 1 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Encontramos mais de uma coleção possível. Escolha qual importar:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parseResult.candidateCollections.map((col) => {
                      const isSelected = (parseResult.selectedCollectionPath || '$') === col.path;
                      return (
                        <button
                          key={col.path}
                          type="button"
                          onClick={() => {
                            setSelectedCollectionPath(col.path);
                            analyzeJson(currentRawContent, col.path);
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition border cursor-pointer flex items-center gap-2',
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                          )}
                        >
                          <span>{col.path}</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px]',
                              isSelected ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-amber-400'
                            )}
                          >
                            {col.count} {col.count === 1 ? 'registro' : 'registros'} ({col.confidence})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Zero Offers Found Empty State */}
              {parseResult && parseResult.totalCount === 0 && !formatError && (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4 max-w-xl mx-auto my-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Nenhuma coleção de ofertas foi encontrada neste JSON</h4>
                    <p className="text-xs text-slate-400">
                      O documento contém metadados de execução, mas não foi localizada uma coleção com sinais comerciais de oferta válidos.
                    </p>
                  </div>

                  {parseResult.globalMetadata && Object.keys(parseResult.globalMetadata).length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-900 text-left text-xs font-mono text-slate-300 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">
                        Estruturas / Metadados encontrados no documento:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.keys(parseResult.globalMetadata).map((k) => (
                          <span key={k} className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 text-[10px] border border-slate-800">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    Nenhuma oferta fantasma ("Sem nome") foi criada. Verifique o arquivo ou utilize o formato canônico <code>offer-miner-worker-1.0</code>.
                  </p>
                </div>
              )}

              {/* Ignored Unsupported Fields Notice */}
              {parseResult && parseResult.ignoredFieldsSummary.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-300">Campos ignorados pelo importador:</span>
                  {parseResult.ignoredFieldsSummary.map((field) => (
                    <span
                      key={field}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-400 font-mono text-[10px] border border-slate-800"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              )}

              {/* ============================================================ */}
              {/* PREVIEW TABLE */}
              {/* ============================================================ */}
              {parseResult && parseResult.previewItems.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Pré-visualização das Ofertas ({parseResult.previewItems.length})
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {validItemsToImport.length} prontas para importar
                      </span>
                      {Boolean(parseResult.duplicatesConsolidatedCount && parseResult.duplicatesConsolidatedCount > 0) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {parseResult.duplicatesConsolidatedCount} duplicatas consolidadas
                        </span>
                      )}
                    </div>

                    {/* Global Duplicate Actions */}
                    {parseResult.duplicateCount > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Ação para duplicatas:</span>
                        <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleGlobalDuplicateChange('ignore')}
                            className={cn(
                              'px-2.5 py-1 rounded-lg font-semibold text-[11px] transition cursor-pointer',
                              globalDuplicateAction === 'ignore'
                                ? 'bg-amber-500 text-slate-950 shadow'
                                : 'text-slate-400 hover:text-white'
                            )}
                          >
                            Ignorar ({parseResult.duplicateCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGlobalDuplicateChange('update')}
                            className={cn(
                              'px-2.5 py-1 rounded-lg font-semibold text-[11px] transition cursor-pointer',
                              globalDuplicateAction === 'update'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            )}
                          >
                            Atualizar ({parseResult.duplicateCount})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Table Container */}
                  <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 shadow-sm">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider z-10">
                          <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Oferta</th>
                            <th className="px-4 py-3">Anunciante</th>
                            <th className="px-4 py-3 text-center">Ads Ativos</th>
                            <th className="px-4 py-3 text-center">Data Início</th>
                            <th className="px-4 py-3">LP</th>
                            <th className="px-4 py-3 text-center">Meta Ads</th>
                            <th className="px-4 py-3">Preço</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Ação / Detalhes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {parseResult.previewItems.map((item) => {
                            const isDuplicate = item.dedupeStatus === 'EXISTING' || item.dedupeStatus === 'POSSIBLE_DUPLICATE';
                            const hasWarnings = item.warnings.length > 0;
                            const hasErrors = item.errors.length > 0;

                            return (
                              <tr
                                key={item.tempId}
                                onClick={() => setSelectedPreviewItem(item)}
                                className={cn(
                                  'hover:bg-slate-800/40 transition cursor-pointer',
                                  hasErrors && 'bg-rose-950/10'
                                )}
                              >
                                <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                  {item.index}
                                </td>

                                <td className="px-4 py-3 font-semibold text-white max-w-[220px]">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="truncate" title={item.normalized.offer_name || 'Sem nome'}>
                                      {item.normalized.offer_name || (
                                        <span className="text-amber-400/80 italic text-xs">(Sem nome)</span>
                                      )}
                                    </div>
                                    {Boolean(item.occurrenceCount && item.occurrenceCount > 1) && (
                                      <span
                                        className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        title={`${item.occurrenceCount} ocorrências unificadas`}
                                      >
                                        {item.occurrenceCount}x
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-slate-300 max-w-[150px]">
                                  <div className="truncate" title={item.normalized.advertiser || undefined}>
                                    {item.normalized.advertiser || <span className="text-slate-600">—</span>}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-center font-mono font-bold text-cyan-400">
                                  {item.normalized.active_ads_count !== null ? (
                                    item.normalized.active_ads_count
                                  ) : (
                                    <span
                                      className="cursor-help text-slate-400 hover:text-slate-200 border-b border-dotted border-slate-600"
                                      title="O arquivo informa que o anúncio estava ativo, mas não informa quantos anúncios ativos pertencem à oferta."
                                    >
                                      —
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center font-mono text-slate-300 whitespace-nowrap">
                                  {formatDateDisplay(item.normalized.oldest_ad_date)}
                                </td>

                                <td className="px-4 py-3 text-slate-300 max-w-[150px]">
                                  {item.normalized.landing_page_url ? (
                                    <a
                                      href={item.normalized.landing_page_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-blue-400 hover:underline truncate"
                                      title={item.normalized.landing_page_url}
                                    >
                                      <span className="truncate">
                                        {item.normalized.landing_page_url
                                          .replace(/^https?:\/\//i, '')
                                          .replace(/^www\./i, '')
                                          .replace(/\/$/, '')}
                                      </span>
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {item.normalized.meta_ads_url ? (
                                    <a
                                      href={item.normalized.meta_ads_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center justify-center text-emerald-400 hover:text-emerald-300 font-bold"
                                      title={`Biblioteca Meta Ads: ${item.normalized.meta_ads_url}`}
                                    >
                                      ✓
                                    </a>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>

                                <td className="px-4 py-3 font-mono text-emerald-400 whitespace-nowrap">
                                  {item.normalized.front_price !== null
                                    ? formatCurrency(item.normalized.front_price)
                                    : '—'}
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  {isDuplicate ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      <RefreshCw className="w-2.5 h-2.5" />
                                      <span>Duplicada</span>
                                    </span>
                                  ) : hasErrors ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                      title={item.errors.join('\n')}
                                    >
                                      <XCircle className="w-2.5 h-2.5" />
                                      <span>Inválida</span>
                                    </span>
                                  ) : hasWarnings ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                      title={item.warnings.join('\n')}
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      <span>Válida / Aviso</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      <span>Válida</span>
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                  {isDuplicate ? (
                                    <div className="inline-flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                      <button
                                        type="button"
                                        onClick={() => handleRowDuplicateChange(item.tempId, 'ignore')}
                                        className={cn(
                                          'px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer',
                                          item.duplicateAction === 'ignore'
                                            ? 'bg-amber-500 text-slate-950 font-bold'
                                            : 'text-slate-400 hover:text-white'
                                        )}
                                      >
                                        Ignorar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRowDuplicateChange(item.tempId, 'update')}
                                        className={cn(
                                          'px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer',
                                          item.duplicateAction === 'update'
                                            ? 'bg-blue-600 text-white font-bold'
                                            : 'text-slate-400 hover:text-white'
                                        )}
                                      >
                                        Atualizar
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPreviewItem(item)}
                                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                                      title="Ver debug de normalização e detalhes da oferta"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
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
            </>
          )}
        </div>

        {/* ================================================================== */}
        {/* MODAL FOOTER ACTION BAR */}
        {/* ================================================================== */}
        {!reportResult && (
          <div className="px-6 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/60">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {parseResult && (
                <span>
                  Total selecionado para gravação:{' '}
                  <strong className="text-white font-mono">{validItemsToImport.length}</strong> de{' '}
                  <span className="font-mono">{parseResult.previewItems.length}</span> ofertas
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSaving || !parseResult || validItemsToImport.length === 0}
                className={cn(
                  'px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition active:scale-95 shadow-lg',
                  validItemsToImport.length > 0 && !isSaving
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                )}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>IMPORTANDO...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Importar {validItemsToImport.length} Ofertas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* STRUCTURE INSPECTION MODAL */}
      {/* ================================================================== */}
      {showStructureModal && parseResult && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowStructureModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Diagnóstico de Estrutura do Documento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStructureModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Classificação Geral</span>
                <span className="text-sm font-bold text-blue-400 block">
                  {formatDocType(parseResult.detectedDocument?.type)}
                </span>
                <p className="text-slate-400 mt-1">
                  {parseResult.detectedDocument?.summary}
                </p>
              </div>

              {parseResult.candidateCollections && parseResult.candidateCollections.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Coleções Candidatas Identificadas ({parseResult.candidateCollections.length})
                  </span>
                  <div className="space-y-2">
                    {parseResult.candidateCollections.map((col) => (
                      <div
                        key={col.path}
                        className={cn(
                          'p-3 rounded-xl border text-xs flex items-center justify-between',
                          col.path === parseResult.selectedCollectionPath
                            ? 'bg-blue-950/20 border-blue-500/40'
                            : 'bg-slate-950 border-slate-800'
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="font-bold text-white">{col.path}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-blue-400">
                              {col.count} ofertas
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-amber-300">
                              Confiança: {col.confidence}
                            </span>
                          </div>
                          {col.reason && (
                            <span className="text-[11px] text-slate-400 mt-1 block">{col.reason}</span>
                          )}
                        </div>

                        {col.path !== parseResult.selectedCollectionPath && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollectionPath(col.path);
                              setShowStructureModal(false);
                              analyzeJson(currentRawContent, col.path);
                            }}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition cursor-pointer"
                          >
                            Usar Esta Coleção
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Global Metadata JSON */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Metadados Globais Isolados (Não importados como ofertas)
                </span>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto">
                  {JSON.stringify(parseResult.globalMetadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStructureModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FIELD MAPPER MODAL */}
      {/* ================================================================== */}
      {showFieldMapperModal && parseResult && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowFieldMapperModal(false)}
        >
          <div
            className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Mapeador de Campos Não Reconhecidos
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldMapperModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Associe chaves personalizadas do seu JSON aos campos canônicos do Offer Miner. O mapeamento será aplicado a todas as ofertas deste lote e salvo para futuras importações com o mesmo schema.
            </p>

            <div className="space-y-3">
              {(parseResult.unrecognizedFields || []).map((fieldPath) => {
                const leafKey = fieldPath.replace(/^\$\./, '');
                const currentVal = customFieldMap[leafKey] || 'ignore';

                return (
                  <div
                    key={fieldPath}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="font-mono text-amber-300 font-bold max-w-[200px] truncate" title={fieldPath}>
                      {fieldPath}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">→</span>
                      <select
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value as CanonicalFieldTarget;
                          setCustomFieldMap((prev) => ({
                            ...prev,
                            [leafKey]: val,
                          }));
                        }}
                        className="rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                      >
                        {TARGET_FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFieldMapperModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleApplyFieldMapping(customFieldMap)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                Aplicar a Todas as Ofertas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW DEBUG & NORMALIZATION INSPECTION MODAL */}
      {/* ================================================================== */}
      {selectedPreviewItem && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedPreviewItem(null)}
        >
          <div
            className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 font-mono">
                  Oferta #{selectedPreviewItem.index}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md">
                  {selectedPreviewItem.normalized.offer_name || 'Oferta sem nome'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewItem(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInspectorTab('detected')}
                className={cn(
                  'px-3 py-1.5 rounded-xl transition cursor-pointer',
                  inspectorTab === 'detected'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Campos Detectados & Origem
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('normalized')}
                className={cn(
                  'px-3 py-1.5 rounded-xl transition cursor-pointer',
                  inspectorTab === 'normalized'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Oferta Normalizada
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('raw')}
                className={cn(
                  'px-3 py-1.5 rounded-xl transition cursor-pointer',
                  inspectorTab === 'raw'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                JSON Original
              </button>
            </div>

            {/* TAB 1: DETECTED FIELDS & ORIGIN PATHS */}
            {inspectorTab === 'detected' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Rastreamento de Origem dos Dados (Dot-Paths)
                </span>

                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="px-3 py-2">Campo Canônico</th>
                        <th className="px-3 py-2">Valor Normalizado</th>
                        <th className="px-3 py-2 font-mono">Origem no JSON (Path)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Nome da Oferta</td>
                        <td className="px-3 py-2 text-white font-sans">{selectedPreviewItem.normalized.offer_name || '—'}</td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.offer_name || '$.offer_name'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Anunciante</td>
                        <td className="px-3 py-2 text-white font-sans">{selectedPreviewItem.normalized.advertiser || '—'}</td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.advertiser || '$.advertiser'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Nicho</td>
                        <td className="px-3 py-2 text-white font-sans">{selectedPreviewItem.normalized.niche || '—'}</td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.niche || '$.niche'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Ads Ativos</td>
                        <td className="px-3 py-2 text-cyan-400 font-bold">{selectedPreviewItem.normalized.active_ads_count ?? 'null'}</td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.active_ads_count || '$.active_ads_count'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Criativos Distintos</td>
                        <td className="px-3 py-2 text-purple-400 font-bold">{selectedPreviewItem.normalized.unique_creatives_count ?? 'null'}</td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.unique_creatives_count || '$.unique_creatives_count'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Preço Front</td>
                        <td className="px-3 py-2 text-emerald-400 font-bold">
                          {selectedPreviewItem.normalized.front_price !== null ? `R$ ${selectedPreviewItem.normalized.front_price}` : 'null'}
                        </td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.front_price || '$.front_price'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Landing Page URL</td>
                        <td className="px-3 py-2 text-blue-400 truncate max-w-xs" title={selectedPreviewItem.normalized.landing_page_url || ''}>
                          {selectedPreviewItem.normalized.landing_page_url || 'null'}
                        </td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.landing_page_url || '$.landing_page_url'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-sans text-slate-300 font-semibold">Checkout URL</td>
                        <td className="px-3 py-2 text-emerald-400 truncate max-w-xs" title={selectedPreviewItem.normalized.checkout_url || ''}>
                          {selectedPreviewItem.normalized.checkout_url || 'null'}
                        </td>
                        <td className="px-3 py-2 text-cyan-400">{selectedPreviewItem.sourceFieldMap?.checkout_url || '$.checkout_url'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: NORMALIZED OBJECT BREAKDOWN */}
            {inspectorTab === 'normalized' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Anúncios Ativos</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {selectedPreviewItem.normalized.active_ads_count ?? 'null'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Criativos Distintos</span>
                    <span className="font-mono text-purple-400 font-bold">
                      {selectedPreviewItem.normalized.unique_creatives_count ?? 'null'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Preço Front</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {selectedPreviewItem.normalized.front_price !== null
                        ? `R$ ${selectedPreviewItem.normalized.front_price}`
                        : 'null'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Dias Rodando</span>
                    <span className="font-mono text-slate-300 font-bold">
                      {selectedPreviewItem.normalized.days_running ?? 'null'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nicho:</span>
                    <span className="text-white font-semibold">{selectedPreviewItem.normalized.niche || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subnicho:</span>
                    <span className="text-white font-semibold">{selectedPreviewItem.normalized.subniche || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Formato do Produto:</span>
                    <span className="text-white font-semibold">{selectedPreviewItem.normalized.product_format || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Faceless (Sem Rosto):</span>
                    <span className="text-white font-semibold">
                      {selectedPreviewItem.normalized.faceless === null ? '—' : selectedPreviewItem.normalized.faceless ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Origem:</span>
                    <span className="text-slate-300 font-mono">{selectedPreviewItem.normalized.source}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: RAW JSON */}
            {inspectorTab === 'raw' && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  JSON Bruto do Registro
                </span>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedPreviewItem.raw, null, 2)}
                </pre>
              </div>
            )}

            {/* Diagnostics Alerts (Always visible at bottom) */}
            {selectedPreviewItem.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                <span className="font-bold block text-rose-200">Erros de Validação:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {selectedPreviewItem.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPreviewItem.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <span className="font-bold block text-amber-200">Avisos de Integridade:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {selectedPreviewItem.warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPreviewItem(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Repair Details Modal */}
      {showRepairsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <span>⚡</span>
                <span>Correções Realizadas no JSON</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRepairsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                O Offer Miner detectou um formato não estrito e aplicou as seguintes correções seguras:
              </p>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                {parseResult?.repairs && parseResult.repairs.length > 0 ? (
                  parseResult.repairs.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-emerald-400">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                      <span className="text-slate-200 font-medium">{r}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-slate-200">Sintaxe JSON normalizada com sucesso.</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Nenhum valor ou oferta foi inventado. Apenas a sintaxe e padrões de formatação foram recuperados.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowRepairsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
