'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Video,
  Download,
  Tag,
  Layers,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit3,
  RefreshCw,
  Trash2,
  Clock,
  User,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { KnowledgeDocument, KnowledgeChunk, KnowledgeSource } from '@/lib/ai-brain/knowledge/types';

export default function KnowledgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [document, setDocument] = useState<KnowledgeDocument | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [source, setSource] = useState<KnowledgeSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'KNOWLEDGE' | 'SOURCE' | 'TRANSCRIPT' | 'CHUNKS' | 'VERSIONS'>('KNOWLEDGE');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) loadDocumentDetail();
  }, [id]);

  const loadDocumentDetail = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/knowledge?id=${id}`);
      const data = await res.json();
      if (data.document) {
        setDocument(data.document);
        setChunks(data.chunks || []);
        setSource(data.source || null);
      }
    } catch (err) {
      console.error('Error loading document detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!document) return;
    const blob = new Blob([document.canonicalMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    if (!document) return;
    navigator.clipboard.writeText(document.canonicalMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este documento da Biblioteca de Conhecimento?')) return;
    try {
      await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
      router.push('/knowledge');
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090D14] text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-purple-400 font-mono text-sm">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Carregando documento da Biblioteca...</span>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-[#090D14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Documento não encontrado</h2>
        <p className="text-sm text-slate-400 mb-6">O documento de conhecimento solicitado não existe ou foi removido.</p>
        <button
          onClick={() => router.push('/knowledge')}
          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-semibold transition"
        >
          Voltar para a Biblioteca
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 flex flex-col font-sans">
      {/* HEADER */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/knowledge')}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold uppercase">
                {document.category}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-medium">{document.knowledgeType}</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-wide truncate max-w-xl">
              {document.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Copiado!' : 'Copiar Markdown'}</span>
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar .md</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition"
            title="Excluir Documento"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* SUB-HEADER TABS */}
      <div className="border-b border-slate-800/80 bg-slate-950/50 px-6 py-2 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('KNOWLEDGE')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'KNOWLEDGE'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Documento Canônico</span>
        </button>

        <button
          onClick={() => setActiveTab('SOURCE')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'SOURCE'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Fonte Original</span>
        </button>

        {document.sourceType === 'VIDEO' && (
          <button
            onClick={() => setActiveTab('TRANSCRIPT')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'TRANSCRIPT'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Transcrição Original</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('CHUNKS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'CHUNKS'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>RAG / Chunks ({chunks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('VERSIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'VERSIONS'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Versão (v{document.version})</span>
        </button>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT / CENTER BODY */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {activeTab === 'KNOWLEDGE' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-mono text-purple-400">DOCUMENTO NORMALIZADO CANÔNICO</span>
                <h2 className="text-2xl font-black text-white mt-1">{document.title}</h2>
                <p className="text-xs text-slate-400 mt-2">{document.description}</p>
              </div>

              <div className="prose prose-invert prose-purple max-w-none text-slate-300 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {document.canonicalMarkdown}
              </div>
            </div>
          )}

          {activeTab === 'SOURCE' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-4xl mx-auto space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Matéria-Prima Original (Source Material)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block">NOME ORIGINAL:</span>
                  <span className="text-slate-200">{document.originalTitle}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">TIPO DE FONTE:</span>
                  <span className="text-purple-300 font-bold">{document.sourceType}</span>
                </div>
                {document.sourceUrl && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block">URL ORIGINAL:</span>
                    <a
                      href={document.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-400 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      {document.sourceUrl}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {source?.hash && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block">HASH SHA-256:</span>
                    <span className="text-slate-400">{source.hash}</span>
                  </div>
                )}
              </div>

              {source?.rawContent && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conteúdo Bruto Extraído</span>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-400 max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {source.rawContent}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'TRANSCRIPT' && document.sourceType === 'VIDEO' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-4xl mx-auto space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                Transcrição Bruta do Vídeo
              </h3>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-sm text-slate-300 leading-relaxed max-h-[600px] overflow-y-auto whitespace-pre-wrap">
                {document.rawTranscript || source?.rawContent || 'Nenhuma transcrição direta disponível.'}
              </div>
            </div>
          )}

          {activeTab === 'CHUNKS' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white">Segmentos Indexados no RAG ({chunks.length} Chunks)</h3>
                <span className="text-xs font-mono text-purple-400">Total Tokens: ~{chunks.reduce((acc, c) => acc + c.tokenCount, 0)}</span>
              </div>

              <div className="space-y-4">
                {chunks.map((c, idx) => (
                  <div key={c.id || idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-purple-400 font-bold">Chunk #{c.chunkIndex} — {c.section}</span>
                      <span className="text-slate-500">{c.tokenCount} tokens</span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'VERSIONS' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-4xl mx-auto space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Histórico de Versões do Conhecimento
              </h3>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-300 block">Versão Atual: v{document.version}</span>
                  <span className="text-[11px] text-slate-400">Criado em {new Date(document.createdAt).toLocaleString('pt-BR')}</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  VERSÃO ATIVA
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT METADATA SIDEBAR */}
        <div className="w-80 border-l border-slate-800/80 bg-slate-950/80 p-6 overflow-y-auto space-y-6 text-xs">
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">METADATA DO CONHECIMENTO</span>
            <div className="space-y-3">
              <div>
                <span className="text-slate-400 block">Status de Conhecimento:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                  {document.knowledgeStatus}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Confiança:</span>
                <span className="text-slate-200 font-semibold">{document.trustStatus}</span>
              </div>

              <div>
                <span className="text-slate-400 block">Fonte:</span>
                <span className="text-slate-200 font-semibold">{document.sourceType}</span>
              </div>

              {document.sourceAuthor && (
                <div>
                  <span className="text-slate-400 block">Autor/Canal:</span>
                  <span className="text-slate-200 font-semibold">{document.sourceAuthor}</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block">Chunks Gerados:</span>
                <span className="text-slate-200 font-semibold">{document.chunkCount} segmentos</span>
              </div>

              <div>
                <span className="text-slate-400 block">Data de Criação:</span>
                <span className="text-slate-300">{new Date(document.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">TAGS AUTOMÁTICAS</span>
            <div className="flex flex-wrap gap-1.5">
              {document.tags.map((t, i) => (
                <span key={i} className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {document.collections && document.collections.length > 0 && (
            <div className="border-t border-slate-800/80 pt-4 space-y-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">COLEÇÕES</span>
              <div className="flex flex-wrap gap-1.5">
                {document.collections.map((c, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
