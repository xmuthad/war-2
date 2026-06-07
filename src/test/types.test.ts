import { describe, it, expect } from 'vitest';
import {
  Faction,
  FactionGroup,
  UnitType,
  BuildingType,
  TileType,
  UnitState,
  GameState,
  Difficulty,
  FACTION_INFO,
  getFactionGroup,
  isAllied,
  isSoviet
} from '../types';

describe('Faction', () => {
  it('should have all 9 playable factions', () => {
    const factions = Object.values(Faction).filter(f => f !== Faction.NEUTRAL);
    expect(factions).toHaveLength(9);
  });

  it('should have correct allied factions', () => {
    const allied = [
      Faction.USA,
      Faction.BRITAIN,
      Faction.GERMANY,
      Faction.FRANCE,
      Faction.KOREA
    ];

    allied.forEach(faction => {
      expect(getFactionGroup(faction)).toBe(FactionGroup.ALLIED);
      expect(isAllied(faction)).toBe(true);
      expect(isSoviet(faction)).toBe(false);
    });
  });

  it('should have correct soviet factions', () => {
    const soviet = [
      Faction.SOVIET,
      Faction.CUBA,
      Faction.LIBYA,
      Faction.IRAQ
    ];

    soviet.forEach(faction => {
      expect(getFactionGroup(faction)).toBe(FactionGroup.SOVIET);
      expect(isSoviet(faction)).toBe(true);
      expect(isAllied(faction)).toBe(false);
    });
  });

  it('should have faction info for all factions', () => {
    Object.values(Faction).forEach(faction => {
      const info = FACTION_INFO[faction];
      expect(info).toBeDefined();
      expect(info.name).toBeDefined();
      expect(info.group).toBeDefined();
      expect(info.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(info.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('should have unique colors for all factions', () => {
    const colors = new Set<string>();

    Object.values(Faction).forEach(faction => {
      const color = FACTION_INFO[faction].color;
      expect(colors.has(color)).toBe(false);
      colors.add(color);
    });
  });
});

describe('UnitType', () => {
  it('should have soldier unit', () => {
    expect(UnitType.SOLDIER).toBe('soldier');
  });

  it('should have unique values', () => {
    const values = Object.values(UnitType);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });

  it('should have special units for each faction', () => {
    expect(UnitType.SEAL).toBe('seal');
    expect(UnitType.SNIPER).toBe('sniper');
    expect(UnitType.TESLA).toBe('tesla');
    expect(UnitType.PHANTOM).toBe('phantom');
    expect(UnitType.BLACKHAWK).toBe('blackhawk');
    expect(UnitType.APOCALYPSE).toBe('apocalypse');
    expect(UnitType.TERRORIST).toBe('terrorist');
    expect(UnitType.IVAN).toBe('ivan');
  });

  it('should have correct unit type strings', () => {
    expect(UnitType.MINER).toBe('miner');
    expect(UnitType.ENGINEER).toBe('engineer');
    expect(UnitType.TANK).toBe('tank');
    expect(UnitType.HELICOPTER).toBe('helicopter');
  });
});

describe('BuildingType', () => {
  it('should have all required buildings', () => {
    expect(BuildingType.COMMAND).toBe('command');
    expect(BuildingType.REFINERY).toBe('refinery');
    expect(BuildingType.BARRACKS).toBe('barracks');
    expect(BuildingType.WARFACTORY).toBe('warfactory');
    expect(BuildingType.POWER).toBe('power');
    expect(BuildingType.RADAR).toBe('radar');
    expect(BuildingType.TECH).toBe('tech');
    expect(BuildingType.REPAIR).toBe('repair');
    expect(BuildingType.WALL).toBe('wall');
  });

  it('should have unique values', () => {
    const values = Object.values(BuildingType);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });

  it('should have defense buildings', () => {
    expect(BuildingType.TURRET).toBe('turret');
    expect(BuildingType.FLAME_TOWER).toBe('flame_tower');
    expect(BuildingType.TESLA_COIL).toBe('tesla_coil');
  });
});

describe('TileType', () => {
  it('should have terrain types', () => {
    expect(TileType.GRASS).toBe('grass');
    expect(TileType.WATER).toBe('water');
    expect(TileType.FOREST).toBe('forest');
    expect(TileType.ROAD).toBe('road');
    expect(TileType.ORE).toBe('ore');
  });

  it('should have unique values', () => {
    const values = Object.values(TileType);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });
});

describe('UnitState', () => {
  it('should have all unit states', () => {
    expect(UnitState.IDLE).toBe('idle');
    expect(UnitState.MOVING).toBe('moving');
    expect(UnitState.ATTACKING).toBe('attacking');
    expect(UnitState.HARVESTING).toBe('harvesting');
    expect(UnitState.RETURNING).toBe('returning');
    expect(UnitState.BUILDING).toBe('building');
    expect(UnitState.REPAIRING).toBe('repairing');
    expect(UnitState.PATROLLING).toBe('patrolling');
    expect(UnitState.GUARDING).toBe('guarding');
  });
});

describe('GameState', () => {
  it('should have all game states', () => {
    expect(GameState.MENU).toBe('menu');
    expect(GameState.LOADING).toBe('loading');
    expect(GameState.PLAYING).toBe('playing');
    expect(GameState.PAUSED).toBe('paused');
    expect(GameState.VICTORY).toBe('victory');
    expect(GameState.DEFEAT).toBe('defeat');
  });
});

describe('Difficulty', () => {
  it('should have difficulty levels', () => {
    expect(Difficulty.EASY).toBe('easy');
    expect(Difficulty.NORMAL).toBe('normal');
    expect(Difficulty.HARD).toBe('hard');
    expect(Difficulty.BRUTAL).toBe('brutal');
  });
});
