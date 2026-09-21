// ==============================================================================
// OFFER MINER - JSON DOCUMENT TYPE DETECTOR
// ==============================================================================

export type JsonDocumentType =
  | 'SINGLE_OFFER'
  | 'OFFER_ARRAY'
  | 'SEQUENCE_OF_OBJECTS'
  | 'OFFER_MINER_EXPORT'
  | 'WORKER_MINING_RESULT'
  | 'GENERIC_WRAPPER'
  | 'UNKNOWN';

export interface DocumentDetectionResult {
  type: JsonDocumentType;
  schemaVersion?: string;
  exportType?: string;
  hasIdentitySignals: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  metadataFields: string[];
}

/**
 * Clean string for key normalization.
 */
function cleanKey(k: string): string {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Fields that represent execution/mining metadata rather than offer identity.
 */
export const MINING_METADATA_KEYS = new Set([
  'dataconsulta',
  'data_consulta',
  'pais',
  'categoria',
  'criteriosaplicados',
  'criterios_aplicados',
  'criterios',
  'criteria',
  'filtros',
  'resumo',
  'estatisticas',
  'metadata',
  'totalencontradas',
  'total_encontradas',
  'observacoes',
  'configuracao',
  'querydate',
  'query_date',
  'timestamp',
  'searchquery',
  'search_query',
  'execution_id',
  'executionid',
  'worker_id',
  'workerid',
]);

/**
 * Evaluates whether an object contains real offer identity signals.
 * An object must NOT be treated as an offer merely because it is a JSON object.
 */
export function hasOfferIdentitySignals(raw: any): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return false;
  }

  const keys = Object.keys(raw);
  const cleanedKeys = new Set(keys.map(cleanKey));

  // 1. Strong Offer Title / Name Signal
  const nameKeys = [
    'offername',
    'nomeoferta',
    'nomeproduto',
    'produtonome',
    'titulooferta',
    'tipomaterial',
    'tipo_material',
    'material',
  ];
  for (const nk of nameKeys) {
    if (cleanedKeys.has(nk)) {
      const actualKey = Object.keys(raw).find((k) => cleanKey(k) === nk);
      const val = actualKey ? raw[actualKey] : null;
      if (val && typeof val === 'string' && val.trim().length > 1) {
        return true;
      }
    }
  }

  // Also check standard name/title/produto if value is a meaningful string
  const generalNameKeys = ['name', 'title', 'nome', 'produto', 'titulo'];
  for (const gk of generalNameKeys) {
    if (cleanedKeys.has(gk)) {
      const actualKey = Object.keys(raw).find((k) => cleanKey(k) === gk);
      const val = actualKey ? raw[actualKey] : null;
      if (val && typeof val === 'string' && val.trim().length > 1) {
        // Ensure this isn't a category or metadata name
        const lowerVal = val.toLowerCase().trim();
        if (
          !lowerVal.includes('todos os anuncios') &&
          !lowerVal.includes('todos os anúncios') &&
          !lowerVal.includes('mineracao') &&
          !lowerVal.includes('mineração')
        ) {
          return true;
        }
      }
    }
  }

  // 2. Strong Landing Page URL Signal
  const lpKeys = [
    'landingpageurl',
    'landingpage',
    'paginavendas',
    'urlpaginavendas',
    'salespageurl',
    'salespage',
    'lpurl',
    'linkdestino',
    'link_destino',
  ];
  for (const lk of lpKeys) {
    if (cleanedKeys.has(lk)) {
      const actualKey = Object.keys(raw).find((k) => cleanKey(k) === lk);
      const val = actualKey ? raw[actualKey] : null;
      if (
        val &&
        typeof val === 'string' &&
        (val.startsWith('http://') || val.startsWith('https://') || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(val.trim()))
      ) {
        return true;
      }
    }
  }

  // 3. Strong Meta Ads Library URL Signal
  const metaKeys = [
    'metaadsurl',
    'bibliotecadeanuncios',
    'bibliotecaanuncios',
    'linkbiblioteca',
    'linkmetaads',
    'urlmetaads',
    'adlibraryurl',
  ];
  for (const mk of metaKeys) {
    if (cleanedKeys.has(mk)) {
      const actualKey = Object.keys(raw).find((k) => cleanKey(k) === mk);
      const val = actualKey ? raw[actualKey] : null;
      if (val && typeof val === 'string' && val.includes('ads/library')) {
        return true;
      }
    }
  }

  // 4. Strong Advertiser + Commercial Evidence
  const hasAdvertiser =
    cleanedKeys.has('advertiser') ||
    cleanedKeys.has('anunciante') ||
    cleanedKeys.has('pagename') ||
    cleanedKeys.has('nomepagina');

  const hasCommercial =
    cleanedKeys.has('frontprice') ||
    cleanedKeys.has('preco') ||
    cleanedKeys.has('price') ||
    cleanedKeys.has('activeadscount') ||
    cleanedKeys.has('anunciosativos') ||
    cleanedKeys.has('checkouturl') ||
    cleanedKeys.has('checkout') ||
    cleanedKeys.has('diasativos') ||
    cleanedKeys.has('daysactive') ||
    cleanedKeys.has('ticket');

  if (hasAdvertiser && hasCommercial) {
    return true;
  }

  return false;
}

/**
 * Detects the overall document type of the given raw parsed JSON object.
 */
export function detectJsonDocumentType(
  raw: any,
  options?: { isSequenceOfObjects?: boolean }
): DocumentDetectionResult {
  if (raw === null || raw === undefined) {
    return {
      type: 'UNKNOWN',
      hasIdentitySignals: false,
      confidence: 'LOW',
      summary: 'Conteúdo nulo ou indefinido.',
      metadataFields: [],
    };
  }

  // Sequence of objects recovered by Smart Ingestion
  if (options?.isSequenceOfObjects && Array.isArray(raw)) {
    return {
      type: 'SEQUENCE_OF_OBJECTS',
      hasIdentitySignals: raw.length > 0 && raw.some(hasOfferIdentitySignals),
      confidence: 'HIGH',
      summary: `Sequência de ${raw.length} ofertas agrupadas em array canônico.`,
      metadataFields: [],
    };
  }

  // Plain Array
  if (Array.isArray(raw)) {
    return {
      type: 'OFFER_ARRAY',
      hasIdentitySignals: raw.length > 0 && raw.some(hasOfferIdentitySignals),
      confidence: 'HIGH',
      summary: `Array contendo ${raw.length} registros.`,
      metadataFields: [],
    };
  }

  if (typeof raw !== 'object') {
    return {
      type: 'UNKNOWN',
      hasIdentitySignals: false,
      confidence: 'LOW',
      summary: `Tipo primitivo inesperado: ${typeof raw}.`,
      metadataFields: [],
    };
  }

  const keys = Object.keys(raw);
  const cleanedKeys = keys.map(cleanKey);

  // Collect metadata fields present at root
  const metadataFields = keys.filter((k) => {
    const ck = cleanKey(k);
    return MINING_METADATA_KEYS.has(ck);
  });

  // 1. Official Worker Schema: offer-miner-worker-1.0
  const schemaVersion = raw.schema_version || raw.schemaVersion;
  if (schemaVersion === 'offer-miner-worker-1.0') {
    return {
      type: 'WORKER_MINING_RESULT',
      schemaVersion: 'offer-miner-worker-1.0',
      hasIdentitySignals: false,
      confidence: 'HIGH',
      summary: 'Resultado de mineração estruturado oficial (Worker Schema v1.0).',
      metadataFields,
    };
  }

  // 2. Offer Miner Native Export
  if (
    raw.export_type ||
    raw.exportType ||
    raw.offerFacts ||
    (raw.metadata?.scope && raw.metadata?.version) ||
    raw.aiInstructions
  ) {
    const exportType = raw.export_type || raw.exportType || raw.metadata?.scope;
    return {
      type: 'OFFER_MINER_EXPORT',
      schemaVersion: String(raw.schema_version || raw.metadata?.version || '1.0'),
      exportType: String(exportType || 'export'),
      hasIdentitySignals: Boolean(raw.offerFacts && hasOfferIdentitySignals(raw.offerFacts)),
      confidence: 'HIGH',
      summary: 'Exportação interna do Offer Miner.',
      metadataFields,
    };
  }

  // 3. Worker Mining Result (Heuristic: execution metadata + internal offers collection)
  const hasMiningMetadata =
    cleanedKeys.includes('dataconsulta') ||
    cleanedKeys.includes('data_consulta') ||
    cleanedKeys.includes('criteriosaplicados') ||
    cleanedKeys.includes('criterios_aplicados') ||
    cleanedKeys.includes('querydate') ||
    (cleanedKeys.includes('pais') && cleanedKeys.includes('categoria'));

  if (hasMiningMetadata) {
    return {
      type: 'WORKER_MINING_RESULT',
      hasIdentitySignals: false,
      confidence: 'HIGH',
      summary: 'Resultado de Mineração de Worker com metadados de execução.',
      metadataFields,
    };
  }

  // 4. Common Wrapper Keys (offers, ofertas, resultados, items, data)
  const commonWrapperKeys = [
    'offers',
    'ofertas',
    'ofertasencontradas',
    'ofertasvalidas',
    'resultados',
    'results',
    'minedoffers',
    'items',
    'data',
    'produtos',
  ];
  const matchedWrapper = commonWrapperKeys.find((wk) => cleanedKeys.includes(wk));
  if (matchedWrapper) {
    const actualKey = keys.find((k) => cleanKey(k) === matchedWrapper);
    const wrapperVal = actualKey ? raw[actualKey] : null;
    if (Array.isArray(wrapperVal)) {
      return {
        type: 'GENERIC_WRAPPER',
        hasIdentitySignals: false,
        confidence: 'HIGH',
        summary: `Objeto encapsulador com coleção em $.${actualKey}.`,
        metadataFields,
      };
    }
  }

  // 5. Single Offer Identity Check
  const isSingleOffer = hasOfferIdentitySignals(raw);
  if (isSingleOffer) {
    return {
      type: 'SINGLE_OFFER',
      hasIdentitySignals: true,
      confidence: 'HIGH',
      summary: 'Objeto único com sinais válidos de identidade de oferta.',
      metadataFields,
    };
  }

  // 6. Unknown / Unclassified
  return {
    type: 'UNKNOWN',
    hasIdentitySignals: false,
    confidence: 'LOW',
    summary: 'Objeto raiz sem sinais de identidade de oferta nem coleções óbvias.',
    metadataFields,
  };
}
