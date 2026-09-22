'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ExternalLink,
  RotateCw,
  Ban,
  Clock,
  Sparkles,
  ChevronRight,
  Activity,
  Layers,
  FileSearch,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { OfferAnalysisJob } from '@/types';
import { notifyOfferUpdated, notifyGlobalSync } from '@/lib/events/offer-events';

interface AnalysisProgressDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeJob: OfferAnalysisJob | null;
  onJobUpdated: (job: OfferAnalysisJob) => void;
}

const STEP_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  RESOLVE_META: { label: 'Conectando à Meta Ads', icon: Sparkles },
  DISCOVER_LANDING_PAGE: { label: 'Descobrindo Landing Page', icon: FileSearch },
  MAP_LANDING_PAGE: { label: 'Mapeando Landing Page & Copy', icon: Layers },
  DISCOVER_CHECKOUT: { label: 'Localizando Checkout', icon: ShoppingCart },
  MAP_CHECKOUT: { label: 'Mapeando Checkout & Oferta', icon: ShoppingCart },
  ENRICH_OFFER: { label: 'Enriquecendo Métricas & Nicho', icon: Activity },
  FINALIZE: { label: 'Finalizando Dossiê', icon: CheckCircle2 },
  COMPLETED: { label: 'Análise Concluída', icon: CheckCircle2 },
};

export function AnalysisProgressDrawer({
  isOpen,
  onClose,
  activeJob,
  onJobUpdated,
}: AnalysisProgressDrawerProps) {
  const router = useRouter();
  const [isProcessingStep, setIsProcessingStep] = useState(false);
  const [secondsSinceHeartbeat, setSecondsSinceHeartbeat] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const runnerRef = useRef<boolean>(false);

  // Time since last heartbeat ticker
  useEffect(() => {
    if (!activeJob) return;

    const updateTimer = () => {
      const hb = activeJob.last_heartbeat_at || activeJob.updated_at || activeJob.created_at;
      if (!hb) {
        setSecondsSinceHeartbeat(0);
        return;
      }
      const diff = Math.max(0, Math.floor((Date.now() - new Date(hb).getTime()) / 1000));
      setSecondsSinceHeartbeat(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeJob]);

  // Client-side atomic step runner loop
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'running') {
      runnerRef.current = false;
      return;
    }

    let isMounted = true;
    runnerRef.current = true;

    const runNextStep = async () => {
      if (!runnerRef.current || isProcessingStep) return;
      setIsProcessingStep(true);
      setActionError(null);

      try {
        const res = await fetch(`/api/offers/analyze/jobs/${activeJob.id}/step`, {
          method: 'POST',
        });
        const data = await res.json();

        if (res.ok && data.success && isMounted) {
          if (data.job) {
            onJobUpdated(data.job);
          }

          if (data.isCompleted) {
            runnerRef.current = false;
            notifyGlobalSync('manual_offer_created');
            if (data.offerId) {
              notifyOfferUpdated(data.offerId, 'completed');
            }
          } else if (data.job?.status === 'running') {
            // Schedule next atomic step after short delay (500ms)
            setTimeout(() => {
              if (runnerRef.current && isMounted) {
                runNextStep();
              }
            }, 600);
          }
        } else if (data.error && isMounted) {
          setActionError(data.error);
          runnerRef.current = false;
        }
      } catch (err: any) {
        console.error('Step runner fetch error:', err);
        if (isMounted) {
          setActionError(err.message || 'Erro na execução da etapa.');
          runnerRef.current = false;
        }
      } finally {
        if (isMounted) {
          setIsProcessingStep(false);
        }
      }
    };

    // Kick off runner if not already executing
    const initialTimer = setTimeout(() => {
      runNextStep();
    }, 400);

    return () => {
      isMounted = false;
      runnerRef.current = false;
      clearTimeout(initialTimer);
    };
  }, [activeJob?.id, activeJob?.status, activeJob?.current_step]);

  if (!isOpen) return null;

  const handleCancel = async () => {
    if (!activeJob) return;
    runnerRef.current = false;
    setActionError(null);
    try {
      const res = await fetch(`/api/offers/analyze/jobs/${activeJob.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (data.success && data.job) {
        onJobUpdated(data.job);
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao cancelar análise.');
    }
  };

  const handleRetry = async () => {
    if (!activeJob) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/offers/analyze/jobs/${activeJob.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });
      const data = await res.json();
      if (data.success && data.job) {
        onJobUpdated(data.job);
      } else if (data.error) {
        setActionError(data.error);
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao reiniciar análise.');
    }
  };

  const handleOpenOffer = () => {
    const targetId = activeJob?.offer_id || activeJob?.progress_data?.offer_id;
    if (targetId) {
      onClose();
      router.push(`/offers/${targetId}`);
    }
  };

  const currentStepKey = activeJob?.current_step || 'RESOLVE_META';
  const stepConfig = STEP_LABELS[currentStepKey] || { label: currentStepKey, icon: Activity };
  const StepIcon = stepConfig.icon;
  const progressPercent = Math.min(100, Math.max(0, activeJob?.progress_percent ?? 10));

  const isCompleted = activeJob?.status === 'completed';
  const isFailed = activeJob?.status === 'failed';
  const isStale = activeJob?.status === 'stale';
  const isRunning = activeJob?.status === 'running';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-md h-full bg-[#0E131F] border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#0B0F19]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                Painel de Análise
                {isRunning && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
                    EM ANDAMENTO
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    CONCLUÍDA
                  </span>
                )}
                {(isFailed || isStale) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    {isStale ? 'EXPIRADA' : 'FALHA'}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                Pipeline serverless com checkpoints atômicos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {!activeJob ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Nenhuma análise ativa encontrada no momento.
            </div>
          ) : (
            <>
              {/* Offer Card Info */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                      Oferta em Processamento
                    </span>
                    <h3 className="text-sm font-bold text-slate-100 mt-0.5 line-clamp-1">
                      {activeJob.progress_data?.product_name || 'Oferta Meta Ads'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeJob.progress_data?.advertiser || 'Identificando anunciante...'}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenOffer}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Abrir página da oferta"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress Bar (Real derived progress, no fake timer) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Progresso Real</span>
                    <span className="font-mono font-bold text-blue-400">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Current Stage Indicator */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <StepIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="font-medium text-[11px] truncate max-w-[200px]">
                      {stepConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>há {secondsSinceHeartbeat}s</span>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-400 block mb-1 text-[10px] uppercase tracking-wider">
                  Status Atual
                </span>
                {activeJob.stage_message || 'Aguardando próxima etapa...'}
              </div>

              {/* Action Error Banner */}
              {actionError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Pipeline Steps List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Etapas da Pipeline
                </h4>
                <div className="space-y-1.5">
                  {Object.entries(STEP_LABELS)
                    .filter(([key]) => key !== 'COMPLETED')
                    .map(([key, config], idx) => {
                      const StepItIcon = config.icon;
                      const isCurrent = activeJob.current_step === key;
                      const isPast =
                        (activeJob.progress_percent ?? 0) >
                        (idx + 1) * (100 / Object.keys(STEP_LABELS).length);

                      return (
                        <div
                          key={key}
                          className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition ${
                            isCurrent
                              ? 'bg-blue-500/10 border-blue-500/40 text-white'
                              : isPast
                              ? 'bg-slate-900/40 border-slate-800 text-slate-400'
                              : 'bg-slate-950/20 border-slate-800/40 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <StepItIcon
                              className={`w-3.5 h-3.5 ${
                                isCurrent ? 'text-blue-400 animate-spin' : isPast ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            />
                            <span className="text-[11px] font-medium">{config.label}</span>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-blue-400 uppercase">
                              Executando
                            </span>
                          )}
                          {isPast && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {activeJob && (
          <div className="p-4 border-t border-slate-800/80 bg-[#0B0F19] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isRunning && (
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
                >
                  <Ban className="w-3.5 h-3.5 text-red-400" />
                  <span>Cancelar</span>
                </button>
              )}

              {(isFailed || isStale) && (
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Tentar Novamente</span>
                </button>
              )}
            </div>

            <button
              onClick={handleOpenOffer}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition"
            >
              <span>Ver Oferta</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
