import { Player, Unit, Building, UnitState, BuildingType, Vector2 } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface GarrisonEvent {
  unitId: string;
  buildingId: string;
  playerId: string;
}

export interface UngarrisonEvent {
  unitIds: string[];
  buildingId: string;
  playerId: string;
}

export class GarrisonSystem {
  readonly GARRISON_RANGE = GAME_CONFIG.TILE_SIZE * 2; // 64px = 2 tiles
  readonly GARRISON_ATTACK_RANGE_BONUS = 1.5;
  readonly GARRISON_DAMAGE_REDUCTION = 0.5;
  readonly UNGARRISON_TIME = 1.0; // seconds to un-garrison

  private ungarrisonTimers: Map<string, number> = new Map(); // buildingId -> remaining time

  update(
    player: Player,
    allPlayers: Player[],
    neutralBuildings: Building[],
    deltaTime: number,
    onGarrison: (event: GarrisonEvent) => void,
    onUngarrison: (event: UngarrisonEvent) => void,
  ): void {
    // Collect all garrisonable buildings (player + neutral)
    const garrisonableBuildings = this.collectGarrisonableBuildings(player, allPlayers, neutralBuildings);

    // Process units in GARRISONING state - move them into buildings when in range
    const garrisoningUnits = player.units.filter(u =>
      u.state === UnitState.GARRISONING && !u.garrisonedBuildingId
    );

    for (const unit of garrisoningUnits) {
      const targetBuilding = this.findTargetBuilding(unit, garrisonableBuildings);
      if (!targetBuilding) continue;

      const buildingCenter = this.getBuildingCenter(targetBuilding);
      const distance = getDistance(unit.position, buildingCenter);

      if (distance <= this.GARRISON_RANGE) {
        // Enter the building
        this.enterBuilding(unit, targetBuilding, player);
        onGarrison({
          unitId: unit.id,
          buildingId: targetBuilding.id,
          playerId: player.id,
        });
      }
      // Otherwise the unit keeps moving toward the building (handled by MovementSystem)
    }

    // Process un-garrison timers
    for (const [buildingId, remaining] of this.ungarrisonTimers) {
      const updated = remaining - deltaTime;
      if (updated <= 0) {
        this.ungarrisonTimers.delete(buildingId);
        this.ungarrisonBuilding(buildingId, player, allPlayers, neutralBuildings);
        const building = this.findBuildingById(buildingId, player, allPlayers, neutralBuildings);
        if (building) {
          onUngarrison({
            unitIds: [], // units already ejected by ungarrisonBuilding
            buildingId,
            playerId: player.id,
          });
        }
      } else {
        this.ungarrisonTimers.set(buildingId, updated);
      }
    }

    // Handle garrisoned building combat
    this.processGarrisonedCombat(player, allPlayers, neutralBuildings, deltaTime);
  }

  garrisonUnit(unitId: string, buildingId: string, player: Player): void {
    const unit = player.units.find(u => u.id === unitId);
    if (!unit) return;
    if (!unit.data.canGarrison) return;

    const building = this.findBuildingById(buildingId, player, [], []);
    if (!building || !this.isGarrisonableBuilding(building)) return;

    unit.state = UnitState.GARRISONING;
    unit.target = buildingId;
    unit.waypoints = [this.getBuildingCenter(building)];
  }

  ungarrisonBuilding(
    buildingId: string,
    player: Player,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): void {
    const building = this.findBuildingById(buildingId, player, allPlayers, neutralBuildings);
    if (!building || !building.garrisonedUnits || building.garrisonedUnits.length === 0) return;

    const unitIds = [...building.garrisonedUnits];
    const buildingCenter = this.getBuildingCenter(building);

    for (const unitId of unitIds) {
      const unit = this.findUnitById(unitId, allPlayers);
      if (!unit) continue;

      // Place unit around the building in a valid position
      const ejectPosition = this.findEjectPosition(buildingCenter, building, allPlayers);
      unit.position = ejectPosition;
      unit.garrisonedBuildingId = undefined;
      unit.state = UnitState.IDLE;
      unit.target = null;
    }

    building.garrisonedUnits = [];

    gameEventBus.emit('transport:unload', {
      buildingId,
      unitIds,
    });
  }

  getGarrisonedAttack(building: Building): number {
    if (!building.garrisonedUnits || building.garrisonedUnits.length === 0) return 0;
    // We cannot directly access unit data from just IDs, so return 0 if no way to resolve
    // This method is intended to be called with access to player data
    // The caller should use getGarrisonedAttackForPlayer instead
    return 0;
  }

  getGarrisonedAttackForPlayer(building: Building, player: Player): number {
    if (!building.garrisonedUnits || building.garrisonedUnits.length === 0) return 0;

    let totalAttack = 0;
    for (const unitId of building.garrisonedUnits) {
      const unit = player.units.find(u => u.id === unitId);
      if (unit) {
        totalAttack += unit.attack;
      }
    }

    return totalAttack * this.GARRISON_ATTACK_RANGE_BONUS;
  }

  isGarrisonableBuilding(building: Building): boolean {
    if (building.isGarrisonable === true) return true;
    if (building.type === BuildingType.CIVILIAN_BUILDING || building.type === BuildingType.BATTLE_BUNKER) return true;
    return false;
  }

  getAvailableGarrisonTargets(unit: Unit, player: Player, allPlayers: Player[], neutralBuildings: Building[]): Building[] {
    const targets: Building[] = [];
    const allBuildings = this.collectGarrisonableBuildings(player, allPlayers, neutralBuildings);

    for (const building of allBuildings) {
      if (!this.isGarrisonableBuilding(building)) continue;
      if (!this.hasGarrisonCapacity(building)) continue;

      const distance = getDistance(unit.position, this.getBuildingCenter(building));
      // Only return buildings within a reasonable search range (vision range in tiles)
      const searchRange = unit.vision * GAME_CONFIG.TILE_SIZE;
      if (distance <= searchRange) {
        targets.push(building);
      }
    }

    return targets;
  }

  /** Start a delayed un-garrison (e.g. when player orders evacuate) */
  startUngarrison(buildingId: string): void {
    this.ungarrisonTimers.set(buildingId, this.UNGARRISON_TIME);
  }

  /** Eject all units from a destroyed building immediately */
  ejectOnBuildingDestroyed(
    buildingId: string,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): void {
    // Find the building among all players and neutral
    const building = this.findBuildingInAll(buildingId, allPlayers, neutralBuildings);
    if (!building || !building.garrisonedUnits || building.garrisonedUnits.length === 0) return;

    const buildingCenter = this.getBuildingCenter(building);
    const unitIds = [...building.garrisonedUnits];

    for (const unitId of unitIds) {
      const unit = this.findUnitById(unitId, allPlayers);
      if (!unit) continue;

      const ejectPosition = this.findEjectPosition(buildingCenter, building, allPlayers);
      unit.position = ejectPosition;
      unit.garrisonedBuildingId = undefined;
      unit.state = UnitState.IDLE;
      unit.target = null;
      // Units ejected from destroyed buildings take 50% damage
      unit.health = Math.max(1, unit.health * this.GARRISON_DAMAGE_REDUCTION);
    }

    building.garrisonedUnits = [];
  }

  // --- Private helpers ---

  private enterBuilding(unit: Unit, building: Building, player: Player): void {
    if (!building.garrisonedUnits) {
      building.garrisonedUnits = [];
    }
    building.garrisonedUnits.push(unit.id);
    unit.garrisonedBuildingId = building.id;
    unit.state = UnitState.IDLE; // Unit is now inside, effectively idle
    unit.target = null;
    unit.waypoints = [];
    // Hide unit from map by moving it off-screen (rendering systems check garrisonedBuildingId)
    unit.position = { x: -9999, y: -9999 };

    gameEventBus.emit('transport:load', {
      unitId: unit.id,
      buildingId: building.id,
    });
  }

  private collectGarrisonableBuildings(
    player: Player,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): Building[] {
    const buildings: Building[] = [];

    // Player's own buildings
    for (const b of player.buildings) {
      if (this.isGarrisonableBuilding(b)) {
        buildings.push(b);
      }
    }

    // Neutral buildings
    for (const b of neutralBuildings) {
      if (this.isGarrisonableBuilding(b)) {
        buildings.push(b);
      }
    }

    // Allied player buildings
    for (const otherPlayer of allPlayers) {
      if (otherPlayer.id === player.id) continue;
      if (player.teamId !== undefined && otherPlayer.teamId === player.teamId) {
        for (const b of otherPlayer.buildings) {
          if (this.isGarrisonableBuilding(b)) {
            buildings.push(b);
          }
        }
      }
    }

    return buildings;
  }

  private findTargetBuilding(unit: Unit, buildings: Building[]): Building | null {
    // Unit.target holds the building ID when garrisoning
    if (unit.target) {
      const target = buildings.find(b => b.id === unit.target);
      if (target && this.hasGarrisonCapacity(target)) return target;
    }

    // Fallback: find nearest garrisonable building with capacity
    let nearest: Building | null = null;
    let nearestDist = Infinity;

    for (const building of buildings) {
      if (!this.hasGarrisonCapacity(building)) continue;
      const dist = getDistance(unit.position, this.getBuildingCenter(building));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = building;
      }
    }

    return nearest;
  }

  private hasGarrisonCapacity(building: Building): boolean {
    const maxGarrison = building.maxGarrison ?? building.data.maxGarrison ?? 0;
    const currentCount = building.garrisonedUnits?.length ?? 0;
    return currentCount < maxGarrison;
  }

  private getBuildingCenter(building: Building): Vector2 {
    return {
      x: building.position.x + (building.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2,
      y: building.position.y + (building.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2,
    };
  }

  private findEjectPosition(
    buildingCenter: Vector2,
    building: Building,
    allPlayers: Player[],
  ): Vector2 {
    const offset = (Math.max(building.data.width || 2, building.data.height || 2) + 1) * GAME_CONFIG.TILE_SIZE;
    // Try positions around the building in cardinal directions
    const candidates: Vector2[] = [
      { x: buildingCenter.x + offset, y: buildingCenter.y },
      { x: buildingCenter.x - offset, y: buildingCenter.y },
      { x: buildingCenter.x, y: buildingCenter.y + offset },
      { x: buildingCenter.x, y: buildingCenter.y - offset },
      { x: buildingCenter.x + offset, y: buildingCenter.y + offset },
      { x: buildingCenter.x - offset, y: buildingCenter.y - offset },
      { x: buildingCenter.x + offset, y: buildingCenter.y - offset },
      { x: buildingCenter.x - offset, y: buildingCenter.y + offset },
    ];

    // Return the first candidate; in a full implementation we would check walkability
    return candidates[0];
  }

  private findBuildingById(
    buildingId: string,
    player: Player,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): Building | null {
    const playerBuilding = player.buildings.find(b => b.id === buildingId);
    if (playerBuilding) return playerBuilding;

    const neutralBuilding = neutralBuildings.find(b => b.id === buildingId);
    if (neutralBuilding) return neutralBuilding;

    for (const otherPlayer of allPlayers) {
      const found = otherPlayer.buildings.find(b => b.id === buildingId);
      if (found) return found;
    }

    return null;
  }

  private findBuildingInAll(
    buildingId: string,
    allPlayers: Player[],
    neutralBuildings: Building[],
  ): Building | null {
    const neutralBuilding = neutralBuildings.find(b => b.id === buildingId);
    if (neutralBuilding) return neutralBuilding;

    for (const player of allPlayers) {
      const found = player.buildings.find(b => b.id === buildingId);
      if (found) return found;
    }

    return null;
  }

  private findUnitById(unitId: string, allPlayers: Player[]): Unit | null {
    for (const player of allPlayers) {
      const unit = player.units.find(u => u.id === unitId);
      if (unit) return unit;
    }
    return null;
  }

  private processGarrisonedCombat(
    player: Player,
    allPlayers: Player[],
    neutralBuildings: Building[],
    deltaTime: number,
  ): void {
    // Find buildings owned by this player that have garrisoned units
    const garrisonedBuildings = player.buildings.filter(
      b => b.garrisonedUnits && b.garrisonedUnits.length > 0,
    );

    for (const building of garrisonedBuildings) {
      // Calculate combined attack from garrisoned units
      const attackPower = this.getGarrisonedAttackForPlayer(building, player);
      if (attackPower <= 0) continue;

      const garrisonedRange = this.getGarrisonedAttackRange(building, player);

      // Find enemy units or buildings in range
      const buildingCenter = this.getBuildingCenter(building);
      let closestEnemy: Unit | Building | null = null;
      let closestDist = Infinity;

      for (const otherPlayer of allPlayers) {
        if (otherPlayer.id === player.id) continue;
        if (player.teamId !== undefined && otherPlayer.teamId === player.teamId) continue;

        for (const enemyUnit of otherPlayer.units) {
          if (enemyUnit.garrisonedBuildingId) continue; // skip garrisoned units
          const dist = getDistance(buildingCenter, enemyUnit.position);
          if (dist < closestDist && dist <= garrisonedRange) {
            closestDist = dist;
            closestEnemy = enemyUnit;
          }
        }

        for (const enemyBuilding of otherPlayer.buildings) {
          const dist = getDistance(buildingCenter, this.getBuildingCenter(enemyBuilding));
          if (dist < closestDist && dist <= garrisonedRange) {
            closestDist = dist;
            closestEnemy = enemyBuilding;
          }
        }
      }

      if (closestEnemy) {
        // Fire from garrisoned building
        building.attackTarget = closestEnemy.id;
        building.attackCooldown = (building.attackCooldown ?? 0) - deltaTime;

        if (building.attackCooldown <= 0) {
          // Apply damage
          if ('health' in closestEnemy) {
            closestEnemy.health -= attackPower * deltaTime;
          }
          building.attackCooldown = 1.0; // Reset cooldown

          gameEventBus.emit('combat:hit', {
            attackerId: building.id,
            targetId: closestEnemy.id,
            damage: attackPower * deltaTime,
            isGarrisonedAttack: true,
          });
        }
      } else {
        building.attackTarget = null;
      }
    }
  }

  private getGarrisonedAttackRange(building: Building, player: Player): number {
    if (!building.garrisonedUnits || building.garrisonedUnits.length === 0) return 0;

    let maxRange = 0;
    for (const unitId of building.garrisonedUnits) {
      const unit = player.units.find(u => u.id === unitId);
      if (unit && unit.attackRange > maxRange) {
        maxRange = unit.attackRange;
      }
    }

    return maxRange * this.GARRISON_ATTACK_RANGE_BONUS;
  }
}

export const garrisonSystem = new GarrisonSystem();
