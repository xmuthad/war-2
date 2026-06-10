import { Unit, Building, Player, BuildingType, UnitType, UnitRank, UnitState } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const INFANTRY_TYPES = new Set([
  UnitType.SOLDIER, UnitType.ROCKET, UnitType.SNIPER, UnitType.SEAL,
  UnitType.TANYA, UnitType.CONSCRIPT, UnitType.FLAKINFANTRY,
  UnitType.TERRORIST, UnitType.IVAN, UnitType.ENGINEER, UnitType.CHRONO,
  UnitType.SPY, UnitType.GI, UnitType.GUARDIAN_GI, UnitType.BRUTE,
]);

const VEHICLE_TYPES = new Set([
  UnitType.TANK, UnitType.IFV, UnitType.PRISM, UnitType.RHINO,
  UnitType.APOCALYPSE, UnitType.TESLA, UnitType.PHANTOM,
  UnitType.GUARDIAN, UnitType.FLAK, UnitType.DESPOT, UnitType.APC,
]);

export interface SpyInfiltrationResult {
  success: boolean;
  effect: string;
}

export class SpyInfiltrationSystem {
  private readonly INFILTRATE_RANGE = GAME_CONFIG.TILE_SIZE * 2;

  infiltrateBuilding(spy: Unit, building: Building, store: any): SpyInfiltrationResult {
    const gameTime: number = store.gameTime;
    const targetPlayerId = building.faction;
    const allPlayers: Player[] = [store.currentPlayer, ...store.aiPlayers].filter(Boolean);
    const targetPlayer = allPlayers.find(p => p.faction === targetPlayerId);
    const spyOwner = allPlayers.find(p => p.faction === spy.faction);

    if (!targetPlayer || !spyOwner) {
      return { success: false, effect: '' };
    }

    switch (building.type) {
      case BuildingType.BARRACKS: {
        // Veteran infantry: all future infantry produced by spy owner start as VETERAN
        if (!spyOwner.spyInfiltrationBuffs) {
          spyOwner.spyInfiltrationBuffs = { veteranInfantry: false, veteranVehicles: false, mapRevealedUntil: 0 };
        }
        spyOwner.spyInfiltrationBuffs.veteranInfantry = true;
        gameEventBus.emit('ui:notification', { message: '间谍渗透兵营！我方步兵将以老兵等级生产！', type: 'success' });
        gameEventBus.emit('notification:success', { message: '间谍渗透: 步兵老兵化' });
        return { success: true, effect: 'veteran_infantry' };
      }

      case BuildingType.WARFACTORY: {
        // Veteran vehicles: all future vehicles produced by spy owner start as VETERAN
        if (!spyOwner.spyInfiltrationBuffs) {
          spyOwner.spyInfiltrationBuffs = { veteranInfantry: false, veteranVehicles: false, mapRevealedUntil: 0 };
        }
        spyOwner.spyInfiltrationBuffs.veteranVehicles = true;
        gameEventBus.emit('ui:notification', { message: '间谍渗透战车工厂！我方车辆将以老兵等级生产！', type: 'success' });
        gameEventBus.emit('notification:success', { message: '间谍渗透: 载具老兵化' });
        return { success: true, effect: 'veteran_vehicles' };
      }

      case BuildingType.REFINERY: {
        // Steal half of the building owner's credits
        const stolenAmount = Math.floor(targetPlayer.money * 0.5);
        if (stolenAmount > 0) {
          targetPlayer.money -= stolenAmount;
          spyOwner.money += stolenAmount;
        }
        gameEventBus.emit('ui:notification', { message: `间谍窃取了 $${stolenAmount}！`, type: 'success' });
        return { success: true, effect: 'steal_credits' };
      }

      case BuildingType.POWER: {
        // Power outage: disable all powered buildings for 60 seconds
        const disableUntil = gameTime + 60;
        for (const b of targetPlayer.buildings) {
          if (b.powerOutput > 0) {
            b.empDisabledUntil = disableUntil;
          }
        }
        gameEventBus.emit('ui:notification', { message: '间谍切断了敌方全部电力！持续60秒！', type: 'success' });
        return { success: true, effect: 'power_outage' };
      }

      case BuildingType.TECH: {
        // Reveal map: mark all enemy units with _spyRevealedUntil for 30 seconds
        const revealUntil = gameTime + 30;
        for (const enemyUnit of targetPlayer.units) {
          enemyUnit._spyRevealedUntil = revealUntil;
        }
        if (!spyOwner.spyInfiltrationBuffs) {
          spyOwner.spyInfiltrationBuffs = { veteranInfantry: false, veteranVehicles: false, mapRevealedUntil: 0 };
        }
        spyOwner.spyInfiltrationBuffs.mapRevealedUntil = revealUntil;
        gameEventBus.emit('ui:notification', { message: '间谍获取了敌方全部情报！持续30秒！', type: 'success' });
        return { success: true, effect: 'reveal_map' };
      }

      default: {
        // Generic building: disable for 15 seconds
        building.empDisabledUntil = gameTime + 15;
        gameEventBus.emit('ui:notification', { message: '间谍渗透了敌方建筑！', type: 'success' });
        return { success: true, effect: 'disable' };
      }
    }
  }

  update(players: Player[], destroyedUnits: string[], store: any): void {
    for (const player of players) {
      for (const unit of player.units) {
        if (unit.type !== UnitType.SPY) continue;
        if (!unit.isDisguised) continue;
        if (unit.state !== UnitState.IDLE && unit.state !== UnitState.MOVING) continue;

        for (const otherPlayer of players) {
          if (otherPlayer.id === player.id) continue;
          if (player.teamId !== undefined && otherPlayer.teamId === player.teamId) continue;

          for (const building of otherPlayer.buildings) {
            if (!building.isConstructed) continue;
            const bCenterX = building.position.x + (building.width || 2) * GAME_CONFIG.TILE_SIZE / 2;
            const bCenterY = building.position.y + (building.height || 2) * GAME_CONFIG.TILE_SIZE / 2;
            const dist = getDistance(unit.position, { x: bCenterX, y: bCenterY });
            if (dist < this.INFILTRATE_RANGE) {
              const result = this.infiltrateBuilding(unit, building, store);
              if (result.success) {
                destroyedUnits.push(unit.id);
                break;
              }
            }
          }
          if (destroyedUnits.includes(unit.id)) break;
        }
      }
    }
  }

  /** Check if a newly produced unit should start as VETERAN due to spy infiltration buffs */
  applyVeteranBuff(unit: Unit, player: Player): void {
    if (!player.spyInfiltrationBuffs) return;
    if (INFANTRY_TYPES.has(unit.type) && player.spyInfiltrationBuffs.veteranInfantry) {
      unit.rank = UnitRank.VETERAN;
    }
    if (VEHICLE_TYPES.has(unit.type) && player.spyInfiltrationBuffs.veteranVehicles) {
      unit.rank = UnitRank.VETERAN;
    }
  }
}
