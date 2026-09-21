// ==============================================================================
// OFFER MINER - CENTRAL SCALE TIER VISUAL HIERARCHY & ENERGIZED BORDER ENGINE
// ==============================================================================

export type ScaleTierType = 'FULL_SCALE' | 'HIGH_SCALE' | 'SCALING' | 'NORMAL';

export interface ScaleTierInfo {
  tier: ScaleTierType;
  label: string;
  badgeLabel: string;
  shortLabel: string;
  icon: string;
  tooltip: string;
  priority: number;
  borderClass: string;
  bgClass: string;
  badgeClass: string;
  textClass: string;
  glowClass: string;
  hoverGlowClass: string;
  cardHeaderClass: string;
  accentColor: string;
  // Animated Flame & Living Energy Border Properties
  flameAuraClass: string;
  conicGradientClass: string;
  spinSpeedClass: string;
  flickerClass: string;
  innerBgClass: string;
}

/**
 * Single central function to compute Scale Tier based on active_ads_count.
 * Purely visual classification of scale intensity with animated fire/energy borders.
 *
 * Thresholds:
 * - activeAds > 200  -> FULL_SCALE ("🔥🔥 FULL ESCALA" - Intense Red Fire Contour)
 * - activeAds > 100  -> HIGH_SCALE ("🔥 ESCALA ALTA" - Warm Red Fire Contour)
 * - activeAds > 30   -> SCALING    ("⚡ EM ESCALA" - Golden/Amber Fire Contour)
 * - activeAds <= 30 (or null) -> NORMAL (Sleek Emerald Energy Contour)
 */
export function getOfferScaleTier(activeAds: number | null | undefined): ScaleTierInfo {
  if (activeAds === null || activeAds === undefined || isNaN(activeAds)) {
    return {
      tier: 'NORMAL',
      label: 'Normal',
      badgeLabel: '',
      shortLabel: 'Sem dados de ads',
      icon: '',
      tooltip: 'Quantidade de anúncios ativos não observada.',
      priority: 1,
      borderClass: 'border-slate-800/80 hover:border-slate-700',
      bgClass: 'bg-slate-900',
      badgeClass: '',
      textClass: 'text-slate-400',
      glowClass: 'shadow-sm',
      hoverGlowClass: 'hover:shadow-md hover:shadow-slate-950/50',
      cardHeaderClass: 'bg-slate-950/60 border-slate-800/60',
      accentColor: '#94a3b8',
      flameAuraClass: 'opacity-15 group-hover:opacity-30 shadow-[0_0_6px_rgba(148,163,184,0.1)]',
      conicGradientClass: 'bg-fire-gradient-emerald',
      spinSpeedClass: 'animate-fire-spin-emerald',
      flickerClass: 'animate-fire-flicker-emerald',
      innerBgClass: 'bg-slate-950/95 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 border border-slate-800/80',
    };
  }

  // 1. FULL ESCALA (> 200 Ads) -> Refined Animated Red Fire Contour
  if (activeAds > 200) {
    return {
      tier: 'FULL_SCALE',
      label: 'Full Escala',
      badgeLabel: '🔥🔥 FULL ESCALA',
      shortLabel: 'Full Escala (>200 Ads)',
      icon: '🔥',
      tooltip: 'Mais de 200 anúncios ativos observados (Oferta em escala massiva).',
      priority: 4,
      borderClass: 'border-rose-500/50 hover:border-rose-400',
      bgClass: 'bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/25 via-slate-900 to-slate-950',
      badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.25)] font-extrabold tracking-wide text-[10px]',
      textClass: 'text-rose-400 font-extrabold',
      glowClass: 'shadow-[0_0_12px_-2px_rgba(244,63,94,0.25)] border-rose-500/50',
      hoverGlowClass: 'hover:shadow-[0_0_18px_-1px_rgba(244,63,94,0.35)] hover:border-rose-400',
      cardHeaderClass: 'bg-rose-950/30 border-rose-900/40 text-rose-300',
      accentColor: '#f43f5e',
      flameAuraClass: 'opacity-50 group-hover:opacity-75 shadow-[0_0_12px_rgba(244,63,94,0.25)]',
      conicGradientClass: 'bg-fire-gradient-full',
      spinSpeedClass: 'animate-fire-spin-fast',
      flickerClass: 'animate-fire-flicker-full',
      innerBgClass: 'bg-slate-950/95 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/25 via-slate-900 to-slate-950 border border-rose-500/25',
    };
  }

  // 2. ESCALA ALTA (> 100 & <= 200 Ads) -> Warm Refined Red Fire Contour
  if (activeAds > 100) {
    return {
      tier: 'HIGH_SCALE',
      label: 'Escala Alta',
      badgeLabel: '🔥 ESCALA ALTA',
      shortLabel: 'Escala Alta (100–200 Ads)',
      icon: '🔥',
      tooltip: 'Mais de 100 anúncios ativos observados.',
      priority: 3,
      borderClass: 'border-rose-500/30 hover:border-rose-400/60',
      bgClass: 'bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/15 via-slate-900 to-slate-950',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-semibold text-[10px]',
      textClass: 'text-rose-400 font-bold',
      glowClass: 'shadow-[0_0_10px_-2px_rgba(244,63,94,0.15)] border-rose-500/30',
      hoverGlowClass: 'hover:shadow-[0_0_15px_-1px_rgba(244,63,94,0.25)] hover:border-rose-400/60',
      cardHeaderClass: 'bg-rose-950/20 border-rose-900/30 text-rose-300',
      accentColor: '#fb7185',
      flameAuraClass: 'opacity-40 group-hover:opacity-60 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
      conicGradientClass: 'bg-fire-gradient-high',
      spinSpeedClass: 'animate-fire-spin-med',
      flickerClass: 'animate-fire-flicker-high',
      innerBgClass: 'bg-slate-950/95 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/15 via-slate-900 to-slate-950 border border-rose-500/18',
    };
  }

  // 3. EM ESCALA (> 30 & <= 100 Ads) -> Shimmering Amber Fire Contour
  if (activeAds > 30) {
    return {
      tier: 'SCALING',
      label: 'Em Escala',
      badgeLabel: '⚡ EM ESCALA',
      shortLabel: 'Em Escala (30–100 Ads)',
      icon: '⚡',
      tooltip: 'Mais de 30 anúncios ativos observados.',
      priority: 2,
      borderClass: 'border-amber-500/30 hover:border-amber-400/60',
      bgClass: 'bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/15 via-slate-900 to-slate-950',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold text-[10px]',
      textClass: 'text-amber-400 font-bold',
      glowClass: 'shadow-[0_0_10px_-2px_rgba(245,158,11,0.15)] border-amber-500/30',
      hoverGlowClass: 'hover:shadow-[0_0_15px_-1px_rgba(245,158,11,0.25)] hover:border-amber-400/60',
      cardHeaderClass: 'bg-amber-950/20 border-amber-900/30 text-amber-300',
      accentColor: '#f59e0b',
      flameAuraClass: 'opacity-35 group-hover:opacity-55 shadow-[0_0_8px_rgba(245,158,11,0.18)]',
      conicGradientClass: 'bg-fire-gradient-gold',
      spinSpeedClass: 'animate-fire-spin-gold',
      flickerClass: 'animate-fire-flicker-gold',
      innerBgClass: 'bg-slate-950/95 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/15 via-slate-900 to-slate-950 border border-amber-500/18',
    };
  }

  // 4. NORMAL (<= 30 Ads) -> Sleek Emerald Energy Contour
  return {
    tier: 'NORMAL',
    label: 'Normal',
    badgeLabel: '',
    shortLabel: 'Normal (<= 30 Ads)',
    icon: '',
    tooltip: 'Até 30 anúncios ativos observados.',
    priority: 1,
    borderClass: 'border-emerald-500/20 hover:border-emerald-500/40',
    bgClass: 'bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/10 via-slate-900 to-slate-950',
    badgeClass: '',
    textClass: 'text-slate-300',
    glowClass: 'shadow-[0_0_8px_-2px_rgba(16,185,129,0.1)] border-emerald-500/20',
    hoverGlowClass: 'hover:shadow-[0_0_12px_-1px_rgba(16,185,129,0.2)] hover:border-emerald-500/40',
    cardHeaderClass: 'bg-emerald-950/15 border-emerald-900/25',
    accentColor: '#10b981',
    flameAuraClass: 'opacity-25 group-hover:opacity-45 shadow-[0_0_6px_rgba(16,185,129,0.12)]',
    conicGradientClass: 'bg-fire-gradient-emerald',
    spinSpeedClass: 'animate-fire-spin-emerald',
    flickerClass: 'animate-fire-flicker-emerald',
    innerBgClass: 'bg-slate-950/95 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/10 via-slate-900 to-slate-950 border border-slate-800/80',
  };
}

