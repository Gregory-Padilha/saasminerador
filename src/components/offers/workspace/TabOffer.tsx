'use client';

import React, { useState, useEffect } from 'react';
import { Offer, OfferDeliverable, OfferBonus, OfferOrderBump, OfferUpsell } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { formatCurrency, cn } from '@/lib/utils';
import {
  getCommercialOfferSummary,
  detectDeliverableFormat,
  CommercialOfferSummary,
} from '@/lib/offer/commercial-mapper';
import { notifyOfferUpdated } from '@/lib/events/offer-events';
import {
  Package,
  Gift,
  Plus,
  Trash2,
  TrendingUp,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Layers,
  Sparkles,
  ExternalLink,
  Globe,
  Check,
  AlertTriangle,
  HelpCircle,
  FileText,
  CreditCard,
  Tag,
  Info,
  X,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

interface TabOfferProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

export function TabOffer({ offer, onOfferUpdated }: TabOfferProps) {
  const [summary, setSummary] = useState<CommercialOfferSummary>(() =>
    getCommercialOfferSummary(offer)
  );

  // Deliverables, Bonuses, Bumps, Upsells local state
  const [deliverables, setDeliverables] = useState<OfferDeliverable[]>(offer.deliverables || []);
  const [bonuses, setBonuses] = useState<OfferBonus[]>(offer.bonuses || []);
  const [orderBumps, setOrderBumps] = useState<OfferOrderBump[]>(offer.order_bumps || []);
  const [upsells, setUpsells] = useState<OfferUpsell[]>(offer.upsells || []);

  // Modals state
  const [isAddDeliverableOpen, setIsAddDeliverableOpen] = useState(false);
  const [isAddBonusOpen, setIsAddBonusOpen] = useState(false);
  const [isAddBumpOpen, setIsAddBumpOpen] = useState(false);
  const [isAddUpsellOpen, setIsAddUpsellOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [evidenceModalData, setEvidenceModalData] = useState<{
    title: string;
    source: string;
    text: string;
    section?: string;
  } | null>(null);

  const diagnosticData = offer.extra_data?.checkout_diagnostic || null;
  // Form states inside modals
  const [newDeliverable, setNewDeliverable] = useState({ title: '', description: '', format: 'PDF / Ebook' });
  const [newBonus, setNewBonus] = useState({ title: '', claimedValue: '', description: '' });
  const [newOrderBump, setNewOrderBump] = useState({ name: '', price: '14.90', description: '' });
  const [newUpsell, setNewUpsell] = useState({ name: '', price: '47.00', description: '' });

  const [isMappingCheckout, setIsMappingCheckout] = useState(false);

  const handleRunCheckoutIntelligence = async () => {
    setIsMappingCheckout(true);
    try {
      const res = await fetch(`/api/offers/${offer.id}/checkout`, { method: 'POST' });
      const data = await res.json();
      const updatedOffer = await dbService.getOfferById(offer.id);
      if (updatedOffer) {
        onOfferUpdated(updatedOffer);
        notifyOfferUpdated(offer.id, 'checkout_mapping');
      }
    } catch (err) {
      console.error('Error running Checkout Intelligence:', err);
    } finally {
      setIsMappingCheckout(false);
    }
  };

  useEffect(() => {
    setSummary(getCommercialOfferSummary(offer));
    setDeliverables(offer.deliverables || []);
    setBonuses(offer.bonuses || []);
    setOrderBumps(offer.order_bumps || []);
    setUpsells(offer.upsells || []);
  }, [offer]);

  // Handlers for Add/Delete
  const handleSaveDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeliverable.title.trim()) return;

    const newItem: OfferDeliverable = {
      id: `del_${Date.now()}`,
      offer_id: offer.id,
      title: newDeliverable.title.trim(),
      description: newDeliverable.description.trim() || undefined,
      source: 'MANUAL',
      order_index: deliverables.length,
    };

    const updated = [...deliverables, newItem];
    setDeliverables(updated);
    await dbService.updateDeliverables(offer.id, updated);
    const updatedOffer = { ...offer, deliverables: updated };
    onOfferUpdated(updatedOffer);
    setIsAddDeliverableOpen(false);
    setNewDeliverable({ title: '', description: '', format: 'PDF / Ebook' });
  };

  const handleDeleteDeliverable = async (id: string) => {
    const updated = deliverables.filter((d) => d.id !== id);
    setDeliverables(updated);
    await dbService.updateDeliverables(offer.id, updated);
    onOfferUpdated({ ...offer, deliverables: updated });
  };

  const handleSaveBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBonus.title.trim()) return;

    const claimedVal = newBonus.claimedValue ? parseFloat(newBonus.claimedValue.replace(',', '.')) : undefined;

    const newItem: OfferBonus = {
      id: `bon_${Date.now()}`,
      offer_id: offer.id,
      title: newBonus.title.trim(),
      description: newBonus.description.trim() || undefined,
      claimed_value: claimedVal,
      source: 'MANUAL',
      order_index: bonuses.length,
    };

    const updated = [...bonuses, newItem];
    setBonuses(updated);
    await dbService.updateBonuses(offer.id, updated);
    const updatedOffer = { ...offer, bonuses: updated };
    onOfferUpdated(updatedOffer);
    setIsAddBonusOpen(false);
    setNewBonus({ title: '', claimedValue: '', description: '' });
  };

  const handleDeleteBonus = async (id: string) => {
    const updated = bonuses.filter((b) => b.id !== id);
    setBonuses(updated);
    await dbService.updateBonuses(offer.id, updated);
    onOfferUpdated({ ...offer, bonuses: updated });
  };

  const handleSaveOrderBump = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderBump.name.trim()) return;

    const priceVal = parseFloat(newOrderBump.price.replace(',', '.')) || 0;

    const newItem: OfferOrderBump = {
      id: `ob_${Date.now()}`,
      offer_id: offer.id,
      name: newOrderBump.name.trim(),
      price: priceVal,
      description: newOrderBump.description.trim() || undefined,
    };

    const updated = [...orderBumps, newItem];
    setOrderBumps(updated);
    await dbService.updateOrderBumps(offer.id, updated);

    const extra = offer.extra_data || {};
    const updatedExtra = { ...extra, checkout_checked: true };
    const updatedOffer = { ...offer, order_bumps: updated, extra_data: updatedExtra };
    await dbService.updateOffer(offer.id, { extra_data: updatedExtra });

    onOfferUpdated(updatedOffer);
    setIsAddBumpOpen(false);
    setNewOrderBump({ name: '', price: '14.90', description: '' });
  };

  const handleDeleteOrderBump = async (id: string) => {
    const updated = orderBumps.filter((ob) => ob.id !== id);
    setOrderBumps(updated);
    await dbService.updateOrderBumps(offer.id, updated);
    onOfferUpdated({ ...offer, order_bumps: updated });
  };

  const handleSaveUpsell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpsell.name.trim()) return;

    const priceVal = parseFloat(newUpsell.price.replace(',', '.')) || 0;

    const newItem: OfferUpsell = {
      id: `up_${Date.now()}`,
      offer_id: offer.id,
      name: newUpsell.name.trim(),
      price: priceVal,
      description: newUpsell.description.trim() || undefined,
    };

    const updated = [...upsells, newItem];
    setUpsells(updated);
    await dbService.updateUpsells(offer.id, updated);

    const extra = offer.extra_data || {};
    const updatedExtra = { ...extra, post_purchase_checked: true };
    const updatedOffer = { ...offer, upsells: updated, extra_data: updatedExtra };
    await dbService.updateOffer(offer.id, { extra_data: updatedExtra });

    onOfferUpdated(updatedOffer);
    setIsAddUpsellOpen(false);
    setNewUpsell({ name: '', price: '47.00', description: '' });
  };

  const handleDeleteUpsell = async (id: string) => {
    const updated = upsells.filter((u) => u.id !== id);
    setUpsells(updated);
    await dbService.updateUpsells(offer.id, updated);
    onOfferUpdated({ ...offer, upsells: updated });
  };

  const handleVerifyCheckout = async () => {
    const extra = offer.extra_data || {};
    const updatedExtra = { ...extra, checkout_checked: true };
    const updatedOffer = { ...offer, extra_data: updatedExtra };
    await dbService.updateOffer(offer.id, { extra_data: updatedExtra });
    onOfferUpdated(updatedOffer);
  };

  const handleVerifyPostPurchase = async () => {
    const extra = offer.extra_data || {};
    const updatedExtra = { ...extra, post_purchase_checked: true };
    const updatedOffer = { ...offer, extra_data: updatedExtra };
    await dbService.updateOffer(offer.id, { extra_data: updatedExtra });
    onOfferUpdated(updatedOffer);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ================================================================== */}
      {/* 1. HEADER & RESUMO COMERCIAL (COMMERCIAL OVERVIEW) */}
      {/* ================================================================== */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Mapa Comercial da Oferta
              </span>
              {summary.entryProduct.productType && (
                <span className="text-[11px] font-semibold text-slate-400">
                  • {summary.entryProduct.productType}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              {summary.entryProduct.name}
            </h2>
          </div>

          {/* Direct External Links */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {offer.landing_page_url && (
              <a
                href={offer.landing_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-750 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Abrir Landing Page</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            {summary.entryProduct.checkoutUrl && (
              <a
                href={summary.entryProduct.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Abrir Checkout</span>
                <ExternalLink className="w-3 h-3 text-blue-200" />
              </a>
            )}
          </div>
        </div>

        {/* Commercial Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Front-End Price */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
              <span>{summary.frontendPricing.count > 1 ? 'Preços Front' : 'Preço Front'}</span>
              {summary.frontendPricing.count > 1 && (
                <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {summary.frontendPricing.count} opções
                </span>
              )}
            </span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono block truncate">
              {summary.frontendPricing.count > 1 && summary.frontendPricing.min && summary.frontendPricing.max && summary.frontendPricing.min < summary.frontendPricing.max
                ? `${formatCurrency(summary.frontendPricing.min)} – ${formatCurrency(summary.frontendPricing.max)}`
                : summary.entryProduct.currentPrice ? formatCurrency(summary.entryProduct.currentPrice) : '—'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {summary.frontendPricing.count > 1 && summary.frontendPricing.average
                ? `Média: ${formatCurrency(summary.frontendPricing.average)}`
                : 'Produto de entrada'}
            </span>
          </div>

          {/* Guarantee */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Garantia
            </span>
            <span className="text-base font-extrabold text-white block">
              {summary.entryProduct.guaranteeDays ? `${summary.entryProduct.guaranteeDays} dias` : 'Não informada'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {summary.entryProduct.guaranteeType}
            </span>
          </div>

          {/* Checkout Provider */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Checkout
            </span>
            <span className="text-base font-extrabold text-blue-400 block truncate">
              {summary.entryProduct.checkoutPlatform || 'Não detectado'}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Platform Provider
            </span>
          </div>

          {/* Entregáveis Count */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Entregáveis
            </span>
            <span className="text-xl font-extrabold text-white font-mono block">
              {summary.deliverables.length}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {summary.deliverables.length === 1 ? 'item incluso' : 'itens inclusos'}
            </span>
          </div>

          {/* Bônus Count */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Bônus
            </span>
            <span className="text-xl font-extrabold text-amber-400 font-mono block">
              {summary.bonuses.length}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {summary.bonuses.length === 0 ? 'na comunicação' : 'prometidos'}
            </span>
          </div>

          {/* Ticket Observado */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border border-emerald-500/30 space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Ticket Observado
            </span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono block">
              {summary.observedTicket ? formatCurrency(summary.observedTicket) : '—'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              Confirmado até o momento
            </span>
          </div>
        </div>

        {/* Conflicts Alert Notice (If XLSX vs LP prices diverge) */}
        {summary.conflicts.map((conf, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-amber-300">{conf.title}</h4>
              <p className="text-slate-300">{conf.description}</p>
              <div className="flex items-center gap-4 text-[11px] font-mono pt-1 text-slate-200">
                <span>
                  {conf.sourceA.name}: <strong>{conf.sourceA.value}</strong>
                </span>
                <span>•</span>
                <span>
                  {conf.sourceB.name}: <strong>{conf.sourceB.value}</strong>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================== */}
      {/* 2. SOURCES COVERAGE & INVESTIGATION QUALITY */}
      {/* ================================================================== */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Fontes Verificadas & Cobertura da Investigação
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {Object.values(summary.sourcesCoverage).filter(Boolean).length} de 5 fontes analisadas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {/* Meta Ads */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="font-medium text-slate-300">Meta Ads</span>
            {summary.sourcesCoverage.metaAds ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
                ✓ Verificado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">
                — Pendente
              </span>
            )}
          </div>

          {/* Landing Page */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="font-medium text-slate-300">Landing Page</span>
            {summary.sourcesCoverage.landingPage ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
                ✓ Mapeada
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">
                — Não mapeada
              </span>
            )}
          </div>

          {/* Checkout */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="font-medium text-slate-300">Checkout</span>
            {summary.sourcesCoverage.checkout ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
                ✓ Verificado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px]">
                — Não verificado
              </span>
            )}
          </div>

          {/* Pós-Compra */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="font-medium text-slate-300">Pós-Compra</span>
            {summary.sourcesCoverage.postPurchase ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
                ✓ Verificado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px]">
                — Não verificado
              </span>
            )}
          </div>

          {/* Histórico */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="font-medium text-slate-300">Histórico</span>
            {summary.sourcesCoverage.history ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
                ✓ Registrado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">
                — 1 snapshot
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 2.5 OPÇÕES DE FRONT-END (FRONT-END PRICING CARDS) */}
      {/* ================================================================== */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>OPÇÕES DE FRONT-END</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {summary.frontendPricing.count} {summary.frontendPricing.count === 1 ? 'opção observada' : 'opções observadas'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Todas as opções comerciais e pacotes de entrada identificados na Landing Page.
              </p>
            </div>
          </div>

          {summary.frontendPricing.count > 1 && summary.frontendPricing.average && (
            <div className="flex items-center gap-3 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800 self-start sm:self-auto">
              <span className="text-slate-400">Menor: <strong className="text-emerald-400">{formatCurrency(summary.frontendPricing.min)}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Maior: <strong className="text-emerald-400">{formatCurrency(summary.frontendPricing.max)}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Média: <strong className="text-blue-400">{formatCurrency(summary.frontendPricing.average)}</strong></span>
            </div>
          )}
        </div>

        {summary.frontendOptions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.frontendOptions.map((opt, idx) => (
              <div
                key={opt.id || idx}
                className={cn(
                  'relative flex flex-col justify-between p-5 rounded-2xl border transition-all',
                  opt.is_featured
                    ? 'bg-gradient-to-b from-blue-950/40 to-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                )}
              >
                {/* Badge if Featured */}
                {opt.is_featured && (
                  <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Recomendado / Destaque</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Opção {opt.position_index || idx + 1}
                      </span>
                      <h4 className="text-base font-extrabold text-white">
                        {opt.name || `Plano ${idx + 1}`}
                      </h4>
                    </div>
                  </div>

                  {/* Pricing Display */}
                  <div className="space-y-0.5">
                    {opt.original_price && opt.original_price > opt.current_price && (
                      <span className="text-xs text-slate-500 line-through font-mono block">
                        De {formatCurrency(opt.original_price)}
                      </span>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        {formatCurrency(opt.current_price)}
                      </span>
                      {opt.billing_type === 'recurring' && (
                        <span className="text-xs text-slate-400">/{opt.billing_period || 'mês'}</span>
                      )}
                    </div>
                    {opt.installments && opt.installment_value && (
                      <span className="text-xs font-semibold text-slate-300 block">
                        ou {opt.installments}x de {formatCurrency(opt.installment_value)}
                      </span>
                    )}
                  </div>

                  {/* Description / Content sample */}
                  {opt.description && (
                    <p className="text-xs text-slate-400 line-clamp-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                      {opt.description}
                    </p>
                  )}
                </div>

                {/* Footer CTA & URL */}
                <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-2">
                  {opt.cta_text && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">CTA: "{opt.cta_text}"</span>
                    </div>
                  )}

                  {opt.cta_url && (
                    <a
                      href={opt.cta_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition truncate"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">Checkout / Link da Opção</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 space-y-2">
            <Tag className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              Nenhuma opção de front-end detalhada extraída ainda
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Ao mapear a Landing Page, o Offer Miner analisará automaticamente todos os cards de ofertas e planos comerciais.
            </p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* 3. ESTEIRA COMERCIAL VISUAL (VISUAL MONETIZATION PIPELINE) */}
      {/* ================================================================== */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Esteira Comercial Observada
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Pipeline de Monetização
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          {/* 1. FRONT-END */}
          <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/30 space-y-2 relative">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Front-End
            </span>
            <div className="text-xs font-bold text-white truncate">{summary.entryProduct.name}</div>
            <div className="text-lg font-extrabold text-emerald-400 font-mono">
              {summary.entryProduct.currentPrice ? formatCurrency(summary.entryProduct.currentPrice) : '—'}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Fonte: {summary.entryProduct.source}
            </span>
          </div>

          {/* 2. CHECKOUT */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Checkout
            </span>
            <div className="text-xs font-bold text-white">
              {summary.entryProduct.checkoutPlatform || 'Plataforma não identificada'}
            </div>
            <div className="text-xs font-mono text-slate-300">
              {summary.entryProduct.checkoutUrl ? 'URL Mapeada' : 'Sem URL'}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Status: {summary.checkoutStatus === 'verified' ? 'Verificado' : 'Não verificado'}
            </span>
          </div>

          {/* 3. ORDER BUMPS */}
          <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Order Bumps ({summary.orderBumps.length})
              </span>
            </div>
            <div className="text-xs font-bold text-white">
              {summary.orderBumpsStatus === 'unverified'
                ? 'Não verificado'
                : summary.orderBumpsStatus === 'not_found'
                ? 'Nenhum encontrado'
                : summary.orderBumps.map((ob) => ob.name).join(', ')}
            </div>
            <div className="text-xs font-mono text-purple-400 font-bold">
              {summary.orderBumps.length > 0
                ? `+ ${formatCurrency(summary.orderBumps.reduce((a, b) => a + (b.price || 0), 0))}`
                : summary.orderBumpsStatus === 'unverified'
                ? 'Pendente'
                : 'R$ 0,00'}
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summary.orderBumpsStatus === 'unverified' ? 'Checkout não analisado' : 'Checkout analisado'}
            </span>
          </div>

          {/* 4. UPSELLS */}
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Upsells ({summary.upsells.length})
              </span>
            </div>
            <div className="text-xs font-bold text-white">
              {summary.upsellsStatus === 'unverified'
                ? 'Não verificado'
                : summary.upsellsStatus === 'not_found'
                ? 'Nenhum encontrado'
                : summary.upsells.map((u) => u.name).join(', ')}
            </div>
            <div className="text-xs font-mono text-amber-400 font-bold">
              {summary.upsells.length > 0
                ? `+ ${formatCurrency(summary.upsells.reduce((a, b) => a + (b.price || 0), 0))}`
                : summary.upsellsStatus === 'unverified'
                ? 'Pendente'
                : 'R$ 0,00'}
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summary.upsellsStatus === 'unverified' ? 'Pós-compra não verificado' : 'Pós-compra analisado'}
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 4. PRODUTO PRINCIPAL DE ENTRADA (CARD DETALHADO) */}
      {/* ================================================================== */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Produto de Entrada (Front-End)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Fonte: {summary.entryProduct.source}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-lg font-bold text-white">
              {summary.entryProduct.name}
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {summary.entryProduct.currentPrice ? formatCurrency(summary.entryProduct.currentPrice) : 'Sem preço'}
              </span>

              {summary.entryProduct.originalPrice && (
                <span className="text-sm font-mono text-slate-500 line-through">
                  De {formatCurrency(summary.entryProduct.originalPrice)}
                </span>
              )}

              {summary.entryProduct.discountPercent && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  {summary.entryProduct.discountPercent}% OFF
                </span>
              )}
            </div>

            <div className="pt-2 text-xs text-slate-300 space-y-1.5">
              <div>
                <strong className="text-slate-400 uppercase text-[10px] tracking-wider block">CTA Principal Observado:</strong>
                <span className="font-semibold text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block mt-0.5">
                  "{summary.entryProduct.mainCta}"
                </span>
              </div>

              {summary.entryProduct.guaranteeText && (
                <div>
                  <strong className="text-slate-400 uppercase text-[10px] tracking-wider block">Garantia:</strong>
                  <span className="text-slate-200">{summary.entryProduct.guaranteeText}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <span className="text-slate-400">Tipo de Produto</span>
              <strong className="text-white">{summary.entryProduct.productType}</strong>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <span className="text-slate-400">Formato Observado</span>
              <strong className="text-blue-400">{summary.entryProduct.format}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Plataforma</span>
              <strong className="text-purple-400">{summary.entryProduct.checkoutPlatform || 'N/D'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 5. ENTREGÁVEIS & BÔNUS (2 COLUNAS DE LISTAS REAIS) */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ENTREGÁVEIS (O que o comprador recebe) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                O Que o Comprador Recebe ({deliverables.length})
              </h3>
            </div>

            <button
              onClick={() => setIsAddDeliverableOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-semibold transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Entregável</span>
            </button>
          </div>

          {deliverables.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
              <p>Nenhum entregável identificado ainda.</p>
              <p className="text-[11px] text-slate-500">
                Mapeie a Landing Page para extrair automaticamente ou clique no botão acima para adicionar.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {deliverables.map((del, idx) => (
                <div
                  key={del.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3 text-xs group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/20">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>{del.title || (del as any).name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {detectDeliverableFormat(del.title || (del as any).name || '')}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                          {del.source || 'MANUAL'}
                        </span>
                      </div>
                      {del.description && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {del.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(del as any).evidenceText && (
                      <button
                        onClick={() =>
                          setEvidenceModalData({
                            title: del.title || '',
                            source: del.source || 'LP',
                            text: (del as any).evidenceText,
                            section: (del as any).evidenceSection,
                          })
                        }
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20"
                      >
                        ver evidência
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteDeliverable(del.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Excluir entregável"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BÔNUS PROMETIDOS */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Bônus Prometidos ({bonuses.length})
              </h3>
            </div>

            <button
              onClick={() => setIsAddBonusOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Bônus</span>
            </button>
          </div>

          {bonuses.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
              <p>Nenhum bônus identificado na comunicação atual.</p>
              <p className="text-[11px] text-slate-500">
                Os bônus são identificados na Landing Page mapeada sem somar valores fictícios ao ticket cobrado.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {bonuses.map((bon, idx) => (
                <div
                  key={bon.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3 text-xs group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-500/20">
                      ★
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>{bon.title || (bon as any).name}</span>
                        {bon.claimed_value && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold">
                            Avaliado em {formatCurrency(bon.claimed_value)}
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                          {bon.source || 'MANUAL'}
                        </span>
                      </div>
                      {bon.description && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {bon.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(bon as any).evidenceText && (
                      <button
                        onClick={() =>
                          setEvidenceModalData({
                            title: bon.title || '',
                            source: bon.source || 'LP',
                            text: (bon as any).evidenceText,
                            section: (bon as any).evidenceSection,
                          })
                        }
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20"
                      >
                        ver evidência
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteBonus(bon.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Excluir bônus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* 6. CHECKOUT INTELLIGENCE & ORDER BUMPS */}
      {/* ================================================================== */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Checkout Intelligence
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Elementos comerciais e adicionais observáveis antes da compra.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {diagnosticData && (
              <button
                onClick={() => setIsDiagnosticOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Diagnóstico</span>
              </button>
            )}

            <button
              onClick={handleRunCheckoutIntelligence}
              disabled={isMappingCheckout}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition flex items-center gap-2"
            >
              {isMappingCheckout ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mapeando Checkout...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>MAPEAR CHECKOUT</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3-Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: CHECKOUT */}
          <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Checkout
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  summary.checkoutStatus === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {summary.checkoutStatus === 'verified' ? 'Verificado' : 'Não verificado'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Provedor</span>
                <strong className="text-white text-sm font-semibold block">
                  {summary.entryProduct.checkoutPlatform || 'Não identificado'}
                </strong>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Preço no Checkout</span>
                <span className="text-base font-mono font-extrabold text-emerald-400 block">
                  {summary.entryProduct.currentPrice ? formatCurrency(summary.entryProduct.currentPrice) : '—'}
                </span>
              </div>

              {summary.entryProduct.checkoutUrl && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">URL do Checkout</span>
                  <a
                    href={summary.entryProduct.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline truncate block font-mono text-[11px]"
                  >
                    {summary.entryProduct.checkoutUrl}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: ORDER BUMPS */}
          <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Order Bumps ({orderBumps.length})
                </span>
              </div>
              <button
                onClick={() => setIsAddBumpOpen(true)}
                className="px-2 py-0.5 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 text-[10px] font-semibold transition"
              >
                + Manual
              </button>
            </div>

            {summary.orderBumpsStatus === 'unverified' && orderBumps.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-850 space-y-2">
                <p className="font-semibold text-slate-300">
                  {offer.checkout_url ? 'Checkout pronto para mapeamento' : 'Checkout ainda não descoberto'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {offer.checkout_url
                    ? 'A URL de checkout já foi identificada. Clique em Mapear Checkout para extrair order bumps e meios de pagamento.'
                    : 'Nenhuma URL de checkout descoberta. Clique em Descobrir Checkout para varrer a Landing Page.'}
                </p>
                {offer.checkout_url ? (
                  <button
                    onClick={handleRunCheckoutIntelligence}
                    disabled={isMappingCheckout}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition"
                  >
                    MAPEAR CHECKOUT
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setIsMappingCheckout(true);
                      try {
                        const res = await fetch(`/api/offers/${offer.id}/checkout`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'discover' }),
                        });
                        const data = await res.json();
                        const updated = await dbService.getOfferById(offer.id);
                        if (updated) onOfferUpdated(updated);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsMappingCheckout(false);
                      }
                    }}
                    disabled={isMappingCheckout}
                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold transition"
                  >
                    DESCOBRIR CHECKOUT
                  </button>
                )}
              </div>
            ) : orderBumps.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-850">
                <span className="font-semibold text-slate-300 block">VERIFICADO — NENHUM ENCONTRADO</span>
                <span className="text-[11px] text-slate-500">Nenhum order bump foi identificado no checkout analisado.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {orderBumps.map((ob) => (
                  <div
                    key={ob.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{ob.name}</span>
                        <span className="font-mono text-purple-400 font-bold">
                          + {formatCurrency(ob.price)}
                        </span>
                      </div>
                      {ob.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{ob.description}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteOrderBump(ob.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: RESUMO DO CHECKOUT & POTENCIAL OBSERVADO */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border border-emerald-500/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Resumo do Checkout
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Pré-compra</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Produto Principal (Front)</span>
                <span className="font-mono font-bold text-white">
                  {summary.entryProduct.currentPrice ? formatCurrency(summary.entryProduct.currentPrice) : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Order Bumps Disponíveis ({orderBumps.length})</span>
                <span className="font-mono font-bold text-purple-400">
                  + {formatCurrency(orderBumps.reduce((a, b) => a + (b.price || 0), 0))}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Potencial Observado no Checkout
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono block">
                  {summary.checkoutStatus === 'verified' || orderBumps.length > 0
                    ? formatCurrency((summary.entryProduct.currentPrice || 0) + orderBumps.reduce((a, b) => a + (b.price || 0), 0))
                    : 'Ainda não determinado'}
                </span>
                <span className="text-[10px] text-slate-400 block leading-tight">
                  Considerando o produto principal e todos os adicionais observáveis no checkout.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Discreet Post-Purchase Note */}
        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 pt-2 border-t border-slate-850">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Pós-compra (Upsells/Downsells): Não investigado automaticamente (requer transação real após compra).</span>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 7. MODALS FOR ADDING DELIVERABLE / BONUS / BUMP / UPSELL / EVIDENCE */}
      {/* ================================================================== */}

      {/* MODAL: ADD DELIVERABLE */}
      {isAddDeliverableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                Adicionar Entregável
              </h3>
              <button
                onClick={() => setIsAddDeliverableOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDeliverable} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Título do Entregável *
                </label>
                <input
                  type="text"
                  required
                  value={newDeliverable.title}
                  onChange={(e) => setNewDeliverable({ ...newDeliverable, title: e.target.value })}
                  placeholder="Ex: Atlas de Fichas Práticas em PDF"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Descrição / Formato (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newDeliverable.description}
                  onChange={(e) => setNewDeliverable({ ...newDeliverable, description: e.target.value })}
                  placeholder="Ex: 60 páginas em alta resolução para download imediato"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddDeliverableOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/20"
                >
                  Salvar Entregável
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BONUS */}
      {isAddBonusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400" />
                Adicionar Bônus Prometido
              </h3>
              <button
                onClick={() => setIsAddBonusOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBonus} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Nome do Bônus *
                </label>
                <input
                  type="text"
                  required
                  value={newBonus.title}
                  onChange={(e) => setNewBonus({ ...newBonus, title: e.target.value })}
                  placeholder="Ex: Guia Extra de Fórmulas Práticas"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Valor Anunciado na LP (R$) — Opcional
                </label>
                <input
                  type="text"
                  value={newBonus.claimedValue}
                  onChange={(e) => setNewBonus({ ...newBonus, claimedValue: e.target.value })}
                  placeholder="Ex: 47,00 (Apenas se a copy disser 'Avaliado em R$47')"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newBonus.description}
                  onChange={(e) => setNewBonus({ ...newBonus, description: e.target.value })}
                  placeholder="Detalhes adicionais sobre a oferta do bônus"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBonusOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/20"
                >
                  Salvar Bônus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ORDER BUMP */}
      {isAddBumpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-400" />
                Adicionar Order Bump
              </h3>
              <button
                onClick={() => setIsAddBumpOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOrderBump} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Nome do Bump *
                </label>
                <input
                  type="text"
                  required
                  value={newOrderBump.name}
                  onChange={(e) => setNewOrderBump({ ...newOrderBump, name: e.target.value })}
                  placeholder="Ex: Acesso Vitalício + Atualizações"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Preço do Bump (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={newOrderBump.price}
                  onChange={(e) => setNewOrderBump({ ...newOrderBump, price: e.target.value })}
                  placeholder="Ex: 14.90"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newOrderBump.description}
                  onChange={(e) => setNewOrderBump({ ...newOrderBump, description: e.target.value })}
                  placeholder="Descrição da oferta oferecida no checkout"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBumpOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-500/20"
                >
                  Salvar Bump
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD UPSELL */}
      {isAddUpsellOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Adicionar Upsell
              </h3>
              <button
                onClick={() => setIsAddUpsellOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUpsell} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Nome do Upsell *
                </label>
                <input
                  type="text"
                  required
                  value={newUpsell.name}
                  onChange={(e) => setNewUpsell({ ...newUpsell, name: e.target.value })}
                  placeholder="Ex: Comunidade VIP de Alunos"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Preço (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={newUpsell.price}
                  onChange={(e) => setNewUpsell({ ...newUpsell, price: e.target.value })}
                  placeholder="Ex: 47.00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newUpsell.description}
                  onChange={(e) => setNewUpsell({ ...newUpsell, description: e.target.value })}
                  placeholder="Descrição da oferta pós-compra"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUpsellOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20"
                >
                  Salvar Upsell
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EVIDÊNCIA */}
      {evidenceModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Evidência Observada
              </h3>
              <button
                onClick={() => setEvidenceModalData(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{evidenceModalData.title}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-[10px]">
                    {evidenceModalData.source}
                  </span>
                </div>

                {evidenceModalData.section && (
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Localização: {evidenceModalData.section}
                  </span>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Trecho de Copy Extraído
                </span>
                <p className="text-slate-200 italic leading-relaxed text-xs">
                  "{evidenceModalData.text}"
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setEvidenceModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-750 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIAGNÓSTICO DO CHECKOUT */}
      {isDiagnosticOpen && diagnosticData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-3xl my-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 text-xs text-slate-300">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <h3 className="text-base font-extrabold text-white">
                    Diagnóstico do Checkout (Resolution Report)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400">
                  Rastreamento completo do clique de CTA, navegação, redirects e sinais do DOM.
                </p>
              </div>

              <button
                onClick={() => setIsDiagnosticOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overview Status Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Checkout Confirmed</span>
                <strong className={`text-sm ${diagnosticData.checkoutConfirmed ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {diagnosticData.checkoutConfirmed ? 'Sim (VERIFIED)' : 'Não (FAILED)'}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Provider Detectado</span>
                <strong className="text-sm text-blue-400 font-bold">
                  {diagnosticData.provider || 'null (Nenhum)'}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Navegação CTA</span>
                <strong className="text-sm text-purple-400 font-bold">
                  {diagnosticData.navigationType}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Preço Extraído</span>
                <strong className="text-sm text-emerald-400 font-bold">
                  {diagnosticData.checkoutPrice ? formatCurrency(diagnosticData.checkoutPrice) : 'null'}
                </strong>
              </div>
            </div>

            {/* CTA Execution Info */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-blue-400">
                1. CTA Selecionado & Execução de Clique
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Offer ID:</span>
                  <span className="font-mono text-slate-200">{diagnosticData.offerId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Landing Page URL:</span>
                  <span className="font-mono text-blue-400 truncate block">{diagnosticData.landingPageUrl}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Texto do CTA Selecionado:</span>
                  <strong className="text-amber-300">"{diagnosticData.selectedCta?.text || 'N/A'}"</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">HREF Original do CTA:</span>
                  <span className="font-mono text-slate-300 truncate block">{diagnosticData.selectedCta?.href || 'Sem href (onclick/js)'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Possui OnClick / Target:</span>
                  <span className="font-mono text-slate-300">
                    OnClick: {diagnosticData.selectedCta?.hasOnClick ? 'Sim' : 'Não'} | Target: {diagnosticData.selectedCta?.target || 'self'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Clique Executado:</span>
                  <span className="font-mono text-emerald-400 font-bold">{diagnosticData.clickExecuted ? 'Sim (Playwright)' : 'Não'}</span>
                </div>
              </div>
            </div>

            {/* Redirects & Final URL */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-purple-400">
                2. Redirecionamentos & Destino Final
              </h4>
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">URL Final Pós-Navegação:</span>
                  <span className="font-mono text-emerald-400 font-bold break-all block">{diagnosticData.finalUrl || 'Não resolvida'}</span>
                </div>
                {diagnosticData.pageTitle && (
                  <div>
                    <span className="text-[10px] text-slate-400 block">Título da Página Final:</span>
                    <span className="text-white italic">{diagnosticData.pageTitle}</span>
                  </div>
                )}
                {diagnosticData.redirectChain && diagnosticData.redirectChain.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Cadeia de Redirecionamento ({diagnosticData.redirectChain.length} hops):</span>
                    <ul className="space-y-1 font-mono text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      {diagnosticData.redirectChain.map((url: string, idx: number) => (
                        <li key={idx} className="truncate text-slate-300">
                          <span className="text-purple-400 font-bold mr-1 font-mono">[{idx + 1}]</span> {url}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* DOM Signals Verification */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400">
                3. Sinais de Validação de Checkout (DOM Analysis)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-[10px] text-slate-400 block">Formulário de Comprador</span>
                  <strong className={diagnosticData.domSignals.hasBuyerForm ? 'text-emerald-400' : 'text-slate-500'}>
                    {diagnosticData.domSignals.hasBuyerForm ? '✓ Detectado' : '✗ Ausente'} ({diagnosticData.domSignals.buyerFieldsCount} campos)
                  </strong>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-[10px] text-slate-400 block">Meios de Pagamento</span>
                  <strong className={diagnosticData.domSignals.hasPaymentFields ? 'text-emerald-400' : 'text-slate-500'}>
                    {diagnosticData.domSignals.hasPaymentFields ? '✓ Detectados' : '✗ Ausentes'} ({diagnosticData.domSignals.paymentKeywordsCount} palavras)
                  </strong>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-[10px] text-slate-400 block">Resumo do Pedido</span>
                  <strong className={diagnosticData.domSignals.hasOrderSummary ? 'text-emerald-400' : 'text-slate-500'}>
                    {diagnosticData.domSignals.hasOrderSummary ? '✓ Detectado' : '✗ Ausente'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Order Bumps Candidate Evaluation */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-amber-400">
                4. Avaliação de Candidatos a Order Bump
              </h4>
              <div className="flex items-center gap-6 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Candidatos no DOM:</span>
                  <strong className="text-white text-sm">{diagnosticData.bumpCandidatesCount}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Bumps Validados e Aceitos:</span>
                  <strong className="text-emerald-400 text-sm">{diagnosticData.acceptedBumpsCount}</strong>
                </div>
              </div>
            </div>

            {/* Screenshot Preview */}
            {diagnosticData.screenshotUrl && (
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-blue-400">
                  5. Screenshot do Checkout Confirmado
                </h4>
                <div className="rounded-lg overflow-hidden border border-slate-800 max-h-64 overflow-y-auto">
                  <img
                    src={diagnosticData.screenshotUrl}
                    alt="Checkout Screenshot"
                    className="w-full h-auto object-top"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsDiagnosticOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20"
              >
                Fechar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
