import type { Unit, Player, Vector2, Faction, Building } from '../../types';
import { UnitState, TileType, UnitRank, UnitType, UpgradeType, BuildingType, getFactionGroup } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { combatSystem, TerroristExplosion, DamageType, ArmorType, ProjectileType, SplashConfig, Projectile, ANTI_AIR_BUILDING_TYPES, INFANTRY_UNIT_TYPES } from './CombatSystem';
import { ivanBombSystem } from './IvanBombSystem';
import { mapManager } from '../map/MapManager';
import { useGameStore } from '../../store/gameStore';
import { gameEventBus } from './GameEventBus';
import { terrainHeightSystem } from './TerrainHeightSystem';
import { garrisonSystem } from './GarrisonSystem';

// Buildings that can target airborne units
const ANTI_AIR_BUILDINGS = new Set<BuildingType>([
  BuildingType.TESLA_COIL,
  BuildingType.TURRET,
  BuildingType.DEFENSE,
  BuildingType.PATRIOT,
  BuildingType.FLAK_CANNON,
  BuildingType.SENTRY_GUN,
]);

// Buildings that are dedicated anti-air (ONLY target airborne units)
const DEDICATED_AA_BUILDINGS = new Set<BuildingType>([
  BuildingType.PATRIOT,
  BuildingType.FLAK_CANNON,
]);

// Units that can target airborne enemies
const CAN_TARGET_AIR_TYPES = new Set<UnitType>([
  UnitType.FLAKINFANTRY,
  UnitType.FLAK,
  UnitType.ROCKET,
  UnitType.DESTROYER,
  UnitType.AEGIS,
]);

function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getDirectionFromDelta(dx: number, dy: number): number {
  return Math.atan2(dy, dx);
}

function isEnemy(attackerFaction: Faction, attackerTeamId: number | undefined, targetFaction: Faction, targetTeamId: number | undefined): boolean {
  if (attackerTeamId !== undefined && targetTeamId !== undefined && attackerTeamId === targetTeamId) {
    return false;
  }
  // If teamIds are not set, use faction alliance: same faction group = allies
  if (attackerTeamId === undefined || targetTeamId === undefined) {
    const attackerGroup = getFactionGroup(attackerFaction);
    const targetGroup = getFactionGroup(targetFaction);
    if (attackerGroup === targetGroup) return false;
  }
  return true;
}

export class CombatUpdateSystem {
  private gameTime: number = 0;
  private pendingDamage: Array<{
    projectileId: string;
    targetId: string;
    damage: number;
    damageType: DamageType;
    sourceId: string;
    sourceFaction: Faction;
    sourceTeamId: number | undefined;
    splashConfig: SplashConfig | null;
  }> = [];

  reset(): void {
    this.gameTime = 0;
    this.pendingDamage = [];
  }

  /** Call once per frame to update global combat state (game time, projectiles). */
  updateFrame(deltaTime: number, allPlayers: Player[], destroyUnit: (unitId: string) => void, destroyBuilding: (buildingId: string) => void): void {
    this.gameTime += deltaTime;
    this.processFinishedProjectiles(allPlayers, deltaTime, destroyUnit, destroyBuilding);
  }

  update(unit: Unit, player: Player, allPlayers: Player[], deltaTime: number, destroyUnit: (unitId: string) => void, destroyBuilding: (buildingId: string) => void): void {
    // Skip units inside a transport
    if (unit.transportId) return;

    // Elite units slowly self-heal
    if (unit.rank === UnitRank.ELITE && unit.health < unit.maxHealth) {
      unit.health = Math.min(unit.maxHealth, unit.health + unit.maxHealth * GAME_CONFIG.ELITE_HEAL_RATE * deltaTime);
    }

    switch (unit.state) {
      case UnitState.ATTACKING:
        this.updateAttacking(unit, player, allPlayers, deltaTime, destroyUnit, destroyBuilding);
        break;
      case UnitState.GUARDING:
        this.updateGuarding(unit, player, allPlayers);
        break;
    }
  }

  private processFinishedProjectiles(allPlayers: Player[], deltaTime: number, destroyUnit: (unitId: string) => void, destroyBuilding: (buildingId: string) => void): void {
    const finishedProjectiles = combatSystem.updateProjectiles(deltaTime);

    for (const proj of finishedProjectiles) {
      // Find the matching pending damage entry
      const pendingIdx = this.pendingDamage.findIndex(p => p.projectileId === proj.id);
      if (pendingIdx === -1) continue;

      const pending = this.pendingDamage[pendingIdx];
      this.pendingDamage.splice(pendingIdx, 1);

      // Apply splash damage if applicable
      if (pending.splashConfig) {
        combatSystem.applySplashDamage(
          proj.target,
          pending.sourceFaction,
          pending.sourceTeamId,
          pending.damage,
          pending.damageType,
          pending.splashConfig,
          allPlayers,
          destroyUnit,
          destroyBuilding
        );
      }

      // Apply direct damage to the primary target
      this.applyProjectileDamage(proj, pending, allPlayers, destroyUnit, destroyBuilding);
    }
  }

  private applyProjectileDamage(
    proj: Projectile,
    pending: typeof this.pendingDamage[number],
    allPlayers: Player[],
    destroyUnit: (unitId: string) => void,
    destroyBuilding: (buildingId: string) => void
  ): void {
    // Find the target unit or building across all players
    for (const player of allPlayers) {
      const targetUnit = player.units.find(u => u.id === proj.targetId);
      if (targetUnit) {
        if (targetUnit.isInvulnerable) return;

        const armorType = combatSystem.getArmorTypeForUnit(targetUnit.type);
        const actualDamage = combatSystem.calculateDamage(pending.damage, pending.damageType, armorType, targetUnit.armor);

        targetUnit.health -= actualDamage;
        gameEventBus.emit('combat:hit', { attackerId: pending.sourceId, targetId: targetUnit.id, damage: actualDamage, position: targetUnit.position });

        if (targetUnit.health <= 0) {
          // Find the source player for kill rewards
          const sourcePlayer = allPlayers.find(p => p.units.some(u => u.id === pending.sourceId));
          if (sourcePlayer) {
            const attacker = sourcePlayer.units.find(u => u.id === pending.sourceId);
            if (attacker) {
              attacker.kills++;
              sourcePlayer.statistics.enemiesDestroyed++;
              promoteUnit(attacker);
            }
            const reward = Math.floor(targetUnit.cost * 0.2);
            if (reward > 0) {
              sourcePlayer.money += reward;
            }
          }
          gameEventBus.emit('combat:explosion', { position: targetUnit.position, unitType: targetUnit.type });
          destroyUnit(targetUnit.id);
        }
        return;
      }

      const targetBuilding = player.buildings.find(b => b.id === proj.targetId);
      if (targetBuilding) {
        const actualDamage = combatSystem.calculateDamage(pending.damage, pending.damageType, ArmorType.STRUCTURE, 0);

        targetBuilding.health -= actualDamage;
        gameEventBus.emit('combat:hit', { attackerId: pending.sourceId, targetId: targetBuilding.id, damage: actualDamage, position: targetBuilding.position });

        if (targetBuilding.health <= 0) {
          const sourcePlayer = allPlayers.find(p => p.units.some(u => u.id === pending.sourceId));
          if (sourcePlayer) {
            const attacker = sourcePlayer.units.find(u => u.id === pending.sourceId);
            if (attacker) {
              attacker.kills++;
              sourcePlayer.statistics.enemiesDestroyed++;
              promoteUnit(attacker);
            }
            const reward = Math.floor(targetBuilding.cost * 0.2);
            if (reward > 0) {
              sourcePlayer.money += reward;
            }
          }
          const tilePos = mapManager.worldToTile(targetBuilding.position.x, targetBuilding.position.y);
          for (let dy = 0; dy < targetBuilding.height; dy++) {
            for (let dx = 0; dx < targetBuilding.width; dx++) {
              mapManager.setTile(tilePos.x + dx, tilePos.y + dy, TileType.RUBBLE);
            }
          }
          gameEventBus.emit('combat:explosion', { position: targetBuilding.position, buildingType: targetBuilding.type });
          destroyBuilding(targetBuilding.id);
        }
        return;
      }
    }
  }

  private updateAttacking(unit: Unit, player: Player, allPlayers: Player[], deltaTime: number, destroyUnit: (unitId: string) => void, destroyBuilding: (buildingId: string) => void): void {
    // Chrono-frozen units cannot attack
    if ((unit.chronoFreezeProgress || 0) > 0) return;

    const enemyPlayers = allPlayers.filter(p =>
      isEnemy(unit.faction, player.teamId, p.faction, p.teamId)
    );
    const allEnemyUnits = enemyPlayers.flatMap(p => p.units);
    const allEnemyBuildings = enemyPlayers.flatMap(p => p.buildings);

    const targetUnit = allEnemyUnits.find(u => u.id === unit.target);
    const targetBuilding = allEnemyBuildings.find(b => b.id === unit.target);
    const targetPos = targetUnit?.position || targetBuilding?.position;

    if (!targetPos || (!targetUnit && !targetBuilding)) {
      unit.state = UnitState.IDLE;
      unit.target = null;
      return;
    }

    // Ground units cannot attack airborne targets unless they have AA capability
    if (targetUnit && targetUnit.isAirborne && !CAN_TARGET_AIR_TYPES.has(unit.type)) {
      unit.state = UnitState.IDLE;
      unit.target = null;
      return;
    }

    // Cannot attack submerged submarines (except DOLPHIN units)
    if (targetUnit && targetUnit.isSubmerged && unit.type !== UnitType.DOLPHIN) {
      unit.state = UnitState.IDLE;
      unit.target = null;
      return;
    }

    // Cannot attack disguised spies (they appear as friendly)
    if (targetUnit && targetUnit.type === UnitType.SPY && targetUnit.isDisguised) {
      unit.state = UnitState.IDLE;
      unit.target = null;
      return;
    }

    // Aircraft ammo check: return to base if out of ammo
    if (unit.isAirborne && unit.data.maxAmmo !== undefined && (unit.ammo ?? 0) <= 0) {
      this.sendAircraftToRearm(unit, player);
      return;
    }

    const attackDist = distance(unit.position, targetPos);
    const map = useGameStore.getState().map;
    // Apply terrain height range bonus
    const heightRangeBonus = map ? terrainHeightSystem.getAttackRangeBonus(unit, map) : 0;
    const effectiveRange = (unit.attackRange + heightRangeBonus) * GAME_CONFIG.TILE_SIZE;

    if (attackDist > effectiveRange) {
      // Use waypoints for pathfinding-aware chase instead of direct movement
      if (unit.waypoints.length === 0 || unit.waypoints[unit.waypoints.length - 1].x !== targetPos.x || unit.waypoints[unit.waypoints.length - 1].y !== targetPos.y) {
        unit.waypoints = [{ ...targetPos }];
      }
    } else {
      unit.direction = getDirectionFromDelta(
        targetPos.x - unit.position.x,
        targetPos.y - unit.position.y
      );

      const cooldown = 1 / unit.attackSpeed;
      const currentCooldown = combatSystem.getAttackCooldown(unit.id);
      if (currentCooldown <= 0) {
        const damageType = combatSystem.getDamageTypeForUnitType(unit.type);

        // Consume ammo for aircraft
        if (unit.isAirborne && unit.data.maxAmmo !== undefined) {
          if ((unit.ammo ?? 0) <= 0) {
            this.sendAircraftToRearm(unit, player);
            return;
          }
          unit.ammo = (unit.ammo ?? 0) - 1;
        }

        // --- Terrorist self-destruct ---
        if (unit.type === UnitType.TERRORIST) {
          const explosion = combatSystem.handleTerroristAttack(unit);
          if (explosion) {
            gameEventBus.emit('sound:play', { key: 'terroristSuicide', position: unit.position });
            explosion.teamId = player.teamId;
            // Deal 400 direct damage to primary target
            if (targetUnit) {
              if (!targetUnit.isInvulnerable) {
                const armorType = combatSystem.getArmorTypeForUnit(targetUnit.type);
                const directDamage = combatSystem.calculateDamage(400, DamageType.EXPLOSIVE, armorType, targetUnit.armor);
                targetUnit.health -= directDamage;
                gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: targetUnit.id, damage: directDamage, position: targetUnit.position });
                if (targetUnit.health <= 0) {
                  unit.kills++;
                  player.statistics.enemiesDestroyed++;
                  promoteUnit(unit);
                  gameEventBus.emit('combat:explosion', { position: targetUnit.position, unitType: targetUnit.type });
                  const reward = Math.floor(targetUnit.cost * 0.2);
                  if (reward > 0) player.money += reward;
                  destroyUnit(targetUnit.id);
                }
              }
            } else if (targetBuilding) {
              const directDamage = combatSystem.calculateDamage(400, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
              targetBuilding.health -= directDamage;
              gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: targetBuilding.id, damage: directDamage, position: targetBuilding.position });
              if (targetBuilding.health <= 0) {
                unit.kills++;
                player.statistics.enemiesDestroyed++;
                promoteUnit(unit);
                gameEventBus.emit('combat:explosion', { position: targetBuilding.position, buildingType: targetBuilding.type });
                const reward = Math.floor(targetBuilding.cost * 0.2);
                if (reward > 0) player.money += reward;
                const tilePos = mapManager.worldToTile(targetBuilding.position.x, targetBuilding.position.y);
                for (let dy = 0; dy < targetBuilding.height; dy++) {
                  for (let dx = 0; dx < targetBuilding.width; dx++) {
                    mapManager.setTile(tilePos.x + dx, tilePos.y + dy, TileType.RUBBLE);
                  }
                }
                destroyBuilding(targetBuilding.id);
              }
            }
            // Apply 200 splash damage within 2 tile radius
            this.applyTerroristExplosion(explosion, allPlayers, destroyUnit, destroyBuilding);
          }
          // Mark as already exploded to prevent double explosion in destroyUnit
          (unit as unknown as Record<string, unknown>)._terroristExploded = true;
          gameEventBus.emit('unit:destroyed', { unitId: unit.id, position: unit.position, unitType: unit.type });
          destroyUnit(unit.id);
          return;
        }

        // --- Ivan bomb placement ---
        if (unit.type === UnitType.IVAN && (targetUnit || targetBuilding)) {
          const target = targetUnit ?? targetBuilding;
          if (target) {
            ivanBombSystem.placeBomb(unit, target);
            gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: target.id, damage: 0, position: target.position });
          }
          // Ivan does not deal normal attack damage, just places bomb
          combatSystem.setAttackCooldown(unit.id, cooldown);
          return;
        }

        // --- Phantom Tank: reveal when attacking ---
        if (unit.type === UnitType.PHANTOM && unit.isDisguised) {
          unit.isDisguised = false;
        }

        // Calculate hit count (Apocalypse double hit)
        const hitCount = combatSystem.getAttackHitCount(unit);
        const projectileType = combatSystem.getProjectileType(unit.type);
        const usesProjectile = projectileType === ProjectileType.SHELL || projectileType === ProjectileType.MISSILE;
        const splashConfig = combatSystem.getSplashConfig(unit.type);

        for (let hit = 0; hit < hitCount; hit++) {
          // Re-find target for subsequent hits (might have been destroyed)
          const currentTargetUnit = allEnemyUnits.find(u => u.id === unit.target);
          const currentTargetBuilding = allEnemyBuildings.find(b => b.id === unit.target);

          if (currentTargetUnit) {
            // Iron Curtain: invulnerable units take no damage
            if (currentTargetUnit.isInvulnerable) {
              combatSystem.setAttackCooldown(unit.id, cooldown);
              break;
            }

            const armorType = combatSystem.getArmorTypeForUnit(currentTargetUnit.type);
            const rankMultiplier = getRankDamageMultiplier(unit.rank);
            let baseDamage = unit.attack * rankMultiplier;

            // Terrain height attack bonus
            if (map && targetUnit) {
              const heightBonus = terrainHeightSystem.getAttackBonus(unit, currentTargetUnit, map);
              baseDamage = Math.floor(baseDamage * heightBonus);
            }

            // Tanya C4: 10x damage vs buildings, 5x vs vehicles
            baseDamage = combatSystem.calculateSpecialDamage(unit, currentTargetUnit, baseDamage);

            // AEGIS cruiser: 2x damage against airborne units
            if (unit.type === UnitType.AEGIS && currentTargetUnit.isAirborne) {
              baseDamage *= 2;
            }

            // --- Attack Dog: instant kill infantry ---
            if (unit.type === UnitType.ATTACK_DOG && INFANTRY_UNIT_TYPES.has(currentTargetUnit.type)) {
              currentTargetUnit.health = 0;
              gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetUnit.id, damage: currentTargetUnit.maxHealth, position: currentTargetUnit.position });
              gameEventBus.emit('sound:play', { key: 'dogInstantKill', position: currentTargetUnit.position });
              unit.kills++;
              player.statistics.enemiesDestroyed++;
              promoteUnit(unit);
              gameEventBus.emit('combat:explosion', { position: currentTargetUnit.position, unitType: currentTargetUnit.type });
              const reward = Math.floor(currentTargetUnit.cost * 0.2);
              if (reward > 0) player.money += reward;
              destroyUnit(currentTargetUnit.id);
              unit.state = UnitState.IDLE;
              unit.target = null;
              combatSystem.setAttackCooldown(unit.id, cooldown);
              break;
            }

            // --- Sniper: instant kill infantry ---
            if (unit.type === UnitType.SNIPER && INFANTRY_UNIT_TYPES.has(currentTargetUnit.type)) {
              currentTargetUnit.health = 0;
              gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetUnit.id, damage: currentTargetUnit.maxHealth, position: currentTargetUnit.position });
              gameEventBus.emit('sound:play', { key: 'sniperShot', position: currentTargetUnit.position });
              unit.kills++;
              player.statistics.enemiesDestroyed++;
              promoteUnit(unit);
              gameEventBus.emit('combat:explosion', { position: currentTargetUnit.position, unitType: currentTargetUnit.type });
              const reward = Math.floor(currentTargetUnit.cost * 0.2);
              if (reward > 0) player.money += reward;
              destroyUnit(currentTargetUnit.id);
              unit.state = UnitState.IDLE;
              unit.target = null;
              combatSystem.setAttackCooldown(unit.id, cooldown);
              break;
            }

            // --- Chrono Legionnaire: freeze attack (no normal damage) ---
            if (unit.type === UnitType.CHRONO) {
              currentTargetUnit.chronoFreezeProgress = (currentTargetUnit.chronoFreezeProgress || 0) + deltaTime / 5;
              if (currentTargetUnit.chronoFreezeProgress >= 1.0) {
                // Fully erased from time - destroy the target
                currentTargetUnit.health = 0;
                gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetUnit.id, damage: currentTargetUnit.maxHealth, position: currentTargetUnit.position });
                unit.kills++;
                player.statistics.enemiesDestroyed++;
                promoteUnit(unit);
                gameEventBus.emit('combat:explosion', { position: currentTargetUnit.position, unitType: currentTargetUnit.type });
                const reward = Math.floor(currentTargetUnit.cost * 0.2);
                if (reward > 0) player.money += reward;
                destroyUnit(currentTargetUnit.id);
                unit.state = UnitState.IDLE;
                unit.target = null;
              } else {
                gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetUnit.id, damage: 0, position: currentTargetUnit.position });
              }
              combatSystem.setAttackCooldown(unit.id, cooldown);
              break;
            }

            // --- Dolphin: 1.5x damage vs naval, force submarines to surface ---
            if (unit.type === UnitType.DOLPHIN) {
              if (currentTargetUnit.isNaval) {
                baseDamage = Math.floor(baseDamage * 1.5);
              }
              if (currentTargetUnit.isSubmerged) {
                currentTargetUnit.isSubmerged = false;
              }
            }

            // --- Squid: grapple naval targets ---
            if (unit.type === UnitType.SQUID && currentTargetUnit.isNaval) {
              if (!currentTargetUnit._grappledBySquid) {
                currentTargetUnit._grappledBySquid = unit.id;
                currentTargetUnit._grappleUntil = this.gameTime + 5; // 5 seconds grapple
              }
            }

            // Prism Tank focus attack
            if (unit.type === UnitType.PRISM) {
              const prismMultiplier = combatSystem.trackPrismAttack(currentTargetUnit.id, unit.id, this.gameTime);
              baseDamage = Math.floor(baseDamage * prismMultiplier);
            }

            if (usesProjectile) {
              // Create projectile for SHELL/MISSILE types - damage applied on impact
              const proj = combatSystem.createProjectile(unit, currentTargetUnit.position, currentTargetUnit.id, baseDamage, damageType);
              this.pendingDamage.push({
                projectileId: proj.id,
                targetId: currentTargetUnit.id,
                damage: baseDamage,
                damageType,
                sourceId: unit.id,
                sourceFaction: unit.faction,
                sourceTeamId: player.teamId,
                splashConfig,
              });
              gameEventBus.emit('combat:projectile', { projectileId: proj.id, type: proj.type, position: proj.position, target: proj.target, sourceId: unit.id, targetId: currentTargetUnit.id });
            } else {
              // BULLET/BEAM: instant damage (existing behavior)
              const finalDamage = combatSystem.calculateDamage(baseDamage, damageType, armorType, currentTargetUnit.armor);
              currentTargetUnit.health -= finalDamage;
              gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetUnit.id, damage: finalDamage, position: currentTargetUnit.position });
              if (currentTargetUnit.health <= 0) {
                unit.kills++;
                player.statistics.enemiesDestroyed++;
                promoteUnit(unit);
                gameEventBus.emit('combat:explosion', { position: currentTargetUnit.position, unitType: currentTargetUnit.type });
                // Kill reward: give 20% of the killed unit's cost to the killer's player
                const reward = Math.floor(currentTargetUnit.cost * 0.2);
                if (reward > 0) {
                  player.money += reward;
                }
                destroyUnit(currentTargetUnit.id);
                unit.state = UnitState.IDLE;
                unit.target = null;
                break;
              }
            }
          } else if (currentTargetBuilding) {
            const armorType = combatSystem.getArmorTypeForBuilding();
            const rankMultiplier2 = getRankDamageMultiplier(unit.rank);
            let baseDamage = unit.attack * rankMultiplier2;

            // Terrain height attack bonus (use building position as target)
            if (map) {
              const attackerElevation = terrainHeightSystem.getElevationAt(
                Math.floor(unit.position.x / GAME_CONFIG.TILE_SIZE),
                Math.floor(unit.position.y / GAME_CONFIG.TILE_SIZE),
                map,
              );
              const targetElevation = terrainHeightSystem.getElevationAt(
                Math.floor(currentTargetBuilding.position.x / GAME_CONFIG.TILE_SIZE),
                Math.floor(currentTargetBuilding.position.y / GAME_CONFIG.TILE_SIZE),
                map,
              );
              const diff = attackerElevation - targetElevation;
              if (diff > 0) {
                baseDamage = Math.floor(baseDamage * (1 + diff * terrainHeightSystem.HEIGHT_ATTACK_BONUS));
              }
            }

            // Tanya C4: 10x damage vs buildings
            baseDamage = combatSystem.calculateSpecialDamage(unit, currentTargetBuilding, baseDamage);

            // --- Tanya/SEAL C4: instant 2000 damage to buildings ---
            if (unit.type === UnitType.TANYA || unit.type === UnitType.SEAL) {
              const c4Damage = 2000;
              const finalC4Damage = combatSystem.calculateDamage(c4Damage, damageType, armorType, 0);
              currentTargetBuilding.health -= finalC4Damage;
              gameEventBus.emit('sound:play', { key: 'c4Plant', position: currentTargetBuilding.position });
              gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetBuilding.id, damage: finalC4Damage, position: currentTargetBuilding.position });
              if (currentTargetBuilding.health <= 0) {
                unit.kills++;
                player.statistics.enemiesDestroyed++;
                promoteUnit(unit);
                gameEventBus.emit('combat:explosion', { position: currentTargetBuilding.position, buildingType: currentTargetBuilding.type });
                const reward = Math.floor(currentTargetBuilding.cost * 0.2);
                if (reward > 0) player.money += reward;
                const tilePos = mapManager.worldToTile(currentTargetBuilding.position.x, currentTargetBuilding.position.y);
                for (let dy = 0; dy < currentTargetBuilding.height; dy++) {
                  for (let dx = 0; dx < currentTargetBuilding.width; dx++) {
                    mapManager.setTile(tilePos.x + dx, tilePos.y + dy, TileType.RUBBLE);
                  }
                }
                destroyBuilding(currentTargetBuilding.id);
                unit.state = UnitState.IDLE;
                unit.target = null;
              }
              combatSystem.setAttackCooldown(unit.id, cooldown);
              break;
            }

            // --- Chrono Legionnaire: freeze attack on buildings ---
            if (unit.type === UnitType.CHRONO) {
              currentTargetBuilding.chronoFreezeProgress = (currentTargetBuilding.chronoFreezeProgress || 0) + deltaTime / 5;
              if (currentTargetBuilding.chronoFreezeProgress >= 1.0) {
                currentTargetBuilding.health = 0;
                gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetBuilding.id, damage: currentTargetBuilding.maxHealth, position: currentTargetBuilding.position });
                unit.kills++;
                player.statistics.enemiesDestroyed++;
                promoteUnit(unit);
                gameEventBus.emit('combat:explosion', { position: currentTargetBuilding.position, buildingType: currentTargetBuilding.type });
                const reward = Math.floor(currentTargetBuilding.cost * 0.2);
                if (reward > 0) player.money += reward;
                const tilePos = mapManager.worldToTile(currentTargetBuilding.position.x, currentTargetBuilding.position.y);
                for (let dy = 0; dy < currentTargetBuilding.height; dy++) {
                  for (let dx = 0; dx < currentTargetBuilding.width; dx++) {
                    mapManager.setTile(tilePos.x + dx, tilePos.y + dy, TileType.RUBBLE);
                  }
                }
                destroyBuilding(currentTargetBuilding.id);
                unit.state = UnitState.IDLE;
                unit.target = null;
              } else {
                gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetBuilding.id, damage: 0, position: currentTargetBuilding.position });
              }
              combatSystem.setAttackCooldown(unit.id, cooldown);
              break;
            }

            // Prism Tank focus attack
            if (unit.type === UnitType.PRISM) {
              const prismMultiplier = combatSystem.trackPrismAttack(currentTargetBuilding.id, unit.id, this.gameTime);
              baseDamage = Math.floor(baseDamage * prismMultiplier);
            }

            if (usesProjectile) {
              // Create projectile for SHELL/MISSILE types - damage applied on impact
              const proj = combatSystem.createProjectile(unit, currentTargetBuilding.position, currentTargetBuilding.id, baseDamage, damageType);
              this.pendingDamage.push({
                projectileId: proj.id,
                targetId: currentTargetBuilding.id,
                damage: baseDamage,
                damageType,
                sourceId: unit.id,
                sourceFaction: unit.faction,
                sourceTeamId: player.teamId,
                splashConfig,
              });
              gameEventBus.emit('combat:projectile', { projectileId: proj.id, type: proj.type, position: proj.position, target: proj.target, sourceId: unit.id, targetId: currentTargetBuilding.id });
            } else {
              // BULLET/BEAM: instant damage (existing behavior)
              const finalDamage = combatSystem.calculateDamage(baseDamage, damageType, armorType, 0);

              currentTargetBuilding.health -= finalDamage;

              // EMP Tech: Tesla units disable enemy buildings for 10 seconds
              if (unit.type === UnitType.TESLA && player.researchedUpgrades.includes(UpgradeType.EMP_TECH)) {
                currentTargetBuilding.empDisabledUntil = useGameStore.getState().gameTime + 10;
                gameEventBus.emit('combat:emp', { attackerId: unit.id, targetId: currentTargetBuilding.id, position: currentTargetBuilding.position, attackerPosition: unit.position });
              }

              gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: currentTargetBuilding.id, damage: finalDamage, position: currentTargetBuilding.position });
              if (currentTargetBuilding.health <= 0) {
                unit.kills++;
                player.statistics.enemiesDestroyed++;
                promoteUnit(unit);
                gameEventBus.emit('combat:explosion', { position: currentTargetBuilding.position, buildingType: currentTargetBuilding.type });
                // Kill reward: give 20% of the killed building's cost to the killer's player
                const reward = Math.floor(currentTargetBuilding.cost * 0.2);
                if (reward > 0) {
                  player.money += reward;
                }
                const tilePos = mapManager.worldToTile(currentTargetBuilding.position.x, currentTargetBuilding.position.y);
                for (let dy = 0; dy < currentTargetBuilding.height; dy++) {
                  for (let dx = 0; dx < currentTargetBuilding.width; dx++) {
                    mapManager.setTile(tilePos.x + dx, tilePos.y + dy, TileType.RUBBLE);
                  }
                }
                destroyBuilding(currentTargetBuilding.id);
                unit.state = UnitState.IDLE;
                unit.target = null;
                break;
              }
            }
          } else {
            // Target no longer exists
            unit.state = UnitState.IDLE;
            unit.target = null;
            break;
          }
        }

        combatSystem.setAttackCooldown(unit.id, cooldown);
      } else {
        combatSystem.setAttackCooldown(unit.id, currentCooldown - deltaTime);
      }
    }
  }

  private applyTerroristExplosion(explosion: TerroristExplosion, allPlayers: Player[], destroyUnit: (unitId: string) => void, destroyBuilding: (buildingId: string) => void): void {
    const radiusPixels = explosion.radius * GAME_CONFIG.TILE_SIZE;
    // Find the terrorist's owner for kill rewards
    const terroristOwner = allPlayers.find(p => p.faction === explosion.faction);

    for (const player of allPlayers) {
      // Skip allies (use teamId-based check, not faction)
      if (!isEnemy(explosion.faction, explosion.teamId, player.faction, player.teamId)) continue;

      // Damage units in radius
      for (const unit of [...player.units]) {
        const dist = distance(unit.position, explosion.position);
        if (dist <= radiusPixels) {
          const armorType = combatSystem.getArmorTypeForUnit(unit.type);
          const actualDamage = combatSystem.calculateDamage(explosion.damage, DamageType.EXPLOSIVE, armorType, unit.armor);
          unit.health -= actualDamage;
          gameEventBus.emit('combat:hit', { attackerId: '', targetId: unit.id, damage: actualDamage, position: unit.position });
          if (unit.health <= 0) {
            // Kill reward for terrorist explosion kills
            if (terroristOwner) {
              const reward = Math.floor(unit.cost * 0.2);
              if (reward > 0) terroristOwner.money += reward;
              terroristOwner.statistics.enemiesDestroyed++;
            }
            gameEventBus.emit('combat:explosion', { position: unit.position, unitType: unit.type });
            destroyUnit(unit.id);
          }
        }
      }

      // Damage buildings in radius
      for (const building of [...player.buildings]) {
        const dist = distance(building.position, explosion.position);
        if (dist <= radiusPixels) {
          const actualDamage = combatSystem.calculateDamage(explosion.damage, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
          building.health -= actualDamage;
          gameEventBus.emit('combat:hit', { attackerId: '', targetId: building.id, damage: actualDamage, position: building.position });
          if (building.health <= 0) {
            // Kill reward for terrorist explosion building kills
            if (terroristOwner) {
              const reward = Math.floor(building.cost * 0.2);
              if (reward > 0) terroristOwner.money += reward;
            }
            const tilePos = mapManager.worldToTile(building.position.x, building.position.y);
            for (let dy = 0; dy < building.height; dy++) {
              for (let dx = 0; dx < building.width; dx++) {
                mapManager.setTile(tilePos.x + dx, tilePos.y + dy, TileType.RUBBLE);
              }
            }
            gameEventBus.emit('combat:explosion', { position: building.position, buildingType: building.type });
            destroyBuilding(building.id);
          }
        }
      }
    }
  }

  private updateGuarding(unit: Unit, player: Player, allPlayers: Player[]): void {
    const enemyPlayers = allPlayers.filter(p =>
      isEnemy(unit.faction, player.teamId, p.faction, p.teamId)
    );
    const enemyUnits = enemyPlayers.flatMap(p => p.units);

    // AEGIS cruiser prioritizes airborne targets
    if (unit.type === UnitType.AEGIS) {
      let nearestAirEnemy: Unit | null = null;
      let nearestAirDist = Infinity;
      let nearestGroundEnemy: Unit | null = null;
      let nearestGroundDist = Infinity;

      for (const enemy of enemyUnits) {
        if (enemy.isSubmerged) continue;
        const d = distance(unit.position, enemy.position);
        if (d < unit.vision * GAME_CONFIG.TILE_SIZE) {
          if (enemy.isAirborne) {
            if (d < nearestAirDist) {
              nearestAirDist = d;
              nearestAirEnemy = enemy;
            }
          } else {
            if (d < nearestGroundDist) {
              nearestGroundDist = d;
              nearestGroundEnemy = enemy;
            }
          }
        }
      }

      const target = nearestAirEnemy || nearestGroundEnemy;
      if (target && unit.data.canAttack !== false) {
        unit.state = UnitState.ATTACKING;
        unit.target = target.id;
      }
      return;
    }

    let nearestEnemy: Unit | null = null;
    let nearestDist = Infinity;
    for (const enemy of enemyUnits) {
      // Skip submerged submarines (invisible) unless attacker is DOLPHIN
      if (enemy.isSubmerged && unit.type !== UnitType.DOLPHIN) continue;
      // Skip airborne enemies unless unit has AA capability
      if (enemy.isAirborne && !CAN_TARGET_AIR_TYPES.has(unit.type)) continue;
      const d = distance(unit.position, enemy.position);
      if (d < unit.vision * GAME_CONFIG.TILE_SIZE && d < nearestDist) {
        nearestDist = d;
        nearestEnemy = enemy;
      }
    }

    if (nearestEnemy && unit.data.canAttack !== false) {
      unit.state = UnitState.ATTACKING;
      unit.target = nearestEnemy.id;
    }
  }

  updateBuildingCombat(building: Building, player: Player, allPlayers: Player[], deltaTime: number, destroyUnit: (unitId: string) => void): void {
    if (!building.isConstructed || !building.isPowered) return;
    if (building.empDisabledUntil && building.empDisabledUntil > useGameStore.getState().gameTime) return;

    // Calculate total attack power: building's own attack + garrisoned units' attack
    const garrisonAttack = garrisonSystem.getGarrisonedAttackForPlayer(building, player);
    const totalAttack = (building.attack || 0) + garrisonAttack;
    if (totalAttack <= 0) return;

    const enemyPlayers = allPlayers.filter(p =>
      isEnemy(building.faction, player.teamId, p.faction, p.teamId)
    );
    const enemyUnits = enemyPlayers.flatMap(p => p.units);

    // Garrisoned units get range bonus
    const garrisonRangeBonus = garrisonAttack > 0 ? garrisonSystem.GARRISON_ATTACK_RANGE_BONUS : 0;
    const baseRange = building.attackRange || 5;
    const effectiveRange = (baseRange + garrisonRangeBonus) * GAME_CONFIG.TILE_SIZE;

    // Check current target validity
    if (building.attackTarget) {
      const targetUnit = enemyUnits.find(u => u.id === building.attackTarget);
      if (!targetUnit) {
        building.attackTarget = null;
      } else {
        // Dedicated AA buildings: drop ground targets immediately
        if (DEDICATED_AA_BUILDINGS.has(building.type) && !targetUnit.isAirborne) {
          building.attackTarget = null;
        } else {
          const targetDist = distance(building.position, targetUnit.position);
          if (targetDist > effectiveRange) {
            building.attackTarget = null;
          } else if (targetDist > effectiveRange * 0.6) {
            // Re-evaluate: if current target is far (>60% range), check for closer threats
            let nearestDist = targetDist;
            let nearestEnemy: Unit | null = null;
            const canTargetAir = ANTI_AIR_BUILDINGS.has(building.type);
            const isDedicatedAA = DEDICATED_AA_BUILDINGS.has(building.type);
            for (const enemy of enemyUnits) {
              if (!canTargetAir && enemy.isAirborne) continue;
              // Dedicated AA buildings only consider airborne targets for re-evaluation
              if (isDedicatedAA && !enemy.isAirborne) continue;
              const d = distance(building.position, enemy.position);
              if (d <= effectiveRange * 0.6 && d < nearestDist) {
                nearestDist = d;
                nearestEnemy = enemy;
              }
            }
            if (nearestEnemy) {
              building.attackTarget = nearestEnemy.id;
            }
          }
        }
      }
    }

    // Find nearest enemy if no valid target
    if (!building.attackTarget) {
      const canTargetAir = ANTI_AIR_BUILDINGS.has(building.type);
      const isDedicatedAA = DEDICATED_AA_BUILDINGS.has(building.type);

      // Dedicated AA buildings: prioritize airborne, fall back to ground with reduced effectiveness
      if (isDedicatedAA) {
        // First try to find airborne targets
        let nearestDist = Infinity;
        let nearestEnemy: Unit | null = null;
        for (const enemy of enemyUnits) {
          if (!enemy.isAirborne) continue;
          const d = distance(building.position, enemy.position);
          if (d <= effectiveRange && d < nearestDist) {
            nearestDist = d;
            nearestEnemy = enemy;
          }
        }
        // If no airborne targets, fall back to ground targets
        if (!nearestEnemy) {
          for (const enemy of enemyUnits) {
            if (enemy.isAirborne) continue;
            const d = distance(building.position, enemy.position);
            if (d <= effectiveRange && d < nearestDist) {
              nearestDist = d;
              nearestEnemy = enemy;
            }
          }
        }
        if (nearestEnemy) {
          building.attackTarget = nearestEnemy.id;
        }
      } else {
        // Non-dedicated AA buildings: prioritize airborne targets when available
        let nearestAirDist = Infinity;
        let nearestAirEnemy: Unit | null = null;
        let nearestGroundDist = Infinity;
        let nearestGroundEnemy: Unit | null = null;

        for (const enemy of enemyUnits) {
          // Ground-only buildings cannot target airborne units
          if (!canTargetAir && enemy.isAirborne) continue;
          const d = distance(building.position, enemy.position);
          if (d <= effectiveRange) {
            if (enemy.isAirborne && canTargetAir) {
              if (d < nearestAirDist) {
                nearestAirDist = d;
                nearestAirEnemy = enemy;
              }
            } else if (!enemy.isAirborne) {
              if (d < nearestGroundDist) {
                nearestGroundDist = d;
                nearestGroundEnemy = enemy;
              }
            }
          }
        }

        // Prefer airborne targets over ground targets
        const nearestEnemy = nearestAirEnemy || nearestGroundEnemy;
        if (nearestEnemy) {
          building.attackTarget = nearestEnemy.id;
        }
      }
    }

    // Attack if target exists and cooldown is ready
    if (building.attackTarget) {
      const targetUnit = enemyUnits.find(u => u.id === building.attackTarget);
      if (targetUnit) {
        // Iron Curtain: invulnerable units take no damage
        if (targetUnit.isInvulnerable) {
          const cooldown = 1 / (building.attackSpeed || 1);
          building.attackCooldown = cooldown;
          building.attackTarget = null;
          return;
        }

        const cooldown = 1 / (building.attackSpeed || 1);
        if (building.attackCooldown === undefined) building.attackCooldown = 0;

        // Low power slows defense building attack speed
        const totalOutput = player.buildings.reduce((sum, b) => sum + (b.powerOutput || 0), 0);
        const totalConsumption = player.buildings.reduce((sum, b) => sum + (b.powerConsumption || 0), 0);
        const isLowPower = totalOutput < totalConsumption;
        const attackSpeedMod = isLowPower ? 0.7 : 1.0;

        if (building.attackCooldown <= 0) {
          const damageType = combatSystem.getDamageTypeForBuilding(building);
          const armorType = combatSystem.getArmorTypeForUnit(targetUnit.type);
          let effectiveAttack = totalAttack;

          // Dedicated AA buildings deal reduced damage to ground targets
          if (DEDICATED_AA_BUILDINGS.has(building.type) && !targetUnit.isAirborne) {
            effectiveAttack = Math.floor(totalAttack * 0.5);
          }

          const finalDamage = combatSystem.calculateDamage(
            effectiveAttack,
            damageType,
            armorType,
            targetUnit.armor
          );

          targetUnit.health -= finalDamage;
          gameEventBus.emit('combat:hit', { attackerId: building.id, targetId: targetUnit.id, damage: finalDamage, position: targetUnit.position });

          if (targetUnit.health <= 0) {
            player.statistics.enemiesDestroyed++;
            gameEventBus.emit('combat:explosion', { position: targetUnit.position, unitType: targetUnit.type });
            // Kill reward: give 20% of the killed unit's cost to the killer's player
            const reward = Math.floor(targetUnit.cost * 0.2);
            if (reward > 0) {
              player.money += reward;
            }
            destroyUnit(targetUnit.id);
            building.attackTarget = null;
          }

          building.attackCooldown = cooldown / attackSpeedMod;
        } else {
          building.attackCooldown -= deltaTime * attackSpeedMod;
        }
      }
    }
  }

  private sendAircraftToRearm(unit: Unit, _player: Player): void {
    // Set flag and state; AircraftAmmoSystem handles waypoint setting and gradual rearm
    unit.isReturningToBase = true;
    unit.state = UnitState.MOVING;
    unit.target = null;
  }
}

function getRankDamageMultiplier(rank: UnitRank): number {
  switch (rank) {
    case UnitRank.VETERAN:
      return 1 + GAME_CONFIG.RANK_DAMAGE_BONUS;
    case UnitRank.ELITE:
      return 1 + GAME_CONFIG.RANK_DAMAGE_BONUS * 2;
    default:
      return 1;
  }
}

function promoteUnit(unit: Unit): void {
  if (unit.rank === UnitRank.ROOKIE && unit.kills >= GAME_CONFIG.VETERAN_KILLS) {
    unit.rank = UnitRank.VETERAN;
    const healthRatio = unit.health / unit.maxHealth;
    unit.maxHealth = Math.round(unit.maxHealth * (1 + GAME_CONFIG.RANK_HEALTH_BONUS));
    unit.health = Math.round(unit.maxHealth * healthRatio);
    unit.speed *= (1 + GAME_CONFIG.RANK_SPEED_BONUS);
    gameEventBus.emit('unit:promoted', { unitId: unit.id, rank: unit.rank });
    gameEventBus.emit('notification:success', { message: `单位晋升: ${unit.data.name} -> 老兵` });
  } else if (unit.rank === UnitRank.VETERAN && unit.kills >= GAME_CONFIG.ELITE_KILLS) {
    unit.rank = UnitRank.ELITE;
    const healthRatio = unit.health / unit.maxHealth;
    unit.maxHealth = Math.round(unit.maxHealth * (1 + GAME_CONFIG.RANK_HEALTH_BONUS * 2));
    unit.health = Math.round(unit.maxHealth * healthRatio);
    unit.speed *= (1 + GAME_CONFIG.RANK_SPEED_BONUS);
    gameEventBus.emit('unit:promoted', { unitId: unit.id, rank: unit.rank });
    gameEventBus.emit('notification:success', { message: `单位晋升: ${unit.data.name} -> 精英` });
  }
}
