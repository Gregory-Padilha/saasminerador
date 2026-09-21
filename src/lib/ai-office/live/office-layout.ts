export interface Point2D {
  x: number; // percentage 0-100%
  y: number; // percentage 0-100%
}

export interface DeskConfig {
  roleId: string;
  name: string;
  department: 'market' | 'offer' | 'gtm' | 'executive';
  deskPosition: Point2D;
  meetingPosition: Point2D;
  libraryPosition: Point2D;
}

export const OFFICE_LAYOUT: Record<string, DeskConfig> = {
  // Executive Room (Top Center)
  'director': {
    roleId: 'director',
    name: 'Diretor de Inteligência',
    department: 'executive',
    deskPosition: { x: 50, y: 15 },
    meetingPosition: { x: 50, y: 78 },
    libraryPosition: { x: 82, y: 25 },
  },

  // Department 1: Market & Validation (Top Left / Mid Left)
  'head-market': {
    roleId: 'head-market',
    name: 'Head de Mercado',
    department: 'market',
    deskPosition: { x: 18, y: 22 },
    meetingPosition: { x: 44, y: 76 },
    libraryPosition: { x: 82, y: 25 },
  },
  'market-signal-miner': {
    roleId: 'market-signal-miner',
    name: 'Minerador de Sinais',
    department: 'market',
    deskPosition: { x: 12, y: 36 },
    meetingPosition: { x: 44, y: 80 },
    libraryPosition: { x: 82, y: 25 },
  },
  'audience-positioning-researcher': {
    roleId: 'audience-positioning-researcher',
    name: 'Pesquisador de Público',
    department: 'market',
    deskPosition: { x: 22, y: 36 },
    meetingPosition: { x: 44, y: 84 },
    libraryPosition: { x: 82, y: 25 },
  },
  'evidence-auditor': {
    roleId: 'evidence-auditor',
    name: 'Auditor de Evidências',
    department: 'market',
    deskPosition: { x: 17, y: 48 },
    meetingPosition: { x: 47, y: 82 },
    libraryPosition: { x: 82, y: 25 },
  },

  // Department 2: Offer Architecture (Top Right / Mid Right)
  'head-offer': {
    roleId: 'head-offer',
    name: 'Head de Oferta',
    department: 'offer',
    deskPosition: { x: 82, y: 48 },
    meetingPosition: { x: 53, y: 76 },
    libraryPosition: { x: 85, y: 25 },
  },
  'offer-dna-analyst': {
    roleId: 'offer-dna-analyst',
    name: 'Analista de DNA',
    department: 'offer',
    deskPosition: { x: 77, y: 36 },
    meetingPosition: { x: 53, y: 80 },
    libraryPosition: { x: 85, y: 25 },
  },
  'product-mechanism-architect': {
    roleId: 'product-mechanism-architect',
    name: 'Arquiteto de Produto',
    department: 'offer',
    deskPosition: { x: 87, y: 36 },
    meetingPosition: { x: 53, y: 84 },
    libraryPosition: { x: 85, y: 25 },
  },
  'pricing-monetization-strategist': {
    roleId: 'pricing-monetization-strategist',
    name: 'Estrategista de Pricing',
    department: 'offer',
    level: 'specialist',
    deskPosition: { x: 82, y: 60 },
    meetingPosition: { x: 56, y: 82 },
    libraryPosition: { x: 85, y: 25 },
  } as any,

  // Department 3: Go-To-Market (Bottom Left)
  'head-gtm': {
    roleId: 'head-gtm',
    name: 'Head de GTM',
    department: 'gtm',
    deskPosition: { x: 18, y: 65 },
    meetingPosition: { x: 56, y: 76 },
    libraryPosition: { x: 82, y: 25 },
  },
  'creative-strategist': {
    roleId: 'creative-strategist',
    name: 'Estrategista de Criativos',
    department: 'gtm',
    deskPosition: { x: 12, y: 78 },
    meetingPosition: { x: 44, y: 78 },
    libraryPosition: { x: 82, y: 25 },
  },
  'copy-lp-strategist': {
    roleId: 'copy-lp-strategist',
    name: 'Estrategista de Copy/LP',
    department: 'gtm',
    deskPosition: { x: 22, y: 78 },
    meetingPosition: { x: 44, y: 82 },
    libraryPosition: { x: 82, y: 25 },
  },
  'validation-scale-strategist': {
    roleId: 'validation-scale-strategist',
    name: 'Estrategista de Validação',
    department: 'gtm',
    deskPosition: { x: 17, y: 90 },
    meetingPosition: { x: 56, y: 84 },
    libraryPosition: { x: 82, y: 25 },
  },
};

export const ZONE_CENTERS = {
  EXECUTIVE_ROOM: { x: 50, y: 15 },
  MARKET_DEPT: { x: 17, y: 35 },
  OFFER_DEPT: { x: 82, y: 45 },
  GTM_DEPT: { x: 17, y: 78 },
  MEETING_ROOM: { x: 50, y: 80 },
  LIBRARY: { x: 83, y: 20 },
  CASE_FILE_TERMINAL: { x: 50, y: 48 },
};
