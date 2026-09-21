/**
 * Offer Intelligence Office - Phaser 3 Top-Down Layout & Navigation Config
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface RoomBounds {
  id: string;
  title: string;
  color: number;
  x: number;
  y: number;
  width: number;
  height: number;
  floorColor: number;
}

export interface PhaserDeskConfig {
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
}

export const OFFICE_WORLD = {
  width: 1200,
  height: 680,
  gridSize: 20,
};

export const ROOM_DEFINITIONS: RoomBounds[] = [
  // 1. Executive Director Room (Top Center)
  {
    id: 'executive',
    title: 'SALA DA DIRETORIA',
    color: 0xa855f7,
    x: 440,
    y: 30,
    width: 320,
    height: 140,
    floorColor: 0x1e152a,
  },
  // 2. Market Department (Top/Mid Left)
  {
    id: 'market',
    title: 'MERCADO & VALIDAÇÃO',
    color: 0x06b6d4,
    x: 40,
    y: 190,
    width: 340,
    height: 230,
    floorColor: 0x0f222d,
  },
  // 3. Offer Architecture Department (Top/Mid Right)
  {
    id: 'offer',
    title: 'ARQUITETURA DE OFERTA',
    color: 0x6366f1,
    x: 820,
    y: 190,
    width: 340,
    height: 230,
    floorColor: 0x181a35,
  },
  // 4. Go-To-Market Department (Bottom Left)
  {
    id: 'gtm',
    title: 'GO-TO-MARKET',
    color: 0x10b981,
    x: 40,
    y: 440,
    width: 340,
    height: 210,
    floorColor: 0x0c251d,
  },
  // 5. Review Board Meeting Room (Bottom Center)
  {
    id: 'meeting',
    title: 'MESA DE VALIDAÇÃO (REVIEW BOARD)',
    color: 0xf59e0b,
    x: 440,
    y: 450,
    width: 320,
    height: 200,
    floorColor: 0x241d13,
  },
  // 6. Knowledge Library (Top Right)
  {
    id: 'library',
    title: 'BIBLIOTECA DE CONHECIMENTO',
    color: 0x3b82f6,
    x: 820,
    y: 30,
    width: 340,
    height: 140,
    floorColor: 0x111c2e,
  },
  // 7. Coffee & Refreshment Area (Center Upper Corridor)
  {
    id: 'coffee',
    title: 'ÁREA DO CAFÉ',
    color: 0xf43f5e,
    x: 440,
    y: 190,
    width: 150,
    height: 110,
    floorColor: 0x26141a,
  },
  // 8. Lounge / Sala de Descanso (Center Right Corridor)
  {
    id: 'lounge',
    title: 'LOUNGE / SALS DE DESCANSO',
    color: 0xec4899,
    x: 605,
    y: 190,
    width: 155,
    height: 110,
    floorColor: 0x241220,
  },
  // 9. Mesa de Sinuca / Billiards Area (Center Mid Corridor)
  {
    id: 'pool',
    title: 'MESA DE SINUCA',
    color: 0x10b981,
    x: 440,
    y: 315,
    width: 320,
    height: 120,
    floorColor: 0x11241a,
  },
];

export const CORRIDOR_WAYPOINTS: Record<string, Point2D> = {
  main_hub: { x: 600, y: 360 },
  exec_hall: { x: 600, y: 180 },
  market_hall: { x: 400, y: 300 },
  offer_hall: { x: 800, y: 300 },
  gtm_hall: { x: 400, y: 530 },
  meeting_hall: { x: 600, y: 430 },
  library_hall: { x: 800, y: 180 },
  coffee_hall: { x: 500, y: 240 },
  lounge_hall: { x: 680, y: 240 },
  pool_hall: { x: 600, y: 375 },
};

export const PHASER_DESKS: Record<string, PhaserDeskConfig> = {
  // Director
  'director': {
    roleId: 'director',
    name: 'Diretor de Inteligência',
    shortName: 'Diretor',
    department: 'executive',
    deskPos: { x: 600, y: 90 },
    chairPos: { x: 600, y: 120 },
    meetingPos: { x: 600, y: 500 },
    libraryPos: { x: 920, y: 90 },
    coffeePos: { x: 500, y: 240 },
    loungePos: { x: 650, y: 240 },
    poolPos: { x: 540, y: 375 },
  },

  // Market
  'head-market': {
    roleId: 'head-market',
    name: 'Head de Mercado',
    shortName: 'Head Mercado',
    department: 'market',
    deskPos: { x: 210, y: 240 },
    chairPos: { x: 210, y: 265 },
    meetingPos: { x: 530, y: 520 },
    libraryPos: { x: 880, y: 90 },
    coffeePos: { x: 480, y: 240 },
    loungePos: { x: 670, y: 240 },
    poolPos: { x: 580, y: 375 },
  },
  'market-signal-miner': {
    roleId: 'market-signal-miner',
    name: 'Minerador de Sinais',
    shortName: 'Signal Miner',
    department: 'market',
    deskPos: { x: 120, y: 320 },
    chairPos: { x: 120, y: 345 },
    meetingPos: { x: 530, y: 570 },
    libraryPos: { x: 920, y: 90 },
    coffeePos: { x: 520, y: 240 },
    loungePos: { x: 690, y: 240 },
    poolPos: { x: 620, y: 375 },
  },
  'audience-positioning-researcher': {
    roleId: 'audience-positioning-researcher',
    name: 'Pesquisador de Público',
    shortName: 'Audience',
    department: 'market',
    deskPos: { x: 300, y: 320 },
    chairPos: { x: 300, y: 345 },
    meetingPos: { x: 530, y: 610 },
    libraryPos: { x: 960, y: 90 },
    coffeePos: { x: 490, y: 260 },
    loungePos: { x: 660, y: 260 },
    poolPos: { x: 660, y: 375 },
  },
  'evidence-auditor': {
    roleId: 'evidence-auditor',
    name: 'Auditor de Evidências',
    shortName: 'Auditor',
    department: 'market',
    deskPos: { x: 210, y: 380 },
    chairPos: { x: 210, y: 405 },
    meetingPos: { x: 580, y: 610 },
    libraryPos: { x: 1000, y: 90 },
    coffeePos: { x: 510, y: 260 },
    loungePos: { x: 680, y: 260 },
    poolPos: { x: 560, y: 375 },
  },

  // Offer
  'head-offer': {
    roleId: 'head-offer',
    name: 'Head de Oferta',
    shortName: 'Head Oferta',
    department: 'offer',
    deskPos: { x: 990, y: 240 },
    chairPos: { x: 990, y: 265 },
    meetingPos: { x: 670, y: 520 },
    libraryPos: { x: 880, y: 120 },
    coffeePos: { x: 480, y: 240 },
    loungePos: { x: 650, y: 240 },
    poolPos: { x: 540, y: 375 },
  },
  'offer-dna-analyst': {
    roleId: 'offer-dna-analyst',
    name: 'Analista de DNA',
    shortName: 'Offer DNA',
    department: 'offer',
    deskPos: { x: 900, y: 320 },
    chairPos: { x: 900, y: 345 },
    meetingPos: { x: 670, y: 570 },
    libraryPos: { x: 920, y: 120 },
    coffeePos: { x: 520, y: 240 },
    loungePos: { x: 670, y: 240 },
    poolPos: { x: 580, y: 375 },
  },
  'product-mechanism-architect': {
    roleId: 'product-mechanism-architect',
    name: 'Arquiteto de Produto',
    shortName: 'Product',
    department: 'offer',
    deskPos: { x: 1080, y: 320 },
    chairPos: { x: 1080, y: 345 },
    meetingPos: { x: 670, y: 610 },
    libraryPos: { x: 960, y: 120 },
    coffeePos: { x: 490, y: 260 },
    loungePos: { x: 690, y: 240 },
    poolPos: { x: 620, y: 375 },
  },
  'pricing-monetization-strategist': {
    roleId: 'pricing-monetization-strategist',
    name: 'Estrategista de Pricing',
    shortName: 'Pricing',
    department: 'offer',
    deskPos: { x: 990, y: 380 },
    chairPos: { x: 990, y: 405 },
    meetingPos: { x: 620, y: 610 },
    libraryPos: { x: 1000, y: 120 },
    coffeePos: { x: 510, y: 260 },
    loungePos: { x: 660, y: 260 },
    poolPos: { x: 660, y: 375 },
  },

  // GTM
  'head-gtm': {
    roleId: 'head-gtm',
    name: 'Head de GTM',
    shortName: 'Head GTM',
    department: 'gtm',
    deskPos: { x: 210, y: 490 },
    chairPos: { x: 210, y: 515 },
    meetingPos: { x: 600, y: 520 },
    libraryPos: { x: 1040, y: 90 },
    coffeePos: { x: 480, y: 240 },
    loungePos: { x: 650, y: 240 },
    poolPos: { x: 540, y: 375 },
  },
  'creative-strategist': {
    roleId: 'creative-strategist',
    name: 'Estrategista de Criativos',
    shortName: 'Creative',
    department: 'gtm',
    deskPos: { x: 120, y: 570 },
    chairPos: { x: 120, y: 595 },
    meetingPos: { x: 600, y: 570 },
    libraryPos: { x: 1040, y: 120 },
    coffeePos: { x: 520, y: 240 },
    loungePos: { x: 670, y: 240 },
    poolPos: { x: 580, y: 375 },
  },
  'copy-lp-strategist': {
    roleId: 'copy-lp-strategist',
    name: 'Estrategista de Copy/LP',
    shortName: 'Copy / LP',
    department: 'gtm',
    deskPos: { x: 300, y: 570 },
    chairPos: { x: 300, y: 595 },
    meetingPos: { x: 600, y: 610 },
    libraryPos: { x: 1080, y: 90 },
    coffeePos: { x: 490, y: 260 },
    loungePos: { x: 690, y: 240 },
    poolPos: { x: 620, y: 375 },
  },
  'validation-scale-strategist': {
    roleId: 'validation-scale-strategist',
    name: 'Estrategista de Validação',
    shortName: 'Validation',
    department: 'gtm',
    deskPos: { x: 210, y: 630 },
    chairPos: { x: 210, y: 650 },
    meetingPos: { x: 600, y: 640 },
    libraryPos: { x: 1080, y: 120 },
    coffeePos: { x: 510, y: 260 },
    loungePos: { x: 680, y: 260 },
    poolPos: { x: 660, y: 375 },
  },
};
