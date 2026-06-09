import { Vector2, GameMapData, TileType, Unit } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';

export class TerrainHeightSystem {
  readonly HEIGHT_VISION_BONUS = 2;
  readonly HEIGHT_RANGE_BONUS = 1;
  readonly HEIGHT_ATTACK_BONUS = 0.1;
  readonly HEIGHT_DAMAGE_REDUCTION = 0.1;
  readonly CLIFF_HEIGHT = 2;

  getElevationAt(x: number, y: number, map: GameMapData): number {
    if (y < 0 || y >= map.height || x < 0 || x >= map.width) {
      return 0;
    }
    const tile = map.tiles[y][x];
    if (tile.elevation !== undefined) {
      return tile.elevation;
    }
    switch (tile.type) {
      case TileType.CLIFF:
        return this.CLIFF_HEIGHT;
      case TileType.MOUNTAIN:
        return 1;
      case TileType.BRIDGE:
        return 1;
      default:
        return 0;
    }
  }

  getVisionBonus(unit: Unit, map: GameMapData): number {
    const elevation = this.getElevationAt(
      Math.floor(unit.position.x / GAME_CONFIG.TILE_SIZE),
      Math.floor(unit.position.y / GAME_CONFIG.TILE_SIZE),
      map,
    );
    return elevation * this.HEIGHT_VISION_BONUS;
  }

  getAttackRangeBonus(unit: Unit, map: GameMapData): number {
    const elevation = this.getElevationAt(
      Math.floor(unit.position.x / GAME_CONFIG.TILE_SIZE),
      Math.floor(unit.position.y / GAME_CONFIG.TILE_SIZE),
      map,
    );
    return elevation * this.HEIGHT_RANGE_BONUS;
  }

  getAttackBonus(attacker: Unit, target: Unit, map: GameMapData): number {
    const attackerElevation = this.getElevationAt(
      Math.floor(attacker.position.x / GAME_CONFIG.TILE_SIZE),
      Math.floor(attacker.position.y / GAME_CONFIG.TILE_SIZE),
      map,
    );
    const targetElevation = this.getElevationAt(
      Math.floor(target.position.x / GAME_CONFIG.TILE_SIZE),
      Math.floor(target.position.y / GAME_CONFIG.TILE_SIZE),
      map,
    );
    const diff = attackerElevation - targetElevation;
    if (diff > 0) {
      return 1 + diff * this.HEIGHT_ATTACK_BONUS;
    }
    if (diff < 0) {
      return 1 + diff * this.HEIGHT_DAMAGE_REDUCTION;
    }
    return 1;
  }

  canSeeOver(observerPos: Vector2, targetPos: Vector2, map: GameMapData): boolean {
    const obsTileX = Math.floor(observerPos.x / GAME_CONFIG.TILE_SIZE);
    const obsTileY = Math.floor(observerPos.y / GAME_CONFIG.TILE_SIZE);
    const tgtTileX = Math.floor(targetPos.x / GAME_CONFIG.TILE_SIZE);
    const tgtTileY = Math.floor(targetPos.y / GAME_CONFIG.TILE_SIZE);

    const observerElevation = this.getElevationAt(obsTileX, obsTileY, map);

    const dx = tgtTileX - obsTileX;
    const dy = tgtTileY - obsTileY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;

    for (let i = 1; i < steps; i++) {
      const ix = obsTileX + Math.round((dx * i) / steps);
      const iy = obsTileY + Math.round((dy * i) / steps);
      const intermediateElevation = this.getElevationAt(ix, iy, map);
      if (intermediateElevation > observerElevation) {
        return false;
      }
    }
    return true;
  }

  getMovementPenalty(fromPos: Vector2, toPos: Vector2, map: GameMapData): number {
    const fromTileX = Math.floor(fromPos.x / GAME_CONFIG.TILE_SIZE);
    const fromTileY = Math.floor(fromPos.y / GAME_CONFIG.TILE_SIZE);
    const toTileX = Math.floor(toPos.x / GAME_CONFIG.TILE_SIZE);
    const toTileY = Math.floor(toPos.y / GAME_CONFIG.TILE_SIZE);

    const fromElevation = this.getElevationAt(fromTileX, fromTileY, map);
    const toElevation = this.getElevationAt(toTileX, toTileY, map);
    const diff = toElevation - fromElevation;

    // Cannot climb more than 1 elevation level at a time (cliffs block movement)
    if (diff > 1) {
      return Infinity;
    }

    // Moving uphill costs 1.5x per elevation level
    if (diff > 0) {
      return 1 + diff * 0.5;
    }

    // Moving downhill or same level costs normal
    return 1;
  }

  updateTileElevations(map: GameMapData): void {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x];
        switch (tile.type) {
          case TileType.CLIFF:
            tile.elevation = this.CLIFF_HEIGHT;
            break;
          case TileType.MOUNTAIN:
            tile.elevation = 1;
            break;
          case TileType.BRIDGE:
            tile.elevation = 1;
            break;
          default:
            tile.elevation = 0;
            break;
        }
      }
    }
  }
}

export const terrainHeightSystem = new TerrainHeightSystem();
