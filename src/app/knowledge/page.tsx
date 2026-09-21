'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  Sparkles,
  FileText,
  Tag,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  Filter,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  X,
  Upload,
  ChevronRight,
  Video,
  FileCode,
  Link as LinkIcon,
  MessageSquare,
  Compass,
  FolderKanban,
  Clock,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  KnowledgeDocument,
  KnowledgeCategory,
  KnowledgeType,
  KnowledgeSearchResult,
  SourceType,
} from '@/lib/ai-brain/knowledge/types';

const CATEGORIES: KnowledgeCategory[] = [
  'OFERTAS & PRODUTO',
  'COPY & POSICIONAMENTO',
  'CRIATIVOS',
  'LANDING PAGES',
  'TRÁFEGO & ESCALA',
  'PESQUISA & MINERAÇÃO',
  'FUNIS & MONETIZAÇÃO',
  'PÚBLICO & MERCADO',
  'OPERAÇÃO',
  'ESTUDOS DE CASO',
  'FRAMEWORKS',
  'OUTROS',
];

const ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'
];

function normalizeInitial(str: string): string {
  if (!str) return '#';
  const clean = str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const first = clean.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export default function KnowledgeLibraryPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'CATALOG' | 'COLLECTIONS' | 'RECENT'>('CATALOG');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<'FILE' | 'TEXT' | 'VIDEO'>('FILE');
  const [showConsultModal, setShowConsultModal] = useState(false);

  // Add Form Inputs
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<KnowledgeCategory>('OFERTAS & PRODUTO');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Consult Chat State
  const [consultQuery, setConsultQuery] = useState('');
  const [consultResults, setConsultResults] = useState<KnowledgeSearchResult[]>([]);
  const [formattedAnswer, setFormattedAnswer] = useState<string | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Error loading knowledge documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente remover este documento da Biblioteca de Conhecimento?')) return;
    try {
      await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
      loadDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleProcessAdd = async (force: boolean = false) => {
    setIsProcessing(true);
    setDuplicateWarning(null);
    setProcessingStage('Ingestão de fonte iniciada...');

    try {
      const formData = new FormData();
      formData.append('source_type', addTab);
      if (customTitle) formData.append('title', customTitle);
      formData.append('category', customCategory);
      if (force) formData.append('force', 'true');

      if (addTab === 'FILE' && uploadFile) {
        formData.append('file', uploadFile);
        setProcessingStage('Extraindo texto e limpando formatação...');
      } else if (addTab === 'TEXT') {
        formData.append('text', pastedText);
        setProcessingStage('Normalizando documento canônico...');
      } else if (addTab === 'VIDEO') {
        formData.append('source_url', videoUrl);
        setProcessingStage('Buscando legendas e transcrição do vídeo...');
      }

      const res = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.status === 409 && data.warning) {
        setDuplicateWarning(data.warning);
        setIsProcessing(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar ingestão.');
      }

      setProcessingStage('Documento indexado no cérebro com sucesso!');
      setTimeout(() => {
        setIsProcessing(false);
        setShowAddModal(false);
        resetAddForm();
        loadDocuments();
      }, 600);
    } catch (err: any) {
      console.error('Error adding knowledge:', err);
      alert(`Falha no processamento: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const resetAddForm = () => {
    setUploadFile(null);
    setPastedText('');
    setVideoUrl('');
    setCustomTitle('');
    setDuplicateWarning(null);
    setIsProcessing(false);
    setProcessingStage('');
  };

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultQuery.trim()) return;
    setIsConsulting(true);
    setFormattedAnswer(null);
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: consultQuery }),
      });
      const data = await res.json();
      setConsultResults(data.results || []);
      setFormattedAnswer(data.formattedContext || null);
    } catch (err) {
      console.error('Error consulting library:', err);
    } fontally: {
      setIsConsulting(false);
    }
  };

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        !searchQuery.trim() ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.originalTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, selectedCategory]);

  // Alphabetical Grouping
  const alphabeticalGroups = useMemo(() => {
    const sorted = [...filteredDocs].sort((a, b) =>
      a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' })
    );

    const groups: Record<string, KnowledgeDocument[]> = {};

    sorted.forEach((doc) => {
      const initial = normalizeInitial(doc.title);
      if (!groups[initial]) groups[initial] = [];
      groups[initial].push(doc);
    });

    return groups;
  }, [filteredDocs]);

  // Collection Groups
  const collectionGroups = useMemo(() => {
    const groups: Record<string, KnowledgeDocument[]> = {};
    filteredDocs.forEach((doc) => {
      const collections = doc.collections && doc.collections.length > 0 ? doc.collections : [doc.category];
      collections.forEach((col) => {
        if (!groups[col]) groups[col] = [];
        groups[col].push(doc);
      });
    });
    return groups;
  }, [filteredDocs]);

  const totalChunks = documents.reduce((acc, d) => acc + d.chunkCount, 0);

  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 flex flex-col font-sans">
      {/* HEADER */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-900/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide uppercase">
                BIBLIOTECA DE CONHECIMENTO
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                Knowledge Library
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Acervo permanente de inteligência do cérebro do Offer Miner.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConsultModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Consultar Biblioteca</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Adicionar</span>
          </button>
        </div>
      </header>

      {/* STATS BAR */}
      <div className="border-b border-slate-800/80 bg-slate-950/40 px-6 py-3 grid grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Documentos</span>
          <span className="text-sm font-mono font-bold text-white">{documents.length}</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Chunks Indexados</span>
          <span className="text-sm font-mono font-bold text-purple-400">{totalChunks}</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Categorias</span>
          <span className="text-sm font-mono font-bold text-indigo-400">{CATEGORIES.length}</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Status da Engine</span>
          <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ATIVO & CONECTADO
          </span>
        </div>
      </div>

      {/* SEARCH & VIEW SWITCHER BAR */}
      <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-950/20 flex flex-wrap items-center justify-between gap-4">
        {/* VIEW MODES */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('CATALOG')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'CATALOG'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>CATÁLOGO A-Z</span>
          </button>
          <button
            onClick={() => setViewMode('COLLECTIONS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'COLLECTIONS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>COLEÇÕES</span>
          </button>
          <button
            onClick={() => setViewMode('RECENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'RECENT'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>RECENTES</span>
          </button>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por título, conceito, tag ou conteúdo..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500/50"
          >
            <option value="ALL">Todas Categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* A-Z ALPHABETICAL STICKY RAIL (FOR CATALOG VIEW) */}
      {viewMode === 'CATALOG' && (
        <div className="bg-slate-950/80 border-b border-slate-800 px-6 py-2 flex items-center justify-center gap-1 overflow-x-auto">
          {ALPHABET.map((letter) => {
            const hasDocs = !!alphabeticalGroups[letter];
            return (
              <button
                key={letter}
                onClick={() => {
                  setSelectedLetter(selectedLetter === letter ? null : letter);
                  const el = document.getElementById(`letter-group-${letter}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                disabled={!hasDocs}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center ${
                  selectedLetter === letter
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : hasDocs
                    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-700 opacity-40 cursor-not-allowed'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {/* MAIN CATALOG CONTENT */}
      <div className="flex-1 p-6 overflow-y-auto space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-purple-400 font-mono text-xs gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Carregando acervo da biblioteca...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          /* EMPTY STATE */
          <div className="max-w-md mx-auto py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Seu cérebro ainda está sem acervo</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Adicione vídeos, PDFs, textos, playbooks e estudos para construir uma biblioteca de conhecimento própria.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { setAddTab('FILE'); setShowAddModal(true); }}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>+ Arquivo</span>
              </button>
              <button
                onClick={() => { setAddTab('TEXT'); setShowAddModal(true); }}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
              >
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>+ Texto</span>
              </button>
              <button
                onClick={() => { setAddTab('VIDEO'); setShowAddModal(true); }}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
              >
                <Video className="w-4 h-4 text-pink-400" />
                <span>+ Vídeo</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'CATALOG' ? (
          /* CATALOG VIEW (GROUPED BY LETTER) */
          Object.keys(alphabeticalGroups)
            .sort()
            .map((letter) => {
              if (selectedLetter && selectedLetter !== letter) return null;
              const docs = alphabeticalGroups[letter];
              return (
                <div key={letter} id={`letter-group-${letter}`} className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-800/80 pb-2">
                    <span className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-mono text-sm font-bold flex items-center justify-center">
                      {letter}
                    </span>
                    <span className="text-xs font-mono text-slate-500">({docs.length} documentos)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map((doc) => (
                      <DocumentCard key={doc.id} doc={doc} onDelete={handleDeleteDoc} />
                    ))}
                  </div>
                </div>
              );
            })
        ) : viewMode === 'COLLECTIONS' ? (
          /* COLLECTIONS VIEW */
          Object.keys(collectionGroups)
            .sort()
            .map((collectionName) => {
              const docs = collectionGroups[collectionName];
              return (
                <div key={collectionName} className="space-y-4 bg-slate-950/40 p-6 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-purple-400" />
                      {collectionName}
                    </h3>
                    <span className="text-xs font-mono text-slate-500">{docs.length} itens</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map((doc) => (
                      <DocumentCard key={doc.id} doc={doc} onDelete={handleDeleteDoc} />
                    ))}
                  </div>
                </div>
              );
            })
        ) : (
          /* RECENT VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onDelete={handleDeleteDoc} />
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADICIONAR À BIBLIOTECA */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => { setShowAddModal(false); resetAddForm(); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wide">ADICIONAR À BIBLIOTECA</h2>
              <p className="text-xs text-slate-400 mt-1">
                Envie qualquer fonte e deixe o Offer Miner transformar em conhecimento estruturado.
              </p>
            </div>

            {/* TABS */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setAddTab('FILE')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  addTab === 'FILE'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>[ ARQUIVO ]</span>
              </button>
              <button
                onClick={() => setAddTab('TEXT')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  addTab === 'TEXT'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>[ COLAR TEXTO ]</span>
              </button>
              <button
                onClick={() => setAddTab('VIDEO')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  addTab === 'VIDEO'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>[ VÍDEO / LINK ]</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            {isProcessing ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                <span className="text-sm font-semibold text-white">{processingStage}</span>
                <span className="text-xs text-slate-500 font-mono">Processamento de Ingestão em andamento...</span>
              </div>
            ) : duplicateWarning ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-4 text-xs text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Aviso de Duplicidade</span>
                    <span>{duplicateWarning}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-amber-500/20">
                  <button
                    onClick={() => setDuplicateWarning(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleProcessAdd(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-500 text-xs font-semibold"
                  >
                    Adicionar Mesmo Assim
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {addTab === 'FILE' && (
                  <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center hover:border-purple-500/50 transition">
                    <input
                      type="file"
                      id="file-upload"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      accept=".pdf,.txt,.md,.docx,.csv,.tsv,.json"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer space-y-3 block">
                      <Upload className="w-8 h-8 text-purple-400 mx-auto" />
                      <span className="text-xs text-slate-300 font-semibold block">
                        {uploadFile ? uploadFile.name : 'Arraste um arquivo ou clique para selecionar'}
                      </span>
                      <span className="text-[11px] text-slate-500 block font-mono">
                        Suporta .pdf, .txt, .md, .docx, .csv
                      </span>
                    </label>
                  </div>
                )}

                {addTab === 'TEXT' && (
                  <div>
                    <textarea
                      rows={8}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Cole aqui uma transcrição, anotação, playbook, framework, estudo, material de curso, estratégia ou qualquer conteúdo que queira ensinar ao Offer Miner..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                )}

                {addTab === 'VIDEO' && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Link do Vídeo (YouTube)</label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50"
                    />
                    <span className="text-[11px] text-slate-500 block">
                      O sistema tentará obter legendas e transcrição automaticamente.
                    </span>
                  </div>
                )}

                {/* OPTIONAL OVERRIDES */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Título (Opcional - IA gera automaticamente)</label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Deixar IA criar nome bibliográfico"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Categoria (Opcional)</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as KnowledgeCategory)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => { setShowAddModal(false); resetAddForm(); }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleProcessAdd(false)}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20"
                  >
                    Processar & Adicionar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CONSULTAR BIBLIOTECA (RAG CHAT) */}
      {showConsultModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowConsultModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                CONSULTAR BIBLIOTECA DE CONHECIMENTO
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Faça perguntas ao cérebro do Offer Miner baseadas estritamente no seu acervo de conhecimento.
              </p>
            </div>

            <form onSubmit={handleConsultSubmit} className="flex gap-2">
              <input
                type="text"
                value={consultQuery}
                onChange={(e) => setConsultQuery(e.target.value)}
                placeholder="Ex: O que minha biblioteca diz sobre Escala Baiana ou 1-1-100?"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
              <button
                type="submit"
                disabled={isConsulting}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2 transition disabled:opacity-50"
              >
                {isConsulting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Buscar</span>
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {isConsulting ? (
                <div className="py-12 text-center text-purple-400 font-mono text-xs gap-3 flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span>Consultando vetores de conhecimento na biblioteca...</span>
                </div>
              ) : consultResults.length === 0 && formattedAnswer ? (
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-xs text-slate-400 text-center">
                  Nenhum trecho de conhecimento correspondente encontrado para essa consulta.
                </div>
              ) : (
                consultResults.map((r, i) => (
                  <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-purple-400 font-bold">{r.document.title}</span>
                      <span className="text-slate-500">{r.chunk.section}</span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{r.chunk.content}</p>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-900">
                      <span>Fonte: {r.document.sourceType}</span>
                      <span>Score: {r.score}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  onDelete,
}: {
  doc: KnowledgeDocument;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const SourceIcon =
    doc.sourceType === 'VIDEO' ? Video : doc.sourceType === 'PASTED_TEXT' ? FileCode : FileText;

  return (
    <Link href={`/knowledge/${doc.id}`} className="block group">
      <div className="bg-slate-900/60 border border-slate-800/80 hover:border-purple-500/50 rounded-2xl p-5 space-y-3 transition duration-200 hover:shadow-xl hover:shadow-purple-950/20 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <SourceIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                {doc.category}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => onDelete(doc.id, e)}
            className="p-1 rounded text-slate-600 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
            title="Excluir Documento"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition line-clamp-2">
            {doc.title}
          </h4>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{doc.description}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          {doc.tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800">
              #{tag}
            </span>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>{doc.chunkCount} chunks</span>
          <span className="flex items-center gap-1 text-purple-400 font-semibold group-hover:translate-x-0.5 transition">
            Abrir <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
