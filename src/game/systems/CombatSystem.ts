import { Unit, Building, UnitType, BuildingType, Vector2, PendingBomb, Faction, Player, TileType } from '../../types';
import { mapManager } from '../map/MapManager';
import { gameEventBus } from './GameEventBus';

export interface TerroristExplosion {
  position: Vector2;
  radius: number;
  damage: number;
  faction: Faction;
}

export enum DamageType {
  KINETIC = 'kinetic',
  EXPLOSIVE = 'explosive',
  ENERGY = 'energy',
  FIRE = 'fire',
  CHEMICAL = 'chemical',
}

export enum ArmorType {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  STRUCTURE = 'structure',
  INFANTRY = 'infantry',
}

export const DAMAGE_MODIFIER_TABLE: Record<DamageType, Record<ArmorType, number>> = {
  [DamageType.KINETIC]: {
    [ArmorType.LIGHT]: 1.0,
    [ArmorType.MEDIUM]: 0.75,
    [ArmorType.HEAVY]: 0.5,
    [ArmorType.STRUCTURE]: 0.25,
    [ArmorType.INFANTRY]: 1.0,
  },
  [DamageType.EXPLOSIVE]: {
    [ArmorType.LIGHT]: 1.0,
    [ArmorType.MEDIUM]: 1.0,
    [ArmorType.HEAVY]: 1.0,
    [ArmorType.STRUCTURE]: 1.5,
    [ArmorType.INFANTRY]: 1.5,
  },
  [DamageType.ENERGY]: {
    [ArmorType.LIGHT]: 1.25,
    [ArmorType.MEDIUM]: 1.0,
    [ArmorType.HEAVY]: 1.5,
    [ArmorType.STRUCTURE]: 0.75,
    [ArmorType.INFANTRY]: 0.75,
  },
  [DamageType.FIRE]: {
    [ArmorType.LIGHT]: 0.75,
    [ArmorType.MEDIUM]: 0.5,
    [ArmorType.HEAVY]: 0.25,
    [ArmorType.STRUCTURE]: 0.5,
    [ArmorType.INFANTRY]: 1.5,
  },
  [DamageType.CHEMICAL]: {
    [ArmorType.LIGHT]: 0.5,
    [ArmorType.MEDIUM]: 0.5,
    [ArmorType.HEAVY]: 0.25,
    [ArmorType.STRUCTURE]: 0.1,
    [ArmorType.INFANTRY]: 2.0,
  },
};

export enum ProjectileType {
  BULLET = 'bullet',
  SHELL = 'shell',
  MISSILE = 'missile',
  BEAM = 'beam',
}

export interface Projectile {
  id: string;
  type: ProjectileType;
  position: Vector2;
  target: Vector2;
  targetId: string;
  speed: number;
  damage: number;
  damageType: DamageType;
  sourceId: string;
  isFinished: boolean;
}

export interface SplashConfig {
  radius: number;        // 溅射半径（像素）
  damageFactor: number;  // 溅射伤害倍率（相对于中心伤害）
  selfDamage: boolean;   // 是否对友军造成伤害
}

const INFANTRY_TYPES = new Set<UnitType>([
  UnitType.SOLDIER,
  UnitType.ENGINEER,
  UnitType.ROCKET,
  UnitType.SNIPER,
  UnitType.TANYA,
  UnitType.SEAL,
  UnitType.CONSCRIPT,
  UnitType.FLAKINFANTRY,
  UnitType.TERRORIST,
  UnitType.IVAN,
  UnitType.CHRONO,
]);

const LIGHT_VEHICLE_TYPES = new Set<UnitType>([
  UnitType.IFV,
  UnitType.FLAK,
  UnitType.APC,
]);

const MEDIUM_TANK_TYPES = new Set<UnitType>([
  UnitType.TANK,
  UnitType.RHINO,
  UnitType.PRISM,
  UnitType.PHANTOM,
  UnitType.GUARDIAN,
]);

const HEAVY_TANK_TYPES = new Set<UnitType>([
  UnitType.APOCALYPSE,
  UnitType.DESPOT,
]);

const AIR_TYPES = new Set<UnitType>([
  UnitType.HELICOPTER,
  UnitType.BLACKHAWK,
  UnitType.KIROV,
  UnitType.YAK,
]);

const KINETIC_DAMAGE_TYPES = new Set<UnitType>([
  UnitType.SNIPER,
  UnitType.TANYA,
  UnitType.SEAL,
]);

const EXPLOSIVE_DAMAGE_TYPES = new Set<UnitType>([
  UnitType.ROCKET,
  UnitType.TERRORIST,
]);

const ENERGY_DAMAGE_TYPES = new Set<UnitType>([
  UnitType.TESLA,
  UnitType.GUARDIAN,
  UnitType.DESPOT,
]);

const FIRE_DAMAGE_BUILDING_TYPES = new Set<BuildingType>([
  BuildingType.FLAME_TOWER,
]);

const CHEMICAL_DAMAGE_TYPES = new Set<UnitType>([
  UnitType.IVAN,
]);

export class CombatSystem {
  attackCooldowns: Map<string, number> = new Map();
  killCounts: Map<string, number> = new Map();
  private projectiles: Projectile[] = [];

  // 根据单位类型获取弹道类型
  getProjectileType(unitType: UnitType): ProjectileType {
    const shellTypes = new Set([UnitType.TANK, UnitType.RHINO, UnitType.APOCALYPSE, UnitType.IFV, UnitType.GUARDIAN]);
    const missileTypes = new Set([UnitType.ROCKET, UnitType.FLAK, UnitType.HELICOPTER, UnitType.BLACKHAWK, UnitType.KIROV]);
    const beamTypes = new Set([UnitType.TESLA, UnitType.PRISM, UnitType.DESPOT]);

    if (shellTypes.has(unitType)) return ProjectileType.SHELL;
    if (missileTypes.has(unitType)) return ProjectileType.MISSILE;
    if (beamTypes.has(unitType)) return ProjectileType.BEAM;
    return ProjectileType.BULLET;
  }

  // 获取弹道速度（像素/秒）
  getProjectileSpeed(type: ProjectileType): number {
    switch (type) {
      case ProjectileType.BULLET: return 800;
      case ProjectileType.SHELL: return 600;
      case ProjectileType.MISSILE: return 400;
      case ProjectileType.BEAM: return Infinity; // 即时命中
    }
  }

  // 获取溅射配置
  getSplashConfig(unitType: UnitType): SplashConfig | null {
    const splashTypes: Partial<Record<UnitType, SplashConfig>> = {
      [UnitType.APOCALYPSE]: { radius: 48, damageFactor: 0.5, selfDamage: false },
      [UnitType.KIROV]: { radius: 80, damageFactor: 0.7, selfDamage: false },
      [UnitType.ROCKET]: { radius: 32, damageFactor: 0.3, selfDamage: false },
    };
    return splashTypes[unitType] || null;
  }

  // 创建弹道
  createProjectile(source: Unit, targetPos: Vector2, targetId: string, damage: number, damageType: DamageType): Projectile {
    const type = this.getProjectileType(source.type);
    const speed = this.getProjectileSpeed(type);
    const projectile: Projectile = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      position: { ...source.position },
      target: { ...targetPos },
      targetId,
      speed,
      damage,
      damageType,
      sourceId: source.id,
      isFinished: false,
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  // 更新所有弹道
  updateProjectiles(deltaTime: number): Projectile[] {
    const finished: Projectile[] = [];

    for (const proj of this.projectiles) {
      if (proj.isFinished) continue;

      // Beam type hits instantly
      if (proj.type === ProjectileType.BEAM) {
        proj.isFinished = true;
        finished.push(proj);
        continue;
      }

      const dx = proj.target.x - proj.position.x;
      const dy = proj.target.y - proj.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < proj.speed * deltaTime) {
        proj.position = { ...proj.target };
        proj.isFinished = true;
        finished.push(proj);
      } else {
        const ratio = (proj.speed * deltaTime) / dist;
        proj.position.x += dx * ratio;
        proj.position.y += dy * ratio;
      }
    }

    this.projectiles = this.projectiles.filter(p => !p.isFinished);
    return finished;
  }

  // 应用溅射伤害
  applySplashDamage(
    center: Vector2,
    sourceFaction: Faction,
    sourceTeamId: number | undefined,
    damage: number,
    damageType: DamageType,
    splashConfig: SplashConfig,
    allPlayers: Player[],
    destroyUnit: (id: string) => void,
    destroyBuilding: (id: string) => void
  ): void {
    for (const player of allPlayers) {
      // Skip allies if selfDamage is false
      if (!splashConfig.selfDamage) {
        if (sourceTeamId !== undefined && player.teamId === sourceTeamId) continue;
        if (sourceFaction === player.faction) continue;
      }

      for (const unit of [...player.units]) {
        const dx = unit.position.x - center.x;
        const dy = unit.position.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= splashConfig.radius) {
          const distanceFactor = 1 - (dist / splashConfig.radius) * 0.5; // 50% falloff at edge
          const splashDamage = Math.floor(damage * splashConfig.damageFactor * distanceFactor);
          const armorType = this.getArmorTypeForUnit(unit.type);
          const actualDamage = this.calculateDamage(splashDamage, damageType, armorType, unit.armor);

          if (!unit.isInvulnerable) {
            unit.health -= actualDamage;
            gameEventBus.emit('combat:hit', { attackerId: '', targetId: unit.id, damage: actualDamage, position: unit.position });
            if (unit.health <= 0) {
              gameEventBus.emit('combat:explosion', { position: unit.position, unitType: unit.type });
              destroyUnit(unit.id);
            }
          }
        }
      }

      for (const building of [...player.buildings]) {
        const dx = building.position.x - center.x;
        const dy = building.position.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= splashConfig.radius) {
          const distanceFactor = 1 - (dist / splashConfig.radius) * 0.5;
          const splashDamage = Math.floor(damage * splashConfig.damageFactor * distanceFactor);
          const actualDamage = this.calculateDamage(splashDamage, damageType, ArmorType.STRUCTURE, 0);

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

  getProjectiles(): Projectile[] {
    return this.projectiles;
  }

  calculateDamage(baseDamage: number, damageType: DamageType, armorType: ArmorType, armorValue: number): number {
    const modifier = this.getDamageModifier(damageType, armorType);
    const armorReduction = 1 - (armorValue / (armorValue + 100));
    return Math.max(1, Math.floor(baseDamage * modifier * armorReduction));
  }

  getDamageModifier(damageType: DamageType, armorType: ArmorType): number {
    return DAMAGE_MODIFIER_TABLE[damageType]?.[armorType] ?? 1.0;
  }

  getArmorType(entity: Unit | Building): ArmorType {
    if ('type' in entity && typeof entity.type === 'string') {
      if (Object.values(UnitType).includes(entity.type as UnitType)) {
        const unitType = entity.type as UnitType;
        if (INFANTRY_TYPES.has(unitType)) return ArmorType.INFANTRY;
        if (LIGHT_VEHICLE_TYPES.has(unitType)) return ArmorType.LIGHT;
        if (MEDIUM_TANK_TYPES.has(unitType)) return ArmorType.MEDIUM;
        if (HEAVY_TANK_TYPES.has(unitType)) return ArmorType.HEAVY;
        if (AIR_TYPES.has(unitType)) return ArmorType.LIGHT;
        return ArmorType.MEDIUM;
      }

      if (Object.values(BuildingType).includes(entity.type as BuildingType)) {
        return ArmorType.STRUCTURE;
      }
    }

    return ArmorType.MEDIUM;
  }

  getDamageType(unit: Unit): DamageType {
    return this.getDamageTypeForUnitType(unit.type);
  }

  getDamageTypeForUnitType(unitType: UnitType): DamageType {
    if (KINETIC_DAMAGE_TYPES.has(unitType)) return DamageType.KINETIC;
    if (EXPLOSIVE_DAMAGE_TYPES.has(unitType)) return DamageType.EXPLOSIVE;
    if (ENERGY_DAMAGE_TYPES.has(unitType)) return DamageType.ENERGY;
    if (CHEMICAL_DAMAGE_TYPES.has(unitType)) return DamageType.CHEMICAL;
    return DamageType.KINETIC;
  }

  getDamageTypeForBuilding(building: Building): DamageType {
    if (FIRE_DAMAGE_BUILDING_TYPES.has(building.type)) return DamageType.FIRE;
    if (building.type === BuildingType.TESLA_COIL) return DamageType.ENERGY;
    if (building.type === BuildingType.TURRET) return DamageType.KINETIC;
    return DamageType.KINETIC;
  }

  getArmorTypeForUnit(unitType: UnitType): ArmorType {
    if (INFANTRY_TYPES.has(unitType)) return ArmorType.INFANTRY;
    if (LIGHT_VEHICLE_TYPES.has(unitType)) return ArmorType.LIGHT;
    if (MEDIUM_TANK_TYPES.has(unitType)) return ArmorType.MEDIUM;
    if (HEAVY_TANK_TYPES.has(unitType)) return ArmorType.HEAVY;
    if (AIR_TYPES.has(unitType)) return ArmorType.LIGHT;
    return ArmorType.MEDIUM;
  }

  getArmorTypeForBuilding(): ArmorType {
    return ArmorType.STRUCTURE;
  }

  getAttackCooldown(unitId: string): number {
    return this.attackCooldowns.get(unitId) ?? 0;
  }

  setAttackCooldown(unitId: string, cooldown: number): void {
    this.attackCooldowns.set(unitId, cooldown);
  }

  getKillCount(unitId: string): number {
    return this.killCounts.get(unitId) ?? 0;
  }

  reset(): void {
    this.attackCooldowns.clear();
    this.killCounts.clear();
    this.pendingBombs = [];
    this.prismAttackTracker.clear();
    this.projectiles = [];
  }

  // --- Special Ability Methods ---

  // Tanya C4: 10x damage vs buildings
  calculateSpecialDamage(attacker: Unit, target: Unit | Building, baseDamage: number): number {
    if (attacker.type === UnitType.TANYA && this.isBuilding(target)) {
      return baseDamage * 10;
    }
    return baseDamage;
  }

  // Apocalypse Tank: double hit (returns number of hits)
  getAttackHitCount(attacker: Unit): number {
    if (attacker.type === UnitType.APOCALYPSE) {
      return 2;
    }
    return 1;
  }

  // Prism Tank focus attack: track concurrent prism attacks and return damage multiplier
  trackPrismAttack(targetId: string, attackerId: string, timestamp: number): number {
    let tracker = this.prismAttackTracker.get(targetId);
    if (!tracker) {
      tracker = { attacks: [], lastCleanup: timestamp };
      this.prismAttackTracker.set(targetId, tracker);
    }

    // Clean up old entries (>2 seconds)
    if (timestamp - tracker.lastCleanup > 2) {
      tracker.attacks = tracker.attacks.filter(t => timestamp - t < 2);
      tracker.lastCleanup = timestamp;
    }

    // Add current attack
    tracker.attacks.push(timestamp);

    // Count concurrent prism attacks (within last 0.5 seconds)
    const recentCount = tracker.attacks.filter(t => timestamp - t < 0.5).length;

    // Each additional prism adds 50% more damage
    // 1 prism = 1x, 2 prism = 1.5x, 3 prism = 2x, etc.
    const multiplier = 1 + (recentCount - 1) * 0.5;
    return Math.max(1, multiplier);
  }

  // Ivan bomb placement
  placeBomb(attacker: Unit, target: Unit | Building): PendingBomb | null {
    if (attacker.type !== UnitType.IVAN) return null;

    const bomb: PendingBomb = {
      id: `bomb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetId: target.id,
      targetPosition: { ...target.position },
      timer: 5, // 5 seconds
      damage: 500,
      faction: attacker.faction,
    };
    this.pendingBombs.push(bomb);
    return bomb;
  }

  // Terrorist self-destruct
  handleTerroristAttack(attacker: Unit): TerroristExplosion | null {
    if (attacker.type !== UnitType.TERRORIST) return null;

    return {
      position: { ...attacker.position },
      radius: 3, // 3 tiles
      damage: 200,
      faction: attacker.faction,
    };
  }

  // Update bomb timers, return detonated bombs
  updateBombs(deltaTime: number): PendingBomb[] {
    const detonated: PendingBomb[] = [];
    for (const bomb of this.pendingBombs) {
      bomb.timer -= deltaTime;
      if (bomb.timer <= 0) {
        detonated.push(bomb);
      }
    }
    this.pendingBombs = this.pendingBombs.filter(b => b.timer > 0);
    return detonated;
  }

  private isBuilding(entity: Unit | Building): boolean {
    return 'type' in entity && Object.values(BuildingType).includes(entity.type as BuildingType);
  }

  pendingBombs: PendingBomb[] = [];
  private prismAttackTracker: Map<string, { attacks: number[]; lastCleanup: number }> = new Map();
}

export const combatSystem = new CombatSystem();
