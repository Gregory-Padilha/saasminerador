'use client';

import React, { useState, useEffect } from 'react';
import { Offer, OfferStatus } from '@/types';
import { X, Save, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfferEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: Offer | null;
  onSave: (updated: Partial<Offer>) => Promise<void>;
}

export function OfferEditModal({
  isOpen,
  onClose,
  offer,
  onSave,
}: OfferEditModalProps) {
  const [formData, setFormData] = useState<Partial<Offer>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (offer) {
      setFormData({
        product_name: offer.product_name || '',
        niche: offer.niche || '',
        subniche: offer.subniche || '',
        advertiser: offer.advertiser || '',
        price: offer.price ?? null,
        active_ads_count: offer.active_ads_count ?? null,
        days_running: offer.days_running ?? null,
        oldest_ad_date: offer.oldest_ad_date || '',
        faceless: offer.faceless ?? false,
        landing_page_url: offer.landing_page_url || '',
        meta_ads_url: offer.meta_ads_url || '',
        headline: offer.headline || '',
        ad_format: offer.ad_format || '',
        score: offer.score ?? null,
        status: offer.status || 'VALIDADA',
        notes: offer.notes || '',
      });
    }
  }, [offer]);

  if (!isOpen || !offer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Editar Oferta</h3>
            <p className="text-xs text-slate-400">
              Modifique os parâmetros comerciais e status da oferta.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Row 1: Product Name & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Produto *
              </label>
              <input
                type="text"
                required
                value={formData.product_name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, product_name: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status de Pesquisa
              </label>
              <select
                value={formData.status || 'NOVA'}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as OfferStatus })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="NOVA">NOVA</option>
                <option value="DADOS_PARCIAIS">DADOS PARCIAIS</option>
                <option value="MAPEADA">MAPEADA</option>
                <option value="ANALISADA">ANALISADA</option>
                <option value="ACOMPANHANDO">ACOMPANHANDO</option>
                <option value="ARQUIVADA">ARQUIVADA</option>
              </select>
            </div>
          </div>

          {/* Row 2: Nicho, Subnicho, Anunciante */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nicho
              </label>
              <input
                type="text"
                value={formData.niche || ''}
                onChange={(e) =>
                  setFormData({ ...formData, niche: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Subnicho
              </label>
              <input
                type="text"
                value={formData.subniche || ''}
                onChange={(e) =>
                  setFormData({ ...formData, subniche: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Anunciante (Página)
              </label>
              <input
                type="text"
                value={formData.advertiser || ''}
                onChange={(e) =>
                  setFormData({ ...formData, advertiser: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 3: Preço, Ads Ativos, Dias Rodando, Nota Work */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Preço (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ads Ativos
              </label>
              <input
                type="number"
                value={formData.active_ads_count ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    active_ads_count: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Dias Rodando
              </label>
              <input
                type="number"
                value={formData.days_running ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    days_running: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Criativos Distintos
              </label>
              <input
                type="number"
                min="0"
                value={formData.estimated_unique_creatives ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_unique_creatives: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 4: Faceless & Formato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.faceless ?? false}
                  onChange={(e) =>
                    setFormData({ ...formData, faceless: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-xs font-semibold text-slate-300">
                  Oferta Faceless (Sem Rosto / Especialista)
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Formato do Criativo
              </label>
              <input
                type="text"
                placeholder="Ex: Vídeo UGC, VSL, Carrossel"
                value={formData.ad_format || ''}
                onChange={(e) =>
                  setFormData({ ...formData, ad_format: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 5: URLs */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              URL da Página de Vendas (LP)
            </label>
            <input
              type="url"
              placeholder="https://meusite.com/oferta"
              value={formData.landing_page_url || ''}
              onChange={(e) =>
                setFormData({ ...formData, landing_page_url: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              URL da Meta Ads Library
            </label>
            <input
              type="url"
              placeholder="https://facebook.com/ads/library/?id=..."
              value={formData.meta_ads_url || ''}
              onChange={(e) =>
                setFormData({ ...formData, meta_ads_url: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Row 6: Headline */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Headline / Promessa Principal
            </label>
            <textarea
              rows={2}
              value={formData.headline || ''}
              onChange={(e) =>
                setFormData({ ...formData, headline: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Row 7: Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observações Pessoais / Inteligência
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Anotações sobre esteira de produtos, order bumps, criativos..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
