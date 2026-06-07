import type { Player } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

export class PowerSystem {
  update(player: Player): void {
    const now = Date.now();
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

    for (const building of player.buildings) {
      building.isPowered = !isLowPower || building.powerOutput > 0;
    }
  }
}
