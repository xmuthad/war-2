import type { Player, Unit, Building, BuildingType, TileType, Vector2, GameMapData } from '../../types';
import { UnitType, TileType as TileTypeEnum, BuildingType as BuildingTypeEnum } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';
import { mapManager } from '../map/MapManager';

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class BridgeSystem {
  readonly BRIDGE_HEALTH = 800;
  readonly BRIDGE_REPAIR_TIME = 10;
  readonly BRIDGE_REPAIR_COST = 500;
  readonly BRIDGE_EXPLOSION_RADIUS = 96;
  readonly BRIDGE_EXPLOSION_DAMAGE = 200;

  destroyBridge(
    bridgeId: string,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): void {
    const bridge = this.findBridgeById(bridgeId, allPlayers, neutralBuildings);
    if (!bridge) return;

    bridge.isBridgeDestroyed = true;

    const tilePositions = bridge.bridgeTilePositions ?? [];
    const changedTiles: Vector2[] = [];

    for (const pos of tilePositions) {
      const tile = mapManager.getTile(pos.x, pos.y);
      if (tile) {
        mapManager.setTile(pos.x, pos.y, TileTypeEnum.BRIDGE_DESTROYED);
        changedTiles.push(pos);
      }
    }

    // Kill any units standing on the bridge tiles
    for (const player of allPlayers) {
      for (const unit of player.units) {
        const unitTile = mapManager.worldToTile(unit.position.x, unit.position.y);
        const onBridge = tilePositions.some(
          pos => pos.x === unitTile.x && pos.y === unitTile.y,
        );
        if (onBridge) {
          unit.health = 0;
        }
      }
    }

    gameEventBus.emit('bridge:destroyed', {
      bridgeId,
      position: bridge.position,
      tilePositions: changedTiles,
    });

    gameEventBus.emit('pathfinding:obstaclesChanged', {
      reason: 'bridge_destroyed',
      bridgeId,
      tiles: changedTiles,
    });

    gameEventBus.emit('terrain:tilesChanged', {
      tiles: changedTiles,
      fromType: TileTypeEnum.BRIDGE,
      toType: TileTypeEnum.BRIDGE_DESTROYED,
    });
  }

  repairBridge(
    bridgeId: string,
    player: Player,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): boolean {
    const bridge = this.findBridgeById(bridgeId, allPlayers, neutralBuildings);
    if (!bridge || !bridge.isBridgeDestroyed) return false;

    if (player.money < this.BRIDGE_REPAIR_COST) return false;

    // Check if an engineer is near the bridge (within 2 tiles)
    const hasEngineerNearby = player.units.some(unit => {
      if (unit.type !== UnitType.ENGINEER) return false;
      const dist = getDistance(unit.position, bridge.position);
      return dist <= GAME_CONFIG.TILE_SIZE * 2;
    });

    if (!hasEngineerNearby) return false;

    const tilePositions = bridge.bridgeTilePositions ?? [];
    const changedTiles: Vector2[] = [];

    for (const pos of tilePositions) {
      const tile = mapManager.getTile(pos.x, pos.y);
      if (tile && tile.type === TileTypeEnum.BRIDGE_DESTROYED) {
        mapManager.setTile(pos.x, pos.y, TileTypeEnum.BRIDGE);
        changedTiles.push(pos);
      }
    }

    bridge.isBridgeDestroyed = false;
    bridge.health = bridge.maxHealth;

    player.money -= this.BRIDGE_REPAIR_COST;

    gameEventBus.emit('bridge:repaired', {
      bridgeId,
      position: bridge.position,
      tilePositions: changedTiles,
      cost: this.BRIDGE_REPAIR_COST,
    });

    gameEventBus.emit('pathfinding:obstaclesChanged', {
      reason: 'bridge_repaired',
      bridgeId,
      tiles: changedTiles,
    });

    gameEventBus.emit('terrain:tilesChanged', {
      tiles: changedTiles,
      fromType: TileTypeEnum.BRIDGE_DESTROYED,
      toType: TileTypeEnum.BRIDGE,
    });

    return true;
  }

  damageBridge(
    bridgeId: string,
    damage: number,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): void {
    const bridge = this.findBridgeById(bridgeId, allPlayers, neutralBuildings);
    if (!bridge || bridge.isBridgeDestroyed) return;

    bridge.health = Math.max(0, bridge.health - damage);

    gameEventBus.emit('building:damaged', {
      buildingId: bridgeId,
      damage,
      remainingHealth: bridge.health,
    });

    if (bridge.health <= 0) {
      this.destroyBridge(bridgeId, allPlayers, neutralBuildings);
    }
  }

  isBridgeTile(tileX: number, tileY: number, map: GameMapData): boolean {
    if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
      return false;
    }
    const tile = map.tiles[tileY][tileX];
    return tile.type === TileTypeEnum.BRIDGE || tile.type === TileTypeEnum.BRIDGE_DESTROYED;
  }

  getBridgesInArea(
    center: Vector2,
    radius: number,
    neutralBuildings: Building[],
  ): Building[] {
    return neutralBuildings.filter(
      building => building.isBridge && getDistance(building.position, center) <= radius,
    );
  }

  findNearestBridge(
    position: Vector2,
    neutralBuildings: Building[],
  ): Building | null {
    let nearest: Building | null = null;
    let nearestDist = Infinity;

    for (const building of neutralBuildings) {
      if (!building.isBridge) continue;
      const dist = getDistance(building.position, position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = building;
      }
    }

    return nearest;
  }

  private findBridgeById(
    bridgeId: string,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): Building | null {
    for (const player of allPlayers) {
      const found = player.buildings.find(b => b.id === bridgeId && b.isBridge);
      if (found) return found;
    }
    return neutralBuildings.find(b => b.id === bridgeId && b.isBridge) ?? null;
  }
}

export const bridgeSystem = new BridgeSystem();
