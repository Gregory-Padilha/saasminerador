'use client';

import React, { useState, useRef } from 'react';
import { CreativeIntelligenceArtifact } from '@/lib/ai-intelligence/creative-intelligence';
import { Play, Pause, Film, FileText, Sparkles, Clock, Layers, ArrowUpRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreativeArtifactRendererProps {
  artifact: CreativeIntelligenceArtifact;
}

export function CreativeArtifactRenderer({ artifact }: CreativeArtifactRendererProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'transcript' | 'timeline' | 'analysis'>('analysis');
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleSeek = (seconds: number) => {
    setActiveTab('video');
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }, 50);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleCopyTranscript = () => {
    if (artifact.transcript?.fullText) {
      navigator.clipboard.writeText(artifact.transcript.fullText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const videoSourceUrl =
    artifact.mediaUrl ||
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  return (
    <div className="my-4 rounded-2xl bg-slate-900/90 border border-purple-500/30 shadow-xl overflow-hidden text-slate-100 select-none">
      {/* CARD HEADER */}
      <div className="p-4 bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                CRIATIVO #{artifact.creativeId.substring(0, 8)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {artifact.mediaType === 'video' ? 'Vídeo' : 'Imagem Estática'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {artifact.productName} • {artifact.durationSeconds ? `${artifact.durationSeconds}s` : '—'} • {artifact.associatedAdsCount} anúncio(s) associado(s)
            </p>
          </div>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('analysis')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition',
              activeTab === 'analysis' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            )}
          >
            Análise & Hook
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5',
              activeTab === 'video' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            )}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Vídeo</span>
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5',
              activeTab === 'transcript' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Transcrição</span>
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5',
              activeTab === 'timeline' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Cenas</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT BODY */}
      <div className="p-4 sm:p-5">
        {/* TAB 1: ANALYSIS & HOOK */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            {/* HOOK CARD */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Gancho Principal (Hook Verbatim)
                </span>
                <span className="text-[10px] font-mono font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                  {artifact.hookAnalysis.evidenceTimestamps}
                </span>
              </div>
              <p className="text-sm font-semibold text-white italic">
                "{artifact.hookAnalysis.verbatimHook}"
              </p>
              <div className="text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-purple-500/20">
                <div>
                  <strong className="text-slate-400">Tipo de Hook:</strong> {artifact.hookAnalysis.hookType}
                </div>
                <div>
                  <strong className="text-slate-400">Emoção Central:</strong> {artifact.hookAnalysis.emotion}
                </div>
                <div className="sm:col-span-2">
                  <strong className="text-slate-400">Por que prende atenção:</strong> {artifact.hookAnalysis.whyItMayHoldAttention}
                </div>
              </div>
            </div>

            {/* TRANSFERABLE PRINCIPLES */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Princípios Transferíveis para Modelagem
              </h4>
              <ul className="space-y-1.5">
                {artifact.transferablePrinciples.map((prin, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>{prin}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE VIDEO PLAYER */}
        {activeTab === 'video' && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                src={videoSourceUrl}
                controls
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Vídeo salvo no Storage de Criativos</span>
              <button
                onClick={() => handleSeek(0)}
                className="text-purple-400 hover:underline font-semibold"
              >
                Reiniciar do 00:00
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: TIMESTAMPED TRANSCRIPT WITH SEEKING */}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Transcrição com Timestamps Interativos
              </span>
              <button
                onClick={handleCopyTranscript}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
              >
                {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {artifact.transcript?.segments.map((seg, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSeek(seg.startSeconds)}
                  className="p-3 rounded-xl bg-slate-950/70 hover:bg-purple-950/20 border border-slate-800 hover:border-purple-500/30 transition cursor-pointer group flex items-start gap-3"
                >
                  <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 group-hover:bg-purple-600 group-hover:text-white font-mono text-[11px] font-bold shrink-0 transition">
                    [{seg.start}]
                  </span>
                  <p className="text-xs text-slate-200 group-hover:text-white transition">
                    {seg.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: VISUAL SCENE TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Linha do Tempo de Cenas & Elementos Visuais
            </span>
            <div className="space-y-2.5">
              {artifact.sceneTimeline.map((scene, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSeek(scene.startSeconds)}
                  className="p-3 rounded-xl bg-slate-950/70 hover:bg-purple-950/20 border border-slate-800 hover:border-purple-500/30 transition cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono text-[11px] font-bold">
                      {scene.start} - {scene.end}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {scene.purposeInAd}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white">
                    {scene.visualDescription}
                  </p>
                  {scene.onScreenText && (
                    <p className="text-[11px] text-amber-300 font-mono">
                      Texto em Tela: "{scene.onScreenText}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
