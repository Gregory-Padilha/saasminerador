-- ==============================================================================
-- OFFER MINER - SECURITY HARDENING & MULTI-TENANT WORKSPACE MIGRATION (V5)
-- Establishes Workspaces, Workspace Members, Strict RLS, and Backfills Existing Data
-- Preserves 100% of existing data (0 rows lost)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT PRIMARY KEY DEFAULT ('ws_' || substr(gen_random_uuid()::text, 1, 12)),
    name TEXT NOT NULL DEFAULT 'Offer Miner Principal',
    slug TEXT UNIQUE DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WORKSPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')) DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);

-- 4. INSERT DEFAULT CANONICAL WORKSPACE
INSERT INTO public.workspaces (id, name, slug)
VALUES ('ws_default_001', 'Offer Miner Principal', 'default')
ON CONFLICT (id) DO NOTHING;

-- 5. ADD WORKSPACE_ID TO PRIMARY ENTITY TABLES
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.mapping_batches ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.deep_dives ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.creative_capture_jobs ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.agent_staged_offers ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 6. CAREFULLY BACKFILL EXISTING DATA TO DEFAULT WORKSPACE (0 DATA LOSS)
UPDATE public.offers SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;
UPDATE public.import_batches SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;
UPDATE public.mapping_batches SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;
UPDATE public.deep_dives SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;
UPDATE public.saved_views SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;
UPDATE public.creative_capture_jobs SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;
UPDATE public.agent_staged_offers SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;
UPDATE public.user_settings SET workspace_id = 'ws_default_001' WHERE workspace_id IS NULL;

-- 7. ENFORCE NOT NULL ON PRIMARY ENTITIES
ALTER TABLE public.offers ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.import_batches ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.mapping_batches ALTER COLUMN workspace_id SET NOT NULL;

-- 8. PERFORMANCE INDEXES ON WORKSPACE_ID
CREATE INDEX IF NOT EXISTS idx_offers_workspace_id ON public.offers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_workspace_id ON public.import_batches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mapping_batches_workspace_id ON public.mapping_batches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deep_dives_workspace_id ON public.deep_dives(workspace_id);

-- 9. HELPER FUNCTIONS FOR ROW LEVEL SECURITY (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_workspace_role(ws_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
    LIMIT 1;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(ws_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
          AND role IN ('OWNER', 'ADMIN')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 10. BOOTSTRAP: AUTO-ASSIGN FIRST REGISTERED USER AS OWNER
CREATE OR REPLACE FUNCTION public.handle_new_user_membership()
RETURNS trigger AS $$
DECLARE
    v_member_count INT;
BEGIN
    SELECT count(*) INTO v_member_count
    FROM public.workspace_members
    WHERE workspace_id = 'ws_default_001';

    IF v_member_count = 0 THEN
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES ('ws_default_001', NEW.id, 'OWNER')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_workspace
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_membership();

-- Also grant OWNER to any pre-existing user in auth.users if no members exist yet
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT 'ws_default_001', id, 'OWNER'
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 11. DROP ALL PERMISSIVE "Public access %" POLICIES
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
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I;', tbl, tbl);
    END LOOP;
END $$;

-- 12. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
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

-- 13. POLICIES: WORKSPACES & WORKSPACE_MEMBERS
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces" ON public.workspaces
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS "Owners can update workspace" ON public.workspaces;
CREATE POLICY "Owners can update workspace" ON public.workspaces
    FOR UPDATE TO authenticated
    USING (public.get_user_workspace_role(id) = 'OWNER');

DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members" ON public.workspace_members
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Admins and Owners can manage workspace members" ON public.workspace_members;
CREATE POLICY "Admins and Owners can manage workspace members" ON public.workspace_members
    FOR ALL TO authenticated
    USING (public.is_workspace_admin_or_owner(workspace_id))
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

-- 14. POLICIES: PROFILES & USER SETTINGS
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL TO authenticated
    USING (id = auth.uid()::text)
    WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings
    FOR ALL TO authenticated
    USING (user_id = auth.uid()::text OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)))
    WITH CHECK (user_id = auth.uid()::text OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

-- 15. POLICIES: PRIMARY WORKSPACE ENTITIES (offers, import_batches, mapping_batches, deep_dives, saved_views, creative_capture_jobs, agent_staged_offers)
DO $$
DECLARE
    tbl text;
    workspace_tables text[] := ARRAY[
        'offers', 'import_batches', 'mapping_batches', 'deep_dives',
        'saved_views', 'creative_capture_jobs', 'agent_staged_offers'
    ];
BEGIN
    FOREACH tbl IN ARRAY workspace_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Workspace members select %s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Workspace members select %s" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "Workspace members insert %s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Workspace members insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id) AND public.get_user_workspace_role(workspace_id) IN (''OWNER'', ''ADMIN'', ''MEMBER''));', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "Workspace members update %s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Workspace members update %s" ON public.%I FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id) AND public.get_user_workspace_role(workspace_id) IN (''OWNER'', ''ADMIN'', ''MEMBER''));', tbl, tbl);

        EXECUTE format('DROP POLICY IF EXISTS "Workspace admins delete %s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Workspace admins delete %s" ON public.%I FOR DELETE TO authenticated USING (public.is_workspace_admin_or_owner(workspace_id));', tbl, tbl);
    END LOOP;
END $$;

-- 16. POLICIES: CHILD OFFER TABLES (Access via parent offer relationship)
DO $$
DECLARE
    tbl text;
    child_tables text[] := ARRAY[
        'offer_snapshots', 'offer_creatives', 'offer_ads',
        'landing_page_captures', 'checkout_captures', 'offer_deliverables',
        'offer_bonuses', 'offer_order_bumps', 'offer_upsells',
        'offer_funnel_steps', 'offer_proofs', 'offer_analysis',
        'offer_analysis_jobs', 'offer_frontend_options'
    ];
BEGIN
    FOREACH tbl IN ARRAY child_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Workspace members manage %s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Workspace members manage %s" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id)));', tbl, tbl);
    END LOOP;
END $$;

-- 17. POLICIES: SECOND-TIER CHILD TABLES (offer_ad_media, landing_page_sections, landing_page_links, import_rows, mapping_jobs)
DROP POLICY IF EXISTS "Workspace members manage offer_ad_media" ON public.offer_ad_media;
CREATE POLICY "Workspace members manage offer_ad_media" ON public.offer_ad_media
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id)));

DROP POLICY IF EXISTS "Workspace members manage landing_page_sections" ON public.landing_page_sections;
CREATE POLICY "Workspace members manage landing_page_sections" ON public.landing_page_sections
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id)));

DROP POLICY IF EXISTS "Workspace members manage landing_page_links" ON public.landing_page_links;
CREATE POLICY "Workspace members manage landing_page_links" ON public.landing_page_links
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.is_workspace_member(o.workspace_id)));

DROP POLICY IF EXISTS "Workspace members manage import_rows" ON public.import_rows;
CREATE POLICY "Workspace members manage import_rows" ON public.import_rows
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.import_batches ib WHERE ib.id = import_batch_id AND public.is_workspace_member(ib.workspace_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches ib WHERE ib.id = import_batch_id AND public.is_workspace_member(ib.workspace_id)));

DROP POLICY IF EXISTS "Workspace members manage mapping_jobs" ON public.mapping_jobs;
CREATE POLICY "Workspace members manage mapping_jobs" ON public.mapping_jobs
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.mapping_batches mb WHERE mb.id = batch_id AND public.is_workspace_member(mb.workspace_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.mapping_batches mb WHERE mb.id = batch_id AND public.is_workspace_member(mb.workspace_id)));

-- 18. SERVICE ROLE FULL ACCESS (Server-side background processes, migrations & seed scripts)
DO $$
DECLARE
    tbl text;
    all_tables text[] := ARRAY[
        'workspaces', 'workspace_members', 'profiles', 'user_settings', 'import_batches',
        'offers', 'import_rows', 'offer_snapshots', 'offer_creatives', 'offer_ads',
        'offer_ad_media', 'landing_page_captures', 'landing_page_sections',
        'landing_page_links', 'checkout_captures', 'offer_deliverables',
        'offer_bonuses', 'offer_order_bumps', 'offer_upsells',
        'offer_funnel_steps', 'offer_proofs', 'offer_analysis',
        'offer_analysis_jobs', 'offer_frontend_options', 'mapping_batches',
        'mapping_jobs', 'agent_staged_offers', 'deep_dives', 'saved_views',
        'creative_capture_jobs'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Service role bypass %s" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Service role bypass %s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;
