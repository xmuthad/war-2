import { BuildingType } from '../../types';
import type { Player } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';
import { useGameStore } from '../../store/gameStore';

// Power priority: higher = last to lose power when low
// Defense buildings stay powered longest, tech buildings first to lose power
const POWER_PRIORITY: Partial<Record<BuildingType, number>> = {
  // Defense - highest priority (stay powered longest)
  [BuildingType.TESLA_COIL]: 10,
  [BuildingType.TURRET]: 10,
  [BuildingType.FLAME_TOWER]: 9,
  [BuildingType.WALL]: 9,
  [BuildingType.DEFENSE]: 9,
  // Production - high priority
  [BuildingType.BARRACKS]: 7,
  [BuildingType.WARFACTORY]: 7,
  [BuildingType.HELIPAD]: 6,
  [BuildingType.NAVAL_SHIPYARD]: 6,
  // Economy - medium priority
  [BuildingType.REFINERY]: 5,
  [BuildingType.REPAIR]: 4,
  // Tech - low priority (first to lose power)
  [BuildingType.RADAR]: 3,
  [BuildingType.TECH]: 2,
  // Superweapons - lowest priority
  [BuildingType.NUCLEAR_SILO]: 1,
  [BuildingType.CHRONOSPHERE]: 1,
  [BuildingType.IRON_CURTAIN]: 1,
  // Command center - always powered
  [BuildingType.COMMAND]: 100,
  // Power plants - always powered
  [BuildingType.POWER]: 100,
};

function getPowerPriority(buildingType: BuildingType): number {
  return POWER_PRIORITY[buildingType] ?? 5; // default medium priority
}

export class PowerSystem {
  update(player: Player): void {
    const now = useGameStore.getState().gameTime;
    const totalPower = player.buildings.reduce((sum, b) => {
      if (!b.isConstructed) return sum;
      if (b.empDisabledUntil && b.empDisabledUntil > now) return sum;
      return sum + b.powerOutput;
    }, 0);
    const totalConsumption = player.buildings.reduce((sum, b) =>
      sum + (b.isConstructed ? b.powerConsumption : 0), 0);
    const wasLowPower = player.power < GAME_CONFIG.LOW_POWER_THRESHOLD;
    player.power = totalPower - totalConsumption;
    player.maxPower = totalPower;
    const isLowPower = player.power < GAME_CONFIG.LOW_POWER_THRESHOLD;

    if (isLowPower && !wasLowPower && !player.isAI) {
      gameEventBus.emit('power:low', { faction: player.faction });
      gameEventBus.emit('alert:lowPower', { faction: player.faction });
    } else if (!isLowPower && wasLowPower && !player.isAI) {
      gameEventBus.emit('power:restored', { faction: player.faction });
    }

    if (isLowPower) {
      // Priority-based power allocation: sort buildings by priority (ascending = first to lose)
      const sortedBuildings = [...player.buildings]
        .filter(b => b.isConstructed && b.powerConsumption > 0)
        .sort((a, b) => getPowerPriority(a.type) - getPowerPriority(b.type));

      let remainingPower = totalPower;
      // Power plants and command center are always powered
      for (const building of player.buildings) {
        if (building.powerOutput > 0 || building.type === BuildingType.COMMAND) {
          building.isPowered = true;
        }
      }

      // Allocate power by priority
      for (const building of sortedBuildings) {
        if (remainingPower >= building.powerConsumption) {
          building.isPowered = true;
          remainingPower -= building.powerConsumption;
        } else {
          building.isPowered = false;
        }
      }
    } else {
      // Sufficient power: all buildings powered
      for (const building of player.buildings) {
        building.isPowered = !isLowPower || building.powerOutput > 0;
      }
    }
  }
}
