import type { Unit, Building, Vector2, PendingBomb, Faction, Player } from '../../types';
import { UnitType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';
import { combatSystem, DamageType, ArmorType } from './CombatSystem';

export class IvanBombSystem {
  private bombs: PendingBomb[] = [];

  placeBomb(ivan: Unit, target: Unit | Building, _store?: unknown): PendingBomb | null {
    if (ivan.type !== UnitType.IVAN) return null;

    // Check range: ivan must be within 1.5 tiles of the target
    const dx = ivan.position.x - target.position.x;
    const dy = ivan.position.y - target.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRange = 1.5 * GAME_CONFIG.TILE_SIZE;
    if (dist > maxRange) return null;

    const bomb: PendingBomb = {
      id: `bomb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetId: target.id,
      targetPosition: { ...target.position },
      timer: 5,
      damage: 500,
      faction: ivan.faction,
    };
    this.bombs.push(bomb);

    gameEventBus.emit('combat:hit', {
      attackerId: ivan.id,
      targetId: target.id,
      damage: 0,
      position: target.position,
    });

    return bomb;
  }

  update(deltaTime: number, allPlayers: Player[]): { destroyedUnits: string[]; destroyedBuildings: string[] } {
    const destroyedUnits: string[] = [];
    const destroyedBuildings: string[] = [];

    // Decrement timers
    for (const bomb of this.bombs) {
      bomb.timer -= deltaTime;
    }

    // Process detonated bombs
    const detonated = this.bombs.filter(b => b.timer <= 0);
    this.bombs = this.bombs.filter(b => b.timer > 0);

    for (const bomb of detonated) {
      let bombKillCount = 0;
      const bombOwner = allPlayers.find(p => p.faction === bomb.faction);

      for (const player of allPlayers) {
        // Direct damage to target unit
        const targetUnit = player.units.find(u => u.id === bomb.targetId);
        if (targetUnit) {
          const armorType = combatSystem.getArmorTypeForUnit(targetUnit.type);
          const actualDamage = combatSystem.calculateDamage(bomb.damage, DamageType.EXPLOSIVE, armorType, targetUnit.armor);
          targetUnit.health -= actualDamage;
          gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: targetUnit.id, damage: actualDamage, position: targetUnit.position });
          if (targetUnit.health <= 0) {
            destroyedUnits.push(targetUnit.id);
            bombKillCount++;
          }
        }

        // Direct damage to target building
        const targetBuilding = player.buildings.find(b => b.id === bomb.targetId);
        if (targetBuilding) {
          const actualDamage = combatSystem.calculateDamage(bomb.damage, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
          targetBuilding.health -= actualDamage;
          gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: targetBuilding.id, damage: actualDamage, position: targetBuilding.position });
          if (targetBuilding.health <= 0) {
            destroyedBuildings.push(targetBuilding.id);
            bombKillCount++;
          }
        }

        // Splash damage to nearby units (1.5 tile radius, 200 damage)
        const splashRadius = 1.5 * GAME_CONFIG.TILE_SIZE;
        for (const unit of [...player.units]) {
          if (unit.id === bomb.targetId) continue;
          const udx = unit.position.x - bomb.targetPosition.x;
          const udy = unit.position.y - bomb.targetPosition.y;
          if (Math.sqrt(udx * udx + udy * udy) <= splashRadius) {
            const armorType = combatSystem.getArmorTypeForUnit(unit.type);
            const splashDamage = combatSystem.calculateDamage(200, DamageType.EXPLOSIVE, armorType, unit.armor);
            unit.health -= splashDamage;
            gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: unit.id, damage: splashDamage, position: unit.position });
            if (unit.health <= 0) {
              destroyedUnits.push(unit.id);
              bombKillCount++;
            }
          }
        }

        // Splash damage to nearby buildings
        for (const building of [...player.buildings]) {
          if (building.id === bomb.targetId) continue;
          const bdx = building.position.x - bomb.targetPosition.x;
          const bdy = building.position.y - bomb.targetPosition.y;
          if (Math.sqrt(bdx * bdx + bdy * bdy) <= splashRadius) {
            const splashDamage = combatSystem.calculateDamage(200, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
            building.health -= splashDamage;
            gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: building.id, damage: splashDamage, position: building.position });
            if (building.health <= 0) {
              destroyedBuildings.push(building.id);
              bombKillCount++;
            }
          }
        }
      }

      if (bombOwner && bombKillCount > 0) {
        bombOwner.statistics.enemiesDestroyed += bombKillCount;
      }

      gameEventBus.emit('combat:explosion', { position: bomb.targetPosition });
    }

    return { destroyedUnits, destroyedBuildings };
  }

  getBombs(): PendingBomb[] {
    return this.bombs;
  }
}

export const ivanBombSystem = new IvanBombSystem();
