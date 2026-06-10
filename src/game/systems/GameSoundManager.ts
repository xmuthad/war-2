import Phaser from 'phaser';
import { gameEventBus } from './GameEventBus';
import { UnitType, Vector2 } from '../../types';

/**
 * Categories of sounds in the game
 * @public
 */
export type SoundCategory = 'ui' | 'combat' | 'movement' | 'building' | 'ambient' | 'voice';

/**
 * Configuration for sound system
 * @public
 */
export interface SoundConfig {
  /** Master volume (0-1) */
  volume: number;
  /** Whether sounds are muted */
  muted: boolean;
  /** Whether sound effects are enabled */
  enableSounds: boolean;
  /** Whether background music is enabled */
  enableMusic: boolean;
}

/**
 * Default sound configuration
 * @public
 */
export const SOUND_CONFIG: SoundConfig = {
  volume: 0.7,
  muted: false,
  enableSounds: true,
  enableMusic: true
};

/**
 * Represents a sound effect definition
 * @public
 */
export interface SoundEffect {
  /** Unique key for the sound */
  key: string;
  /** Category this sound belongs to */
  category: SoundCategory;
  /** Base volume (0-1) */
  volume?: number;
  /** Playback rate multiplier */
  rate?: number;
  /** Whether to loop the sound */
  loops?: boolean;
}

/**
 * Represents a voice line definition
 * @public
 */
export interface VoiceLine {
  /** Unique key for the voice line */
  key: string;
  /** Category of the voice line */
  category: 'acknowledgement' | 'command' | 'attack' | 'help' | 'death';
  /** Probability of playing (0-1) */
  probability?: number;
}

/**
 * Default sound effects configuration
 * @public
 */
export const SOUND_EFFECTS: Record<string, SoundEffect> = {
  uiClick: { key: 'ui_click', category: 'ui', volume: 0.5 },
  uiSelect: { key: 'ui_select', category: 'ui', volume: 0.6 },
  uiError: { key: 'ui_error', category: 'ui', volume: 0.4 },
  unitMove: { key: 'unit_move', category: 'movement', volume: 0.5 },
  unitAttack: { key: 'unit_attack', category: 'combat', volume: 0.7 },
  unitSelect: { key: 'unit_select', category: 'ui', volume: 0.6 },
  unitDestroyed: { key: 'unit_destroyed', category: 'combat', volume: 0.8 },
  buildingPlace: { key: 'building_place', category: 'building', volume: 0.6 },
  buildingComplete: { key: 'building_complete', category: 'building', volume: 0.7 },
  buildingStart: { key: 'building_start', category: 'building', volume: 0.5 },
  resourceCollect: { key: 'resource_collect', category: 'building', volume: 0.3 },
  explosion: { key: 'explosion', category: 'combat', volume: 0.8 },
  bullet: { key: 'bullet', category: 'combat', volume: 0.4 },
  radarPing: { key: 'radar_ping', category: 'ui', volume: 0.5 },
  alert: { key: 'alert', category: 'combat', volume: 0.7 },
  upgradeComplete: { key: 'upgrade_complete', category: 'building', volume: 0.6 },
  empAttack: { key: 'emp', category: 'combat', volume: 0.7 },
  resourceDepleted: { key: 'click', category: 'ui', volume: 0.5 },
  chronoShift: { key: 'teleport', category: 'combat', volume: 0.6 },
  buildingDestroyed: { key: 'building_destroyed', category: 'combat', volume: 0.6 },
  buildingHit: { key: 'building_hit', category: 'combat', volume: 0.5 },
  superweaponCharging: { key: 'superweapon_charging', category: 'combat', volume: 0.7 },
  superweaponLaunch: { key: 'superweapon_launch', category: 'combat', volume: 0.8 },
  unitProduced: { key: 'unit_produced', category: 'building', volume: 0.4 },
  oreDeposit: { key: 'ore_deposit', category: 'building', volume: 0.3 },
  lowPower: { key: 'low_power', category: 'ui', volume: 0.5 },
  baseUnderAttack: { key: 'base_under_attack', category: 'combat', volume: 0.7 },
  upgradeStarted: { key: 'upgrade_started', category: 'building', volume: 0.4 },
  nukeExplosion: { key: 'nuke_explosion', category: 'combat', volume: 0.9 },
  ironCurtain: { key: 'iron_curtain', category: 'combat', volume: 0.6 },
  chronosphere: { key: 'chronosphere', category: 'combat', volume: 0.6 }
};

/**
 * Default voice lines configuration
 * @public
 */
export const VOICE_LINES: Record<string, VoiceLine> = {
  ack1: { key: 'voice_ack_1', category: 'acknowledgement', probability: 0.3 },
  ack2: { key: 'voice_ack_2', category: 'acknowledgement', probability: 0.3 },
  ack3: { key: 'voice_ack_3', category: 'acknowledgement', probability: 0.3 },
  move1: { key: 'voice_move_1', category: 'command', probability: 0.4 },
  move2: { key: 'voice_move_2', category: 'command', probability: 0.3 },
  attack1: { key: 'voice_attack_1', category: 'attack', probability: 0.5 },
  attack2: { key: 'voice_attack_2', category: 'attack', probability: 0.3 },
  help1: { key: 'voice_help_1', category: 'help', probability: 0.6 },
  death1: { key: 'voice_death_1', category: 'death', probability: 0.8 }
};

/**
 * Voice events that units can trigger
 * @public
 */
export enum UnitVoiceEvent {
  SELECT = 'select',
  MOVE = 'move',
  ATTACK = 'attack',
  UNDER_FIRE = 'under_fire',
  LOW_HEALTH = 'low_health',
  KILL = 'kill',
  PROMOTED = 'promoted',
  GARRISON = 'garrison',
  UNGARRISON = 'ungarrison',
  DEPLOY = 'deploy',
  SPECIAL = 'special',
  BUILT = 'built',
}

/**
 * Helper to generate voice file paths for a unit type.
 * Each event gets 2-3 variant files for variety.
 * @internal
 */
function voiceFiles(unitType: string, event: UnitVoiceEvent, count: number = 2): string[] {
  const files: string[] = [];
  for (let i = 1; i <= count; i++) {
    files.push(`sounds/voice/${unitType}/${event}_${i}.mp3`);
  }
  return files;
}

/**
 * Per-unit voice map: each UnitType maps to its voice events → sound file paths.
 * Follows the pattern: sounds/voice/{unitType}/{event}_{variant}.mp3
 * @public
 */
export const UNIT_VOICE_MAP: Record<UnitType, Record<UnitVoiceEvent, string[]>> = {
  [UnitType.SOLDIER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('soldier', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('soldier', UnitVoiceEvent.MOVE, 3),
    [UnitVoiceEvent.ATTACK]: voiceFiles('soldier', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('soldier', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('soldier', UnitVoiceEvent.LOW_HEALTH, 2),
    [UnitVoiceEvent.KILL]: voiceFiles('soldier', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('soldier', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('soldier', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('soldier', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('soldier', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('soldier', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('soldier', UnitVoiceEvent.BUILT),
  },
  [UnitType.CONSCRIPT]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('conscript', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('conscript', UnitVoiceEvent.MOVE, 3),
    [UnitVoiceEvent.ATTACK]: voiceFiles('conscript', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('conscript', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('conscript', UnitVoiceEvent.LOW_HEALTH, 2),
    [UnitVoiceEvent.KILL]: voiceFiles('conscript', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('conscript', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('conscript', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('conscript', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('conscript', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('conscript', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('conscript', UnitVoiceEvent.BUILT),
  },
  [UnitType.ENGINEER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('engineer', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('engineer', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('engineer', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('engineer', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('engineer', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('engineer', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('engineer', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('engineer', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('engineer', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('engineer', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('engineer', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('engineer', UnitVoiceEvent.BUILT),
  },
  [UnitType.ROCKET]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('rocket', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('rocket', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('rocket', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('rocket', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('rocket', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('rocket', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('rocket', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('rocket', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('rocket', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('rocket', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('rocket', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('rocket', UnitVoiceEvent.BUILT),
  },
  [UnitType.SNIPER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('sniper', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('sniper', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('sniper', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('sniper', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('sniper', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('sniper', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('sniper', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('sniper', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('sniper', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('sniper', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('sniper', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('sniper', UnitVoiceEvent.BUILT),
  },
  [UnitType.TANYA]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('tanya', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('tanya', UnitVoiceEvent.MOVE, 3),
    [UnitVoiceEvent.ATTACK]: voiceFiles('tanya', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('tanya', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('tanya', UnitVoiceEvent.LOW_HEALTH, 2),
    [UnitVoiceEvent.KILL]: voiceFiles('tanya', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('tanya', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('tanya', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('tanya', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('tanya', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('tanya', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('tanya', UnitVoiceEvent.BUILT),
  },
  [UnitType.SEAL]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('seal', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('seal', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('seal', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('seal', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('seal', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('seal', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('seal', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('seal', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('seal', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('seal', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('seal', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('seal', UnitVoiceEvent.BUILT),
  },
  [UnitType.TANK]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('tank', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('tank', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('tank', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('tank', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('tank', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('tank', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('tank', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('tank', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('tank', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('tank', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('tank', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('tank', UnitVoiceEvent.BUILT),
  },
  [UnitType.RHINO]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('rhino', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('rhino', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('rhino', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('rhino', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('rhino', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('rhino', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('rhino', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('rhino', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('rhino', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('rhino', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('rhino', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('rhino', UnitVoiceEvent.BUILT),
  },
  [UnitType.APOCALYPSE]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('apocalypse', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('apocalypse', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('apocalypse', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('apocalypse', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('apocalypse', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('apocalypse', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('apocalypse', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('apocalypse', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('apocalypse', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('apocalypse', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('apocalypse', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('apocalypse', UnitVoiceEvent.BUILT),
  },
  [UnitType.TESLA]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('tesla', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('tesla', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('tesla', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('tesla', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('tesla', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('tesla', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('tesla', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('tesla', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('tesla', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('tesla', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('tesla', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('tesla', UnitVoiceEvent.BUILT),
  },
  [UnitType.KIROV]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('kirov', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('kirov', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('kirov', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('kirov', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('kirov', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('kirov', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('kirov', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('kirov', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('kirov', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('kirov', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('kirov', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('kirov', UnitVoiceEvent.BUILT),
  },
  [UnitType.PRISM]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('prism', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('prism', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('prism', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('prism', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('prism', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('prism', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('prism', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('prism', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('prism', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('prism', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('prism', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('prism', UnitVoiceEvent.BUILT),
  },
  [UnitType.MCV]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('mcv', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('mcv', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('mcv', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('mcv', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('mcv', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('mcv', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('mcv', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('mcv', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('mcv', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('mcv', UnitVoiceEvent.DEPLOY, 3),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('mcv', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('mcv', UnitVoiceEvent.BUILT),
  },
  [UnitType.ATTACK_DOG]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('attack_dog', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('attack_dog', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('attack_dog', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('attack_dog', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('attack_dog', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('attack_dog', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('attack_dog', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('attack_dog', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('attack_dog', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('attack_dog', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('attack_dog', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('attack_dog', UnitVoiceEvent.BUILT),
  },
  [UnitType.MINER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('miner', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('miner', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('miner', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('miner', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('miner', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('miner', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('miner', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('miner', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('miner', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('miner', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('miner', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('miner', UnitVoiceEvent.BUILT),
  },
  [UnitType.IFV]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('ifv', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('ifv', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('ifv', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('ifv', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('ifv', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('ifv', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('ifv', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('ifv', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('ifv', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('ifv', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('ifv', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('ifv', UnitVoiceEvent.BUILT),
  },
  [UnitType.PHANTOM]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('phantom', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('phantom', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('phantom', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('phantom', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('phantom', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('phantom', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('phantom', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('phantom', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('phantom', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('phantom', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('phantom', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('phantom', UnitVoiceEvent.BUILT),
  },
  [UnitType.HELICOPTER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('helicopter', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('helicopter', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('helicopter', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('helicopter', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('helicopter', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('helicopter', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('helicopter', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('helicopter', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('helicopter', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('helicopter', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('helicopter', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('helicopter', UnitVoiceEvent.BUILT),
  },
  [UnitType.BLACKHAWK]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('blackhawk', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('blackhawk', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('blackhawk', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('blackhawk', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('blackhawk', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('blackhawk', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('blackhawk', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('blackhawk', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('blackhawk', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('blackhawk', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('blackhawk', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('blackhawk', UnitVoiceEvent.BUILT),
  },
  [UnitType.YAK]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('yak', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('yak', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('yak', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('yak', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('yak', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('yak', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('yak', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('yak', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('yak', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('yak', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('yak', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('yak', UnitVoiceEvent.BUILT),
  },
  [UnitType.TERRORIST]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('terrorist', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('terrorist', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('terrorist', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('terrorist', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('terrorist', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('terrorist', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('terrorist', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('terrorist', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('terrorist', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('terrorist', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('terrorist', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('terrorist', UnitVoiceEvent.BUILT),
  },
  [UnitType.IVAN]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('ivan', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('ivan', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('ivan', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('ivan', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('ivan', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('ivan', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('ivan', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('ivan', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('ivan', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('ivan', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('ivan', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('ivan', UnitVoiceEvent.BUILT),
  },
  [UnitType.FLAK]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('flak', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('flak', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('flak', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('flak', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('flak', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('flak', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('flak', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('flak', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('flak', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('flak', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('flak', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('flak', UnitVoiceEvent.BUILT),
  },
  [UnitType.FLAKINFANTRY]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('flakinfantry', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('flakinfantry', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('flakinfantry', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('flakinfantry', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('flakinfantry', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('flakinfantry', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('flakinfantry', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('flakinfantry', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('flakinfantry', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('flakinfantry', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('flakinfantry', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('flakinfantry', UnitVoiceEvent.BUILT),
  },
  [UnitType.GUARDIAN]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('guardian', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('guardian', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('guardian', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('guardian', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('guardian', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('guardian', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('guardian', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('guardian', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('guardian', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('guardian', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('guardian', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('guardian', UnitVoiceEvent.BUILT),
  },
  [UnitType.DESPOT]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('despot', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('despot', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('despot', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('despot', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('despot', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('despot', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('despot', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('despot', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('despot', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('despot', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('despot', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('despot', UnitVoiceEvent.BUILT),
  },
  [UnitType.CHRONO]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('chrono', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('chrono', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('chrono', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('chrono', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('chrono', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('chrono', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('chrono', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('chrono', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('chrono', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('chrono', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('chrono', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('chrono', UnitVoiceEvent.BUILT),
  },
  [UnitType.APC]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('apc', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('apc', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('apc', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('apc', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('apc', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('apc', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('apc', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('apc', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('apc', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('apc', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('apc', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('apc', UnitVoiceEvent.BUILT),
  },
  [UnitType.DESTROYER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('destroyer', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('destroyer', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('destroyer', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('destroyer', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('destroyer', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('destroyer', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('destroyer', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('destroyer', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('destroyer', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('destroyer', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('destroyer', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('destroyer', UnitVoiceEvent.BUILT),
  },
  [UnitType.SUBMARINE]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('submarine', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('submarine', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('submarine', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('submarine', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('submarine', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('submarine', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('submarine', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('submarine', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('submarine', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('submarine', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('submarine', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('submarine', UnitVoiceEvent.BUILT),
  },
  [UnitType.TRANSPORT_SHIP]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('transport_ship', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('transport_ship', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('transport_ship', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('transport_ship', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('transport_ship', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('transport_ship', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('transport_ship', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('transport_ship', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('transport_ship', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('transport_ship', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('transport_ship', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('transport_ship', UnitVoiceEvent.BUILT),
  },
  [UnitType.SPY]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('spy', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('spy', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('spy', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('spy', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('spy', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('spy', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('spy', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('spy', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('spy', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('spy', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('spy', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('spy', UnitVoiceEvent.BUILT),
  },
  [UnitType.WAR_MINER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('war_miner', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('war_miner', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('war_miner', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('war_miner', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('war_miner', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('war_miner', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('war_miner', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('war_miner', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('war_miner', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('war_miner', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('war_miner', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('war_miner', UnitVoiceEvent.BUILT),
  },
  [UnitType.MIRAGE]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('mirage', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('mirage', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('mirage', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('mirage', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('mirage', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('mirage', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('mirage', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('mirage', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('mirage', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('mirage', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('mirage', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('mirage', UnitVoiceEvent.BUILT),
  },
  [UnitType.GRIZZLY]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('grizzly', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('grizzly', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('grizzly', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('grizzly', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('grizzly', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('grizzly', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('grizzly', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('grizzly', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('grizzly', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('grizzly', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('grizzly', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('grizzly', UnitVoiceEvent.BUILT),
  },
  [UnitType.LASH]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('lash', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('lash', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('lash', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('lash', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('lash', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('lash', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('lash', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('lash', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('lash', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('lash', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('lash', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('lash', UnitVoiceEvent.BUILT),
  },
  [UnitType.DREADNOUGHT]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('dreadnought', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('dreadnought', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('dreadnought', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('dreadnought', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('dreadnought', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('dreadnought', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('dreadnought', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('dreadnought', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('dreadnought', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('dreadnought', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('dreadnought', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('dreadnought', UnitVoiceEvent.BUILT),
  },
  [UnitType.AEGIS]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('aegis', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('aegis', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('aegis', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('aegis', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('aegis', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('aegis', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('aegis', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('aegis', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('aegis', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('aegis', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('aegis', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('aegis', UnitVoiceEvent.BUILT),
  },
  [UnitType.GI]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('gi', UnitVoiceEvent.SELECT, 3),
    [UnitVoiceEvent.MOVE]: voiceFiles('gi', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('gi', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('gi', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('gi', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('gi', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('gi', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('gi', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('gi', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('gi', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('gi', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('gi', UnitVoiceEvent.BUILT),
  },
  [UnitType.GUARDIAN_GI]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('guardian_gi', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('guardian_gi', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('guardian_gi', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('guardian_gi', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('guardian_gi', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('guardian_gi', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('guardian_gi', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('guardian_gi', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('guardian_gi', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('guardian_gi', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('guardian_gi', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('guardian_gi', UnitVoiceEvent.BUILT),
  },
  [UnitType.BRUTE]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('brute', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('brute', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('brute', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('brute', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('brute', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('brute', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('brute', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('brute', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('brute', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('brute', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('brute', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('brute', UnitVoiceEvent.BUILT),
  },
  [UnitType.DISC]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('disc', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('disc', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('disc', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('disc', UnitVoiceEvent.UNDER_FIRE),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('disc', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('disc', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('disc', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('disc', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('disc', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('disc', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('disc', UnitVoiceEvent.SPECIAL, 2),
    [UnitVoiceEvent.BUILT]: voiceFiles('disc', UnitVoiceEvent.BUILT),
  },
  [UnitType.BOOMER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('boomer', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('boomer', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('boomer', UnitVoiceEvent.ATTACK, 2),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('boomer', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('boomer', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('boomer', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('boomer', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('boomer', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('boomer', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('boomer', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('boomer', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('boomer', UnitVoiceEvent.BUILT),
  },
  [UnitType.GATTLING_TANK]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('gattling_tank', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('gattling_tank', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('gattling_tank', UnitVoiceEvent.ATTACK, 3),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('gattling_tank', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('gattling_tank', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('gattling_tank', UnitVoiceEvent.KILL, 2),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('gattling_tank', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('gattling_tank', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('gattling_tank', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('gattling_tank', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('gattling_tank', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('gattling_tank', UnitVoiceEvent.BUILT),
  },
  [UnitType.SLAVE_MINER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('slave_miner', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('slave_miner', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('slave_miner', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('slave_miner', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('slave_miner', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('slave_miner', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('slave_miner', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('slave_miner', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('slave_miner', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('slave_miner', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('slave_miner', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('slave_miner', UnitVoiceEvent.BUILT),
  },
  [UnitType.DOLPHIN]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('dolphin', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('dolphin', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('dolphin', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('dolphin', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('dolphin', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('dolphin', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('dolphin', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('dolphin', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('dolphin', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('dolphin', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('dolphin', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('dolphin', UnitVoiceEvent.BUILT),
  },
  [UnitType.SQUID]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('squid', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('squid', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('squid', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('squid', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('squid', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('squid', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('squid', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('squid', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('squid', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('squid', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('squid', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('squid', UnitVoiceEvent.BUILT),
  },
  [UnitType.CARRIER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('carrier', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('carrier', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('carrier', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('carrier', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('carrier', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('carrier', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('carrier', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('carrier', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('carrier', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('carrier', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('carrier', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('carrier', UnitVoiceEvent.BUILT),
  },
  [UnitType.V3_ROCKET]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('v3_rocket', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('v3_rocket', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('v3_rocket', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('v3_rocket', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('v3_rocket', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('v3_rocket', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('v3_rocket', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('v3_rocket', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('v3_rocket', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('v3_rocket', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('v3_rocket', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('v3_rocket', UnitVoiceEvent.BUILT),
  },
  [UnitType.CHRONO_MINER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('chrono_miner', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('chrono_miner', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('chrono_miner', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('chrono_miner', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('chrono_miner', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('chrono_miner', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('chrono_miner', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('chrono_miner', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('chrono_miner', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('chrono_miner', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('chrono_miner', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('chrono_miner', UnitVoiceEvent.BUILT),
  },
  [UnitType.HARRIER]: {
    [UnitVoiceEvent.SELECT]: voiceFiles('harrier', UnitVoiceEvent.SELECT, 2),
    [UnitVoiceEvent.MOVE]: voiceFiles('harrier', UnitVoiceEvent.MOVE, 2),
    [UnitVoiceEvent.ATTACK]: voiceFiles('harrier', UnitVoiceEvent.ATTACK),
    [UnitVoiceEvent.UNDER_FIRE]: voiceFiles('harrier', UnitVoiceEvent.UNDER_FIRE, 2),
    [UnitVoiceEvent.LOW_HEALTH]: voiceFiles('harrier', UnitVoiceEvent.LOW_HEALTH),
    [UnitVoiceEvent.KILL]: voiceFiles('harrier', UnitVoiceEvent.KILL),
    [UnitVoiceEvent.PROMOTED]: voiceFiles('harrier', UnitVoiceEvent.PROMOTED),
    [UnitVoiceEvent.GARRISON]: voiceFiles('harrier', UnitVoiceEvent.GARRISON),
    [UnitVoiceEvent.UNGARRISON]: voiceFiles('harrier', UnitVoiceEvent.UNGARRISON),
    [UnitVoiceEvent.DEPLOY]: voiceFiles('harrier', UnitVoiceEvent.DEPLOY),
    [UnitVoiceEvent.SPECIAL]: voiceFiles('harrier', UnitVoiceEvent.SPECIAL),
    [UnitVoiceEvent.BUILT]: voiceFiles('harrier', UnitVoiceEvent.BUILT),
  },
};

/**
 * Manages game sounds, music, and voice lines
 * @public
 */
export class GameSoundManager {
  private scene: Phaser.Scene;
  private config: SoundConfig;
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private music: Map<string, Phaser.Sound.BaseSound> = new Map();
  private categoryVolumes: Map<SoundCategory, number> = new Map();
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private lastVoiceTime: Map<string, number> = new Map();
  private voiceCooldown: number = 2000;
  private cameraPosition: { x: number; y: number } = { x: 0, y: 0 };
  private readonly SOUND_FALLOFF_RADIUS = 800; // 音效衰减半径（像素）
  private readonly SOUND_MIN_VOLUME = 0.1; // 最小音量
  private volumeChangedUnsub?: () => void;
  private voiceEventUnsubs: (() => void)[] = [];

  // Battle music auto-switch
  private lastCombatTime: number = 0;
  private isPlayingBattleMusic: boolean = false;
  private combatUnsub?: () => void;
  private static readonly BATTLE_MUSIC_COOLDOWN = 10000; // 10s after last combat → switch back to calm

  /**
   * Creates a new GameSoundManager instance
   * @param scene - The Phaser scene this manager belongs to
   * @param config - Optional configuration overrides
   */
  constructor(scene: Phaser.Scene, config: Partial<SoundConfig> = {}) {
    this.scene = scene;
    this.config = { ...SOUND_CONFIG, ...config };

    this.initializeCategoryVolumes();
    this.listenForSettingsChanges();
    this.listenForCombatEvents();
    this.initVoiceEvents();
  }

  /** Listen for combat events to trigger battle music */
  private listenForCombatEvents(): void {
    this.combatUnsub = gameEventBus.on('combat:hit', () => {
      this.lastCombatTime = this.scene.time.now;
      if (!this.isPlayingBattleMusic) {
        this.isPlayingBattleMusic = true;
        this.playMusic('music_battle', 3000);
      }
    });
  }

  /** Listen for volume change events from settings panel */
  private listenForSettingsChanges(): void {
    this.volumeChangedUnsub = gameEventBus.on('settings:volumeChanged', (event) => {
      const data = event.data as { master?: number; music?: number; sfx?: number } | undefined;
      if (!data) return;
      if (data.master !== undefined) {
        this.setMasterVolume(data.master);
      }
      if (data.music !== undefined) {
        this.categoryVolumes.set('ambient', data.music);
      }
      if (data.sfx !== undefined) {
        this.categoryVolumes.set('combat', data.sfx);
        this.categoryVolumes.set('movement', data.sfx);
        this.categoryVolumes.set('building', data.sfx);
        this.categoryVolumes.set('ui', data.sfx);
      }
    });
  }

  /**
   * Initializes category volumes to default values
   * @internal
   */
  private initializeCategoryVolumes(): void {
    this.categoryVolumes.set('ui', 1.0);
    this.categoryVolumes.set('combat', 0.9);
    this.categoryVolumes.set('movement', 0.6);
    this.categoryVolumes.set('building', 0.7);
    this.categoryVolumes.set('ambient', 0.4);
    this.categoryVolumes.set('voice', 1.0);
  }

  /**
   * Sets the camera position for distance-based sound attenuation
   * @param x - Camera x position in world coordinates
   * @param y - Camera y position in world coordinates
   */
  setCameraPosition(x: number, y: number): void {
    this.cameraPosition = { x, y };
  }

  /**
   * Preloads all sound assets
   */
  preload(): void {
    try {
      Object.values(SOUND_EFFECTS).forEach(sfx => {
        this.scene.load.audio(sfx.key, `/assets/sounds/${sfx.key}.mp3`);
      });

      Object.values(VOICE_LINES).forEach(voice => {
        this.scene.load.audio(voice.key, `/assets/sounds/voices/${voice.key}.mp3`);
      });

      this.scene.load.audio('music_battle', '/assets/sounds/music/battle.mp3');
      this.scene.load.audio('music_calm', '/assets/sounds/music/calm.mp3');
      this.scene.load.audio('music_menu', '/assets/sounds/music/menu.mp3');
    } catch (error) {
      console.error('Failed to preload sounds:', error);
    }
  }

  /**
   * Plays a sound effect
   * @param sfxKey - Key of the sound effect to play
   * @param options - Playback options
   */
  play(sfxKey: string, options?: {
    volume?: number;
    rate?: number;
    loops?: boolean;
    forceRestart?: boolean;
    position?: { x: number; y: number };
  }): void {
    if (!this.config.enableSounds || this.config.muted) return;

    const sfx = SOUND_EFFECTS[sfxKey];
    if (!sfx) return;

    // Check if audio is in Phaser cache
    if (!this.scene.sound.get(sfx.key)) {
      console.warn(`Audio "${sfx.key}" not yet loaded, skipping play`);
      return;
    }

    // Calculate distance-based volume attenuation
    let distanceVolume = 1;
    if (options?.position) {
      const dx = options.position.x - this.cameraPosition.x;
      const dy = options.position.y - this.cameraPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.SOUND_FALLOFF_RADIUS) {
        return; // 太远，不播放
      }

      const distanceFactor = 1 - (distance / this.SOUND_FALLOFF_RADIUS);
      distanceVolume = Math.max(this.SOUND_MIN_VOLUME, distanceFactor);
    }

    let sound = this.sounds.get(sfxKey);

    if (!sound || options?.forceRestart) {
      if (sound) {
        sound.destroy();
      }
      sound = this.scene.sound.add(sfx.key, {
        volume: (options?.volume ?? sfx.volume ?? 1) * this.config.volume * distanceVolume,
        rate: options?.rate ?? sfx.rate ?? 1,
        loop: options?.loops ?? sfx.loops ?? false
      });
      this.sounds.set(sfxKey, sound);
    }

    sound?.play();
  }

  /**
   * Plays a voice line
   * @param voiceKey - Key of the voice line to play
   * @param forcePlay - Whether to ignore probability and cooldown
   */
  playVoice(voiceKey: string, forcePlay: boolean = false): void {
    if (!this.config.enableSounds || this.config.muted) return;

    const voice = VOICE_LINES[voiceKey];
    if (!voice) return;

    // Check if audio is in Phaser cache
    if (!this.scene.sound.get(voice.key)) {
      console.warn(`Voice "${voice.key}" not yet loaded, skipping play`);
      return;
    }

    if (!forcePlay && voice.probability && Math.random() > voice.probability) {
      return;
    }

    const lastPlayed = this.lastVoiceTime.get(voiceKey) || 0;
    const now = Date.now();
    if (now - lastPlayed < this.voiceCooldown) {
      return;
    }

    let sound = this.sounds.get(voiceKey);
    if (sound && sound.isPlaying) {
      return;
    }

    // Destroy old sound object before creating new one
    if (sound) {
      sound.destroy();
    }

    sound = this.scene.sound.add(voice.key, {
      volume: this.categoryVolumes.get('voice')! * this.config.volume
    });
    this.sounds.set(voiceKey, sound);
    sound?.play();

    this.lastVoiceTime.set(voiceKey, now);
  }

  /**
   * Plays a random voice line from a category
   * @param category - Category of voice lines to choose from
   */
  playRandomVoice(category: VoiceLine['category']): void {
    const voicesInCategory = Object.values(VOICE_LINES).filter(
      v => v.category === category
    );
    if (voicesInCategory.length === 0) return;

    const randomVoice = voicesInCategory[Math.floor(Math.random() * voicesInCategory.length)];
    this.playVoice(randomVoice.key);
  }

  /**
   * Plays a unit-specific voice line for a given event
   * @param unitType - The type of unit speaking
   * @param event - The voice event triggering the line
   * @param position - Optional world position for spatial audio
   */
  playUnitVoice(unitType: UnitType, event: UnitVoiceEvent, position?: Vector2): void {
    if (!this.config.enableSounds || this.config.muted) return;

    const voiceMap = UNIT_VOICE_MAP[unitType];
    if (!voiceMap) return;

    const variants = voiceMap[event];
    if (!variants || variants.length === 0) return;

    // Respect voice cooldown per unit type
    const cooldownKey = `unit_voice_${unitType}_${event}`;
    const lastPlayed = this.lastVoiceTime.get(cooldownKey) || 0;
    const now = Date.now();
    if (now - lastPlayed < this.voiceCooldown) return;

    // Pick a random variant
    const filePath = variants[Math.floor(Math.random() * variants.length)];
    const soundKey = filePath.replace(/[/.]/g, '_');

    // Check if audio is in Phaser cache
    if (!this.scene.sound.get(soundKey)) {
      console.warn(`Unit voice "${soundKey}" not yet loaded, skipping play`);
      return;
    }

    // Calculate distance-based volume attenuation
    let distanceVolume = 1;
    if (position) {
      const dx = position.x - this.cameraPosition.x;
      const dy = position.y - this.cameraPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.SOUND_FALLOFF_RADIUS) return;

      const distanceFactor = 1 - (distance / this.SOUND_FALLOFF_RADIUS);
      distanceVolume = Math.max(this.SOUND_MIN_VOLUME, distanceFactor);
    }

    // Destroy old sound object if reusing key
    const existing = this.sounds.get(soundKey);
    if (existing) {
      if (existing.isPlaying) return;
      existing.destroy();
    }

    const sound = this.scene.sound.add(soundKey, {
      volume: this.categoryVolumes.get('voice')! * this.config.volume * distanceVolume
    });
    this.sounds.set(soundKey, sound);
    sound.play();

    this.lastVoiceTime.set(cooldownKey, now);
  }

  /**
   * Registers event bus listeners for unit voice events
   */
  initVoiceEvents(): void {
    // unit:move → play MOVE voice
    this.voiceEventUnsubs.push(
      gameEventBus.on('unit:move', (event) => {
        const data = event.data as { unitType: UnitType; position?: Vector2 } | undefined;
        if (!data) return;
        this.playUnitVoice(data.unitType, UnitVoiceEvent.MOVE, data.position);
      })
    );

    // unit:attack → play ATTACK voice
    this.voiceEventUnsubs.push(
      gameEventBus.on('unit:attack', (event) => {
        const data = event.data as { unitType: UnitType; position?: Vector2 } | undefined;
        if (!data) return;
        this.playUnitVoice(data.unitType, UnitVoiceEvent.ATTACK, data.position);
      })
    );

    // unit:produced → play BUILT voice
    this.voiceEventUnsubs.push(
      gameEventBus.on('unit:produced', (event) => {
        const data = event.data as { unitType: UnitType; position?: Vector2 } | undefined;
        if (!data) return;
        this.playUnitVoice(data.unitType, UnitVoiceEvent.BUILT, data.position);
      })
    );

    // unit:promoted → play PROMOTED voice
    this.voiceEventUnsubs.push(
      gameEventBus.on('unit:promoted', (event) => {
        const data = event.data as { unitType: UnitType; position?: Vector2 } | undefined;
        if (!data) return;
        this.playUnitVoice(data.unitType, UnitVoiceEvent.PROMOTED, data.position);
      })
    );

    // unit:destroyed → play UNDER_FIRE for nearby allied units
    this.voiceEventUnsubs.push(
      gameEventBus.on('unit:destroyed', (event) => {
        const data = event.data as { unitType: UnitType; position?: Vector2; nearbyAlliedUnits?: Array<{ unitType: UnitType; position: Vector2 }> } | undefined;
        if (!data) return;
        if (data.nearbyAlliedUnits) {
          for (const ally of data.nearbyAlliedUnits) {
            this.playUnitVoice(ally.unitType, UnitVoiceEvent.UNDER_FIRE, ally.position);
          }
        }
      })
    );
  }

  /**
   * Starts playing background music
   * @param musicKey - Key of the music to play
   * @param fadeDuration - Fade duration in milliseconds (0 = no fade)
   */
  playMusic(musicKey: string, fadeDuration: number = 1000): void {
    if (!this.config.enableMusic || this.config.muted) return;

    if (this.currentMusic) {
      if (fadeDuration > 0) {
        this.scene.tweens.add({
          targets: this.currentMusic,
          volume: 0,
          duration: fadeDuration / 2,
          onComplete: () => {
            if (!this.scene?.scene?.isActive()) return;
            this.currentMusic?.stop();
            this.currentMusic = null;
            this.startMusic(musicKey, fadeDuration / 2);
          }
        });
      } else {
        this.currentMusic.stop();
        this.currentMusic = null;
        this.startMusic(musicKey, 0);
      }
    } else {
      this.startMusic(musicKey, fadeDuration);
    }
  }

  /**
   * Internal method to start music playback
   * @param musicKey - Key of the music to start
   * @param fadeInDuration - Fade in duration in milliseconds
   * @internal
   */
  private startMusic(musicKey: string, fadeInDuration: number): void {
    const music = this.scene.sound.add(musicKey, {
      volume: fadeInDuration > 0 ? 0 : this.config.volume,
      loop: true
    });

    music.play();

    if (fadeInDuration > 0) {
      this.scene.tweens.add({
        targets: music,
        volume: this.config.volume,
        duration: fadeInDuration
      });
    }

    this.currentMusic = music;
  }

  /**
   * Stops the current music
   * @param fadeDuration - Fade out duration in milliseconds (0 = no fade)
   */
  stopMusic(fadeDuration: number = 1000): void {
    if (!this.currentMusic) return;

    if (fadeDuration > 0) {
      this.scene.tweens.add({
        targets: this.currentMusic,
        volume: 0,
        duration: fadeDuration,
        onComplete: () => {
          if (!this.scene?.scene?.isActive()) return;
          this.currentMusic?.stop();
          this.currentMusic = null;
        }
      });
    } else {
      this.currentMusic.stop();
      this.currentMusic = null;
    }
  }

  /**
   * Sets the master volume for all sounds
   * @param volume - Volume level (0-1)
   */
  setMasterVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));

    if (this.currentMusic) {
      try {
        (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume(this.config.volume);
      } catch (error) {
        console.error('Failed to set music volume:', error);
      }
    }

    this.sounds.forEach((sound, key) => {
      const sfx = SOUND_EFFECTS[key];
      if (sfx) {
        try {
          (sound as Phaser.Sound.WebAudioSound).setVolume((sfx.volume ?? 1) * this.config.volume);
        } catch (error) {
          console.error(`Failed to set volume for sound ${key}:`, error);
        }
      }
    });
  }

  /**
   * Sets the volume for a specific sound category
   * @param category - Sound category to adjust
   * @param volume - Volume level (0-1)
   */
  setCategoryVolume(category: SoundCategory, volume: number): void {
    this.categoryVolumes.set(category, Math.max(0, Math.min(1, volume)));

    Object.entries(SOUND_EFFECTS).forEach(([key, sfx]) => {
      if (sfx.category === category) {
        const sound = this.sounds.get(key);
        if (sound) {
          try {
            (sound as Phaser.Sound.WebAudioSound).setVolume((sfx.volume ?? 1) * this.categoryVolumes.get(category)! * this.config.volume);
          } catch (error) {
            console.error(`Failed to set category volume for ${key}:`, error);
          }
        }
      }
    });
  }

  /**
   * Sets the muted state for all sounds
   * @param muted - Whether to mute all sounds
   */
  setMuted(muted: boolean): void {
    this.config.muted = muted;

    if (this.currentMusic) {
      (this.currentMusic as Phaser.Sound.WebAudioSound).setMute(muted);
    }

    this.sounds.forEach(sound => {
      (sound as Phaser.Sound.WebAudioSound).setMute(muted);
    });
  }

  /**
   * Enables or disables sound effects
   * @param enabled - Whether sound effects should be enabled
   */
  setSoundsEnabled(enabled: boolean): void {
    this.config.enableSounds = enabled;

    if (!enabled) {
      this.sounds.forEach(sound => {
        if (sound.isPlaying) {
          sound.stop();
        }
      });
    }
  }

  /**
   * Enables or disables background music
   * @param enabled - Whether background music should be enabled
   */
  setMusicEnabled(enabled: boolean): void {
    this.config.enableMusic = enabled;

    if (!enabled && this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
    }
  }

  /**
   * Pauses all currently playing sounds and music
   */
  pauseAll(): void {
    if (this.currentMusic && this.currentMusic.isPlaying) {
      this.currentMusic.pause();
    }

    this.sounds.forEach(sound => {
      if (sound.isPlaying) {
        sound.pause();
      }
    });
  }

  /**
   * Resumes all paused sounds and music
   */
  resumeAll(): void {
    if (this.currentMusic && !this.currentMusic.isPlaying) {
      this.currentMusic.resume();
    }

    this.sounds.forEach(sound => {
      if (!sound.isPlaying && sound.isPaused) {
        sound.resume();
      }
    });
  }

  /**
   * Stops all currently playing sounds and music
   * @param fadeDuration - Fade out duration in milliseconds (0 = no fade)
   */
  stopAll(fadeDuration: number = 0): void {
    if (fadeDuration > 0) {
      this.scene.tweens.add({
        targets: [this.currentMusic, ...Array.from(this.sounds.values())],
        volume: 0,
        duration: fadeDuration,
        onComplete: () => {
          if (!this.scene?.scene?.isActive()) return;
          this.stopAll(0);
        }
      });
    } else {
      this.currentMusic?.stop();
      this.currentMusic = null;

      this.sounds.forEach(sound => {
        sound.stop();
      });
    }
  }

  /**
   * Gets the current sound configuration
   * @returns Copy of the current configuration
   */
  getConfig(): SoundConfig {
    return { ...this.config };
  }

  /**
   * Cleans up resources used by this manager
   */
  /**
   * Update method — checks for battle music cooldown
   */
  update(time: number): void {
    if (this.isPlayingBattleMusic && this.lastCombatTime > 0) {
      const elapsed = time - this.lastCombatTime;
      if (elapsed >= GameSoundManager.BATTLE_MUSIC_COOLDOWN) {
        this.isPlayingBattleMusic = false;
        this.lastCombatTime = 0;
        this.playMusic('music_calm', 3000);
      }
    }
  }

  dispose(): void {
    this.volumeChangedUnsub?.();
    this.volumeChangedUnsub = undefined;
    this.combatUnsub?.();
    this.combatUnsub = undefined;
    this.voiceEventUnsubs.forEach(unsub => unsub());
    this.voiceEventUnsubs = [];

    this.stopAll();

    this.sounds.forEach(sound => sound.destroy());
    this.sounds.clear();

    this.music.forEach(music => music.destroy());
    this.music.clear();

    this.currentMusic = null;
  }
}
