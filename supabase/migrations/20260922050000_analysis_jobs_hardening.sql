-- ==============================================================================
-- OFFER MINER - ANALYSIS JOBS HARDENING & SERVERLESS ATOMIC STEPS MIGRATION
-- ==============================================================================
-- Ensures offer_analysis_jobs supports atomic step execution, heartbeats,
-- staleness watchdog, workspace isolation and Row Level Security.

-- 1. ADD NEW COLUMNS IF NOT EXIST
DO $$
BEGIN
    -- workspace_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'ws_default_001' REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;

    -- current_step
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'current_step') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN current_step TEXT DEFAULT 'RESOLVE_META';
    END IF;

    -- progress_percent
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'progress_percent') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN progress_percent INTEGER DEFAULT 0;
    END IF;

    -- last_heartbeat_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'last_heartbeat_at') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN last_heartbeat_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- attempt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'attempt') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN attempt INTEGER DEFAULT 1;
    END IF;

    -- max_attempts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'max_attempts') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN max_attempts INTEGER DEFAULT 3;
    END IF;

    -- error_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'error_code') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN error_code TEXT;
    END IF;

    -- error_message_safe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'error_message_safe') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN error_message_safe TEXT;
    END IF;

    -- failed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'offer_analysis_jobs' AND column_name = 'failed_at') THEN
        ALTER TABLE public.offer_analysis_jobs ADD COLUMN failed_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_ws ON public.offer_analysis_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON public.offer_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_heartbeat ON public.offer_analysis_jobs(last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_offer ON public.offer_analysis_jobs(offer_id);

-- 3. RLS POLICIES FOR OFFER_ANALYSIS_JOBS
ALTER TABLE public.offer_analysis_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members select offer_analysis_jobs" ON public.offer_analysis_jobs;
CREATE POLICY "Workspace members select offer_analysis_jobs" ON public.offer_analysis_jobs
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members insert offer_analysis_jobs" ON public.offer_analysis_jobs;
CREATE POLICY "Workspace members insert offer_analysis_jobs" ON public.offer_analysis_jobs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members update offer_analysis_jobs" ON public.offer_analysis_jobs;
CREATE POLICY "Workspace members update offer_analysis_jobs" ON public.offer_analysis_jobs
    FOR UPDATE TO authenticated
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members delete offer_analysis_jobs" ON public.offer_analysis_jobs;
CREATE POLICY "Workspace members delete offer_analysis_jobs" ON public.offer_analysis_jobs
    FOR DELETE TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Fallback policies for serverless background workers and default workspace access
DROP POLICY IF EXISTS "Public fallback select offer_analysis_jobs" ON public.offer_analysis_jobs;
CREATE POLICY "Public fallback select offer_analysis_jobs" ON public.offer_analysis_jobs
    FOR SELECT TO anon
    USING (workspace_id = 'ws_default_001');

DROP POLICY IF EXISTS "Public fallback insert offer_analysis_jobs" ON public.offer_analysis_jobs;
CREATE POLICY "Public fallback insert offer_analysis_jobs" ON public.offer_analysis_jobs
    FOR INSERT TO anon
    WITH CHECK (workspace_id = 'ws_default_001');

DROP POLICY IF EXISTS "Public fallback update offer_analysis_jobs" ON public.offer_analysis_jobs;
CREATE POLICY "Public fallback update offer_analysis_jobs" ON public.offer_analysis_jobs
    FOR UPDATE TO anon
    USING (workspace_id = 'ws_default_001');

-- Also ensure offers fallback policies exist for anon in default workspace
DROP POLICY IF EXISTS "Public fallback select offers" ON public.offers;
CREATE POLICY "Public fallback select offers" ON public.offers
    FOR SELECT TO anon
    USING (workspace_id = 'ws_default_001');

DROP POLICY IF EXISTS "Public fallback insert offers" ON public.offers;
CREATE POLICY "Public fallback insert offers" ON public.offers
    FOR INSERT TO anon
    WITH CHECK (workspace_id = 'ws_default_001');

DROP POLICY IF EXISTS "Public fallback update offers" ON public.offers;
CREATE POLICY "Public fallback update offers" ON public.offers
    FOR UPDATE TO anon
    USING (workspace_id = 'ws_default_001');

-- 4. CLEANUP / AUTO-RECOVER EXISTING STALE JOBS (> 5 min without heartbeat)
UPDATE public.offer_analysis_jobs
SET status = 'stale',
    error_code = 'TIMEOUT_STALE_RECOVERED',
    error_message_safe = 'Análise expirada (mais de 5 minutos sem comunicação com o worker). Você pode tentar novamente.',
    updated_at = NOW()
WHERE status IN ('running', 'queued', 'pending')
  AND (last_heartbeat_at IS NULL OR last_heartbeat_at < NOW() - INTERVAL '5 minutes');
