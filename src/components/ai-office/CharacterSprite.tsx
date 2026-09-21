'use client';

import React from 'react';
import { VisualAgentState } from '@/lib/ai-office/events';
import {
  Radar,
  FileText,
  Globe,
  ShoppingCart,
  Image as ImageIcon,
  BookOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface CharacterSpriteProps {
  agent: VisualAgentState;
  onClick?: () => void;
  isSelected?: boolean;
}

export function CharacterSprite({ agent, onClick, isSelected }: CharacterSpriteProps) {
  // Department color palettes
  const getDeptColor = () => {
    switch (agent.department) {
      case 'executive':
        return {
          bg: 'bg-purple-950/80',
          border: 'border-purple-500',
          glow: 'shadow-[0_0_15px_rgba(168,85,247,0.4)]',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          accent: '#c084fc',
        };
      case 'market':
        return {
          bg: 'bg-cyan-950/80',
          border: 'border-cyan-500',
          glow: 'shadow-[0_0_15px_rgba(6,182,212,0.4)]',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          accent: '#38bdf8',
        };
      case 'offer':
        return {
          bg: 'bg-indigo-950/80',
          border: 'border-indigo-500',
          glow: 'shadow-[0_0_15px_rgba(99,102,241,0.4)]',
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          accent: '#818cf8',
        };
      case 'gtm':
        return {
          bg: 'bg-emerald-950/80',
          border: 'border-emerald-500',
          glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          accent: '#34d399',
        };
      default:
        return {
          bg: 'bg-slate-900',
          border: 'border-slate-700',
          glow: '',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          accent: '#94a3b8',
        };
    }
  };

  const colors = getDeptColor();

  // Status badge config
  const getStatusBadge = () => {
    switch (agent.state) {
      case 'RESEARCHING':
      case 'WRITING':
        return {
          label: 'TRABALHANDO',
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          icon: <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-400" />,
        };
      case 'USING_TOOL':
        return {
          label: agent.activeToolLabel || 'USANDO FERRAMENTA',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: getToolIcon(agent.toolCategory),
        };
      case 'REVIEWING':
        return {
          label: 'REVISANDO',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          icon: <Sparkles className="w-2.5 h-2.5 text-purple-400" />,
        };
      case 'MEETING':
        return {
          label: 'EM REUNIÃO',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          icon: <Clock className="w-2.5 h-2.5 text-indigo-400" />,
        };
      case 'SUBMITTED':
        return {
          label: 'ENTREGUE',
          color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          icon: <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />,
        };
      case 'APPROVED':
        return {
          label: 'APROVADO',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          icon: <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />,
        };
      case 'ERROR':
        return {
          label: 'ERRO',
          color: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: <AlertTriangle className="w-2.5 h-2.5 text-red-400" />,
        };
      case 'WAITING':
        return {
          label: 'AGUARDANDO',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: null,
        };
      default:
        return {
          label: 'IDLE',
          color: 'bg-slate-800/80 text-slate-400 border-slate-700/50',
          icon: null,
        };
    }
  };

  function getToolIcon(category?: string) {
    switch (category) {
      case 'offers':
        return <Radar className="w-2.5 h-2.5 text-amber-400" />;
      case 'context':
        return <FileText className="w-2.5 h-2.5 text-amber-400" />;
      case 'landing_page':
        return <Globe className="w-2.5 h-2.5 text-amber-400" />;
      case 'checkout':
        return <ShoppingCart className="w-2.5 h-2.5 text-amber-400" />;
      case 'creatives':
        return <ImageIcon className="w-2.5 h-2.5 text-amber-400" />;
      case 'knowledge':
        return <BookOpen className="w-2.5 h-2.5 text-amber-400" />;
      default:
        return <Radar className="w-2.5 h-2.5 text-amber-400" />;
    }
  }

  const statusInfo = getStatusBadge();
  const isWorkingState = agent.state === 'RESEARCHING' || agent.state === 'USING_TOOL' || agent.state === 'WRITING';

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer select-none transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 ${
        isSelected ? 'scale-110 z-30' : 'hover:scale-105 z-20'
      }`}
    >
      {/* Floating Status Badge above agent */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 pointer-events-none">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium tracking-wide border shadow-md backdrop-blur-md transition-all ${statusInfo.color}`}
        >
          {statusInfo.icon}
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Main Character Body (Vector 2.5D SVG Avatar) */}
      <div className="relative flex flex-col items-center">
        {/* Glow halo when active */}
        {isWorkingState && (
          <div
            className="absolute -inset-1 rounded-full blur-sm opacity-60 animate-pulse"
            style={{ backgroundColor: colors.accent }}
          />
        )}

        <svg
          width="44"
          height="52"
          viewBox="0 0 44 52"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative drop-shadow-md"
        >
          {/* Shadow beneath character */}
          <ellipse cx="22" cy="48" rx="14" ry="4" fill="#000" fillOpacity="0.4" />

          {/* Torso / Body */}
          <rect
            x="11"
            y="24"
            width="22"
            height="22"
            rx="6"
            fill="#1e293b"
            stroke={isSelected ? '#38bdf8' : colors.accent}
            strokeWidth={isSelected ? '2' : '1.5'}
          />

          {/* Department Shirt Accent */}
          <path
            d="M15 24 C15 30, 29 30, 29 24"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Head */}
          <circle cx="22" cy="15" r="10" fill="#0f172a" stroke={colors.accent} strokeWidth="1.5" />
          
          {/* Hair / Headband styling */}
          <path
            d="M14 12 Q22 7 30 12"
            stroke={colors.accent}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Eyes (Glowing Digital Visor / Glasses) */}
          <rect
            x="16"
            y="13"
            width="12"
            height="4"
            rx="2"
            fill={isWorkingState ? colors.accent : '#64748b'}
            className={isWorkingState ? 'animate-pulse' : ''}
          />

          {/* Hands Typing Animation (if sitting/working) */}
          {isWorkingState && (
            <g className="animate-bounce" style={{ animationDuration: '0.8s' }}>
              <circle cx="14" cy="40" r="2.5" fill={colors.accent} />
              <circle cx="30" cy="40" r="2.5" fill={colors.accent} />
            </g>
          )}

          {/* Badge / Role Symbol */}
          {agent.department === 'executive' && (
            <path d="M22 28 L24 33 L19 30 L25 30 L20 33 Z" fill="#fbbf24" />
          )}
        </svg>

        {/* Character Label */}
        <div className="mt-0.5 text-center">
          <span className="block text-[10px] font-semibold text-slate-200 tracking-tight drop-shadow-sm line-clamp-1 max-w-[80px]">
            {agent.name.split(' ')[0]} {agent.name.split(' ')[1] || ''}
          </span>
        </div>
      </div>
    </div>
  );
}
