import { z } from 'zod';

export const TransformationStatusSchema = z.enum([
  'MANDATORY_NEW',
  'PRESERVED',
  'STRATEGIC_CHANGE',
  'LOCALIZED',
  'CHANGED',
  'ADAPTED',
  'LOCKED',
]);

export type TransformationStatus = z.infer<typeof TransformationStatusSchema>;

// Zod Item Schema
export const TransformationMatrixItemSchema = z.object({
  dimension: z.string(),
  status: TransformationStatusSchema.default('PRESERVED'),
  sourceValue: z.unknown().optional(),
  modelValue: z.unknown().optional(),
  originalValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  rationale: z.string().optional(),
});

export type CanonicalTransformationMatrixItem = {
  dimension: string;
  status: TransformationStatus;
  sourceValue: string;
  modelValue: string;
  rationale?: string;
};

/**
 * Format any arbitrary project value safely into a string representation.
 * Prevents React [object Object] render errors.
 */
export function formatProjectValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.map((v) => formatProjectValue(v)).join(', ');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    if (obj.name && typeof obj.name === 'string') return obj.name;
    if (obj.title && typeof obj.title === 'string') return obj.title;
    if (obj.value && isPrimitive(obj.value)) return String(obj.value);
    if (obj.summary && typeof obj.summary === 'string') return obj.summary;
    if (obj.text && typeof obj.text === 'string') return obj.text;
    if (obj.label && typeof obj.label === 'string') return obj.label;

    try {
      return JSON.stringify(value);
    } catch {
      return '[Objeto Estruturado]';
    }
  }

  return String(value);
}

function isPrimitive(val: unknown): boolean {
  return typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean';
}

/**
 * Ensures any input is converted to a safe array.
 */
export function ensureArray<T = any>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }

  if (typeof raw === 'object') {
    return Object.values(raw) as T[];
  }

  return [];
}

/**
 * Central Normalizer for Transformation Matrix.
 * Handles:
 * 1. Array of Canonical items
 * 2. Object with `.dimensions` property array (e.g. `{ sourceOfferId, dimensions: [...] }`)
 * 3. Object keyed by dimension (e.g. `{ MARKET: { status: 'CHANGED', ... }, PRODUCT: { ... } }`)
 * 4. JSON string (parses JSON then recursively normalizes)
 * 5. null / undefined / malformed shape -> returns []
 */
export function normalizeTransformationMatrix(raw: unknown): CanonicalTransformationMatrixItem[] {
  if (raw === null || raw === undefined) {
    return [];
  }

  // 1. JSON String parsing
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeTransformationMatrix(parsed);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[TRANSFORMATION_NORMALIZER] Failed to parse JSON string:', raw);
      }
      return [];
    }
  }

  // 2. Object containing `.dimensions` property array
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && 'dimensions' in (raw as any)) {
    const dims = (raw as any).dimensions;
    if (Array.isArray(dims)) {
      return normalizeTransformationMatrix(dims);
    }
  }

  // 3. Array of items
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeItem(item))
      .filter((item): item is CanonicalTransformationMatrixItem => item !== null);
  }

  // 4. Object keyed by dimension (e.g. { MARKET: {...}, POSITIONING: {...} })
  if (typeof raw === 'object' && raw !== null) {
    const items: CanonicalTransformationMatrixItem[] = [];
    for (const [dimKey, dimVal] of Object.entries(raw as Record<string, any>)) {
      if (dimVal && typeof dimVal === 'object') {
        const normalized = normalizeItem({ dimension: dimKey, ...dimVal });
        if (normalized) items.push(normalized);
      }
    }
    return items;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[TRANSFORMATION_NORMALIZER_INVALID_SHAPE]', typeof raw, raw);
  }

  return [];
}

function normalizeItem(rawItem: any): CanonicalTransformationMatrixItem | null {
  if (!rawItem || typeof rawItem !== 'object') return null;

  const dimension = String(rawItem.dimension || rawItem.name || rawItem.key || 'DIMENSION');

  let rawStatus = String(rawItem.status || 'PRESERVED').toUpperCase();
  if (!['PRESERVED', 'CHANGED', 'ADAPTED', 'LOCKED'].includes(rawStatus)) {
    rawStatus = 'PRESERVED';
  }

  const sourceVal = formatProjectValue(rawItem.sourceValue ?? rawItem.originalValue ?? rawItem.from ?? '-');
  const modelVal = formatProjectValue(rawItem.modelValue ?? rawItem.newValue ?? rawItem.to ?? '-');
  const rationale = rawItem.rationale ? String(rawItem.rationale) : undefined;

  return {
    dimension,
    status: rawStatus as TransformationStatus,
    sourceValue: sourceVal,
    modelValue: modelVal,
    rationale,
  };
}
