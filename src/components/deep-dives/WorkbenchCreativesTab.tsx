'use client';

import React, { useState } from 'react';
import { DeepDive, OfferAdWithMedia, DeepDiveCreativeTag, CreativeTagType } from '@/types';
import {
  Tag,
  Star,
  FileText,
  Video,
  Image as ImageIcon,
  Check,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface WorkbenchCreativesTabProps {
  deepDive: DeepDive;
  onUpdateCreativeTags: (tags: Record<string, DeepDiveCreativeTag>) => Promise<void>;
}

const TAG_OPTIONS: { id: CreativeTagType; label: string; color: string }[] = [
  { id: 'REFERENCIA', label: '⭐ Referência', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'HOOK_FORTE', label: '🪝 Hook Forte', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { id: 'VISUAL_INTERESSANTE', label: '🎨 Visual Interessante', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { id: 'FORMATO_TESTAR', label: '🧪 Formato para Testar', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { id: 'IGNORAR', label: '🚫 Ignorar', color: 'bg-slate-800 text-slate-400 border-slate-700' },
];

export function WorkbenchCreativesTab({
  deepDive,
  onUpdateCreativeTags,
}: WorkbenchCreativesTabProps) {
  const offer = deepDive.offer;
  const ads = offer?.ads || [];
  const currentTags = deepDive.creative_tags || {};

  const [activeAdId, setActiveAdId] = useState<string | null>(ads[0]?.id || null);
  const [tagNotes, setTagNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    Object.keys(currentTags).forEach((k) => {
      map[k] = currentTags[k].note || '';
    });
    return map;
  });

  const handleSelectTag = async (adId: string, tagType: CreativeTagType) => {
    const existing = currentTags[adId];
    const isSame = existing?.tag === tagType;

    const nextTags = { ...currentTags };

    if (isSame) {
      delete nextTags[adId];
    } else {
      nextTags[adId] = {
        creative_id: adId,
        tag: tagType,
        note: tagNotes[adId] || existing?.note || '',
        is_primary: existing?.is_primary || false,
        updated_at: new Date().toISOString(),
      };
    }

    await onUpdateCreativeTags(nextTags);
  };

  const handleTogglePrimary = async (adId: string) => {
    const nextTags = { ...currentTags };
    // Clear other primary flags
    Object.keys(nextTags).forEach((k) => {
      if (nextTags[k]) nextTags[k].is_primary = false;
    });

    const existing = nextTags[adId];
    nextTags[adId] = {
      creative_id: adId,
      tag: existing?.tag || 'REFERENCIA',
      note: tagNotes[adId] || existing?.note || '',
      is_primary: true,
      updated_at: new Date().toISOString(),
    };

    await onUpdateCreativeTags(nextTags);
  };

  const handleNoteBlur = async (adId: string) => {
    const existing = currentTags[adId];
    if (!existing && !tagNotes[adId]) return;

    const nextTags = {
      ...currentTags,
      [adId]: {
        creative_id: adId,
        tag: existing?.tag || 'REFERENCIA',
        note: tagNotes[adId] || '',
        is_primary: existing?.is_primary || false,
        updated_at: new Date().toISOString(),
      },
    };

    await onUpdateCreativeTags(nextTags);
  };

  if (ads.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <Video className="w-10 h-10 text-slate-500 mx-auto" />
        <h3 className="text-base font-bold text-white">Nenhum criativo capturado ainda</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Esta oferta ainda não possui mídias baixadas. A Oficina utiliza as mídias já coletadas no Dossiê sem refazer scrapers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Análise Qualitativa de Criativos ({ads.length} mídias)
          </h3>
          <p className="text-xs text-slate-400">
            Marque os criativos principais, registre destaques de hook, estilo visual e notas estratégicas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ads.map((ad) => {
          const firstMedia = ad.media?.[0];
          const tagInfo = currentTags[ad.id];
          const isPrimary = tagInfo?.is_primary === true;

          return (
            <div
              key={ad.id}
              className={`p-4 rounded-2xl border transition space-y-3 flex flex-col justify-between ${
                isPrimary
                  ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="space-y-3">
                {/* Media Preview Thumbnail / Player */}
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video border border-slate-800 group">
                  {firstMedia?.media_display_url || firstMedia?.media_url ? (
                    firstMedia.media_type === 'video' ? (
                      <video
                        src={firstMedia.media_display_url || firstMedia.media_url || undefined}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={firstMedia.media_display_url || firstMedia.media_url || undefined}
                        alt="Creative Media"
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : ad.card_screenshot_display_url || ad.card_screenshot_url ? (
                    <img
                      src={ad.card_screenshot_display_url || ad.card_screenshot_url || undefined}
                      alt="Ad Screenshot"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                      <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                      Sem preview de mídia
                    </div>
                  )}

                  {/* Primary Badge */}
                  {isPrimary && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold flex items-center gap-1 shadow-md">
                      <Star className="w-3 h-3 fill-current" />
                      CRIATIVO PRINCIPAL DA ANÁLISE
                    </div>
                  )}
                </div>

                {/* Primary Text / Headline snippet */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                    ID Meta: {ad.meta_ad_id}
                  </span>
                  {ad.primary_text && (
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      "{ad.primary_text}"
                    </p>
                  )}
                </div>

                {/* Tag Selectors */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Classificação na Oficina:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {TAG_OPTIONS.map((opt) => {
                      const isSelected = tagInfo?.tag === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectTag(ad.id, opt.id)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                            isSelected
                              ? opt.color
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Creative Note Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">
                    Anotação Estratégica do Criativo:
                  </label>
                  <textarea
                    rows={2}
                    value={tagNotes[ad.id] ?? ''}
                    onChange={(e) => setTagNotes({ ...tagNotes, [ad.id]: e.target.value })}
                    onBlur={() => handleNoteBlur(ad.id)}
                    placeholder="Ex: Demonstração rápida do produto com narração envolvente..."
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Set Primary Button */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTogglePrimary(ad.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                    isPrimary ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isPrimary ? 'fill-current' : ''}`} />
                  {isPrimary ? 'Criativo Principal' : 'Destacar como Principal'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
