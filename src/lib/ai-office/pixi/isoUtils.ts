/**
 * Offer Intelligence Office - Isometric Projection & Z-Index Utilities
 */

export interface IsoPoint {
  isoX: number;
  isoY: number;
  isoZ?: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/**
 * Converts 3D Isometric grid coordinates to 2D Screen coordinates
 * Formula:
 * Screen X = (isoX - isoY) * (tileWidth / 2)
 * Screen Y = (isoX + isoY) * (tileHeight / 2) - isoZ
 */
export function toScreen(
  isoX: number,
  isoY: number,
  isoZ = 0,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
): ScreenPoint {
  return {
    x: (isoX - isoY) * (tileWidth / 2),
    y: (isoX + isoY) * (tileHeight / 2) - isoZ,
  };
}

/**
 * Converts 2D Screen coordinates back to 3D Isometric grid coordinates
 */
export function toIso(
  screenX: number,
  screenY: number,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
): IsoPoint {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return {
    isoX: Math.round((screenX / halfW + screenY / halfH) / 2),
    isoY: Math.round((screenY / halfH - screenX / halfW) / 2),
    isoZ: 0,
  };
}

/**
 * Calculates dynamic Z-sorting index for depth ordering in PixiJS
 * Formula: zIndex = (isoX + isoY) * 100 + isoZ
 */
export function getZIndex(isoX: number, isoY: number, isoZ = 0): number {
  return Math.floor((isoX + isoY) * 100 + isoZ);
}
