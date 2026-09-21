/**
 * Offer Intelligence Office - Natural Image Map Configuration
 * Source of Truth: public/office/office-base.png (1672 x 941 px)
 */

export interface NormalizedPoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface OfficeWorkStation {
  id: string;
  roleId: string;
  name: string;
  shortName: string;
  department: 'executive' | 'market' | 'offer' | 'gtm';
  roomName: string;
  normalizedPos: NormalizedPoint;
}

export interface NavGraphNode {
  id: string;
  normalizedPos: NormalizedPoint;
  neighbors: string[]; // Connected node IDs
}

export const OFFICE_IMAGE_DIMENSIONS = {
  width: 1672,
  height: 941,
  aspectRatio: 1672 / 941,
};

/**
 * Converts normalized coordinate (0..1) to pixel coordinate based on natural image dimensions
 */
export function toPixelCoords(norm: NormalizedPoint, naturalWidth = OFFICE_IMAGE_DIMENSIONS.width, naturalHeight = OFFICE_IMAGE_DIMENSIONS.height): PixelPoint {
  return {
    x: Math.round(norm.x * naturalWidth),
    y: Math.round(norm.y * naturalHeight),
  };
}

/**
 * Converts pixel coordinate back to normalized coordinate (0..1)
 */
export function toNormalizedCoords(pixel: PixelPoint, naturalWidth = OFFICE_IMAGE_DIMENSIONS.width, naturalHeight = OFFICE_IMAGE_DIMENSIONS.height): NormalizedPoint {
  return {
    x: Number((pixel.x / naturalWidth).toFixed(4)),
    y: Number((pixel.y / naturalHeight).toFixed(4)),
  };
}

/**
 * 13 Exact Workstation Chair Positions mapped on the real image
 */
export const OFFICE_WORKSTATIONS: Record<string, OfficeWorkStation> = {
  'director': {
    id: 'director_desk',
    roleId: 'director',
    name: 'Diretor de Inteligência',
    shortName: 'Director',
    department: 'executive',
    roomName: 'Executive Suite',
    normalizedPos: { x: 0.170, y: 0.245 },
  },

  // Heads Office (3 Blue Desks in Top Center)
  'head-market': {
    id: 'head_market_desk',
    roleId: 'head-market',
    name: 'Head de Mercado',
    shortName: 'Head Market',
    department: 'market',
    roomName: 'Heads Office',
    normalizedPos: { x: 0.435, y: 0.200 },
  },
  'head-offer': {
    id: 'head_offer_desk',
    roleId: 'head-offer',
    name: 'Head de Oferta',
    shortName: 'Head Offer',
    department: 'offer',
    roomName: 'Heads Office',
    normalizedPos: { x: 0.355, y: 0.295 },
  },
  'head-gtm': {
    id: 'head_gtm_desk',
    roleId: 'head-gtm',
    name: 'Head de GTM',
    shortName: 'Head GTM',
    department: 'gtm',
    roomName: 'Heads Office',
    normalizedPos: { x: 0.500, y: 0.295 },
  },

  // Specialist Open Floor (9 Desks in 3x3 Grid)
  // Column 1: Market Specialists
  'market-signal-miner': {
    id: 'signal_miner_desk',
    roleId: 'market-signal-miner',
    name: 'Minerador de Sinais',
    shortName: 'Signal Miner',
    department: 'market',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.355, y: 0.570 },
  },
  'audience-positioning-researcher': {
    id: 'audience_desk',
    roleId: 'audience-positioning-researcher',
    name: 'Pesquisador de Público',
    shortName: 'Audience',
    department: 'market',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.355, y: 0.700 },
  },
  'evidence-auditor': {
    id: 'evidence_auditor_desk',
    roleId: 'evidence-auditor',
    name: 'Auditor de Evidências',
    shortName: 'Auditor',
    department: 'market',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.355, y: 0.820 },
  },

  // Column 2: Offer Specialists
  'offer-dna-analyst': {
    id: 'offer_dna_desk',
    roleId: 'offer-dna-analyst',
    name: 'Analista de DNA',
    shortName: 'Offer DNA',
    department: 'offer',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.470, y: 0.570 },
  },
  'product-mechanism-architect': {
    id: 'product_desk',
    roleId: 'product-mechanism-architect',
    name: 'Arquiteto de Produto',
    shortName: 'Product',
    department: 'offer',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.470, y: 0.700 },
  },
  'pricing-monetization-strategist': {
    id: 'pricing_desk',
    roleId: 'pricing-monetization-strategist',
    name: 'Estrategista de Pricing',
    shortName: 'Pricing',
    department: 'offer',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.470, y: 0.820 },
  },

  // Column 3: GTM Specialists
  'creative-strategist': {
    id: 'creative_desk',
    roleId: 'creative-strategist',
    name: 'Estrategista de Criativos',
    shortName: 'Creative',
    department: 'gtm',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.585, y: 0.570 },
  },
  'copy-lp-strategist': {
    id: 'copy_lp_desk',
    roleId: 'copy-lp-strategist',
    name: 'Estrategista de Copy/LP',
    shortName: 'Copy / LP',
    department: 'gtm',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.585, y: 0.700 },
  },
  'validation-scale-strategist': {
    id: 'validation_desk',
    roleId: 'validation-scale-strategist',
    name: 'Estrategista de Validação',
    shortName: 'Validation',
    department: 'gtm',
    roomName: 'Specialist Open Floor',
    normalizedPos: { x: 0.585, y: 0.820 },
  },
};

/**
 * Social & Activity Destinations (Coffee Table, Arcade, Lounge, Library)
 */
export const SOCIAL_DESTINATIONS: Record<string, NormalizedPoint> = {
  // Coffee / Collaboration Round Table
  review_seat_1: { x: 0.655, y: 0.295 },
  review_seat_2: { x: 0.680, y: 0.250 },
  review_seat_3: { x: 0.705, y: 0.295 },
  review_seat_4: { x: 0.680, y: 0.330 },
  coffee_counter: { x: 0.630, y: 0.200 },

  // Recreation Room (Top Right)
  arcade_player: { x: 0.850, y: 0.290 },
  beanbag_seat: { x: 0.895, y: 0.350 },

  // Knowledge Library (Bottom Left)
  library_seat_1: { x: 0.090, y: 0.550 },
  library_seat_2: { x: 0.135, y: 0.550 },

  // Lounge (Bottom Right)
  lounge_seat_1: { x: 0.830, y: 0.570 },
  lounge_seat_2: { x: 0.925, y: 0.570 },
  lounge_seat_3: { x: 0.875, y: 0.640 },
};

/**
 * Physical Navigation Graph Nodes (Hallways & Doorways)
 */
export const NAV_GRAPH: Record<string, NavGraphNode> = {
  // Main Central Corridor Backbone
  hall_left: {
    id: 'hall_left',
    normalizedPos: { x: 0.290, y: 0.440 },
    neighbors: ['director_entry', 'library_entry', 'hall_center_left'],
  },
  hall_center_left: {
    id: 'hall_center_left',
    normalizedPos: { x: 0.400, y: 0.440 },
    neighbors: ['hall_left', 'heads_left_entry', 'specialist_floor_entry', 'hall_center'],
  },
  hall_center: {
    id: 'hall_center',
    normalizedPos: { x: 0.540, y: 0.440 },
    neighbors: ['hall_center_left', 'specialist_floor_entry', 'hall_center_right'],
  },
  hall_center_right: {
    id: 'hall_center_right',
    normalizedPos: { x: 0.670, y: 0.440 },
    neighbors: ['hall_center', 'heads_right_entry', 'coffee_entry', 'hall_right'],
  },
  hall_right: {
    id: 'hall_right',
    normalizedPos: { x: 0.790, y: 0.440 },
    neighbors: ['hall_center_right', 'recreation_entry', 'lounge_entry'],
  },

  // Room Doorways
  director_entry: {
    id: 'director_entry',
    normalizedPos: { x: 0.310, y: 0.340 },
    neighbors: ['hall_left', 'director_desk'],
  },
  heads_left_entry: {
    id: 'heads_left_entry',
    normalizedPos: { x: 0.350, y: 0.360 },
    neighbors: ['hall_center_left', 'head_offer_desk', 'head_market_desk'],
  },
  heads_right_entry: {
    id: 'heads_right_entry',
    normalizedPos: { x: 0.600, y: 0.360 },
    neighbors: ['hall_center_right', 'head_gtm_desk', 'head_market_desk'],
  },
  coffee_entry: {
    id: 'coffee_entry',
    normalizedPos: { x: 0.660, y: 0.360 },
    neighbors: ['hall_center_right', 'review_seat_1', 'review_seat_2', 'review_seat_3', 'review_seat_4', 'coffee_counter'],
  },
  recreation_entry: {
    id: 'recreation_entry',
    normalizedPos: { x: 0.790, y: 0.360 },
    neighbors: ['hall_right', 'arcade_player', 'beanbag_seat'],
  },
  library_entry: {
    id: 'library_entry',
    normalizedPos: { x: 0.210, y: 0.500 },
    neighbors: ['hall_left', 'library_seat_1', 'library_seat_2'],
  },
  specialist_floor_entry: {
    id: 'specialist_floor_entry',
    normalizedPos: { x: 0.540, y: 0.490 },
    neighbors: ['hall_center', 'aisle_center_top'],
  },
  lounge_entry: {
    id: 'lounge_entry',
    normalizedPos: { x: 0.790, y: 0.510 },
    neighbors: ['hall_right', 'lounge_seat_1', 'lounge_seat_2', 'lounge_seat_3'],
  },

  // Specialist Floor Internal Aisles
  aisle_center_top: {
    id: 'aisle_center_top',
    normalizedPos: { x: 0.470, y: 0.520 },
    neighbors: ['specialist_floor_entry', 'signal_miner_desk', 'offer_dna_desk', 'creative_desk', 'aisle_center_mid'],
  },
  aisle_center_mid: {
    id: 'aisle_center_mid',
    normalizedPos: { x: 0.470, y: 0.640 },
    neighbors: ['aisle_center_top', 'audience_desk', 'product_desk', 'copy_lp_desk', 'aisle_center_bottom'],
  },
  aisle_center_bottom: {
    id: 'aisle_center_bottom',
    normalizedPos: { x: 0.470, y: 0.760 },
    neighbors: ['aisle_center_mid', 'evidence_auditor_desk', 'pricing_desk', 'validation_desk'],
  },

  // Workstations connected to graph
  director_desk: { id: 'director_desk', normalizedPos: { x: 0.170, y: 0.245 }, neighbors: ['director_entry'] },
  head_market_desk: { id: 'head_market_desk', normalizedPos: { x: 0.435, y: 0.200 }, neighbors: ['heads_left_entry', 'heads_right_entry'] },
  head_offer_desk: { id: 'head_offer_desk', normalizedPos: { x: 0.355, y: 0.295 }, neighbors: ['heads_left_entry'] },
  head_gtm_desk: { id: 'head_gtm_desk', normalizedPos: { x: 0.500, y: 0.295 }, neighbors: ['heads_right_entry'] },

  signal_miner_desk: { id: 'signal_miner_desk', normalizedPos: { x: 0.355, y: 0.570 }, neighbors: ['aisle_center_top'] },
  audience_desk: { id: 'audience_desk', normalizedPos: { x: 0.355, y: 0.700 }, neighbors: ['aisle_center_mid'] },
  evidence_auditor_desk: { id: 'evidence_auditor_desk', normalizedPos: { x: 0.355, y: 0.820 }, neighbors: ['aisle_center_bottom'] },

  offer_dna_desk: { id: 'offer_dna_desk', normalizedPos: { x: 0.470, y: 0.570 }, neighbors: ['aisle_center_top'] },
  product_desk: { id: 'product_desk', normalizedPos: { x: 0.470, y: 0.700 }, neighbors: ['aisle_center_mid'] },
  pricing_desk: { id: 'pricing_desk', normalizedPos: { x: 0.470, y: 0.820 }, neighbors: ['aisle_center_bottom'] },

  creative_desk: { id: 'creative_desk', normalizedPos: { x: 0.585, y: 0.570 }, neighbors: ['aisle_center_top'] },
  copy_lp_desk: { id: 'copy_lp_desk', normalizedPos: { x: 0.585, y: 0.700 }, neighbors: ['aisle_center_mid'] },
  validation_desk: { id: 'validation_desk', normalizedPos: { x: 0.585, y: 0.820 }, neighbors: ['aisle_center_bottom'] },

  // Social destinations connected to graph
  review_seat_1: { id: 'review_seat_1', normalizedPos: { x: 0.655, y: 0.295 }, neighbors: ['coffee_entry'] },
  review_seat_2: { id: 'review_seat_2', normalizedPos: { x: 0.680, y: 0.250 }, neighbors: ['coffee_entry'] },
  review_seat_3: { id: 'review_seat_3', normalizedPos: { x: 0.705, y: 0.295 }, neighbors: ['coffee_entry'] },
  review_seat_4: { id: 'review_seat_4', normalizedPos: { x: 0.680, y: 0.330 }, neighbors: ['coffee_entry'] },
  coffee_counter: { id: 'coffee_counter', normalizedPos: { x: 0.630, y: 0.200 }, neighbors: ['coffee_entry'] },

  arcade_player: { id: 'arcade_player', normalizedPos: { x: 0.850, y: 0.290 }, neighbors: ['recreation_entry'] },
  beanbag_seat: { id: 'beanbag_seat', normalizedPos: { x: 0.895, y: 0.350 }, neighbors: ['recreation_entry'] },

  library_seat_1: { id: 'library_seat_1', normalizedPos: { x: 0.090, y: 0.550 }, neighbors: ['library_entry'] },
  library_seat_2: { id: 'library_seat_2', normalizedPos: { x: 0.135, y: 0.550 }, neighbors: ['library_entry'] },

  lounge_seat_1: { id: 'lounge_seat_1', normalizedPos: { x: 0.830, y: 0.570 }, neighbors: ['lounge_entry'] },
  lounge_seat_2: { id: 'lounge_seat_2', normalizedPos: { x: 0.925, y: 0.570 }, neighbors: ['lounge_entry'] },
  lounge_seat_3: { id: 'lounge_seat_3', normalizedPos: { x: 0.875, y: 0.640 }, neighbors: ['lounge_entry'] },
};

/**
 * Helper to find the nearest navigation node ID to a given normalized coordinate
 */
export function findNearestNodeId(norm: NormalizedPoint): string {
  let closestId = 'hall_center';
  let minDistance = Infinity;

  Object.values(NAV_GRAPH).forEach((node) => {
    const dist = Math.hypot(node.normalizedPos.x - norm.x, node.normalizedPos.y - norm.y);
    if (dist < minDistance) {
      minDistance = dist;
      closestId = node.id;
    }
  });

  return closestId;
}

/**
 * Dijkstra / A* shortest path search over the navigation graph
 */
export function findGraphPath(startNodeId: string, targetNodeId: string): NormalizedPoint[] {
  if (startNodeId === targetNodeId) {
    const n = NAV_GRAPH[startNodeId];
    return n ? [n.normalizedPos] : [];
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const nodes = Object.keys(NAV_GRAPH);

  nodes.forEach((id) => {
    distances[id] = Infinity;
    previous[id] = null;
  });

  distances[startNodeId] = 0;
  const unvisited = new Set(nodes);

  while (unvisited.size > 0) {
    // Current node with smallest distance
    let currentId: string | null = null;
    let minDistance = Infinity;

    unvisited.forEach((id) => {
      if (distances[id] < minDistance) {
        minDistance = distances[id];
        currentId = id;
      }
    });

    if (!currentId || minDistance === Infinity) break;
    if (currentId === targetNodeId) break;

    unvisited.delete(currentId);
    const currNode = NAV_GRAPH[currentId];

    if (currNode && currNode.neighbors) {
      currNode.neighbors.forEach((neighborId) => {
        if (!unvisited.has(neighborId)) return;
        const neighborNode = NAV_GRAPH[neighborId];
        if (!neighborNode) return;

        const dist = Math.hypot(
          neighborNode.normalizedPos.x - currNode.normalizedPos.x,
          neighborNode.normalizedPos.y - currNode.normalizedPos.y
        );

        const alt = distances[currentId!] + dist;
        if (alt < distances[neighborId]) {
          distances[neighborId] = alt;
          previous[neighborId] = currentId;
        }
      });
    }
  }

  // Reconstruct path
  const pathNodes: string[] = [];
  let curr: string | null = targetNodeId;

  while (curr) {
    pathNodes.unshift(curr);
    curr = previous[curr];
  }

  if (pathNodes[0] !== startNodeId) {
    // Direct fall-back if graph is partitioned
    const sNode = NAV_GRAPH[startNodeId];
    const tNode = NAV_GRAPH[targetNodeId];
    return sNode && tNode ? [sNode.normalizedPos, tNode.normalizedPos] : [];
  }

  return pathNodes.map((id) => NAV_GRAPH[id].normalizedPos);
}
