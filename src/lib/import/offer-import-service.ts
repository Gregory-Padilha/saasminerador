// ==============================================================================
// OFFER MINER - CENTRALIZED OFFER IMPORT SERVICE
// ==============================================================================

import { Offer, UserSettings, DuplicateAction, ValidationDetail } from '@/types';
import {
  NormalizedOfferImportRecord,
  ImportPreviewItem,
  JsonParseResult,
  ImportBatchType,
  ImportBatchExecutionResult,
  ImportDedupeStatus,
} from './types';
import { JsonOfferImportAdapter } from './adapters/json-adapter';
import { generateDedupeKey } from '../deduplication';
import { validateOffer, DEFAULT_VALIDATION_SETTINGS } from '../validation';
import { calculateDiscoveryScore } from '../scoring';
import { dbService } from '../supabase/db';

function cleanToken(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanUrl(url?: string | null): string {
  if (!url) return '';
  const lower = url.trim().toLowerCase().replace(/\/$/, '');
  if (lower.includes('facebook.com/ads/library') || lower.includes('meta.com/ads/library')) {
    try {
      const parsed = new URL(url);
      const adId = parsed.searchParams.get('id');
      if (adId) {
        return `${parsed.origin}${parsed.pathname}?id=${adId}`.toLowerCase();
      }
    } catch {
      return lower;
    }
  }
  return lower.split('?')[0].replace(/\/$/, '').trim();
}

import {
  consolidateBatchRecords,
  detectDuplicateMultiLevel,
  canonicalOfferFingerprint,
} from './dedupe';

/**
 * Multi-signal deduplication check matching candidate against existing database offers.
 */
export function detectDuplicate(
  candidate: NormalizedOfferImportRecord,
  existingOffers: Offer[]
): {
  status: ImportDedupeStatus;
  existingOffer: Offer | null;
  matchReason?: string;
  fingerprint?: string;
} {
  return detectDuplicateMultiLevel(candidate, existingOffers);
}

export class OfferImportService {
  // Idempotency cache: prevents duplicate processing on double-click, network retry, or StrictMode
  private static idempotencyCache = new Map<string, ImportBatchExecutionResult>();

  /**
   * Clears the idempotency cache (useful for testing and teardowns).
   */
  static clearIdempotencyCache(): void {
    OfferImportService.idempotencyCache.clear();
  }

  /**
   * Processes a JSON text payload through parsing, normalization, deduplication, and validation.
   */
  static processJson(
    rawText: string,
    existingOffers: Offer[] = [],
    settings: UserSettings = DEFAULT_VALIDATION_SETTINGS,
    options?: {
      targetCollectionPath?: string;
      customFieldMap?: Record<string, any>;
    }
  ): JsonParseResult {
    const parseResult = JsonOfferImportAdapter.parse(rawText, options);

    if (!parseResult.success) {
      return {
        success: false,
        records: [],
        previewItems: [],
        ignoredFieldsSummary: [],
        isOfferMinerExport: false,
        errorMessage: parseResult.errorMessage,
        errorPosition: parseResult.errorPosition,
        totalCount: 0,
        validCount: 0,
        warningCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        duplicatesConsolidatedCount: 0,
        detectedDocument: parseResult.detectedDocument,
        candidateCollections: parseResult.candidateCollections,
        selectedCollectionPath: parseResult.selectedCollectionPath,
        globalMetadata: parseResult.globalMetadata,
        recognizedFieldsCount: 0,
        unrecognizedFieldsCount: 0,
        unrecognizedFields: [],
      };
    }

    // --------------------------------------------------------------------------
    // LEVEL 2 DEDUPLICATION: Within-Batch Consolidation
    // Groups multiple occurrences of the exact same offer in the incoming document.
    // --------------------------------------------------------------------------
    const consolidation = consolidateBatchRecords(
      parseResult.records,
      parseResult.normalizationReports
    );
    const consolidatedItems = consolidation.consolidatedItems;
    const duplicatesConsolidatedCount = consolidation.duplicatesConsolidatedCount;

    let validCount = 0;
    let warningCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    const previewItems: ImportPreviewItem[] = [];

    consolidatedItems.forEach((cItem, idx) => {
      const record = cItem.record;
      const normReport = cItem.report;
      const tempId = `preview_${idx}_${Date.now()}`;

      // ------------------------------------------------------------------------
      // LEVEL 3 DEDUPLICATION: Multi-Signal Database Comparison
      // ------------------------------------------------------------------------
      const dedupeInfo = detectDuplicateMultiLevel(record, existingOffers);
      const isDuplicate =
        dedupeInfo.status === 'EXISTING' || dedupeInfo.status === 'POSSIBLE_DUPLICATE';

      // Validation check
      const validation = validateOffer(
        {
          product_name: record.offer_name,
          advertiser: record.advertiser,
          price: record.front_price,
          active_ads_count: record.active_ads_count,
          days_running: record.days_running,
          landing_page_url: record.landing_page_url,
          meta_ads_url: record.meta_ads_url,
          niche: record.niche,
          faceless: record.faceless,
        },
        settings
      );

      // Merge normalization warnings and errors into validation
      if (normReport.warnings.length > 0) {
        normReport.warnings.forEach((w) => {
          if (!validation.warnings.includes(w)) validation.warnings.push(w);
        });
      }
      if (normReport.errors.length > 0) {
        normReport.errors.forEach((e) => {
          if (!validation.reasons.includes(e)) validation.reasons.push(e);
        });
        validation.isValid = false;
        validation.status = 'INVALIDA';
      }

      // If multiple occurrences were consolidated within this batch, add an informational notice
      if (cItem.occurrenceCount > 1) {
        const badgeMsg = `${cItem.occurrenceCount} ocorrências consolidadas no documento JSON.`;
        if (!validation.warnings.includes(badgeMsg)) {
          validation.warnings.push(badgeMsg);
        }
      }

      if (isDuplicate) {
        duplicateCount++;
      } else if (!validation.isValid) {
        invalidCount++;
      } else if (validation.warnings.length > 0) {
        warningCount++;
      } else {
        validCount++;
      }

      const dedupeKey = generateDedupeKey({
        product_name: record.offer_name,
        advertiser: record.advertiser,
        landing_page_url: record.landing_page_url,
      });

      // Default duplicate action: 'ignore' (user can toggle to 'update')
      const defaultDuplicateAction: DuplicateAction = 'ignore';

      previewItems.push({
        tempId,
        index: idx + 1,
        raw: record.raw_data,
        normalized: record,
        dedupe_key: dedupeKey,
        fingerprint: cItem.fingerprint,
        dedupeStatus: dedupeInfo.status,
        matchReason: dedupeInfo.matchReason,
        existingOffer: dedupeInfo.existingOffer,
        duplicateAction: defaultDuplicateAction,
        validation,
        ignoredFields: normReport.ignoredFields,
        warnings: validation.warnings,
        errors: validation.reasons,
        sourceFieldMap: normReport.sourceFieldMap,
        occurrenceCount: cItem.occurrenceCount,
        originalIndices: cItem.originalIndices,
      });
    });

    // --------------------------------------------------------------------------
    // PREPARED IMPORT PLAN: PREVIEW STRICTLY MATCHES COMMIT
    // --------------------------------------------------------------------------
    const preparedPlan = {
      planId: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      newRecords: previewItems.filter((p) => p.dedupeStatus === 'NEW' && p.validation.isValid),
      updates: previewItems.filter(
        (p) =>
          (p.dedupeStatus === 'EXISTING' || p.dedupeStatus === 'POSSIBLE_DUPLICATE') &&
          p.duplicateAction === 'update'
      ),
      duplicates: previewItems.filter(
        (p) =>
          (p.dedupeStatus === 'EXISTING' || p.dedupeStatus === 'POSSIBLE_DUPLICATE') &&
          p.duplicateAction === 'ignore'
      ),
      invalid: previewItems.filter((p) => !p.validation.isValid),
      warnings: previewItems.flatMap((p) => p.warnings),
      totalRawRecords: parseResult.records.length,
      totalConsolidatedRecords: previewItems.length,
    };

    return {
      success: true,
      records: consolidatedItems.map((c) => c.record),
      previewItems,
      preparedPlan,
      ignoredFieldsSummary: parseResult.ignoredFieldsSummary,
      isOfferMinerExport: parseResult.isOfferMinerExport,
      exportType: parseResult.exportType,
      schemaVersion: parseResult.schemaVersion,
      totalCount: previewItems.length,
      validCount,
      warningCount,
      invalidCount,
      duplicateCount,
      duplicatesConsolidatedCount,
      detectedDocument: parseResult.detectedDocument,
      candidateCollections: parseResult.candidateCollections,
      selectedCollectionPath: parseResult.selectedCollectionPath,
      globalMetadata: parseResult.globalMetadata,
      recognizedFieldsCount: parseResult.recognizedFieldsCount,
      unrecognizedFieldsCount: parseResult.unrecognizedFieldsCount,
      unrecognizedFields: parseResult.unrecognizedFields,
      isRepaired: parseResult.isRepaired,
      isSequenceOfObjects: parseResult.isSequenceOfObjects,
      repairedJsonText: parseResult.repairedJsonText,
      repairs: parseResult.repairs,
    };
  }

  /**
   * Persists preview items safely into the database via executeImportBatch.
   *
   * CRITICAL BUSINESS INVARIANTS:
   * 1. IDEMPOTENCY:
   *    - Uses clientImportRequestId to guarantee double-clicks and retries return cached result.
   * 2. PERSISTENCE GATE:
   *    - Rejects offers without minimum identity (no name, no LP, no Meta Ads, no checkout).
   *    - Strictly forbids persisting placeholder "Oferta Sem Nome".
   * 3. NEW OFFERS:
   *    - lp_mapping_status: 'NOT_MAPPED'
   *    - checkout_discovery_status: 'NOT_PROCESSED'
   *    - checkout_mapping_status: 'NOT_MAPPED'
   * 4. EXISTING OFFERS:
   *    - If duplicateAction === 'update', preserves existing valid mappings (e.g. lp_mapping_status: 'SUCCESS').
   * 5. SEPARATION:
   *    - active_ads_count and unique_creatives_count are stored separately.
   */
  static async executeImport(params: {
    batchType: ImportBatchType;
    fileName?: string | null;
    previewItems: ImportPreviewItem[];
    existingOffers?: Offer[];
    globalMetadata?: Record<string, any>;
    clientImportRequestId?: string;
  }): Promise<ImportBatchExecutionResult> {
    const {
      batchType,
      fileName,
      previewItems,
      existingOffers = [],
      globalMetadata,
      clientImportRequestId,
    } = params;

    // Idempotency Guard: if this exact request ID was already processed, return previous result
    if (clientImportRequestId && OfferImportService.idempotencyCache.has(clientImportRequestId)) {
      return OfferImportService.idempotencyCache.get(clientImportRequestId)!;
    }

    const displayFileName =
      fileName || (batchType === 'JSON_PASTE' ? 'Texto colado via JSON' : 'importacao_ofertas.json');

    // If running in browser environment, dispatch to server-authoritative API route
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/offers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchType,
          fileName: displayFileName,
          previewItems,
          globalMetadata,
          clientImportRequestId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha na persistência da importação no servidor.');
      }

      const data = await res.json();
      const executionResult: ImportBatchExecutionResult = data.result;

      // Authoritatively update client local storage with returned canonical offers
      if (Array.isArray(data.persistedOffers) && data.persistedOffers.length > 0) {
        let localOffers = dbService.getLocalOffersSync();
        const newIds = new Set(data.persistedOffers.map((o: Offer) => o.id));
        localOffers = [...data.persistedOffers, ...localOffers.filter((o: Offer) => !newIds.has(o.id))];
        localOffers.sort((a: Offer, b: Offer) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        dbService.setLocalOffersSync(localOffers);
      }

      // Notify global offer events
      try {
        const { offerEvents } = await import('@/lib/events/offer-events');
        offerEvents.notifyGlobalSync('json_import');
      } catch {}

      if (clientImportRequestId) {
        OfferImportService.idempotencyCache.set(clientImportRequestId, executionResult);
      }

      return executionResult;
    }

    // Convert preview items into ImportPreviewRow format expected by executeImportBatch
    const rowsToImport = previewItems.map((item) => {
      const norm = item.normalized;
      const isDuplicate =
        item.dedupeStatus === 'EXISTING' || item.dedupeStatus === 'POSSIBLE_DUPLICATE';

      // Score calculation
      const discoveryBreakdown = calculateDiscoveryScore({
        product_name: norm.offer_name,
        price: norm.front_price,
        active_ads_count: norm.active_ads_count,
        days_running: norm.days_running,
        advertiser: norm.advertiser,
        niche: norm.niche,
        landing_page_url: norm.landing_page_url,
      });

      return {
        tempId: item.tempId,
        rowIndex: item.index,
        sheetName: 'JSON_IMPORT',
        raw: item.raw,
        normalized: {
          product_name: norm.offer_name || null,
          advertiser: norm.advertiser || null,
          niche: norm.niche,
          subniche: norm.subniche,
          product_type: norm.product_type,
          price: norm.front_price,
          currency: norm.currency,
          active_ads_count: norm.active_ads_count,
          estimated_unique_creatives: norm.unique_creatives_count,
          unique_creatives_count: norm.unique_creatives_count,
          oldest_ad_date: norm.oldest_ad_date,
          newest_ad_date: norm.newest_ad_date,
          days_running: norm.days_running,
          faceless: norm.faceless,
          meta_ads_url: norm.meta_ads_url,
          landing_page_url: norm.landing_page_url,
          landing_page_url_original: norm.landing_page_url,
          landing_page_url_source: (norm.landing_page_url ? 'MANUAL' : 'NONE') as any,
          landing_page_url_status: (norm.landing_page_url ? 'PENDING' : 'NEEDS_MANUAL_URL') as any,
          checkout_url: norm.checkout_url,
          headline: norm.headline,
          subheadline: norm.subheadline,
          ad_format: norm.product_format,
          notes: norm.notes,
          score: norm.score,
          work_score: norm.score,
          source: batchType === 'JSON_PASTE' ? 'JSON_PASTE' : 'JSON_IMPORT',
        } as Partial<Offer>,
        extraData: {
          ...norm.extra_data,
          import_source_type: batchType,
          meta_page_id: norm.meta_page_id,
          batch_row_fingerprint: item.fingerprint,
          occurrence_count: item.occurrenceCount || 1,
        },
        dedupe_key: item.dedupe_key,
        isDuplicate,
        duplicateOfferId: item.existingOffer?.id,
        existingOffer: item.existingOffer,
        duplicateAction: item.duplicateAction,
        validation: item.validation,
        system_score: discoveryBreakdown.total,
        hasErrors: !item.validation.isValid,
        errors: item.errors,
      };
    });

    const result = await dbService.executeImportBatch(displayFileName, rowsToImport, 1, {
      import_type: batchType,
      metadata: globalMetadata,
    });

    const executionResult: ImportBatchExecutionResult = {
      batchId: result.batch.id,
      fileName: displayFileName,
      type: batchType,
      totalRecords: previewItems.length,
      newOffersCount: result.newCount,
      updatedOffersCount: result.updatedCount,
      ignoredDuplicatesCount: result.ignoredCount,
      invalidCount: result.batch.invalid_rows,
      errorsList: previewItems
        .filter((p) => p.errors.length > 0)
        .map((p) => ({
          index: p.index,
          name: p.normalized.offer_name || '<<Sem Nome>>',
          message: p.errors.join('; '),
        })),
    };

    // Cache result if idempotency key was supplied
    if (clientImportRequestId) {
      OfferImportService.idempotencyCache.set(clientImportRequestId, executionResult);
    }

    return executionResult;
  }

  /**
   * Persists a single normalized record directly as a canonical Offer with read-after-write verification.
   */
  static async persistNormalizedOffer(
    record: NormalizedOfferImportRecord,
    importContext: {
      batchId?: string;
      rowId?: string;
      fileName?: string;
      rowIndex?: number;
      sheetName?: string;
      source?: string;
    } = {}
  ): Promise<{ offer: Offer; verified: boolean }> {
    const { resolveImportedOfferName } = await import('./offer-name-resolver');
    const resolved = resolveImportedOfferName(record.raw_data, record);
    const offerName = (resolved.offerName || record.offer_name || '').trim();
    if (!offerName) {
      throw new Error('Não é permitido persistir uma oferta sem nome canônico válido.');
    }

    const advertiser = record.advertiser || resolved.advertiser || null;
    const batchType: ImportBatchType = (importContext.source as any) || 'JSON_PASTE';

    const tempPreviewItem: ImportPreviewItem = {
      tempId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      index: importContext.rowIndex || 1,
      raw: record.raw_data || {},
      normalized: {
        ...record,
        offer_name: offerName,
        advertiser,
      },
      dedupe_key: `${offerName}_${advertiser || ''}`,
      fingerprint: `${offerName}_${advertiser || ''}`,
      dedupeStatus: 'NEW',
      duplicateAction: 'ignore',
      validation: { isValid: true, status: 'VALIDADA', reasons: [], warnings: [] },
      ignoredFields: [],
      warnings: [],
      errors: [],
      occurrenceCount: 1,
      originalIndices: [importContext.rowIndex || 1],
    };

    const batchResult = await OfferImportService.executeImport({
      batchType,
      fileName: importContext.fileName || 'importacao_individual.json',
      previewItems: [tempPreviewItem],
    });

    const allOffers = await dbService.getOffers();
    const savedOffer = allOffers.find((o) => o.source_import_batch_id === batchResult.batchId);
    if (!savedOffer) {
      throw new Error(`FAILED_PERSISTENCE: Falha na verificação read-after-write para a oferta '${offerName}'.`);
    }

    return {
      offer: savedOffer,
      verified: true,
    };
  }
}
