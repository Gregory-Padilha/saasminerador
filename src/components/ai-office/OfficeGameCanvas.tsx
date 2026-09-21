'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LiveOfficeVisualState } from '@/lib/ai-office/events';
import { OfficeScene } from '@/lib/ai-office/phaser/office-scene';
import { OfficeErrorBoundary } from './OfficeErrorBoundary';
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

interface OfficeGameCanvasProps {
  visualState: LiveOfficeVisualState;
  onSelectAgent?: (roleId: string) => void;
  onOpenCaseFile?: () => void;
  zoomLevel?: number; // 80, 100, 120
  isMiniPreview?: boolean;
}

export function OfficeGameCanvas({
  visualState,
  onSelectAgent,
  onOpenCaseFile,
  zoomLevel = 100,
  isMiniPreview = false,
}: OfficeGameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<any>(null);
  const officeSceneRef = useRef<OfficeScene | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalZoom, setInternalZoom] = useState(zoomLevel);

  useEffect(() => {
    setInternalZoom(zoomLevel);
  }, [zoomLevel]);

  // Mount Phaser 3 Game instance Client-Side
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let phaserInstance: any = null;

    async function initPhaser() {
      const PhaserModule = await import('phaser');
      const Phaser = PhaserModule.default || PhaserModule;

      const config: any = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        width: 1200,
        height: 680,
        backgroundColor: '#090d14',
        scale: {
          mode: isMiniPreview ? Phaser.Scale.FIT : Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [OfficeScene],
        physics: {
          default: 'arcade',
          arcade: { debug: false },
        },
      };

      phaserInstance = new Phaser.Game(config);
      phaserGameRef.current = phaserInstance;

      // Event Listeners from Scene
      phaserInstance.events.on('scene-ready', () => {
        const scene = phaserInstance.scene.getScene('OfficeScene') as OfficeScene;
        officeSceneRef.current = scene;
        if (visualState && scene) {
          scene.updateOfficeVisualState(visualState);
        }
      });

      phaserInstance.events.on('select-agent', (roleId: string) => {
        if (onSelectAgent) onSelectAgent(roleId);
      });

      phaserInstance.events.on('open-casefile', () => {
        if (onOpenCaseFile) onOpenCaseFile();
      });
    }

    initPhaser();

    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
        officeSceneRef.current = null;
      }
    };
  }, [isMiniPreview]);

  // Sync Visual State changes to active Phaser Scene
  useEffect(() => {
    if (officeSceneRef.current && visualState) {
      officeSceneRef.current.updateOfficeVisualState(visualState);
    }
  }, [visualState]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  const scaleTransform = isMiniPreview ? 'scale(1)' : `scale(${internalZoom / 100})`;

  return (
    <OfficeErrorBoundary widgetName="PhaserOfficeCanvas">
      <div
        className={`relative w-full overflow-hidden bg-[#090d14] border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center justify-center select-none ${
          isMiniPreview ? 'h-[360px]' : 'min-h-[640px]'
        }`}
      >
        {/* Top Controls Overlay (Full Canvas Mode only) */}
        {!isMiniPreview && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 text-slate-300">
            <button
              onClick={() => setInternalZoom((z) => Math.max(80, z - 10))}
              className="p-1 hover:text-white rounded hover:bg-slate-800"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs w-10 text-center">{internalZoom}%</span>
            <button
              onClick={() => setInternalZoom((z) => Math.min(120, z + 10))}
              className="p-1 hover:text-white rounded hover:bg-slate-800"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:text-purple-300 rounded hover:bg-slate-800"
              title="Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Phaser 3 Mounting Element */}
        <div
          ref={containerRef}
          className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
          style={{ transform: scaleTransform, transformOrigin: 'center center' }}
        />
      </div>
    </OfficeErrorBoundary>
  );
}
