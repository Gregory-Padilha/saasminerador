'use client';

import React, { useState } from 'react';
import { Offer } from '@/types';
import { dbService } from '@/lib/supabase/db';
import { FileText, Save, Check } from 'lucide-react';

interface TabNotesProps {
  offer: Offer;
  onOfferUpdated: (updated: Offer) => void;
}

export function TabNotes({ offer, onOfferUpdated }: TabNotesProps) {
  const [notes, setNotes] = useState(offer.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const updated = await dbService.updateOffer(offer.id, { notes });
      if (updated) {
        onOfferUpdated(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Anotações & Observações Livres
          </h3>
        </div>

        <button
          onClick={handleSaveNotes}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Salvando...' : savedSuccess ? 'Notas Salvas!' : 'Salvar Anotações'}
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Espaço livre para rascunhar ideias, insights de copy, links úteis, referências de benchmark ou apontamentos rápidos sobre a operação desta oferta.
      </p>

      <textarea
        rows={12}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Escreva suas anotações aqui... Ex: 'Hero muito boa. Oferta depende de ancoragem de bônus. Vale a pena adaptar para professores do ensino fundamental.'"
        className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-y"
      />
    </div>
  );
}
