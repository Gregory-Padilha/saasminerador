'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { OfferAnalysisJob, OfferAnalysisStage } from '@/types';
import { validateMetaAdsLibraryUrl } from '@/lib/meta-ads/url-utils';
import { notifyOfferUpdated, notifyGlobalSync } from '@/lib/events/offer-events';
import { dbService } from '@/lib/supabase/db';
import { formatCurrency } from '@/lib/utils';

interface AnalyzeOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialJobId?: string | null;
}

const STAGE_LABELS: Record<OfferAnalysisStage, string> = {
  validating_url: 'Validando URL da Meta Ads Library',
  opening_meta: 'Conectando à Meta Ads Library',
  discovering_ads: 'Buscando anúncios ativos na biblioteca',
  identifying_offer: 'Identificando produto e anunciante',
  saving_ads: 'Catalogando anúncios no banco de dados',
  capturing_creatives: 'Baixando mídias (vídeos e imagens)',
  resolving_landing_page: 'Descobrindo Landing Page da oferta',
  capturing_landing_page: 'Capturando visualmente a Landing Page',
  mapping_landing_page: 'Extraindo copy, entregáveis e bônus',
  syncing_offer_data: 'Sincronizando dossiê da oferta',
  resolving_checkout: 'Localizando página de checkout',
  mapping_checkout: 'Testando CTA e extraindo Order Bumps',
  building_funnel: 'Estruturando esteira comercial do funil',
  finalizing: 'Finalizando montagem do dossiê',
};

const ORDERED_STAGES: OfferAnalysisStage[] = [
  'validating_url',
  'opening_meta',
  'discovering_ads',
  'identifying_offer',
  'saving_ads',
  'capturing_creatives',
  'resolving_landing_page',
  'capturing_landing_page',
  'mapping_landing_page',
  'syncing_offer_data',
  'resolving_checkout',
  'mapping_checkout',
  'building_funnel',
  'finalizing',
];

export function AnalyzeOfferModal({ isOpen, onClose, initialJobId }: AnalyzeOfferModalProps) {
  const router = useRouter();

  const [inputUrl, setInputUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId || null);
  const [job, setJob] = useState<OfferAnalysisJob | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [duplicateOffer, setDuplicateOffer] = useState<{ id: string; name: string } | null>(null);
  const [prevInitialJobId, setPrevInitialJobId] = useState<string | null | undefined>(initialJobId);

  if (initialJobId !== prevInitialJobId) {
    setPrevInitialJobId(initialJobId);
    setActiveJobId(initialJobId || null);
  }

  const handleCloseModal = () => {
    setDuplicateOffer(null);
    setValidationError(null);
    setIsSubmitting(false);
    onClose();
  };

  // Polling active job
  useEffect(() => {
    if (!activeJobId || !isOpen) return;

    let isMounted = true;

    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/offers/analyze/jobs/${activeJobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.job && isMounted) {
            setJob(data.job);
            if (data.job.status === 'completed' || data.job.status === 'completed_with_warnings') {
              const targetOfferId = data.job.offer_id || data.job.progress_data?.offer_id;
              if (targetOfferId) {
                notifyOfferUpdated(targetOfferId, 'analyze_job_completed');
              }
              notifyGlobalSync('analyze_job_completed');
            }
          }
        }
      } catch (err) {
        console.error('Job polling error:', err);
      }
    };

    fetchJob();
    const interval = setInterval(fetchJob, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeJobId, isOpen]);

  // EARLY RETURN ONLY AFTER ALL HOOKS
  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputUrl(val);
    setValidationError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent, forceMode?: 'new' | 'update') => {
    e.preventDefault();
    setValidationError(null);
    setDuplicateOffer(null);

    // Strict URL Validation before submitting
    const validation = validateMetaAdsLibraryUrl(inputUrl);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Este link não parece ser uma URL válida da Meta Ads Library.');
      return;
    }

    setIsSubmitting(true);

    try {
      const targetMode = forceMode || 'new';
      const targetOfferId = forceMode === 'update' ? duplicateOffer?.id : undefined;

      const res = await fetch('/api/offers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl.trim(), mode: targetMode, offerId: targetOfferId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.isDuplicate && data.existingOffer) {
          setDuplicateOffer({
            id: data.existingOffer.id || data.existingOfferId,
            name: data.existingOffer.product_name,
          });
        } else if (data.isAlreadyRunning && data.jobId) {
          setActiveJobId(data.jobId);
          setJob(data.job);
        } else {
          setValidationError(data.error || 'Falha ao iniciar análise da oferta.');
        }
        return;
      }

      // Save created offer to client storage immediately and notify UI
      if (data.offer) {
        await dbService.saveOffer(data.offer);
      }
      notifyGlobalSync('manual_offer_created');
      if (data.offer?.id) {
        notifyOfferUpdated(data.offer.id, 'created');
      }

      setActiveJobId(data.jobId);
      setJob(data.job);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro de conexão ao iniciar análise.';
      setValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeUpdate = async () => {
    if (!activeJobId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/offers/analyze/jobs/${activeJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume', offerId: job?.progress_data?.existing_offer_id }),
      });
      const data = await res.json();
      if (data.success && data.job) {
        setJob(data.job);
      }
    } catch (err) {
      console.error('Resume error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJobId) return;
    try {
      await fetch(`/api/offers/analyze/jobs/${activeJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      onClose();
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  const handleOpenOfferDossier = (offerId?: string | null) => {
    const targetId = offerId || job?.offer_id || job?.progress_data?.existing_offer_id;
    if (targetId) {
      onClose();
      router.push(`/offers/${targetId}`);
    }
  };

  const currentStageIndex = job
    ? ORDERED_STAGES.indexOf(job.current_stage)
    : -1;

  const isCompleted =
    job?.status === 'completed' || job?.status === 'completed_with_warnings';
  const isFailed = job?.status === 'failed';
  const isDuplicateDetected = job?.progress_data?.duplicate_detected === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl my-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {activeJobId ? 'Analisando Oferta (Meta Ads Library)' : 'Analisar Nova Oferta'}
              </h3>
              <p className="text-xs text-slate-400">
                {activeJobId
                  ? 'O Offer Miner está catalogando anúncios, criativos, LP e checkout.'
                  : 'Cole um link da Meta Ads Library para catalogar a oferta automaticamente.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* INPUT MODE FORM */}
        {!activeJobId && (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                URL da Meta Ads Library *
              </label>
              <input
                type="url"
                required
                value={inputUrl}
                onChange={handleInputChange}
                placeholder="https://www.facebook.com/ads/library/?id=..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-white placeholder-slate-500 text-xs sm:text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
              />

              {validationError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {duplicateOffer && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-300 block text-sm font-bold">OFERTA JÁ EXISTE NO BANCO DE DADOS</strong>
                      <span>A oferta <strong>&quot;{duplicateOffer.name}&quot;</strong> já está cadastrada no Offer Miner.</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
                    <button
                      type="button"
                      onClick={() => handleOpenOfferDossier(duplicateOffer.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition flex items-center gap-1.5"
                    >
                      <span>Abrir Dossiê Existente</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleFormSubmit(e, 'update')}
                      disabled={isSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reanalisar e Atualizar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850 text-xs space-y-2 text-slate-400">
              <span className="font-semibold text-slate-300 block">💡 O que acontecerá a seguir:</span>
              <ul className="space-y-1 list-disc list-inside text-[11px] text-slate-400">
                <li>O Offer Miner varrerá todos os anúncios da biblioteca apontada.</li>
                <li>Baixará vídeos, imagens e capturará os criativos originais.</li>
                <li>Descobrirá e mapeará a Landing Page e seus entregáveis/bônus.</li>
                <li>Localizará o botão de checkout e analisará Order Bumps pré-compra.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !inputUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 transition flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Iniciando Análise...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>ANALISAR OFERTA</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* PROCESSING & COMPLETED JOB MODE */}
        {activeJobId && job && (
          <div className="space-y-5 text-xs">
            {/* Live Discovered Offer Info Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Oferta Identificada
                  </span>
                  <h4 className="text-sm font-extrabold text-white truncate">
                    {job.progress_data?.product_name || 'Analisando anúncios...'}
                  </h4>
                  {job.progress_data?.advertiser && (
                    <span className="text-[11px] text-slate-400 block">
                      Anunciante: <strong>{job.progress_data.advertiser}</strong>
                    </span>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-blue-400 block">
                    {job.progress_data?.ads_count ?? 0} Anúncios
                  </span>
                  {job.progress_data?.unique_creatives_count !== undefined && (
                    <span className="text-[11px] font-mono text-purple-400 block">
                      {job.progress_data.unique_creatives_count} Criativos
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Summary Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase">Anúncios</span>
                  <strong className="text-slate-200">{job.progress_data?.ads_count ?? 0}</strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase">Vídeos / Imagens</span>
                  <strong className="text-purple-400">
                    {(job.progress_data?.videos_count || 0) + (job.progress_data?.images_count || 0)}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase">Landing Page</span>
                  <strong className="text-blue-400 truncate block">
                    {job.progress_data?.landing_page_status || 'Descobrindo...'}
                  </strong>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase">Checkout / Bumps</span>
                  <strong className="text-emerald-400 truncate block">
                    {job.progress_data?.checkout_provider || 'Aguardando...'}
                  </strong>
                </div>
              </div>
            </div>

            {/* DUPLICATE OFFER WARNING BANNER */}
            {isDuplicateDetected && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-amber-300 text-sm">
                      OFERTA JÁ EXISTE NO BANCO DE DADOS
                    </h4>
                    <p className="text-slate-300 text-xs mt-0.5">
                      Identificamos que a oferta <strong>&quot;{job.progress_data?.existing_offer_name}&quot;</strong> já está cadastrada.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
                  <button
                    onClick={() => handleOpenOfferDossier(job.progress_data?.existing_offer_id)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition flex items-center gap-1.5"
                  >
                    <span>Abrir Dossiê Existente</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleResumeUpdate}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Atualizar Oferta Existente</span>
                  </button>
                </div>
              </div>
            )}

            {/* STAGE CHECKLIST */}
            {!isCompleted && !isFailed && !isDuplicateDetected && (
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Etapas do Pipeline de Análise
                </span>

                <div className="space-y-1.5">
                  {ORDERED_STAGES.map((stageKey, idx) => {
                    const isPassed = currentStageIndex > idx;
                    const isCurrent = currentStageIndex === idx;

                    return (
                      <div
                        key={stageKey}
                        className={`flex items-center gap-2.5 p-2 rounded-lg transition ${
                          isCurrent
                            ? 'bg-blue-500/10 text-white border border-blue-500/30'
                            : isPassed
                            ? 'text-slate-400 opacity-80'
                            : 'text-slate-600 opacity-50'
                        }`}
                      >
                        {isPassed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                        )}

                        <span className="font-semibold text-xs min-w-0 truncate">
                          {STAGE_LABELS[stageKey]}
                        </span>

                        {isCurrent && (
                          <span className="ml-auto text-[10px] text-blue-400 font-mono font-bold animate-pulse">
                            Em processamento...
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COMPLETED RESULT SUMMARY SCREEN */}
            {isCompleted && (
              <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">ANÁLISE CONCLUÍDA COM SUCESSO!</h4>
                    <p className="text-xs text-emerald-200">
                      O dossiê completo foi montado e sincronizado no Offer Miner.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Anúncios</span>
                    <strong className="text-white text-sm">{job.progress_data?.ads_count ?? 0}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Preço Front</span>
                    <strong className="text-emerald-400 text-sm">
                      {job.progress_data?.front_price ? formatCurrency(job.progress_data.front_price) : 'N/D'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Entregáveis</span>
                    <strong className="text-blue-400 text-sm">{job.progress_data?.deliverables_count ?? 0}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Order Bumps</span>
                    <strong className="text-purple-400 text-sm">{job.progress_data?.order_bumps_count ?? 0}</strong>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handleOpenOfferDossier(job.offer_id)}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
                  >
                    <span>ABRIR DOSSIÊ DA OFERTA</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* FAILED SCREEN */}
            {isFailed && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-rose-300 font-bold">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>Falha ao executar análise da oferta</span>
                </div>
                <p className="text-slate-300">{job.error_message}</p>
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-750 font-semibold"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* DIAGNOSTIC LOGS ACCORDION */}
            <div className="border-t border-slate-800 pt-3">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Diagnóstico do Job (Logs de Execução)</span>
                </span>
                {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showLogs && (
                <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-300">
                  {job.progress_data?.logs?.map((log, idx) => (
                    <div key={idx} className="truncate">
                      <span className="text-slate-500 mr-2">[{log.timestamp.split('T')[1]?.slice(0, 8)}]</span>
                      <span className="text-blue-400 font-bold mr-1.5">[{log.stage}]</span>
                      <span>{log.message}</span>
                    </div>
                  )) || <span className="text-slate-500">Nenhum log registrado ainda.</span>}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            {!isCompleted && !isFailed && !isDuplicateDetected && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                <span className="text-slate-500 font-mono">
                  {job.stage_message || 'Processando pipeline...'}
                </span>
                <button
                  onClick={handleCancelJob}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold transition"
                >
                  Cancelar Análise
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
