// ==============================================================================
// OFFER MINER - UNIFIED DATABASE & STORAGE SERVICE (PIPELINE & AUDIT READY)
// ==============================================================================

import { supabase, isSupabaseConfigured, createAdminSupabaseClient, createAuthenticatedSupabaseClient } from './client';
import {
  Offer,
  OfferSnapshot,
  OfferAd,
  OfferAdMedia,
  OfferAdWithMedia,
  OfferCreative,
  OfferDeliverable,
  OfferBonus,
  OfferOrderBump,
  OfferUpsell,
  OfferFunnelStep,
  OfferAnalysis,
  ImportBatch,
  ImportRow,
  DeepDive,
  DeepDiveInsight,
  DeepDiveHypothesis,
  DeepDiveTest,
  ResearchPattern,
  UserSettings,
  ImportPreviewRow,
  OfferFiltersState,
  OfferStatus,
  SavedView,
  CreativeCaptureJob,
  CaptureJobStatus,
  LandingPageCapture,
  LandingPageSection,
  LandingPageLink,
  LandingPageAnalysisResult,
  OfferProof,
  OfferBenefit,
  OfferObjection,
  OfferCTA,
  OfferAnalysisJob,
  OfferAnalysisJobStatus,
  OfferAnalysisStage,
  OfferFrontendOption,
  MappingBatch,
  MappingJob,
  MappingSummary,
  ActiveAdsSource,
  CreativeMetricsUpdate,
  ScrapingBatch,
  ScrapingJob,
  ScrapingSummary,
  AgentStagedOffer,
} from '@/types';
import { calculateFrontendPricing } from '@/lib/pricing';
import { resolveCurrentCheckoutUrl, isKnownCheckoutUrl } from '@/lib/checkout-intelligence/url-resolver';
import { DEFAULT_VALIDATION_SETTINGS } from '../validation';
import { calculateOpportunityScore, calculateDiscoveryScore, calculateMomentumScore, deriveActivityStatus } from '../scoring';
import { deriveDataStatus } from '../dossier';
import { resolveImportedOfferName } from '../import/offer-name-resolver';

// Storage keys for local fallback
const STORAGE_KEYS = {
  OFFERS: 'offerminer_offers_v2',
  SNAPSHOTS: 'offerminer_snapshots_v2',
  ADS: 'offerminer_ads_v2',
  AD_MEDIA: 'offerminer_ad_media_v2',
  CREATIVES: 'offerminer_creatives_v2',
  DELIVERABLES: 'offerminer_deliverables_v2',
  BONUSES: 'offerminer_bonuses_v2',
  ORDER_BUMPS: 'offerminer_orderbumps_v2',
  UPSELLS: 'offerminer_upsells_v2',
  FUNNEL_STEPS: 'offerminer_funnels_v2',
  PROOFS: 'offerminer_proofs_v2',
  BENEFITS: 'offerminer_benefits_v2',
  OBJECTIONS: 'offerminer_objections_v2',
  CTAS: 'offerminer_ctas_v2',
  ANALYSIS: 'offerminer_analysis_v2',
  BATCHES: 'offerminer_batches_v2',
  IMPORT_ROWS: 'offerminer_import_rows_v2',
  DEEP_DIVES: 'offerminer_deepdives_v2',
  INSIGHTS: 'offerminer_insights_v2',
  HYPOTHESES: 'offerminer_hypotheses_v2',
  TESTS: 'offerminer_tests_v2',
  PATTERNS: 'offerminer_patterns_v2',
  SETTINGS: 'offerminer_settings_v2',
  SAVED_VIEWS: 'offerminer_savedviews_v2',
  CAPTURE_JOBS: 'offerminer_capturejobs_v2',
  LP_CAPTURES: 'offerminer_lp_captures_v2',
  LP_SECTIONS: 'offerminer_lp_sections_v2',
  LP_LINKS: 'offerminer_lp_links_v2',
  CHECKOUT_CAPTURES: 'offerminer_checkout_captures_v2',
  ANALYSIS_JOBS: 'offerminer_analysis_jobs_v2',
  FRONTEND_OPTIONS: 'offerminer_frontend_options_v2',
  MAPPING_BATCHES: 'offerminer_mapping_batches_v2',
  MAPPING_JOBS: 'offerminer_mapping_jobs_v2',
  SCRAPING_BATCHES: 'offerminer_scraping_batches_v2',
  SCRAPING_JOBS: 'offerminer_scraping_jobs_v2',
  AGENT_STAGED_OFFERS: 'offerminer_agent_staged_v2',
};

// In-memory store + file store for server-side fallback
const memoryStore: Record<string, string> = {};

export function isBadTestOffer(o: any): boolean {
  if (!o) return true;
  const name = (o.product_name || o.offer_name || '').trim();
  const lower = name.toLowerCase();
  if (
    lower === 'oferta sem nome' ||
    lower === '<<sem nome>>' ||
    lower.includes('test 9') ||
    lower.includes('test 14') ||
    lower.includes('test 6') ||
    lower.includes('test 5') ||
    lower.includes('test 7') ||
    lower.includes('test 2') ||
    lower.includes('test 1') ||
    lower.includes('colada diretamente') ||
    lower.includes('previamente mapeada') ||
    lower.includes('central mapping') ||
    lower.includes('checkout test') ||
    lower.includes('landing page test')
  ) return true;
  if (o.is_demo_data || o.is_test_data || o.source_type === 'TEST') return true;
  if (!name && !o.landing_page_url && !o.meta_ads_url && !o.checkout_url) return true;
  return false;
}

export function isLocalBackend(): boolean {
  return process.env.DATA_BACKEND === 'local';
}

function getStoreFileName(): string {
  const isTest = process.env.NODE_ENV === 'test' || process.env.IS_TEST_RUN === 'true';
  return isTest ? 'test_store.json' : 'store.json';
}

function readServerStore(): Record<string, string> {
  if (typeof window !== 'undefined') return {};
  try {
    const nodeRequire = eval('require');
    const fs = nodeRequire('fs');
    const path = nodeRequire('path');
    const dataDir = path.resolve(process.cwd(), '.data');
    const dataFile = path.join(dataDir, getStoreFileName());
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(dataFile)) {
      const content = fs.readFileSync(dataFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    // ignore
  }
  return {};
}

function writeServerStore(store: Record<string, string>) {
  if (typeof window !== 'undefined') return;
  try {
    const nodeRequire = eval('require');
    const fs = nodeRequire('fs');
    const path = nodeRequire('path');
    const dataDir = path.resolve(process.cwd(), '.data');
    const dataFile = path.join(dataDir, getStoreFileName());
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    // ignore
  }
}

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    const store = readServerStore();
    const memData = store[key] !== undefined ? store[key] : memoryStore[key];
    if (memData) {
      const parsed = JSON.parse(memData);
      if (key === STORAGE_KEYS.OFFERS && Array.isArray(parsed)) {
        return parsed.filter((o: any) => !isBadTestOffer(o)) as any;
      }
      return parsed;
    }
    return fallback;
  }
  try {
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (key === STORAGE_KEYS.OFFERS && Array.isArray(parsed)) {
        const cleaned = parsed.filter((o: any) => !isBadTestOffer(o));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
        return cleaned as any;
      }
      return parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  let finalValue = value;
  if (key === STORAGE_KEYS.OFFERS && Array.isArray(value)) {
    finalValue = value.filter((o: any) => !isBadTestOffer(o)) as any;
  }

  const str = JSON.stringify(finalValue);
  memoryStore[key] = str;

  if (typeof window === 'undefined') {
    // In server environments, write to server store as resilient fallback
    const store = readServerStore();
    store[key] = str;
    writeServerStore(store);
    return;
  }

  try {
    localStorage.setItem(key, str);
    // Asynchronously synchronize key to backend so server API immediately has it
    if (typeof fetch !== 'undefined') {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: finalValue }),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('LocalStorage write error:', err);
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export const dbService = {
  _lastError: null as { code?: string; message: string; timestamp: string } | null,
  getLastError() {
    return this._lastError;
  },
  clearLastError() {
    this._lastError = null;
  },

  // --------------------------------------------------------------------------
  // USER SETTINGS
  // --------------------------------------------------------------------------
  async getSettings(): Promise<UserSettings> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        const query = supabase.from('user_settings').select('*');
        if (user?.user?.id) {
          query.eq('user_id', user.user.id);
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (data && !error) return data;
      } catch (err) {
        console.warn('Supabase getSettings fallback:', err);
      }
    }
    return getLocal<UserSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_VALIDATION_SETTINGS);
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings, updated_at: new Date().toISOString() };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        await supabase
          .from('user_settings')
          .upsert({ ...updated, user_id: user?.user?.id || null });
      } catch (err) {
        console.warn('Supabase updateSettings fallback:', err);
      }
    }

    setLocal(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  },

  getLocalOffersSync(): Offer[] {
    return getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
  },

  setLocalOffersSync(offers: Offer[]): void {
    setLocal(STORAGE_KEYS.OFFERS, offers);
  },

  // --------------------------------------------------------------------------
  // OFFERS
  // --------------------------------------------------------------------------
  async getOffers(filters?: Partial<OfferFiltersState>, client?: any): Promise<Offer[]> {
    let allOffers: Offer[] = [];

    if (isLocalBackend()) {
      let localOffers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);

      // Auto-purge any demo data if present
      if (localOffers.some((o) => o.is_demo_data)) {
        localOffers = localOffers.filter((o) => !o.is_demo_data);
        setLocal(STORAGE_KEYS.OFFERS, localOffers);
      }

      // Guarantee newest first (created_at DESC)
      localOffers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const snapshots = getLocal<OfferSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
      const creatives = getLocal<OfferCreative[]>(STORAGE_KEYS.CREATIVES, []);
      const deliverables = getLocal<OfferDeliverable[]>(STORAGE_KEYS.DELIVERABLES, []);
      const bonuses = getLocal<OfferBonus[]>(STORAGE_KEYS.BONUSES, []);
      const orderBumps = getLocal<OfferOrderBump[]>(STORAGE_KEYS.ORDER_BUMPS, []);
      const upsells = getLocal<OfferUpsell[]>(STORAGE_KEYS.UPSELLS, []);
      const funnels = getLocal<OfferFunnelStep[]>(STORAGE_KEYS.FUNNEL_STEPS, []);
      const analyses = getLocal<OfferAnalysis[]>(STORAGE_KEYS.ANALYSIS, []);
      const frontendOptions = getLocal<OfferFrontendOption[]>(STORAGE_KEYS.FRONTEND_OPTIONS, []);

      allOffers = localOffers.map((offer) => {
        const offerSnapshots = [
          ...(offer.snapshots || []),
          ...snapshots.filter((s) => s.offer_id === offer.id),
        ].sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());

        const momentumInfo = calculateMomentumScore(offer.active_ads_count ?? null, offerSnapshots);

        const optionsFromStorage = frontendOptions.filter((fo) => fo.offer_id === offer.id);
        const loadedOptions = optionsFromStorage.length > 0 ? optionsFromStorage : (offer.frontend_options || []);

        return {
          ...offer,
          snapshots: offerSnapshots,
          creatives: offer.creatives || creatives.filter((c) => c.offer_id === offer.id),
          deliverables: offer.deliverables || deliverables.filter((d) => d.offer_id === offer.id),
          bonuses: offer.bonuses || bonuses.filter((b) => b.offer_id === offer.id),
          order_bumps: offer.order_bumps || orderBumps.filter((ob) => ob.offer_id === offer.id),
          upsells: offer.upsells || upsells.filter((u) => u.offer_id === offer.id),
          funnel_steps: offer.funnel_steps || funnels.filter((f) => f.offer_id === offer.id),
          analysis: offer.analysis || analyses.find((a) => a.offer_id === offer.id),
          frontend_options: loadedOptions,
          trend: offer.trend || momentumInfo.trend,
          momentum_score: offer.momentum_score ?? momentumInfo.momentumScore,
          activity_status: deriveActivityStatus(offer.last_seen_at || offer.last_imported_at || offer.created_at),
        };
      });
    } else {
      // REGRA ARQUITETURAL: Supabase é o backend CANÔNICO OBRIGATÓRIO
      const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

      if (!isSupabaseConfigured() || !activeClient) {
        this._lastError = {
          message: 'Supabase não configurado no ambiente. Configure NEXT_PUBLIC_SUPABASE_URL.',
          timestamp: new Date().toISOString(),
        };
        throw new Error(this._lastError.message);
      }

      const { data, error } = await activeClient
        .from('offers')
        .select(`
          *,
          snapshots:offer_snapshots(*),
          creatives:offer_creatives(*),
          deliverables:offer_deliverables(*),
          bonuses:offer_bonuses(*),
          order_bumps:offer_order_bumps(*),
          upsells:offer_upsells(*),
          funnel_steps:offer_funnel_steps(*),
          frontend_options:offer_frontend_options(*),
          analysis:offer_analysis(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        this._lastError = {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        };
        console.error('Supabase getOffers query error:', error.message || error.code);
        throw new Error(`Falha ao consultar ofertas no Supabase: ${error.message} (${error.code})`);
      }

      this._lastError = null;
      allOffers = ((data || []) as any[]).map((offer) => {
        const offerSnapshots = (offer.snapshots || []).sort(
          (a: any, b: any) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        );
        const momentumInfo = calculateMomentumScore(offer.active_ads_count ?? null, offerSnapshots);
        return {
          ...offer,
          snapshots: offerSnapshots,
          trend: offer.trend || momentumInfo.trend,
          momentum_score: offer.momentum_score ?? momentumInfo.momentumScore,
          activity_status: deriveActivityStatus(offer.last_seen_at || offer.last_imported_at || offer.created_at),
        };
      }) as Offer[];

      if (allOffers.length === 0) {
        const localOffers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
        if (localOffers.length > 0) {
          allOffers = localOffers;
        }
      }
    }

    if (!filters) return allOffers;

    // Apply Filters
    return allOffers.filter((offer) => {
      // 1. Search Query
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchProduct = (offer.product_name || '').toLowerCase().includes(query);
        const matchAdv = (offer.advertiser || '').toLowerCase().includes(query);
        const matchHeadline = (offer.headline || '').toLowerCase().includes(query);
        const matchPromise = (offer.promise || '').toLowerCase().includes(query);
        const matchNiche = (offer.niche || '').toLowerCase().includes(query);
        const matchSubniche = (offer.subniche || '').toLowerCase().includes(query);
        const matchType = (offer.product_type || '').toLowerCase().includes(query);
        const matchNotes = (offer.notes || '').toLowerCase().includes(query);

        if (!matchProduct && !matchAdv && !matchHeadline && !matchPromise && !matchNiche && !matchSubniche && !matchType && !matchNotes) {
          return false;
        }
      }

      // 2. Quick Filter Chips
      if (filters.quickFilter && filters.quickFilter !== 'all') {
        if (filters.quickFilter === 'opportunities') {
          if (offer.status !== 'VALIDADA' || (offer.system_score ?? 0) < 75) return false;
        } else if (filters.quickFilter === 'new') {
          const createdTime = new Date(offer.created_at).getTime();
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          if (createdTime < sevenDaysAgo) return false;
        } else if (filters.quickFilter === 'scaling') {
          if (offer.trend !== 'CRESCENDO' && (offer.momentum_score ?? 0) < 70) return false;
        } else if (filters.quickFilter === 'favorites') {
          if (!offer.favorite) return false;
        } else if (filters.quickFilter === 'watching') {
          if (!offer.watching) return false;
        } else if (filters.quickFilter === 'deep_dive') {
          if (!offer.in_deep_dive) return false;
        } else if (filters.quickFilter === 'price_20_30') {
          const opts = offer.frontend_options || [];
          if (opts.length > 0) {
            const hasMatch = opts.some((o) => o.current_price >= 20 && o.current_price <= 30);
            if (!hasMatch) return false;
          } else {
            if (offer.price === null || offer.price === undefined || offer.price < 20 || offer.price > 30) return false;
          }
        } else if (filters.quickFilter === 'ads_20_plus') {
          if (offer.active_ads_count === null || offer.active_ads_count === undefined || offer.active_ads_count < 20) return false;
        } else if (filters.quickFilter === 'full_scale') {
          if (offer.active_ads_count === null || offer.active_ads_count === undefined || offer.active_ads_count <= 200) return false;
        } else if (filters.quickFilter === 'ads_100_plus') {
          if (offer.active_ads_count === null || offer.active_ads_count === undefined || offer.active_ads_count <= 100) return false;
        } else if (filters.quickFilter === 'ads_30_plus') {
          if (offer.active_ads_count === null || offer.active_ads_count === undefined || offer.active_ads_count <= 30) return false;
        } else if (filters.quickFilter === 'days_20_plus') {
          if (offer.days_running === null || offer.days_running === undefined || offer.days_running < 20) return false;
        }
      }

      // 3. Specific Flags
      if (filters.onlyFavorites && !offer.favorite) return false;
      if (filters.onlyWatching && !offer.watching) return false;
      if (filters.onlyDeepDive && !offer.in_deep_dive) return false;

      // 4. Status & Decision
      if (filters.status && filters.status !== 'all' && offer.status !== filters.status) return false;
      if (filters.decision && filters.decision !== 'all' && offer.decision !== filters.decision) return false;
      if (filters.trend && filters.trend !== 'all' && offer.trend !== filters.trend) return false;

      // 5. Niche & Product Type
      if (filters.niche && filters.niche !== 'all' && offer.niche !== filters.niche) return false;
      if (filters.subniche && filters.subniche !== 'all' && offer.subniche !== filters.subniche) return false;
      if (filters.productType && filters.productType !== 'all' && offer.product_type !== filters.productType) return false;

      // 6. Price Range (ANY front option within range)
      const opts = offer.frontend_options || [];
      if (opts.length > 0) {
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
          const minP = filters.minPrice ?? 0;
          const maxP = filters.maxPrice ?? Infinity;
          const hasMatch = opts.some((o) => o.current_price >= minP && o.current_price <= maxP);
          if (!hasMatch) return false;
        }
      } else {
        if (filters.minPrice !== undefined && (offer.price === null || offer.price === undefined || offer.price < filters.minPrice)) return false;
        if (filters.maxPrice !== undefined && (offer.price === null || offer.price === undefined || offer.price > filters.maxPrice)) return false;
      }

      // 7. Ads Range
      if (filters.minAds !== undefined && (offer.active_ads_count === null || offer.active_ads_count === undefined || offer.active_ads_count < filters.minAds)) return false;
      if (filters.maxAds !== undefined && (offer.active_ads_count === null || offer.active_ads_count === undefined || offer.active_ads_count > filters.maxAds)) return false;

      // 8. Days Range
      const days = offer.days_running ?? null;
      if (filters.minDays !== undefined && (days === null || days < filters.minDays)) return false;
      if (filters.maxDays !== undefined && (days === null || days > filters.maxDays)) return false;

      // 9. Faceless
      if (filters.faceless !== undefined && filters.faceless !== 'all') {
        if (offer.faceless !== filters.faceless) return false;
      }

      // 10. Min Score
      if (filters.minScore !== undefined && (offer.score === null || offer.score === undefined || offer.score < filters.minScore)) return false;

      return true;
    }).sort((a, b) => {
      const sortBy = filters.sortBy || 'created_at';
      const order = filters.sortOrder === 'asc' ? 1 : -1;

      if (sortBy === 'price') {
        const pA = a.front_price_avg ?? a.price ?? 0;
        const pB = b.front_price_avg ?? b.price ?? 0;
        return (pA - pB) * order;
      }
      if (sortBy === 'active_ads_count') return ((a.active_ads_count ?? 0) - (b.active_ads_count ?? 0)) * order;
      if (sortBy === 'days_running') return ((a.days_running ?? 0) - (b.days_running ?? 0)) * order;
      if (sortBy === 'score') return ((a.score ?? 0) - (b.score ?? 0)) * order;
      if (sortBy === 'system_score') return ((a.system_score ?? 0) - (b.system_score ?? 0)) * order;
      if (sortBy === 'momentum_score') return ((a.momentum_score ?? 0) - (b.momentum_score ?? 0)) * order;

      const dateA = new Date(a.last_imported_at || a.created_at).getTime();
      const dateB = new Date(b.last_imported_at || b.created_at).getTime();
      return (dateA - dateB) * order;
    });
  },

  getCurrentCheckoutUrl(offer: Offer | null | undefined): string | null {
    if (!offer) return null;
    const res = resolveCurrentCheckoutUrl(offer);
    return res.resolvedCheckoutUrl || offer.checkout_url || null;
  },

  async getOfferById(id: string, client?: any): Promise<Offer | null> {
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data, error } = await activeClient
          .from('offers')
          .select(`
            *,
            snapshots:offer_snapshots(*),
            creatives:offer_creatives(*),
            deliverables:offer_deliverables(*),
            bonuses:offer_bonuses(*),
            order_bumps:offer_order_bumps(*),
            upsells:offer_upsells(*),
            funnel_steps:offer_funnel_steps(*),
            frontend_options:offer_frontend_options(*),
            analysis:offer_analysis(*)
          `)
          .eq('id', id)
          .maybeSingle();

        if (data && !error) {
          return data as Offer;
        }
      } catch (err) {
        console.warn('Supabase getOfferById error:', err);
      }
    }

    const all = await this.getOffers(undefined, client);
    const offer = all.find((o) => o.id === id);
    return offer || null;
  },

  // --------------------------------------------------------------------------
  // BATCH IMPORT & AUDIT ROWS
  // --------------------------------------------------------------------------
  async executeImportBatch(
    fileName: string,
    previewRows: ImportPreviewRow[],
    sheetCount: number = 1,
    options?: {
      import_type?: 'XLSX' | 'JSON_FILE' | 'JSON_PASTE' | 'MANUAL';
      metadata?: Record<string, any>;
      workspace_id?: string;
      user_id?: string;
    },
    client?: any
  ): Promise<{
    batch: ImportBatch;
    newCount: number;
    updatedCount: number;
    ignoredCount: number;
    persistedOffers?: Offer[];
    persisted_offer_ids: string[];
    rejectedCount: number;
  }> {
    const now = new Date().toISOString();
    const batchId = generateId();
    const isJsonBatch =
      options?.import_type === 'JSON_FILE' ||
      options?.import_type === 'JSON_PASTE' ||
      fileName.toLowerCase().endsWith('.json') ||
      fileName.includes('JSON');

    const resolvedWorkspaceId = options?.workspace_id || 'ws_default_001';
    const resolvedUserId = options?.user_id || null;
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    let newCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;
    let invalidCount = 0;
    let errorCount = 0;

    const offersToInsert: Partial<Offer>[] = [];
    const snapshotsToInsert: Partial<OfferSnapshot>[] = [];
    const offersToUpdate: { id: string; changes: Partial<Offer> }[] = [];
    const importRowsToInsert: ImportRow[] = [];

    for (const item of previewRows) {
      const rowId = generateId();

      if (item.hasErrors || item.validation?.status === 'INVALIDA' || item.validation?.isValid === false) {
        errorCount++;
        invalidCount++;
        importRowsToInsert.push({
          id: rowId,
          import_batch_id: batchId,
          workspace_id: resolvedWorkspaceId,
          user_id: resolvedUserId || undefined,
          sheet_name: item.sheetName || 'Sheet1',
          row_number: item.rowIndex,
          raw_data: item.raw,
          normalized_data: item.normalized as Record<string, any>,
          import_status: 'error',
          error_message: (item.errors && item.errors.length > 0) ? item.errors.join('; ') : 'Validation failed',
          created_at: now,
        });
        continue;
      }

      if (item.isDuplicate) {
        if (item.duplicateAction === 'ignore') {
          ignoredCount++;
          importRowsToInsert.push({
            id: rowId,
            import_batch_id: batchId,
            workspace_id: resolvedWorkspaceId,
            user_id: resolvedUserId || undefined,
            sheet_name: item.sheetName || 'Sheet1',
            row_number: item.rowIndex,
            raw_data: item.raw,
            normalized_data: item.normalized as Record<string, any>,
            import_status: 'ignored',
            offer_id: item.existingOffer?.id || null,
            created_at: now,
          });
          continue;
        }

        if (item.duplicateAction === 'update' && item.existingOffer) {
          updatedCount++;
          const existing = item.existingOffer;

          // 1. Create historical snapshot of the new incoming state
          const currentIncomingSnapshot: OfferSnapshot = {
            id: generateId(),
            offer_id: existing.id,
            workspace_id: resolvedWorkspaceId,
            user_id: resolvedUserId || undefined,
            active_ads_count: item.normalized.active_ads_count ?? existing.active_ads_count ?? null,
            estimated_unique_creatives: item.normalized.estimated_unique_creatives ?? existing.estimated_unique_creatives ?? null,
            days_running: item.normalized.days_running ?? existing.days_running ?? null,
            oldest_ad_date: item.normalized.oldest_ad_date ?? existing.oldest_ad_date ?? null,
            price: item.normalized.price ?? existing.price ?? null,
            captured_at: now,
            import_batch_id: batchId,
          };
          snapshotsToInsert.push(currentIncomingSnapshot);

          // 2. Compute new momentum and trend using all historical snapshots + current
          const allSnaps = [
            ...(existing.snapshots || []),
            currentIncomingSnapshot,
          ];

          const momentumInfo = calculateMomentumScore(
            item.normalized.active_ads_count ?? existing.active_ads_count ?? null,
            allSnaps
          );

          const discoveryBreakdown = calculateDiscoveryScore({
            ...existing,
            ...item.normalized,
          });
          const discoveryScore = discoveryBreakdown.total;
          const oppScore = calculateOpportunityScore(discoveryScore, momentumInfo.momentumScore);

          // Merge extra_data
          const mergedExtra = {
            ...(existing.extra_data || {}),
            ...(item.extraData || {}),
          };

          offersToUpdate.push({
            id: existing.id,
            changes: {
              active_ads_count: item.normalized.active_ads_count ?? existing.active_ads_count,
              estimated_unique_creatives: item.normalized.estimated_unique_creatives ?? (item.normalized as any).unique_creatives_count ?? existing.estimated_unique_creatives,
              unique_creatives_count: (item.normalized as any).unique_creatives_count ?? item.normalized.estimated_unique_creatives ?? existing.unique_creatives_count,
              days_running: item.normalized.days_running ?? existing.days_running,
              price: item.normalized.price ?? existing.price,
              headline: item.normalized.headline ?? existing.headline,
              ad_format: item.normalized.ad_format ?? existing.ad_format,
              notes: item.normalized.notes
                ? `${existing.notes || ''}\n[Atualização ${now.split('T')[0]}]: ${item.normalized.notes}`.trim()
                : existing.notes,
              score: item.normalized.score ?? existing.score,
              work_score: item.normalized.score ?? existing.work_score,
              discovery_score: discoveryScore,
              system_score: oppScore ?? discoveryScore,
              opportunity_score: oppScore,
              momentum_score: momentumInfo.momentumScore,
              trend: momentumInfo.trend,
              status: existing.status === 'ARQUIVADA' ? 'ARQUIVADA' : deriveDataStatus({ ...existing, ...item.normalized }),
              source_file_name: fileName,
              sheet_name: item.sheetName,
              row_number: item.rowIndex,
              raw_data: item.raw,
              extra_data: Object.keys(mergedExtra).length > 0 ? mergedExtra : null,
              source_import_batch_id: batchId,
              source_import_row_id: rowId,
              last_seen_at: now,
              last_imported_at: now,
              updated_at: now,
            },
          });

          importRowsToInsert.push({
            id: rowId,
            import_batch_id: batchId,
            workspace_id: resolvedWorkspaceId,
            user_id: resolvedUserId || undefined,
            sheet_name: item.sheetName || 'Sheet1',
            row_number: item.rowIndex,
            raw_data: item.raw,
            normalized_data: item.normalized as Record<string, any>,
            import_status: 'updated',
            offer_id: existing.id,
            created_at: now,
          });

          continue;
        }
      }

      // ----------------------------------------------------------------------
      // PERSISTENCE GATE: Minimal identity enforcement & placeholder prohibition
      // ----------------------------------------------------------------------
      const resolvedIdentity = resolveImportedOfferName(item.raw, item.normalized);
      const rawProdName = (
        resolvedIdentity.offerName ||
        item.normalized.product_name ||
        (item.normalized as any).offer_name ||
        ''
      ).trim();
      const isPlaceholderName =
        rawProdName.toLowerCase() === 'sem nome' ||
        rawProdName.toLowerCase() === 'oferta sem nome' ||
        rawProdName.toLowerCase() === 'sem título' ||
        rawProdName.toLowerCase() === 'sem titulo' ||
        rawProdName.toLowerCase() === '<<sem nome>>';
      const hasValidName = rawProdName.length > 0 && !isPlaceholderName;
      const hasLp = Boolean(item.normalized.landing_page_url && item.normalized.landing_page_url.trim().length > 0);
      const hasMeta = Boolean(item.normalized.meta_ads_url && item.normalized.meta_ads_url.trim().length > 0);
      const hasChk = Boolean(item.normalized.checkout_url && item.normalized.checkout_url.trim().length > 0);

      // Persistence Gate: Reject records without minimal identity
      if (!hasValidName && !hasLp && !hasMeta && !hasChk) {
        invalidCount++;
        errorCount++;
        importRowsToInsert.push({
          id: rowId,
          import_batch_id: batchId,
          workspace_id: resolvedWorkspaceId,
          user_id: resolvedUserId || undefined,
          sheet_name: item.sheetName || 'Sheet1',
          row_number: item.rowIndex,
          raw_data: item.raw,
          normalized_data: item.normalized as Record<string, any>,
          import_status: 'error',
          error_message: 'Persistence Gate: Registro rejeitado por ausência de identidade mínima (sem nome, sem LP, sem Meta Ads e sem Checkout).',
          created_at: now,
        });
        continue;
      }

      // New offer insertion
      newCount++;
      const newOfferId = generateId();
      const discoveryBreakdown = calculateDiscoveryScore(item.normalized);
      const discoveryScore = discoveryBreakdown.total;

      const safeProductName = hasValidName ? rawProdName : null;
      const resolvedAdvertiser = item.normalized.advertiser || resolvedIdentity.advertiser || null;

      const newOffer: Offer = {
        id: newOfferId,
        workspace_id: resolvedWorkspaceId,
        user_id: resolvedUserId || undefined,
        source: item.normalized.source || (isJsonBatch ? (options?.import_type || 'JSON_IMPORT') : 'XLSX'),
        product_name: (safeProductName as any) ?? '',
        offer_name: (safeProductName as any) ?? '',
        niche: item.normalized.niche ?? null,
        subniche: item.normalized.subniche ?? null,
        product_type: item.normalized.product_type ?? null,
        advertiser: resolvedAdvertiser,
        price: item.normalized.price ?? null,
        currency: 'BRL',
        active_ads_count: item.normalized.active_ads_count ?? null,
        estimated_unique_creatives: item.normalized.estimated_unique_creatives ?? (item.normalized as any).unique_creatives_count ?? null,
        unique_creatives_count: (item.normalized as any).unique_creatives_count ?? item.normalized.estimated_unique_creatives ?? null,
        oldest_ad_date: item.normalized.oldest_ad_date ?? null,
        days_running: item.normalized.days_running ?? null,
        faceless: item.normalized.faceless ?? null,
        meta_ads_url: item.normalized.meta_ads_url ?? null,
        landing_page_url: item.normalized.landing_page_url ?? null,
        landing_page_url_original: item.normalized.landing_page_url ?? null,
        landing_page_domain: item.normalized.landing_page_domain ?? null,
        landing_page_url_source: item.normalized.landing_page_url_source ?? 'NONE',
        landing_page_url_status: item.normalized.landing_page_url_status ?? (item.normalized.landing_page_url ? 'PENDING' : 'NEEDS_MANUAL_URL'),
        lp_mapping_status: 'NOT_MAPPED',
        lp_mapped_at: null,
        mapped_source_url: null,
        mapper_version: null,
        checkout_url: item.normalized.checkout_url ?? null,
        checkout_discovery_status: isJsonBatch ? 'NOT_PROCESSED' : (item.normalized.checkout_url ? 'FOUND' : 'NOT_PROCESSED'),
        checkout_discovery_at: isJsonBatch ? null : (item.normalized.checkout_url ? now : null),
        checkout_mapping_status: 'NOT_MAPPED',
        checkout_mapped_at: null,
        headline: item.normalized.headline ?? null,
        subheadline: item.normalized.subheadline ?? null,
        ad_format: item.normalized.ad_format ?? null,
        notes: item.normalized.notes ?? null,
        score: item.normalized.score ?? null,
        work_score: item.normalized.score ?? null,
        discovery_score: discoveryScore,
        system_score: discoveryScore,
        opportunity_score: null, // No momentum yet on initial capture
        momentum_score: null, // Strict: null until >= 2 snapshots
        trend: 'SEM_HISTORICO',
        activity_status: 'Ativa',
        status: deriveDataStatus(item.normalized),
        decision: 'Observar',
        favorite: false,
        watching: false,
        in_deep_dive: false,
        archived: false,
        archived_at: null,
        archived_by_user: false,
        dedupe_key: item.dedupe_key,
        source_file_name: fileName,
        sheet_name: item.sheetName || 'Sheet1',
        row_number: item.rowIndex,
        raw_data: item.raw,
        extra_data: item.extraData && Object.keys(item.extraData).length > 0 ? item.extraData : null,
        source_import_batch_id: batchId,
        source_import_row_id: rowId,
        first_seen_at: now,
        last_seen_at: now,
        first_imported_at: now,
        last_imported_at: now,
        created_at: now,
        updated_at: now,
        is_demo_data: false,
      };

      offersToInsert.push(newOffer);

      // Initial snapshot for the new offer
      snapshotsToInsert.push({
        id: generateId(),
        offer_id: newOfferId,
        workspace_id: resolvedWorkspaceId,
        user_id: resolvedUserId || undefined,
        active_ads_count: newOffer.active_ads_count,
        estimated_unique_creatives: newOffer.estimated_unique_creatives,
        days_running: newOffer.days_running,
        oldest_ad_date: newOffer.oldest_ad_date,
        price: newOffer.price,
        captured_at: now,
        import_batch_id: batchId,
      });

      importRowsToInsert.push({
        id: rowId,
        import_batch_id: batchId,
        workspace_id: resolvedWorkspaceId,
        user_id: resolvedUserId || undefined,
        sheet_name: item.sheetName || 'Sheet1',
        row_number: item.rowIndex,
        raw_data: item.raw,
        normalized_data: item.normalized as Record<string, any>,
        import_status: 'inserted',
        offer_id: newOfferId,
        created_at: now,
      });
    }

    const batchRecord: ImportBatch = {
      id: batchId,
      workspace_id: resolvedWorkspaceId,
      user_id: resolvedUserId || undefined,
      file_name: fileName,
      import_type: options?.import_type || (isJsonBatch ? (fileName.includes('colado') || fileName.includes('PASTE') ? 'JSON_PASTE' : 'JSON_FILE') : 'XLSX'),
      sheet_count: sheetCount,
      total_rows: previewRows.length,
      imported_rows: newCount,
      updated_rows: updatedCount,
      duplicate_rows: ignoredCount + updatedCount,
      invalid_rows: invalidCount,
      error_rows: errorCount,
      successful_rows: newCount + updatedCount,
      metadata_json: options?.metadata,
      created_at: now,
    };

    // 1. Supabase Canonical Persistence
    if (isSupabaseConfigured() && activeClient) {
      // 1.1 Inserir Batch
      const { error: batchErr } = await activeClient
        .from('import_batches')
        .insert({
          ...batchRecord,
          workspace_id: resolvedWorkspaceId,
          user_id: resolvedUserId,
        });

      if (batchErr) {
        console.error('[executeImportBatch Error on import_batches]:', batchErr);
        throw new Error(`[IMPORT_DB_FAILED]: Falha ao registrar lote no Supabase: ${batchErr.message} (${batchErr.code})`);
      }

      // 1.2 Inserir Ofertas
      if (offersToInsert.length > 0) {
        const payloadOffers = offersToInsert.map((o) => ({
          ...o,
          workspace_id: resolvedWorkspaceId,
          user_id: resolvedUserId,
        }));

        const { error: offersErr } = await activeClient
          .from('offers')
          .insert(payloadOffers);

        if (offersErr) {
          console.error('[executeImportBatch Error on offers]:', offersErr);
          throw new Error(`[IMPORT_DB_FAILED]: Falha ao inserir ofertas no Supabase: ${offersErr.message} (${offersErr.code})`);
        }
      }

      // 1.3 Inserir Linhas de Importação
      if (importRowsToInsert.length > 0) {
        const { error: rowsErr } = await activeClient
          .from('import_rows')
          .insert(importRowsToInsert);
        if (rowsErr) {
          console.warn('[executeImportBatch Warning on import_rows]:', rowsErr.message);
        }
      }

      // 1.4 Atualizar Ofertas Existentes
      for (const updateItem of offersToUpdate) {
        const { error: updErr } = await activeClient
          .from('offers')
          .update(updateItem.changes)
          .eq('id', updateItem.id)
          .eq('workspace_id', resolvedWorkspaceId);
        if (updErr) {
          console.warn('[executeImportBatch Warning on offers update]:', updErr.message);
        }
      }

      // 1.5 Inserir Snapshots
      if (snapshotsToInsert.length > 0) {
        const { error: snapErr } = await activeClient
          .from('offer_snapshots')
          .insert(snapshotsToInsert);
        if (snapErr) {
          console.warn('[executeImportBatch Warning on offer_snapshots]:', snapErr.message);
        }
      }
    }

    // 2. CANONICAL DB READ-BACK VERIFICATION DIRECTLY FROM SUPABASE
    let confirmedPersistedOffers: Offer[] = [];
    let confirmedOfferIds: string[] = [];

    if (offersToInsert.length > 0 && isSupabaseConfigured() && activeClient) {
      const idsToCheck = offersToInsert.map((o) => o.id!).filter(Boolean);
      const { data: readBackData, error: readBackErr } = await activeClient
        .from('offers')
        .select(`
          id,
          product_name,
          advertiser,
          workspace_id,
          status,
          created_at,
          source_import_batch_id
        `)
        .in('id', idsToCheck)
        .eq('workspace_id', resolvedWorkspaceId);

      if (readBackErr) {
        throw new Error(`[IMPORT_READBACK_FAILED]: Erro ao reler ofertas persistidas no banco: ${readBackErr.message} (${readBackErr.code})`);
      }

      confirmedPersistedOffers = (readBackData || []) as Offer[];
      confirmedOfferIds = confirmedPersistedOffers.map((o) => o.id);

      if (confirmedPersistedOffers.length === 0) {
        throw new Error(`[IMPORT_READBACK_FAILED]: Nenhuma das ${offersToInsert.length} ofertas foi encontrada no banco após o commit.`);
      }

      if (confirmedPersistedOffers.length < offersToInsert.length) {
        console.warn(`[executeImportBatch]: Read-back confirmou ${confirmedPersistedOffers.length}/${offersToInsert.length} ofertas.`);
      }
    } else {
      confirmedOfferIds = offersToInsert.map((o) => o.id!).filter(Boolean);
      confirmedPersistedOffers = offersToInsert as Offer[];
    }

    // 3. Client Local Storage Sync (Browser only resilience)
    if (typeof window !== 'undefined') {
      let localOffers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
      localOffers = localOffers.map((o) => {
        const update = offersToUpdate.find((u) => u.id === o.id);
        return update ? ({ ...o, ...update.changes } as Offer) : o;
      });
      const newIds = new Set(confirmedOfferIds);
      localOffers = [...confirmedPersistedOffers, ...localOffers.filter((o) => !newIds.has(o.id))];
      setLocal(STORAGE_KEYS.OFFERS, localOffers);

      const localSnapshots = getLocal<OfferSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
      setLocal(STORAGE_KEYS.SNAPSHOTS, [...(snapshotsToInsert as OfferSnapshot[]), ...localSnapshots]);

      const localBatches = getLocal<ImportBatch[]>(STORAGE_KEYS.BATCHES, []);
      setLocal(STORAGE_KEYS.BATCHES, [batchRecord, ...localBatches]);

      const localRows = getLocal<ImportRow[]>(STORAGE_KEYS.IMPORT_ROWS, []);
      setLocal(STORAGE_KEYS.IMPORT_ROWS, [...importRowsToInsert, ...localRows]);
    }

    return {
      batch: batchRecord,
      newCount: confirmedOfferIds.length,
      updatedCount,
      ignoredCount,
      persistedOffers: confirmedPersistedOffers,
      persisted_offer_ids: confirmedOfferIds,
      rejectedCount: errorCount + invalidCount,
    };
  },

  // --------------------------------------------------------------------------
  // ACTIONS, FAVORITES, WATCHLIST & DEEP DIVE
  // --------------------------------------------------------------------------
  async toggleFavorite(offerId: string, current: boolean): Promise<boolean> {
    const nextVal = !current;
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offers').update({ favorite: nextVal, updated_at: new Date().toISOString() }).eq('id', offerId);
      } catch (err) {
        console.warn('Supabase toggleFavorite error:', err);
      }
    }
    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(STORAGE_KEYS.OFFERS, offers.map((o) => (o.id === offerId ? { ...o, favorite: nextVal } : o)));
    return nextVal;
  },

  async toggleWatchlist(offerId: string, current: boolean): Promise<boolean> {
    const nextVal = !current;
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offers').update({ watching: nextVal, updated_at: new Date().toISOString() }).eq('id', offerId);
      } catch (err) {
        console.warn('Supabase toggleWatchlist error:', err);
      }
    }
    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(STORAGE_KEYS.OFFERS, offers.map((o) => (o.id === offerId ? { ...o, watching: nextVal } : o)));
    return nextVal;
  },

  async toggleDeepDive(offerId: string, currentInDeepDive: boolean): Promise<boolean> {
    const nextVal = !currentInDeepDive;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        await supabase.from('offers').update({ in_deep_dive: nextVal, updated_at: now }).eq('id', offerId);

        if (nextVal) {
          await supabase.from('deep_dives').insert({
            id: generateId(),
            offer_id: offerId,
            user_id: user?.user?.id || null,
            status: 'Fila',
            priority: 'Media',
          });
        } else {
          await supabase.from('deep_dives').delete().eq('offer_id', offerId);
        }
      } catch (err) {
        console.warn('Supabase toggleDeepDive error:', err);
      }
    }

    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(STORAGE_KEYS.OFFERS, offers.map((o) => (o.id === offerId ? { ...o, in_deep_dive: nextVal } : o)));

    const deepDives = getLocal<DeepDive[]>(STORAGE_KEYS.DEEP_DIVES, []);
    if (nextVal) {
      const newDeepDive: DeepDive = {
        id: generateId(),
        offer_id: offerId,
        status: 'Fila',
        priority: 'Media',
        created_at: now,
        updated_at: now,
      };
      setLocal(STORAGE_KEYS.DEEP_DIVES, [newDeepDive, ...deepDives]);
    } else {
      setLocal(STORAGE_KEYS.DEEP_DIVES, deepDives.filter((d) => d.offer_id !== offerId));
    }

    return nextVal;
  },

  async saveOffer(offerData: Partial<Offer>, client?: any): Promise<Offer> {
    const now = new Date().toISOString();
    const offerId = offerData.id || generateId();
    const existing = offerData.id ? await this.getOfferById(offerData.id) : null;
    const discScore = calculateDiscoveryScore(offerData).total;
    const oppScore = calculateOpportunityScore(discScore, offerData.momentum_score ?? null);

    const fullOffer: Offer = {
      id: offerId,
      workspace_id: offerData.workspace_id || existing?.workspace_id || 'ws_default_001',
      product_name: offerData.product_name || existing?.product_name || 'Oferta sem nome',
      niche: offerData.niche ?? existing?.niche ?? null,
      subniche: offerData.subniche ?? existing?.subniche ?? null,
      product_type: offerData.product_type ?? existing?.product_type ?? 'Digital',
      advertiser: offerData.advertiser ?? existing?.advertiser ?? null,
      price: offerData.price ?? existing?.price ?? null,
      currency: offerData.currency || existing?.currency || 'BRL',
      active_ads_count: offerData.active_ads_count ?? existing?.active_ads_count ?? null,
      estimated_unique_creatives: offerData.estimated_unique_creatives ?? existing?.estimated_unique_creatives ?? null,
      captured_creatives_count: offerData.captured_creatives_count ?? existing?.captured_creatives_count ?? null,
      captured_videos_count: offerData.captured_videos_count ?? existing?.captured_videos_count ?? null,
      captured_images_count: offerData.captured_images_count ?? existing?.captured_images_count ?? null,
      oldest_ad_date: offerData.oldest_ad_date ?? existing?.oldest_ad_date ?? null,
      days_running: offerData.days_running ?? existing?.days_running ?? null,
      faceless: offerData.faceless ?? existing?.faceless ?? null,
      meta_ads_url: offerData.meta_ads_url ?? existing?.meta_ads_url ?? null,
      landing_page_url: offerData.landing_page_url ?? existing?.landing_page_url ?? null,
      landing_page_url_original: offerData.landing_page_url_original ?? offerData.landing_page_url ?? existing?.landing_page_url_original ?? null,
      landing_page_domain: offerData.landing_page_domain ?? existing?.landing_page_domain ?? null,
      landing_page_url_source: offerData.landing_page_url_source ?? existing?.landing_page_url_source ?? 'NONE',
      landing_page_url_status: offerData.landing_page_url_status ?? existing?.landing_page_url_status ?? (offerData.landing_page_url ? 'PENDING' : 'NEEDS_MANUAL_URL'),
      lp_mapping_status: offerData.lp_mapping_status ?? existing?.lp_mapping_status ?? 'NOT_MAPPED',
      lp_mapped_at: offerData.lp_mapped_at ?? existing?.lp_mapped_at ?? null,
      mapped_source_url: offerData.mapped_source_url ?? existing?.mapped_source_url ?? null,
      mapper_version: offerData.mapper_version ?? existing?.mapper_version ?? null,
      checkout_url: offerData.checkout_url ?? existing?.checkout_url ?? null,
      checkout_discovery_status: offerData.checkout_discovery_status ?? existing?.checkout_discovery_status ?? (offerData.checkout_url ? 'FOUND' : 'NOT_PROCESSED'),
      checkout_discovery_at: offerData.checkout_discovery_at ?? existing?.checkout_discovery_at ?? (offerData.checkout_url ? now : null),
      checkout_mapping_status: offerData.checkout_mapping_status ?? existing?.checkout_mapping_status ?? 'NOT_MAPPED',
      checkout_mapped_at: offerData.checkout_mapped_at ?? existing?.checkout_mapped_at ?? null,
      headline: offerData.headline ?? null,
      subheadline: offerData.subheadline ?? null,
      ad_format: offerData.ad_format ?? null,
      notes: offerData.notes ?? null,
      score: offerData.score ?? null,
      work_score: offerData.work_score ?? null,
      discovery_score: discScore,
      system_score: oppScore ?? discScore,
      opportunity_score: oppScore,
      momentum_score: offerData.momentum_score ?? null,
      trend: offerData.trend || 'SEM_HISTORICO',
      activity_status: offerData.activity_status || 'Ativa',
      status: offerData.status || deriveDataStatus(offerData),
      decision: offerData.decision || 'Observar',
      favorite: Boolean(offerData.favorite),
      watching: Boolean(offerData.watching),
      in_deep_dive: Boolean(offerData.in_deep_dive),
      dedupe_key: offerData.dedupe_key || '',
      source_file_name: offerData.source_file_name || '',
      sheet_name: offerData.sheet_name || 'Principal',
      row_number: offerData.row_number ?? null,
      raw_data: offerData.raw_data || null,
      extra_data: offerData.extra_data || null,
      source_import_batch_id: offerData.source_import_batch_id || null,
      source_import_row_id: offerData.source_import_row_id || null,
      first_seen_at: offerData.first_seen_at || now,
      last_seen_at: offerData.last_seen_at || now,
      first_imported_at: offerData.first_imported_at || now,
      last_imported_at: offerData.last_imported_at || now,
      created_at: offerData.created_at || now,
      updated_at: now,
      is_demo_data: false,
    };

    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));
    if (isSupabaseConfigured() && activeClient && !isLocalBackend()) {
      try {
        const { error: saveError } = await activeClient.from('offers').upsert(fullOffer);
        if (saveError) {
          console.warn('Supabase saveOffer warning (falling back to resilient store):', saveError.message);
        }
      } catch (err: any) {
        console.warn('Supabase saveOffer network/runtime fallback:', err.message);
      }
    }

    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    const existingIdx = offers.findIndex((o) => o.id === offerId);
    let updatedList: Offer[];
    if (existingIdx >= 0) {
      updatedList = [...offers];
      updatedList[existingIdx] = { ...offers[existingIdx], ...fullOffer };
    } else {
      updatedList = [fullOffer, ...offers];
    }
    setLocal(STORAGE_KEYS.OFFERS, updatedList);

    return fullOffer;
  },

  async updateOffer(id: string, updates: Partial<Offer>, client?: any): Promise<Offer | null> {
    const now = new Date().toISOString();
    const existing = await this.getOfferById(id);
    const merged = { ...existing, ...updates };
    const discScore = calculateDiscoveryScore(merged).total;
    const oppScore = calculateOpportunityScore(discScore, merged.momentum_score ?? null);
    const payload = {
      ...updates,
      discovery_score: discScore,
      system_score: oppScore ?? discScore,
      opportunity_score: oppScore,
      updated_at: now,
    };

    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));
    if (isSupabaseConfigured() && activeClient) {
      try {
        await activeClient.from('offers').update(payload).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateOffer error:', err);
      }
    }

    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    let updatedOffer: Offer | null = null;
    const updatedList = offers.map((o) => {
      if (o.id === id) {
        updatedOffer = { ...o, ...payload } as Offer;
        return updatedOffer;
      }
      return o;
    });
    setLocal(STORAGE_KEYS.OFFERS, updatedList);
    return updatedOffer;
  },

  async updateCreativeMetrics(offerId: string, metrics: CreativeMetricsUpdate): Promise<Offer | null> {
    const cleanPayload: Partial<Offer> = {
      captured_ads_count: metrics.captured_ads_count ?? undefined,
      captured_unique_creatives: metrics.captured_unique_creatives ?? undefined,
      unique_creatives_count: metrics.unique_creatives_count ?? undefined,
      captured_creatives_count: metrics.captured_creatives_count ?? undefined,
      captured_videos_count: metrics.captured_videos_count ?? undefined,
      captured_images_count: metrics.captured_images_count ?? undefined,
      stored_media_count: metrics.stored_media_count ?? undefined,
      oldest_ad_date: metrics.oldest_ad_date ?? undefined,
      days_running: metrics.days_running ?? undefined,
      last_creatives_capture_at: metrics.last_creatives_capture_at ?? new Date().toISOString(),
    };

    Object.keys(cleanPayload).forEach((key) => {
      if ((cleanPayload as any)[key] === undefined) {
        delete (cleanPayload as any)[key];
      }
    });

    return this.updateOffer(offerId, cleanPayload);
  },

  async updateActiveAdsCount(
    offerId: string,
    count: number,
    source: ActiveAdsSource,
    observedAt?: string
  ): Promise<Offer | null> {
    if ((source as string) === 'CREATIVE_SYNC') {
      throw new Error(
        'SECURITY/INTEGRITY VIOLATION: Creative Sync cannot update active_ads_count. Active Ads count requires an active ads observer source (META_ADS_LIBRARY, WORKER_IMPORT, MANUAL_VERIFIED, HISTORICAL_SNAPSHOT, XLSX_IMPORT).'
      );
    }

    const now = observedAt || new Date().toISOString();
    const existing = await this.getOfferById(offerId);

    await this.addSnapshot(offerId, count, existing?.price ?? null);

    const updated = await this.updateOffer(offerId, {
      active_ads_count: count,
      active_ads_count_source: source,
      active_ads_count_observed_at: now,
      last_seen_at: now,
    });

    return updated;
  },

  async updateOfferAnalysis(offerId: string, analysisData: Partial<OfferAnalysis>): Promise<OfferAnalysis> {
    const now = new Date().toISOString();
    const currentAnalyses = getLocal<OfferAnalysis[]>(STORAGE_KEYS.ANALYSIS, []);
    const existing = currentAnalyses.find((a) => a.offer_id === offerId);

    const updatedAnalysis: OfferAnalysis = {
      id: existing?.id || generateId(),
      offer_id: offerId,
      ...existing,
      ...analysisData,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_analysis').upsert(updatedAnalysis);
        if (analysisData.decision) {
          await supabase.from('offers').update({ decision: analysisData.decision, updated_at: now }).eq('id', offerId);
        }
      } catch (err) {
        console.warn('Supabase updateOfferAnalysis error:', err);
      }
    }

    if (analysisData.decision) {
      await this.updateOffer(offerId, { decision: analysisData.decision });
    }

    const filtered = currentAnalyses.filter((a) => a.offer_id !== offerId);
    setLocal(STORAGE_KEYS.ANALYSIS, [updatedAnalysis, ...filtered]);

    return updatedAnalysis;
  },

  async addCreative(offerId: string, creative: Partial<OfferCreative>): Promise<OfferCreative> {
    const newCreative: OfferCreative = {
      id: generateId(),
      offer_id: offerId,
      format: creative.format || 'Imagem',
      hook: creative.hook || '',
      angle: creative.angle || 'Quantidade',
      headline: creative.headline || '',
      ad_url: creative.ad_url || '',
      media_url: creative.media_url || '',
      thumbnail_url: creative.thumbnail_url || '',
      status: creative.status || 'Ativo',
      started_at: creative.started_at || new Date().toISOString().split('T')[0],
      notes: creative.notes || '',
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_creatives').insert(newCreative);
      } catch (err) {
        console.warn('Supabase addCreative error:', err);
      }
    }

    const creatives = getLocal<OfferCreative[]>(STORAGE_KEYS.CREATIVES, []);
    setLocal(STORAGE_KEYS.CREATIVES, [newCreative, ...creatives]);
    return newCreative;
  },

  async deleteCreative(creativeId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_creatives').delete().eq('id', creativeId);
      } catch (err) {
        console.warn('Supabase deleteCreative error:', err);
      }
    }
    const creatives = getLocal<OfferCreative[]>(STORAGE_KEYS.CREATIVES, []);
    setLocal(STORAGE_KEYS.CREATIVES, creatives.filter((c) => c.id !== creativeId));
  },

  async updateDeliverables(offerId: string, items: OfferDeliverable[]): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_deliverables').delete().eq('offer_id', offerId);
        if (items.length > 0) {
          await supabase.from('offer_deliverables').insert(
            items.map((it, idx) => ({ ...it, id: it.id || generateId(), offer_id: offerId, order_index: idx }))
          );
        }
      } catch (err) {
        console.warn('Supabase updateDeliverables error:', err);
      }
    }
    const all = getLocal<OfferDeliverable[]>(STORAGE_KEYS.DELIVERABLES, []);
    const filtered = all.filter((d) => d.offer_id !== offerId);
    setLocal(STORAGE_KEYS.DELIVERABLES, [...items, ...filtered]);
  },

  async updateBonuses(offerId: string, items: OfferBonus[]): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_bonuses').delete().eq('offer_id', offerId);
        if (items.length > 0) {
          await supabase.from('offer_bonuses').insert(
            items.map((it, idx) => ({ ...it, id: it.id || generateId(), offer_id: offerId, order_index: idx }))
          );
        }
      } catch (err) {
        console.warn('Supabase updateBonuses error:', err);
      }
    }
    const all = getLocal<OfferBonus[]>(STORAGE_KEYS.BONUSES, []);
    const filtered = all.filter((b) => b.offer_id !== offerId);
    setLocal(STORAGE_KEYS.BONUSES, [...items, ...filtered]);
  },

  async updateOrderBumps(offerId: string, items: OfferOrderBump[]): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_order_bumps').delete().eq('offer_id', offerId);
        if (items.length > 0) {
          await supabase.from('offer_order_bumps').insert(
            items.map((it) => ({ ...it, id: it.id || generateId(), offer_id: offerId }))
          );
        }
      } catch (err) {
        console.warn('Supabase updateOrderBumps error:', err);
      }
    }
    const all = getLocal<OfferOrderBump[]>(STORAGE_KEYS.ORDER_BUMPS, []);
    const filtered = all.filter((ob) => ob.offer_id !== offerId);
    setLocal(STORAGE_KEYS.ORDER_BUMPS, [...items, ...filtered]);
  },

  async updateUpsells(offerId: string, items: OfferUpsell[]): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_upsells').delete().eq('offer_id', offerId);
        if (items.length > 0) {
          await supabase.from('offer_upsells').insert(
            items.map((it) => ({ ...it, id: it.id || generateId(), offer_id: offerId }))
          );
        }
      } catch (err) {
        console.warn('Supabase updateUpsells error:', err);
      }
    }
    const all = getLocal<OfferUpsell[]>(STORAGE_KEYS.UPSELLS, []);
    const filtered = all.filter((u) => u.offer_id !== offerId);
    setLocal(STORAGE_KEYS.UPSELLS, [...items, ...filtered]);
  },

  async saveCheckoutCapture(record: any): Promise<any> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('checkout_captures').insert(record);
      } catch (err) {
        console.warn('Supabase saveCheckoutCapture error:', err);
      }
    }
    const all = getLocal<any[]>(STORAGE_KEYS.CHECKOUT_CAPTURES, []);
    setLocal(STORAGE_KEYS.CHECKOUT_CAPTURES, [record, ...all]);
    return record;
  },

  async saveFrontendOptions(
    offerId: string,
    options: OfferFrontendOption[]
  ): Promise<void> {
    const records: OfferFrontendOption[] = options.map((opt, i) => ({
      id: opt.id || generateId(),
      offer_id: offerId,
      landing_page_capture_id: opt.landing_page_capture_id || null,
      name: opt.name || `Opção ${i + 1}`,
      description: opt.description || '',
      current_price: opt.current_price,
      original_price: opt.original_price || null,
      currency: opt.currency || 'BRL',
      billing_type: opt.billing_type || 'one_time',
      billing_period: opt.billing_period || null,
      installments: opt.installments || null,
      installment_value: opt.installment_value || null,
      cta_text: opt.cta_text || null,
      cta_url: opt.cta_url || null,
      position_index: opt.position_index !== undefined ? opt.position_index : i + 1,
      is_featured: opt.is_featured || false,
      is_default: opt.is_default || i === 0,
      source: opt.source || 'LANDING_PAGE',
      source_section: opt.source_section || 'pricing',
      source_text: opt.source_text || null,
      created_at: opt.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_frontend_options').delete().eq('offer_id', offerId);
        if (records.length > 0) {
          await supabase.from('offer_frontend_options').insert(records);
        }
      } catch (err) {
        console.warn('Supabase saveFrontendOptions error:', err);
      }
    }

    const all = getLocal<OfferFrontendOption[]>(STORAGE_KEYS.FRONTEND_OPTIONS, []);
    const filtered = all.filter((o) => o.offer_id !== offerId);
    setLocal(STORAGE_KEYS.FRONTEND_OPTIONS, [...records, ...filtered]);
  },

  async getFrontendOptions(offerId: string): Promise<OfferFrontendOption[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('offer_frontend_options')
          .select('*')
          .eq('offer_id', offerId)
          .order('position_index', { ascending: true });
        if (!error && data) return data as OfferFrontendOption[];
      } catch (err) {
        console.warn('Supabase getFrontendOptions error:', err);
      }
    }

    const all = getLocal<OfferFrontendOption[]>(STORAGE_KEYS.FRONTEND_OPTIONS, []);
    return all
      .filter((o) => o.offer_id === offerId)
      .sort((a, b) => (a.position_index || 0) - (b.position_index || 0));
  },

  async getCheckoutCaptures(offerId: string, client?: any): Promise<any[]> {
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data } = await activeClient
          .from('checkout_captures')
          .select('*')
          .eq('offer_id', offerId)
          .order('captured_at', { ascending: false });
        if (data) return data;
      } catch (err) {
        console.warn('Supabase getCheckoutCaptures error:', err);
      }
    }
    if (isLocalBackend()) {
      const all = getLocal<any[]>(STORAGE_KEYS.CHECKOUT_CAPTURES, []);
      return all.filter((c) => c.offer_id === offerId).sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
    }
    return [];
  },

  async addSnapshot(offerId: string, activeAdsCount: number, price?: number | null): Promise<OfferSnapshot> {
    const now = new Date().toISOString();
    const newSnapshot: OfferSnapshot = {
      id: generateId(),
      offer_id: offerId,
      active_ads_count: activeAdsCount,
      days_running: null,
      oldest_ad_date: null,
      price: price ?? null,
      captured_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_snapshots').insert(newSnapshot);
      } catch (err) {
        console.warn('Supabase addSnapshot error:', err);
      }
    }

    const snapshots = getLocal<OfferSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
    setLocal(STORAGE_KEYS.SNAPSHOTS, [newSnapshot, ...snapshots]);

    // Recalculate momentum & trend on offer
    const offer = await this.getOfferById(offerId);
    if (offer) {
      const allSnaps = [newSnapshot, ...(offer.snapshots || [])];
      const momentumInfo = calculateMomentumScore(activeAdsCount, allSnaps);
      await this.updateOffer(offerId, {
        active_ads_count: activeAdsCount,
        momentum_score: momentumInfo.momentumScore,
        trend: momentumInfo.trend,
        last_seen_at: now,
        last_imported_at: now,
      });
    }

    return newSnapshot;
  },

  async deleteOffer(id: string): Promise<boolean> {
    return this.deleteOffersBulk([id]);
  },

  async deleteOffersBulk(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        // 1. Unlink offer references in import_rows so raw import history is never lost
        await supabase.from('import_rows').update({ offer_id: null }).in('offer_id', ids);

        // 2. Cascade delete related dependent tables
        await supabase.from('deep_dives').delete().in('offer_id', ids);
        await supabase.from('offer_analysis').delete().in('offer_id', ids);
        await supabase.from('offer_snapshots').delete().in('offer_id', ids);
        await supabase.from('offer_creatives').delete().in('offer_id', ids);
        await supabase.from('offer_deliverables').delete().in('offer_id', ids);
        await supabase.from('offer_bonuses').delete().in('offer_id', ids);
        await supabase.from('offer_order_bumps').delete().in('offer_id', ids);
        await supabase.from('offer_upsells').delete().in('offer_id', ids);
        await supabase.from('offer_funnel_steps').delete().in('offer_id', ids);

        // 3. Delete primary offers records
        const { error } = await supabase.from('offers').delete().in('id', ids);
        if (error) {
          console.error('Supabase deleteOffersBulk error:', error);
          throw error;
        }
      } catch (err) {
        console.error('Supabase deleteOffersBulk error:', err);
        throw err;
      }
    }

    // Local Storage Cleanup
    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(STORAGE_KEYS.OFFERS, offers.filter((o) => !ids.includes(o.id)));

    const snapshots = getLocal<OfferSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
    setLocal(STORAGE_KEYS.SNAPSHOTS, snapshots.filter((s) => !ids.includes(s.offer_id)));

    const creatives = getLocal<OfferCreative[]>(STORAGE_KEYS.CREATIVES, []);
    setLocal(STORAGE_KEYS.CREATIVES, creatives.filter((c) => !ids.includes(c.offer_id)));

    const deliverables = getLocal<OfferDeliverable[]>(STORAGE_KEYS.DELIVERABLES, []);
    setLocal(STORAGE_KEYS.DELIVERABLES, deliverables.filter((d) => !ids.includes(d.offer_id)));

    const bonuses = getLocal<OfferBonus[]>(STORAGE_KEYS.BONUSES, []);
    setLocal(STORAGE_KEYS.BONUSES, bonuses.filter((b) => !ids.includes(b.offer_id)));

    const orderBumps = getLocal<OfferOrderBump[]>(STORAGE_KEYS.ORDER_BUMPS, []);
    setLocal(STORAGE_KEYS.ORDER_BUMPS, orderBumps.filter((ob) => !ids.includes(ob.offer_id)));

    const upsells = getLocal<OfferUpsell[]>(STORAGE_KEYS.UPSELLS, []);
    setLocal(STORAGE_KEYS.UPSELLS, upsells.filter((u) => !ids.includes(u.offer_id)));

    const funnels = getLocal<OfferFunnelStep[]>(STORAGE_KEYS.FUNNEL_STEPS, []);
    setLocal(STORAGE_KEYS.FUNNEL_STEPS, funnels.filter((f) => !ids.includes(f.offer_id)));

    const analyses = getLocal<OfferAnalysis[]>(STORAGE_KEYS.ANALYSIS, []);
    setLocal(STORAGE_KEYS.ANALYSIS, analyses.filter((a) => !ids.includes(a.offer_id)));

    const deepDives = getLocal<DeepDive[]>(STORAGE_KEYS.DEEP_DIVES, []);
    setLocal(STORAGE_KEYS.DEEP_DIVES, deepDives.filter((d) => !ids.includes(d.offer_id)));

    const importRows = getLocal<ImportRow[]>(STORAGE_KEYS.IMPORT_ROWS, []);
    setLocal(
      STORAGE_KEYS.IMPORT_ROWS,
      importRows.map((r) => (r.offer_id && ids.includes(r.offer_id) ? { ...r, offer_id: null } : r))
    );

    return true;
  },

  async archiveOffer(id: string): Promise<boolean> {
    return this.bulkArchiveOffers([id]);
  },

  async unarchiveOffer(id: string): Promise<boolean> {
    return this.bulkUnarchiveOffers([id]);
  },

  async bulkArchiveOffers(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('offers').update({
          archived: true,
          archived_at: now,
          archived_by_user: true,
          status: 'ARQUIVADA',
          updated_at: now,
        }).in('id', ids);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase bulkArchiveOffers error:', err);
      }
    }

    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(
      STORAGE_KEYS.OFFERS,
      offers.map((o) =>
        ids.includes(o.id)
          ? {
              ...o,
              archived: true,
              archived_at: now,
              archived_by_user: true,
              status: 'ARQUIVADA',
              updated_at: now,
            }
          : o
      )
    );
    return true;
  },

  async bulkUnarchiveOffers(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('offers').update({
          archived: false,
          archived_at: null,
          archived_by_user: false,
          updated_at: now,
        }).in('id', ids);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase bulkUnarchiveOffers error:', err);
      }
    }

    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(
      STORAGE_KEYS.OFFERS,
      offers.map((o) =>
        ids.includes(o.id)
          ? {
              ...o,
              archived: false,
              archived_at: null,
              archived_by_user: false,
              status: o.status === 'ARQUIVADA' ? deriveDataStatus(o) : o.status,
              updated_at: now,
            }
          : o
      )
    );
    return true;
  },

  async bulkUpdateStatus(ids: string[], status: OfferStatus): Promise<boolean> {
    if (ids.length === 0) return true;
    if (status === 'ARQUIVADA') {
      return this.bulkArchiveOffers(ids);
    }
    const now = new Date().toISOString();
    const isWatching = status === 'ACOMPANHANDO';

    if (isSupabaseConfigured() && supabase) {
      try {
        const updatePayload: Record<string, any> = { status, updated_at: now };
        if (isWatching) {
          updatePayload.watching = true;
        }
        const { error } = await supabase.from('offers').update(updatePayload).in('id', ids);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase bulkUpdateStatus error:', err);
        throw err;
      }
    }

    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(
      STORAGE_KEYS.OFFERS,
      offers.map((o) =>
        ids.includes(o.id)
          ? {
              ...o,
              status,
              ...(isWatching ? { watching: true } : {}),
              updated_at: now,
            }
          : o
      )
    );
    return true;
  },

  async bulkToggleFavorite(ids: string[], favorite: boolean): Promise<boolean> {
    if (ids.length === 0) return true;
    const now = new Date().toISOString();
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('offers').update({ favorite, updated_at: now }).in('id', ids);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase bulkToggleFavorite error:', err);
        throw err;
      }
    }
    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(STORAGE_KEYS.OFFERS, offers.map((o) => (ids.includes(o.id) ? { ...o, favorite, updated_at: now } : o)));
    return true;
  },

  async bulkToggleWatchlist(ids: string[], watching: boolean): Promise<boolean> {
    if (ids.length === 0) return true;
    const now = new Date().toISOString();
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('offers').update({ watching, updated_at: now }).in('id', ids);
        if (error) throw error;
      } catch (err) {
        console.error('Supabase bulkToggleWatchlist error:', err);
        throw err;
      }
    }
    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(STORAGE_KEYS.OFFERS, offers.map((o) => (ids.includes(o.id) ? { ...o, watching, updated_at: now } : o)));
    return true;
  },

  async bulkToggleDeepDive(ids: string[], inDeepDive: boolean): Promise<boolean> {
    if (ids.length === 0) return true;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        const userId = user?.user?.id || null;

        // 1. Update in_deep_dive flag on offers table
        const { error } = await supabase
          .from('offers')
          .update({ in_deep_dive: inDeepDive, updated_at: now })
          .in('id', ids);
        if (error) throw error;

        // 2. Insert or remove records from deep_dives table
        if (inDeepDive) {
          const deepDiveInserts = ids.map((id) => ({
            id: generateId(),
            offer_id: id,
            user_id: userId,
            status: 'Fila',
            priority: 'Media',
            created_at: now,
            updated_at: now,
          }));
          await supabase.from('deep_dives').upsert(deepDiveInserts, { onConflict: 'offer_id' });
        } else {
          await supabase.from('deep_dives').delete().in('offer_id', ids);
        }
      } catch (err) {
        console.error('Supabase bulkToggleDeepDive error:', err);
        throw err;
      }
    }

    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    setLocal(
      STORAGE_KEYS.OFFERS,
      offers.map((o) => (ids.includes(o.id) ? { ...o, in_deep_dive: inDeepDive, updated_at: now } : o))
    );

    const deepDives = getLocal<DeepDive[]>(STORAGE_KEYS.DEEP_DIVES, []);
    if (inDeepDive) {
      const existingOfferIds = new Set(deepDives.map((d) => d.offer_id));
      const newItems: DeepDive[] = ids
        .filter((id) => !existingOfferIds.has(id))
        .map((id) => ({
          id: generateId(),
          offer_id: id,
          status: 'Fila',
          priority: 'Media',
          created_at: now,
          updated_at: now,
        }));
      setLocal(STORAGE_KEYS.DEEP_DIVES, [...newItems, ...deepDives]);
    } else {
      setLocal(STORAGE_KEYS.DEEP_DIVES, deepDives.filter((d) => !ids.includes(d.offer_id)));
    }

    return true;
  },

  // --------------------------------------------------------------------------
  // BATCHES, IMPORT ROWS, DEEP DIVES & SAVED VIEWS
  // --------------------------------------------------------------------------
  async getBatches(): Promise<ImportBatch[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false });
        if (!error && data) return data as ImportBatch[];
      } catch (err) {
        console.warn('Supabase getBatches error:', err);
      }
    }
    return getLocal<ImportBatch[]>(STORAGE_KEYS.BATCHES, []);
  },

  async getImportRows(batchId?: string): Promise<ImportRow[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const query = supabase.from('import_rows').select('*').order('row_number', { ascending: true });
        if (batchId) query.eq('import_batch_id', batchId);
        const { data, error } = await query;
        if (!error && data) return data as ImportRow[];
      } catch (err) {
        console.warn('Supabase getImportRows error:', err);
      }
    }
    const all = getLocal<ImportRow[]>(STORAGE_KEYS.IMPORT_ROWS, []);
    return batchId ? all.filter((r) => r.import_batch_id === batchId) : all;
  },

  async getDeepDives(client?: any): Promise<DeepDive[]> {
    const offers = await this.getOffers(undefined, client);
    let deepDives: DeepDive[] = [];
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data, error } = await activeClient.from('deep_dives').select('*').order('created_at', { ascending: false });
        if (!error && data) deepDives = data as DeepDive[];
      } catch (err) {
        console.warn('Supabase getDeepDives error:', err);
      }
    }

    if (deepDives.length === 0 && isLocalBackend()) {
      deepDives = getLocal<DeepDive[]>(STORAGE_KEYS.DEEP_DIVES, []);
    }

    const existingOfferIds = new Set(deepDives.map((d) => d.offer_id));
    const extraDeepDives: DeepDive[] = [];

    offers.forEach((o) => {
      if (o.in_deep_dive && !existingOfferIds.has(o.id)) {
        extraDeepDives.push({
          id: `dd_${o.id}`,
          offer_id: o.id,
          status: 'BACKLOG',
          priority: 'MEDIA',
          created_at: o.created_at,
          updated_at: o.updated_at,
        });
      }
    });

    const combined = [...deepDives, ...extraDeepDives];

    // Normalize statuses for backwards compatibility
    const normalized = combined.map((dd) => {
      const offer = offers.find((o) => o.id === dd.offer_id);
      let status = dd.status;
      if (['Fila', 'Pesquisando', 'Analisando', 'Pronta', 'Modelar', 'Descartada'].includes(dd.status as string)) {
        if (dd.status === 'Fila') status = 'BACKLOG';
        else if (dd.status === 'Pesquisando' || dd.status === 'Analisando') status = 'EM_ANALISE';
        else if (dd.status === 'Pronta') status = 'SINTETIZANDO';
        else if (dd.status === 'Modelar') status = 'CONCLUIDO';
        else if (dd.status === 'Descartada') status = 'ARQUIVADO';
      }

      // Compute checklist progress
      const checklist = dd.checklist || {};
      const keys = Object.keys(checklist);
      const progress = keys.length > 0
        ? Math.round((keys.filter((k) => checklist[k] === true).length / keys.length) * 100)
        : 0;

      return {
        ...dd,
        status,
        offer,
        investigation_progress: progress,
      };
    });

    return normalized;
  },

  async getDeepDiveById(id: string): Promise<DeepDive | null> {
    const all = await this.getDeepDives();
    const match = all.find((d) => d.id === id || d.offer_id === id);
    if (!match) return null;

    // Fetch related insights, hypotheses, tests
    const insights = await this.getDeepDiveInsights(match.id);
    const hypotheses = await this.getDeepDiveHypotheses(match.id);
    const tests = await this.getDeepDiveTests(match.id);

    return {
      ...match,
      insights,
      hypotheses,
      tests,
    };
  },

  async createDeepDive(offerId: string, priority: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'MEDIA'): Promise<DeepDive> {
    const now = new Date().toISOString();
    const offers = await this.getOffers();
    const offer = offers.find((o) => o.id === offerId);

    const startSnapshot = offer
      ? {
          active_ads_count: offer.active_ads_count ?? null,
          days_running: offer.days_running ?? null,
          price: offer.price ?? null,
          creatives_count: offer.estimated_unique_creatives ?? offer.captured_creatives_count ?? null,
          captured_at: now,
        }
      : null;

    const newDeepDive: DeepDive = {
      id: generateId(),
      offer_id: offerId,
      offer,
      status: 'BACKLOG',
      priority,
      tags: [],
      start_snapshot: startSnapshot,
      notes: {},
      creative_tags: {},
      lp_section_notes: [],
      offer_observations: {},
      checkout_analysis: {},
      checklist: {
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
      },
      investigation_progress: 0,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        await supabase.from('offers').update({ in_deep_dive: true, updated_at: now }).eq('id', offerId);
        await supabase.from('deep_dives').insert({
          ...newDeepDive,
          user_id: user?.user?.id || null,
        });
      } catch (err) {
        console.warn('Supabase createDeepDive error:', err);
      }
    }

    // Local Storage update
    await this.updateOffer(offerId, { in_deep_dive: true });
    const localDives = getLocal<DeepDive[]>(STORAGE_KEYS.DEEP_DIVES, []);
    setLocal(STORAGE_KEYS.DEEP_DIVES, [newDeepDive, ...localDives.filter((d) => d.offer_id !== offerId)]);

    return newDeepDive;
  },

  async updateDeepDive(id: string, updates: Partial<DeepDive>): Promise<DeepDive> {
    const now = new Date().toISOString();
    const deepDives = getLocal<DeepDive[]>(STORAGE_KEYS.DEEP_DIVES, []);
    const existing = deepDives.find((d) => d.id === id || d.offer_id === id);
    const offerId = existing?.offer_id || updates.offer_id || id;

    // If status changed to CONCLUIDO and end_snapshot is missing, capture end_snapshot
    let endSnapshot = updates.end_snapshot || existing?.end_snapshot;
    let completedAt = updates.completed_at || existing?.completed_at;
    let startedAt = updates.started_at || existing?.started_at;

    if (updates.status === 'EM_ANALISE' && !startedAt) {
      startedAt = now;
    }

    if (updates.status === 'CONCLUIDO' && !endSnapshot) {
      completedAt = now;
      const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
      const offer = offers.find((o) => o.id === offerId);
      if (offer) {
        endSnapshot = {
          active_ads_count: offer.active_ads_count ?? null,
          days_running: offer.days_running ?? null,
          price: offer.price ?? null,
          creatives_count: offer.estimated_unique_creatives ?? offer.captured_creatives_count ?? null,
          captured_at: now,
        };
      }
    }

    const payload: Partial<DeepDive> = {
      ...updates,
      end_snapshot: endSnapshot,
      started_at: startedAt,
      completed_at: completedAt,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('deep_dives').update(payload).eq('id', existing?.id || id);
      } catch (err) {
        console.warn('Supabase updateDeepDive error:', err);
      }
    }

    const updatedList = deepDives.map((d) =>
      d.id === id || d.offer_id === id ? ({ ...d, ...payload } as DeepDive) : d
    );
    setLocal(STORAGE_KEYS.DEEP_DIVES, updatedList);

    const match = updatedList.find((d) => d.id === id || d.offer_id === id);
    return match || ({ id, ...payload } as DeepDive);
  },

  async deleteDeepDive(id: string): Promise<boolean> {
    const deepDives = getLocal<DeepDive[]>(STORAGE_KEYS.DEEP_DIVES, []);
    const match = deepDives.find((d) => d.id === id || d.offer_id === id);
    const offerId = match?.offer_id || id;

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offers').update({ in_deep_dive: false }).eq('id', offerId);
        await supabase.from('deep_dives').delete().eq('id', match?.id || id);
      } catch (err) {
        console.warn('Supabase deleteDeepDive error:', err);
      }
    }

    await this.updateOffer(offerId, { in_deep_dive: false });
    setLocal(
      STORAGE_KEYS.DEEP_DIVES,
      deepDives.filter((d) => d.id !== id && d.offer_id !== id)
    );
    return true;
  },

  // Deep Dive Sub-entities (Insights, Hypotheses, Tests, Patterns)
  async getDeepDiveInsights(deepDiveId?: string): Promise<DeepDiveInsight[]> {
    const insights = getLocal<DeepDiveInsight[]>(STORAGE_KEYS.INSIGHTS, []);
    if (!deepDiveId) return insights;
    return insights.filter((i) => i.deep_dive_id === deepDiveId || i.offer_id === deepDiveId);
  },

  async createDeepDiveInsight(insight: Partial<DeepDiveInsight>): Promise<DeepDiveInsight> {
    const now = new Date().toISOString();
    const newInsight: DeepDiveInsight = {
      id: insight.id || generateId(),
      deep_dive_id: insight.deep_dive_id || '',
      offer_id: insight.offer_id || '',
      offer_name: insight.offer_name || 'Oferta',
      title: insight.title || 'Novo Insight',
      description: insight.description || '',
      category: insight.category || 'Oferta',
      tags: insight.tags || [],
      applicability: insight.applicability || '',
      created_at: now,
    };

    const current = getLocal<DeepDiveInsight[]>(STORAGE_KEYS.INSIGHTS, []);
    setLocal(STORAGE_KEYS.INSIGHTS, [newInsight, ...current]);
    return newInsight;
  },

  async deleteDeepDiveInsight(id: string): Promise<boolean> {
    const current = getLocal<DeepDiveInsight[]>(STORAGE_KEYS.INSIGHTS, []);
    setLocal(STORAGE_KEYS.INSIGHTS, current.filter((i) => i.id !== id));
    return true;
  },

  async getDeepDiveHypotheses(deepDiveId?: string): Promise<DeepDiveHypothesis[]> {
    const hypotheses = getLocal<DeepDiveHypothesis[]>(STORAGE_KEYS.HYPOTHESES, []);
    if (!deepDiveId) return hypotheses;
    return hypotheses.filter((h) => h.deep_dive_id === deepDiveId);
  },

  async createDeepDiveHypothesis(hypothesis: Partial<DeepDiveHypothesis>): Promise<DeepDiveHypothesis> {
    const now = new Date().toISOString();
    const item: DeepDiveHypothesis = {
      id: hypothesis.id || generateId(),
      deep_dive_id: hypothesis.deep_dive_id || '',
      title: hypothesis.title || 'Nova Hipótese',
      description: hypothesis.description || '',
      status: hypothesis.status || 'ABERTA',
      evidence: hypothesis.evidence || [],
      created_at: now,
    };
    const current = getLocal<DeepDiveHypothesis[]>(STORAGE_KEYS.HYPOTHESES, []);
    setLocal(STORAGE_KEYS.HYPOTHESES, [item, ...current]);
    return item;
  },

  async updateDeepDiveHypothesis(id: string, updates: Partial<DeepDiveHypothesis>): Promise<DeepDiveHypothesis> {
    const current = getLocal<DeepDiveHypothesis[]>(STORAGE_KEYS.HYPOTHESES, []);
    let updated: DeepDiveHypothesis | null = null;
    const next = current.map((h) => {
      if (h.id === id) {
        updated = { ...h, ...updates };
        return updated;
      }
      return h;
    });
    setLocal(STORAGE_KEYS.HYPOTHESES, next);
    return updated || ({ id, ...updates } as DeepDiveHypothesis);
  },

  async deleteDeepDiveHypothesis(id: string): Promise<boolean> {
    const current = getLocal<DeepDiveHypothesis[]>(STORAGE_KEYS.HYPOTHESES, []);
    setLocal(STORAGE_KEYS.HYPOTHESES, current.filter((h) => h.id !== id));
    return true;
  },

  async getDeepDiveTests(deepDiveId?: string): Promise<DeepDiveTest[]> {
    const tests = getLocal<DeepDiveTest[]>(STORAGE_KEYS.TESTS, []);
    if (!deepDiveId) return tests;
    return tests.filter((t) => t.deep_dive_id === deepDiveId);
  },

  async createDeepDiveTest(test: Partial<DeepDiveTest>): Promise<DeepDiveTest> {
    const now = new Date().toISOString();
    const item: DeepDiveTest = {
      id: test.id || generateId(),
      deep_dive_id: test.deep_dive_id || '',
      title: test.title || 'Nova Ideia de Teste',
      description: test.description || '',
      status: test.status || 'IDEIA',
      created_at: now,
    };
    const current = getLocal<DeepDiveTest[]>(STORAGE_KEYS.TESTS, []);
    setLocal(STORAGE_KEYS.TESTS, [item, ...current]);
    return item;
  },

  async updateDeepDiveTest(id: string, updates: Partial<DeepDiveTest>): Promise<DeepDiveTest> {
    const current = getLocal<DeepDiveTest[]>(STORAGE_KEYS.TESTS, []);
    let updated: DeepDiveTest | null = null;
    const next = current.map((t) => {
      if (t.id === id) {
        updated = { ...t, ...updates };
        return updated;
      }
      return t;
    });
    setLocal(STORAGE_KEYS.TESTS, next);
    return updated || ({ id, ...updates } as DeepDiveTest);
  },

  async deleteDeepDiveTest(id: string): Promise<boolean> {
    const current = getLocal<DeepDiveTest[]>(STORAGE_KEYS.TESTS, []);
    setLocal(STORAGE_KEYS.TESTS, current.filter((t) => t.id !== id));
    return true;
  },

  async getResearchPatterns(): Promise<ResearchPattern[]> {
    return getLocal<ResearchPattern[]>(STORAGE_KEYS.PATTERNS, []);
  },

  async saveResearchPattern(pattern: Partial<ResearchPattern>): Promise<ResearchPattern> {
    const now = new Date().toISOString();
    const current = getLocal<ResearchPattern[]>(STORAGE_KEYS.PATTERNS, []);
    const existingIdx = current.findIndex((p) => p.id === pattern.id);

    const item: ResearchPattern = {
      id: pattern.id || generateId(),
      title: pattern.title || 'Novo Padrão',
      description: pattern.description || '',
      category: pattern.category || 'Geral',
      tags: pattern.tags || [],
      deep_dive_ids: pattern.deep_dive_ids || [],
      created_at: pattern.created_at || now,
    };

    if (existingIdx >= 0) {
      current[existingIdx] = item;
      setLocal(STORAGE_KEYS.PATTERNS, [...current]);
    } else {
      setLocal(STORAGE_KEYS.PATTERNS, [item, ...current]);
    }

    return item;
  },

  async deleteResearchPattern(id: string): Promise<boolean> {
    const current = getLocal<ResearchPattern[]>(STORAGE_KEYS.PATTERNS, []);
    setLocal(STORAGE_KEYS.PATTERNS, current.filter((p) => p.id !== id));
    return true;
  },

  async getSavedViews(): Promise<SavedView[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('saved_views').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as SavedView[];
      } catch (err) {
        console.warn('Supabase getSavedViews error:', err);
      }
    }
    return getLocal<SavedView[]>(STORAGE_KEYS.SAVED_VIEWS, [
      { id: 'view_1', name: '🔥 Top Oportunidades', filters: { quickFilter: 'opportunities' }, created_at: new Date().toISOString() },
      { id: 'view_2', name: '📈 Em Escalação (Ads 20+)', filters: { minAds: 20, trend: 'CRESCENDO' }, created_at: new Date().toISOString() },
      { id: 'view_3', name: '💰 Ticket R$ 20–30', filters: { priceRange: '20-30', minPrice: 20, maxPrice: 30 }, created_at: new Date().toISOString() },
    ]);
  },

  async saveView(name: string, filters: Partial<OfferFiltersState>): Promise<SavedView> {
    const newView: SavedView = {
      id: generateId(),
      name,
      filters,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('saved_views').insert({
          id: newView.id,
          name: newView.name,
          filters_json: newView.filters,
        });
      } catch (err) {
        console.warn('Supabase saveView error:', err);
      }
    }

    const current = await this.getSavedViews();
    setLocal(STORAGE_KEYS.SAVED_VIEWS, [newView, ...current]);
    return newView;
  },

  async deleteSavedView(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('saved_views').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteSavedView error:', err);
      }
    }
    const current = await this.getSavedViews();
    setLocal(STORAGE_KEYS.SAVED_VIEWS, current.filter((v) => v.id !== id));
  },

  // --------------------------------------------------------------------------
  // CREATIVE CAPTURE JOBS & MEDIA STORAGE
  // --------------------------------------------------------------------------
  async createCaptureJob(offerId: string, sourceUrl: string, userId?: string | null): Promise<CreativeCaptureJob> {
    const now = new Date().toISOString();
    const newJob: CreativeCaptureJob = {
      id: generateId(),
      user_id: userId || null,
      offer_id: offerId,
      status: 'queued',
      source_url: sourceUrl,
      started_at: null,
      finished_at: null,
      progress: 0,
      ads_detected: 0,
      ads_processed: 0,
      videos_detected: 0,
      images_detected: 0,
      new_creatives: 0,
      existing_creatives: 0,
      failed_creatives: 0,
      error_code: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('creative_capture_jobs').insert(newJob);
        if (error) console.warn('Supabase createCaptureJob error:', error);
      } catch (err) {
        console.warn('Supabase createCaptureJob error:', err);
      }
    }

    const currentJobs = getLocal<CreativeCaptureJob[]>(STORAGE_KEYS.CAPTURE_JOBS, []);
    setLocal(STORAGE_KEYS.CAPTURE_JOBS, [newJob, ...currentJobs]);
    return newJob;
  },

  async getCaptureJob(id: string): Promise<CreativeCaptureJob | null> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('creative_capture_jobs').select('*').eq('id', id).maybeSingle();
        if (!error && data) return data as CreativeCaptureJob;
      } catch (err) {
        console.warn('Supabase getCaptureJob error:', err);
      }
    }
    const currentJobs = getLocal<CreativeCaptureJob[]>(STORAGE_KEYS.CAPTURE_JOBS, []);
    return currentJobs.find((j) => j.id === id) || null;
  },

  async getActiveCaptureJob(offerId: string): Promise<CreativeCaptureJob | null> {
    const activeStatuses: CaptureJobStatus[] = [
      'queued',
      'starting_browser',
      'opening_url',
      'waiting_dom',
      'checking_access',
      'page_loaded',
      'handling_consent',
      'scrolling_results',
      'discovering_ad_cards',
      'extracting_ad_ids',
      'detecting_media',
      'downloading_media',
      'uploading_storage',
    ];

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('creative_capture_jobs')
          .select('*')
          .eq('offer_id', offerId)
          .in('status', activeStatuses)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) return data as CreativeCaptureJob;
      } catch (err) {
        console.warn('Supabase getActiveCaptureJob error:', err);
      }
    }

    const currentJobs = getLocal<CreativeCaptureJob[]>(STORAGE_KEYS.CAPTURE_JOBS, []);
    return currentJobs.find((j) => j.offer_id === offerId && activeStatuses.includes(j.status)) || null;
  },

  async getCaptureJobsByOffer(offerId: string): Promise<CreativeCaptureJob[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('creative_capture_jobs')
          .select('*')
          .eq('offer_id', offerId)
          .order('created_at', { ascending: false });

        if (!error && data) return data as CreativeCaptureJob[];
      } catch (err) {
        console.warn('Supabase getCaptureJobsByOffer error:', err);
      }
    }
    const currentJobs = getLocal<CreativeCaptureJob[]>(STORAGE_KEYS.CAPTURE_JOBS, []);
    return currentJobs.filter((j) => j.offer_id === offerId);
  },

  async updateCaptureJob(id: string, updates: Partial<CreativeCaptureJob>): Promise<CreativeCaptureJob | null> {
    const now = new Date().toISOString();
    const payload = { ...updates, updated_at: now };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('creative_capture_jobs').update(payload).eq('id', id);
        if (error) console.warn('Supabase updateCaptureJob error:', error);
      } catch (err) {
        console.warn('Supabase updateCaptureJob error:', err);
      }
    }

    const currentJobs = getLocal<CreativeCaptureJob[]>(STORAGE_KEYS.CAPTURE_JOBS, []);
    let updatedJob: CreativeCaptureJob | null = null;
    const updatedList = currentJobs.map((j) => {
      if (j.id === id) {
        updatedJob = { ...j, ...payload } as CreativeCaptureJob;
        return updatedJob;
      }
      return j;
    });
    setLocal(STORAGE_KEYS.CAPTURE_JOBS, updatedList);
    return updatedJob;
  },

  async cancelCaptureJob(id: string): Promise<boolean> {
    const res = await this.updateCaptureJob(id, {
      status: 'cancelled',
      finished_at: new Date().toISOString(),
      error_message: 'Captura cancelada pelo usuário.',
    });
    return !!res;
  },

  async claimNextQueuedJob(): Promise<CreativeCaptureJob | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        // Atomic claim pattern
        const { data, error } = await supabase
          .from('creative_capture_jobs')
          .select('*')
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          const { data: updated, error: updateErr } = await supabase
            .from('creative_capture_jobs')
            .update({ status: 'starting_browser', started_at: now, updated_at: now })
            .eq('id', data.id)
            .eq('status', 'queued')
            .select()
            .maybeSingle();

          if (updated && !updateErr) {
            return updated as CreativeCaptureJob;
          }
        }
      } catch (err) {
        console.warn('Supabase claimNextQueuedJob error:', err);
      }
    }

    const currentJobs = getLocal<CreativeCaptureJob[]>(STORAGE_KEYS.CAPTURE_JOBS, []);
    const queuedJob = currentJobs.find((j) => j.status === 'queued');
    if (queuedJob) {
      const updated = {
        ...queuedJob,
        status: 'starting_browser' as CaptureJobStatus,
        started_at: now,
        updated_at: now,
      };
      setLocal(
        STORAGE_KEYS.CAPTURE_JOBS,
        currentJobs.map((j) => (j.id === queuedJob.id ? updated : j))
      );
      return updated;
    }
    return null;
  },

  // --------------------------------------------------------------------------
  // OFFER ADS & MEDIA (SEPARATE ADS VS MEDIA ENTITIES)
  // --------------------------------------------------------------------------
  async getOfferAds(offerId: string, client?: any): Promise<OfferAdWithMedia[]> {
    let ads: OfferAd[] = [];
    let mediaList: OfferAdMedia[] = [];
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data: adsData } = await activeClient
          .from('offer_ads')
          .select('*')
          .eq('offer_id', offerId)
          .order('started_at', { ascending: false });

        const { data: mediaData } = await activeClient
          .from('offer_ad_media')
          .select('*')
          .eq('offer_id', offerId);

        if (adsData) ads = adsData as OfferAd[];
        if (mediaData) mediaList = mediaData as OfferAdMedia[];
      } catch (err) {
        console.warn('Supabase getOfferAds error:', err);
      }
    }

    if (ads.length === 0 && isLocalBackend()) {
      const allAds = getLocal<OfferAd[]>(STORAGE_KEYS.ADS, []);
      ads = allAds.filter((a) => a.offer_id === offerId);
      const allMedia = getLocal<OfferAdMedia[]>(STORAGE_KEYS.AD_MEDIA, []);
      mediaList = allMedia.filter((m) => m.offer_id === offerId);
    }

    // Hash occurrence map for duplicate creative identification
    const hashCounts = new Map<string, number>();
    for (const m of mediaList) {
      if (m.file_hash) {
        hashCounts.set(m.file_hash, (hashCounts.get(m.file_hash) || 0) + 1);
      }
    }

    // Join ads with their media
    return ads.map((ad) => {
      const adMedia = mediaList.filter((m) => m.offer_ad_id === ad.id);
      const primaryHash = adMedia[0]?.file_hash;
      const count = primaryHash ? hashCounts.get(primaryHash) || 1 : 1;

      return {
        ...ad,
        media: adMedia,
        isDuplicateCreative: count > 1,
        duplicateCount: count,
      };
    });
  },

  async saveOfferAd(ad: Partial<OfferAd>): Promise<OfferAd> {
    const now = new Date().toISOString();
    const allAds = getLocal<OfferAd[]>(STORAGE_KEYS.ADS, []);

    // Check if ad with same offer_id + meta_ad_id exists
    let existing = allAds.find(
      (a) => a.id === ad.id || (a.offer_id === ad.offer_id && a.meta_ad_id === ad.meta_ad_id)
    );

    const record: OfferAd = {
      id: existing?.id || ad.id || generateId(),
      user_id: ad.user_id || existing?.user_id || null,
      offer_id: ad.offer_id!,
      meta_ad_id: ad.meta_ad_id || existing?.meta_ad_id || '',
      meta_ad_url: ad.meta_ad_url || existing?.meta_ad_url || null,
      advertiser: ad.advertiser || existing?.advertiser || null,
      status: ad.status || existing?.status || 'Ativo',
      ad_status: ad.ad_status || existing?.ad_status || ad.status || 'Ativo',
      started_at: ad.started_at || existing?.started_at || null,
      primary_text: ad.primary_text ?? existing?.primary_text ?? null,
      headline: ad.headline ?? existing?.headline ?? null,
      description: ad.description ?? existing?.description ?? null,
      cta: ad.cta ?? existing?.cta ?? null,
      destination_url: ad.destination_url ?? existing?.destination_url ?? null,
      card_screenshot_path: ad.card_screenshot_path || existing?.card_screenshot_path || null,
      card_screenshot_url: ad.card_screenshot_url || existing?.card_screenshot_url || null,
      capture_status: ad.capture_status || existing?.capture_status || 'detected',
      first_seen_at: existing?.first_seen_at || now,
      last_seen_at: now,
      raw_data: ad.raw_data || existing?.raw_data || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_ads').upsert(record);
      } catch (err) {
        console.warn('Supabase saveOfferAd error:', err);
      }
    }

    const filtered = allAds.filter((a) => a.id !== record.id);
    setLocal(STORAGE_KEYS.ADS, [record, ...filtered]);

    return record;
  },

  async saveOfferAdMedia(media: Partial<OfferAdMedia>): Promise<OfferAdMedia> {
    const now = new Date().toISOString();
    const allMedia = getLocal<OfferAdMedia[]>(STORAGE_KEYS.AD_MEDIA, []);

    let existing = allMedia.find(
      (m) =>
        m.id === media.id ||
        (m.offer_ad_id === media.offer_ad_id && m.file_hash === media.file_hash)
    );

    const record: OfferAdMedia = {
      id: existing?.id || media.id || generateId(),
      user_id: media.user_id || existing?.user_id || null,
      offer_id: media.offer_id!,
      offer_ad_id: media.offer_ad_id!,
      media_type: media.media_type || 'video',
      mime_type: media.mime_type || 'video/mp4',
      original_url: media.original_url || existing?.original_url || null,
      storage_path: media.storage_path || existing?.storage_path || null,
      thumbnail_path: media.thumbnail_path || existing?.thumbnail_path || null,
      media_url: media.media_url || existing?.media_url || null,
      thumbnail_url: media.thumbnail_url || existing?.thumbnail_url || null,
      file_hash: media.file_hash || existing?.file_hash || '',
      file_size: media.file_size ?? existing?.file_size ?? null,
      width: media.width ?? existing?.width ?? null,
      height: media.height ?? existing?.height ?? null,
      duration_seconds: media.duration_seconds ?? existing?.duration_seconds ?? null,
      is_primary: media.is_primary ?? existing?.is_primary ?? true,
      capture_status: media.capture_status || existing?.capture_status || 'completed',
      error_message: media.error_message || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_ad_media').upsert(record);
      } catch (err) {
        console.warn('Supabase saveOfferAdMedia error:', err);
      }
    }

    const filtered = allMedia.filter((m) => m.id !== record.id);
    setLocal(STORAGE_KEYS.AD_MEDIA, [record, ...filtered]);

    return record;
  },

  async deleteOfferAd(adId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_ad_media').delete().eq('offer_ad_id', adId);
        await supabase.from('offer_ads').delete().eq('id', adId);
      } catch (err) {
        console.warn('Supabase deleteOfferAd error:', err);
      }
    }

    const allAds = getLocal<OfferAd[]>(STORAGE_KEYS.ADS, []);
    setLocal(
      STORAGE_KEYS.ADS,
      allAds.filter((a) => a.id !== adId)
    );
    const allMedia = getLocal<OfferAdMedia[]>(STORAGE_KEYS.AD_MEDIA, []);
    setLocal(
      STORAGE_KEYS.AD_MEDIA,
      allMedia.filter((m) => m.offer_ad_id !== adId)
    );
  },

  async getCreativesByOffer(offerId: string): Promise<OfferCreative[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('offer_creatives')
          .select('*')
          .eq('offer_id', offerId)
          .order('created_at', { ascending: false });

        if (!error && data) return data as OfferCreative[];
      } catch (err) {
        console.warn('Supabase getCreativesByOffer error:', err);
      }
    }
    const all = getLocal<OfferCreative[]>(STORAGE_KEYS.CREATIVES, []);
    return all.filter((c) => c.offer_id === offerId);
  },

  async saveCreative(creative: Partial<OfferCreative>): Promise<OfferCreative> {
    const now = new Date().toISOString();
    const creativeId = creative.id || generateId();
    const record: OfferCreative = {
      id: creativeId,
      user_id: creative.user_id || null,
      offer_id: creative.offer_id!,
      capture_job_id: creative.capture_job_id || null,
      meta_ad_id: creative.meta_ad_id || null,
      meta_ad_url: creative.meta_ad_url || null,
      media_type: creative.media_type || (creative.format === 'Vídeo' ? 'video' : 'image'),
      mime_type: creative.mime_type || null,
      storage_path: creative.storage_path || null,
      thumbnail_path: creative.thumbnail_path || null,
      media_url: creative.media_url || null,
      thumbnail_url: creative.thumbnail_url || null,
      original_media_url: creative.original_media_url || null,
      file_hash: creative.file_hash || null,
      file_size: creative.file_size || null,
      duration_seconds: creative.duration_seconds || null,
      width: creative.width || null,
      height: creative.height || null,
      ad_url: creative.ad_url || null,
      format: creative.format || (creative.media_type === 'video' ? 'Vídeo' : 'Imagem'),
      hook: creative.hook || '',
      angle: creative.angle || 'Quantidade',
      headline: creative.headline || '',
      primary_text: creative.primary_text || '',
      cta: creative.cta || '',
      started_at: creative.started_at || null,
      first_captured_at: creative.first_captured_at || now,
      last_seen_at: creative.last_seen_at || now,
      is_active: creative.is_active !== undefined ? creative.is_active : true,
      capture_status: creative.capture_status || 'completed',
      status: creative.status || 'Ativo',
      notes: creative.notes || '',
      error_message: creative.error_message || null,
      created_at: creative.created_at || now,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_creatives').upsert(record);
      } catch (err) {
        console.warn('Supabase saveCreative error:', err);
      }
    }

    const all = getLocal<OfferCreative[]>(STORAGE_KEYS.CREATIVES, []);
    const existingIdx = all.findIndex((c) => c.id === record.id);
    let updatedList: OfferCreative[];
    if (existingIdx >= 0) {
      updatedList = [...all];
      updatedList[existingIdx] = record;
    } else {
      updatedList = [record, ...all];
    }
    setLocal(STORAGE_KEYS.CREATIVES, updatedList);

    return record;
  },

  // --------------------------------------------------------------------------
  // CLEANUP HELPER
  // --------------------------------------------------------------------------
  async purgeDemoData(): Promise<number> {
    const offers = getLocal<Offer[]>(STORAGE_KEYS.OFFERS, []);
    const filtered = offers.filter((o) => !o.is_demo_data);
    const removedCount = offers.length - filtered.length;
    setLocal(STORAGE_KEYS.OFFERS, filtered);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offers').delete().eq('is_demo_data', true);
      } catch (err) {
        console.warn('Supabase purgeDemoData error:', err);
      }
    }

    return removedCount;
  },

  // --------------------------------------------------------------------------
  // LANDING PAGE INTELLIGENCE METHODS
  // --------------------------------------------------------------------------
  async saveLandingPageCapture(capture: Partial<LandingPageCapture>): Promise<LandingPageCapture> {
    const now = new Date().toISOString();
    const captureId = capture.id || generateId();
    const record: LandingPageCapture = {
      id: captureId,
      user_id: capture.user_id || null,
      offer_id: capture.offer_id!,
      url: capture.url || '',
      final_url: capture.final_url || capture.url || null,
      domain: capture.domain || null,
      http_status: capture.http_status !== undefined ? capture.http_status : 200,
      page_title: capture.page_title || null,
      captured_at: capture.captured_at || now,
      desktop_screenshot_path: capture.desktop_screenshot_path || null,
      desktop_screenshot_url: capture.desktop_screenshot_url || null,
      mobile_screenshot_path: capture.mobile_screenshot_path || null,
      mobile_screenshot_url: capture.mobile_screenshot_url || null,
      full_page_screenshot_path: capture.full_page_screenshot_path || null,
      full_page_screenshot_url: capture.full_page_screenshot_url || null,
      hero_screenshot_path: capture.hero_screenshot_path || null,
      hero_screenshot_url: capture.hero_screenshot_url || null,
      html_snapshot_path: capture.html_snapshot_path || null,
      capture_status: capture.capture_status || 'ready',
      error_message: capture.error_message || null,
      raw_data: capture.raw_data || null,
      created_at: capture.created_at || now,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('landing_page_captures').upsert(record);
      } catch (err) {
        console.warn('Supabase saveLandingPageCapture error:', err);
      }
    }

    const all = getLocal<LandingPageCapture[]>(STORAGE_KEYS.LP_CAPTURES, []);
    const filtered = all.filter((c) => c.id !== record.id);
    setLocal(STORAGE_KEYS.LP_CAPTURES, [record, ...filtered]);

    return record;
  },

  async getLandingPageCaptures(offerId: string, client?: any): Promise<LandingPageCapture[]> {
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data, error } = await activeClient
          .from('landing_page_captures')
          .select('*')
          .eq('offer_id', offerId)
          .order('captured_at', { ascending: false });
        if (!error && data) return data as LandingPageCapture[];
      } catch (err) {
        console.warn('Supabase getLandingPageCaptures error:', err);
      }
    }

    if (isLocalBackend()) {
      const all = getLocal<LandingPageCapture[]>(STORAGE_KEYS.LP_CAPTURES, []);
      return all
        .filter((c) => c.offer_id === offerId)
        .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
    }
    return [];
  },

  async getLatestLandingPageCapture(offerId: string): Promise<LandingPageCapture | null> {
    const captures = await this.getLandingPageCaptures(offerId);
    return captures[0] || null;
  },

  async saveLandingPageSections(
    captureId: string,
    offerId: string,
    sections: Partial<LandingPageSection>[]
  ): Promise<LandingPageSection[]> {
    const now = new Date().toISOString();
    const records: LandingPageSection[] = sections.map((s, idx) => ({
      id: s.id || generateId(),
      landing_page_capture_id: captureId,
      offer_id: offerId,
      section_type: s.section_type || 'unknown',
      position_index: s.position_index !== undefined ? s.position_index : idx + 1,
      heading: s.heading || null,
      text_content: s.text_content || null,
      dom_selector: s.dom_selector || null,
      top_offset: s.top_offset || null,
      bottom_offset: s.bottom_offset || null,
      screenshot_path: s.screenshot_path || null,
      screenshot_url: s.screenshot_url || null,
      raw_data: s.raw_data || null,
      created_at: s.created_at || now,
    }));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('landing_page_sections').upsert(records);
      } catch (err) {
        console.warn('Supabase saveLandingPageSections error:', err);
      }
    }

    const all = getLocal<LandingPageSection[]>(STORAGE_KEYS.LP_SECTIONS, []);
    const filtered = all.filter((s) => s.landing_page_capture_id !== captureId);
    setLocal(STORAGE_KEYS.LP_SECTIONS, [...records, ...filtered]);

    return records;
  },

  async getLandingPageSections(captureId: string): Promise<LandingPageSection[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('landing_page_sections')
          .select('*')
          .eq('landing_page_capture_id', captureId)
          .order('position_index', { ascending: true });
        if (!error && data) return data as LandingPageSection[];
      } catch (err) {
        console.warn('Supabase getLandingPageSections error:', err);
      }
    }

    const all = getLocal<LandingPageSection[]>(STORAGE_KEYS.LP_SECTIONS, []);
    return all
      .filter((s) => s.landing_page_capture_id === captureId)
      .sort((a, b) => a.position_index - b.position_index);
  },

  async saveLandingPageLinks(
    captureId: string,
    offerId: string,
    links: Partial<LandingPageLink>[]
  ): Promise<LandingPageLink[]> {
    const now = new Date().toISOString();
    const records: LandingPageLink[] = links.map((l) => ({
      id: l.id || generateId(),
      capture_id: captureId,
      offer_id: offerId,
      text: l.text || null,
      url: l.url || '',
      domain: l.domain || null,
      link_type: l.link_type || 'external',
      checkout_platform: l.checkout_platform || null,
      section_type: l.section_type || null,
      is_external: l.is_external !== undefined ? l.is_external : true,
      created_at: l.created_at || now,
    }));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('landing_page_links').upsert(records);
      } catch (err) {
        console.warn('Supabase saveLandingPageLinks error:', err);
      }
    }

    const all = getLocal<LandingPageLink[]>(STORAGE_KEYS.LP_LINKS, []);
    const filtered = all.filter((l) => l.capture_id !== captureId);
    setLocal(STORAGE_KEYS.LP_LINKS, [...records, ...filtered]);

    return records;
  },

  async getLandingPageLinks(captureId: string): Promise<LandingPageLink[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('landing_page_links')
          .select('*')
          .eq('capture_id', captureId);
        if (!error && data) return data as LandingPageLink[];
      } catch (err) {
        console.warn('Supabase getLandingPageLinks error:', err);
      }
    }

    const all = getLocal<LandingPageLink[]>(STORAGE_KEYS.LP_LINKS, []);
    return all.filter((l) => l.capture_id === captureId);
  },

  async saveOfferDeliverables(
    offerId: string,
    deliverables: Partial<OfferDeliverable>[]
  ): Promise<void> {
    const records: OfferDeliverable[] = deliverables.map((d, i) => ({
      id: d.id || generateId(),
      offer_id: offerId,
      title: d.title || d.name || 'Entregável',
      name: d.name || d.title || 'Entregável',
      description: d.description || '',
      order_index: d.order_index !== undefined ? d.order_index : i,
      source: d.source || 'landing_page',
      capture_id: d.capture_id,
      created_at: d.created_at || new Date().toISOString(),
    }));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_deliverables').upsert(records);
      } catch (err) {
        console.warn('Supabase saveOfferDeliverables error:', err);
      }
    }

    const all = getLocal<OfferDeliverable[]>(STORAGE_KEYS.DELIVERABLES, []);
    const filtered = all.filter((d) => d.offer_id !== offerId);
    setLocal(STORAGE_KEYS.DELIVERABLES, [...records, ...filtered]);
  },

  async getOfferDeliverables(offerId: string): Promise<OfferDeliverable[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('offer_deliverables')
          .select('*')
          .eq('offer_id', offerId)
          .order('order_index', { ascending: true });
        if (!error && data) return data as OfferDeliverable[];
      } catch (err) {
        console.warn('Supabase getOfferDeliverables error:', err);
      }
    }
    const all = getLocal<OfferDeliverable[]>(STORAGE_KEYS.DELIVERABLES, []);
    return all.filter((d) => d.offer_id === offerId);
  },

  async saveOfferBonuses(offerId: string, bonuses: Partial<OfferBonus>[]): Promise<void> {
    const records: OfferBonus[] = bonuses.map((b, i) => ({
      id: b.id || generateId(),
      offer_id: offerId,
      title: b.title || b.name || 'Bônus',
      name: b.name || b.title || 'Bônus',
      description: b.description || '',
      claimed_value: b.claimed_value || b.advertised_value || 0,
      advertised_value: b.advertised_value || b.claimed_value || 0,
      order_index: b.order_index !== undefined ? b.order_index : i,
      source: b.source || 'landing_page',
      capture_id: b.capture_id,
      created_at: b.created_at || new Date().toISOString(),
    }));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_bonuses').upsert(records);
      } catch (err) {
        console.warn('Supabase saveOfferBonuses error:', err);
      }
    }

    const all = getLocal<OfferBonus[]>(STORAGE_KEYS.BONUSES, []);
    const filtered = all.filter((b) => b.offer_id !== offerId);
    setLocal(STORAGE_KEYS.BONUSES, [...records, ...filtered]);
  },

  async getOfferBonuses(offerId: string): Promise<OfferBonus[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('offer_bonuses')
          .select('*')
          .eq('offer_id', offerId)
          .order('order_index', { ascending: true });
        if (!error && data) return data as OfferBonus[];
      } catch (err) {
        console.warn('Supabase getOfferBonuses error:', err);
      }
    }
    const all = getLocal<OfferBonus[]>(STORAGE_KEYS.BONUSES, []);
    return all.filter((b) => b.offer_id === offerId);
  },

  async saveOfferFunnelSteps(offerId: string, steps: OfferFunnelStep[]): Promise<void> {
    const records: OfferFunnelStep[] = steps.map((s, idx) => ({
      id: s.id || `fs_${offerId}_${idx + 1}`,
      offer_id: offerId,
      step_type: s.step_type,
      title: s.title,
      price: s.price ?? null,
      url: s.url ?? null,
      domain: s.domain ?? null,
      provider: s.provider ?? null,
      source: s.source ?? 'landing_page',
      source_link_text: s.source_link_text ?? null,
      verified_at: s.verified_at ?? new Date().toISOString(),
      notes: s.notes ?? null,
      order_index: s.order_index !== undefined ? s.order_index : idx + 1,
    }));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_funnel_steps').delete().eq('offer_id', offerId);
        if (records.length > 0) {
          await supabase.from('offer_funnel_steps').insert(records);
        }
      } catch (err) {
        console.warn('Supabase saveOfferFunnelSteps error:', err);
      }
    }

    const all = getLocal<OfferFunnelStep[]>(STORAGE_KEYS.FUNNEL_STEPS, []);
    const filtered = all.filter((f) => f.offer_id !== offerId);
    setLocal(STORAGE_KEYS.FUNNEL_STEPS, [...records, ...filtered]);
  },

  async getOfferFunnelSteps(offerId: string): Promise<OfferFunnelStep[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('offer_funnel_steps')
          .select('*')
          .eq('offer_id', offerId)
          .order('order_index', { ascending: true });
        if (!error && data) return data as OfferFunnelStep[];
      } catch (err) {
        console.warn('Supabase getOfferFunnelSteps error:', err);
      }
    }
    const all = getLocal<OfferFunnelStep[]>(STORAGE_KEYS.FUNNEL_STEPS, []);
    return all.filter((f) => f.offer_id === offerId);
  },

  async saveOfferProofs(offerId: string, proofs: OfferProof[]): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('offer_proofs').delete().eq('offer_id', offerId);
        if (proofs.length > 0) {
          await supabase.from('offer_proofs').insert(proofs);
        }
      } catch (err) {
        console.warn('Supabase saveOfferProofs error:', err);
      }
    }
    const all = getLocal<OfferProof[]>(STORAGE_KEYS.PROOFS, []);
    const filtered = all.filter((p) => p.offer_id !== offerId);
    setLocal(STORAGE_KEYS.PROOFS, [...proofs, ...filtered]);
  },

  async getOfferProofs(offerId: string): Promise<OfferProof[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('offer_proofs')
          .select('*')
          .eq('offer_id', offerId);
        if (!error && data) return data as OfferProof[];
      } catch (err) {
        console.warn('Supabase getOfferProofs error:', err);
      }
    }
    const all = getLocal<OfferProof[]>(STORAGE_KEYS.PROOFS, []);
    return all.filter((p) => p.offer_id === offerId);
  },

  async syncLandingPageToOffer(
    offerId: string,
    analysis: LandingPageAnalysisResult
  ): Promise<Offer | null> {
    const existing = await this.getOfferById(offerId);
    if (!existing) return null;

    const updates: Partial<Offer> = {};
    const heroXRay = analysis.heroXRay || {};
    const copy = analysis.copy || { promises: [], painPoints: [], benefits: [], objections: [], testimonials: [], guarantees: [], ctas: [], faqs: [], urgency: [] };
    const commerce = analysis.commerce || { deliverables: [], bonuses: [], checkoutUrls: [] };

    // 1. Headlines & Subheadlines from Hero if empty or not manually set
    if (!existing.headline && heroXRay.headline) {
      updates.headline = heroXRay.headline;
    }
    if (!existing.subheadline && heroXRay.subheadline) {
      updates.subheadline = heroXRay.subheadline;
    }

    // 2. Promise & Problem & Transformation & Mechanism & BigIdea
    if (!existing.promise && copy.promises?.[0]) {
      updates.promise = copy.promises[0];
    }
    if (!existing.problem && copy.painPoints?.[0]) {
      updates.problem = copy.painPoints[0];
    }
    if (!existing.transformation && copy.promises?.[0]) {
      updates.transformation = copy.promises[0];
    }

    // 3. Guarantee
    if (commerce.guaranteeText && !existing.guarantee) {
      updates.guarantee = commerce.guaranteeText;
    }

    // 4. Front-End Pricing Options & Aggregated Metrics
    if (commerce.frontOptions && commerce.frontOptions.length > 0) {
      const optionsToSave: OfferFrontendOption[] = commerce.frontOptions.map((opt, i) => ({
        ...opt,
        id: opt.id || `front_opt_${analysis.capture.id}_${i + 1}`,
        offer_id: offerId,
        landing_page_capture_id: analysis.capture.id,
        created_at: opt.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      await this.saveFrontendOptions(offerId, optionsToSave);
      updates.frontend_options = optionsToSave;

      const pSummary = calculateFrontendPricing(optionsToSave);
      updates.front_options_count = pSummary.count;
      updates.front_price_min = pSummary.min;
      updates.front_price_max = pSummary.max;
      updates.front_price_avg = pSummary.average;
      if (pSummary.min) {
        updates.price = pSummary.min;
      }
    } else if (commerce.currentPrice) {
      const singleOpt: OfferFrontendOption = {
        id: `front_opt_${analysis.capture.id}_1`,
        offer_id: offerId,
        landing_page_capture_id: analysis.capture.id,
        name: 'Opção Única',
        current_price: commerce.currentPrice,
        original_price: commerce.originalPrice || null,
        currency: 'BRL',
        billing_type: 'one_time',
        position_index: 1,
        is_featured: false,
        is_default: true,
        source: 'LANDING_PAGE',
        source_section: 'pricing',
      };
      await this.saveFrontendOptions(offerId, [singleOpt]);
      updates.frontend_options = [singleOpt];
      updates.front_options_count = 1;
      updates.front_price_min = commerce.currentPrice;
      updates.front_price_max = commerce.currentPrice;
      updates.front_price_avg = commerce.currentPrice;
      updates.price = commerce.currentPrice;
    }

    // 5. Checkout Platform & Checkout URL
    if (commerce.checkoutPlatform && !existing.checkout_platform) {
      updates.checkout_platform = commerce.checkoutPlatform;
    }
    if (commerce.checkoutUrls?.[0] && !existing.checkout_url) {
      updates.checkout_url = commerce.checkoutUrls[0];
    }

    // 6. Audience Profile (ONLY update if explicit evidence exists, NO hardcoded defaults!)
    const currentAudienceProfile = existing.audience_profile || {};
    const audienceUpdates: Record<string, any> = { ...currentAudienceProfile };

    if (!existing.target_audience) {
      const fullText = (analysis.capture as any)?.raw_data?.fullText || '';
      const audienceMatch = fullText.match(
        /(?:desenvolvido|criado|feito|ideal|especial|pensado)\s+para\s+([^,\.\n\r]+)/i
      );
      if (audienceMatch?.[1]) {
        updates.target_audience = `Para ${audienceMatch[1].trim()}`;
        audienceUpdates.buyer_persona = updates.target_audience;
      }
    }

    if (!audienceUpdates.core_problem && copy.painPoints?.[0]) {
      audienceUpdates.core_problem = copy.painPoints[0];
    }
    if (!audienceUpdates.core_desire && copy.promises?.[0]) {
      audienceUpdates.core_desire = copy.promises[0];
    }

    // REMOVE HARDCODED "Consciente do Problema"!
    if (!audienceUpdates.awareness_level) {
      audienceUpdates.awareness_level = null;
    }

    updates.audience_profile = audienceUpdates;

    // 7. Sections list
    if (analysis.sections && analysis.sections.length > 0) {
      updates.lp_sections = analysis.sections.map((s) => s.section_type);
    }

    // 8. Save Deliverables (offer_deliverables)
    if (commerce.deliverables && commerce.deliverables.length > 0) {
      const delivRecords: Partial<OfferDeliverable>[] = commerce.deliverables.map((d, i) => ({
        id: `deliv_${analysis.capture.id}_${i}`,
        offer_id: offerId,
        title: d.name,
        name: d.name,
        description: d.description || '',
        order_index: i + 1,
        source: 'landing_page',
        capture_id: analysis.capture.id,
      }));
      await this.saveOfferDeliverables(offerId, delivRecords as OfferDeliverable[]);
    }

    // 9. Save Bonuses (offer_bonuses)
    if (commerce.bonuses && commerce.bonuses.length > 0) {
      const bonusRecords: Partial<OfferBonus>[] = commerce.bonuses.map((b: any, i: number) => ({
        id: `bonus_${analysis.capture.id}_${i}`,
        offer_id: offerId,
        title: b.name,
        name: b.name,
        description: b.description || '',
        claimed_value: b.advertisedValue ?? b.advertised_value ?? 0,
        advertised_value: b.advertisedValue ?? b.advertised_value ?? 0,
        order_index: i + 1,
        source: 'landing_page',
        capture_id: analysis.capture.id,
      }));
      await this.saveOfferBonuses(offerId, bonusRecords as OfferBonus[]);
    }

    // 10. Save Real Observed Funnel Steps (offer_funnel_steps)
    const funnelSteps: OfferFunnelStep[] = [];
    let stepIndex = 1;

    // Step 1: Meta Ads (if present or ad count exists)
    if (existing.meta_ads_url || (existing.active_ads_count && existing.active_ads_count > 0)) {
      funnelSteps.push({
        id: `fs_${offerId}_meta_ads`,
        offer_id: offerId,
        step_type: 'meta_ad',
        title: 'Tráfego Pago (Meta Ads)',
        url: existing.meta_ads_url || null,
        domain: 'facebook.com',
        provider: 'Meta Ads Library',
        source: 'meta_ads',
        notes: `${existing.active_ads_count || 0} anúncios ativos observados`,
        order_index: stepIndex++,
      });
    }

    // Step 2: Landing Page
    if (existing.landing_page_url || analysis.capture.url) {
      funnelSteps.push({
        id: `fs_${offerId}_lp`,
        offer_id: offerId,
        step_type: 'landing_page',
        title: 'Página de Vendas (Landing Page)',
        url: existing.landing_page_url || analysis.capture.url,
        domain: existing.landing_page_domain || analysis.capture.domain || null,
        provider: 'Landing Page',
        source: 'landing_page',
        notes: heroXRay.headline || 'Página de Vendas Principal',
        order_index: stepIndex++,
      });
    }

    // Step 3: Checkout
    const checkoutUrl = existing.checkout_url || commerce.checkoutUrls?.[0];
    if (checkoutUrl) {
      const platformName = commerce.checkoutPlatform ? commerce.checkoutPlatform.toUpperCase() : 'Checkout';
      funnelSteps.push({
        id: `fs_${offerId}_checkout`,
        offer_id: offerId,
        step_type: 'checkout',
        title: `Checkout (${platformName})`,
        price: existing.price || commerce.currentPrice || null,
        url: checkoutUrl,
        provider: commerce.checkoutPlatform || 'Custom',
        source: 'checkout_link',
        notes: 'Página de pagamento identificada no CTA da Landing Page',
        order_index: stepIndex++,
      });
    }

    if (funnelSteps.length > 0) {
      await this.saveOfferFunnelSteps(offerId, funnelSteps);
    }

    // 11. Save Proofs (offer_proofs)
    const proofsList: OfferProof[] = [];
    if (copy.testimonials && copy.testimonials.length > 0) {
      copy.testimonials.forEach((t, i) => {
        proofsList.push({
          id: `proof_test_${analysis.capture.id}_${i}`,
          offer_id: offerId,
          proof_type: 'testimonial',
          title: 'Depoimento de Cliente',
          quote: t,
          source: 'landing_page',
        });
      });
    }
    if (heroXRay.rating) {
      proofsList.push({
        id: `proof_rating_${analysis.capture.id}`,
        offer_id: offerId,
        proof_type: 'rating',
        title: 'Avaliação Média',
        rating: heroXRay.rating,
        source: 'landing_page',
      });
    }
    if (proofsList.length > 0) {
      await this.saveOfferProofs(offerId, proofsList);
    }

    // 12. Provenance Map
    const provenanceMap: Record<string, any> = {
      headline: {
        source_type: 'LANDING_PAGE',
        source_text: heroXRay.headline || copy.headlines?.[0],
        source_section: 'hero',
        captured_at: analysis.capture.captured_at,
      },
      price: {
        source_type: 'LANDING_PAGE',
        source_text: commerce.currentPrice ? `R$ ${commerce.currentPrice.toFixed(2)}` : null,
        source_section: 'pricing',
        captured_at: analysis.capture.captured_at,
      },
      guarantee: {
        source_type: 'LANDING_PAGE',
        source_text: commerce.guaranteeText,
        source_section: 'guarantee',
        captured_at: analysis.capture.captured_at,
      },
      checkout: {
        source_type: 'LANDING_PAGE',
        source_text: commerce.checkoutPlatform || 'Checkout Link',
        source_section: 'cta',
        captured_at: analysis.capture.captured_at,
      },
    };

    // Store in extra_data
    const existingExtra = existing.extra_data || {};
    updates.extra_data = {
      ...existingExtra,
      latest_lp_analysis: analysis,
      provenance_map: provenanceMap,
      lp_last_analyzed_at: new Date().toISOString(),
    };

    // Single Source of Truth updates
    updates.lp_mapping_status = 'SUCCESS';
    updates.lp_mapped_at = new Date().toISOString();
    updates.lp_last_error = null;
    const derivedStatus = deriveDataStatus({
      ...existing,
      ...updates,
      lp_mapping_status: 'SUCCESS',
      lp_mapped_at: updates.lp_mapped_at,
    });
    updates.status = existing.status === 'VALIDADA' ? 'VALIDADA' : derivedStatus;
    updates.landing_page_url_status = 'CAPTURED';

    // Checkout Discovery & Status Transition
    const finalCheckoutUrl = updates.checkout_url || existing.checkout_url || commerce.checkoutUrls?.[0];
    if (
      finalCheckoutUrl &&
      finalCheckoutUrl.trim() !== '' &&
      (!existing.landing_page_url || finalCheckoutUrl.trim() !== existing.landing_page_url.trim())
    ) {
      updates.checkout_url = finalCheckoutUrl;
      if (existing.checkout_mapping_status !== 'SUCCESS') {
        updates.checkout_mapping_status = 'PENDING';
      }
    } else if (!existing.checkout_mapping_status || existing.checkout_mapping_status !== 'SUCCESS') {
      updates.checkout_mapping_status = 'NOT_READY';
    }

    return await this.updateOffer(offerId, updates);
  },

  async reconcileMappingState(offer: Offer): Promise<Offer> {
    const updates: Partial<Offer> = {};
    let needsUpdate = false;

    // 1. LP Mapping Reconciliation based strictly on REAL ARTIFACTS
    const lpCaptures = await this.getLandingPageCaptures(offer.id);
    const validCaptures = lpCaptures.filter(
      (c) => c.capture_status === 'ready' || c.capture_status === 'analyzed'
    );
    const hasLpCaptures = validCaptures.length > 0;
    const hasLpAnalysis = Boolean((offer.extra_data as any)?.latest_lp_analysis);
    const isLpSuccess = hasLpCaptures || hasLpAnalysis;

    if (isLpSuccess) {
      if (offer.lp_mapping_status !== 'SUCCESS') {
        updates.lp_mapping_status = 'SUCCESS';
        needsUpdate = true;
      }
      if (!offer.lp_mapped_at) {
        updates.lp_mapped_at = validCaptures[0]?.captured_at || offer.created_at || new Date().toISOString();
        needsUpdate = true;
      }
      if (!offer.mapped_source_url) {
        updates.mapped_source_url = offer.landing_page_url || offer.landing_page_url_original || null;
        needsUpdate = true;
      }
      const derived = deriveDataStatus({
        ...offer,
        ...updates,
        lp_mapping_status: 'SUCCESS',
        lp_mapped_at: updates.lp_mapped_at || offer.lp_mapped_at || new Date().toISOString(),
      });
      if (offer.status !== derived && offer.status !== 'VALIDADA' && offer.status !== 'ANALISADA') {
        updates.status = derived;
        needsUpdate = true;
      }
      if (offer.landing_page_url_status !== 'CAPTURED') {
        updates.landing_page_url_status = 'CAPTURED';
        needsUpdate = true;
      }
    } else {
      // FALSE POSITIVE RECONCILIATION: Reset status if no real artifact exists
      if (offer.lp_mapping_status === 'SUCCESS') {
        updates.lp_mapping_status = offer.lp_last_error ? 'FAILED' : 'NOT_MAPPED';
        updates.lp_mapped_at = null;
        needsUpdate = true;
      }
      if (offer.status === 'MAPEADA') {
        const derived = deriveDataStatus({ ...offer, lp_mapping_status: 'NOT_MAPPED', lp_mapped_at: null });
        updates.status = derived === 'MAPEADA' ? 'DADOS_PARCIAIS' : derived;
        needsUpdate = true;
      }
    }

    // 2. Checkout URL Enrichment from LP links if missing (Invariant: checkout_url != landing_page_url)
    let checkoutUrl = offer.checkout_url || null;
    const lpUrl = offer.landing_page_url || offer.landing_page_url_original;
    if (lpUrl && checkoutUrl?.trim() === lpUrl.trim()) {
      checkoutUrl = null;
      updates.checkout_url = null;
      needsUpdate = true;
    }

    if (!checkoutUrl && hasLpCaptures) {
      const links = await this.getLandingPageLinks(validCaptures[0].id);
      const foundLink = links.find((l) => l.link_type === 'checkout' || isKnownCheckoutUrl(l.url));
      if (foundLink && (!lpUrl || foundLink.url.trim() !== lpUrl.trim())) {
        checkoutUrl = foundLink.url;
        updates.checkout_url = checkoutUrl;
        needsUpdate = true;
      }
    }

    // 3. Checkout Discovery & Mapping Status Reconciliation
    if (checkoutUrl) {
      if (offer.checkout_discovery_status !== 'FOUND') {
        updates.checkout_discovery_status = 'FOUND';
        updates.checkout_discovery_at = offer.checkout_discovery_at || new Date().toISOString();
        needsUpdate = true;
      }

      const checkoutCaptures = await this.getCheckoutCaptures(offer.id);
      const isCheckoutVerified =
        checkoutCaptures.some((c) => c.status === 'verified') || (offer.extra_data as any)?.checkout_verified === true;
      const hasFailedCheckout = checkoutCaptures.some(
        (c) => c.status === 'not_confirmed' || c.status === 'url_not_found' || c.status === 'blocked'
      );

      if (isCheckoutVerified) {
        if (offer.checkout_mapping_status !== 'SUCCESS') {
          updates.checkout_mapping_status = 'SUCCESS';
          updates.checkout_mapped_at = offer.checkout_mapped_at || new Date().toISOString();
          needsUpdate = true;
        }
      } else if (hasFailedCheckout) {
        if (offer.checkout_mapping_status !== 'FAILED') {
          updates.checkout_mapping_status = 'FAILED';
          needsUpdate = true;
        }
      } else {
        if (offer.checkout_mapping_status === 'SUCCESS') {
          updates.checkout_mapping_status = 'NOT_MAPPED';
          updates.checkout_mapped_at = null;
          needsUpdate = true;
        }
      }
    } else {
      if (hasLpCaptures) {
        if (offer.checkout_discovery_status !== 'NOT_FOUND') {
          updates.checkout_discovery_status = 'NOT_FOUND';
          updates.checkout_discovery_at = offer.checkout_discovery_at || new Date().toISOString();
          needsUpdate = true;
        }
        if (offer.checkout_mapping_status !== 'NOT_APPLICABLE') {
          updates.checkout_mapping_status = 'NOT_APPLICABLE';
          needsUpdate = true;
        }
      } else {
        if (offer.checkout_discovery_status !== 'NOT_PROCESSED' && offer.checkout_discovery_status !== 'RUNNING') {
          updates.checkout_discovery_status = 'NOT_PROCESSED';
          needsUpdate = true;
        }
        if (offer.checkout_mapping_status !== 'NOT_MAPPED' && offer.checkout_mapping_status !== 'QUEUED' && offer.checkout_mapping_status !== 'RUNNING') {
          updates.checkout_mapping_status = 'NOT_MAPPED';
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      const updated = await this.updateOffer(offer.id, updates);
      return updated || { ...offer, ...updates };
    }

    return offer;
  },

  async reconcileAllOffers(): Promise<Offer[]> {
    const offers = await this.getOffers();
    const reconciled: Offer[] = [];
    for (const offer of offers) {
      const result = await this.reconcileMappingState(offer);
      reconciled.push(result);
    }
    return reconciled;
  },

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // OFFER ANALYSIS JOBS (META ADS LINK PIPELINE - HARDENED & SERVERLESS RESILIENT)
  // --------------------------------------------------------------------------
  async createAnalysisJob(jobData: Partial<OfferAnalysisJob>, client?: any): Promise<OfferAnalysisJob> {
    const now = new Date().toISOString();
    const jobId = jobData.id || `job_${generateId()}`;
    const workspaceId = jobData.workspace_id || 'ws_default_001';
    const currentStep = jobData.current_step || 'RESOLVE_META';
    const progressPercent = jobData.progress_percent ?? 10;
    const attempt = jobData.attempt || 1;
    const maxAttempts = jobData.max_attempts || 3;

    const progressData = {
      ...(jobData.progress_data || {}),
      workspace_id: workspaceId,
      current_step: currentStep,
      progress_percent: progressPercent,
      last_heartbeat_at: now,
      attempt,
      max_attempts: maxAttempts,
    };

    const newJob: OfferAnalysisJob = {
      id: jobId,
      workspace_id: workspaceId,
      user_id: jobData.user_id || null,
      offer_id: jobData.offer_id || null,
      input_url: jobData.input_url || '',
      meta_ads_url_original: jobData.meta_ads_url_original || jobData.input_url || '',
      status: jobData.status || 'running',
      current_stage: jobData.current_stage || 'validating_url',
      current_step: currentStep,
      progress_percent: progressPercent,
      last_heartbeat_at: now,
      attempt,
      max_attempts: maxAttempts,
      stage_message: jobData.stage_message || 'Inicializando análise...',
      progress_data: progressData,
      started_at: jobData.started_at || now,
      mode: jobData.mode || 'new',
      created_at: now,
      updated_at: now,
    };

    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));
    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data: user } = await activeClient.auth.getUser().catch(() => ({ data: { user: null } }));
        // Try inserting with all fields
        const insertPayload: Record<string, any> = {
          id: newJob.id,
          offer_id: newJob.offer_id,
          input_url: newJob.input_url,
          meta_ads_url_original: newJob.meta_ads_url_original,
          status: newJob.status,
          current_stage: newJob.current_stage,
          stage_message: newJob.stage_message,
          progress_data: newJob.progress_data,
          mode: newJob.mode,
          started_at: newJob.started_at,
          user_id: user?.user?.id || newJob.user_id,
          created_at: now,
          updated_at: now,
        };

        const { error: insErr } = await activeClient.from('offer_analysis_jobs').insert(insertPayload);
        if (insErr) {
          console.warn('Supabase createAnalysisJob insert error:', insErr.message);
        }
      } catch (err) {
        console.warn('Supabase createAnalysisJob fallback:', err);
      }
    }

    const jobs = getLocal<OfferAnalysisJob[]>(STORAGE_KEYS.ANALYSIS_JOBS, []);
    setLocal(STORAGE_KEYS.ANALYSIS_JOBS, [newJob, ...jobs]);
    return newJob;
  },

  async getAnalysisJob(jobId: string, client?: any): Promise<OfferAnalysisJob | null> {
    let job: OfferAnalysisJob | null = null;
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data, error } = await activeClient
          .from('offer_analysis_jobs')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();

        if (!error && data) {
          job = data as OfferAnalysisJob;
        }
      } catch (err) {
        console.warn('Supabase getAnalysisJob fallback:', err);
      }
    }

    if (!job) {
      const jobs = getLocal<OfferAnalysisJob[]>(STORAGE_KEYS.ANALYSIS_JOBS, []);
      job = jobs.find((j) => j.id === jobId) || null;
    }

    if (job) {
      // Normalize progress_data mirror fields
      job.current_step = job.current_step || job.progress_data?.current_step || job.current_stage || 'RESOLVE_META';
      job.progress_percent = job.progress_percent ?? job.progress_data?.progress_percent ?? 10;
      job.last_heartbeat_at = job.last_heartbeat_at || job.progress_data?.last_heartbeat_at || job.updated_at || job.created_at;
      job.attempt = job.attempt || job.progress_data?.attempt || 1;
      job.max_attempts = job.max_attempts || job.progress_data?.max_attempts || 3;
    }

    return job;
  },

  async getAnalysisJobs(client?: any): Promise<OfferAnalysisJob[]> {
    let jobs: OfferAnalysisJob[] = [];
    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));

    if (isSupabaseConfigured() && activeClient) {
      try {
        const { data, error } = await activeClient
          .from('offer_analysis_jobs')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          jobs = data as OfferAnalysisJob[];
        }
      } catch (err) {
        console.warn('Supabase getAnalysisJobs fallback:', err);
      }
    }

    if (jobs.length === 0) {
      jobs = getLocal<OfferAnalysisJob[]>(STORAGE_KEYS.ANALYSIS_JOBS, []);
    }

    const now = Date.now();
    const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes staleness limit

    const normalizedJobs = jobs.map((job) => {
      const normalized: OfferAnalysisJob = {
        ...job,
        current_step: job.current_step || job.progress_data?.current_step || job.current_stage || 'RESOLVE_META',
        progress_percent: job.progress_percent ?? job.progress_data?.progress_percent ?? 10,
        last_heartbeat_at: job.last_heartbeat_at || job.progress_data?.last_heartbeat_at || job.updated_at || job.created_at,
        attempt: job.attempt || job.progress_data?.attempt || 1,
        max_attempts: job.max_attempts || job.progress_data?.max_attempts || 3,
      };

      // Auto-recover stale jobs: running or queued for > 5 min without heartbeat
      const lastHeartbeat = new Date(normalized.last_heartbeat_at!).getTime();
      if (
        (normalized.status === 'running' || normalized.status === 'queued') &&
        now - lastHeartbeat > STALE_TIMEOUT_MS
      ) {
        normalized.status = 'stale';
        normalized.error_code = 'TIMEOUT_STALE_AUTO_RECOVERED';
        normalized.stage_message = 'Análise expirada (mais de 5 minutos sem comunicação). Você pode tentar novamente.';
        // Persist stale state asynchronously
        this.updateAnalysisJob(normalized.id, {
          status: 'stale',
          error_code: 'TIMEOUT_STALE_AUTO_RECOVERED',
          stage_message: normalized.stage_message,
        }, activeClient).catch(() => {});
      }

      return normalized;
    });

    return normalizedJobs;
  },

  async updateAnalysisJob(
    jobId: string,
    updates: Partial<OfferAnalysisJob>,
    client?: any
  ): Promise<OfferAnalysisJob | null> {
    const now = new Date().toISOString();
    const heartbeatTime = updates.last_heartbeat_at || now;
    const updateTime = updates.updated_at || now;

    const mergedProgress = {
      ...(updates.progress_data || {}),
      ...(updates.current_step ? { current_step: updates.current_step } : {}),
      ...(updates.progress_percent !== undefined ? { progress_percent: updates.progress_percent } : {}),
      ...(updates.error_code ? { error_code: updates.error_code } : {}),
      last_heartbeat_at: heartbeatTime,
    };

    const payloadToDb: Record<string, any> = {
      ...updates,
      progress_data: mergedProgress,
      updated_at: updateTime,
    };

    const activeClient = client || (typeof window !== 'undefined' ? supabase : (createAdminSupabaseClient() || supabase));
    if (isSupabaseConfigured() && activeClient) {
      try {
        await activeClient
          .from('offer_analysis_jobs')
          .update(payloadToDb)
          .eq('id', jobId);
      } catch (err) {
        console.warn('Supabase updateAnalysisJob fallback:', err);
      }
    }

    const jobs = getLocal<OfferAnalysisJob[]>(STORAGE_KEYS.ANALYSIS_JOBS, []);
    let updatedJob: OfferAnalysisJob | null = null;

    const newJobs = jobs.map((j) => {
      if (j.id === jobId) {
        updatedJob = {
          ...j,
          ...updates,
          progress_data: {
            ...(j.progress_data || {}),
            ...mergedProgress,
          },
          updated_at: updateTime,
          last_heartbeat_at: heartbeatTime,
        };
        return updatedJob;
      }
      return j;
    });

    setLocal(STORAGE_KEYS.ANALYSIS_JOBS, newJobs);
    return updatedJob;
  },

  // --------------------------------------------------------------------------
  // CENTRAL DE MAPEAMENTO - BATCHES & JOBS PERSISTENCE
  // --------------------------------------------------------------------------
  async getMappingBatches(): Promise<MappingBatch[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('mapping_batches')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data as MappingBatch[];
      } catch (err) {
        console.warn('Supabase getMappingBatches fallback:', err);
      }
    }
    const batches = getLocal<MappingBatch[]>(STORAGE_KEYS.MAPPING_BATCHES, []);
    return batches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getMappingBatchById(id: string): Promise<MappingBatch | null> {
    const batches = await this.getMappingBatches();
    return batches.find((b) => b.id === id) || null;
  },

  async saveMappingBatch(batch: MappingBatch): Promise<MappingBatch> {
    const now = new Date().toISOString();
    const fullBatch = { ...batch, updated_at: now };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('mapping_batches').upsert(fullBatch);
      } catch (err) {
        console.warn('Supabase saveMappingBatch error:', err);
      }
    }

    const batches = getLocal<MappingBatch[]>(STORAGE_KEYS.MAPPING_BATCHES, []);
    const idx = batches.findIndex((b) => b.id === fullBatch.id);
    let updated: MappingBatch[];
    if (idx >= 0) {
      updated = [...batches];
      updated[idx] = fullBatch;
    } else {
      updated = [fullBatch, ...batches];
    }
    setLocal(STORAGE_KEYS.MAPPING_BATCHES, updated);
    return fullBatch;
  },

  async getMappingJobs(batchId?: string): Promise<MappingJob[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('mapping_jobs').select('*');
        if (batchId) query = query.eq('batch_id', batchId);
        const { data, error } = await query.order('created_at', { ascending: true });
        if (!error && data) return data as MappingJob[];
      } catch (err) {
        console.warn('Supabase getMappingJobs fallback:', err);
      }
    }
    const jobs = getLocal<MappingJob[]>(STORAGE_KEYS.MAPPING_JOBS, []);
    if (batchId) {
      return jobs.filter((j) => j.batch_id === batchId);
    }
    return jobs;
  },

  async saveMappingJob(job: MappingJob): Promise<MappingJob> {
    const now = new Date().toISOString();
    const fullJob = { ...job, updated_at: now };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('mapping_jobs').upsert(fullJob);
      } catch (err) {
        console.warn('Supabase saveMappingJob error:', err);
      }
    }

    const jobs = getLocal<MappingJob[]>(STORAGE_KEYS.MAPPING_JOBS, []);
    const idx = jobs.findIndex((j) => j.id === fullJob.id);
    let updated: MappingJob[];
    if (idx >= 0) {
      updated = [...jobs];
      updated[idx] = fullJob;
    } else {
      updated = [...jobs, fullJob];
    }
    setLocal(STORAGE_KEYS.MAPPING_JOBS, updated);
    return fullJob;
  },

  // --------------------------------------------------------------------------
  // RASPAGEM & ENRIQUECIMENTO - BATCHES & JOBS PERSISTENCE
  // --------------------------------------------------------------------------
  async getScrapingBatches(): Promise<ScrapingBatch[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('scraping_batches')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data as ScrapingBatch[];
      } catch (err) {
        console.warn('Supabase getScrapingBatches fallback:', err);
      }
    }
    const batches = getLocal<ScrapingBatch[]>(STORAGE_KEYS.SCRAPING_BATCHES, []);
    return batches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getScrapingBatchById(id: string): Promise<ScrapingBatch | null> {
    const batches = await this.getScrapingBatches();
    return batches.find((b) => b.id === id) || null;
  },

  async saveScrapingBatch(batch: ScrapingBatch): Promise<ScrapingBatch> {
    const now = new Date().toISOString();
    const fullBatch = { ...batch, updated_at: now };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('scraping_batches').upsert(fullBatch);
      } catch (err) {
        console.warn('Supabase saveScrapingBatch error:', err);
      }
    }

    const batches = getLocal<ScrapingBatch[]>(STORAGE_KEYS.SCRAPING_BATCHES, []);
    const idx = batches.findIndex((b) => b.id === fullBatch.id);
    let updated: ScrapingBatch[];
    if (idx >= 0) {
      updated = [...batches];
      updated[idx] = fullBatch;
    } else {
      updated = [fullBatch, ...batches];
    }
    setLocal(STORAGE_KEYS.SCRAPING_BATCHES, updated);
    return fullBatch;
  },

  async getScrapingJobs(batchId?: string): Promise<ScrapingJob[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('scraping_jobs').select('*');
        if (batchId) query = query.eq('batch_id', batchId);
        const { data, error } = await query.order('created_at', { ascending: true });
        if (!error && data) return data as ScrapingJob[];
      } catch (err) {
        console.warn('Supabase getScrapingJobs fallback:', err);
      }
    }
    const jobs = getLocal<ScrapingJob[]>(STORAGE_KEYS.SCRAPING_JOBS, []);
    if (batchId) {
      return jobs.filter((j) => j.batch_id === batchId);
    }
    return jobs;
  },

  async saveScrapingJob(job: ScrapingJob): Promise<ScrapingJob> {
    const now = new Date().toISOString();
    const fullJob = { ...job, updated_at: now };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('scraping_jobs').upsert(fullJob);
      } catch (err) {
        console.warn('Supabase saveScrapingJob error:', err);
      }
    }

    const jobs = getLocal<ScrapingJob[]>(STORAGE_KEYS.SCRAPING_JOBS, []);
    const idx = jobs.findIndex((j) => j.id === fullJob.id);
    let updated: ScrapingJob[];
    if (idx >= 0) {
      updated = [...jobs];
      updated[idx] = fullJob;
    } else {
      updated = [...jobs, fullJob];
    }
    setLocal(STORAGE_KEYS.SCRAPING_JOBS, updated);
    return fullJob;
  },

  async getStagedOffers(statusFilter?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'): Promise<AgentStagedOffer[]> {
    const list = getLocal<AgentStagedOffer[]>(STORAGE_KEYS.AGENT_STAGED_OFFERS, []);
    if (statusFilter) {
      return list.filter((item) => item.status === statusFilter);
    }
    return list;
  },

  async stageOffer(data: Partial<AgentStagedOffer>): Promise<AgentStagedOffer> {
    const list = getLocal<AgentStagedOffer[]>(STORAGE_KEYS.AGENT_STAGED_OFFERS, []);
    const id = data.id || `stg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const staged: AgentStagedOffer = {
      id,
      product_name: (data.product_name || (data as any).title || (data as any).name || (data as any).nome || 'Oferta Minerada').trim(),
      advertiser: (data.advertiser || (data as any).anunciante || 'Anunciante Desconhecido').trim(),
      price: typeof data.price === 'number' && !isNaN(data.price) ? data.price : null,
      currency: data.currency || 'BRL',
      niche: data.niche || (data as any).nicho || null,
      subniche: data.subniche || (data as any).subnicho || null,
      landing_page_url: data.landing_page_url || (data as any).landingPageUrl || (data as any).url || null,
      checkout_url: data.checkout_url || (data as any).checkoutUrl || null,
      meta_ads_url: data.meta_ads_url || (data as any).metaAdsUrl || (data as any).ad_url || null,
      active_ads_count: typeof data.active_ads_count === 'number' ? data.active_ads_count : null,
      headline: data.headline || (data as any).manchete || null,
      promise: data.promise || (data as any).promessa || null,
      status: 'PENDING_APPROVAL',
      mined_at: data.mined_at || now,
      source: data.source || 'BROWSER_USE_AGENT',
      raw_data: data.raw_data || null,
    };

    const existingIdx = list.findIndex(
      (item) =>
        (staged.landing_page_url && item.landing_page_url && item.landing_page_url === staged.landing_page_url) ||
        (item.product_name.toLowerCase().trim() === staged.product_name.toLowerCase().trim())
    );

    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...staged, id: list[existingIdx].id };
      setLocal(STORAGE_KEYS.AGENT_STAGED_OFFERS, list);
      return list[existingIdx];
    } else {
      list.unshift(staged);
      setLocal(STORAGE_KEYS.AGENT_STAGED_OFFERS, list);
      return staged;
    }
  },

  async stageOffersBatch(offers: Partial<AgentStagedOffer>[]): Promise<{ count: number; staged: AgentStagedOffer[] }> {
    const stagedList: AgentStagedOffer[] = [];
    for (const item of offers) {
      if (!item) continue;
      const staged = await this.stageOffer(item);
      stagedList.push(staged);
    }
    return { count: stagedList.length, staged: stagedList };
  },

  async approveStagedOffer(id: string): Promise<{ success: boolean; offer?: Offer }> {
    const list = getLocal<AgentStagedOffer[]>(STORAGE_KEYS.AGENT_STAGED_OFFERS, []);
    const target = list.find((item) => item.id === id);
    if (!target) return { success: false };

    // Save as canonical offer in offers table
    const canonicalOffer = await this.saveOffer({
      product_name: target.product_name,
      advertiser: target.advertiser,
      price: target.price,
      currency: target.currency || 'BRL',
      niche: target.niche,
      subniche: target.subniche,
      landing_page_url: target.landing_page_url,
      checkout_url: target.checkout_url,
      meta_ads_url: target.meta_ads_url,
      active_ads_count: target.active_ads_count,
      headline: target.headline,
      promise: target.promise,
      status: 'DADOS_PARCIAIS',
      source: 'AGENT_MINED',
      lp_mapping_status: 'NOT_MAPPED',
      checkout_mapping_status: 'NOT_MAPPED',
      data_scraping_status: 'NOT_PROCESSED',
    });

    target.status = 'APPROVED';
    setLocal(STORAGE_KEYS.AGENT_STAGED_OFFERS, list);

    return { success: true, offer: canonicalOffer };
  },

  async rejectStagedOffer(id: string): Promise<boolean> {
    let list = getLocal<AgentStagedOffer[]>(STORAGE_KEYS.AGENT_STAGED_OFFERS, []);
    const initialLen = list.length;
    list = list.filter((item) => item.id !== id);
    setLocal(STORAGE_KEYS.AGENT_STAGED_OFFERS, list);
    return list.length < initialLen;
  },

  async approveAllStagedOffers(): Promise<{ approvedCount: number; offers: Offer[] }> {
    const list = getLocal<AgentStagedOffer[]>(STORAGE_KEYS.AGENT_STAGED_OFFERS, []);
    const pending = list.filter((item) => item.status === 'PENDING_APPROVAL');
    const approvedOffers: Offer[] = [];

    for (const item of pending) {
      const res = await this.approveStagedOffer(item.id);
      if (res.success && res.offer) {
        approvedOffers.push(res.offer);
      }
    }

    return { approvedCount: approvedOffers.length, offers: approvedOffers };
  },

  async clearStagedOffers(statusFilter?: string): Promise<void> {
    if (statusFilter) {
      let list = getLocal<AgentStagedOffer[]>(STORAGE_KEYS.AGENT_STAGED_OFFERS, []);
      list = list.filter((item) => item.status !== statusFilter);
      setLocal(STORAGE_KEYS.AGENT_STAGED_OFFERS, list);
    } else {
      setLocal(STORAGE_KEYS.AGENT_STAGED_OFFERS, []);
    }
  },
};
