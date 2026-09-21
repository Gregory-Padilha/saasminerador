// ==============================================================================
// OFFER MINER - STRICT DATA NORMALIZATION ENGINE (SOURCE OF TRUTH PRESERVATION)
// ==============================================================================

/**
 * Normalizes price values from various formats:
 * "R$ 27,90" -> 27.90
 * "27,90" -> 27.90
 * "27.90" -> 27.90
 * "R$27" -> 27.00
 * "27" -> 27.00
 * "R$ 1.250,50" -> 1250.50
 *
 * Empty, null or unparseable -> value: null (NEVER 0!)
 */
export function normalizePrice(raw: any): { value: number | null; error?: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null };
  }

  if (typeof raw === 'number') {
    return isNaN(raw) ? { value: null, error: 'Valor numérico inválido' } : { value: raw };
  }

  const str = String(raw).trim();
  if (!str) return { value: null };

  // If the text contains descriptive phrases with price tags, e.g. "R$ 14,99 no plano..."
  // Try extracting the first valid currency amount
  const currencyMatch = str.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+[.,][0-9]{2}|[0-9]+)/i);
  let targetStr = str;
  if (currencyMatch && currencyMatch[1]) {
    targetStr = currencyMatch[1];
  } else {
    // Check for "R$ 14.99" or simple number
    const simpleMatch = str.match(/([0-9]+[.,][0-9]{2})/);
    if (simpleMatch && simpleMatch[1]) {
      targetStr = simpleMatch[1];
    }
  }

  // Remove currency symbol, spaces, R$, BRL, etc.
  let cleaned = targetStr.replace(/[R$BRLbrl\s]/g, '');

  // Handle brazilian number format 1.250,50 or 27,90
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    return { value: null, error: `Não foi possível converter o preço: "${str}"` };
  }

  return { value: Math.round(parsed * 100) / 100 };
}

/**
 * Normalizes active ads count:
 * "18 anúncios" -> 18
 * "18" -> 18
 * "~18" -> 18
 * "aprox. 18" -> 18
 * "18 ads" -> 18
 *
 * Empty or null -> value: null (NEVER 0!)
 */
export function normalizeAdsCount(raw: any): { value: number | null; error?: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null };
  }

  if (typeof raw === 'number') {
    return isNaN(raw) ? { value: null } : { value: Math.floor(raw) };
  }

  const str = String(raw).trim();
  if (!str) return { value: null };

  // Detect ranges like "10-15" or "10 a 20"
  if (/(\d+)\s*[-–—]\s*(\d+)/i.test(str) || /(\d+)\s+a\s+(\d+)/i.test(str)) {
    return { value: null, error: `Faixa de anúncios encontrada (${str}). Preservado no raw.` };
  }

  // Extract single integer
  const match = str.match(/^\D*(\d+)\D*$/);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? { value: null, error: `Número de anúncios inválido: "${str}"` } : { value: val };
  }

  const generalMatch = str.match(/\d+/);
  if (generalMatch) {
    const val = parseInt(generalMatch[0], 10);
    return isNaN(val) ? { value: null, error: `Número de anúncios inválido: "${str}"` } : { value: val };
  }

  return { value: null, error: `Não foi possível extrair número de anúncios de: "${str}"` };
}

/**
 * Normalizes days running:
 * "15 dias" -> 15
 * "15" -> 15
 * "15d" -> 15
 * "2026-04-09 (162 dias)" -> 162
 * "10-15 dias" -> null (error/warning, preserves raw)
 *
 * Empty or null -> value: null (NEVER 0!)
 */
export function normalizeDaysRunning(raw: any): { value: number | null; error?: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null };
  }

  if (typeof raw === 'number') {
    return isNaN(raw) ? { value: null } : { value: Math.floor(raw) };
  }

  const str = String(raw).trim();
  if (!str) return { value: null };

  // Detect ranges like "10-15 dias" or "10 a 20 dias"
  if (/(\d+)\s*[-–—]\s*(\d+)\s*dias?/i.test(str) || /(\d+)\s+a\s+(\d+)\s*dias?/i.test(str)) {
    return { value: null, error: `Faixa de dias encontrada (${str}). Preservado no raw.` };
  }

  // Check for explicit "X dias" e.g. "(162 dias)" or "162 dias"
  const diasMatch = str.match(/(\d+)\s*dias?/i);
  if (diasMatch) {
    const val = parseInt(diasMatch[1], 10);
    return isNaN(val) ? { value: null, error: `Dias rodando inválido: "${str}"` } : { value: val };
  }

  const match = str.match(/^\D*(\d+)\D*$/);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? { value: null, error: `Dias rodando inválido: "${str}"` } : { value: val };
  }

  const generalMatch = str.match(/\d+/);
  if (generalMatch) {
    const val = parseInt(generalMatch[0], 10);
    return isNaN(val) ? { value: null, error: `Dias rodando inválido: "${str}"` } : { value: val };
  }

  return { value: null, error: `Não foi possível extrair dias rodando de: "${str}"` };
}

/**
 * Normalizes faceless boolean:
 * SIM, Sim, sim, YES, Yes, true, 1 -> true
 * NÃO, Nao, Não, NO, No, false, 0 -> false
 * Vazio / Desconhecido -> null (NEVER false by default!)
 */
export function normalizeFaceless(raw: any): boolean | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }

  const str = String(raw).trim().toLowerCase();
  const truthy = ['sim', 'yes', 'true', '1', 's', 'y', 'faceless', 'sem rosto', 'sem_rosto', 'anonimo', 'anônimo'];
  const falsy = ['nao', 'não', 'no', 'false', '0', 'n', 'com rosto', 'com_rosto', 'especialista', 'autoridade'];

  if (truthy.includes(str)) return true;
  if (falsy.includes(str)) return false;

  return null;
}

/**
 * Normalizes score (1-10 or 1-100 to 1-10 scale)
 * Empty or null -> null (NEVER 0!)
 */
export function normalizeScore(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (isNaN(raw)) return null;
    if (raw > 10 && raw <= 100) return Math.round((raw / 10) * 10) / 10;
    return Math.round(raw * 10) / 10;
  }
  const str = String(raw).trim().replace(',', '.');
  const parsed = parseFloat(str);
  if (isNaN(parsed)) return null;
  if (parsed > 10 && parsed <= 100) return Math.round((parsed / 10) * 10) / 10;
  return Math.round(parsed * 10) / 10;
}

export {
  normalizeUrl,
  canonicalizeUrlForComparison,
  extractHostname,
  classifyUrl,
} from './url-field-mapping';

/**
 * Parses date from string or Excel serial number into 'YYYY-MM-DD'
 * Empty or invalid -> null
 */
export function normalizeDate(raw: any): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // Handle Excel serial date numbers (e.g. 45547)
  if (typeof raw === 'number') {
    try {
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // continue
    }
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Check Portuguese localized date like "11 de jun de 2026" or "11 de junho de 2026"
  const ptMatch = str.match(/(\d{1,2})\s*(?:de|\/|\-)\s*([a-záéíóúç]+)\s*(?:de|\/|\-)?\s*(\d{4})/i);
  if (ptMatch) {
    const day = ptMatch[1].padStart(2, '0');
    const monthStr = ptMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const monthKey = monthStr.substring(0, 3);
    const months: Record<string, string> = {
      jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
      jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
    };
    const monthNum = months[monthKey];
    if (monthNum) {
      return `${ptMatch[3]}-${monthNum}-${day}`;
    }
  }

  // Try standard Date parsing
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // fallback
  }

  return null;
}

/**
 * Cleans text strings, trims extra whitespace.
 * If empty or null -> returns null (NEVER empty string or invented value!)
 */
export function normalizeText(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : null;
}
