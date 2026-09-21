'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Play,
  RotateCcw,
  CloudDownload,
  AlertCircle,
  FileArchive,
  Trash2,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Eye,
  Camera,
  Code,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Fingerprint,
  Wrench,
} from 'lucide-react';
import { Offer, OfferAdWithMedia, OfferCreative } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import { notifyOfferUpdated } from '@/lib/events/offer-events';
import { CaptureProgressEvent, CaptureResult, CaptureDiagnosticReport } from '@/lib/meta-ads/types';

interface TabCreativesProps {
  offer: Offer;
  onOfferUpdated: (offer: Offer) => void;
}

interface AdMediaPreviewProps {
  ad: OfferAdWithMedia;
  onOpenVideo?: () => void;
  onOpenImage?: () => void;
}

function AdMediaPreview({ ad, onOpenVideo, onOpenImage }: AdMediaPreviewProps) {
  const primaryMedia = ad.media[0];
  const isVideo = primaryMedia?.media_type === 'video';
  const isImage = primaryMedia?.media_type === 'image';

  // Fallback chain: thumbnail -> media -> card screenshot
  const initialUrl =
    primaryMedia?.thumbnail_display_url ||
    primaryMedia?.thumbnail_url ||
    primaryMedia?.media_display_url ||
    primaryMedia?.media_url ||
    ad.card_screenshot_display_url ||
    ad.card_screenshot_url ||
    null;

  const [currentSrc, setCurrentSrc] = useState<string | null>(initialUrl);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setCurrentSrc(initialUrl);
    setHasError(false);
    setRetryCount(0);
  }, [initialUrl]);

  const handleImageError = async () => {
    // If first error and we have a storage path, try resolving signed URL directly
    if (retryCount === 0 && primaryMedia?.storage_path) {
      setRetryCount(1);
      try {
        const pathParam = primaryMedia.thumbnail_path || primaryMedia.storage_path;
        const res = await fetch(`/api/creatives/signed-url?path=${encodeURIComponent(pathParam)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.url && data.url !== currentSrc) {
            setCurrentSrc(data.url);
            return;
          }
        }
      } catch (err) {
        console.warn('[IMG RECOVERY] Fresh signed URL fetch failed:', err);
      }
    }

    // Fallback to card screenshot
    const fallbackScreenshot = ad.card_screenshot_display_url || ad.card_screenshot_url;
    if (fallbackScreenshot && currentSrc !== fallbackScreenshot) {
      setCurrentSrc(fallbackScreenshot);
      return;
    }

    // Final fallback: show graceful placeholder icon
    setHasError(true);
  };

  return (
    <div
      onClick={() => {
        if (isVideo && onOpenVideo) onOpenVideo();
        else if (isImage && onOpenImage) onOpenImage();
      }}
      className={cn(
        'relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center select-none',
        (isVideo || isImage) && 'cursor-pointer group-hover:brightness-105'
      )}
    >
      {!hasError && currentSrc ? (
        <img
          src={currentSrc}
          alt={ad.headline || ad.primary_text || 'Criativo do anúncio'}
          onError={handleImageError}
          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5 p-4 text-center">
          {isVideo ? (
            <Video className="w-8 h-8 text-slate-700" />
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-700" />
          )}
          <span className="text-[10px] text-slate-500 font-medium">
            {isVideo ? 'Vídeo sem preview' : 'Imagem indisponível'}
          </span>
        </div>
      )}

      {/* Video Play Overlay */}
      {isVideo && (
        <div className="absolute inset-0 bg-black/30 hover:bg-black/10 flex items-center justify-center transition group-hover:scale-110">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </div>
        </div>
      )}

      {/* Image Zoom Hint on Hover */}
      {isImage && !hasError && currentSrc && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition opacity-0 group-hover:opacity-100">
          <div className="p-2 rounded-full bg-slate-900/80 text-white shadow-md">
            <Eye className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
}

export function TabCreatives({ offer, onOfferUpdated }: TabCreativesProps) {
  const toast = useToast();
  const [ads, setAds] = useState<OfferAdWithMedia[]>([]);
  const [legacyCreatives, setLegacyCreatives] = useState<OfferCreative[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [retryingAdId, setRetryingAdId] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState<CaptureProgressEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Video Modal State
  const [selectedAdForModal, setSelectedAdForModal] = useState<OfferAdWithMedia | null>(null);
  const [videoSignedUrl, setVideoSignedUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Image Modal State
  const [selectedImageAdForModal, setSelectedImageAdForModal] = useState<OfferAdWithMedia | null>(null);

  // Diagnostics Modal State
  const [viewingDebugData, setViewingDebugData] = useState<CaptureDiagnosticReport | null>(null);

  // Manual Add Modal State
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualFormat, setManualFormat] = useState('Vídeo');
  const [manualHook, setManualHook] = useState('');
  const [manualHeadline, setManualHeadline] = useState('');
  const [manualAdUrl, setManualAdUrl] = useState('');
  const [manualThumbnailUrl, setManualThumbnailUrl] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // 1. Initial Load of Ads & Media from Server API
  useEffect(() => {
    loadAdsData();
  }, [offer.id]);

  const loadAdsData = async () => {
    try {
      const res = await fetch(`/api/offers/${offer.id}/ads`);
      if (res.ok) {
        const data = await res.json();
        if (data.ads && Array.isArray(data.ads)) {
          setAds(data.ads);
          return;
        }
      }
    } catch (err) {
      console.warn('[TAB CREATIVES] Server API fetch warning, falling back to dbService:', err);
    }

    try {
      const adsList = await dbService.getOfferAds(offer.id);
      setAds(adsList);

      const creativesList = await dbService.getCreativesByOffer(offer.id);
      setLegacyCreatives(creativesList);
    } catch (err) {
      console.error('[TAB CREATIVES] Error loading ads:', err);
    }
  };

  // 2. Direct In-Process Backend Capture Execution
  const handleStartCapture = async (mode: 'capture' | 'discovery_only' = 'capture') => {
    if (!offer.meta_ads_url) {
      toast.error('Esta oferta não possui uma URL da Meta Ads Library cadastrada.');
      return;
    }

    setIsCapturing(true);
    setCurrentProgress({
      step: 'starting_browser',
      message: 'Iniciando captura direta no backend...',
      progressPercent: 5,
    });

    try {
      const res = await fetch(`/api/offers/${offer.id}/capture-creatives?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ offer, mode }),
      });

      if (!res.ok) {
        let errJson: any = {};
        try {
          errJson = await res.json();
        } catch {}
        toast.error(errJson.error || 'Falha ao executar captura no backend.');
        setIsCapturing(false);
        setCurrentProgress(null);
        return;
      }

      if (!res.body) {
        toast.error('Nenhuma resposta do servidor de captura.');
        setIsCapturing(false);
        setCurrentProgress(null);
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
                const finalResult: CaptureResult = payload.result;

                if (finalResult.success) {
                  await loadAdsData();
                  const updatedOffer = await dbService.getOfferById(offer.id);
                  if (updatedOffer) {
                    onOfferUpdated(updatedOffer);
                    notifyOfferUpdated(offer.id, 'creatives_captured');
                  }

                  if (mode === 'discovery_only') {
                    toast.success(
                      `Inspeção concluída! ${finalResult.adsInScope} anúncios detectados no escopo.`
                    );
                    setViewingDebugData(finalResult.diagnosticReport);
                  } else {
                    const countSaved = finalResult.ads?.length || finalResult.adsDetected || 0;
                    toast.success(`Captura concluída: ${countSaved} anúncios processados com sucesso.`);
                  }
                } else {
                  toast.error(finalResult.errorMessage || 'Falha na captura.');
                  if (finalResult.diagnosticReport) {
                    setViewingDebugData(finalResult.diagnosticReport);
                  }
                }
              } else if (payload.step === 'failed') {
                toast.error(payload.result?.errorMessage || 'Falha na captura.');
              } else {
                setCurrentProgress(payload as CaptureProgressEvent);
              }
            } catch (parseErr) {
              console.warn('[SSE PARSE WARNING]', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[CAPTURE STREAM ERROR]', err);
      toast.error('Erro de conexão durante a captura.');
    } finally {
      setIsCapturing(false);
      setCurrentProgress(null);
    }
  };

  // 3. Repair Media Routine
  const handleRepairMedia = async () => {
    setIsRepairing(true);
    try {
      const res = await fetch(`/api/offers/${offer.id}/repair-media`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Mídias sincronizadas: ${data.repairedCount} arquivo(s) revalidados!`);
        await loadAdsData();
      } else {
        toast.error(data.error || 'Erro ao sincronizar mídias.');
      }
    } catch (err) {
      toast.error('Erro ao comunicar com serviço de reparo.');
    } finally {
      setIsRepairing(false);
    }
  };

  // 4. Retry Media Capture for a Single Ad
  const handleRetrySingleAd = async (ad: OfferAdWithMedia) => {
    setRetryingAdId(ad.id);
    try {
      const res = await fetch(`/api/offers/${offer.id}/ads/${ad.id}/capture-media`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Mídia do anúncio #${ad.meta_ad_id} recapturada com sucesso!`);
        await loadAdsData();
        if (selectedAdForModal && selectedAdForModal.id === ad.id) {
          handleOpenAdModal(data.ad || ad);
        }
      } else {
        toast.error(data.error || 'Não foi possível recapturar a mídia deste anúncio.');
      }
    } catch (err) {
      toast.error('Erro ao tentar recapturar mídia.');
    } finally {
      setRetryingAdId(null);
    }
  };

  // 5. Open Video Modal
  const handleOpenAdModal = async (ad: OfferAdWithMedia) => {
    setSelectedAdForModal(ad);
    setVideoError(null);
    const primaryMedia = ad.media[0];
    setVideoDuration(primaryMedia?.duration_seconds || null);

    if (primaryMedia && primaryMedia.media_type === 'video') {
      setIsLoadingVideo(true);
      setVideoSignedUrl(null);

      try {
        if (primaryMedia.media_display_url) {
          setVideoSignedUrl(primaryMedia.media_display_url);
        } else if (primaryMedia.storage_path) {
          const res = await fetch(
            `/api/creatives/signed-url?path=${encodeURIComponent(primaryMedia.storage_path)}`
          );
          const data = await res.json();
          setVideoSignedUrl(data.url || `/uploads/${primaryMedia.storage_path}`);
        } else {
          setVideoSignedUrl(primaryMedia.media_url || primaryMedia.original_url || null);
        }
      } catch (err) {
        console.error(err);
        setVideoSignedUrl(primaryMedia.media_url || primaryMedia.original_url || null);
      } finally {
        setIsLoadingVideo(false);
      }
    } else {
      setVideoSignedUrl(null);
      setIsLoadingVideo(false);
    }
  };

  // 6. Open Image Modal
  const handleOpenImageModal = (ad: OfferAdWithMedia) => {
    setSelectedImageAdForModal(ad);
  };

  // 7. Delete Ad
  const handleDeleteAd = async (ad: OfferAdWithMedia) => {
    if (!confirm(`Excluir o anúncio #${ad.meta_ad_id} permanentemente do Offer Miner?`)) return;
    try {
      await dbService.deleteOfferAd(ad.id);
      const updated = ads.filter((a) => a.id !== ad.id);
      setAds(updated);
      onOfferUpdated({ ...offer, ads: updated });
      toast.success('Anúncio excluído com sucesso.');
    } catch (err) {
      toast.error('Erro ao excluir o anúncio.');
    }
  };

  // 8. Copy Text Helper
  const handleCopyText = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Texto copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 9. Manual Add Creative
  const handleSaveManualCreative = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingManual(true);
    try {
      const res = await fetch(`/api/offers/${offer.id}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_ad_id: `manual-${Date.now()}`,
          status: 'Ativo',
          headline: manualHeadline,
          primary_text: manualHook,
          meta_ad_url: manualAdUrl,
          media: [
            {
              media_type: manualFormat === 'Vídeo' ? 'video' : 'image',
              mime_type: manualFormat === 'Vídeo' ? 'video/mp4' : 'image/webp',
              thumbnail_url: manualThumbnailUrl,
              file_hash: `manual-hash-${Date.now()}`,
              is_primary: true,
              capture_status: 'completed',
            },
          ],
        }),
      });

      if (res.ok) {
        await loadAdsData();
        toast.success('Anúncio manual adicionado com sucesso.');
        setManualHook('');
        setManualHeadline('');
        setManualAdUrl('');
        setManualThumbnailUrl('');
        setIsAddingManual(false);
      } else {
        toast.error('Erro ao salvar anúncio manual.');
      }
    } catch (err) {
      toast.error('Erro ao salvar anúncio manual.');
    } finally {
      setIsSavingManual(false);
    }
  };

  // 10. Computed Ads List & Categorization
  const allAdsList = useMemo(() => {
    if (ads.length > 0) return ads;

    return legacyCreatives.map((c) => ({
      id: c.id,
      offer_id: c.offer_id,
      meta_ad_id: c.meta_ad_id || `legacy-${c.id}`,
      meta_ad_url: c.meta_ad_url || c.ad_url,
      status: c.status || 'Ativo',
      started_at: c.started_at,
      primary_text: c.primary_text || c.hook,
      headline: c.headline,
      media: [
        {
          id: `media-${c.id}`,
          offer_id: c.offer_id,
          offer_ad_id: c.id,
          media_type: (c.media_type === 'image' ? 'image' : 'video') as 'video' | 'image',
          mime_type: c.mime_type || (c.media_type === 'image' ? 'image/webp' : 'video/mp4'),
          original_url: c.original_media_url,
          storage_path: c.storage_path,
          thumbnail_path: c.thumbnail_path,
          media_url: c.media_url,
          thumbnail_url: c.thumbnail_url,
          file_hash: c.file_hash || '',
          file_size: c.file_size,
          width: c.width,
          height: c.height,
          duration_seconds: c.duration_seconds,
          is_primary: true,
          capture_status: c.capture_status,
        },
      ],
      isDuplicateCreative: false,
    })) as OfferAdWithMedia[];
  }, [ads, legacyCreatives]);

  // Unique hash calculation
  const uniqueHashes = useMemo(() => {
    const hashes = new Set<string>();
    allAdsList.forEach((a) => {
      a.media.forEach((m) => {
        if (m.file_hash && !m.file_hash.startsWith('card-screenshot-')) {
          hashes.add(m.file_hash);
        }
      });
    });
    return hashes;
  }, [allAdsList]);

  const uniqueCreativesCount = uniqueHashes.size > 0 ? uniqueHashes.size : allAdsList.length;
  const videoAdsCount = allAdsList.filter((a) => a.media[0]?.media_type === 'video').length;
  const imageAdsCount = allAdsList.filter((a) => a.media[0]?.media_type === 'image').length;
  const storedMediaCount = allAdsList.filter((a) =>
    a.media.some((m) => Boolean(m.media_display_url || m.storage_path || m.media_url))
  ).length;
  const duplicateAdsCount = allAdsList.filter((a) => a.isDuplicateCreative).length;
  const failedAdsCount = allAdsList.filter(
    (a) =>
      a.media.length === 0 ||
      a.media.some((m) => m.capture_status === 'failed' || m.capture_status === 'media_unmatched')
  ).length;

  // Filtered ads
  const filteredAds = useMemo(() => {
    return allAdsList.filter((a) => {
      const primary = a.media[0];
      const isVideo = primary?.media_type === 'video';
      const isImage = primary?.media_type === 'image';
      const isDuplicate = a.isDuplicateCreative;
      const isStored = a.media.some((m) => Boolean(m.media_display_url || m.storage_path || m.media_url));
      const isFailed =
        a.media.length === 0 ||
        a.media.some((m) => m.capture_status === 'failed' || m.capture_status === 'media_unmatched');

      if (filterType === 'videos') return isVideo;
      if (filterType === 'images') return isImage;
      if (filterType === 'duplicates') return isDuplicate;
      if (filterType === 'stored') return isStored;
      if (filterType === 'errors') return isFailed;
      return true;
    });
  }, [allAdsList, filterType]);

  return (
    <div className="space-y-6 select-none">
      {/* 1. TOP BAR: Action Controls & Summary Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Biblioteca de Anúncios & Criativos</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {allAdsList.length} anúncio(s) cadastrado(s) • {uniqueCreativesCount} criativo(s) distinto(s) • {storedMediaCount} mídias no Storage
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Action: Capturar Criativos */}
          <button
            onClick={() => handleStartCapture('capture')}
            disabled={isCapturing || !offer.meta_ads_url}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition active:scale-95',
              isCapturing
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30 cursor-not-allowed'
                : !offer.meta_ads_url
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
            )}
            title={!offer.meta_ads_url ? 'Esta oferta não possui uma URL da Meta Ads Library cadastrada.' : ''}
          >
            {isCapturing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Capturando...</span>
              </>
            ) : allAdsList.length > 0 ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Buscar Novos Anúncios</span>
              </>
            ) : (
              <>
                <CloudDownload className="w-3.5 h-3.5" />
                <span>Capturar Criativos</span>
              </>
            )}
          </button>

          {/* Sincronizar / Reparar Mídias */}
          {allAdsList.length > 0 && (
            <button
              onClick={handleRepairMedia}
              disabled={isRepairing || isCapturing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-semibold transition"
              title="Revalida arquivos no Storage e regenera thumbnails"
            >
              {isRepairing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Sincronizar Mídias</span>
            </button>
          )}

          {/* Test Discovery Button */}
          {offer.meta_ads_url && (
            <button
              onClick={() => handleStartCapture('discovery_only')}
              disabled={isCapturing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-800 text-xs font-semibold transition"
              title="Abre a Biblioteca e gera diagnóstico técnico sem alterar o banco"
            >
              <Search className="w-3.5 h-3.5 text-purple-400" />
              <span>Testar Detecção</span>
            </button>
          )}

          {/* Download All ZIP */}
          {storedMediaCount > 0 && (
            <a
              href={`/api/offers/${offer.id}/download-all-creatives`}
              download
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 border border-slate-700 hover:text-white transition"
              title="Baixar todas as mídias salvas em arquivo .ZIP organizado"
            >
              <FileArchive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Baixar Todos (.ZIP)</span>
            </a>
          )}

          {/* Meta Ads Library External Link */}
          {offer.meta_ads_url && (
            <a
              href={offer.meta_ads_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition"
              title="Abrir página oficial da Meta Ads Library"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Meta Ads Library</span>
            </a>
          )}

          {/* Manual Add Trigger */}
          <button
            onClick={() => setIsAddingManual(true)}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Adicionar anúncio manualmente"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ANÚNCIOS</span>
          <span className="text-xl font-black text-white font-mono mt-0.5 block">{allAdsList.length}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block flex items-center gap-1">
            <Fingerprint className="w-3 h-3" />
            <span>CRIATIVOS DISTINTOS</span>
          </span>
          <span className="text-xl font-black text-blue-400 font-mono mt-0.5 block">{uniqueCreativesCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">VÍDEOS</span>
          <span className="text-xl font-black text-purple-400 font-mono mt-0.5 block">{videoAdsCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">IMAGENS</span>
          <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">{imageAdsCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">MÍDIAS NO STORAGE</span>
          <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">{storedMediaCount}</span>
        </div>
      </div>

      {/* 3. REAL-TIME CAPTURE PROGRESS BANNER */}
      {isCapturing && currentProgress && (
        <div className="p-4 sm:p-5 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-3.5 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <span>PROCESSAMENTO NO BACKEND DO OFFER MINER</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                    {currentProgress.step}
                  </span>
                </h4>
                <p className="text-xs text-blue-200/90 mt-0.5 font-medium">{currentProgress.message}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-blue-400 font-mono">
                {currentProgress.progressPercent}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(5, currentProgress.progressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* 4. FILTER PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={cn(
            'px-3.5 py-1.5 rounded-xl font-semibold transition shrink-0',
            filterType === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          )}
        >
          Todos ({allAdsList.length})
        </button>

        <button
          onClick={() => setFilterType('videos')}
          className={cn(
            'px-3.5 py-1.5 rounded-xl font-semibold transition shrink-0 flex items-center gap-1.5',
            filterType === 'videos'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-300'
          )}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Vídeos ({videoAdsCount})</span>
        </button>

        <button
          onClick={() => setFilterType('images')}
          className={cn(
            'px-3.5 py-1.5 rounded-xl font-semibold transition shrink-0 flex items-center gap-1.5',
            filterType === 'images'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300'
          )}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Imagens ({imageAdsCount})</span>
        </button>

        {duplicateAdsCount > 0 && (
          <button
            onClick={() => setFilterType('duplicates')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl font-semibold transition shrink-0 flex items-center gap-1.5',
              filterType === 'duplicates'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-300'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Mesmo Criativo ({duplicateAdsCount})</span>
          </button>
        )}

        <button
          onClick={() => setFilterType('stored')}
          className={cn(
            'px-3.5 py-1.5 rounded-xl font-semibold transition shrink-0',
            filterType === 'stored'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300'
          )}
        >
          Salvos no Storage ({storedMediaCount})
        </button>

        {failedAdsCount > 0 && (
          <button
            onClick={() => setFilterType('errors')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl font-semibold transition shrink-0 flex items-center gap-1.5',
              filterType === 'errors'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-300'
            )}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Com Falha ({failedAdsCount})</span>
          </button>
        )}
      </div>

      {/* 5. AD CARDS GALLERY GRID */}
      {filteredAds.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Nenhum anúncio encontrado</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {offer.meta_ads_url
              ? 'Clique em "Capturar Criativos" para que o backend do Offer Miner extraia os anúncios e salve os arquivos no Storage.'
              : 'Cadastre a URL da Meta Ads Library para habilitar a captura automática.'}
          </p>
          {offer.meta_ads_url && (
            <button
              onClick={() => handleStartCapture('capture')}
              disabled={isCapturing}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition"
            >
              <CloudDownload className="w-4 h-4" />
              <span>Capturar Criativos Agora</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredAds.map((ad) => {
            const primaryMedia = ad.media[0];
            const isVideo = primaryMedia?.media_type === 'video';
            const isImage = primaryMedia?.media_type === 'image';
            const hasMediaFile = Boolean(primaryMedia?.media_display_url || primaryMedia?.storage_path || primaryMedia?.media_url);
            const mainMediaUrl = primaryMedia?.media_display_url || primaryMedia?.media_url;
            const cardScreenUrl = ad.card_screenshot_display_url || ad.card_screenshot_url;

            return (
              <div
                key={ad.id}
                className="group flex flex-col justify-between rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:shadow-xl transition-all duration-200 overflow-hidden text-left"
              >
                {/* Media Preview Box (Container with object-contain & dark background) */}
                <div className="relative">
                  <AdMediaPreview
                    ad={ad}
                    onOpenVideo={() => handleOpenAdModal(ad)}
                    onOpenImage={() => handleOpenImageModal(ad)}
                  />

                  {/* Top Left: Format Badge & Duration/Dimensions */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1',
                        isVideo ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
                      )}
                    >
                      {isVideo ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                      <span>{isVideo ? 'Vídeo' : 'Imagem'}</span>
                    </span>

                    {isVideo && primaryMedia?.duration_seconds && primaryMedia.duration_seconds > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/80 text-white border border-white/20">
                        {Math.floor(primaryMedia.duration_seconds / 60)}:
                        {Math.floor(primaryMedia.duration_seconds % 60)
                          .toString()
                          .padStart(2, '0')}
                      </span>
                    ) : null}

                    {isImage && primaryMedia?.width && primaryMedia?.height ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/80 text-white border border-white/20">
                        {primaryMedia.width}x{primaryMedia.height}
                      </span>
                    ) : null}
                  </div>

                  {/* Top Right Badges */}
                  <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 pointer-events-none">
                    {ad.isDuplicateCreative && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/90 text-amber-950 shadow-sm flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>MESMO CRIATIVO</span>
                      </span>
                    )}

                    {hasMediaFile ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-900/90 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Salvo</span>
                      </span>
                    ) : cardScreenUrl ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-900/90 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Camera className="w-2.5 h-2.5" />
                        <span>Screenshot</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-950/90 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>Sem Mídia</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content & Details */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    {/* Meta Ad ID and Date */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>ID: {ad.meta_ad_id}</span>
                      {ad.started_at && <span className="truncate max-w-[140px]">{ad.started_at}</span>}
                    </div>

                    {/* Headline */}
                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-relaxed">
                      {ad.headline || ad.primary_text || `Anúncio #${ad.meta_ad_id}`}
                    </h4>

                    {/* Primary Text */}
                    {ad.primary_text && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {ad.primary_text}
                      </p>
                    )}

                    {/* CTA / Destination Link */}
                    {ad.cta && (
                      <div className="pt-1">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          CTA: {ad.cta}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5">
                      {isVideo ? (
                        <button
                          onClick={() => handleOpenAdModal(ad)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Assistir</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenImageModal(ad)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 transition shadow-sm"
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>Ver Imagem</span>
                        </button>
                      )}

                      {/* Retry Single Ad Media Download if failed */}
                      {!hasMediaFile && (
                        <button
                          onClick={() => handleRetrySingleAd(ad)}
                          disabled={retryingAdId === ad.id}
                          className="px-2 py-1 rounded-lg bg-amber-950/40 text-amber-400 hover:bg-amber-900/50 border border-amber-800 text-xs font-medium flex items-center gap-1 transition"
                          title="Tentar baixar mídia novamente"
                        >
                          {retryingAdId === ad.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Recapturar</span>
                        </button>
                      )}

                      {/* Download Button */}
                      {(mainMediaUrl || cardScreenUrl) && (
                        <a
                          href={mainMediaUrl || cardScreenUrl || '#'}
                          download={`${(offer.product_name || 'oferta')
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '-')}_meta-${ad.meta_ad_id}.${
                            isVideo ? 'mp4' : 'webp'
                          }`}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Baixar mídia do Storage"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Copy Text Button */}
                      {ad.primary_text && (
                        <button
                          onClick={() => handleCopyText(ad.primary_text || '', ad.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                          title="Copiar texto do anúncio"
                        >
                          {copiedId === ad.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Meta Ads Library External Link */}
                      <a
                        href={ad.meta_ad_url || `https://www.facebook.com/ads/library/?id=${ad.meta_ad_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        title="Abrir no Meta Ads Library"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <button
                      onClick={() => handleDeleteAd(ad)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                      title="Excluir anúncio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. HTML5 VIDEO PLAYER & AD DETAILS MODAL */}
      {selectedAdForModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white truncate">
                  ANÚNCIO #{selectedAdForModal.meta_ad_id}
                </h3>
                {videoDuration && videoDuration > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-950/60 text-purple-300 border border-purple-800">
                    {Math.floor(videoDuration / 60)}:
                    {Math.floor(videoDuration % 60)
                      .toString()
                      .padStart(2, '0')}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedAdForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Player Container */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
              {isLoadingVideo ? (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs">Carregando vídeo do Storage...</span>
                </div>
              ) : videoError ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Não foi possível reproduzir este vídeo</h4>
                    <p className="text-xs text-slate-400 max-w-sm">{videoError}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => handleRetrySingleAd(selectedAdForModal)}
                      disabled={retryingAdId === selectedAdForModal.id}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                    >
                      {retryingAdId === selectedAdForModal.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Recapturar Vídeo</span>
                    </button>
                    <button
                      onClick={() => handleOpenAdModal(selectedAdForModal)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      Tentar Novamente
                    </button>
                    <a
                      href={
                        selectedAdForModal.meta_ad_url ||
                        `https://www.facebook.com/ads/library/?id=${selectedAdForModal.meta_ad_id}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-300 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir na Meta</span>
                    </a>
                  </div>
                </div>
              ) : videoSignedUrl ? (
                <video
                  src={videoSignedUrl}
                  controls
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.duration && v.duration > 0 && isFinite(v.duration)) {
                      setVideoDuration(v.duration);
                    }
                    setVideoError(null);
                  }}
                  onError={(e) => {
                    const v = e.currentTarget;
                    const code = v.error?.code;
                    const msg = v.error?.message;
                    setVideoError(
                      `Erro de reprodução (código ${code || 'indefinido'}${msg ? `: ${msg}` : ''})`
                    );
                  }}
                  className="w-full h-full object-contain"
                />
              ) : selectedAdForModal.media[0]?.media_url ? (
                <video
                  src={selectedAdForModal.media[0].media_url}
                  controls
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.duration && v.duration > 0 && isFinite(v.duration)) {
                      setVideoDuration(v.duration);
                    }
                  }}
                  onError={(e) => {
                    const v = e.currentTarget;
                    setVideoError(`Erro ao decodificar stream.`);
                  }}
                  className="w-full h-full object-contain"
                />
              ) : selectedAdForModal.card_screenshot_url ? (
                <img
                  src={selectedAdForModal.card_screenshot_url}
                  alt="Card screenshot"
                  className="w-full h-full object-contain"
                />
              ) : (
                <p className="text-xs text-rose-400">Não foi possível carregar a reprodução deste vídeo.</p>
              )}
            </div>

            {/* Full Ad Details */}
            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              {selectedAdForModal.headline && (
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Headline</span>
                  <span className="text-white font-semibold text-sm">{selectedAdForModal.headline}</span>
                </div>
              )}

              {selectedAdForModal.primary_text && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Texto Principal (Copy)</span>
                    <button
                      onClick={() => handleCopyText(selectedAdForModal.primary_text || '', 'modal-copy')}
                      className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar Texto</span>
                    </button>
                  </div>
                  <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedAdForModal.primary_text}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                {selectedAdForModal.advertiser && (
                  <div>
                    <span className="text-slate-500 block">Anunciante:</span>
                    <span className="text-slate-300 font-medium">{selectedAdForModal.advertiser}</span>
                  </div>
                )}
                {selectedAdForModal.started_at && (
                  <div>
                    <span className="text-slate-500 block">Início da Veiculação:</span>
                    <span className="text-slate-300 font-medium">{selectedAdForModal.started_at}</span>
                  </div>
                )}
                {selectedAdForModal.cta && (
                  <div>
                    <span className="text-slate-500 block">CTA:</span>
                    <span className="text-slate-300 font-medium">{selectedAdForModal.cta}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <a
                href={
                  selectedAdForModal.meta_ad_url ||
                  `https://www.facebook.com/ads/library/?id=${selectedAdForModal.meta_ad_id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir na Meta Ads Library</span>
              </a>

              {videoSignedUrl && (
                <a
                  href={videoSignedUrl}
                  download={`${(offer.product_name || 'oferta')
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')}_meta-${selectedAdForModal.meta_ad_id}.mp4`}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Vídeo</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. FULL IMAGE VIEW MODAL */}
      {selectedImageAdForModal && (() => {
        const primaryMedia = selectedImageAdForModal.media[0];
        const imageDisplayUrl =
          primaryMedia?.media_display_url ||
          primaryMedia?.media_url ||
          primaryMedia?.thumbnail_display_url ||
          selectedImageAdForModal.card_screenshot_display_url ||
          selectedImageAdForModal.card_screenshot_url ||
          '';

        const downloadFileName = `${(offer.product_name || 'criativo')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')}_meta-${selectedImageAdForModal.meta_ad_id}.webp`;

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
            <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white truncate">
                    CRIATIVO #{selectedImageAdForModal.meta_ad_id}
                  </h3>
                  {primaryMedia?.width && primaryMedia?.height && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                      {primaryMedia.width}x{primaryMedia.height}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedImageAdForModal(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Large Image Container */}
              <div className="relative max-h-[55vh] min-h-[260px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800/80">
                {imageDisplayUrl ? (
                  <img
                    src={imageDisplayUrl}
                    alt={selectedImageAdForModal.headline || 'Criativo da Meta Ads'}
                    className="max-h-[50vh] w-auto max-w-full object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-xs text-rose-400 p-8 text-center">
                    Imagem não encontrada no Storage.
                  </div>
                )}
              </div>

              {/* Ad Details Box */}
              <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
                {selectedImageAdForModal.headline && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Headline</span>
                    <span className="text-white font-semibold text-sm">{selectedImageAdForModal.headline}</span>
                  </div>
                )}

                {selectedImageAdForModal.primary_text && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Texto Principal (Copy)</span>
                      <button
                        onClick={() => handleCopyText(selectedImageAdForModal.primary_text || '', 'modal-image-copy')}
                        className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar Texto</span>
                      </button>
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedImageAdForModal.primary_text}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                  {selectedImageAdForModal.advertiser && (
                    <div>
                      <span className="text-slate-500 block">Anunciante:</span>
                      <span className="text-slate-300 font-medium truncate block">{selectedImageAdForModal.advertiser}</span>
                    </div>
                  )}
                  {selectedImageAdForModal.started_at && (
                    <div>
                      <span className="text-slate-500 block">Início:</span>
                      <span className="text-slate-300 font-medium truncate block">{selectedImageAdForModal.started_at}</span>
                    </div>
                  )}
                  {primaryMedia?.file_size && (
                    <div>
                      <span className="text-slate-500 block">Tamanho:</span>
                      <span className="text-slate-300 font-mono font-medium">{Math.round(primaryMedia.file_size / 1024)} KB</span>
                    </div>
                  )}
                  {selectedImageAdForModal.cta && (
                    <div>
                      <span className="text-slate-500 block">CTA:</span>
                      <span className="text-slate-300 font-medium">{selectedImageAdForModal.cta}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <a
                  href={
                    selectedImageAdForModal.meta_ad_url ||
                    `https://www.facebook.com/ads/library/?id=${selectedImageAdForModal.meta_ad_id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir na Meta Ads Library</span>
                </a>

                {imageDisplayUrl && (
                  <a
                    href={imageDisplayUrl}
                    download={downloadFileName}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Imagem</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 8. DIAGNOSTICS MODAL */}
      {viewingDebugData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Relatório de Auditoria & Diagnóstico do Scraper
                  </h3>
                  <p className="text-xs text-slate-400">Visão técnica do que o Chromium carregou e inspecionou</p>
                </div>
              </div>
              <button
                onClick={() => setViewingDebugData(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid 1: Basic Page Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Título da Página</span>
                <span className="font-semibold text-white block">{viewingDebugData.pageTitle || '—'}</span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  HTTP Status: {viewingDebugData.httpStatus || 200} ({viewingDebugData.httpStatusText || 'OK'})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Tempo de Execução</span>
                <span className="font-semibold text-white block font-mono">
                  {viewingDebugData.executionTimeMs ? `${(viewingDebugData.executionTimeMs / 1000).toFixed(2)}s` : '—'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate" title={viewingDebugData.finalUrl}>
                  URL Final: {viewingDebugData.finalUrl}
                </span>
              </div>
            </div>

            {/* Grid 2: Inspection Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Vídeos no DOM</span>
                <span className="text-lg font-black text-purple-400 font-mono">
                  {viewingDebugData.videoElementsCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Imagens Criativas</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {viewingDebugData.imageElementsCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Respostas MP4</span>
                <span className="text-lg font-black text-cyan-400 font-mono">
                  {viewingDebugData.mp4ResponsesCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Ad IDs Encontrados</span>
                <span className="text-lg font-black text-white font-mono">
                  {viewingDebugData.metaAdIdsFound.length}
                </span>
              </div>
            </div>

            {/* Screenshot Display */}
            {viewingDebugData.screenshotUrl && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                    <span>Screenshot Capturado pelo Chromium:</span>
                  </span>
                  {viewingDebugData.htmlUrl && (
                    <a
                      href={viewingDebugData.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <Code className="w-3 h-3" />
                      <span>Ver HTML Bruto</span>
                    </a>
                  )}
                </div>
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-black max-h-96 overflow-y-auto">
                  <img
                    src={viewingDebugData.screenshotUrl}
                    alt="Screenshot do Scraper"
                    className="w-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Body Text Sample */}
            {viewingDebugData.bodyTextSample && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">Amostra do Texto Visível na Página:</span>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {viewingDebugData.bodyTextSample}
                </div>
              </div>
            )}

            {/* Footer Close */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewingDebugData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
              >
                Fechar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MANUAL ADD MODAL */}
      {isAddingManual && (
        <form
          onSubmit={handleSaveManualCreative}
          className="p-5 rounded-2xl bg-slate-900 border border-blue-500/40 shadow-xl space-y-4 animate-in fade-in duration-200 text-xs"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Novo Anúncio Manual
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingManual(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Formato</label>
              <select
                value={manualFormat}
                onChange={(e) => setManualFormat(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Vídeo">Vídeo</option>
                <option value="Imagem">Imagem</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Texto Principal / Gancho</label>
              <input
                type="text"
                value={manualHook}
                onChange={(e) => setManualHook(e.target.value)}
                placeholder="Ex: Aprenda a modelar do zero"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Headline do Anúncio</label>
              <input
                type="text"
                value={manualHeadline}
                onChange={(e) => setManualHeadline(e.target.value)}
                placeholder="Ex: Molde Avental Japonês"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddingManual(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingManual}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm transition"
            >
              {isSavingManual ? 'Salvando...' : 'Salvar Anúncio'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
