'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LiveOfficeVisualState, VisualAgentState, OfficeEvent } from '@/lib/ai-office/events';
import { OFFICE_ROLES } from '@/lib/ai-office/roles/registry';
import { OfficeErrorBoundary } from './OfficeErrorBoundary';
import {
  OFFICE_IMAGE_DIMENSIONS,
  OFFICE_WORKSTATIONS,
  SOCIAL_DESTINATIONS,
  NAV_GRAPH,
  findGraphPath,
  findNearestNodeId,
  toPixelCoords,
  toNormalizedCoords,
  NormalizedPoint,
  PixelPoint,
} from '@/lib/ai-office/map/office-image-map';
import {
  getAgentPipelineContext,
  getAgentTaskBadge,
  AgentPipelineContext,
} from '@/lib/ai-office/mission-pipeline';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Copy,
  Check,
  Building2,
  Bug,
  Eye,
  EyeOff,
  Activity,
  Compass,
  ArrowLeft,
  X,
  Sparkles,
  MapPin,
  Clock,
  User,
  Shield,
  Layers,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ArrowDownRight,
  ArrowUpRight,
  FileCheck,
  FileText,
} from 'lucide-react';

interface IsometricImageCanvasProps {
  visualState: LiveOfficeVisualState;
  events?: OfficeEvent[];
  activeMissionTitle?: string;
  onSelectAgent?: (roleId: string) => void;
  onOpenCaseFile?: () => void;
  zoomLevel?: number;
  showNavHeader?: boolean;
}

// Internal State for Continuous Waypoint Movement Engine
interface AgentAnimState {
  roleId: string;
  currentPx: PixelPoint;
  targetNorm: NormalizedPoint;
  targetPx: PixelPoint;
  pathWaypoints: PixelPoint[];
  currentWaypointIdx: number;
  isWalking: boolean;
  speed: number;
  facingLeft: boolean;
  bobTime: number;
  lastNodeId: string;
}

const IDLE_INITIAL_DESTINATIONS: Record<string, string> = {
  'director': 'director_desk',
  'head-market': 'review_seat_1',
  'head-offer': 'coffee_counter',
  'head-gtm': 'head_gtm_desk',
  'market-signal-miner': 'arcade_player',
  'audience-positioning-researcher': 'library_seat_1',
  'evidence-auditor': 'library_seat_2',
  'offer-dna-analyst': 'lounge_seat_1',
  'product-mechanism-architect': 'lounge_seat_2',
  'pricing-monetization-strategist': 'lounge_seat_3',
  'creative-strategist': 'beanbag_seat',
  'copy-lp-strategist': 'copy_lp_desk',
  'validation-scale-strategist': 'validation_desk',
};

const SOCIAL_POOL = [
  'arcade_player',
  'beanbag_seat',
  'library_seat_1',
  'library_seat_2',
  'coffee_counter',
  'review_seat_1',
  'review_seat_2',
  'review_seat_3',
  'lounge_seat_1',
  'lounge_seat_2',
  'lounge_seat_3',
];

export function IsometricImageCanvas({
  visualState,
  events = [],
  activeMissionTitle,
  onSelectAgent,
  onOpenCaseFile,
  zoomLevel = 100,
  showNavHeader = true,
}: IsometricImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<any>(null);
  const viewportRef = useRef<any>(null);
  const animStatesRef = useRef<Record<string, AgentAnimState>>({});

  // UX State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showEventLog, setShowEventLog] = useState(true);
  const [cleanMode, setCleanMode] = useState(false);

  // Inspector & Hover State
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [followingAgentId, setFollowingAgentId] = useState<string | null>(null);

  // Debug Inspector State
  const [clickedCoord, setClickedCoord] = useState<{
    pixelX: number;
    pixelY: number;
    normX: number;
    normY: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Check URL parameter ?officeDebug=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('officeDebug') === '1') {
        setIsDebugMode(true);
      }
    }
  }, []);

  // 1. Mount Pixi.js Application & Movement Engine
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let isSubscribed = true;
    let app: any = null;
    let viewport: any = null;

    async function initPixi() {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      if (pixiAppRef.current) {
        try {
          pixiAppRef.current.destroy(true, { children: true, texture: true });
        } catch (e) {
          console.warn('Previous Pixi app cleanup warning:', e);
        }
        pixiAppRef.current = null;
        viewportRef.current = null;
      }

      const PIXI = await import('pixi.js');
      const { Viewport } = await import('pixi-viewport');

      if (!isSubscribed || !containerRef.current) return;

      app = new PIXI.Application();
      await app.init({
        width: containerRef.current.clientWidth || 1280,
        height: containerRef.current.clientHeight || 720,
        backgroundColor: 0x090d14,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });

      if (!isSubscribed || !containerRef.current) {
        app.destroy(true);
        return;
      }

      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;

      app.stage.sortableChildren = true;

      viewport = new Viewport({
        screenWidth: app.screen.width,
        screenHeight: app.screen.height,
        worldWidth: OFFICE_IMAGE_DIMENSIONS.width,
        worldHeight: OFFICE_IMAGE_DIMENSIONS.height,
        events: app.renderer.events,
      });

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({ minScale: 0.35, maxScale: 2.5 });

      viewport.fitWidth(OFFICE_IMAGE_DIMENSIONS.width);
      viewport.moveCenter(OFFICE_IMAGE_DIMENSIONS.width / 2, OFFICE_IMAGE_DIMENSIONS.height / 2);

      viewport.on('drag-start', () => {
        if (app.canvas) app.canvas.style.cursor = 'grabbing';
      });
      viewport.on('drag-end', () => {
        if (app.canvas) app.canvas.style.cursor = 'grab';
      });

      viewport.on('clicked', (e: any) => {
        if (e.event.detail === 2) {
          viewport.fitWidth(OFFICE_IMAGE_DIMENSIONS.width);
          viewport.moveCenter(OFFICE_IMAGE_DIMENSIONS.width / 2, OFFICE_IMAGE_DIMENSIONS.height / 2);
        }
      });

      app.stage.addChild(viewport);
      viewportRef.current = viewport;
      viewport.sortableChildren = true;

      // World Background Layer (office-base.png)
      const bgTexture = await PIXI.Assets.load('/office/office-base.png');
      const bgSprite = new PIXI.Sprite(bgTexture);
      bgSprite.width = OFFICE_IMAGE_DIMENSIONS.width;
      bgSprite.height = OFFICE_IMAGE_DIMENSIONS.height;
      bgSprite.zIndex = -100;
      bgSprite.eventMode = 'static';
      bgSprite.cursor = 'grab';

      bgSprite.on('pointerdown', (e: any) => {
        const localPos = e.getLocalPosition(bgSprite);
        const norm = toNormalizedCoords({ x: localPos.x, y: localPos.y });
        setClickedCoord({
          pixelX: Math.round(localPos.x),
          pixelY: Math.round(localPos.y),
          normX: norm.x,
          normY: norm.y,
        });
      });

      viewport.addChild(bgSprite);

      // Destination Highlights Layer
      const destContainer = new PIXI.Container();
      destContainer.name = 'dest_container';
      destContainer.zIndex = -50;
      viewport.addChild(destContainer);

      // Initialize Agent Sprites with Canvas Task Badges
      initAgentSprites(
        PIXI,
        viewport,
        visualState,
        (roleId) => {
          setSelectedAgentId(roleId);
          if (onSelectAgent) onSelectAgent(roleId);
        },
        (roleId, screenPos) => {
          setHoveredAgentId(roleId);
          setHoverPos(screenPos);
        },
        () => {
          setHoveredAgentId(null);
          setHoverPos(null);
        },
        showNames
      );

      // Initialize Animation State map
      initializeAnimStates();

      // Debug Overlay if active
      if (isDebugMode) {
        renderDebugOverlay(PIXI, viewport);
      }

      // FRAME-BY-FRAME TICKER
      app.ticker.add((ticker: any) => {
        const dt = ticker.deltaTime / 60;
        updateFrameMovement(
          PIXI,
          viewport,
          dt,
          animStatesRef.current,
          visualState,
          followingAgentId,
          showNames,
          showRoutes
        );
      });
    }

    initPixi();

    return () => {
      isSubscribed = false;
      if (pixiAppRef.current) {
        try {
          pixiAppRef.current.destroy(true, { children: true, texture: true });
        } catch (err) {
          // silent cleanup
        }
        pixiAppRef.current = null;
        viewportRef.current = null;
      }
    };
  }, [isDebugMode]);

  // 2. Sync Live Visual State Changes
  useEffect(() => {
    if (viewportRef.current && visualState) {
      syncStateTargets(visualState);
    }
  }, [visualState]);

  // 3. Natural Idle Roam Cycle
  useEffect(() => {
    const hasActiveMission = visualState.phase !== 'IDLE';
    if (hasActiveMission) return;

    const interval = setInterval(() => {
      triggerRandomIdleRoam();
    }, 9000);

    return () => clearInterval(interval);
  }, [visualState.phase]);

  const triggerRandomIdleRoam = () => {
    const roles = Object.keys(OFFICE_WORKSTATIONS);
    const randomRoleId = roles[Math.floor(Math.random() * roles.length)];
    const animState = animStatesRef.current[randomRoleId];
    if (!animState || animState.isWalking) return;

    const randomDestKey = SOCIAL_POOL[Math.floor(Math.random() * SOCIAL_POOL.length)];
    let targetNorm = SOCIAL_DESTINATIONS[randomDestKey];

    if (!targetNorm && OFFICE_WORKSTATIONS[randomDestKey]) {
      targetNorm = OFFICE_WORKSTATIONS[randomDestKey].normalizedPos;
    }

    if (!targetNorm) return;
    setAgentNewTarget(randomRoleId, targetNorm, 105);
  };

  const setAgentNewTarget = (roleId: string, targetNorm: NormalizedPoint, speed = 130) => {
    const anim = animStatesRef.current[roleId];
    if (!anim) return;

    const startNodeId = anim.lastNodeId || findNearestNodeId(toNormalizedCoords(anim.currentPx));
    const targetNodeId = findNearestNodeId(targetNorm);

    const pathNorms = findGraphPath(startNodeId, targetNodeId);
    const waypoints = pathNorms.map((n) => toPixelCoords(n));
    const finalPx = toPixelCoords(targetNorm);
    waypoints.push(finalPx);

    anim.targetNorm = targetNorm;
    anim.targetPx = finalPx;
    anim.pathWaypoints = waypoints;
    anim.currentWaypointIdx = 0;
    anim.isWalking = waypoints.length > 0;
    anim.speed = speed;
    anim.lastNodeId = targetNodeId;
  };

  const syncStateTargets = (vState: LiveOfficeVisualState) => {
    const isReviewActive = vState.meetingRoomState?.isMeetingActive || vState.phase === 'DIRECTOR_REVIEW';

    Object.values(OFFICE_WORKSTATIONS).forEach((ws) => {
      const liveAgent = vState.agents[ws.roleId];
      if (!liveAgent) return;

      let targetNorm = ws.normalizedPos;

      if (isReviewActive && (ws.roleId === 'head-market' || ws.roleId === 'head-offer' || ws.roleId === 'head-gtm' || ws.roleId === 'evidence-auditor')) {
        if (ws.roleId === 'head-market') targetNorm = SOCIAL_DESTINATIONS['review_seat_1'];
        if (ws.roleId === 'head-offer') targetNorm = SOCIAL_DESTINATIONS['review_seat_2'];
        if (ws.roleId === 'head-gtm') targetNorm = SOCIAL_DESTINATIONS['review_seat_3'];
        if (ws.roleId === 'evidence-auditor') targetNorm = SOCIAL_DESTINATIONS['review_seat_4'];
      } else if (vState.phase === 'IDLE') {
        const defaultIdleKey = IDLE_INITIAL_DESTINATIONS[ws.roleId];
        if (defaultIdleKey) {
          targetNorm = SOCIAL_DESTINATIONS[defaultIdleKey] || OFFICE_WORKSTATIONS[defaultIdleKey]?.normalizedPos || ws.normalizedPos;
        }
      }

      const anim = animStatesRef.current[ws.roleId];
      if (anim) {
        const dist = Math.hypot(anim.targetNorm.x - targetNorm.x, anim.targetNorm.y - targetNorm.y);
        if (dist > 0.02) {
          const speed = vState.phase === 'IDLE' ? 110 : 165;
          setAgentNewTarget(ws.roleId, targetNorm, speed);
        }
      }
    });
  };

  const initializeAnimStates = () => {
    Object.values(OFFICE_WORKSTATIONS).forEach((ws) => {
      const defaultIdleKey = IDLE_INITIAL_DESTINATIONS[ws.roleId];
      const initialNorm = SOCIAL_DESTINATIONS[defaultIdleKey] || ws.normalizedPos;
      const initialPx = toPixelCoords(initialNorm);

      animStatesRef.current[ws.roleId] = {
        roleId: ws.roleId,
        currentPx: { ...initialPx },
        targetNorm: initialNorm,
        targetPx: { ...initialPx },
        pathWaypoints: [],
        currentWaypointIdx: 0,
        isWalking: false,
        speed: 110,
        facingLeft: false,
        bobTime: Math.random() * 10,
        lastNodeId: findNearestNodeId(initialNorm),
      };
    });
  };

  const handleFitView = () => {
    if (!viewportRef.current) return;
    viewportRef.current.fitWidth(OFFICE_IMAGE_DIMENSIONS.width);
    viewportRef.current.moveCenter(OFFICE_IMAGE_DIMENSIONS.width / 2, OFFICE_IMAGE_DIMENSIONS.height / 2);
    setFollowingAgentId(null);
  };

  const handleZoomIn = () => {
    viewportRef.current?.zoomPercent(0.2, true);
  };

  const handleZoomOut = () => {
    viewportRef.current?.zoomPercent(-0.2, true);
  };

  const handleResetZoom = () => {
    if (!viewportRef.current) return;
    viewportRef.current.setZoom(1.0, true);
  };

  const centerOnAgent = (roleId: string) => {
    const anim = animStatesRef.current[roleId];
    if (!anim || !viewportRef.current) return;
    viewportRef.current.animate({
      time: 500,
      position: { x: anim.currentPx.x, y: anim.currentPx.y },
      scale: 1.2,
    });
  };

  const toggleFollowAgent = (roleId: string) => {
    if (followingAgentId === roleId) {
      setFollowingAgentId(null);
    } else {
      setFollowingAgentId(roleId);
      centerOnAgent(roleId);
    }
  };

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

  const copyCoordToClipboard = () => {
    if (!clickedCoord) return;
    const text = `{ x: ${clickedCoord.normX}, y: ${clickedCoord.normY} }`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Metrics
  const activeCount = Object.values(visualState.agents).filter(
    (a) => a.state === 'RESEARCHING' || a.state === 'USING_TOOL' || a.state === 'WRITING'
  ).length;
  const walkingCount = Object.values(animStatesRef.current).filter((a) => a.isWalking).length;
  const idleCount = Object.values(visualState.agents).length - activeCount - walkingCount;

  const selectedAgent = selectedAgentId ? visualState.agents[selectedAgentId] : null;
  const selectedRoleDef = selectedAgentId ? OFFICE_ROLES[selectedAgentId] : null;
  const hoveredAgent = hoveredAgentId ? visualState.agents[hoveredAgentId] : null;
  const selectedPipelineCtx = selectedAgentId
    ? getAgentPipelineContext(selectedAgentId, events, visualState)
    : null;

  return (
    <OfficeErrorBoundary widgetName="IsometricImageCanvas">
      <div className="relative w-full h-full min-h-[640px] flex flex-col bg-[#090d14] rounded-3xl border border-slate-800 overflow-hidden select-none font-sans">
        {/* A. TOP STATUS & CONTROL HEADER BAR */}
        {!cleanMode && showNavHeader && (
          <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-4 z-20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                <span>ESCRITÓRIO AO VIVO</span>
              </span>

              <span className="text-xs font-bold text-white tracking-tight">
                {activeMissionTitle || '13 Agentes Operacionais'}
              </span>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ● {visualState.phase || 'IDLE'}
              </span>
            </div>

            {/* Factual Agent Counters */}
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-400">
                <strong className="text-emerald-400">{activeCount}</strong> Trabalhando
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">
                <strong className="text-sky-400">{walkingCount}</strong> Andando
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">
                <strong className="text-slate-300">{Math.max(0, idleCount)}</strong> Idle
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-amber-400 font-semibold">$0,00 (0 LLM Extra)</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setShowEventLog(!showEventLog)}
                className={`px-3 py-1.5 rounded-xl border font-bold transition flex items-center gap-1.5 ${
                  showEventLog
                    ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Alternar Feed de Eventos"
              >
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Eventos</span>
              </button>

              <button
                onClick={() => setCleanMode(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold transition flex items-center gap-1.5"
                title="Ativar Modo Limpo Imersivo"
              >
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Modo Limpo</span>
              </button>
            </div>
          </div>
        )}

        {/* B. MAIN CANVAS AREA WITH OVERLAYS */}
        <div className="relative flex-1 w-full h-full min-h-[580px] overflow-hidden bg-[#090d14] flex items-center justify-center">
          {/* Top-Right Floating Viewport Controls Toolbar */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 text-slate-300 text-xs shadow-2xl">
            {cleanMode && (
              <button
                onClick={() => setCleanMode(false)}
                className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-[10px] flex items-center gap-1"
                title="Sair do Modo Limpo"
              >
                <Eye className="w-3 h-3" />
                <span>Mostrar UI</span>
              </button>
            )}

            <button
              onClick={() => setShowNames(!showNames)}
              className={`p-1.5 rounded-xl transition ${
                showNames ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Mostrar / Ocultar Nomes e Tarefas"
            >
              <User className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowRoutes(!showRoutes)}
              className={`p-1.5 rounded-xl transition ${
                showRoutes ? 'text-sky-400 bg-sky-500/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Mostrar / Ocultar Rotas de Destino"
            >
              <MapPin className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsDebugMode(!isDebugMode)}
              className={`p-1.5 rounded-xl transition ${
                isDebugMode ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Alternar Modo de Debug"
            >
              <Bug className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-slate-800 mx-1" />

            <button onClick={handleZoomOut} className="p-1.5 hover:text-white rounded-xl hover:bg-slate-800" title="Diminuir Zoom">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleFitView} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 font-mono font-bold rounded-xl text-[11px]" title="Smart Fit (Enquadrar 100% do Escritório)">
              Fit
            </button>
            <button onClick={handleResetZoom} className="px-2 py-1 hover:text-white rounded-xl hover:bg-slate-800 font-mono text-[11px]" title="Escala 100%">
              100%
            </button>
            <button onClick={handleZoomIn} className="p-1.5 hover:text-white rounded-xl hover:bg-slate-800" title="Aumentar Zoom">
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-slate-800 mx-1" />

            <button onClick={toggleFullscreen} className="p-1.5 hover:text-purple-300 rounded-xl hover:bg-slate-800" title="Tela Cheia">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Floating Agent Hover Tooltip */}
          {hoveredAgent && hoverPos && !selectedAgentId && (
            <div
              className="fixed z-50 pointer-events-none bg-slate-950/95 backdrop-blur-md p-3.5 rounded-2xl border border-purple-500/40 text-xs shadow-2xl space-y-1.5 transform -translate-x-1/2 -translate-y-full mb-3"
              style={{ left: hoverPos.x, top: hoverPos.y }}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{hoveredAgent.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  ● {hoveredAgent.state}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono line-clamp-1">{hoveredAgent.currentTask}</p>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 pt-1 border-t border-slate-800">
                <span>Estação: {OFFICE_WORKSTATIONS[hoveredAgent.roleId]?.roomName}</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">Clique para inspecionar insumos ↗</span>
              </div>
            </div>
          )}

          {/* Debug Coordinate Calibration Inspector */}
          {isDebugMode && clickedCoord && (
            <div className="absolute top-4 left-4 z-40 bg-slate-950/95 backdrop-blur-md p-3.5 rounded-2xl border border-amber-500/40 text-xs font-mono text-slate-200 shadow-2xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-4">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4" /> INSPEÇÃO DE COORDENADA
                </span>
                <button onClick={() => setClickedCoord(null)} className="text-slate-500 hover:text-white">✕</button>
              </div>
              <div className="space-y-1 text-[11px]">
                <div>Pixel: X={clickedCoord.pixelX}px, Y={clickedCoord.pixelY}px</div>
                <div className="text-amber-300 font-bold">Normalized: x: {clickedCoord.normX}, y: {clickedCoord.normY}</div>
              </div>
              <button
                onClick={copyCoordToClipboard}
                className="w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] transition flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'COPIAR COORDENADA'}</span>
              </button>
            </div>
          )}

          {/* REALTIME EVENT FEED PANEL */}
          {!cleanMode && showEventLog && (
            <div className="absolute bottom-4 left-4 z-30 w-84 max-h-64 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 shadow-2xl flex flex-col space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-purple-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-purple-400" /> FEED DE EVENTOS OPERACIONAIS
                </span>
                <button onClick={() => setShowEventLog(false)} className="text-slate-500 hover:text-white">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono">
                {events.length === 0 ? (
                  <div className="text-slate-500 italic py-2">Aguardando eventos operacionais dos agentes...</div>
                ) : (
                  events.slice(-15).reverse().map((ev, idx) => (
                    <div key={ev.id || idx} className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        <span className="text-purple-400 font-bold uppercase">{ev.type}</span>
                      </div>
                      <p className="text-slate-200 line-clamp-2">{ev.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Pixi Canvas Mount Point */}
          <div ref={containerRef} className="w-full h-full flex items-center justify-center" />
        </div>

        {/* C. RICH AGENT INSPECTOR RIGHT SIDEBAR DRAWER */}
        {selectedAgent && selectedRoleDef && selectedPipelineCtx && (
          <div className="fixed inset-y-0 right-0 w-[420px] bg-slate-950/98 border-l border-slate-800 z-50 p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 backdrop-blur-md overflow-y-auto">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center font-extrabold text-purple-300 text-xl shadow-lg">
                    {selectedAgent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedAgent.name}</h3>
                    <span className="text-xs text-slate-400">{selectedRoleDef.title}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedAgentId(null)} className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Badge & Timing */}
              <div className="space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px] uppercase">Estado Atual</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold font-mono uppercase inline-block mt-0.5">
                      ● {selectedAgent.state}
                    </span>
                  </div>
                  {selectedPipelineCtx.taskStartTime && (
                    <div className="text-right font-mono">
                      <span className="text-slate-500 text-[10px] block uppercase">Início da Tarefa</span>
                      <span className="text-slate-300 font-semibold">{selectedPipelineCtx.taskStartTime}</span>
                    </div>
                  )}
                </div>

                {/* Current Execution Task */}
                <div>
                  <span className="text-slate-400 block mb-1 font-mono text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> Tarefa Em Execução
                  </span>
                  <p className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 text-slate-200 font-mono leading-relaxed text-[11px]">
                    {selectedAgent.currentTask || 'Aguardando próxima instrução...'}
                  </p>
                </div>

                {selectedAgent.activeToolLabel && (
                  <div>
                    <span className="text-slate-400 block mb-1 font-mono text-[10px] uppercase">Ferramenta Em Uso</span>
                    <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-amber-300 font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>{selectedAgent.activeToolLabel}</span>
                    </div>
                  </div>
                )}

                {/* Input Received (Entrada) */}
                <div>
                  <span className="text-slate-400 block mb-1 font-mono text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <ArrowDownRight className="w-3.5 h-3.5 text-indigo-400" /> Entrada Recebida (Input)
                  </span>
                  <div className="bg-indigo-500/10 border border-indigo-500/25 p-3 rounded-2xl text-indigo-200 font-mono text-[11px] leading-relaxed">
                    {selectedPipelineCtx.receivedInput || 'Inteligência de Mercado e Insumos da Missão'}
                  </div>
                </div>

                {/* Output Parcial / Final */}
                <div>
                  <span className="text-slate-400 block mb-1 font-mono text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> Saída Produzida (Output)
                  </span>
                  <div className="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-2xl text-emerald-200 font-mono text-[11px] leading-relaxed">
                    {selectedPipelineCtx.producedOutput || 'Processando dados para envio ao próximo estágio...'}
                  </div>
                </div>

                {/* Pipeline Flow Lineage */}
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-[11px] font-mono">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Fluxo da Linha de Produção</span>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Anterior:</span>
                    <span className="font-bold text-slate-200">{selectedPipelineCtx.upstreamAgentName || 'Entrada Inicial'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Próximo Agente:</span>
                    <span className="font-bold text-purple-300">{selectedPipelineCtx.downstreamAgentName || 'Diretoria'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Estação Base:</span>
                    <span className="font-semibold text-slate-200">{OFFICE_WORKSTATIONS[selectedAgent.roleId]?.roomName}</span>
                  </div>
                </div>

                {/* Recent Activity Timeline */}
                {selectedPipelineCtx.recentActivity.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-slate-400 font-mono text-[10px] uppercase font-bold block">Histórico Recente</span>
                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                      {selectedPipelineCtx.recentActivity.map((act, i) => (
                        <div key={i} className="text-[10px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 line-clamp-2">
                          {act}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Drawer Actions */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => centerOnAgent(selectedAgent.roleId)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
              >
                <Crosshair className="w-4 h-4 text-amber-400" />
                <span>CENTRALIZAR CÂMERA</span>
              </button>

              <button
                onClick={() => toggleFollowAgent(selectedAgent.roleId)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  followingAgentId === selectedAgent.roleId
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Compass className="w-4 h-4 text-purple-300" />
                <span>{followingAgentId === selectedAgent.roleId ? 'SEGUINDO AGENTE ✓' : 'SEGUIR AGENTE'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </OfficeErrorBoundary>
  );
}

/**
 * Render 13 Agent Sprites + CANVAS TASK & STATUS BADGES
 */
function initAgentSprites(
  PIXI: any,
  viewport: any,
  visualState: LiveOfficeVisualState,
  onSelectAgent: (roleId: string) => void,
  onHoverAgent: (roleId: string, screenPos: { x: number; y: number }) => void,
  onLeaveAgent: () => void,
  showNames: boolean
) {
  let agentContainer = viewport.getChildByName('agent_container');
  if (!agentContainer) {
    agentContainer = new PIXI.Container();
    agentContainer.name = 'agent_container';
    viewport.addChild(agentContainer);
  }
  agentContainer.removeChildren();

  Object.values(OFFICE_WORKSTATIONS).forEach((ws) => {
    const px = toPixelCoords(ws.normalizedPos);
    const container = new PIXI.Container();
    container.name = `agent_${ws.roleId}`;
    container.x = px.x;
    container.y = px.y;
    container.zIndex = px.y;

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => onSelectAgent(ws.roleId));
    container.on('pointerover', (e: any) => {
      const global = e.global;
      onHoverAgent(ws.roleId, { x: global.x, y: global.y });
    });
    container.on('pointerout', () => onLeaveAgent());

    // 1. Drop Shadow at feet
    const shadowGfx = new PIXI.Graphics();
    shadowGfx.ellipse(0, 13, 14, 5.5).fill({ color: 0x000000, alpha: 0.45 });

    // 2. 2.5D Character Avatar Sprite
    const avatarGfx = new PIXI.Graphics();
    avatarGfx.name = 'avatar_gfx';

    const deptColor =
      ws.department === 'executive'
        ? 0xa855f7
        : ws.department === 'market'
        ? 0x06b6d4
        : ws.department === 'offer'
        ? 0x6366f1
        : 0x10b981;

    avatarGfx.roundRect(-6, 0, 5, 13, 2).fill({ color: 0x0f172a });
    avatarGfx.roundRect(1, 0, 5, 13, 2).fill({ color: 0x0f172a });
    avatarGfx.roundRect(-10, -15, 20, 15, 3).fill({ color: 0x1e293b }).stroke({ color: deptColor, width: 2.0 });
    avatarGfx.circle(0, -22, 8.5).fill({ color: 0xf8fafc });
    avatarGfx.ellipse(0, -25, 9, 4).fill({ color: 0x1e293b });
    avatarGfx.rect(-5, -24, 10, 3).fill({ color: deptColor });

    // 3. Nameplate Label
    const labelText = new PIXI.Text({
      text: ws.shortName,
      style: {
        fontFamily: 'sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        fill: 0xffffff,
        backgroundColor: '#090d16f2',
        padding: 4,
        borderRadius: 4,
      },
    });
    labelText.name = 'nameplate';
    labelText.anchor.set(0.5, 1);
    labelText.y = -42;
    labelText.visible = showNames;

    // 4. Task Short Badge on Canvas
    const taskBadge = new PIXI.Text({
      text: 'Disponível',
      style: {
        fontFamily: 'sans-serif',
        fontSize: 9,
        fontWeight: 'bold',
        fill: 0x38bdf8,
        backgroundColor: '#020617e6',
        padding: 3,
        borderRadius: 3,
      },
    });
    taskBadge.name = 'task_badge';
    taskBadge.anchor.set(0.5, 1);
    taskBadge.y = -60;
    taskBadge.visible = showNames;

    // 5. Status Dot Indicator
    const statusDot = new PIXI.Graphics();
    statusDot.name = 'status_dot';
    statusDot.circle(0, -32, 4).fill({ color: 0x64748b });
    statusDot.stroke({ color: 0x0f172a, width: 1.5 });

    container.addChild(shadowGfx);
    container.addChild(avatarGfx);
    container.addChild(statusDot);
    container.addChild(taskBadge);
    container.addChild(labelText);

    agentContainer.addChild(container);
  });
}

/**
 * Frame-by-Frame Continuous Waypoint Movement & Task Badge Update
 */
function updateFrameMovement(
  PIXI: any,
  viewport: any,
  dt: number,
  animStates: Record<string, AgentAnimState>,
  visualState: LiveOfficeVisualState,
  followingAgentId: string | null,
  showNames: boolean,
  showRoutes: boolean
) {
  const agentContainer = viewport.getChildByName('agent_container');
  const destContainer = viewport.getChildByName('dest_container');
  if (!agentContainer) return;

  if (destContainer) destContainer.removeChildren();

  Object.values(OFFICE_WORKSTATIONS).forEach((ws) => {
    const agentSprite = agentContainer.getChildByName(`agent_${ws.roleId}`);
    const anim = animStates[ws.roleId];
    const liveAgent = visualState.agents[ws.roleId];
    if (!agentSprite || !anim) return;

    // Waypoint Step
    if (anim.isWalking && anim.pathWaypoints.length > 0) {
      const nextWaypoint = anim.pathWaypoints[anim.currentWaypointIdx];
      if (nextWaypoint) {
        const dx = nextWaypoint.x - anim.currentPx.x;
        const dy = nextWaypoint.y - anim.currentPx.y;
        const dist = Math.hypot(dx, dy);
        const step = anim.speed * dt;

        if (Math.abs(dx) > 1) {
          anim.facingLeft = dx < 0;
        }

        if (dist <= step) {
          anim.currentPx.x = nextWaypoint.x;
          anim.currentPx.y = nextWaypoint.y;
          anim.currentWaypointIdx += 1;

          if (anim.currentWaypointIdx >= anim.pathWaypoints.length) {
            anim.isWalking = false;
          }
        } else {
          anim.currentPx.x += (dx / dist) * step;
          anim.currentPx.y += (dy / dist) * step;
        }

        anim.bobTime += dt * 10;
      }
    }

    const bobY = anim.isWalking ? Math.abs(Math.sin(anim.bobTime)) * 3 : 0;
    agentSprite.x = anim.currentPx.x;
    agentSprite.y = anim.currentPx.y - bobY;
    agentSprite.zIndex = anim.currentPx.y;

    const avatarGfx = agentSprite.getChildByName('avatar_gfx');
    if (avatarGfx) {
      avatarGfx.scale.x = anim.facingLeft ? -1 : 1;
    }

    const nameplate = agentSprite.getChildByName('nameplate');
    if (nameplate) nameplate.visible = showNames;

    // Update Task Badge & Status Dot text
    const taskBadge = agentSprite.getChildByName('task_badge');
    const statusDot = agentSprite.getChildByName('status_dot');

    if (liveAgent) {
      const badgeInfo = getAgentTaskBadge(liveAgent);
      if (taskBadge) {
        taskBadge.text = `${badgeInfo.icon} ${badgeInfo.label}`;
        taskBadge.visible = showNames;
      }

      if (statusDot) {
        statusDot.clear();
        let colorHex = parseInt(badgeInfo.color.replace('#', '0x'), 16);
        statusDot.circle(0, -32, 4).fill({ color: colorHex });
        statusDot.stroke({ color: 0x0f172a, width: 1.5 });
      }
    }

    if (followingAgentId === ws.roleId) {
      viewport.moveCenter(anim.currentPx.x, anim.currentPx.y);
    }

    if (showRoutes && destContainer && anim.isWalking) {
      const ringGfx = new PIXI.Graphics();
      ringGfx.circle(anim.targetPx.x, anim.targetPx.y, 10).stroke({ color: 0x38bdf8, width: 2, alpha: 0.7 });
      ringGfx.circle(anim.targetPx.x, anim.targetPx.y, 3).fill({ color: 0x38bdf8, alpha: 0.9 });
      destContainer.addChild(ringGfx);
    }
  });
}

function renderDebugOverlay(PIXI: any, viewport: any) {
  let debugContainer = viewport.getChildByName('debug_overlay');
  if (!debugContainer) {
    debugContainer = new PIXI.Container();
    debugContainer.name = 'debug_overlay';
    debugContainer.zIndex = 99999;
    viewport.addChild(debugContainer);
  }
  debugContainer.removeChildren();

  const gfx = new PIXI.Graphics();

  Object.values(NAV_GRAPH).forEach((node) => {
    const p1 = toPixelCoords(node.normalizedPos);
    node.neighbors.forEach((nId) => {
      const neighbor = NAV_GRAPH[nId];
      if (neighbor) {
        const p2 = toPixelCoords(neighbor.normalizedPos);
        gfx.lineStyle(1.5, 0x38bdf8, 0.4);
        gfx.moveTo(p1.x, p1.y);
        gfx.lineTo(p2.x, p2.y);
      }
    });
  });

  Object.values(NAV_GRAPH).forEach((node) => {
    const p = toPixelCoords(node.normalizedPos);
    gfx.circle(p.x, p.y, 4).fill({ color: 0x38bdf8 });
  });

  Object.values(OFFICE_WORKSTATIONS).forEach((ws) => {
    const p = toPixelCoords(ws.normalizedPos);
    gfx.circle(p.x, p.y, 6).fill({ color: 0xf59e0b, alpha: 0.8 });
    gfx.stroke({ color: 0xffffff, width: 1 });
  });

  debugContainer.addChild(gfx);
}
