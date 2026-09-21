'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Workflow,
  Globe,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Play,
  Pause,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  Square,
  ArrowRight,
  ExternalLink,
  Flame,
  Radio,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { MappingBatch, MappingJob, MappingSummary, MappingType, Offer } from '@/types';
import { buildOfferReadModel } from '@/lib/offer/read-model';
import { notifyGlobalSync } from '@/lib/events/offer-events';
import { useToast } from '@/components/ui/Toast';
import { ReconciliationDrawer } from '@/components/offers/ReconciliationDrawer';

type ActiveTab = 'overview' | 'full_offer' | 'landing_pages' | 'checkouts' | 'scraping_enrichment' | 'executions' | 'errors';

export default function MappingCenterPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [summary, setSummary] = useState<MappingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // Active Running Batch state
  const [activeBatch, setActiveBatch] = useState<MappingBatch | null>(null);
  const [activeJobs, setActiveJobs] = useState<MappingJob[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Scraping Batch state
  const [activeScrapingBatch, setActiveScrapingBatch] = useState<any | null>(null);
  const [selectedScrapeIds, setSelectedScrapeIds] = useState<string[]>([]);
  const [reconciliationOfferId, setReconciliationOfferId] = useState<string | null>(null);

  // Offers lists for LP & Checkout tabs
  const [lpOffers, setLpOffers] = useState<any[]>([]);
  const [checkoutOffers, setCheckoutOffers] = useState<any[]>([]);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [isLoadingAllOffers, setIsLoadingAllOffers] = useState(false);

  // Selection states
  const [selectedLpIds, setSelectedLpIds] = useState<string[]>([]);
  const [selectedCheckoutIds, setSelectedCheckoutIds] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'mapped' | 'failed' | 'all'>('pending');

  // Batches history
  const [batchesHistory, setBatchesHistory] = useState<MappingBatch[]>([]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/mapping/summary');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch mapping summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // Fetch active batch and status
  const fetchActiveBatch = useCallback(async () => {
    try {
      const res = await fetch('/api/mapping/batches?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setActiveBatch(data.activeBatch);
        setActiveJobs(data.jobs || []);
        if (data.activeBatch?.status === 'COMPLETED') {
          fetchSummary();
          notifyGlobalSync('mapping_batch_completed');
        }
      }
    } catch (err) {
      console.error('Failed to fetch active batch:', err);
    }
  }, [fetchSummary]);

  // Fetch offer lists for tabs
  const fetchOffersForTab = useCallback(async (type: MappingType) => {
    setIsLoadingOffers(true);
    try {
      const url = `/api/mapping/offers?type=${type}&status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (type === 'LANDING_PAGE') {
          setLpOffers(data.offers || []);
        } else {
          setCheckoutOffers(data.offers || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch mapping offers:', err);
    } finally {
      setIsLoadingOffers(false);
    }
  }, [statusFilter, searchQuery]);

  // Fetch batches history
  const fetchBatchesHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/mapping/batches');
      const data = await res.json();
      if (data.success) {
        setBatchesHistory(data.batches || []);
      }
    } catch (err) {
      console.error('Failed to fetch batches history:', err);
    }
  }, []);

  // Fetch all offers for full offer view
  const fetchAllOffers = useCallback(async () => {
    setIsLoadingAllOffers(true);
    try {
      const res = await fetch('/api/offers');
      const data = await res.json();
      if (data.offers) {
        setAllOffers(data.offers);
      }
    } catch (err) {
      console.error('Failed to fetch all offers for full offer view:', err);
    } finally {
      setIsLoadingAllOffers(false);
    }
  }, []);

  const filteredFullOffers = React.useMemo(() => {
    if (!searchQuery.trim()) return allOffers;
    const q = searchQuery.toLowerCase();
    return allOffers.filter(
      (o) =>
        (o.product_name || '').toLowerCase().includes(q) ||
        (o.advertiser || '').toLowerCase().includes(q)
    );
  }, [allOffers, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchActiveBatch();
    fetchAllOffers();
  }, [fetchSummary, fetchActiveBatch, fetchAllOffers]);

  // Poll active batch while running or paused
  useEffect(() => {
    if (!activeBatch || (activeBatch.status !== 'RUNNING' && activeBatch.status !== 'PAUSED')) {
      return;
    }
    const interval = setInterval(() => {
      fetchActiveBatch();
    }, 2000);
    return () => clearInterval(interval);
  }, [activeBatch, fetchActiveBatch]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'full_offer') {
      fetchAllOffers();
    } else if (activeTab === 'landing_pages') {
      fetchOffersForTab('LANDING_PAGE');
    } else if (activeTab === 'checkouts') {
      fetchOffersForTab('CHECKOUT');
    } else if (activeTab === 'executions') {
      fetchBatchesHistory();
    }
  }, [activeTab, fetchAllOffers, fetchOffersForTab, fetchBatchesHistory]);

  // Sweep / Refresh All
  const handleSweep = async () => {
    setIsLoadingSummary(true);
    await fetchSummary();
    await fetchActiveBatch();
    await fetchAllOffers();
    if (activeTab === 'landing_pages') fetchOffersForTab('LANDING_PAGE');
    if (activeTab === 'checkouts') fetchOffersForTab('CHECKOUT');
    if (activeTab === 'executions') fetchBatchesHistory();
    toast.success('Varredura da base concluída!');
  };

  // Launch Batch
  const handleLaunchBatch = async (type: MappingType, ids?: string[]) => {
    const targetIds = ids || (type === 'LANDING_PAGE' ? selectedLpIds : selectedCheckoutIds);
    setIsProcessingAction(true);
    try {
      const res = await fetch('/api/mapping/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          offerIds: targetIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Falha ao iniciar lote de mapeamento.');
        return;
      }
      toast.success(`Lote de ${type === 'LANDING_PAGE' ? 'Landing Pages' : 'Checkouts'} iniciado com ${data.batch.total_items} ofertas!`);
      if (type === 'LANDING_PAGE') setSelectedLpIds([]);
      if (type === 'CHECKOUT') setSelectedCheckoutIds([]);
      setActiveBatch(data.batch);
      setActiveJobs(data.jobs);
      fetchSummary();
    } catch (err: any) {
      toast.error('Erro de rede ao iniciar lote.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Batch Control Action (Pause, Resume, Cancel, Reprocess)
  const handleBatchAction = async (batchId: string, action: 'pause' | 'resume' | 'cancel' | 'reprocess_failed') => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/mapping/batches/${batchId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Falha ao executar ação no lote.');
        return;
      }
      toast.success(`Ação "${action.toUpperCase()}" executada no lote.`);
      fetchActiveBatch();
      fetchSummary();
      if (activeTab === 'executions') fetchBatchesHistory();
    } catch (err) {
      toast.error('Erro de comunicação com o servidor.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Fetch active scraping batch
  const fetchActiveScrapingBatch = useCallback(async () => {
    try {
      const res = await fetch('/api/scraping/batches?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setActiveScrapingBatch(data.activeBatch);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchActiveScrapingBatch();
    const interval = setInterval(fetchActiveScrapingBatch, 3000);
    return () => clearInterval(interval);
  }, [fetchActiveScrapingBatch]);

  // Launch Scraping Batch
  const handleLaunchScrapingBatch = async (ids?: string[]) => {
    const targetIds = ids !== undefined ? ids : selectedScrapeIds;
    setIsProcessingAction(true);
    try {
      const res = await fetch('/api/scraping/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerIds: targetIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Falha ao iniciar lote de raspagem.');
        return;
      }
      toast.success('Lote de raspagem e enriquecimento iniciado!');
      setSelectedScrapeIds([]);
      fetchActiveScrapingBatch();
      fetchAllOffers();
    } catch {
      toast.error('Erro ao iniciar lote de raspagem.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Scrape single offer
  const handleScrapeSingle = async (offerId: string) => {
    toast.info('Iniciando raspagem e enriquecimento da oferta...');
    try {
      const res = await fetch('/api/scraping/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Raspagem concluída (${data.report?.status})!`);
        fetchAllOffers();
      } else {
        toast.error(data.error || 'Falha ao raspar oferta.');
      }
    } catch {
      toast.error('Erro de conexão ao raspar oferta.');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-16">
        {/* Header */}
        <PageHeader
          title="Central de Mapeamento"
          description="Automatize a coleta e enriquecimento em lote das Landing Pages e Checkouts das ofertas mineradas sem precisar abrir cada dossiê individualmente."
          actions={
            <button
              onClick={handleSweep}
              disabled={isLoadingSummary}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isLoadingSummary && 'animate-spin')} />
              <span>Varredura da Base</span>
            </button>
          }
        />

        {/* 1. SUMMARY STATS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Offers */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 text-left">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Ofertas</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white tabular-numbers">
              {isLoadingSummary ? '—' : summary?.total_offers ?? 0}
            </p>
          </div>

          {/* LP Pendente */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-blue-500/20 space-y-1 text-left">
            <div className="flex items-center justify-between text-blue-400 text-xs font-medium">
              <span>LP Pendente</span>
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-300 tabular-numbers">
              {isLoadingSummary ? '—' : summary?.lp_pending ?? 0}
            </p>
          </div>

          {/* LP Mapeada */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/20 space-y-1 text-left">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
              <span>LP Mapeada</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-emerald-300 tabular-numbers">
              {isLoadingSummary ? '—' : summary?.lp_mapped ?? 0}
            </p>
          </div>

          {/* Checkout Pendente */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/20 space-y-1 text-left">
            <div className="flex items-center justify-between text-cyan-400 text-xs font-medium">
              <span>Checkout Pendente</span>
              <ShoppingCart className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-cyan-300 tabular-numbers">
              {isLoadingSummary ? '—' : summary?.checkout_pending ?? 0}
            </p>
          </div>

          {/* Checkout Mapeado */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-teal-500/20 space-y-1 text-left">
            <div className="flex items-center justify-between text-teal-400 text-xs font-medium">
              <span>Checkout Mapeado</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-teal-300 tabular-numbers">
              {isLoadingSummary ? '—' : summary?.checkout_mapped ?? 0}
            </p>
          </div>

          {/* Com Erro / Falha */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-rose-500/20 space-y-1 text-left">
            <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
              <span>Falhas / Atenção</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-rose-300 tabular-numbers">
              {isLoadingSummary ? '—' : summary?.failed_count ?? 0}
            </p>
          </div>
        </div>

        {/* 2. ACTIVE RUNNING BATCH DASHBOARD (LIVE PROGRESS PANEL) */}
        {activeBatch && (activeBatch.status === 'RUNNING' || activeBatch.status === 'PAUSED' || activeBatch.status === 'COMPLETED') && (
          <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-r from-blue-600/40 via-cyan-500/40 to-blue-600/40 text-left shadow-2xl">
            <div className="p-5 sm:p-6 rounded-[15px] bg-slate-950/95 border border-slate-800 space-y-4">
              {/* Batch Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                        {activeBatch.type === 'LANDING_PAGE' ? 'Mapeamento de Landing Page' : 'Mapeamento de Checkout'}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase',
                        activeBatch.status === 'RUNNING' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse' :
                        activeBatch.status === 'PAUSED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      )}>
                        {activeBatch.status === 'RUNNING' ? '⚡ Processando' : activeBatch.status === 'PAUSED' ? '⏸ Pausado' : '✓ Concluído'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                      {activeBatch.name}
                    </h3>
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center gap-2">
                  {activeBatch.status === 'RUNNING' && (
                    <button
                      onClick={() => handleBatchAction(activeBatch.id, 'pause')}
                      disabled={isProcessingAction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pausar</span>
                    </button>
                  )}

                  {activeBatch.status === 'PAUSED' && (
                    <button
                      onClick={() => handleBatchAction(activeBatch.id, 'resume')}
                      disabled={isProcessingAction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Continuar</span>
                    </button>
                  )}

                  {(activeBatch.status === 'RUNNING' || activeBatch.status === 'PAUSED') && (
                    <button
                      onClick={() => handleBatchAction(activeBatch.id, 'cancel')}
                      disabled={isProcessingAction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </button>
                  )}

                  {activeBatch.status === 'COMPLETED' && activeBatch.failed_count > 0 && (
                    <button
                      onClick={() => handleBatchAction(activeBatch.id, 'reprocess_failed')}
                      disabled={isProcessingAction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reprocessar Falhas ({activeBatch.failed_count})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Info & Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-300 truncate">
                    Oferta <span className="text-white font-bold">{activeBatch.processed_items}</span> de <span className="text-white font-bold">{activeBatch.total_items}</span> — <span className="text-blue-400">{activeBatch.current_step}</span>
                  </span>
                  <span className="text-blue-400 font-bold tabular-numbers ml-2">
                    {Math.round((activeBatch.processed_items / (activeBatch.total_items || 1)) * 100)}%
                  </span>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${Math.round((activeBatch.processed_items / (activeBatch.total_items || 1)) * 100)}%` }}
                  />
                </div>

                {/* Sub-counter Chips */}
                <div className="flex items-center gap-4 text-xs font-medium text-slate-400 pt-1">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {activeBatch.success_count} concluídas
                  </span>
                  {activeBatch.partial_count > 0 && (
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      {activeBatch.partial_count} parciais
                    </span>
                  )}
                  {activeBatch.failed_count > 0 && (
                    <span className="flex items-center gap-1 text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {activeBatch.failed_count} falhas
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.max(0, activeBatch.total_items - activeBatch.processed_items)} restantes
                  </span>
                </div>
              </div>

              {/* Live Jobs Progress List */}
              {activeJobs.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 max-h-48 overflow-y-auto space-y-1 pr-1">
                  {activeJobs.map((job) => (
                    <div
                      key={job.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl text-xs transition border',
                        job.status === 'RUNNING' ? 'bg-blue-500/10 border-blue-500/30 text-white' :
                        job.status === 'SUCCESS' ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-300' :
                        job.status === 'PARTIAL' ? 'bg-cyan-500/5 border-cyan-500/20 text-slate-300' :
                        job.status === 'FAILED' || job.status === 'FAILED_TIMEOUT' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' :
                        'bg-slate-900/50 border-slate-800/60 text-slate-400'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {job.status === 'RUNNING' && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />}
                        {job.status === 'SUCCESS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        {job.status === 'PARTIAL' && <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        {(job.status === 'FAILED' || job.status === 'FAILED_TIMEOUT') && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                        {job.status === 'QUEUED' && <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                        {job.status === 'CANCELLED' && <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />}

                        <span className="font-semibold truncate">{job.offer_name}</span>
                        {job.advertiser && <span className="text-[10px] text-slate-500 truncate">({job.advertiser})</span>}
                      </div>

                      <div className="text-[11px] font-medium shrink-0 ml-2">
                        {job.status === 'RUNNING' && <span className="text-blue-400">{job.current_step}</span>}
                        {job.status === 'SUCCESS' && <span className="text-emerald-400 font-semibold">Concluído</span>}
                        {job.status === 'PARTIAL' && <span className="text-cyan-400 font-semibold">Parcial</span>}
                        {(job.status === 'FAILED' || job.status === 'FAILED_TIMEOUT') && (
                          <span className="text-rose-400 truncate max-w-[200px]" title={job.error_message || ''}>
                            {job.error_message || 'Falhou'}
                          </span>
                        )}
                        {job.status === 'QUEUED' && <span className="text-slate-500">Aguardando</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. TABS NAVIGATION */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0',
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('full_offer')}
            className={cn(
              'px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0',
              activeTab === 'full_offer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Oferta Completa ({allOffers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('landing_pages')}
            className={cn(
              'px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0',
              activeTab === 'landing_pages'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Landing Pages ({summary?.lp_pending ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('checkouts')}
            className={cn(
              'px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0',
              activeTab === 'checkouts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Checkouts ({summary?.checkout_pending ?? 0})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('scraping_enrichment');
              fetchAllOffers();
              fetchActiveScrapingBatch();
            }}
            className={cn(
              'px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0',
              activeTab === 'scraping_enrichment'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Raspagem & Enriquecimento</span>
          </button>

          <button
            onClick={() => setActiveTab('executions')}
            className={cn(
              'px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0',
              activeTab === 'executions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Execuções</span>
          </button>
        </div>

        {/* 4. TAB CONTENTS */}

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
            {/* Pipeline Mathematical Funnel Diagram */}
            <div className="md:col-span-2 p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">Pipeline de Mapeamento Reconciliado</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                  ✓ 100% das {summary?.total_offers ?? 0} Ofertas Classificadas sem Limbo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
                {/* Stage 1: Landing Pages */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-blue-400 font-bold border-b border-slate-800/80 pb-1.5">
                    <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> 1. LANDING PAGES</span>
                    <span className="text-sm font-bold text-emerald-400">{summary?.lp_mapped ?? 0} Mapeadas</span>
                  </div>
                  <div className="space-y-1.5 text-slate-400 pt-1">
                    <div className="flex justify-between"><span>LP Mapeadas (SUCCESS):</span> <span className="text-emerald-400 font-bold">{summary?.lp_mapped ?? 0}</span></div>
                    <div className="flex justify-between"><span>LP Pendentes:</span> <span className="text-blue-300 font-semibold">{summary?.lp_pending ?? 0}</span></div>
                    <div className="flex justify-between"><span>Falhas de LP:</span> <span className="text-rose-400 font-semibold">{summary?.lp_failed ?? 0}</span></div>
                  </div>
                </div>

                {/* Stage 2: Checkout Discovery */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-800/80 pb-1.5">
                    <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> 2. DESCOBERTA CHECKOUT</span>
                    <span className="text-sm font-bold text-cyan-300">{summary?.discovery_found ?? 0} Encontrados</span>
                  </div>
                  <div className="space-y-1.5 text-slate-400 pt-1">
                    <div className="flex justify-between"><span>Checkout Encontrado (FOUND):</span> <span className="text-cyan-300 font-bold">{summary?.discovery_found ?? 0}</span></div>
                    <div className="flex justify-between"><span>Sem Checkout (NOT_FOUND):</span> <span className="text-amber-400 font-semibold">{summary?.discovery_not_found ?? 0}</span></div>
                    <div className="flex justify-between"><span>A Descobrir (NOT_PROCESSED):</span> <span className="text-slate-400 font-semibold">{summary?.discovery_not_processed ?? 0}</span></div>
                  </div>
                </div>

                {/* Stage 3: Checkout Mapping */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-teal-400 font-bold border-b border-slate-800/80 pb-1.5">
                    <span className="flex items-center gap-1.5"><ShoppingCart className="w-4 h-4" /> 3. MAPEAMENTO CHECKOUT</span>
                    <span className="text-sm font-bold text-teal-300">{summary?.checkout_mapped ?? 0} Mapeados</span>
                  </div>
                  <div className="space-y-1.5 text-slate-400 pt-1">
                    <div className="flex justify-between"><span>Checkouts Mapeados (SUCCESS):</span> <span className="text-teal-300 font-bold">{summary?.checkout_mapped ?? 0}</span></div>
                    <div className="flex justify-between"><span>Checkouts Pendentes:</span> <span className="text-cyan-300 font-semibold">{summary?.checkout_pending ?? 0}</span></div>
                    <div className="flex justify-between"><span>Falhas no Checkout:</span> <span className="text-rose-400 font-semibold">{summary?.checkout_failed ?? 0}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Card 1: Landing Pages */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Mapeamento em Lote de Landing Pages</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Varre todas as ofertas que possuem URL de Landing Page e ainda não foram mapeadas (ou falharam), capturando seções, hero copy, preços e opções front-end automaticamente.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">
                  <strong className="text-blue-400 font-bold text-sm">{summary?.lp_pending ?? 0}</strong> LPs pendentes
                </span>

                <button
                  onClick={() => handleLaunchBatch('LANDING_PAGE')}
                  disabled={Boolean(activeBatch?.status === 'RUNNING') || (summary?.lp_pending ?? 0) === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-500/20 disabled:opacity-40 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Mapear {summary?.lp_pending ?? 0} Landing Pages</span>
                </button>
              </div>
            </div>

            {/* Quick Card 2: Checkouts */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Mapeamento em Lote de Checkouts</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Executa o Checkout Intelligence em lote para ofertas com checkout real descoberto, identificando provedor, order bumps, preços de checkout e opções de parcelamento.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">
                  <strong className="text-cyan-400 font-bold text-sm">{summary?.checkout_pending ?? 0}</strong> Checkouts pendentes
                </span>

                <button
                  onClick={() => handleLaunchBatch('CHECKOUT')}
                  disabled={Boolean(activeBatch?.status === 'RUNNING') || (summary?.checkout_pending ?? 0) === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-md shadow-cyan-500/20 disabled:opacity-40 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Mapear {summary?.checkout_pending ?? 0} Checkouts</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: OFERTA COMPLETA (4 Pipeline Pillars) */}
        {activeTab === 'full_offer' && (
          <div className="space-y-4 text-left">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 px-4 rounded-2xl text-xs">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar oferta ou anunciante..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="text-xs text-slate-400">
                <span>{filteredFullOffers.length} ofertas catalogadas</span>
              </div>
            </div>

            {/* Full Offer Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Oferta & Anunciante</th>
                      <th className="px-4 py-3">1. Escala (Ads)</th>
                      <th className="px-4 py-3">2. Criativos</th>
                      <th className="px-4 py-3">3. Landing Page</th>
                      <th className="px-4 py-3">4. Checkout</th>
                      <th className="px-4 py-3">Status Geral</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredFullOffers.map((offer) => {
                      const readModel = buildOfferReadModel(offer);
                      const stages = readModel.stages;

                      return (
                        <tr key={offer.id} className="hover:bg-slate-800/40 transition">
                          {/* Offer Name */}
                          <td className="px-4 py-3 max-w-[220px]">
                            <Link
                              href={`/offers/${offer.id}`}
                              className="font-bold text-white hover:text-blue-400 line-clamp-1 transition"
                            >
                              {offer.product_name}
                            </Link>
                            <p className="text-[11px] text-slate-400 truncate">
                              {offer.advertiser || 'Anunciante —'}
                            </p>
                          </td>

                          {/* Scale */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {stages.scale.isVerified ? (
                              <span className="text-blue-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                {stages.scale.label}
                              </span>
                            ) : (
                              <span className="text-slate-500 flex items-center gap-1">
                                <span className="text-slate-600">○</span> Não coletado
                              </span>
                            )}
                          </td>

                          {/* Creatives */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {stages.creatives.isVerified ? (
                              <span className="text-purple-300 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                {stages.creatives.label}
                              </span>
                            ) : (
                              <span className="text-slate-500 flex items-center gap-1">
                                <span className="text-slate-600">○</span> Não coletado
                              </span>
                            )}
                          </td>

                          {/* LP */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {stages.landingPage.isMapped ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Mapeada {stages.landingPage.price !== null ? `(R$ ${stages.landingPage.price.toFixed(2)})` : ''}
                              </span>
                            ) : (
                              <span className="text-amber-400/90 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Pendente
                              </span>
                            )}
                          </td>

                          {/* Checkout */}
                          <td className="px-4 py-3 max-w-[150px] truncate">
                            {stages.checkout.isProcessed ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-1 truncate">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                {stages.checkout.label}
                              </span>
                            ) : stages.checkout.discoveryStatus === 'FOUND' ? (
                              <span className="text-cyan-400 flex items-center gap-1 truncate">
                                <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                                Pendente mapear
                              </span>
                            ) : (
                              <span className="text-slate-500 flex items-center gap-1">
                                <span className="text-slate-600">○</span> Não processado
                              </span>
                            )}
                          </td>

                          {/* Status Geral */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge
                              status={readModel.data_status}
                              breakdown={stages}
                              missingRequirements={readModel.missing_requirements}
                              size="sm"
                            />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Link
                              href={`/offers/${offer.id}`}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition inline-flex items-center gap-1"
                            >
                              <span>Ver Dossiê</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2 & TAB 3: LANDING PAGES & CHECKOUTS LIST TABLES */}
        {(activeTab === 'landing_pages' || activeTab === 'checkouts') && (
          <div className="space-y-4 text-left">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 px-4 rounded-2xl text-xs">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar oferta ou anunciante..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  {activeTab === 'landing_pages' ? (
                    <>
                      <option value="pending">Pendentes / Falhas ({summary?.lp_pending ?? 0})</option>
                      <option value="mapped">Mapeadas ({summary?.lp_mapped ?? 0})</option>
                      <option value="failed">Falhas ({summary?.lp_failed ?? 0})</option>
                      <option value="all">Todas ({summary?.total_offers ?? 0})</option>
                    </>
                  ) : (
                    <>
                      <option value="pending">Checkouts Pendentes ({summary?.checkout_pending ?? 0})</option>
                      <option value="mapped">Checkouts Mapeados ({summary?.checkout_mapped ?? 0})</option>
                      <option value="not_found">Sem Checkout Detectado ({summary?.discovery_not_found ?? 0})</option>
                      <option value="not_processed">A Descobrir ({summary?.discovery_not_processed ?? 0})</option>
                      <option value="failed">Falhas ({summary?.checkout_failed ?? 0})</option>
                      <option value="all">Todos os Descobertos ({summary?.discovery_found ?? 0})</option>
                    </>
                  )}
                </select>
              </div>

              {/* Action Trigger Button */}
              {activeTab === 'landing_pages' ? (
                <button
                  onClick={() => handleLaunchBatch('LANDING_PAGE', selectedLpIds.length > 0 ? selectedLpIds : undefined)}
                  disabled={Boolean(activeBatch?.status === 'RUNNING') || isProcessingAction}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-40 w-full sm:w-auto justify-center"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {selectedLpIds.length > 0
                      ? `Mapear ${selectedLpIds.length} LPs Selecionadas`
                      : `Mapear Todas as LPs Pendentes (${summary?.lp_pending ?? 0})`}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => handleLaunchBatch('CHECKOUT', selectedCheckoutIds.length > 0 ? selectedCheckoutIds : undefined)}
                  disabled={Boolean(activeBatch?.status === 'RUNNING') || isProcessingAction}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition active:scale-95 disabled:opacity-40 w-full sm:w-auto justify-center"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {selectedCheckoutIds.length > 0
                      ? `Mapear ${selectedCheckoutIds.length} Checkouts Selecionados`
                      : `Mapear Todos os Checkouts Pendentes (${summary?.checkout_pending ?? 0})`}
                  </span>
                </button>
              )}
            </div>

            {/* List Table */}
            {isLoadingOffers ? (
              <div className="p-12 text-center text-slate-400 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                <span>Carregando ofertas elegíveis...</span>
              </div>
            ) : (activeTab === 'landing_pages' ? lpOffers : checkoutOffers).length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs">
                <span>Nenhuma oferta encontrada para os critérios selecionados.</span>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3 pl-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            activeTab === 'landing_pages'
                              ? lpOffers.length > 0 && selectedLpIds.length === lpOffers.length
                              : checkoutOffers.length > 0 && selectedCheckoutIds.length === checkoutOffers.length
                          }
                          onChange={(e) => {
                            const offers = activeTab === 'landing_pages' ? lpOffers : checkoutOffers;
                            if (e.target.checked) {
                              const allIds = offers.map((o) => o.offer.id);
                              if (activeTab === 'landing_pages') setSelectedLpIds(allIds);
                              else setSelectedCheckoutIds(allIds);
                            } else {
                              if (activeTab === 'landing_pages') setSelectedLpIds([]);
                              else setSelectedCheckoutIds([]);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Oferta</th>
                      <th className="p-3">Anunciante</th>
                      <th className="p-3">URL Alvo</th>
                      <th className="p-3">Status Mapeamento</th>
                      <th className="p-3 pr-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(activeTab === 'landing_pages' ? lpOffers : checkoutOffers).map((item) => {
                      const isSelected = activeTab === 'landing_pages'
                        ? selectedLpIds.includes(item.offer.id)
                        : selectedCheckoutIds.includes(item.offer.id);

                      return (
                        <tr key={item.offer.id} className={cn('hover:bg-slate-850/50 transition', isSelected && 'bg-blue-500/5')}>
                          <td className="p-3 pl-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const id = item.offer.id;
                                if (activeTab === 'landing_pages') {
                                  setSelectedLpIds((prev) => e.target.checked ? [...prev, id] : prev.filter((x) => x !== id));
                                } else {
                                  setSelectedCheckoutIds((prev) => e.target.checked ? [...prev, id] : prev.filter((x) => x !== id));
                                }
                              }}
                              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-100">
                            <Link href={`/offers/${item.offer.id}`} className="hover:text-blue-400 transition">
                              {item.offer.product_name || 'Oferta Sem Nome'}
                            </Link>
                          </td>
                          <td className="p-3 text-slate-400 font-medium">{item.offer.advertiser || '—'}</td>
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {item.targetUrl ? (
                              <a href={item.targetUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 truncate max-w-[200px] inline-block">
                                {item.targetUrl}
                              </a>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              item.mappingStatus === 'MAPPED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                              item.mappingStatus === 'FAILED' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
                              item.mappingStatus === 'PENDING' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' :
                              'bg-slate-800 text-slate-500 border-slate-700'
                            )}>
                              {item.mappingStatus === 'MAPPED' ? '✓ Mapeada' : item.mappingStatus === 'FAILED' ? '✕ Falhou' : item.mappingStatus === 'PENDING' ? '⏳ Pendente' : '— Sem URL'}
                            </span>
                          </td>
                          <td className="p-3 pr-4 text-right">
                            <button
                              onClick={() => handleLaunchBatch(activeTab === 'landing_pages' ? 'LANDING_PAGE' : 'CHECKOUT', [item.offer.id])}
                              disabled={Boolean(activeBatch?.status === 'RUNNING')}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white text-[11px] font-semibold transition disabled:opacity-30"
                            >
                              Mapear
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: RASPAGEM & ENRIQUECIMENTO */}
        {activeTab === 'scraping_enrichment' && (() => {
          const scrapingPendingCount = allOffers.filter(
            (o) => !o.data_scraping_status || o.data_scraping_status === 'NOT_PROCESSED' || o.data_scraping_status === 'PARTIAL'
          ).length;
          const scrapingSuccessCount = allOffers.filter((o) => o.data_scraping_status === 'SUCCESS').length;

          const filteredScrapeOffers = allOffers.filter((o) => {
            const matchesSearch =
              !searchQuery ||
              (o.product_name && o.product_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (o.advertiser && o.advertiser.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (o.niche && o.niche.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;
            if (statusFilter === 'pending') {
              return !o.data_scraping_status || o.data_scraping_status === 'NOT_PROCESSED' || o.data_scraping_status === 'PARTIAL';
            }
            if (statusFilter === 'mapped') {
              return o.data_scraping_status === 'SUCCESS';
            }
            if (statusFilter === 'failed') {
              return o.data_scraping_status === 'FAILED';
            }
            return true;
          });

          return (
            <div className="space-y-4">
              {/* Active Scraping Batch Progress Banner */}
              {activeScrapingBatch && activeScrapingBatch.status === 'RUNNING' && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                          ⚡ Raspagem em Andamento
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1">
                          {activeScrapingBatch.name}
                        </h4>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {activeScrapingBatch.processed_items} / {activeScrapingBatch.total_items} ({activeScrapingBatch.current_progress_percent}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${activeScrapingBatch.current_progress_percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    {activeScrapingBatch.current_step}
                  </p>
                </div>
              )}

              {/* Sub-Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar ofertas para raspagem..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Filter by status */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setStatusFilter('pending')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-medium transition',
                        statusFilter === 'pending' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      )}
                    >
                      Pendentes ({scrapingPendingCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('mapped')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-medium transition',
                        statusFilter === 'mapped' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      )}
                    >
                      Enriquecidas ({scrapingSuccessCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-medium transition',
                        statusFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      )}
                    >
                      Todas ({allOffers.length})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedScrapeIds.length > 0 && (
                    <button
                      onClick={() => handleLaunchScrapingBatch(selectedScrapeIds)}
                      disabled={isProcessingAction}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Raspar Selecionadas ({selectedScrapeIds.length})</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleLaunchScrapingBatch([])}
                    disabled={isProcessingAction || scrapingPendingCount === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', isProcessingAction && 'animate-spin')} />
                    <span>Raspar Pendentes ({scrapingPendingCount})</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm text-left text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3 pl-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            filteredScrapeOffers.length > 0 &&
                            filteredScrapeOffers.every((o) => selectedScrapeIds.includes(o.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScrapeIds(filteredScrapeOffers.map((o) => o.id));
                            } else {
                              setSelectedScrapeIds([]);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Oferta</th>
                      <th className="p-3">Anunciante</th>
                      <th className="p-3">LP</th>
                      <th className="p-3">Checkout</th>
                      <th className="p-3">Meta Ads</th>
                      <th className="p-3">Criativos</th>
                      <th className="p-3">Status Raspagem</th>
                      <th className="p-3 pr-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredScrapeOffers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                          Nenhuma oferta encontrada para este filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredScrapeOffers.map((o) => {
                        const readModel = buildOfferReadModel(o);
                        const isSelected = selectedScrapeIds.includes(o.id);
                        const status = o.data_scraping_status || 'NOT_PROCESSED';

                        return (
                          <tr
                            key={o.id}
                            className={cn('hover:bg-slate-850/50 transition font-sans', isSelected && 'bg-emerald-500/5')}
                          >
                            <td className="p-3 pl-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  setSelectedScrapeIds((prev) =>
                                    e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id)
                                  );
                                }}
                                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-white max-w-[220px] truncate" title={o.product_name}>
                                {o.product_name}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {o.niche || 'Nicho —'} {o.price ? `• R$ ${o.price.toFixed(2)}` : ''}
                              </div>
                            </td>
                            <td className="p-3 text-slate-400 truncate max-w-[140px]" title={o.advertiser || ''}>
                              {o.advertiser || '—'}
                            </td>
                            <td className="p-3">
                              {readModel.stages.landingPage.isMapped ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  ✓ Mapeada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-800">
                                  ✕ Pendente
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {readModel.stages.checkout.isProcessed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  ✓ Mapeado
                                </span>
                              ) : (readModel.stages.checkout.discoveryStatus as any) === 'NOT_APPLICABLE' ? (
                                <span className="text-[10px] text-slate-500">○ N/A</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-800">
                                  ✕ Pendente
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-xs">
                              {typeof readModel.metrics.active_ads_count === 'number' ? (
                                <span className="text-emerald-400 font-bold">
                                  {readModel.metrics.active_ads_count} ads
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-xs">
                              {typeof readModel.metrics.unique_creatives_count === 'number' ? (
                                <span className="text-purple-300 font-bold">
                                  {readModel.metrics.unique_creatives_count} un
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                                  status === 'SUCCESS'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : status === 'PARTIAL'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : status === 'FAILED'
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                )}
                              >
                                {status === 'SUCCESS' ? 'ENRIQUECIDA' : status === 'PARTIAL' ? 'DADOS PARCIAIS' : status}
                              </span>
                            </td>
                            <td className="p-3 pr-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setReconciliationOfferId(o.id)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
                                >
                                  Ver Dados
                                </button>
                                <button
                                  onClick={() => handleScrapeSingle(o.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition"
                                >
                                  Raspar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* TAB 4: EXECUÇÕES (BATCH HISTORY) */}
        {activeTab === 'executions' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm text-left text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3 pl-4">Lote</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Itens</th>
                  <th className="p-3">Sucesso / Falhas</th>
                  <th className="p-3">Data Criado</th>
                  <th className="p-3 pr-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {batchesHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum lote de mapeamento executado até o momento.
                    </td>
                  </tr>
                ) : (
                  batchesHistory.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-3 pl-4 font-bold text-white">{b.name}</td>
                      <td className="p-3 font-semibold text-blue-400">{b.type}</td>
                      <td className="p-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          b.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                          b.status === 'RUNNING' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' :
                          b.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                          'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        )}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-200 tabular-numbers">{b.processed_items} / {b.total_items}</td>
                      <td className="p-3 font-medium text-slate-300 tabular-numbers">
                        <span className="text-emerald-400">{b.success_count} ✓</span> / <span className="text-rose-400">{b.failed_count} ✕</span>
                      </td>
                      <td className="p-3 text-slate-400">{formatDate(b.created_at)}</td>
                      <td className="p-3 pr-4 text-right">
                        {b.failed_count > 0 && (
                          <button
                            onClick={() => handleBatchAction(b.id, 'reprocess_failed')}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition"
                          >
                            Reprocessar Falhas
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Reconciliation Drawer */}
        <ReconciliationDrawer
          offerId={reconciliationOfferId}
          isOpen={Boolean(reconciliationOfferId)}
          onClose={() => setReconciliationOfferId(null)}
          onScrapeAgain={handleScrapeSingle}
        />
      </div>
    </AppShell>
  );
}
