'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Database, Lock, Mail, ArrowRight, ShieldCheck, Sparkles, KeyRound, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { APP_ROUTES, getSafeInternalReturnUrl } from '@/lib/routes';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextRaw = searchParams.get('next') || searchParams.get('returnTo');
  const safeNext = getSafeInternalReturnUrl(nextRaw, APP_ROUTES.dashboard);
  const isOAuthFlow = safeNext.includes('/oauth/consent');

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (isSupabaseConfigured() && supabase) {
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
            },
          });
          if (error) throw error;
          setSuccessMsg('Conta criada com sucesso! Redirecionando...');
          setTimeout(() => router.push(safeNext), 1000);
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          router.push(safeNext);
        }
      } else {
        if (isOAuthFlow) {
          throw new Error('Supabase Auth não está configurado. OAuth exige o Supabase Auth ativo.');
        }
        // Local mode instant access
        router.push(safeNext);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    if (isOAuthFlow) {
      setErrorMsg('O Modo Direto não pode ser utilizado para autorização de agentes de IA (OAuth). Faça login com sua conta Supabase.');
      return;
    }
    router.push(safeNext);
  };

  return (
    <div className="min-h-screen bg-[#090D14] flex flex-col justify-center items-center p-4 selection:bg-blue-600/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-4">
            <Database className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            OFFER MINER
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Banco Privado de Inteligência de Ofertas Low-Ticket
          </p>
        </div>

        {/* OAuth Notice Banner */}
        {isOAuthFlow && (
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <KeyRound className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>Conexão OAuth 2.1 MCP em Andamento</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Você foi redirecionado para autenticação antes de aprovar a conexão do seu agente de IA (Gemini Spark / MCP). Faça login com sua conta Supabase.
            </p>
          </div>
        )}

        {/* Auth Card */}
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white">
              {isSignUp ? 'Criar Nova Conta' : 'Acessar Plataforma'}
            </h2>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition"
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Criar conta'}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Cadastrar e Entrar' : 'Entrar no Sistema'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Instant Access Button */}
          <div className="pt-4 border-t border-slate-800 text-center">
            {isOAuthFlow ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Modo Direto desativado durante autorização OAuth. O Gemini Spark exige autenticação Supabase Auth.</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDemoAccess}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Acessar Imediatamente (Modo Direto)</span>
              </button>
            )}
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Banco protegido com Row Level Security (RLS)</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090D14] flex items-center justify-center text-xs text-slate-400">Carregando login...</div>}>
      <LoginContent />
    </Suspense>
  );
}

