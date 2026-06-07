import type { Unit, Player, Vector2 } from '../../types';
import { UnitState, BuildingType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';

function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class RepairSystem {
  update(unit: Unit, player: Player, deltaTime: number): void {
    // Repair factory: vehicles being repaired at the factory
    if (unit.isRepairingAtFactory) {
      this.updateFactoryRepair(unit, player, deltaTime);
      return;
    }

    // Engineer repairing buildings
    if (unit.state !== UnitState.REPAIRING) return;

    const targetBuilding = player.buildings.find(b => b.id === unit.target);
    if (!targetBuilding || targetBuilding.health >= targetBuilding.maxHealth) {
      unit.state = UnitState.IDLE;
      unit.target = null;
      return;
    }

    const repairDist = distance(unit.position, targetBuilding.position);
    if (repairDist > GAME_CONFIG.TILE_SIZE * 3) {
      const dx = targetBuilding.position.x - unit.position.x;
      const dy = targetBuilding.position.y - unit.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = unit.speed * GAME_CONFIG.TILE_SIZE * deltaTime;
      const ratio = Math.min(1, moveSpeed / dist);
      unit.position.x += dx * ratio;
      unit.position.y += dy * ratio;
      unit.direction = Math.atan2(dy, dx);
    } else {
      const repairAmount = deltaTime * GAME_CONFIG.REPAIR_RATE * targetBuilding.maxHealth;
      const repairCost = repairAmount * GAME_CONFIG.REPAIR_COST_PER_HP;
      if (player.money >= repairCost) {
        targetBuilding.health = Math.min(targetBuilding.maxHealth, targetBuilding.health + repairAmount);
        player.money -= repairCost;
      }
    }
  }

  private updateFactoryRepair(unit: Unit, player: Player, deltaTime: number): void {
    const repairBuilding = player.buildings.find(b =>
      b.type === BuildingType.REPAIR && b.isConstructed
    );
    if (!repairBuilding) {
      unit.isRepairingAtFactory = false;
      return;
    }

    // Check if unit is at the repair building
    const dist = distance(unit.position, repairBuilding.position);
    if (dist > GAME_CONFIG.TILE_SIZE * 2) {
      // Not there yet — move toward the repair factory
      const dx = repairBuilding.position.x - unit.position.x;
      const dy = repairBuilding.position.y - unit.position.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = unit.speed * GAME_CONFIG.TILE_SIZE * deltaTime;
      const ratio = Math.min(1, moveSpeed / d);
      unit.position.x += dx * ratio;
      unit.position.y += dy * ratio;
      unit.direction = Math.atan2(dy, dx);
      return;
    }

    // Unit is at the repair building — repair it
    if (unit.health < unit.maxHealth) {
      const repairRate = unit.maxHealth * 0.1; // 10% per second
      const repairThisFrame = deltaTime * repairRate;
      const costThisFrame = repairThisFrame * 0.5; // Cost per HP

      if (player.money >= costThisFrame) {
        unit.health = Math.min(unit.maxHealth, unit.health + repairThisFrame);
        player.money -= costThisFrame;
      } else {
        unit.isRepairingAtFactory = false; // Can't afford
      }

      if (unit.health >= unit.maxHealth) {
        unit.health = unit.maxHealth;
        unit.isRepairingAtFactory = false;
        // Move unit away from factory
        unit.state = UnitState.IDLE;
      }
    } else {
      unit.isRepairingAtFactory = false;
    }
  }
}
