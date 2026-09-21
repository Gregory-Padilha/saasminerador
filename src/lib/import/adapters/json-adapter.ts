// ==============================================================================
// OFFER MINER - JSON OFFER IMPORT ADAPTER (INTELLIGENT DOCUMENT PIPELINE)
// ==============================================================================

import {
  NormalizedOfferImportRecord,
  NormalizationReport,
} from '../types';
import { normalizeOfferImportRecord, STRUCTURAL_EXPORT_KEYS } from '../normalizer';
import {
  detectJsonDocumentType,
  hasOfferIdentitySignals,
  DocumentDetectionResult,
} from '../document-detector';
import {
  extractOfferCollections,
  getInheritableMetadata,
  CandidateCollection,
} from '../collection-extractor';
import { applyFieldMapping, CustomFieldMap } from '../field-mapper';
import { smartRepairJson } from '../smart-json-ingestion';

export interface JsonAdapterParseResult {
  success: boolean;
  records: NormalizedOfferImportRecord[];
  normalizationReports: NormalizationReport[];
  isOfferMinerExport: boolean;
  exportType?: string;
  schemaVersion?: string;
  ignoredFieldsSummary: string[];
  totalExtracted: number;
  errorMessage?: string;
  errorPosition?: {
    line: number;
    column: number;
    snippet?: string;
  };
  detectedDocument: DocumentDetectionResult;
  candidateCollections: CandidateCollection[];
  selectedCollectionPath?: string;
  globalMetadata: Record<string, any>;
  recognizedFieldsCount: number;
  unrecognizedFieldsCount: number;
  unrecognizedFields: string[];
  isRepaired?: boolean;
  isSequenceOfObjects?: boolean;
  repairedJsonText?: string;
  repairs?: string[];
}

const MAX_JSON_STRING_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_OFFERS_PER_BATCH = 500;

/**
 * Extracts line and column from JSON parse error message or text position.
 */
function extractErrorCoordinates(
  err: any,
  rawJson: string
): { line: number; column: number; snippet?: string } | undefined {
  if (!err) return undefined;

  const msg = String(err.message || '');
  let pos: number | null = null;

  const posMatch = msg.match(/position\s+(\d+)/i);
  if (posMatch) {
    pos = parseInt(posMatch[1], 10);
  }

  const lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    const line = parseInt(lineColMatch[1], 10);
    const col = parseInt(lineColMatch[2], 10);
    return { line, column: col };
  }

  if (pos !== null && !isNaN(pos) && pos >= 0 && pos <= rawJson.length) {
    const lines = rawJson.substring(0, pos).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    const start = Math.max(0, pos - 25);
    const end = Math.min(rawJson.length, pos + 25);
    const snippet = rawJson.substring(start, end);

    return { line, column, snippet };
  }

  return undefined;
}

export class JsonOfferImportAdapter {
  /**
   * Parses raw JSON text through the intelligent Document Detector -> Collection Extractor -> Normalizer pipeline.
   */
  static parse(
    rawText: string,
    options?: {
      targetCollectionPath?: string;
      customFieldMap?: CustomFieldMap;
    }
  ): JsonAdapterParseResult {
    const trimmed = (rawText || '').trim();

    const emptyFallbackDetection: DocumentDetectionResult = {
      type: 'UNKNOWN',
      hasIdentitySignals: false,
      confidence: 'LOW',
      summary: 'Vazio',
      metadataFields: [],
    };

    if (!trimmed) {
      return {
        success: false,
        records: [],
        normalizationReports: [],
        isOfferMinerExport: false,
        ignoredFieldsSummary: [],
        totalExtracted: 0,
        errorMessage: 'O conteúdo JSON está vazio.',
        detectedDocument: emptyFallbackDetection,
        candidateCollections: [],
        globalMetadata: {},
        recognizedFieldsCount: 0,
        unrecognizedFieldsCount: 0,
        unrecognizedFields: [],
      };
    }

    // 1. Size Limit Check
    if (trimmed.length > MAX_JSON_STRING_BYTES) {
      return {
        success: false,
        records: [],
        normalizationReports: [],
        isOfferMinerExport: false,
        ignoredFieldsSummary: [],
        totalExtracted: 0,
        errorMessage: `Tamanho do arquivo excede o limite máximo permitido de 10 MB (${(trimmed.length / (1024 * 1024)).toFixed(1)} MB).`,
        detectedDocument: emptyFallbackDetection,
        candidateCollections: [],
        globalMetadata: {},
        recognizedFieldsCount: 0,
        unrecognizedFieldsCount: 0,
        unrecognizedFields: [],
      };
    }

    // 2. Smart JSON Parse & Repair
    const repairResult = smartRepairJson(trimmed);
    if (!repairResult.success) {
      const coords = extractErrorCoordinates(new Error(repairResult.error || ''), trimmed);
      const positionText = coords ? ` na linha ${coords.line}, coluna ${coords.column}` : '';
      return {
        success: false,
        records: [],
        normalizationReports: [],
        isOfferMinerExport: false,
        ignoredFieldsSummary: [],
        totalExtracted: 0,
        errorMessage: `JSON inválido${positionText}: ${repairResult.error || 'Formato não pôde ser reparado.'}`,
        errorPosition: coords,
        detectedDocument: emptyFallbackDetection,
        candidateCollections: [],
        globalMetadata: {},
        recognizedFieldsCount: 0,
        unrecognizedFieldsCount: 0,
        unrecognizedFields: [],
      };
    }

    const parsed = repairResult.data;
    const isRepaired = repairResult.isRepaired;
    const isSequenceOfObjects = repairResult.isSequenceOfObjects || false;
    const repairedJsonText = repairResult.repairedJsonText || trimmed;
    const repairs = repairResult.repairDetails?.corrections || [];

    // 3. Document Type Detection
    const detectedDocument = detectJsonDocumentType(parsed, { isSequenceOfObjects });

    // 4. Locate and Extract Offer Collections
    const extraction = extractOfferCollections(parsed, options?.customFieldMap);
    const candidateCollections = extraction.candidateCollections;
    let selectedCollection = extraction.selectedCollection;

    // If user specified a preferred collection path:
    if (options?.targetCollectionPath) {
      const userChoice = candidateCollections.find((c) => c.path === options.targetCollectionPath);
      if (userChoice) {
        selectedCollection = userChoice;
      }
    }

    const topLevelIgnoredKeys = new Set<string>();

    // Determine raw candidate items
    let rawCandidateItems: any[] = [];
    let selectedCollectionPath = selectedCollection?.path;

    if (
      detectedDocument.type === 'OFFER_MINER_EXPORT' &&
      parsed.offerFacts &&
      typeof parsed.offerFacts === 'object'
    ) {
      // Offer Miner context package export: offerFacts is the canonical offer
      rawCandidateItems = [parsed.offerFacts];
      selectedCollectionPath = '$.offerFacts';
    } else if (selectedCollection && selectedCollection.records.length > 0) {
      rawCandidateItems = selectedCollection.records;
    } else if (
      detectedDocument.type === 'SINGLE_OFFER' &&
      hasOfferIdentitySignals(parsed)
    ) {
      // Valid single offer
      rawCandidateItems = [parsed];
      selectedCollectionPath = '$';
    } else {
      // NO valid offer collection was found and root is NOT a single offer
      // INVARIANT: NEVER treat arbitrary metadata root as an offer!
      rawCandidateItems = [];
    }

    // Collect top-level ignored structural keys
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const k of Object.keys(parsed)) {
        if (STRUCTURAL_EXPORT_KEYS.has(k)) {
          topLevelIgnoredKeys.add(k);
        }
      }
    }

    // 5. Batch Count Limit Check
    if (rawCandidateItems.length > MAX_OFFERS_PER_BATCH) {
      return {
        success: false,
        records: [],
        normalizationReports: [],
        isOfferMinerExport: detectedDocument.type === 'OFFER_MINER_EXPORT',
        exportType: detectedDocument.exportType,
        schemaVersion: detectedDocument.schemaVersion,
        ignoredFieldsSummary: Array.from(topLevelIgnoredKeys),
        totalExtracted: rawCandidateItems.length,
        errorMessage: `O lote contém ${rawCandidateItems.length} ofertas, o que excede o limite máximo de ${MAX_OFFERS_PER_BATCH} ofertas por importação.`,
        detectedDocument,
        candidateCollections,
        selectedCollectionPath,
        globalMetadata: extraction.globalMetadata,
        recognizedFieldsCount: 0,
        unrecognizedFieldsCount: 0,
        unrecognizedFields: [],
      };
    }

    // 6. Inheritable Metadata Extraction (country, language, currency)
    const inheritableMeta = getInheritableMetadata(extraction.globalMetadata);

    // 7. Normalize Each Item
    const records: NormalizedOfferImportRecord[] = [];
    const normalizationReports: NormalizationReport[] = [];
    const allIgnoredKeys = new Set<string>(topLevelIgnoredKeys);
    const allRecognizedPaths = new Set<string>();
    const allUnrecognizedPaths = new Set<string>();

    rawCandidateItems.forEach((rawItem) => {
      // Apply custom field mapping if present
      const mappedItem = options?.customFieldMap
        ? applyFieldMapping(rawItem, options.customFieldMap)
        : rawItem;

      const report = normalizeOfferImportRecord(mappedItem, inheritableMeta);
      records.push(report.record);
      normalizationReports.push(report);

      report.ignoredFields.forEach((k) => allIgnoredKeys.add(k));
      report.recognizedFields?.forEach((p) => allRecognizedPaths.add(p));
      report.unrecognizedFields?.forEach((p) => allUnrecognizedPaths.add(p));
    });

    const isOfferMinerExport =
      detectedDocument.type === 'OFFER_MINER_EXPORT' ||
      Boolean(detectedDocument.exportType || detectedDocument.schemaVersion);

    if (isSequenceOfObjects || isRepaired) {
      candidateCollections.forEach((c) => {
        if (c.path === '$') {
          c.reason = 'Raiz reparada ($)';
        }
      });
      if (detectedDocument.type === 'OFFER_ARRAY') {
        detectedDocument.summary = isSequenceOfObjects
          ? `Sequência de ${records.length} ofertas recuperada com sucesso.`
          : detectedDocument.summary;
      }
    }

    return {
      success: true,
      records,
      normalizationReports,
      isOfferMinerExport,
      exportType: detectedDocument.exportType,
      schemaVersion: detectedDocument.schemaVersion,
      ignoredFieldsSummary: Array.from(allIgnoredKeys),
      totalExtracted: records.length,
      detectedDocument,
      candidateCollections,
      selectedCollectionPath,
      globalMetadata: extraction.globalMetadata,
      recognizedFieldsCount: allRecognizedPaths.size,
      unrecognizedFieldsCount: allUnrecognizedPaths.size,
      unrecognizedFields: Array.from(allUnrecognizedPaths),
      isRepaired,
      isSequenceOfObjects,
      repairedJsonText,
      repairs,
    };
  }
}
