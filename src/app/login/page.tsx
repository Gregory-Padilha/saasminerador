'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Database, Lock, Mail, ArrowRight, ShieldCheck, KeyRound, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { APP_ROUTES, getSafeInternalReturnUrl } from '@/lib/routes';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextRaw = searchParams.get('next') || searchParams.get('returnTo');
  const safeNext = getSafeInternalReturnUrl(nextRaw, APP_ROUTES.dashboard);
  const isOAuthFlow = safeNext.includes('/oauth/consent');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (!isSupabaseConfigured() || !supabase) {
        throw new Error('Serviço de autenticação temporariamente indisponível.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.session) {
        // Generic safe error message to prevent account enumeration
        throw new Error('E-mail ou senha inválidos.');
      }

      // Hard redirect to ensure all SSR cookies are parsed by server middleware
      window.location.href = safeNext;
    } catch (err: any) {
      setErrorMsg(err.message || 'E-mail ou senha inválidos.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D14] flex flex-col justify-center items-center p-4 selection:bg-blue-600/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-4 border border-blue-400/20">
            <Database className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            OFFER MINER
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Banco Privado de Inteligência e Mineração
          </p>
        </div>

        {/* OAuth Notice Banner */}
        {isOAuthFlow && (
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <KeyRound className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>Conexão OAuth 2.1 em Andamento</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Autentique-se para autorizar o acesso seguro do seu agente de IA (ChatGPT Work / MCP).
            </p>
          </div>
        )}

        {/* Auth Card */}
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-sm space-y-6">
          <div className="border-b border-slate-800/80 pb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Acesso Restrito
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Área privada — acesso somente autorizado.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Autenticação Privada com Row Level Security (RLS)</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090D14] flex items-center justify-center text-xs text-slate-400">Carregando acesso seguro...</div>}>
      <LoginContent />
    </Suspense>
  );
}
