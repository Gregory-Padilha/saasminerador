import { dbService } from '@/lib/supabase/db';
import {
  DeepDive,
  DeepDiveStatus,
  DeepDivePriority,
  DeepDiveSnapshot,
  DeepDiveInsight,
  DeepDiveHypothesis,
  DeepDiveTest,
  ResearchPattern,
  Offer,
} from '@/types';

export function normalizeDeepDiveStatus(status: string): DeepDiveStatus {
  switch (status) {
    case 'Fila':
      return 'BACKLOG';
    case 'Pesquisando':
    case 'Analisando':
      return 'EM_ANALISE';
    case 'Pronta':
      return 'SINTETIZANDO';
    case 'Modelar':
      return 'CONCLUIDO';
    case 'Descartada':
      return 'ARQUIVADO';
    case 'BACKLOG':
    case 'EM_ANALISE':
    case 'SINTETIZANDO':
    case 'CONCLUIDO':
    case 'ARQUIVADO':
      return status as DeepDiveStatus;
    default:
      return 'BACKLOG';
  }
}

export function calculateChecklistProgress(checklist?: Record<string, boolean> | null): number {
  if (!checklist) return 0;
  const keys = Object.keys(checklist);
  if (keys.length === 0) return 0;
  const completed = keys.filter((k) => checklist[k] === true).length;
  return Math.round((completed / keys.length) * 100);
}

export function createOfferSnapshot(offer: Offer): DeepDiveSnapshot {
  return {
    active_ads_count: offer.active_ads_count ?? null,
    days_running: offer.days_running ?? null,
    price: offer.price ?? null,
    creatives_count: offer.estimated_unique_creatives ?? offer.captured_creatives_count ?? null,
    captured_at: new Date().toISOString(),
  };
}

export const DEFAULT_CHECKLIST = {
  understand_product: false,
  analyze_top_creatives: false,
  analyze_hero_section: false,
  analyze_lp_structure: false,
  analyze_pricing_front: false,
  analyze_checkout_flow: false,
  analyze_order_bumps: false,
  register_hypothesis: false,
  extract_insights: false,
  register_tests: false,
};
