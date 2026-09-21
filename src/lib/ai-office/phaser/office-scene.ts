import type Phaser from 'phaser';
import {
  ISO_WORLD,
  ISO_ROOMS,
  ISO_WAYPOINTS,
  ISO_AGENTS_CONFIG,
  IsoRoomConfig,
  IsoAgentDeskConfig,
  Point2D,
} from './iso-map-config';
import { IsoPathfinding } from './iso-pathfinding';
import { LiveOfficeVisualState, VisualAgentState } from '../events';

export type IdleActivityType = 'DESK' | 'WALK' | 'COFFEE' | 'LOUNGE' | 'POOL' | 'LIBRARY';

export interface AgentIdleState {
  roleId: string;
  activity: IdleActivityType;
  timer: any;
}

const SceneBase: typeof Phaser.Scene =
  typeof window !== 'undefined'
    ? (require('phaser').Scene as typeof Phaser.Scene)
    : (class {} as any);

export class OfficeScene extends SceneBase {
  private agentContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private agentSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private statusDots: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private toolBadges: Map<string, Phaser.GameObjects.Container> = new Map();

  private caseFileTerminal: Phaser.GameObjects.Image | null = null;
  private pathfinding!: IsoPathfinding;

  // Frontend Idle Behavior Controller State
  private agentIdleMap: Map<string, AgentIdleState> = new Map();
  private realMissionActiveAgents: Set<string> = new Set();
  private isMissionRunning: boolean = false;
  private isDebugMode: boolean = false;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload() {
    // 1. Preload 2.5D Illustrated SVG Asset Pack
    const artPath = '/office/art';

    // Tiles
    this.load.svg('tile_wood', `${artPath}/tiles/wood_floor.svg`);
    this.load.svg('tile_carpet', `${artPath}/tiles/carpet_tile.svg`);
    this.load.svg('tile_floor', `${artPath}/tiles/tile_floor.svg`);
    this.load.svg('lounge_rug', `${artPath}/tiles/lounge_rug.svg`);

    // Furniture & Decor
    this.load.svg('furniture_pool_table', `${artPath}/furniture/pool_table.svg`);
    this.load.svg('furniture_coffee_station', `${artPath}/furniture/coffee_station.svg`);
    this.load.svg('furniture_sofa_lounge', `${artPath}/furniture/sofa_lounge.svg`);
    this.load.svg('furniture_armchair', `${artPath}/furniture/armchair.svg`);
    this.load.svg('furniture_bookshelf', `${artPath}/furniture/bookshelf.svg`);
    this.load.svg('furniture_meeting_table', `${artPath}/furniture/meeting_table.svg`);
    this.load.svg('furniture_desk_workstation', `${artPath}/furniture/desk_workstation.svg`);
    this.load.svg('furniture_operations_terminal', `${artPath}/furniture/operations_terminal.svg`);
    this.load.svg('decor_plant_potted', `${artPath}/decor/plant_potted.svg`);

    // 13 Illustrated Agent Avatars
    Object.keys(ISO_AGENTS_CONFIG).forEach((roleId) => {
      this.load.svg(`agent_${roleId}`, `${artPath}/agents/agent_${roleId}.svg`);
    });
  }

  create() {
    this.cameras.main.setBounds(0, 0, ISO_WORLD.width, ISO_WORLD.height);

    // Check debug URL parameter (?officeDebug=1)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      this.isDebugMode = urlParams.get('officeDebug') === '1';
    }

    // 1. Initialize Pathfinding Grid (30x18 tiles)
    this.pathfinding = new IsoPathfinding(ISO_WORLD.gridWidth, ISO_WORLD.gridHeight);

    // 2. Draw Continuous Architectural Floorplan (Pisos & Parede de Vidro)
    this.drawFloorplan();

    // 3. Place Illustrated Furniture & Objects
    this.placeFurniture();

    // 4. Create 13 Agent Sprites & Nameplates
    this.createAgentSprites();

    // 5. Initialize Frontend Idle Controller
    this.initIdleBehaviorController();

    // Debug Overlay (Only when ?officeDebug=1 is set)
    if (this.isDebugMode) {
      this.drawDebugGrid();
    }

    // Handle Input Events
    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const roleId = gameObject.getData('roleId');
      if (roleId) {
        this.game.events.emit('select-agent', roleId);
      }
      if (gameObject.getData('isCaseFile')) {
        this.game.events.emit('open-casefile');
      }
    });

    // Notify wrapper that scene is ready
    this.game.events.emit('scene-ready');
  }

  /**
   * Render Continuous 2.5D Building Floorplan (Zero Phaser.Graphics for Art)
   */
  private drawFloorplan() {
    // Backdrop Fill
    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x090d14, 1);
    bgGfx.fillRect(0, 0, ISO_WORLD.width, ISO_WORLD.height);

    // Continuous Building Outer Bounds Shadow & Base
    const buildingX = 30;
    const buildingY = 30;
    const buildingW = 1140;
    const buildingH = 660;

    bgGfx.fillStyle(0x000000, 0.5);
    bgGfx.fillRoundedRect(buildingX + 8, buildingY + 8, buildingW, buildingH, 16);
    bgGfx.fillStyle(0x0d131f, 0.95);
    bgGfx.fillRoundedRect(buildingX, buildingY, buildingW, buildingH, 16);
    bgGfx.lineStyle(2, 0x1e293b, 0.8);
    bgGfx.strokeRoundedRect(buildingX, buildingY, buildingW, buildingH, 16);

    // Render Floor Tile Textures for each room
    ISO_ROOMS.forEach((room) => {
      const px = room.gridX * ISO_WORLD.tileSize;
      const py = room.gridY * ISO_WORLD.tileSize;
      const pw = room.gridW * ISO_WORLD.tileSize;
      const ph = room.gridH * ISO_WORLD.tileSize;

      let tileKey = 'tile_carpet';
      if (room.floorTile === 'wood') tileKey = 'tile_wood';
      if (room.floorTile === 'tile') tileKey = 'tile_floor';

      // Tile texture fill across room grid
      for (let x = px; x < px + pw; x += 128) {
        for (let y = py; y < py + ph; y += 64) {
          const tile = this.add.image(x + 64, y + 32, tileKey);
          tile.setDepth(1);
          tile.setAlpha(0.9);
        }
      }

      // Room Title Floor Plate Label (Discreet 10px text)
      const label = this.add.text(px + 12, py + 10, room.title, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: room.textColor,
      });
      label.setAlpha(0.65);
      label.setDepth(2);
    });

    // Glass Wall Dividers & Door Openings (Wall Layer)
    const wallGfx = this.add.graphics();
    wallGfx.setDepth(5);

    // Glass Room Outline Accents
    ISO_ROOMS.forEach((room) => {
      const px = room.gridX * ISO_WORLD.tileSize;
      const py = room.gridY * ISO_WORLD.tileSize;
      const pw = room.gridW * ISO_WORLD.tileSize;
      const ph = room.gridH * ISO_WORLD.tileSize;

      wallGfx.lineStyle(2, room.color, 0.4);
      wallGfx.strokeRoundedRect(px, py, pw, ph, 8);
    });
  }

  /**
   * Place Illustrated Furniture & Objects (Desks, Chairs, Monitors, Sofas, Pool Table, Coffee, Library)
   */
  private placeFurniture() {
    // 1. Lounge Rug Asset
    const rug = this.add.image(680, 250, 'lounge_rug');
    rug.setDepth(2);

    // 2. Workstations & Desks for all 13 Agents
    Object.values(ISO_AGENTS_CONFIG).forEach((cfg) => {
      // Workstation Desk Asset
      const desk = this.add.image(cfg.deskPos.x, cfg.deskPos.y, 'furniture_desk_workstation');
      desk.setDepth(cfg.deskPos.y);

      // Ergonomic Chair Asset
      const chair = this.add.image(cfg.chairPos.x, cfg.chairPos.y, 'furniture_desk_workstation');
      chair.setScale(0.3);
      chair.setDepth(cfg.chairPos.y - 1);

      // Mark desk tile as blocked in pathfinding
      const gx = Math.floor(cfg.deskPos.x / ISO_WORLD.tileSize);
      const gy = Math.floor(cfg.deskPos.y / ISO_WORLD.tileSize);
      this.pathfinding.setWalkable(gx, gy, false);
    });

    // 3. Review Board Oval Meeting Table
    const meetingTable = this.add.image(600, 560, 'furniture_meeting_table');
    meetingTable.setDepth(560);
    this.pathfinding.setAreaWalkable(14, 13, 3, 2, false);

    // 4. Knowledge Library Bookshelves
    const bookshelf = this.add.image(970, 90, 'furniture_bookshelf');
    bookshelf.setDepth(90);
    this.pathfinding.setAreaWalkable(22, 1, 3, 1, false);

    // 5. Coffee Station (Granite Counter + Espresso Machine)
    const coffeeStation = this.add.image(500, 240, 'furniture_coffee_station');
    coffeeStation.setDepth(240);
    this.pathfinding.setAreaWalkable(12, 5, 2, 1, false);

    // 6. Lounge Sofas & Armchairs
    const sofa1 = this.add.image(660, 230, 'furniture_sofa_lounge');
    sofa1.setDepth(230);
    const sofa2 = this.add.image(660, 270, 'furniture_sofa_lounge');
    sofa2.setDepth(270);
    const armchair = this.add.image(720, 250, 'furniture_armchair');
    armchair.setDepth(250);
    this.pathfinding.setAreaWalkable(16, 5, 3, 2, false);

    // 7. REAL Billiards Pool Table (Mahogany + Emerald Felt + Balls + Cues)
    const poolTable = this.add.image(600, 390, 'furniture_pool_table');
    poolTable.setDepth(390);
    this.pathfinding.setAreaWalkable(13, 9, 4, 2, false);

    // 8. Operations Terminal (Wall-mounted Case File Monitor Object)
    this.caseFileTerminal = this.add.image(600, 160, 'furniture_operations_terminal');
    this.caseFileTerminal.setDepth(160);
    this.caseFileTerminal.setInteractive({ useHandCursor: true });
    this.caseFileTerminal.setData('isCaseFile', true);

    // 9. Potted Plants in Corners
    const plant1 = this.add.image(60, 220, 'decor_plant_potted');
    plant1.setDepth(220);
    const plant2 = this.add.image(1140, 220, 'decor_plant_potted');
    plant2.setDepth(220);
    const plant3 = this.add.image(740, 290, 'decor_plant_potted');
    plant3.setDepth(290);
  }

  /**
   * Create 13 Illustrated Agent Avatars, Nameplates & Status Indicators
   */
  private createAgentSprites() {
    Object.values(ISO_AGENTS_CONFIG).forEach((cfg) => {
      // Container positioned at initial chair coordinate
      const container = this.add.container(cfg.chairPos.x, cfg.chairPos.y);

      // Illustrated 2.5D Avatar Image Sprite
      const sprite = this.add.image(0, -12, `agent_${cfg.roleId}`);
      sprite.setOrigin(0.5, 0.5);

      // Container hit area for click inspection
      container.setSize(36, 48);
      container.setInteractive({ useHandCursor: true });
      container.setData('roleId', cfg.roleId);

      // Discrete 9-10px Nameplate Label
      const labelText = this.add.text(0, -32, cfg.shortName, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#f8fafc',
        backgroundColor: '#0f172aa8',
        padding: { x: 4, y: 2 },
      });
      labelText.setOrigin(0.5, 0.5);

      // Status Indicator Dot (gray=idle, blue=working, amber=review, green=done, red=error)
      const statusDot = this.add.graphics();
      statusDot.fillStyle(0x64748b, 1);
      statusDot.fillCircle(0, -20, 3);
      statusDot.lineStyle(1, 0x0f172a, 1);
      statusDot.strokeCircle(0, -20, 3);

      // Tool Badge Container (floating above name label)
      const toolBadge = this.add.container(0, -48);
      toolBadge.setVisible(false);

      container.add([sprite, labelText, statusDot, toolBadge]);
      container.setDepth(cfg.chairPos.y + 10);

      this.agentContainers.set(cfg.roleId, container);
      this.agentSprites.set(cfg.roleId, sprite);
      this.nameLabels.set(cfg.roleId, labelText);
      this.statusDots.set(cfg.roleId, statusDot);
      this.toolBadges.set(cfg.roleId, toolBadge);
    });
  }

  // =========================================================================
  // FRONTEND IDLE BEHAVIOR CONTROLLER (0 LLM CALLS, $0 COST)
  // =========================================================================

  private initIdleBehaviorController() {
    Object.keys(ISO_AGENTS_CONFIG).forEach((roleId, idx) => {
      this.agentIdleMap.set(roleId, {
        roleId,
        activity: 'DESK',
        timer: null,
      });

      // Random stagger delay (2s to 12s)
      const staggerDelay = 2000 + idx * 1000 + Math.random() * 2000;
      this.time.delayedCall(staggerDelay, () => {
        this.scheduleNextIdleActivity(roleId);
      });
    });
  }

  private scheduleNextIdleActivity(roleId: string) {
    if (this.realMissionActiveAgents.has(roleId)) return;

    const idleState = this.agentIdleMap.get(roleId);
    if (!idleState) return;

    const nextActivity = this.chooseIdleActivity(roleId);
    idleState.activity = nextActivity;

    this.executeIdleActivity(roleId, nextActivity);

    // Random action duration between 10 and 35 seconds
    const durationMs = 10000 + Math.floor(Math.random() * 25000);

    if (idleState.timer) idleState.timer.destroy();
    idleState.timer = this.time.delayedCall(durationMs, () => {
      this.scheduleNextIdleActivity(roleId);
    });
  }

  private chooseIdleActivity(roleId: string): IdleActivityType {
    let coffeeCount = 0;
    let loungeCount = 0;
    let poolCount = 0;
    let libraryCount = 0;

    this.agentIdleMap.forEach((st, id) => {
      if (id === roleId) return;
      if (st.activity === 'COFFEE') coffeeCount++;
      if (st.activity === 'LOUNGE') loungeCount++;
      if (st.activity === 'POOL') poolCount++;
      if (st.activity === 'LIBRARY') libraryCount++;
    });

    const rand = Math.random();
    if (rand < 0.40) return 'DESK';
    if (rand < 0.55) return 'WALK';
    if (rand < 0.70 && coffeeCount < 3) return 'COFFEE';
    if (rand < 0.85 && loungeCount < 4) return 'LOUNGE';
    if (rand < 0.92 && poolCount < 2) return 'POOL';
    if (libraryCount < 2) return 'LIBRARY';

    return 'DESK';
  }

  private executeIdleActivity(roleId: string, activity: IdleActivityType) {
    const container = this.agentContainers.get(roleId);
    const cfg = ISO_AGENTS_CONFIG[roleId];
    if (!container || !cfg) return;

    let targetPos: Point2D = cfg.chairPos;
    switch (activity) {
      case 'COFFEE': targetPos = cfg.coffeePos; break;
      case 'LOUNGE': targetPos = cfg.loungePos; break;
      case 'POOL': targetPos = cfg.poolPos; break;
      case 'LIBRARY': targetPos = cfg.libraryPos; break;
      case 'WALK': targetPos = ISO_WAYPOINTS['main_hub']; break;
      case 'DESK': default: targetPos = cfg.chairPos; break;
    }

    this.walkAgentTo(container, targetPos);
  }

  /**
   * Smooth A* Grid Pathfinding Walk Execution
   */
  private walkAgentTo(container: Phaser.GameObjects.Container, targetPixelPos: Point2D) {
    const startGrid = {
      x: Math.floor(container.x / ISO_WORLD.tileSize),
      y: Math.floor(container.y / ISO_WORLD.tileSize),
    };
    const targetGrid = {
      x: Math.floor(targetPixelPos.x / ISO_WORLD.tileSize),
      y: Math.floor(targetPixelPos.y / ISO_WORLD.tileSize),
    };

    const gridPath = this.pathfinding.findPath(startGrid, targetGrid);
    const pixelPath = gridPath.map((pt) => ({
      x: pt.x * ISO_WORLD.tileSize + 20,
      y: pt.y * ISO_WORLD.tileSize + 20,
    }));

    this.animateAgentPath(container, pixelPath);
  }

  /**
   * Smooth Waypoint Path Tweening with Bobbing Motion
   */
  private animateAgentPath(container: Phaser.GameObjects.Container, waypoints: Point2D[]) {
    this.tweens.killTweensOf(container);
    if (waypoints.length <= 1) return;

    const tweenChain = waypoints.map((wpt) => ({
      targets: container,
      x: wpt.x,
      y: wpt.y,
      duration: 600,
      ease: 'Power1',
      onUpdate: () => {
        container.setDepth(container.y + 10);
      },
    }));

    this.tweens.chain({
      targets: container,
      tweens: tweenChain,
    });
  }

  /**
   * React state sync endpoint: Updates positions & animations from LiveOfficeVisualState
   */
  public updateOfficeVisualState(visualState: LiveOfficeVisualState) {
    const hasActiveMission = Boolean(visualState.missionId && visualState.missionId !== 'idle');
    this.isMissionRunning = hasActiveMission;

    // Check if Review Board Meeting is Active
    const isMeetingActive = visualState.meetingRoomState?.isMeetingActive || visualState.phase === 'DIRECTOR_REVIEW';

    // Update Agent States & Positions (Real Mission Priority over Idle)
    Object.values(visualState.agents).forEach((agent) => {
      const container = this.agentContainers.get(agent.roleId);
      const cfg = ISO_AGENTS_CONFIG[agent.roleId];
      const statusDot = this.statusDots.get(agent.roleId);

      if (!container || !cfg || !statusDot) return;

      const isRealWorking =
        agent.state === 'RESEARCHING' ||
        agent.state === 'USING_TOOL' ||
        agent.state === 'WRITING' ||
        agent.state === 'REVIEWING' ||
        agent.state === 'MEETING';

      if (isRealWorking) {
        this.realMissionActiveAgents.add(agent.roleId);
        const idleState = this.agentIdleMap.get(agent.roleId);
        if (idleState?.timer) {
          idleState.timer.destroy();
          idleState.timer = null;
        }

        let targetPos: Point2D = cfg.chairPos;
        if (isMeetingActive && (agent.department === 'market' || agent.department === 'offer' || agent.department === 'gtm')) {
          targetPos = cfg.meetingPos; // WALK TO REVIEW BOARD MEETING ROOM
        } else if (agent.currentLocation === 'library') {
          targetPos = cfg.libraryPos;
        } else if (agent.currentLocation === 'executive_room') {
          targetPos = ISO_AGENTS_CONFIG['director'].deskPos;
        }

        const dist = Math.hypot(targetPos.x - container.x, targetPos.y - container.y);
        if (dist > 30) {
          this.walkAgentTo(container, targetPos);
        }
      } else {
        if (this.realMissionActiveAgents.has(agent.roleId)) {
          this.realMissionActiveAgents.delete(agent.roleId);
          this.scheduleNextIdleActivity(agent.roleId);
        }
      }

      // Update Status Dot Color
      statusDot.clear();
      let dotColor = 0x64748b; // gray idle
      if (agent.state === 'RESEARCHING' || agent.state === 'WRITING') dotColor = 0x38bdf8; // blue working
      if (agent.state === 'USING_TOOL') dotColor = 0xf59e0b; // amber tool
      if (agent.state === 'REVIEWING' || agent.state === 'MEETING') dotColor = 0xc084fc; // purple review/meeting
      if (agent.state === 'APPROVED') dotColor = 0x34d399; // green approved
      if (agent.state === 'ERROR') dotColor = 0xf43f5e; // red error

      statusDot.fillStyle(dotColor, 1);
      statusDot.fillCircle(0, -20, 3);
      statusDot.lineStyle(1, 0x0f172a, 1);
      statusDot.strokeCircle(0, -20, 3);
    });
  }

  /**
   * Debug Grid Overlay (Active only when ?officeDebug=1 URL parameter is set)
   */
  private drawDebugGrid() {
    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(999);
    this.debugGraphics.lineStyle(1, 0x00ff00, 0.3);

    for (let x = 0; x < ISO_WORLD.width; x += ISO_WORLD.tileSize) {
      this.debugGraphics.lineBetween(x, 0, x, ISO_WORLD.height);
    }
    for (let y = 0; y < ISO_WORLD.height; y += ISO_WORLD.tileSize) {
      this.debugGraphics.lineBetween(0, y, ISO_WORLD.width, y);
    }
  }
}
