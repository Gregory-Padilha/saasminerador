'use client';

import React, { useState, useEffect } from 'react';
import { dbService } from '@/lib/supabase/db';
import { UserSettings } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Settings,
  ShieldCheck,
  Save,
  Check,
  Sliders,
  Sparkles,
  Database,
  Info,
  RefreshCw,
  Server,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { McpSettingsSection } from '@/components/settings/McpSettingsSection';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    min_price: 10,
    max_price: 50,
    min_ads: 5,
    max_ads: 50,
    min_days: 10,
    max_days: 30,
    require_faceless: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [hasSupabase, setHasSupabase] = useState(false);

  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(false);
  const [lastQueryTime, setLastQueryTime] = useState<string | null>(null);

  useEffect(() => {
    setHasSupabase(isSupabaseConfigured());
    loadSettings();
    loadDiagnostic();
  }, []);

  const loadDiagnostic = async () => {
    setIsDiagnosticLoading(true);
    try {
      const res = await fetch('/api/debug/database-context');
      if (res.ok) {
        const data = await res.json();
        setDiagnostic(data);
        setLastQueryTime(new Date().toLocaleTimeString('pt-BR'));
      }
    } catch (err) {
      console.error('Failed to load diagnostic context:', err);
    } finally {
      setIsDiagnosticLoading(false);
    }
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await dbService.updateSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings({
      min_price: 10,
      max_price: 50,
      min_ads: 5,
      max_ads: 50,
      min_days: 10,
      max_days: 30,
      require_faceless: true,
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Configurações & Critérios de Mineração"
        description="Personalize os filtros padrão de mineração para busca, radar e prospecção de ofertas low-ticket."
      />

      <div className="max-w-4xl space-y-8">
        {/* ================================================================== */}
        {/* FASE 23 — PAINEL DE DIAGNÓSTICO DO SISTEMA & PERSISTÊNCIA */}
        {/* ================================================================== */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Diagnóstico do Sistema & Persistência
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 font-normal">
                    Server Context
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auditoria de conexão do banco de dados, resolução de tenant, autenticação e contagem server-side.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={loadDiagnostic}
                disabled={isDiagnosticLoading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosticLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>

              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  diagnostic?.supabaseConnection?.tableExists
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : diagnostic?.supabaseConfigured
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                }`}
              >
                {diagnostic?.supabaseConnection?.tableExists
                  ? '✓ Supabase Online'
                  : diagnostic?.supabaseConfigured
                  ? '⚠ Acesso Limitado'
                  : '● Modo Local'}
              </span>
            </div>
          </div>

          {/* 6 Diagnostic Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. Ambiente */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Ambiente
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white uppercase">
                  {diagnostic?.environment || 'development'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({diagnostic?.context || 'local'})
                </span>
              </div>
            </div>

            {/* 2. Supabase Project Ref */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Supabase Project Ref
              </span>
              <span className="text-xs font-mono font-bold text-blue-400 block truncate" title={diagnostic?.supabaseProjectRef || 'Não configurado'}>
                {diagnostic?.supabaseProjectRef || 'Não configurado'}
              </span>
            </div>

            {/* 3. Auth User */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Sessão / Usuário
              </span>
              <span className="text-xs font-mono text-slate-200 block truncate" title={diagnostic?.authUserId || 'Sessão Pública / Anônima'}>
                {diagnostic?.authenticated ? (diagnostic.authUserId || 'Autenticado') : 'Sessão Pública / Anônima'}
              </span>
            </div>

            {/* 4. Workspace */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Workspace / Tenant
              </span>
              <span className="text-xs font-mono text-slate-200 block">
                {diagnostic?.workspaceId || 'default_workspace'}
              </span>
            </div>

            {/* 5. Database Status */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Database Status
              </span>
              <div className="flex items-center gap-1.5">
                {diagnostic?.supabaseConnection?.tableExists ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs font-medium text-emerald-400 truncate">PostgreSQL Online</span>
                  </>
                ) : diagnostic?.supabaseConfigured ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs font-medium text-amber-400 truncate" title={diagnostic?.supabaseConnection?.error || 'Tabelas não criadas'}>
                      Acesso Limitado (Tabelas Ausentes)
                    </span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-xs font-medium text-cyan-400 truncate">Armazenamento Local</span>
                  </>
                )}
              </div>
            </div>

            {/* 6. Data Access */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Acesso aos Dados (Server)
              </span>
              <span className="text-xs font-mono font-bold text-white block">
                {diagnostic?.offersVisibleToCurrentSession ?? 0} ofertas visíveis
              </span>
            </div>
          </div>

          {/* Diagnostic Warnings & Last query */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
            <div>
              {diagnostic?.supabaseConfigured && !diagnostic?.supabaseConnection?.tableExists && (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Supabase conectado, mas a tabela <code>public.offers</code> não existe ({diagnostic?.supabaseConnection?.error || 'PGRST205'}). Execute a migração <code>supabase/schema.sql</code>.
                </span>
              )}
              {!diagnostic?.supabaseConfigured && diagnostic?.environment === 'production' && (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Produção Netlify sem variáveis <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                </span>
              )}
              {diagnostic?.supabaseConnection?.tableExists && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ambiente conectado com sucesso ao Supabase Cloud.
                </span>
              )}
            </div>

            {lastQueryTime && (
              <span className="font-mono text-[10px] text-slate-500 shrink-0">
                Última consulta: {lastQueryTime}
              </span>
            )}
          </div>
        </div>

        {/* MCP Server & AI Agents Section */}
        <McpSettingsSection />

        {/* Security & Access Control Section */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Segurança e Governança de Acesso
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Sistema Privado
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Autenticação
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Supabase Auth (ONLINE)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Row Level Security
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                RLS Ativo (28 Tabelas)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Workspace Ativo
              </span>
              <span className="text-xs font-mono font-bold text-white block truncate">
                Offer Miner Principal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                MFA TOTP
              </span>
              <span className="text-xs font-medium text-slate-300 block">
                Disponível via Auth
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Acesso restrito exclusivamente a membros autenticados do workspace.
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  const { supabase } = await import('@/lib/supabase/client');
                  if (supabase) await supabase.auth.signOut();
                } catch {}
                window.location.href = '/login';
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Encerrar Sessão (Logout)</span>
            </button>
          </div>
        </div>

        {/* Validation Criteria Form */}
        <form
          onSubmit={handleSave}
          className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Filtros Padrão de Mineração Low-Ticket
              </h3>
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Restaurar Padrões
            </button>
          </div>

          {/* Intro notice */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-xs text-blue-300 leading-relaxed">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              Estes parâmetros definem os filtros rápidos de mineração e conformidade objetiva de ofertas low-ticket. Eles auxiliam na filtragem rápida no Radar e Explorer sem atribuir notas arbitrárias ou julgar a qualidade comercial da oferta.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Price Range */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                1. Faixa de Preço Low-Ticket (R$)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Preço Mínimo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.min_price}
                    onChange={(e) =>
                      setSettings({ ...settings, min_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Preço Máximo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.max_price}
                    onChange={(e) =>
                      setSettings({ ...settings, max_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Ads Volume Range */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                2. Volume de Ads Ativos
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Mínimo de Ads
                  </label>
                  <input
                    type="number"
                    value={settings.min_ads}
                    onChange={(e) =>
                      setSettings({ ...settings, min_ads: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Máximo de Ads
                  </label>
                  <input
                    type="number"
                    value={settings.max_ads}
                    onChange={(e) =>
                      setSettings({ ...settings, max_ads: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Maturity / Days Running Range */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                3. Idade da Oferta (Dias Rodando)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Mínimo de Dias
                  </label>
                  <input
                    type="number"
                    value={settings.min_days}
                    onChange={(e) =>
                      setSettings({ ...settings, min_days: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Máximo de Dias
                  </label>
                  <input
                    type="number"
                    value={settings.max_days}
                    onChange={(e) =>
                      setSettings({ ...settings, max_days: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Require Faceless Toggle */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-3">
              <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                4. Exigência Faceless
              </span>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.require_faceless}
                    onChange={(e) =>
                      setSettings({ ...settings, require_faceless: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-xs font-medium text-slate-300">
                    Obrigatório ser Faceless (Sem Rosto)
                  </span>
                </label>
              </div>
              <p className="text-[11px] text-slate-400">
                Se ativado, ofertas com influenciadores/especialistas serão marcadas como INVÁLIDA.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Configurações Salvas!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Critérios'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Scoring Engine Architecture (Informativo) */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Motor de Inteligência & Pesos de Scoring
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Arquitetura Explicável v2.0
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            O Offer Miner diferencia rigorosamente <strong>Dado Coletado</strong>, <strong>Dado Calculado</strong> e <strong>Histórico Real</strong>.
            Nenhum score mágico é atribuído sem rastreabilidade nem gerado ficticiamente.
          </p>

          {/* Discovery Score Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                1. Discovery Score (0 a 100 pts) — Primeira Captura
              </span>
              <span className="text-[11px] text-blue-400 font-mono font-bold">100% dos Sinais Observáveis</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Volume de Ads</span>
                  <span className="text-xs font-mono font-bold text-blue-400">35 pts</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Faixa ideal 5 a 50 ads. Pico de 35 pts em 31–40 ads. Acima de 50 = 0 pts.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Tempo Rodando</span>
                  <span className="text-xs font-mono font-bold text-blue-400">25 pts</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Faixa ideal 10 a 30 dias. Pico de 25 pts em 18–24 dias de sobrevivência.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Criativos Únicos</span>
                  <span className="text-xs font-mono font-bold text-blue-400">15 pts</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Variações distintas de criativos. 11+ criativos = 15 pts. Se ausente = 0 pts.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Completude</span>
                  <span className="text-xs font-mono font-bold text-blue-400">10 pts</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Preenchimento de 15 campos fundamentais da oferta (80% = 8 pts).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Nota do Work</span>
                  <span className="text-xs font-mono font-bold text-blue-400">15 pts</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Percepção do minerador (0 a 10) convertida para escala de 0 a 15 pts.
                </p>
              </div>
            </div>
          </div>

          {/* Momentum & Opportunity Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  2. Momentum Score (0 a 100 pts)
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">Mínimo 2 Snapshots</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Requer obrigatoriamente 2+ capturas temporais da mesma oferta.
                Calcula o delta de crescimento de anúncios ativos:
              </p>
              <ul className="text-[10px] text-slate-300 space-y-1 font-mono">
                <li>• <strong className="text-emerald-400">+50%+</strong>: Crescendo Forte (85–100 pts)</li>
                <li>• <strong className="text-emerald-300">+15% a +49%</strong>: Crescendo (70 pts)</li>
                <li>• <strong className="text-slate-300">-14% a +14%</strong>: Estável (50–60 pts)</li>
                <li>• <strong className="text-rose-400">-15% ou menos</strong>: Caindo (15–35 pts)</li>
                <li>• <em>1 única captura</em>: Retorna nulo / Aguardando histórico</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                  3. Opportunity Score (0 a 100 pts)
                </span>
                <span className="text-[10px] font-mono text-purple-400 font-bold">Composto Final</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Calculado exclusivamente quando a oferta possui Momentum consolidado:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-purple-300">
                Opportunity = (Discovery × 70%) + (Momentum × 30%)
              </div>
              <p className="text-[10px] text-slate-500">
                Se não houver momentum histórico, o sistema exibe apenas o Discovery Score e indica &quot;Aguardando histórico&quot;.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
