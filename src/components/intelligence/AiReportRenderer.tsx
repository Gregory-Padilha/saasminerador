'use client';

import React from 'react';
import {
  Sparkles,
  ExternalLink,
  Layers,
  Globe,
  ShoppingCart,
  Image as ImageIcon,
  Flame,
  ArrowRight,
  TrendingUp,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  BookOpen,
} from 'lucide-react';
import { AISourceReference } from '@/lib/ai-intelligence/types';

interface AiReportRendererProps {
  content: string;
  sources?: AISourceReference[];
  onSelectSource?: (source: AISourceReference) => void;
  onSendMessage?: (prompt: string) => void;
}

/**
 * Custom Dark-Mode Editorial Markdown & Citation Renderer for Offer Miner AI Intelligence
 */
export function AiReportRenderer({
  content,
  sources = [],
  onSelectSource,
  onSendMessage,
}: AiReportRendererProps) {
  // 1. Process inline source markers: [[source:type:id]] or [Text](source:type:id)
  const renderFormattedText = (text: string) => {
    // Replace citation patterns with clickable source chips
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Matches [[source:type:id]] or [Text](source:type:id) or [Oferta|LP|Checkout|Criativo|Conhecimento: Title]
    const citationRegex = /\[(?:\[source:(offer|landing_page|checkout|creative|deep_dive|knowledge):([^\]]+)\]\]|([^\]]+)\]\(source:(offer|landing_page|checkout|creative|deep_dive|knowledge):([^\)]+)\)|\[(Oferta|LP|Checkout|Criativo|Conhecimento):\s*([^\]]+)\])/g;

    let match;
    let keyIdx = 0;

    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(parseInlineFormatting(text.substring(lastIndex, match.index), `txt_${keyIdx++}`));
      }

      const type = match[1] || match[4] || (match[6] === 'Oferta' ? 'offer' : match[6] === 'LP' ? 'landing_page' : match[6] === 'Checkout' ? 'checkout' : match[6] === 'Conhecimento' ? 'knowledge' : 'creative');
      const idOrTitle = match[2] || match[5] || match[7];
      const linkText = match[3] || match[7] || idOrTitle;

      // Find matching source entity
      const matchedSource = sources.find((s) => s.id === idOrTitle || s.title.toLowerCase().includes(idOrTitle.toLowerCase()));

      parts.push(
        <button
          key={`chip_${keyIdx++}`}
          type="button"
          onClick={() => {
            if (matchedSource && onSelectSource) {
              onSelectSource(matchedSource);
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-md bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-semibold transition active:scale-95 cursor-pointer align-baseline"
          title={`Ver fonte: ${matchedSource?.title || linkText}`}
        >
          {type === 'offer' && <Layers className="w-3 h-3 text-blue-400" />}
          {type === 'landing_page' && <Globe className="w-3 h-3 text-emerald-400" />}
          {type === 'checkout' && <ShoppingCart className="w-3 h-3 text-amber-400" />}
          {type === 'creative' && <ImageIcon className="w-3 h-3 text-pink-400" />}
          {type === 'deep_dive' && <Flame className="w-3 h-3 text-rose-400" />}
          {type === 'knowledge' && <BookOpen className="w-3 h-3 text-cyan-400" />}
          <span className="truncate max-w-[200px]">{linkText}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </button>
      );

      lastIndex = citationRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(parseInlineFormatting(text.substring(lastIndex), `txt_${keyIdx++}`));
    }

    return parts;
  };

  // Helper for bold, italic, code inline formatting
  const parseInlineFormatting = (str: string, keyPrefix: string): React.ReactNode => {
    // Splits **bold**, *italic*, `code`
    const subParts: React.ReactNode[] = [];
    let remaining = str;
    let i = 0;

    // Simple regex parse for **bold** and `code`
    const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    let m;
    let last = 0;

    while ((m = tokenRegex.exec(str)) !== null) {
      if (m.index > last) {
        subParts.push(str.substring(last, m.index));
      }
      const val = m[0];
      if (val.startsWith('**') && val.endsWith('**')) {
        subParts.push(
          <strong key={`${keyPrefix}_b_${i++}`} className="font-extrabold text-white">
            {val.slice(2, -2)}
          </strong>
        );
      } else if (val.startsWith('`') && val.endsWith('`')) {
        subParts.push(
          <code
            key={`${keyPrefix}_c_${i++}`}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[12px] border border-slate-700/60"
          >
            {val.slice(1, -1)}
          </code>
        );
      } else if (val.startsWith('*') && val.endsWith('*')) {
        subParts.push(
          <em key={`${keyPrefix}_i_${i++}`} className="italic text-slate-300">
            {val.slice(1, -1)}
          </em>
        );
      }
      last = tokenRegex.lastIndex;
    }

    if (last < str.length) {
      subParts.push(str.substring(last));
    }

    return <React.Fragment key={keyPrefix}>{subParts}</React.Fragment>;
  };

  // 2. Parse Markdown Blocks (Headers, Tables, Lists, Callouts)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];
  let elementKey = 0;

  const flushTable = () => {
    if (tableHeader.length > 0) {
      elements.push(
        <div
          key={`tbl_${elementKey++}`}
          className="my-5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-xl"
        >
          <table className="w-full text-left text-xs text-slate-200 border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-4 py-3 font-semibold">
                    {renderFormattedText(h.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tableRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-slate-900/50 transition-colors font-mono tabular-nums text-slate-300"
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap">
                      {renderFormattedText(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableHeader = [];
    tableRows = [];
    inTable = false;
  };

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];
    const trimmed = line.trim();

    // Markdown Table Detector
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        // Table divider line line - ignore
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty line
    if (!trimmed) {
      elements.push(<div key={`sp_${elementKey++}`} className="h-3" />);
      continue;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2
          key={`h1_${elementKey++}`}
          className="text-lg font-extrabold text-white tracking-tight pt-4 pb-2 border-b border-slate-800 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{renderFormattedText(trimmed.replace(/^#\s+/, ''))}</span>
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      const title = trimmed.replace(/^##\s+/, '');
      const isFact = /fato|dado|observado/i.test(title);
      const isHypothesis = /hipótese|ponto|investigar/i.test(title);
      const isInterpretation = /interpretação|padrão|insights/i.test(title);

      elements.push(
        <h3
          key={`h2_${elementKey++}`}
          className={`text-base font-bold tracking-tight pt-4 pb-1.5 flex items-center gap-2 ${
            isFact
              ? 'text-cyan-400 border-b border-cyan-500/20'
              : isHypothesis
              ? 'text-amber-400 border-b border-amber-500/20'
              : isInterpretation
              ? 'text-purple-300 border-b border-purple-500/20'
              : 'text-white border-b border-slate-800'
          }`}
        >
          {isFact && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
          {isHypothesis && <HelpCircle className="w-4 h-4 text-amber-400" />}
          {isInterpretation && <Lightbulb className="w-4 h-4 text-purple-400" />}
          <span>{renderFormattedText(title)}</span>
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4
          key={`h3_${elementKey++}`}
          className="text-sm font-bold text-slate-200 tracking-wide pt-3 pb-1 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span>{renderFormattedText(trimmed.replace(/^###\s+/, ''))}</span>
        </h4>
      );
      continue;
    }

    // Callout boxes (📌 Resumo Executivo / 💡 Interpretação / 🧪 Hipóteses)
    if (trimmed.startsWith('> ') || trimmed.startsWith('📌') || trimmed.startsWith('💡') || trimmed.startsWith('🧪')) {
      const textOnly = trimmed.replace(/^>\s*/, '');
      const isCyan = trimmed.includes('📌') || trimmed.includes('Fatos');
      const isAmber = trimmed.includes('🧪') || trimmed.includes('Hipótese');

      elements.push(
        <div
          key={`call_${elementKey++}`}
          className={`my-3 p-4 rounded-2xl border text-xs leading-relaxed space-y-1 shadow-md ${
            isCyan
              ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
              : isAmber
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              : 'bg-purple-950/30 border-purple-500/30 text-purple-200'
          }`}
        >
          {renderFormattedText(textOnly)}
        </div>
      );
      continue;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr_${elementKey++}`} className="my-6 border-slate-800/80" />);
      continue;
    }

    // Bullet Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li
          key={`li_${elementKey++}`}
          className="ml-4 list-disc text-xs text-slate-300 leading-relaxed my-1"
        >
          {renderFormattedText(trimmed.replace(/^[-*]\s+/, ''))}
        </li>
      );
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p_${elementKey++}`} className="text-xs sm:text-sm text-slate-300 leading-relaxed my-1.5">
        {renderFormattedText(line)}
      </p>
    );
  }

  if (inTable) {
    flushTable();
  }

  // Deduplicate sources for bottom footer
  const uniqueSourcesMap = new Map<string, AISourceReference>();
  sources.forEach((s) => {
    uniqueSourcesMap.set(`${s.type}:${s.id}`, s);
  });
  const uniqueSources = Array.from(uniqueSourcesMap.values());

  const offersCount = uniqueSources.filter((s) => s.type === 'offer').length;
  const lpsCount = uniqueSources.filter((s) => s.type === 'landing_page').length;
  const checkoutsCount = uniqueSources.filter((s) => s.type === 'checkout').length;
  const creativesCount = uniqueSources.filter((s) => s.type === 'creative').length;

  return (
    <div className="space-y-4 font-sans text-slate-200 selection:bg-purple-500/30">
      {/* Rendered Editorial Content */}
      <div className="ai-prose space-y-1">{elements}</div>

      {/* Sources Deduplicated Summary Footer Bar */}
      {uniqueSources.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 flex-wrap">
            <span className="text-slate-400">Fontes Únicas Analisadas:</span>
            {offersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-mono">
                {offersCount} ofertas
              </span>
            )}
            {lpsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-mono">
                {lpsCount} LPs
              </span>
            )}
            {checkoutsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono">
                {checkoutsCount} checkouts
              </span>
            )}
            {creativesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[11px] font-mono">
                {creativesCount} criativos
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {uniqueSources.length} fontes vinculadas no painel lateral →
          </span>
        </div>
      )}

      {/* Suggested Follow-up Context Chips */}
      {onSendMessage && (
        <div className="pt-3 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Sugestões de Continuação:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onSendMessage('Aprofunde o pricing e order bumps das maiores ofertas encontradas')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
              <span>Aprofundar Pricing & Order Bumps</span>
            </button>

            <button
              onClick={() => onSendMessage('Quais são os padrões de headline e promessa nas Landing Pages destas ofertas?')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Analisar Headlines das LPs</span>
            </button>

            <button
              onClick={() => onSendMessage('Quais formatos e ganchos de criativos estão gerando mais volume de anúncios?')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
              <span>Estudar Criativos em Escala</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
