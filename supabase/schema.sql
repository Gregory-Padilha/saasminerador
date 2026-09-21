-- ==============================================================================
-- OFFER MINER / OFFER INTELLIGENCE PLATFORM - SUPABASE SQL SCHEMA (v3)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    min_price NUMERIC DEFAULT 10.00,
    max_price NUMERIC DEFAULT 50.00,
    min_ads INTEGER DEFAULT 5,
    max_ads INTEGER DEFAULT 50,
    min_days INTEGER DEFAULT 10,
    max_days INTEGER DEFAULT 30,
    require_faceless BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. IMPORT BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.import_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    file_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    sheet_count INTEGER DEFAULT 1,
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    warning_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    updated_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    invalid_rows INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OFFERS TABLE (Comprehensive Offer Intelligence Model)
CREATE TABLE IF NOT EXISTS public.offers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    product_name TEXT NOT NULL,
    advertiser TEXT,
    niche TEXT,
    subniche TEXT,
    product_type TEXT,
    price NUMERIC,
    currency TEXT DEFAULT 'BRL',
    active_ads_count INTEGER,
    oldest_ad_date DATE,
    newest_ad_date DATE,
    days_running INTEGER,
    faceless BOOLEAN,
    meta_ads_url TEXT,
    landing_page_url TEXT,
    checkout_url TEXT,
    landing_page_domain TEXT,
    headline TEXT,
    subheadline TEXT,
    promise TEXT,
    problem TEXT,
    transformation TEXT,
    target_audience TEXT,
    ad_format TEXT,
    guarantee TEXT,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    score NUMERIC,
    work_score NUMERIC,
    system_score NUMERIC,
    opportunity_score NUMERIC,
    momentum_score NUMERIC,
    trend TEXT DEFAULT 'NOVO',
    activity_status TEXT DEFAULT 'Ativa',
    status TEXT DEFAULT 'REVISAR',
    decision TEXT DEFAULT 'Observar',
    favorite BOOLEAN DEFAULT FALSE,
    watching BOOLEAN DEFAULT FALSE,
    in_deep_dive BOOLEAN DEFAULT FALSE,
    dedupe_key TEXT NOT NULL,
    source_file_name TEXT,
    sheet_name TEXT,
    row_number INTEGER,
    source_import_batch_id TEXT REFERENCES public.import_batches(id) ON DELETE SET NULL,
    source_import_row_id TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    extra_data JSONB DEFAULT '{}'::jsonb,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_imported_at TIMESTAMPTZ DEFAULT NOW(),
    is_demo_data BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. IMPORT ROWS TABLE (Granular audit & raw preservation for every single row)
CREATE TABLE IF NOT EXISTS public.import_rows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    import_batch_id TEXT NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    normalized_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    import_status TEXT DEFAULT 'inserted',
    offer_id TEXT REFERENCES public.offers(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. OFFER SNAPSHOTS TABLE (Historical tracking of scale & ads count)
CREATE TABLE IF NOT EXISTS public.offer_snapshots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    active_ads_count INTEGER,
    days_running INTEGER,
    oldest_ad_date DATE,
    price NUMERIC,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    import_batch_id TEXT REFERENCES public.import_batches(id) ON DELETE SET NULL
);

-- 8. OFFER CREATIVES TABLE (Enhanced for Storage, Media Types & Deduplication)
CREATE TABLE IF NOT EXISTS public.offer_creatives (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    capture_job_id TEXT,
    meta_ad_id TEXT,
    meta_ad_url TEXT,
    media_type TEXT DEFAULT 'video',
    mime_type TEXT,
    storage_path TEXT,
    thumbnail_path TEXT,
    media_url TEXT,
    thumbnail_url TEXT,
    original_media_url TEXT,
    file_hash TEXT,
    file_size BIGINT,
    duration_seconds NUMERIC,
    width INTEGER,
    height INTEGER,
    ad_url TEXT,
    format TEXT DEFAULT 'Vídeo',
    hook TEXT,
    angle TEXT,
    headline TEXT,
    primary_text TEXT,
    cta TEXT,
    started_at DATE,
    first_captured_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    capture_status TEXT DEFAULT 'completed',
    status TEXT DEFAULT 'Ativo',
    notes TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. OFFER DELIVERABLES TABLE
CREATE TABLE IF NOT EXISTS public.offer_deliverables (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0
);

-- 10. OFFER BONUSES TABLE
CREATE TABLE IF NOT EXISTS public.offer_bonuses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    claimed_value NUMERIC,
    order_index INTEGER DEFAULT 0
);

-- 11. OFFER ORDER BUMPS & UPSELLS TABLE
CREATE TABLE IF NOT EXISTS public.offer_order_bumps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.offer_upsells (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    url TEXT,
    description TEXT
);

-- 12. OFFER FUNNEL STEPS TABLE
CREATE TABLE IF NOT EXISTS public.offer_funnel_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    step_type TEXT NOT NULL,
    title TEXT NOT NULL,
    price NUMERIC,
    notes TEXT,
    order_index INTEGER DEFAULT 0
);

-- 13. OFFER ANALYSIS TABLE
CREATE TABLE IF NOT EXISTS public.offer_analysis (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL UNIQUE REFERENCES public.offers(id) ON DELETE CASCADE,
    strengths TEXT,
    weaknesses TEXT,
    why_interesting TEXT,
    what_to_model TEXT,
    what_not_to_copy TEXT,
    differentiation_ideas TEXT,
    adaptation_ideas TEXT,
    risk_score TEXT DEFAULT 'Baixo',
    potential_score TEXT DEFAULT 'Alto',
    decision TEXT DEFAULT 'Observar',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. DEEP DIVES TABLE
CREATE TABLE IF NOT EXISTS public.deep_dives (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Fila',
    priority TEXT DEFAULT 'Media',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. SAVED VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.saved_views (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    name TEXT NOT NULL,
    filters_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. CREATIVE CAPTURE JOBS TABLE (Meta Ads Library background scraping and media ingestion)
CREATE TABLE IF NOT EXISTS public.creative_capture_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    source_url TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    progress INTEGER DEFAULT 0,
    ads_detected INTEGER DEFAULT 0,
    ads_processed INTEGER DEFAULT 0,
    videos_detected INTEGER DEFAULT 0,
    images_detected INTEGER DEFAULT 0,
    new_creatives INTEGER DEFAULT 0,
    existing_creatives INTEGER DEFAULT 0,
    failed_creatives INTEGER DEFAULT 0,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON public.offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_niche ON public.offers(niche);
CREATE INDEX IF NOT EXISTS idx_offers_product_type ON public.offers(product_type);
CREATE INDEX IF NOT EXISTS idx_offers_price ON public.offers(price);
CREATE INDEX IF NOT EXISTS idx_offers_active_ads ON public.offers(active_ads_count DESC);
CREATE INDEX IF NOT EXISTS idx_offers_opportunity_score ON public.offers(system_score DESC);
CREATE INDEX IF NOT EXISTS idx_offers_momentum ON public.offers(momentum_score DESC);
CREATE INDEX IF NOT EXISTS idx_offers_days_running ON public.offers(days_running);
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON public.offers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_last_seen_at ON public.offers(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_dedupe_key ON public.offers(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_offers_favorite ON public.offers(favorite);
CREATE INDEX IF NOT EXISTS idx_offers_watching ON public.offers(watching);
CREATE INDEX IF NOT EXISTS idx_offers_in_deep_dive ON public.offers(in_deep_dive);
CREATE INDEX IF NOT EXISTS idx_offers_source_batch ON public.offers(source_import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.import_rows(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_offer ON public.import_rows(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_snapshots_offer_id ON public.offer_snapshots(offer_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_creatives_offer_id ON public.offer_creatives(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_creatives_meta_ad ON public.offer_creatives(meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_offer_creatives_file_hash ON public.offer_creatives(file_hash);
CREATE INDEX IF NOT EXISTS idx_deep_dives_status ON public.deep_dives(status);
CREATE INDEX IF NOT EXISTS idx_capture_jobs_offer_id ON public.creative_capture_jobs(offer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capture_jobs_status ON public.creative_capture_jobs(status);

-- 18. ROW LEVEL SECURITY (RLS) - PERMISSIVE FOR APP OPERATIONS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_order_bumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deep_dives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_capture_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public access user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Public access import_batches" ON public.import_batches;
DROP POLICY IF EXISTS "Public access import_rows" ON public.import_rows;
DROP POLICY IF EXISTS "Public access offers" ON public.offers;
DROP POLICY IF EXISTS "Public access offer_snapshots" ON public.offer_snapshots;
DROP POLICY IF EXISTS "Public access offer_creatives" ON public.offer_creatives;
DROP POLICY IF EXISTS "Public access offer_deliverables" ON public.offer_deliverables;
DROP POLICY IF EXISTS "Public access offer_bonuses" ON public.offer_bonuses;
DROP POLICY IF EXISTS "Public access offer_order_bumps" ON public.offer_order_bumps;
DROP POLICY IF EXISTS "Public access offer_upsells" ON public.offer_upsells;
DROP POLICY IF EXISTS "Public access offer_funnel_steps" ON public.offer_funnel_steps;
DROP POLICY IF EXISTS "Public access offer_analysis" ON public.offer_analysis;
DROP POLICY IF EXISTS "Public access deep_dives" ON public.deep_dives;
DROP POLICY IF EXISTS "Public access saved_views" ON public.saved_views;
DROP POLICY IF EXISTS "Public access creative_capture_jobs" ON public.creative_capture_jobs;

CREATE POLICY "Public access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access user_settings" ON public.user_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access import_batches" ON public.import_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access import_rows" ON public.import_rows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_snapshots" ON public.offer_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_creatives" ON public.offer_creatives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_deliverables" ON public.offer_deliverables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_bonuses" ON public.offer_bonuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_order_bumps" ON public.offer_order_bumps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_upsells" ON public.offer_upsells FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_funnel_steps" ON public.offer_funnel_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_analysis" ON public.offer_analysis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access deep_dives" ON public.deep_dives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access saved_views" ON public.saved_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access creative_capture_jobs" ON public.creative_capture_jobs FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for both anon & authenticated roles
CREATE POLICY "Public access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access user_settings" ON public.user_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access import_batches" ON public.import_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access import_rows" ON public.import_rows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_snapshots" ON public.offer_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_creatives" ON public.offer_creatives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_deliverables" ON public.offer_deliverables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_bonuses" ON public.offer_bonuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_order_bumps" ON public.offer_order_bumps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_upsells" ON public.offer_upsells FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_funnel_steps" ON public.offer_funnel_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access offer_analysis" ON public.offer_analysis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access deep_dives" ON public.deep_dives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access saved_views" ON public.saved_views FOR ALL USING (true) WITH CHECK (true);
