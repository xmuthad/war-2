import type { Player, Unit, Faction, Vector2, Building } from '../../types';
import { Difficulty, UnitState, UnitType, BuildingType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { AI_CONFIG } from '../config/AIConfig';
import { gameEventBus } from './GameEventBus';
import { useGameStore } from '../../store/gameStore';
import { mapManager } from '../map/MapManager';

// Infantry types that can be cloned by Cloning Vats
const CLONEABLE_INFANTRY = new Set<UnitType>([
  UnitType.SOLDIER, UnitType.ROCKET, UnitType.SNIPER, UnitType.SEAL,
  UnitType.TANYA, UnitType.CONSCRIPT, UnitType.FLAKINFANTRY,
  UnitType.TERRORIST, UnitType.IVAN, UnitType.ENGINEER, UnitType.CHRONO,
  UnitType.GI, UnitType.GUARDIAN_GI, UnitType.BRUTE,
]);

const INDUSTRIAL_PLANT_DISCOUNT = 0.75; // 25% cost reduction for vehicles

export class ProductionSystem {
  /**
   * Find a valid spawn position around a building.
   * Tries the default position first, then searches in expanding rings.
   */
  private findSpawnPosition(building: Building, player: Player, unitType?: UnitType): Vector2 {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    // Always spawn next to the building, not at the rally point
    const defaultPos: Vector2 = { x: building.position.x + building.width * tileSize, y: building.position.y };

    // Naval units need water tiles, land units need walkable tiles
    const isNavalUnit = unitType ? this.isNavalUnitType(unitType) : false;
    const isValidPos = isNavalUnit
      ? (pos: Vector2) => mapManager.isWaterAtPosition(pos.x, pos.y) && !this.isUnitAtPosition(pos, player)
      : (pos: Vector2) => mapManager.isWalkableAtPosition(pos.x, pos.y) && !this.isUnitAtPosition(pos, player);

    // Check if default position is valid
    if (isValidPos(defaultPos)) {
      return defaultPos;
    }

    // Search in expanding rings around the building center
    const centerX = building.position.x + (building.width * tileSize) / 2;
    const centerY = building.position.y + (building.height * tileSize) / 2;
    const step = tileSize;

    for (let radius = 1; radius <= 6; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // Only check the ring edge
          const candidate: Vector2 = { x: centerX + dx * step, y: centerY + dy * step };
          if (isValidPos(candidate)) {
            return candidate;
          }
        }
      }
    }

    // Fallback: return default position even if blocked
    return defaultPos;
  }

  private isNavalUnitType(type: UnitType): boolean {
    return type === UnitType.DESTROYER || type === UnitType.SUBMARINE || type === UnitType.TRANSPORT_SHIP;
  }

  private isUnitAtPosition(pos: Vector2, player: Player): boolean {
    const threshold = GAME_CONFIG.TILE_SIZE * 0.5;
    return player.units.some(u =>
      Math.abs(u.position.x - pos.x) < threshold &&
      Math.abs(u.position.y - pos.y) < threshold
    );
  }
  update(player: Player, deltaTime: number, createUnit: (type: UnitType, faction: Faction, position: Vector2) => Unit): void {
    const isLowPower = player.power < GAME_CONFIG.LOW_POWER_THRESHOLD;
    const { weatherBuildModifier, maxUnits } = useGameStore.getState();

    const diffKey = player.isAI
      ? ((player.difficulty || Difficulty.NORMAL).toString().toLowerCase()) as keyof typeof AI_CONFIG.PRODUCTION_SPEED
      : null;
    const aiSpeedMult = diffKey ? (AI_CONFIG.PRODUCTION_SPEED[diffKey] || 1) : 1;

    // Count constructed buildings by type for multi-building speedup
    const buildingCounts: Record<string, number> = {};
    for (const building of player.buildings) {
      if (building.isConstructed && !building.empDisabledUntil) {
        buildingCounts[building.type] = (buildingCounts[building.type] || 0) + 1;
      }
    }

    for (const building of player.buildings) {
      if (building.newUnitCooldown && building.newUnitCooldown > 0) {
        const sameTypeCount = buildingCounts[building.type] || 1;
        const multiBuildingSpeedup = 1 + (sameTypeCount - 1) * 0.3; // Each additional building adds 30% speed
        const speedModifier = (isLowPower ? GAME_CONFIG.POWER_SLOWDOWN_FACTOR : 1) * aiSpeedMult * weatherBuildModifier * multiBuildingSpeedup;
        building.newUnitCooldown -= deltaTime * speedModifier;

        // Update production queue progress for the first item
        if (building.productionQueue.length > 0) {
          const currentItem = building.productionQueue[0];
          currentItem.progress = currentItem.totalTime - building.newUnitCooldown;
        }

        if (building.newUnitCooldown <= 0) {
          building.newUnitCooldown = 0;
          if (building.producingUnit) {
            if (player.units.length >= maxUnits) {
              // At unit cap - refund the queued item and skip production
              const cancelledItem = building.productionQueue[0];
              if (cancelledItem) {
                player.money += cancelledItem.cost;
                building.productionQueue.shift();
                gameEventBus.emit('ui:notification', { message: '单位数量已达上限，生产已取消', type: 'warning' });
              }
              building.producingUnit = null;
              // Start next item in queue if any
              if (building.productionQueue.length > 0) {
                const nextItem = building.productionQueue[0];
                building.producingUnit = nextItem.type as UnitType;
                building.newUnitCooldown = nextItem.totalTime;
                nextItem.progress = 0;
              }
              continue;
            }
            const spawnPos = this.findSpawnPosition(building, player, building.producingUnit);
            const newUnit = createUnit(building.producingUnit, building.faction, spawnPos);
            // If building has a rally point, move the unit there
            if (building.rallyPoint) {
              newUnit.state = UnitState.MOVING;
              newUnit.waypoints = [{ ...building.rallyPoint }];
            }
            player.units.push(newUnit);
            player.statistics.unitsProduced++;
            gameEventBus.emit('unit:produced', { unitType: building.producingUnit, faction: building.faction, position: spawnPos });

            // Cloning Vats: free clone of infantry units
            if (CLONEABLE_INFANTRY.has(building.producingUnit) && player.units.length < maxUnits) {
              const hasCloningVats = player.buildings.some(
                b => b.type === BuildingType.CLONING_VATS && b.isConstructed && b.isPowered
              );
              if (hasCloningVats) {
                const clonePos = this.findSpawnPosition(building, player, building.producingUnit);
                const cloneUnit = createUnit(building.producingUnit, building.faction, clonePos);
                if (building.rallyPoint) {
                  cloneUnit.state = UnitState.MOVING;
                  cloneUnit.waypoints = [{ ...building.rallyPoint }];
                }
                player.units.push(cloneUnit);
                player.statistics.unitsProduced++;
                gameEventBus.emit('unit:produced', { unitType: building.producingUnit, faction: building.faction, position: clonePos });
              }
            }

            building.producingUnit = null;

            // Remove completed item from queue
            if (building.productionQueue.length > 0) {
              building.productionQueue.shift();
            }

            // Start next item in queue if any
            if (building.productionQueue.length > 0) {
              const nextItem = building.productionQueue[0];
              building.producingUnit = nextItem.type as UnitType;
              building.newUnitCooldown = nextItem.totalTime;
              nextItem.progress = 0;
            }
          }
        }
      }

      // Gradual repair: if building is flagged for repair, heal over time and deduct money
      const isEmpDisabled = building.empDisabledUntil && building.empDisabledUntil > useGameStore.getState().gameTime;
      if (building.isRepairing && building.health < building.maxHealth && building.isConstructed && !isEmpDisabled) {
        const repairRate = building.maxHealth * 0.05; // 5% per second
        const repairThisFrame = deltaTime * repairRate;
        const costThisFrame = repairThisFrame * GAME_CONFIG.REPAIR_COST_PER_HP;

        if (player.money >= costThisFrame) {
          building.health = Math.min(building.maxHealth, building.health + repairThisFrame);
          player.money -= costThisFrame;
        } else {
          building.isRepairing = false; // Stop if can't afford
        }

        if (building.health >= building.maxHealth) {
          building.isRepairing = false;
        }
      }
    }
  }

  // Cancel a production item and refund the cost
  cancelProduction(building: Building, queueItemId: string, player: Player): boolean {
    const queueIndex = building.productionQueue.findIndex(q => q.id === queueItemId);
    if (queueIndex === -1) return false;

    const item = building.productionQueue[queueIndex];

    // Refund 100% if just started, decreasing based on progress
    const refundRate = 1 - item.progress * 0.5; // 100% at start, 50% at completion
    const refund = Math.floor(item.cost * refundRate);

    if (refund > 0) {
      player.money += refund;
    }

    building.productionQueue.splice(queueIndex, 1);

    // If the cancelled item was being produced, start the next item
    if (building.producingUnit && queueIndex === 0) {
      building.producingUnit = null;
      // Start next item in queue if any
      if (building.productionQueue.length > 0) {
        const nextItem = building.productionQueue[0];
        building.producingUnit = nextItem.type as UnitType;
        building.newUnitCooldown = nextItem.totalTime - nextItem.progress;
      }
    }

    return true;
  }
}
