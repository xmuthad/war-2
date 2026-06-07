import { GameMapData, Tile, TileType, Vector2, ResourceNode } from '../../types';

const DEFAULT_TILE_SIZE = 32;

interface MapValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface NeighborTile {
  x: number;
  y: number;
  tile: Tile;
  direction: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';
}

const TILE_PROPERTIES: Record<TileType, { walkable: boolean; buildable: boolean; movementCost: number }> = {
  [TileType.GRASS]: { walkable: true, buildable: true, movementCost: 1 },
  [TileType.WATER]: { walkable: false, buildable: false, movementCost: 99 },
  [TileType.MOUNTAIN]: { walkable: false, buildable: false, movementCost: 99 },
  [TileType.FOREST]: { walkable: true, buildable: false, movementCost: 1.5 },
  [TileType.ROAD]: { walkable: true, buildable: false, movementCost: 0.8 },
  [TileType.ORE]: { walkable: true, buildable: false, movementCost: 1.2 },
  [TileType.SAND]: { walkable: true, buildable: true, movementCost: 1.3 },
  [TileType.ICE]: { walkable: true, buildable: false, movementCost: 0.8 },
  [TileType.MUD]: { walkable: true, buildable: false, movementCost: 2 },
  [TileType.RUBBLE]: { walkable: true, buildable: false, movementCost: 1.5 },
  [TileType.CRATER]: { walkable: true, buildable: false, movementCost: 1.8 },
  [TileType.CLIFF]: { walkable: false, buildable: false, movementCost: 99 },
};

export function getTileProperties(type: TileType): { walkable: boolean; buildable: boolean; movementCost: number } {
  return TILE_PROPERTIES[type];
}

export class MapManager {
  private map: GameMapData | null = null;
  private tileSize = DEFAULT_TILE_SIZE;
  private occupiedTiles: Map<string, string> = new Map();

  initialize(map: GameMapData) {
    this.map = map;
    this.occupiedTiles.clear();
  }

  isInBounds(x: number, y: number): boolean {
    if (!this.map) return false;
    return x >= 0 && x < this.map.width && y >= 0 && y < this.map.height;
  }

  getTile(x: number, y: number): Tile | null {
    if (!this.isInBounds(x, y)) return null;
    return this.map!.tiles[y][x];
  }

  getTileAtPosition(worldX: number, worldY: number): Tile | null {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    return this.getTile(tileX, tileY);
  }

  setTile(x: number, y: number, type: TileType): boolean {
    if (!this.isInBounds(x, y)) return false;
    const props = TILE_PROPERTIES[type];
    this.map!.tiles[y][x] = {
      type,
      walkable: props.walkable,
      buildable: props.buildable,
      movementCost: props.movementCost,
    };
    return true;
  }

  setTileAtPosition(worldX: number, worldY: number, type: TileType): boolean {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    return this.setTile(tileX, tileY, type);
  }

  getNeighbors(x: number, y: number, includeDiagonal: boolean = false): NeighborTile[] {
    const directions: Array<{ dx: number; dy: number; dir: NeighborTile['direction'] }> = [
      { dx: 0, dy: -1, dir: 'north' },
      { dx: 0, dy: 1, dir: 'south' },
      { dx: 1, dy: 0, dir: 'east' },
      { dx: -1, dy: 0, dir: 'west' },
    ];

    if (includeDiagonal) {
      directions.push(
        { dx: 1, dy: -1, dir: 'northeast' },
        { dx: -1, dy: -1, dir: 'northwest' },
        { dx: 1, dy: 1, dir: 'southeast' },
        { dx: -1, dy: 1, dir: 'southwest' },
      );
    }

    const neighbors: NeighborTile[] = [];
    for (const { dx, dy, dir } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const tile = this.getTile(nx, ny);
      if (tile) {
        neighbors.push({ x: nx, y: ny, tile, direction: dir });
      }
    }

    return neighbors;
  }

  getWalkableNeighbors(x: number, y: number, includeDiagonal: boolean = false): NeighborTile[] {
    return this.getNeighbors(x, y, includeDiagonal).filter(n => n.tile.walkable);
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    return tile ? tile.walkable : false;
  }

  isWalkableAtPosition(worldX: number, worldY: number): boolean {
    const tile = this.getTileAtPosition(worldX, worldY);
    return tile ? tile.walkable : false;
  }

  isWaterAtPosition(worldX: number, worldY: number): boolean {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    return this.getTile(tileX, tileY)?.type === TileType.WATER;
  }

  isBuildable(x: number, y: number, width: number = 1, height: number = 1, playerBuildings?: Array<{position: {x: number, y: number}, width: number, height: number}>): boolean {
    if (!this.map) return false;

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = this.getTile(tx, ty);
        if (!tile || !tile.buildable) return false;
        const key = `${tx},${ty}`;
        if (this.occupiedTiles.has(key)) return false;
      }
    }

    // Adjacency check: must be near an existing building (exempt when no buildings exist yet)
    if (playerBuildings && playerBuildings.length > 0) {
      const isAdjacent = playerBuildings.some(building => {
        const bTileX = Math.floor(building.position.x / this.tileSize);
        const bTileY = Math.floor(building.position.y / this.tileSize);
        const bEndX = bTileX + building.width;
        const bEndY = bTileY + building.height;
        // Check if any tile of the new building is within 1 tile of any edge of an existing building
        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            if (tx >= bTileX - 1 && tx <= bEndX &&
                ty >= bTileY - 1 && ty <= bEndY) {
              return true;
            }
          }
        }
        return false;
      });

      if (!isAdjacent) return false;
    }

    return true;
  }

  isBuildableAtPosition(worldX: number, worldY: number, width: number, height: number): boolean {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    return this.isBuildable(tileX, tileY, width, height);
  }

  markOccupied(x: number, y: number, width: number, height: number, entityId: string): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.occupiedTiles.set(`${x + dx},${y + dy}`, entityId);
      }
    }
  }

  unmarkOccupied(x: number, y: number, width: number, height: number): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.occupiedTiles.delete(`${x + dx},${y + dy}`);
      }
    }
  }

  isOccupied(x: number, y: number): boolean {
    return this.occupiedTiles.has(`${x},${y}`);
  }

  getOccupyingEntity(x: number, y: number): string | undefined {
    return this.occupiedTiles.get(`${x},${y}`);
  }

  getMovementCost(x: number, y: number): number {
    const tile = this.getTile(x, y);
    return tile ? tile.movementCost : 99;
  }

  getMovementCostAtPosition(worldX: number, worldY: number): number {
    const tile = this.getTileAtPosition(worldX, worldY);
    return tile ? tile.movementCost : 99;
  }

  getResourceAt(tileX: number, tileY: number): ResourceNode | null {
    if (!this.map) return null;
    return this.map.resourceNodes.find(r =>
      Math.floor(r.position.x) === tileX && Math.floor(r.position.y) === tileY
    ) || null;
  }

  getResourceById(resourceId: string): ResourceNode | null {
    if (!this.map) return null;
    return this.map.resourceNodes.find(r => r.id === resourceId) || null;
  }

  depleteResource(resourceId: string, amount: number): boolean {
    if (!this.map) return false;
    const resource = this.map.resourceNodes.find(r => r.id === resourceId);
    if (!resource) return false;

    resource.amount = Math.max(0, resource.amount - amount);
    return true;
  }

  removeResource(resourceId: string): boolean {
    if (!this.map) return false;
    const index = this.map.resourceNodes.findIndex(r => r.id === resourceId);
    if (index === -1) return false;

    const resource = this.map.resourceNodes[index];
    const tileX = Math.floor(resource.position.x);
    const tileY = Math.floor(resource.position.y);
    const tile = this.getTile(tileX, tileY);
    if (tile && tile.type === TileType.ORE) {
      this.setTile(tileX, tileY, TileType.CRATER);
    }

    this.map.resourceNodes.splice(index, 1);
    return true;
  }

  worldToTile(worldX: number, worldY: number): Vector2 {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize),
    };
  }

  tileToWorld(tileX: number, tileY: number): Vector2 {
    return {
      x: tileX * this.tileSize,
      y: tileY * this.tileSize,
    };
  }

  findPathablePositionNear(x: number, y: number, maxRadius: number = 5): Vector2 | null {
    if (this.isWalkable(x, y)) {
      return { x, y };
    }

    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          if (this.isWalkable(x + dx, y + dy)) {
            return { x: x + dx, y: y + dy };
          }
        }
      }
    }

    return null;
  }

  validate(map: GameMapData): MapValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!map.id) errors.push('Map id is missing');
    if (!map.name) errors.push('Map name is missing');
    if (map.width < 16 || map.width > 256) errors.push(`Map width ${map.width} out of range (16-256)`);
    if (map.height < 16 || map.height > 256) errors.push(`Map height ${map.height} out of range (16-256)`);

    if (map.tiles.length !== map.height) {
      errors.push(`Tiles rows (${map.tiles.length}) don't match height (${map.height})`);
    }

    for (let y = 0; y < map.tiles.length; y++) {
      if (map.tiles[y].length !== map.width) {
        errors.push(`Tiles row ${y} length (${map.tiles[y].length}) doesn't match width (${map.width})`);
        break;
      }
    }

    if (map.spawnPoints.length < 2) {
      errors.push('Map needs at least 2 spawn points');
    }

    for (let i = 0; i < map.spawnPoints.length; i++) {
      const sp = map.spawnPoints[i];
      if (sp.x < 0 || sp.x >= map.width || sp.y < 0 || sp.y >= map.height) {
        errors.push(`Spawn point ${i} (${sp.x},${sp.y}) is out of bounds`);
      } else {
        const tile = map.tiles[Math.floor(sp.y)]?.[Math.floor(sp.x)];
        if (tile && !tile.walkable) {
          errors.push(`Spawn point ${i} is on unwalkable terrain (${tile.type})`);
        }
      }
    }

    if (map.resourceNodes.length === 0) {
      warnings.push('Map has no resource nodes');
    }

    for (const resource of map.resourceNodes) {
      if (resource.amount <= 0) {
        warnings.push(`Resource ${resource.id} has no amount`);
      }
      if (resource.position.x < 0 || resource.position.x >= map.width ||
          resource.position.y < 0 || resource.position.y >= map.height) {
        errors.push(`Resource ${resource.id} position is out of bounds`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getMap(): GameMapData | null {
    return this.map;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  setTileSize(size: number) {
    this.tileSize = size;
  }

  dispose(): void {
    this.map = null;
    this.occupiedTiles.clear();
  }
}

export const mapManager = new MapManager();
