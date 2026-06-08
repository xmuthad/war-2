import { Player, Unit, Building, UnitState, UnitType, UnitStance } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { useGameStore } from '../../store/gameStore';

// Anti-air unit types that should prioritize airborne targets
const ANTI_AIR_TYPES = new Set<UnitType>([
  UnitType.FLAKINFANTRY,
  UnitType.FLAK,
]);

// Units capable of targeting airborne enemies
const CAN_TARGET_AIR_TYPES = new Set<UnitType>([
  UnitType.FLAKINFANTRY,
  UnitType.FLAK,
  UnitType.ROCKET,
]);

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class AutoEngageSystem {
  private readonly AUTO_ENGAGE_RANGE = GAME_CONFIG.TILE_SIZE * 12;
  private readonly PHANTOM_REVEAL_RANGE = GAME_CONFIG.TILE_SIZE * 2;

  update(player: Player, allPlayers: Player[]): void {
    const idleAttackers = player.units.filter(u =>
      u.state === UnitState.IDLE && u.data.attack > 0
    );

    if (idleAttackers.length === 0) return;

    const enemies = this.getEnemyUnitsAndBuildings(player.id, allPlayers);

    // Apply weather/day-night vision modifier to engagement range
    const { weatherVisionModifier, dayNightVisionModifier } = useGameStore.getState();
    const visionModifier = weatherVisionModifier * dayNightVisionModifier;

    for (const unit of idleAttackers) {
      const stance = unit.stance || UnitStance.GUARD;
      const attackRange = (unit.data.attackRange || 4) * GAME_CONFIG.TILE_SIZE;

      // PASSIVE: don't auto-initiate combat at all
      if (stance === UnitStance.PASSIVE) continue;

      // Find nearest enemy, with anti-air priority for AA units
      let nearestEnemy: Unit | Building | null = null;
      let nearestDist = Infinity;
      let nearestAirEnemy: Unit | Building | null = null;
      let nearestAirDist = Infinity;

      const isAntiAir = ANTI_AIR_TYPES.has(unit.type);
      const canTargetAir = CAN_TARGET_AIR_TYPES.has(unit.type);

      for (const enemy of enemies) {
        // Phantom Tank disguise: skip disguised phantoms beyond 2 tiles
        if (this.isDisguisedPhantom(enemy)) {
          const dist = getDistance(unit.position, enemy.position);
          if (dist > this.PHANTOM_REVEAL_RANGE) {
            continue;
          }
        }

        const dist = getDistance(unit.position, enemy.position);

        // AGGRESSIVE: chase enemies within vision range (AUTO_ENGAGE_RANGE)
      // GUARD: only engage enemies within attack range
      if (stance === UnitStance.GUARD) {
        if (dist >= attackRange) continue;
      }

      const effectiveEngageRange = this.AUTO_ENGAGE_RANGE * visionModifier;
      if (dist < effectiveEngageRange && dist < nearestDist) {
          nearestEnemy = enemy;
          nearestDist = dist;
        }

        // Track nearest airborne enemy for AA priority
        if (canTargetAir && 'isAirborne' in enemy && (enemy as Unit).isAirborne) {
          if (dist < effectiveEngageRange && dist < nearestAirDist) {
            if (stance !== UnitStance.GUARD || dist < attackRange) {
              nearestAirEnemy = enemy;
              nearestAirDist = dist;
            }
          }
        }
      }

      // Anti-air units prioritize airborne targets
      if (isAntiAir && nearestAirEnemy) {
        unit.state = UnitState.ATTACKING;
        unit.target = nearestAirEnemy.id;
      } else if (nearestEnemy) {
        unit.state = UnitState.ATTACKING;
        unit.target = nearestEnemy.id;
      }
    }
  }

  private isDisguisedPhantom(entity: Unit | Building): boolean {
    return 'isDisguised' in entity && (entity as Unit).type === UnitType.PHANTOM && !!(entity as Unit).isDisguised;
  }

  private getEnemyUnitsAndBuildings(playerId: string, allPlayers: Player[]): (Unit | Building)[] {
    const player = allPlayers.find(p => p.id === playerId);
    const playerTeamId = player?.teamId;
    const enemies: (Unit | Building)[] = [];
    for (const p of allPlayers) {
      if (p.id === playerId) continue;
      // Skip allies on the same team
      if (playerTeamId !== undefined && p.teamId === playerTeamId) continue;
      for (const u of p.units) enemies.push(u);
      for (const b of p.buildings.filter(b => b.isConstructed)) enemies.push(b);
    }
    return enemies;
  }
}

export const autoEngageSystem = new AutoEngageSystem();