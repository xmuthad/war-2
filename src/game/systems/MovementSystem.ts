import type { Unit } from '../../types';
import { UnitState, UnitType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { mapManager } from '../map/MapManager';
import { useGameStore } from '../../store/gameStore';
import { PathfindingManager } from './PathfindingManager';

function getDirectionFromDelta(dx: number, dy: number): number {
  return Math.atan2(dy, dx);
}

export class MovementSystem {
  private readonly AVOIDANCE_RADIUS = 28;
  private readonly AVOIDANCE_STRENGTH = 0.6;
  private readonly MIN_SEPARATION = 20;
  private readonly TARGET_DISPERSE_RADIUS = 10;
  private readonly FORMATION_SPACING = 30;
  private pathfindingManager: PathfindingManager | null = null;
  private cachedWeatherModifier: number = 1;
  // Stuck detection: track last positions and timestamps
  private stuckCheckPositions: Map<string, { x: number; y: number; time: number }> = new Map();
  private static readonly STUCK_CHECK_INTERVAL = 2; // seconds
  private static readonly STUCK_THRESHOLD = 5; // pixels - if moved less than this, consider stuck

  /** Set the pathfinding manager for A* pathfinding. Call during game initialization. */
  setPathfindingManager(pm: PathfindingManager): void {
    this.pathfindingManager = pm;
  }

  getPathfindingManager(): PathfindingManager | null {
    return this.pathfindingManager;
  }

  /**
   * Request a path from the unit's current position to the target.
   * If pathfinding is available, uses A*; otherwise falls back to direct waypoints.
   */
  requestPath(unit: Unit, targetX: number, targetY: number): void {
    if (!this.pathfindingManager) return;

    const result = this.pathfindingManager.findPath(
      unit.position.x, unit.position.y,
      targetX, targetY,
      1,
      !!unit.isAirborne,
      !!unit.isNaval,
      unit.id
    );

    if (result.success && result.path.length > 1) {
      // Replace waypoints with A* path (skip first node = current position)
      unit.waypoints = result.path.slice(1);
    } else {
      // Fallback: direct move to target
      unit.waypoints = [{ x: targetX, y: targetY }];
    }
  }

  update(unit: Unit, deltaTime: number): void {
    // Skip units inside a transport
    if (unit.transportId) return;

    // Skip CHRONO units that are chrono-shifting or on cooldown
    if (unit.type === UnitType.CHRONO && (unit.isChronoShifting || unit.isChronoCooldown)) return;

    switch (unit.state) {
      case UnitState.MOVING:
        this.updateMoving(unit, deltaTime);
        break;
      case UnitState.PATROLLING:
        this.updatePatrolling(unit, deltaTime);
        break;
    }
  }

  updateAll(units: Unit[], deltaTime: number): void {
    this.cachedWeatherModifier = useGameStore.getState().weatherSpeedModifier;
    for (const unit of units) {
      this.updateWithAvoidance(unit, units, deltaTime);
    }
  }

  updateWithAvoidance(unit: Unit, allUnits: Unit[], deltaTime: number): void {
    if (unit.transportId) return;
    if (unit.type === UnitType.CHRONO && (unit.isChronoShifting || unit.isChronoCooldown)) return;

    // Stuck detection: if unit hasn't moved significantly, clear its path
    if (unit.state === UnitState.MOVING || unit.state === UnitState.ATTACKING) {
      const gameTime = useGameStore.getState().gameTime;
      const lastCheck = this.stuckCheckPositions.get(unit.id);
      if (!lastCheck) {
        this.stuckCheckPositions.set(unit.id, { x: unit.position.x, y: unit.position.y, time: gameTime });
      } else if (gameTime - lastCheck.time >= MovementSystem.STUCK_CHECK_INTERVAL) {
        const dx = unit.position.x - lastCheck.x;
        const dy = unit.position.y - lastCheck.y;
        const moved = Math.sqrt(dx * dx + dy * dy);
        if (moved < MovementSystem.STUCK_THRESHOLD && unit.waypoints.length > 0) {
          // Unit is stuck - clear waypoints and let AI reassign
          unit.waypoints = [];
          if (unit.isAttackMoving) {
            unit.state = UnitState.GUARDING;
            unit.isAttackMoving = false;
          } else if (unit.state === UnitState.MOVING) {
            unit.state = UnitState.IDLE;
          }
        }
        this.stuckCheckPositions.set(unit.id, { x: unit.position.x, y: unit.position.y, time: gameTime });
      }
    }

    switch (unit.state) {
      case UnitState.MOVING:
        this.updateMovingWithAvoidance(unit, allUnits, deltaTime);
        break;
      case UnitState.PATROLLING:
        this.updatePatrollingWithAvoidance(unit, allUnits, deltaTime);
        break;
      case UnitState.ATTACKING:
        // Attackers chasing targets use waypoints set by CombatUpdateSystem
        if (unit.waypoints.length > 0) {
          this.updateMovingWithAvoidance(unit, allUnits, deltaTime);
        }
        break;
      case UnitState.HARVESTING:
      case UnitState.RETURNING:
        // Harvesters use waypoints set by HarvestSystem, move along them
        if (unit.waypoints.length > 0) {
          this.updateMovingWithAvoidance(unit, allUnits, deltaTime);
        }
        break;
    }
  }

  private calculateAvoidanceOffset(unit: Unit, allUnits: Unit[]): { x: number; y: number } {
    let offsetX = 0;
    let offsetY = 0;

    for (const other of allUnits) {
      if (other.id === unit.id) continue;
      if (other.transportId) continue;
      if (other.isAirborne !== unit.isAirborne) continue;
      if (other.isNaval !== unit.isNaval) continue;

      const dx = unit.position.x - other.position.x;
      const dy = unit.position.y - other.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.AVOIDANCE_RADIUS && dist > 0.1) {
        const overlap = this.AVOIDANCE_RADIUS - dist;
        const strength = (overlap / this.AVOIDANCE_RADIUS) * this.AVOIDANCE_STRENGTH;
        offsetX += (dx / dist) * strength;
        offsetY += (dy / dist) * strength;
      }
    }

    return { x: offsetX, y: offsetY };
  }

  private disperseTarget(unit: Unit, allUnits: Unit[]): { x: number; y: number } | null {
    if (unit.waypoints.length === 0) return null;

    const target = unit.waypoints[unit.waypoints.length - 1];
    const sameTargetUnits = allUnits.filter(u =>
      u.id !== unit.id &&
      u.waypoints.length > 0 &&
      Math.abs(u.waypoints[u.waypoints.length - 1].x - target.x) < this.TARGET_DISPERSE_RADIUS &&
      Math.abs(u.waypoints[u.waypoints.length - 1].y - target.y) < this.TARGET_DISPERSE_RADIUS
    );

    if (sameTargetUnits.length === 0) return null;

    const allHeading = [unit, ...sameTargetUnits];
    const index = allHeading.indexOf(unit);
    const angle = (index / allHeading.length) * Math.PI * 2;
    return {
      x: target.x + Math.cos(angle) * this.FORMATION_SPACING,
      y: target.y + Math.sin(angle) * this.FORMATION_SPACING,
    };
  }

  private updateMovingWithAvoidance(unit: Unit, allUnits: Unit[], deltaTime: number): void {
    if (unit.waypoints.length > 0) {
      const target = unit.waypoints[0];
      const dx = target.x - unit.position.x;
      const dy = target.y - unit.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        unit.position = { ...target };
        unit.waypoints.shift();
        if (unit.waypoints.length === 0) {
          // Don't change state for HARVESTING/RETURNING/ATTACKING - managed by other systems
          if (unit.state !== UnitState.HARVESTING && unit.state !== UnitState.RETURNING && unit.state !== UnitState.ATTACKING) {
            if (unit.isAttackMoving) {
              unit.state = UnitState.GUARDING;
              unit.isAttackMoving = false;
            } else {
              unit.state = UnitState.IDLE;
            }
          }
        }
      } else {
        const weatherSpeedModifier = this.cachedWeatherModifier;
        const moveSpeed = unit.speed * GAME_CONFIG.TILE_SIZE * deltaTime * weatherSpeedModifier;
        const movementCost = mapManager.getMovementCostAtPosition(unit.position.x, unit.position.y);
        const costFactor = movementCost > 0 ? 1 / movementCost : 1;
        const adjustedSpeed = moveSpeed * costFactor;
        const ratio = Math.min(1, adjustedSpeed / dist);
        let newX = unit.position.x + dx * ratio;
        let newY = unit.position.y + dy * ratio;

        // Apply avoidance offset
        const avoidance = this.calculateAvoidanceOffset(unit, allUnits);
        newX += avoidance.x;
        newY += avoidance.y;

        // Naval units can only move on water
        if (unit.isNaval && !mapManager.isWaterAtPosition(newX, newY)) {
          if (unit.isAttackMoving) {
            unit.state = UnitState.GUARDING;
            unit.isAttackMoving = false;
          } else {
            unit.state = UnitState.IDLE;
          }
          unit.waypoints = [];
        } else if (!unit.isAirborne && !unit.isNaval && !mapManager.isWalkableAtPosition(newX, newY)) {
          // Non-naval, non-airborne units cannot move on non-walkable tiles (including water)
          if (unit.isAttackMoving) {
            unit.state = UnitState.GUARDING;
            unit.isAttackMoving = false;
          } else {
            unit.state = UnitState.IDLE;
          }
          unit.waypoints = [];
        } else {
          unit.position.x = newX;
          unit.position.y = newY;
          unit.direction = getDirectionFromDelta(dx, dy);
        }
      }
    } else {
      // Apply avoidance even when idle at destination
      const avoidance = this.calculateAvoidanceOffset(unit, allUnits);
      if (Math.abs(avoidance.x) > 0.01 || Math.abs(avoidance.y) > 0.01) {
        const newX = unit.position.x + avoidance.x;
        const newY = unit.position.y + avoidance.y;
        const canMove = unit.isAirborne ||
          (unit.isNaval && mapManager.isWaterAtPosition(newX, newY)) ||
          (!unit.isNaval && mapManager.isWalkableAtPosition(newX, newY));
        if (canMove) {
          unit.position.x = newX;
          unit.position.y = newY;
        }
      }

      if (unit.isAttackMoving) {
        unit.state = UnitState.GUARDING;
        unit.isAttackMoving = false;
      } else {
        unit.state = UnitState.IDLE;
      }
    }
  }

  private updatePatrollingWithAvoidance(unit: Unit, allUnits: Unit[], deltaTime: number): void {
    if (unit.waypoints.length > 0) {
      const target = unit.waypoints[0];
      const dx = target.x - unit.position.x;
      const dy = target.y - unit.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        unit.waypoints.push(unit.waypoints.shift()!);
      } else {
        const weatherSpeedModifier = this.cachedWeatherModifier;
        const moveSpeed = unit.speed * GAME_CONFIG.TILE_SIZE * deltaTime * weatherSpeedModifier;
        const ratio = Math.min(1, moveSpeed / dist);
        let newX = unit.position.x + dx * ratio;
        let newY = unit.position.y + dy * ratio;

        // Apply avoidance offset
        const avoidance = this.calculateAvoidanceOffset(unit, allUnits);
        newX += avoidance.x;
        newY += avoidance.y;

        // Naval units can only move on water
        if (unit.isNaval && !mapManager.isWaterAtPosition(newX, newY)) {
          unit.state = UnitState.IDLE;
          unit.waypoints = [];
        } else if (!unit.isAirborne && !unit.isNaval && !mapManager.isWalkableAtPosition(newX, newY)) {
          unit.state = UnitState.IDLE;
          unit.waypoints = [];
        } else {
          unit.position.x = newX;
          unit.position.y = newY;
          unit.direction = getDirectionFromDelta(dx, dy);
        }
      }
    } else {
      unit.state = UnitState.IDLE;
    }
  }

  private updateMoving(unit: Unit, deltaTime: number): void {
    if (unit.waypoints.length > 0) {
      const target = unit.waypoints[0];
      const dx = target.x - unit.position.x;
      const dy = target.y - unit.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        unit.position = { ...target };
        unit.waypoints.shift();
        if (unit.waypoints.length === 0) {
          if (unit.isAttackMoving) {
            unit.state = UnitState.GUARDING;
            unit.isAttackMoving = false;
          } else {
            unit.state = UnitState.IDLE;
          }
        }
      } else {
        const weatherSpeedModifier = this.cachedWeatherModifier;
        const moveSpeed = unit.speed * GAME_CONFIG.TILE_SIZE * deltaTime * weatherSpeedModifier;
        const movementCost = mapManager.getMovementCostAtPosition(unit.position.x, unit.position.y);
        const costFactor = movementCost > 0 ? 1 / movementCost : 1;
        const adjustedSpeed = moveSpeed * costFactor;
        const ratio = Math.min(1, adjustedSpeed / dist);
        const newX = unit.position.x + dx * ratio;
        const newY = unit.position.y + dy * ratio;

        // Naval units can only move on water
        if (unit.isNaval && !mapManager.isWaterAtPosition(newX, newY)) {
          if (unit.isAttackMoving) {
            unit.state = UnitState.GUARDING;
            unit.isAttackMoving = false;
          } else {
            unit.state = UnitState.IDLE;
          }
          unit.waypoints = [];
        } else if (!unit.isAirborne && !unit.isNaval && !mapManager.isWalkableAtPosition(newX, newY)) {
          // Non-naval, non-airborne units cannot move on non-walkable tiles (including water)
          if (unit.isAttackMoving) {
            unit.state = UnitState.GUARDING;
            unit.isAttackMoving = false;
          } else {
            unit.state = UnitState.IDLE;
          }
          unit.waypoints = [];
        } else {
          unit.position.x = newX;
          unit.position.y = newY;
          unit.direction = getDirectionFromDelta(dx, dy);
        }
      }
    } else {
      if (unit.isAttackMoving) {
        unit.state = UnitState.GUARDING;
        unit.isAttackMoving = false;
      } else {
        unit.state = UnitState.IDLE;
      }
    }
  }

  private updatePatrolling(unit: Unit, deltaTime: number): void {
    if (unit.waypoints.length > 0) {
      const target = unit.waypoints[0];
      const dx = target.x - unit.position.x;
      const dy = target.y - unit.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        unit.waypoints.push(unit.waypoints.shift()!);
      } else {
        const weatherSpeedModifier = this.cachedWeatherModifier;
        const moveSpeed = unit.speed * GAME_CONFIG.TILE_SIZE * deltaTime * weatherSpeedModifier;
        const ratio = Math.min(1, moveSpeed / dist);
        const newX = unit.position.x + dx * ratio;
        const newY = unit.position.y + dy * ratio;

        // Naval units can only move on water
        if (unit.isNaval && !mapManager.isWaterAtPosition(newX, newY)) {
          unit.state = UnitState.IDLE;
          unit.waypoints = [];
        } else if (!unit.isAirborne && !unit.isNaval && !mapManager.isWalkableAtPosition(newX, newY)) {
          unit.state = UnitState.IDLE;
          unit.waypoints = [];
        } else {
          unit.position.x = newX;
          unit.position.y = newY;
          unit.direction = getDirectionFromDelta(dx, dy);
        }
      }
    } else {
      unit.state = UnitState.IDLE;
    }
  }

  removeUnit(unitId: string): void {
    this.stuckCheckPositions.delete(unitId);
  }

  reset(): void {
    this.stuckCheckPositions.clear();
    this.cachedWeatherModifier = 1;
  }
}
