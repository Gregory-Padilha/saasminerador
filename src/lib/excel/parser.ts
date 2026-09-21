// ==============================================================================
// OFFER MINER - ROBUST MULTI-SHEET EXCEL PARSER (MATRIX-FIRST & SMART HEADERS)
// ==============================================================================

import * as XLSX from 'xlsx';
import {
  Offer,
  ImportPreviewRow,
  ImportSummary,
  UserSettings,
  ParseResult,
  SheetParseInfo,
  RawSheetData,
  DetectedHeaderInfo,
} from '@/types';
import { matchColumnWithConfidence, normalizeHeader, SYSTEM_COLUMNS } from './aliases';
import { detectHeaderRow } from './headerDetector';
import {
  normalizePrice,
  normalizeAdsCount,
  normalizeDaysRunning,
  normalizeFaceless,
  normalizeScore,
  normalizeUrl,
  normalizeDate,
  normalizeText,
  classifyUrl,
  extractHostname,
} from '../normalization';
import { generateDedupeKey, findDuplicateOffer } from '../deduplication';
import { validateOffer, DEFAULT_VALIDATION_SETTINGS } from '../validation';
import { calculateDiscoveryScore } from '../scoring';
import { calculateDaysRunning } from '../utils';
import { LandingPageResolutionSource } from '@/types';

/**
 * Parses all sheets in an Excel (.xlsx, .xls) or CSV buffer using a matrix-first approach.
 * Detects headers with scoring, preserves hyperlinks and 100% of raw cells.
 */
export async function parseSpreadsheet(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  existingOffers: Offer[] = [],
  settings: UserSettings = DEFAULT_VALIDATION_SETTINGS,
  customMapping?: Record<string, string>,
  customHeaderRowIndex?: number
): Promise<ParseResult> {
  const dataArray = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const workbook = XLSX.read(dataArray, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const allSheetNames = workbook.SheetNames || [];
  if (allSheetNames.length === 0) {
    throw new Error('O arquivo enviado não contém nenhuma planilha.');
  }

  const sheetsInfo: SheetParseInfo[] = [];
  const rawSheetsData: RawSheetData[] = [];
  const allHeadersSet = new Set<string>();
  const columnMappingDetails: Record<string, { key: string | null; confidence: number; label: string }> = {};
  const previewRows: ImportPreviewRow[] = [];

  let readyCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let errorCount = 0;
  let firstDetectedHeaderIndex = 0;

  // 1. Process each sheet
  for (const sheetName of allSheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert sheet to 2D matrix
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    });

    if (!matrix || matrix.length === 0) continue;

    // Detect header row (or use custom override)
    const headerDetection = detectHeaderRow(matrix);
    const headerRowIndex =
      customHeaderRowIndex !== undefined && customHeaderRowIndex >= 0 && customHeaderRowIndex < matrix.length
        ? customHeaderRowIndex
        : headerDetection.headerRowIndex;

    firstDetectedHeaderIndex = headerRowIndex;

    const rawHeaderRow = matrix[headerRowIndex] || [];
    const headersList: string[] = [];

    rawHeaderRow.forEach((cell: any, colIdx: number) => {
      const headerStr = cell !== null && cell !== undefined ? String(cell).trim() : '';
      const finalHeader = headerStr.length > 0 ? headerStr : `Coluna_${colIdx + 1}`;
      headersList.push(finalHeader);
      allHeadersSet.add(finalHeader);
    });

    if (headersList.length === 0) continue;

    // Build header info objects
    const detectedHeadersInfo: DetectedHeaderInfo[] = headersList.map((original, index) => {
      const isCustomMapped = Boolean(customMapping && Object.prototype.hasOwnProperty.call(customMapping, original));
      let mappedField: string | null = null;
      let confidence = 0;
      let label = 'Salvar em extra_data';

      if (isCustomMapped) {
        const customVal = customMapping![original];
        if (customVal && customVal !== '' && customVal !== 'extra_data' && customVal !== 'ignore') {
          mappedField = customVal;
          label = SYSTEM_COLUMNS.find((c) => c.key === customVal)?.label || customVal;
        }
        confidence = 100;
      } else {
        const match = matchColumnWithConfidence(original);
        mappedField = match.key;
        confidence = match.confidence;
        label = match.label;
      }

      columnMappingDetails[original] = {
        key: mappedField,
        confidence,
        label,
      };

      return {
        original,
        normalized: normalizeHeader(original),
        index,
        mappedField,
        confidence,
        label,
      };
    });

    // Extract data rows after header
    const dataMatrix = matrix.slice(headerRowIndex + 1);
    const sheetRawRows: Record<string, any>[] = [];

    dataMatrix.forEach((rowArray, idx) => {
      if (!rowArray || !Array.isArray(rowArray)) return;

      // Skip completely empty rows
      const hasAnyData = rowArray.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '');
      if (!hasAnyData) return;

      const rowIndex = headerRowIndex + 2 + idx; // 1-indexed row number in the sheet
      const rawRowObj: Record<string, any> = {};
      const systemRowObj: Record<string, any> = {};
      const extraData: Record<string, any> = {};
      const hyperlinkTargets: Record<string, string> = {};

      headersList.forEach((header, colIdx) => {
        let cellVal = rowArray[colIdx] !== undefined ? rowArray[colIdx] : null;
        let hyperlinkTarget: string | null = null;
        const displayText: string | null = cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : null;

        // Check for Excel hyperlink if cell object has target link
        try {
          const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex + 1 + idx, c: colIdx });
          const cellObj = worksheet[cellAddress];
          if (cellObj && cellObj.l && cellObj.l.Target) {
            hyperlinkTarget = String(cellObj.l.Target).trim();
            hyperlinkTargets[header] = hyperlinkTarget;
          }
        } catch {
          // continue
        }

        // Store display value in rawRowObj
        rawRowObj[header] = displayText !== null ? displayText : cellVal;

        const mapping = columnMappingDetails[header];
        const sysKey = mapping?.key;

        if (sysKey && sysKey !== 'extra_data' && sysKey !== 'ignore') {
          // Prefer valid hyperlink target over truncated display text for URL fields
          let effectiveVal = cellVal;
          if (
            (sysKey === 'landing_page_url' || sysKey === 'meta_ads_url' || sysKey === 'checkout_url') &&
            hyperlinkTarget &&
            /^https?:\/\//i.test(hyperlinkTarget)
          ) {
            effectiveVal = hyperlinkTarget;
          }

          if (effectiveVal !== null && effectiveVal !== undefined && String(effectiveVal).trim() !== '') {
            // Collision protection for landing_page_url: don't overwrite complete URL with a bare domain
            if (sysKey === 'landing_page_url' && systemRowObj.landing_page_url) {
              const existingStr = String(systemRowObj.landing_page_url).trim();
              const incomingStr = String(effectiveVal).trim();
              const isIncomingBareDomain = !incomingStr.includes('/') || incomingStr.replace(/^https?:\/\//i, '').indexOf('/') === -1;
              if (existingStr && isIncomingBareDomain) {
                // Keep the existing full URL, do not overwrite with bare domain
              } else {
                systemRowObj[sysKey] = effectiveVal;
              }
            } else {
              systemRowObj[sysKey] = effectiveVal;
            }
          } else if (!(sysKey in systemRowObj)) {
            systemRowObj[sysKey] = null;
          }
        } else {
          // Preserve unmapped or custom extra column in extraData
          if (cellVal !== null && cellVal !== undefined && String(cellVal).trim() !== '') {
            extraData[header] = cellVal;
          }
        }
      });

      sheetRawRows.push(rawRowObj);

      const rowErrors: string[] = [];

      // Strict Data Normalization (Never invent content)
      const productName = normalizeText(systemRowObj.product_name);
      const niche = normalizeText(systemRowObj.niche);
      const subniche = normalizeText(systemRowObj.subniche);
      const productType = normalizeText(systemRowObj.product_type);
      const advertiser = normalizeText(systemRowObj.advertiser);

      const priceResult = normalizePrice(systemRowObj.price);
      const adsResult = normalizeAdsCount(systemRowObj.active_ads_count);
      const creativesResult = normalizeAdsCount(systemRowObj.estimated_unique_creatives);

      const oldestAdDate = normalizeDate(systemRowObj.oldest_ad_date);

      let daysRunning = normalizeDaysRunning(systemRowObj.days_running).value;
      if (daysRunning === null && oldestAdDate) {
        daysRunning = calculateDaysRunning(oldestAdDate);
      }

      const faceless = normalizeFaceless(systemRowObj.faceless);

      // URL Canonical Field Processing & Classification
      let metaAdsUrl = normalizeUrl(systemRowObj.meta_ads_url);
      let landingPageUrl = normalizeUrl(systemRowObj.landing_page_url);
      let checkoutUrl = normalizeUrl(systemRowObj.checkout_url);
      let landingPageDomain = systemRowObj.landing_page_domain
        ? extractHostname(systemRowObj.landing_page_domain)
        : null;
      let lpSource: LandingPageResolutionSource = 'NONE';

      // Disambiguate and classify landingPageUrl
      if (landingPageUrl) {
        const classification = classifyUrl(landingPageUrl);
        if (classification === 'META_ADS_LIBRARY') {
          // Mistakenly assigned Meta Ads library as LP
          if (!metaAdsUrl) metaAdsUrl = landingPageUrl;
          landingPageUrl = null;
        } else if (classification === 'CHECKOUT') {
          // Mistakenly assigned checkout gateway as LP
          if (!checkoutUrl) checkoutUrl = landingPageUrl;
          landingPageUrl = null;
        } else {
          landingPageDomain = extractHostname(landingPageUrl);
          lpSource = 'XLSX_VALUE';
        }
      }

      const headline = normalizeText(systemRowObj.headline);
      const subheadline = normalizeText(systemRowObj.subheadline);
      let adFormat = normalizeText(systemRowObj.ad_format);
      const notes = normalizeText(systemRowObj.notes);
      const score = normalizeScore(systemRowObj.work_score ?? systemRowObj.score);

      // Fallback: If estimated_unique_creatives contains text like "Vídeos curtos" and ad_format is empty
      if (!adFormat && systemRowObj.estimated_unique_creatives && typeof systemRowObj.estimated_unique_creatives === 'string') {
        adFormat = normalizeText(systemRowObj.estimated_unique_creatives);
      }

      const normalizedOffer: Partial<Offer> = {
        product_name: productName || '',
        niche: niche,
        subniche: subniche,
        product_type: productType,
        advertiser: advertiser,
        price: priceResult.value,
        currency: 'BRL',
        active_ads_count: adsResult.value,
        estimated_unique_creatives: creativesResult.value,
        oldest_ad_date: oldestAdDate,
        days_running: daysRunning,
        faceless: faceless,
        meta_ads_url: metaAdsUrl,
        landing_page_url: landingPageUrl,
        landing_page_url_original: landingPageUrl,
        landing_page_domain: landingPageDomain,
        landing_page_url_source: landingPageUrl ? lpSource : 'NONE',
        landing_page_url_status: landingPageUrl ? 'PENDING' : 'NEEDS_MANUAL_URL',
        checkout_url: checkoutUrl,
        headline: headline,
        subheadline: subheadline,
        ad_format: adFormat,
        notes: notes,
        score: score,
        work_score: score,
        trend: 'SEM_HISTORICO',
        momentum_score: null,
        opportunity_score: null,
        source_file_name: fileName,
        sheet_name: sheetName,
        row_number: rowIndex,
        raw_data: rawRowObj,
        extra_data: Object.keys(extraData).length > 0 ? extraData : null,
      };

      // Deduplication check
      const dedupeKey = generateDedupeKey({
        product_name: productName || '',
        advertiser: advertiser || '',
        landing_page_url: landingPageUrl || '',
      });

      const existingMatch = findDuplicateOffer(dedupeKey, normalizedOffer, existingOffers);
      const isDuplicate = !!existingMatch;

      // Score and Validation
      const discoveryBreakdown = calculateDiscoveryScore(normalizedOffer);
      normalizedOffer.discovery_score = discoveryBreakdown.total;
      normalizedOffer.system_score = discoveryBreakdown.total;

      const validation = validateOffer(normalizedOffer, settings);

      // Collect non-fatal field warnings
      if (priceResult.error) validation.warnings.push(priceResult.error);
      if (adsResult.error) validation.warnings.push(adsResult.error);
      if (creativesResult.error) validation.warnings.push(creativesResult.error);

      if (rowErrors.length > 0) {
        validation.reasons.push(...rowErrors);
        validation.status = 'INVALIDA';
        validation.isValid = false;
      }

      const hasErrors = !validation.isValid;

      if (hasErrors) errorCount++;
      if (validation.status === 'INVALIDA') invalidCount++;
      if (isDuplicate) duplicateCount++;
      if (validation.isValid && !isDuplicate) readyCount++;

      previewRows.push({
        tempId: `row_${sheetName}_${rowIndex}_${Math.random().toString(36).substring(2, 6)}`,
        rowIndex,
        sheetName,
        raw: rawRowObj,
        normalized: normalizedOffer,
        extraData,
        dedupe_key: dedupeKey,
        isDuplicate,
        duplicateOfferId: existingMatch?.id,
        existingOffer: existingMatch,
        duplicateAction: 'update',
        validation,
        system_score: discoveryBreakdown.total,
        hasErrors,
        errors: rowErrors,
      });
    });

    sheetsInfo.push({
      sheetName,
      rowCount: sheetRawRows.length,
      headers: headersList,
    });

    rawSheetsData.push({
      sheetName,
      headerRowIndex,
      detectedHeaders: detectedHeadersInfo,
      rawRows: sheetRawRows,
      confidence: headerDetection.confidence,
      headerCandidates: headerDetection.candidates,
    });
  }

  if (previewRows.length === 0 && rawSheetsData.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada após a leitura das planilhas.');
  }

  const allHeaders = Array.from(allHeadersSet);
  const columnMapping: Record<string, string> = {};
  const unmappedHeaders: string[] = [];

  allHeaders.forEach((h) => {
    const detail = columnMappingDetails[h];
    if (detail && detail.key) {
      columnMapping[h] = detail.key;
    } else {
      unmappedHeaders.push(h);
    }
  });

  const summary: ImportSummary = {
    fileName,
    totalSheets: sheetsInfo.length,
    sheetNames: sheetsInfo.map((s) => s.sheetName),
    totalRows: previewRows.length,
    readyRows: readyCount,
    duplicateRows: duplicateCount,
    invalidRows: invalidCount,
    errorRows: errorCount,
  };

  return {
    fileName,
    sheetNames: sheetsInfo.map((s) => s.sheetName),
    sheetsInfo,
    headers: allHeaders,
    columnMapping,
    columnMappingDetails,
    unmappedHeaders,
    rows: previewRows,
    summary,
    rawSheetsData,
    detectedHeaderRowIndex: firstDetectedHeaderIndex,
  };
}
