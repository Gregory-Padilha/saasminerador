// ==============================================================================
// OFFER MINER - CENTRALIZED OFFER NAME & IDENTITY RESOLVER
// ==============================================================================

/**
 * Prohibited placeholders that should never be treated as valid offer names.
 */
const PLACEHOLDER_NAMES = new Set([
  'oferta sem nome',
  'sem nome',
  'sem titulo',
  'sem título',
  '<<sem nome>>',
  '<< sem nome >>',
  'null',
  'undefined',
  'n/a',
  'na',
  'none',
  'nenhum',
  'sem produto',
  'produto sem nome',
  'oferta',
  'anúncio',
  'anuncio',
]);

/**
 * Keys that must NEVER be interpreted as an offer/product name, as they denote the advertiser or page.
 */
const FORBIDDEN_OFFER_NAME_KEYS = new Set([
  'pagina',
  'page',
  'page_name',
  'pagename',
  'nome_pagina',
  'nomepagina',
  'advertiser',
  'advertiser_name',
  'advertisername',
  'anunciante',
  'anunciantenome',
  'nome_anunciante',
  'nomeanunciante',
  'marca',
  'perfil',
  'perfil_anunciante',
]);

/**
 * Strict priority list for offer/product name resolution:
 * 1. offer_name
 * 2. offerName
 * 3. nome_oferta
 * 4. titulo_oferta
 * 5. product_name
 * 6. produto_nome
 * 7. tipo_material
 * 8. produto
 * 9. title
 * 10. nome
 */
const OFFER_NAME_PRIORITY_KEYS: string[] = [
  'offer_name',
  'offerName',
  'offername',
  'nome_oferta',
  'nomeoferta',
  'titulo_oferta',
  'titulooferta',
  'product_name',
  'productName',
  'productname',
  'produto_nome',
  'produtonome',
  'tipo_material',
  'tipomaterial',
  'material',
  'tipo_do_material',
  'produto',
  'title',
  'titulo',
  'nome',
];

/**
 * Priority list for advertiser resolution:
 */
const ADVERTISER_PRIORITY_KEYS: string[] = [
  'advertiser',
  'advertiser_name',
  'advertiserName',
  'anunciante',
  'nome_anunciante',
  'pagina',
  'page',
  'page_name',
  'pageName',
  'nome_pagina',
  'marca',
  'perfil',
];

function cleanKey(k: string): string {
  return k
    .toLowerCase()
    .trim()
    .replace(/[\\_\-\s\.]+/g, '');
}

function isPlaceholder(val?: string | null): boolean {
  if (!val) return true;
  const cleaned = val.toLowerCase().trim().replace(/[\s\-_]+/g, ' ');
  return PLACEHOLDER_NAMES.has(cleaned);
}

export interface ResolvedOfferIdentity {
  offerName: string | null;
  advertiser: string | null;
  resolvedNameFromKey: string | null;
  resolvedAdvertiserFromKey: string | null;
  hasValidName: boolean;
  status: 'VALID_NAME' | 'NEEDS_NAME' | 'INVALID_NAME';
}

/**
 * Centrally resolves the canonical offer name and advertiser from raw input and normalized record.
 * 
 * INVARIANTS:
 * 1. Strict priority resolution (1 to 10).
 * 2. `pagina` / advertiser keys are NEVER treated as offer name.
 * 3. Discards placeholders ("Oferta Sem Nome", "Sem nome", etc.).
 * 4. Returns `null` if no valid product name exists (never returns "Oferta Sem Nome").
 */
export function resolveImportedOfferName(
  raw: any,
  normalized?: any
): ResolvedOfferIdentity {
  let resolvedOfferName: string | null = null;
  let resolvedNameKey: string | null = null;

  let resolvedAdvertiser: string | null = null;
  let resolvedAdvertiserKey: string | null = null;

  // Build key-value dictionaries from raw and normalized
  const candidates: Record<string, string> = {};

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' && v.trim()) {
        candidates[k] = v.trim();
        candidates[cleanKey(k)] = v.trim();
      }
    }
  }

  // Also check nested dot-paths if any
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      if (typeof raw[key] === 'object' && raw[key] !== null) {
        for (const [subK, subV] of Object.entries(raw[key])) {
          if (typeof subV === 'string' && subV.trim()) {
            candidates[`${key}.${subK}`] = subV.trim();
            candidates[cleanKey(`${key}.${subK}`)] = subV.trim();
            candidates[cleanKey(subK)] = subV.trim();
          }
        }
      }
    }
  }

  // 1. Resolve Offer Name by Strict Priority
  for (const pKey of OFFER_NAME_PRIORITY_KEYS) {
    const directVal = candidates[pKey] || candidates[cleanKey(pKey)];
    if (directVal && !isPlaceholder(directVal)) {
      resolvedOfferName = directVal;
      resolvedNameKey = pKey;
      break;
    }
  }

  // Check normalized record if not resolved from raw
  if (!resolvedOfferName && normalized) {
    const normName = normalized.offer_name || normalized.product_name;
    if (normName && typeof normName === 'string' && !isPlaceholder(normName)) {
      resolvedOfferName = normName.trim();
      resolvedNameKey = 'normalized';
    }
  }

  // 2. Resolve Advertiser
  for (const aKey of ADVERTISER_PRIORITY_KEYS) {
    const directVal = candidates[aKey] || candidates[cleanKey(aKey)];
    if (directVal && !isPlaceholder(directVal)) {
      resolvedAdvertiser = directVal;
      resolvedAdvertiserKey = aKey;
      break;
    }
  }

  if (!resolvedAdvertiser && normalized?.advertiser && !isPlaceholder(normalized.advertiser)) {
    resolvedAdvertiser = normalized.advertiser.trim();
    resolvedAdvertiserKey = 'normalized.advertiser';
  }

  // Final check: if resolvedOfferName is equal to advertiser or in forbidden advertiser keys, reject it
  if (resolvedOfferName && resolvedAdvertiser) {
    if (resolvedOfferName.toLowerCase().trim() === resolvedAdvertiser.toLowerCase().trim()) {
      // Name was accidentally duplicated as advertiser
      resolvedOfferName = null;
      resolvedNameKey = null;
    }
  }

  // Check if resolvedNameKey was a forbidden advertiser key
  if (resolvedNameKey && FORBIDDEN_OFFER_NAME_KEYS.has(cleanKey(resolvedNameKey))) {
    resolvedOfferName = null;
    resolvedNameKey = null;
  }

  const hasValidName = Boolean(resolvedOfferName && resolvedOfferName.length >= 2 && !isPlaceholder(resolvedOfferName));

  return {
    offerName: hasValidName ? resolvedOfferName : null,
    advertiser: resolvedAdvertiser,
    resolvedNameFromKey: resolvedNameKey,
    resolvedAdvertiserFromKey: resolvedAdvertiserKey,
    hasValidName,
    status: hasValidName ? 'VALID_NAME' : 'NEEDS_NAME',
  };
}
