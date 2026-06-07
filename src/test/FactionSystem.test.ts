import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactionSystem,
  FACTION_BONUSES,
  FACTION_SPECIAL_ABILITIES,
  getFactionDisplayName,
  getFactionColor,
  isAlliedFaction,
  isSovietFaction,
  getAlliedFactions,
  getSovietFactions
} from '../game/systems/FactionSystem';
import { Faction, FactionGroup } from '../types';

describe('FactionSystem', () => {
  let factionSystem: FactionSystem;

  describe('USA Faction', () => {
    beforeEach(() => {
      factionSystem = new FactionSystem(Faction.USA);
    });

    it('should return correct faction', () => {
      expect(factionSystem.getFaction()).toBe(Faction.USA);
    });

    it('should return allied faction group', () => {
      expect(factionSystem.getFactionGroup()).toBe(FactionGroup.ALLIED);
      expect(factionSystem.isAlliedFaction()).toBe(true);
      expect(factionSystem.isSovietFaction()).toBe(false);
    });

    it('should have correct faction info', () => {
      const info = factionSystem.getFactionInfo();
      expect(info.name).toBe('美国');
      expect(info.group).toBe(FactionGroup.ALLIED);
      expect(info.color).toBe('#4169E1');
    });

    it('should have special ability', () => {
      const ability = factionSystem.getSpecialAbility();
      expect(ability).not.toBeNull();
      expect(ability?.type).toBe('ninja');
      expect(ability?.name).toBe('海豹突击队');
    });

    it('should apply unit cost bonus', () => {
      const baseCost = 1000;
      const adjustedCost = factionSystem.getAdjustedUnitCost(baseCost);
      expect(adjustedCost).toBe(1000);
    });
  });

  describe('Soviet Faction', () => {
    beforeEach(() => {
      factionSystem = new FactionSystem(Faction.SOVIET);
    });

    it('should return correct faction', () => {
      expect(factionSystem.getFaction()).toBe(Faction.SOVIET);
    });

    it('should return soviet faction group', () => {
      expect(factionSystem.getFactionGroup()).toBe(FactionGroup.SOVIET);
      expect(factionSystem.isSovietFaction()).toBe(true);
      expect(factionSystem.isAlliedFaction()).toBe(false);
    });

    it('should have soviet bonus for unit cost', () => {
      const baseCost = 1000;
      const adjustedCost = factionSystem.getAdjustedUnitCost(baseCost);
      expect(adjustedCost).toBe(800);
    });

    it('should have special ability - Apocalypse', () => {
      const ability = factionSystem.getSpecialAbility();
      expect(ability).not.toBeNull();
      expect(ability?.type).toBe('apocalypse');
    });
  });

  describe('Cuba Faction', () => {
    beforeEach(() => {
      factionSystem = new FactionSystem(Faction.CUBA);
    });

    it('should have terror special ability', () => {
      const ability = factionSystem.getSpecialAbility();
      expect(ability).not.toBeNull();
      expect(ability?.type).toBe('terror');
      expect(ability?.name).toBe('恐怖分子');
    });

    it('should have fast unit production bonus', () => {
      const bonus = factionSystem.getFactionBonus();
      expect(bonus.unitProductionSpeed).toBe(1.2);
    });

    it('should have low unit cost bonus', () => {
      const bonus = factionSystem.getFactionBonus();
      expect(bonus.unitCost).toBe(0.7);
    });
  });

  describe('Germany Faction', () => {
    beforeEach(() => {
      factionSystem = new FactionSystem(Faction.GERMANY);
    });

    it('should have tesla special ability', () => {
      const ability = factionSystem.getSpecialAbility();
      expect(ability).not.toBeNull();
      expect(ability?.type).toBe('tesla');
    });

    it('should have good power efficiency', () => {
      const bonus = factionSystem.getFactionBonus();
      expect(bonus.powerEfficiency).toBe(1.3);
    });
  });

  describe('Iraq Faction', () => {
    beforeEach(() => {
      factionSystem = new FactionSystem(Faction.IRAQ);
    });

    it('should have chemical special ability', () => {
      const ability = factionSystem.getSpecialAbility();
      expect(ability).not.toBeNull();
      expect(ability?.type).toBe('chemical');
    });

    it('should have good defense bonus', () => {
      const bonus = factionSystem.getFactionBonus();
      expect(bonus.defense).toBe(1.2);
    });
  });

  describe('Enemy Detection', () => {
    it('should detect USA vs Soviet as enemies', () => {
      const usaSystem = new FactionSystem(Faction.USA);
      expect(usaSystem.isEnemyOf(Faction.SOVIET)).toBe(true);
      expect(usaSystem.isEnemyOf(Faction.CUBA)).toBe(true);
      expect(usaSystem.isEnemyOf(Faction.IRAQ)).toBe(true);
    });

    it('should detect Soviet vs Allied as enemies', () => {
      const sovietSystem = new FactionSystem(Faction.SOVIET);
      expect(sovietSystem.isEnemyOf(Faction.USA)).toBe(true);
      expect(sovietSystem.isEnemyOf(Faction.BRITAIN)).toBe(true);
      expect(sovietSystem.isEnemyOf(Faction.FRANCE)).toBe(true);
    });

    it('should detect allies correctly', () => {
      const usaSystem = new FactionSystem(Faction.USA);
      expect(usaSystem.isEnemyOf(Faction.BRITAIN)).toBe(false);
      expect(usaSystem.isEnemyOf(Faction.FRANCE)).toBe(false);
      expect(usaSystem.isEnemyOf(Faction.GERMANY)).toBe(false);
      expect(usaSystem.isEnemyOf(Faction.KOREA)).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('getFactionDisplayName should return correct names', () => {
      expect(getFactionDisplayName(Faction.USA)).toBe('美国');
      expect(getFactionDisplayName(Faction.BRITAIN)).toBe('英国');
      expect(getFactionDisplayName(Faction.SOVIET)).toBe('苏联');
      expect(getFactionDisplayName(Faction.CUBA)).toBe('古巴');
    });

    it('getFactionColor should return hex colors', () => {
      expect(getFactionColor(Faction.USA)).toBe('#4169E1');
      expect(getFactionColor(Faction.SOVIET)).toBe('#CC0000');
    });

    it('isAlliedFaction should work correctly', () => {
      expect(isAlliedFaction(Faction.USA)).toBe(true);
      expect(isAlliedFaction(Faction.BRITAIN)).toBe(true);
      expect(isAlliedFaction(Faction.SOVIET)).toBe(false);
      expect(isAlliedFaction(Faction.CUBA)).toBe(false);
    });

    it('isSovietFaction should work correctly', () => {
      expect(isSovietFaction(Faction.SOVIET)).toBe(true);
      expect(isSovietFaction(Faction.CUBA)).toBe(true);
      expect(isSovietFaction(Faction.USA)).toBe(false);
    });

    it('getAlliedFactions should return 5 factions', () => {
      const allied = getAlliedFactions();
      expect(allied).toHaveLength(5);
      expect(allied).toContain(Faction.USA);
      expect(allied).toContain(Faction.BRITAIN);
      expect(allied).toContain(Faction.GERMANY);
      expect(allied).toContain(Faction.FRANCE);
      expect(allied).toContain(Faction.KOREA);
    });

    it('getSovietFactions should return 4 factions', () => {
      const soviet = getSovietFactions();
      expect(soviet).toHaveLength(4);
      expect(soviet).toContain(Faction.SOVIET);
      expect(soviet).toContain(Faction.CUBA);
      expect(soviet).toContain(Faction.LIBYA);
      expect(soviet).toContain(Faction.IRAQ);
    });
  });

  describe('FACTION_BONUSES', () => {
    it('should have bonus values for all factions', () => {
      Object.values(Faction).forEach(faction => {
        const bonus = FACTION_BONUSES[faction];
        expect(bonus).toBeDefined();
        expect(bonus.unitProductionSpeed).toBeGreaterThan(0);
        expect(bonus.unitCost).toBeGreaterThan(0);
        expect(bonus.attack).toBeGreaterThan(0);
        expect(bonus.defense).toBeGreaterThan(0);
      });
    });
  });

  describe('FACTION_SPECIAL_ABILITIES', () => {
    it('should have special abilities for combat factions', () => {
      const combatFactions = [
        Faction.USA, Faction.BRITAIN, Faction.GERMANY,
        Faction.FRANCE, Faction.KOREA, Faction.SOVIET,
        Faction.CUBA, Faction.LIBYA, Faction.IRAQ
      ];

      combatFactions.forEach(faction => {
        const ability = FACTION_SPECIAL_ABILITIES[faction];
        expect(ability).not.toBeNull();
        expect(ability?.name).toBeDefined();
        expect(ability?.description).toBeDefined();
        expect(ability?.icon).toBeDefined();
      });
    });

    it('should have no special ability for neutral', () => {
      expect(FACTION_SPECIAL_ABILITIES[Faction.NEUTRAL]).toBeNull();
    });
  });
});
