import {
  Faction,
  Difficulty,
  GameState,
  UnitState,
  TileType,
  UnitType,
  BuildingType,
  UpgradeType,
  UnitStance,
} from '../../types';
import type {
  Player,
  GameMapData,
  Unit,
  Building,
  ResourceNode,
  Tile,
  Vector2,
  BuildQueueItem,
} from '../../types';
import { AIController } from './AIController';
import { useGameStore, type GameSettings } from '../../store/gameStore';
import { getUnitsByFaction } from '../data/units';
import { getBuildingsByFaction } from '../data/buildings';

export interface SaveSlot {
  id: number;
  name: string;
  timestamp: number;
  gameTime: number;
  faction: Faction;
  difficulty: Difficulty;
  thumbnail: string | null;
}

export interface SaveData {
  version: string;
  timestamp: number;
  gameTime: number;
  faction: Faction;
  difficulty: Difficulty;
  currentPlayer: Player;
  aiPlayers: Player[];
  map: GameMapData;
  gameState: GameState;
  neutralBuildings: Building[];
  gameSettings?: GameSettings;
}

interface SaveStorage {
  slots: Record<number, SaveData>;
  metadata: Record<number, SaveSlot>;
}

type FactionValue = Faction;
type DifficultyValue = Difficulty;
type GameStateValue = GameState;
type UnitStateValue = UnitState;
type TileTypeValue = TileType;
type UnitTypeValue = UnitType;
type BuildingTypeValue = BuildingType;

const VALID_FACTIONS: Set<string> = new Set<string>(
  Object.values(Faction) as string[]
);
const VALID_DIFFICULTIES: Set<string> = new Set<string>(
  Object.values(Difficulty) as string[]
);
const VALID_GAME_STATES: Set<string> = new Set<string>(
  Object.values(GameState) as string[]
);
const VALID_UNIT_STATES: Set<string> = new Set<string>(
  Object.values(UnitState) as string[]
);
const VALID_TILE_TYPES: Set<string> = new Set<string>(
  Object.values(TileType) as string[]
);
const VALID_UNIT_TYPES: Set<string> = new Set<string>(
  Object.values(UnitType) as string[]
);
const VALID_BUILDING_TYPES: Set<string> = new Set<string>(
  Object.values(BuildingType) as string[]
);
const VALID_UPGRADE_TYPES: Set<string> = new Set<string>(
  Object.values(UpgradeType) as string[]
);

function isValidFaction(value: string): value is FactionValue {
  return VALID_FACTIONS.has(value);
}

function isValidDifficulty(value: string): value is DifficultyValue {
  return VALID_DIFFICULTIES.has(value);
}

function isValidGameState(value: string): value is GameStateValue {
  return VALID_GAME_STATES.has(value);
}

function isValidUnitState(value: string): value is UnitStateValue {
  return VALID_UNIT_STATES.has(value);
}

function isValidTileType(value: string): value is TileTypeValue {
  return VALID_TILE_TYPES.has(value);
}

function isValidUnitType(value: string): value is UnitTypeValue {
  return VALID_UNIT_TYPES.has(value);
}

function isValidBuildingType(value: string): value is BuildingTypeValue {
  return VALID_BUILDING_TYPES.has(value);
}

function isValidUpgradeType(value: string): value is UpgradeType {
  return VALID_UPGRADE_TYPES.has(value);
}

function isValidVector2(v: unknown): v is Vector2 {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Vector2).x === 'number' &&
    typeof (v as Vector2).y === 'number'
  );
}

function validateTile(tile: unknown): tile is Tile {
  if (typeof tile !== 'object' || tile === null) return false;
  const t = tile as Record<string, unknown>;
  return (
    typeof t.type === 'string' &&
    isValidTileType(t.type) &&
    typeof t.walkable === 'boolean' &&
    typeof t.buildable === 'boolean' &&
    typeof t.movementCost === 'number'
  );
}

function validateResourceNode(node: unknown): node is ResourceNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    isValidVector2(n.position) &&
    typeof n.amount === 'number' &&
    typeof n.maxAmount === 'number'
  );
}

function validateBuildQueueItem(item: unknown): item is BuildQueueItem {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.producerId === 'string' &&
    typeof i.type === 'string' &&
    (isValidUnitType(i.type) || isValidBuildingType(i.type)) &&
    typeof i.progress === 'number' &&
    typeof i.totalTime === 'number' &&
    typeof i.cost === 'number'
  );
}

function validateUnit(unit: unknown): unit is Unit {
  if (typeof unit !== 'object' || unit === null) return false;
  const u = unit as Record<string, unknown>;
  return (
    typeof u.id === 'string' &&
    typeof u.type === 'string' &&
    isValidUnitType(u.type) &&
    typeof u.faction === 'string' &&
    isValidFaction(u.faction) &&
    isValidVector2(u.position) &&
    typeof u.health === 'number' &&
    typeof u.maxHealth === 'number' &&
    typeof u.armor === 'number' &&
    typeof u.attack === 'number' &&
    typeof u.attackRange === 'number' &&
    typeof u.attackSpeed === 'number' &&
    typeof u.speed === 'number' &&
    typeof u.vision === 'number' &&
    typeof u.cost === 'number' &&
    typeof u.buildTime === 'number' &&
    typeof u.state === 'string' &&
    isValidUnitState(u.state) &&
    (u.target === null || typeof u.target === 'string') &&
    typeof u.isAirborne === 'boolean' &&
    typeof u.isSelected === 'boolean' &&
    typeof u.isBuilding === 'boolean' &&
    typeof u.buildProgress === 'number' &&
    typeof u.cargo === 'number' &&
    typeof u.cargoCapacity === 'number' &&
    typeof u.direction === 'number' &&
    typeof u.kills === 'number' &&
    typeof u.rank === 'number' &&
    // Optional new fields - accept if present, don't require
    (u.isDisguised === undefined || typeof u.isDisguised === 'boolean') &&
    (u.idleTimer === undefined || typeof u.idleTimer === 'number') &&
    (u.transportId === undefined || u.transportId === null || typeof u.transportId === 'string') &&
    (u.passengers === undefined || (Array.isArray(u.passengers) && (u.passengers as unknown[]).every(p => typeof p === 'string'))) &&
    (u.maxPassengers === undefined || typeof u.maxPassengers === 'number') &&
    (u.isAttackMoving === undefined || typeof u.isAttackMoving === 'boolean') &&
    (u.chronoShiftTarget === undefined || isValidVector2(u.chronoShiftTarget)) &&
    (u.chronoShiftTimer === undefined || typeof u.chronoShiftTimer === 'number') &&
    (u.isChronoShifting === undefined || typeof u.isChronoShifting === 'boolean') &&
    (u.isChronoCooldown === undefined || typeof u.isChronoCooldown === 'boolean')
  );
}

function validateBuilding(building: unknown): building is Building {
  if (typeof building !== 'object' || building === null) return false;
  const b = building as Record<string, unknown>;
  return (
    typeof b.id === 'string' &&
    typeof b.type === 'string' &&
    isValidBuildingType(b.type) &&
    typeof b.faction === 'string' &&
    isValidFaction(b.faction) &&
    isValidVector2(b.position) &&
    typeof b.health === 'number' &&
    typeof b.maxHealth === 'number' &&
    typeof b.powerOutput === 'number' &&
    typeof b.powerConsumption === 'number' &&
    typeof b.cost === 'number' &&
    typeof b.buildTime === 'number' &&
    typeof b.width === 'number' &&
    typeof b.height === 'number' &&
    typeof b.isPowered === 'boolean' &&
    typeof b.isSelected === 'boolean' &&
    typeof b.isBuilding === 'boolean' &&
    typeof b.buildProgress === 'number' &&
    typeof b.isConstructed === 'boolean' &&
    typeof b.isActive === 'boolean' &&
    // Optional new fields - accept if present, don't require
    (b.empDisabledUntil === undefined || typeof b.empDisabledUntil === 'number') &&
    (b.isRepairing === undefined || typeof b.isRepairing === 'boolean') &&
    (b.productionQueue === undefined || (Array.isArray(b.productionQueue) && (b.productionQueue as unknown[]).every(validateBuildQueueItem))) &&
    (b.rallyPoint === undefined || b.rallyPoint === null || isValidVector2(b.rallyPoint)) &&
    (b.newUnitCooldown === undefined || typeof b.newUnitCooldown === 'number') &&
    (b.producingUnit === undefined || b.producingUnit === null || (typeof b.producingUnit === 'string' && isValidUnitType(b.producingUnit))) &&
    (b.superweaponChargeTime === undefined || typeof b.superweaponChargeTime === 'number') &&
    (b.superweaponChargeProgress === undefined || typeof b.superweaponChargeProgress === 'number') &&
    (b.superweaponReady === undefined || typeof b.superweaponReady === 'boolean') &&
    (b.oreStorage === undefined || typeof b.oreStorage === 'number') &&
    (b.maxOreStorage === undefined || typeof b.maxOreStorage === 'number') &&
    (b.attack === undefined || typeof b.attack === 'number') &&
    (b.attackRange === undefined || typeof b.attackRange === 'number') &&
    (b.attackSpeed === undefined || typeof b.attackSpeed === 'number') &&
    (b.attackTarget === undefined || b.attackTarget === null || typeof b.attackTarget === 'string') &&
    (b.attackCooldown === undefined || typeof b.attackCooldown === 'number')
  );
}

function validatePlayer(player: unknown): player is Player {
  if (typeof player !== 'object' || player === null) return false;
  const p = player as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.faction === 'string' &&
    isValidFaction(p.faction) &&
    typeof p.name === 'string' &&
    typeof p.money === 'number' &&
    typeof p.power === 'number' &&
    typeof p.maxPower === 'number' &&
    typeof p.isAI === 'boolean' &&
    typeof p.difficulty === 'string' &&
    isValidDifficulty(p.difficulty) &&
    typeof p.color === 'string' &&
    typeof p.isDefeated === 'boolean' &&
    typeof p.isVictorious === 'boolean' &&
    Array.isArray(p.units) &&
    (p.units as unknown[]).every(validateUnit) &&
    Array.isArray(p.buildings) &&
    (p.buildings as unknown[]).every(validateBuilding) &&
    Array.isArray(p.buildQueue) &&
    (p.buildQueue as unknown[]).every(validateBuildQueueItem) &&
    // Optional new fields - accept if present, don't require
    (p.researchedUpgrades === undefined || (Array.isArray(p.researchedUpgrades) && (p.researchedUpgrades as unknown[]).every(r => typeof r === 'string' && isValidUpgradeType(r as string)))) &&
    (p.researchQueue === undefined || Array.isArray(p.researchQueue)) &&
    (p.statistics === undefined || (typeof p.statistics === 'object' && p.statistics !== null))
  );
}

function validateGameMapData(map: unknown): map is GameMapData {
  if (typeof map !== 'object' || map === null) return false;
  const m = map as Record<string, unknown>;
  if (
    typeof m.id !== 'string' ||
    typeof m.name !== 'string' ||
    typeof m.width !== 'number' ||
    typeof m.height !== 'number'
  ) {
    return false;
  }
  if (!Array.isArray(m.tiles)) return false;
  const tiles = m.tiles as unknown[][];
  for (const row of tiles) {
    if (!Array.isArray(row)) return false;
    for (const tile of row) {
      if (!validateTile(tile)) return false;
    }
  }
  if (!Array.isArray(m.spawnPoints)) return false;
  for (const sp of m.spawnPoints as unknown[]) {
    if (!isValidVector2(sp)) return false;
  }
  if (!Array.isArray(m.resourceNodes)) return false;
  for (const rn of m.resourceNodes as unknown[]) {
    if (!validateResourceNode(rn)) return false;
  }
  return true;
}

const SAVE_VERSION = '1.0.0';

function validateSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  const saveMajorVersion = typeof d.version === 'string' ? d.version.split('.')[0] : undefined;
  const currentMajorVersion = SAVE_VERSION.split('.')[0];
  const baseValid =
    typeof d.version === 'string' &&
    saveMajorVersion === currentMajorVersion &&
    typeof d.timestamp === 'number' &&
    typeof d.gameTime === 'number' &&
    typeof d.faction === 'string' &&
    isValidFaction(d.faction) &&
    typeof d.difficulty === 'string' &&
    isValidDifficulty(d.difficulty) &&
    validatePlayer(d.currentPlayer) &&
    Array.isArray(d.aiPlayers) &&
    (d.aiPlayers as unknown[]).every(validatePlayer) &&
    validateGameMapData(d.map) &&
    typeof d.gameState === 'string' &&
    isValidGameState(d.gameState);
  if (!baseValid) return false;
  // neutralBuildings is optional for backward compatibility
  if (d.neutralBuildings !== undefined) {
    if (!Array.isArray(d.neutralBuildings)) return false;
    if (!(d.neutralBuildings as unknown[]).every(validateBuilding)) return false;
  }
  return true;
}

export const AUTO_SAVE_SLOT_ID = 0;
export const AUTO_SAVE_LABEL = '自动存档';

export class SaveManager {
  SAVE_KEY = 'war_game_saves';
  MAX_SLOTS = 10;

  private readStorage(): SaveStorage {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return { slots: {}, metadata: {} };
      const parsed = JSON.parse(raw) as SaveStorage;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof parsed.slots !== 'object' ||
        typeof parsed.metadata !== 'object'
      ) {
        return { slots: {}, metadata: {} };
      }
      return parsed;
    } catch {
      return { slots: {}, metadata: {} };
    }
  }

  private writeStorage(storage: SaveStorage): boolean {
    try {
      const serialized = JSON.stringify(storage);
      localStorage.setItem(this.SAVE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }

  private extractMetadata(slotId: number, name: string, data: SaveData, thumbnail?: string | null): SaveSlot {
    return {
      id: slotId,
      name,
      timestamp: data.timestamp,
      gameTime: data.gameTime,
      faction: data.faction,
      difficulty: data.difficulty,
      thumbnail: thumbnail ?? null,
    };
  }

  getSaveSlots(): SaveSlot[] {
    const storage = this.readStorage();
    const slots: SaveSlot[] = [];
    // Slot 0 is reserved for auto-save
    const autoSaveMeta = storage.metadata[AUTO_SAVE_SLOT_ID];
    if (autoSaveMeta) {
      slots.push(autoSaveMeta);
    } else {
      slots.push({
        id: AUTO_SAVE_SLOT_ID,
        name: AUTO_SAVE_LABEL,
        timestamp: 0,
        gameTime: 0,
        faction: Faction.NEUTRAL,
        difficulty: Difficulty.NORMAL,
        thumbnail: null,
      });
    }
    for (let i = 1; i <= this.MAX_SLOTS; i++) {
      const meta = storage.metadata[i];
      if (meta) {
        slots.push(meta);
      }
    }
    return slots;
  }

  saveGame(slotId: number, name: string, state: SaveData, thumbnail?: string | null): boolean {
    if (slotId < 0 || slotId > this.MAX_SLOTS) return false;
    if (!validateSaveData(state)) return false;

    const storage = this.readStorage();
    storage.slots[slotId] = state;
    storage.metadata[slotId] = this.extractMetadata(slotId, name, state, thumbnail);
    return this.writeStorage(storage);
  }

  loadGame(slotId: number): SaveData | null {
    if (slotId < 0 || slotId > this.MAX_SLOTS) return null;
    const storage = this.readStorage();
    const data = storage.slots[slotId];
    if (!data) return null;
    if (!validateSaveData(data)) return null;
    return data;
  }

  restoreGame(slotId: number): boolean {
    const data = this.loadGame(slotId);
    if (!data) return false;

    const aiControllers = new Map<string, AIController>();
    for (const aiPlayer of data.aiPlayers) {
      const controller = new AIController({
        faction: aiPlayer.faction,
        difficulty: aiPlayer.difficulty,
      });
      controller.start();
      aiControllers.set(aiPlayer.id, controller);
    }

    // Apply defaults for missing optional fields on units and rehydrate data references
    const allPlayers = [data.currentPlayer, ...data.aiPlayers];
    for (const player of allPlayers) {
      const factionUnits = getUnitsByFaction(player.faction);
      const factionBuildings = getBuildingsByFaction(player.faction);
      for (const unit of player.units) {
        // Rehydrate unit.data from current static data (serialized snapshot may be stale)
        const freshUnitData = factionUnits[unit.type];
        if (freshUnitData) {
          unit.data = freshUnitData;
        }
        unit.isDisguised = unit.isDisguised ?? false;
        unit.idleTimer = unit.idleTimer ?? 0;
        unit.transportId = unit.transportId ?? undefined;
        unit.passengers = unit.passengers ?? [];
        unit.maxPassengers = unit.maxPassengers ?? undefined;
        unit.isAttackMoving = unit.isAttackMoving ?? false;
        unit.attackTarget = unit.attackTarget ?? null;
        unit.stance = unit.stance ?? UnitStance.GUARD;
        unit.waypoints = unit.waypoints ?? [];
        unit.harvestTarget = unit.harvestTarget ?? null;
        unit.isNaval = unit.isNaval ?? freshUnitData?.isNaval ?? false;
        unit.chronoShiftTarget = unit.chronoShiftTarget ?? undefined;
        unit.chronoShiftTimer = unit.chronoShiftTimer ?? undefined;
        unit.isChronoShifting = unit.isChronoShifting ?? false;
        unit.isChronoCooldown = unit.isChronoCooldown ?? false;
        unit.isSubmerged = unit.isSubmerged ?? false;
        unit.ammo = unit.ammo ?? unit.data?.maxAmmo;
        unit.isReturningToBase = unit.isReturningToBase ?? false;
        unit._buffUntil = unit._buffUntil ?? undefined;
        unit._debuffUntil = unit._debuffUntil ?? undefined;
        unit.isInvulnerable = unit.isInvulnerable ?? false;
        unit.invulnerableUntil = unit.invulnerableUntil ?? undefined;
        unit.isRepairingAtFactory = unit.isRepairingAtFactory ?? false;
      }
      for (const building of player.buildings) {
        // Rehydrate building.data from current static data
        const freshBuildingData = factionBuildings[building.type];
        if (freshBuildingData) {
          building.data = freshBuildingData;
        }
        building.empDisabledUntil = building.empDisabledUntil ?? undefined;
        building.isRepairing = building.isRepairing ?? false;
        building.productionQueue = building.productionQueue || [];
        building.rallyPoint = building.rallyPoint ?? null;
        building.newUnitCooldown = building.newUnitCooldown ?? 0;
        building.producingUnit = building.producingUnit ?? null;
        building.superweaponChargeProgress = building.superweaponChargeProgress ?? 0;
        building.superweaponReady = building.superweaponReady ?? false;
        building.oreStorage = building.oreStorage ?? 0;
        building.maxOreStorage = building.maxOreStorage ?? 0;
        building.attack = building.attack ?? 0;
        building.attackRange = building.attackRange ?? 0;
        building.attackSpeed = building.attackSpeed ?? 0;
        building.attackTarget = building.attackTarget ?? null;
        building.attackCooldown = building.attackCooldown ?? 0;
      }
      player.researchedUpgrades = player.researchedUpgrades ?? [];
      player.researchQueue = player.researchQueue ?? [];
      player.statistics = player.statistics ?? { unitsProduced: 0, unitsLost: 0, enemiesDestroyed: 0, buildingsBuilt: 0, buildingsLost: 0, resourcesGathered: 0 };
      player._tempSpySatelliteUntil = player._tempSpySatelliteUntil ?? undefined;
    }
    // Rehydrate neutral building data
    if (data.neutralBuildings) {
      const neutralBuildings = getBuildingsByFaction(Faction.NEUTRAL);
      for (const building of data.neutralBuildings) {
        const freshBuildingData = neutralBuildings[building.type];
        if (freshBuildingData) {
          building.data = freshBuildingData;
        }
      }
    }

    useGameStore.setState({
      currentPlayer: data.currentPlayer,
      aiPlayers: data.aiPlayers,
      aiControllers,
      map: data.map,
      gameState: data.gameState,
      isPaused: false,
      gameTime: data.gameTime,
      gameSpeed: (data.gameSettings?.gameSpeed ?? 1) as import('../engine/GameEngine').GameSpeed,
      neutralBuildings: data.neutralBuildings || [],
    });

    return true;
  }

  deleteSave(slotId: number): boolean {
    if (slotId < 0 || slotId > this.MAX_SLOTS) return false;
    const storage = this.readStorage();
    if (!storage.slots[slotId]) return false;
    delete storage.slots[slotId];
    delete storage.metadata[slotId];
    return this.writeStorage(storage);
  }

  hasSave(slotId: number): boolean {
    if (slotId < 0 || slotId > this.MAX_SLOTS) return false;
    const storage = this.readStorage();
    return slotId in storage.slots;
  }

  exportSave(slotId: number): string | null {
    const data = this.loadGame(slotId);
    if (!data) return null;
    try {
      const json = JSON.stringify(data);
      return btoa(unescape(encodeURIComponent(json)));
    } catch {
      return null;
    }
  }

  importSave(slotId: number, data: string): boolean {
    if (slotId < 0 || slotId > this.MAX_SLOTS) return false;
    try {
      const json = decodeURIComponent(escape(atob(data)));
      const parsed = JSON.parse(json);
      if (!validateSaveData(parsed)) return false;
      const storage = this.readStorage();
      storage.slots[slotId] = parsed;
      storage.metadata[slotId] = this.extractMetadata(slotId, `Imported ${new Date().toLocaleString()}`, parsed);
      return this.writeStorage(storage);
    } catch {
      return false;
    }
  }

  getStorageUsage(): { used: number; total: number } {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      const used = raw ? new Blob([raw]).size : 0;
      const total = 5 * 1024 * 1024;
      return { used, total };
    } catch {
      return { used: 0, total: 5 * 1024 * 1024 };
    }
  }

  clearAllSaves(): void {
    try {
      localStorage.removeItem(this.SAVE_KEY);
    } catch {
      // silently fail
    }
  }
}

export const saveManager = new SaveManager();
