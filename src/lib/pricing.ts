import { OfferFrontendOption } from '@/types';

export interface FrontendPricingSummary {
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  options: OfferFrontendOption[];
}

/**
 * Calculates aggregated front-end metrics from a list of options.
 * Uses simple arithmetic mean of current_price values.
 */
export function calculateFrontendPricing(
  options?: OfferFrontendOption[] | null,
  fallbackPrice?: number | null
): FrontendPricingSummary {
  const validOptions = (options || []).filter(
    (opt) => typeof opt.current_price === 'number' && !isNaN(opt.current_price) && opt.current_price > 0
  );

  if (validOptions.length === 0) {
    if (typeof fallbackPrice === 'number' && !isNaN(fallbackPrice) && fallbackPrice > 0) {
      const fallbackVal = Math.round(fallbackPrice * 100) / 100;
      return {
        count: 1,
        min: fallbackVal,
        max: fallbackVal,
        average: fallbackVal,
        options: [],
      };
    }
    return {
      count: 0,
      min: null,
      max: null,
      average: null,
      options: [],
    };
  }

  const prices = validOptions.map((opt) => opt.current_price);
  const min = Math.round(Math.min(...prices) * 100) / 100;
  const max = Math.round(Math.max(...prices) * 100) / 100;
  const sum = prices.reduce((acc, p) => acc + p, 0);
  const average = Math.round((sum / prices.length) * 100) / 100;

  return {
    count: validOptions.length,
    min,
    max,
    average,
    options: validOptions,
  };
}

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/I';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
