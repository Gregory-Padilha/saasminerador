'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Layers,
  Database,
  Info,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Offer, OfferReconciliationReport, OfferFieldConflict, FieldProvenance } from '@/types';
import { useToast } from '@/components/ui/Toast';

interface ReconciliationDrawerProps {
  offerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onScrapeAgain?: (offerId: string) => Promise<void>;
}

export function ReconciliationDrawer({
  offerId,
  isOpen,
  onClose,
  onScrapeAgain,
}: ReconciliationDrawerProps) {
  const toast = useToast();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [report, setReport] = useState<OfferReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReScraping, setIsReScraping] = useState(false);

  useEffect(() => {
    if (!isOpen || !offerId) return;

    setIsLoading(true);
    fetch(`/api/scraping/preview/${offerId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setOffer(data.offer);
          setReport(data.report);
        } else {
          toast.error(data.error || 'Falha ao carregar dados de reconciliação.');
        }
      })
      .catch((err) => {
        console.error('Failed to load reconciliation preview:', err);
        toast.error('Erro ao conectar com servidor.');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, offerId, toast]);

  if (!isOpen) return null;

  const handleReScrape = async () => {
    if (!offerId) return;
    setIsReScraping(true);
    try {
      if (onScrapeAgain) {
        await onScrapeAgain(offerId);
      } else {
        const res = await fetch('/api/scraping/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Raspagem e enriquecimento concluídos!');
          setOffer(data.offer);
          setReport(data.report);
        } else {
          toast.error(data.error || 'Falha ao re-raspar.');
        }
      }
    } catch {
      toast.error('Erro ao executar raspagem.');
    } finally {
      setIsReScraping(false);
    }
  };

  const conflicts: OfferFieldConflict[] = report?.conflicts || [];
  const provenanceMap: Record<string, FieldProvenance> =
    (offer?.provenance_map as any) || report?.provenanceMap || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#111318] border-l border-white/10 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-start justify-between bg-white/[0.02]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Reconciliação & Enriquecimento
              </h2>
            </div>
            <p className="text-xs text-white/50">
              {offer?.product_name || 'Carregando detalhes...'}
              {offer?.advertiser && <span className="text-white/30"> • {offer.advertiser}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-white/40 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <p className="text-sm">Carregando relatório factual da oferta...</p>
            </div>
          ) : !offer ? (
            <div className="py-20 text-center text-white/40 text-sm">
              Nenhum dado encontrado para esta oferta.
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div className="p-4 rounded-xl border bg-white/[0.02] border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-mono tracking-wider text-white/40 block mb-1">
                    Status da Raspagem
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider',
                        offer.data_scraping_status === 'SUCCESS'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : offer.data_scraping_status === 'PARTIAL'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : offer.data_scraping_status === 'FAILED'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-white/10 text-white/60 border border-white/15'
                      )}
                    >
                      {offer.data_scraping_status || 'NÃO PROCESSADO'}
                    </span>
                    {report?.durationMs && (
                      <span className="text-xs text-white/40 font-mono">
                        ({report.durationMs}ms)
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleReScrape}
                  disabled={isReScraping}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', isReScraping && 'animate-spin')} />
                  {isReScraping ? 'Raspando...' : 'Re-raspar'}
                </button>
              </div>

              {/* Conflict Alerts */}
              {conflicts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Conflitos de Fontes Detectados ({conflicts.length})
                  </div>
                  {conflicts.map((conf, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between font-medium text-amber-300">
                        <span>Campo: <strong className="font-mono uppercase">{conf.field}</strong></span>
                        <span className="text-[10px] text-amber-400/70 font-mono">
                          {new Date(conf.detectedAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-white/80">{conf.description}</p>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-500/20 text-[11px]">
                        <div>
                          <span className="text-white/40 block">Valor Primário ({conf.primarySource}):</span>
                          <span className="text-emerald-400 font-mono font-bold">
                            {typeof conf.primaryValue === 'number'
                              ? formatCurrency(conf.primaryValue)
                              : String(conf.primaryValue)}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/40 block">Divergente ({conf.conflictingSource}):</span>
                          <span className="text-amber-400 font-mono font-semibold">
                            {typeof conf.conflictingValue === 'number'
                              ? formatCurrency(conf.conflictingValue)
                              : String(conf.conflictingValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Factual Metrics Comparison Grid */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-mono tracking-wider text-white/50 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  Dados Factuais Enriquecidos
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[11px] text-white/40 block">Preço de Venda</span>
                    <span className="text-base font-bold text-white font-mono">
                      {offer.price ? formatCurrency(offer.price) : '—'}
                    </span>
                    <span className="text-[10px] text-white/40 block font-mono">
                      Fonte: {provenanceMap['price']?.source || 'DESCONHECIDA'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[11px] text-white/40 block">Anúncios Ativos (Cluster)</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {typeof offer.active_ads_count === 'number' ? offer.active_ads_count : '—'}
                    </span>
                    <span className="text-[10px] text-white/40 block font-mono">
                      {typeof offer.active_ads_count === 'number'
                        ? 'Cluster Confirmado'
                        : 'Não Confirmado'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[11px] text-white/40 block">Criativos Únicos</span>
                    <span className="text-base font-bold text-white font-mono">
                      {typeof offer.unique_creatives_count === 'number'
                        ? offer.unique_creatives_count
                        : '—'}
                    </span>
                    <span className="text-[10px] text-white/40 block">
                      {offer.captured_videos_count || 0} vídeos • {offer.captured_images_count || 0} imagens
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[11px] text-white/40 block">Dias Rodando</span>
                    <span className="text-base font-bold text-white font-mono">
                      {offer.days_running ? `${offer.days_running}d` : '—'}
                    </span>
                    <span className="text-[10px] text-white/40 block font-mono">
                      Desde: {offer.oldest_ad_date || offer.first_seen_at || '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[11px] text-white/40 block">Nicho & Subnicho</span>
                    <span className="text-sm font-semibold text-white truncate block">
                      {offer.niche || '—'}
                    </span>
                    <span className="text-[10px] text-white/40 block truncate">
                      {offer.subniche ? `Sub: ${offer.subniche}` : 'Sem subnicho'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[11px] text-white/40 block">Checkout & Plataforma</span>
                    <span className="text-sm font-semibold text-white truncate block">
                      {offer.checkout_platform || 'Não detectado'}
                    </span>
                    <span className="text-[10px] text-white/40 block font-mono">
                      {offer.order_bumps && offer.order_bumps.length > 0
                        ? `${offer.order_bumps.length} order bumps`
                        : 'Bumps não encontrados'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Copy / Message Elements */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-mono tracking-wider text-white/50 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  Copy & Ângulos Extraídos
                </h3>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 text-xs">
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase font-mono mb-1">
                      Headline Principal
                    </span>
                    <p className="text-white font-medium">
                      {offer.headline || '—'}
                    </p>
                  </div>
                  {offer.promise && (
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-white/40 block text-[10px] uppercase font-mono mb-1">
                        Promessa
                      </span>
                      <p className="text-white/80">{offer.promise}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Provenance Map Table */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-mono tracking-wider text-white/50 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  Rastreabilidade & Proveniência ({Object.keys(provenanceMap).length} campos)
                </h3>

                <div className="rounded-xl border border-white/10 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-[10px] font-mono uppercase text-white/50 border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-3">Campo</th>
                        <th className="py-2.5 px-3">Fonte</th>
                        <th className="py-2.5 px-3">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/70 font-mono">
                      {Object.keys(provenanceMap).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-white/30">
                            Nenhuma proveniência registrada ainda.
                          </td>
                        </tr>
                      ) : (
                        Object.entries(provenanceMap).map(([field, prov]) => (
                          <tr key={field} className="hover:bg-white/[0.02]">
                            <td className="py-2 px-3 text-white font-medium">{field}</td>
                            <td className="py-2 px-3 text-white/60">{prov.source}</td>
                            <td className="py-2 px-3">
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 rounded text-[10px]',
                                  prov.type === 'OBSERVED'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : prov.type === 'INFERRED'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : prov.type === 'DERIVED'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-white/5 text-white/40'
                                )}
                              >
                                {prov.type}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
