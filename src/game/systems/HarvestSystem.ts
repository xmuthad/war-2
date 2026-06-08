import type { Unit, Building, Player, GameMapData, ResourceNode, Vector2 } from '../../types';
import { UnitState, BuildingType, TileType, UpgradeType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { mapManager } from '../map/MapManager';
import { gameEventBus } from './GameEventBus';

function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getDirectionFromDelta(dx: number, dy: number): number {
  return Math.atan2(dy, dx);
}

function findNearestRefinery(unit: Unit, buildings: Building[]): Building | null {
  let nearest: Building | null = null;
  let minDist = Infinity;
  for (const building of buildings) {
    if (building.type === BuildingType.REFINERY && building.isConstructed && building.isPowered) {
      const dist = distance(unit.position, building.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = building;
      }
    }
  }
  return nearest;
}

function findNearestResource(unit: Unit, resources: ResourceNode[]): ResourceNode | null {
  let nearest: ResourceNode | null = null;
  let minDist = Infinity;
  for (const resource of resources) {
    if (resource.amount > 0) {
      // resource.position is in tile coordinates, unit.position is in world coordinates
      const worldPos = { x: resource.position.x * GAME_CONFIG.TILE_SIZE, y: resource.position.y * GAME_CONFIG.TILE_SIZE };
      const dist = distance(unit.position, worldPos);
      if (dist < minDist) {
        minDist = dist;
        nearest = resource;
      }
    }
  }
  return nearest;
}

export class HarvestSystem {
  update(unit: Unit, player: Player, map: GameMapData | null, deltaTime: number): void {
    switch (unit.state) {
      case UnitState.HARVESTING:
        this.updateHarvesting(unit, player, map, deltaTime);
        break;
      case UnitState.RETURNING:
        this.updateReturning(unit, player, map, deltaTime);
        break;
    }
  }

  private updateHarvesting(unit: Unit, player: Player, map: GameMapData | null, deltaTime: number): void {
    if (!unit.data.canHarvest) {
      unit.state = UnitState.IDLE;
      return;
    }

    if (unit.cargo >= unit.cargoCapacity) {
      unit.state = UnitState.RETURNING;
      const refinery = findNearestRefinery(unit, player.buildings);
      if (refinery) {
        unit.waypoints = [{ ...refinery.position }];
      }
      return;
    }

    const resource = unit.harvestTarget ||
      findNearestResource(unit, map?.resourceNodes || []);

    if (!resource || resource.amount <= 0) {
      unit.state = UnitState.IDLE;
      unit.harvestTarget = null;
      unit.waypoints = [];
      return;
    }

    const resourcePos = { x: resource.position.x * GAME_CONFIG.TILE_SIZE, y: resource.position.y * GAME_CONFIG.TILE_SIZE };
    const harvestDist = distance(unit.position, resourcePos);

    if (harvestDist > GAME_CONFIG.TILE_SIZE * 2) {
      // Use waypoints for pathfinding-aware movement instead of direct position update
      if (unit.waypoints.length === 0) {
        unit.waypoints = [resourcePos];
      }
      // MovementSystem handles the actual movement via waypoints
      return;
    } else {
      const harvestAmount = Math.min(GAME_CONFIG.HARVEST_AMOUNT * deltaTime, resource.amount, unit.cargoCapacity - unit.cargo);
      unit.cargo += harvestAmount;
      resource.amount -= harvestAmount;
      unit.direction = getDirectionFromDelta(
        resourcePos.x - unit.position.x,
        resourcePos.y - unit.position.y
      );

      if (resource.amount <= 0 && map) {
        map.resourceNodes = map.resourceNodes.filter(r => r.id !== resource.id);
        gameEventBus.emit('resource:depleted', { resourceId: resource.id, position: resource.position });
        const resTileX = Math.floor(resource.position.x);
        const resTileY = Math.floor(resource.position.y);

        // Clean up surrounding ORE tiles
        const changedTiles: Array<{ x: number; y: number; type: string }> = [];
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const tile = mapManager.getTile(resTileX + dx, resTileY + dy);
            if (tile && tile.type === TileType.ORE) {
              mapManager.setTile(resTileX + dx, resTileY + dy, TileType.GRASS);
              changedTiles.push({ x: resTileX + dx, y: resTileY + dy, type: TileType.GRASS });
            }
          }
        }
        if (changedTiles.length > 0) {
          gameEventBus.emit('terrain:tilesChanged', { tiles: changedTiles });
        }
        unit.harvestTarget = null;
      }
    }
  }

  private updateReturning(unit: Unit, player: Player, map: GameMapData | null, deltaTime: number): void {
    const refinery = findNearestRefinery(unit, player.buildings);

    if (!refinery) {
      unit.state = UnitState.IDLE;
      unit.cargo = 0; // Clear cargo to prevent IDLE→RETURNING loop
      unit.waypoints = [];
      return;
    }

    const refineryDist = distance(unit.position, refinery.position);

    if (refineryDist > GAME_CONFIG.TILE_SIZE * 3) {
      // Use waypoints for pathfinding-aware movement instead of direct position update
      if (unit.waypoints.length === 0) {
        unit.waypoints = [{ ...refinery.position }];
      }
      // MovementSystem handles the actual movement via waypoints
      return;
    } else {
      const resourceMultiplier = unit.harvestTarget?.resourceType === 'gem' ? 75
        : unit.harvestTarget?.resourceType === 'crate' ? 100
        : 50;
      let depositValue = unit.cargo * resourceMultiplier;
      // Apply ore value upgrades
      if (player.researchedUpgrades.includes(UpgradeType.ORE_COMPRESSION)) {
        depositValue = Math.floor(depositValue * 1.2);
      }
      if (player.researchedUpgrades.includes(UpgradeType.GOLD_REFINING)) {
        depositValue = Math.floor(depositValue * 1.5);
      }
      player.money += depositValue;
      player.statistics.resourcesGathered += depositValue;
      gameEventBus.emit('resource:collected', { amount: depositValue, faction: player.faction });
      gameEventBus.emit('resource:deposited', { amount: depositValue, faction: player.faction, position: unit.position });
      // Increment refinery ore storage
      if (refinery.oreStorage !== undefined) {
        refinery.oreStorage = Math.min(
          refinery.maxOreStorage || 1000,
          refinery.oreStorage + depositValue
        );
      }
      unit.cargo = 0;
      unit.state = UnitState.HARVESTING;

      const nextResource = findNearestResource(unit, map?.resourceNodes || []);
      if (nextResource) {
        unit.harvestTarget = nextResource;
        unit.waypoints = [{ x: nextResource.position.x * GAME_CONFIG.TILE_SIZE, y: nextResource.position.y * GAME_CONFIG.TILE_SIZE }];
      } else {
        unit.state = UnitState.IDLE;
      }
    }
  }
}
