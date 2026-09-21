'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Globe,
  CheckCircle2,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Plus,
  Trash2,
  ShieldCheck,
  Check,
  Edit2,
  Save,
  Clock,
  Sparkles,
  Smartphone,
  CreditCard,
  HelpCircle,
  Eye,
  RotateCcw,
  Search,
  Loader2,
  AlertCircle,
  FileText,
  Copy,
  Link2,
  History,
  Monitor,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ArrowRight,
  MessageCircle,
  Play,
  Video,
  Target,
  Gift,
  DollarSign,
  AlertTriangle,
  Flame,
  Tag,
  CheckSquare,
  ChevronRight,
  TrendingUp,
  MoreHorizontal,
  Wrench,
  SearchCode,
  Globe2,
  AlertOctagon,
  X,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Offer,
  LandingPageCapture,
  LandingPageSection,
  LandingPageLink,
  LandingPageAnalysisResult,
  LandingPageDiff,
  OfferDeliverable,
  OfferBonus,
  LandingPageUrlResolution,
  LandingPageCandidateUrl,
} from '@/types';
import { dbService } from '@/lib/supabase/db';
import { useToast } from '@/components/ui/Toast';
import { cn, formatCurrency } from '@/lib/utils';
import { LPAnalyzeProgressEvent } from '@/lib/landing-page/types';
import { notifyOfferUpdated } from '@/lib/events/offer-events';

interface TabLandingPageProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

type SubTab = 'visual' | 'estrutura' | 'copy' | 'elementos' | 'links' | 'historico';
type PreviewMode = 'live' | 'desktop' | 'mobile' | 'fullPage';

export function TabLandingPage({ offer, onOfferUpdated }: TabLandingPageProps) {
  const toast = useToast();

  const [currentOffer, setCurrentOffer] = useState<Offer>(offer);

  // Sync prop changes
  useEffect(() => {
    setCurrentOffer(offer);
  }, [offer]);

  // Navigation Subtabs
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('visual');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Core Data States
  const [captures, setCaptures] = useState<LandingPageCapture[]>([]);
  const [latestCapture, setLatestCapture] = useState<LandingPageCapture | null>(null);
  const [sections, setSections] = useState<LandingPageSection[]>([]);
  const [links, setLinks] = useState<LandingPageLink[]>([]);
  const [analysis, setAnalysis] = useState<LandingPageAnalysisResult | null>(null);
  const [deliverables, setDeliverables] = useState<OfferDeliverable[]>([]);
  const [bonuses, setBonuses] = useState<OfferBonus[]>([]);

  // Resolution & Diagnostics States
  const [resolution, setResolution] = useState<LandingPageUrlResolution | null>(null);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isConfigUrlOpen, setIsConfigUrlOpen] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Action / Progress States
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<LPAnalyzeProgressEvent | null>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // History Comparison State
  const [selectedFromCaptureId, setSelectedFromCaptureId] = useState<string>('');
  const [selectedToCaptureId, setSelectedToCaptureId] = useState<string>('');
  const [diffResult, setDiffResult] = useState<LandingPageDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Selected Section for Inspection
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load of LP Data
  useEffect(() => {
    loadLandingPageData();
  }, [currentOffer.id]);

  const loadLandingPageData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/offers/${currentOffer.id}/landing-page`);
      if (res.ok) {
        const data = await res.json();
        setCaptures(data.captures || []);
        setLatestCapture(data.latestCapture || null);
        setSections(data.sections || []);
        setLinks(data.links || []);
        setDeliverables(data.deliverables || []);
        setBonuses(data.bonuses || []);
        if (data.analysis) {
          setAnalysis(data.analysis);
        }
        if (data.resolution) {
          setResolution(data.resolution);
        }
        if (data.offer) {
          setCurrentOffer(data.offer);
        }

        // Set default comparison IDs
        if (data.captures && data.captures.length >= 2) {
          setSelectedFromCaptureId(data.captures[1].id);
          setSelectedToCaptureId(data.captures[0].id);
        } else if (data.captures && data.captures.length === 1) {
          setSelectedToCaptureId(data.captures[0].id);
        }

        // Auto-trigger initial visual capture ONLY if URL is valid/available and no captures exist yet
        const targetUrl = data.resolution?.resolvedUrl || currentOffer.landing_page_url_resolved || currentOffer.landing_page_url;
        const status = data.resolution?.status || currentOffer.landing_page_url_status;
        const isDead = status === 'DNS_NOT_RESOLVED' || status === 'UNAVAILABLE' || status === 'INVALID_URL';

        if (targetUrl && !isDead && (!data.captures || data.captures.length === 0)) {
          triggerAutoCapture();
        }
      }
    } catch (err) {
      console.error('[TAB LP] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Reverify / Resolve URL on demand
  const handleReverifyUrl = async (customManualUrl?: string) => {
    setIsResolvingUrl(true);
    try {
      const res = await fetch(`/api/offers/${currentOffer.id}/landing-page/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceReverify: true,
          manualOverrideUrl: customManualUrl !== undefined ? customManualUrl : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.resolution) {
        setResolution(data.resolution);
        if (data.offer) {
          setCurrentOffer(data.offer);
          onOfferUpdated(data.offer);
        }
        if (data.resolution.status === 'AVAILABLE' || data.resolution.status === 'RECOVERED_FROM_ADS') {
          toast.success(data.resolution.userFriendlyMessage || 'Landing page verificada com sucesso!');
          await loadLandingPageData();
        } else if (data.resolution.status === 'DIRECT_TO_CHECKOUT') {
          toast.info('Funil Direto para Checkout identificado.');
        } else {
          toast.info(data.resolution.userFriendlyMessage || 'Status da URL atualizado.');
        }
      } else {
        toast.error(data.error || 'Falha ao verificar resolução da URL.');
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao reverificar URL.');
    } finally {
      setIsResolvingUrl(false);
    }
  };

  // 3. Apply Candidate URL from Meta Ads
  const handleApplyCandidateUrl = async (candidateUrl: string) => {
    await handleReverifyUrl(candidateUrl);
    setIsConfigUrlOpen(false);
  };

  // 4. Trigger Visual Capture
  const triggerAutoCapture = async () => {
    const targetUrl = currentOffer.landing_page_url_resolved || currentOffer.landing_page_url;
    if (isCapturing || !targetUrl) return;
    setIsCapturing(true);
    try {
      const res = await fetch(`/api/offers/${currentOffer.id}/landing-page/capture`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success && data.capture) {
        toast.success('Preview visual da Landing Page gerado com sucesso!');
        await loadLandingPageData();
      } else if (data.resolution && (data.resolution.status === 'DNS_NOT_RESOLVED' || data.resolution.status === 'UNAVAILABLE')) {
        setResolution(data.resolution);
        toast.error(data.error || 'Não foi possível localizar este domínio na internet.');
      }
    } catch (err) {
      console.warn('[LP AUTO CAPTURE] Warning:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  // 5. Trigger Full Structured Mapping (SSE Streaming)
  const handleStartAnalysis = async () => {
    const targetUrl = currentOffer.landing_page_url_resolved || currentOffer.landing_page_url;
    if (!targetUrl) {
      toast.error('Esta oferta não possui uma URL de Landing Page cadastrada.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeProgress({
      step: 'opening_url',
      message: 'Iniciando navegador Chromium...',
      progressPercent: 5,
    });

    try {
      const res = await fetch(`/api/offers/${currentOffer.id}/landing-page/analyze?stream=true`, {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Falha ao iniciar mapeamento da Landing Page.');
        setIsAnalyzing(false);
        setAnalyzeProgress(null);
        return;
      }

      if (!res.body) {
        toast.error('Sem resposta do servidor.');
        setIsAnalyzing(false);
        setAnalyzeProgress(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const payload = JSON.parse(trimmed.replace(/^data:\s*/, ''));
              if (payload.step === 'done') {
                const finalAnalysis: LandingPageAnalysisResult = payload.result;
                setAnalysis(finalAnalysis);
                toast.success('Mapeamento completo da Landing Page concluído!');
                await loadLandingPageData();
                const updatedOffer = await dbService.getOfferById(currentOffer.id);
                if (updatedOffer) {
                  onOfferUpdated(updatedOffer);
                  notifyOfferUpdated(currentOffer.id, 'landing_page_mapping');
                }
              } else if (payload.step === 'failed') {
                if (payload.result?.resolution) {
                  setResolution(payload.result.resolution);
                }
                toast.error(payload.message || 'Falha no mapeamento.');
              } else {
                setAnalyzeProgress(payload as LPAnalyzeProgressEvent);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      console.error('[LP ANALYZE ERROR]:', err);
      toast.error('Erro de conexão durante o mapeamento.');
    } finally {
      setIsAnalyzing(false);
      setAnalyzeProgress(null);
    }
  };

  // 6. History Comparison Trigger
  const handleCompareCaptures = async (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setIsLoadingDiff(true);
    try {
      const res = await fetch(`/api/offers/${currentOffer.id}/landing-page/history?from=${fromId}&to=${toId}`);
      if (res.ok) {
        const data = await res.json();
        setDiffResult(data.diff || null);
      }
    } catch (err) {
      console.error('[LP DIFF] Error:', err);
    } finally {
      setIsLoadingDiff(false);
    }
  };

  // 7. Section Scroll Helper
  const handleScrollToSection = (section: LandingPageSection) => {
    setSelectedSectionId(section.id);
    if (viewerContainerRef.current && section.top_offset) {
      const scale = zoomLevel / 100;
      viewerContainerRef.current.scrollTo({
        top: section.top_offset * scale,
        behavior: 'smooth',
      });
    }
  };

  // 8. Copy text helper
  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Texto copiado para a área de transferência!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Domain & URL Resolution calculations
  const effectiveUrl =
    currentOffer.landing_page_url_resolved ||
    currentOffer.manual_override_url ||
    currentOffer.landing_page_url ||
    '';

  const originalImportedUrl =
    currentOffer.landing_page_url_original ||
    currentOffer.landing_page_url ||
    '';

  let domain = '—';
  try {
    if (effectiveUrl) {
      domain = new URL(effectiveUrl).hostname;
    }
  } catch {
    domain = currentOffer.landing_page_domain || '—';
  }

  const status = resolution?.status || currentOffer.landing_page_url_status;
  const isUrlDead = status === 'DNS_NOT_RESOLVED' || status === 'UNAVAILABLE' || status === 'INVALID_URL';
  const isDirectToCheckout = status === 'DIRECT_TO_CHECKOUT' || currentOffer.landing_page_flow_type === 'DIRECT_TO_CHECKOUT';
  const isRecoveredFromAds = resolution?.source === 'META_AD_DESTINATION' || currentOffer.landing_page_resolution_source === 'META_AD_DESTINATION';

  const heroXRay = analysis?.heroXRay || latestCapture?.raw_data?.analysis?.heroXRay || null;
  const copyData = analysis?.copy || latestCapture?.raw_data?.analysis?.copy || null;
  const elementsData = analysis?.elements || latestCapture?.raw_data?.analysis?.elements || null;
  const commerceData = analysis?.commerce || latestCapture?.raw_data?.analysis?.commerce || null;

  // Active snapshot image based on previewMode
  const activeSnapshotUrl = useMemo(() => {
    if (!latestCapture) return null;
    if (previewMode === 'mobile') {
      return latestCapture.mobile_screenshot_url || latestCapture.full_page_screenshot_url;
    }
    if (previewMode === 'fullPage') {
      return latestCapture.full_page_screenshot_url || latestCapture.desktop_screenshot_url;
    }
    return latestCapture.desktop_screenshot_url || latestCapture.full_page_screenshot_url;
  }, [latestCapture, previewMode]);

  return (
    <div className="space-y-6 select-none relative">
      {/* 1. TOP BAR: LANDING PAGE INTELLIGENCE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Globe className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Landing Page Intelligence</span>
              <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {domain}
              </span>
            </h3>

            {/* Smart Resolution Status Badge */}
            {isRecoveredFromAds ? (
              <button
                onClick={() => setIsDiagnosticOpen(true)}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-950/90 text-purple-300 border border-purple-800/80 flex items-center gap-1.5 hover:bg-purple-900 transition cursor-pointer"
                title="Esta URL foi encontrada através dos anúncios ativos na Meta Ads Library"
              >
                <SearchCode className="w-3 h-3 text-purple-400" />
                <span>↪ Recuperada dos Ads</span>
              </button>
            ) : isDirectToCheckout ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/90 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                <span>Funil Direto para Checkout</span>
              </span>
            ) : isUrlDead ? (
              <button
                onClick={() => setIsDiagnosticOpen(true)}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950/90 text-rose-300 border border-rose-800/80 flex items-center gap-1.5 hover:bg-rose-900 transition cursor-pointer"
                title="Clique para ver o diagnóstico de resolução"
              >
                <AlertOctagon className="w-3 h-3 text-rose-400" />
                <span>⚠ Domínio Indisponível</span>
              </button>
            ) : latestCapture?.capture_status === 'analyzed' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Mapeada</span>
              </span>
            ) : latestCapture?.capture_status === 'ready' || status === 'AVAILABLE' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-300 border border-blue-800/80 flex items-center gap-1">
                <Check className="w-3 h-3 text-blue-400" />
                <span>Disponível</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Pendente</span>
              </span>
            )}

            {/* Source Provenance Badge */}
            {(resolution?.source || currentOffer.landing_page_resolution_source) && (
              <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60">
                Fonte:{' '}
                <strong className="text-slate-200">
                  {(resolution?.source || currentOffer.landing_page_resolution_source) === 'META_AD_DESTINATION'
                    ? 'Meta Ads'
                    : (resolution?.source || currentOffer.landing_page_resolution_source) === 'MANUAL_OVERRIDE'
                    ? 'Manual'
                    : (resolution?.source || currentOffer.landing_page_resolution_source) === 'WWW_FALLBACK'
                    ? 'WWW'
                    : (resolution?.source || currentOffer.landing_page_resolution_source) === 'XLSX_HYPERLINK'
                    ? 'XLSX (Hyperlink)'
                    : (resolution?.source || currentOffer.landing_page_resolution_source) === 'XLSX_VALUE'
                    ? 'XLSX'
                    : 'Original'}
                </strong>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400">
            {latestCapture?.captured_at ? (
              <span>
                Última captura em {new Date(latestCapture.captured_at).toLocaleDateString('pt-BR')} às{' '}
                {new Date(latestCapture.captured_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {' • '}{captures.length} captura(s) no histórico
              </span>
            ) : currentOffer.landing_page_url_last_checked_at ? (
              <span>
                Última verificação de URL em{' '}
                {new Date(currentOffer.landing_page_url_last_checked_at).toLocaleDateString('pt-BR')} às{' '}
                {new Date(currentOffer.landing_page_url_last_checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <span>Aguardando validação da página de vendas</span>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Action: Mapear Landing Page */}
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing || isCapturing || !effectiveUrl || isUrlDead}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition active:scale-95',
              isAnalyzing
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30 cursor-not-allowed'
                : !effectiveUrl || isUrlDead
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
            )}
            title="Analisa o DOM, extrai a Hero, seções, copy, links, preço e sincroniza com a oferta"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mapeando LP...</span>
              </>
            ) : latestCapture?.capture_status === 'analyzed' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>Atualizar Mapeamento</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>Mapear Landing Page</span>
              </>
            )}
          </button>

          {/* Quick Recapture Visual */}
          <button
            onClick={triggerAutoCapture}
            disabled={isCapturing || isAnalyzing || !effectiveUrl || isUrlDead}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition',
              isUrlDead
                ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            )}
            title="Executa nova captura de screenshots da página"
          >
            {isCapturing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">Recapturar Visual</span>
          </button>

          {/* Open Resolved/Current URL */}
          {effectiveUrl && !isUrlDead && (
            <a
              href={effectiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition"
              title="Abrir página de vendas atual em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Abrir Página Atual</span>
            </a>
          )}

          {/* ⋯ Options Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
              title="Mais opções da Landing Page"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setIsMenuOpen(false)}
              >
                <button
                  onClick={() => setIsDiagnosticOpen(true)}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <SearchCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Diagnóstico da URL</span>
                </button>
                <button
                  onClick={() => {
                    setManualUrlInput(currentOffer.manual_override_url || effectiveUrl || '');
                    setIsConfigUrlOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>Configurar URL Manual</span>
                </button>
                <button
                  onClick={() => handleReverifyUrl()}
                  disabled={isResolvingUrl}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5 text-emerald-400', isResolvingUrl && 'animate-spin')} />
                  <span>Reverificar Resolução de URL</span>
                </button>
                {originalImportedUrl && (
                  <div className="pt-1.5 mt-1.5 border-t border-slate-800 px-3.5 py-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">URL do XLSX:</span>
                    <span className="text-[11px] text-slate-400 font-mono truncate block" title={originalImportedUrl}>
                      {originalImportedUrl}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME ANALYSIS PROGRESS BANNER */}
      {isAnalyzing && analyzeProgress && (
        <div className="p-4 sm:p-5 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-3 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <span>MAPEAMENTO INTELIGENTE DA LANDING PAGE</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                    {analyzeProgress.step}
                  </span>
                </h4>
                <p className="text-xs text-blue-200/90 mt-0.5 font-medium">{analyzeProgress.message}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-400 font-mono">
              {analyzeProgress.progressPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(5, analyzeProgress.progressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. SUBTABS NAVIGATION BAR */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 overflow-x-auto text-xs scrollbar-none">
        <button
          onClick={() => setActiveSubTab('visual')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition shrink-0',
            activeSubTab === 'visual'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Monitor className="w-4 h-4" />
          <span>VISUAL & PREVIEW</span>
        </button>

        <button
          onClick={() => setActiveSubTab('estrutura')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition shrink-0',
            activeSubTab === 'estrutura'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Layers className="w-4 h-4" />
          <span>ESTRUTURA ({sections.length > 0 ? sections.length : '—'})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('copy')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition shrink-0',
            activeSubTab === 'copy'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <FileText className="w-4 h-4" />
          <span>COPY & PROVAS</span>
        </button>

        <button
          onClick={() => setActiveSubTab('elementos')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition shrink-0',
            activeSubTab === 'elementos'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span>ELEMENTOS COMERCIAIS</span>
        </button>

        <button
          onClick={() => setActiveSubTab('links')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition shrink-0',
            activeSubTab === 'links'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Link2 className="w-4 h-4" />
          <span>LINKS & FUNIL ({links.length > 0 ? links.length : '—'})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('historico')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition shrink-0',
            activeSubTab === 'historico'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <History className="w-4 h-4" />
          <span>HISTÓRICO & DIFF ({captures.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. SUBTAB CONTENT PANELS */}
      {/* ========================================================================= */}

      {/* --- SUBTAB 1: VISUAL & PREVIEW CANVAS --- */}
      {activeSubTab === 'visual' && (
        <div className="space-y-4">
          {/* If URL is Dead / Offline / DNS_NOT_RESOLVED: Show Modern Recovery Card */}
          {isUrlDead ? (
            <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-rose-500/30 shadow-2xl space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        Landing Page Indisponível / Domínio Não Encontrado
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950 text-rose-300 border border-rose-800">
                        {status}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                      Não foi possível resolver o hostname{' '}
                      <span className="text-white font-mono font-semibold">{domain}</span> na internet. O domínio pode ter sido desativado, expirado ou migrado pelo anunciante.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                  <button
                    onClick={() => handleReverifyUrl()}
                    disabled={isResolvingUrl}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', isResolvingUrl && 'animate-spin')} />
                    <span>Reverificar URL</span>
                  </button>
                  <button
                    onClick={() => {
                      setManualUrlInput(currentOffer.manual_override_url || effectiveUrl || '');
                      setIsConfigUrlOpen(true);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Configurar URL</span>
                  </button>
                </div>
              </div>

              {/* URL Details Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">URL Importada (XLSX)</span>
                  <p className="text-xs font-mono text-slate-300 break-all">{originalImportedUrl || '—'}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Diagnóstico Técnico</span>
                  <p className="text-xs text-rose-300 font-medium">
                    {resolution?.userFriendlyMessage || 'Falha no servidor DNS (ENOTFOUND).'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Ação Recomendada</span>
                  <p className="text-xs text-slate-300">
                    Verifique se os anúncios utilizam uma nova URL de destino ou informe manualmente.
                  </p>
                </div>
              </div>

              {/* Candidate Destinations Recovered from Meta Ads */}
              {resolution?.candidates && resolution.candidates.length > 0 && (
                <div className="p-5 rounded-xl bg-slate-900/80 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SearchCode className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        URLs de Destino Encontradas nos Anúncios da Meta ({resolution.candidates.length})
                      </h4>
                    </div>
                    <span className="text-[10px] text-purple-300 font-semibold">
                      Recuperação Automática
                    </span>
                  </div>

                  <div className="space-y-2">
                    {resolution.candidates.map((cand, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white font-mono">{cand.domain}</span>
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                              {cand.count} anúncio(s)
                            </span>
                            {cand.isCheckout && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                Checkout
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-lg">{cand.url}</p>
                        </div>

                        <button
                          onClick={() => handleApplyCandidateUrl(cand.url)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Usar esta URL</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isDirectToCheckout ? (
            <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-amber-500/30 shadow-2xl space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Funil Direto para Checkout Identificado
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                      Os anúncios ativos desta oferta não passam por uma landing page intermediária tradicional; eles direcionam o usuário diretamente para a página de checkout.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={effectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Checkout Oficial</span>
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">URL do Checkout</span>
                  <p className="font-mono text-amber-300 break-all">{effectiveUrl}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Controls Bar: Mode Toggle + Zoom Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Visualização:</span>
                  <button
                    onClick={() => {
                      setPreviewMode('live');
                      setIframeBlocked(false);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold transition',
                      previewMode === 'live'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    )}
                  >
                    Live (Interativo)
                  </button>
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold transition',
                      previewMode === 'desktop'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    )}
                  >
                    Desktop
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1',
                      previewMode === 'mobile'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    )}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                  <button
                    onClick={() => setPreviewMode('fullPage')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold transition',
                      previewMode === 'fullPage'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    )}
                  >
                    Página Inteira
                  </button>
                </div>

                {/* Zoom controls for snapshots */}
                {previewMode !== 'live' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                      title="Diminuir Zoom"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-mono text-[11px] text-slate-300">{zoomLevel}%</span>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                      title="Aumentar Zoom"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLevel(100)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-[11px]"
                    >
                      100%
                    </button>
                  </div>
                )}
              </div>

              {/* Main Inspection Area: Split Preview + Sections Map */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Center / Left: Preview Canvas (9 cols) */}
                <div className="lg:col-span-9 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden p-2 sm:p-4 min-h-[580px] flex items-center justify-center relative shadow-inner">
                  {isCapturing ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <p className="text-sm font-semibold text-white">Capturando visual da Landing Page...</p>
                      <p className="text-xs text-slate-500 max-w-xs">
                        O Chromium está abrindo a página, carregando imagens e gerando snapshots.
                      </p>
                    </div>
                  ) : previewMode === 'live' ? (
                    <div className="w-full h-[700px] relative bg-white rounded-xl overflow-hidden">
                      {iframeBlocked ? (
                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-3">
                          <AlertCircle className="w-10 h-10 text-amber-400" />
                          <h4 className="text-sm font-bold text-white">Embed Interativo Bloqueado pelo Site</h4>
                          <p className="text-xs text-slate-400 max-w-md">
                            Esta Landing Page utiliza cabeçalhos de segurança (X-Frame-Options / CSP) que impedem visualização direta em iframe. Utilize os modos Snapshot (Desktop, Mobile, Página Inteira) capturados pelo Offer Miner.
                          </p>
                          <button
                            onClick={() => setPreviewMode('desktop')}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                          >
                            Ver Snapshot Desktop
                          </button>
                        </div>
                      ) : (
                        <iframe
                          src={effectiveUrl}
                          title="Live Landing Page Preview"
                          className="w-full h-full border-0"
                          onError={() => setIframeBlocked(true)}
                        />
                      )}
                    </div>
                  ) : activeSnapshotUrl ? (
                    <div
                      ref={viewerContainerRef}
                      className={cn(
                        'max-h-[750px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40 p-2 transition-transform duration-150',
                        previewMode === 'mobile' ? 'max-w-[420px] mx-auto' : 'w-full'
                      )}
                    >
                      <img
                        src={activeSnapshotUrl}
                        alt="Landing page snapshot"
                        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                        className="w-full h-auto object-contain rounded-lg shadow-2xl mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Globe className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Nenhum preview disponível</h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {effectiveUrl
                          ? 'Clique no botão abaixo para gerar a captura visual desta Landing Page.'
                          : 'Cadastre a URL da Landing Page para habilitar a visualização.'}
                      </p>
                      {effectiveUrl && (
                        <button
                          onClick={triggerAutoCapture}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20"
                        >
                          Capturar Preview Agora
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Interactive Sections Sidebar (3 cols) */}
                <div className="lg:col-span-3 space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span>Seções da Página</span>
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">
                        {sections.length} detectadas
                      </span>
                    </div>

                    {sections.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 space-y-2">
                        <p className="text-xs">Nenhuma seção mapeada ainda.</p>
                        <button
                          onClick={handleStartAnalysis}
                          disabled={isAnalyzing || isUrlDead}
                          className="text-xs text-blue-400 hover:underline font-semibold"
                        >
                          Mapear Seções Agora
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                        {sections.map((sec) => (
                          <button
                            key={sec.id}
                            onClick={() => handleScrollToSection(sec)}
                            className={cn(
                              'w-full text-left p-2.5 rounded-xl border text-xs transition flex items-start justify-between gap-2',
                              selectedSectionId === sec.id
                                ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                                : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-[10px] font-bold text-blue-400 mt-0.5">
                                {String(sec.position_index).padStart(2, '0')}
                              </span>
                              <div>
                                <span className="font-semibold block capitalize">
                                  {sec.section_type.replace('_', ' ')}
                                </span>
                                {sec.heading && (
                                  <span className="text-[11px] text-slate-400 truncate block max-w-[170px]">
                                    {sec.heading}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-1" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- SUBTAB 2: ESTRUTURA & RAIO-X DA HERO --- */}
      {activeSubTab === 'estrutura' && (
        <div className="space-y-6">
          {/* RAIO-X DA HERO */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Raio-X da Seção Hero (Primeira Dobra)
                </h4>
              </div>
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Ponto Central de Conversão
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Hero Screenshot / Visual */}
              <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center min-h-[260px]">
                {latestCapture?.hero_screenshot_url ? (
                  <img
                    src={latestCapture.hero_screenshot_url}
                    alt="Hero section capture"
                    className="w-full h-auto object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-500 space-y-2">
                    <ImageIcon className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-xs">Screenshot da Hero gerada no mapeamento.</p>
                  </div>
                )}
              </div>

              {/* Hero Extracted Elements */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Headline */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-blue-400">Headline</span>
                  <p className="text-slate-100 font-bold text-sm leading-relaxed">
                    {heroXRay?.headline ? `"${heroXRay.headline}"` : 'Não detectada'}
                  </p>
                </div>

                {/* Subheadline */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Subheadline / Apoio</span>
                  <p className="text-slate-300 leading-relaxed">
                    {heroXRay?.subheadline || 'Não detectada'}
                  </p>
                </div>

                {/* CTA Principal */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-emerald-400">CTA Principal</span>
                  <p className="text-emerald-300 font-bold">
                    {heroXRay?.primaryCtaText ? `[ ${heroXRay.primaryCtaText} ]` : 'Não detectado'}
                  </p>
                </div>

                {/* Preço Aparente na Hero */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-amber-400">Preço na Hero</span>
                  <p className="text-amber-300 font-bold font-mono">
                    {heroXRay?.priceDisplay || 'Não exibido na primeira dobra'}
                  </p>
                </div>

                {/* Prova Social */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-purple-400">Prova Social na Hero</span>
                  <p className="text-slate-200">
                    {heroXRay?.proofText || 'Não detectada'}
                  </p>
                </div>

                {/* Garantia */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-cyan-400">Garantia</span>
                  <p className="text-slate-200">
                    {heroXRay?.guaranteeText || 'Não mencionada na hero'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* TIMELINE DE TODAS AS SEÇÕES */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Sequência Estrutural da Página ({sections.length} seções)
                </h4>
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Execute o mapeamento para catalogar a ordem das seções.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sections.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-bold text-[10px]">
                        #{String(s.position_index).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {s.section_type}
                      </span>
                    </div>
                    <h5 className="font-bold text-white text-xs pt-1">
                      {s.heading || 'Seção sem cabeçalho explícito'}
                    </h5>
                    {s.text_content && (
                      <p className="text-[11px] text-slate-400 line-clamp-2">{s.text_content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB 3: COPY & PROVAS --- */}
      {activeSubTab === 'copy' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Repositório Factual de Copywriting Extraído da LP
                </h4>
              </div>
            </div>

            {copyData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Promessas & Headlines */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Promessas & Headlines</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    {(copyData.headlines || []).concat(copyData.promises || []).slice(0, 6).map((item: string, i: number) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-2"
                      >
                        <p className="text-slate-200 leading-relaxed font-medium">{item}</p>
                        <button
                          onClick={() => handleCopyText(item, `prom-${i}`)}
                          className="text-slate-500 hover:text-white shrink-0 p-1"
                          title="Copiar texto"
                        >
                          {copiedKey === `prom-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Benefícios & Bullets */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Benefícios & Bullets</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    {(copyData.benefits || []).slice(0, 6).map((item: string, i: number) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-2"
                      >
                        <p className="text-slate-200 leading-relaxed">{item}</p>
                        <button
                          onClick={() => handleCopyText(item, `ben-${i}`)}
                          className="text-slate-500 hover:text-white shrink-0 p-1"
                          title="Copiar texto"
                        >
                          {copiedKey === `ben-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Dores & Objeções */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Dores & Quebra de Objeções</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    {(copyData.painPoints || []).concat(copyData.objections || []).slice(0, 6).map((item: string, i: number) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-2"
                      >
                        <p className="text-slate-200 leading-relaxed">{item}</p>
                        <button
                          onClick={() => handleCopyText(item, `pain-${i}`)}
                          className="text-slate-500 hover:text-white shrink-0 p-1"
                          title="Copiar texto"
                        >
                          {copiedKey === `pain-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Chamadas para Ação (CTAs) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Chamadas para Ação (CTAs)</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    {(copyData.ctas || []).slice(0, 6).map((item: string, i: number) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-2"
                      >
                        <p className="text-slate-200 font-bold uppercase text-[11px]">{item}</p>
                        <button
                          onClick={() => handleCopyText(item, `cta-${i}`)}
                          className="text-slate-500 hover:text-white shrink-0 p-1"
                          title="Copiar texto"
                        >
                          {copiedKey === `cta-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Perguntas Frequentes (FAQ) */}
                {copyData.faqs && copyData.faqs.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 md:col-span-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Perguntas Frequentes (FAQ)</span>
                    </h5>
                    <div className="space-y-2 text-xs">
                      {copyData.faqs.map((faq: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <p className="font-bold text-white">{faq.question}</p>
                          <p className="text-slate-300 leading-relaxed text-xs">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                Execute o mapeamento para extrair os blocos de copy da página.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB 4: ELEMENTOS COMERCIAIS --- */}
      {activeSubTab === 'elementos' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Matriz de Elementos de Conversão Detectados
                </h4>
              </div>
            </div>

            {elementsData ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[
                  { label: 'Vídeo / VSL', present: elementsData.hasVsl || elementsData.hasVideo },
                  { label: 'Depoimentos / Provas', present: elementsData.hasTestimonials || elementsData.hasReviews },
                  { label: 'Avaliações / Ratings', present: elementsData.hasRating },
                  { label: 'Garantia Explícita', present: elementsData.hasGuarantee },
                  { label: 'FAQ Accordion', present: elementsData.hasFaq },
                  { label: 'Tabela de Preços', present: elementsData.hasPriceTable },
                  { label: 'Selos de Confiança', present: elementsData.hasBadges },
                  { label: 'WhatsApp / Chat', present: elementsData.hasWhatsApp },
                  { label: 'Checkout Embutido', present: elementsData.hasCheckout },
                  { label: 'Timer de Escassez', present: elementsData.hasTimer },
                  { label: 'Botão Flutuante / Sticky', present: elementsData.hasStickyCta },
                  { label: 'Popups / Overlays', present: elementsData.hasPopup },
                ].map((el, i) => (
                  <div
                    key={i}
                    className={cn(
                      'p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition',
                      el.present
                        ? 'bg-slate-950 border-emerald-500/40 text-slate-100'
                        : 'bg-slate-950/40 border-slate-800 text-slate-500'
                    )}
                  >
                    <span className="font-medium">{el.label}</span>
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]',
                        el.present ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'
                      )}
                    >
                      {el.present ? '✓' : '✕'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                Execute o mapeamento para catalogar os elementos de conversão.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB 5: LINKS & FUNIL --- */}
      {activeSubTab === 'links' && (
        <div className="space-y-6">
          {/* Funnel Flow Visual Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Fluxo de Tráfego Identificado da Oferta
            </h4>

            <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center">
                  1
                </span>
                <div>
                  <span className="font-bold text-white block">Meta Ads</span>
                  <span className="text-[11px] text-slate-400">Anúncios no Facebook/Instagram</span>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-600 hidden md:block" />

              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center">
                  2
                </span>
                <div>
                  <span className="font-bold text-white block">Landing Page</span>
                  <span className="text-[11px] text-slate-400 font-mono">{domain}</span>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-600 hidden md:block" />

              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center">
                  3
                </span>
                <div>
                  <span className="font-bold text-white block">Checkout</span>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    {commerceData?.checkoutPlatform
                      ? `Plataforma: ${commerceData.checkoutPlatform.toUpperCase()}`
                      : 'Checkout Direto'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Links Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Links & Destinos Mapeados ({links.length})
                </h4>
              </div>
            </div>

            {links.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhum link catalogado ainda. Execute o mapeamento da página.
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((lnk) => (
                  <div
                    key={lnk.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-200 block">{lnk.text || 'Botão sem texto'}</span>
                      <span className="text-[11px] text-slate-400 font-mono break-all">{lnk.url}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                          lnk.link_type === 'checkout'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : lnk.link_type === 'whatsapp'
                            ? 'bg-green-950 text-green-300 border border-green-800'
                            : 'bg-slate-800 text-slate-400'
                        )}
                      >
                        {lnk.link_type}
                      </span>
                      <a
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB 6: HISTÓRICO & DIFF --- */}
      {activeSubTab === 'historico' && (
        <div className="space-y-6">
          {/* Comparison Selector */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Comparação Factual entre Versões da Landing Page
            </h4>

            {captures.length >= 2 ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Captura Anterior:</span>
                  <select
                    value={selectedFromCaptureId}
                    onChange={(e) => setSelectedFromCaptureId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    {captures.map((c) => (
                      <option key={c.id} value={c.id}>
                        {new Date(c.captured_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(c.captured_at).toLocaleTimeString('pt-BR')}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-slate-600 font-bold">vs</span>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Captura Atual:</span>
                  <select
                    value={selectedToCaptureId}
                    onChange={(e) => setSelectedToCaptureId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    {captures.map((c) => (
                      <option key={c.id} value={c.id}>
                        {new Date(c.captured_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(c.captured_at).toLocaleTimeString('pt-BR')}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleCompareCaptures(selectedFromCaptureId, selectedToCaptureId)}
                  disabled={isLoadingDiff || selectedFromCaptureId === selectedToCaptureId}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  {isLoadingDiff ? 'Comparando...' : 'Comparar Versões'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                São necessárias pelo menos 2 capturas para exibir a análise comparativa de alterações.
              </p>
            )}

            {/* Diff Result Summary */}
            {diffResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 mt-4">
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                  Alterações Factuais Detectadas:
                </h5>
                <ul className="space-y-1 text-xs text-slate-300">
                  {diffResult.summary.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Historical List */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Histórico Imutável de Capturas ({captures.length})
            </h4>

            <div className="space-y-2">
              {captures.map((cap, i) => (
                <div
                  key={cap.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 font-mono font-bold flex items-center justify-center text-[10px]">
                      #{captures.length - i}
                    </span>
                    <div>
                      <span className="font-bold text-white block">
                        {new Date(cap.captured_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(cap.captured_at).toLocaleTimeString('pt-BR')}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{cap.final_url || cap.url}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        cap.capture_status === 'analyzed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      )}
                    >
                      {cap.capture_status}
                    </span>
                    {cap.full_page_screenshot_url && (
                      <a
                        href={cap.full_page_screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
                      >
                        Ver Imagem
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: DIAGNÓSTICO DETALHADO DA URL */}
      {/* ========================================================================= */}
      {isDiagnosticOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SearchCode className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Diagnóstico de Resolução da Landing Page
                </h3>
              </div>
              <button
                onClick={() => setIsDiagnosticOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">URL Original (XLSX)</span>
                <p className="font-mono text-slate-200 break-all">{originalImportedUrl || '—'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">DNS Root ({domain})</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        resolution?.diagnostic?.dnsRoot?.resolved
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      )}
                    >
                      {resolution?.diagnostic?.dnsRoot?.resolved ? 'RESOLVIDO' : 'FALHOU'}
                    </span>
                    {resolution?.diagnostic?.dnsRoot?.ips && resolution.diagnostic.dnsRoot.ips.length > 0 && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {resolution.diagnostic.dnsRoot.ips.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    DNS WWW ({resolution?.diagnostic?.dnsWww?.hostname || `www.${domain}`})
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block',
                      resolution?.diagnostic?.dnsWww?.resolved
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    )}
                  >
                    {resolution?.diagnostic?.dnsWww?.resolved ? 'RESOLVIDO' : 'NÃO RESOLVEU'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Destinos Mapeados nos Anúncios da Meta
                  </span>
                  <span className="text-[11px] font-mono font-bold text-purple-400">
                    {resolution?.diagnostic?.adDestinationsCount ?? 0} anúncio(s)
                  </span>
                </div>
                {resolution?.diagnostic?.adCandidates && resolution.diagnostic.adCandidates.length > 0 ? (
                  <div className="space-y-1.5 pt-1.5">
                    {resolution.diagnostic.adCandidates.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-900 text-[11px]">
                        <span className="font-mono text-slate-300 truncate max-w-sm">{c.url}</span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                          {c.count} ads
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-[11px]">Nenhuma destination_url capturada nos anúncios.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Status da Resolução</span>
                  <p className="font-bold text-white">{status || 'PENDING'}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Origem da Resolução</span>
                  <p className="font-bold text-slate-200">
                    {resolution?.source || currentOffer.landing_page_resolution_source || 'RESOLVED_ORIGINAL'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsDiagnosticOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: CONFIGURAR URL MANUAL */}
      {/* ========================================================================= */}
      {isConfigUrlOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Configurar URL Manual da Landing Page
                </h3>
              </div>
              <button
                onClick={() => setIsConfigUrlOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Caso a landing page tenha migrado para outro domínio ou a URL importada esteja incorreta, informe a URL atualizada abaixo para restaurar o preview e o mapeamento.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Nova URL da Landing Page:</label>
              <input
                type="text"
                value={manualUrlInput}
                onChange={(e) => setManualUrlInput(e.target.value)}
                placeholder="https://exemplo.com/pagina-de-vendas"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              {currentOffer.manual_override_url && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleReverifyUrl('');
                    setIsConfigUrlOpen(false);
                  }}
                  className="text-xs text-rose-400 hover:underline font-semibold"
                >
                  Remover URL Manual
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsConfigUrlOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleReverifyUrl(manualUrlInput.trim());
                    setIsConfigUrlOpen(false);
                  }}
                  disabled={isResolvingUrl || !manualUrlInput.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isResolvingUrl ? 'Salvando...' : 'Salvar & Verificar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
