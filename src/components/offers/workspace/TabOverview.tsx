'use client';

import React, { useState } from 'react';
import { Offer } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Package,
  Layers,
  Sparkles,
  CheckCircle2,
  Check,
  AlertCircle,
  Edit3,
  Save,
  Tag,
  Users,
  EyeOff,
  Globe,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Code2,
  Database,
  X,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface TabOverviewProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

export function TabOverview({ offer, onOfferUpdated }: TabOverviewProps) {
  const [isEditingPromise, setIsEditingPromise] = useState(false);
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [headline, setHeadline] = useState(offer.headline || '');
  const [subheadline, setSubheadline] = useState(offer.subheadline || '');
  const [promise, setPromise] = useState(offer.promise || '');
  const [problem, setProblem] = useState(offer.problem || '');
  const [transformation, setTransformation] = useState(offer.transformation || '');
  const [targetAudience, setTargetAudience] = useState(offer.target_audience || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSavePromise = async () => {
    setIsSaving(true);
    try {
      const updated = await dbService.updateOffer(offer.id, {
        headline,
        subheadline,
        promise,
        problem,
        transformation,
        target_audience: targetAudience,
      });
      if (updated) {
        onOfferUpdated(updated);
        setIsEditingPromise(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Observational validation signals calculation
  const signals = [
    {
      label: `${offer.active_ads_count ?? 0} anúncios ativos simultâneos na Meta`,
      valid: (offer.active_ads_count ?? 0) >= 5,
      detail: (offer.active_ads_count ?? 0) >= 20 ? 'Volume alto de escala' : (offer.active_ads_count ?? 0) >= 5 ? 'Tração validada' : 'Baixo volume',
    },
    {
      label: `${offer.days_running ?? 0} dias rodando continuamente`,
      valid: (offer.days_running ?? 0) >= 10,
      detail: (offer.days_running ?? 0) >= 15 ? 'Longevidade de teste aprovada' : 'Recém-lançada',
    },
    {
      label: `Ticket low-ticket ${formatCurrency(offer.price)} (alvo R$ 10–50)`,
      valid: (offer.price ?? 0) >= 10 && (offer.price ?? 0) <= 50,
      detail: (offer.price ?? 0) >= 20 && (offer.price ?? 0) <= 35 ? 'Faixa ideal R$ 20–35' : 'Dentro do limite',
    },
    {
      label: `Operação sem criador aparente (Faceless)`,
      valid: !!offer.faceless,
      detail: offer.faceless ? 'Fácil de modelar sem autoridade' : 'Requer autoridade/influenciador',
    },
    {
      label: `Landing Page / Página de Vendas encontrada`,
      valid: !!offer.landing_page_url,
      detail: offer.landing_page_domain || 'URL identificada',
    },
    {
      label: `Checkout direto identificado`,
      valid: !!offer.checkout_url,
      detail: offer.checkout_url ? 'Link disponível' : 'Não capturado',
    },
  ];

  const validSignalsCount = signals.filter((s) => s.valid).length;
  const validationPct = Math.round((validSignalsCount / signals.length) * 100);

  // Checklist items
  const checklist = [
    { name: 'Produto Digital', checked: true, note: offer.product_type || 'Digital' },
    { name: 'Preço R$ 10–50', checked: (offer.price ?? 0) >= 10 && (offer.price ?? 0) <= 50, note: formatCurrency(offer.price) },
    { name: '5–50 Anúncios Ativos', checked: (offer.active_ads_count ?? 0) >= 5 && (offer.active_ads_count ?? 0) <= 50, note: `${offer.active_ads_count ?? 0} ads` },
    { name: '10–30 Dias no Ar', checked: (offer.days_running ?? 0) >= 10 && (offer.days_running ?? 0) <= 30, note: `${offer.days_running ?? 0} dias` },
    { name: 'Faceless (Sem Especialista)', checked: !!offer.faceless, note: offer.faceless ? 'Sim' : 'Não' },
    { name: 'Landing Page Mapeada', checked: !!offer.landing_page_url, note: offer.landing_page_domain || 'Sim' },
  ];

  const hasPromiseData = offer.headline || offer.promise || offer.problem || offer.transformation || offer.target_audience;
  const extraDataEntries = offer.extra_data && typeof offer.extra_data === 'object' ? Object.entries(offer.extra_data) : [];

  return (
    <div className="space-y-6">
      {/* 2-Column Grid: Product Spec & Observable Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Info, Origin & Checklist (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* O PRODUTO */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
              <Package className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                O Produto & Estrutura
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-xs">
                <span className="text-slate-400">Tipo de Produto</span>
                <span className="font-semibold text-slate-200">{offer.product_type || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-xs">
                <span className="text-slate-400">Nicho</span>
                <span className="font-semibold text-blue-400">{offer.niche || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-xs">
                <span className="text-slate-400">Subnicho</span>
                <span className="font-semibold text-slate-300">{offer.subniche || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-xs">
                <span className="text-slate-400">Preço Front-end</span>
                <span className="font-bold text-emerald-400 font-mono">{formatCurrency(offer.price)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-xs">
                <span className="text-slate-400">Formato Principal</span>
                <span className="font-semibold text-slate-300">{offer.ad_format || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-xs">
                <span className="text-slate-400">Garantia</span>
                <span className="font-semibold text-slate-300">{offer.guarantee || '7 dias'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-xs">
                <span className="text-slate-400">Faceless</span>
                <span className={`font-semibold ${offer.faceless === true ? 'text-emerald-400' : offer.faceless === false ? 'text-slate-400' : 'text-slate-500'}`}>
                  {offer.faceless === true ? '✓ Sim (Sem rosto)' : offer.faceless === false ? '✕ Não (Com especialista)' : '— Não informado'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-slate-400">Domínio LP</span>
                <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]" title={offer.landing_page_url || ''}>
                  {offer.landing_page_domain || (offer.landing_page_url ? new URL(offer.landing_page_url).hostname : '—')}
                </span>
              </div>
            </div>
          </div>

          {/* FONTE & RASTREABILIDADE (Rule 22 & 33) */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Origem da Mineração
                </h3>
              </div>
              <button
                onClick={() => setIsRawModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-[11px] font-mono text-blue-400 border border-slate-700 transition"
              >
                <Code2 className="w-3 h-3" />
                <span>Ver Raw Data</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Arquivo Original:</span>
                <span className="font-mono font-medium text-slate-200 truncate max-w-[180px]" title={offer.source_file_name || ''}>
                  {offer.source_file_name || 'Importação Manual / Legado'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Planilha (Sheet):</span>
                <span className="font-mono font-medium text-slate-200">
                  {offer.sheet_name || 'Principal'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Linha no Arquivo:</span>
                <span className="font-mono font-bold text-white">
                  {offer.row_number !== null && offer.row_number !== undefined ? `Linha #${offer.row_number}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Data da Importação:</span>
                <span className="font-mono text-slate-300">
                  {formatDateTime(offer.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* CHECKLIST DE VALIDAÇÃO */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Checklist de Critérios
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {checklist.filter((c) => c.checked).length} / {checklist.length} Aprovados
              </span>
            </div>

            <div className="space-y-2.5">
              {checklist.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                    item.checked
                      ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        item.checked
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {item.checked ? '✓' : '–'}
                    </span>
                    <span className="font-medium text-slate-200">{item.name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Promessa, Sinais Observáveis & Todos os Dados Importados (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SINAIS OBSERVÁVEIS DE VALIDAÇÃO */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Sinais Observáveis de Validação
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                Conformidade: <span className="text-blue-400 font-bold">{validationPct}%</span>
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              Indicadores extraídos de dados públicos de tráfego e longevidade. <span className="text-slate-300 font-medium">Não afirma faturamento interno ou lucro líquido.</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {signals.map((sig, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                    sig.valid
                      ? 'bg-slate-950/60 border-slate-800'
                      : 'bg-slate-950/30 border-slate-900/60 opacity-60'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      sig.valid
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {sig.valid ? '✓' : '✕'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200 leading-snug">{sig.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{sig.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PROMESSA & COPYWRITING */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Promessa & Comunicação do Produto
                </h3>
              </div>
              {!isEditingPromise ? (
                <button
                  onClick={() => setIsEditingPromise(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  {hasPromiseData ? 'Editar Promessa' : 'Adicionar Análise'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingPromise(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 border border-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSavePromise}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>

            {isEditingPromise ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Headline Principal da LP
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Ex: Alfabetize Seu Filho em 30 Dias com Atividades Lúdicas..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Subheadline
                  </label>
                  <input
                    type="text"
                    value={subheadline}
                    onChange={(e) => setSubheadline(e.target.value)}
                    placeholder="Ex: Mais de 350 atividades prontas para imprimir e aplicar hoje mesmo..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Promessa Principal
                    </label>
                    <textarea
                      rows={2}
                      value={promise}
                      onChange={(e) => setPromise(e.target.value)}
                      placeholder="Qual a grande promessa comercial?"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Público-Alvo
                    </label>
                    <textarea
                      rows={2}
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="Mães de crianças de 3 a 7 anos, pedagogas..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Problema / Dor Central
                    </label>
                    <textarea
                      rows={2}
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      placeholder="Cansaço de procurar materiais avulsos, falta de tempo..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Transformação Ofertada
                    </label>
                    <textarea
                      rows={2}
                      value={transformation}
                      onChange={(e) => setTransformation(e.target.value)}
                      placeholder="Criança aprendendo com facilidade, tempo livre para os pais..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            ) : hasPromiseData ? (
              <div className="space-y-4">
                {offer.headline && (
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Headline Principal
                    </div>
                    <div className="text-sm font-semibold text-white leading-snug">
                      &quot;{offer.headline}&quot;
                    </div>
                    {offer.subheadline && (
                      <div className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {offer.subheadline}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400 mb-1">
                      Promessa Central
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {offer.promise || <span className="text-slate-500 italic">Não analisado</span>}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-purple-400 mb-1">
                      Público-Alvo
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {offer.target_audience || <span className="text-slate-500 italic">Não analisado</span>}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-rose-400 mb-1">
                      Problema Resolvido
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {offer.problem || <span className="text-slate-500 italic">Não analisado</span>}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1">
                      Transformação
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {offer.transformation || <span className="text-slate-500 italic">Não analisado</span>}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-lg bg-slate-950/40 border border-dashed border-slate-800">
                <p className="text-xs text-slate-400 mb-3">
                  A promessa, headline e público-alvo desta oferta ainda não foram analisados.
                </p>
                <button
                  onClick={() => setIsEditingPromise(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Adicionar Análise de Copy
                </button>
              </div>
            )}
          </div>

          {/* TODOS OS DADOS IMPORTADOS / EXTRA DATA (Rule 31 & 32) */}
          {extraDataEntries.length > 0 && (
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
                <Database className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Todos os Dados Importados ({extraDataEntries.length} campos extras)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {extraDataEntries.map(([key, value]) => (
                  <div key={key} className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/70">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 truncate" title={key}>
                      {key}
                    </div>
                    <div className="text-xs font-medium text-slate-200 break-words">
                      {value !== null && value !== undefined && String(value).trim() !== ''
                        ? String(value)
                        : <span className="text-slate-500 italic">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RAW DATA AUDIT MODAL (Rule 33) */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Auditoria de Dados Originais (Raw Data)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Linha #{offer.row_number || '—'} • Planilha: {offer.sheet_name || 'Principal'} • Arquivo: {offer.source_file_name || 'Original'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRawModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
              {offer.raw_data && typeof offer.raw_data === 'object' && Object.keys(offer.raw_data).length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                    Células Originais Lidas do Excel
                  </h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs text-slate-300">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-[11px]">
                          <th className="px-4 py-2.5">Coluna Original</th>
                          <th className="px-4 py-2.5">Valor Original</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {Object.entries(offer.raw_data).map(([col, val]) => (
                          <tr key={col} className="hover:bg-slate-900/30 transition">
                            <td className="px-4 py-2 text-slate-400 font-semibold pr-4 whitespace-nowrap">{col}</td>
                            <td className="px-4 py-2 text-white break-all">
                              {val !== null && val !== undefined ? String(val) : <span className="text-slate-600 italic">null</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                  Nenhum dado bruto armazenado para este registro antigo. Novas importações gravam automaticamente o raw_data.
                </div>
              )}

              {offer.extra_data && typeof offer.extra_data === 'object' && Object.keys(offer.extra_data).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                    Campos Extras (extra_data JSON)
                  </h4>
                  <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-amber-300/90 overflow-x-auto">
                    {JSON.stringify(offer.extra_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setIsRawModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
