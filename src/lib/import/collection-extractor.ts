// ==============================================================================
// OFFER MINER - OFFER COLLECTION EXTRACTOR & RECURSIVE DISCOVERY
// ==============================================================================

import { hasOfferIdentitySignals } from './document-detector';
import { STRUCTURAL_EXPORT_KEYS } from './normalizer';

export interface CandidateCollection {
  path: string;
  records: any[];
  count: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  sampleKeys: string[];
  isAutoSelected: boolean;
  reason?: string;
}

export interface CollectionExtractionResult {
  candidateCollections: CandidateCollection[];
  selectedCollection: CandidateCollection | null;
  globalMetadata: Record<string, any>;
  hasMultipleCandidates: boolean;
}

function cleanKey(k: string): string {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Evaluates whether an array looks like a real collection of offers.
 *
 * CRITICAL RULES:
 * 1. String arrays (e.g. `criterios_aplicados: ["..."]`) are NEVER offer collections.
 * 2. Number arrays are NEVER offer collections.
 * 3. Array of objects is scored based on commercial, Meta Ads, identity and URL signals.
 */
export function isLikelyOfferArray(
  arr: any[],
  customFieldMap?: Record<string, any>
): {
  isOfferArray: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  sampleKeys: string[];
  reason?: string;
} {
  if (!Array.isArray(arr) || arr.length === 0) {
    return {
      isOfferArray: false,
      confidence: 'LOW',
      score: 0,
      sampleKeys: [],
      reason: 'Array vazio ou inválido',
    };
  }

  // 1. If any of the first elements is a primitive (string, number, boolean), it is NOT an offer collection
  const checkSlice = arr.slice(0, Math.min(arr.length, 5));
  const hasPrimitives = checkSlice.some((item) => item === null || typeof item !== 'object' || Array.isArray(item));
  if (hasPrimitives) {
    return {
      isOfferArray: false,
      confidence: 'LOW',
      score: 0,
      sampleKeys: [],
      reason: 'Contém valores primitivos (strings ou números), não é lista de ofertas',
    };
  }

  // 2. Score the candidate objects
  let totalScore = 0;
  const sampleKeysSet = new Set<string>();

  checkSlice.forEach((item) => {
    let itemScore = 0;
    const itemKeys = Object.keys(item);
    itemKeys.forEach((k) => sampleKeysSet.add(k));
    const cleaned = itemKeys.map(cleanKey);

    // Custom field mapping bonus: if user or caller mapped custom keys
    if (customFieldMap) {
      for (const [srcKey, target] of Object.entries(customFieldMap)) {
        if (target !== 'ignore' && itemKeys.includes(srcKey)) {
          itemScore += 4;
        }
      }
    }

    // Identity signals (+3)
    if (
      cleaned.some(
        (k) =>
          [
            'offername',
            'nomeoferta',
            'nomeproduto',
            'titulooferta',
            'name',
            'title',
            'nome',
            'produto',
            'titulo',
            'tipomaterial',
            'tipo_material',
            'material',
          ].includes(k) ||
          k.startsWith('nome') ||
          k.startsWith('titulo') ||
          k.includes('offer') ||
          k.includes('produto') ||
          k.includes('material')
      )
    ) {
      itemScore += 3;
    }

    // Advertiser signals (+2)
    if (
      cleaned.some(
        (k) =>
          ['advertiser', 'anunciante', 'pagename', 'nomepagina', 'pagina', 'marca', 'perfil'].includes(k) ||
          k.includes('anunciante') ||
          k.includes('perfil') ||
          k.includes('advertiser') ||
          k.includes('pagina')
      )
    ) {
      itemScore += 2;
    }

    // Ads count (+3)
    if (
      cleaned.some(
        (k) =>
          [
            'activeadscount',
            'activeads',
            'anunciosativos',
            'anuncios_ativos',
            'qtdanunciosativos',
            'ads',
            'anuncios',
          ].includes(k) ||
          k.includes('anuncio') ||
          k.includes('campanha') ||
          k.includes('ads')
      )
    ) {
      itemScore += 3;
    }

    // Creatives count (+2)
    if (
      cleaned.some(
        (k) =>
          [
            'uniquecreativescount',
            'uniquecreatives',
            'criativosdistintos',
            'criativos_distintos',
            'criativos',
          ].includes(k) ||
          k.includes('criativo') ||
          k.includes('creative')
      )
    ) {
      itemScore += 2;
    }

    // URL signals (+3)
    if (
      cleaned.some(
        (k) =>
          [
            'landingpageurl',
            'landingpage',
            'paginavendas',
            'salespageurl',
            'metaadsurl',
            'bibliotecadeanuncios',
            'bibliotecaanuncios',
            'linkbiblioteca',
            'linkmetaads',
            'linkdestino',
            'link_destino',
            'checkouturl',
            'checkout',
          ].includes(k) ||
          k.includes('url') ||
          k.includes('link') ||
          k.includes('pagina') ||
          k.includes('checkout') ||
          k.includes('destino')
      )
    ) {
      itemScore += 3;
    }

    // Price signals (+2)
    if (
      cleaned.some(
        (k) =>
          ['frontprice', 'price', 'preco', 'precofront', 'valor', 'ticket'].includes(k) ||
          k.includes('preco') ||
          k.includes('price') ||
          k.includes('valor') ||
          k.includes('ticket')
      )
    ) {
      itemScore += 2;
    }

    // Penalty for non-offer schema: e.g. `{ criterio: "...", aplicado: true }`
    if (
      cleaned.includes('criterio') ||
      cleaned.includes('regra') ||
      (cleaned.includes('parametro') && cleaned.includes('valor') && !cleaned.includes('preco'))
    ) {
      itemScore -= 4;
    }

    totalScore += Math.max(0, itemScore);
  });

  const avgScore = totalScore / checkSlice.length;

  if (avgScore >= 4) {
    return {
      isOfferArray: true,
      confidence: 'HIGH',
      score: avgScore,
      sampleKeys: Array.from(sampleKeysSet),
      reason: 'Sinais fortes de identidade, anúncios, URLs e campos comerciais',
    };
  }

  if (avgScore >= 2) {
    return {
      isOfferArray: true,
      confidence: 'MEDIUM',
      score: avgScore,
      sampleKeys: Array.from(sampleKeysSet),
      reason: 'Sinais parciais de oferta comercial',
    };
  }

  if (avgScore >= 1) {
    return {
      isOfferArray: true,
      confidence: 'LOW',
      score: avgScore,
      sampleKeys: Array.from(sampleKeysSet),
      reason: 'Poucos campos compatíveis com oferta',
    };
  }

  return {
    isOfferArray: false,
    confidence: 'LOW',
    score: avgScore,
    sampleKeys: Array.from(sampleKeysSet),
    reason: 'Não contém campos típicos de oferta comercial',
  };
}

/**
 * Priority list of collection keys used across Portuguese and English mining exporters.
 */
const PREFERRED_COLLECTION_KEYS = [
  'offers',
  'ofertas',
  'ofertas_encontradas',
  'ofertasencontradas',
  'ofertas_validas',
  'ofertasvalidas',
  'valid_offers',
  'validoffers',
  'mined_offers',
  'minedoffers',
  'resultados',
  'results',
  'itens',
  'items',
  'records',
  'produtos',
  'products',
  'data',
];

/**
 * Controlled recursive search for offer arrays up to maximum depth.
 */
export function findCandidateOfferArrays(
  node: any,
  currentPath = '$',
  depth = 0,
  maxDepth = 4,
  visited = new Set<any>(),
  customFieldMap?: Record<string, any>
): CandidateCollection[] {
  if (depth > maxDepth || !node || typeof node !== 'object') {
    return [];
  }

  if (visited.has(node)) {
    return [];
  }
  visited.add(node);

  const candidates: CandidateCollection[] = [];

  // If the current node itself is an array:
  if (Array.isArray(node)) {
    const analysis = isLikelyOfferArray(node, customFieldMap);
    if (analysis.isOfferArray) {
      candidates.push({
        path: currentPath,
        records: node,
        count: node.length,
        confidence: analysis.confidence,
        score: analysis.score,
        sampleKeys: analysis.sampleKeys,
        isAutoSelected: false,
        reason: analysis.reason,
      });
    }
    // Don't traverse deeper into elements of an offer array
    return candidates;
  }

  // If node is an object, inspect its properties
  const keys = Object.keys(node);

  // Check preferred keys first
  for (const key of keys) {
    if (STRUCTURAL_EXPORT_KEYS.has(key) || STRUCTURAL_EXPORT_KEYS.has(cleanKey(key))) {
      continue;
    }
    const val = node[key];
    const subPath = currentPath === '$' ? `$.${key}` : `${currentPath}.${key}`;

    if (Array.isArray(val)) {
      const analysis = isLikelyOfferArray(val, customFieldMap);
      if (analysis.isOfferArray) {
        // Boost score if key name is explicitly in preferred list
        const cleanK = cleanKey(key);
        const isPreferredKey = PREFERRED_COLLECTION_KEYS.some((pk) => cleanKey(pk) === cleanK);
        const finalScore = isPreferredKey ? analysis.score + 2 : analysis.score;
        const confidence = finalScore >= 4 ? 'HIGH' : finalScore >= 2 ? 'MEDIUM' : 'LOW';

        candidates.push({
          path: subPath,
          records: val,
          count: val.length,
          confidence,
          score: finalScore,
          sampleKeys: analysis.sampleKeys,
          isAutoSelected: false,
          reason: analysis.reason,
        });
      }
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      // Recurse into nested objects
      const subCandidates = findCandidateOfferArrays(val, subPath, depth + 1, maxDepth, visited, customFieldMap);
      candidates.push(...subCandidates);
    }
  }

  return candidates;
}

/**
 * Extracts global mining metadata outside the chosen collection path.
 */
export function extractGlobalMetadata(
  root: any,
  selectedCollectionPath?: string
): Record<string, any> {
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {};
  }

  const metadata: Record<string, any> = {};
  const collectionKey = selectedCollectionPath
    ? selectedCollectionPath.replace(/^\$\./, '').split('.')[0]
    : null;

  for (const [key, value] of Object.entries(root)) {
    // Skip the collection itself
    if (key === collectionKey) continue;

    // Preserve non-collection metadata values
    if (value !== undefined && value !== null && typeof value !== 'function') {
      metadata[key] = value;
    }
  }

  return metadata;
}

/**
 * Inheritable metadata whitelist:
 * ONLY language, country, and currency may be safely inherited by offer records.
 *
 * CRITICAL INVARIANT:
 * `categoria` (e.g. "Todos os anúncios"), `criterios_aplicados`, `filtros`, `query`
 * MUST NEVER BE INHERITED OR APPLIED AS OFFER NICHE!
 */
export const INHERITABLE_METADATA_WHITELIST = new Set([
  'country',
  'pais',
  'language',
  'idioma',
  'currency',
  'moeda',
]);

/**
 * Extracts safe inheritable fields from global metadata.
 */
export function getInheritableMetadata(globalMeta: Record<string, any>): {
  country?: string;
  language?: string;
  currency?: string;
} {
  const inheritable: { country?: string; language?: string; currency?: string } = {};

  if (!globalMeta) return inheritable;

  for (const [key, val] of Object.entries(globalMeta)) {
    const ck = cleanKey(key);
    if (!INHERITABLE_METADATA_WHITELIST.has(ck)) continue;

    if (typeof val === 'string' && val.trim().length > 0) {
      if (ck === 'pais' || ck === 'country') {
        inheritable.country = val.trim();
      } else if (ck === 'idioma' || ck === 'language') {
        inheritable.language = val.trim();
      } else if (ck === 'moeda' || ck === 'currency') {
        inheritable.currency = val.trim().toUpperCase();
      }
    }
  }

  return inheritable;
}

/**
 * Master collection extractor that analyzes root and selects best candidate.
 */
export function extractOfferCollections(
  root: any,
  customFieldMap?: Record<string, any>
): CollectionExtractionResult {
  // 1. If root is a plain array of offers
  if (Array.isArray(root)) {
    const analysis = isLikelyOfferArray(root, customFieldMap);
    const collection: CandidateCollection = {
      path: '$',
      records: root,
      count: root.length,
      confidence: analysis.confidence,
      score: analysis.score,
      sampleKeys: analysis.sampleKeys,
      isAutoSelected: true,
      reason: analysis.reason,
    };

    return {
      candidateCollections: [collection],
      selectedCollection: collection,
      globalMetadata: {},
      hasMultipleCandidates: false,
    };
  }

  // 2. Controlled recursive search
  const candidates = findCandidateOfferArrays(root, '$', 0, 4, new Set<any>(), customFieldMap);

  // Sort candidates by score descending, then record count descending
  candidates.sort((a, b) => b.score - a.score || b.count - a.count);

  let selectedCollection: CandidateCollection | null = null;
  const highConfidenceCandidates = candidates.filter((c) => c.confidence === 'HIGH');

  if (highConfidenceCandidates.length === 1) {
    // Single HIGH confidence candidate -> auto-select
    selectedCollection = highConfidenceCandidates[0];
    selectedCollection.isAutoSelected = true;
  } else if (candidates.length === 1 && candidates[0].confidence !== 'LOW') {
    selectedCollection = candidates[0];
    selectedCollection.isAutoSelected = true;
  } else if (candidates.length > 0 && highConfidenceCandidates.length > 1) {
    // Multiple HIGH candidates -> default to highest score but flag for user selection
    selectedCollection = highConfidenceCandidates[0];
    selectedCollection.isAutoSelected = true;
  } else if (candidates.length > 0) {
    // Only medium or low candidates -> select top one
    selectedCollection = candidates[0];
    selectedCollection.isAutoSelected = true;
  }

  const globalMetadata = extractGlobalMetadata(root, selectedCollection?.path);

  return {
    candidateCollections: candidates,
    selectedCollection,
    globalMetadata,
    hasMultipleCandidates: candidates.length > 1,
  };
}
