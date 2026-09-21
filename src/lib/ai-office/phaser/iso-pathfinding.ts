/**
 * Offer Intelligence Office - Isometric 2.5D A* Grid Pathfinding System
 * 100% Dependency-free, fast & smooth pathfinding for 13 agents
 */

export interface GridPoint {
  x: number;
  y: number;
}

export class IsoPathfinding {
  private width: number;
  private height: number;
  private grid: boolean[][]; // true = walkable, false = blocked

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: width }, () => Array(height).fill(true));
  }

  /**
   * Set tile walkability
   */
  public setWalkable(x: number, y: number, isWalkable: boolean) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[x][y] = isWalkable;
    }
  }

  /**
   * Set rectangular area walkability
   */
  public setAreaWalkable(x: number, y: number, w: number, h: number, isWalkable: boolean) {
    for (let gx = x; gx < x + w; gx++) {
      for (let gy = y; gy < y + h; gy++) {
        this.setWalkable(gx, gy, isWalkable);
      }
    }
  }

  /**
   * Check if tile is walkable
   */
  public isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.grid[x][y];
  }

  /**
   * A* Pathfinding algorithm from start to target GridPoint
   */
  public findPath(start: GridPoint, target: GridPoint): GridPoint[] {
    // If target is blocked, find nearest walkable neighbor
    let end = { ...target };
    if (!this.isWalkable(end.x, end.y)) {
      const neighbor = this.getNearestWalkableNeighbor(end.x, end.y);
      if (neighbor) end = neighbor;
      else return [start];
    }

    const openSet: GridNode[] = [];
    const closedSet: Set<string> = new Set();

    const startNode = new GridNode(start.x, start.y, 0, this.heuristic(start, end), null);
    openSet.push(startNode);

    while (openSet.length > 0) {
      // Find node with lowest f cost
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      const currentKey = `${current.x},${current.y}`;
      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);

      // Reached goal
      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(current);
      }

      // Check 8-way neighbors (up, down, left, right, diagonals)
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
        { x: current.x + 1, y: current.y + 1 },
        { x: current.x - 1, y: current.y - 1 },
        { x: current.x + 1, y: current.y - 1 },
        { x: current.x - 1, y: current.y + 1 },
      ];

      for (const n of neighbors) {
        if (!this.isWalkable(n.x, n.y)) continue;
        const nKey = `${n.x},${n.y}`;
        if (closedSet.has(nKey)) continue;

        const isDiagonal = n.x !== current.x && n.y !== current.y;
        const gCost = current.g + (isDiagonal ? 1.414 : 1.0);
        const hCost = this.heuristic(n, end);

        const existingOpen = openSet.find((node) => node.x === n.x && node.y === n.y);
        if (!existingOpen || gCost < existingOpen.g) {
          if (existingOpen) {
            existingOpen.g = gCost;
            existingOpen.f = gCost + existingOpen.h;
            existingOpen.parent = current;
          } else {
            openSet.push(new GridNode(n.x, n.y, gCost, hCost, current));
          }
        }
      }
    }

    // Direct fallback if path blocked
    return [start, end];
  }

  private heuristic(a: GridPoint, b: GridPoint): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  private getNearestWalkableNeighbor(x: number, y: number): GridPoint | null {
    const r = 3;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.isWalkable(nx, ny)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  private reconstructPath(node: GridNode): GridPoint[] {
    const path: GridPoint[] = [];
    let curr: GridNode | null = node;
    while (curr) {
      path.unshift({ x: curr.x, y: curr.y });
      curr = curr.parent;
    }
    return this.compressPath(path);
  }

  /**
   * Compress collinear waypoints for smooth linear tweening
   */
  private compressPath(rawPath: GridPoint[]): GridPoint[] {
    if (rawPath.length <= 2) return rawPath;
    const compressed: GridPoint[] = [rawPath[0]];

    for (let i = 1; i < rawPath.length - 1; i++) {
      const prev = compressed[compressed.length - 1];
      const curr = rawPath[i];
      const next = rawPath[i + 1];

      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      // Keep waypoint if direction changes
      if (dx1 * dy2 !== dx2 * dy1) {
        compressed.push(curr);
      }
    }

    compressed.push(rawPath[rawPath.length - 1]);
    return compressed;
  }
}

class GridNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;

  constructor(x: number, y: number, g: number, h: number, parent: GridNode | null) {
    this.x = x;
    this.y = y;
    this.g = g;
    this.h = h;
    this.f = g + h;
    this.parent = parent;
  }
}
