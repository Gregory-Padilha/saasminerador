'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bot,
  Globe,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Database,
  Sparkles,
  ArrowLeft,
  Inbox,
  CheckCheck,
  Trash2,
  Tag,
  DollarSign,
  TrendingUp,
  FileJson,
  X,
  Plus,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { AgentStagedOffer } from '@/types';
import { MissionsHubModal } from '@/components/agent/MissionsHubModal';

interface AgentStatus {
  online: boolean;
  url: string;
  port: number;
  latencyMs: number;
  type: string;
  engine: string;
}

interface DatabaseStats {
  totalOffersShared: number;
  nichesCount: number;
  sampleNiches: string[];
}

interface AgentActivity {
  is_running: boolean;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'STOPPED';
  task: string;
  current_step: number;
  max_steps: number;
  next_goal: string;
  last_action?: string;
  started_at: string | null;
  elapsed_seconds: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function MinerAgentPage() {
  const toast = useToast();
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [iframeKey, setIframeKey] = useState<number>(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Missions Hub & Generator Modal State
  const [isMissionsHubOpen, setIsMissionsHubOpen] = useState(false);

  // Staging / Approval Queue State
  const [stagedOffers, setStagedOffers] = useState<AgentStagedOffer[]>([]);
  const [isLoadingStaged, setIsLoadingStaged] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isRejectingAll, setIsRejectingAll] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [isSubmittingJson, setIsSubmittingJson] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/agent/status');
      const data = await res.json();
      if (data.success) {
        setAgent(data.agent);
        setDatabaseStats(data.database);
      }
    } catch (err) {
      console.error('Failed to check agent status:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await fetch('/api/agent/activity');
      const data = await res.json();
      if (data.success && data.activity) {
        setActivity(data.activity);
      }
    } catch (err) {
      // ignore
    }
  };

  const fetchStagedOffers = async () => {
    try {
      setIsLoadingStaged(true);
      const res = await fetch('/api/agent/stage?status=PENDING_APPROVAL');
      const data = await res.json();
      if (data.success && Array.isArray(data.staged)) {
        setStagedOffers(data.staged);
      }
    } catch (err) {
      console.error('Failed to fetch staged offers:', err);
    } finally {
      setIsLoadingStaged(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchActivity();
    fetchStagedOffers();

    // Fast polling for agent activity (every 2.5s) and database (every 6s)
    const actInterval = setInterval(() => {
      fetchActivity();
      fetchStagedOffers();
    }, 2500);

    const statusInterval = setInterval(fetchStatus, 6000);

    return () => {
      clearInterval(actInterval);
      clearInterval(statusInterval);
    };
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchStatus();
    fetchActivity();
    fetchStagedOffers();
    setIframeKey((prev) => prev + 1);
    toast.info('Status, atividade e navegador atualizados.');
  };

  const handleApproveOffer = async (id: string, name: string) => {
    setApprovingId(id);
    try {
      const res = await fetch('/api/agent/stage/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Oferta "${name}" aprovada e inserida no catálogo!`);
        setStagedOffers((prev) => prev.filter((o) => o.id !== id));
        fetchStatus();
      } else {
        toast.error(data.error || 'Erro ao aprovar oferta.');
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao aprovar oferta.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectOffer = async (id: string) => {
    try {
      const res = await fetch('/api/agent/stage/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.info('Oferta descartada da fila.');
        setStagedOffers((prev) => prev.filter((o) => o.id !== id));
      } else {
        toast.error(data.error || 'Erro ao descartar oferta.');
      }
    } catch (err) {
      toast.error('Erro ao descartar oferta.');
    }
  };

  const handleApproveAll = async () => {
    if (stagedOffers.length === 0) return;
    setIsApprovingAll(true);
    try {
      const res = await fetch('/api/agent/stage/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.approvedCount || stagedOffers.length} ofertas aprovadas com sucesso!`);
        setStagedOffers([]);
        fetchStatus();
      } else {
        toast.error(data.error || 'Erro ao aprovar todas as ofertas.');
      }
    } catch (err) {
      toast.error('Erro ao aprovar ofertas em lote.');
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleRejectAll = async () => {
    if (stagedOffers.length === 0) return;
    if (!confirm('Deseja realmente descartar todas as ofertas pendentes da fila?')) return;
    setIsRejectingAll(true);
    try {
      const res = await fetch('/api/agent/stage/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.info('Fila de ofertas limpa.');
        setStagedOffers([]);
      }
    } catch (err) {
      toast.error('Erro ao limpar fila.');
    } finally {
      setIsRejectingAll(false);
    }
  };

  const handleSubmitJson = async () => {
    if (!rawJsonInput.trim()) {
      toast.error('Cole um JSON ou resultado de texto do agente.');
      return;
    }
    setIsSubmittingJson(true);
    try {
      const res = await fetch('/api/agent/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawJsonInput }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.count} oferta(s) adicionada(s) para aprovação!`);
        setRawJsonInput('');
        setIsJsonModalOpen(false);
        fetchStagedOffers();
      } else {
        toast.error(data.error || 'Não foi possível processar o JSON.');
      }
    } catch (err: any) {
      toast.error('Erro ao enviar JSON para staging.');
    } finally {
      setIsSubmittingJson(false);
    }
  };

  const agentUrl = agent?.url || 'http://127.0.0.1:7788';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/offers"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition group shadow-sm hover:border-slate-700"
          id="btn-voltar-ao-catalogo"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar ao Catálogo de Ofertas</span>
        </Link>

        <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
          Catálogo <span className="text-slate-700">/</span> Agente de Mineração Autônomo
        </div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white flex-shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Agente de Mineração Autônomo
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Browser-Use WebUI
                </span>
                {stagedOffers.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse flex items-center gap-1">
                    <Inbox className="w-3 h-3" />
                    {stagedOffers.length} {stagedOffers.length === 1 ? 'oferta aguardando aprovação' : 'ofertas aguardando aprovação'}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Navegador autônomo conectado ao banco. Toda oferta minerada gera um card de conferência para sua aprovação antes de entrar no catálogo.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Mining Beacon Badge */}
          {activity?.is_running && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse shadow-md shadow-amber-500/10">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>⛏️ Minerando</span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-white">Passo {activity.current_step || 1}</span>
              {activity.elapsed_seconds > 0 && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="font-mono text-cyan-300">{formatDuration(activity.elapsed_seconds)}</span>
                </>
              )}
            </div>
          )}

          {/* Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              agent?.online
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                agent?.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>
              {agent?.online
                ? `Online (Porta ${agent.port} • ${agent.latencyMs}ms)`
                : 'Offline na porta 7788'}
            </span>
          </div>

          <button
            onClick={() => setIsMissionsHubOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-500/40 text-xs font-bold text-cyan-300 hover:text-white hover:border-cyan-400 transition shadow-sm group active:scale-95"
            title="Abrir Central de Missões & Gerador IA"
            id="btn-abrir-central-missoes"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
            <span>Central de Missões</span>
            <span className="px-1 py-0.2 rounded text-[9px] font-black bg-cyan-400 text-slate-950">
              Guia & Gerador
            </span>
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm"
            title="Recarregar status e fila"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Recarregar</span>
          </button>

          <a
            href={agentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition shadow-sm"
            title="Abrir WebUI em nova aba"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Janela</span>
          </a>
        </div>
      </div>

      {/* Quick Guide & Missions Launchpad Bar */}
      <div
        onClick={() => setIsMissionsHubOpen(true)}
        className="cursor-pointer p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-blue-950/40 border border-cyan-500/30 hover:border-cyan-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-cyan-950/20 group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-105 group-hover:bg-cyan-500/20 transition-transform flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                Central de Missões, Guia & Gerador de Prompts do Agente
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                8 Prontas + Gerador Sob Medida
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Clique para abrir o guia interativo com comandos formulados por nicho, regras estritas anti-duplicação e construtor de prompts personalizados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/20 transition active:scale-95"
          >
            <span>Abrir Guia & Gerador</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Integration Cockpit Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Shared Database */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Banco Principal
            </div>
            <div className="text-lg font-black text-white">
              {databaseStats?.totalOffersShared ?? '...'} Ofertas
            </div>
            <div className="text-[10px] text-blue-400 font-medium">
              Catálogo canônico sincronizado
            </div>
          </div>
        </div>

        {/* Card 2: Approval Queue Count */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${
          stagedOffers.length > 0
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-slate-900/60 border-slate-800'
        }`}>
          <div className={`p-2.5 rounded-xl border ${
            stagedOffers.length > 0
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
          }`}>
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Fila de Aprovação
            </div>
            <div className="text-lg font-black text-white flex items-center gap-2">
              <span>{stagedOffers.length} {stagedOffers.length === 1 ? 'Oferta' : 'Ofertas'}</span>
              {stagedOffers.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Ação necessária
                </span>
              )}
            </div>
            <div className={`text-[10px] font-medium ${stagedOffers.length > 0 ? 'text-amber-400' : 'text-purple-400'}`}>
              {stagedOffers.length > 0 ? 'Aguardando sua conferência abaixo' : 'Tudo limpo e aprovado'}
            </div>
          </div>
        </div>

        {/* Card 3: Top Niches Context */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Nichos Conhecidos
            </div>
            <div className="text-xs font-bold text-slate-200 truncate max-w-[200px]">
              {databaseStats?.sampleNiches?.slice(0, 3).join(', ') || 'Carregando...'}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">
              {databaseStats?.nichesCount ?? 0} nichos no catálogo
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* APPROVAL CARDS SECTION: OFERTAS MINERADAS AGUARDANDO CONFERÊNCIA E APROVAÇÃO */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-5 space-y-4 relative overflow-hidden backdrop-blur-sm">
        {/* Subtle background glow when items exist */}
        {stagedOffers.length > 0 && (
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Caixa de Aprovação de Ofertas Mineradas
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {stagedOffers.length} pendentes
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Confira os dados extraídos pelo agente antes de salvar no catálogo oficial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsJsonModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm"
              title="Colar ou importar JSON de ofertas diretamente"
            >
              <FileJson className="w-3.5 h-3.5 text-cyan-400" />
              <span>Colar JSON</span>
            </button>

            {stagedOffers.length > 0 && (
              <>
                <button
                  onClick={handleRejectAll}
                  disabled={isRejectingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-rose-500/30 hover:bg-rose-500/10 text-xs font-semibold text-rose-400 transition"
                  title="Descartar todas as ofertas pendentes"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Descartar Todas</span>
                </button>

                <button
                  onClick={handleApproveAll}
                  disabled={isApprovingAll}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
                  title="Aprovar e importar todas as ofertas para o catálogo"
                >
                  <CheckCheck className={`w-4 h-4 ${isApprovingAll ? 'animate-spin' : ''}`} />
                  <span>Aprovar Todas ({stagedOffers.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Active Mining In-Progress Banner (When offers already exist but agent is still mining) */}
        {stagedOffers.length > 0 && activity?.is_running && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-emerald-500/10 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs text-cyan-300 animate-pulse">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
              <span>
                <strong>Mineração em andamento:</strong> Passo {activity.current_step || 1} • {stagedOffers.length} {stagedOffers.length === 1 ? 'oferta já na fila' : 'ofertas já na fila'}. O robô continua buscando mais no navegador...
              </span>
            </div>
            {activity.next_goal && (
              <span className="font-mono text-[11px] text-slate-400 hidden lg:inline truncate max-w-sm">
                &ldquo;{activity.next_goal}&rdquo;
              </span>
            )}
          </div>
        )}

        {/* Offers Cards Grid */}
        {stagedOffers.length === 0 ? (
          activity?.is_running ? (
            /* ========================================================================= */
            /* LIVE MINING RADAR LOADER */
            /* ========================================================================= */
            <div className="p-8 rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/40 via-slate-900/80 to-slate-950 text-center flex flex-col items-center justify-center space-y-5 relative overflow-hidden shadow-2xl animate-fadeIn">
              {/* Animated Radar Pulse Rings */}
              <div className="relative flex items-center justify-center py-2">
                <span className="absolute w-28 h-28 rounded-full bg-cyan-500/10 animate-ping pointer-events-none" />
                <span className="absolute w-20 h-20 rounded-full bg-cyan-500/20 animate-pulse pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/40 z-10 animate-bounce">
                  <Bot className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Status Header */}
              <div className="max-w-xl space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>AGENTE EM OPERAÇÃO DE MINERAÇÃO NO NAVEGADOR</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-white font-mono">Passo {activity.current_step || 1}</span>
                  {activity.elapsed_seconds > 0 && (
                    <>
                      <span className="text-slate-500">•</span>
                      <span className="text-amber-300 font-mono">{formatDuration(activity.elapsed_seconds)}</span>
                    </>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Varrendo Anúncios e Extraindo Ofertas em Tempo Real
                </h3>

                {activity.next_goal && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0 text-cyan-400" />
                    <span className="truncate max-w-lg">&ldquo;{activity.next_goal}&rdquo;</span>
                  </div>
                )}

                <p className="text-xs text-slate-400 leading-relaxed">
                  O robô está navegando na biblioteca de anúncios, abrindo páginas de venda e checando preços. Cada oferta inédita encontrada aparecerá automaticamente aqui como um card de conferência.
                </p>
              </div>

              {/* Operational Stages Flow */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-2xl pt-2">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
                  <div className="text-[10px] text-cyan-400 font-bold">1. NAVEGADOR</div>
                  <div className="text-xs text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Conectado
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-left">
                  <div className="text-[10px] text-cyan-400 font-bold">2. VARREDURA</div>
                  <div className="text-xs text-cyan-300 font-semibold flex items-center gap-1 mt-0.5">
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    Buscando Ads
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
                  <div className="text-[10px] text-slate-400 font-bold">3. CHECAGEM</div>
                  <div className="text-xs text-slate-300 font-semibold mt-0.5">
                    Anti-Duplicação
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
                  <div className="text-[10px] text-slate-400 font-bold">4. APROVAÇÃO</div>
                  <div className="text-xs text-slate-300 font-semibold mt-0.5">
                    Gera Card Aqui
                  </div>
                </div>
              </div>

              <a
                href="#viewport-navegador"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm"
              >
                <span>Acompanhar Navegação do Robô Abaixo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-slate-800/80 bg-slate-900/20 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <Inbox className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h3 className="text-sm font-semibold text-white">Nenhuma oferta aguardando aprovação</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Assim que o agente autônomo iniciar e minerar uma oferta ou concluir uma tarefa, o card aparecerá automaticamente aqui com botão para aprovar!
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                <button
                  onClick={() => setIsMissionsHubOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Escolher Missão para Rodar</span>
                </button>
                <button
                  onClick={() => setIsJsonModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Colar JSON do Agente</span>
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {stagedOffers.map((offer) => {
              const isApproving = approvingId === offer.id;
              return (
                <div
                  key={offer.id}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3 shadow-lg group relative"
                >
                  <div className="space-y-2.5">
                    {/* Header: Niche & Active Ads */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {offer.niche ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {offer.niche}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400">
                            Nicho a definir
                          </span>
                        )}
                        {offer.subniche && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300">
                            {offer.subniche}
                          </span>
                        )}
                      </div>

                      {offer.active_ads_count !== null && offer.active_ads_count !== undefined && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-blue-400" />
                          {offer.active_ads_count} {offer.active_ads_count === 1 ? 'anúncio' : 'anúncios'}
                        </span>
                      )}
                    </div>

                    {/* Product Name & Advertiser */}
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition line-clamp-2">
                        {offer.product_name}
                      </h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="text-slate-500">por</span> {offer.advertiser}
                      </p>
                    </div>

                    {/* Price and Promise */}
                    <div className="flex items-center gap-2 pt-1">
                      {offer.price !== null && offer.price !== undefined ? (
                        <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-xs">
                          R$ {Number(offer.price).toFixed(2).replace('.', ',')}
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 font-medium text-[11px]">
                          Preço sob verificação
                        </div>
                      )}

                      {offer.promise && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-1 flex-1">
                          &ldquo;{offer.promise}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* URLs / Links Preview */}
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                      {offer.landing_page_url && (
                        <a
                          href={offer.landing_page_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-cyan-400 transition"
                          title="Abrir Landing Page"
                        >
                          <ExternalLink className="w-3 h-3 text-cyan-400" />
                          <span>Página</span>
                        </a>
                      )}

                      {offer.meta_ads_url && (
                        <a
                          href={offer.meta_ads_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-blue-400 transition"
                          title="Abrir Anúncio na Meta Ads Library"
                        >
                          <ExternalLink className="w-3 h-3 text-blue-400" />
                          <span>Meta Ads</span>
                        </a>
                      )}

                      {offer.checkout_url && (
                        <a
                          href={offer.checkout_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-emerald-400 transition"
                          title="Abrir Checkout"
                        >
                          <ExternalLink className="w-3 h-3 text-emerald-400" />
                          <span>Checkout</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handleRejectOffer(offer.id)}
                      disabled={isApproving}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-semibold transition"
                      title="Descartar esta oferta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleApproveOffer(offer.id, offer.product_name)}
                      disabled={isApproving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50"
                    >
                      <Check className={`w-3.5 h-3.5 ${isApproving ? 'animate-spin' : ''}`} />
                      <span>{isApproving ? 'Aprovando...' : 'Aprovar e Adicionar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MAIN AGENT VIEWPORT */}
      {/* ========================================================================= */}
      <div
        id="viewport-navegador"
        className={`rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl transition-all ${
          isMaximized
            ? 'fixed inset-4 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md'
            : 'flex flex-col h-[750px]'
        }`}
      >
        {/* Viewport Toolbar */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800/80">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{agentUrl}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Viewport Content */}
        <div className="flex-1 w-full h-full relative bg-slate-950">
          {agent?.online ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={`${agentUrl}/?__theme=dark`}
              className="w-full h-full border-none"
              title="Browser Use WebUI"
              allow="clipboard-read; clipboard-write;"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-white mb-1">
                  Agente Browser-Use Não Conectado
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  O servidor Python do Browser-Use não respondeu em <code className="text-cyan-400">http://127.0.0.1:7788</code>.
                  Inicie o servidor para acessar o navegador autônomo dentro do SaaS.
                </p>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-left font-mono text-xs text-slate-300 relative">
                  <div className="text-slate-500 mb-1"># Comando para iniciar o agente:</div>
                  <div className="text-cyan-300">cd web-ui && python webui.py --ip 127.0.0.1 --port 7788</div>
                </div>
              </div>
              <button
                onClick={handleManualRefresh}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs transition"
              >
                Tentar Reconectar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Central de Missões & Gerador IA Modal */}
      <MissionsHubModal
        isOpen={isMissionsHubOpen}
        onClose={() => setIsMissionsHubOpen(false)}
      />

      {/* ========================================================================= */}
      {/* MODAL: COLAR JSON MANUALMENTE */}
      {/* ========================================================================= */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Colar Resultado JSON do Agente
                </h3>
              </div>
              <button
                onClick={() => setIsJsonModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Cole o texto ou JSON retornado pelo Agente ao final da tarefa. O sistema detectará automaticamente os campos e criará os cards de aprovação.
            </p>

            <textarea
              value={rawJsonInput}
              onChange={(e) => setRawJsonInput(e.target.value)}
              placeholder="Cole aqui o JSON (ex: [ { 'product_name': '...', 'price': 27, 'landing_page_url': '...' } ])"
              rows={8}
              className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-y"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setRawJsonInput(
                    JSON.stringify(
                      [
                        {
                          product_name: 'Método Leitura Acelerada Kids',
                          advertiser: 'EducaKids Digital',
                          price: 27.9,
                          niche: 'Educação Infantil',
                          subniche: 'Alfabetização',
                          landing_page_url: 'https://exemplo-kids.com.br',
                          active_ads_count: 6,
                          promise: 'Ensine seu filho a ler em 30 dias de forma lúdica.',
                        },
                      ],
                      null,
                      2
                    )
                  );
                }}
                className="text-[11px] text-cyan-400 hover:underline mr-auto"
              >
                Preencher com exemplo de teste
              </button>

              <button
                onClick={() => setIsJsonModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleSubmitJson}
                disabled={isSubmittingJson || !rawJsonInput.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition disabled:opacity-50"
              >
                <span>{isSubmittingJson ? 'Processando...' : 'Gerar Cards de Aprovação'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
