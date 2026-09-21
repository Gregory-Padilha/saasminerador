'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Compass,
  Sparkles,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Brain,
  DollarSign,
  TrendingUp,
  Search,
  X,
  ArrowLeft,
  RotateCcw,
  FileCheck,
} from 'lucide-react';
import { OfficeMissionRecord, OfficeOfferProjectRecord } from '@/lib/supabase/office-db';
import { ExpandableOfficePanel } from '@/components/ai-office/ExpandableOfficePanel';
import { MissionBriefWizardModal } from '@/components/ai-office/MissionBriefWizardModal';

function OfficeCentralContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modelOfferIdParam = searchParams.get('modelOfferId');

  const [missions, setMissions] = useState<OfficeMissionRecord[]>([]);
  const [projects, setProjects] = useState<OfficeOfferProjectRecord[]>([]);
  const [marketDna, setMarketDna] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Mission Brief Wizard State
  const [showNewMissionModal, setShowNewMissionModal] = useState(false);
  const [initialWizardMode, setInitialWizardMode] = useState<'MODEL_EXISTING_OFFER' | 'CREATE_FROM_ZERO'>('CREATE_FROM_ZERO');
  const [initialPrimaryOfferId, setInitialPrimaryOfferId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (modelOfferIdParam) {
      setInitialWizardMode('MODEL_EXISTING_OFFER');
      setInitialPrimaryOfferId(modelOfferIdParam);
      setShowNewMissionModal(true);
    }
  }, [modelOfferIdParam]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, dnaRes, pRes] = await Promise.all([
        fetch('/api/office/missions').then((r) => r.json()),
        fetch('/api/office/market-dna').then((r) => r.json()),
        fetch('/api/office/projects/dummy').then((r) => r.json()).catch(() => ({ projects: [] })),
      ]);

      if (mRes.missions) setMissions(mRes.missions);
      if (dnaRes.marketDna) setMarketDna(dnaRes.marketDna);
      if (pRes.projects) setProjects(pRes.projects);
    } catch (err) {
      console.error('Error fetching office data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter Active vs Completed / Recent Missions
  const activeStatuses = ['PLANNING', 'RESEARCHING', 'ARCHITECTING', 'GTM', 'REVIEW', 'DIRECTOR_REVIEW', 'PAUSED'];
  const activeMissions = missions.filter((m) => activeStatuses.includes(m.status));
  const recentMissions = missions.filter((m) => !activeStatuses.includes(m.status));

  // Find the running mission for the Live Office Preview
  const runningMission = activeMissions.find((m) => m.status !== 'PAUSED') || activeMissions[0] || null;

  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 p-6 sm:p-10 space-y-8 font-sans selection:bg-amber-500/30">
      {/* Permanent Header with Back Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>Voltar ao Offer Miner</span>
            </Link>

            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-bold font-mono">
              <Building2 className="w-3 h-3 text-amber-400" />
              <span>OFFER INTELLIGENCE OFFICE</span>
            </span>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Escritório de Inteligência de Ofertas
          </h1>
          <p className="text-xs text-slate-400">
            Transforme inteligência de mercado em novas ofertas testáveis.
          </p>
        </div>

        <button
          onClick={() => {
            setInitialWizardMode('CREATE_FROM_ZERO');
            setInitialPrimaryOfferId(undefined);
            setShowNewMissionModal(true);
          }}
          className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ NOVA MISSÃO</span>
        </button>
      </div>

      {/* 1. FIRST SECTION: EXPANDABLE LIVE DIGITAL OFFICE */}
      <div className="w-full">
        <ExpandableOfficePanel
          activeMission={runningMission}
          onOpenNewMission={() => {
            setInitialWizardMode('CREATE_FROM_ZERO');
            setInitialPrimaryOfferId(undefined);
            setShowNewMissionModal(true);
          }}
        />
      </div>

      {/* 2. MAIN GRID: ACTIVE MISSIONS & MARKET DNA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Active Missions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              Missões Ativas ({activeMissions.length})
            </h3>
          </div>

          {activeMissions.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-300">Nenhuma missão em execução no momento</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Inicie uma missão para ver os 13 agentes trabalhando em tempo real no Escritório.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeMissions.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition space-y-3 shadow-lg group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      ● {m.status}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {m.mode === 'MODEL_EXISTING_OFFER' ? 'Modelagem' : 'Criação do Zero'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition flex items-center justify-between">
                      <span>{m.title}</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{m.goal}</p>
                  </div>

                  {/* Factual Progress Bar */}
                  <div className="grid grid-cols-5 gap-1.5 text-[9px] font-mono text-center pt-2">
                    <div className="p-1 rounded bg-slate-950 border border-cyan-500/30 text-cyan-400">
                      MERCADO ✓
                    </div>
                    <div className="p-1 rounded bg-slate-950 border border-indigo-500/30 text-indigo-400">
                      OFERTA
                    </div>
                    <div className="p-1 rounded bg-slate-950 border border-emerald-500/30 text-emerald-400">
                      GTM
                    </div>
                    <div className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-500">
                      REVIEW
                    </div>
                    <div className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-500">
                      DIRETOR
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px]">
                    <span className="text-slate-400 font-mono">Perfil: {m.profileId}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/office/missions/${m.id}`)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        Painel
                      </button>
                      <button
                        onClick={() => router.push(`/office/live/${m.id}`)}
                        className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Building2 className="w-3 h-3" />
                        <span>Acompanhar ↗</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. RECENT / COMPLETED MISSIONS SECTION */}
          {recentMissions.length > 0 && (
            <div className="pt-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Missões Concluídas & Recentes ({recentMissions.length})
              </h3>

              <div className="space-y-3">
                {recentMissions.map((m) => (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/30 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        ✓ {m.status}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">13 Agentes Participaram</span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white">{m.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{m.goal}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-500 font-mono">
                        Criado em: {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.offerProjectId && (
                          <button
                            onClick={() => router.push(`/office/projects/${m.offerProjectId}`)}
                            className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                          >
                            Abrir Oferta ↗
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/office/live/${m.id}`)}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Replay</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Market DNA & Quick Links */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Market DNA Agregado
              </span>
              <span className="text-[10px] text-slate-500 font-mono">v1.0</span>
            </div>

            {marketDna ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Ofertas Mapeadas:</span>
                  <span className="font-bold text-white font-mono">{marketDna.totalOffersCount}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Anúncios Ativos Mapeados:</span>
                  <span className="font-bold text-emerald-400 font-mono">{marketDna.totalActiveAdsCount}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Predomínio Faceless:</span>
                  <span className="font-bold text-amber-300 font-mono">~85% do catálogo</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Carregando inteligência de mercado...</div>
            )}
          </div>
        </div>
      </div>

      {/* MISSION BRIEF WIZARD MODAL */}
      <MissionBriefWizardModal
        isOpen={showNewMissionModal}
        onClose={() => setShowNewMissionModal(false)}
        initialMode={initialWizardMode}
        initialPrimaryOfferId={initialPrimaryOfferId}
      />
    </div>
  );
}

export default function OfficeCentralPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090D14] p-10 text-slate-400 text-xs">Carregando Escritório...</div>}>
      <OfficeCentralContent />
    </Suspense>
  );
}

