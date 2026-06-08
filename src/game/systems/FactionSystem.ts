import { Faction, FactionGroup, FACTION_INFO } from '../../types';
import { useGameStore } from '../../store/gameStore';

/**
 * Types of special abilities available to factions
 * @public
 */
export type SpecialAbilityType =
  | 'ninja'
  | 'sniper'
  | 'phantom'
  | 'tesla'
  | 'blackhawk'
  | 'apocalypse'
  | 'terror'
  | 'ivan'
  | 'chemical';

/**
 * Bonus multipliers applied to faction statistics
 * All values are multipliers (1.0 = normal, >1.0 = bonus, <1.0 = penalty)
 * @public
 */
export interface FactionBonus {
  /** Unit production speed multiplier */
  unitProductionSpeed: number;
  /** Unit cost multiplier (lower = cheaper) */
  unitCost: number;
  /** Building cost multiplier (lower = cheaper) */
  buildingCost: number;
  /** Resource gathering rate multiplier */
  resourceGathering: number;
  /** Defense multiplier for all units */
  defense: number;
  /** Attack damage multiplier for all units */
  attack: number;
  /** Movement speed multiplier for all units */
  speed: number;
  /** Vision range multiplier for all units */
  vision: number;
  /** Power plant efficiency multiplier */
  powerEfficiency: number;
}

/**
 * Special ability available to a faction
 * @public
 */
export interface SpecialAbility {
  /** Type identifier for the ability */
  type: SpecialAbilityType;
  /** Display name of the ability */
  name: string;
  /** Detailed description of the ability */
  description: string;
  /** Icon identifier for UI display */
  icon: string;
  /** Cooldown in milliseconds (0 = no cooldown) */
  cooldown: number;
  /** Duration in milliseconds (0 = instant) */
  duration: number;
  /** Function that calculates the effect of the ability */
  effect: (context: AbilityContext) => AbilityEffect;
}

/**
 * Context provided when activating an ability
 * @public
 */
export interface AbilityContext {
  /** Faction activating the ability */
  faction: Faction;
  /** Optional unit ID if triggered by a unit */
  unitId?: string;
  /** Optional position if triggered at a location */
  position?: { x: number; y: number };
  /** Optional target ID if targeting a specific entity */
  targetId?: string;
}

/**
 * Effect produced by activating a special ability
 * @public
 */
export interface AbilityEffect {
  /** Type of effect to apply */
  type: 'buff' | 'debuff' | 'damage' | 'heal' | 'summon' | 'teleport';
  /** Primary value (damage, healing, etc.) */
  value: number;
  /** Area of effect radius (optional) */
  area?: number;
  /** Effect duration in milliseconds (optional) */
  duration?: number;
  /** Whether the effect can stack (optional) */
  stackable?: boolean;
}

export const FACTION_BONUSES: Record<Faction, FactionBonus> = {
  [Faction.USA]: {
    unitProductionSpeed: 1.0,
    unitCost: 1.0,
    buildingCost: 1.0,
    resourceGathering: 1.0,
    defense: 1.0,
    attack: 1.0,
    speed: 1.0,
    vision: 1.0,
    powerEfficiency: 1.0,
  },
  [Faction.BRITAIN]: {
    unitProductionSpeed: 1.0,
    unitCost: 1.1,
    buildingCost: 1.0,
    resourceGathering: 1.0,
    defense: 1.0,
    attack: 1.2,
    speed: 1.0,
    vision: 1.3,
    powerEfficiency: 1.0,
  },
  [Faction.GERMANY]: {
    unitProductionSpeed: 0.9,
    unitCost: 1.2,
    buildingCost: 1.0,
    resourceGathering: 1.0,
    defense: 1.2,
    attack: 1.15,
    speed: 1.0,
    vision: 1.0,
    powerEfficiency: 1.3,
  },
  [Faction.FRANCE]: {
    unitProductionSpeed: 1.0,
    unitCost: 1.15,
    buildingCost: 0.9,
    resourceGathering: 1.0,
    defense: 1.3,
    attack: 1.1,
    speed: 0.95,
    vision: 1.0,
    powerEfficiency: 1.0,
  },
  [Faction.KOREA]: {
    unitProductionSpeed: 1.1,
    unitCost: 1.0,
    buildingCost: 1.0,
    resourceGathering: 1.0,
    defense: 1.0,
    attack: 1.1,
    speed: 1.15,
    vision: 1.2,
    powerEfficiency: 1.0,
  },
  [Faction.SOVIET]: {
    unitProductionSpeed: 1.0,
    unitCost: 0.8,
    buildingCost: 1.0,
    resourceGathering: 1.0,
    defense: 1.1,
    attack: 1.1,
    speed: 1.0,
    vision: 1.0,
    powerEfficiency: 1.0,
  },
  [Faction.CUBA]: {
    unitProductionSpeed: 1.2,
    unitCost: 0.7,
    buildingCost: 1.0,
    resourceGathering: 1.0,
    defense: 0.9,
    attack: 1.15,
    speed: 1.0,
    vision: 1.0,
    powerEfficiency: 1.0,
  },
  [Faction.LIBYA]: {
    unitProductionSpeed: 1.0,
    unitCost: 0.85,
    buildingCost: 1.0,
    resourceGathering: 1.2,
    defense: 1.0,
    attack: 1.1,
    speed: 1.0,
    vision: 1.0,
    powerEfficiency: 1.0,
  },
  [Faction.IRAQ]: {
    unitProductionSpeed: 1.0,
    unitCost: 0.9,
    buildingCost: 1.1,
    resourceGathering: 1.0,
    defense: 1.2,
    attack: 1.05,
    speed: 1.0,
    vision: 1.0,
    powerEfficiency: 0.8,
  },
  [Faction.NEUTRAL]: {
    unitProductionSpeed: 1.0,
    unitCost: 1.0,
    buildingCost: 1.0,
    resourceGathering: 1.0,
    defense: 1.0,
    attack: 1.0,
    speed: 1.0,
    vision: 1.0,
    powerEfficiency: 1.0,
  },
};

export const FACTION_SPECIAL_ABILITIES: Record<Faction, SpecialAbility | null> = {
  [Faction.USA]: {
    type: 'ninja',
    name: '海豹突击队',
    description: '海豹突击队可以使用C4炸弹摧毁建筑',
    icon: 'seal_icon',
    cooldown: 30000,
    duration: 0,
    effect: (_ctx) => ({
      type: 'damage',
      value: 500,
      area: 50,
    }),
  },
  [Faction.BRITAIN]: {
    type: 'sniper',
    name: '狙击手',
    description: '狙击手可以远程击杀步兵单位',
    icon: 'sniper_icon',
    cooldown: 0,
    duration: 0,
    effect: (_ctx) => ({
      type: 'damage',
      value: 200,
    }),
  },
  [Faction.GERMANY]: {
    type: 'tesla',
    name: '利赛特电磁炮',
    description: '电磁攻击可以连锁攻击多个单位',
    icon: 'tesla_icon',
    cooldown: 5000,
    duration: 3000,
    effect: (_ctx) => ({
      type: 'damage',
      value: 80,
      area: 100,
      stackable: true,
    }),
  },
  [Faction.FRANCE]: {
    type: 'phantom',
    name: '幻影坦克',
    description: '幻影坦克可以伪装成树木',
    icon: 'phantom_icon',
    cooldown: 20000,
    duration: 10000,
    effect: (_ctx) => ({
      type: 'buff',
      value: 0,
    }),
  },
  [Faction.KOREA]: {
    type: 'blackhawk',
    name: '黑鹰战机',
    description: '黑鹰战机具有空中优势',
    icon: 'blackhawk_icon',
    cooldown: 0,
    duration: 0,
    effect: (_ctx) => ({
      type: 'buff',
      value: 1.5,
    }),
  },
  [Faction.SOVIET]: {
    type: 'apocalypse',
    name: '天启坦克',
    description: '天启坦克装配双管炮塔',
    icon: 'apocalypse_icon',
    cooldown: 0,
    duration: 0,
    effect: (_ctx) => ({
      type: 'damage',
      value: 120,
    }),
  },
  [Faction.CUBA]: {
    type: 'terror',
    name: '恐怖分子',
    description: '恐怖分子可以进行自爆攻击',
    icon: 'terror_icon',
    cooldown: 10000,
    duration: 0,
    effect: (_ctx) => ({
      type: 'damage',
      value: 300,
      area: 80,
    }),
  },
  [Faction.LIBYA]: {
    type: 'ivan',
    name: '疯狂伊文',
    description: '疯狂伊文可以放置定时炸弹',
    icon: 'ivan_icon',
    cooldown: 15000,
    duration: 5000,
    effect: (_ctx) => ({
      type: 'damage',
      value: 400,
      area: 60,
    }),
  },
  [Faction.IRAQ]: {
    type: 'chemical',
    name: '辐射工兵',
    description: '辐射工兵可以造成持续伤害',
    icon: 'chemical_icon',
    cooldown: 8000,
    duration: 5000,
    effect: (_ctx) => ({
      type: 'damage',
      value: 50,
      duration: 5000,
      stackable: true,
    }),
  },
  [Faction.NEUTRAL]: null,
};

export class FactionSystem {
  private faction: Faction;
  private activeAbilities: Map<string, { ability: SpecialAbility; endTime: number }> = new Map();

  /**
   * Creates a new FactionSystem instance
   * @param faction - The faction to create the system for
   */
  constructor(faction: Faction) {
    if (faction === undefined || faction === null) {
      throw new Error(`Invalid faction: ${faction}`);
    }
    this.faction = faction;
  }

  /**
   * Gets the faction this system represents
   * @returns The faction enum value
   */
  getFaction(): Faction {
    return this.faction;
  }

  /**
   * Gets faction information
   * @returns Faction info object
   */
  getFactionInfo() {
    return FACTION_INFO[this.faction];
  }

  /**
   * Gets the faction group (Allied or Soviet)
   * @returns The faction group
   */
  getFactionGroup(): FactionGroup {
    return FACTION_INFO[this.faction].group;
  }

  /**
   * Gets the bonus configuration for this faction
   * @returns Copy of the faction bonus object
   */
  getFactionBonus(): FactionBonus {
    return { ...FACTION_BONUSES[this.faction] };
  }

  /**
   * Gets the special ability for this faction
   * @returns Special ability or null if none
   */
  getSpecialAbility(): SpecialAbility | null {
    return FACTION_SPECIAL_ABILITIES[this.faction];
  }

  getAdjustedUnitCost(baseCost: number): number {
    return Math.floor(baseCost * this.getFactionBonus().unitCost);
  }

  getAdjustedBuildingCost(baseCost: number): number {
    return Math.floor(baseCost * this.getFactionBonus().buildingCost);
  }

  getAdjustedUnitProductionTime(baseTime: number): number {
    return Math.floor(baseTime * this.getFactionBonus().unitProductionSpeed);
  }

  getAdjustedAttack(baseAttack: number): number {
    return Math.floor(baseAttack * this.getFactionBonus().attack);
  }

  getAdjustedDefense(baseDefense: number): number {
    return Math.floor(baseDefense * this.getFactionBonus().defense);
  }

  getAdjustedVision(baseVision: number): number {
    return Math.floor(baseVision * this.getFactionBonus().vision);
  }

  getAdjustedSpeed(baseSpeed: number): number {
    return baseSpeed * this.getFactionBonus().speed;
  }

  getResourceMultiplier(): number {
    return this.getFactionBonus().resourceGathering;
  }

  getPowerEfficiency(): number {
    return this.getFactionBonus().powerEfficiency;
  }

  /**
   * Checks if an ability can be used (not on cooldown)
   * @param abilityType - Type of ability to check
   * @returns True if ability can be used
   */
  canUseAbility(abilityType: string): boolean {
    const ability = this.getSpecialAbility();
    if (!ability || ability.type !== abilityType) {
      return false;
    }

    const activeAbility = this.activeAbilities.get(abilityType);
    if (activeAbility) {
      return useGameStore.getState().gameTime * 1000 >= activeAbility.endTime;
    }
    return true;
  }

  /**
   * Uses the faction's special ability
   * @param context - Context for the ability activation
   * @returns The effect produced or null if failed
   */
  useAbility(context: AbilityContext): AbilityEffect | null {
    const ability = this.getSpecialAbility();
    if (!ability) {
      return null;
    }

    if (!this.canUseAbility(ability.type)) {
      return null;
    }

    try {
      const effect = ability.effect(context);

      if (ability.cooldown > 0) {
        this.activeAbilities.set(ability.type, {
          ability,
          endTime: useGameStore.getState().gameTime * 1000 + ability.cooldown,
        });
      }

      return effect;
    } catch (error) {
      console.error(`Failed to execute ability '${ability.type}' for faction ${this.faction}:`, error);
      return null;
    }
  }

  /**
   * Gets the remaining cooldown time for an ability
   * @param abilityType - Type of ability to check
   * @returns Remaining cooldown in milliseconds
   */
  getRemainingCooldown(abilityType: string): number {
    const activeAbility = this.activeAbilities.get(abilityType);
    if (!activeAbility) return 0;
    return Math.max(0, activeAbility.endTime - useGameStore.getState().gameTime * 1000);
  }

  /**
   * Checks if this is an Allied faction
   * @returns True if Allied faction
   */
  isAlliedFaction(): boolean {
    return this.getFactionGroup() === FactionGroup.ALLIED;
  }

  /**
   * Checks if this is a Soviet faction
   * @returns True if Soviet faction
   */
  isSovietFaction(): boolean {
    return this.getFactionGroup() === FactionGroup.SOVIET;
  }

  /**
   * Checks if this faction is an enemy of another
   * @param other - Faction to check against
   * @returns True if enemy
   */
  isEnemyOf(other: Faction): boolean {
    return this.getFactionGroup() !== FACTION_INFO[other].group;
  }

  /**
   * Checks if this faction is an ally of another
   * @param other - Faction to check against
   * @returns True if ally
   */
  isAllyOf(other: Faction): boolean {
    return this.getFactionGroup() === FACTION_INFO[other].group && this.faction !== other;
  }

  /**
   * Cleans up resources used by this system
   */
  dispose(): void {
    this.activeAbilities.clear();
  }
}

/**
 * Factory function to create a FactionSystem instance
 * @param faction - The faction to create the system for
 * @returns New FactionSystem instance
 */
export function createFactionSystem(faction: Faction): FactionSystem {
  return new FactionSystem(faction);
}

/**
 * Gets the display name for a faction
 * @param faction - Faction to get name for
 * @returns Display name
 */
export function getFactionDisplayName(faction: Faction): string {
  return FACTION_INFO[faction].name;
}

/**
 * Gets the primary color for a faction
 * @param faction - Faction to get color for
 * @returns Hex color string
 */
export function getFactionColor(faction: Faction): string {
  return FACTION_INFO[faction].color;
}

/**
 * Gets the secondary color for a faction
 * @param faction - Faction to get color for
 * @returns Hex color string
 */
export function getFactionSecondaryColor(faction: Faction): string {
  return FACTION_INFO[faction].secondaryColor;
}

/**
 * Gets the description for a faction
 * @param faction - Faction to get description for
 * @returns Faction description
 */
export function getFactionDescription(faction: Faction): string {
  return FACTION_INFO[faction].description;
}

/**
 * Gets the special ability name for a faction
 * @param faction - Faction to get ability name for
 * @returns Special ability name or '无特殊能力'
 */
export function getFactionSpecialAbilityName(faction: Faction): string {
  const ability = FACTION_SPECIAL_ABILITIES[faction];
  return ability?.name || '无特殊能力';
}

/**
 * Checks if a faction is Allied
 * @param faction - Faction to check
 * @returns True if Allied faction
 */
export function isAlliedFaction(faction: Faction): boolean {
  return FACTION_INFO[faction].group === FactionGroup.ALLIED;
}

/**
 * Checks if a faction is Soviet
 * @param faction - Faction to check
 * @returns True if Soviet faction
 */
export function isSovietFaction(faction: Faction): boolean {
  return FACTION_INFO[faction].group === FactionGroup.SOVIET;
}

/**
 * Gets all Allied factions
 * @returns Array of Allied faction enum values
 */
export function getAlliedFactions(): Faction[] {
  return [
    Faction.USA,
    Faction.BRITAIN,
    Faction.GERMANY,
    Faction.FRANCE,
    Faction.KOREA,
  ];
}

/**
 * Gets all Soviet factions
 * @returns Array of Soviet faction enum values
 */
export function getSovietFactions(): Faction[] {
  return [
    Faction.SOVIET,
    Faction.CUBA,
    Faction.LIBYA,
    Faction.IRAQ,
  ];
}
