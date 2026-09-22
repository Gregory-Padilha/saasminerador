'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  UploadCloud,
  Database,
  User,
  Sparkles,
  Command,
  Plus,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { dbService } from '@/lib/supabase/db';
import { AnalyzeOfferModal } from '@/components/offers/AnalyzeOfferModal';
import { AnalysisProgressDrawer } from '@/components/offers/AnalysisProgressDrawer';
import { ImportDropdown } from '@/components/imports/ImportDropdown';
import { JsonImportModal } from '@/components/imports/JsonImportModal';
import { OfferAnalysisJob } from '@/types';

export function Topbar() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [hasSupabase, setHasSupabase] = useState(false);
  const [healthLabel, setHealthLabel] = useState('Verificando...');
  const [healthTooltip, setHealthTooltip] = useState('Verificando integridade da conexão...');
  const [healthDotClass, setHealthDotClass] = useState('bg-slate-500');

  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [activeJob, setActiveJob] = useState<OfferAnalysisJob | null>(null);

  useEffect(() => {
    setHasSupabase(isSupabaseConfigured());

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/debug/database-context');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.supabaseConfigured) {
          if (data.supabaseConnection?.tableExists) {
            setHealthLabel('Banco Conectado');
            setHealthTooltip('Database ✓ · Session ✓ · Workspace ✓ · Data Access ✓');
            setHealthDotClass('bg-emerald-400 animate-pulse');
          } else {
            setHealthLabel('DATABASE_SCHEMA_ERROR');
            setHealthTooltip(`Supabase Conectado, mas tabelas ausentes no schema public: ${data.supabaseConnection?.error || 'PGRST205'}`);
            setHealthDotClass('bg-rose-500');
          }
        } else {
          if (data.environment === 'production') {
            setHealthLabel('Banco Desconectado');
            setHealthTooltip('Produção sem variáveis NEXT_PUBLIC_SUPABASE_URL configuradas no Netlify');
            setHealthDotClass('bg-rose-500');
          } else {
            setHealthLabel('Modo Local (Offline)');
            setHealthTooltip('Modo Local Storage Ativo · Supabase Cloud Desconectado');
            setHealthDotClass('bg-cyan-400');
          }
        }
      } catch (err: any) {
        if (isSupabaseConfigured()) {
          setHealthLabel('Conexão Instável');
          setHealthTooltip('Erro ao contatar backend');
          setHealthDotClass('bg-rose-500');
        } else {
          setHealthLabel('Modo Local');
          setHealthTooltip('Conexão local ativa');
          setHealthDotClass('bg-cyan-400');
        }
      }
    };

    checkHealth();

    const handleOpenJson = () => setIsJsonModalOpen(true);
    window.addEventListener('open-json-import-modal', handleOpenJson);
    return () => {
      window.removeEventListener('open-json-import-modal', handleOpenJson);
    };
  }, []);

  // Poll active analysis jobs & run staleness watchdog (Phase 13 & 24)
  useEffect(() => {
    let isMounted = true;
    const checkActiveJobs = async () => {
      try {
        const jobs = await dbService.getAnalysisJobs();
        const now = Date.now();
        const STALE_TIMEOUT_MS = 5 * 60 * 1000;

        // Only count healthy jobs whose heartbeat is under 5 minutes old (Phase 24)
        const running = jobs.find((j) => {
          if (j.status !== 'running' && j.status !== 'queued' && j.status !== 'retrying') return false;
          const hb = new Date(j.last_heartbeat_at || j.updated_at || j.created_at).getTime();
          return now - hb < STALE_TIMEOUT_MS;
        });

        if (isMounted) {
          setActiveJob(running || null);
        }
      } catch (err) {
        // ignore
      }
    };

    checkActiveJobs();
    const interval = setInterval(checkActiveJobs, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/offers?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-800/80 bg-[#090D14]/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        {/* Search Input triggering global search or Command Palette */}
        <form onSubmit={handleSearchSubmit} className="relative w-72 sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar produto, anunciante, headline, nicho..."
            className="w-full pl-10 pr-16 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/90 border border-slate-700/60 rounded">
              <span>⌘</span>K
            </kbd>
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Active Job Floating Pill - Clicking opens Realtime Progress Drawer */}
          {activeJob && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition shadow-sm cursor-pointer"
              title="Clique para abrir o painel de acompanhamento em tempo real"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>
                {activeJob.progress_percent
                  ? `${activeJob.progress_percent}% · ${activeJob.current_step || 'Analisando'}`
                  : '1 análise em andamento...'}
              </span>
            </button>
          )}

          {/* Backend status indicator with accurate diagnostics (FASE 22) */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-800 bg-slate-900/80 cursor-help transition"
            title={healthTooltip}
          >
            <span className={`w-2 h-2 rounded-full ${healthDotClass}`} />
            <span className="text-slate-300 text-[11px] font-medium">{healthLabel}</span>
          </div>

          {/* Button 1: + ANALISAR OFERTA */}
          <button
            onClick={() => setIsAnalyzeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-blue-500/20 transition active:scale-95 border border-blue-400/30"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Analisar Oferta</span>
          </button>

          {/* Button 2: IMPORTAR DROPDOWN */}
          <ImportDropdown
            variant="secondary"
            onOpenJsonImport={() => setIsJsonModalOpen(true)}
          />

          {/* Profile Avatar / Settings Link */}
          <Link
            href="/settings"
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-600 transition"
            title="Configurações e Segurança"
          >
            <User className="w-4 h-4" />
          </Link>

          {/* Global Logout Button */}
          <button
            onClick={async () => {
              try {
                if (supabase) {
                  await supabase.auth.signOut();
                }
              } catch {}
              window.location.href = '/login';
            }}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/30 transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Encerrar Sessão (Logout)"
          >
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Global Analyze Offer Modal */}
      <AnalyzeOfferModal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        initialJobId={activeJob?.id}
      />

      {/* Realtime Analysis Progress Drawer (Phase 17, 18, 19) */}
      <AnalysisProgressDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeJob={activeJob}
        onJobUpdated={(updatedJob) => {
          if (
            updatedJob.status === 'completed' ||
            updatedJob.status === 'cancelled' ||
            updatedJob.status === 'stale'
          ) {
            setActiveJob(null);
          } else {
            setActiveJob(updatedJob);
          }
        }}
      />

      {/* Global JSON Import Modal */}
      <JsonImportModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
      />
    </>
  );
}
