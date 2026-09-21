-- ==============================================================================
-- OFFER MINER - CANONICAL SUPABASE SCHEMA (V4 CANONICAL)
-- Complete schema for all 26 collections representing current Offer Miner platform
-- Preserves UUIDs, created_at, relationships, raw metadata and audit trails
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
    import_type TEXT DEFAULT 'SHEETS',
    sheet_count INTEGER DEFAULT 1,
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    warning_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    updated_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    invalid_rows INTEGER DEFAULT 0,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OFFERS TABLE (Canonical Model with complete provenance and metrics)
CREATE TABLE IF NOT EXISTS public.offers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    product_name TEXT NOT NULL,
    offer_name TEXT,
    advertiser TEXT,
    niche TEXT,
    subniche TEXT,
    product_type TEXT,
    price NUMERIC,
    currency TEXT DEFAULT 'BRL',
    active_ads_count INTEGER,
    estimated_unique_creatives INTEGER,
    unique_creatives_count INTEGER,
    oldest_ad_date DATE,
    newest_ad_date DATE,
    days_running INTEGER,
    calculated_days_running INTEGER,
    faceless BOOLEAN,
    meta_ads_url TEXT,
    landing_page_url TEXT,
    landing_page_url_original TEXT,
    landing_page_url_resolved TEXT,
    landing_page_domain TEXT,
    landing_page_url_source TEXT,
    landing_page_url_status TEXT,
    landing_page_url_last_checked_at TIMESTAMPTZ,
    landing_page_resolution_source TEXT,
    landing_page_resolution_diagnostic JSONB DEFAULT '{}'::jsonb,
    lp_mapping_status TEXT DEFAULT 'NOT_MAPPED',
    lp_mapped_at TIMESTAMPTZ,
    lp_last_error TEXT,
    mapped_source_url TEXT,
    mapper_version TEXT,
    checkout_url TEXT,
    checkout_platform TEXT,
    checkout_discovery_status TEXT DEFAULT 'NOT_PROCESSED',
    checkout_discovery_at TIMESTAMPTZ,
    checkout_mapping_status TEXT DEFAULT 'NOT_MAPPED',
    checkout_mapped_at TIMESTAMPTZ,
    checkout_last_error TEXT,
    headline TEXT,
    subheadline TEXT,
    promise TEXT,
    problem TEXT,
    transformation TEXT,
    target_audience TEXT,
    audience_profile JSONB DEFAULT '{}'::jsonb,
    ad_format TEXT,
    guarantee TEXT,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    score NUMERIC,
    work_score NUMERIC,
    discovery_score NUMERIC,
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
    archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_by_user BOOLEAN DEFAULT FALSE,
    dedupe_key TEXT NOT NULL,
    source TEXT DEFAULT 'IMPORT',
    source_file_name TEXT,
    sheet_name TEXT,
    row_number INTEGER,
    source_import_batch_id TEXT REFERENCES public.import_batches(id) ON DELETE SET NULL,
    source_import_row_id TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    extra_data JSONB DEFAULT '{}'::jsonb,
    front_options_count INTEGER DEFAULT 0,
    front_price_min NUMERIC,
    front_price_max NUMERIC,
    front_price_avg NUMERIC,
    data_scraping_status TEXT DEFAULT 'NOT_PROCESSED',
    data_scraping_started_at TIMESTAMPTZ,
    data_scraping_completed_at TIMESTAMPTZ,
    data_scraping_version TEXT,
    data_scraping_reconciliation JSONB DEFAULT '{}'::jsonb,
    provenance_map JSONB DEFAULT '{}'::jsonb,
    captured_ads_count INTEGER DEFAULT 0,
    captured_unique_creatives INTEGER DEFAULT 0,
    captured_creatives_count INTEGER DEFAULT 0,
    captured_videos_count INTEGER DEFAULT 0,
    captured_images_count INTEGER DEFAULT 0,
    stored_media_count INTEGER DEFAULT 0,
    last_creatives_capture_at TIMESTAMPTZ,
    active_ads_count_source TEXT,
    active_ads_count_observed_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_imported_at TIMESTAMPTZ DEFAULT NOW(),
    is_demo_data BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. IMPORT ROWS TABLE (Raw row preservation & audit)
CREATE TABLE IF NOT EXISTS public.import_rows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    import_batch_id TEXT REFERENCES public.import_batches(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    normalized_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    import_status TEXT DEFAULT 'inserted',
    offer_id TEXT REFERENCES public.offers(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. OFFER SNAPSHOTS TABLE (Historical tracking of scale & metrics)
CREATE TABLE IF NOT EXISTS public.offer_snapshots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    active_ads_count INTEGER,
    estimated_unique_creatives INTEGER,
    days_running INTEGER,
    oldest_ad_date DATE,
    price NUMERIC,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    import_batch_id TEXT REFERENCES public.import_batches(id) ON DELETE SET NULL
);

-- 8. OFFER CREATIVES TABLE
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

-- 9. OFFER ADS TABLE
CREATE TABLE IF NOT EXISTS public.offer_ads (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    meta_ad_id TEXT,
    meta_ad_url TEXT,
    advertiser TEXT,
    status TEXT DEFAULT 'ACTIVE',
    ad_status TEXT DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ,
    primary_text TEXT,
    headline TEXT,
    description TEXT,
    cta TEXT,
    destination_url TEXT,
    card_screenshot_path TEXT,
    card_screenshot_url TEXT,
    capture_status TEXT DEFAULT 'COMPLETED',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. OFFER AD MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.offer_ad_media (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    offer_ad_id TEXT REFERENCES public.offer_ads(id) ON DELETE CASCADE,
    media_type TEXT DEFAULT 'image',
    mime_type TEXT,
    original_url TEXT,
    storage_path TEXT,
    thumbnail_path TEXT,
    media_url TEXT,
    thumbnail_url TEXT,
    file_hash TEXT,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    duration_seconds NUMERIC,
    is_primary BOOLEAN DEFAULT FALSE,
    capture_status TEXT DEFAULT 'COMPLETED',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. LANDING PAGE CAPTURES TABLE
CREATE TABLE IF NOT EXISTS public.landing_page_captures (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    final_url TEXT NOT NULL,
    domain TEXT,
    http_status INTEGER DEFAULT 200,
    page_title TEXT,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    desktop_screenshot_path TEXT,
    desktop_screenshot_url TEXT,
    mobile_screenshot_path TEXT,
    mobile_screenshot_url TEXT,
    full_page_screenshot_path TEXT,
    full_page_screenshot_url TEXT,
    hero_screenshot_path TEXT,
    hero_screenshot_url TEXT,
    html_snapshot_path TEXT,
    capture_status TEXT DEFAULT 'COMPLETED',
    error_message TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. LANDING PAGE SECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.landing_page_sections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    landing_page_capture_id TEXT REFERENCES public.landing_page_captures(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    position_index INTEGER DEFAULT 0,
    heading TEXT,
    text_content TEXT,
    dom_selector TEXT,
    top_offset NUMERIC,
    bottom_offset NUMERIC,
    screenshot_path TEXT,
    screenshot_url TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. LANDING PAGE LINKS TABLE
CREATE TABLE IF NOT EXISTS public.landing_page_links (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    capture_id TEXT REFERENCES public.landing_page_captures(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    text TEXT,
    url TEXT NOT NULL,
    domain TEXT,
    link_type TEXT DEFAULT 'OTHER',
    checkout_platform TEXT,
    section_type TEXT,
    is_external BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. CHECKOUT CAPTURES TABLE
CREATE TABLE IF NOT EXISTS public.checkout_captures (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    checkout_url TEXT NOT NULL,
    final_url TEXT NOT NULL,
    provider TEXT,
    status TEXT DEFAULT 'SUCCESS',
    bumps_status TEXT DEFAULT 'NONE',
    front_price NUMERIC,
    currency TEXT DEFAULT 'BRL',
    order_bumps_count INTEGER DEFAULT 0,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    full_page_screenshot_url TEXT,
    price_mismatch BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. OFFER DELIVERABLES TABLE
CREATE TABLE IF NOT EXISTS public.offer_deliverables (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    title TEXT,
    name TEXT,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    source TEXT,
    capture_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. OFFER BONUSES TABLE
CREATE TABLE IF NOT EXISTS public.offer_bonuses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    title TEXT,
    name TEXT,
    description TEXT,
    claimed_value NUMERIC,
    advertised_value NUMERIC,
    order_index INTEGER DEFAULT 0,
    source TEXT,
    capture_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. OFFER ORDER BUMPS TABLE
CREATE TABLE IF NOT EXISTS public.offer_order_bumps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    description TEXT
);

-- 18. OFFER UPSELLS TABLE
CREATE TABLE IF NOT EXISTS public.offer_upsells (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    url TEXT,
    description TEXT
);

-- 19. OFFER FUNNEL STEPS TABLE
CREATE TABLE IF NOT EXISTS public.offer_funnel_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    step_type TEXT NOT NULL,
    title TEXT NOT NULL,
    price NUMERIC,
    url TEXT,
    domain TEXT,
    provider TEXT,
    source TEXT,
    source_link_text TEXT,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    order_index INTEGER DEFAULT 0
);

-- 20. OFFER PROOFS TABLE
CREATE TABLE IF NOT EXISTS public.offer_proofs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    proof_type TEXT DEFAULT 'TESTIMONIAL',
    title TEXT,
    quote TEXT,
    source TEXT,
    rating TEXT
);

-- 21. OFFER ANALYSIS TABLE
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

-- 22. OFFER ANALYSIS JOBS TABLE
CREATE TABLE IF NOT EXISTS public.offer_analysis_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    input_url TEXT,
    meta_ads_url_original TEXT,
    status TEXT DEFAULT 'QUEUED',
    current_stage TEXT,
    stage_message TEXT,
    progress_data JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    mode TEXT DEFAULT 'STANDARD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 23. OFFER FRONTEND OPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.offer_frontend_options (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    original_option_id TEXT,
    landing_page_capture_id TEXT REFERENCES public.landing_page_captures(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    current_price NUMERIC NOT NULL,
    original_price NUMERIC,
    currency TEXT DEFAULT 'BRL',
    billing_type TEXT DEFAULT 'single',
    billing_period TEXT,
    installments INTEGER,
    installment_value NUMERIC,
    cta_text TEXT,
    cta_url TEXT,
    position_index INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    source TEXT,
    source_section TEXT,
    source_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. MAPPING BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.mapping_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    concurrency INTEGER DEFAULT 2,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    partial_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    current_offer_id TEXT,
    current_offer_name TEXT,
    current_step TEXT,
    current_progress_percent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. MAPPING JOBS TABLE
CREATE TABLE IF NOT EXISTS public.mapping_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_id TEXT NOT NULL REFERENCES public.mapping_batches(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    offer_name TEXT NOT NULL,
    advertiser TEXT,
    target_url TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    current_step TEXT,
    progress_percent NUMERIC DEFAULT 0,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. AGENT STAGED OFFERS TABLE
CREATE TABLE IF NOT EXISTS public.agent_staged_offers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    product_name TEXT NOT NULL,
    advertiser TEXT,
    price NUMERIC,
    currency TEXT DEFAULT 'BRL',
    niche TEXT,
    subniche TEXT,
    landing_page_url TEXT,
    checkout_url TEXT,
    meta_ads_url TEXT,
    active_ads_count INTEGER DEFAULT 0,
    headline TEXT,
    promise TEXT,
    status TEXT DEFAULT 'PENDING',
    mined_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'AGENT',
    raw_data JSONB DEFAULT '{}'::jsonb
);

-- 27. DEEP DIVES TABLE
CREATE TABLE IF NOT EXISTS public.deep_dives (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    offer_id TEXT NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Fila',
    priority TEXT DEFAULT 'Media',
    notes TEXT,
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. SAVED VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.saved_views (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    name TEXT NOT NULL,
    filters_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. CREATIVE CAPTURE JOBS TABLE
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

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_niche ON public.offers(niche);
CREATE INDEX IF NOT EXISTS idx_offers_product_name ON public.offers(product_name);
CREATE INDEX IF NOT EXISTS idx_offers_advertiser ON public.offers(advertiser);
CREATE INDEX IF NOT EXISTS idx_offers_active_ads ON public.offers(active_ads_count DESC);
CREATE INDEX IF NOT EXISTS idx_offers_system_score ON public.offers(system_score DESC);
CREATE INDEX IF NOT EXISTS idx_offers_opportunity_score ON public.offers(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_offers_momentum ON public.offers(momentum_score DESC);
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON public.offers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_dedupe_key ON public.offers(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_offers_landing_page_url ON public.offers(landing_page_url);
CREATE INDEX IF NOT EXISTS idx_offers_checkout_url ON public.offers(checkout_url);
CREATE INDEX IF NOT EXISTS idx_offers_meta_ads_url ON public.offers(meta_ads_url);
CREATE INDEX IF NOT EXISTS idx_offers_source_batch ON public.offers(source_import_batch_id);

CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.import_rows(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_offer ON public.import_rows(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_snapshots_offer ON public.offer_snapshots(offer_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_creatives_offer ON public.offer_creatives(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_creatives_meta_ad ON public.offer_creatives(meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_offer_ads_offer ON public.offer_ads(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_ads_meta_ad ON public.offer_ads(meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_offer_ad_media_ad ON public.offer_ad_media(offer_ad_id);
CREATE INDEX IF NOT EXISTS idx_offer_ad_media_offer ON public.offer_ad_media(offer_id);
CREATE INDEX IF NOT EXISTS idx_lp_captures_offer ON public.landing_page_captures(offer_id);
CREATE INDEX IF NOT EXISTS idx_lp_sections_capture ON public.landing_page_sections(landing_page_capture_id);
CREATE INDEX IF NOT EXISTS idx_lp_sections_offer ON public.landing_page_sections(offer_id);
CREATE INDEX IF NOT EXISTS idx_lp_links_capture ON public.landing_page_links(capture_id);
CREATE INDEX IF NOT EXISTS idx_lp_links_offer ON public.landing_page_links(offer_id);
CREATE INDEX IF NOT EXISTS idx_checkout_captures_offer ON public.checkout_captures(offer_id);
CREATE INDEX IF NOT EXISTS idx_frontend_options_offer ON public.offer_frontend_options(offer_id);
CREATE INDEX IF NOT EXISTS idx_mapping_jobs_batch ON public.mapping_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_mapping_jobs_offer ON public.mapping_jobs(offer_id);
CREATE INDEX IF NOT EXISTS idx_deep_dives_offer ON public.deep_dives(offer_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_ad_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_order_bumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_frontend_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_staged_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deep_dives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_capture_jobs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for web application operations (anon, authenticated and service_role)
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'profiles', 'user_settings', 'import_batches', 'offers', 'import_rows',
        'offer_snapshots', 'offer_creatives', 'offer_ads', 'offer_ad_media',
        'landing_page_captures', 'landing_page_sections', 'landing_page_links',
        'checkout_captures', 'offer_deliverables', 'offer_bonuses',
        'offer_order_bumps', 'offer_upsells', 'offer_funnel_steps',
        'offer_proofs', 'offer_analysis', 'offer_analysis_jobs',
        'offer_frontend_options', 'mapping_batches', 'mapping_jobs',
        'agent_staged_offers', 'deep_dives', 'saved_views', 'creative_capture_jobs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access %s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Public access %s" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role;', tbl);
    END LOOP;
END $$;
