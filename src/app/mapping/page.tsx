'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  Zap,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { MappingBatch, MappingJob, MappingSummary, MappingType, Offer } from '@/types';
import { buildOfferReadModel } from '@/lib/offer/read-model';
import { notifyGlobalSync } from '@/lib/events/offer-events';
import { useToast } from '@/components/ui/Toast';
import { ReconciliationDrawer } from '@/components/offers/ReconciliationDrawer';
import { getSupabaseClient } from '@/lib/supabase/client';

type ActiveTab = 'overview' | 'full_offer' | 'landing_pages' | 'checkouts' | 'scraping_enrichment' | 'executions';
type StatusFilterType = 'all' | 'pending' | 'queued' | 'running' | 'mapped' | 'partial' | 'failed';

export default function MappingCenterPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Carregando Central de Mapeamento...</p>
        </div>
      </AppShell>
    }>
      <MappingCenterContent />
    </Suspense>
  );
}

function MappingCenterContent() {
  const toast = useToast();
  const searchParams = useSearchParams();

  // URL query params for deep-linking (e.g. from Dossier "Mapear Agora")
  const urlOfferId = searchParams.get('offerId') || searchParams.get('offer_id');
  const urlType = searchParams.get('type') as 'LANDING_PAGE' | 'CHECKOUT' | null;
  const urlAutoStart = searchParams.get('autoStart') === 'true';

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    urlType === 'CHECKOUT' ? 'checkouts' : urlOfferId ? 'landing_pages' : 'overview'
  );
  const [summary, setSummary] = useState<MappingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // Auto-scan on mount state
  const hasAutoScannedRef = useRef(false);
  const [isScanningBase, setIsScanningBase] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);

  // Realtime connection status
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Active Running Batch state
  const [activeBatch, setActiveBatch] = useState<MappingBatch | null>(null);
  const [activeJobs, setActiveJobs] = useState<MappingJob[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Offers lists for LP & Checkout tabs
  const [lpOffers, setLpOffers] = useState<any[]>([]);
  const [checkoutOffers, setCheckoutOffers] = useState<any[]>([]);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [isLoadingAllOffers, setIsLoadingAllOffers] = useState(false);

  // Selection states
  const [selectedLpIds, setSelectedLpIds] = useState<string[]>([]);
  const [selectedCheckoutIds, setSelectedCheckoutIds] = useState<string[]>([]);

  // Expanded rows for drawer/detail inspection
  const [expandedOfferIds, setExpandedOfferIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState(urlOfferId ? urlOfferId : '');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('pending');

  // Scraping Batch state
  const [activeScrapingBatch, setActiveScrapingBatch] = useState<any | null>(null);
  const [selectedScrapeIds, setSelectedScrapeIds] = useState<string[]>([]);
  const [reconciliationOfferId, setReconciliationOfferId] = useState<string | null>(null);

  // Batches history
  const [batchesHistory, setBatchesHistory] = useState<MappingBatch[]>([]);

  // 1. Fetch summary canonical stats
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/mapping/summary');
      const data = await res.json();
      if (data.success && data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('[MAPPING] Failed to fetch summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // 2. Fetch active batch and active jobs
  const fetchActiveBatch = useCallback(async () => {
    try {
      const res = await fetch('/api/mapping/batches?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setActiveBatch(data.activeBatch || null);
        setActiveJobs(data.jobs || []);
        if (data.activeBatch?.status === 'COMPLETED') {
          fetchSummary();
          notifyGlobalSync('mapping_batch_completed');
        }
      }
    } catch (err) {
      console.error('[MAPPING] Failed to fetch active batch:', err);
    }
  }, [fetchSummary]);

  // 3. Fetch offer lists for tabs
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
      console.error('[MAPPING] Failed to fetch mapping offers:', err);
    } finally {
      setIsLoadingOffers(false);
    }
  }, [statusFilter, searchQuery]);

  // 4. Fetch all offers
  const fetchAllOffers = useCallback(async () => {
    setIsLoadingAllOffers(true);
    try {
      const res = await fetch('/api/offers');
      const data = await res.json();
      if (data.offers) {
        setAllOffers(data.offers);
      }
    } catch (err) {
      console.error('[MAPPING] Failed to fetch all offers:', err);
    } finally {
      setIsLoadingAllOffers(false);
    }
  }, []);

  // 5. Fetch batches history
  const fetchBatchesHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/mapping/batches');
      const data = await res.json();
      if (data.success) {
        setBatchesHistory(data.batches || []);
      }
    } catch (err) {
      console.error('[MAPPING] Failed to fetch batches history:', err);
    }
  }, []);

  // 6. Automatic non-blocking Base Scan on entry
  const runAutoScan = useCallback(async (isManual: boolean = false) => {
    setIsScanningBase(true);
    setScanMessage('Verificando base...');
    try {
      const res = await fetch('/api/mapping/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setScanMessage('Base sincronizada agora');
        setLastScannedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        if (data.stats) {
          setSummary(data.stats);
          setIsLoadingSummary(false);
        }
        if (isManual) {
          toast.success('Varredura e reconciliação da base concluídas!');
        }
      } else {
        setScanMessage('Aviso na verificação');
        if (isManual) toast.error('Aviso na varredura da base.');
      }
    } catch (err) {
      setScanMessage('Falha ao verificar base');
      if (isManual) toast.error('Falha de conexão na varredura.');
    } finally {
      setIsScanningBase(false);
      fetchSummary();
      fetchActiveBatch();
    }
  }, [fetchSummary, fetchActiveBatch, toast]);

  // Trigger auto-scan EXACTLY ONCE on mount
  useEffect(() => {
    if (!hasAutoScannedRef.current) {
      hasAutoScannedRef.current = true;
      runAutoScan(false);
    }
  }, [runAutoScan]);

  // Initial data loading
  useEffect(() => {
    fetchSummary();
    fetchActiveBatch();
    fetchAllOffers();
  }, [fetchSummary, fetchActiveBatch, fetchAllOffers]);

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

  // 7. Supabase Realtime Subscription + Silent Polling Fallback
  useEffect(() => {
    const supabase = getSupabaseClient();
    let channel: any = null;

    if (supabase) {
      channel = supabase
        .channel('mapping-center-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mapping_jobs' },
          (payload: any) => {
            const updatedJob = payload.new as MappingJob;
            if (!updatedJob) return;

            // 1. Update activeJobs list
            setActiveJobs((prev) => {
              const idx = prev.findIndex((j) => j.id === updatedJob.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedJob;
                return next;
              }
              if (updatedJob.status === 'QUEUED' || updatedJob.status === 'RUNNING') {
                return [updatedJob, ...prev];
              }
              return prev;
            });

            // 2. Realtime update in active table rows
            const updateRow = (items: any[]) =>
              items.map((item) => {
                if (item.offer.id === updatedJob.offer_id) {
                  return {
                    ...item,
                    mappingStatus: updatedJob.status,
                    currentStep: updatedJob.current_step,
                    progressPercent: updatedJob.progress_percent,
                    lastHeartbeatAt: updatedJob.last_heartbeat_at,
                    activeJob: updatedJob,
                  };
                }
                return item;
              });

            setLpOffers((prev) => updateRow(prev));
            setCheckoutOffers((prev) => updateRow(prev));

            // 3. If job finished, refresh summary count
            if (updatedJob.status === 'SUCCESS' || updatedJob.status === 'PARTIAL' || updatedJob.status === 'FAILED') {
              fetchSummary();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mapping_batches' },
          (payload: any) => {
            const updatedBatch = payload.new as MappingBatch;
            if (!updatedBatch) return;

            setActiveBatch((prev) => {
              if (prev && prev.id === updatedBatch.id) {
                return updatedBatch;
              }
              if (updatedBatch.status === 'RUNNING' || updatedBatch.status === 'PAUSED') {
                return updatedBatch;
              }
              return prev;
            });

            if (updatedBatch.status === 'COMPLETED') {
              toast.success(
                `Lote "${updatedBatch.name}" concluído! (${updatedBatch.success_count} concluídas, ${updatedBatch.failed_count} falhas)`
              );
              fetchSummary();
              fetchBatchesHistory();
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeConnected(true);
            setIsReconnecting(false);
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            setIsRealtimeConnected(false);
            setIsReconnecting(true);
          }
        });
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchSummary, fetchBatchesHistory, toast]);

  // 8. Fallback Polling (Every 3s ONLY while active jobs exist)
  const hasActiveProcessing = Boolean(
    activeBatch?.status === 'RUNNING' ||
    activeJobs.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING') ||
    lpOffers.some((o) => o.mappingStatus === 'QUEUED' || o.mappingStatus === 'RUNNING') ||
    checkoutOffers.some((o) => o.mappingStatus === 'QUEUED' || o.mappingStatus === 'RUNNING')
  );

  useEffect(() => {
    if (!hasActiveProcessing) return;

    const interval = setInterval(() => {
      fetchActiveBatch();
      if (activeTab === 'landing_pages') fetchOffersForTab('LANDING_PAGE');
      if (activeTab === 'checkouts') fetchOffersForTab('CHECKOUT');
      fetchSummary();
    }, 3000);

    return () => clearInterval(interval);
  }, [hasActiveProcessing, activeTab, fetchActiveBatch, fetchOffersForTab, fetchSummary]);

  // 9. Handle immediate optimistic mapping for a single offer
  const handleMapSingle = async (type: MappingType, offerId: string) => {
    // 1. Optimistic Update: Immediately mark row as QUEUED
    const setOptimistic = (prev: any[]) =>
      prev.map((item) => {
        if (item.offer.id === offerId) {
          return {
            ...item,
            mappingStatus: 'QUEUED',
            currentStep: 'Aguardando worker...',
            progressPercent: 0,
            activeJob: {
              id: 'temp_job',
              status: 'QUEUED',
              current_step: 'Aguardando worker...',
              progress_percent: 0,
              type,
            },
          };
        }
        return item;
      });

    if (type === 'LANDING_PAGE') setLpOffers((prev) => setOptimistic(prev));
    else setCheckoutOffers((prev) => setOptimistic(prev));

    try {
      const res = await fetch('/api/mapping/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, type }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Falha ao enfileirar mapeamento.');
        if (type === 'LANDING_PAGE') fetchOffersForTab('LANDING_PAGE');
        else fetchOffersForTab('CHECKOUT');
        return;
      }

      toast.info(`Oferta adicionada à fila de mapeamento (${data.job?.status || 'QUEUED'})`);
      fetchActiveBatch();
      fetchSummary();
    } catch (err: any) {
      toast.error('Erro de conexão ao enfileirar job.');
    }
  };

  // 10. Handle Batch Launch (Mapear Todas / Selecionadas)
  const handleLaunchBatch = async (type: MappingType, ids?: string[]) => {
    const targetIds = ids || (type === 'LANDING_PAGE' ? selectedLpIds : selectedCheckoutIds);
    setIsProcessingAction(true);

    // Optimistic update of targeted rows to QUEUED immediately
    const targetIdSet = new Set(targetIds.length > 0 ? targetIds : (type === 'LANDING_PAGE' ? lpOffers : checkoutOffers).map((o) => o.offer.id));
    const setOptimisticBatch = (prev: any[]) =>
      prev.map((item) => {
        if (targetIdSet.has(item.offer.id) && item.mappingStatus !== 'MAPPED') {
          return {
            ...item,
            mappingStatus: 'QUEUED',
            currentStep: 'Aguardando worker...',
            progressPercent: 0,
          };
        }
        return item;
      });

    if (type === 'LANDING_PAGE') setLpOffers((prev) => setOptimisticBatch(prev));
    else setCheckoutOffers((prev) => setOptimisticBatch(prev));

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
        if (type === 'LANDING_PAGE') fetchOffersForTab('LANDING_PAGE');
        else fetchOffersForTab('CHECKOUT');
        return;
      }

      toast.success(`Lote iniciado: ${data.batch.total_items} ofertas colocadas na fila!`);
      if (type === 'LANDING_PAGE') setSelectedLpIds([]);
      if (type === 'CHECKOUT') setSelectedCheckoutIds([]);
      setActiveBatch(data.batch);
      setActiveJobs(data.jobs || []);
      fetchSummary();
    } catch (err: any) {
      toast.error('Erro de rede ao iniciar lote.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 11. Batch Control Action (Pause, Resume, Cancel, Reprocess)
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
      toast.success(`Ação "${action.toUpperCase()}" aplicada com sucesso.`);
      fetchActiveBatch();
      fetchSummary();
      if (activeTab === 'executions') fetchBatchesHistory();
    } catch (err) {
      toast.error('Erro de comunicação com o servidor.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (offerId: string) => {
    setExpandedOfferIds((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

  // Auto-scroll to URL target offer if provided
  useEffect(() => {
    if (urlOfferId) {
      const element = document.getElementById(`offer-row-${urlOfferId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [urlOfferId, lpOffers, checkoutOffers]);

  const filteredFullOffers = React.useMemo(() => {
    if (!searchQuery.trim()) return allOffers;
    const q = searchQuery.toLowerCase();
    return allOffers.filter(
      (o) =>
        (o.product_name || '').toLowerCase().includes(q) ||
        (o.advertiser || '').toLowerCase().includes(q)
    );
  }, [allOffers, searchQuery]);

  return (
    <AppShell>
      <div className="space-y-6 pb-16">
        {/* Header with Auto-Scan & Realtime Live Status */}
        <PageHeader
          title="Central de Mapeamento"
          description="Painel operacional em tempo real: varredura automática, fila persistida e mapeamento concorrente com zero F5."
          actions={
            <div className="flex items-center gap-2.5">
              {/* Realtime Live Pulse Pill */}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition',
                  isRealtimeConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : isReconnecting
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                )}
                title={isRealtimeConnected ? 'Supabase Realtime ativo' : 'Atualização com polling fallback'}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isRealtimeConnected
                      ? 'bg-emerald-400 animate-pulse'
                      : isReconnecting
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-slate-500'
                  )}
                />
                <span>
                  {isRealtimeConnected
                    ? 'Ao vivo'
                    : isReconnecting
                    ? 'Reconectando...'
                    : 'Modo Polling (3s)'}
                </span>
              </div>

              {/* Base Sincronizada Pill */}
              <div
                className={cn(
                  'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition',
                  isScanningBase
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                )}
              >
                {isScanningBase ? (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>
                  {isScanningBase
                    ? 'Verificando base...'
                    : lastScannedAt
                    ? `Sincronizada às ${lastScannedAt}`
                    : 'Base sincronizada'}
                </span>
              </div>

              {/* Botão Forçar Varredura da Base */}
              <button
                onClick={() => runAutoScan(true)}
                disabled={isScanningBase}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-semibold shadow transition active:scale-95 disabled:opacity-50"
                title="Forçar nova varredura e reconciliação dos estados do banco"
              >
                <RefreshCw className={cn('w-3.5 h-3.5 text-blue-400', isScanningBase && 'animate-spin')} />
                <span>Varredura da Base</span>
              </button>
            </div>
          }
        />

        {/* 1. TOP STATS CARDS (INTERACTIVE FILTERS & NAVIGATION - ZERO FAKE ZERO) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Ofertas */}
          <button
            onClick={() => {
              setActiveTab('full_offer');
              setStatusFilter('all');
            }}
            className={cn(
              'p-4 rounded-2xl bg-slate-900/90 border space-y-1 text-left transition-all active:scale-[0.98] cursor-pointer hover:border-slate-600',
              activeTab === 'full_offer' ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/5' : 'border-slate-800'
            )}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Ofertas</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white tabular-numbers">
              {isLoadingSummary ? (
                <span className="text-slate-600 animate-pulse text-base font-normal">[...]</span>
              ) : (
                summary?.total_offers ?? 0
              )}
            </p>
            <p className="text-[10px] text-slate-500">Ver todas no funil</p>
          </button>

          {/* 2. LP Pendente */}
          <button
            onClick={() => {
              setActiveTab('landing_pages');
              setStatusFilter('pending');
            }}
            className={cn(
              'p-4 rounded-2xl bg-slate-900/90 border space-y-1 text-left transition-all active:scale-[0.98] cursor-pointer hover:border-blue-400/60',
              activeTab === 'landing_pages' && statusFilter === 'pending'
                ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/10'
                : 'border-blue-500/20'
            )}
          >
            <div className="flex items-center justify-between text-blue-400 text-xs font-medium">
              <span>LP Pendente</span>
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-300 tabular-numbers">
              {isLoadingSummary ? (
                <span className="text-blue-500/60 animate-pulse text-base font-normal">[...]</span>
              ) : (
                summary?.lp_pending ?? 0
              )}
            </p>
            <p className="text-[10px] text-blue-400/80">Filtrar LPs a mapear</p>
          </button>

          {/* 3. LP Mapeada */}
          <button
            onClick={() => {
              setActiveTab('landing_pages');
              setStatusFilter('mapped');
            }}
            className={cn(
              'p-4 rounded-2xl bg-slate-900/90 border space-y-1 text-left transition-all active:scale-[0.98] cursor-pointer hover:border-emerald-400/60',
              activeTab === 'landing_pages' && statusFilter === 'mapped'
                ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/10'
                : 'border-emerald-500/20'
            )}
          >
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
              <span>LP Mapeada</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-emerald-300 tabular-numbers">
              {isLoadingSummary ? (
                <span className="text-emerald-500/60 animate-pulse text-base font-normal">[...]</span>
              ) : (
                summary?.lp_mapped ?? 0
              )}
            </p>
            <p className="text-[10px] text-emerald-400/80">Filtrar LPs concluídas</p>
          </button>

          {/* 4. Checkout Pendente */}
          <button
            onClick={() => {
              setActiveTab('checkouts');
              setStatusFilter('pending');
            }}
            className={cn(
              'p-4 rounded-2xl bg-slate-900/90 border space-y-1 text-left transition-all active:scale-[0.98] cursor-pointer hover:border-cyan-400/60',
              activeTab === 'checkouts' && statusFilter === 'pending'
                ? 'ring-2 ring-cyan-500 border-cyan-500 bg-cyan-500/10'
                : 'border-cyan-500/20'
            )}
          >
            <div className="flex items-center justify-between text-cyan-400 text-xs font-medium">
              <span>Checkout Pendente</span>
              <ShoppingCart className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-cyan-300 tabular-numbers">
              {isLoadingSummary ? (
                <span className="text-cyan-500/60 animate-pulse text-base font-normal">[...]</span>
              ) : (
                summary?.checkout_pending ?? 0
              )}
            </p>
            <p className="text-[10px] text-cyan-400/80">Filtrar checkouts pendentes</p>
          </button>

          {/* 5. Checkout Mapeado */}
          <button
            onClick={() => {
              setActiveTab('checkouts');
              setStatusFilter('mapped');
            }}
            className={cn(
              'p-4 rounded-2xl bg-slate-900/90 border space-y-1 text-left transition-all active:scale-[0.98] cursor-pointer hover:border-teal-400/60',
              activeTab === 'checkouts' && statusFilter === 'mapped'
                ? 'ring-2 ring-teal-500 border-teal-500 bg-teal-500/10'
                : 'border-teal-500/20'
            )}
          >
            <div className="flex items-center justify-between text-teal-400 text-xs font-medium">
              <span>Checkout Mapeado</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-teal-300 tabular-numbers">
              {isLoadingSummary ? (
                <span className="text-teal-500/60 animate-pulse text-base font-normal">[...]</span>
              ) : (
                summary?.checkout_mapped ?? 0
              )}
            </p>
            <p className="text-[10px] text-teal-400/80">Filtrar checkouts validados</p>
          </button>

          {/* 6. Falhas / Atenção */}
          <button
            onClick={() => {
              setActiveTab('landing_pages');
              setStatusFilter('failed');
            }}
            className={cn(
              'p-4 rounded-2xl bg-slate-900/90 border space-y-1 text-left transition-all active:scale-[0.98] cursor-pointer hover:border-rose-400/60',
              statusFilter === 'failed'
                ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/10'
                : 'border-rose-500/20'
            )}
          >
            <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
              <span>Falhas / Atenção</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-rose-300 tabular-numbers">
              {isLoadingSummary ? (
                <span className="text-rose-500/60 animate-pulse text-base font-normal">[...]</span>
              ) : (
                summary?.failed_count ?? 0
              )}
            </p>
            <p className="text-[10px] text-rose-400/80">Ver falhas elegíveis a retry</p>
          </button>
        </div>

        {/* 2. ACTIVE RUNNING BATCH BANNER (LIVE CONCURRENCY & BATCH CONTROLS) */}
        {activeBatch && (activeBatch.status === 'RUNNING' || activeBatch.status === 'PAUSED') && (
          <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-r from-blue-600/50 via-cyan-500/50 to-blue-600/50 text-left shadow-2xl">
            <div className="p-5 sm:p-6 rounded-[15px] bg-slate-950/95 border border-slate-800 space-y-4">
              {/* Batch Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Workflow className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                        {activeBatch.type === 'LANDING_PAGE' ? 'Mapeamento de Landing Pages' : 'Mapeamento de Checkouts'}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase',
                          activeBatch.status === 'RUNNING'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        )}
                      >
                        {activeBatch.status === 'RUNNING' ? '⚡ Processando ao Vivo' : '⏸ Pausado'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                      {activeBatch.name}
                    </h3>
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center gap-2">
                  {activeBatch.status === 'RUNNING' ? (
                    <button
                      onClick={() => handleBatchAction(activeBatch.id, 'pause')}
                      disabled={isProcessingAction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pausar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBatchAction(activeBatch.id, 'resume')}
                      disabled={isProcessingAction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Retomar</span>
                    </button>
                  )}

                  {/* Cancel Pending Only (Safe - does not touch completed) */}
                  <button
                    onClick={() => handleBatchAction(activeBatch.id, 'cancel')}
                    disabled={isProcessingAction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                    title="Cancela apenas os jobs pendentes na fila; os concluídos são preservados"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancelar Pendentes</span>
                  </button>
                </div>
              </div>

              {/* Progress Info & Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-300 truncate">
                    <strong className="text-white font-bold">{activeBatch.processed_items}</strong> de{' '}
                    <strong className="text-white font-bold">{activeBatch.total_items}</strong> concluídas —{' '}
                    <span className="text-blue-400 font-semibold">{activeBatch.current_step}</span>
                  </span>
                  <span className="text-blue-400 font-bold tabular-numbers ml-2">
                    {Math.round((activeBatch.processed_items / Math.max(1, activeBatch.total_items)) * 100)}%
                  </span>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${Math.round((activeBatch.processed_items / Math.max(1, activeBatch.total_items)) * 100)}%`,
                    }}
                  />
                </div>

                {/* Sub-counter Chips & Concurrency Indicators */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400 pt-1">
                  <span className="flex items-center gap-1 text-blue-400">
                    <Zap className="w-3.5 h-3.5" />
                    {activeJobs.filter((j) => j.status === 'RUNNING').length} processando (max 2)
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {activeJobs.filter((j) => j.status === 'QUEUED').length} na fila
                  </span>
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
                </div>
              </div>
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
            onClick={() => {
              setActiveTab('landing_pages');
              setStatusFilter('pending');
            }}
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
            onClick={() => {
              setActiveTab('checkouts');
              setStatusFilter('pending');
            }}
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
            {/* Reconciled Funnel Diagram */}
            <div className="md:col-span-2 p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">Pipeline de Mapeamento Reconciliado</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                  ✓ {summary?.reconciled_percent ?? 100}% das {summary?.total_offers ?? 0} Ofertas Classificadas sem Limbo
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

            {/* Quick Action Card 1: Landing Pages */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Mapeamento em Lote de Landing Pages</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Varre as Landing Pages com fila operacional ao vivo, capturando hero copy, seções, preços e links de checkout sem bloquear a navegação.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">
                  <strong className="text-blue-400 font-bold text-sm">{summary?.lp_pending ?? 0}</strong> LPs pendentes
                </span>

                <button
                  onClick={() => {
                    setActiveTab('landing_pages');
                    setStatusFilter('pending');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-500/20 active:scale-95"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Acessar Painel de LPs</span>
                </button>
              </div>
            </div>

            {/* Quick Action Card 2: Checkouts */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Checkout Intelligence em Lote</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Analisa checkouts reais descobertos, extraindo provedor, order bumps e preços de checkout com verificação factual contra URLs duplicadas.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">
                  <strong className="text-cyan-400 font-bold text-sm">{summary?.checkout_pending ?? 0}</strong> Checkouts pendentes
                </span>

                <button
                  onClick={() => {
                    setActiveTab('checkouts');
                    setStatusFilter('pending');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-md shadow-cyan-500/20 active:scale-95"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Acessar Painel de Checkouts</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2 & TAB 3: LANDING PAGES & CHECKOUTS OPERATIONAL LIVE TABLE */}
        {(activeTab === 'landing_pages' || activeTab === 'checkouts') && (
          <div className="space-y-4 text-left">
            {/* Filter and Batch Action Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 px-4 rounded-2xl text-xs">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar oferta, anunciante ou URL..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-medium transition',
                      statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    Todas ({summary?.total_offers ?? 0})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-medium transition',
                      statusFilter === 'pending' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    Pendentes ({activeTab === 'landing_pages' ? summary?.lp_pending ?? 0 : summary?.checkout_pending ?? 0})
                  </button>
                  <button
                    onClick={() => setStatusFilter('mapped')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-medium transition',
                      statusFilter === 'mapped' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    Mapeadas ({activeTab === 'landing_pages' ? summary?.lp_mapped ?? 0 : summary?.checkout_mapped ?? 0})
                  </button>
                  <button
                    onClick={() => setStatusFilter('failed')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-medium transition',
                      statusFilter === 'failed' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    Falhas ({activeTab === 'landing_pages' ? summary?.lp_failed ?? 0 : summary?.checkout_failed ?? 0})
                  </button>
                </div>
              </div>

              {/* Action Trigger Button */}
              {activeTab === 'landing_pages' ? (
                <button
                  onClick={() => handleLaunchBatch('LANDING_PAGE', selectedLpIds.length > 0 ? selectedLpIds : undefined)}
                  disabled={Boolean(activeBatch?.status === 'RUNNING') || isProcessingAction}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-40 w-full md:w-auto justify-center"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {selectedLpIds.length > 0
                      ? `Mapear ${selectedLpIds.length} LPs Selecionadas`
                      : `MAPEAR TODAS AS LPs PENDENTES (${summary?.lp_pending ?? 0})`}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => handleLaunchBatch('CHECKOUT', selectedCheckoutIds.length > 0 ? selectedCheckoutIds : undefined)}
                  disabled={Boolean(activeBatch?.status === 'RUNNING') || isProcessingAction}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition active:scale-95 disabled:opacity-40 w-full md:w-auto justify-center"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {selectedCheckoutIds.length > 0
                      ? `Mapear ${selectedCheckoutIds.length} Checkouts Selecionados`
                      : `MAPEAR TODOS OS CHECKOUTS PENDENTES (${summary?.checkout_pending ?? 0})`}
                  </span>
                </button>
              )}
            </div>

            {/* Operational Table */}
            {isLoadingOffers ? (
              <div className="p-12 text-center text-slate-400 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                <span>Carregando fila operacional em tempo real...</span>
              </div>
            ) : (activeTab === 'landing_pages' ? lpOffers : checkoutOffers).length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-semibold text-white">Nenhuma oferta pendente para este filtro.</p>
                <p className="text-slate-500">Todas as ofertas dessa categoria já foram reconciliadas ou estão mapeadas.</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
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
                            className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 min-w-[200px]">Oferta</th>
                        <th className="p-3 min-w-[130px]">Anunciante</th>
                        <th className="p-3 min-w-[160px]">URL Alvo</th>
                        <th className="p-3 min-w-[120px]">Status</th>
                        <th className="p-3 min-w-[180px]">Etapa Operacional</th>
                        <th className="p-3 min-w-[140px]">Progresso</th>
                        <th className="p-3 pr-4 text-right min-w-[120px]">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {(activeTab === 'landing_pages' ? lpOffers : checkoutOffers).map((item, idx) => {
                        const isSelected = activeTab === 'landing_pages'
                          ? selectedLpIds.includes(item.offer.id)
                          : selectedCheckoutIds.includes(item.offer.id);
                        const isExpanded = expandedOfferIds.has(item.offer.id);
                        const isTargetFromUrl = urlOfferId === item.offer.id;

                        const status = item.mappingStatus;
                        const isRunning = status === 'RUNNING';
                        const isQueued = status === 'QUEUED';
                        const isSuccess = status === 'MAPPED' || status === 'SUCCESS';
                        const isPartial = status === 'PARTIAL';
                        const isFailed = status === 'FAILED';
                        const isStale = status === 'STALE';

                        return (
                          <React.Fragment key={item.offer.id}>
                            <tr
                              id={`offer-row-${item.offer.id}`}
                              className={cn(
                                'transition-colors hover:bg-slate-850/50',
                                isSelected && 'bg-blue-500/5',
                                isRunning && 'bg-blue-500/10 border-l-2 border-l-blue-400',
                                isTargetFromUrl && 'ring-2 ring-blue-500 bg-blue-500/15'
                              )}
                            >
                              {/* Checkbox */}
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
                                  className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                />
                              </td>

                              {/* Oferta */}
                              <td className="p-3 font-semibold text-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={`/offers/${item.offer.id}`}
                                    className="font-bold text-white hover:text-blue-400 transition truncate max-w-[200px]"
                                    title={item.offer.product_name}
                                  >
                                    {item.offer.product_name || 'Oferta Sem Nome'}
                                  </Link>
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {item.offer.niche || 'Geral'} {item.offer.price ? `• R$ ${item.offer.price.toFixed(2)}` : ''}
                                </div>
                              </td>

                              {/* Anunciante */}
                              <td className="p-3 text-slate-400 truncate max-w-[130px]" title={item.offer.advertiser || ''}>
                                {item.offer.advertiser || '—'}
                              </td>

                              {/* Target URL */}
                              <td className="p-3 text-slate-400 font-mono text-[11px]">
                                {item.targetUrl ? (
                                  <a
                                    href={item.targetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-400 truncate max-w-[160px] inline-flex items-center gap-1"
                                    title={item.targetUrl}
                                  >
                                    <span className="truncate">{item.targetUrl}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                                  </a>
                                ) : (
                                  <span className="text-slate-600">— Sem URL</span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
                                    isRunning && 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse',
                                    isQueued && 'bg-slate-800 text-slate-300 border-slate-700',
                                    isSuccess && 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
                                    isPartial && 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
                                    isFailed && 'bg-rose-500/10 text-rose-300 border-rose-500/30',
                                    isStale && 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                                    status === 'NOT_PROCESSED' && 'bg-slate-850 text-slate-400 border-slate-800'
                                  )}
                                >
                                  {isRunning && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                                  {isQueued && <Clock className="w-3 h-3 text-slate-400" />}
                                  {isSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                  {isPartial && <Sparkles className="w-3 h-3 text-cyan-400" />}
                                  {isFailed && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                                  {isStale && <AlertTriangle className="w-3 h-3 text-amber-400" />}

                                  <span>
                                    {isRunning
                                      ? 'Processando'
                                      : isQueued
                                      ? 'Na fila'
                                      : isSuccess
                                      ? 'Mapeada'
                                      : isPartial
                                      ? 'Parcial'
                                      : isFailed
                                      ? 'Falhou'
                                      : isStale
                                      ? 'Sem Resposta'
                                      : 'Pendente'}
                                  </span>
                                </span>
                              </td>

                              {/* Etapa Operacional Factual */}
                              <td className="p-3 text-xs">
                                <span className={cn(
                                  'truncate max-w-[200px] block font-medium',
                                  isRunning ? 'text-blue-300' : isFailed ? 'text-rose-400' : isSuccess ? 'text-emerald-400' : 'text-slate-400'
                                )} title={item.currentStep || ''}>
                                  {item.currentStep || 'Aguardando início...'}
                                </span>
                              </td>

                              {/* Progresso Real % com barra */}
                              <td className="p-3">
                                <div className="space-y-1 w-28">
                                  <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-slate-400">Progresso</span>
                                    <span className={cn('font-bold', isRunning ? 'text-blue-400' : isSuccess ? 'text-emerald-400' : 'text-slate-400')}>
                                      {item.progressPercent ?? 0}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                    <div
                                      className={cn(
                                        'h-full transition-all duration-300 rounded-full',
                                        isSuccess ? 'bg-emerald-500' : isRunning ? 'bg-blue-500 animate-pulse' : isFailed ? 'bg-rose-500' : 'bg-slate-700'
                                      )}
                                      style={{ width: `${item.progressPercent ?? 0}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Ações (Mapear / Retry / Expandir) */}
                              <td className="p-3 pr-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Mapear Individual */}
                                  {(status === 'NOT_PROCESSED' || status === 'PENDING') && (
                                    <button
                                      onClick={() => handleMapSingle(activeTab === 'landing_pages' ? 'LANDING_PAGE' : 'CHECKOUT', item.offer.id)}
                                      disabled={isRunning || isQueued}
                                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition shadow-sm active:scale-95"
                                    >
                                      Mapear
                                    </button>
                                  )}

                                  {/* Retry button for FAILED or STALE */}
                                  {(isFailed || isStale) && (
                                    <button
                                      onClick={() => handleMapSingle(activeTab === 'landing_pages' ? 'LANDING_PAGE' : 'CHECKOUT', item.offer.id)}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition active:scale-95 flex items-center gap-1"
                                      title="Tentar novamente o mapeamento desta oferta"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Tentar Novamente</span>
                                    </button>
                                  )}

                                  {/* Expand Details Chevron */}
                                  <button
                                    onClick={() => toggleRowExpansion(item.offer.id)}
                                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                    title="Ver detalhes da execução"
                                  >
                                    <ChevronDown
                                      className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180 text-blue-400')}
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Row Detail Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-950/80 border-b border-slate-800">
                                <td colSpan={8} className="p-4 pl-12 pr-6">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-500">Detalhes da Oferta</span>
                                      <p className="text-white font-medium">{item.offer.product_name}</p>
                                      <p className="text-slate-400 font-mono text-[11px]">ID: {item.offer.id}</p>
                                      {item.targetUrl && (
                                        <p className="text-blue-400 break-all text-[11px]">
                                          <a href={item.targetUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                            {item.targetUrl}
                                          </a>
                                        </p>
                                      )}
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-500">Execução do Job</span>
                                      <p className="text-slate-300">
                                        Status:{' '}
                                        <strong className={cn(isSuccess ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-blue-400')}>
                                          {item.mappingStatus}
                                        </strong>
                                      </p>
                                      <p className="text-slate-400">Etapa: {item.currentStep || '—'}</p>
                                      <p className="text-slate-400 font-mono text-[11px]">
                                        Job ID: {item.activeJob?.id || 'Sem job ativo'}
                                      </p>
                                      {item.lastHeartbeatAt && (
                                        <p className="text-slate-500 text-[10px]">
                                          Último heartbeat: {new Date(item.lastHeartbeatAt).toLocaleTimeString()}
                                        </p>
                                      )}
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-500">Diagnóstico & Ações</span>
                                      {item.activeJob?.error_message || item.offer.lp_last_error || item.offer.checkout_last_error ? (
                                        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                                          {item.activeJob?.error_message || item.offer.lp_last_error || item.offer.checkout_last_error}
                                        </div>
                                      ) : (
                                        <p className="text-emerald-400 text-xs">Nenhum erro registrado.</p>
                                      )}
                                      <div className="pt-2 flex items-center gap-2">
                                        <Link
                                          href={`/offers/${item.offer.id}`}
                                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-medium transition inline-flex items-center gap-1"
                                        >
                                          <span>Abrir Dossiê</span>
                                          <ArrowRight className="w-3 h-3" />
                                        </Link>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: OFERTA COMPLETA (4 Pipeline Pillars) */}
        {activeTab === 'full_offer' && (
          <div className="space-y-4 text-left">
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
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredFullOffers.map((offer) => {
                      const readModel = buildOfferReadModel(offer);
                      const stages = readModel.stages;

                      return (
                        <tr key={offer.id} className="hover:bg-slate-800/40 transition">
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

                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge
                              status={readModel.data_status}
                              breakdown={stages}
                              missingRequirements={readModel.missing_requirements}
                              size="sm"
                            />
                          </td>

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
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm text-left text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3 pl-4">Oferta</th>
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
                        <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                          Nenhuma oferta encontrada para este filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredScrapeOffers.map((o) => {
                        const readModel = buildOfferReadModel(o);
                        const status = o.data_scraping_status || 'NOT_PROCESSED';

                        return (
                          <tr key={o.id} className="hover:bg-slate-850/50 transition font-sans">
                            <td className="p-3 pl-4">
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
                              <button
                                onClick={() => setReconciliationOfferId(o.id)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
                              >
                                Ver Dados
                              </button>
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
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {batchesHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum lote de mapeamento registrado no histórico.
                    </td>
                  </tr>
                ) : (
                  batchesHistory.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-3 pl-4 font-bold text-white">{b.name}</td>
                      <td className="p-3 font-semibold text-blue-400">{b.type}</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
                            b.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : b.status === 'RUNNING'
                              ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                              : b.status === 'PAUSED'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          )}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-200 tabular-numbers">
                        {b.processed_items} / {b.total_items}
                      </td>
                      <td className="p-3 font-medium text-slate-300 tabular-numbers">
                        <span className="text-emerald-400">{b.success_count} ✓</span> /{' '}
                        <span className="text-rose-400">{b.failed_count} ✕</span>
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
          onScrapeAgain={async (_offerId: string) => {}}
        />
      </div>
    </AppShell>
  );
}
