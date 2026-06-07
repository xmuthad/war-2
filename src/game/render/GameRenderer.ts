import type { GameMapData, UnitType, Faction } from '../../types';
import type { FogOfWar } from './FogOfWar';
import type { GameSoundManager } from '../systems/GameSoundManager';
import type { HotkeyManager, UnitGroupManager } from '../systems/HotkeyManager';
import type { PathfindingManager } from '../systems/PathfindingManager';
import type { AlertLevel, WeatherType, MissionConfig } from '../systems/SystemManager';

/** 2D position used by Phaser (2D renderer) */
export interface Position2D {
  x: number;
  y: number;
}

/** 3D position used by Three.js renderer; z is optional for 2D renderers */
export interface Position3D {
  x: number;
  y: number;
  z?: number;
}

export interface GameRenderer {
  dispose(): void;
  createTerrain(map: GameMapData | number, mapHeight?: number): void;
  updateUnit(id: string, type: UnitType, faction: Faction, position: Position3D, rotation: number): void;
  updateBuilding(id: string, type: string, faction: Faction, position: Position3D, isConstructed?: boolean, buildProgress?: number, isPowered?: boolean): void;
  initialize?(map: GameMapData): void;
  render?(): void;

  // Selection
  setUnitSelected(id: string, selected: boolean): void;
  setBuildingSelected(id: string, selected: boolean): void;

  // Health
  setUnitHealth(id: string, health: number, maxHealth: number): void;
  setBuildingHealth(id: string, health: number, maxHealth: number, oreStorage?: number, maxOreStorage?: number): void;

  // Rank
  setUnitRank?(id: string, rank: number): void;

  // Group badge
  setUnitGroupBadge?(id: string, groupNumber: number | null): void;

  // Visibility
  setUnitVisible?(id: string, visible: boolean): void;
  setUnitDisguised?(id: string, isDisguised: boolean): void;
  setBuildingVisible?(id: string, visible: boolean): void;

  // Coordinate conversion
  worldToScreen(worldX: number, worldY: number): Position2D;
  screenToWorld(screenX: number, screenY: number): Position2D;

  // Subsystem accessors
  getFogOfWar?(): FogOfWar | undefined;
  getSoundManager?(): GameSoundManager | undefined;
  getHotkeyManager?(): HotkeyManager | undefined;
  getGroupManager?(): UnitGroupManager | undefined;
  getPathfindingManager?(): PathfindingManager | undefined;

  // System control
  startWeather?(type: WeatherType, intensity?: number, duration?: number): void;
  stopWeather?(): void;
  triggerAlert?(level: AlertLevel, message: string, position?: Position2D): string;
  startMission?(config: MissionConfig): void;
}
