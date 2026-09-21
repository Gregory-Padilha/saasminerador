// ==============================================================================
// OFFER MINER - CENTRALIZED CANONICAL NORMALIZATION & WHITELIST PROJECTION
// ==============================================================================

import { NormalizedOfferImportRecord, NormalizationReport } from './types';
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
} from '../normalization';
import {
  unwrapMarkdownUrl,
  normalizeProtocolUrl,
  extractMetaAdId,
  parseLocalizedDate,
} from './smart-json-ingestion';
import { resolveImportedOfferName } from './offer-name-resolver';

/**
 * STRICT SECURITY WHITELIST: Fields explicitly rejected or forbidden from external import.
 * JSON input MUST NEVER be accepted as canonical authority for SaaS internal state.
 */
export const FORBIDDEN_IMPORT_KEYS = new Set([
  'id',
  '_id',
  'uuid',
  'user_id',
  'userId',
  'organization_id',
  'organizationId',
  'org_id',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
  'inserted_at',
  'insertedAt',
  'auth',
  'token',
  'tokens',
  'api_key',
  'apiKey',
  'secret',
  'owner_id',
  'ownerId',
  'storage_path',
  'storagePath',
  // Mapping authority invariants - external input cannot declare itself mapped!
  'mapped',
  'is_mapped',
  'isMapped',
  'mapping_status',
  'mappingStatus',
  'lp_mapping_status',
  'lpMappingStatus',
  'lp_mapped',
  'lpMapped',
  'lp_mapped_at',
  'lpMappedAt',
  'checkout_mapping_status',
  'checkoutMappingStatus',
  'checkout_mapped',
  'checkoutMapped',
  'checkout_mapped_at',
  'checkoutMappedAt',
  'checkout_discovery_status',
  'checkoutDiscoveryStatus',
  'status',
  'validation_status',
  'data_status',
  'dataStatus',
  'operational_state',
  'operationalState',
]);

/**
 * Non-offer structural fields from AI intelligence / export packages that should be safely ignored.
 */
export const STRUCTURAL_EXPORT_KEYS = new Set([
  'conversation',
  'conversations',
  'messages',
  'aiInstructions',
  'ai_instructions',
  'creativesFacts',
  'creatives_facts',
  'landingPageFacts',
  'landing_page_facts',
  'checkoutFacts',
  'checkout_facts',
  'availability',
  'insightsAndNotes',
  'insights_and_notes',
  'metadata',
  'sources',
  'evidence',
  'creative_analyses',
  'ai_analysis',
  'aiAnalysis',
  'schema_version',
  'schemaVersion',
  'export_type',
  'exportType',
]);

/**
 * Normalizes an object key to lowercase alphanumeric without accents for alias matching.
 */
export function cleanKey(key: string): string {
  return String(key || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Aliases map matching cleaned raw keys (and dot-paths) to canonical fields.
 * Includes all expanded aliases requested for PT-BR and English.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  offer_name: [
    'offername',
    'offer_name',
    'name',
    'title',
    'nome',
    'nomeoferta',
    'nome_oferta',
    'titulo',
    'titulooferta',
    'titulo_oferta',
    'produto',
    'produtonome',
    'produto_nome',
    'productname',
    'product_name',
    'tipomaterial',
    'tipo_material',
    'material',
    'nomedomaterial',
    'nome_do_material',
    // Dot-path aliases
    'ofertanome',
    'oferta_nome',
    'produtonome',
    'ofertatitulo',
  ],
  advertiser: [
    'advertiser',
    'advertisername',
    'advertiser_name',
    'pagename',
    'page_name',
    'anunciante',
    'pagina',
    'nomepagina',
    'nome_pagina',
    'nomepaginaanunciante',
    'nome_pagina_anunciante',
    'paginaanunciante',
    'pagina_anunciante',
    'pagina_do_anunciante',
    'marca',
    'perfil',
    'nomeanunciante',
    'anunciantenome',
  ],
  niche: [
    'niche',
    'category',
    'nicho',
    'segmento',
    'mercado',
    'ramo',
    'nichosubnicho',
    'nicho_subnicho',
  ],
  subniche: [
    'subniche',
    'sub_niche',
    'subnicho',
    'sub_nicho',
    'subcategoria',
    'sub_category',
    'micronicho',
    'micro_nicho',
  ],
  active_ads_count: [
    'activeadscount',
    'activeads',
    'active_ads',
    'active_ads_count',
    'adsativos',
    'ads_ativos',
    'anunciosativos',
    'anuncios_ativos',
    'quantidadeanunciosativos',
    'quantidade_anuncios_ativos',
    'qtdanunciosativos',
    'qtd_anuncios_ativos',
    'numeroanunciosativos',
    'numero_anuncios_ativos',
    'qtdeanuncios',
    'quantidadedeanuncios',
    'totalads',
    'numerodeanuncios',
    'ads',
    'anuncios',
    // Dot-path aliases
    'metaadsanunciosativos',
    'metaadsanuncios',
    'metaadsactiveads',
  ],
  unique_creatives_count: [
    'uniquecreativescount',
    'uniquecreatives',
    'unique_creatives',
    'unique_creatives_count',
    'criativosdistintos',
    'criativos_distintos',
    'quantidadecriativos',
    'quantidade_criativos',
    'qtdcriativos',
    'qtd_criativos',
    'criativosunicos',
    'criativos_unicos',
    'estimateduniquecreatives',
    'estimated_unique_creatives',
    'totalcriativos',
    'creatives',
    'criativos',
    // Dot-path aliases
    'metaadscriativosdistintos',
    'metaadscriativos',
  ],
  days_running: [
    'daysactive',
    'days_active',
    'daysrunning',
    'days_running',
    'activedays',
    'active_days',
    'diasativos',
    'dias_ativos',
    'diasrodando',
    'dias_rodando',
    'diasnoar',
    'dias_no_ar',
    'tempoativodias',
    'tempo_ativo_dias',
    'tempodeveiculacao',
    'datainicioveiculacao',
    'data_inicio_veiculacao',
  ],
  first_seen: [
    'firstseen',
    'first_seen',
    'primeiroanuncio',
    'primeiro_anuncio',
    'dataprimeiroanuncio',
    'data_primeiro_anuncio',
    'inicioveiculacao',
    'inicio_veiculacao',
    'datainicio',
    'data_inicio',
    'oldestaddate',
    'oldest_ad_date',
    'primeiraveiculacao',
    'primeira_veiculacao',
  ],
  last_seen: [
    'lastseen',
    'last_seen',
    'ultimacaptura',
    'ultima_captura',
    'dataultimacaptura',
    'data_ultima_captura',
    'ultimaveiculacao',
    'ultima_veiculacao',
    'datafim',
    'data_fim',
  ],
  front_price: [
    'frontprice',
    'front_price',
    'price',
    'preco',
    'precofront',
    'preco_front',
    'precoprincipal',
    'preco_principal',
    'precooferta',
    'preco_oferta',
    'precodaoferta',
    'preco_da_oferta',
    'valoroferta',
    'valordaoferta',
    'ticket',
    'valor',
    'valorfront',
    'precovenda',
    // Dot-path aliases
    'precovalor',
    'ofertapreco',
    'ofertavalor',
  ],
  currency: [
    'currency',
    'moeda',
    'cambio',
  ],
  meta_ads_url: [
    'metaadsurl',
    'meta_ads_url',
    'facebookadsurl',
    'facebook_ads_url',
    'adslibraryurl',
    'ads_library_url',
    'bibliotecaanuncios',
    'biblioteca_anuncios',
    'bibliotecadeanuncios',
    'bibliotecaanunciosurl',
    'biblioteca_anuncios_url',
    'urlbibliotecaanunciospagina',
    'url_biblioteca_anuncios_pagina',
    'urlbibliotecaanuncios',
    'url_biblioteca_anuncios',
    'linkbiblioteca',
    'link_biblioteca',
    'linkbibliotecaanuncios',
    'link_biblioteca_anuncios',
    'linkmetaads',
    'link_meta_ads',
    'urlmetaads',
    'url_meta_ads',
    'metaurl',
    'adlibraryurl',
    'ad_library_url',
    'linkanuncios',
    'link_anuncios',
    'linkads',
    'metaadslibrary',
    // Dot-path aliases
    'metaadsurl',
    'metaadslink',
  ],
  meta_page_id: [
    'metapageid',
    'meta_page_id',
    'pageid',
    'page_id',
    'idpagina',
    'id_pagina',
    'facebookpageid',
  ],
  landing_page_url: [
    'landingpageurl',
    'landing_page_url',
    'landingpage',
    'landing_page',
    'salespage',
    'sales_page',
    'salespageurl',
    'sales_page_url',
    'paginavendas',
    'pagina_vendas',
    'urlpaginavendas',
    'url_pagina_vendas',
    'linkpaginavendas',
    'link_pagina_vendas',
    'lp',
    'lpurl',
    'lp_url',
    'site',
    'siteurl',
    'urllp',
    'linkdestino',
    'link_destino',
    'destinolink',
    'destino_link',
    'urldestino',
    'url_destino',
    // Dot-path aliases
    'funillandingpage',
    'funilpaginavendas',
    'funillp',
  ],
  checkout_url: [
    'checkouturl',
    'checkout_url',
    'checkout',
    'urlcheckout',
    'url_checkout',
    'linkcheckout',
    'link_checkout',
    'hotmarturl',
    'kiwifyurl',
    // Dot-path aliases
    'funilcheckout',
    'checkoutlink',
  ],
  faceless: [
    'faceless',
    'semespecialista',
    'sem_especialista',
    'semrosto',
    'sem_rosto',
    'anonimo',
    'isfaceless',
    'is_faceless',
  ],
  product_format: [
    'productformat',
    'product_format',
    'formato',
    'formatoproduto',
    'formato_produto',
    'tipoproduto',
    'tipo_produto',
    'mecanismotipoproduto',
    'mecanismo_tipo_produto',
    'mecanismo',
    'tipodeproduto',
    'tipo_de_produto',
    'adformat',
    'ad_format',
    'tipo',
  ],
  headline: [
    'headline',
    'titulo',
    'manchete',
    'copyheadline',
    'promessa',
    'promessaprincipal',
    'promessa_principal',
    'promessadoanuncio',
    'promise',
  ],
  subheadline: [
    'subheadline',
    'subtitulo',
    'sub_titulo',
  ],
  notes: [
    'notes',
    'nota',
    'notas',
    'observacoes',
    'observacao',
    'obs',
    'comentarios',
  ],
  score: [
    'score',
    'workscore',
    'work_score',
    'pontuacao',
    'notascore',
  ],
  source: [
    'source',
    'fonte',
    'origem',
  ],
};

// Inverted lookup map: cleanedAlias -> canonicalField
const ALIAS_LOOKUP: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_LOOKUP[cleanKey(alias)] = canonical;
  }
}

interface FlattenedEntry {
  path: string;       // e.g. "$.meta_ads.anuncios_ativos"
  dotKey: string;     // e.g. "meta_ads.anuncios_ativos"
  leafKey: string;    // e.g. "anuncios_ativos"
  value: any;
}

/**
 * Recursively flattens an object to extract both dot-paths and leaf properties.
 */
function extractFlattenedEntries(
  obj: any,
  parentPath = '$',
  parentDot = '',
  depth = 0,
  maxDepth = 3
): FlattenedEntry[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > maxDepth) {
    return [];
  }

  const entries: FlattenedEntry[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const curPath = parentPath === '$' ? `$.${key}` : `${parentPath}.${key}`;
    const curDot = parentDot ? `${parentDot}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse deeper into nested object
      const sub = extractFlattenedEntries(value, curPath, curDot, depth + 1, maxDepth);
      entries.push(...sub);
    } else {
      entries.push({
        path: curPath,
        dotKey: curDot,
        leafKey: key,
        value,
      });
    }
  }

  return entries;
}

/**
 * Normalizes a raw object from JSON input into a canonical NormalizedOfferImportRecord.
 *
 * Enforces:
 * 1. Security Whitelist: Discards forbidden internal fields.
 * 2. Canonical Aliases (EN and PT-BR) + Dot-Paths (e.g. meta_ads.anuncios_ativos).
 * 3. Strict separation of active_ads_count vs unique_creatives_count (CRITICAL INVARIANT).
 * 4. Safe coercion (no guessing, null when missing or invalid).
 * 5. Minimum identity validation + weak identity warning.
 * 6. Discards Meta Ads search categories (e.g. "Todos os anúncios") from niche.
 * 7. Tracks sourceFieldMap for full transparency and debug view.
 */
export function normalizeOfferImportRecord(
  raw: any,
  inheritedMeta?: { country?: string; language?: string; currency?: string }
): NormalizationReport {
  const warnings: string[] = [];
  const errors: string[] = [];
  const ignoredFields: string[] = [];
  const recognizedFields: string[] = [];
  const unrecognizedFields: string[] = [];
  const extraData: Record<string, any> = {};
  const sourceFieldMap: Record<string, string> = {};

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      record: {
        offer_name: '',
        advertiser: null,
        niche: null,
        subniche: null,
        product_type: null,
        active_ads_count: null,
        unique_creatives_count: null,
        oldest_ad_date: null,
        newest_ad_date: null,
        days_running: null,
        front_price: null,
        currency: 'BRL',
        meta_ads_url: null,
        meta_page_id: null,
        landing_page_url: null,
        checkout_url: null,
        product_format: null,
        faceless: null,
        headline: null,
        subheadline: null,
        notes: null,
        score: null,
        source: null,
        raw_data: {},
        extra_data: {},
      },
      warnings: [],
      errors: ['Registro JSON inválido (não é um objeto válido)'],
      ignoredFields: [],
      weakIdentification: true,
      sourceFieldMap: {},
      recognizedFields: [],
      unrecognizedFields: [],
    };
  }

  // Mapped bucket for extracted values
  const extracted: Record<string, any> = {};

  // Extract all flattened paths (both direct and nested dot-paths)
  const flattened = extractFlattenedEntries(raw);

  for (const entry of flattened) {
    const { path, dotKey, leafKey, value } = entry;

    // 1. Check if forbidden internal field
    if (
      FORBIDDEN_IMPORT_KEYS.has(leafKey) ||
      FORBIDDEN_IMPORT_KEYS.has(cleanKey(leafKey)) ||
      FORBIDDEN_IMPORT_KEYS.has(cleanKey(dotKey))
    ) {
      if (!ignoredFields.includes(leafKey)) ignoredFields.push(leafKey);
      if (path !== leafKey && !ignoredFields.includes(path)) ignoredFields.push(path);
      continue;
    }

    // 2. Check if known structural/export metadata field to safely ignore
    if (
      STRUCTURAL_EXPORT_KEYS.has(leafKey) ||
      STRUCTURAL_EXPORT_KEYS.has(cleanKey(leafKey))
    ) {
      if (!ignoredFields.includes(leafKey)) ignoredFields.push(leafKey);
      if (path !== leafKey && !ignoredFields.includes(path)) ignoredFields.push(path);
      continue;
    }

    // 3. Try to match dotKey alias first (e.g. meta_ads.anuncios_ativos), then leafKey (e.g. anuncios_ativos)
    const cleanedDot = cleanKey(dotKey);
    const cleanedLeaf = cleanKey(leafKey);

    let matchedCanonical = ALIAS_LOOKUP[cleanedDot] || ALIAS_LOOKUP[cleanedLeaf];

    if (matchedCanonical) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        // Only assign if not already assigned by a higher priority match
        if (!(matchedCanonical in extracted)) {
          extracted[matchedCanonical] = value;
          sourceFieldMap[matchedCanonical] = path;
          recognizedFields.push(path);
        }
      }
    } else {
      // Unknown or non-canonical field: preserve in extraData and track
      if (value !== undefined && value !== null && typeof value !== 'function') {
        extraData[dotKey] = value;
        unrecognizedFields.push(path);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STRICT DATA NORMALIZATION (Safe coercion, zero guessing)
  // --------------------------------------------------------------------------

  // NICHO & SUBNICHO DISAMBIGUATION:
  // Discard search category filters like "Todos os anúncios" or "Todas as categorias"
  let niche = normalizeText(extracted.niche);
  let subniche = normalizeText(extracted.subniche);

  if (niche) {
    const cleanN = niche.toLowerCase().trim();
    if (
      cleanN === 'todos os anuncios' ||
      cleanN === 'todos os anúncios' ||
      cleanN === 'todas as categorias' ||
      cleanN === 'all ads' ||
      cleanN === 'all categories' ||
      cleanN === 'todos os anuncios do facebook'
    ) {
      niche = null;
    } else if (niche.includes(' / ')) {
      // Split compound "Marketing digital / Instagram e Stories" into niche and subniche
      const parts = niche.split(' / ');
      niche = parts[0]?.trim() || null;
      if (!subniche) {
        subniche = parts.slice(1).join(' / ')?.trim() || null;
      }
    }
  }

  // Centralized identity resolution (Strict priority 1-10, prevents pagina from becoming offer_name)
  const identity = resolveImportedOfferName(raw, {
    offer_name: extracted.offer_name,
    advertiser: extracted.advertiser,
  });

  const advertiser = normalizeText(identity.advertiser || extracted.advertiser);
  const productFormat = normalizeText(extracted.product_format);

  // URLs & Disambiguation (Smart Unwrapping & Protocol Normalization)
  let rawMetaUrl = extracted.meta_ads_url ? unwrapMarkdownUrl(extracted.meta_ads_url) : null;
  let rawLpUrl = extracted.landing_page_url ? unwrapMarkdownUrl(extracted.landing_page_url) : null;
  let rawCheckoutUrl = extracted.checkout_url ? unwrapMarkdownUrl(extracted.checkout_url) : null;

  // Extract meta_ad_id if present
  if (rawMetaUrl) {
    const adId = extractMetaAdId(rawMetaUrl);
    if (adId) {
      extraData.meta_ad_id = adId;
    }
  }

  // Normalize protocol on landing page url (e.g. KITKIDSESCOLAR.COM.BR -> https://kitkidsescolar.com.br)
  if (rawLpUrl) {
    const protoRes = normalizeProtocolUrl(rawLpUrl);
    rawLpUrl = protoRes.url;
    if (protoRes.addedProtocol) {
      extraData.original_landing_page_url_raw = protoRes.original;
    }
  }

  if (rawCheckoutUrl) {
    const protoRes = normalizeProtocolUrl(rawCheckoutUrl);
    rawCheckoutUrl = protoRes.url;
  }

  let metaAdsUrl = normalizeUrl(rawMetaUrl);
  let landingPageUrl = normalizeUrl(rawLpUrl);
  let checkoutUrl = normalizeUrl(rawCheckoutUrl);

  // Auto-heal misplaced URLs
  if (landingPageUrl) {
    const classification = classifyUrl(landingPageUrl);
    if (classification === 'META_ADS_LIBRARY') {
      if (!metaAdsUrl) metaAdsUrl = landingPageUrl;
      landingPageUrl = null;
      warnings.push('A URL da Página de Vendas era na verdade um link da Biblioteca do Meta Ads. Realocado automaticamente.');
    } else if (classification === 'CHECKOUT') {
      if (!checkoutUrl) checkoutUrl = landingPageUrl;
      landingPageUrl = null;
      warnings.push('A URL da Página de Vendas era na verdade um link de Checkout. Realocado automaticamente.');
    }
  }

  // Offer Name / Identity from centralized resolver
  let offerName = identity.offerName || '';

  // If no explicit offer name, try to intelligently infer a product name from mechanism or landing page URL slug
  if (!offerName) {
    if (productFormat && productFormat.length >= 4 && productFormat.length <= 100) {
      offerName = productFormat;
    } else if (landingPageUrl) {
      try {
        const u = new URL(landingPageUrl.startsWith('http') ? landingPageUrl : `https://${landingPageUrl}`);
        const pathSegments = u.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSeg = pathSegments[pathSegments.length - 1];
          if (lastSeg && !lastSeg.includes('.') && lastSeg.length >= 3) {
            offerName = lastSeg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // SCALE & VOLUME: STRICT SEPARATION (CRITICAL INVARIANT)
  // ACTIVE STATUS VS ACTIVE COUNT:
  // "anuncios_ativos": "Yes", "ativo", true is an ad status signal, NEVER an active_ads_count!
  let sourceAdActive: boolean | null = null;
  const rawActiveVal = extracted.active_ads_count;
  if (typeof rawActiveVal === 'boolean') {
    sourceAdActive = rawActiveVal;
    extracted.active_ads_count = null;
    extraData.source_ad_active = sourceAdActive;
    extraData.ad_status = sourceAdActive ? 'active' : 'inactive';
    warnings.push(
      `O campo de anúncios ativos informou status (${rawActiveVal ? 'true' : 'false'}) em vez de contagem numérica. Mantido como status do anúncio.`
    );
  } else if (typeof rawActiveVal === 'string') {
    const trimmedVal = rawActiveVal.trim().toLowerCase();
    if (['yes', 'sim', 'ativo', 'active', 'true'].includes(trimmedVal)) {
      sourceAdActive = true;
      extracted.active_ads_count = null;
      extraData.source_ad_active = true;
      extraData.ad_status = 'active';
      warnings.push(
        `O campo de anúncios ativos informa status ('${rawActiveVal}') e não a contagem numérica de anúncios da oferta. Contagem mantida como desconhecida.`
      );
    } else if (['no', 'nao', 'não', 'inativo', 'inactive', 'false'].includes(trimmedVal)) {
      sourceAdActive = false;
      extracted.active_ads_count = null;
      extraData.source_ad_active = false;
      extraData.ad_status = 'inactive';
      warnings.push(
        `O campo de anúncios ativos informa status ('${rawActiveVal}') e não a contagem numérica de anúncios da oferta. Contagem mantida como desconhecida.`
      );
    }
  }

  const adsResult = normalizeAdsCount(extracted.active_ads_count);
  const creativesResult = normalizeAdsCount(extracted.unique_creatives_count);

  if (adsResult.error) warnings.push(adsResult.error);
  if (creativesResult.error) warnings.push(creativesResult.error);

  // Price & Currency
  const priceResult = normalizePrice(extracted.front_price);
  if (priceResult.error) warnings.push(priceResult.error);

  let currency = 'BRL';
  if (extracted.currency && typeof extracted.currency === 'string') {
    const cleanCurr = extracted.currency.trim().toUpperCase();
    if (cleanCurr.length === 3) currency = cleanCurr;
  } else if (inheritedMeta?.currency) {
    currency = inheritedMeta.currency;
  }

  // Dates & Running Time (Supporting Portuguese localized dates: e.g. "11 de jun de 2026")
  const oldestAdDate = parseLocalizedDate(extracted.first_seen) || normalizeDate(extracted.first_seen);
  const newestAdDate = parseLocalizedDate(extracted.last_seen) || normalizeDate(extracted.last_seen);
  const daysRunningRes = normalizeDaysRunning(extracted.days_running);
  if (daysRunningRes.error) warnings.push(daysRunningRes.error);

  let daysRunning = daysRunningRes.value;
  // If days running was not directly provided, derive from first_seen and reference date if known
  const refDate = (inheritedMeta as any)?.referenceDate || (inheritedMeta as any)?.queryDate;
  if (daysRunning === null && oldestAdDate && refDate) {
    try {
      const tOldest = new Date(oldestAdDate).getTime();
      const tRef = new Date(refDate).getTime();
      if (!isNaN(tOldest) && !isNaN(tRef) && tRef >= tOldest) {
        daysRunning = Math.floor((tRef - tOldest) / (1000 * 60 * 60 * 24));
        extraData.days_active_derived = true;
      }
    } catch {
      // ignore
    }
  }

  // Faceless
  const faceless = normalizeFaceless(extracted.faceless);

  // Meta Page ID
  let metaPageId: string | null = null;
  if (extracted.meta_page_id) {
    metaPageId = String(extracted.meta_page_id).trim() || null;
  }

  // Copy & Extras (including promise mapping)
  const headline = normalizeText(extracted.headline);
  const subheadline = normalizeText(extracted.subheadline);
  const notes = normalizeText(extracted.notes);
  const score = normalizeScore(extracted.score);
  const source = normalizeText(extracted.source) || 'JSON_IMPORT';

  if (extracted.headline || extracted.promise || extracted.promessa) {
    extraData.promise = extracted.promise || extracted.promessa || extracted.headline;
  }

  const record: NormalizedOfferImportRecord = {
    offer_name: offerName,
    advertiser,
    niche,
    subniche,
    product_type: productFormat,
    active_ads_count: adsResult.value,
    unique_creatives_count: creativesResult.value,
    oldest_ad_date: oldestAdDate,
    newest_ad_date: newestAdDate,
    days_running: daysRunning,
    front_price: priceResult.value,
    currency,
    meta_ads_url: metaAdsUrl,
    meta_page_id: metaPageId,
    landing_page_url: landingPageUrl,
    checkout_url: checkoutUrl,
    product_format: productFormat,
    faceless,
    headline,
    subheadline,
    notes,
    score,
    source,
    raw_data: raw,
    extra_data: extraData,
  };

  // --------------------------------------------------------------------------
  // MINIMUM IDENTITY CHECK & WEAK IDENTIFICATION WARNINGS (PERSISTENCE GATE)
  // --------------------------------------------------------------------------
  const hasName = Boolean(offerName && offerName.trim().length > 0);
  const hasAdv = Boolean(advertiser && advertiser.trim().length > 0);
  const hasLp = Boolean(landingPageUrl && landingPageUrl.trim().length > 0);
  const hasMeta = Boolean(metaAdsUrl && metaAdsUrl.trim().length > 0);
  const hasCheckout = Boolean(checkoutUrl && checkoutUrl.trim().length > 0);
  const hasMetaPageId = Boolean(metaPageId && metaPageId.trim().length > 0);

  // Minimum Identity: Must have at least one valid identity anchor
  const hasMinimumIdentity = hasName || hasLp || hasMeta || hasCheckout;

  let weakIdentification = false;

  if (!hasMinimumIdentity) {
    errors.push('Identidade insuficiente para persistência: oferta sem nome, sem landing page, sem checkout e sem URL de anúncios.');
  } else if (!hasName && (hasLp || hasMeta || hasCheckout)) {
    weakIdentification = true;
    warnings.push('Nome da oferta ausente (identificação baseada apenas em URL).');
  } else if (hasName && !hasAdv && !hasLp && !hasMeta && !hasCheckout) {
    weakIdentification = true;
    warnings.push('Identificação fraca: apenas o nome foi informado (sem anunciante, LP ou link do Meta Ads).');
  } else if (!hasName && hasAdv && !hasLp && !hasMeta && !hasMetaPageId && !hasCheckout) {
    weakIdentification = true;
    warnings.push('Identificação fraca: apenas anunciante informado sem URLs operacionais.');
  }

  // Non-fatal physical sanity warnings
  if (record.front_price !== null && record.front_price < 0) {
    warnings.push(`Preço negativo detectado (R$ ${record.front_price}).`);
  }
  if (record.active_ads_count !== null && record.active_ads_count < 0) {
    warnings.push(`Contagem de anúncios ativos negativa (${record.active_ads_count}).`);
  }

  return {
    record,
    warnings,
    errors,
    ignoredFields,
    weakIdentification,
    sourceFieldMap,
    recognizedFields,
    unrecognizedFields,
  };
}
