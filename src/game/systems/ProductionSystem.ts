import type { Player, Unit, Faction, Vector2, UnitType, Building } from '../../types';
import { Difficulty } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { AI_CONFIG } from '../config/AIConfig';
import { gameEventBus } from './GameEventBus';
import { useGameStore } from '../../store/gameStore';

export class ProductionSystem {
  update(player: Player, deltaTime: number, createUnit: (type: UnitType, faction: Faction, position: Vector2) => Unit): void {
    const isLowPower = player.power < GAME_CONFIG.LOW_POWER_THRESHOLD;

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
        const weatherBuildModifier = useGameStore.getState().weatherBuildModifier;
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
            const maxUnits = useGameStore.getState().maxUnits;
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
            const spawnPos = building.rallyPoint
              ? { ...building.rallyPoint }
              : { x: building.position.x + building.width * GAME_CONFIG.TILE_SIZE, y: building.position.y };
            player.units.push(createUnit(building.producingUnit, building.faction, spawnPos));
            player.statistics.unitsProduced++;
            gameEventBus.emit('unit:produced', { unitType: building.producingUnit, faction: building.faction, position: spawnPos });
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
      if (building.isRepairing && building.health < building.maxHealth && building.isConstructed) {
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

    // If the cancelled item was being produced, reset producingUnit
    if (building.producingUnit && queueIndex === 0) {
      building.producingUnit = null;
    }

    return true;
  }
}
