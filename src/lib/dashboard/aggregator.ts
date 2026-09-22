// ==============================================================================
// OFFER MINER - DASHBOARD INTELLIGENCE AGGREGATOR
// ==============================================================================

import { Offer, OfferAdMedia, OfferCreative } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { calculateMedian } from '@/lib/utils';
import {
  normalizeNicheName,
  normalizeProductType,
  normalizeCreativeFormat,
} from './normalizers';

export type PeriodFilter = '7d' | '30d' | 'all';

export interface DashboardSummary {
  period: PeriodFilter;
  lastUpdated: string;

  // Diagnostic status to prevent masking errors as zero
  dataStatus: {
    status: 'ONLINE' | 'LOCAL_FALLBACK' | 'EMPTY' | 'ERROR' | 'UNCONFIGURED';
    errorMessage?: string;
    details?: string;
  };

  // A. Main KPIs
  kpis: {
    totalBase: number;
    activeOffers: number;
    archivedOffers: number;
    newOffersPeriod: number;
    totalActiveAdsMapped: number;
    capturedCreativesCount: number;
    lpsMappedCount: number;
    lpsAvailableCount: number;
    lpsMappedPercentage: number;
    watchingCount: number;
  };

  // B. User Research (Minha Pesquisa)
  userResearch: {
    favoritesCount: number;
    watchingCount: number;
    deepDivesCount: number;
  };

  // C. Recent Changes (O Que Mudou)
  recentChanges: Array<{
    id: string;
    offerId: string;
    productName: string;
    niche: string;
    changeType: 'ads_increase' | 'ads_decrease' | 'price_change' | 'lp_change' | 'new_creatives' | 'lp_unavailable';
    oldValue: string;
    newValue: string;
    changedAt: string;
  }>;

  // D. Featured Offers
  featuredOffers: {
    topAds: Offer[];
    longestRunning: Offer[];
    newWithVolume: Offer[];
    mostCreatives: Offer[];
    recentlyUpdated: Offer[];
  };

  // E. Market Intelligence
  marketIntelligence: {
    topNiches: Array<{
      niche: string;
      count: number;
      avgPrice: number | null;
      medianAds: number;
    }>;
    priceDistribution: {
      ranges: Array<{ label: string; count: number; percentage: number }>;
      avgPrice: number | null;
      medianPrice: number | null;
    };
    adsDistribution: Array<{ range: string; count: number; percentage: number }>;
    productTypes: Array<{ type: string; count: number }>;
    creativeFormats: Array<{ format: string; count: number }>;
  };

  // F. Base Health & Issues (Base & Pendências)
  baseIssues: Array<{
    id: string;
    label: string;
    count: number;
    filterKey: string;
    filterValue: string;
    severity: 'warning' | 'error' | 'info';
  }>;

  // G. Recent Activity
  recentActivity: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
    type: 'import' | 'capture' | 'lp_map' | 'favorite' | 'archive' | 'update';
    offerId?: string;
    offerName?: string;
  }>;
}

export async function getDashboardSummary(period: PeriodFilter = '7d'): Promise<DashboardSummary> {
  const offers: Offer[] = await dbService.getOffers();

  const nowMs = Date.now();
  let periodStartMs = 0;
  if (period === '7d') {
    periodStartMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  } else if (period === '30d') {
    periodStartMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  }

  // Active vs Archived
  const activeOffers = offers.filter((o) => o.status !== 'ARQUIVADA' && o.archived !== true);
  const archivedOffers = offers.filter((o) => o.status === 'ARQUIVADA' || o.archived === true);

  // New offers in period
  const newOffersPeriod = offers.filter((o) => {
    if (period === 'all') return true;
    const dateStr = o.first_imported_at || o.created_at;
    if (!dateStr) return false;
    return new Date(dateStr).getTime() >= periodStartMs;
  }).length;

  // Total active ads mapped sum
  const totalActiveAdsMapped = activeOffers.reduce(
    (sum, o) => sum + (o.active_ads_count && !isNaN(o.active_ads_count) ? o.active_ads_count : 0),
    0
  );

  // Creatives captured count
  const capturedCreativesCount = offers.reduce(
    (sum, o) => sum + (o.creatives?.length || o.unique_creatives_count || 0),
    0
  );

  // Landing pages mapped
  const lpsAvailableList = offers.filter((o) => Boolean(o.landing_page_url || o.landing_page_url_original));
  const lpsMappedList = offers.filter(
    (o) =>
      Boolean((o as any).extra_data?.latest_lp_analysis) ||
      o.landing_page_url_status === 'AVAILABLE' ||
      o.landing_page_url_status === 'REDIRECTED' ||
      o.landing_page_url_status === 'RECOVERED_FROM_ADS'
  );
  const lpsMappedPercentage =
    lpsAvailableList.length > 0
      ? Math.round((lpsMappedList.length / lpsAvailableList.length) * 100)
      : 0;

  // User research metrics
  const favoritesCount = offers.filter((o) => o.favorite).length;
  const watchingCount = offers.filter((o) => o.watching).length;
  const deepDivesCount = offers.filter((o) => o.in_deep_dive).length;

  // --- RECENT CHANGES (O que mudou) ---
  const recentChanges: DashboardSummary['recentChanges'] = [];
  offers.forEach((o) => {
    const snaps = (o.snapshots || []).sort(
      (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    );
    if (snaps.length >= 2) {
      const prev = snaps[snaps.length - 2];
      const curr = snaps[snaps.length - 1];

      const prevAds = prev.active_ads_count ?? 0;
      const currAds = curr.active_ads_count ?? o.active_ads_count ?? 0;
      const deltaAds = currAds - prevAds;

      if (deltaAds !== 0) {
        recentChanges.push({
          id: `chg_ads_${o.id}_${curr.captured_at}`,
          offerId: o.id,
          productName: o.product_name,
          niche: normalizeNicheName(o.niche),
          changeType: deltaAds > 0 ? 'ads_increase' : 'ads_decrease',
          oldValue: `${prevAds} ads`,
          newValue: `${currAds} ads`,
          changedAt: curr.captured_at,
        });
      }

      if (
        prev.price !== null &&
        prev.price !== undefined &&
        curr.price !== null &&
        curr.price !== undefined &&
        prev.price !== curr.price
      ) {
        recentChanges.push({
          id: `chg_price_${o.id}_${curr.captured_at}`,
          offerId: o.id,
          productName: o.product_name,
          niche: normalizeNicheName(o.niche),
          changeType: 'price_change',
          oldValue: `R$ ${prev.price.toFixed(2)}`,
          newValue: `R$ ${curr.price.toFixed(2)}`,
          changedAt: curr.captured_at,
        });
      }
    }

    if (
      o.landing_page_url_status === 'DNS_NOT_RESOLVED' ||
      o.landing_page_url_status === 'UNAVAILABLE' ||
      o.landing_page_url_status === 'HTTP_404'
    ) {
      recentChanges.push({
        id: `chg_lp_err_${o.id}`,
        offerId: o.id,
        productName: o.product_name,
        niche: normalizeNicheName(o.niche),
        changeType: 'lp_unavailable',
        oldValue: 'LP Ativa',
        newValue: `Indisponível (${o.landing_page_url_status})`,
        changedAt: o.landing_page_url_last_checked_at || o.updated_at,
      });
    }
  });

  const sortedChanges = recentChanges
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
    .slice(0, 8);

  // --- FEATURED OFFERS (Ofertas em evidencia) ---
  const topAds = [...activeOffers]
    .sort((a, b) => (b.active_ads_count ?? 0) - (a.active_ads_count ?? 0))
    .slice(0, 6);

  const longestRunning = [...activeOffers]
    .sort((a, b) => (b.days_running ?? 0) - (a.days_running ?? 0))
    .slice(0, 6);

  const newWithVolume = [...activeOffers]
    .filter((o) => {
      if (period === 'all') return true;
      const dateStr = o.first_imported_at || o.created_at;
      return dateStr ? new Date(dateStr).getTime() >= periodStartMs : true;
    })
    .sort((a, b) => (b.active_ads_count ?? 0) - (a.active_ads_count ?? 0))
    .slice(0, 6);

  const mostCreatives = [...activeOffers]
    .sort(
      (a, b) =>
        (b.captured_creatives_count || b.estimated_unique_creatives || 0) -
        (a.captured_creatives_count || a.estimated_unique_creatives || 0)
    )
    .slice(0, 6);

  const recentlyUpdated = [...activeOffers]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  // --- MARKET INTELLIGENCE ---
  // Top Niches
  const nicheMap: Record<string, { count: number; prices: number[]; ads: number[] }> = {};
  activeOffers.forEach((o) => {
    const niche = normalizeNicheName(o.niche);
    if (!nicheMap[niche]) nicheMap[niche] = { count: 0, prices: [], ads: [] };
    nicheMap[niche].count++;
    const effectivePrice = o.front_price_avg ?? o.price;
    if (effectivePrice !== null && effectivePrice !== undefined && !isNaN(effectivePrice)) {
      nicheMap[niche].prices.push(effectivePrice);
    }
    if (o.active_ads_count !== null && o.active_ads_count !== undefined && !isNaN(o.active_ads_count)) {
      nicheMap[niche].ads.push(o.active_ads_count);
    }
  });

  const topNiches = Object.entries(nicheMap)
    .map(([niche, data]) => {
      const avgPrice =
        data.prices.length > 0
          ? Math.round((data.prices.reduce((a, b) => a + b, 0) / data.prices.length) * 100) / 100
          : null;
      const medianAds = calculateMedian(data.ads) || 0;
      return { niche, count: data.count, avgPrice, medianAds: Math.round(medianAds) };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Price Distribution (Uses representative front_price_avg per offer)
  const validPrices = activeOffers
    .map((o) => o.front_price_avg ?? o.price)
    .filter((p): p is number => p !== null && p !== undefined && !isNaN(p));

  const overallAvgPrice =
    validPrices.length > 0
      ? Math.round((validPrices.reduce((a, b) => a + b, 0) / validPrices.length) * 100) / 100
      : null;
  const overallMedianPrice = calculateMedian(validPrices);

  const priceRanges = [
    { label: 'Até R$ 9,99', min: 0, max: 9.99, count: 0 },
    { label: 'R$ 10 – 19,99', min: 10, max: 19.99, count: 0 },
    { label: 'R$ 20 – 29,99', min: 20, max: 29.99, count: 0 },
    { label: 'R$ 30 – 39,99', min: 30, max: 39.99, count: 0 },
    { label: 'R$ 40 – 50,00', min: 40, max: 50.0, count: 0 },
    { label: 'Acima de R$ 50', min: 50.01, max: Infinity, count: 0 },
  ];

  validPrices.forEach((p) => {
    const range = priceRanges.find((r) => p >= r.min && p <= r.max);
    if (range) range.count++;
  });

  const totalPricesCount = validPrices.length || 1;
  const priceDistributionFormatted = priceRanges.map((r) => ({
    label: r.label,
    count: r.count,
    percentage: Math.round((r.count / totalPricesCount) * 100),
  }));

  // Ads Volume Distribution
  const validAds = activeOffers
    .map((o) => o.active_ads_count)
    .filter((a): a is number => a !== null && a !== undefined && !isNaN(a));

  const adsRanges = [
    { range: '1 – 4 ads', min: 1, max: 4, count: 0 },
    { range: '5 – 9 ads', min: 5, max: 9, count: 0 },
    { range: '10 – 19 ads', min: 10, max: 19, count: 0 },
    { range: '20 – 29 ads', min: 20, max: 29, count: 0 },
    { range: '30 – 39 ads', min: 30, max: 39, count: 0 },
    { range: '40 – 49 ads', min: 40, max: 49, count: 0 },
    { range: '50+ ads', min: 50, max: Infinity, count: 0 },
  ];

  validAds.forEach((a) => {
    const range = adsRanges.find((r) => a >= r.min && a <= r.max);
    if (range) range.count++;
  });

  const totalAdsCount = validAds.length || 1;
  const adsDistributionFormatted = adsRanges.map((r) => ({
    range: r.range,
    count: r.count,
    percentage: Math.round((r.count / totalAdsCount) * 100),
  }));

  // Product Types
  const typeMap: Record<string, number> = {};
  activeOffers.forEach((o) => {
    const norm = normalizeProductType(o.product_type);
    typeMap[norm] = (typeMap[norm] || 0) + 1;
  });
  const productTypes = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Creative Formats
  const fmtMap: Record<string, number> = {};
  activeOffers.forEach((o) => {
    const norm = normalizeCreativeFormat(o.ad_format);
    fmtMap[norm] = (fmtMap[norm] || 0) + 1;
  });
  const creativeFormats = Object.entries(fmtMap)
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // --- BASE HEALTH & ISSUES (Base & Pendências) ---
  const unmappedLpsCount = activeOffers.filter(
    (o) =>
      Boolean(o.landing_page_url || o.landing_page_url_original) &&
      !Boolean((o as any).extra_data?.latest_lp_analysis)
  ).length;

  const partialDataCount = activeOffers.filter((o) => o.status === 'DADOS_PARCIAIS').length;

  const unavailableLpsCount = activeOffers.filter((o) =>
    ['DNS_NOT_RESOLVED', 'UNAVAILABLE', 'HTTP_404', 'HTTP_5XX', 'CONNECTION_REFUSED'].includes(
      o.landing_page_url_status || ''
    )
  ).length;

  const missingPriceCount = activeOffers.filter((o) => o.price === null || o.price === undefined).length;

  const missingMetaUrlCount = activeOffers.filter((o) => !o.meta_ads_url).length;

  const baseIssues: DashboardSummary['baseIssues'] = [
    {
      id: 'issue_unmapped_lp',
      label: 'Landing Pages não mapeadas',
      count: unmappedLpsCount,
      filterKey: 'unmapped_lp',
      filterValue: 'true',
      severity: 'warning',
    },
    {
      id: 'issue_partial_data',
      label: 'Ofertas com dados parciais',
      count: partialDataCount,
      filterKey: 'status',
      filterValue: 'DADOS_PARCIAIS',
      severity: 'warning',
    },
    {
      id: 'issue_unavailable_lp',
      label: 'URLs de Landing Page indisponíveis',
      count: unavailableLpsCount,
      filterKey: 'lp_unavailable',
      filterValue: 'true',
      severity: 'error',
    },
    {
      id: 'issue_missing_price',
      label: 'Ofertas sem preço cadastrado',
      count: missingPriceCount,
      filterKey: 'missing_price',
      filterValue: 'true',
      severity: 'info',
    },
    {
      id: 'issue_missing_meta',
      label: 'Ofertas sem Meta Ads Library URL',
      count: missingMetaUrlCount,
      filterKey: 'missing_meta_url',
      filterValue: 'true',
      severity: 'info',
    },
  ];

  // --- RECENT ACTIVITY TIMELINE ---
  const recentActivity: DashboardSummary['recentActivity'] = [];
  const sortedByImport = [...offers].sort(
    (a, b) =>
      new Date(b.first_imported_at || b.created_at).getTime() -
      new Date(a.first_imported_at || a.created_at).getTime()
  );

  sortedByImport.slice(0, 10).forEach((o) => {
    recentActivity.push({
      id: `act_${o.id}_${o.first_imported_at || o.created_at}`,
      title: 'Oferta catalogada na base',
      description: `"${o.product_name}" (${normalizeNicheName(o.niche)}) adicionada com ${o.active_ads_count ?? 0} ads.`,
      timestamp: o.first_imported_at || o.created_at,
      type: 'import',
      offerId: o.id,
      offerName: o.product_name,
    });
  });

  let dataStatus: DashboardSummary['dataStatus'];
  const dbError = (dbService as any).getLastError ? (dbService as any).getLastError() : null;

  if (dbError) {
    dataStatus = {
      status: 'ERROR',
      errorMessage: dbError.message || 'Erro ao consultar o banco de dados Supabase.',
      details: dbError.code,
    };
  } else if (!isSupabaseConfigured()) {
    if (offers.length > 0) {
      dataStatus = {
        status: 'LOCAL_FALLBACK',
        details: 'Executando em Modo Local. Supabase não configurado neste ambiente.',
      };
    } else {
      dataStatus = {
        status: 'UNCONFIGURED',
        errorMessage: 'Supabase não configurado no ambiente de produção e armazenamento local vazio.',
      };
    }
  } else if (offers.length === 0) {
    dataStatus = {
      status: 'EMPTY',
      details: 'Conectado ao Supabase, mas nenhuma oferta foi encontrada na tabela.',
    };
  } else {
    dataStatus = {
      status: 'ONLINE',
    };
  }

  return {
    period,
    lastUpdated: new Date().toISOString(),
    dataStatus,
    kpis: {
      totalBase: offers.length,
      activeOffers: activeOffers.length,
      archivedOffers: archivedOffers.length,
      newOffersPeriod,
      totalActiveAdsMapped,
      capturedCreativesCount,
      lpsMappedCount: lpsMappedList.length,
      lpsAvailableCount: lpsAvailableList.length,
      lpsMappedPercentage,
      watchingCount,
    },
    userResearch: {
      favoritesCount,
      watchingCount,
      deepDivesCount,
    },
    recentChanges: sortedChanges,
    featuredOffers: {
      topAds,
      longestRunning,
      newWithVolume,
      mostCreatives,
      recentlyUpdated,
    },
    marketIntelligence: {
      topNiches,
      priceDistribution: {
        ranges: priceDistributionFormatted,
        avgPrice: overallAvgPrice,
        medianPrice: overallMedianPrice,
      },
      adsDistribution: adsDistributionFormatted,
      productTypes,
      creativeFormats,
    },
    baseIssues,
    recentActivity: recentActivity
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10),
  };
}
