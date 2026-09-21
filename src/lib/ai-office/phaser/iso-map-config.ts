/**
 * Offer Intelligence Office - 2.5D Top-Down Architecture, Furniture & Pathfinding Grid Config
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface IsoRoomConfig {
  id: string;
  title: string;
  color: number;
  textColor: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  floorTile: 'wood' | 'carpet' | 'tile';
}

export interface IsoFurnitureConfig {
  id: string;
  spriteKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depthOffset?: number;
  isBlocker?: boolean;
}

export interface IsoAgentDeskConfig {
  roleId: string;
  name: string;
  shortName: string;
  department: 'market' | 'offer' | 'gtm' | 'executive';
  deskPos: Point2D;
  chairPos: Point2D;
  meetingPos: Point2D;
  libraryPos: Point2D;
  coffeePos: Point2D;
  loungePos: Point2D;
  poolPos: Point2D;
  avatarSpriteKey: string;
  monitorType: 'single' | 'dual' | 'vertical' | 'chart' | 'alert';
}

export const ISO_WORLD = {
  width: 1200,
  height: 720,
  gridWidth: 30,
  gridHeight: 18,
  tileSize: 40,
};

/**
 * 10 Architectural Rooms forming ONE Continuous Illustrated Office Floorplan
 */
export const ISO_ROOMS: IsoRoomConfig[] = [
  // 1. Diretoria / CTO Room (Top Center)
  {
    id: 'executive',
    title: 'DIRETORIA',
    color: 0xa855f7,
    textColor: '#c084fc',
    gridX: 11,
    gridY: 1,
    gridW: 8,
    gridH: 4,
    floorTile: 'wood',
  },
  // 2. Mercado & Validação (Top/Mid Left)
  {
    id: 'market',
    title: 'MERCADO & VALIDAÇÃO',
    color: 0x06b6d4,
    textColor: '#38bdf8',
    gridX: 1,
    gridY: 5,
    gridW: 9,
    gridH: 6,
    floorTile: 'carpet',
  },
  // 3. Arquitetura de Oferta (Top/Mid Right)
  {
    id: 'offer',
    title: 'ARQUITETURA DE OFERTA',
    color: 0x6366f1,
    textColor: '#818cf8',
    gridX: 20,
    gridY: 5,
    gridW: 9,
    gridH: 6,
    floorTile: 'carpet',
  },
  // 4. Go-To-Market (Bottom Left)
  {
    id: 'gtm',
    title: 'GO-TO-MARKET',
    color: 0x10b981,
    textColor: '#34d399',
    gridX: 1,
    gridY: 12,
    gridW: 9,
    gridH: 5,
    floorTile: 'carpet',
  },
  // 5. Review Board Meeting Room (Bottom Center)
  {
    id: 'meeting',
    title: 'MESA DE VALIDAÇÃO (REVIEW BOARD)',
    color: 0xf59e0b,
    textColor: '#fbbf24',
    gridX: 11,
    gridY: 12,
    gridW: 8,
    gridH: 5,
    floorTile: 'wood',
  },
  // 6. Knowledge Library (Top Right)
  {
    id: 'library',
    title: 'BIBLIOTECA DE CONHECIMENTO',
    color: 0x3b82f6,
    textColor: '#60a5fa',
    gridX: 20,
    gridY: 1,
    gridW: 9,
    gridH: 4,
    floorTile: 'wood',
  },
  // 7. Copa / Área do Café (Center Upper)
  {
    id: 'coffee',
    title: 'ÁREA DO CAFÉ',
    color: 0xf43f5e,
    textColor: '#fb7185',
    gridX: 11,
    gridY: 5,
    gridW: 4,
    gridH: 3,
    floorTile: 'tile',
  },
  // 8. Lounge / Sala de Descanso (Center Mid Right)
  {
    id: 'lounge',
    title: 'LOUNGE / DESCANSO',
    color: 0xec4899,
    textColor: '#f472b6',
    gridX: 15,
    gridY: 5,
    gridW: 4,
    gridH: 3,
    floorTile: 'carpet',
  },
  // 9. Mesa de Sinuca / Recreação (Center Mid Corridor)
  {
    id: 'pool',
    title: 'MESA DE SINUCA',
    color: 0x10b981,
    textColor: '#34d399',
    gridX: 11,
    gridY: 8,
    gridW: 8,
    gridH: 3,
    floorTile: 'wood',
  },
];

/**
 * Waypoints for Corridor Hallway Navigation
 */
export const ISO_WAYPOINTS: Record<string, Point2D> = {
  main_hub: { x: 600, y: 360 },
  exec_hall: { x: 600, y: 190 },
  market_hall: { x: 400, y: 340 },
  offer_hall: { x: 800, y: 340 },
  gtm_hall: { x: 400, y: 550 },
  meeting_hall: { x: 600, y: 500 },
  library_hall: { x: 800, y: 190 },
  coffee_hall: { x: 500, y: 250 },
  lounge_hall: { x: 700, y: 250 },
  pool_hall: { x: 600, y: 400 },
};

/**
 * 13 Agent Workstation & Activity Destinations
 */
export const ISO_AGENTS_CONFIG: Record<string, IsoAgentDeskConfig> = {
  // Director
  'director': {
    roleId: 'director',
    name: 'Diretor de Inteligência',
    shortName: 'Director',
    department: 'executive',
    deskPos: { x: 600, y: 90 },
    chairPos: { x: 600, y: 120 },
    meetingPos: { x: 600, y: 530 },
    libraryPos: { x: 920, y: 100 },
    coffeePos: { x: 510, y: 250 },
    loungePos: { x: 670, y: 250 },
    poolPos: { x: 540, y: 400 },
    avatarSpriteKey: 'agent_director',
    monitorType: 'dual',
  },

  // Market Department (4 Agents)
  'head-market': {
    roleId: 'head-market',
    name: 'Head de Mercado',
    shortName: 'Head Mercado',
    department: 'market',
    deskPos: { x: 200, y: 250 },
    chairPos: { x: 200, y: 275 },
    meetingPos: { x: 530, y: 530 },
    libraryPos: { x: 880, y: 100 },
    coffeePos: { x: 490, y: 250 },
    loungePos: { x: 690, y: 250 },
    poolPos: { x: 580, y: 400 },
    avatarSpriteKey: 'agent_head_market',
    monitorType: 'single',
  },
  'market-signal-miner': {
    roleId: 'market-signal-miner',
    name: 'Minerador de Sinais',
    shortName: 'Signal Miner',
    department: 'market',
    deskPos: { x: 110, y: 340 },
    chairPos: { x: 110, y: 365 },
    meetingPos: { x: 530, y: 570 },
    libraryPos: { x: 920, y: 100 },
    coffeePos: { x: 520, y: 250 },
    loungePos: { x: 710, y: 250 },
    poolPos: { x: 620, y: 400 },
    avatarSpriteKey: 'agent_signal',
    monitorType: 'dual',
  },
  'audience-positioning-researcher': {
    roleId: 'audience-positioning-researcher',
    name: 'Pesquisador de Público',
    shortName: 'Audience',
    department: 'market',
    deskPos: { x: 290, y: 340 },
    chairPos: { x: 290, y: 365 },
    meetingPos: { x: 530, y: 610 },
    libraryPos: { x: 960, y: 100 },
    coffeePos: { x: 500, y: 260 },
    loungePos: { x: 680, y: 260 },
    poolPos: { x: 660, y: 400 },
    avatarSpriteKey: 'agent_audience',
    monitorType: 'single',
  },
  'evidence-auditor': {
    roleId: 'evidence-auditor',
    name: 'Auditor de Evidências',
    shortName: 'Auditor',
    department: 'market',
    deskPos: { x: 200, y: 410 },
    chairPos: { x: 200, y: 435 },
    meetingPos: { x: 570, y: 610 },
    libraryPos: { x: 1000, y: 100 },
    coffeePos: { x: 530, y: 260 },
    loungePos: { x: 700, y: 260 },
    poolPos: { x: 560, y: 400 },
    avatarSpriteKey: 'agent_auditor',
    monitorType: 'alert',
  },

  // Offer Architecture Department (4 Agents)
  'head-offer': {
    roleId: 'head-offer',
    name: 'Head de Oferta',
    shortName: 'Head Oferta',
    department: 'offer',
    deskPos: { x: 1000, y: 250 },
    chairPos: { x: 1000, y: 275 },
    meetingPos: { x: 670, y: 530 },
    libraryPos: { x: 880, y: 130 },
    coffeePos: { x: 490, y: 250 },
    loungePos: { x: 670, y: 250 },
    poolPos: { x: 540, y: 400 },
    avatarSpriteKey: 'agent_head_offer',
    monitorType: 'single',
  },
  'offer-dna-analyst': {
    roleId: 'offer-dna-analyst',
    name: 'Analista de DNA',
    shortName: 'Offer DNA',
    department: 'offer',
    deskPos: { x: 910, y: 340 },
    chairPos: { x: 910, y: 365 },
    meetingPos: { x: 670, y: 570 },
    libraryPos: { x: 920, y: 130 },
    coffeePos: { x: 520, y: 250 },
    loungePos: { x: 690, y: 250 },
    poolPos: { x: 580, y: 400 },
    avatarSpriteKey: 'agent_offer_dna',
    monitorType: 'dual',
  },
  'product-mechanism-architect': {
    roleId: 'product-mechanism-architect',
    name: 'Arquiteto de Produto',
    shortName: 'Product',
    department: 'offer',
    deskPos: { x: 1090, y: 340 },
    chairPos: { x: 1090, y: 365 },
    meetingPos: { x: 670, y: 610 },
    libraryPos: { x: 960, y: 130 },
    coffeePos: { x: 500, y: 260 },
    loungePos: { x: 710, y: 250 },
    poolPos: { x: 620, y: 400 },
    avatarSpriteKey: 'agent_product',
    monitorType: 'single',
  },
  'pricing-monetization-strategist': {
    roleId: 'pricing-monetization-strategist',
    name: 'Estrategista de Pricing',
    shortName: 'Pricing',
    department: 'offer',
    deskPos: { x: 1000, y: 410 },
    chairPos: { x: 1000, y: 435 },
    meetingPos: { x: 630, y: 610 },
    libraryPos: { x: 1000, y: 130 },
    coffeePos: { x: 530, y: 260 },
    loungePos: { x: 680, y: 260 },
    poolPos: { x: 660, y: 400 },
    avatarSpriteKey: 'agent_pricing',
    monitorType: 'chart',
  },

  // Go-To-Market Department (4 Agents)
  'head-gtm': {
    roleId: 'head-gtm',
    name: 'Head de GTM',
    shortName: 'Head GTM',
    department: 'gtm',
    deskPos: { x: 200, y: 530 },
    chairPos: { x: 200, y: 555 },
    meetingPos: { x: 600, y: 530 },
    libraryPos: { x: 1040, y: 100 },
    coffeePos: { x: 490, y: 250 },
    loungePos: { x: 670, y: 250 },
    poolPos: { x: 540, y: 400 },
    avatarSpriteKey: 'agent_head_gtm',
    monitorType: 'single',
  },
  'creative-strategist': {
    roleId: 'creative-strategist',
    name: 'Estrategista de Criativos',
    shortName: 'Creative',
    department: 'gtm',
    deskPos: { x: 110, y: 610 },
    chairPos: { x: 110, y: 635 },
    meetingPos: { x: 600, y: 570 },
    libraryPos: { x: 1040, y: 130 },
    coffeePos: { x: 520, y: 250 },
    loungePos: { x: 690, y: 250 },
    poolPos: { x: 580, y: 400 },
    avatarSpriteKey: 'agent_creative',
    monitorType: 'dual',
  },
  'copy-lp-strategist': {
    roleId: 'copy-lp-strategist',
    name: 'Estrategista de Copy/LP',
    shortName: 'Copy / LP',
    department: 'gtm',
    deskPos: { x: 290, y: 610 },
    chairPos: { x: 290, y: 635 },
    meetingPos: { x: 600, y: 610 },
    libraryPos: { x: 1080, y: 100 },
    coffeePos: { x: 500, y: 260 },
    loungePos: { x: 710, y: 250 },
    poolPos: { x: 620, y: 400 },
    avatarSpriteKey: 'agent_copy',
    monitorType: 'vertical',
  },
  'validation-scale-strategist': {
    roleId: 'validation-scale-strategist',
    name: 'Estrategista de Validação',
    shortName: 'Validation',
    department: 'gtm',
    deskPos: { x: 200, y: 660 },
    chairPos: { x: 200, y: 680 },
    meetingPos: { x: 600, y: 640 },
    libraryPos: { x: 1080, y: 130 },
    coffeePos: { x: 530, y: 260 },
    loungePos: { x: 680, y: 260 },
    poolPos: { x: 660, y: 400 },
    avatarSpriteKey: 'agent_validation',
    monitorType: 'chart',
  },
};
