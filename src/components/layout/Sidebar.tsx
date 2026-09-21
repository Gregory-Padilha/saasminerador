'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  UploadCloud,
  Compass,
  Columns,
  PieChart,
  Star,
  Eye,
  Flame,
  Settings,
  Database,
  ArrowRight,
  Workflow,
  Sparkles,
  BookOpen,
  Building2,
  Terminal,
  FileCode,
  Bot,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { APP_ROUTES } from '@/lib/routes';

interface NavGroup {
  groupName: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    active: boolean;
  }[];
}

export function Sidebar() {
  const pathname = usePathname();

  const navGroups: NavGroup[] = [
    {
      groupName: 'VISÃO GERAL',
      items: [
        {
          name: 'Dashboard',
          href: APP_ROUTES.dashboard,
          icon: LayoutDashboard,
          active: pathname === '/' || pathname === '/dashboard',
        },
      ],
    },
    {
      groupName: 'MINERAÇÃO',
      items: [
        {
          name: 'Ofertas',
          href: '/offers',
          icon: Layers,
          active: pathname.startsWith('/offers'),
        },
        {
          name: 'Mapeamentos',
          href: '/mapping',
          icon: Workflow,
          active: pathname.startsWith('/mapping'),
        },
        {
          name: 'Agente de Mineração',
          href: '/miner-agent',
          icon: Bot,
          active: pathname.startsWith('/miner-agent'),
          badge: 'Agent',
        },
        {
          name: 'Importações',
          href: '/imports',
          icon: UploadCloud,
          active: pathname.startsWith('/imports'),
        },
        {
          name: 'Radar',
          href: '/radar',
          icon: Compass,
          active: pathname.startsWith('/radar') || pathname.startsWith('/opportunities'),
        },
      ],
    },
    {
      groupName: 'INTELIGÊNCIA',
      items: [
        {
          name: '✦ AI Intelligence',
          href: '/intelligence',
          icon: Sparkles,
          active: pathname === '/intelligence',
          badge: 'IA',
        },
        {
          name: '⚙ Worker Prompt Studio',
          href: '/intelligence/mining-prompts',
          icon: Terminal,
          active: pathname.startsWith('/intelligence/mining-prompts'),
          badge: 'Studio',
        },
        {
          name: '🏢 Escritório de Ofertas',
          href: '/office',
          icon: Building2,
          active: pathname.startsWith('/office'),
          badge: 'Brain',
        },
        {
          name: 'Biblioteca IA',
          href: '/knowledge',
          icon: BookOpen,
          active: pathname.startsWith('/knowledge'),
          badge: 'RAG',
        },
        {
          name: 'Nichos',
          href: '/niches',
          icon: PieChart,
          active: pathname.startsWith('/niches'),
        },
        {
          name: 'Comparar',
          href: '/compare',
          icon: Columns,
          active: pathname.startsWith('/compare'),
        },
        {
          name: 'Acompanhando',
          href: '/watchlist',
          icon: Eye,
          active: pathname.startsWith('/watchlist'),
        },
      ],
    },
    {
      groupName: 'PESQUISA',
      items: [
        {
          name: 'Favoritas',
          href: '/favorites',
          icon: Star,
          active: pathname.startsWith('/favorites'),
        },
        {
          name: 'Deep Dives',
          href: '/deep-dives',
          icon: Flame,
          active: pathname.startsWith('/deep-dives'),
        },
      ],
    },
    {
      groupName: 'SISTEMA',
      items: [
        {
          name: 'Configurações',
          href: '/settings',
          icon: Settings,
          active: pathname.startsWith('/settings'),
        },
      ],
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-[#090D14] flex flex-col justify-between select-none h-screen sticky top-0 overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <Link href={APP_ROUTES.dashboard} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Database className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight">
                  OFFER MINER
                </span>
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Offer Intelligence Platform
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Groups */}
        <nav className="p-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.groupName} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.groupName}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                      item.active
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          'w-4 h-4 transition-colors',
                          item.active
                            ? 'text-blue-400'
                            : 'text-slate-400 group-hover:text-slate-200'
                        )}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Ingestion Action */}
      <div className="p-3 m-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-white">
          <span>Mineração</span>
          <span className="text-[10px] text-amber-400 font-mono">XLSX • JSON</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href="/imports"
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shadow transition active:scale-95"
            title="Importar Excel (.xlsx)"
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
            <span>Excel</span>
          </Link>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-json-import-modal'))}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 shadow transition active:scale-95 cursor-pointer"
            title="Importar JSON (.json ou texto)"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>JSON</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
