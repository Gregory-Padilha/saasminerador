'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { dbService } from '@/lib/supabase/db';
import { Offer, isLandingPageMapped } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { StatusBadge, FacelessBadge } from '@/components/ui/StatusBadge';
import { DossierCompletenessBadge } from '@/components/ui/DossierCompletenessBadge';
import { TrendBadge } from '@/components/ui/TrendBadge';
import { OfferEditModal } from '@/components/offers/OfferEditModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  TabOverview,
} from '@/components/offers/workspace/TabOverview';
import {
  TabAdvertiser,
} from '@/components/offers/workspace/TabAdvertiser';
import {
  TabCreatives,
} from '@/components/offers/workspace/TabCreatives';
import {
  TabLandingPage,
} from '@/components/offers/workspace/TabLandingPage';
import {
  TabOffer,
} from '@/components/offers/workspace/TabOffer';
import {
  TabFunnel,
} from '@/components/offers/workspace/TabFunnel';
import {
  TabHistory,
} from '@/components/offers/workspace/TabHistory';
import {
  TabCopy,
} from '@/components/offers/workspace/TabCopy';
import {
  TabAudience,
} from '@/components/offers/workspace/TabAudience';
import {
  TabNotes,
} from '@/components/offers/workspace/TabNotes';
import {
  TabRawData,
} from '@/components/offers/workspace/TabRawData';
import { ExportOfferModal } from '@/components/offers/ExportOfferModal';
import {
  ArrowLeft,
  Star,
  Flame,
  ExternalLink,
  Eye,
  Edit2,
  Trash2,
  Layers,
  Sparkles,
  Globe,
  Share2,
  Clock,
  Brain,
  FileText,
  DollarSign,
  Users,
  Quote,
  Target,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  AlertTriangle,
  ShoppingCart,
  Download,
} from 'lucide-react';

type TabKey =
  | 'overview'
  | 'advertiser'
  | 'creatives'
  | 'landing_page'
  | 'offer_stack'
  | 'funnel'
  | 'history'
  | 'copy'
  | 'audience'
  | 'notes'
  | 'raw_data';

import { offerEvents, notifyOfferUpdated } from '@/lib/events/offer-events';

export default function OfferAnalysisWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const loadOffer = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch(`/api/offers/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.offer) {
          setOffer(json.offer);
          return;
        }
      }

      const data = await dbService.getOfferById(id);
      if (data) setOffer(data);
    } catch (err) {
      console.error(err);
      try {
        const data = await dbService.getOfferById(id);
        if (data) setOffer(data);
      } catch {}
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOffer(true);

    // Subscribe to live event bus & silent sync provider
    const unsubscribe = offerEvents.subscribe((payload) => {
      if (payload.offerId === id || payload.type === 'global_sync') {
        console.log(`[LIVE SYNC] Offer Workspace payload received (${payload.type}), silently updating data...`);
        loadOffer(false);
      }
    });

    return () => unsubscribe();
  }, [id]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!offer) {
    return (
      <AppShell>
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 my-8">
          <h2 className="text-lg font-bold text-white">Oferta não encontrada</h2>
          <p className="text-xs text-slate-400 mt-1">
            Esta oferta pode ter sido excluída ou o identificador está incorreto.
          </p>
          <Link
            href="/offers"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Ofertas
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleToggleFavorite = async () => {
    const nextVal = await dbService.toggleFavorite(offer.id, offer.favorite);
    setOffer({ ...offer, favorite: nextVal });
  };

  const handleToggleWatchlist = async () => {
    const nextVal = await dbService.toggleWatchlist(offer.id, offer.watching);
    setOffer({ ...offer, watching: nextVal });
  };

  const handleToggleDeepDive = async () => {
    const nextVal = await dbService.toggleDeepDive(offer.id, offer.in_deep_dive);
    setOffer({ ...offer, in_deep_dive: nextVal });
  };

  const handleSaveEdit = async (updatedData: Partial<Offer>) => {
    const result = await dbService.updateOffer(offer.id, updatedData);
    if (result) {
      setOffer(result);
    }
  };

  const handleDelete = async () => {
    await dbService.deleteOffer(offer.id);
    router.push('/offers');
  };

  const tabs: { id: TabKey; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { id: 'overview', label: 'Visão Geral', icon: Layers },
    { id: 'advertiser', label: 'Anunciante', icon: Users },
    {
      id: 'creatives',
      label: 'Criativos',
      icon: Sparkles,
      badge: offer.captured_creatives_count || offer.creatives?.length || undefined,
    },
    { id: 'landing_page', label: 'Landing Page', icon: Globe },
    {
      id: 'offer_stack',
      label: 'Oferta',
      icon: DollarSign,
      badge: (offer.deliverables?.length || 0) + (offer.bonuses?.length || 0) || undefined,
    },
    { id: 'funnel', label: 'Funil', icon: Share2 },
    {
      id: 'history',
      label: 'Histórico',
      icon: Clock,
      badge: offer.snapshots?.length || undefined,
    },
    { id: 'copy', label: 'Copy', icon: Quote },
    { id: 'audience', label: 'Público', icon: Target },
    { id: 'notes', label: 'Notas', icon: FileText },
    { id: 'raw_data', label: 'Dados Originais', icon: FileSpreadsheet },
  ];

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Back Link & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/offers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para Ofertas
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">ID: {offer.id}</span>
            {offer.is_demo_data && (
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold">
                Dado Demonstrativo
              </span>
            )}
          </div>
        </div>

        {/* 1. DOSSIÊ HEADER (FACTUAL & EXPLICABLE) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Title & Metadata */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusBadge status={offer.status} />
                <TrendBadge trend={offer.trend} />
                <FacelessBadge faceless={offer.faceless} />
                <DossierCompletenessBadge offer={offer} />
                {offer.niche && (
                  <Link
                    href={`/offers?niche=${encodeURIComponent(offer.niche)}`}
                    className="text-xs font-semibold text-blue-400 hover:underline"
                  >
                    {offer.niche} {offer.subniche ? `› ${offer.subniche}` : ''}
                  </Link>
                )}
              </div>

              <h1 className="text-2xl font-black text-white tracking-tight">
                {offer.product_name}
              </h1>

              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                {offer.advertiser && (
                  <span>
                    Anunciante:{' '}
                    <strong className="text-slate-200">{offer.advertiser}</strong>
                  </span>
                )}
                <span>•</span>
                <span>
                  Tipo: <strong className="text-slate-200">{offer.product_type || 'Digital'}</strong>
                </span>
                {offer.source_file_name && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      Fonte: {offer.source_file_name}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {offer.meta_ads_url && (
                <a
                  href={offer.meta_ads_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  Meta Ads
                </a>
              )}

              {offer.landing_page_url && (
                <a
                  href={offer.landing_page_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  Landing Page
                </a>
              )}

              {offer.checkout_url && (
                <a
                  href={offer.checkout_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Checkout
                </a>
              )}

              <Link
                href={`/office?modelOfferId=${offer.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition shadow-sm"
              >
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                Modelar no Escritório ↗
              </Link>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition shadow-sm"
                title="Baixar os dados desta oferta como contexto estruturado."
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                Exportar Oferta
              </button>

              <button
                onClick={handleToggleFavorite}
                className={`p-2 rounded-xl border transition-all ${
                  offer.favorite
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title={offer.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Star className={`w-4 h-4 ${offer.favorite ? 'fill-amber-400' : ''}`} />
              </button>

              <button
                onClick={handleToggleWatchlist}
                className={`p-2 rounded-xl border transition-all ${
                  offer.watching
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title={offer.watching ? 'Acompanhando' : 'Acompanhar oferta'}
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                onClick={handleToggleDeepDive}
                className={`p-2 rounded-xl border transition-all ${
                  offer.in_deep_dive
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title={offer.in_deep_dive ? 'Em Deep Dive' : 'Adicionar ao Deep Dive'}
              >
                <Flame className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar Dossiê
              </button>
            </div>
          </div>

          {/* 2. FACTUAL KPIS BAR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-4 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Preço Front</span>
              <span className="text-base font-black font-mono text-emerald-400 block">
                {formatCurrency(offer.price)}
              </span>
              <span className="text-[10px] text-slate-500">Ticket inicial</span>
            </div>

            <div
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5 cursor-help"
              title="Número de anúncios ativos observados para a oferta na Meta. Não corresponde ao número de criativos únicos salvos."
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Ads Ativos</span>
              <span className="text-base font-black font-mono text-white block">
                {offer.active_ads_count !== null && offer.active_ads_count !== undefined
                  ? `${offer.active_ads_count} ads`
                  : '—'}
              </span>
              <span className="text-[10px] text-slate-500">Escala na Meta</span>
            </div>

            <div
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5 cursor-help"
              title="Quantidade de peças criativas distintas após deduplicação. Vários anúncios podem reutilizar o mesmo criativo."
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Criativos Distintos</span>
              <span className="text-base font-black font-mono text-indigo-300 block">
                {offer.captured_unique_creatives || offer.unique_creatives_count ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    {offer.captured_unique_creatives ?? offer.unique_creatives_count}
                    <span className="text-[10px] font-semibold text-emerald-400/90 px-1 py-0.2 bg-emerald-500/10 rounded">peças</span>
                  </span>
                ) : offer.estimated_unique_creatives !== null && offer.estimated_unique_creatives !== undefined ? (
                  `${offer.estimated_unique_creatives}`
                ) : (
                  '—'
                )}
              </span>
              <span className="text-[10px] text-slate-500">
                {offer.captured_creatives_count && offer.captured_creatives_count > 0
                  ? `${offer.captured_videos_count ?? 0} vídeos, ${offer.captured_images_count ?? 0} imgs`
                  : 'Peças únicas identificadas'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Dias Rodando</span>
              <span className="text-base font-black font-mono text-slate-200 block">
                {offer.days_running !== null && offer.days_running !== undefined
                  ? `${offer.days_running} dias`
                  : '—'}
              </span>
              <span className="text-[10px] text-slate-500">Longevidade ativa</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Faceless</span>
              <span className={`text-xs font-bold block mt-1 ${offer.faceless ? 'text-emerald-400' : 'text-slate-400'}`}>
                {offer.faceless ? '✓ Sem Rosto' : '✕ Especialista'}
              </span>
              <span className="text-[10px] text-slate-500">Sem autoridade pessoal</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Primeiro Anúncio</span>
              <span className="text-xs font-mono font-bold text-slate-300 block mt-1">
                {offer.oldest_ad_date ? formatDate(offer.oldest_ad_date) : '—'}
              </span>
              <span className="text-[10px] text-slate-500">Início da veiculação</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Última Captura</span>
              <span className="text-xs font-mono font-bold text-slate-300 block mt-1">
                {offer.last_seen_at || offer.updated_at
                  ? formatDate(offer.last_seen_at || offer.updated_at)
                  : '—'}
              </span>
              <span className="text-[10px] text-slate-500">Último snapshot</span>
            </div>
          </div>
        </div>

        {/* 2. UNMAPPED WARNING BANNERS */}
        {!isLandingPageMapped(offer) && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Landing Page Não Mapeada</h4>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Esta oferta possui metadata cadastrada, mas o Offer Miner Mapper ainda não executou a captura e raspagem completa da LP.
                </p>
              </div>
            </div>
            <Link
              href={`/mapping?offerId=${offer.id}`}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition shadow"
            >
              Mapear Agora
            </Link>
          </div>
        )}

        {offer.checkout_discovery_status === 'NOT_PROCESSED' && (
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Checkout Não Processado</h4>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  O checkout desta oferta ainda não passou pela busca de links de checkout ou verificação de order bumps.
                </p>
              </div>
            </div>
            <Link
              href={`/mapping?type=CHECKOUT&offerId=${offer.id}`}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 transition shadow"
            >
              Descobrir Checkout
            </Link>
          </div>
        )}

        {/* 3. DOSSIÊ NAVIGATION TABS (11 TABS) */}
        <div className="border-b border-slate-800">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? 'border-blue-500 text-white bg-slate-900/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. TAB CONTENTS */}
        <div>
          {activeTab === 'overview' && (
            <TabOverview offer={offer} onOfferUpdated={setOffer} />
          )}
          {activeTab === 'advertiser' && (
            <TabAdvertiser offer={offer} />
          )}
          {activeTab === 'creatives' && (
            <TabCreatives offer={offer} onOfferUpdated={setOffer} />
          )}
          {activeTab === 'landing_page' && (
            <TabLandingPage offer={offer} onOfferUpdated={setOffer} />
          )}
          {activeTab === 'offer_stack' && (
            <TabOffer offer={offer} onOfferUpdated={setOffer} />
          )}
          {activeTab === 'funnel' && (
            <TabFunnel offer={offer} />
          )}
          {activeTab === 'history' && (
            <TabHistory offer={offer} onOfferUpdated={(updated) => setOffer(updated)} />
          )}
          {activeTab === 'copy' && (
            <TabCopy offer={offer} onOfferUpdated={setOffer} />
          )}
          {activeTab === 'audience' && (
            <TabAudience offer={offer} onOfferUpdated={setOffer} />
          )}
          {activeTab === 'notes' && (
            <TabNotes offer={offer} onOfferUpdated={setOffer} />
          )}
          {activeTab === 'raw_data' && (
            <TabRawData offer={offer} />
          )}
        </div>

        {/* Edit Modal */}
        {isEditing && (
          <OfferEditModal
            offer={offer}
            isOpen={isEditing}
            onClose={() => setIsEditing(false)}
            onSave={handleSaveEdit}
          />
        )}

        {/* Delete Modal */}
        {isDeleting && (
          <ConfirmModal
            isOpen={isDeleting}
            title="Excluir Oferta"
            description={`Tem certeza que deseja excluir "${offer.product_name}" do banco de inteligência? Esta ação removerá o dossiê e seus dados.`}
            confirmText="Sim, Excluir"
            cancelText="Cancelar"
            variant="danger"
            onConfirm={handleDelete}
            onClose={() => setIsDeleting(false)}
          />
        )}

        {/* Export Context Pack Modal */}
        {isExportModalOpen && (
          <ExportOfferModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            offerId={offer.id}
            offerName={offer.product_name}
          />
        )}
      </div>
    </AppShell>
  );
}
