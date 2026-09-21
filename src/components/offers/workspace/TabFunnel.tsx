'use client';

import React from 'react';
import { Offer } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  Layers,
  Globe,
  CreditCard,
  PlusCircle,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  ArrowDown,
  ArrowRight,
  Share2,
} from 'lucide-react';

interface TabFunnelProps {
  offer: Offer;
}

export function TabFunnel({ offer }: TabFunnelProps) {
  const frontPrice = offer.price || (offer as any).extra_data?.latest_lp_analysis?.commerce?.currentPrice || 0;
  const bumps = offer.order_bumps || [];
  const upsells = offer.upsells || [];
  const extractedCommerce = (offer as any).extra_data?.latest_lp_analysis?.commerce;
  const effectiveCheckoutUrl = offer.checkout_url || extractedCommerce?.checkoutUrls?.[0] || null;
  const checkoutPlatform = extractedCommerce?.checkoutPlatform
    ? `Checkout ${extractedCommerce.checkoutPlatform.toUpperCase()}`
    : 'Conversão Principal';

  // Build real observed steps
  const dbSteps = offer.funnel_steps || [];

  const steps = dbSteps.length > 0
    ? dbSteps.map((s, idx) => ({
        step: idx + 1,
        title: s.title,
        badge: s.provider || (s.step_type === 'meta_ad' ? `${offer.active_ads_count ?? 0} Ads` : s.step_type),
        type: s.step_type,
        icon: s.step_type === 'meta_ad' ? Layers : s.step_type === 'landing_page' ? Globe : CreditCard,
        price: s.price,
        desc: s.notes || (s.step_type === 'landing_page' ? offer.headline || 'Página de Vendas' : 'Etapa do funil'),
        link: s.url,
        linkText: s.url ? 'Abrir Link' : null,
      }))
    : [
        {
          step: 1,
          title: 'Tráfego Pago (Meta Ads)',
          badge: `${offer.active_ads_count ?? 0} Anúncios Ativos`,
          type: 'Ad Traffic',
          icon: Layers,
          price: null,
          desc: 'Anúncios no feed e stories do Instagram/Facebook atraindo público qualificado.',
          link: offer.meta_ads_url,
          linkText: 'Ver na Biblioteca',
        },
        {
          step: 2,
          title: 'Página de Vendas (Landing Page)',
          badge: offer.landing_page_domain || 'LP Mapeada',
          type: 'Presell / Sales Page',
          icon: Globe,
          price: null,
          desc: `Apresenta a oferta, promessa "${offer.promise || (offer as any).extra_data?.latest_lp_analysis?.heroXRay?.headline || 'Transformação'}" e CTA de compra.`,
          link: offer.landing_page_url,
          linkText: 'Abrir Página de Vendas',
        },
        {
          step: 3,
          title: `Checkout: ${offer.product_name || 'Produto Principal'}`,
          badge: checkoutPlatform,
          type: 'Order Entry',
          icon: CreditCard,
          price: frontPrice,
          desc: 'Formulário de pagamento de alta conversão.',
          link: effectiveCheckoutUrl,
          linkText: effectiveCheckoutUrl ? 'Link do Checkout Identificado' : null,
        },
        {
          step: 4,
          title: `Order Bump: ${bumps.length > 0 ? bumps[0].name : 'Não verificado no checkout'}`,
          badge: bumps.length > 0 ? '+ Adicionado ao carrinho' : 'Não verificado no checkout',
          type: 'Order Bump',
          icon: PlusCircle,
          price: bumps.length > 0 ? bumps[0].price : null,
          desc: bumps.length > 0 ? (bumps[0].description || 'Item de impulso no checkout.') : 'Etapa de checkout não verificada.',
          link: null,
        },
        {
          step: 5,
          title: `Upsell: ${upsells.length > 0 ? upsells[0].name : 'Não verificado no pós-compra'}`,
          badge: upsells.length > 0 ? '+ Pós-compra' : 'Não verificado no pós-compra',
          type: 'Upsell',
          icon: TrendingUp,
          price: upsells.length > 0 ? upsells[0].price : null,
          desc: upsells.length > 0 ? (upsells[0].description || 'Oferta pós-compra.') : 'Etapa de pós-compra não verificada.',
          link: upsells.length > 0 ? upsells[0].url : null,
        },
      ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-blue-400" />
            Mapa do Funil de Conversão
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Fluxo completo percorrido pelo lead desde o criativo na Meta até o pós-venda
          </p>
        </div>
      </div>

      {/* Sequential Funnel Flow */}
      <div className="space-y-3">
        {steps.map((st, idx) => {
          const Icon = st.icon;
          const isLast = idx === steps.length - 1;

          return (
            <div key={st.step} className="relative">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-sm text-slate-200 shrink-0">
                    <Icon className="w-4 h-4 text-blue-400" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Passo {st.step}
                      </span>
                      <h4 className="text-xs font-bold text-white">{st.title}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {st.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{st.desc}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                  {st.price !== null && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Preço</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(st.price)}
                      </span>
                    </div>
                  )}

                  {st.link && (
                    <a
                      href={st.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {st.linkText || 'Abrir'}
                    </a>
                  )}
                </div>
              </div>

              {!isLast && (
                <div className="flex justify-center my-1.5">
                  <ArrowDown className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
