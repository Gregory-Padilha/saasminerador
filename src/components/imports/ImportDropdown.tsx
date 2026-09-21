'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { UploadCloud, FileSpreadsheet, FileCode, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportDropdownProps {
  onOpenJsonImport?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'compact';
}

export function ImportDropdown({
  onOpenJsonImport,
  className,
  variant = 'primary',
}: ImportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const buttonStyles = {
    primary:
      'px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 border border-blue-400/30',
    secondary:
      'px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700',
    compact:
      'px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow',
  }[variant];

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 transition active:scale-95 select-none cursor-pointer',
          buttonStyles
        )}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <UploadCloud className="w-4 h-4 text-blue-300" />
        <span>Importar</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1.5 divide-y divide-slate-800/60"
          role="menu"
        >
          <div className="py-1">
            <Link
              href="/imports"
              onClick={() => setIsOpen(false)}
              className="group flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition"
              role="menuitem"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:bg-blue-500/20 transition">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-white">Importar Excel</div>
                <div className="text-[10px] text-slate-400">Planilhas .xlsx, .xls ou .csv</div>
              </div>
            </Link>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onOpenJsonImport) {
                  onOpenJsonImport();
                } else {
                  // Fallback: trigger custom event if modal is mounted globally
                  window.dispatchEvent(new CustomEvent('open-json-import-modal'));
                }
              }}
              className="w-full text-left group flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
              role="menuitem"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:bg-amber-500/20 transition">
                <FileCode className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <span>Importar JSON</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 font-bold">
                    NOVO
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Arquivo .json ou texto colado</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
