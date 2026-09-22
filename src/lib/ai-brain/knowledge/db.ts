import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeSource,
  IngestionJob,
  KnowledgeUsageRecord,
} from './types';
import fs from 'fs';
import path from 'path';

const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'scratch', 'knowledge-db');
const DOCUMENTS_FILE = path.join(LOCAL_STORAGE_DIR, 'documents.json');
const CHUNKS_FILE = path.join(LOCAL_STORAGE_DIR, 'chunks.json');
const SOURCES_FILE = path.join(LOCAL_STORAGE_DIR, 'sources.json');
const JOBS_FILE = path.join(LOCAL_STORAGE_DIR, 'jobs.json');
const USAGE_FILE = path.join(LOCAL_STORAGE_DIR, 'usage.json');

const isLocalMode = process.env.DATA_BACKEND === 'local';

function ensureLocalStorage() {
  if (!isLocalMode || typeof window !== 'undefined') return;
  try {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
    const initFile = (filePath: string) => {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([]), 'utf-8');
      }
    };
    initFile(DOCUMENTS_FILE);
    initFile(CHUNKS_FILE);
    initFile(SOURCES_FILE);
    initFile(JOBS_FILE);
    initFile(USAGE_FILE);
  } catch (err) {
    // Non-fatal if filesystem is read-only (serverless)
  }
}

function getLocalData<T>(filePath: string): T[] {
  if (!isLocalMode || typeof window !== 'undefined') return [];
  ensureLocalStorage();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalData<T>(filePath: string, data: T[]) {
  if (!isLocalMode || typeof window !== 'undefined') return;
  ensureLocalStorage();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore serverless write errors
  }
}

export class KnowledgeDatabaseService {
  // --- SOURCES ---
  async saveSource(source: KnowledgeSource): Promise<KnowledgeSource> {
    const sources = getLocalData<KnowledgeSource>(SOURCES_FILE);
    const idx = sources.findIndex((s) => s.id === source.id);
    if (idx >= 0) sources[idx] = source;
    else sources.unshift(source);
    saveLocalData(SOURCES_FILE, sources);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('knowledge_sources').upsert(source);
      } catch (err) {
        console.warn('Supabase saveSource warning:', err);
      }
    }
    return source;
  }

  async getSources(): Promise<KnowledgeSource[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('knowledge_sources').select('*');
        if (!error && data) {
          return (data || []) as KnowledgeSource[];
        }
      } catch (err) {
        console.warn('Supabase getSources warning:', err);
      }
    }
    return isLocalMode ? getLocalData<KnowledgeSource>(SOURCES_FILE) : [];
  }

  async getSourceById(id: string): Promise<KnowledgeSource | null> {
    const sources = await this.getSources();
    return sources.find((s) => s.id === id) || null;
  }

  // --- DOCUMENTS & CHUNKS ---
  async saveDocument(doc: KnowledgeDocument, chunks: KnowledgeChunk[] = []): Promise<KnowledgeDocument> {
    const docs = getLocalData<KnowledgeDocument>(DOCUMENTS_FILE);
    const existingIdx = docs.findIndex((d) => d.id === doc.id);
    if (existingIdx >= 0) {
      docs[existingIdx] = doc;
    } else {
      docs.unshift(doc);
    }
    saveLocalData(DOCUMENTS_FILE, docs);

    // Save Chunks locally
    const currentChunks = getLocalData<KnowledgeChunk>(CHUNKS_FILE).filter((c) => c.documentId !== doc.id && (c as any).document_id !== doc.id);
    const updatedChunks = [...currentChunks, ...chunks];
    saveLocalData(CHUNKS_FILE, updatedChunks);

    // Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('knowledge_documents').upsert({
          id: doc.id,
          source_id: doc.sourceId,
          title: doc.title,
          original_title: doc.originalTitle,
          description: doc.description,
          canonical_markdown: doc.canonicalMarkdown,
          category: doc.category,
          knowledge_type: doc.knowledgeType,
          knowledge_status: doc.knowledgeStatus,
          trust_status: doc.trustStatus,
          source_type: doc.sourceType,
          source_url: doc.sourceUrl,
          tags: doc.tags,
          collections: doc.collections,
          language: doc.language,
          processing_status: doc.processingStatus,
          raw_transcript: doc.rawTranscript,
          chunk_count: doc.chunkCount,
          version: doc.version,
          created_at: doc.createdAt,
          updated_at: doc.updatedAt,
        });

        if (chunks.length > 0) {
          await supabase.from('knowledge_chunks').delete().eq('document_id', doc.id);
          await supabase.from('knowledge_chunks').insert(
            chunks.map((c) => ({
              id: c.id,
              document_id: c.documentId,
              document_title: c.documentTitle,
              section: c.section,
              category: c.category,
              knowledge_type: c.knowledgeType,
              chunk_index: c.chunkIndex,
              content: c.content,
              token_count: c.tokenCount,
              tags: c.tags,
              source_type: c.sourceType,
              source_url: c.sourceUrl,
              version: c.version,
              created_at: c.createdAt,
            }))
          );
        }
      } catch (err) {
        console.warn('Supabase knowledge save warning:', err);
      }
    }

    return doc;
  }

  async getDocuments(): Promise<KnowledgeDocument[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('knowledge_documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            sourceId: d.source_id || d.sourceId || 'src_legacy',
            title: d.title,
            originalTitle: d.original_title || d.originalTitle || d.title,
            description: d.description,
            canonicalMarkdown: d.canonical_markdown || d.canonicalMarkdown || d.content || `# ${d.title}`,
            category: d.category || 'OUTROS',
            knowledgeType: d.knowledge_type || d.knowledgeType || 'PLAYBOOK',
            knowledgeStatus: d.knowledge_status || d.knowledgeStatus || 'PROCESSED',
            trustStatus: d.trust_status || d.trustStatus || 'REFERÊNCIA',
            sourceType: d.source_type || d.sourceType || 'FILE',
            sourceUrl: d.source_url || d.sourceUrl,
            tags: d.tags || [],
            collections: d.collections || [d.category || 'OUTROS'],
            language: d.language || 'pt-BR',
            processingStatus: d.processing_status || d.processingStatus || 'READY',
            rawTranscript: d.raw_transcript || d.rawTranscript,
            chunkCount: d.chunk_count || d.chunkCount || 0,
            version: d.version || 1,
            createdAt: d.created_at || d.createdAt,
            updatedAt: d.updated_at || d.updatedAt,
          }));
        }
      } catch (err) {
        console.warn('Supabase getDocuments error:', err);
      }
    }
    return isLocalMode ? getLocalData<KnowledgeDocument>(DOCUMENTS_FILE) : [];
  }

  async getDocumentById(id: string): Promise<KnowledgeDocument | null> {
    const docs = await this.getDocuments();
    return docs.find((d) => d.id === id) || null;
  }

  async getChunks(documentId?: string): Promise<KnowledgeChunk[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('knowledge_chunks').select('*');
        if (documentId) query = query.eq('document_id', documentId);
        const { data, error } = await query;
        if (!error && data) {
          return data.map((c: any) => ({
            id: c.id,
            documentId: c.document_id || c.documentId,
            documentTitle: c.document_title || c.documentTitle,
            section: c.section || 'Geral',
            category: c.category,
            knowledgeType: c.knowledge_type || c.knowledgeType,
            chunkIndex: c.chunk_index || c.chunkIndex,
            content: c.content,
            tokenCount: c.token_count || c.tokenCount || 0,
            tags: c.tags || [],
            sourceType: c.source_type || c.sourceType || 'FILE',
            sourceUrl: c.source_url || c.sourceUrl,
            version: c.version || 1,
            createdAt: c.created_at || c.createdAt,
          }));
        }
      } catch (err) {
        console.warn('Supabase getChunks error:', err);
      }
    }

    if (!isLocalMode) return [];

    const local = getLocalData<KnowledgeChunk>(CHUNKS_FILE).map((c: any) => ({
      id: c.id,
      documentId: c.documentId || c.document_id,
      documentTitle: c.documentTitle || c.document_title,
      section: c.section || 'Geral',
      category: c.category,
      knowledgeType: c.knowledgeType || c.knowledge_type,
      chunkIndex: c.chunkIndex || c.chunk_index,
      content: c.content,
      tokenCount: c.tokenCount || c.token_count || 0,
      tags: c.tags || [],
      sourceType: c.sourceType || c.source_type || 'FILE',
      sourceUrl: c.sourceUrl || c.source_url,
      version: c.version || 1,
      createdAt: c.createdAt || c.created_at,
    }));

    if (documentId) return local.filter((c) => c.documentId === documentId);
    return local;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const docs = getLocalData<KnowledgeDocument>(DOCUMENTS_FILE).filter((d) => d.id !== id);
    saveLocalData(DOCUMENTS_FILE, docs);
    const chunks = getLocalData<KnowledgeChunk>(CHUNKS_FILE).filter((c) => c.documentId !== id && (c as any).document_id !== id);
    saveLocalData(CHUNKS_FILE, chunks);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('knowledge_chunks').delete().eq('document_id', id);
        await supabase.from('knowledge_documents').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteDocument warning:', err);
      }
    }
    return true;
  }

  // --- INGESTION JOBS ---
  async saveJob(job: IngestionJob): Promise<IngestionJob> {
    const jobs = getLocalData<IngestionJob>(JOBS_FILE);
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) jobs[idx] = job;
    else jobs.unshift(job);
    saveLocalData(JOBS_FILE, jobs);
    return job;
  }

  async getJobById(id: string): Promise<IngestionJob | null> {
    const jobs = getLocalData<IngestionJob>(JOBS_FILE);
    return jobs.find((j) => j.id === id) || null;
  }

  // --- USAGE RECS ---
  async recordUsage(rec: KnowledgeUsageRecord): Promise<void> {
    const usage = getLocalData<KnowledgeUsageRecord>(USAGE_FILE);
    usage.unshift(rec);
    saveLocalData(USAGE_FILE, usage.slice(0, 500));
  }
}

export const knowledgeDb = new KnowledgeDatabaseService();
