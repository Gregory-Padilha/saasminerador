'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ExportThreadModal } from '@/components/intelligence/ExportThreadModal';
import {
  Brain,
  Sparkles,
  Plus,
  Search,
  Pin,
  Archive,
  Trash2,
  Send,
  Zap,
  Flame,
  Target,
  Palette,
  Globe,
  DollarSign,
  History,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  Lightbulb,
  FlaskConical,
  Paperclip,
  Check,
  MoreVertical,
  Edit2,
  Copy,
  ChevronDown,
  Layers,
  Download,
  Sliders,
  Maximize2,
  ArrowLeft,
  Activity,
  Compass,
  ShieldAlert,
  Film,
  Video,
} from 'lucide-react';
import { AIThread, AIMessage, AnalysisMode, AISourceReference, AIToolCallRecord, ProviderId } from '@/lib/ai-intelligence/types';
import { dbService } from '@/lib/supabase/db';
import { APP_ROUTES, getSafeInternalReturnUrl } from '@/lib/routes';
import { AiReportRenderer } from '@/components/intelligence/AiReportRenderer';
import { CreativeArtifactRenderer } from '@/components/intelligence/CreativeArtifactRenderer';
import { CreativeIntelligenceArtifact } from '@/lib/ai-intelligence/creative-intelligence';

interface ShortcutCard {
  id: string;
  icon: any;
  title: string;
  description: string;
  defaultPrompt: string;
  color: string;
}

const SHORTCUTS: ShortcutCard[] = [
  {
    id: 'disassemble_creative',
    icon: Video,
    title: 'DESMEMBRAR CRIATIVOS',
    description: 'Pegue 2 criativos desta oferta e faça o desmembramento completo de hooks, transcrição e linha do tempo.',
    defaultPrompt: 'Quero que você pegue 2 criativos dessa oferta, retorne os ganchos usados, a transcrição completa com timestamps e como os criativos estão estruturados.',
    color: 'from-purple-500/20 to-indigo-500/10 text-purple-400 border-purple-500/30',
  },
  {
    id: 'compare_creatives',
    icon: Film,
    title: 'COMPARAR ESTRUTURAS DE CRIATIVOS',
    description: 'Compare os criativos mais antigos ou mais reutilizados e isole princípios de modelagem.',
    defaultPrompt: 'Selecione os criativos que possuem maior histórico de veiculação nesta oferta e compare suas estruturas de ganchos, visual e chamada para ação.',
    color: 'from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/30',
  },
  {
    id: 'discover',
    icon: Search,
    title: 'ENCONTRAR OFERTA PARA MODELAR',
    description: 'Filtre candidate pool por longevidade, volume de anúncios e facilidade de execução faceless.',
    defaultPrompt: 'Encontre 3 ofertas validadas no catálogo com alta longevidade e baixa complexidade para eu modelar um novo produto faceless.',
    color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
  },
  {
    id: 'model',
    icon: Brain,
    title: 'MODELAR OFERTA EXISTENTE',
    description: 'Desmonte o motor da oferta e reconstrua uma nova tese sem clonar copy ou produto.',
    defaultPrompt: 'Desmonte e modele uma nova oferta a partir de uma oferta existente do catálogo usando o framework de 15 etapas (Deconstruct, Preserve, Transform, Rebuild).',
    color: 'from-purple-500/20 to-indigo-500/10 text-purple-400 border-purple-500/30',
  },
  {
    id: 'dna',
    icon: Sparkles,
    title: 'EXTRAIR DNA DA OFERTA',
    description: 'Mapeie o avatar, dor, desejo, promessa, mecanismo, formato, precificação e motivo de escala.',
    defaultPrompt: 'Extraia o DNA completo da oferta (Avatar, Dor, Promessa, Mecanismo, Formato, Entregável, Precificação e Ancoragem).',
    color: 'from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/30',
  },
  {
    id: 'avatar',
    icon: Target,
    title: 'TROCAR PÚBLICO OU ALVO',
    description: 'Mantenha a lógica comercial e o mecanismo, mas altere o público-alvo ou recorte demográfico.',
    defaultPrompt: 'Mantendo a estrutura comercial e o mecanismo da oferta, proponha 3 públicos alternativos ou recortes de nicho para a mesma solução.',
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'angle',
    icon: Flame,
    title: 'TROCAR GANCHO OU ÂNGULO',
    description: 'Altere a porta de entrada da oferta (praticidade, economia, velocidade, organização).',
    defaultPrompt: 'Crie 5 novos ganchos e ângulos de abordagem comercial para a oferta mantendo o mesmo produto entregável.',
    color: 'from-rose-500/20 to-red-500/10 text-rose-400 border-rose-500/30',
  },
  {
    id: 'product',
    icon: Layers,
    title: 'VARIAÇÃO DE PRODUTO',
    description: 'Altere o formato do entregável (ebook, planner, cards, gerador, biblioteca, checklists).',
    defaultPrompt: 'Mantenha a promessa e o problema da oferta, mas altere o formato do produto (ex: de ebook para planner/templates/gerador).',
    color: 'from-sky-500/20 to-blue-500/10 text-sky-400 border-sky-500/30',
  },
  {
    id: 'lp',
    icon: Globe,
    title: 'MODELAR LANDING PAGE',
    description: 'Extraia o blueprint da LP (Hero, Mecanismo, Demonstração, Entregáveis, Bônus, FAQ).',
    defaultPrompt: 'Extraia o blueprint da Landing Page (Hero, Mecanismo, Demonstração, Entregáveis, Bônus, FAQ) e crie uma nova estrutura.',
    color: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30',
  },
  {
    id: 'pricing',
    icon: DollarSign,
    title: 'PRICING & ORDER BUMPS',
    description: 'Estruture o ticket de entrada, ancoragem e order bumps de alta complementariedade.',
    defaultPrompt: 'Estruture a precificação de entrada (front-end), ancoragem e 3 sugestões de order bumps de alta complementariedade.',
    color: 'from-green-500/20 to-emerald-500/10 text-green-400 border-green-500/30',
  },
  {
    id: 'test',
    icon: FlaskConical,
    title: 'PLANO DE TESTE E VALIDAÇÃO',
    description: 'Monte um plano de validação rápido isolando produto mínimo, preço, criativos e métricas.',
    defaultPrompt: 'Crie um plano de teste inicial isolando variáveis: produto mínimo, preço, 3 criativos e estrutura de campanha.',
    color: 'from-orange-500/20 to-amber-500/10 text-orange-400 border-orange-500/30',
  },
];

function AiIntelligenceWorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const threadIdFromUrl = searchParams.get('t');
  const attachedOfferIdFromUrl = searchParams.get('offer');
  const attachedOfferIdsFromUrl = searchParams.getAll('attachedOfferIds');
  const fromUrl = searchParams.get('from');

  const [threads, setThreads] = useState<AIThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(threadIdFromUrl);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [collectedSources, setCollectedSources] = useState<AISourceReference[]>([]);
  const [toolLogs, setToolLogs] = useState<any[]>([]);

  // Composer Provider State (Persisted in localStorage)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('anthropic');
  const [mode, setMode] = useState<AnalysisMode>('quick');
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  // Attached Offers Context
  const [attachedOffers, setAttachedOffers] = useState<{ id: string; name: string }[]>([]);
  const [availableOffersToAttach, setAvailableOffersToAttach] = useState<{ id: string; name: string; niche?: string }[]>([]);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showProviderPopover, setShowProviderPopover] = useState(false);
  const [showQuickSkillsMenu, setShowQuickSkillsMenu] = useState(false);

  // UI Layout Panels
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'sources' | 'activity' | 'context'>('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Health checks
  const [providersHealth, setProvidersHealth] = useState<Record<string, any>>({});

  // 1. Initial Load of Provider Preference & Threads
  useEffect(() => {
    const savedProv = localStorage.getItem('om_intelligence_provider') as ProviderId;
    if (savedProv && (savedProv === 'openai' || savedProv === 'gemini' || savedProv === 'anthropic')) {
      setSelectedProvider(savedProv);
    }
    fetchThreads();
    checkProvidersHealth();
    resolveInitialAttachedOffers();
  }, []);

  // 2. React to Active Thread Changes & Check Reload Recovery
  useEffect(() => {
    if (activeThreadId) {
      fetchThreadMessages(activeThreadId);
      checkActiveRunForRecovery(activeThreadId);
      setRightCollapsed(false);
    } else {
      setMessages([]);
      setCollectedSources([]);
      setToolLogs([]);
      setRightCollapsed(true);
    }
  }, [activeThreadId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat (only if user is near bottom)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 220;
    if (isNearBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, currentStatus]);

  const handleSelectProvider = (prov: ProviderId) => {
    setSelectedProvider(prov);
    localStorage.setItem('om_intelligence_provider', prov);
  };

  const resolveInitialAttachedOffers = async () => {
    const idsToResolve = new Set<string>();
    if (attachedOfferIdFromUrl) idsToResolve.add(attachedOfferIdFromUrl);
    attachedOfferIdsFromUrl.forEach((id) => {
      if (id.trim()) idsToResolve.add(id.trim());
    });

    try {
      const allOffers = await dbService.getOffers();
      setAvailableOffersToAttach(allOffers.map((o) => ({ id: o.id, name: o.product_name, niche: o.niche || undefined })));

      if (idsToResolve.size > 0) {
        const resolved = allOffers
          .filter((o) => idsToResolve.has(o.id))
          .map((o) => ({ id: o.id, name: o.product_name }));
        setAttachedOffers(resolved);
      }
    } catch {}
  };

  const checkProvidersHealth = async () => {
    try {
      const res = await fetch('/api/ai-intelligence/health');
      const data = await res.json();
      if (data.providers) setProvidersHealth(data.providers);
    } catch {}
  };

  const fetchThreads = async () => {
    try {
      const res = await fetch('/api/ai-intelligence/threads');
      const data = await res.json();
      if (data.threads) setThreads(data.threads);
    } catch (err) {
      console.error('Error fetching threads:', err);
    }
  };

  const fetchThreadMessages = async (threadId: string) => {
    try {
      const res = await fetch(`/api/ai-intelligence/threads?id=${threadId}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);

        const sourcesMap = new Map<string, AISourceReference>();
        const logs: any[] = [];

        data.messages.forEach((m: AIMessage) => {
          if (m.metadata?.sources) {
            m.metadata.sources.forEach((s) => sourcesMap.set(`${s.type}:${s.id}`, s));
          }
        });

        if (data.toolCalls) {
          data.toolCalls.forEach((tc: AIToolCallRecord) => {
            logs.push({
              toolName: tc.toolName,
              durationMs: tc.durationMs || 0,
              summary: tc.resultSummary || tc.status,
              isError: tc.status === 'error',
              args: tc.arguments,
            });
          });
        }

        setCollectedSources(Array.from(sourcesMap.values()));
        setToolLogs(logs);
      }
    } catch (err) {
      console.error('Error fetching thread details:', err);
    }
  };

  const checkActiveRunForRecovery = async (threadId: string) => {
    try {
      const res = await fetch(`/api/ai-intelligence/runs?threadId=${threadId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.run?.status === 'RUNNING') {
          setIsGenerating(true);
          setCurrentStatus('Recuperando execução em andamento...');
          if (data.assistantMessage) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === data.assistantMessage.id);
              if (exists) return prev.map((m) => (m.id === data.assistantMessage.id ? data.assistantMessage : m));
              return [...prev, data.assistantMessage];
            });
          }
        }
      }
    } catch {}
  };

  const selectThread = (id: string) => {
    setActiveThreadId(id);
    router.replace(`/intelligence?t=${id}${fromUrl ? `&from=${encodeURIComponent(fromUrl)}` : ''}`);
  };

  const createNewThread = () => {
    setActiveThreadId(null);
    setMessages([]);
    setCollectedSources([]);
    setToolLogs([]);
    setPromptInput('');
    setRightCollapsed(true);
    router.replace(`/intelligence${fromUrl ? `?from=${encodeURIComponent(fromUrl)}` : ''}`);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || promptInput).trim();
    if (!textToSend || isGenerating) return;

    if (!customPrompt) setPromptInput('');
    setIsGenerating(true);
    setCurrentStatus('Iniciando Offer Miner Brain...');
    setRightCollapsed(false);

    const tempUserMsgId = `msg_usr_${Date.now()}`;
    const userMsg: AIMessage = {
      id: tempUserMsgId,
      threadId: activeThreadId || 'temp',
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
      metadata: { mode, attachedOfferIds: attachedOffers.map((o) => o.id) },
    };

    const assistantMsgId = `msg_ast_${Date.now()}`;
    const initialAssistantMsg: AIMessage = {
      id: assistantMsgId,
      threadId: activeThreadId || 'temp',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      metadata: { mode, provider: selectedProvider, status: 'RUNNING' },
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);

    try {
      const res = await fetch('/api/ai-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: activeThreadId || undefined,
          message: textToSend,
          provider: selectedProvider,
          mode,
          attachedOfferIds: attachedOffers.map((o) => o.id),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao enviar mensagem');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Stream indisponível');

      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const lines = block.split('\n');
          let eventName = '';
          let dataPayload: any = null;

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              try {
                dataPayload = JSON.parse(line.replace('data:', '').trim());
              } catch {}
            }
          }

          if (eventName && dataPayload) {
            if (eventName === 'thread') {
              if (!activeThreadId) {
                setActiveThreadId(dataPayload.threadId);
                router.replace(`/intelligence?t=${dataPayload.threadId}${fromUrl ? `&from=${encodeURIComponent(fromUrl)}` : ''}`);
                fetchThreads();
              }
            } else if (eventName === 'status') {
              setCurrentStatus(dataPayload.status);
            } else if (eventName === 'tool_start') {
              setCurrentStatus(`● Executando ${dataPayload.toolName}...`);
            } else if (eventName === 'tool_end') {
              setToolLogs((prev) => [
                ...prev,
                {
                  toolName: dataPayload.toolName,
                  durationMs: dataPayload.durationMs,
                  summary: dataPayload.summary,
                  isError: dataPayload.isError,
                },
              ]);
            } else if (eventName === 'text_delta') {
              assistantText += dataPayload.delta || dataPayload.token || '';
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: assistantText, metadata: { ...m.metadata, status: 'RUNNING' } } : m))
              );
            } else if (eventName === 'sources') {
              setCollectedSources(dataPayload.sources || []);
            } else if (eventName === 'complete') {
              setCurrentStatus(null);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: m.content || `⚠️ Erro na execução (${selectedProvider.toUpperCase()}): ${err.message}`,
                metadata: { ...m.metadata, status: 'ERROR', error: err.message },
              }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
      setCurrentStatus(null);
      fetchThreads();
    }
  };

  const getReturnButtonMeta = () => {
    if (!fromUrl) return { label: 'Voltar ao Offer Miner', href: APP_ROUTES.dashboard };
    const safeTarget = getSafeInternalReturnUrl(fromUrl, APP_ROUTES.dashboard);
    if (safeTarget.includes('/offers')) return { label: 'Voltar para Ofertas', href: safeTarget };
    return { label: 'Voltar ao Offer Miner', href: safeTarget };
  };

  const returnMeta = getReturnButtonMeta();
  const filteredThreads = threads.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderThreadItem = (t: AIThread) => {
    const active = activeThreadId === t.id;
    return (
      <div
        key={t.id}
        onClick={() => selectThread(t.id)}
        className={cn(
          'p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between group',
          active
            ? 'bg-purple-600/15 border-purple-500/40 text-white font-semibold'
            : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 text-slate-300'
        )}
      >
        <div className="truncate pr-2">
          <span className="block truncate">{t.title}</span>
          <span className="text-[10px] text-slate-500 font-mono">
            {t.provider.toUpperCase()} • {new Date(t.updatedAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] bg-[#090D14] text-slate-100 flex flex-col font-sans selection:bg-purple-600/30 overflow-hidden">
      {/* GLOBAL TOPBAR HEADER */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(returnMeta.href)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition flex items-center gap-2 shadow-sm group"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>{returnMeta.label}</span>
          </button>

          <span className="text-slate-700 hidden sm:inline">/</span>

          <div onClick={() => router.push(APP_ROUTES.dashboard)} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <Brain className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-400 group-hover:text-white transition">OFFER MINER</span>
                <span className="text-slate-600 text-xs">/</span>
                <span className="font-bold text-xs text-white tracking-wide">INTELLIGENCE COPILOT</span>
              </div>
              <p className="text-[10px] text-purple-300 font-mono hidden md:block">
                Copiloto Especialista de Ofertas & Criativos
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5">
          {activeThreadId && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Baixar esta conversa e seu contexto para continuar em outra IA."
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Exportar Contexto</span>
            </button>
          )}

          <button
            onClick={createNewThread}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Análise</span>
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* COLLAPSIBLE LEFT SIDEBAR */}
        <aside className={cn('border-r border-slate-800/80 bg-slate-950/60 flex flex-col flex-shrink-0 transition-all duration-300 relative', leftCollapsed ? 'w-16' : 'w-72')}>
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2">
            {!leftCollapsed ? (
              <>
                <button onClick={createNewThread} className="flex-1 py-2 px-3 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-200 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ NOVA ANÁLISE</span>
                </button>
                <button onClick={() => setLeftCollapsed(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={() => setLeftCollapsed(false)} className="mx-auto p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {!leftCollapsed && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar histórico..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">{filteredThreads.map((t) => renderThreadItem(t))}</div>
            </div>
          )}
        </aside>

        {/* CENTRAL CHAT AREA */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#090D14] overflow-hidden relative">
          {messages.length === 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-10 space-y-8 max-w-4xl mx-auto w-full">
              <div className="text-center space-y-3 pt-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>OFFER MINER INTELLIGENCE COPILOT</span>
                </div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  Copiloto Analítico de Ofertas & Criativos
                </h2>
                <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                  Converse diretamente com seus dados do Offer Miner. Analise criativos, ganchos, linhas do tempo de vídeo, LPs e estratégias de modelagem com proveniência factual.
                </p>
              </div>

              {/* SHORTCUT CARDS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SHORTCUTS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSendMessage(s.defaultPrompt)}
                      className={cn(
                        'p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border transition cursor-pointer group space-y-2',
                        s.color
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tracking-wider flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {s.title}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
              {messages.map((m) => (
                <div key={m.id} className="max-w-4xl mx-auto">
                  {m.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-2xl p-4 rounded-2xl bg-purple-900/30 border border-purple-500/30 text-slate-100 text-sm shadow-md">
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-bold text-slate-200">ANÁLISE DE INTELIGÊNCIA</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                            {m.metadata?.provider === 'openai' ? 'OpenAI GPT-4o' : m.metadata?.provider === 'anthropic' ? 'Anthropic Claude' : 'Google Gemini'}
                          </span>
                        </div>
                      </div>

                      <AiReportRenderer
                        content={m.content}
                        sources={m.metadata?.sources || collectedSources}
                        onSendMessage={handleSendMessage}
                      />
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && currentStatus && (
                <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-slate-900 border border-purple-500/30 text-xs text-purple-300 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <span className="font-semibold">{currentStatus}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Consultando Tool Layer...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* COMPOSER BAR WITH PROVIDER SELECTOR & CONTEXT CHIPS */}
          <div className="flex-shrink-0 p-4 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md z-20">
            <div className="max-w-4xl mx-auto space-y-2.5">
              {/* Context Chips & Provider Controls Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Context Chips */}
                  {attachedOffers.map((o) => (
                    <span key={o.id} className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[11px] flex items-center gap-1 font-semibold">
                      <span>📎 {o.name}</span>
                      <button onClick={() => setAttachedOffers((prev) => prev.filter((item) => item.id !== o.id))} className="hover:text-rose-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  <button
                    onClick={() => setShowAttachModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-semibold transition flex items-center gap-1"
                  >
                    <Paperclip className="w-3 h-3 text-purple-400" />
                    <span>+ Anexar Oferta</span>
                  </button>
                </div>

                {/* Provider Selector Selector Directly in Composer */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProvider}
                    onChange={(e) => handleSelectProvider(e.target.value as ProviderId)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-purple-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="anthropic">Claude 3.5 Sonnet (Anthropic)</option>
                    <option value="gemini">Gemini 1.5 Pro (Google)</option>
                    <option value="openai">GPT-4o (OpenAI)</option>
                  </select>

                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as AnalysisMode)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="quick">⚡ Rápido</option>
                    <option value="deep">🔥 Profundo</option>
                  </select>
                </div>
              </div>

              {/* Main Input Textarea */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 focus-within:border-purple-500/60 transition">
                <textarea
                  rows={1}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Peça uma análise de criativos, ganchos, LPs ou estratégias de modelagem..."
                  className="flex-1 bg-transparent px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-32"
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!promptInput.trim() || isGenerating}
                  className="p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-500/20 disabled:opacity-50 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Export Thread Context Pack Modal */}
      {isExportModalOpen && activeThreadId && (
        <ExportThreadModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          threadId={activeThreadId}
        />
      )}
    </div>
  );
}

export default function AiIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando AI Intelligence Copilot...</div>}>
      <AiIntelligenceWorkspaceContent />
    </Suspense>
  );
}
