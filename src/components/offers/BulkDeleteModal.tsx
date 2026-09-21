'use client';

import React, { useState, useEffect } from 'react';
import { Offer } from '@/types';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkDeleteModalProps {
  isOpen: boolean;
  selectedOffers: Offer[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function BulkDeleteModal({
  isOpen,
  selectedOffers,
  onClose,
  onConfirm,
}: BulkDeleteModalProps) {
  const [confirmedSafety, setConfirmedSafety] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const count = selectedOffers.length;
  const requiresSafetyCheck = count >= 5;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfirmedSafety(false);
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Keyboard navigation: Escape closes, Enter submits if allowed
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      } else if (e.key === 'Enter' && !isDeleting) {
        if (!requiresSafetyCheck || confirmedSafety) {
          handleExecuteDelete();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, requiresSafetyCheck, confirmedSafety]);

  if (!isOpen || count === 0) return null;

  const handleExecuteDelete = async () => {
    if (requiresSafetyCheck && !confirmedSafety) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  const previewList = selectedOffers.slice(0, 3);
  const remainingCount = count - previewList.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="bulk-delete-title" className="text-base sm:text-lg font-bold text-white">
                Excluir {count === 1 ? '1 Oferta' : `${count} Ofertas`}?
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Esta ação removerá permanentemente as ofertas e todos os dados relacionados a elas no banco.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Details */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
          <span className="font-semibold text-slate-300 block">
            Você está excluindo:
          </span>
          <ul className="space-y-1 text-slate-400">
            {previewList.map((o) => (
              <li key={o.id} className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span className="truncate font-medium text-slate-200">
                  {o.product_name || 'Oferta sem nome'}
                </span>
                {o.advertiser && (
                  <span className="text-slate-500 text-[11px] truncate">
                    ({o.advertiser})
                  </span>
                )}
              </li>
            ))}
            {remainingCount > 0 && (
              <li className="text-slate-500 font-medium pl-3.5 pt-0.5">
                + {remainingCount} {remainingCount === 1 ? 'outra oferta' : 'outras ofertas'}
              </li>
            )}
          </ul>
        </div>

        {/* Warning Text */}
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 leading-relaxed">
          <strong>Atenção:</strong> Essa ação é destrutiva e definitiva. Históricos de snapshots, criativos e análises vinculados serão removidos. O arquivo Excel e o lote de importação original serão preservados.
        </p>

        {/* Safety Checkbox for 5+ items */}
        {requiresSafetyCheck && (
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/90 cursor-pointer text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={confirmedSafety}
              onChange={(e) => setConfirmedSafety(e.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <span className="font-medium text-slate-200">
              Confirmo que desejo excluir permanentemente {count === 1 ? 'esta oferta' : `estas ${count} ofertas`}.
            </span>
          </label>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecuteDelete}
            disabled={isDeleting || (requiresSafetyCheck && !confirmedSafety)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition active:scale-95',
              'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20',
              (isDeleting || (requiresSafetyCheck && !confirmedSafety)) &&
                'opacity-50 cursor-not-allowed active:scale-100 hover:bg-rose-600'
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir {count === 1 ? '1 Oferta' : `${count} Ofertas`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
