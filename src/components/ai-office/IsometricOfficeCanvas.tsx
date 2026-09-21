'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LiveOfficeVisualState } from '@/lib/ai-office/events';
import { OfficeErrorBoundary } from './OfficeErrorBoundary';
import {
  IsoAgent,
  OFFICE_ZONES,
  INITIAL_ISO_AGENTS,
  mapLiveVisualStateToIsoAgents,
} from '@/lib/ai-office/pixi/useAgentOfficeStore';
import {
  toScreen,
  toIso,
  getZIndex,
  TILE_WIDTH,
  TILE_HEIGHT,
} from '@/lib/ai-office/pixi/isoUtils';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface IsometricOfficeCanvasProps {
  visualState: LiveOfficeVisualState;
  onSelectAgent?: (roleId: string) => void;
  zoomLevel?: number;
}

export function IsometricOfficeCanvas({
  visualState,
  onSelectAgent,
  zoomLevel = 100,
}: IsometricOfficeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<any>(null);
  const viewportRef = useRef<any>(null);

  const [agents, setAgents] = useState<IsoAgent[]>(INITIAL_ISO_AGENTS);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync live state to agents
  useEffect(() => {
    if (visualState) {
      setAgents((prev) => mapLiveVisualStateToIsoAgents(prev, visualState));
    }
  }, [visualState]);

  // Mount Pixi.js Application & pixi-viewport Client-Side
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let app: any = null;
    let viewport: any = null;
    let animationFrameId: number | null = null;

    async function initPixi() {
      const PIXI = await import('pixi.js');
      const { Viewport } = await import('pixi-viewport');

      // Initialize Pixi 8 Application
      app = new PIXI.Application();
      await app.init({
        width: containerRef.current!.clientWidth || 1200,
        height: containerRef.current!.clientHeight || 680,
        backgroundColor: 0x090d14,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });

      if (!containerRef.current) return;
      containerRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;

      // Enable PixiJS zIndex sorting
      app.stage.sortableChildren = true;

      // Initialize pixi-viewport for smooth zoom & pan
      viewport = new Viewport({
        screenWidth: app.screen.width,
        screenHeight: app.screen.height,
        worldWidth: 2400,
        worldHeight: 1600,
        events: app.renderer.events,
      });

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({ minScale: 0.5, maxScale: 2.5 });

      // Center viewport on office origin
      viewport.moveCenter(0, 300);
      viewport.setZoom(1.0);

      app.stage.addChild(viewport);
      viewportRef.current = viewport;
      viewport.sortableChildren = true;

      // 1. Draw 30x30 Diamond Isometric Floor Tiles
      drawIsometricFloor(PIXI, viewport);

      // 2. Draw Isometric Partition Walls & Glass Dividers
      drawIsometricWalls(PIXI, viewport);

      // 3. Draw Isometric Furniture Sprites
      drawIsometricFurniture(PIXI, viewport);

      // 4. Render 13 Habbo-Style 2.5D Avatars & Badges
      renderIsometricAgents(PIXI, viewport, agents, onSelectAgent);

      // Ticker loop for dynamic pulsing rings & speech bubble waves
      let pulseTime = 0;
      app.ticker.add((ticker: any) => {
        pulseTime += ticker.deltaTime * 0.05;
        updateDynamicAnimations(viewport, pulseTime);
      });
    }

    initPixi();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true, texture: true });
        pixiAppRef.current = null;
        viewportRef.current = null;
      }
    };
  }, []);

  // Update Pixi Canvas when agents state changes
  useEffect(() => {
    if (viewportRef.current && window) {
      import('pixi.js').then((PIXI) => {
        renderIsometricAgents(PIXI, viewportRef.current, agents, onSelectAgent);
      });
    }
  }, [agents, onSelectAgent]);

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

  return (
    <OfficeErrorBoundary widgetName="IsometricOfficeCanvas">
      <div className="relative w-full h-[660px] overflow-hidden bg-[#090d14] border border-slate-800 rounded-3xl shadow-2xl select-none flex items-center justify-center">
        {/* Top Control Toolbar Overlay */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 text-slate-300 text-xs">
          <button
            onClick={() => viewportRef.current?.zoomPercent(-0.15, true)}
            className="p-1.5 hover:text-white rounded-lg hover:bg-slate-800"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              viewportRef.current?.moveCenter(0, 300);
              viewportRef.current?.setZoom(1.0, true);
            }}
            className="px-2 py-1 hover:text-white rounded-lg hover:bg-slate-800 font-mono text-[11px]"
            title="Recentralizar Câmera"
          >
            Reset
          </button>
          <button
            onClick={() => viewportRef.current?.zoomPercent(0.15, true)}
            className="p-1.5 hover:text-white rounded-lg hover:bg-slate-800"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:text-purple-300 rounded-lg hover:bg-slate-800"
            title="Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1.5">
          <div className="text-xs font-bold text-slate-200 mb-1">ESCRITÓRIO ISOMÉTRICO 2.5D (RETRO HABBO)</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"/> IDLE</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"/> WORKING</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"/> INTAKE / CALL</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"/> ERROR</span>
          </div>
        </div>

        {/* Canvas Mounting Container */}
        <div ref={containerRef} className="w-full h-full flex items-center justify-center" />
      </div>
    </OfficeErrorBoundary>
  );
}

/**
 * 1. Draw 30x30 Diamond Isometric Floor Tiles across 5 Room Zones
 */
function drawIsometricFloor(PIXI: any, viewport: any) {
  const floorContainer = new PIXI.Container();
  floorContainer.zIndex = -100;

  for (let x = 0; x < 30; x++) {
    for (let y = 0; y < 30; y++) {
      const screenPt = toScreen(x, y);

      // Determine Zone & Floor Style
      let tileColor = 0x141e33; // Default carpet
      let borderColor = 0x1e293b;

      if (x >= 2 && x <= 10 && y >= 2 && y <= 10) {
        tileColor = 0x261b36; // Executive Hardwood
        borderColor = 0x3b2754;
      } else if (x >= 12 && x <= 28 && y >= 2 && y <= 10) {
        tileColor = 0x0f222d; // Litigation Carpet
        borderColor = 0x1e3a5f;
      } else if (x >= 2 && x <= 10 && y >= 12 && y <= 28) {
        tileColor = 0x181a35; // Contracts Marble
        borderColor = 0x312e81;
      } else if (x >= 12 && x <= 20 && y >= 12 && y <= 20) {
        tileColor = 0x0c251d; // Intake Tile
        borderColor = 0x065f46;
      } else if (x >= 22 && x <= 28 && y >= 12 && y <= 28) {
        tileColor = 0x241d13; // Research Wood
        borderColor = 0x78350f;
      }

      // Draw Diamond Tile Polygon
      const tileGfx = new PIXI.Graphics();
      tileGfx.poly([
        screenPt.x, screenPt.y - TILE_HEIGHT / 2,
        screenPt.x + TILE_WIDTH / 2, screenPt.y,
        screenPt.x, screenPt.y + TILE_HEIGHT / 2,
        screenPt.x - TILE_WIDTH / 2, screenPt.y,
      ]);
      tileGfx.fill({ color: tileColor, alpha: 0.95 });
      tileGfx.stroke({ color: borderColor, width: 1, alpha: 0.6 });

      floorContainer.addChild(tileGfx);
    }
  }

  viewport.addChild(floorContainer);
}

/**
 * 2. Draw Partition Glass Walls & Corner Posts
 */
function drawIsometricWalls(PIXI: any, viewport: any) {
  const wallContainer = new PIXI.Container();
  wallContainer.zIndex = 0;

  Object.values(OFFICE_ZONES).forEach((zone) => {
    const minPt = toScreen(zone.minX, zone.minY);
    const maxPt = toScreen(zone.maxX, zone.maxY);

    // Wall Glass Outline Graphics
    const wallGfx = new PIXI.Graphics();
    wallGfx.poly([
      toScreen(zone.minX, zone.minY).x, toScreen(zone.minX, zone.minY).y,
      toScreen(zone.maxX, zone.minY).x, toScreen(zone.maxX, zone.minY).y,
      toScreen(zone.maxX, zone.maxY).x, toScreen(zone.maxX, zone.maxY).y,
      toScreen(zone.minX, zone.maxY).x, toScreen(zone.minX, zone.maxY).y,
    ]);
    wallGfx.stroke({ color: zone.color, width: 2, alpha: 0.5 });
    wallContainer.addChild(wallGfx);
  });

  viewport.addChild(wallContainer);
}

/**
 * 3. Draw Procedural 2.5D Isometric Furniture Sprites
 */
function drawIsometricFurniture(PIXI: any, viewport: any) {
  const furnContainer = new PIXI.Container();

  // Helper to place furniture sprite
  const addFurniture = (isoX: number, isoY: number, drawFn: (gfx: any) => void) => {
    const pt = toScreen(isoX, isoY);
    const gfx = new PIXI.Graphics();
    drawFn(gfx);
    gfx.x = pt.x;
    gfx.y = pt.y;
    gfx.zIndex = getZIndex(isoX, isoY, 10);
    furnContainer.addChild(gfx);
  };

  // Executive Desks & Sofas
  addFurniture(5, 4, (g) => {
    // Executive Mahogany Desk
    g.ellipse(0, 6, 24, 12).fill({ color: 0x000000, alpha: 0.4 }); // Shadow
    g.roundRect(-22, -10, 44, 20, 4).fill({ color: 0x3f1d0b }).stroke({ color: 0x78350f, width: 2 });
    g.roundRect(-10, -6, 20, 6, 2).fill({ color: 0xc084fc }); // Executive Laptop Glow
  });

  // Litigation Dual-Monitor Desks
  [ {x: 15, y: 3}, {x: 20, y: 3}, {x: 15, y: 7}, {x: 22, y: 7} ].forEach((pos) => {
    addFurniture(pos.x, pos.y, (g) => {
      g.ellipse(0, 6, 20, 10).fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(-18, -8, 36, 16, 3).fill({ color: 0x1e293b }).stroke({ color: 0x38bdf8, width: 1.5 });
      g.rect(-12, -5, 10, 4).fill({ color: 0x38bdf8 }); // Dual Monitor 1
      g.rect(2, -5, 10, 4).fill({ color: 0x38bdf8 });  // Dual Monitor 2
    });
  });

  // Contracts & Offer Desks
  [ {x: 4, y: 14}, {x: 7, y: 14}, {x: 4, y: 21}, {x: 7, y: 21} ].forEach((pos) => {
    addFurniture(pos.x, pos.y, (g) => {
      g.ellipse(0, 6, 20, 10).fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(-18, -8, 36, 16, 3).fill({ color: 0x181a35 }).stroke({ color: 0x818cf8, width: 1.5 });
      g.rect(-8, -5, 16, 4).fill({ color: 0x818cf8 });
    });
  });

  // Intake Counter & Lounge
  [ {x: 14, y: 13}, {x: 17, y: 13}, {x: 14, y: 17}, {x: 17, y: 17} ].forEach((pos) => {
    addFurniture(pos.x, pos.y, (g) => {
      g.ellipse(0, 6, 20, 10).fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(-18, -8, 36, 16, 3).fill({ color: 0x0c251d }).stroke({ color: 0x34d399, width: 1.5 });
      g.rect(-8, -5, 16, 4).fill({ color: 0x34d399 });
    });
  });

  // Billiards Table in Corridor Center
  addFurniture(15, 11, (g) => {
    g.ellipse(0, 8, 36, 18).fill({ color: 0x000000, alpha: 0.4 });
    g.roundRect(-30, -14, 60, 28, 4).fill({ color: 0x3f1d0b }).stroke({ color: 0x78350f, width: 2 });
    g.roundRect(-26, -10, 52, 20, 3).fill({ color: 0x047857 }).stroke({ color: 0x10b981, width: 1 });
    g.circle(-10, 0, 2).fill({ color: 0xffffff }); // White Cue Ball
    g.circle(10, 0, 2).fill({ color: 0xef4444 });  // Red Ball
  });

  viewport.addChild(furnContainer);
}

/**
 * 4. Render 13 Habbo-Style 2.5D Avatars, Status Overhead Badges & Speech Bubbles
 */
function renderIsometricAgents(
  PIXI: any,
  viewport: any,
  agents: IsoAgent[],
  onSelectAgent?: (roleId: string) => void
) {
  let agentContainer = viewport.getChildByName('agent_container');
  if (!agentContainer) {
    agentContainer = new PIXI.Container();
    agentContainer.name = 'agent_container';
    viewport.addChild(agentContainer);
  }
  agentContainer.removeChildren();

  agents.forEach((agent) => {
    const pt = toScreen(agent.isoX, agent.isoY);
    const container = new PIXI.Container();
    container.x = pt.x;
    container.y = pt.y;
    container.zIndex = getZIndex(agent.isoX, agent.isoY, 50);

    // Click & Hover Interaction
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => {
      if (onSelectAgent) onSelectAgent(agent.id);
    });

    // A. Drop Shadow
    const shadowGfx = new PIXI.Graphics();
    shadowGfx.ellipse(0, 12, 12, 5).fill({ color: 0x000000, alpha: 0.4 });

    // B. Habbo-Style 2.5D Pixel Avatar Sprite
    const avatarGfx = new PIXI.Graphics();

    // Legs
    avatarGfx.roundRect(-5, 0, 4, 10, 1).fill({ color: 0x0f172a });
    avatarGfx.roundRect(1, 0, 4, 10, 1).fill({ color: 0x0f172a });

    // Torso / Suit
    avatarGfx.roundRect(-8, -12, 16, 13, 3).fill({ color: agent.suitColor }).stroke({ color: 0xffffff, width: 1, alpha: 0.6 });

    // Head & Hair
    avatarGfx.circle(0, -18, 7).fill({ color: agent.hairColor });
    avatarGfx.circle(0, -17, 6).fill({ color: 0xf8fafc });
    avatarGfx.ellipse(0, -20, 7, 3).fill({ color: agent.hairColor });

    // Glasses / Visor
    avatarGfx.rect(-4, -18, 8, 2.5).fill({ color: agent.suitColor });

    // C. Overhead Status Badge Indicator
    const badgeGfx = new PIXI.Graphics();
    badgeGfx.name = 'status_badge';

    if (agent.status === 'WORKING') {
      badgeGfx.circle(0, -30, 4).fill({ color: 0x10b981 });
      badgeGfx.circle(0, -30, 6).stroke({ color: 0x34d399, width: 1.5, alpha: 0.8 });
    } else if (agent.status === 'CALL') {
      badgeGfx.circle(0, -30, 4.5).fill({ color: 0xf59e0b });
      badgeGfx.circle(0, -30, 6.5).stroke({ color: 0xfbbf24, width: 1.5, alpha: 0.8 });
    } else if (agent.status === 'ERROR') {
      badgeGfx.circle(0, -30, 5).fill({ color: 0xf43f5e });
      badgeGfx.circle(0, -30, 7).stroke({ color: 0xfb7185, width: 1.5, alpha: 0.9 });
    } else {
      badgeGfx.circle(0, -30, 3).fill({ color: 0x64748b });
    }

    // D. Nameplate Label
    const labelText = new PIXI.Text({
      text: agent.shortName,
      style: {
        fontFamily: 'sans-serif',
        fontSize: 9,
        fontWeight: 'bold',
        fill: 0xf8fafc,
        backgroundColor: '#0f172acc',
        padding: 2,
      },
    });
    labelText.anchor.set(0.5, 1);
    labelText.y = -36;

    // E. Floating Pixel Speech Bubble (if text present)
    if (agent.speechBubbleText) {
      const bubbleContainer = new PIXI.Container();
      bubbleContainer.y = -52;

      const bubbleText = new PIXI.Text({
        text: agent.speechBubbleText,
        style: {
          fontFamily: 'monospace',
          fontSize: 8,
          fill: 0x38bdf8,
          wordWrap: true,
          wordWrapWidth: 110,
        },
      });
      bubbleText.anchor.set(0.5, 0.5);

      const bubbleBg = new PIXI.Graphics();
      const bw = Math.max(70, bubbleText.width + 10);
      const bh = bubbleText.height + 6;

      bubbleBg.roundRect(-bw / 2, -bh / 2, bw, bh, 4).fill({ color: 0x0f172a, alpha: 0.95 }).stroke({ color: 0x38bdf8, width: 1 });
      bubbleBg.poly([0, bh / 2, -4, bh / 2 + 4, 4, bh / 2 + 4]).fill({ color: 0x38bdf8 });

      bubbleContainer.addChild(bubbleBg);
      bubbleContainer.addChild(bubbleText);
      container.addChild(bubbleContainer);
    }

    container.addChild(shadowGfx);
    container.addChild(avatarGfx);
    container.addChild(badgeGfx);
    container.addChild(labelText);

    agentContainer.addChild(container);
  });
}

/**
 * Ticker loop for dynamic pulsing rings
 */
function updateDynamicAnimations(viewport: any, pulseTime: number) {
  const agentContainer = viewport.getChildByName('agent_container');
  if (!agentContainer) return;

  agentContainer.children.forEach((container: any) => {
    const badge = container.getChildByName('status_badge');
    if (badge) {
      const scale = 1 + Math.sin(pulseTime * 3) * 0.15;
      badge.scale.set(scale);
    }
  });
}
