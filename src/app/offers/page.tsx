'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { dbService } from '@/lib/supabase/db';
import { offerEvents } from '@/lib/events/offer-events';
import { Offer, OfferFiltersState, OfferStatus, isLandingPageMapped } from '@/types';
import { deriveDataStatus, deriveDaysRunning } from '@/lib/dossier';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/offers/DataTable';
import { OffersGrid } from '@/components/offers/OffersGrid';
import { OfferCardSkeleton } from '@/components/offers/OfferCardSkeleton';
import { CardDensity } from '@/components/offers/OfferCard';
import { OfferFilters } from '@/components/offers/OfferFilters';
import { BulkActionBar } from '@/components/offers/BulkActionBar';
import { BulkDeleteModal } from '@/components/offers/BulkDeleteModal';
import { OfferEditModal } from '@/components/offers/OfferEditModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { UploadCloud, Layers, ChevronDown, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { OfferCard } from '@/components/offers/OfferCard';
import { ImportDropdown } from '@/components/imports/ImportDropdown';
import { JsonImportModal } from '@/components/imports/JsonImportModal';
import { ReconciliationDrawer } from '@/components/offers/ReconciliationDrawer';

function OffersPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialNiche = searchParams.get('niche') || 'all';
  const initialStatus = (searchParams.get('status') as OfferStatus) || 'all';
  const initialQuickFilter = searchParams.get('quickFilter') || 'all';
  const initialOnlyFavorites = searchParams.get('favorites') === 'true' || initialQuickFilter === 'favorites';
  const initialOnlyWatching = searchParams.get('watching') === 'true' || initialQuickFilter === 'watching';
  const initialOnlyDeepDive = searchParams.get('deep_dive') === 'true' || initialQuickFilter === 'deep_dive';

  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [density, setDensity] = useState<CardDensity>('standard');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // Modals state
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deletingOffer, setDeletingOffer] = useState<Offer | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [reconciliationOfferId, setReconciliationOfferId] = useState<string | null>(null);

  // Column visibility for table mode
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    favorite: true,
    watchlist: true,
    product: true,
    niche: true,
    price: true,
    ads: true,
    creatives: true,
    days: true,
    trend: true,
    faceless: true,
    completeness: true,
    status: true,
    imported_at: true,
    actions: true,
  });

  // Filter state
  const [filters, setFilters] = useState<OfferFiltersState>({
    search: initialQuery,
    niche: initialNiche,
    subniche: 'all',
    productType: 'all',
    faceless: 'all',
    status: initialStatus,
    decision: 'all',
    trend: 'all',
    adFormat: 'all',
    onlyFavorites: initialOnlyFavorites,
    onlyWatching: initialOnlyWatching,
    onlyDeepDive: initialOnlyDeepDive,
    quickFilter: initialQuickFilter as OfferFiltersState['quickFilter'],
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  // Sync URL search params when filters state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();

    if (filters.search) params.set('q', filters.search);
    if (filters.niche && filters.niche !== 'all') params.set('niche', filters.niche);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.quickFilter && filters.quickFilter !== 'all') params.set('quickFilter', filters.quickFilter);
    if (filters.scaleTier && filters.scaleTier !== 'all') params.set('scale', filters.scaleTier);
    if (filters.lpStatusFilter && filters.lpStatusFilter !== 'all') params.set('lp', filters.lpStatusFilter);
    if (filters.checkoutStatusFilter && filters.checkoutStatusFilter !== 'all') params.set('checkout', filters.checkoutStatusFilter);
    if (filters.onlyFavorites) params.set('favorites', 'true');
    if (filters.onlyWatching) params.set('watching', 'true');
    if (filters.onlyDeepDive) params.set('deep_dive', 'true');

    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [filters]);

  const handleViewModeChange = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('offer_miner_view_mode', mode);
    } catch {}
  };

  const handleDensityChange = (d: CardDensity) => {
    setDensity(d);
    try {
      localStorage.setItem('offer_miner_cards_density', d);
    } catch {}
  };

  useEffect(() => {
    loadOffers();

    const unsub = offerEvents.subscribe(() => {
      loadOffers(false);
    });
    return () => unsub();
  }, []);

  const loadOffers = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const data = await dbService.getOffers();
      setOffers(data);
    } catch (err) {
      console.error('Error fetching offers:', err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  // Selected offers objects list for preview in modals and bulk toolbar
  const selectedOffersList = useMemo(() => {
    const idSet = new Set(selectedIds);
    return offers.filter((o) => idSet.has(o.id));
  }, [offers, selectedIds]);

  const isAllFavorites = useMemo(() => {
    return (
      selectedOffersList.length > 0 &&
      selectedOffersList.every((o) => o.favorite === true)
    );
  }, [selectedOffersList]);

  const isAllWatching = useMemo(() => {
    return (
      selectedOffersList.length > 0 &&
      selectedOffersList.every((o) => o.watching === true)
    );
  }, [selectedOffersList]);

  // Distinct niches & product types
  const availableNiches = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.niche) set.add(o.niche);
    });
    return Array.from(set).sort();
  }, [offers]);

  const availableProductTypes = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      if (o.product_type) set.add(o.product_type);
    });
    return Array.from(set).sort();
  }, [offers]);

  // Client filtered offers
  // Client filtered offers
  const filteredOffers = useMemo(() => {
    return offers
      .filter((offer) => {
        // 1. Search Query
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const match =
            (offer.product_name || '').toLowerCase().includes(q) ||
            (offer.advertiser || '').toLowerCase().includes(q) ||
            (offer.headline || '').toLowerCase().includes(q) ||
            (offer.promise || '').toLowerCase().includes(q) ||
            (offer.niche || '').toLowerCase().includes(q) ||
            (offer.subniche || '').toLowerCase().includes(q) ||
            (offer.product_type || '').toLowerCase().includes(q) ||
            (offer.notes || '').toLowerCase().includes(q) ||
            (offer.landing_page_domain || '').toLowerCase().includes(q) ||
            (offer.landing_page_url || '').toLowerCase().includes(q) ||
            (offer.checkout_url || '').toLowerCase().includes(q) ||
            (offer.checkout_platform || '').toLowerCase().includes(q);
          if (!match) return false;
        }

        // 2. Scale Tier / Color Filter
        if (filters.scaleTier && filters.scaleTier !== 'all') {
          const ads = offer.active_ads_count ?? 0;
          if (filters.scaleTier === 'FULL_SCALE' && ads <= 200) return false;
          if (filters.scaleTier === 'HIGH_SCALE' && (ads < 101 || ads > 200)) return false;
          if (filters.scaleTier === 'SCALING' && (ads < 31 || ads > 100)) return false;
          if (filters.scaleTier === 'NORMAL' && ads > 30) return false;
        }

        // 3. Quick Filter Chips
        if (filters.quickFilter && filters.quickFilter !== 'all') {
          const ads = offer.active_ads_count ?? 0;
          if (filters.quickFilter === 'full_scale' && ads <= 200) return false;
          if (filters.quickFilter === 'scale_high' && (ads < 101 || ads > 200)) return false;
          if (filters.quickFilter === 'scale_normal' && ads > 30) return false;
          if (filters.quickFilter === 'ads_100_plus' && ads < 100) return false;
          if (filters.quickFilter === 'ads_30_plus' && ads < 30) return false;

          if (filters.quickFilter === 'new') {
            const createdTime = new Date(offer.created_at).getTime();
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            if (createdTime < sevenDaysAgo) return false;
          } else if (filters.quickFilter === 'favorites' && !offer.favorite) {
            return false;
          } else if (filters.quickFilter === 'watching' && !offer.watching) {
            return false;
          } else if (filters.quickFilter === 'deep_dive' && !offer.in_deep_dive) {
            return false;
          } else if (filters.quickFilter === 'price_20_30') {
            const p = offer.price ?? offer.front_price_avg ?? 0;
            if (p < 20 || p > 30) return false;
          } else if (filters.quickFilter === 'days_20_plus' && (offer.days_running ?? 0) < 20) {
            return false;
          } else if (filters.quickFilter === 'faceless' && offer.faceless !== true) {
            return false;
          } else if (filters.quickFilter === 'with_lp' && (!offer.landing_page_url || offer.landing_page_url.trim() === '')) {
            return false;
          } else if (filters.quickFilter === 'without_lp' && offer.landing_page_url && offer.landing_page_url.trim() !== '') {
            return false;
          } else if (filters.quickFilter === 'with_checkout' && (!offer.checkout_url || offer.checkout_url.trim() === '' || offer.checkout_url.trim() === offer.landing_page_url?.trim())) {
            return false;
          } else if (filters.quickFilter === 'without_checkout' && offer.checkout_url && offer.checkout_url.trim() !== '' && offer.checkout_url.trim() !== offer.landing_page_url?.trim()) {
            return false;
          }
        }

        // 4. Favorites, Watching, Deep Dive
        if (filters.onlyFavorites && !offer.favorite) return false;
        if (filters.onlyWatching && !offer.watching) return false;
        if (filters.onlyDeepDive && !offer.in_deep_dive) return false;

        // 5. Status & Decision
        if (filters.status && filters.status !== 'all') {
          const effectiveStatus = deriveDataStatus(offer);
          if (effectiveStatus !== filters.status && offer.status !== filters.status) return false;
        }
        if (filters.decision && filters.decision !== 'all' && offer.decision !== filters.decision) return false;

        // 6. Niches & Subniches
        if (filters.selectedNiches && filters.selectedNiches.length > 0) {
          if (!offer.niche || !filters.selectedNiches.includes(offer.niche)) return false;
        } else if (filters.niche && filters.niche !== 'all' && offer.niche !== filters.niche) {
          return false;
        }

        if (filters.subniche && filters.subniche !== 'all' && offer.subniche !== filters.subniche) return false;

        // 7. Product Type
        if (filters.selectedProductTypes && filters.selectedProductTypes.length > 0) {
          if (!offer.product_type || !filters.selectedProductTypes.includes(offer.product_type)) return false;
        } else if (filters.productType && filters.productType !== 'all' && offer.product_type !== filters.productType) {
          return false;
        }

        // 8. Price Range Filter (Null protection)
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
          const minP = filters.minPrice ?? 0;
          const maxP = filters.maxPrice ?? Infinity;
          const opts = offer.frontend_options || [];
          if (opts.length > 0) {
            const hasMatch = opts.some((o) => o.current_price >= minP && o.current_price <= maxP);
            if (!hasMatch) return false;
          } else {
            if (offer.price === null || offer.price === undefined) return false;
            if (offer.price < minP || offer.price > maxP) return false;
          }
        }

        // 9. Ads Count Range Filter
        if (filters.minAds !== undefined && (offer.active_ads_count ?? 0) < filters.minAds) return false;
        if (filters.maxAds !== undefined && (offer.active_ads_count ?? 0) > filters.maxAds) return false;

        // 10. Days Running Range Filter
        const days = offer.days_running ?? deriveDaysRunning(offer) ?? 0;
        if (filters.minDays !== undefined && days < filters.minDays) return false;
        if (filters.maxDays !== undefined && days > filters.maxDays) return false;

        // 11. Unique Creatives Range Filter
        const creativesCount = offer.estimated_unique_creatives ?? offer.captured_creatives_count ?? 0;
        if (filters.minCreatives !== undefined && creativesCount < filters.minCreatives) return false;
        if (filters.maxCreatives !== undefined && creativesCount > filters.maxCreatives) return false;

        // 12. Faceless Filter
        if (filters.faceless !== undefined && filters.faceless !== 'all') {
          if (offer.faceless !== filters.faceless) return false;
        }

        // 13. Landing Page Status Filter
        if (filters.lpStatusFilter && filters.lpStatusFilter !== 'all') {
          const hasLp = Boolean(offer.landing_page_url && offer.landing_page_url.trim() !== '');
          const isLpSuccess = isLandingPageMapped(offer);

          if (filters.lpStatusFilter === 'with_lp' && !hasLp) return false;
          if (filters.lpStatusFilter === 'without_lp' && hasLp) return false;
          if (filters.lpStatusFilter === 'SUCCESS' && !isLpSuccess) return false;
          if (filters.lpStatusFilter === 'PENDING' && (!hasLp || isLpSuccess)) return false;
          if (filters.lpStatusFilter === 'PARTIAL' && offer.lp_mapping_status !== 'PARTIAL' && offer.status !== 'DADOS_PARCIAIS') return false;
          if (filters.lpStatusFilter === 'FAILED' && offer.lp_mapping_status !== 'FAILED') return false;
        }

        // 14. Checkout Status Filter
        if (filters.checkoutStatusFilter && filters.checkoutStatusFilter !== 'all') {
          const hasCheckout = Boolean(offer.checkout_url && offer.checkout_url.trim() !== '' && offer.checkout_url.trim() !== offer.landing_page_url?.trim());

          if (filters.checkoutStatusFilter === 'with_checkout' && !hasCheckout) return false;
          if (filters.checkoutStatusFilter === 'without_checkout' && hasCheckout) return false;
          if (filters.checkoutStatusFilter === 'FOUND' && offer.checkout_discovery_status !== 'FOUND') return false;
          if (filters.checkoutStatusFilter === 'NOT_FOUND' && offer.checkout_discovery_status !== 'NOT_FOUND') return false;
          if (filters.checkoutStatusFilter === 'NOT_PROCESSED' && offer.checkout_discovery_status !== 'NOT_PROCESSED') return false;
          if (filters.checkoutStatusFilter === 'SUCCESS' && offer.checkout_mapping_status !== 'SUCCESS') return false;
          if (filters.checkoutStatusFilter === 'PENDING' && offer.checkout_mapping_status !== 'PENDING') return false;
          if (filters.checkoutStatusFilter === 'FAILED' && offer.checkout_mapping_status !== 'FAILED') return false;
        }

        return true;
      })
      .sort((a, b) => {
        const sortBy = filters.sortBy;
        const order = filters.sortOrder === 'asc' ? 1 : -1;

        if (sortBy === 'price') return ((a.price ?? 0) - (b.price ?? 0)) * order;
        if (sortBy === 'active_ads_count') return ((a.active_ads_count ?? 0) - (b.active_ads_count ?? 0)) * order;
        if (sortBy === 'days_running') {
          const daysA = a.days_running ?? deriveDaysRunning(a) ?? 0;
          const daysB = b.days_running ?? deriveDaysRunning(b) ?? 0;
          return (daysA - daysB) * order;
        }
        if (sortBy === 'estimated_unique_creatives') return ((a.estimated_unique_creatives ?? 0) - (b.estimated_unique_creatives ?? 0)) * order;
        if (sortBy === 'product_name') return (a.product_name || '').localeCompare(b.product_name || '') * order;

        const dateA = new Date(a.last_imported_at || a.created_at).getTime();
        const dateB = new Date(b.last_imported_at || b.created_at).getTime();
        return (dateA - dateB) * order;
      });
  }, [offers, filters]);

  // Full Scale (>200 Ads) Grouping
  const [isFullScaleExpanded, setIsFullScaleExpanded] = useState(true);
  const [isFullScaleShowAll, setIsFullScaleShowAll] = useState(false);

  const fullScaleOffers = useMemo(() => {
    return filteredOffers
      .filter((o) => (o.active_ads_count ?? 0) > 200)
      .sort((a, b) => (b.active_ads_count ?? 0) - (a.active_ads_count ?? 0));
  }, [filteredOffers]);

  const mainListOffers = useMemo(() => {
    if (filters.quickFilter === 'full_scale') return [];
    if (fullScaleOffers.length > 0 && viewMode === 'cards') {
      const fullScaleIds = new Set(fullScaleOffers.map((o) => o.id));
      return filteredOffers.filter((o) => !fullScaleIds.has(o.id));
    }
    return filteredOffers;
  }, [filteredOffers, fullScaleOffers, filters.quickFilter, viewMode]);

  // Selection handlers
  const handleSelectRow = (id: string, selected: boolean) => {
    setSelectedIds((prev) =>
      selected ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? filteredOffers.map((o) => o.id) : []);
  };

  // Actions
  const handleToggleFavorite = async (offer: Offer) => {
    const nextVal = await dbService.toggleFavorite(offer.id, offer.favorite);
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, favorite: nextVal } : o))
    );
    if (nextVal) {
      toast.success(`"${offer.product_name}" adicionada aos Favoritos.`);
    } else {
      toast.info(`"${offer.product_name}" removida dos Favoritos.`);
    }
  };

  const handleToggleWatchlist = async (offer: Offer) => {
    const nextVal = await dbService.toggleWatchlist(offer.id, offer.watching);
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, watching: nextVal } : o))
    );
    if (nextVal) {
      toast.success(`"${offer.product_name}" adicionada ao acompanhamento.`);
    } else {
      toast.info(`"${offer.product_name}" removida do acompanhamento.`);
    }
  };

  const handleToggleDeepDive = async (offer: Offer) => {
    const nextVal = await dbService.toggleDeepDive(offer.id, offer.in_deep_dive);
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, in_deep_dive: nextVal } : o))
    );
    if (nextVal) {
      toast.success(`"${offer.product_name}" enviada para Deep Dive.`);
    } else {
      toast.info(`"${offer.product_name}" removida do Deep Dive.`);
    }
  };

  const handleSaveEdit = async (updatedData: Partial<Offer>) => {
    if (!editingOffer) return;
    const result = await dbService.updateOffer(editingOffer.id, updatedData);
    if (result) {
      setOffers((prev) => prev.map((o) => (o.id === result.id ? result : o)));
      toast.success('Oferta atualizada com sucesso.');
    }
  };

  const handleDeleteSingle = async () => {
    if (!deletingOffer) return;
    const name = deletingOffer.product_name;
    const id = deletingOffer.id;
    try {
      await dbService.deleteOffer(id);
      setOffers((prev) => prev.filter((o) => o.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      toast.success(`Oferta "${name}" excluída com sucesso.`);
    } catch {
      toast.error('Não foi possível excluir a oferta.');
    } finally {
      setDeletingOffer(null);
    }
  };

  // --------------------------------------------------------------------------
  // BULK ACTIONS (PERSISTENT WITH FEEDBACK)
  // --------------------------------------------------------------------------
  const handleBulkFavorite = async (favorite: boolean) => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    const count = selectedIds.length;
    try {
      await dbService.bulkToggleFavorite(selectedIds, favorite);
      setOffers((prev) =>
        prev.map((o) => (selectedIds.includes(o.id) ? { ...o, favorite } : o))
      );
      if (favorite) {
        toast.success(
          `${count} ${count === 1 ? 'oferta adicionada aos Favoritos.' : 'ofertas adicionadas aos Favoritos.'}`
        );
      } else {
        toast.info(
          `${count} ${count === 1 ? 'oferta removida dos Favoritos.' : 'ofertas removidas dos Favoritos.'}`
        );
      }
    } catch {
      toast.error('Não foi possível atualizar os favoritos.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkWatchlist = async (watching: boolean) => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    const count = selectedIds.length;
    try {
      await dbService.bulkToggleWatchlist(selectedIds, watching);
      setOffers((prev) =>
        prev.map((o) => (selectedIds.includes(o.id) ? { ...o, watching } : o))
      );
      if (watching) {
        toast.success(
          `${count} ${count === 1 ? 'oferta adicionada ao acompanhamento.' : 'ofertas adicionadas ao acompanhamento.'}`
        );
      } else {
        toast.info(
          `${count} ${count === 1 ? 'oferta removida do acompanhamento.' : 'ofertas removidas do acompanhamento.'}`
        );
      }
    } catch {
      toast.error('Não foi possível atualizar o acompanhamento.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkDeepDive = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    const count = selectedIds.length;
    try {
      await dbService.bulkToggleDeepDive(selectedIds, true);
      setOffers((prev) =>
        prev.map((o) => (selectedIds.includes(o.id) ? { ...o, in_deep_dive: true } : o))
      );
      toast.success(
        `${count} ${count === 1 ? 'oferta adicionada ao Deep Dive.' : 'ofertas adicionadas ao Deep Dive.'}`
      );
    } catch {
      toast.error('Não foi possível adicionar ao Deep Dive.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkChangeStatus = async (status: OfferStatus) => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    const count = selectedIds.length;
    const isWatching = status === 'ACOMPANHANDO';
    try {
      await dbService.bulkUpdateStatus(selectedIds, status);
      setOffers((prev) =>
        prev.map((o) =>
          selectedIds.includes(o.id)
            ? {
                ...o,
                status,
                ...(isWatching ? { watching: true } : {}),
              }
            : o
        )
      );
      toast.success(
        `Status de ${count} ${count === 1 ? 'oferta alterado' : 'ofertas alterado'} para ${status}.`
      );
    } catch {
      toast.error('Não foi possível alterar o status das ofertas.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    const count = selectedIds.length;
    try {
      await dbService.bulkUpdateStatus(selectedIds, 'ARQUIVADA');
      setOffers((prev) =>
        prev.map((o) => (selectedIds.includes(o.id) ? { ...o, status: 'ARQUIVADA' } : o))
      );
      toast.success(
        `${count} ${count === 1 ? 'oferta arquivada com sucesso.' : 'ofertas arquivadas com sucesso.'}`
      );
      setSelectedIds([]);
    } catch {
      toast.error('Não foi possível arquivar as ofertas.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleScrapeOffer = async (offer: Offer) => {
    toast.info(`Iniciando raspagem e enriquecimento de "${offer.product_name}"...`);
    try {
      const res = await fetch('/api/scraping/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Raspagem concluída (${data.report?.status})!`);
        if (data.offer) {
          setOffers((prev) => prev.map((o) => (o.id === offer.id ? data.offer : o)));
        }
      } else {
        toast.error(data.error || 'Falha ao executar raspagem.');
      }
    } catch {
      toast.error('Erro de conexão ao executar raspagem.');
    }
  };

  const handleViewReconciliation = (offer: Offer) => {
    setReconciliationOfferId(offer.id);
  };

  const handleBulkScrape = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    try {
      const res = await fetch('/api/scraping/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerIds: selectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Lote de raspagem iniciado com ${selectedIds.length} ofertas!`);
        setSelectedIds([]);
      } else {
        toast.error(data.error || 'Falha ao iniciar lote de raspagem.');
      }
    } catch {
      toast.error('Erro ao iniciar lote de raspagem.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const count = selectedIds.length;
    try {
      await dbService.deleteOffersBulk(selectedIds);
      setOffers((prev) => prev.filter((o) => !selectedIds.includes(o.id)));
      toast.success(
        `${count} ${count === 1 ? 'oferta excluída permanentemente.' : 'ofertas excluídas permanentemente.'}`
      );
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    } catch {
      toast.error('Não foi possível excluir as ofertas do banco.');
    }
  };

  return (
    <AppShell>
      <div className={cn('transition-all duration-200', selectedIds.length > 0 && 'pb-28')}>
        <PageHeader
          title="Ofertas Mineradas"
          description="Central de inteligência visual de ofertas digitais low-ticket. Explore anúncios ativos, dias de teste, criativos e links operacionais."
          actions={
            <ImportDropdown onOpenJsonImport={() => setIsJsonModalOpen(true)} />
          }
        />

        {/* Filters Bar with Cards/Table Toggle */}
        <OfferFilters
          filters={filters}
          onChange={setFilters}
          allOffers={offers}
          availableNiches={availableNiches}
          availableProductTypes={availableProductTypes}
          totalCount={offers.length}
          filteredCount={filteredOffers.length}
          visibleColumns={visibleColumns}
          onToggleColumn={(col) =>
            setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }))
          }
          viewMode={viewMode}
          onChangeViewMode={handleViewModeChange}
        />

        {/* Loading Skeleton */}
        {isLoading ? (
          <OfferCardSkeleton density={density} count={8} />
        ) : offers.length === 0 ? (
          <EmptyState />
        ) : filteredOffers.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
            <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">
              Nenhuma oferta encontrada para os filtros selecionados.
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Tente ajustar seus critérios de busca ou limpe os filtros para visualizar todas as ofertas.
            </p>
            <button
              onClick={() =>
                setFilters({
                  search: '',
                  niche: 'all',
                  subniche: 'all',
                  productType: 'all',
                  faceless: 'all',
                  status: 'all',
                  decision: 'all',
                  trend: 'all',
                  adFormat: 'all',
                  onlyFavorites: false,
                  onlyWatching: false,
                  onlyDeepDive: false,
                  quickFilter: 'all',
                  sortBy: 'created_at',
                  sortOrder: 'desc',
                })
              }
              className="mt-4 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-blue-400 border border-slate-700 transition"
            >
              Limpar Filtros
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-6">
            {/* Top Section: 🔥 FULL ESCALA (>200 Ads) */}
            {fullScaleOffers.length > 0 && filters.quickFilter !== 'full_scale' && (
              <div className="relative rounded-2xl p-[1.5px] transition-all duration-300 text-left">
                {/* Outer Flame Blur Halo */}
                <div className="absolute -inset-[1.5px] rounded-2xl blur-xs pointer-events-none opacity-50 shadow-[0_0_14px_rgba(244,63,94,0.25)] animate-fire-flicker-full overflow-hidden">
                  <div className="absolute inset-[-100%] m-auto aspect-square bg-fire-gradient-full animate-fire-spin-fast" />
                </div>
                {/* Fiery Border Mask */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none animate-fire-flicker-full">
                  <div className="absolute inset-[-100%] m-auto aspect-square bg-fire-gradient-full animate-fire-spin-fast" />
                </div>
                {/* Inner Banner Container */}
                <div className="relative z-10 p-5 sm:p-6 rounded-[14px] bg-slate-950/95 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/45 via-slate-900 to-slate-950 border border-rose-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-900/30">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-base">
                          🔥🔥
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                          FULL ESCALA
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                            {fullScaleOffers.length} {fullScaleOffers.length === 1 ? 'oferta' : 'ofertas'}
                          </span>
                        </h2>
                      </div>
                      <p className="text-xs text-rose-300/80 mt-1 font-medium">
                        Ofertas com mais de 200 anúncios ativos observados.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsFullScaleExpanded(!isFullScaleExpanded)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-xs font-semibold text-rose-300 border border-rose-800/50 transition self-start sm:self-auto"
                    >
                      <span>{isFullScaleExpanded ? 'Recolher Seção' : 'Expandir Seção'}</span>
                      <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isFullScaleExpanded && 'rotate-180')} />
                    </button>
                  </div>

                  {isFullScaleExpanded && (
                    <div
                      className={cn(
                        'grid gap-4 sm:gap-5',
                        density === 'compact'
                          ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
                          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
                      )}
                    >
                      {(isFullScaleShowAll ? fullScaleOffers : fullScaleOffers.slice(0, 12)).map((offer) => (
                        <OfferCard
                          key={offer.id}
                          offer={offer}
                          selected={selectedIds.includes(offer.id)}
                          density={density}
                          onSelect={(selected) => handleSelectRow(offer.id, selected)}
                          onToggleFavorite={handleToggleFavorite}
                          onToggleWatchlist={handleToggleWatchlist}
                          onToggleDeepDive={handleToggleDeepDive}
                          onEditOffer={(o) => setEditingOffer(o)}
                          onDeleteOffer={(o) => setDeletingOffer(o)}
                        />
                      ))}
                    </div>
                  )}

                  {isFullScaleExpanded && fullScaleOffers.length > 12 && !isFullScaleShowAll && (
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setIsFullScaleShowAll(true)}
                        className="px-4 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 text-xs font-bold text-rose-300 border border-rose-800/50 transition shadow"
                      >
                        VER TODAS AS {fullScaleOffers.length} OFERTAS FULL ESCALA →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Offers Grid */}
            <OffersGrid
              offers={mainListOffers}
              selectedIds={selectedIds}
              density={density}
              onChangeDensity={handleDensityChange}
              onSelectRow={handleSelectRow}
              onSelectAll={handleSelectAll}
              onToggleFavorite={handleToggleFavorite}
              onToggleWatchlist={handleToggleWatchlist}
              onToggleDeepDive={handleToggleDeepDive}
              onEditOffer={(o) => setEditingOffer(o)}
              onDeleteOffer={(o) => setDeletingOffer(o)}
              onScrapeOffer={handleScrapeOffer}
              onViewReconciliation={handleViewReconciliation}
            />
          </div>
        ) : (
          <DataTable
            offers={filteredOffers}
            selectedIds={selectedIds}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            onToggleFavorite={handleToggleFavorite}
            onToggleWatchlist={handleToggleWatchlist}
            onToggleDeepDive={handleToggleDeepDive}
            onEditOffer={(o) => setEditingOffer(o)}
            onDeleteOffer={(o) => setDeletingOffer(o)}
            onScrapeOffer={handleScrapeOffer}
            onViewReconciliation={handleViewReconciliation}
          />
        )}

        {/* Compact & Functional Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedIds.length}
          selectedIds={selectedIds}
          isAllFavorites={isAllFavorites}
          isAllWatching={isAllWatching}
          isProcessing={isProcessingBulk}
          onClearSelection={() => setSelectedIds([])}
          onBulkFavorite={handleBulkFavorite}
          onBulkWatchlist={handleBulkWatchlist}
          onBulkDeepDive={handleBulkDeepDive}
          onBulkScrape={handleBulkScrape}
          onBulkChangeStatus={handleBulkChangeStatus}
          onBulkArchive={handleBulkArchive}
          onBulkDelete={() => setIsBulkDeleteOpen(true)}
        />

        {/* Edit Modal */}
        <OfferEditModal
          isOpen={!!editingOffer}
          offer={editingOffer}
          onClose={() => setEditingOffer(null)}
          onSave={handleSaveEdit}
        />

        {/* Single Delete Confirm Modal */}
        <ConfirmModal
          isOpen={!!deletingOffer}
          onClose={() => setDeletingOffer(null)}
          onConfirm={handleDeleteSingle}
          title="Excluir Oferta"
          description={`Tem certeza que deseja excluir "${deletingOffer?.product_name}"? Esta ação removerá a oferta e todo seu histórico de snapshots permanentemente.`}
          confirmText="Sim, Excluir"
          variant="danger"
        />

        {/* Dedicated Bulk Delete Modal with Safety Protections */}
        <BulkDeleteModal
          isOpen={isBulkDeleteOpen}
          selectedOffers={selectedOffersList}
          onClose={() => setIsBulkDeleteOpen(false)}
          onConfirm={handleBulkDeleteConfirm}
        />

        {/* JSON Import Modal */}
        <JsonImportModal
          isOpen={isJsonModalOpen}
          onClose={() => setIsJsonModalOpen(false)}
          onSuccess={loadOffers}
        />

        {/* Reconciliation Drawer */}
        <ReconciliationDrawer
          offerId={reconciliationOfferId}
          isOpen={Boolean(reconciliationOfferId)}
          onClose={() => setReconciliationOfferId(null)}
          onScrapeAgain={async (id) => {
            const off = offers.find((o) => o.id === id);
            if (off) await handleScrapeOffer(off);
          }}
        />
      </div>
    </AppShell>
  );
}

export default function OffersPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </AppShell>
      }
    >
      <OffersPageContent />
    </Suspense>
  );
}
