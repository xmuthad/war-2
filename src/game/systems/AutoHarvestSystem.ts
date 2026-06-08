import { Player, Unit, UnitState, GameMapData, UpgradeType, Building, BuildingType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class AutoHarvestSystem {
  update(player: Player, _allPlayers: Player[], map: GameMapData | null): void {
    if (!map) return;

    const idleMiners = player.units.filter(u =>
      u.state === UnitState.IDLE && u.data.canHarvest
    );

    if (idleMiners.length === 0) return;

    // Track already-assigned resource IDs to distribute harvesters across different nodes
    const assignedResourceIds = new Set<string>();
    // Include resources already targeted by non-idle harvesters
    for (const u of player.units) {
      if (u.data.canHarvest && u.state !== UnitState.IDLE && u.target) {
        assignedResourceIds.add(u.target);
      }
    }

    for (const unit of idleMiners) {
      // If cargo is full, find nearest refinery and return
      if ((unit.cargo ?? 0) >= GAME_CONFIG.CARGO_CAPACITY) {
        const refinery = this.findNearestRefinery(unit.position, player);
        if (refinery) {
          unit.state = UnitState.RETURNING;
          unit.target = refinery.id;
          continue;
        }
      }

      // Find nearest unassigned resource node
      const nearestResource = this.findNearestResource(unit.position, map, assignedResourceIds);
      if (nearestResource) {
        unit.state = UnitState.HARVESTING;
        unit.target = nearestResource.id;
        assignedResourceIds.add(nearestResource.id);
      }
    }

    // Also handle miners that have returned to refinery - auto-dump and continue
    for (const unit of player.units) {
      if (unit.state !== UnitState.RETURNING || !unit.data.canHarvest) continue;

      const refinery = player.buildings.find(b => b.id === unit.target);
      if (!refinery) continue;

      const dist = getDistance(unit.position, refinery.position);
      if (dist < GAME_CONFIG.TILE_SIZE * 2) {
        // Dump cargo at refinery
        const cargo = unit.cargo ?? 0;
        if (cargo > 0) {
          // Use same resource value calculation as HarvestSystem
          const resourceMultiplier = unit.harvestTarget?.resourceType === 'gem' ? 75
            : unit.harvestTarget?.resourceType === 'crate' ? 100
            : 50;
          let depositValue = cargo * resourceMultiplier;
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
          unit.cargo = 0;
        }

        // Find next resource and continue
        const nearestResource = this.findNearestResource(unit.position, map);
        if (nearestResource) {
          unit.state = UnitState.HARVESTING;
          unit.target = nearestResource.id;
        } else {
          unit.state = UnitState.IDLE;
          unit.target = null;
        }
      }
    }
  }

  private findNearestRefinery(pos: { x: number; y: number }, player: Player): Building | null {
    const refineries = player.buildings.filter(b =>
      b.type === BuildingType.REFINERY && b.isConstructed
    );
    if (refineries.length === 0) return null;

    let nearest: Building | null = null;
    let nearestDist = Infinity;
    for (const r of refineries) {
      const dist = getDistance(pos, r.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = r;
      }
    }
    return nearest;
  }

  private findNearestResource(pos: { x: number; y: number }, map: GameMapData, excludeIds?: Set<string>): { id: string } | null {
    if (!map.resourceNodes || map.resourceNodes.length === 0) return null;

    let nearest: { id: string } | null = null;
    let nearestDist = Infinity;
    for (const r of map.resourceNodes) {
      if (r.amount <= 0) continue;
      if (excludeIds && excludeIds.has(r.id)) continue;
      const worldX = r.position.x * GAME_CONFIG.TILE_SIZE;
      const worldY = r.position.y * GAME_CONFIG.TILE_SIZE;
      const dist = getDistance(pos, { x: worldX, y: worldY });
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { id: r.id };
      }
    }
    return nearest;
  }
}

export const autoHarvestSystem = new AutoHarvestSystem();