'use client';

import React, { useState, useEffect } from 'react';
import { dbService } from '@/lib/supabase/db';
import { Offer, OfferFiltersState } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/offers/DataTable';
import { OfferEditModal } from '@/components/offers/OfferEditModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Star } from 'lucide-react';

export default function FavoritesPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deletingOffer, setDeletingOffer] = useState<Offer | null>(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getOffers({ onlyFavorites: true });
      setOffers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (offer: Offer) => {
    await dbService.toggleFavorite(offer.id, offer.favorite);
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
  };

  const handleToggleDeepDive = async (offer: Offer) => {
    const nextVal = await dbService.toggleDeepDive(offer.id, offer.in_deep_dive);
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, in_deep_dive: nextVal } : o))
    );
  };

  const handleToggleWatchlist = async (offer: Offer) => {
    const nextVal = await dbService.toggleWatchlist(offer.id, offer.watching);
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, watching: nextVal } : o))
    );
  };

  const handleSaveEdit = async (updatedData: Partial<Offer>) => {
    if (!editingOffer) return;
    const result = await dbService.updateOffer(editingOffer.id, updatedData);
    if (result) {
      setOffers((prev) => prev.map((o) => (o.id === result.id ? result : o)));
    }
  };

  const handleDeleteSingle = async () => {
    if (!deletingOffer) return;
    await dbService.deleteOffer(deletingOffer.id);
    setOffers((prev) => prev.filter((o) => o.id !== deletingOffer.id));
    setDeletingOffer(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Ofertas Favoritas"
        description="Acesse rapidamente os infoprodutos e criativos low-ticket que você marcou com estrela para modelagem ou acompanhamento prioritário."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : offers.length === 0 ? (
        <EmptyState
          title="Nenhuma oferta favoritada ainda."
          description="Clique na estrela ao lado de qualquer oferta na tabela ou na página de detalhes para salvá-la aqui."
          icon={Star}
          actionText="Explorar Banco de Ofertas"
          actionHref="/offers"
        />
      ) : (
        <DataTable
          offers={offers}
          selectedIds={selectedIds}
          onSelectRow={(id, sel) =>
            setSelectedIds((prev) => (sel ? [...prev, id] : prev.filter((x) => x !== id)))
          }
          onSelectAll={(sel) => setSelectedIds(sel ? offers.map((o) => o.id) : [])}
          onToggleFavorite={handleToggleFavorite}
          onToggleWatchlist={handleToggleWatchlist}
          onToggleDeepDive={handleToggleDeepDive}
          onEditOffer={(o) => setEditingOffer(o)}
          onDeleteOffer={(o) => setDeletingOffer(o)}
        />
      )}

      {/* Modals */}
      <OfferEditModal
        isOpen={!!editingOffer}
        offer={editingOffer}
        onClose={() => setEditingOffer(null)}
        onSave={handleSaveEdit}
      />

      <ConfirmModal
        isOpen={!!deletingOffer}
        onClose={() => setDeletingOffer(null)}
        onConfirm={handleDeleteSingle}
        title="Excluir Oferta"
        description={`Tem certeza que deseja excluir "${deletingOffer?.product_name}"?`}
        confirmText="Sim, Excluir"
        variant="danger"
      />
    </AppShell>
  );
}
