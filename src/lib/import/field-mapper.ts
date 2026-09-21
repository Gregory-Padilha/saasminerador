// ==============================================================================
// OFFER MINER - OFFER FIELD MAPPER & CUSTOM MAPPING PERSISTENCE
// ==============================================================================

export type CanonicalFieldTarget =
  | 'offer_name'
  | 'advertiser'
  | 'niche'
  | 'subniche'
  | 'active_ads_count'
  | 'unique_creatives_count'
  | 'front_price'
  | 'currency'
  | 'landing_page_url'
  | 'checkout_url'
  | 'meta_ads_url'
  | 'days_active'
  | 'first_seen'
  | 'last_seen'
  | 'product_format'
  | 'faceless'
  | 'notes'
  | 'ignore';

export interface FieldMappingRule {
  sourceKey: string;
  targetField: CanonicalFieldTarget;
}

export type CustomFieldMap = Record<string, CanonicalFieldTarget>;

export const TARGET_FIELD_OPTIONS: Array<{
  value: CanonicalFieldTarget;
  label: string;
  description: string;
}> = [
  { value: 'offer_name', label: 'Nome da Oferta', description: 'Título comercial ou produto' },
  { value: 'advertiser', label: 'Anunciante', description: 'Página ou marca anunciante' },
  { value: 'niche', label: 'Nicho', description: 'Nicho ou segmento de mercado' },
  { value: 'subniche', label: 'Subnicho', description: 'Subcategoria específica' },
  { value: 'active_ads_count', label: 'Ads Ativos (Volume)', description: 'Quantidade de anúncios ativos' },
  { value: 'unique_creatives_count', label: 'Criativos Distintos', description: 'Quantidade de criativos únicos' },
  { value: 'front_price', label: 'Preço Front (R$)', description: 'Valor de venda principal' },
  { value: 'currency', label: 'Moeda', description: 'BRL, USD, EUR, etc.' },
  { value: 'landing_page_url', label: 'URL Página de Vendas (LP)', description: 'Link final de destino' },
  { value: 'checkout_url', label: 'URL Checkout', description: 'Link direto para pagamento' },
  { value: 'meta_ads_url', label: 'URL Biblioteca Meta Ads', description: 'Link do cluster na biblioteca' },
  { value: 'days_active', label: 'Dias Rodando', description: 'Tempo em dias de veiculação' },
  { value: 'first_seen', label: 'Data de Início', description: 'Data do primeiro anúncio' },
  { value: 'last_seen', label: 'Última Captura', description: 'Data da última veiculação' },
  { value: 'product_format', label: 'Formato do Produto', description: 'Ebook, Template, Curso, etc.' },
  { value: 'faceless', label: 'Faceless (Sem Rosto)', description: 'Booleano: true/false' },
  { value: 'notes', label: 'Observações / Notas', description: 'Comentários ou anotações' },
  { value: 'ignore', label: 'Ignorar Campo', description: 'Não mapear e descartar' },
];

/**
 * Computes a deterministic fingerprint of an object's keys for mapping persistence.
 */
export function computeSchemaFingerprint(sampleKeys: string[]): string {
  if (!sampleKeys || sampleKeys.length === 0) return 'empty_schema';
  const sorted = [...sampleKeys].sort().join('::');
  // Simple hash for localStorage key
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `schema_fp_${Math.abs(hash)}`;
}

const STORAGE_KEY_PREFIX = 'offerminer_field_map_';

/**
 * Loads custom mapping from localStorage by fingerprint.
 */
export function loadSavedMapping(fingerprint: string): CustomFieldMap | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${fingerprint}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load saved field map:', err);
  }
  return null;
}

/**
 * Saves custom mapping to localStorage by fingerprint.
 */
export function saveCustomMapping(fingerprint: string, mapping: CustomFieldMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${fingerprint}`, JSON.stringify(mapping));
  } catch (err) {
    console.warn('Failed to save field map:', err);
  }
}

/**
 * Applies custom field mapping overrides to a raw item before standard normalization.
 */
export function applyFieldMapping(rawItem: any, mapping: CustomFieldMap): any {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem) || !mapping) {
    return rawItem;
  }

  const modified = { ...rawItem };

  for (const [sourceKey, targetField] of Object.entries(mapping)) {
    if (targetField === 'ignore') {
      delete modified[sourceKey];
      continue;
    }

    if (sourceKey in modified && modified[sourceKey] !== undefined) {
      // Map to targetField if not already present
      if (!(targetField in modified)) {
        modified[targetField] = modified[sourceKey];
      }
    }
  }

  return modified;
}
