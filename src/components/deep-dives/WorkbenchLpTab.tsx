'use client';

import React, { useState } from 'react';
import { DeepDive, DeepDiveLpSectionNote } from '@/types';
import {
  Globe,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Layers,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface WorkbenchLpTabProps {
  deepDive: DeepDive;
  onUpdateLpSectionNotes: (notes: DeepDiveLpSectionNote[]) => Promise<void>;
}

const SECTION_TYPES = [
  'Hero',
  'Promessa',
  'Prova',
  'Preço',
  'Bônus',
  'Garantia',
  'CTA',
  'FAQ',
] as const;

export function WorkbenchLpTab({
  deepDive,
  onUpdateLpSectionNotes,
}: WorkbenchLpTabProps) {
  const offer = deepDive.offer;
  const sectionNotes = deepDive.lp_section_notes || [];

  const [selectedSection, setSelectedSection] = useState<string>('Hero');
  const [inputText, setInputText] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNote.trim()) return;

    setIsSubmitting(true);
    try {
      const newNoteItem: DeepDiveLpSectionNote = {
        section: selectedSection,
        text: inputText.trim(),
        note: inputNote.trim(),
        updated_at: new Date().toISOString(),
      };

      const updated = [newNoteItem, ...sectionNotes];
      await onUpdateLpSectionNotes(updated);

      setInputText('');
      setInputNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (index: number) => {
    const updated = sectionNotes.filter((_, i) => i !== index);
    await onUpdateLpSectionNotes(updated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: LP Preview Frame (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Visualização da Landing Page</h3>
          </div>

          {offer?.landing_page_url && (
            <a
              href={offer.landing_page_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir em Nova Aba
            </a>
          )}
        </div>

        <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl min-h-[550px] flex flex-col">
          {offer?.landing_page_url ? (
            <iframe
              src={offer.landing_page_url}
              className="w-full flex-1 min-h-[550px] border-0"
              title="Landing Page Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
              <Globe className="w-10 h-10 opacity-40" />
              <p className="text-xs">Nenhuma URL de Landing Page mapeada para esta oferta.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Section Annotation Tools (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              Anotação de Seção da LP
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione o bloco da Landing Page e registe observações sobre a estrutura de copy.
            </p>
          </div>

          <form onSubmit={handleAddNote} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Seção da LP:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {SECTION_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedSection(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      selectedSection === type
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Texto / Trecho da LP (Opcional):
              </label>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ex: '365 Receitas Sem Açúcar para Emagrecer Sem Sacrifício'"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Sua Observação de Investigação *:
              </label>
              <textarea
                rows={3}
                required
                value={inputNote}
                onChange={(e) => setInputNote(e.target.value)}
                placeholder="Ex: Headline comunica volume imediatamente. Preço baixo reduz barreira de entrada..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !inputNote.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adicionar Nota de Seção
            </button>
          </form>
        </div>

        {/* Existing Section Notes List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Anotações Registradas ({sectionNotes.length})
          </h4>

          {sectionNotes.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
              Nenhuma anotação de seção cadastrada.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sectionNotes.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 group hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      {item.section}
                    </span>
                    <button
                      onClick={() => handleDeleteNote(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition"
                      title="Excluir nota"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.text && (
                    <p className="text-[11px] italic text-slate-400 border-l-2 border-slate-700 pl-2">
                      "{item.text}"
                    </p>
                  )}

                  <p className="text-xs font-medium text-slate-200 leading-relaxed">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
