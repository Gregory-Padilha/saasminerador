// ==============================================================================
// OFFER MINER - CENTRALIZED VALIDATION ENGINE (RULE 27)
// ==============================================================================

import { Offer, UserSettings, ValidationDetail, OfferStatus } from '@/types';

export const DEFAULT_VALIDATION_SETTINGS: UserSettings = {
  min_price: 10.0,
  max_price: 50.0,
  min_ads: 5,
  max_ads: 50,
  min_days: 10,
  max_days: 30,
  require_faceless: true,
};

/**
 * Validates an offer against STRUCTURAL ADEQUACY ONLY.
 *
 * The Offer Miner ingestion engine MUST BE SOURCE-AGNOSTIC.
 * Mining strategy criteria (max ads, min/max price, min/max days, faceless)
 * MUST NOT block offers from entering the database.
 *
 * Rules:
 * 1. Structural Identification: Requires at least ONE basic identifier (product_name, advertiser, landing_page_url, meta_ads_url).
 * 2. Physical Sanity: Values cannot be physically invalid (e.g., negative price or negative ads).
 * 3. Missing optional fields generate warnings and status 'REVISAR' (partial data), but remain IMPORTABLE (isValid = true).
 * 4. Only severe structural errors (no identifiers, unparseable corruption) set isValid = false & status 'INVALIDA'.
 */
export function validateOffer(
  offer: Partial<Offer>,
  _settings: UserSettings = DEFAULT_VALIDATION_SETTINGS
): ValidationDetail {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const hasProductName = Boolean(offer.product_name && offer.product_name.trim().length > 0);
  const hasAdvertiser = Boolean(offer.advertiser && offer.advertiser.trim().length > 0);
  const hasLpUrl = Boolean(offer.landing_page_url && offer.landing_page_url.trim().length > 0);
  const hasMetaUrl = Boolean(offer.meta_ads_url && offer.meta_ads_url.trim().length > 0);

  // 1. Minimum Structural Identification
  if (!hasProductName && !hasAdvertiser && !hasLpUrl && !hasMetaUrl) {
    reasons.push('Nenhum identificador válido encontrado (Nome do Produto, Anunciante, LP URL ou Meta Ads URL ausentes)');
  }

  // 2. Physical Sanity Checks (Technical Constraints)
  if (offer.price !== null && offer.price !== undefined && !isNaN(offer.price) && offer.price < 0) {
    reasons.push(`Preço inválido (R$ ${offer.price}): valor não pode ser negativo`);
  }

  if (offer.active_ads_count !== null && offer.active_ads_count !== undefined && !isNaN(offer.active_ads_count) && offer.active_ads_count < 0) {
    reasons.push(`Anúncios ativos inválidos (${offer.active_ads_count}): valor não pode ser negativo`);
  }

  if (offer.days_running !== null && offer.days_running !== undefined && !isNaN(offer.days_running) && offer.days_running < 0) {
    reasons.push(`Dias rodando inválidos (${offer.days_running}): valor não pode ser negativo`);
  }

  // 3. Optional Fields Presence (Warnings only, NEVER blocks import)
  if (!hasProductName) warnings.push('Nome do produto ausente');
  if (offer.price === null || offer.price === undefined || isNaN(offer.price)) warnings.push('Preço não informado');
  if (offer.active_ads_count === null || offer.active_ads_count === undefined || isNaN(offer.active_ads_count)) warnings.push('Quantidade de anúncios ativos não informada');
  if (!hasLpUrl) warnings.push('URL da Página de Vendas (LP) não informada');
  if (!hasAdvertiser) warnings.push('Anunciante não informado');
  if (!offer.niche) warnings.push('Nicho não informado');
  if (offer.faceless === null || offer.faceless === undefined) warnings.push('Critério Faceless não informado');

  // Status calculation:
  // - If structural reasons exist -> INVALIDA (isValid = false)
  // - Else if warnings exist -> REVISAR (isValid = true)
  // - Else -> VALIDADA (isValid = true)
  let status: OfferStatus = 'VALIDADA';
  let isValid = true;

  if (reasons.length > 0) {
    status = 'INVALIDA';
    isValid = false;
  } else if (warnings.length > 0) {
    status = 'REVISAR';
    isValid = true; // PARTIAL DATA IS STILL IMPORTABLE!
  }

  return {
    isValid,
    status,
    reasons,
    warnings,
  };
}
