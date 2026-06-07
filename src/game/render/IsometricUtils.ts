// Isometric (2:1) projection helpers used by the render layer only.
// The logical world remains orthogonal: positions are stored in pixels where
// 1 tile == TILE_SIZE (32) px. These helpers project logical-pixel coordinates
// into Phaser canvas coordinates and back so the screen looks like RA2 while
// the simulation (pathfinding, AI, movement) keeps its simple grid layout.

// Each logical tile (32x32) projects to a 64x32 diamond on screen.
export const ISO = {
  TILE_W: 64, // diamond width in render space
  TILE_H: 32, // diamond height in render space
} as const;

// Convert logical-pixel coordinates (lx, ly) to render-space (rx, ry).
//   rx = lx - ly
//   ry = (lx + ly) / 2
export function logicalToRender(lx: number, ly: number): { x: number; y: number } {
  return { x: lx - ly, y: (lx + ly) * 0.5 };
}

// Inverse of logicalToRender:
//   lx = rx/2 + ry
//   ly = ry - rx/2
export function renderToLogical(rx: number, ry: number): { x: number; y: number } {
  return { x: rx * 0.5 + ry, y: ry - rx * 0.5 };
}

// Diamond polygon (4 vertices, render-space) for tile (tileX, tileY) where
// each tile spans 32x32 logical px. Vertex order: top, right, bottom, left.
export function tileDiamond(
  tileX: number,
  tileY: number,
  tileSize: number = 32
): Array<{ x: number; y: number }> {
  const top = logicalToRender(tileX * tileSize, tileY * tileSize);
  const right = logicalToRender((tileX + 1) * tileSize, tileY * tileSize);
  const bottom = logicalToRender((tileX + 1) * tileSize, (tileY + 1) * tileSize);
  const left = logicalToRender(tileX * tileSize, (tileY + 1) * tileSize);
  return [top, right, bottom, left];
}

// Center of tile (tileX, tileY) in render space.
export function tileCenterRender(
  tileX: number,
  tileY: number,
  tileSize: number = 32
): { x: number; y: number } {
  return logicalToRender(
    (tileX + 0.5) * tileSize,
    (tileY + 0.5) * tileSize
  );
}

// Bounding box (in render space) that fully contains a mapW x mapH tile grid.
// The grid corners after projection live at:
//   (0,0)            -> (0, 0)
//   (mapW*ts, 0)     -> ( mapW*ts,        mapW*ts/2)
//   (0, mapH*ts)     -> (-mapH*ts,        mapH*ts/2)
//   (mapW*ts, mapH*ts) -> ((mapW-mapH)*ts, (mapW+mapH)*ts/2)
// So the bounding box is:
//   x:      -mapH * ts
//   y:      0
//   width:  (mapW + mapH) * ts
//   height: (mapW + mapH) * ts / 2
export function isoBounds(
  mapW: number,
  mapH: number,
  tileSize: number = 32
): { x: number; y: number; width: number; height: number } {
  return {
    x: -mapH * tileSize,
    y: 0,
    width: (mapW + mapH) * tileSize,
    height: (mapW + mapH) * tileSize * 0.5,
  };
}
