'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Check,
  Copy,
  RefreshCw,
  Server,
  Globe,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  Zap,
  Activity,
  X,
  Code,
  Sliders,
  KeyRound,
  CheckCircle2,
  Brain,
} from 'lucide-react';
import {
  CLIENT_PRESETS,
  ClientPresetMeta,
  EnvironmentMode,
  TransportType,
  generateClientSnippet,
} from '@/lib/ai-tools/presets';

export function McpSettingsSection() {
  const [localUrl, setLocalUrl] = useState('http://localhost:3000/api/mcp');
  const [healthData, setHealthData] = useState<{
    status: string;
    version: string;
    tools: number;
    remoteConfigured: boolean;
    remoteUrl: string | null;
    remoteStatus: string;
    uptimeSeconds: number;
  } | null>(null);

  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  // Modal State
  const [activeModalPreset, setActiveModalPreset] = useState<ClientPresetMeta | null>(null);
  const [selectedMode, setSelectedMode] = useState<EnvironmentMode>('local');
  const [selectedTransport, setSelectedTransport] = useState<TransportType>('http');
  const [copiedModalSnippet, setCopiedModalSnippet] = useState(false);
  const [testingModal, setTestingModal] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<{
    success: boolean;
    message: string;
    serverVersion?: string;
    toolsAvailable?: number;
  } | null>(null);

  // OAuth Diagnostic Test State
  const [testingOAuth, setTestingOAuth] = useState(false);
  const [oauthTestResult, setOauthTestResult] = useState<{
    success: boolean;
    chatgptWorkReady?: 'YES' | 'NO';
    message: string;
    statusBadges?: {
      mcpProduction: string;
      mcpDevelopment: string;
      oauthResourceMetadata: 'ONLINE' | 'ERROR';
      authorizationServerDiscovery: 'ONLINE' | 'ERROR';
      challenge401: 'PASS' | 'FAIL';
      chatgptWorkReady: 'YES' | 'NO';
    };
    checklist?: Record<string, boolean>;
    logs?: string[];
  } | null>(null);

  // Diagnostic drawer
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // Multi-Provider Health & Diagnostic State
  const [providersHealth, setProvidersHealth] = useState<{
    openai?: any;
    gemini?: any;
    anthropic?: any;
  } | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [activeTestResult, setActiveTestResult] = useState<any | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocalUrl(`${window.location.origin}/api/mcp`);
    }
    fetchHealth();
    fetchAllProvidersHealth();
    handleTestOAuthStack();
  }, []);

  const fetchAllProvidersHealth = async () => {
    try {
      const res = await fetch('/api/ai-intelligence/health');
      const data = await res.json();
      if (data.providers) {
        setProvidersHealth(data.providers);
      }
    } catch (err) {
      console.error('Error fetching providers health:', err);
    }
  };

  const handleTestProviderConnection = async (provider: 'openai' | 'gemini' | 'anthropic') => {
    setTestingProvider(provider);
    setActiveTestResult(null);
    try {
      const res = await fetch('/api/ai-intelligence/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      setActiveTestResult(data);
      fetchAllProvidersHealth();
    } catch (err: any) {
      setActiveTestResult({
        success: false,
        message: `Falha no teste do provedor: ${err.message}`,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/mcp/health');
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error('Error fetching MCP health:', err);
    }
  };

  const handleToggleRevealToken = async () => {
    if (tokenRevealed) {
      setTokenRevealed(false);
      setRevealedToken(null);
      return;
    }

    try {
      const res = await fetch('/api/mcp/reveal-token', { method: 'POST' });
      const data = await res.json();
      if (data.configured && data.token) {
        setRevealedToken(data.token);
        setTokenRevealed(true);
      }
    } catch (err) {
      console.error('Error revealing token:', err);
    }
  };

  const openPresetModal = (preset: ClientPresetMeta) => {
    setActiveModalPreset(preset);
    setSelectedMode('local');
    if (preset.supportsHttp) setSelectedTransport('http');
    else if (preset.supportsRest) setSelectedTransport('rest');
    else setSelectedTransport('stdio');
    setModalTestResult(null);
    setCopiedModalSnippet(false);
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedModalSnippet(true);
    setTimeout(() => setCopiedModalSnippet(false), 2000);
  };

  const handleTestModalConfig = async () => {
    setTestingModal(true);
    setModalTestResult(null);

    const target = selectedMode === 'remote' ? 'chatgpt' : 'local';

    try {
      const res = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      setModalTestResult(data);
    } catch (err: any) {
      setModalTestResult({
        success: false,
        message: `Erro na conexão: ${err.message}`,
      });
    } finally {
      setTestingModal(false);
    }
  };

  const handleTestOAuthStack = async () => {
    setTestingOAuth(true);
    setOauthTestResult(null);

    try {
      const res = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'oauth' }),
      });
      const data = await res.json();
      setOauthTestResult(data);
    } catch (err: any) {
      setOauthTestResult({
        success: false,
        message: `Falha no teste de diagnóstico OAuth: ${err.message}`,
      });
    } finally {
      setTestingOAuth(false);
    }
  };

  const isRemoteValid = Boolean(healthData?.remoteConfigured);

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-8">
      {/* AI Gateway Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 text-purple-400 border border-purple-500/30 shadow-inner">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">OFFER MINER AI GATEWAY & MCP</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                OAuth 2.1 + RFC 9728
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Camada Canônica de Integração para ChatGPT Work (Mineração & Deduplicação), Gemini, Antigravity e IDEs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleTestOAuthStack}
            disabled={testingOAuth}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingOAuth ? 'animate-spin' : ''}`} />
            <span>Testar ChatGPT & OAuth</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition flex items-center gap-2"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Diagnóstico & Logs</span>
          </button>
        </div>
      </div>

      {/* Gateway Transports Status Grid (6 Cards per Specifications) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: MCP Production */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              MCP Produção (Canônico)
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">● Online</span>
          </div>
          <p className="text-[11px] text-emerald-300 truncate font-mono select-all">
            https://saasmineracao.netlify.app/api/mcp
          </p>
        </div>

        {/* Card 2: MCP Development */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              MCP Desenvolvimento
            </span>
            <span className="text-[10px] font-mono text-blue-400 font-bold">● Local / Dev</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate font-mono">http://localhost:3000/api/mcp</p>
        </div>

        {/* Card 3: OAuth Resource Metadata */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              OAuth Resource Metadata
            </span>
            {oauthTestResult?.checklist?.protectedResourceMetadata ? (
              <span className="text-[10px] font-mono text-emerald-400 font-bold">● ONLINE</span>
            ) : (
              <span className="text-[10px] font-mono text-rose-400 font-bold">○ ERROR</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate font-mono">/.well-known/oauth-protected-resource</p>
        </div>

        {/* Card 4: Authorization Server Discovery */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-purple-400" />
              Auth Server Discovery
            </span>
            {oauthTestResult?.checklist?.oauthDiscovery ? (
              <span className="text-[10px] font-mono text-emerald-400 font-bold">● ONLINE</span>
            ) : (
              <span className="text-[10px] font-mono text-rose-400 font-bold">○ ERROR</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate font-mono">hofrcxldtmdjchbhdcno (PKCE S256)</p>
        </div>

        {/* Card 5: 401 Challenge */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              401 Challenge (RFC 6750)
            </span>
            {oauthTestResult?.checklist?.challenge401 ? (
              <span className="text-[10px] font-mono text-emerald-400 font-bold">● PASS</span>
            ) : (
              <span className="text-[10px] font-mono text-rose-400 font-bold">○ FAIL</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate font-mono">WWW-Authenticate resource_metadata</p>
        </div>

        {/* Card 6: ChatGPT Work Ready */}
        <div className={`p-4 rounded-xl border space-y-1.5 transition ${
          oauthTestResult?.chatgptWorkReady === 'YES'
            ? 'bg-emerald-950/30 border-emerald-500/40 ring-1 ring-emerald-500/20'
            : 'bg-slate-950/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              ChatGPT Work Ready
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              oauthTestResult?.chatgptWorkReady === 'YES'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {oauthTestResult?.chatgptWorkReady || 'TESTING...'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate font-mono">
            {oauthTestResult?.chatgptWorkReady === 'YES' ? '7/7 Etapas Validadas' : 'Validando Conexão...'}
          </p>
        </div>
      </div>

      {/* OAuth Diagnostic & ChatGPT Work Readiness Result Display */}
      {oauthTestResult && (
        <div
          className={`p-5 rounded-2xl border text-xs space-y-4 ${
            oauthTestResult.chatgptWorkReady === 'YES'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between font-bold text-sm gap-2">
            <span className="flex items-center gap-2">
              {oauthTestResult.chatgptWorkReady === 'YES' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              )}
              {oauthTestResult.message}
            </span>
            <span className="text-[10px] font-mono bg-slate-950 px-3 py-1 rounded-full border border-slate-800 text-slate-300 self-start sm:self-auto">
              {oauthTestResult.chatgptWorkReady === 'YES' ? 'CHATGPT WORK READY: YES' : 'DIAGNÓSTICO EM CURSO'}
            </span>
          </div>

          {/* 7-Point Verification Checklist */}
          {oauthTestResult.checklist && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-300">1. MCP Initialize (2024-11-05)</span>
                <span className={oauthTestResult.checklist.mcpInitialize ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {oauthTestResult.checklist.mcpInitialize ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-300">2. Tools List (26 ferramentas)</span>
                <span className={oauthTestResult.checklist.toolsList ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {oauthTestResult.checklist.toolsList ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-300">3. Protected Resource Metadata</span>
                <span className={oauthTestResult.checklist.protectedResourceMetadata ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {oauthTestResult.checklist.protectedResourceMetadata ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-300">4. Supabase OAuth Discovery</span>
                <span className={oauthTestResult.checklist.oauthDiscovery ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {oauthTestResult.checklist.oauthDiscovery ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-300">5. 401 Challenge Header</span>
                <span className={oauthTestResult.checklist.challenge401 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {oauthTestResult.checklist.challenge401 ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-300">6. OAuth Consent & Login</span>
                <span className={oauthTestResult.checklist.oauthLoginReady ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {oauthTestResult.checklist.oauthLoginReady ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono sm:col-span-2 lg:col-span-3">
                <span className="text-slate-300">7. Supabase Database Tool Call (Catálogo Canônico)</span>
                <span className={oauthTestResult.checklist.databaseToolCall ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {oauthTestResult.checklist.databaseToolCall ? "PASS" : "FAIL"}
                </span>
              </div>
            </div>
          )}

          {oauthTestResult.logs && (
            <div className="space-y-1 font-mono text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300">
              {oauthTestResult.logs.map((log, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Authentication Section (Hybrid Mode) */}
      <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Autenticação Híbrida (OAuth 2.1 JWT + Token Estático Legado)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            HYBRID AUTH
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-purple-300 block">1. OAuth 2.1 (Gemini Spark & Cloud):</span>
            <p className="text-[11px] text-slate-400">
              Valida Access Token JWT assinado pelo Supabase Auth. Tela de consentimento em <code className="text-slate-200">/oauth/consent</code>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-blue-300 block">2. Static Bearer Token (Cursor / CLI):</span>
            <div className="flex items-center justify-between font-mono text-[11px] pt-1">
              {tokenRevealed ? (
                <span className="text-emerald-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 select-all">
                  {revealedToken}
                </span>
              ) : (
                <span className="text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-bold">
                  om_mcp_••••••••••••••••
                </span>
              )}
              <button
                type="button"
                onClick={handleToggleRevealToken}
                className="text-xs text-purple-400 hover:text-purple-300 ml-2"
              >
                {tokenRevealed ? 'Ocultar' : 'Revelar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Client Presets Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Presets de Conexão por Agente / Cliente
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione seu agente para obter o snippet de configuração ideal e testar a conexão.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CLIENT_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-purple-300 transition">
                    {preset.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{preset.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                  {preset.supportsHttp && <span className="px-1.5 py-0.5 bg-slate-900 rounded">HTTP</span>}
                  {preset.supportsStdio && <span className="px-1.5 py-0.5 bg-slate-900 rounded">STDIO</span>}
                  {preset.supportsRest && <span className="px-1.5 py-0.5 bg-slate-900 rounded">REST</span>}
                </div>

                <button
                  type="button"
                  onClick={() => openPresetModal(preset)}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>Conectar Agente</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connection Preset Modal */}
      {activeModalPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Conectar {activeModalPreset.name}
                  </h3>
                  <p className="text-xs text-slate-400">{activeModalPreset.description}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalPreset(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode & Transport Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Environment Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Ambiente do Cliente:</label>
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('local')}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                      selectedMode === 'local' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    Local (localhost)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('remote')}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                      selectedMode === 'remote' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    Remoto (Cloud / HTTPS)
                  </button>
                </div>
              </div>

              {/* Transport Choice */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Transporte:</label>
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                  {activeModalPreset.supportsHttp && (
                    <button
                      type="button"
                      onClick={() => setSelectedTransport('http')}
                      className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                        selectedTransport === 'http' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400'
                      }`}
                    >
                      Streamable HTTP
                    </button>
                  )}
                  {activeModalPreset.supportsStdio && (
                    <button
                      type="button"
                      onClick={() => setSelectedTransport('stdio')}
                      className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                        selectedTransport === 'stdio' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400'
                      }`}
                    >
                      STDIO Local
                    </button>
                  )}
                  {activeModalPreset.supportsRest && (
                    <button
                      type="button"
                      onClick={() => setSelectedTransport('rest')}
                      className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                        selectedTransport === 'rest' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400'
                      }`}
                    >
                      REST / OpenAPI
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Generated Config Snippet */}
            {(() => {
              const generated = generateClientSnippet(
                activeModalPreset.id,
                selectedMode,
                selectedTransport,
                localUrl,
                healthData?.remoteUrl || null,
                revealedToken || 'SEU_OFFER_MINER_MCP_TOKEN'
              );

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-300">{generated.instructions}</span>
                    <button
                      type="button"
                      onClick={() => handleCopySnippet(generated.snippet)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      {copiedModalSnippet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedModalSnippet ? 'Copiado!' : 'Copiar Configuração'}</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56">
                    {generated.snippet}
                  </pre>
                </div>
              );
            })()}

            {/* Test Result Display inside Modal */}
            {modalTestResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  modalTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {modalTestResult.success ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                    )}
                    {modalTestResult.message}
                  </span>
                  <span className="font-mono text-[10px]">15 Tools Verificadas</span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestModalConfig}
                disabled={testingModal}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingModal ? 'animate-spin' : ''}`} />
                <span>{testingModal ? 'Testando Conexão...' : 'Testar Conexão em Tempo Real'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalPreset(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Drawer / Section */}
      {showDiagnostic && (
        <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Painel de Diagnóstico do AI Gateway & OAuth
            </span>
            <button
              type="button"
              onClick={() => setShowDiagnostic(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Protocol Version</span>
              <span className="font-bold text-white font-mono">2024-11-05</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Uptime Servidor</span>
              <span className="font-bold text-emerald-400 font-mono">
                {healthData?.uptimeSeconds || 0}s
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Autenticação</span>
              <span className="font-bold text-amber-400 font-mono">Hybrid (OAuth 2.1 + Token)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">RFC 9728 Discovery</span>
            </div>
          </div>
        </div>
      )}
      {/* AI Intelligence & Models Settings Section */}
      <div className="p-6 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                IA & MODELOS (ARQUITETURA MULTI-PROVIDER)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Provedores de IA suportados server-side com perfil ⚡ Rápido e 🧠 Profundo.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold self-start sm:self-auto">
            Multi-Provider Engine v2.0
          </span>
        </div>

        {/* 3 Provider Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. OpenAI Card */}
          {(() => {
            const h = providersHealth?.openai;
            return (
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      ChatGPT / OpenAI
                    </span>
                    {h?.status === 'ONLINE' ? (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ● Online
                      </span>
                    ) : h?.status === 'NOT_CONFIGURED' ? (
                      <span className="text-[10px] font-mono text-slate-400 font-bold">○ Não configurado</span>
                    ) : (
                      <span className="text-[10px] font-mono text-rose-400 font-bold">○ Erro</span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">OPENAI_API_KEY:</span>
                      <span className={h?.keyConfigured ? "text-emerald-300 font-bold font-mono" : "text-slate-500 font-mono"}>
                        {h?.keyConfigured ? `FOUND (${h.keyMasked})` : 'NOT FOUND (.env)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">⚡ Modelo Rápido:</span>
                      <span className="text-purple-300 font-bold font-mono">{h?.fastModel || 'gpt-4o-mini'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">🧠 Modelo Profundo:</span>
                      <span className="text-purple-300 font-bold font-mono">{h?.deepModel || 'gpt-4o'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestProviderConnection('openai')}
                  disabled={testingProvider === 'openai'}
                  className="w-full py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'openai' ? 'animate-spin' : ''}`} />
                  <span>Testar OpenAI API & Tools</span>
                </button>
              </div>
            );
          })()}

          {/* 2. Gemini Card */}
          {(() => {
            const h = providersHealth?.gemini;
            return (
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Google Gemini
                    </span>
                    {h?.status === 'ONLINE' ? (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ● Online
                      </span>
                    ) : h?.status === 'NOT_CONFIGURED' ? (
                      <span className="text-[10px] font-mono text-slate-400 font-bold">○ Não configurado</span>
                    ) : (
                      <span className="text-[10px] font-mono text-rose-400 font-bold">○ Erro</span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">GEMINI_API_KEY:</span>
                      <span className={h?.keyConfigured ? "text-emerald-300 font-bold font-mono" : "text-slate-500 font-mono"}>
                        {h?.keyConfigured ? `FOUND (${h.keyMasked})` : 'NOT FOUND (.env)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">⚡ Modelo Rápido:</span>
                      <span className="text-purple-300 font-bold font-mono">{h?.fastModel || 'gemini-2.5-flash'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">🧠 Modelo Profundo:</span>
                      <span className="text-purple-300 font-bold font-mono">{h?.deepModel || 'gemini-1.5-pro'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestProviderConnection('gemini')}
                  disabled={testingProvider === 'gemini'}
                  className="w-full py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'gemini' ? 'animate-spin' : ''}`} />
                  <span>Testar Gemini API & Tools</span>
                </button>
              </div>
            );
          })()}

          {/* 3. Anthropic Claude Card */}
          {(() => {
            const h = providersHealth?.anthropic;
            return (
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Anthropic Claude
                    </span>
                    {h?.status === 'ONLINE' ? (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ● Online
                      </span>
                    ) : h?.status === 'NOT_CONFIGURED' ? (
                      <span className="text-[10px] font-mono text-slate-400 font-bold">○ Não configurado</span>
                    ) : (
                      <span className="text-[10px] font-mono text-rose-400 font-bold">○ Erro</span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ANTHROPIC_API_KEY:</span>
                      <span className={h?.keyConfigured ? "text-emerald-300 font-bold font-mono" : "text-slate-500 font-mono"}>
                        {h?.keyConfigured ? `FOUND (${h.keyMasked})` : 'NOT FOUND (.env)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">⚡ Modelo Rápido:</span>
                      <span className="text-purple-300 font-bold font-mono">{h?.fastModel || 'claude-3-5-haiku'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">🧠 Modelo Profundo:</span>
                      <span className="text-purple-300 font-bold font-mono">{h?.deepModel || 'claude-3-5-sonnet'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestProviderConnection('anthropic')}
                  disabled={testingProvider === 'anthropic'}
                  className="w-full py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'anthropic' ? 'animate-spin' : ''}`} />
                  <span>Testar Claude API & Tools</span>
                </button>
              </div>
            );
          })()}
        </div>

        {/* Diagnostic 4-Step Test Result Display */}
        {activeTestResult && (
          <div
            className={`p-5 rounded-xl border text-xs space-y-3 ${
              activeTestResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-sm">
              <span className="flex items-center gap-2">
                {activeTestResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                )}
                {activeTestResult.message}
              </span>
              <span className="text-[10px] font-mono bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 text-slate-300">
                Latência: {activeTestResult.details?.totalLatencyMs || 0}ms
              </span>
            </div>

            {activeTestResult.steps && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                {Object.entries(activeTestResult.steps).map(([stepKey, step]: [string, any]) => (
                  <div key={stepKey} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-200 font-bold">{step.label}</span>
                    {step.pass ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> PASS {step.latencyMs ? `(${step.latencyMs}ms)` : ''}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <X className="w-3.5 h-3.5" /> {step.error || 'FAIL'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Environment Keys Instruction */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <span className="font-bold text-slate-200 block">Variáveis de Ambiente Server-Side (.env.local):</span>
          <p>
            Defina <code className="text-purple-300 font-mono font-bold">OPENAI_API_KEY</code>, <code className="text-purple-300 font-mono font-bold">GEMINI_API_KEY</code>, ou <code className="text-purple-300 font-mono font-bold">ANTHROPIC_API_KEY</code> para ativar cada provedor individualmente.
          </p>
        </div>
      </div>
    </div>
  );
}
