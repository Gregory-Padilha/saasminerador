// ==============================================================================
// OFFER MINER - ROBUST INTELLIGENCE SCORING ENGINE (DISCOVERY & REAL MOMENTUM)
// ==============================================================================

import {
  Offer,
  OfferSnapshot,
  OfferTrend,
  ActivityStatus,
  DiscoveryScoreBreakdown,
  MomentumCalculationResult,
} from '@/types';

/**
 * Calculates the Discovery Score (0-100) based strictly on the 5 observable criteria on initial capture:
 * 1. Volume de Anúncios Ativos: 35 pts
 * 2. Tempo Rodando: 25 pts
 * 3. Quantidade de Criativos Diferentes: 15 pts
 * 4. Completude dos Dados: 10 pts
 * 5. Nota do Minerador / Work: 15 pts
 */
export function calculateDiscoveryScore(offer: Partial<Offer>): DiscoveryScoreBreakdown {
  const ads = offer.active_ads_count ?? null;
  const days = offer.days_running ?? null;
  const creatives = offer.estimated_unique_creatives ?? null;
  const rawWork = offer.work_score ?? offer.score ?? null;

  // --------------------------------------------------------------------------
  // 1. VOLUME DE ANÚNCIOS ATIVOS (35 PONTOS)
  // --------------------------------------------------------------------------
  let adsScore = 0;
  let adsExpl = 'Sem dados de anúncios';
  if (ads !== null && !isNaN(ads)) {
    if (ads >= 31 && ads <= 40) {
      adsScore = 35;
      adsExpl = `${ads} ads ativos (Faixa de escala máxima)`;
    } else if ((ads >= 21 && ads <= 30) || (ads >= 41 && ads <= 50)) {
      adsScore = 32;
      adsExpl = `${ads} ads ativos (Excelente volume)`;
    } else if (ads >= 13 && ads <= 20) {
      adsScore = 26;
      adsExpl = `${ads} ads ativos (Boa tração)`;
    } else if (ads >= 8 && ads <= 12) {
      adsScore = 18;
      adsExpl = `${ads} ads ativos (Volume moderado)`;
    } else if (ads >= 5 && ads <= 7) {
      adsScore = 10;
      adsExpl = `${ads} ads ativos (Volume inicial mínimo)`;
    } else if (ads > 50) {
      adsScore = 0;
      adsExpl = `${ads} ads ativos (Acima do teto low-ticket de 50 ads)`;
    } else {
      adsScore = 0;
      adsExpl = `${ads} ads ativos (Abaixo do mínimo de 5 ads)`;
    }
  }

  // --------------------------------------------------------------------------
  // 2. TEMPO RODANDO (25 PONTOS)
  // --------------------------------------------------------------------------
  let daysScore = 0;
  let daysExpl = 'Sem dados de tempo rodando';
  if (days !== null && !isNaN(days)) {
    if (days >= 18 && days <= 24) {
      daysScore = 25;
      daysExpl = `${days} dias rodando (Faixa ideal de longevidade)`;
    } else if (days >= 25 && days <= 30) {
      daysScore = 22;
      daysExpl = `${days} dias rodando (Maturidade alta)`;
    } else if (days >= 13 && days <= 17) {
      daysScore = 18;
      daysExpl = `${days} dias rodando (Boa consistência)`;
    } else if (days >= 10 && days <= 12) {
      daysScore = 12;
      daysExpl = `${days} dias rodando (Início de validação)`;
    } else if (days > 30) {
      daysScore = 0;
      daysExpl = `${days} dias rodando (Fora da janela low-ticket 10-30d)`;
    } else {
      daysScore = 0;
      daysExpl = `${days} dias rodando (Menos de 10 dias de teste)`;
    }
  }

  // --------------------------------------------------------------------------
  // 3. CRIATIVOS DIFERENTES ESTIMADOS (15 PONTOS)
  // --------------------------------------------------------------------------
  let creativesScore = 0;
  let creativesExpl = 'Criativos distintos não informados';
  if (creatives !== null && !isNaN(creatives)) {
    if (creatives >= 11) {
      creativesScore = 15;
      creativesExpl = `${creatives} criativos distintos (Amplo teste de ângulos)`;
    } else if (creatives >= 7 && creatives <= 10) {
      creativesScore = 11;
      creativesExpl = `${creatives} criativos distintos (Boa variação)`;
    } else if (creatives >= 4 && creatives <= 6) {
      creativesScore = 7;
      creativesExpl = `${creatives} criativos distintos (Variação moderada)`;
    } else if (creatives >= 1 && creatives <= 3) {
      creativesScore = 3;
      creativesExpl = `${creatives} criativos distintos (Variação inicial)`;
    }
  }

  // --------------------------------------------------------------------------
  // 4. COMPLETUDE DOS DADOS (10 PONTOS) - 15 CAMPOS AVALIADOS
  // --------------------------------------------------------------------------
  const fieldsToCheck: (keyof Offer)[] = [
    'product_name',
    'advertiser',
    'niche',
    'subniche',
    'product_type',
    'price',
    'active_ads_count',
    'oldest_ad_date',
    'days_running',
    'faceless',
    'meta_ads_url',
    'landing_page_url',
    'headline',
    'ad_format',
    'estimated_unique_creatives',
  ];

  let filledCount = 0;
  for (const field of fieldsToCheck) {
    const val = offer[field];
    if (val !== null && val !== undefined && val !== '') {
      filledCount++;
    }
  }

  const completenessPercentage = Math.round((filledCount / fieldsToCheck.length) * 100);
  const completenessScore = Math.round((filledCount / fieldsToCheck.length) * 10 * 10) / 10;
  const completenessExpl = `${filledCount} de 15 campos preenchidos (${completenessPercentage}%)`;

  // --------------------------------------------------------------------------
  // 5. NOTA DO WORK / MINERADOR (15 PONTOS) - ESCALA 0 A 10 -> 0 A 15
  // --------------------------------------------------------------------------
  let workScorePoints = 0;
  let workExpl = 'Nota Work ausente';
  let cleanWorkScore: number | null = null;
  if (rawWork !== null && rawWork !== undefined && !isNaN(rawWork)) {
    cleanWorkScore = Math.min(10, Math.max(0, rawWork));
    workScorePoints = Math.round(cleanWorkScore * 1.5 * 10) / 10;
    workExpl = `Nota Work ${cleanWorkScore.toFixed(1)}/10 (${workScorePoints}/15 pts)`;
  }

  const total = Math.min(
    100,
    Math.max(0, Math.round(adsScore + daysScore + creativesScore + completenessScore + workScorePoints))
  );

  let priorityLabel: DiscoveryScoreBreakdown['priorityLabel'] = 'BAIXA_PRIORIDADE';
  if (total >= 90) priorityLabel = 'EXCEPCIONAL';
  else if (total >= 80) priorityLabel = 'FORTE';
  else if (total >= 70) priorityLabel = 'INTERESSANTE';
  else if (total >= 60) priorityLabel = 'OBSERVAR';

  return {
    total,
    adsScore,
    daysScore,
    creativesScore,
    completenessScore,
    completenessPercentage,
    completedFieldsCount: filledCount,
    totalFieldsCount: fieldsToCheck.length,
    workScore: workScorePoints,
    rawWorkScore: cleanWorkScore,
    priorityLabel,
    explanation: {
      ads: adsExpl,
      days: daysExpl,
      creatives: creativesExpl,
      completeness: completenessExpl,
      work: workExpl,
    },
  };
}

export { validateOffer, DEFAULT_VALIDATION_SETTINGS } from './validation';

/**
 * Calculates Momentum Score (0-100) and Trend.
 * MANDATORY: ONLY calculates when there are at least 2 snapshots.
 * If < 2 snapshots: returns momentumScore: null, trend: 'SEM_HISTORICO'.
 */
export function calculateMomentumScore(
  adsOrSnapshots: number | null | undefined | OfferSnapshot[],
  snapshotsArg?: OfferSnapshot[]
): MomentumCalculationResult {
  let snapshots: OfferSnapshot[] | undefined;
  let current: number | null = null;

  if (Array.isArray(adsOrSnapshots)) {
    snapshots = adsOrSnapshots;
    current = snapshots.length > 0 ? (snapshots[snapshots.length - 1].active_ads_count ?? null) : null;
  } else {
    current = adsOrSnapshots ?? null;
    snapshots = snapshotsArg;
  }

  // Strict check: if no snapshots or less than 2 captures, no momentum can exist
  if (!snapshots || snapshots.length < 2) {
    return {
      momentumScore: null,
      trend: 'SEM_HISTORICO',
      statusText: 'Aguardando nova captura',
      growthPct: null,
      deltaAds: null,
      currentAds: current,
      previousAds: null,
      snapshotCount: snapshots?.length || (current !== null ? 1 : 0),
    };
  }

  // Sort snapshots chronologically
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
  );

  const prevSnap = sorted[sorted.length - 2];
  const lastSnap = sorted[sorted.length - 1];

  const prevAds = prevSnap.active_ads_count ?? null;
  const currAds = current !== null ? current : (lastSnap.active_ads_count ?? null);

  if (prevAds === null || currAds === null) {
    return {
      momentumScore: null,
      trend: 'SEM_HISTORICO',
      statusText: 'Dados incompletos nos snapshots',
      growthPct: null,
      deltaAds: null,
      currentAds: currAds,
      previousAds: prevAds,
      snapshotCount: sorted.length,
    };
  }

  const deltaAds = currAds - prevAds;
  let growthPct: number | null = null;
  if (prevAds > 0) {
    growthPct = Math.round((deltaAds / prevAds) * 100);
  }

  // Classify Trend
  let trend: OfferTrend = 'ESTAVEL';
  if (growthPct !== null) {
    if (growthPct >= 50) trend = 'CRESCENDO_FORTE';
    else if (growthPct >= 15) trend = 'CRESCENDO';
    else if (growthPct <= -15) trend = 'CAINDO';
    else trend = 'ESTAVEL';
  } else {
    if (deltaAds > 2) trend = 'CRESCENDO_FORTE';
    else if (deltaAds > 0) trend = 'CRESCENDO';
    else if (deltaAds < 0) trend = 'CAINDO';
    else trend = 'ESTAVEL';
  }

  // Numerical Momentum Score (0-100)
  let momentumScore = 50;
  if (growthPct !== null) {
    if (growthPct >= 100) momentumScore = 100;
    else if (growthPct >= 50) momentumScore = 85;
    else if (growthPct >= 25) momentumScore = 70;
    else if (growthPct >= 10) momentumScore = 60;
    else if (growthPct >= -9 && growthPct <= 9) momentumScore = 50;
    else if (growthPct >= -24 && growthPct <= -10) momentumScore = 35;
    else momentumScore = 15;
  } else {
    if (deltaAds >= 10) momentumScore = 85;
    else if (deltaAds >= 4) momentumScore = 70;
    else if (deltaAds >= 1) momentumScore = 60;
    else if (deltaAds === 0) momentumScore = 50;
    else momentumScore = 35;
  }

  const statusText =
    trend === 'CRESCENDO_FORTE'
      ? 'Crescendo Forte'
      : trend === 'CRESCENDO'
      ? 'Crescendo'
      : trend === 'ESTAVEL'
      ? 'Estável'
      : 'Caindo';

  return {
    momentumScore,
    trend,
    statusText,
    growthPct,
    deltaAds,
    currentAds: currAds,
    previousAds: prevAds,
    snapshotCount: sorted.length,
  };
}

/**
 * Calculates Opportunity Score (0-100) combining Discovery Score (70%) and Momentum Score (30%).
 * MANDATORY: ONLY exists when Momentum Score exists. Otherwise returns null.
 */
export function calculateOpportunityScore(
  discoveryScore: number | null | undefined,
  momentumScore: number | null | undefined
): number | null {
  if (
    discoveryScore === null ||
    discoveryScore === undefined ||
    isNaN(discoveryScore) ||
    momentumScore === null ||
    momentumScore === undefined ||
    isNaN(momentumScore)
  ) {
    return null;
  }

  const finalScore = Math.round(discoveryScore * 0.70 + momentumScore * 0.30);
  return Math.min(100, Math.max(0, finalScore));
}

/**
 * Backward compatibility helper for legacy call sites
 */
export function calculateMomentumAndTrend(
  currentAds: number | null | undefined,
  snapshots?: OfferSnapshot[]
) {
  const res = calculateMomentumScore(currentAds, snapshots);
  return {
    momentumScore: res.momentumScore ?? 50,
    trend: res.trend,
    adsGrowthPct: res.growthPct,
    adsGrowthCount: res.deltaAds,
    statusText: res.statusText,
  };
}

/**
 * Derives activity status based on last seen date
 */
export function deriveActivityStatus(lastSeenAt?: string | null): ActivityStatus {
  if (!lastSeenAt) return 'Ativa';
  try {
    const last = new Date(lastSeenAt).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

    if (diffDays > 45) return 'Possivelmente encerrada';
    if (diffDays > 20) return 'Não vista recentemente';
    return 'Ativa';
  } catch {
    return 'Ativa';
  }
}
