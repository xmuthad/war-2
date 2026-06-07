import type { Unit, Player, Vector2, Faction, Building } from '../../types';
import { UnitState, TileType, UnitRank, UnitType, UpgradeType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { combatSystem, TerroristExplosion, DamageType, ArmorType, ProjectileType, SplashConfig, Projectile } from './CombatSystem';
import { mapManager } from '../map/MapManager';
import { gameEventBus } from './GameEventBus';

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

  update(unit: Unit, player: Player, allPlayers: Player[], deltaTime: number, destroyUnit: (unitId: string) => void, destroyBuilding: (buildingId: string) => void): void {
    // Skip units inside a transport
    if (unit.transportId) return;

    this.gameTime += deltaTime;

    // Update projectiles and process finished ones
    this.processFinishedProjectiles(allPlayers, deltaTime, destroyUnit, destroyBuilding);

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

    const attackDist = distance(unit.position, targetPos);
    const effectiveRange = unit.attackRange * GAME_CONFIG.TILE_SIZE;

    if (attackDist > effectiveRange) {
      const dx = targetPos.x - unit.position.x;
      const dy = targetPos.y - unit.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = unit.speed * GAME_CONFIG.TILE_SIZE * deltaTime;
      const ratio = Math.min(1, moveSpeed / dist);
      unit.position.x += dx * ratio;
      unit.position.y += dy * ratio;
      unit.direction = getDirectionFromDelta(dx, dy);
    } else {
      unit.direction = getDirectionFromDelta(
        targetPos.x - unit.position.x,
        targetPos.y - unit.position.y
      );

      const cooldown = 1 / unit.attackSpeed;
      const currentCooldown = combatSystem.getAttackCooldown(unit.id);
      if (currentCooldown <= 0) {
        const damageType = combatSystem.getDamageTypeForUnitType(unit.type);

        // --- Terrorist self-destruct ---
        if (unit.type === UnitType.TERRORIST) {
          const explosion = combatSystem.handleTerroristAttack(unit);
          if (explosion) {
            this.applyTerroristExplosion(explosion, allPlayers, destroyUnit, destroyBuilding);
          }
          destroyUnit(unit.id);
          return;
        }

        // --- Ivan bomb placement ---
        if (unit.type === UnitType.IVAN && (targetUnit || targetBuilding)) {
          const target = targetUnit || targetBuilding!;
          combatSystem.placeBomb(unit, target);
          gameEventBus.emit('combat:hit', { attackerId: unit.id, targetId: target.id, damage: 0, position: target.position });
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

            // Tanya C4: 10x damage vs buildings (not applicable to units, but method handles it)
            baseDamage = combatSystem.calculateSpecialDamage(unit, currentTargetUnit, baseDamage);

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

            // Tanya C4: 10x damage vs buildings
            baseDamage = combatSystem.calculateSpecialDamage(unit, currentTargetBuilding, baseDamage);

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
                currentTargetBuilding.empDisabledUntil = Date.now() + 10000;
                gameEventBus.emit('combat:emp', { attackerId: unit.id, targetId: currentTargetBuilding.id, position: currentTargetBuilding.position });
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

    for (const player of allPlayers) {
      // Skip same faction (friendly fire off)
      if (player.faction === explosion.faction) continue;

      // Damage units in radius
      for (const unit of [...player.units]) {
        const dist = distance(unit.position, explosion.position);
        if (dist <= radiusPixels) {
          const armorType = combatSystem.getArmorTypeForUnit(unit.type);
          const actualDamage = combatSystem.calculateDamage(explosion.damage, DamageType.EXPLOSIVE, armorType, unit.armor);
          unit.health -= actualDamage;
          gameEventBus.emit('combat:hit', { attackerId: '', targetId: unit.id, damage: actualDamage, position: unit.position });
          if (unit.health <= 0) {
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

    let nearestEnemy: Unit | null = null;
    let nearestDist = Infinity;
    for (const enemy of enemyUnits) {
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
    if (!building.attack || building.attack <= 0) return;
    if (!building.isConstructed || !building.isPowered) return;
    if (building.empDisabledUntil && building.empDisabledUntil > Date.now()) return;

    const enemyPlayers = allPlayers.filter(p =>
      isEnemy(building.faction, player.teamId, p.faction, p.teamId)
    );
    const enemyUnits = enemyPlayers.flatMap(p => p.units);

    const effectiveRange = (building.attackRange || 5) * GAME_CONFIG.TILE_SIZE;

    // Check current target validity
    if (building.attackTarget) {
      const targetUnit = enemyUnits.find(u => u.id === building.attackTarget);
      if (!targetUnit) {
        building.attackTarget = null;
      } else {
        const targetDist = distance(building.position, targetUnit.position);
        if (targetDist > effectiveRange) {
          building.attackTarget = null;
        }
      }
    }

    // Find nearest enemy if no valid target
    if (!building.attackTarget) {
      let nearestDist = Infinity;
      let nearestEnemy: Unit | null = null;
      for (const enemy of enemyUnits) {
        const d = distance(building.position, enemy.position);
        if (d <= effectiveRange && d < nearestDist) {
          nearestDist = d;
          nearestEnemy = enemy;
        }
      }
      if (nearestEnemy) {
        building.attackTarget = nearestEnemy.id;
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

        if (building.attackCooldown <= 0) {
          const damageType = DamageType.KINETIC;
          const armorType = combatSystem.getArmorTypeForUnit(targetUnit.type);
          const finalDamage = combatSystem.calculateDamage(
            building.attack,
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

          building.attackCooldown = cooldown;
        } else {
          building.attackCooldown -= deltaTime;
        }
      }
    }
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
    unit.maxHealth = Math.round(unit.maxHealth * (1 + GAME_CONFIG.RANK_HEALTH_BONUS));
    unit.health = unit.maxHealth;
    unit.speed *= (1 + GAME_CONFIG.RANK_SPEED_BONUS);
    gameEventBus.emit('unit:promoted', { unitId: unit.id, rank: unit.rank });
  } else if (unit.rank === UnitRank.VETERAN && unit.kills >= GAME_CONFIG.ELITE_KILLS) {
    unit.rank = UnitRank.ELITE;
    unit.maxHealth = Math.round(unit.maxHealth * (1 + GAME_CONFIG.RANK_HEALTH_BONUS * 2));
    unit.health = unit.maxHealth;
    unit.speed *= (1 + GAME_CONFIG.RANK_SPEED_BONUS);
    gameEventBus.emit('unit:promoted', { unitId: unit.id, rank: unit.rank });
  }
}
