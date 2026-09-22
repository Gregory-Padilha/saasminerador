-- ==============================================================================
-- OFFER MINER - CANONICAL KNOWLEDGE LIBRARY SCHEMA & PERSISTENCE MIGRATION
-- ==============================================================================
-- Eliminates ephemeral serverless filesystem dependencies (/var/task/scratch/knowledge-db).
-- Migrates knowledge library metadata, documents, and chunks into Supabase Cloud
-- with full workspace isolation and Row Level Security (RLS).

-- 1. KNOWLEDGE SOURCES
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws_default_001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    original_name TEXT,
    source_url TEXT,
    hash TEXT,
    raw_content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. KNOWLEDGE DOCUMENTS
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws_default_001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    original_title TEXT,
    description TEXT,
    canonical_markdown TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'OUTROS',
    knowledge_type TEXT NOT NULL DEFAULT 'PLAYBOOK',
    knowledge_status TEXT NOT NULL DEFAULT 'PROCESSED',
    trust_status TEXT NOT NULL DEFAULT 'VALIDADO',
    source_type TEXT NOT NULL DEFAULT 'PASTED_TEXT',
    source_url TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    collections TEXT[] DEFAULT ARRAY[]::TEXT[],
    language TEXT DEFAULT 'pt-BR',
    processing_status TEXT DEFAULT 'READY',
    raw_transcript TEXT,
    chunk_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. KNOWLEDGE CHUNKS
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws_default_001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    document_title TEXT NOT NULL,
    section TEXT DEFAULT 'Geral',
    category TEXT,
    knowledge_type TEXT,
    chunk_index INTEGER DEFAULT 1,
    content TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    source_type TEXT DEFAULT 'FILE',
    source_url TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_ws ON public.knowledge_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_ws ON public.knowledge_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_cat ON public.knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON public.knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_ws ON public.knowledge_chunks(workspace_id);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Knowledge Sources Policies
DROP POLICY IF EXISTS "Workspace members select knowledge_sources" ON public.knowledge_sources;
CREATE POLICY "Workspace members select knowledge_sources" ON public.knowledge_sources
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage knowledge_sources" ON public.knowledge_sources;
CREATE POLICY "Workspace members manage knowledge_sources" ON public.knowledge_sources
    FOR ALL TO authenticated
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- Knowledge Documents Policies
DROP POLICY IF EXISTS "Workspace members select knowledge_documents" ON public.knowledge_documents;
CREATE POLICY "Workspace members select knowledge_documents" ON public.knowledge_documents
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage knowledge_documents" ON public.knowledge_documents;
CREATE POLICY "Workspace members manage knowledge_documents" ON public.knowledge_documents
    FOR ALL TO authenticated
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- Knowledge Chunks Policies
DROP POLICY IF EXISTS "Workspace members select knowledge_chunks" ON public.knowledge_chunks;
CREATE POLICY "Workspace members select knowledge_chunks" ON public.knowledge_chunks
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members manage knowledge_chunks" ON public.knowledge_chunks;
CREATE POLICY "Workspace members manage knowledge_chunks" ON public.knowledge_chunks
    FOR ALL TO authenticated
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- 6. MIGRATE LOCAL SEED DATA INTO SUPABASE (IDEMPOTENT)
INSERT INTO public.knowledge_sources (id, workspace_id, source_type, original_name, hash, raw_content, created_at)
VALUES (
    'src_test_1789527529553',
    'ws_default_001',
    'PASTED_TEXT',
    'aula_escala_raw_001.txt',
    'c50d046c81d8918bd737159f18918269fbeaa1530ce7da61e536333342e1bb1f',
    'Escala 1-1-100 é a estrutura de alocação de orçamento e criativos no CBO Meta Ads. Consiste em 1 campanha CBO, 1 conjunto de anúncios amplo, e 100 variações de criativos estáticos e vídeos 9:16. A progressão de escala ocorre aumentando 20% do orçamento a cada 6 horas se o CPA permanecer abaixo do limite de R$ 30. Utilizada principalmente para ofertas low-ticket no mercado Brasil e US.',
    '2026-09-16T02:58:49.553Z'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.knowledge_documents (
    id, workspace_id, source_id, title, original_title, description, canonical_markdown,
    category, knowledge_type, knowledge_status, trust_status, source_type,
    tags, topics, collections, language, processing_status, chunk_count, version,
    created_at, updated_at
) VALUES (
    'kdoc_test_1789527529553',
    'ws_default_001',
    'src_test_1789527529553',
    'Escala 1-1-100 — Estrutura e Aplicação',
    'aula_escala_raw_001.txt',
    'Documento de PLAYBOOK sobre Escala 1-1-100 — Estrutura e Aplicação classificado em TRÁFEGO & ESCALA. Contém orientações e acervo de consulta para o Offer Miner.',
    '# Escala 1-1-100 — Estrutura e Aplicação\n\n## Conteúdo Principal\n\nEscala 1-1-100 é a estrutura de alocação de orçamento e criativos no CBO Meta Ads.\n  Consiste em 1 campanha CBO, 1 conjunto de anúncios amplo, e 100 variações de criativos estáticos e vídeos 9:16.\n  A progressão de escala ocorre aumentando 20% do orçamento a cada 6 horas se o CPA permanecer abaixo do limite de R$ 30.\n  Utilizada principalmente para ofertas low-ticket no mercado Brasil e US.',
    'TRÁFEGO & ESCALA',
    'PLAYBOOK',
    'PROCESSED',
    'VALIDADO',
    'PASTED_TEXT',
    ARRAY['TRÁFEGO & ESCALA','PLAYBOOK','1-1-100','Meta Ads','CBO','Low Ticket'],
    ARRAY['TRÁFEGO & ESCALA','PLAYBOOK','1-1-100','Meta Ads','CBO','Low Ticket'],
    ARRAY['TRÁFEGO & ESCALA','Tráfego & Escala','Offer Modeling'],
    'pt-BR',
    'READY',
    1,
    1,
    '2026-09-16T02:58:49.555Z',
    '2026-09-16T02:58:49.555Z'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.knowledge_chunks (
    id, workspace_id, document_id, document_title, section, category, knowledge_type,
    chunk_index, content, token_count, tags, source_type, version, created_at
) VALUES (
    'kdoc_test_1789527529553-chunk-1',
    'ws_default_001',
    'kdoc_test_1789527529553',
    'Escala 1-1-100 — Estrutura e Aplicação',
    'Conteúdo Principal',
    'TRÁFEGO & ESCALA',
    'PLAYBOOK',
    1,
    '# Escala 1-1-100 — Estrutura e Aplicação\n\n## Conteúdo Principal\n\nEscala 1-1-100 é a estrutura de alocação de orçamento e criativos no CBO Meta Ads.\n  Consiste em 1 campanha CBO, 1 conjunto de anúncios amplo, e 100 variações de criativos estáticos e vídeos 9:16.\n  A progressão de escala ocorre aumentando 20% do orçamento a cada 6 horas se o CPA permanecer abaixo do limite de R$ 30.\n  Utilizada principalmente para ofertas low-ticket no mercado Brasil e US.',
    189,
    ARRAY['TRÁFEGO & ESCALA','PLAYBOOK','1-1-100','Meta Ads','CBO','Low Ticket'],
    'PASTED_TEXT',
    1,
    '2026-09-16T02:58:49.555Z'
) ON CONFLICT (id) DO NOTHING;
