import Phaser from 'phaser';
import { UnitType, BuildingType, Faction } from '../../types';
import { TERRAIN_COLORS as SHARED_TERRAIN_COLORS } from '../config/TerrainConfig';

export interface SpriteConfig {
  frameWidth: number;
  frameHeight: number;
  tileSize: number;
  directions: number;
  frames: number;
}

export interface RenderConfig {
  spriteScale: number;
  unitDepthBase: number;
  buildingDepthBase: number;
  healthBarDepth: number;
  selectionDepth: number;
  healthBarWidth: number;
  healthBarHeight: number;
  unitHealthBarOffsetY: number;
  buildingHealthBarOffsetY: number;
  selectionCircleRadius: number;
  animationFrameInterval: number;
  unitFallbackColorAllied: number;
  unitFallbackColorSoviet: number;
  buildingFallbackColorAllied: number;
  buildingFallbackColorSoviet: number;
  unitFallbackRadius: number;
  buildingFallbackWidth: number;
  buildingFallbackHeight: number;
}

export interface TerrainConfig {
  grass: number;
  water: number;
  mountain: number;
  forest: number;
  road: number;
  ore: number;
  sand: number;
  ice: number;
  mud: number;
  rubble: number;
  crater: number;
  cliff: number;
}

export interface ResourceNodeConfig {
  color: number;
  strokeColor: number;
  scale: number;
  strokeWidth: number;
}

export interface HealthBarColors {
  background: number;
  backgroundAlpha: number;
  barBackground: number;
  healthHigh: number;
  healthMedium: number;
  healthLow: number;
  selection: number;
}

export interface SpriteMapping {
  [key: string]: string;
}

export const SPRITE_CONFIG: SpriteConfig = {
  frameWidth: 64,
  frameHeight: 64,
  tileSize: 32,
  directions: 8,
  frames: 4
};

export const RENDER_CONFIG: RenderConfig = {
  // Render sprites at full source size (64x64) for crisp visuals on a tile grid.
  // The previous 0.5 scale combined with pixelArt+nearest filter made every
  // unit look tiny and aliased; 1.0 keeps the original artwork resolution and
  // crisp pixel-art look while still leaving room above the 32px tile.
  spriteScale: 1.0,
  unitDepthBase: 0,
  buildingDepthBase: -1,
  healthBarDepth: 999,
  selectionDepth: 1000,
  healthBarWidth: 50,
  healthBarHeight: 6,
  unitHealthBarOffsetY: 40,
  buildingHealthBarOffsetY: 10,
  selectionCircleRadius: 28,
  animationFrameInterval: 100,
  unitFallbackColorAllied: 0x4488ff,
  unitFallbackColorSoviet: 0xff4444,
  buildingFallbackColorAllied: 0x3366cc,
  buildingFallbackColorSoviet: 0xcc3333,
  unitFallbackRadius: 14,
  buildingFallbackWidth: 48,
  buildingFallbackHeight: 48,
};

export const TERRAIN_COLORS: TerrainConfig = SHARED_TERRAIN_COLORS as TerrainConfig;

export const RESOURCE_NODE_CONFIG: ResourceNodeConfig = {
  color: 0xff8c00,
  strokeColor: 0xcc7000,
  scale: 0.8,
  strokeWidth: 2
};

export const HEALTH_BAR_COLORS: HealthBarColors = {
  background: 0x000000,
  backgroundAlpha: 0.7,
  barBackground: 0x333333,
  healthHigh: 0x00ff00,
  healthMedium: 0xffff00,
  healthLow: 0xff0000,
  selection: 0x00ff00
};

export function getDirectionAngles(): number[] {
  const angles: number[] = [];
  for (let i = 0; i < SPRITE_CONFIG.directions; i++) {
    angles.push((i / SPRITE_CONFIG.directions) * Math.PI * 2 - Math.PI / 2);
  }
  return angles;
}

export const DIRECTION_ANGLES = getDirectionAngles();

function createUnitSpriteKey(faction: Faction, type: UnitType): string {
  return `${faction}_${type}`;
}

function createBuildingSpriteKey(faction: Faction, type: BuildingType): string {
  return `${faction}_${type}`;
}

export const UNIT_SPRITE_KEYS: SpriteMapping = {
  [createUnitSpriteKey(Faction.USA, UnitType.SOLDIER)]: 'usa_soldier',
  [createUnitSpriteKey(Faction.USA, UnitType.ENGINEER)]: 'usa_engineer',
  [createUnitSpriteKey(Faction.USA, UnitType.ROCKET)]: 'usa_rocket',
  [createUnitSpriteKey(Faction.USA, UnitType.SEAL)]: 'usa_seal',
  [createUnitSpriteKey(Faction.USA, UnitType.TANYA)]: 'usa_tanya',
  [createUnitSpriteKey(Faction.USA, UnitType.TANK)]: 'usa_tank',
  [createUnitSpriteKey(Faction.USA, UnitType.IFV)]: 'usa_ifv',
  [createUnitSpriteKey(Faction.USA, UnitType.PRISM)]: 'usa_prism',
  [createUnitSpriteKey(Faction.USA, UnitType.MINER)]: 'usa_miner',
  [createUnitSpriteKey(Faction.USA, UnitType.HELICOPTER)]: 'usa_helicopter',
  [createUnitSpriteKey(Faction.USA, UnitType.BLACKHAWK)]: 'usa_blackhawk',
  [createUnitSpriteKey(Faction.USA, UnitType.CHRONO)]: 'usa_chrono',
  [createUnitSpriteKey(Faction.USA, UnitType.SPY)]: 'usa_spy',
  [createUnitSpriteKey(Faction.USA, UnitType.GUARDIAN)]: 'usa_guardian',
  [createUnitSpriteKey(Faction.USA, UnitType.DESTROYER)]: 'usa_destroyer',
  [createUnitSpriteKey(Faction.USA, UnitType.TRANSPORT_SHIP)]: 'usa_transport_ship',
  [createUnitSpriteKey(Faction.USA, UnitType.MCV)]: 'usa_mcv',
  [createUnitSpriteKey(Faction.USA, UnitType.GI)]: 'usa_gi',
  [createUnitSpriteKey(Faction.USA, UnitType.GUARDIAN_GI)]: 'usa_guardian_gi',
  [createUnitSpriteKey(Faction.USA, UnitType.GRIZZLY)]: 'usa_grizzly',
  [createUnitSpriteKey(Faction.USA, UnitType.MIRAGE)]: 'usa_mirage',
  [createUnitSpriteKey(Faction.USA, UnitType.AEGIS)]: 'usa_aegis',
  [createUnitSpriteKey(Faction.USA, UnitType.ATTACK_DOG)]: 'usa_attack_dog',
  [createUnitSpriteKey(Faction.USA, UnitType.DOLPHIN)]: 'allied_dolphin',
  [createUnitSpriteKey(Faction.USA, UnitType.CARRIER)]: 'allied_carrier',
  [createUnitSpriteKey(Faction.USA, UnitType.CHRONO_MINER)]: 'allied_chrono_miner',
  [createUnitSpriteKey(Faction.USA, UnitType.HARRIER)]: 'allied_harrier',

  [createUnitSpriteKey(Faction.BRITAIN, UnitType.SOLDIER)]: 'britain_soldier',
  [createUnitSpriteKey(Faction.BRITAIN, UnitType.SNIPER)]: 'britain_sniper',
  [createUnitSpriteKey(Faction.BRITAIN, UnitType.TANK)]: 'britain_tank',
  [createUnitSpriteKey(Faction.BRITAIN, UnitType.MINER)]: 'britain_miner',

  [createUnitSpriteKey(Faction.GERMANY, UnitType.SOLDIER)]: 'germany_soldier',
  [createUnitSpriteKey(Faction.GERMANY, UnitType.TESLA)]: 'germany_tesla',
  [createUnitSpriteKey(Faction.GERMANY, UnitType.TANK)]: 'germany_tank',
  [createUnitSpriteKey(Faction.GERMANY, UnitType.MINER)]: 'germany_miner',

  [createUnitSpriteKey(Faction.FRANCE, UnitType.SOLDIER)]: 'france_soldier',
  [createUnitSpriteKey(Faction.FRANCE, UnitType.PHANTOM)]: 'france_phantom',
  [createUnitSpriteKey(Faction.FRANCE, UnitType.TANK)]: 'france_tank',
  [createUnitSpriteKey(Faction.FRANCE, UnitType.MINER)]: 'france_miner',

  [createUnitSpriteKey(Faction.KOREA, UnitType.SOLDIER)]: 'korea_soldier',
  [createUnitSpriteKey(Faction.KOREA, UnitType.BLACKHAWK)]: 'korea_blackhawk',
  [createUnitSpriteKey(Faction.KOREA, UnitType.TANK)]: 'korea_tank',
  [createUnitSpriteKey(Faction.KOREA, UnitType.MINER)]: 'korea_miner',

  [createUnitSpriteKey(Faction.SOVIET, UnitType.SOLDIER)]: 'soviet_soldier',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.ENGINEER)]: 'soviet_engineer',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.ROCKET)]: 'soviet_rocket',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.RHINO)]: 'soviet_rhino',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.APOCALYPSE)]: 'soviet_apocalypse',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.TESLA)]: 'soviet_tesla',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.MINER)]: 'soviet_miner',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.HELICOPTER)]: 'soviet_helicopter',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.KIROV)]: 'soviet_kirov',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.APC)]: 'soviet_apc',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.CONSCRIPT)]: 'soviet_conscript',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.FLAKINFANTRY)]: 'soviet_flakinfantry',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.DESPOT)]: 'soviet_despot',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.FLAK)]: 'soviet_flak',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.SUBMARINE)]: 'soviet_submarine',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.TRANSPORT_SHIP)]: 'soviet_transport_ship',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.YAK)]: 'soviet_yak',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.MCV)]: 'soviet_mcv',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.WAR_MINER)]: 'soviet_war_miner',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.LASH)]: 'soviet_lash',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.DREADNOUGHT)]: 'soviet_dreadnought',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.BRUTE)]: 'soviet_brute',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.DISC)]: 'soviet_disc',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.BOOMER)]: 'soviet_boomer',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.GATTLING_TANK)]: 'soviet_gattling_tank',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.SLAVE_MINER)]: 'soviet_slave_miner',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.ATTACK_DOG)]: 'soviet_attack_dog',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.SQUID)]: 'soviet_squid',
  [createUnitSpriteKey(Faction.SOVIET, UnitType.V3_ROCKET)]: 'soviet_v3_rocket',

  [createUnitSpriteKey(Faction.CUBA, UnitType.SOLDIER)]: 'cuba_soldier',
  [createUnitSpriteKey(Faction.CUBA, UnitType.TERRORIST)]: 'cuba_terrorist',
  [createUnitSpriteKey(Faction.CUBA, UnitType.TANK)]: 'cuba_tank',
  [createUnitSpriteKey(Faction.CUBA, UnitType.MINER)]: 'cuba_miner',
  [createUnitSpriteKey(Faction.CUBA, UnitType.ENGINEER)]: 'cuba_engineer',
  [createUnitSpriteKey(Faction.CUBA, UnitType.ROCKET)]: 'cuba_rocket',
  [createUnitSpriteKey(Faction.CUBA, UnitType.FLAKINFANTRY)]: 'cuba_flakinfantry',
  [createUnitSpriteKey(Faction.CUBA, UnitType.FLAK)]: 'cuba_flak',

  [createUnitSpriteKey(Faction.LIBYA, UnitType.SOLDIER)]: 'libya_soldier',
  [createUnitSpriteKey(Faction.LIBYA, UnitType.IVAN)]: 'libya_ivan',
  [createUnitSpriteKey(Faction.LIBYA, UnitType.TANK)]: 'libya_tank',
  [createUnitSpriteKey(Faction.LIBYA, UnitType.MINER)]: 'libya_miner',
  [createUnitSpriteKey(Faction.LIBYA, UnitType.ENGINEER)]: 'libya_engineer',
  [createUnitSpriteKey(Faction.LIBYA, UnitType.ROCKET)]: 'libya_rocket',
  [createUnitSpriteKey(Faction.LIBYA, UnitType.FLAKINFANTRY)]: 'libya_flakinfantry',
  [createUnitSpriteKey(Faction.LIBYA, UnitType.FLAK)]: 'libya_flak',

  [createUnitSpriteKey(Faction.IRAQ, UnitType.SOLDIER)]: 'iraq_soldier',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.ROCKET)]: 'iraq_rocket',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.RHINO)]: 'iraq_rhino',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.TESLA)]: 'iraq_tesla',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.MINER)]: 'iraq_miner',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.ENGINEER)]: 'iraq_engineer',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.FLAKINFANTRY)]: 'iraq_flakinfantry',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.DESPOT)]: 'iraq_despot',
  [createUnitSpriteKey(Faction.IRAQ, UnitType.FLAK)]: 'iraq_flak',
};

export const BUILDING_SPRITE_KEYS: SpriteMapping = {
  [createBuildingSpriteKey(Faction.USA, BuildingType.COMMAND)]: 'usa_command',
  [createBuildingSpriteKey(Faction.USA, BuildingType.BARRACKS)]: 'usa_barracks',
  [createBuildingSpriteKey(Faction.USA, BuildingType.REFINERY)]: 'usa_refinery',
  [createBuildingSpriteKey(Faction.USA, BuildingType.WARFACTORY)]: 'usa_warfactory',
  [createBuildingSpriteKey(Faction.USA, BuildingType.POWER)]: 'usa_power',
  [createBuildingSpriteKey(Faction.USA, BuildingType.RADAR)]: 'usa_radar',
  [createBuildingSpriteKey(Faction.USA, BuildingType.TECH)]: 'usa_tech',
  [createBuildingSpriteKey(Faction.USA, BuildingType.REPAIR)]: 'usa_repair',
  [createBuildingSpriteKey(Faction.USA, BuildingType.HELIPAD)]: 'usa_airfield',
  [createBuildingSpriteKey(Faction.USA, BuildingType.WALL)]: 'usa_wall',
  [createBuildingSpriteKey(Faction.USA, BuildingType.TURRET)]: 'usa_turret',
  [createBuildingSpriteKey(Faction.USA, BuildingType.DEFENSE)]: 'usa_defense',
  [createBuildingSpriteKey(Faction.USA, BuildingType.AIRFIELD)]: 'usa_airfield',
  [createBuildingSpriteKey(Faction.USA, BuildingType.CHRONOSPHERE)]: 'usa_chronosphere',
  [createBuildingSpriteKey(Faction.USA, BuildingType.NAVAL_SHIPYARD)]: 'usa_naval_shipyard',
  [createBuildingSpriteKey(Faction.USA, BuildingType.GAP_GENERATOR)]: 'allied_gap_generator',
  [createBuildingSpriteKey(Faction.USA, BuildingType.SPY_SATELLITE)]: 'allied_spy_satellite',
  [createBuildingSpriteKey(Faction.USA, BuildingType.ORE_PURIFIER)]: 'allied_ore_purifier',
  [createBuildingSpriteKey(Faction.USA, BuildingType.GRAND_CANNON)]: 'allied_grand_cannon',

  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.COMMAND)]: 'soviet_command',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.BARRACKS)]: 'soviet_barracks',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.REFINERY)]: 'soviet_refinery',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.WARFACTORY)]: 'soviet_warfactory',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.POWER)]: 'soviet_power',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.RADAR)]: 'soviet_radar',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.TECH)]: 'soviet_tech',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.REPAIR)]: 'soviet_repair',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.TESLA_COIL)]: 'soviet_teslacoil',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.WALL)]: 'soviet_wall',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.DEFENSE)]: 'soviet_defense',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.AIRFIELD)]: 'soviet_airfield',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.HELIPAD)]: 'soviet_airfield',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.TURRET)]: 'soviet_turret',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.FLAME_TOWER)]: 'soviet_flame_tower',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.NUCLEAR_SILO)]: 'soviet_nuclear_silo',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.IRON_CURTAIN)]: 'soviet_iron_curtain',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.NAVAL_SHIPYARD)]: 'soviet_naval_shipyard',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.NUCLEAR_REACTOR)]: 'soviet_nuclear_reactor',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.FLAK_CANNON)]: 'soviet_flak_cannon',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.SENTRY_GUN)]: 'soviet_turret',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.BATTLE_BUNKER)]: 'soviet_defense',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.CLONING_VATS)]: 'soviet_tech',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.INDUSTRIAL_PLANT)]: 'soviet_warfactory',
  [createBuildingSpriteKey(Faction.SOVIET, BuildingType.PSYCHIC_SENSOR)]: 'soviet_radar',
  [createBuildingSpriteKey(Faction.USA, BuildingType.PATRIOT)]: 'allied_patriot',
  [createBuildingSpriteKey(Faction.NEUTRAL, BuildingType.CIVILIAN_BUILDING)]: 'neutral_civilian_building',
  [createBuildingSpriteKey(Faction.NEUTRAL, BuildingType.BIOLAB)]: 'neutral_civilian_building',
  [createBuildingSpriteKey(Faction.NEUTRAL, BuildingType.MACHINE_SHOP)]: 'neutral_civilian_building',
  [createBuildingSpriteKey(Faction.NEUTRAL, BuildingType.BRIDGE)]: 'neutral_bridge',
  [createBuildingSpriteKey(Faction.NEUTRAL, BuildingType.BRIDGE_DESTROYED)]: 'neutral_bridge_destroyed',

  // Allied sub-factions share building sprites
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.COMMAND)]: 'usa_command',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.BARRACKS)]: 'usa_barracks',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.REFINERY)]: 'usa_refinery',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.WARFACTORY)]: 'usa_warfactory',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.POWER)]: 'usa_power',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.RADAR)]: 'usa_radar',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.TECH)]: 'usa_tech',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.REPAIR)]: 'usa_repair',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.WALL)]: 'usa_wall',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.TURRET)]: 'usa_turret',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.DEFENSE)]: 'usa_defense',
  [createBuildingSpriteKey(Faction.BRITAIN, BuildingType.AIRFIELD)]: 'usa_airfield',

  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.COMMAND)]: 'usa_command',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.BARRACKS)]: 'usa_barracks',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.REFINERY)]: 'usa_refinery',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.WARFACTORY)]: 'usa_warfactory',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.POWER)]: 'usa_power',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.RADAR)]: 'usa_radar',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.TECH)]: 'usa_tech',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.REPAIR)]: 'usa_repair',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.WALL)]: 'usa_wall',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.TURRET)]: 'usa_turret',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.DEFENSE)]: 'usa_defense',
  [createBuildingSpriteKey(Faction.GERMANY, BuildingType.AIRFIELD)]: 'usa_airfield',

  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.COMMAND)]: 'usa_command',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.BARRACKS)]: 'usa_barracks',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.REFINERY)]: 'usa_refinery',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.WARFACTORY)]: 'usa_warfactory',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.POWER)]: 'usa_power',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.RADAR)]: 'usa_radar',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.TECH)]: 'usa_tech',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.REPAIR)]: 'usa_repair',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.WALL)]: 'usa_wall',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.TURRET)]: 'usa_turret',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.DEFENSE)]: 'usa_defense',
  [createBuildingSpriteKey(Faction.FRANCE, BuildingType.AIRFIELD)]: 'usa_airfield',

  [createBuildingSpriteKey(Faction.KOREA, BuildingType.COMMAND)]: 'usa_command',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.BARRACKS)]: 'usa_barracks',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.REFINERY)]: 'usa_refinery',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.WARFACTORY)]: 'usa_warfactory',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.POWER)]: 'usa_power',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.RADAR)]: 'usa_radar',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.TECH)]: 'usa_tech',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.REPAIR)]: 'usa_repair',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.WALL)]: 'usa_wall',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.TURRET)]: 'usa_turret',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.DEFENSE)]: 'usa_defense',
  [createBuildingSpriteKey(Faction.KOREA, BuildingType.AIRFIELD)]: 'usa_airfield',

  // Soviet sub-factions share building sprites
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.COMMAND)]: 'soviet_command',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.BARRACKS)]: 'soviet_barracks',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.REFINERY)]: 'soviet_refinery',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.WARFACTORY)]: 'soviet_warfactory',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.POWER)]: 'soviet_power',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.RADAR)]: 'soviet_radar',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.TECH)]: 'soviet_tech',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.REPAIR)]: 'soviet_repair',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.WALL)]: 'soviet_wall',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.TURRET)]: 'soviet_turret',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.DEFENSE)]: 'soviet_defense',
  [createBuildingSpriteKey(Faction.CUBA, BuildingType.AIRFIELD)]: 'soviet_airfield',

  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.COMMAND)]: 'soviet_command',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.BARRACKS)]: 'soviet_barracks',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.REFINERY)]: 'soviet_refinery',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.WARFACTORY)]: 'soviet_warfactory',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.POWER)]: 'soviet_power',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.RADAR)]: 'soviet_radar',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.TECH)]: 'soviet_tech',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.REPAIR)]: 'soviet_repair',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.WALL)]: 'soviet_wall',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.TURRET)]: 'soviet_turret',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.DEFENSE)]: 'soviet_defense',
  [createBuildingSpriteKey(Faction.LIBYA, BuildingType.AIRFIELD)]: 'soviet_airfield',

  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.COMMAND)]: 'soviet_command',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.BARRACKS)]: 'soviet_barracks',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.REFINERY)]: 'soviet_refinery',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.WARFACTORY)]: 'soviet_warfactory',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.POWER)]: 'soviet_power',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.RADAR)]: 'soviet_radar',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.TECH)]: 'soviet_tech',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.REPAIR)]: 'soviet_repair',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.WALL)]: 'soviet_wall',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.TURRET)]: 'soviet_turret',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.DEFENSE)]: 'soviet_defense',
  [createBuildingSpriteKey(Faction.IRAQ, BuildingType.AIRFIELD)]: 'soviet_airfield',
};

const _ALLIED_UNIT_FALLBACKS: Record<string, string> = {
  usa_soldier: 'allied_soldier',
  usa_engineer: 'allied_engineer',
  usa_rocket: 'allied_rocket',
  usa_seal: 'allied_soldier',
  usa_tanya: 'allied_soldier',
  usa_tank: 'allied_tank',
  usa_ifv: 'allied_ifv',
  usa_prism: 'allied_tank',
  usa_miner: 'allied_miner',
  usa_helicopter: 'allied_helicopter',
  usa_blackhawk: 'allied_helicopter',
  usa_chrono: 'allied_soldier',
  usa_spy: 'allied_spy',
  usa_guardian: 'allied_tank',
  usa_destroyer: 'allied_tank',
  usa_transport_ship: 'allied_miner',
  britain_soldier: 'allied_soldier',
  britain_sniper: 'allied_sniper',
  britain_tank: 'allied_tank',
  britain_miner: 'allied_miner',
  germany_soldier: 'allied_soldier',
  germany_tesla: 'soviet_tesla',
  germany_tank: 'allied_tank',
  germany_miner: 'allied_miner',
  france_soldier: 'allied_soldier',
  france_phantom: 'allied_helicopter',
  france_tank: 'allied_tank',
  france_miner: 'allied_miner',
  korea_soldier: 'allied_soldier',
  korea_blackhawk: 'allied_helicopter',
  korea_tank: 'allied_tank',
  korea_miner: 'allied_miner',
  soviet_apc: 'soviet_tank',
  soviet_conscript: 'soviet_soldier',
  soviet_flakinfantry: 'soviet_rocket',
  soviet_despot: 'soviet_tank',
  soviet_flak: 'soviet_tank',
  soviet_submarine: 'soviet_tank',
  soviet_transport_ship: 'soviet_miner',
  soviet_yak: 'soviet_helicopter',
  cuba_soldier: 'soviet_soldier',
  cuba_terrorist: 'soviet_soldier',
  cuba_tank: 'soviet_tank',
  cuba_miner: 'soviet_miner',
  cuba_engineer: 'soviet_engineer',
  cuba_rocket: 'soviet_rocket',
  cuba_flakinfantry: 'soviet_rocket',
  cuba_flak: 'soviet_tank',
  libya_soldier: 'soviet_soldier',
  libya_ivan: 'soviet_soldier',
  libya_tank: 'soviet_tank',
  libya_miner: 'soviet_miner',
  libya_engineer: 'soviet_engineer',
  libya_rocket: 'soviet_rocket',
  libya_flakinfantry: 'soviet_rocket',
  libya_flak: 'soviet_tank',
  iraq_soldier: 'soviet_soldier',
  iraq_rocket: 'soviet_rocket',
  iraq_rhino: 'soviet_tank',
  iraq_tesla: 'soviet_tesla',
  iraq_miner: 'soviet_miner',
  iraq_engineer: 'soviet_engineer',
  iraq_flakinfantry: 'soviet_rocket',
  iraq_despot: 'soviet_tank',
  iraq_flak: 'soviet_tank',
};

const _ALLIED_BUILDING_FALLBACKS: Record<string, string> = {
  usa_command: 'allied_command',
  usa_barracks: 'allied_barracks',
  usa_refinery: 'allied_refinery',
  usa_warfactory: 'allied_warfactory',
  usa_power: 'allied_power',
  usa_radar: 'allied_radar',
  usa_tech: 'allied_tech',
  usa_repair: 'allied_repair',
  usa_helipad: 'allied_warfactory',
  usa_wall: 'allied_wall',
  usa_turret: 'allied_warfactory',
  usa_defense: 'allied_warfactory',
  soviet_teslacoil: 'soviet_radar',
  soviet_turret: 'soviet_radar',
  soviet_defense: 'soviet_radar',
};

export const SPRITE_PATHS = {
  units: {
    usa_soldier: '/assets/sprites/units/allied_soldier.png',
    usa_engineer: '/assets/sprites/units/allied_engineer.png',
    usa_rocket: '/assets/sprites/units/allied_rocket.png',
    usa_seal: '/assets/sprites/units/allied_soldier.png',
    usa_tanya: '/assets/sprites/units/allied_tanya.png',
    usa_tank: '/assets/sprites/units/allied_tank.png',
    usa_ifv: '/assets/sprites/units/allied_ifv.png',
    usa_prism: '/assets/sprites/units/allied_prism.png',
    usa_miner: '/assets/sprites/units/allied_miner.png',
    usa_helicopter: '/assets/sprites/units/allied_helicopter.png',
    usa_blackhawk: '/assets/sprites/units/allied_helicopter.png',
    usa_chrono: '/assets/sprites/units/allied_soldier.png',
    usa_spy: '/assets/sprites/units/allied_spy.png',
    usa_guardian: '/assets/sprites/units/allied_guardian.png',
    usa_destroyer: '/assets/sprites/units/allied_destroyer.png',
    usa_transport_ship: '/assets/sprites/units/allied_transport_ship.png',
    usa_mcv: '/assets/sprites/units/allied_mcv.png',
    usa_gi: '/assets/sprites/units/allied_gi.png',
    usa_guardian_gi: '/assets/sprites/units/allied_guardian_gi.png',
    usa_grizzly: '/assets/sprites/units/allied_grizzly.png',
    usa_mirage: '/assets/sprites/units/allied_mirage.png',
    usa_aegis: '/assets/sprites/units/allied_aegis.png',
    usa_attack_dog: '/assets/sprites/units/soviet_attack_dog.png',
    allied_dolphin: '/assets/sprites/units/allied_dolphin.png',
    allied_carrier: '/assets/sprites/units/allied_carrier.png',
    allied_chrono_miner: '/assets/sprites/units/allied_chrono_miner.png',
    allied_harrier: '/assets/sprites/units/allied_harrier.png',

    britain_soldier: '/assets/sprites/units/allied_soldier.png',
    britain_sniper: '/assets/sprites/units/allied_sniper.png',
    britain_tank: '/assets/sprites/units/allied_tank.png',
    britain_miner: '/assets/sprites/units/allied_miner.png',

    germany_soldier: '/assets/sprites/units/allied_soldier.png',
    germany_tesla: '/assets/sprites/units/soviet_tesla.png',
    germany_tank: '/assets/sprites/units/allied_tank.png',
    germany_miner: '/assets/sprites/units/allied_miner.png',

    france_soldier: '/assets/sprites/units/allied_soldier.png',
    france_phantom: '/assets/sprites/units/allied_phantom.png',
    france_tank: '/assets/sprites/units/allied_tank.png',
    france_miner: '/assets/sprites/units/allied_miner.png',

    korea_soldier: '/assets/sprites/units/allied_soldier.png',
    korea_blackhawk: '/assets/sprites/units/allied_helicopter.png',
    korea_tank: '/assets/sprites/units/allied_tank.png',
    korea_miner: '/assets/sprites/units/allied_miner.png',

    soviet_soldier: '/assets/sprites/units/soviet_soldier.png',
    soviet_engineer: '/assets/sprites/units/soviet_engineer.png',
    soviet_rocket: '/assets/sprites/units/soviet_rocket.png',
    soviet_rhino: '/assets/sprites/units/soviet_tank.png',
    soviet_apocalypse: '/assets/sprites/units/soviet_apocalypse.png',
    soviet_tesla: '/assets/sprites/units/soviet_tesla.png',
    soviet_miner: '/assets/sprites/units/soviet_miner.png',
    soviet_helicopter: '/assets/sprites/units/soviet_helicopter.png',
    soviet_kirov: '/assets/sprites/units/soviet_helicopter.png',
    soviet_apc: '/assets/sprites/units/soviet_tank.png',
    soviet_conscript: '/assets/sprites/units/soviet_conscript.png',
    soviet_flakinfantry: '/assets/sprites/units/soviet_flakinfantry.png',
    soviet_despot: '/assets/sprites/units/soviet_despot.png',
    soviet_flak: '/assets/sprites/units/soviet_flak.png',
    soviet_submarine: '/assets/sprites/units/soviet_submarine.png',
    soviet_transport_ship: '/assets/sprites/units/allied_transport_ship.png',
    soviet_yak: '/assets/sprites/units/soviet_yak.png',
    soviet_mcv: '/assets/sprites/units/soviet_mcv.png',
    soviet_war_miner: '/assets/sprites/units/soviet_war_miner.png',
    soviet_lash: '/assets/sprites/units/soviet_lash.png',
    soviet_dreadnought: '/assets/sprites/units/soviet_dreadnought.png',
    soviet_brute: '/assets/sprites/units/soviet_brute.png',
    soviet_disc: '/assets/sprites/units/soviet_disc.png',
    soviet_boomer: '/assets/sprites/units/soviet_boomer.png',
    soviet_gattling_tank: '/assets/sprites/units/soviet_gattling_tank.png',
    soviet_slave_miner: '/assets/sprites/units/soviet_slave_miner.png',
    soviet_attack_dog: '/assets/sprites/units/soviet_attack_dog.png',
    soviet_squid: '/assets/sprites/units/soviet_squid.png',
    soviet_v3_rocket: '/assets/sprites/units/soviet_v3_rocket.png',

    cuba_soldier: '/assets/sprites/units/soviet_soldier.png',
    cuba_terrorist: '/assets/sprites/units/soviet_soldier.png',
    cuba_tank: '/assets/sprites/units/soviet_tank.png',
    cuba_miner: '/assets/sprites/units/soviet_miner.png',
    cuba_engineer: '/assets/sprites/units/soviet_engineer.png',
    cuba_rocket: '/assets/sprites/units/soviet_rocket.png',
    cuba_flakinfantry: '/assets/sprites/units/soviet_flakinfantry.png',
    cuba_flak: '/assets/sprites/units/soviet_flak.png',

    libya_soldier: '/assets/sprites/units/soviet_soldier.png',
    libya_ivan: '/assets/sprites/units/soviet_soldier.png',
    libya_tank: '/assets/sprites/units/soviet_tank.png',
    libya_miner: '/assets/sprites/units/soviet_miner.png',
    libya_engineer: '/assets/sprites/units/soviet_engineer.png',
    libya_rocket: '/assets/sprites/units/soviet_rocket.png',
    libya_flakinfantry: '/assets/sprites/units/soviet_flakinfantry.png',
    libya_flak: '/assets/sprites/units/soviet_flak.png',

    iraq_soldier: '/assets/sprites/units/soviet_soldier.png',
    iraq_rocket: '/assets/sprites/units/soviet_rocket.png',
    iraq_rhino: '/assets/sprites/units/soviet_tank.png',
    iraq_tesla: '/assets/sprites/units/soviet_tesla.png',
    iraq_miner: '/assets/sprites/units/soviet_miner.png',
    iraq_engineer: '/assets/sprites/units/soviet_engineer.png',
    iraq_flakinfantry: '/assets/sprites/units/soviet_flakinfantry.png',
    iraq_despot: '/assets/sprites/units/soviet_despot.png',
    iraq_flak: '/assets/sprites/units/soviet_flak.png',
  },
  buildings: {
    usa_command: '/assets/sprites/buildings/allied_command.png',
    usa_barracks: '/assets/sprites/buildings/allied_barracks.png',
    usa_refinery: '/assets/sprites/buildings/allied_refinery.png',
    usa_warfactory: '/assets/sprites/buildings/allied_warfactory.png',
    usa_power: '/assets/sprites/buildings/allied_power.png',
    usa_radar: '/assets/sprites/buildings/allied_radar.png',
    usa_tech: '/assets/sprites/buildings/allied_tech.png',
    usa_repair: '/assets/sprites/buildings/allied_repair.png',
    usa_helipad: '/assets/sprites/buildings/allied_warfactory.png',
    usa_wall: '/assets/sprites/buildings/allied_wall.png',
    usa_turret: '/assets/sprites/buildings/allied_warfactory.png',

    soviet_command: '/assets/sprites/buildings/soviet_command.png',
    soviet_barracks: '/assets/sprites/buildings/soviet_barracks.png',
    soviet_refinery: '/assets/sprites/buildings/soviet_refinery.png',
    soviet_warfactory: '/assets/sprites/buildings/soviet_warfactory.png',
    soviet_power: '/assets/sprites/buildings/soviet_power.png',
    soviet_radar: '/assets/sprites/buildings/soviet_radar.png',
    soviet_tech: '/assets/sprites/buildings/soviet_tech.png',
    soviet_repair: '/assets/sprites/buildings/soviet_repair.png',
    soviet_teslacoil: '/assets/sprites/buildings/soviet_teslacoil.png',
    soviet_wall: '/assets/sprites/buildings/soviet_wall.png',
    soviet_turret: '/assets/sprites/buildings/soviet_defense.png',
    soviet_defense: '/assets/sprites/buildings/soviet_defense.png',
    soviet_airfield: '/assets/sprites/buildings/soviet_airfield.png',
    usa_defense: '/assets/sprites/buildings/allied_defense.png',
    usa_airfield: '/assets/sprites/buildings/allied_airfield.png',
    usa_chronosphere: '/assets/sprites/buildings/allied_chronosphere.png',
    usa_naval_shipyard: '/assets/sprites/buildings/allied_naval_shipyard.png',

    soviet_flame_tower: '/assets/sprites/buildings/soviet_flame_tower.png',
    soviet_nuclear_silo: '/assets/sprites/buildings/soviet_nuclear_silo.png',
    soviet_iron_curtain: '/assets/sprites/buildings/soviet_iron_curtain.png',
    soviet_naval_shipyard: '/assets/sprites/buildings/soviet_naval_shipyard.png',

    // New building sprites
    allied_patriot: '/assets/sprites/buildings/allied_patriot.png',
    soviet_sentry_gun: '/assets/sprites/buildings/soviet_sentry_gun.png',
    soviet_battle_bunker: '/assets/sprites/buildings/soviet_battle_bunker.png',
    soviet_cloning_vats: '/assets/sprites/buildings/soviet_cloning_vats.png',
    soviet_industrial_plant: '/assets/sprites/buildings/soviet_industrial_plant.png',
    soviet_psychic_sensor: '/assets/sprites/buildings/soviet_psychic_sensor.png',
    neutral_civilian_building: '/assets/sprites/buildings/neutral_civilian_building.png',
    neutral_biolab: '/assets/sprites/buildings/neutral_biolab.png',
    neutral_machine_shop: '/assets/sprites/buildings/neutral_machine_shop.png',
    neutral_bridge: '/assets/sprites/buildings/neutral_bridge.png',
    neutral_bridge_destroyed: '/assets/sprites/buildings/neutral_bridge_destroyed.png',
    allied_gap_generator: '/assets/sprites/buildings/allied_gap_generator.png',
    soviet_nuclear_reactor: '/assets/sprites/buildings/soviet_nuclear_reactor.png',
    soviet_flak_cannon: '/assets/sprites/buildings/soviet_flak_cannon.png',
    allied_spy_satellite: '/assets/sprites/buildings/allied_spy_satellite.png',
    allied_ore_purifier: '/assets/sprites/buildings/allied_ore_purifier.png',
    allied_grand_cannon: '/assets/sprites/buildings/allied_grand_cannon.png',
  }
};

export function createPhaserConfig(
  parent: HTMLElement,
  width: number,
  height: number
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width,
    height,
    parent,
    backgroundColor: '#1a472a',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    render: {
      pixelArt: true,
      antialias: false,
      powerPreference: 'high-performance',
      mipmapFilter: 'nearest',
      batchSize: 4096,
      preserveDrawingBuffer: true,  // Enable for E2E testing pixel readback
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    } as Phaser.Types.Core.ScaleConfig
  };
}

export function getUnitSpriteKey(faction: Faction, type: UnitType): string {
  return UNIT_SPRITE_KEYS[`${faction}_${type}`] || 'allied_soldier';
}

export function getBuildingSpriteKey(faction: Faction, type: BuildingType): string {
  const key = BUILDING_SPRITE_KEYS[`${faction}_${type}`];
  if (key) return key;
  // Fallback: use the parent faction's command center sprite
  const parentFaction = [Faction.BRITAIN, Faction.GERMANY, Faction.FRANCE, Faction.KOREA].includes(faction)
    ? Faction.USA
    : [Faction.CUBA, Faction.LIBYA, Faction.IRAQ].includes(faction)
    ? Faction.SOVIET
    : faction;
  return BUILDING_SPRITE_KEYS[`${parentFaction}_command`] || 'usa_command';
}