'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Layers,
  HelpCircle,
  ExternalLink,
  DollarSign,
  Globe,
  Palette,
  Target,
  CheckCircle2,
  Brain,
  ShieldAlert,
  Edit3,
  BookOpen,
  TrendingUp,
  Tag,
  Clock,
  Zap,
  Layout,
  FileCheck,
  AlertTriangle,
  Code2,
  Lock,
  RefreshCw,
  Eye,
  FileText,
  Search,
  Check,
  Info,
} from 'lucide-react';
import { OfficeOfferProjectRecord } from '@/lib/supabase/office-db';
import { EvidenceDrawer } from '@/components/office/EvidenceDrawer';
import { OfficeValueRenderer } from '@/components/ai-office/OfficeValueRenderer';
import { CompleteOfferProjectSpec } from '@/lib/ai-office/offer-schema';
import {
  normalizeTransformationMatrix,
  formatProjectValue,
  ensureArray,
  CanonicalTransformationMatrixItem,
} from '@/lib/ai-office/transformation-normalizer';
import { SectionErrorBoundary } from '@/components/ai-office/SectionErrorBoundary';

export default function OfferProjectStrategyPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<OfficeOfferProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | 'OVERVIEW'
    | 'TRANSFORMATION'
    | 'AUDIENCE'
    | 'POSITIONING'
    | 'PRODUCT'
    | 'PRICING'
    | 'CREATIVES'
    | 'LP'
    | 'VALIDATION'
    | 'EVIDENCE'
    | 'DECISIONS'
  >('OVERVIEW');

  // Evidence Drawer state
  const [selectedDecisionForDrawer, setSelectedDecisionForDrawer] = useState<any | null>(null);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/office/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project) setProject(data.project);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#090D14] text-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-purple-400 font-bold text-xs font-mono">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span>Carregando Strategy Workspace da Oferta...</span>
        </div>
      </div>
    );
  }

  const spec: Partial<CompleteOfferProjectSpec> = project.offerSpec || {};
  const sourceOfferName = formatProjectValue(
    spec.sourceOffer?.name || project.referenceOfferIds?.[0] || project.workingName || 'Oferta Base de Origem'
  );

  const changesUsed = spec.transformationSummary?.changesUsed || 2;
  const maxChanges = 2;

  // 1. BOUNDARY NORMALIZATION OF TRANSFORMATION MATRIX
  // Audits and safely parses any shape (Array, Object with .dimensions, Keyed Object, JSON String, null/undefined)
  const rawMatrixData = spec.transformationMatrix || (spec as any).qualityReport?.transformationMatrix || project.offerSpec?.transformationMatrix;
  const matrix: CanonicalTransformationMatrixItem[] = normalizeTransformationMatrix(rawMatrixData);

  const isCreateFromZero = (project as any).mode === 'CREATE_FROM_ZERO' || (spec.identity as any)?.tag === 'CREATE_FROM_ZERO';

  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 flex flex-col font-sans selection:bg-purple-600/30">
      {/* Permanent Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/90 px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/office')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition flex items-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
            <span>Escritório</span>
          </button>
          <span className="text-slate-700">/</span>
          <span className="font-bold text-xs text-white truncate max-w-xs">{formatProjectValue(project.projectName)}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>APROVADO PELOS GATES</span>
          </span>

          <button
            onClick={() => router.push(`/intelligence?offerIds=${ensureArray(project.referenceOfferIds).join(',')}`)}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-500/20"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Conversar com Brain ↗</span>
          </button>
        </div>
      </header>

      {/* Hero Header & Transformation Matrix Banner */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-8 sm:px-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-widest px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
              STRATEGY WORKSPACE · {formatProjectValue(project.niche || 'CULINÁRIA').toUpperCase()}
            </span>
            <span className="text-xs font-mono text-cyan-400 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              🇺🇸 {formatProjectValue(spec.market?.marketCountry || 'Estados Unidos')}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">ID: {project.id}</span>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {formatProjectValue(spec.identity?.recommendedName || project.projectName)}
          </h1>
          {!isCreateFromZero && (
            <p className="text-sm text-purple-300 font-medium mt-1">
              Modelada a partir de: <strong className="text-amber-400">{sourceOfferName}</strong>
            </p>
          )}

          {ensureArray(spec.identity?.alternativeNames).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="text-slate-400">Nomes alternativos:</span>
              {ensureArray(spec.identity?.alternativeNames).map((item: any, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                  {formatProjectValue(item)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Transformation Budget Metric */}
        {!isCreateFromZero && (
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-mono uppercase text-[10px]">Identidade Obrigatória</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-emerald-400 font-mono">✓ NOVA</span>
                <span className="text-[10px] text-slate-400">(Nome & Marca)</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-mono uppercase text-[10px]">Adaptações de Mercado</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-cyan-400 font-mono">4 Localizações</span>
                <span className="text-[10px] text-slate-400">(US, USD, EN, Checkout)</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-mono uppercase text-[10px]">Mudanças Estratégicas</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-amber-400 font-mono">
                  {changesUsed} / {maxChanges}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Público + Posicionamento
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Tabbed Navigation */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-6 py-2 overflow-x-auto flex items-center gap-1.5 text-xs font-medium sticky top-16 z-20 backdrop-blur-md">
        {[
          { id: 'OVERVIEW', label: '📊 Visão Geral' },
          ...(!isCreateFromZero ? [{ id: 'TRANSFORMATION', label: '🔄 Original vs Modelada' }] : []),
          { id: 'AUDIENCE', label: '👤 Mercado & Público' },
          { id: 'POSITIONING', label: '🎯 Posicionamento & Big Idea' },
          { id: 'PRODUCT', label: '📦 Produto & Entregáveis' },
          { id: 'PRICING', label: '💰 Pricing & Monetização' },
          { id: 'CREATIVES', label: '🎨 Criativos & Copy' },
          { id: 'LP', label: '🌐 Landing Page' },
          { id: 'VALIDATION', label: '🧪 Plano de Validação' },
          { id: 'EVIDENCE', label: '📁 Evidências' },
          { id: 'DECISIONS', label: '⚖️ Decisões (Ledger)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-6xl mx-auto w-full space-y-8">
        {/* 1. VISÃO GERAL TAB */}
        {activeTab === 'OVERVIEW' && (
          <SectionErrorBoundary sectionName="Visão Geral">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1 uppercase text-[10px]">Preço Teste</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">
                    {formatProjectValue(spec.pricing?.testPrice || '$27.00 USD')}
                  </span>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1 uppercase text-[10px]">Ancoragem</span>
                  <span className="text-xl font-bold text-slate-300 font-mono">
                    {formatProjectValue(spec.pricing?.anchorPrice || '$97.00 USD')}
                  </span>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1 uppercase text-[10px]">Formato</span>
                  <span className="text-xs font-bold text-purple-300">
                    {formatProjectValue(spec.product?.format || 'PDF / Ebook + Digital Cards')}
                  </span>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1 uppercase text-[10px]">Coerência de Dominio</span>
                  <span className="text-xs font-bold text-emerald-400">
                    ✓ 100% Culinária / Receitas
                  </span>
                </div>
              </div>

              {/* Big Idea & Concept */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Big Idea Central
                  </h3>
                  <p className="text-purple-200 font-semibold leading-relaxed text-sm">
                    "{formatProjectValue(spec.bigIdea?.idea || 'Guia Prático de 365 Refeições Sem Açúcar, Glúten e Lactose Organizadas em Fichas Rápidas para o Dia a Dia Americano.')}"
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Ângulo:</strong> {formatProjectValue(spec.bigIdea?.hookTerritory || 'Praticidade diária com tripla restrição alimentar.')}
                  </p>
                </div>

                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-400" />
                    Avatar Comprador Target
                  </h3>
                  <p className="text-slate-200 font-semibold leading-relaxed">
                    {formatProjectValue(spec.audience?.primaryAudience || 'Adultos nos EUA responsáveis pelo planejamento alimentar familiar que gerenciam restrições simultâneas de glúten, lactose e açúcar.')}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Momento:</strong> {formatProjectValue(spec.audience?.context || 'Exaustados de pesquisar receitas separadas em blogs e redes sociais.')}
                  </p>
                </div>
              </div>

              {/* Quick Deliverables */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 text-xs">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Resumo do Entregável
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ensureArray(spec.deliverables).map((del: any, i: number) => (
                    <div key={i} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                      <span className="font-bold text-purple-300 block">📦 {formatProjectValue(del.name)}</span>
                      <p className="text-slate-300 text-[11px]">{formatProjectValue(del.contents)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 2. TRANSFORMATION MATRIX TAB */}
        {activeTab === 'TRANSFORMATION' && (
          <SectionErrorBoundary sectionName="Matriz de Transformação">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    Matriz de Transformação da Oferta (Original vs Modelada)
                  </h3>
                  <span className="font-mono text-xs text-amber-300 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    {changesUsed} / {maxChanges} Mudanças Utilizadas
                  </span>
                </div>

                {matrix.length > 0 ? (
                  <div className="space-y-3">
                    {matrix.map((item: CanonicalTransformationMatrixItem, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
                      >
                        <div className="md:col-span-3 flex items-center gap-2">
                          <span className="font-bold text-white font-mono uppercase">{item.dimension}</span>
                          {item.status === 'MANDATORY_NEW' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              MANDATORY NEW
                            </span>
                          )}
                          {item.status === 'STRATEGIC_CHANGE' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              STRATEGIC CHANGE
                            </span>
                          )}
                          {item.status === 'LOCALIZED' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              LOCALIZED
                            </span>
                          )}
                          {item.status === 'LOCKED' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              LOCKED
                            </span>
                          )}
                          {(item.status === 'CHANGED' || item.status === 'ADAPTED') && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {item.status}
                            </span>
                          )}
                          {item.status === 'PRESERVED' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              PRESERVED
                            </span>
                          )}
                        </div>

                        <div className="md:col-span-4 p-2 bg-slate-900 rounded-xl text-slate-400">
                          <span className="text-[10px] uppercase font-mono block text-slate-500">Original:</span>
                          {item.sourceValue}
                        </div>

                        <div className="md:col-span-5 p-2 bg-slate-900 rounded-xl text-slate-200 font-medium border border-slate-800">
                          <span className="text-[10px] uppercase font-mono block text-purple-400">Modelado:</span>
                          {item.modelValue}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                    <Info className="w-6 h-6 text-purple-400 mx-auto" />
                    {isCreateFromZero ? (
                      <p className="text-slate-300 font-medium">
                        💡 Missão de Criação do Zero: Esta oferta foi gerada sem modelagem de oferta fonte.
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">
                        Matriz de transformação ainda não disponível.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 3. MERCADO & PÚBLICO TAB */}
        {activeTab === 'AUDIENCE' && (
          <SectionErrorBoundary sectionName="Mercado & Público">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Target className="w-4 h-4 text-purple-400" />
                  Mapeamento Profundo do Público Comprador (Avatar US)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <span className="font-bold text-purple-300 text-xs block uppercase">Segmento Primário:</span>
                    <p className="text-slate-200 font-medium leading-relaxed">
                      {formatProjectValue(spec.audience?.primaryAudience || 'Adultos americanos (30-55 anos), responsáveis pelo planejamento das refeições familiares, que convivem com restrições simultâneas de açúcar, glúten e lactose.')}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <span className="font-bold text-cyan-300 text-xs block uppercase">Contexto / Momento de Compra:</span>
                    <p className="text-slate-200 font-medium leading-relaxed">
                      {formatProjectValue(spec.audience?.context || 'Cansados de gastar horas pesquisando receitas separadamente em blogs e lidando com pratos sem sabor que a família rejeita.')}
                    </p>
                  </div>
                </div>

                {/* JTBD Breakdown */}
                <div className="space-y-3">
                  <span className="font-bold text-white text-xs block uppercase">Jobs To Be Done (JTBD):</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                      <span className="font-bold text-purple-400 block text-xs">⚡ Funcional:</span>
                      <p className="text-slate-300 text-[11px]">
                        Preparar refeições sem açúcar, glúten e lactose em menos de 20 minutos sem precisar comprar ingredientes raros.
                      </p>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                      <span className="font-bold text-amber-400 block text-xs">❤️ Emocional:</span>
                      <p className="text-slate-300 text-[11px]">
                        Sentir alívio e controle ao não precisar dizer 'não' a sobremesas e pratos saborosos por causa das restrições.
                      </p>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                      <span className="font-bold text-emerald-400 block text-xs">👥 Social:</span>
                      <p className="text-slate-300 text-[11px]">
                        Servir refeições deliciosas para a família inteira sem precisar fazer dois cardápios diferentes na mesma casa.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pains & Triggers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <span className="font-bold text-rose-400 text-xs block uppercase">Dores Funcionais & Frustrações:</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Receitas da internet que exigem 15 ingredientes ultra caros.</li>
                      <li>Substituições erradas que estragam a textura do bolo/pão.</li>
                      <li>Falta de organização semanal no cardápio familiar.</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <span className="font-bold text-emerald-400 text-xs block uppercase">Buying Triggers & Desejos:</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Diagnóstico recente de intolerância ou decisão de dieta limpa.</li>
                      <li>Desejo de comer doces e massas com sabor sem inflamação.</li>
                      <li>Acesso instantâneo em formato digital fácil de abrir no celular.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 4. POSICIONAMENTO TAB */}
        {activeTab === 'POSITIONING' && (
          <SectionErrorBoundary sectionName="Posicionamento">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Declaração de Posicionamento & Big Idea
                </h3>
                <p className="text-purple-200 text-base leading-relaxed font-bold bg-purple-950/30 p-4 rounded-2xl border border-purple-500/30">
                  "{formatProjectValue(spec.positioning?.positioningStatement || 'O único sistema de 365 receitas práticas com tripla restrição (Zero Açúcar, Zero Glúten, Zero Lactose) desenhado especificamente para a rotina dinâmica da cozinha americana.')}"
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-amber-400 font-bold block text-xs">Contra-Posicionamento:</span>
                    <p className="text-slate-300">{formatProjectValue(spec.positioning?.counterPositioning || 'Contra livros de culinária teóricos ou blogs com receitas impossíveis e ingredientes raros.')}</p>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-emerald-400 font-bold block text-xs">Diferenciação Principal:</span>
                    <p className="text-slate-300">{formatProjectValue(spec.positioning?.differentiation || 'Substituições exatas testadas para manter sabor de refeição normal.')}</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 5. PRODUTO & ENTREGÁVEIS TAB */}
        {activeTab === 'PRODUCT' && (
          <SectionErrorBoundary sectionName="Produto & Entregáveis">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Especificação Completa do Produto Digital
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 block mb-1 font-mono uppercase text-[10px]">Conceito:</span>
                    <p className="font-semibold text-slate-200">{formatProjectValue(spec.product?.concept || '365 Recipes Triple-Free Kitchen Guide')}</p>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 block mb-1 font-mono uppercase text-[10px]">Formato de Entrega:</span>
                    <p className="font-semibold text-slate-200">{formatProjectValue(spec.product?.format || 'PDF / Ebook Interativo + Digital Cards')}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <span className="font-bold text-white text-xs block uppercase">Lista de Entregáveis Detalhados:</span>
                  <div className="space-y-2">
                    {ensureArray(spec.deliverables).map((del: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                        <div className="font-bold text-purple-300 text-sm">📦 {formatProjectValue(del.name)}</div>
                        <p className="text-slate-300">{formatProjectValue(del.contents)}</p>
                        <p className="text-slate-400 text-[11px]">
                          <strong>Problema Resolvido:</strong> {formatProjectValue(del.problemSolved)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 6. PRICING TAB */}
        {activeTab === 'PRICING' && (
          <SectionErrorBoundary sectionName="Pricing & Monetização">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Estrutura de Preço & Order Bumps (USD / US Target)
                </h3>
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-1">
                  <span className="text-emerald-400 font-bold block">Raciocínio da Precificação de Teste:</span>
                  <p className="text-slate-300">{formatProjectValue(spec.pricing?.rationale || 'Precificação low-ticket otimizada para conversão direta em anúncios digitais nos EUA ($27.00 USD).')}</p>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="font-bold text-white block">Order Bumps Recomendados:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ensureArray(spec.monetization?.orderBumps).map((bump: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">➕ {formatProjectValue(bump.name)}</span>
                          <span className="font-mono text-emerald-400 font-bold">{formatProjectValue(bump.proposedPrice)}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{formatProjectValue(bump.complementaryWhy)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 7. CRIATIVOS & COPY TAB */}
        {activeTab === 'CREATIVES' && (
          <SectionErrorBoundary sectionName="Criativos & Copy">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Palette className="w-4 h-4 text-amber-400" />
                  Territórios de Ângulos & Primeiros 5 Conceitos de Criativos
                </h3>
                <div className="space-y-3">
                  {ensureArray(spec.creativeStrategy?.firstCreativeConcepts).map((c: any, i: number) => (
                    <div key={i} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">{formatProjectValue(c.conceptName)}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                          {formatProjectValue(c.format)}
                        </span>
                      </div>
                      <p className="text-slate-200">
                        <strong>Hook Text:</strong> "{formatProjectValue(c.hookText)}"
                      </p>
                      <p className="text-slate-400">{formatProjectValue(c.bodyConcept)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 8. LANDING PAGE TAB */}
        {activeTab === 'LP' && (
          <SectionErrorBoundary sectionName="Landing Page">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Blueprint Estrutural da Landing Page (13 Seções Vertical)
                </h3>
                <div className="space-y-2">
                  {ensureArray(spec.landingPageBlueprint?.sections).map((sec: any, i: number) => (
                    <div key={i} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3">
                      <span className="font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                        {formatProjectValue(sec.sectionNumber)}
                      </span>
                      <div className="space-y-0.5 flex-1">
                        <span className="font-bold text-white block">{formatProjectValue(sec.name)}</span>
                        <p className="text-slate-300">{formatProjectValue(sec.purpose)}</p>
                        <p className="text-slate-400 text-[11px]">{formatProjectValue(sec.content)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 9. PLANO DE VALIDAÇÃO TAB */}
        {activeTab === 'VALIDATION' && (
          <SectionErrorBoundary sectionName="Plano de Validação">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  Plano de Teste Operacional & Riscos Mapeados
                </h3>
                <div className="space-y-3">
                  {ensureArray(spec.validationPlan?.testMatrix).map((tm: any, i: number) => (
                    <div key={i} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                      <span className="font-bold text-emerald-400 text-sm">{formatProjectValue(tm.testName)}</span>
                      <p className="text-slate-300">
                        <strong>Hipótese:</strong> {formatProjectValue(tm.hypothesis)}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <span className="text-emerald-300">✓ Sinal de Sucesso: {formatProjectValue(tm.successSignal)}</span>
                        <span className="text-amber-400">⚠️ Sinal de Falha: {formatProjectValue(tm.failureSignal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 10. EVIDÊNCIAS TAB */}
        {activeTab === 'EVIDENCE' && (
          <SectionErrorBoundary sectionName="Evidências">
            <div className="space-y-6 text-xs">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                  <FileCheck className="w-4 h-4 text-cyan-400" />
                  Evidências Catalogadas no Case File
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                    <span className="font-mono text-[10px] text-cyan-400 uppercase font-bold">OBSERVED_SOURCE</span>
                    <span className="font-bold text-white block">Oferta Principal: {sourceOfferName}</span>
                    <p className="text-slate-300 text-[11px]">
                      Estrutura da oferta de origem validada no acervo de {formatProjectValue(project.niche || 'Mercado Target')}.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                    <span className="font-mono text-[10px] text-indigo-400 uppercase font-bold">OBSERVED_CATALOG</span>
                    <span className="font-bold text-white block">Padrão de Mercado ({formatProjectValue(spec.market?.marketCountry || project.market || 'Brasil')})</span>
                    <p className="text-slate-300 text-[11px]">
                      Faixa de preço de teste: {formatProjectValue(spec.pricing?.testPrice || '$27.00 USD')}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionErrorBoundary>
        )}

        {/* 11. DECISÕES (LEDGER) TAB */}
        {activeTab === 'DECISIONS' && (
          <SectionErrorBoundary sectionName="Decision Ledger">
            <div className="space-y-4 text-xs">
              <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Decision Ledger Registrado pelo Escritório
              </h3>

              <div className="space-y-3">
                {ensureArray(project.decisionLedger || spec.decisions).length > 0 ? (
                  ensureArray(project.decisionLedger || spec.decisions).map((dec: any) => (
                    <div key={dec.id || Math.random()} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{formatProjectValue(dec.title)}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {formatProjectValue(dec.decisionType)}
                          </span>
                          {dec.uncertainty && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {formatProjectValue(dec.uncertainty)}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedDecisionForDrawer(dec)}
                          className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Por quê?</span>
                        </button>
                      </div>

                      <p className="text-slate-300">{formatProjectValue(dec.rationale)}</p>

                      {ensureArray(dec.evidenceRefs).length > 0 && (
                        <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 flex items-center gap-1">
                          <FileCheck className="w-3 h-3 text-cyan-400" />
                          <span>Evidências: {ensureArray(dec.evidenceRefs).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-900 text-xs text-slate-500">
                    Nenhuma decisão no ledger.
                  </div>
                )}
              </div>
            </div>
          </SectionErrorBoundary>
        )}
      </main>

      {/* Evidence Drawer Modal */}
      <EvidenceDrawer
        isOpen={!!selectedDecisionForDrawer}
        onClose={() => setSelectedDecisionForDrawer(null)}
        decision={selectedDecisionForDrawer}
      />
    </div>
  );
}
