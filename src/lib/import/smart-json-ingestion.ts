// ==============================================================================
// OFFER MINER - SMART JSON INGESTION & REPAIR ENGINE
// ==============================================================================

import { jsonrepair } from 'jsonrepair';

export interface SmartRepairDetails {
  isRepaired: boolean;
  repairedText: string;
  corrections: string[];
  objectsGroupedInArrayCount?: number;
  markdownEscapesCount?: number;
  markdownLinksUnwrappedCount?: number;
  protocolAddedCount?: number;
  trailingCommasFixedCount?: number;
  isSequenceOfObjects?: boolean;
}

export interface SmartJsonParseResult {
  success: boolean;
  data?: any;
  isRepaired: boolean;
  isSequenceOfObjects?: boolean;
  repairedJsonText?: string;
  repairDetails?: SmartRepairDetails;
  error?: string;
  errorPosition?: {
    line: number;
    column: number;
    snippet?: string;
  };
}

export const PT_BR_MONTHS: Record<string, string> = {
  jan: '01',
  fev: '02',
  mar: '03',
  abr: '04',
  mai: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  set: '09',
  out: '10',
  nov: '11',
  dez: '12',
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

/**
 * Parses dates with Brazilian Portuguese month names (e.g. "11 de jun de 2026", "24 de jul de 2026").
 * Returns ISO 'YYYY-MM-DD' or null.
 */
export function parseLocalizedDate(value: any, _locale = 'pt-BR'): string | null {
  if (!value || typeof value !== 'string') return null;
  const str = value.trim();

  // Pattern: "11 de jun de 2026" or "11 de junho de 2026" or "11/jun/2026"
  const ptMatch = str.match(/(\d{1,2})\s*(?:de|\/|\-)\s*([a-záéíóúç]+)\s*(?:de|\/|\-)?\s*(\d{4})/i);
  if (ptMatch) {
    const day = ptMatch[1].padStart(2, '0');
    const monthStr = ptMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const monthKey = monthStr.substring(0, 3);
    const monthNum = PT_BR_MONTHS[monthKey] || PT_BR_MONTHS[monthStr];
    const year = ptMatch[3];
    if (monthNum) {
      return `${year}-${monthNum}-${day}`;
    }
  }

  // Fallback: standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Fallback: DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try native date parsing
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Unwraps markdown link formats:
 * - [https://...](https://...) -> https://...
 * - [text](https://...) -> https://...
 * - <https://...> -> https://...
 */
export function unwrapMarkdownUrl(raw: any): string {
  if (!raw || typeof raw !== 'string') return '';
  const str = raw.trim();

  const mdMatch = str.match(/\[(?:.*?)\]\((https?:\/\/[^\s\)]+)\)/i);
  if (mdMatch) {
    return mdMatch[1].trim();
  }

  const angleMatch = str.match(/^<(https?:\/\/[^>]+)>$/i);
  if (angleMatch) {
    return angleMatch[1].trim();
  }

  return str;
}

/**
 * Normalizes domain URLs without scheme:
 * KITKIDSESCOLAR.COM.BR -> https://kitkidsescolar.com.br
 */
export function normalizeProtocolUrl(raw: any): { url: string; original: string; addedProtocol: boolean } {
  if (!raw || typeof raw !== 'string') return { url: '', original: '', addedProtocol: false };
  const unwrapped = unwrapMarkdownUrl(raw).trim();
  if (!unwrapped) return { url: '', original: raw, addedProtocol: false };

  if (/^https?:\/\//i.test(unwrapped)) {
    return { url: unwrapped, original: raw, addedProtocol: false };
  }

  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(unwrapped)) {
    return { url: `https://${unwrapped.toLowerCase()}`, original: raw, addedProtocol: true };
  }

  return { url: unwrapped, original: raw, addedProtocol: false };
}

/**
 * Extracts meta_ad_id from Meta Ads Library URL if present (e.g. ?id=865473736608989).
 */
export function extractMetaAdId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[?&]id=(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Tries native JSON.parse on raw string.
 */
export function tryStrictJsonParse(text: string): { success: boolean; data?: any; error?: any } {
  try {
    const data = JSON.parse(text);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Fixes markdown-escaped underscores (e.g. \_ -> _) while preserving valid JSON escape sequences:
 * \b, \f, \n, \r, \t, \", \\, \/, \uXXXX.
 */
export function fixMarkdownEscapes(rawText: string): { text: string; count: number } {
  let count = 0;
  // Match backslash followed by an underscore
  const fixed = rawText.replace(/\\_/g, () => {
    count++;
    return '_';
  });

  return { text: fixed, count };
}

/**
 * Detects if the document contains multiple top-level objects not enclosed in [ ... ].
 * E.g.: {...}, {...}, {...}
 */
export function detectTopLevelObjectSequence(rawText: string): {
  isSequence: boolean;
  objectCount: number;
  wrappedText: string;
} {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return { isSequence: false, objectCount: 0, wrappedText: rawText };
  }

  // Count occurrences of closing brace followed by comma and opening brace
  // or opening braces at top level
  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;
  let topLevelObjects = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === '\\') {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '{') {
        if (braceDepth === 0) {
          topLevelObjects++;
        }
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
      }
    }
  }

  if (topLevelObjects > 1) {
    return {
      isSequence: true,
      objectCount: topLevelObjects,
      wrappedText: `[\n${trimmed}\n]`,
    };
  }

  return { isSequence: false, objectCount: topLevelObjects, wrappedText: rawText };
}

/**
 * Intelligent Smart JSON Ingestion:
 * Attempts strict parse; if it fails, applies pre-sanitization (markdown escapes, top-level sequence),
 * runs jsonrepair, and returns the repaired data along with audit details.
 */
export function smartRepairJson(rawText: string): SmartJsonParseResult {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    return { success: false, isRepaired: false, error: 'O conteúdo está vazio.' };
  }

  // 1. Strict parse attempt first
  const strictResult = tryStrictJsonParse(trimmed);
  if (strictResult.success) {
    return {
      success: true,
      data: strictResult.data,
      isRepaired: false,
      repairedJsonText: trimmed,
    };
  }

  // 2. Pre-sanitization
  const corrections: string[] = [];
  let currentText = trimmed;

  // A. Fix markdown escapes (\_ -> _)
  const escapeFix = fixMarkdownEscapes(currentText);
  if (escapeFix.count > 0) {
    currentText = escapeFix.text;
    corrections.push(`${escapeFix.count} escapes de Markdown corrigidos (ex: \\_ → _)`);
  }

  // B. Detect sequence of top-level objects
  const seqDetect = detectTopLevelObjectSequence(currentText);
  let isSequenceOfObjects = false;
  if (seqDetect.isSequence) {
    currentText = seqDetect.wrappedText;
    isSequenceOfObjects = true;
    corrections.push(`${seqDetect.objectCount} objetos agrupados em array canônico ([ ... ])`);
  }

  // C. Count markdown links present in input
  const mdLinkMatches = (rawText.match(/\[(?:.*?)\]\((https?:\/\/[^\s\)]+)\)/gi) || []).length;
  if (mdLinkMatches > 0) {
    corrections.push(`${mdLinkMatches} links Markdown convertidos para URL limpa`);
  }

  // 3. Run jsonrepair
  let repairedString = '';
  try {
    repairedString = jsonrepair(currentText);
  } catch (repairErr: any) {
    // If jsonrepair failed directly, try wrapping in array as last resort
    if (!currentText.startsWith('[')) {
      try {
        repairedString = jsonrepair(`[\n${currentText}\n]`);
        if (!isSequenceOfObjects) {
          isSequenceOfObjects = true;
          corrections.push('Objetos agrupados em array canônico ([ ... ])');
        }
      } catch {
        return {
          success: false,
          isRepaired: false,
          error: `Falha na recuperação do JSON: ${repairErr.message || 'Formato não recuperável'}`,
        };
      }
    } else {
      return {
        success: false,
        isRepaired: false,
        error: `Falha na recuperação do JSON: ${repairErr.message || 'Formato não recuperável'}`,
      };
    }
  }

  // 4. Parse repaired JSON
  try {
    const parsedData = JSON.parse(repairedString);
    const prettyJson = JSON.stringify(parsedData, null, 2);

    if (corrections.length === 0) {
      corrections.push('Sintaxe JSON normalizada automaticamente');
    }

    const details: SmartRepairDetails = {
      isRepaired: true,
      repairedText: prettyJson,
      corrections,
      objectsGroupedInArrayCount: seqDetect.isSequence ? seqDetect.objectCount : undefined,
      markdownEscapesCount: escapeFix.count,
      markdownLinksUnwrappedCount: mdLinkMatches,
      isSequenceOfObjects,
    };

    return {
      success: true,
      data: parsedData,
      isRepaired: true,
      isSequenceOfObjects,
      repairedJsonText: prettyJson,
      repairDetails: details,
    };
  } catch (finalParseErr: any) {
    return {
      success: false,
      isRepaired: false,
      error: `JSON não pôde ser reparado: ${finalParseErr.message}`,
    };
  }
}
