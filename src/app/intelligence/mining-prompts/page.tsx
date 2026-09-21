'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Sparkles,
  Zap,
  Copy,
  Download,
  Save,
  RotateCcw,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  Filter,
  ShieldCheck,
  Clock,
  DollarSign,
  Globe,
  Sliders,
  CheckCircle2,
  X,
  History as HistoryIcon,
  BookOpen,
  ArrowLeft,
  Flame,
  Building2,
  Lock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  MiningPromptConfig,
  DEFAULT_MINING_CONFIG,
  MINING_PRESETS,
  DEFAULT_OUTPUT_FIELDS,
  validateMiningConfig,
} from '@/lib/ai-intelligence/mining-prompt-types';
import { compileMiningPrompt } from '@/lib/ai-intelligence/mining-prompt-compiler';
import { dbService } from '@/lib/supabase/db';

const FORMAT_OPTIONS = [
  'PDF',
  'Ebook',
  'Printable',
  'Templates',
  'Cards',
  'Planilhas',
  'Calculadoras',
  'Ferramenta',
  'Prompts',
  'Guias',
  'Outro',
];

const EXCLUDED_FORMAT_OPTIONS = [
  'Produto Físico',
  'Curso de Expert',
  'SaaS',
  'Comunidade',
  'Mentoria',
  'Coaching',
];

export default function WorkerPromptStudioPage() {
  const [config, setConfig] = useState<MiningPromptConfig>(DEFAULT_MINING_CONFIG);
  const [dbOffers, setDbOffers] = useState<any[]>([]);

  // Sections Collapse States
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    A: true,
    B: true,
    C: true,
    D: true,
    E: true,
    F: true,
    G: false,
    H: false,
    I: true,
    J: false,
  });

  // Generated Prompt & Claude Refinement State
  const [compiledResult, setCompiledResult] = useState<any>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [isRefiningClaude, setIsRefiningClaude] = useState(false);
  const [claudeAuditResult, setClaudeAuditResult] = useState<any>(null);

  // UI Modals & Feedback
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [savedHistory, setSavedHistory] = useState<any[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeKeywordInput, setExcludeKeywordInput] = useState('');

  // Fetch mapped DB offers for exclusion manifest & history
  useEffect(() => {
    dbService.getOffers().then((offers) => {
      setDbOffers(offers || []);
    }).catch(() => []);

    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/intelligence/mining-prompts');
      const data = await res.json();
      if (data.prompts) setSavedHistory(data.prompts);
    } catch {}
  };

  // Compile Base Prompt (Layer 1) deterministically
  useEffect(() => {
    const res = compileMiningPrompt(config, dbOffers);
    setCompiledResult(res);
    // If user hasn't audited with Claude yet, prompt defaults to compiled base
    if (!claudeAuditResult) {
      setCurrentPrompt(res.prompt);
    }
  }, [config, dbOffers, claudeAuditResult]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyPreset = (patch: Partial<MiningPromptConfig>) => {
    setClaudeAuditResult(null);
    setConfig((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  // Run Claude Refinement (Layer 2)
  const handleRefineWithClaude = async () => {
    setIsRefiningClaude(true);
    try {
      const res = await fetch('/api/intelligence/mining-prompts/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          compiledPrompt: compiledResult?.prompt,
        }),
      });

      const data = await res.json();
      if (data.finalPrompt) {
        setCurrentPrompt(data.finalPrompt);
        setClaudeAuditResult(data);
      }
    } catch (err) {
      console.error('Error refining with Claude:', err);
    } finally {
      setIsRefiningClaude(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!currentPrompt) return;
    navigator.clipboard.writeText(currentPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!currentPrompt) return;
    const blob = new Blob([currentPrompt], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mining_prompt_${config.name.toLowerCase().replace(/\s+/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveTemplate = async () => {
    try {
      const res = await fetch('/api/intelligence/mining-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          configJson: config,
          generatedPrompt: compiledResult?.prompt,
          refinedPrompt: claudeAuditResult?.finalPrompt,
          model: claudeAuditResult?.model || 'claude-sonnet-5',
        }),
      });

      const data = await res.json();
      if (data.prompt) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
        await fetchHistory();
      }
    } catch (err) {
      console.error('Error saving template:', err);
    }
  };

  // Multi-input tag helpers
  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    if (!config.keywords.includes(keywordInput.trim())) {
      setConfig((prev) => ({ ...prev, keywords: [...prev.keywords, keywordInput.trim()] }));
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setConfig((prev) => ({ ...prev, keywords: prev.keywords.filter((k) => k !== kw) }));
  };

  const addExcludeKeyword = () => {
    if (!excludeKeywordInput.trim()) return;
    if (!config.excludeKeywords.includes(excludeKeywordInput.trim())) {
      setConfig((prev) => ({ ...prev, excludeKeywords: [...prev.excludeKeywords, excludeKeywordInput.trim()] }));
    }
    setExcludeKeywordInput('');
  };

  const removeExcludeKeyword = (kw: string) => {
    setConfig((prev) => ({ ...prev, excludeKeywords: prev.excludeKeywords.filter((k) => k !== kw) }));
  };

  const toggleFormat = (listKey: 'allowedFormats' | 'excludedFormats', format: string) => {
    setConfig((prev) => {
      const list = prev[listKey];
      const exists = list.includes(format);
      return {
        ...prev,
        [listKey]: exists ? list.filter((f) => f !== format) : [...list, format],
      };
    });
  };

  const toggleOutputField = (field: string) => {
    setConfig((prev) => {
      const exists = prev.outputFields.includes(field);
      return {
        ...prev,
        outputFields: exists ? prev.outputFields.filter((f) => f !== field) : [...prev.outputFields, field],
      };
    });
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-16 font-sans">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                href="/intelligence"
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Voltar a Inteligência</span>
              </Link>

              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold font-mono">
                <Terminal className="w-3 h-3 text-purple-400" />
                <span>WORKER PROMPT STUDIO</span>
              </span>
            </div>

            <h1 className="text-3xl font-black text-white tracking-tight">
              Gerador de Prompts de Mineração
            </h1>
            <p className="text-xs text-slate-400">
              Configure os critérios operacionais e gere uma instrução completa, à prova de erros, para o Worker.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => {
                setConfig(DEFAULT_MINING_CONFIG);
                setClaudeAuditResult(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>+ NOVO PROMPT</span>
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition flex items-center gap-1.5"
            >
              <HistoryIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>HISTÓRICO ({savedHistory.length})</span>
            </button>
          </div>
        </div>

        {/* PRESETS BAR */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            PRESETS RÁPIDOS DE MINERAÇÃO:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MINING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.configPatch)}
                className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition space-y-1 group"
              >
                <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 block">
                  ⚡ {preset.name}
                </span>
                <span className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN SPLIT VIEW LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: CONFIGURATION BUILDER (5 COLS) */}
          <div className="lg:col-span-6 space-y-4">
            {/* SECTION A: OBJETIVO DA MISSÃO */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div
                onClick={() => toggleSection('A')}
                className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 font-mono">SEÇÃO A</span>
                  <h3 className="text-sm font-bold text-white">Objetivo & Quantidade</h3>
                </div>
                {openSections.A ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {openSections.A && (
                <div className="p-5 space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">NOME INTERNO DA MISSÃO:</label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Low Ticket Educação 15"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">QUANTIDADE DE OFERTAS (targetOffers):</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[5, 10, 15, 25, 50].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, targetOffers: num }))}
                          className={`py-2 rounded-xl font-bold border transition ${
                            config.targetOffers === num
                              ? 'bg-amber-500 text-slate-950 border-amber-500'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">PAÍS ALVO:</label>
                      <input
                        type="text"
                        value={config.country}
                        onChange={(e) => setConfig((prev) => ({ ...prev, country: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">IDIOMA:</label>
                      <input
                        type="text"
                        value={config.language}
                        onChange={(e) => setConfig((prev) => ({ ...prev, language: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION B: NICHO & KEYWORDS */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div
                onClick={() => toggleSection('B')}
                className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 font-mono">SEÇÃO B</span>
                  <h3 className="text-sm font-bold text-white">Nicho, Subnicho & Keywords</h3>
                </div>
                {openSections.B ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {openSections.B && (
                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, nicheMode: 'ANY_NICHE', niche: '' }))}
                      className={`py-2 rounded-xl font-bold border transition ${
                        config.nicheMode === 'ANY_NICHE'
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      QUALQUER NICHO
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, nicheMode: 'SPECIFIC_NICHE' }))}
                      className={`py-2 rounded-xl font-bold border transition ${
                        config.nicheMode === 'SPECIFIC_NICHE'
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      NICHO ESPECÍFICO
                    </button>
                  </div>

                  {config.nicheMode === 'SPECIFIC_NICHE' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-300">NICHO:</label>
                        <input
                          type="text"
                          value={config.niche || ''}
                          onChange={(e) => setConfig((prev) => ({ ...prev, niche: e.target.value }))}
                          placeholder="Ex: Educação"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-300">SUBNICHO (Opcional):</label>
                        <input
                          type="text"
                          value={config.subniche || ''}
                          onChange={(e) => setConfig((prev) => ({ ...prev, subniche: e.target.value }))}
                          placeholder="Ex: Alfabetização"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                        />
                      </div>
                    </div>
                  )}

                  {/* KEYWORDS */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-300">KEYWORDS DE BUSCA (Multi-input):</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                        placeholder="Digite termo de busca..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={addKeyword}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-amber-400"
                      >
                        + Add
                      </button>
                    </div>
                    {config.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {config.keywords.map((kw) => (
                          <span key={kw} className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                            <span>{kw}</span>
                            <button onClick={() => removeKeyword(kw)} className="hover:text-white">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* EXCLUDE KEYWORDS */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-300">KEYWORDS A EXCLUIR:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={excludeKeywordInput}
                        onChange={(e) => setExcludeKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addExcludeKeyword();
                          }
                        }}
                        placeholder="Ex: 'grátis', 'consultoria'..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={addExcludeKeyword}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-rose-400"
                      >
                        + Excluir
                      </button>
                    </div>
                    {config.excludeKeywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {config.excludeKeywords.map((kw) => (
                          <span key={kw} className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                            <span>{kw}</span>
                            <button onClick={() => removeExcludeKeyword(kw)} className="hover:text-white">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION C: TIPO DE OFERTA & FORMATO */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div
                onClick={() => toggleSection('C')}
                className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 font-mono">SEÇÃO C</span>
                  <h3 className="text-sm font-bold text-white">Tipo de Oferta, Faceless & Formatos</h3>
                </div>
                {openSections.C ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {openSections.C && (
                <div className="p-5 space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <span className="font-bold text-slate-200 block">SOMENTE PRODUTOS DIGITAIS</span>
                      <span className="text-[10px] text-slate-500">Excluir produtos físicos por padrão</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.digitalOnly}
                      onChange={(e) => setConfig((prev) => ({ ...prev, digitalOnly: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">FACELESS (SEM ESPECIALISTA APARENTE):</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Required', 'Preferred', 'Any'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, facelessPreference: opt as any }))}
                          className={`py-2 rounded-xl font-bold border transition ${
                            config.facelessPreference === opt
                              ? 'bg-amber-500 text-slate-950 border-amber-500'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {opt === 'Required' ? 'Obrigatório' : opt === 'Preferred' ? 'Preferível' : 'Indiferente'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PERMITIDOS */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-300">FORMATOS PERMITIDOS:</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {FORMAT_OPTIONS.map((fmt) => {
                        const isSelected = config.allowedFormats.includes(fmt);
                        return (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => toggleFormat('allowedFormats', fmt)}
                            className={`px-2.5 py-1 rounded-xl border text-[10px] transition ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}{fmt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* EXCLUÍDOS */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-300">FORMATOS EXCLUÍDOS:</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {EXCLUDED_FORMAT_OPTIONS.map((fmt) => {
                        const isSelected = config.excludedFormats.includes(fmt);
                        return (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => toggleFormat('excludedFormats', fmt)}
                            className={`px-2.5 py-1 rounded-xl border text-[10px] transition ${
                              isSelected
                                ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {isSelected ? '✕ ' : ''}{fmt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION D: PREÇO / TICKET */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div
                onClick={() => toggleSection('D')}
                className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 font-mono">SEÇÃO D</span>
                  <h3 className="text-sm font-bold text-white">Faixa de Preço (Ticket Front)</h3>
                </div>
                {openSections.D ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {openSections.D && (
                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">PREÇO MÍNIMO (R$):</label>
                      <input
                        type="number"
                        value={config.minFrontPrice ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            minFrontPrice: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                        placeholder="Ex: 10"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">PREÇO MÁXIMO (R$):</label>
                      <input
                        type="number"
                        value={config.maxFrontPrice ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            maxFrontPrice: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                        placeholder="Ex: 50"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION E: META ADS METRICS */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div
                onClick={() => toggleSection('E')}
                className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 font-mono">SEÇÃO E</span>
                  <h3 className="text-sm font-bold text-white">Métricas de Anúncios no Meta Ads</h3>
                </div>
                {openSections.E ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {openSections.E && (
                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">MÍNIMO DE ADS ATIVOS:</label>
                      <input
                        type="number"
                        value={config.minActiveAds ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            minActiveAds: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                        placeholder="Ex: 5"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">MÁXIMO DE ADS ATIVOS:</label>
                      <input
                        type="number"
                        value={config.maxActiveAds ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            maxActiveAds: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                        placeholder="Ex: 50 (Vazio = ilimitado)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">MÍNIMO DIAS RODANDO:</label>
                      <input
                        type="number"
                        value={config.minDaysActive ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            minDaysActive: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                        placeholder="Ex: 10"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">MÁXIMO DIAS RODANDO:</label>
                      <input
                        type="number"
                        value={config.maxDaysActive ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            maxDaysActive: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                        placeholder="Ex: 60"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION F: REQUISITOS DE FUNIL & LINKS */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div
                onClick={() => toggleSection('F')}
                className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 font-mono">SEÇÃO F</span>
                  <h3 className="text-sm font-bold text-white">Requisitos de Funil & Links</h3>
                </div>
                {openSections.F ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {openSections.F && (
                <div className="p-5 space-y-3 text-xs">
                  {[
                    { key: 'requireLandingPage', label: 'EXIGIR LANDING PAGE', sub: 'Destino da ad precisa abrir uma LP ativa' },
                    { key: 'requireCheckout', label: 'EXIGIR CHECKOUT VISÍVEL', sub: 'Destino direto ou acessível para checkout' },
                    { key: 'requirePriceVisible', label: 'EXIGIR PREÇO VISÍVEL NA PÁGINA', sub: 'Ignorar se preço não for descoberto' },
                    { key: 'requireMetaAdsLink', label: 'EXIGIR META ADS URL ESPECÍFICO', sub: 'Proibir buscas genéricas como meta_ads_url' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div>
                        <span className="font-bold text-slate-200 block">{item.label}</span>
                        <span className="text-[10px] text-slate-500">{item.sub}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={(config as any)[item.key]}
                        onChange={(e) => setConfig((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-900"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION I: DEDUPE & MANIFEST */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div
                onClick={() => toggleSection('I')}
                className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 font-mono">SEÇÃO I</span>
                  <h3 className="text-sm font-bold text-white">Desduplicação & Exclusion Manifest</h3>
                </div>
                {openSections.I ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {openSections.I && (
                <div className="p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <span className="font-bold text-slate-200 block">EXCLUIR OFERTAS JÁ MINERADAS</span>
                      <span className="text-[10px] text-slate-500">
                        Injetar manifesto de {compiledResult?.manifest?.length || 0} ofertas mapeadas no Offer Miner
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.excludeMinedOffers}
                      onChange={(e) => setConfig((prev) => ({ ...prev, excludeMinedOffers: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: STICKY MEGA PROMPT PREVIEW & STATS (6 COLS) */}
          <div className="lg:col-span-6 space-y-4 sticky top-6">
            {/* STATS & VALIDATION BAR */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">
                    PROMPT ARCHITECT AUDIT
                  </span>
                </div>
                {claudeAuditResult ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Claude Sonnet 5 Audited
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono">
                    Prompt Compilado (Base 1.0)
                  </span>
                )}
              </div>

              {/* Contradiction Warnings */}
              {compiledResult?.validationErrors && compiledResult.validationErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Contradição de Filtros Detectada:</span>
                  </div>
                  {compiledResult.validationErrors.map((err: string, i: number) => (
                    <p key={i} className="text-[11px] font-mono pl-5">• {err}</p>
                  ))}
                </div>
              )}

              {/* Stats Counters */}
              <div className="grid grid-cols-4 gap-2 text-[10px] font-mono text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block">CARACTERES</span>
                  <span className="font-bold text-white text-xs">{currentPrompt.length}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block">EST. TOKENS</span>
                  <span className="font-bold text-amber-300 text-xs">~{Math.ceil(currentPrompt.length / 4)}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block">EXCLUSÕES</span>
                  <span className="font-bold text-cyan-400 text-xs">{compiledResult?.manifest?.length || 0}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block">FILTROS HARD</span>
                  <span className="font-bold text-purple-400 text-xs">{compiledResult?.hardFiltersCount || 0}</span>
                </div>
              </div>

              {claudeAuditResult?.stats && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-[11px] font-mono flex items-center justify-between text-slate-300">
                  <span>Tokens Uso: {claudeAuditResult.stats.inputTokens} in / {claudeAuditResult.stats.outputTokens} out</span>
                  <span className="text-emerald-400 font-bold">Custo Est: ${claudeAuditResult.stats.costUsd.toFixed(4)}</span>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS TOOLBAR */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleRefineWithClaude}
                disabled={isRefiningClaude}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>{isRefiningClaude ? 'Refinando com Claude...' : '✦ REFINAR COM CLAUDE'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPrompt}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                title="Baixar em .md"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleSaveTemplate}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                title="Salvar Template"
              >
                {savedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
              </button>
            </div>

            {/* MEGA PROMPT CODE PREVIEW AREA */}
            <div className="rounded-2xl bg-[#090D14] border border-slate-800/90 shadow-2xl overflow-hidden flex flex-col h-[600px]">
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Terminal className="w-3.5 h-3.5" />
                  PROMPT COMPILADO
                </span>
                <span>Markdown Output Contract</span>
              </div>

              <div className="p-5 flex-1 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-amber-500/30">
                {currentPrompt}
              </div>
            </div>
          </div>
        </div>

        {/* HISTORY & TEMPLATES MODAL */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Histórico de Prompts Salvos</h3>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {savedHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">Nenhum prompt salvo no histórico.</div>
                ) : (
                  savedHistory.map((h) => (
                    <div key={h.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{h.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Criado em: {new Date(h.createdAt).toLocaleDateString()} | v{h.version}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (h.configJson) setConfig(h.configJson);
                          if (h.refinedPrompt || h.generatedPrompt) setCurrentPrompt(h.refinedPrompt || h.generatedPrompt);
                          setShowHistoryModal(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                      >
                        Carregar Template
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
