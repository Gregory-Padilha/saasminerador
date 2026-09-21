'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, Sparkles, ArrowRight, XCircle, RefreshCw } from 'lucide-react';

function ConsentContent() {
  const searchParams = useSearchParams();
  const authorizationId = searchParams.get('authorization_id') || searchParams.get('authorizationId');

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authDetails, setAuthDetails] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authorizedSuccess, setAuthorizedSuccess] = useState(false);

  // Compute login return URL preserving authorization_id
  const fullConsentPath = authorizationId
    ? `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
    : '/oauth/consent';
  const loginWithNextUrl = `/login?next=${encodeURIComponent(fullConsentPath)}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] || 'supabase-project';

  useEffect(() => {
    checkUserSessionAndDetails();
  }, [authorizationId]);

  const checkUserSessionAndDetails = async () => {
    setLoading(true);
    setErrorMsg(null);
    setAuthDetails(null);

    if (!isSupabaseConfigured() || !supabase) {
      setErrorMsg('Supabase Auth não está configurado neste ambiente.');
      setLoading(false);
      return;
    }

    try {
      // 1. Verify User Session
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        console.log('[OAuth Consent] User not authenticated -> redirecting to login with next parameter');
        if (authorizationId) {
          window.location.href = loginWithNextUrl;
          return;
        } else {
          setErrorMsg('Nenhuma solicitação OAuth informada na URL.');
          setLoading(false);
          return;
        }
      }

      setUser(userData.user);

      if (!authorizationId) {
        setErrorMsg('Parâmetro authorization_id ausente na URL.');
        setLoading(false);
        return;
      }

      console.log(`[OAuth Consent] Request received for authorizationId: ${authorizationId.substring(0, 8)}... | Project: ${projectRef} | User: ${userData.user.email}`);

      // 2. Fetch Authorization Details from Supabase Auth Server (passing authorizationId as string)
      let detailsResult: any = null;
      let detailsErrorMsg: string | null = null;

      try {
        if ((supabase.auth as any).oauth?.getAuthorizationDetails) {
          const res = await (supabase.auth as any).oauth.getAuthorizationDetails(authorizationId);
          if (res.error) {
            detailsErrorMsg = res.error.message || 'Solicitação de autorização não encontrada (authorization not found)';
          } else {
            detailsResult = res.data;
          }
        }
      } catch (sdkErr: any) {
        detailsErrorMsg = sdkErr.message;
      }

      // REST Fallback if SDK method didn't return data
      if (!detailsResult && !detailsErrorMsg) {
        try {
          const session = (await supabase.auth.getSession())?.data?.session;
          if (session) {
            const res = await fetch(`${supabaseUrl}/auth/v1/oauth/authorizations/${authorizationId}`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              },
            });
            const resJson = await res.json();
            if (res.ok) {
              detailsResult = resJson;
            } else {
              detailsErrorMsg = resJson.msg || resJson.error_description || resJson.message || 'authorization not found';
            }
          }
        } catch (fetchErr: any) {
          detailsErrorMsg = fetchErr.message;
        }
      }

      // 3. Process Details Result (Type Narrowing)
      if (detailsResult) {
        console.log('[OAuth Consent] getAuthorizationDetails SUCCESS:', detailsResult);

        // Check Type Narrowing #10: If user already consented, Supabase returns redirect_url directly
        const alreadyConsentedUrl = detailsResult.redirect_url || detailsResult.redirectUrl;
        const hasClientDetails = detailsResult.client || detailsResult.authorization_id || detailsResult.client_id;

        if (alreadyConsentedUrl && !hasClientDetails) {
          console.log('[OAuth Consent] Already consented -> redirecting immediately:', alreadyConsentedUrl);
          window.location.href = alreadyConsentedUrl;
          return;
        }

        setAuthDetails(detailsResult);
      } else {
        console.error('[OAuth Consent] getAuthorizationDetails ERROR:', detailsErrorMsg);
        setErrorMsg(detailsErrorMsg || 'authorization not found');
      }
    } catch (err: any) {
      console.error('[OAuth Consent] Fatal session error:', err);
      setErrorMsg(err.message || 'Erro ao processar sessão OAuth.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!authorizationId || !authDetails) {
      setErrorMsg('Solicitação de autorização inválida ou não carregada.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Try SDK official helper method (passing string authorizationId)
      if (supabase && (supabase.auth as any).oauth?.approveAuthorization) {
        const res = await (supabase.auth as any).oauth.approveAuthorization(authorizationId);

        if (res.error) throw res.error;

        const targetUrl = res.data?.redirectUrl || res.data?.redirect_url;
        if (targetUrl) {
          console.log('[OAuth Consent] Approve SUCCESS -> redirecting to client:', targetUrl);
          window.location.href = targetUrl;
          return;
        }
      }

      // 2. Direct REST Fallback to Supabase Auth Server
      const session = (await supabase?.auth.getSession())?.data?.session;

      if (!session) {
        window.location.href = loginWithNextUrl;
        return;
      }

      const res = await fetch(`${supabaseUrl}/auth/v1/oauth/authorizations/${authorizationId}/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.msg || resData.error_description || 'Erro ao aprovar autorização OAuth.');

      if (resData.redirect_url) {
        console.log('[OAuth Consent] Approve REST SUCCESS -> redirecting:', resData.redirect_url);
        window.location.href = resData.redirect_url;
      } else {
        setAuthorizedSuccess(true);
      }
    } catch (err: any) {
      console.error('[OAuth Consent] Approve error:', err);
      setErrorMsg(err.message || 'Falha ao aprovar autorização OAuth.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!authorizationId) {
      window.location.href = '/';
      return;
    }

    setSubmitting(true);
    try {
      if (supabase && (supabase.auth as any).oauth?.denyAuthorization) {
        const res = await (supabase.auth as any).oauth.denyAuthorization(authorizationId);
        const targetUrl = res.data?.redirectUrl || res.data?.redirect_url;
        if (targetUrl) {
          window.location.href = targetUrl;
          return;
        }
      }

      const session = (await supabase?.auth.getSession())?.data?.session;
      if (session && supabaseUrl) {
        const res = await fetch(`${supabaseUrl}/auth/v1/oauth/authorizations/${authorizationId}/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ action: 'deny' }),
        });
        const resData = await res.json();
        if (resData.redirect_url) {
          window.location.href = resData.redirect_url;
          return;
        }
      }

      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  const clientName = authDetails?.client?.name || authDetails?.client_name || authDetails?.client?.client_name;
  const clientId = authDetails?.client?.client_id || authDetails?.client_id;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans selection:bg-purple-600/30">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Title & Header */}
        <div className="text-center space-y-2 relative">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide uppercase">AUTORIZAR ACESSO AO OFFER MINER</h1>
          <p className="text-xs text-slate-400">
            Conectar aplicativo cliente via OAuth 2.1 (Offer Miner AI Gateway)
          </p>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Verificando detalhes da autorização OAuth...</span>
          </div>
        ) : !user ? (
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 text-center">
            <Lock className="w-10 h-10 text-amber-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Login Supabase Necessário</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Você precisa estar autenticado com sua conta Supabase para autorizar a conexão OAuth deste cliente.
              </p>
            </div>
            <a
              href={loginWithNextUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-500/20"
            >
              <span>Fazer Login no Offer Miner</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : authorizedSuccess ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-300">Acesso Autorizado com Sucesso!</h3>
            <p className="text-xs text-slate-300">Redirecionando de volta para o agente de IA...</p>
          </div>
        ) : !authDetails ? (
          /* Invalid / Expired Request Card - Requirement #8 & #20: DO NOT show consent or approve button when details fail */
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-4 text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white uppercase tracking-tight">SOLICITAÇÃO DE AUTORIZAÇÃO INVÁLIDA OU EXPIRADA</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Essa solicitação OAuth não está mais disponível ou expirou. Volte ao seu cliente de IA (Gemini Spark) e inicie a conexão novamente.
              </p>
            </div>

            {/* Visual Diagnostic Panel */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-rose-300">
                <span>Status da Requisição:</span>
                <span className="font-bold">Invalid / Expired</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Causa do Erro:</span>
                <span className="text-slate-200">{errorMsg || 'authorization not found'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Supabase Project:</span>
                <span className="text-purple-300">{projectRef}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Sessão Supabase:</span>
                <span className="text-emerald-400">Autenticado ✓</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-purple-400" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : (
          /* Valid Consent Card */
          <>
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Aplicativo Solicitante:</span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  {clientName || 'Cliente MCP'}
                </span>
              </div>

              {clientId && (
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Client ID:</span>
                  <span className="font-mono text-slate-300">{clientId}</span>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                  Permissões Solicitadas:
                </span>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>MODO READ-ONLY (Apenas Consulta)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Este aplicativo poderá consultar dados do Offer Miner através do AI Gateway (15 ferramentas). Nenhuma ferramenta de escrita ou mutação está disponível.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Usuário Autenticado:</span>
                  <span className="text-slate-200 font-mono font-bold">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>ID de Autorização:</span>
                  <span className="text-purple-400 font-mono text-[10px]">{authorizationId ? `${authorizationId.substring(0, 12)}...` : 'Válido'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleDeny}
                disabled={submitting}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Cancelar</span>
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    <span>Autorizar Acesso</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-xs">Carregando...</div>}>
      <ConsentContent />
    </Suspense>
  );
}
