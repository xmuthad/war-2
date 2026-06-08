import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  GameState,
  Faction,
  Player,
  PlayerSlot,
  Unit,
  Building,
  GameMapData,
  Vector2,
  BuildingType,
  BuildingData,
  UnitType,
  UnitData,
  UnitState,
  UnitRank,
  Difficulty,
  BuildQueueItem,
  UpgradeType,
  UnitStance,
  VictoryConditionType,
} from '../types';
import { getFactionGroup } from '../types';
import { FACTION_BONUSES } from '../game/systems/FactionSystem';
import { BUILDINGS_BY_FACTION, UNITS_BY_FACTION } from '../game/systems/AIUnitLookup';
import { GameSpeed } from '../game/engine/GameEngine';
import { AIController } from '../game/systems/AIController';
import { buildAIContext } from '../game/systems/AIContextAdapter';
import { createGameCommands } from '../game/systems/AIGameCommands';

import { gameEventBus } from '../game/systems/GameEventBus';
import { saveManager } from '../game/systems/SaveManager';
import { mapManager } from '../game/map/MapManager';
import { PowerSystem } from '../game/systems/PowerSystem';
import { ProductionSystem } from '../game/systems/ProductionSystem';
import { MovementSystem } from '../game/systems/MovementSystem';
import { PathfindingManager } from '../game/systems/PathfindingManager';
import { HarvestSystem } from '../game/systems/HarvestSystem';
import { VictoryConditionSystem } from '../game/systems/VictoryConditionSystem';
import { RepairSystem } from '../game/systems/RepairSystem';
import { AutoEngageSystem } from '../game/systems/AutoEngageSystem';
import { AutoHarvestSystem } from '../game/systems/AutoHarvestSystem';
import { AttackWaveSystem } from '../game/systems/AttackWaveSystem';
import { captureSystem } from '../game/systems/CaptureSystem';
import { AI_CONFIG } from '../game/config/AIConfig';
import { CombatUpdateSystem } from '../game/systems/CombatUpdateSystem';
import { combatSystem, DamageType, ArmorType } from '../game/systems/CombatSystem';
import { GAME_CONFIG } from '../game/config/GameConfig';
import { UPGRADES } from '../game/data/upgrades';
import { ACHIEVEMENTS, loadUnlockedAchievements, saveUnlockedAchievements, Achievement } from '../game/data/achievements';
import { CampaignMission, CampaignProgress, CampaignId, createDefaultCampaignProgress, completeMission as completeCampaignMission } from '../game/systems/campaigns';

let crateSpawnTimer = 0;
let oreRegenTimer = 0;
let lastFogUpdateTime = 0;
let achievementCheckTimer = 0;
let autoSaveTimer = 0;
const ACHIEVEMENT_CHECK_INTERVAL = 30;
const AUTO_SAVE_INTERVAL = 300; // 5 minutes in seconds
const FOG_UPDATE_INTERVAL = 200;
const ORE_REGEN_INTERVAL = 120; // 2 minutes

export interface GameSettings {
  startingResources: number;
  gameSpeed: number;
  fogOfWarEnabled: boolean;
  superweaponsEnabled: boolean;
  oreRegenRate: number; // 0=none, 1=slow, 2=normal, 3=fast
  aiDifficultyPerPlayer: Record<string, Difficulty>;
}

const DEFAULT_GAME_SETTINGS: GameSettings = {
  startingResources: 5000,
  gameSpeed: 1,
  fogOfWarEnabled: true,
  superweaponsEnabled: true,
  oreRegenRate: 2,
  aiDifficultyPerPlayer: {},
};

const powerSystem = new PowerSystem();
const productionSystem = new ProductionSystem();
const movementSystem = new MovementSystem();
const pathfindingManager = new PathfindingManager();
const harvestSystem = new HarvestSystem();
const victoryConditionSystem = new VictoryConditionSystem();
const repairSystem = new RepairSystem();
const combatUpdateSystem = new CombatUpdateSystem();
const autoEngageSys = new AutoEngageSystem();
const autoHarvestSys = new AutoHarvestSystem();
const attackWaveSys = new AttackWaveSystem();

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 100;

function isEnemy(attackerFaction: Faction, attackerTeamId: number | undefined, targetFaction: Faction, targetTeamId: number | undefined): boolean {
  if (attackerTeamId !== undefined && targetTeamId !== undefined && attackerTeamId === targetTeamId) {
    return false;
  }
  return true;
}

interface GameStore {
  currentPlayer: Player | null;
  aiPlayers: Player[];
  aiControllers: Map<string, AIController>;
  map: GameMapData | null;
  isObserverMode: boolean;
  isPaused: boolean;
  gameState: GameState;
  gameTime: number;
  selectedUnits: Unit[];
  selectedBuilding: Building | null;
  neutralBuildings: Building[];
  showStats: boolean;
  resources: { money: number; power: number; techLevel: number } | null;
  alertLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' | 'extreme' | null;
  alertClearTimer: number;
  gameLogs: LogEntry[];
  gameSpeed: GameSpeed;
  cameraPosition: Vector2;
  cameraViewport: { width: number; height: number };
  placementBuildingType: BuildingType | null;
  placementPreviewPos: Vector2 | null;
  placementValid: boolean;
  selectionBox: { start: Vector2; end: Vector2 } | null;
  fogVisibleTiles: Set<string>;
  weatherSpeedModifier: number;
  weatherVisionModifier: number;
  weatherBuildModifier: number;
  dayNightVisionModifier: number;
  setGameState: (state: GameState) => void;
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  setGameSpeed: (speed: GameSpeed) => void;
  setCameraPosition: (position: Vector2) => void;
  setCameraViewport: (viewport: { width: number; height: number }) => void;
  toggleStats: () => void;
  initializeGame: (playerSlot: PlayerSlot, aiSlots: PlayerSlot[], map: GameMapData, observerMode?: boolean) => void;
  selectUnits: (units: Unit[]) => void;
  selectBuilding: (building: Building | null) => void;
  moveUnit: (unitId: string, position: Vector2) => void;
  moveUnitsToTarget: (unitIds: string[], target: Vector2) => void;
  attackMoveUnit: (unitId: string, position: Vector2) => void;
  attackMoveUnitsToTarget: (unitIds: string[], target: Vector2) => void;
  attackUnit: (attackerId: string, targetId: string) => void;
  harvestResource: (unitId: string, resourceId: string) => void;
  produceUnit: (buildingId: string, unitType: UnitType) => void;
  buildStructure: (buildingType: BuildingType, position: Vector2) => void;
  destroyUnit: (unitId: string) => void;
  damageUnit: (unitId: string, damage: number) => void;
  sellBuilding: (buildingId: string) => void;
  repairBuilding: (buildingId: string) => void;
  repairUnitBuilding: (unitId: string, buildingId: string) => void;
  setRallyPoint: (buildingId: string, position: Vector2 | null) => void;
  log: (message: string, level?: LogLevel) => void;
  getLogs: (level?: LogLevel, limit?: number) => LogEntry[];
  clearLogs: () => void;
  destroyBuilding: (buildingId: string) => void;
  damageBuilding: (buildingId: string, damage: number, damageType?: DamageType) => void;
  updateResources: (playerId: string, amount: number) => void;
  update: (deltaTime: number) => void;
  updateAI: () => void;
  addToBuildQueue: (item: BuildQueueItem) => void;
  removeFromBuildQueue: (itemId: string) => void;
  getAllPlayers: () => Player[];
  getPlayerById: (playerId: string) => Player | null;
  setUnitWaypoints: (unitId: string, waypoints: Vector2[], state: UnitState) => void;
  clearUnitWaypoints: (unitId: string) => void;
  buildStructureForPlayer: (playerId: string, buildingType: BuildingType, position: Vector2) => void;
  produceUnitForPlayer: (playerId: string, buildingId: string, unitType: UnitType) => void;
  repairBuildingForPlayer: (playerId: string, buildingId: string) => void;
  sellBuildingForPlayer: (playerId: string, buildingId: string) => void;
  setRallyPointForPlayer: (playerId: string, buildingId: string, position: Vector2 | null) => void;
  upgradeBuildingForPlayer: (playerId: string, buildingId: string) => void;
  findUnitOwner: (unitId: string) => Player | null;
  findBuildingOwner: (buildingId: string) => Player | null;
  resetGame: () => void;
  startBuildingPlacement: (buildingType: BuildingType) => void;
  cancelBuildingPlacement: () => void;
  updatePlacementPreview: (position: Vector2 | null) => void;
  confirmBuildingPlacement: () => void;
  captureBuilding: (capturerId: string, buildingId: string) => void;
  startDragSelection: (worldPos: Vector2) => void;
  updateDragSelection: (worldPos: Vector2) => void;
  endDragSelection: () => void;
  researchUpgrade: (upgradeType: UpgradeType) => void;
  researchUpgradeForPlayer: (playerId: string, upgradeType: UpgradeType) => void;
  completeUpgrade: (playerId: string, upgradeType: UpgradeType) => void;
  processResearchQueue: (deltaTime: number) => void;
  loadIntoTransport: (unitId: string, transportId: string) => void;
  unloadFromTransport: (transportId: string, position?: Vector2) => void;
  cancelProduction: (buildingId: string, queueIndex: number) => void;
  sendToRepairFactory: (unitId: string) => void;
  activateNuclearSilo: (buildingId: string, targetPosition: Vector2) => void;
  activateIronCurtain: (buildingId: string, targetPosition: Vector2) => void;
  activateChronosphere: (buildingId: string, sourcePosition: Vector2, targetPosition: Vector2) => void;
  // Campaign state
  selectedCampaign: CampaignId | null;
  selectedMission: CampaignMission | null;
  isCampaignMode: boolean;
  campaignProgress: Record<CampaignId, CampaignProgress>;
  missionResult: 'victory' | 'defeat' | 'timeout' | null;
  missionStats: {
    time: number;
    unitsProduced: number;
    unitsLost: number;
    enemiesDestroyed: number;
    buildingsBuilt: number;
    buildingsLost: number;
    resourcesGathered: number;
    rating: number;
  } | null;
  lastMissionDifficulty: Difficulty;
  selectCampaign: (campaignId: CampaignId) => void;
  selectMission: (mission: CampaignMission) => void;
  startCampaignMission: (mission: CampaignMission, difficulty: Difficulty) => void;
  completeCampaignMission: (result: 'victory' | 'defeat' | 'timeout') => void;
  loadCampaignProgress: () => void;
  updateFogVisibility: (fogOfWar: { isTileVisible: (tileX: number, tileY: number) => boolean } | undefined) => void;
  updateWeatherModifiers: (weatherType: string) => void;
  updateDayNightVisionModifier: (timeOfDay: string) => void;
  setUnitStance: (unitIds: string[], stance: UnitStance) => void;
  selectIdleMiners: () => void;
  selectIdleMilitary: () => void;
  surrender: () => void;
  maxUnits: number;
  gameSettings: GameSettings;
  setGameSettings: (settings: Partial<GameSettings>) => void;
  // Achievement system
  unlockedAchievements: string[];
  newAchievement: Achievement | null;
  checkAchievements: () => void;
  clearNewAchievement: () => void;
  // Tutorial system
  tutorialActive: boolean;
  tutorialStep: number;
  tutorialHighlight: string | null;
  startTutorial: () => void;
  endTutorial: () => void;
  setTutorialStep: (step: number) => void;
  // Camera bookmarks
  cameraBookmarks: Array<{ x: number; y: number } | null>;
  saveCameraBookmark: (index: number, position: { x: number; y: number }) => void;
  loadCameraBookmark: (index: number) => { x: number; y: number } | null;
}

function createUnitFromData(type: UnitType, faction: Faction, position: Vector2, researchedUpgrades: UpgradeType[] = []): Unit {
  const factionUnits = UNITS_BY_FACTION[faction] || {};
  const unitData = factionUnits[type];
  if (!unitData) {
    const fallbackData: UnitData = {
      type,
      faction,
      name: type,
      health: 100,
      armor: 0,
      attack: 10,
      attackRange: 5,
      attackSpeed: 1,
      speed: 3,
      vision: 5,
      cost: 500,
      buildTime: 10,
      canAttack: true,
      canHarvest: false,
      canCapture: false,
      isAirborne: false,
    };
    return createUnitInternal(type, faction, position, fallbackData, researchedUpgrades);
  }
  const data = unitData as UnitData;
  return createUnitInternal(type, faction, position, data, researchedUpgrades);
}

function createUnitInternal(type: UnitType, faction: Faction, position: Vector2, data: UnitData, researchedUpgrades: UpgradeType[] = []): Unit {
  // Apply upgrade bonuses to base stats
  let attack = data.attack;
  let armor = data.armor;
  let speed = data.speed;
  let attackRange = data.attackRange;

  if (INFANTRY_TYPES.has(type)) {
    if (researchedUpgrades.includes(UpgradeType.INFANTRY_ATTACK)) {
      attack = Math.floor(attack * 1.1);
    }
    if (researchedUpgrades.includes(UpgradeType.CONSCRIPT_ATTACK)) {
      attack = Math.floor(attack * 1.15);
    }
    if (researchedUpgrades.includes(UpgradeType.ELITE_FORCES)) {
      attack = Math.floor(attack * 1.1);
    }
  }

  if (type === UnitType.ROCKET || type === UnitType.FLAKINFANTRY) {
    if (researchedUpgrades.includes(UpgradeType.ROCKET_RANGE)) {
      attackRange = Math.floor(attackRange * 1.15);
    }
  }

  if (VEHICLE_TYPES.has(type)) {
    if (researchedUpgrades.includes(UpgradeType.ARMOR_REINFORCE)) {
      armor = Math.floor(armor * 1.2);
    }
    if (researchedUpgrades.includes(UpgradeType.HEAVY_ARMOR)) {
      armor = Math.floor(armor * 1.3);
    }
    if (researchedUpgrades.includes(UpgradeType.ENGINE_OPTIMIZE)) {
      speed = Math.floor(speed * 1.15);
    }
    if (researchedUpgrades.includes(UpgradeType.TURBO_ENGINE)) {
      speed = Math.floor(speed * 1.2);
    }
    if (researchedUpgrades.includes(UpgradeType.ADVANCED_ARTILLERY)) {
      attack = Math.floor(attack * 1.25);
    }
    if (researchedUpgrades.includes(UpgradeType.PRISM_TECH) && type === UnitType.PRISM) {
      attack = Math.floor(attack * 1.15);
    }
    if (researchedUpgrades.includes(UpgradeType.TESLA_WEAPONS) && type === UnitType.TESLA) {
      attack = Math.floor(attack * 1.2);
    }
  }

  // Apply faction bonuses
  const factionBonus = FACTION_BONUSES[faction];
  if (factionBonus) {
    attack = Math.floor(attack * factionBonus.attack);
    armor = Math.floor(armor * factionBonus.defense);
    speed = speed * factionBonus.speed;
    attackRange = Math.floor(attackRange * factionBonus.vision);
  }

  return {
    id: `${faction}_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type,
    faction,
    position: { ...position },
    health: data.health,
    maxHealth: data.health,
    armor,
    attack,
    attackRange,
    attackSpeed: data.attackSpeed,
    speed,
    vision: factionBonus ? Math.floor(data.vision * factionBonus.vision) : data.vision,
    cost: factionBonus ? Math.floor(data.cost * factionBonus.unitCost) : data.cost,
    buildTime: data.buildTime,
    state: UnitState.IDLE,
    target: null,
    waypoints: [],
    isAirborne: data.isAirborne,
    isNaval: data.isNaval,
    isSelected: false,
    isBuilding: false,
    buildProgress: 0,
    data,
    harvestTarget: null,
    cargo: 0,
    cargoCapacity: type === UnitType.MINER ? GAME_CONFIG.CARGO_CAPACITY : 0,
    kills: 0,
    rank: UnitRank.ROOKIE,
    direction: 0,
    passengers: data.maxPassengers ? [] : undefined,
    maxPassengers: data.maxPassengers,
    stance: UnitStance.GUARD,
  };
}

function createBuildingFromData(type: BuildingType, faction: Faction, position: Vector2): Building {
  const factionBuildings = BUILDINGS_BY_FACTION[faction] || {};
  const buildingData = factionBuildings[type];
  if (!buildingData) {
    const fallbackData: BuildingData = {
      type,
      faction,
      name: type,
      health: 500,
      powerOutput: 0,
      powerConsumption: 0,
      cost: 500,
      buildTime: 10,
      width: 2,
      height: 2,
      canProduce: [],
      requiredBuildings: [],
    };
    return createBuildingInternal(type, faction, position, fallbackData);
  }
  const data = buildingData as BuildingData;
  return createBuildingInternal(type, faction, position, data);
}

function createBuildingInternal(type: BuildingType, faction: Faction, position: Vector2, data: BuildingData): Building {
  // Apply faction building cost bonus
  const factionBonus = FACTION_BONUSES[faction];

  return {
    id: `${faction}_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type,
    faction,
    position: { ...position },
    health: data.health,
    maxHealth: data.health,
    powerOutput: factionBonus ? Math.floor(data.powerOutput * factionBonus.powerEfficiency) : data.powerOutput,
    powerConsumption: data.powerConsumption,
    cost: factionBonus ? Math.floor(data.cost * factionBonus.buildingCost) : data.cost,
    buildTime: data.buildTime,
    width: data.width,
    height: data.height,
    canProduce: data.canProduce,
    requiredBuildings: data.requiredBuildings,
    isPowered: true,
    isSelected: false,
    isBuilding: false,
    buildProgress: 1,
    isConstructed: true,
    data,
    productionQueue: [],
    rallyPoint: null,
    isActive: true,
    newUnitCooldown: 0,
    producingUnit: null,
    attack: data.attack,
    attackRange: data.attackRange,
    attackSpeed: data.attackSpeed,
    attackTarget: null,
    attackCooldown: 0,
    superweaponChargeTime: data.superweaponChargeTime,
    superweaponChargeProgress: 0,
    superweaponReady: false,
    oreStorage: type === BuildingType.REFINERY ? 0 : undefined,
    maxOreStorage: type === BuildingType.REFINERY ? 1000 : undefined,
  };
}

// Unit types that require specific upgrades to produce
export const UNIT_UPGRADE_REQUIREMENTS: Partial<Record<UnitType, UpgradeType>> = {
  [UnitType.PRISM]: UpgradeType.PRISM_TECH,
  [UnitType.TESLA]: UpgradeType.TESLA_WEAPONS,
  [UnitType.DESPOT]: UpgradeType.ELITE_FORCES,
  [UnitType.CHRONO]: UpgradeType.CHRONO_TECH,
};

function getRequiredUpgradeForUnit(unitType: UnitType): UpgradeType | null {
  return UNIT_UPGRADE_REQUIREMENTS[unitType] || null;
}

// Infantry unit types that benefit from attack upgrades
const INFANTRY_TYPES = new Set([
  UnitType.SOLDIER, UnitType.ROCKET, UnitType.SNIPER, UnitType.SEAL,
  UnitType.TANYA, UnitType.CONSCRIPT, UnitType.FLAKINFANTRY,
  UnitType.TERRORIST, UnitType.IVAN, UnitType.CHRONO,
]);

// Vehicle unit types that benefit from armor/speed/damage upgrades
const VEHICLE_TYPES = new Set([
  UnitType.TANK, UnitType.IFV, UnitType.PRISM, UnitType.RHINO,
  UnitType.APOCALYPSE, UnitType.TESLA, UnitType.PHANTOM,
  UnitType.GUARDIAN, UnitType.FLAK, UnitType.DESPOT, UnitType.APC,
]);

const FORMATION_SPACING = 40; // Pixels between units in formation
export const MAX_SELECTION_COUNT = 30;

export function calculateFormation(center: Vector2, units: Unit[]): Map<string, Vector2> {
  const result = new Map<string, Vector2>();

  if (units.length === 0) return result;

  // Separate units by type: vehicles in front, infantry behind, naval, airborne last
  const vehicles = units.filter(u => VEHICLE_TYPES.has(u.type));
  const infantry = units.filter(u => !VEHICLE_TYPES.has(u.type) && !u.isAirborne && !u.isNaval);
  const naval = units.filter(u => !!u.isNaval && !u.isAirborne && !VEHICLE_TYPES.has(u.type));
  const airborne = units.filter(u => u.isAirborne);

  const count = units.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  const startX = center.x - (cols - 1) * FORMATION_SPACING / 2;
  const startY = center.y - (rows - 1) * FORMATION_SPACING / 2;

  let idx = 0;

  const assignPosition = (unit: Unit) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    result.set(unit.id, {
      x: startX + col * FORMATION_SPACING,
      y: startY + row * FORMATION_SPACING,
    });
    idx++;
  };

  // Vehicles first (front rows)
  for (const unit of vehicles) assignPosition(unit);
  // Infantry behind vehicles
  for (const unit of infantry) assignPosition(unit);
  // Naval units
  for (const unit of naval) assignPosition(unit);
  // Airborne last
  for (const unit of airborne) assignPosition(unit);

  return result;
}

function applyUpgradeEffects(player: Player, upgradeType: UpgradeType): void {
  switch (upgradeType) {
    // Power upgrades: increase output of all Power Plants
    case UpgradeType.ADVANCED_POWER: {
      for (const building of player.buildings) {
        if (building.type === BuildingType.POWER && building.isConstructed) {
          building.powerOutput = Math.floor(building.powerOutput * 1.5);
        }
      }
      break;
    }
    case UpgradeType.NUCLEAR_POWER: {
      for (const building of player.buildings) {
        if (building.type === BuildingType.POWER && building.isConstructed) {
          building.powerOutput = Math.floor(building.powerOutput * 2);
        }
      }
      break;
    }

    // Infantry attack upgrades: apply to existing infantry units
    case UpgradeType.INFANTRY_ATTACK: {
      for (const unit of player.units) {
        if (INFANTRY_TYPES.has(unit.type)) {
          unit.attack = Math.floor(unit.attack * 1.1);
        }
      }
      break;
    }
    case UpgradeType.CONSCRIPT_ATTACK: {
      for (const unit of player.units) {
        if (INFANTRY_TYPES.has(unit.type)) {
          unit.attack = Math.floor(unit.attack * 1.15);
        }
      }
      break;
    }

    // Rocket range upgrade
    case UpgradeType.ROCKET_RANGE: {
      for (const unit of player.units) {
        if (unit.type === UnitType.ROCKET || unit.type === UnitType.FLAKINFANTRY) {
          unit.attackRange = Math.floor(unit.attackRange * 1.15);
        }
      }
      break;
    }

    // Vehicle armor upgrades
    case UpgradeType.ARMOR_REINFORCE: {
      for (const unit of player.units) {
        if (VEHICLE_TYPES.has(unit.type)) {
          unit.armor = Math.floor(unit.armor * 1.2);
        }
      }
      break;
    }
    case UpgradeType.HEAVY_ARMOR: {
      for (const unit of player.units) {
        if (VEHICLE_TYPES.has(unit.type)) {
          unit.armor = Math.floor(unit.armor * 1.3);
        }
      }
      break;
    }

    // Vehicle speed upgrades
    case UpgradeType.ENGINE_OPTIMIZE: {
      for (const unit of player.units) {
        if (VEHICLE_TYPES.has(unit.type)) {
          unit.speed = Math.floor(unit.speed * 1.15);
        }
      }
      break;
    }
    case UpgradeType.TURBO_ENGINE: {
      for (const unit of player.units) {
        if (VEHICLE_TYPES.has(unit.type)) {
          unit.speed = Math.floor(unit.speed * 1.2);
        }
      }
      break;
    }

    // Vehicle damage upgrades
    case UpgradeType.ADVANCED_ARTILLERY: {
      for (const unit of player.units) {
        if (VEHICLE_TYPES.has(unit.type)) {
          unit.attack = Math.floor(unit.attack * 1.25);
        }
      }
      break;
    }

    // Tech unlock upgrades - these are handled by checking researchedUpgrades
    // when producing units or in the build panel
    case UpgradeType.PRISM_TECH:
    case UpgradeType.TESLA_WEAPONS:
    case UpgradeType.ELITE_FORCES:
    case UpgradeType.EMP_TECH:
    case UpgradeType.CHRONO_TECH:
    case UpgradeType.SPY_SATELLITE:
    case UpgradeType.ORE_COMPRESSION:
    case UpgradeType.GOLD_REFINING:
      // These upgrades have passive effects that are checked at runtime
      break;
  }
}

export const useGameStore = create<GameStore>()(immer((set, get) => ({
  currentPlayer: null,
  aiPlayers: [],
  aiControllers: new Map(),
  map: null,
  isObserverMode: false,
  isPaused: false,
  gameState: GameState.MENU,
  gameTime: 0,
  selectedUnits: [],
  selectedBuilding: null,
  neutralBuildings: [],
  showStats: false,
  resources: null,
  alertLevel: null,
  alertClearTimer: 0,
  gameLogs: [],
  gameSpeed: 1,
  cameraPosition: { x: 0, y: 0 },
  cameraViewport: { width: 800, height: 600 },
  placementBuildingType: null,
  placementPreviewPos: null,
  placementValid: false,
  selectionBox: null,
  fogVisibleTiles: new Set<string>(),
  weatherSpeedModifier: 1.0,
  weatherVisionModifier: 1.0,
  weatherBuildModifier: 1.0,
  dayNightVisionModifier: 1.0,
  gameSettings: { ...DEFAULT_GAME_SETTINGS },
  maxUnits: 50,
  // Campaign state
  selectedCampaign: null,
  selectedMission: null,
  isCampaignMode: false,
  campaignProgress: createDefaultCampaignProgress(),
  missionResult: null,
  missionStats: null,
  lastMissionDifficulty: Difficulty.NORMAL,
  // Achievement system
  unlockedAchievements: loadUnlockedAchievements(),
  newAchievement: null,
  // Tutorial system
  tutorialActive: false,
  tutorialStep: 0,
  tutorialHighlight: null,
  // Camera bookmarks
  cameraBookmarks: [null, null, null, null],

  setGameState: (state) => set({ gameState: state }),

  setPaused: (paused) => set({ isPaused: paused }),

  togglePause: () => {
    set((draft) => {
      draft.isPaused = !draft.isPaused;
    });
  },

  setGameSpeed: (speed) => set({ gameSpeed: speed }),

  toggleStats: () => set(draft => {
    draft.showStats = !draft.showStats;
  }),

  setCameraPosition: (position) => set({ cameraPosition: position }),

  setCameraViewport: (viewport) => set({ cameraViewport: viewport }),

  getAllPlayers: () => {
    const state = get();
    return [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
  },

  getPlayerById: (playerId) => {
    const state = get();
    if (state.currentPlayer?.id === playerId) return state.currentPlayer;
    return state.aiPlayers.find(p => p.id === playerId) || null;
  },

  findUnitOwner: (unitId) => {
    const state = get();
    if (state.currentPlayer?.units.some(u => u.id === unitId)) return state.currentPlayer;
    return state.aiPlayers.find(p => p.units.some(u => u.id === unitId)) || null;
  },

  findBuildingOwner: (buildingId) => {
    const state = get();
    if (state.currentPlayer?.buildings.some(b => b.id === buildingId)) return state.currentPlayer;
    return state.aiPlayers.find(p => p.buildings.some(b => b.id === buildingId)) || null;
  },

  initializeGame: (playerSlot, aiSlots, map, observerMode = false) => {
    const settings = get().gameSettings;
    const validationResult = mapManager.validate(map);
    if (!validationResult.valid) {
      console.error('Map validation failed:', validationResult.errors);
      return;
    }
    if (validationResult.warnings.length > 0) {
      console.warn('Map warnings:', validationResult.warnings);
    }

    mapManager.initialize(map);

    // Initialize pathfinding grid from map data
    pathfindingManager.initialize(map, { tileSize: GAME_CONFIG.TILE_SIZE });
    movementSystem.setPathfindingManager(pathfindingManager);

    // Helper to generate ore fields around a position
    const generateOreField = (centerX: number, centerY: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 8 + Math.random() * 12;
        const ox = Math.floor(centerX + Math.cos(angle) * distance);
        const oy = Math.floor(centerY + Math.sin(angle) * distance);
        // Clamp to map bounds
        const cx = Math.max(1, Math.min(map.width - 2, ox));
        const cy = Math.max(1, Math.min(map.height - 2, oy));
        // Don't add duplicate at same position
        const exists = map.resourceNodes.some(r => r.position.x === cx && r.position.y === cy);
        if (!exists) {
          map.resourceNodes.push({
            id: `ore_${cx}_${cy}_${Date.now()}_${i}`,
            resourceType: 'ore',
            position: { x: cx, y: cy },
            amount: 500,
            maxAmount: 500,
          });
          // Set terrain tiles around this ore node to ORE type
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const tx = cx + dx;
              const ty = cy + dy;
              if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                const tile = map.tiles[ty]?.[tx] as { type: string } | undefined;
                if (tile && tile.type === 'grass') {
                  tile.type = 'ore';
                }
              }
            }
          }
        }
      }
    };

    const spawnCount = map.spawnPoints.length;

    // In observer mode, create a dummy player with no units/buildings
    const currentPlayer: Player = observerMode
      ? {
          id: 'observer',
          faction: Faction.NEUTRAL,
          name: '观战者',
          money: 0,
          power: 0,
          maxPower: 0,
          units: [],
          buildings: [],
          buildQueue: [],
          researchedUpgrades: [],
          researchQueue: [],
          isAI: false,
          difficulty: playerSlot.difficulty,
          color: '#888888',
          isDefeated: false,
          isVictorious: false,
          teamId: 0,
          statistics: { unitsProduced: 0, unitsLost: 0, enemiesDestroyed: 0, buildingsBuilt: 0, buildingsLost: 0, resourcesGathered: 0 },
        }
      : {
          id: playerSlot.id,
          faction: playerSlot.faction,
          name: playerSlot.name,
          money: settings.startingResources,
          power: GAME_CONFIG.STARTING_POWER,
          maxPower: GAME_CONFIG.STARTING_MAX_POWER,
          units: [],
          buildings: [],
          buildQueue: [],
          researchedUpgrades: [],
          researchQueue: [],
          isAI: false,
          difficulty: playerSlot.difficulty,
          color: playerSlot.color,
          isDefeated: false,
          isVictorious: false,
          teamId: playerSlot.teamId,
          statistics: { unitsProduced: 0, unitsLost: 0, enemiesDestroyed: 0, buildingsBuilt: 0, buildingsLost: 0, resourcesGathered: 0 },
        };

    const spawnIndex = 0;

    // Only place buildings/units for real player (not observer)
    if (!observerMode) {
      const playerSpawn = map.spawnPoints[spawnIndex] || { x: 5, y: 5 };

      // Generate ore around player spawn
      generateOreField(playerSpawn.x, playerSpawn.y, 8);

      // Place Command Center at spawn
      currentPlayer.buildings.push(
        createBuildingFromData(BuildingType.COMMAND, playerSlot.faction, { x: playerSpawn.x * GAME_CONFIG.TILE_SIZE, y: playerSpawn.y * GAME_CONFIG.TILE_SIZE })
      );
      // Start with Power Plant and Barracks pre-built (RA-style)
      currentPlayer.buildings.push(
        createBuildingFromData(BuildingType.POWER, playerSlot.faction, { x: (playerSpawn.x + 5) * GAME_CONFIG.TILE_SIZE, y: playerSpawn.y * GAME_CONFIG.TILE_SIZE })
      );
      currentPlayer.buildings.push(
        createBuildingFromData(BuildingType.BARRACKS, playerSlot.faction, { x: (playerSpawn.x + 3) * GAME_CONFIG.TILE_SIZE, y: (playerSpawn.y + 4) * GAME_CONFIG.TILE_SIZE })
      );
      // Refinery is required for the harvester to deposit ore — without it the
      // economy stalls indefinitely (miner returns to nowhere). Place it adjacent
      // to the spawn so the very first miner can start earning immediately.
      currentPlayer.buildings.push(
        createBuildingFromData(BuildingType.REFINERY, playerSlot.faction, { x: (playerSpawn.x - 3) * GAME_CONFIG.TILE_SIZE, y: (playerSpawn.y + 2) * GAME_CONFIG.TILE_SIZE })
      );
      // Start with 3 soldiers and 1 miner
      currentPlayer.units.push(
        createUnitFromData(UnitType.SOLDIER, playerSlot.faction, { x: (playerSpawn.x + 2) * GAME_CONFIG.TILE_SIZE, y: (playerSpawn.y + 2) * GAME_CONFIG.TILE_SIZE }),
        createUnitFromData(UnitType.SOLDIER, playerSlot.faction, { x: (playerSpawn.x - 2) * GAME_CONFIG.TILE_SIZE, y: (playerSpawn.y + 2) * GAME_CONFIG.TILE_SIZE }),
        createUnitFromData(UnitType.SOLDIER, playerSlot.faction, { x: (playerSpawn.x + 1) * GAME_CONFIG.TILE_SIZE, y: (playerSpawn.y - 2) * GAME_CONFIG.TILE_SIZE }),
        createUnitFromData(UnitType.MINER, playerSlot.faction, { x: (playerSpawn.x + 4) * GAME_CONFIG.TILE_SIZE, y: (playerSpawn.y + 1) * GAME_CONFIG.TILE_SIZE })
      );
    }

    const aiPlayers: Player[] = [];
    const aiControllers = new Map<string, AIController>();

    for (let i = 0; i < aiSlots.length; i++) {
      const slot = aiSlots[i];
      const spawn = map.spawnPoints[(spawnIndex + 1 + i) % spawnCount] || { x: map.width - 9, y: map.height - 9 };

      // Generate ore around AI spawn
      generateOreField(spawn.x, spawn.y, 8);

      const aiPlayer: Player = {
        id: slot.id,
        faction: slot.faction,
        name: slot.name,
        money: settings.startingResources,
        power: GAME_CONFIG.STARTING_POWER,
        maxPower: GAME_CONFIG.STARTING_MAX_POWER,
        units: [],
        buildings: [],
        buildQueue: [],
        researchedUpgrades: [],
        researchQueue: [],
        isAI: true,
        difficulty: settings.aiDifficultyPerPlayer[slot.id] || slot.difficulty,
        color: slot.color,
        isDefeated: false,
        isVictorious: false,
        teamId: slot.teamId,
        statistics: { unitsProduced: 0, unitsLost: 0, enemiesDestroyed: 0, buildingsBuilt: 0, buildingsLost: 0, resourcesGathered: 0 },
      };

      aiPlayer.buildings.push(
        createBuildingFromData(BuildingType.COMMAND, slot.faction, { x: spawn.x * GAME_CONFIG.TILE_SIZE, y: spawn.y * GAME_CONFIG.TILE_SIZE })
      );
      aiPlayer.buildings.push(
        createBuildingFromData(BuildingType.POWER, slot.faction, { x: (spawn.x + 5) * GAME_CONFIG.TILE_SIZE, y: spawn.y * GAME_CONFIG.TILE_SIZE })
      );
      aiPlayer.buildings.push(
        createBuildingFromData(BuildingType.BARRACKS, slot.faction, { x: (spawn.x + 3) * GAME_CONFIG.TILE_SIZE, y: (spawn.y + 4) * GAME_CONFIG.TILE_SIZE })
      );
      // Mirror the player setup: AI also needs a refinery so its economy can run.
      aiPlayer.buildings.push(
        createBuildingFromData(BuildingType.REFINERY, slot.faction, { x: (spawn.x - 3) * GAME_CONFIG.TILE_SIZE, y: (spawn.y + 2) * GAME_CONFIG.TILE_SIZE })
      );
      aiPlayer.units.push(
        createUnitFromData(UnitType.SOLDIER, slot.faction, { x: (spawn.x + 2) * GAME_CONFIG.TILE_SIZE, y: (spawn.y + 2) * GAME_CONFIG.TILE_SIZE }),
        createUnitFromData(UnitType.SOLDIER, slot.faction, { x: (spawn.x - 2) * GAME_CONFIG.TILE_SIZE, y: (spawn.y + 2) * GAME_CONFIG.TILE_SIZE }),
        createUnitFromData(UnitType.SOLDIER, slot.faction, { x: (spawn.x + 1) * GAME_CONFIG.TILE_SIZE, y: (spawn.y - 2) * GAME_CONFIG.TILE_SIZE }),
        createUnitFromData(UnitType.MINER, slot.faction, { x: (spawn.x + 4) * GAME_CONFIG.TILE_SIZE, y: (spawn.y + 1) * GAME_CONFIG.TILE_SIZE })
      );

      aiPlayers.push(aiPlayer);

      const controller = new AIController({
        faction: slot.faction,
        difficulty: slot.difficulty,
      });
      controller.start();
      aiControllers.set(slot.id, controller);
    }

    // Place neutral buildings (oil derricks + hospital)
    const mapCenterX = Math.floor(map.width / 2) * GAME_CONFIG.TILE_SIZE;
    const mapCenterY = Math.floor(map.height / 2) * GAME_CONFIG.TILE_SIZE;
    const neutralBuildings: Building[] = [
      createBuildingFromData(BuildingType.OIL_DERRICK, Faction.NEUTRAL, {
        x: mapCenterX - GAME_CONFIG.TILE_SIZE * 4,
        y: mapCenterY - GAME_CONFIG.TILE_SIZE * 2
      }),
      createBuildingFromData(BuildingType.OIL_DERRICK, Faction.NEUTRAL, {
        x: mapCenterX + GAME_CONFIG.TILE_SIZE * 4,
        y: mapCenterY + GAME_CONFIG.TILE_SIZE * 2
      }),
      createBuildingFromData(BuildingType.HOSPITAL, Faction.NEUTRAL, {
        x: mapCenterX,
        y: mapCenterY
      }),
    ];

    // Apply superweapons setting: remove superweapon buildings if disabled
    if (!settings.superweaponsEnabled) {
      const superweaponTypes = [BuildingType.NUCLEAR_SILO, BuildingType.IRON_CURTAIN, BuildingType.CHRONOSPHERE];
      for (const player of [currentPlayer, ...aiPlayers]) {
        if (player) {
          player.buildings = player.buildings.filter(b => !superweaponTypes.includes(b.type));
        }
      }
    }

    // Set default victory condition (annihilation)
    victoryConditionSystem.reset();
    victoryConditionSystem.setConditions([{ type: VictoryConditionType.ANNIHILATION }]);

    set({
      currentPlayer,
      aiPlayers,
      aiControllers,
      map,
      neutralBuildings,
      gameState: GameState.PLAYING,
      isPaused: false,
      gameTime: 0,
      gameSpeed: settings.gameSpeed as GameSpeed,
      fogVisibleTiles: new Set<string>(),
      isObserverMode: observerMode,
      isCampaignMode: false,
      missionResult: null,
      missionStats: null,
    });

    for (const building of [...currentPlayer.buildings, ...aiPlayers.flatMap(p => p.buildings)]) {
      const tilePos = mapManager.worldToTile(building.position.x, building.position.y);
      mapManager.markOccupied(tilePos.x, tilePos.y, building.width, building.height, building.id);
    }
  },

  selectUnits: (units) => {
    set((state) => {
      const cappedUnits = units.length > MAX_SELECTION_COUNT
        ? units.slice(0, MAX_SELECTION_COUNT)
        : units;
      const unitIds = new Set(cappedUnits.map(u => u.id));
      if (state.currentPlayer) {
        state.currentPlayer.units.forEach(u => {
          u.isSelected = unitIds.has(u.id);
        });
      }
      state.selectedUnits = state.currentPlayer?.units.filter(u => unitIds.has(u.id)) || [];
    });
  },

  selectBuilding: (building) => {
    set((state) => {
      const buildingId = building?.id;
      if (state.currentPlayer) {
        state.currentPlayer.buildings.forEach(b => {
          b.isSelected = b.id === buildingId;
        });
      }
      state.selectedBuilding = buildingId
        ? (state.currentPlayer?.buildings.find(b => b.id === buildingId) ?? null)
        : null;
    });
  },

  moveUnit: (unitId, position) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit) {
          if (unit.type === UnitType.CHRONO) {
            // Chrono Legionnaire: teleport instead of walking
            if (unit.isChronoCooldown) return; // Can't move while on cooldown
            unit.chronoShiftTarget = { ...position };
            unit.chronoShiftTimer = 2.0; // 2 second charge time
            unit.isChronoShifting = true;
            unit.state = UnitState.MOVING; // Visual state
            unit.target = null;
            unit.isAttackMoving = false;
          } else {
            // Use A* pathfinding for intelligent route planning
            movementSystem.requestPath(unit, position.x, position.y);
            unit.state = UnitState.MOVING;
            unit.target = null;
            unit.isAttackMoving = false;
          }
          if (player === state.currentPlayer) {
            gameEventBus.emit('unit:move', { unitId, position });
          }
          break;
        }
      }
    });
  },

  attackMoveUnit: (unitId, position) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit) {
          if (unit.type === UnitType.CHRONO) {
            // Chrono Legionnaire: teleport instead of walking
            if (unit.isChronoCooldown) return;
            unit.chronoShiftTarget = { ...position };
            unit.chronoShiftTimer = 2.0;
            unit.isChronoShifting = true;
            unit.state = UnitState.MOVING;
            unit.target = null;
            unit.isAttackMoving = true;
          } else {
            // Use A* pathfinding for intelligent route planning
            movementSystem.requestPath(unit, position.x, position.y);
            unit.state = UnitState.MOVING;
            unit.target = null;
            unit.isAttackMoving = true;
          }
          if (player === state.currentPlayer) {
            gameEventBus.emit('unit:move', { unitId, position });
          }
          break;
        }
      }
    });
  },

  moveUnitsToTarget: (unitIds, target) => {
    set((state) => {
      if (unitIds.length === 0) return;

      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];

      // Find all requested units
      const foundUnits: Unit[] = [];
      for (const player of allPlayers) {
        for (const unit of player.units) {
          if (unitIds.includes(unit.id)) {
            foundUnits.push(unit);
          }
        }
      }

      if (foundUnits.length === 0) return;

      // Single unit: move directly to target
      if (foundUnits.length === 1) {
        const unit = foundUnits[0];
        if (unit.type === UnitType.CHRONO) {
          if (unit.isChronoCooldown) return;
          unit.chronoShiftTarget = { ...target };
          unit.chronoShiftTimer = 2.0;
          unit.isChronoShifting = true;
          unit.state = UnitState.MOVING;
          unit.target = null;
          unit.isAttackMoving = false;
        } else {
          // Use A* pathfinding for intelligent route planning
          movementSystem.requestPath(unit, target.x, target.y);
          unit.state = UnitState.MOVING;
          unit.target = null;
          unit.isAttackMoving = false;
        }
        const owner = allPlayers.find(p => p.units.some(u => u.id === unit.id));
        if (owner === state.currentPlayer) {
          gameEventBus.emit('unit:move', { unitId: unit.id, position: target });
        }
        return;
      }

      // Multiple units: calculate formation positions
      const formationMap = calculateFormation(target, foundUnits);

      for (const unit of foundUnits) {
        const pos = formationMap.get(unit.id);
        if (!pos) continue;

        if (unit.type === UnitType.CHRONO) {
          if (unit.isChronoCooldown) continue;
          unit.chronoShiftTarget = { ...pos };
          unit.chronoShiftTimer = 2.0;
          unit.isChronoShifting = true;
          unit.state = UnitState.MOVING;
          unit.target = null;
          unit.isAttackMoving = false;
        } else {
          // Use A* pathfinding for intelligent route planning
          movementSystem.requestPath(unit, pos.x, pos.y);
          unit.state = UnitState.MOVING;
          unit.target = null;
          unit.isAttackMoving = false;
        }
        const owner = allPlayers.find(p => p.units.some(u => u.id === unit.id));
        if (owner === state.currentPlayer) {
          gameEventBus.emit('unit:move', { unitId: unit.id, position: pos });
        }
      }
    });
  },

  attackMoveUnitsToTarget: (unitIds, target) => {
    set((state) => {
      if (unitIds.length === 0) return;

      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];

      const foundUnits: Unit[] = [];
      for (const player of allPlayers) {
        for (const unit of player.units) {
          if (unitIds.includes(unit.id)) {
            foundUnits.push(unit);
          }
        }
      }

      if (foundUnits.length === 0) return;

      // Single unit: attack-move directly
      if (foundUnits.length === 1) {
        const unit = foundUnits[0];
        movementSystem.requestPath(unit, target.x, target.y);
        unit.state = UnitState.MOVING;
        unit.target = null;
        unit.isAttackMoving = true;
        const owner = allPlayers.find(p => p.units.some(u => u.id === unit.id));
        if (owner === state.currentPlayer) {
          gameEventBus.emit('unit:move', { unitId: unit.id, position: target });
        }
        return;
      }

      // Multiple units: calculate formation positions
      const formationMap = calculateFormation(target, foundUnits);

      for (const unit of foundUnits) {
        const pos = formationMap.get(unit.id);
        if (!pos) continue;

        movementSystem.requestPath(unit, pos.x, pos.y);
        unit.state = UnitState.MOVING;
        unit.target = null;
        unit.isAttackMoving = true;
        const owner = allPlayers.find(p => p.units.some(u => u.id === unit.id));
        if (owner === state.currentPlayer) {
          gameEventBus.emit('unit:move', { unitId: unit.id, position: pos });
        }
      }
    });
  },

  attackUnit: (attackerId, targetId) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      let attacker: Unit | null = null;
      let attackerPlayer: Player | null = null;
      let targetUnit: Unit | null = null;
      let targetBuilding: Building | null = null;
      let targetOwner: Player | null = null;

      for (const player of allPlayers) {
        const u = player.units.find(u => u.id === attackerId);
        if (u) { attacker = u; attackerPlayer = player; }
        const tu = player.units.find(u => u.id === targetId);
        if (tu) { targetUnit = tu; targetOwner = player; }
        const tb = player.buildings.find(b => b.id === targetId);
        if (tb) { targetBuilding = tb; targetOwner = player; }
      }

      if (!attacker || !attackerPlayer || !(targetUnit || targetBuilding)) return;

      // Validate: cannot attack own units/buildings or allies
      if (targetOwner) {
        if (targetOwner.id === attackerPlayer.id) return;
        if (attackerPlayer.teamId !== undefined && targetOwner.teamId === attackerPlayer.teamId) return;
      }

      attacker.state = UnitState.ATTACKING;
      attacker.target = targetId;
      attacker.waypoints = [];
      gameEventBus.emit('unit:attack', { attackerId, targetId });
    });
  },

  harvestResource: (unitId, resourceId) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit) {
          const resource = state.map?.resourceNodes.find(r => r.id === resourceId);
          if (resource && unit.data?.canHarvest) {
            unit.state = UnitState.HARVESTING;
            unit.harvestTarget = resource;
            unit.waypoints = [{ x: resource.position.x * GAME_CONFIG.TILE_SIZE, y: resource.position.y * GAME_CONFIG.TILE_SIZE }];
          }
          break;
        }
      }
    });
  },

  produceUnit: (buildingId, unitType) => {
    const state = get();
    return state.produceUnitForPlayer(state.currentPlayer?.id || '', buildingId, unitType);
  },

  buildStructure: (buildingType, position) => {
    const state = get();
    return state.buildStructureForPlayer(state.currentPlayer?.id || '', buildingType, position);
  },

  destroyUnit: (unitId) => {
    // Check for terrorist death explosion before removing
    let terroristExplosion: { position: Vector2; faction: Faction; teamId?: number } | null = null;
    let passengerIdsToDestroy: string[] = [];
    // If the destroyed unit was inside a transport, remove it from passenger list
    let transportIdToClean: string | undefined;

    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        // Only trigger death explosion if terrorist hasn't already exploded via CombatUpdateSystem
        if (unit && unit.type === UnitType.TERRORIST && !(unit as unknown as Record<string, unknown>)._terroristExploded) {
          terroristExplosion = { position: { ...unit.position }, faction: unit.faction, teamId: player.teamId };
        }
        // If this unit is a transport with passengers, mark passengers for destruction
        if (unit && unit.passengers && unit.passengers.length > 0) {
          passengerIdsToDestroy = [...unit.passengers];
        }
        // If this unit was inside a transport, note the transport to clean up
        if (unit && unit.transportId) {
          transportIdToClean = unit.transportId;
        }
      }
    });

    // Remove the destroyed unit from its transport's passenger list
    if (transportIdToClean) {
      set((state) => {
        const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
        for (const player of allPlayers) {
          const transport = player.units.find(u => u.id === transportIdToClean);
          if (transport && transport.passengers) {
            transport.passengers = transport.passengers.filter(id => id !== unitId);
          }
        }
      });
    }

    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit) {
          gameEventBus.emit('unit:destroyed', { unitId, type: unit.type, faction: unit.faction, position: unit.position });
          player.statistics.unitsLost++;
          player.units = player.units.filter(u => u.id !== unitId);
          if (player === state.currentPlayer) {
            state.selectedUnits = state.selectedUnits.filter(u => u.id !== unitId);
          }
          break;
        }
      }
    });

    movementSystem.removeUnit(unitId);

    // Destroy all passengers when transport is destroyed
    for (const passengerId of passengerIdsToDestroy) {
      get().destroyUnit(passengerId);
    }

    // Apply terrorist death explosion (AoE damage to enemies in 3-tile radius)
    if (terroristExplosion) {
      const explosionRadius = 3 * GAME_CONFIG.TILE_SIZE;
      const explosionDamage = 200;
      const destroyedByExplosion: string[] = [];
      const destroyedBuildingsByExplosion: string[] = [];
      let explosionKillCount = 0;

      set((state) => {
        const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
        // Find the terrorist's owner player for enemiesDestroyed tracking
        const terroristOwner = allPlayers.find(p => p.faction === terroristExplosion!.faction);
        for (const player of allPlayers) {
          // Skip allies (use teamId-based check, not faction)
          if (terroristExplosion!.teamId !== undefined && player.teamId !== undefined && terroristExplosion!.teamId === player.teamId) continue;
          for (const unit of [...player.units]) {
            const dx = unit.position.x - terroristExplosion!.position.x;
            const dy = unit.position.y - terroristExplosion!.position.y;
            if (Math.sqrt(dx * dx + dy * dy) <= explosionRadius) {
              const armorType = combatSystem.getArmorTypeForUnit(unit.type);
              const actualDamage = combatSystem.calculateDamage(explosionDamage, DamageType.EXPLOSIVE, armorType, unit.armor);
              unit.health -= actualDamage;
              gameEventBus.emit('combat:hit', { attackerId: '', targetId: unit.id, damage: actualDamage, position: unit.position });
              if (unit.health <= 0) {
                destroyedByExplosion.push(unit.id);
                explosionKillCount++;
              }
            }
          }
          for (const building of [...player.buildings]) {
            const dx = building.position.x - terroristExplosion!.position.x;
            const dy = building.position.y - terroristExplosion!.position.y;
            if (Math.sqrt(dx * dx + dy * dy) <= explosionRadius) {
              const actualDamage = combatSystem.calculateDamage(explosionDamage, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
              building.health -= actualDamage;
              gameEventBus.emit('combat:hit', { attackerId: '', targetId: building.id, damage: actualDamage, position: building.position });
              gameEventBus.emit('building:damaged', { buildingId: building.id, buildingType: building.type, health: building.health, maxHealth: building.maxHealth, position: building.position });
              if (building.health <= 0) {
                destroyedBuildingsByExplosion.push(building.id);
                explosionKillCount++;
              }
            }
          }
        }
        if (terroristOwner && explosionKillCount > 0) {
          terroristOwner.statistics.enemiesDestroyed += explosionKillCount;
        }
      });

      for (const id of destroyedByExplosion) {
        get().destroyUnit(id);
      }
      for (const id of destroyedBuildingsByExplosion) {
        get().destroyBuilding(id);
      }
    }
  },

  damageUnit: (unitId, damage) => {
    let unitDestroyed = false;
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit) {
          const armorType = combatSystem.getArmorType(unit);
          const actualDamage = combatSystem.calculateDamage(damage, DamageType.KINETIC, armorType, unit.armor);
          unit.health -= actualDamage;
          if (unit.health <= 0) {
            unitDestroyed = true;
          }
          break;
        }
      }
    });
    if (unitDestroyed) {
      get().destroyUnit(unitId);
    }
  },

  destroyBuilding: (buildingId) => {
    let wasWall = false;
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const building = player.buildings.find(b => b.id === buildingId);
        if (building) {
          if (building.type === BuildingType.WALL) wasWall = true;
          const tilePos = mapManager.worldToTile(building.position.x, building.position.y);
          mapManager.unmarkOccupied(tilePos.x, tilePos.y, building.width, building.height);
          gameEventBus.emit('building:destroyed', { buildingId, type: building.type, faction: building.faction, position: building.position });
          player.statistics.buildingsLost++;
          player.buildings = player.buildings.filter(b => b.id !== buildingId);
          break;
        }
      }
    });
    if (wasWall) {
      gameEventBus.emit('pathfinding:obstaclesChanged');
    }
  },

  damageBuilding: (buildingId, damage, damageType?) => {
    let buildingDestroyed = false;
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const building = player.buildings.find(b => b.id === buildingId);
        if (building) {
          const actualDamage = combatSystem.calculateDamage(
            damage,
            damageType || DamageType.KINETIC,
            ArmorType.STRUCTURE,
            0
          );
          building.health -= actualDamage;
          gameEventBus.emit('building:damaged', { buildingId: building.id, buildingType: building.type, health: building.health, maxHealth: building.maxHealth, position: building.position });
          if (building.health <= 0) {
            buildingDestroyed = true;
          }
          break;
        }
      }
    });
    if (buildingDestroyed) {
      get().destroyBuilding(buildingId);
    }
  },

  updateResources: (playerId, amount) => {
    set((state) => {
      if (state.currentPlayer?.id === playerId) {
        state.currentPlayer.money += amount;
        return;
      }
      const aiPlayer = state.aiPlayers.find(p => p.id === playerId);
      if (aiPlayer) {
        aiPlayer.money += amount;
      }
    });
  },

  update: (deltaTime) => {
    const destroyedUnits: string[] = [];
    const destroyedBuildings: string[] = [];

    set((state) => {
      if (state.isPaused || state.gameState !== GameState.PLAYING) return;

      state.gameTime += deltaTime;
      // Update victory condition system with current game time
      victoryConditionSystem.setGameTime(state.gameTime);
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];

      // Neutral building effects
      for (const building of state.neutralBuildings) {
        if (building.type === BuildingType.OIL_DERRICK) {
          const owner = allPlayers.find(p => p.buildings.some(b => b.id === building.id));
          if (owner) {
            owner.money += 5 * deltaTime;
          }
        }
      }
      for (const player of allPlayers) {
        const hospitals = player.buildings.filter(b => b.type === BuildingType.HOSPITAL && b.isConstructed);
        for (const hospital of hospitals) {
          for (const unit of player.units) {
            const dx = unit.position.x - hospital.position.x;
            const dy = unit.position.y - hospital.position.y;
            if (Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.TILE_SIZE * 5 && unit.health < unit.maxHealth) {
              unit.health = Math.min(unit.maxHealth, unit.health + unit.maxHealth * 0.005 * deltaTime);
            }
          }
        }
      }

      // Update pathfinding dynamic obstacles from all units
      const allUnits = allPlayers.flatMap(p => p.units);
      pathfindingManager.updateDynamicObstacles(allUnits.map(u => ({
        id: u.id,
        position: u.position,
        isAirborne: !!u.isAirborne,
        isNaval: !!u.isNaval,
      })));

      // Update global combat state once per frame (game time, projectiles)
      combatUpdateSystem.updateFrame(deltaTime, allPlayers,
        (unitId: string) => { destroyedUnits.push(unitId); },
        (buildingId: string) => { destroyedBuildings.push(buildingId); }
      );

      for (const player of allPlayers) {
        powerSystem.update(player);

        productionSystem.update(player, deltaTime, (type, faction, pos) =>
          createUnitFromData(type, faction, pos, player.researchedUpgrades)
        );

        for (const unit of player.units) {
          // Process chrono shift charging
          if (unit.type === UnitType.CHRONO && unit.isChronoShifting) {
            unit.chronoShiftTimer -= deltaTime;
            if (unit.chronoShiftTimer <= 0) {
              // Teleport!
              unit.position = { ...unit.chronoShiftTarget! };
              unit.chronoShiftTarget = undefined;
              unit.isChronoShifting = false;
              unit.isChronoCooldown = true;
              unit.chronoShiftTimer = player.researchedUpgrades.includes(UpgradeType.CHRONO_TECH) ? 2.1 : 3.0; // CHRONO_TECH reduces cooldown by 30%
              unit.state = UnitState.IDLE;
              gameEventBus.emit('unit:teleport', { unitId: unit.id, position: { ...unit.position }, faction: player.faction });
            }
          }

          // Process chrono cooldown
          if (unit.type === UnitType.CHRONO && unit.isChronoCooldown) {
            unit.chronoShiftTimer -= deltaTime;
            if (unit.chronoShiftTimer <= 0) {
              unit.isChronoCooldown = false;
              unit.chronoShiftTimer = 0;
            }
          }

          // Skip normal movement for chrono-shifting units (cooldown is ok - they can attack/move normally)
          if (!(unit.type === UnitType.CHRONO && unit.isChronoShifting)) {
            movementSystem.updateWithAvoidance(unit, player.units, deltaTime);
          }

          // Attack-move: detect enemies while moving
          if (unit.state === UnitState.MOVING && unit.isAttackMoving && unit.attack > 0) {
            const effectiveRange = unit.attackRange * GAME_CONFIG.TILE_SIZE;
            const enemyPlayers = allPlayers.filter(p =>
              isEnemy(unit.faction, player.teamId, p.faction, p.teamId)
            );
            let nearestEnemy: { id: string; position: Vector2 } | null = null;
            let nearestDist = Infinity;
            for (const ep of enemyPlayers) {
              for (const eu of ep.units) {
                const dx = eu.position.x - unit.position.x;
                const dy = eu.position.y - unit.position.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d <= effectiveRange && d < nearestDist) {
                  nearestDist = d;
                  nearestEnemy = eu;
                }
              }
              for (const eb of ep.buildings) {
                if (!eb.isConstructed) continue;
                const dx = eb.position.x - unit.position.x;
                const dy = eb.position.y - unit.position.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d <= effectiveRange && d < nearestDist) {
                  nearestDist = d;
                  nearestEnemy = eb;
                }
              }
            }
            if (nearestEnemy) {
              unit.state = UnitState.ATTACKING;
              unit.target = nearestEnemy.id;
            }
          }

          if (unit.state === UnitState.ATTACKING || unit.state === UnitState.GUARDING) {
            combatUpdateSystem.update(unit, player, allPlayers, deltaTime,
              (unitId: string) => { destroyedUnits.push(unitId); },
              (buildingId: string) => { destroyedBuildings.push(buildingId); }
            );
          }

          harvestSystem.update(unit, player, state.map, deltaTime);

          repairSystem.update(unit, player, deltaTime);

          // Elite units slowly self-heal
          if (unit.rank === UnitRank.ELITE && unit.health < unit.maxHealth) {
            unit.health = Math.min(unit.maxHealth, unit.health + unit.maxHealth * GAME_CONFIG.ELITE_HEAL_RATE * deltaTime);
          }

          // Iron Curtain invulnerability expiry
          if (unit.isInvulnerable && unit.invulnerableUntil && state.gameTime >= unit.invulnerableUntil) {
            unit.isInvulnerable = false;
            unit.invulnerableUntil = undefined;
          }

          // Phantom Tank disguise logic
          if (unit.type === UnitType.PHANTOM) {
            if (unit.state === UnitState.IDLE || unit.state === UnitState.GUARDING) {
              unit.idleTimer = (unit.idleTimer || 0) + deltaTime;
              if (unit.idleTimer >= 2 && !unit.isDisguised) {
                unit.isDisguised = true;
              }
            } else {
              // Moving, attacking, etc. — reveal
              unit.idleTimer = 0;
              unit.isDisguised = false;
            }
          }
        }

        // Sync passenger positions with their transport vehicles
        for (const unit of player.units) {
          if (unit.transportId && unit.state === UnitState.IDLE) {
            const transport = player.units.find(u => u.id === unit.transportId);
            if (transport) {
              unit.position = { ...transport.position };
            }
          }
        }

        // Auto-engage: idle combat units attack nearby enemies
        autoEngageSys.update(player, allPlayers);
        // Auto-harvest: idle miners find ore and harvest
        autoHarvestSys.update(player, allPlayers, state.map);
        // AI attack waves
        if (player.isAI) {
          const aiDiff = player.difficulty || Difficulty.NORMAL;
          attackWaveSys.update(player, allPlayers, deltaTime, aiDiff);
        }
        // Engineer capture: auto-capture nearby enemy buildings
        captureSystem.update(player, allPlayers, state.neutralBuildings, deltaTime, (event) => {
          get().captureBuilding(event.engineerId, event.buildingId);
        });

        // Building construction progress
        for (const building of player.buildings) {
          // Clear expired EMP disable
          if (building.empDisabledUntil && building.empDisabledUntil <= state.gameTime) {
            building.empDisabledUntil = undefined;
          }

          // Process building self-repair
          if (building.isRepairing && building.health < building.maxHealth) {
            const repairRate = building.maxHealth * 0.05; // 5% per second
            const repairThisFrame = deltaTime * repairRate;
            const costThisFrame = repairThisFrame * GAME_CONFIG.REPAIR_COST_PER_HP;

            if (player.money >= costThisFrame) {
              building.health = Math.min(building.maxHealth, building.health + repairThisFrame);
              player.money -= costThisFrame;
            } else {
              building.isRepairing = false; // Stop if can't afford
            }

            if (building.health >= building.maxHealth) {
              building.health = building.maxHealth;
              building.isRepairing = false;
            }
          }

          if (building.isBuilding && !building.isConstructed) {
            const powerModifier = player.power < GAME_CONFIG.LOW_POWER_THRESHOLD ? GAME_CONFIG.POWER_SLOWDOWN_FACTOR : 1;
            const aiSpeedMult = player.isAI
              ? (AI_CONFIG.BUILD_SPEED[((player.difficulty || Difficulty.NORMAL).toString().toLowerCase()) as keyof typeof AI_CONFIG.BUILD_SPEED] || 1)
              : 1;
            const weatherBuildMod = get().weatherBuildModifier;
            building.buildProgress += GAME_CONFIG.BUILD_SPEED * deltaTime * powerModifier * aiSpeedMult * weatherBuildMod;
            building.health = Math.min(
              building.maxHealth,
              Math.ceil(building.maxHealth * (GAME_CONFIG.BUILD_START_HP_RATIO + building.buildProgress * (1 - GAME_CONFIG.BUILD_START_HP_RATIO)))
            );
            if (building.buildProgress >= 1) {
              building.buildProgress = 1;
              building.isBuilding = false;
              building.isConstructed = true;
              building.health = building.maxHealth;
              player.statistics.buildingsBuilt++;
              gameEventBus.emit('building:constructed', { buildingId: building.id, type: building.type, position: building.position });
            }
          }

          // Defense building auto-attack
          if (building.attack && building.attack > 0) {
            combatUpdateSystem.updateBuildingCombat(building, player, allPlayers, deltaTime,
              (unitId: string) => { destroyedUnits.push(unitId); }
            );
          }

          // Superweapon charging
          if (building.superweaponChargeTime && building.isConstructed && !building.empDisabledUntil) {
            if (!building.superweaponChargeProgress) building.superweaponChargeProgress = 0;
            const wasReady = building.superweaponReady;
            building.superweaponChargeProgress += deltaTime;
            if (building.superweaponChargeProgress >= building.superweaponChargeTime) {
              building.superweaponReady = true;
              building.superweaponChargeProgress = building.superweaponChargeTime;
              if (!wasReady) {
                gameEventBus.emit('superweapon:launch', { buildingId: building.id, type: building.type, faction: building.faction, position: building.position });
              }
            } else {
              // Emit charging event at 25%, 50%, 75% milestones
              const prevPct = Math.floor(((building.superweaponChargeProgress - deltaTime) / building.superweaponChargeTime) * 4);
              const curPct = Math.floor((building.superweaponChargeProgress / building.superweaponChargeTime) * 4);
              if (curPct > prevPct && curPct >= 1) {
                gameEventBus.emit('superweapon:charging', { buildingId: building.id, type: building.type, faction: building.faction, progress: curPct / 4, position: building.position });
              }
            }
          }
        }
      }

      // Ivan bomb timer update
      const detonatedBombs = combatSystem.updateBombs(deltaTime);
      for (const bomb of detonatedBombs) {
        let bombKillCount = 0;
        const bombOwner = allPlayers.find(p => p.faction === bomb.faction);
        // Find and damage the target
        for (const player of allPlayers) {
          const targetUnit = player.units.find(u => u.id === bomb.targetId);
          if (targetUnit) {
            const armorType = combatSystem.getArmorTypeForUnit(targetUnit.type);
            const actualDamage = combatSystem.calculateDamage(bomb.damage, DamageType.EXPLOSIVE, armorType, targetUnit.armor);
            targetUnit.health -= actualDamage;
            gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: targetUnit.id, damage: actualDamage, position: targetUnit.position });
            if (targetUnit.health <= 0) {
              destroyedUnits.push(targetUnit.id);
              bombKillCount++;
            }
          }
          const targetBuilding = player.buildings.find(b => b.id === bomb.targetId);
          if (targetBuilding) {
            const actualDamage = combatSystem.calculateDamage(bomb.damage, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
            targetBuilding.health -= actualDamage;
            gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: targetBuilding.id, damage: actualDamage, position: targetBuilding.position });
            if (targetBuilding.health <= 0) {
              destroyedBuildings.push(targetBuilding.id);
              bombKillCount++;
            }
          }

          // Also deal AoE damage to nearby entities (1.5 tile radius)
          const aoeRadius = 1.5 * GAME_CONFIG.TILE_SIZE;
          for (const unit of [...player.units]) {
            if (unit.id === bomb.targetId) continue;
            const dx = unit.position.x - bomb.targetPosition.x;
            const dy = unit.position.y - bomb.targetPosition.y;
            if (Math.sqrt(dx * dx + dy * dy) <= aoeRadius) {
              const armorType = combatSystem.getArmorTypeForUnit(unit.type);
              const aoeDamage = combatSystem.calculateDamage(bomb.damage * 0.5, DamageType.EXPLOSIVE, armorType, unit.armor);
              unit.health -= aoeDamage;
              gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: unit.id, damage: aoeDamage, position: unit.position });
              if (unit.health <= 0) {
                destroyedUnits.push(unit.id);
                bombKillCount++;
              }
            }
          }
          for (const building of [...player.buildings]) {
            if (building.id === bomb.targetId) continue;
            const dx = building.position.x - bomb.targetPosition.x;
            const dy = building.position.y - bomb.targetPosition.y;
            if (Math.sqrt(dx * dx + dy * dy) <= aoeRadius) {
              const aoeDamage = combatSystem.calculateDamage(bomb.damage * 0.5, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
              building.health -= aoeDamage;
              gameEventBus.emit('combat:hit', { attackerId: bomb.id, targetId: building.id, damage: aoeDamage, position: building.position });
              if (building.health <= 0) {
                destroyedBuildings.push(building.id);
                bombKillCount++;
              }
            }
          }
        }
        if (bombOwner && bombKillCount > 0) {
          bombOwner.statistics.enemiesDestroyed += bombKillCount;
        }
        gameEventBus.emit('combat:explosion', { position: bomb.targetPosition });
      }

      if (state.currentPlayer) {
        if (state.isObserverMode) {
          // Observer mode: check if one AI defeated the other
          const activeAiPlayers = state.aiPlayers.filter(ai => !ai.isDefeated);
          const defeatedAiIds: string[] = [];
          for (const ai of activeAiPlayers) {
            const aiHasCommand = ai.buildings.some(b => b.type === BuildingType.COMMAND && b.isConstructed);
            const aiHasAnyBuilding = ai.buildings.some(b => b.isConstructed);
            const aiHasAnyUnit = ai.units.length > 0;
            if (!aiHasCommand && !aiHasAnyBuilding && !aiHasAnyUnit) {
              defeatedAiIds.push(ai.id);
              ai.isDefeated = true;
            }
          }

          // If only one AI remains, the battle is over
          const remainingAi = state.aiPlayers.filter(ai => !ai.isDefeated);
          if (remainingAi.length <= 1 && state.aiPlayers.length >= 2) {
            const winner = remainingAi.length === 1 ? remainingAi[0] : null;
            if (winner) {
              winner.isVictorious = true;
              gameEventBus.emit('game:victory', { faction: winner.faction });
            } else {
              gameEventBus.emit('game:victory', { faction: Faction.NEUTRAL });
            }
            state.gameState = GameState.VICTORY;
            return;
          }
        } else {
          const result = victoryConditionSystem.check(state.currentPlayer, state.aiPlayers);

          if (result.playerDefeated) {
            state.currentPlayer.isDefeated = true;
            gameEventBus.emit('game:defeat', { faction: state.currentPlayer.faction });
            if (state.isCampaignMode) {
              state.missionResult = 'defeat';
              state.missionStats = {
                time: state.gameTime,
                unitsProduced: state.currentPlayer.statistics.unitsProduced,
                unitsLost: state.currentPlayer.statistics.unitsLost,
                enemiesDestroyed: state.currentPlayer.statistics.enemiesDestroyed,
                buildingsBuilt: state.currentPlayer.statistics.buildingsBuilt,
                buildingsLost: state.currentPlayer.statistics.buildingsLost,
                resourcesGathered: state.currentPlayer.statistics.resourcesGathered,
                rating: 0,
              };
              state.gameState = GameState.MISSION_DEBRIEFING;
            } else {
              state.gameState = GameState.DEFEAT;
            }
            return;
          }

          for (const aiId of result.defeatedAiIds) {
            const ai = state.aiPlayers.find(a => a.id === aiId);
            if (ai) ai.isDefeated = true;
          }

          if (result.allEnemiesDefeated) {
            state.currentPlayer.isVictorious = true;
            gameEventBus.emit('game:victory', { faction: state.currentPlayer.faction });
            if (state.isCampaignMode && state.selectedMission) {
              const campaignId = state.selectedMission.campaign;
              const missionId = state.selectedMission.id;
              const rating = Math.max(1, 5 - Math.floor(state.gameTime / 120));
              const stats = {
                time: state.gameTime,
                unitsProduced: state.currentPlayer.statistics.unitsProduced,
                unitsLost: state.currentPlayer.statistics.unitsLost,
                enemiesDestroyed: state.currentPlayer.statistics.enemiesDestroyed,
                buildingsBuilt: state.currentPlayer.statistics.buildingsBuilt,
                buildingsLost: state.currentPlayer.statistics.buildingsLost,
                resourcesGathered: state.currentPlayer.statistics.resourcesGathered,
                rating,
              };
              state.campaignProgress = completeCampaignMission(
                state.campaignProgress,
                campaignId,
                missionId,
                rating,
                state.gameTime
              );
              try {
                localStorage.setItem('campaignProgress', JSON.stringify(state.campaignProgress));
              } catch {
                // Ignore localStorage errors
              }
              state.missionResult = 'victory';
              state.missionStats = stats;
              state.gameState = GameState.MISSION_DEBRIEFING;
            } else {
              state.gameState = GameState.VICTORY;
            }
            return;
          }

          state.resources = {
            money: state.currentPlayer.money,
            power: state.currentPlayer.power,
            techLevel: state.currentPlayer.buildings.filter(b =>
              b.type === BuildingType.TECH && b.isConstructed
            ).length + 1,
          };

          // Alert level: check power ratio
          const powerRatio = state.currentPlayer.maxPower > 0
            ? state.currentPlayer.power / state.currentPlayer.maxPower
            : 1;
          if (powerRatio < 0.25) {
            state.alertLevel = 'critical';
            state.alertClearTimer = 5;
          } else if (powerRatio < 0.5) {
            state.alertLevel = 'medium';
            state.alertClearTimer = 5;
          }

          // Alert level: tick down timer and clear
          if (state.alertLevel && state.alertClearTimer > 0) {
            state.alertClearTimer -= deltaTime;
            if (state.alertClearTimer <= 0) {
              state.alertClearTimer = 0;
              state.alertLevel = null;
            }
          }
        } // end else (non-observer mode)

        // Ore regeneration
        const oreRegenRate = state.gameSettings.oreRegenRate;
        const oreRegenInterval = oreRegenRate === 0 ? Infinity
          : oreRegenRate === 1 ? ORE_REGEN_INTERVAL * 2
          : oreRegenRate === 3 ? ORE_REGEN_INTERVAL / 2
          : ORE_REGEN_INTERVAL;
        oreRegenTimer += deltaTime;
        if (oreRegenTimer >= oreRegenInterval && state.map && oreRegenRate > 0) {
          oreRegenTimer = 0;
          const map = state.map;
          const currentOreCount = map.resourceNodes.filter(n => n.resourceType === 'ore').length;
          const maxOreNodes = 20;

          if (currentOreCount < maxOreNodes) {
            const existingOre = map.resourceNodes.filter(n => n.resourceType === 'ore');
            const spawnCount = Math.min(2, maxOreNodes - currentOreCount);

            for (let i = 0; i < spawnCount; i++) {
              let position;
              if (existingOre.length > 0) {
                const ref = existingOre[Math.floor(Math.random() * existingOre.length)];
                const offset = (Math.random() - 0.5) * 10;
                position = {
                  x: ref.position.x + offset,
                  y: ref.position.y + offset,
                };
              } else {
                position = {
                  x: 5 + Math.random() * (map.width - 10),
                  y: 5 + Math.random() * (map.height - 10),
                };
              }

              position.x = Math.max(1, Math.min(map.width - 2, Math.round(position.x)));
              position.y = Math.max(1, Math.min(map.height - 2, Math.round(position.y)));

              map.resourceNodes.push({
                id: `ore_regen_${Date.now()}_${i}`,
                resourceType: 'ore',
                position,
                amount: 2000,
                maxAmount: 3000,
              });

              // Set terrain tiles around this ore node to ORE type
              const cx = Math.floor(position.x);
              const cy = Math.floor(position.y);
              for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                  const tx = cx + dx;
                  const ty = cy + dy;
                  if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                    const tile = map.tiles[ty]?.[tx] as { type: string } | undefined;
                    if (tile && tile.type === 'grass') {
                      tile.type = 'ore';
                    }
                  }
                }
              }
            }
          }
        }

        // Crate spawning
        crateSpawnTimer += deltaTime;
        if (crateSpawnTimer >= GAME_CONFIG.CRATE_SPAWN_INTERVAL && state.map) {
          crateSpawnTimer = 0;
          const crateCount = state.map.resourceNodes.filter(r => r.resourceType === 'crate').length;
          if (crateCount < GAME_CONFIG.CRATE_MAX_COUNT) {
            const spawnX = 5 + Math.random() * (state.map.width - 10);
            const spawnY = 5 + Math.random() * (state.map.height - 10);
            const crateTypes: Array<'money' | 'heal' | 'veterancy' | 'reveal'> = ['money', 'heal', 'veterancy', 'reveal'];
            const crateType = crateTypes[Math.floor(Math.random() * crateTypes.length)];
            state.map.resourceNodes.push({
              id: `crate_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              position: { x: spawnX, y: spawnY },
              amount: 1,
              maxAmount: 1,
              resourceType: 'crate',
              crateType,
            });
          }
        }

        // Crate pickup
        if (state.map) {
          const crates = state.map.resourceNodes.filter(r => r.resourceType === 'crate');
          for (const crate of crates) {
            const crateWorldX = crate.position.x * GAME_CONFIG.TILE_SIZE;
            const crateWorldY = crate.position.y * GAME_CONFIG.TILE_SIZE;
            for (const player of allPlayers) {
              for (const unit of player.units) {
                const dx = unit.position.x - crateWorldX;
                const dy = unit.position.y - crateWorldY;
                if (Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.CRATE_PICKUP_RADIUS) {
                  // Apply crate effect
                  if (crate.crateType === 'money') {
                    player.money += GAME_CONFIG.CRATE_MONEY_BONUS;
                  } else if (crate.crateType === 'heal') {
                    unit.health = Math.min(unit.maxHealth, unit.health + GAME_CONFIG.CRATE_HEAL_AMOUNT);
                  } else if (crate.crateType === 'veterancy') {
                    if (unit.rank === UnitRank.ROOKIE) {
                      unit.rank = UnitRank.VETERAN;
                    } else if (unit.rank === UnitRank.VETERAN) {
                      unit.rank = UnitRank.ELITE;
                    }
                  } else if (crate.crateType === 'reveal') {
                    // Reveal a large area around the crate via event
                    gameEventBus.emit('map:reveal', { position: { x: crate.position.x, y: crate.position.y }, radius: 10 });
                  }
                  // Remove crate
                  state.map.resourceNodes = state.map.resourceNodes.filter(r => r.id !== crate.id);
                  gameEventBus.emit('resource:depleted', { resourceId: crate.id, position: crate.position });
                  break;
                }
              }
              if (!state.map.resourceNodes.some(r => r.id === crate.id)) break;
            }
          }
        }
      }
    });

    for (const unitId of destroyedUnits) {
      get().destroyUnit(unitId);
    }
    for (const buildingId of destroyedBuildings) {
      get().destroyBuilding(buildingId);
    }

    // Process research queue
    get().processResearchQueue(deltaTime);

    // Achievement check timer
    achievementCheckTimer += deltaTime;
    if (achievementCheckTimer >= ACHIEVEMENT_CHECK_INTERVAL) {
      achievementCheckTimer = 0;
      get().checkAchievements();
    }

    // Auto-save every 5 minutes
    autoSaveTimer += deltaTime;
    if (autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      autoSaveTimer = 0;
      const state = get();
      if (state.gameState === GameState.PLAYING && state.currentPlayer && !state.isObserverMode) {
        const saveData = {
          version: '1.0.0',
          timestamp: Date.now(),
          gameTime: state.gameTime,
          faction: state.currentPlayer.faction,
          difficulty: state.aiPlayers[0]?.difficulty ?? Difficulty.NORMAL,
          currentPlayer: state.currentPlayer,
          aiPlayers: state.aiPlayers,
          map: state.map!,
          gameState: state.gameState,
          neutralBuildings: state.neutralBuildings,
        };
        saveManager.saveGame(0, '自动存档', saveData);
      }
    }
  },

  updateAI: () => {
    const state = get();
    if (!state.currentPlayer || !state.map) return;
    if (state.isPaused || state.gameState !== GameState.PLAYING) return;

    for (const aiPlayer of state.aiPlayers) {
      if (aiPlayer.isDefeated) continue;

      const controller = state.aiControllers.get(aiPlayer.id);
      if (!controller) continue;

      const combinedEnemyPlayer: Player = {
        id: 'combined_enemy',
        faction: state.currentPlayer.faction,
        name: 'Enemies',
        money: 0,
        power: 0,
        maxPower: 0,
        units: [],
        buildings: [],
        buildQueue: [],
        researchedUpgrades: [],
        researchQueue: [],
        isAI: false,
        difficulty: aiPlayer.difficulty,
        color: '#FF0000',
        isDefeated: false,
        isVictorious: false,
        teamId: state.currentPlayer.teamId,
        statistics: { unitsProduced: 0, unitsLost: 0, enemiesDestroyed: 0, buildingsBuilt: 0, buildingsLost: 0, resourcesGathered: 0 },
      };

      const enemyPlayers = [state.currentPlayer, ...state.aiPlayers].filter(p =>
        p.id !== aiPlayer.id && isEnemy(aiPlayer.faction, aiPlayer.teamId, p.faction, p.teamId)
      );

      for (const enemy of enemyPlayers) {
        combinedEnemyPlayer.units.push(...enemy.units);
        combinedEnemyPlayer.buildings.push(...enemy.buildings);
      }

      const context = buildAIContext(
        aiPlayer,
        combinedEnemyPlayer,
        state.map,
        state.gameTime,
        aiPlayer.difficulty
      );

      const actions = controller.update(context);
      const gameCommands = createGameCommands(aiPlayer.faction);

      for (const action of actions) {
        controller.executeAction(action, gameCommands);
      }
    }
  },

  addToBuildQueue: (item) => {
    set((state) => {
      if (state.currentPlayer) {
        state.currentPlayer.buildQueue.push(item);
      }
    });
  },

  removeFromBuildQueue: (itemId) => {
    set((state) => {
      if (state.currentPlayer) {
        state.currentPlayer.buildQueue = state.currentPlayer.buildQueue.filter(item => item.id !== itemId);
      }
    });
  },

  sellBuilding: (buildingId) => {
    let shouldDestroy = false;
    set((state) => {
      const building = state.currentPlayer?.buildings.find(b => b.id === buildingId);
      if (building && state.currentPlayer) {
        if (!building.isConstructed) {
          // Cancel construction: refund a portion of the cost
          const buildTime = building.data.buildTime || 1;
          const refund = Math.floor(building.data.cost * 0.5 * (building.buildProgress / buildTime));
          state.currentPlayer.money += refund;
          shouldDestroy = true;
          return;
        }
        const maxHealth = building.maxHealth || 1;
        const healthRatio = building.health / maxHealth;
        const sellValue = Math.floor(building.data.cost * GAME_CONFIG.SELL_PRICE_RATIO * healthRatio);
        state.currentPlayer.money += sellValue;
        shouldDestroy = true;
      }
    });
    if (shouldDestroy) {
      get().destroyBuilding(buildingId);
    }
  },

  repairBuilding: (buildingId) => {
    const state = get();
    return state.repairBuildingForPlayer(state.currentPlayer?.id || '', buildingId);
  },

  repairUnitBuilding: (unitId, buildingId) => {
    set((draft) => {
      const allPlayers = [draft.currentPlayer, ...draft.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit && unit.data.canCapture) {
          unit.state = UnitState.REPAIRING;
          unit.target = buildingId;
          return;
        }
      }
    });
  },

  setRallyPoint: (buildingId, position) => {
    const state = get();
    return state.setRallyPointForPlayer(state.currentPlayer?.id || '', buildingId, position);
  },

  setUnitWaypoints: (unitId, waypoints, state) => {
    set((draft) => {
      const allPlayers = [draft.currentPlayer, ...draft.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit) {
          unit.waypoints = waypoints.map(w => ({ ...w }));
          unit.state = state;
          unit.target = null;
          break;
        }
      }
    });
  },

  clearUnitWaypoints: (unitId) => {
    set((draft) => {
      const allPlayers = [draft.currentPlayer, ...draft.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit) {
          unit.waypoints = [];
          unit.state = UnitState.IDLE;
          unit.target = null;
          break;
        }
      }
    });
  },

  buildStructureForPlayer: (playerId, buildingType, position) => {
    set((state) => {
      const isCurrent = state.currentPlayer?.id === playerId;
      const player = isCurrent
        ? state.currentPlayer
        : state.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const factionBuildings = BUILDINGS_BY_FACTION[player.faction] || {};
      const buildingData = factionBuildings[buildingType] as BuildingData | undefined;
      if (!buildingData || player.money < buildingData.cost) return;

      // Check tech tree requirements
      if (buildingData.requiredBuildings && buildingData.requiredBuildings.length > 0) {
        const hasAllRequired = buildingData.requiredBuildings.every(
          reqType => player.buildings.some(b => b.isConstructed && b.type === reqType)
        );
        if (!hasAllRequired) {
          gameEventBus.emit('ui:notification', { message: `需要先建造前置建筑`, type: 'warning' });
          return;
        }
      }

      const tilePos = mapManager.worldToTile(position.x, position.y);
      const buildingWidth = buildingData.width || 2;
      const buildingHeight = buildingData.height || 2;

      if (!mapManager.isBuildable(tilePos.x, tilePos.y, buildingWidth, buildingHeight,
        player.buildings.filter(b => b.isConstructed).map(b => ({ position: b.position, width: b.width, height: b.height }))
      )) {
        return;
      }

      const newBuilding = createBuildingFromData(buildingType, player.faction, position);
      player.buildings.push(newBuilding);
      player.money -= buildingData.cost;
      // Start building in construction state
      newBuilding.isBuilding = true;
      newBuilding.buildProgress = 0;
      newBuilding.isConstructed = false;
      newBuilding.health = Math.ceil(buildingData.health * GAME_CONFIG.BUILD_START_HP_RATIO);
      mapManager.markOccupied(tilePos.x, tilePos.y, buildingWidth, buildingHeight, newBuilding.id);
      gameEventBus.emit('building:constructed', { buildingId: newBuilding.id, type: buildingType, position });
      // Update pathfinding obstacles when wall is placed
      if (buildingType === BuildingType.WALL) {
        gameEventBus.emit('pathfinding:obstaclesChanged');
      }
    });
  },

  produceUnitForPlayer: (playerId, buildingId, unitType) => {
    set((state) => {
      const player = state.currentPlayer?.id === playerId
        ? state.currentPlayer
        : state.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const building = player.buildings.find(b => b.id === buildingId);
      const factionUnits = UNITS_BY_FACTION[player.faction] || {};
      const unitData = factionUnits[unitType] as UnitData | undefined;

      if (building && unitData && player.money >= unitData.cost) {
        // Check if building is EMP-disabled
        if (building.empDisabledUntil && building.empDisabledUntil > get().gameTime) {
          gameEventBus.emit('ui:notification', { message: '建筑被EMP瘫痪，无法生产单位', type: 'warning' });
          return;
        }

        // Check unit cap
        if (player.units.length >= state.maxUnits) {
          gameEventBus.emit('ui:notification', { message: '单位数量已达上限', type: 'warning' });
          return;
        }

        // Check tech unlock requirements
        const requiredUpgrade = getRequiredUpgradeForUnit(unitType);
        if (requiredUpgrade && !player.researchedUpgrades.includes(requiredUpgrade)) {
          return;
        }

        // Check queue limit (max 5 items)
        if (building.productionQueue.length >= 5) return;

        player.money -= unitData.cost;

        // Add to production queue
        const queueItem = {
          id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          producerId: buildingId,
          type: unitType,
          progress: 0,
          totalTime: unitData.buildTime,
          cost: unitData.cost,
        };
        building.productionQueue.push(queueItem);

        // If nothing is currently producing, start immediately
        if (!building.producingUnit) {
          building.producingUnit = unitType;
          building.newUnitCooldown = unitData.buildTime;
        }
      }
    });
  },

  repairBuildingForPlayer: (playerId, buildingId) => {
    set((draft) => {
      const player = draft.currentPlayer?.id === playerId
        ? draft.currentPlayer
        : draft.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const building = player.buildings.find(b => b.id === buildingId);
      if (!building) return;

      // Toggle repair: if already repairing, stop; otherwise start
      if (building.isRepairing) {
        building.isRepairing = false;
      } else if (building.health < building.maxHealth) {
        building.isRepairing = true;
      }
    });
  },

  sellBuildingForPlayer: (playerId, buildingId) => {
    let shouldDestroy = false;
    set((state) => {
      const player = state.currentPlayer?.id === playerId
        ? state.currentPlayer
        : state.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const building = player.buildings.find(b => b.id === buildingId);
      if (!building) return;

      if (!building.isConstructed) {
        const buildTime = building.data.buildTime || 1;
        const refund = Math.floor(building.data.cost * 0.5 * (building.buildProgress / buildTime));
        player.money += refund;
        shouldDestroy = true;
        return;
      }
      const maxHealth = building.maxHealth || 1;
      const healthRatio = building.health / maxHealth;
      const sellValue = Math.floor(building.data.cost * GAME_CONFIG.SELL_PRICE_RATIO * healthRatio);
      player.money += sellValue;
      shouldDestroy = true;
    });
    if (shouldDestroy) {
      get().destroyBuilding(buildingId);
    }
  },

  setRallyPointForPlayer: (playerId, buildingId, position) => {
    set((state) => {
      const player = state.currentPlayer?.id === playerId
        ? state.currentPlayer
        : state.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const building = player.buildings.find(b => b.id === buildingId);
      if (building) {
        building.rallyPoint = position;
      }
    });
  },

  upgradeBuildingForPlayer: (playerId, buildingId) => {
    set((state) => {
      const player = state.currentPlayer?.id === playerId
        ? state.currentPlayer
        : state.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const building = player.buildings.find(b => b.id === buildingId);
      if (!building || player.money < GAME_CONFIG.UPGRADE_COST) return;

      player.money -= GAME_CONFIG.UPGRADE_COST;
      building.maxHealth = Math.floor(building.maxHealth * GAME_CONFIG.UPGRADE_HEALTH_MULTIPLIER);
      building.health = building.maxHealth;
    });
  },

  log: (message, level = 'info') => {
    set((state) => {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level,
        message
      };
      const newLogs = [...state.gameLogs, entry];
      if (newLogs.length > MAX_LOG_ENTRIES) {
        newLogs.shift();
      }
      return { gameLogs: newLogs };
    });
  },

  getLogs: (level?: LogLevel, limit?: number) => {
    const logs = get().gameLogs;
    const filtered = level ? logs.filter(l => l.level === level) : logs;
    return filtered.slice(-(limit || MAX_LOG_ENTRIES));
  },

  clearLogs: () => {
    set({ gameLogs: [] });
  },

  startBuildingPlacement: (buildingType) => {
    const state = get();
    if (!state.currentPlayer) return;

    const factionBuildings = BUILDINGS_BY_FACTION[state.currentPlayer.faction] || {};
    const buildingData = factionBuildings[buildingType] as BuildingData | undefined;
    if (!buildingData || state.currentPlayer.money < buildingData.cost) return;

    const requiredBuildings = buildingData.requiredBuildings || [];
    const hasAll = requiredBuildings.every(req =>
      state.currentPlayer!.buildings.some(b => b.type === req && b.isConstructed)
    );
    if (!hasAll) return;

    set({
      placementBuildingType: buildingType,
      placementPreviewPos: null,
      placementValid: false,
    });
  },

  cancelBuildingPlacement: () => {
    set({
      placementBuildingType: null,
      placementPreviewPos: null,
      placementValid: false,
    });
  },

  updatePlacementPreview: (position) => {
    if (!position) {
      set({ placementPreviewPos: null, placementValid: false });
      return;
    }
    const state = get();
    if (!state.placementBuildingType || !state.currentPlayer || !state.map) return;

    const factionBuildings = BUILDINGS_BY_FACTION[state.currentPlayer.faction] || {};
    const buildingData = factionBuildings[state.placementBuildingType] as BuildingData | undefined;
    if (!buildingData) return;

    const tileX = Math.floor(position.x / GAME_CONFIG.TILE_SIZE);
    const tileY = Math.floor(position.y / GAME_CONFIG.TILE_SIZE);
    const width = buildingData.width || 2;
    const height = buildingData.height || 2;

    const isValid = mapManager.isBuildable(tileX, tileY, width, height,
      state.currentPlayer.buildings.filter(b => b.isConstructed).map(b => ({ position: b.position, width: b.width, height: b.height }))
    );

    set({
      placementPreviewPos: { x: tileX * GAME_CONFIG.TILE_SIZE, y: tileY * GAME_CONFIG.TILE_SIZE },
      placementValid: isValid,
    });
  },

  confirmBuildingPlacement: () => {
    const state = get();
    if (!state.placementBuildingType || !state.placementPreviewPos || !state.currentPlayer) return;

    // If placement was already validated as valid, proceed normally
    if (state.placementValid) {
      state.buildStructureForPlayer(
        state.currentPlayer.id,
        state.placementBuildingType,
        { ...state.placementPreviewPos }
      );

      set({
        placementBuildingType: null,
        placementPreviewPos: null,
        placementValid: false,
      });
      return;
    }

    // Placement is invalid — determine why and notify the player
    const position = state.placementPreviewPos;
    const playerBuildings = state.currentPlayer.buildings.filter(b => b.isConstructed);

    const factionBuildings = BUILDINGS_BY_FACTION[state.currentPlayer.faction] || {};
    const buildingData = factionBuildings[state.placementBuildingType] as BuildingData | undefined;
    const width = buildingData?.width || 2;
    const height = buildingData?.height || 2;

    const tileX = Math.floor(position.x / GAME_CONFIG.TILE_SIZE);
    const tileY = Math.floor(position.y / GAME_CONFIG.TILE_SIZE);

    // Check each tile for terrain buildability and occupation
    let terrainUnbuildable = false;
    let tileOccupied = false;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        const tile = mapManager.getTile(tx, ty);
        if (!tile || !tile.buildable) {
          terrainUnbuildable = true;
        }
        if (mapManager.isOccupied(tx, ty)) {
          tileOccupied = true;
        }
      }
    }

    if (terrainUnbuildable) {
      gameEventBus.emit('ui:notification', { message: '该地形无法建造建筑', type: 'warning' });
    } else if (tileOccupied) {
      gameEventBus.emit('ui:notification', { message: '该位置已被占用', type: 'warning' });
    } else if (playerBuildings.length > 0) {
      gameEventBus.emit('ui:notification', { message: '建筑必须建在已有建筑附近', type: 'warning' });
    } else {
      gameEventBus.emit('ui:notification', { message: '无法在此位置建造', type: 'warning' });
    }
  },

  captureBuilding: (capturerId, buildingId) => {
    set((state) => {
      let capturedBuilding: Building | null = null;
      let oldOwner: Player | null = null;

      // Find the building and its current owner (check neutral buildings first)
      const neutralIdx = state.neutralBuildings.findIndex(b => b.id === buildingId);
      if (neutralIdx >= 0) {
        capturedBuilding = state.neutralBuildings[neutralIdx];
      } else {
        for (const player of [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[]) {
          const building = player.buildings.find(b => b.id === buildingId);
          if (building) {
            capturedBuilding = building;
            oldOwner = player;
            break;
          }
        }
      }

      if (!capturedBuilding) return;

      // Find the engineer (capturer) unit and its owner
      let engineerUnit: Unit | null = null;
      let newOwner: Player | null = null;
      for (const player of [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[]) {
        const unit = player.units.find(u => u.id === capturerId);
        if (unit) {
          engineerUnit = unit;
          newOwner = player;
          break;
        }
      }

      if (!engineerUnit || !newOwner) return;
      if (oldOwner && newOwner.id === oldOwner.id) return;

      // Distance check: engineer must be within capture range
      const dx = engineerUnit.position.x - capturedBuilding.position.x;
      const dy = engineerUnit.position.y - capturedBuilding.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > GAME_CONFIG.TILE_SIZE * 3) return;

      // Transfer the building
      if (oldOwner) {
        oldOwner.buildings = oldOwner.buildings.filter(b => b.id !== buildingId);
      } else {
        state.neutralBuildings.splice(neutralIdx, 1);
      }
      capturedBuilding.faction = newOwner.faction;
      newOwner.buildings.push(capturedBuilding);

      // Remove the engineer unit (entered the building)
      newOwner.units = newOwner.units.filter(u => u.id !== capturerId);
    });
  },

  startDragSelection: (worldPos) => {
    set({ selectionBox: { start: { ...worldPos }, end: { ...worldPos } } });
  },

  updateDragSelection: (worldPos) => {
    set((state) => {
      if (state.selectionBox) {
        state.selectionBox.end = { ...worldPos };
      }
    });
  },

  endDragSelection: () => {
    set((state) => {
      if (!state.selectionBox || !state.currentPlayer) {
        state.selectionBox = null;
        return;
      }

      // Calculate selection rectangle bounds
      const minX = Math.min(state.selectionBox.start.x, state.selectionBox.end.x);
      const maxX = Math.max(state.selectionBox.start.x, state.selectionBox.end.x);
      const minY = Math.min(state.selectionBox.start.y, state.selectionBox.end.y);
      const maxY = Math.max(state.selectionBox.start.y, state.selectionBox.end.y);

      // Find all units within the selection rectangle
      let selected = state.currentPlayer.units.filter(u => {
        const ux = u.position.x + GAME_CONFIG.TILE_SIZE / 2;
        const uy = u.position.y + GAME_CONFIG.TILE_SIZE / 2;
        return ux >= minX && ux <= maxX && uy >= minY && uy <= maxY;
      });

      if (selected.length > MAX_SELECTION_COUNT) {
        selected = selected.slice(0, MAX_SELECTION_COUNT);
      }

      if (selected.length > 0) {
        state.currentPlayer.units.forEach(u => {
          u.isSelected = selected.some(s => s.id === u.id);
        });
        state.selectedUnits = selected;
      }

      state.selectionBox = null;
    });
  },

  researchUpgrade: (upgradeType) => {
    set((state) => {
      if (!state.currentPlayer) return;

      const upgrade = UPGRADES[upgradeType];
      if (!upgrade) return;

      // Check faction
      const playerFactionGroup = getFactionGroup(state.currentPlayer.faction);
      if (upgrade.factionGroup !== playerFactionGroup) return;

      // Check already researched
      if (state.currentPlayer.researchedUpgrades.includes(upgradeType)) return;

      // Check already researching
      if (state.currentPlayer.researchQueue.some(q => q.upgradeType === upgradeType)) return;

      // Check cost
      if (state.currentPlayer.money < upgrade.cost) {
        gameEventBus.emit('ui:notification', { message: `资源不足，需要 $${upgrade.cost}`, type: 'warning' });
        return;
      }

      // Check required buildings
      const hasAllRequired = upgrade.requiredBuildings.every(req =>
        state.currentPlayer!.buildings.some(b => b.type === req && b.isConstructed)
      );
      if (!hasAllRequired) {
        gameEventBus.emit('ui:notification', { message: '需要先建造前置建筑', type: 'warning' });
        return;
      }

      // Check prerequisite upgrades
      if (upgrade.prerequisites && upgrade.prerequisites.length > 0) {
        const missingPrereqs = upgrade.prerequisites.filter(p => !state.currentPlayer!.researchedUpgrades.includes(p));
        if (missingPrereqs.length > 0) {
          const missingNames = missingPrereqs.map(p => UPGRADES[p]?.name || p).join(', ');
          gameEventBus.emit('ui:notification', { message: `需要先研究: ${missingNames}`, type: 'warning' });
          return;
        }
      }

      // Only one research at a time
      if (state.currentPlayer.researchQueue.length >= 1) {
        gameEventBus.emit('ui:notification', { message: '已有研究正在进行', type: 'warning' });
        return;
      }

      state.currentPlayer.money -= upgrade.cost;
      state.currentPlayer.researchQueue.push({
        id: `research_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        upgradeType,
        progress: 0,
        totalTime: upgrade.researchTime,
        cost: upgrade.cost,
      });

      gameEventBus.emit('ui:notification', { message: `开始研究: ${upgrade.name}`, type: 'info' });
      gameEventBus.emit('upgrade:started', { upgradeType, upgradeName: upgrade.name, faction: state.currentPlayer.faction });
    });
  },

  researchUpgradeForPlayer: (playerId, upgradeType) => {
    set((state) => {
      const isCurrent = state.currentPlayer?.id === playerId;
      const player = isCurrent
        ? state.currentPlayer
        : state.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const upgrade = UPGRADES[upgradeType];
      if (!upgrade) return;

      // Check faction
      const playerFactionGroup = getFactionGroup(player.faction);
      if (upgrade.factionGroup !== playerFactionGroup) return;

      // Check already researched
      if (player.researchedUpgrades.includes(upgradeType)) return;

      // Check already researching
      if (player.researchQueue.some(q => q.upgradeType === upgradeType)) return;

      // Check cost
      if (player.money < upgrade.cost) return;

      // Check required buildings
      const hasAllRequired = upgrade.requiredBuildings.every(req =>
        player.buildings.some(b => b.type === req && b.isConstructed)
      );
      if (!hasAllRequired) return;

      // Check prerequisite upgrades
      if (upgrade.prerequisites && upgrade.prerequisites.length > 0) {
        const missingPrereqs = upgrade.prerequisites.filter(p => !player.researchedUpgrades.includes(p));
        if (missingPrereqs.length > 0) return;
      }

      // Only one research at a time
      if (player.researchQueue.length >= 1) return;

      player.money -= upgrade.cost;
      player.researchQueue.push({
        id: `research_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        upgradeType,
        progress: 0,
        totalTime: upgrade.researchTime,
        cost: upgrade.cost,
      });
    });
  },

  completeUpgrade: (playerId, upgradeType) => {
    set((state) => {
      const isCurrent = state.currentPlayer?.id === playerId;
      const player = isCurrent
        ? state.currentPlayer
        : state.aiPlayers.find(p => p.id === playerId);
      if (!player) return;

      const upgrade = UPGRADES[upgradeType];
      if (!upgrade) return;

      // Add to researched upgrades
      if (!player.researchedUpgrades.includes(upgradeType)) {
        player.researchedUpgrades.push(upgradeType);
      }

      // Remove from research queue
      player.researchQueue = player.researchQueue.filter(q => q.upgradeType !== upgradeType);

      // Apply immediate effects based on upgrade type
      applyUpgradeEffects(player, upgradeType);

      if (isCurrent) {
        gameEventBus.emit('ui:notification', { message: `研究完成: ${upgrade.name}`, type: 'success' });
      }
      gameEventBus.emit('upgrade:completed', { upgradeType, faction: player.faction });
    });
  },

  processResearchQueue: (deltaTime) => {
    const completedUpgrades: { playerId: string; upgradeType: UpgradeType }[] = [];

    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        if (player.researchQueue.length === 0) continue;

        const currentItem = player.researchQueue[0];
        const isLowPower = player.power < GAME_CONFIG.LOW_POWER_THRESHOLD;
        const speedModifier = isLowPower ? GAME_CONFIG.POWER_SLOWDOWN_FACTOR : 1;
        currentItem.progress += deltaTime * speedModifier;

        if (currentItem.progress >= currentItem.totalTime) {
          completedUpgrades.push({ playerId: player.id, upgradeType: currentItem.upgradeType });
        }
      }
    });

    for (const { playerId, upgradeType } of completedUpgrades) {
      get().completeUpgrade(playerId, upgradeType);
    }
  },

  loadIntoTransport: (unitId, transportId) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      let unit: Unit | null = null;
      let transport: Unit | null = null;

      for (const player of allPlayers) {
        const u = player.units.find(u => u.id === unitId);
        if (u) unit = u;
        const t = player.units.find(u => u.id === transportId);
        if (t) transport = t;
      }

      if (!unit || !transport) return;

      // Validate: unit must be infantry
      if (!INFANTRY_TYPES.has(unit.type)) return;

      // Validate: transport must have capacity
      if (!transport.maxPassengers || !transport.passengers) return;
      if (transport.passengers.length >= transport.maxPassengers) return;

      // Validate: same faction group
      if (getFactionGroup(unit.faction) !== getFactionGroup(transport.faction)) return;

      // Validate: unit must be near transport (within 3 tiles)
      const dx = unit.position.x - transport.position.x;
      const dy = unit.position.y - transport.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 3 * GAME_CONFIG.TILE_SIZE) return;

      // Load unit into transport
      unit.transportId = transportId;
      unit.state = UnitState.IDLE;
      unit.target = null;
      unit.waypoints = [];
      unit.position = { ...transport.position }; // Sync position with transport
      transport.passengers.push(unitId);

      gameEventBus.emit('transport:load', { unitId, transportId });
    });
  },

  unloadFromTransport: (transportId, position) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      let transport: Unit | null = null;

      for (const player of allPlayers) {
        const t = player.units.find(u => u.id === transportId);
        if (t) transport = t;
      }

      if (!transport || !transport.passengers) return;

      const unloadPos = position || { ...transport.position };

      // Clamp unload position to map bounds
      const mapWidth = (state.map?.width || 100) * GAME_CONFIG.TILE_SIZE;
      const mapHeight = (state.map?.height || 100) * GAME_CONFIG.TILE_SIZE;
      const clampedX = Math.max(GAME_CONFIG.TILE_SIZE, Math.min(mapWidth - GAME_CONFIG.TILE_SIZE, unloadPos.x));
      const clampedY = Math.max(GAME_CONFIG.TILE_SIZE, Math.min(mapHeight - GAME_CONFIG.TILE_SIZE, unloadPos.y));

      // Unload all passengers
      for (const passengerId of [...transport.passengers]) {
        for (const player of allPlayers) {
          const unit = player.units.find(u => u.id === passengerId);
          if (unit) {
            unit.transportId = undefined;
            unit.position = { x: clampedX, y: clampedY };
            unit.state = UnitState.IDLE;
            unit.target = null;
            unit.waypoints = [];
            break;
          }
        }
      }

      transport.passengers = [];
      gameEventBus.emit('transport:unload', { transportId });
    });
  },

  cancelProduction: (buildingId, queueIndex) => {
    set((draft) => {
      const allPlayers = [draft.currentPlayer, ...draft.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const building = player.buildings.find(b => b.id === buildingId);
        if (building && building.productionQueue && building.productionQueue.length > queueIndex) {
          const item = building.productionQueue[queueIndex];
          // Progressive refund: 100% at start, decreasing to 50% at completion
          const refundRate = 1 - (item.progress / item.totalTime) * 0.5;
          const refund = Math.floor(item.cost * refundRate);
          player.money += refund;
          // Remove from queue
          building.productionQueue.splice(queueIndex, 1);

          // If we cancelled the first item (currently producing), update producingUnit
          if (queueIndex === 0) {
            if (building.productionQueue.length > 0) {
              building.producingUnit = building.productionQueue[0].type as UnitType;
              building.newUnitCooldown = building.productionQueue[0].totalTime - building.productionQueue[0].progress;
            } else {
              building.producingUnit = null;
              building.newUnitCooldown = 0;
            }
          }
          break;
        }
      }
    });
  },

  sendToRepairFactory: (unitId) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (!unit) continue;

        // Find the nearest REPAIR building owned by the unit's player
        const repairBuilding = player.buildings.find(b =>
          b.type === BuildingType.REPAIR && b.isConstructed
        );
        if (!repairBuilding) {
          gameEventBus.emit('ui:notification', { message: '没有可用的维修工厂', type: 'warning' });
          return;
        }

        // Move the unit to the repair building's position
        unit.waypoints = [{ ...repairBuilding.position }];
        unit.state = UnitState.MOVING;
        unit.target = null;
        unit.isRepairingAtFactory = true;
        unit.isAttackMoving = false;
        break;
      }
    });
  },

  activateNuclearSilo: (buildingId, targetPosition) => {
    const destroyedUnits: string[] = [];
    const destroyedBuildings: string[] = [];

    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const building = player.buildings.find(b => b.id === buildingId);
        if (!building || !building.superweaponReady) return;
        if (building.type !== BuildingType.NUCLEAR_SILO) return;

        // Reset superweapon
        building.superweaponReady = false;
        building.superweaponChargeProgress = 0;

        // Nuclear strike effects handled by superweapon:activated event

        const nuclearRadius = 8 * GAME_CONFIG.TILE_SIZE;
        const nuclearDamage = 500;
        let killCount = 0;

        // Deal massive damage to all entities in radius (enemies and friendly)
        for (const p of allPlayers) {
          const isEnemy = p.id !== player.id && !(player.teamId !== undefined && p.teamId === player.teamId);
          for (const unit of [...p.units]) {
            const dx = unit.position.x - targetPosition.x;
            const dy = unit.position.y - targetPosition.y;
            if (Math.sqrt(dx * dx + dy * dy) <= nuclearRadius) {
              if (unit.isInvulnerable) continue;
              const armorType = combatSystem.getArmorTypeForUnit(unit.type);
              const actualDamage = combatSystem.calculateDamage(nuclearDamage, DamageType.EXPLOSIVE, armorType, unit.armor);
              unit.health -= actualDamage;
              gameEventBus.emit('combat:hit', { attackerId: buildingId, targetId: unit.id, damage: actualDamage, position: unit.position });
              if (unit.health <= 0) {
                destroyedUnits.push(unit.id);
                if (isEnemy) killCount++;
              }
            }
          }
          for (const b of [...p.buildings]) {
            const dx = b.position.x - targetPosition.x;
            const dy = b.position.y - targetPosition.y;
            if (Math.sqrt(dx * dx + dy * dy) <= nuclearRadius) {
              const actualDamage = combatSystem.calculateDamage(nuclearDamage, DamageType.EXPLOSIVE, ArmorType.STRUCTURE, 0);
              b.health -= actualDamage;
              gameEventBus.emit('combat:hit', { attackerId: buildingId, targetId: b.id, damage: actualDamage, position: b.position });
              if (b.health <= 0) {
                destroyedBuildings.push(b.id);
                if (isEnemy) killCount++;
              }
            }
          }
        }
        player.statistics.enemiesDestroyed += killCount;
        gameEventBus.emit('combat:explosion', { position: targetPosition });
        gameEventBus.emit('superweapon:activated', { type: BuildingType.NUCLEAR_SILO, position: targetPosition, faction: player.faction });
        break;
      }
    });

    for (const unitId of destroyedUnits) {
      get().destroyUnit(unitId);
    }
    for (const buildingId of destroyedBuildings) {
      get().destroyBuilding(buildingId);
    }
  },

  activateIronCurtain: (buildingId, targetPosition) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const building = player.buildings.find(b => b.id === buildingId);
        if (!building || !building.superweaponReady) return;
        if (building.type !== BuildingType.IRON_CURTAIN) return;

        // Reset superweapon
        building.superweaponReady = false;
        building.superweaponChargeProgress = 0;

        // Iron curtain effects handled by superweapon:activated event

        const curtainRadius = 5 * GAME_CONFIG.TILE_SIZE;
        const invulnerableDuration = 20000; // 20 seconds in ms

        // Make all friendly units in radius invulnerable
        for (const unit of player.units) {
          const dx = unit.position.x - targetPosition.x;
          const dy = unit.position.y - targetPosition.y;
          if (Math.sqrt(dx * dx + dy * dy) <= curtainRadius) {
            unit.isInvulnerable = true;
            unit.invulnerableUntil = get().gameTime + invulnerableDuration / 1000;
          }
        }

        gameEventBus.emit('superweapon:activated', { type: BuildingType.IRON_CURTAIN, position: targetPosition, faction: player.faction });
        break;
      }
    });
  },

  activateChronosphere: (buildingId, sourcePosition, targetPosition) => {
    set((state) => {
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        const building = player.buildings.find(b => b.id === buildingId);
        if (!building || !building.superweaponReady) return;
        if (building.type !== BuildingType.CHRONOSPHERE) return;

        // Reset superweapon
        building.superweaponReady = false;
        building.superweaponChargeProgress = 0;

        // Chronosphere effects handled by superweapon:activated event

        const chronoRadius = 5 * GAME_CONFIG.TILE_SIZE;

        // Teleport all friendly units from source area to target area
        for (const unit of player.units) {
          const dx = unit.position.x - sourcePosition.x;
          const dy = unit.position.y - sourcePosition.y;
          if (Math.sqrt(dx * dx + dy * dy) <= chronoRadius) {
            // Offset from source center to maintain formation
            const offsetX = unit.position.x - sourcePosition.x;
            const offsetY = unit.position.y - sourcePosition.y;
            // Clamp to map boundaries
            const mapWidth = state.map ? state.map.width * GAME_CONFIG.TILE_SIZE : Infinity;
            const mapHeight = state.map ? state.map.height * GAME_CONFIG.TILE_SIZE : Infinity;
            const newX = Math.max(0, Math.min(mapWidth - GAME_CONFIG.TILE_SIZE, targetPosition.x + offsetX));
            const newY = Math.max(0, Math.min(mapHeight - GAME_CONFIG.TILE_SIZE, targetPosition.y + offsetY));
            unit.position = { x: newX, y: newY };
            unit.state = UnitState.IDLE;
            unit.target = null;
            unit.waypoints = [];
            gameEventBus.emit('unit:teleport', { unitId: unit.id, position: { ...unit.position }, faction: player.faction });
          }
        }

        gameEventBus.emit('superweapon:activated', { type: BuildingType.CHRONOSPHERE, position: targetPosition, faction: player.faction });
        break;
      }
    });
  },

  updateFogVisibility: (fogOfWar) => {
    if (!get().map) {
      set({ fogVisibleTiles: new Set<string>() });
      return;
    }
    const now = Date.now();
    if (now - lastFogUpdateTime < FOG_UPDATE_INTERVAL) {
      return;
    }
    lastFogUpdateTime = now;
    const map = get().map!;
    const player = get().currentPlayer;

    // Observer mode: reveal entire map
    if (get().isObserverMode) {
      const visibleTiles = new Set<string>();
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          visibleTiles.add(`${x},${y}`);
        }
      }
      set({ fogVisibleTiles: visibleTiles });
      return;
    }

    const visibleTiles = new Set<string>();

    // Spy Satellite: all tiles are visible
    if (player?.researchedUpgrades.includes(UpgradeType.SPY_SATELLITE)) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          visibleTiles.add(`${x},${y}`);
        }
      }
    } else if (fogOfWar) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (fogOfWar.isTileVisible(x, y)) {
            visibleTiles.add(`${x},${y}`);
          }
        }
      }
    }

    set({ fogVisibleTiles: visibleTiles });
  },

  updateWeatherModifiers: (weatherType) => {
    switch (weatherType) {
      case 'rain':
        set({ weatherSpeedModifier: 0.9, weatherVisionModifier: 0.9, weatherBuildModifier: 1.0 });
        break;
      case 'sandstorm':
        set({ weatherSpeedModifier: 0.8, weatherVisionModifier: 0.7, weatherBuildModifier: 0.85 });
        break;
      case 'snow':
        set({ weatherSpeedModifier: 0.85, weatherVisionModifier: 0.85, weatherBuildModifier: 0.9 });
        break;
      case 'storm':
        set({ weatherSpeedModifier: 0.75, weatherVisionModifier: 0.75, weatherBuildModifier: 0.8 });
        break;
      case 'fog':
        set({ weatherSpeedModifier: 0.95, weatherVisionModifier: 0.6, weatherBuildModifier: 1.0 });
        break;
      case 'clear':
      default:
        set({ weatherSpeedModifier: 1.0, weatherVisionModifier: 1.0, weatherBuildModifier: 1.0 });
        break;
    }
  },

  updateDayNightVisionModifier: (timeOfDay) => {
    switch (timeOfDay) {
      case 'dawn':
      case 'day':
        set({ dayNightVisionModifier: 1.0 });
        break;
      case 'dusk':
        set({ dayNightVisionModifier: 0.85 });
        break;
      case 'night':
        set({ dayNightVisionModifier: 0.6 });
        break;
      default:
        set({ dayNightVisionModifier: 1.0 });
        break;
    }
  },

  setUnitStance: (unitIds, stance) => {
    set((state) => {
      const idSet = new Set(unitIds);
      const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
      for (const player of allPlayers) {
        for (const unit of player.units) {
          if (idSet.has(unit.id)) {
            unit.stance = stance;
          }
        }
      }
    });
  },

  selectIdleMiners: () => {
    set((state) => {
      const player = state.currentPlayer;
      if (!player) return;
      let idleMiners = player.units.filter(u =>
        u.data.canHarvest && u.state === UnitState.IDLE && !u.transportId
      );
      if (idleMiners.length > MAX_SELECTION_COUNT) {
        idleMiners = idleMiners.slice(0, MAX_SELECTION_COUNT);
      }
      const idleMinerIds = new Set(idleMiners.map(u => u.id));
      player.units.forEach(u => {
        u.isSelected = idleMinerIds.has(u.id);
      });
      state.selectedUnits = idleMiners;
      state.selectedBuilding = null;
    });
  },

  selectIdleMilitary: () => {
    set((state) => {
      const player = state.currentPlayer;
      if (!player) return;
      let idleMilitary = player.units.filter(u =>
        !u.data.canHarvest && u.attack > 0 && u.state === UnitState.IDLE && !u.transportId
      );
      if (idleMilitary.length > MAX_SELECTION_COUNT) {
        idleMilitary = idleMilitary.slice(0, MAX_SELECTION_COUNT);
      }
      const idleMilitaryIds = new Set(idleMilitary.map(u => u.id));
      player.units.forEach(u => {
        u.isSelected = idleMilitaryIds.has(u.id);
      });
      state.selectedUnits = idleMilitary;
      state.selectedBuilding = null;
    });
  },

  surrender: () => {
    set((state) => {
      if (!state.currentPlayer || state.currentPlayer.isDefeated) return;
      if (state.gameState !== GameState.PLAYING) return;
      state.currentPlayer.isDefeated = true;
      gameEventBus.emit('game:defeat', { faction: state.currentPlayer.faction });
      if (state.isCampaignMode) {
        state.missionResult = 'defeat';
        state.missionStats = {
          time: state.gameTime,
          unitsProduced: state.currentPlayer.statistics.unitsProduced,
          unitsLost: state.currentPlayer.statistics.unitsLost,
          enemiesDestroyed: state.currentPlayer.statistics.enemiesDestroyed,
          buildingsBuilt: state.currentPlayer.statistics.buildingsBuilt,
          buildingsLost: state.currentPlayer.statistics.buildingsLost,
          resourcesGathered: state.currentPlayer.statistics.resourcesGathered,
          rating: 0,
        };
        state.gameState = GameState.MISSION_DEBRIEFING;
      } else {
        state.gameState = GameState.DEFEAT;
      }
    });
  },

  setGameSettings: (settings) => {
    set((state) => {
      Object.assign(state.gameSettings, settings);
    });
  },

  checkAchievements: () => {
    const state = get();
    if (!state.currentPlayer) return;

    const stats = state.currentPlayer.statistics;
    const playerFaction = state.currentPlayer.faction;
    const unlocked = new Set(state.unlockedAchievements);
    let newlyUnlocked: Achievement | null = null;

    for (const achievement of ACHIEVEMENTS) {
      if (unlocked.has(achievement.id)) continue;
      // Check faction requirement
      if (achievement.factionRequired) {
        const isAllied = ['USA', 'BRITAIN', 'GERMANY', 'FRANCE', 'KOREA'].includes(playerFaction);
        if (achievement.factionRequired === 'allied' && !isAllied) continue;
        if (achievement.factionRequired === 'soviet' && isAllied) continue;
      }
      if (achievement.condition(stats)) {
        unlocked.add(achievement.id);
        newlyUnlocked = achievement;
      }
    }

    if (unlocked.size !== state.unlockedAchievements.length) {
      const newIds = [...unlocked];
      saveUnlockedAchievements(newIds);
      set({
        unlockedAchievements: newIds,
        newAchievement: newlyUnlocked,
      });
    }
  },

  clearNewAchievement: () => {
    set({ newAchievement: null });
  },

  startTutorial: () => {
    set({ tutorialActive: true, tutorialStep: 0, tutorialHighlight: null });
  },

  endTutorial: () => {
    set({ tutorialActive: false, tutorialStep: 0, tutorialHighlight: null });
    localStorage.setItem('ra2_tutorial_completed', 'true');
  },

  setTutorialStep: (step) => {
    set((state) => {
      const highlight = null; // highlight is determined by TUTORIAL_STEPS in GameUI
      return { tutorialStep: step, tutorialHighlight: highlight };
    });
  },

  saveCameraBookmark: (index, position) => {
    set((draft) => {
      if (!draft.cameraBookmarks) draft.cameraBookmarks = [null, null, null, null];
      if (index >= 0 && index < 4) {
        draft.cameraBookmarks[index] = position;
      }
    });
  },

  loadCameraBookmark: (index) => {
    const bookmarks = get().cameraBookmarks;
    if (bookmarks && index >= 0 && index < 4) {
      return bookmarks[index];
    }
    return null;
  },

  resetGame: () => {
    set({
      gameState: GameState.MENU,
      currentPlayer: null,
      aiPlayers: [],
      aiControllers: new Map(),
      selectedUnits: [],
      selectedBuilding: null,
      neutralBuildings: [],
      gameTime: 0,
      isPaused: false,
      isObserverMode: false,
      resources: null,
      gameLogs: [],
      placementBuildingType: null,
      placementPreviewPos: null,
      placementValid: false,
      fogVisibleTiles: new Set<string>(),
      weatherSpeedModifier: 1.0,
      weatherVisionModifier: 1.0,
      weatherBuildModifier: 1.0,
      dayNightVisionModifier: 1.0,
      gameSettings: { ...DEFAULT_GAME_SETTINGS },
      isCampaignMode: false,
      cameraBookmarks: [null, null, null, null],
      missionResult: null,
      missionStats: null,
    });
    attackWaveSys.reset();
    combatSystem.reset();
    combatUpdateSystem.reset();
    captureSystem.reset();
    movementSystem.reset();
    crateSpawnTimer = 0;
    oreRegenTimer = 0;
    autoSaveTimer = 0;
    lastFogUpdateTime = 0;
    achievementCheckTimer = 0;
  },

  selectCampaign: (campaignId) => {
    set({ selectedCampaign: campaignId });
  },

  selectMission: (mission) => {
    set({ selectedMission: mission });
  },

  startCampaignMission: (mission, difficulty) => {
    const state = get();
    const playerFaction = mission.faction;
    const aiFaction = playerFaction === Faction.USA ? Faction.SOVIET : Faction.USA;

    const playerSlot: PlayerSlot = {
      id: 'player',
      faction: playerFaction,
      difficulty,
      isAI: false,
      name: '指挥官',
      teamId: 1,
      color: '#4169E1',
    };

    const aiSlots: PlayerSlot[] = [
      {
        id: 'ai_1',
        faction: aiFaction,
        difficulty,
        isAI: true,
        name: 'AI-1',
        teamId: 2,
        color: '#DC143C',
      },
    ];

    state.initializeGame(playerSlot, aiSlots, mission.map);

    // Set campaign victory conditions
    victoryConditionSystem.reset();
    victoryConditionSystem.setConditions([{ type: VictoryConditionType.ANNIHILATION }]);

    set({
      isCampaignMode: true,
      gameState: GameState.PLAYING,
      lastMissionDifficulty: difficulty,
    });
  },

  completeCampaignMission: (result) => {
    const state = get();
    const gameTime = state.gameTime;
    const playerStats = state.currentPlayer?.statistics;

    const stats = {
      time: gameTime,
      unitsProduced: playerStats?.unitsProduced ?? 0,
      unitsLost: playerStats?.unitsLost ?? 0,
      enemiesDestroyed: playerStats?.enemiesDestroyed ?? 0,
      buildingsBuilt: playerStats?.buildingsBuilt ?? 0,
      buildingsLost: playerStats?.buildingsLost ?? 0,
      resourcesGathered: playerStats?.resourcesGathered ?? 0,
      rating: result === 'victory' ? Math.max(1, 5 - Math.floor(gameTime / 120)) : 0,
    };

    if (result === 'victory' && state.selectedMission) {
      const campaignId = state.selectedMission.campaign;
      const missionId = state.selectedMission.id;
      const newProgress = completeCampaignMission(
        state.campaignProgress,
        campaignId,
        missionId,
        stats.rating,
        gameTime
      );

      // Persist to localStorage
      try {
        localStorage.setItem('campaignProgress', JSON.stringify(newProgress));
      } catch {
        // Ignore localStorage errors
      }

      set({
        campaignProgress: newProgress,
        missionResult: result,
        missionStats: stats,
        gameState: GameState.MISSION_DEBRIEFING,
      });
    } else {
      set({
        missionResult: result,
        missionStats: stats,
        gameState: GameState.MISSION_DEBRIEFING,
      });
    }
  },

  loadCampaignProgress: () => {
    try {
      const saved = localStorage.getItem('campaignProgress');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<CampaignId, CampaignProgress>;
        set({ campaignProgress: parsed });
      }
    } catch {
      // Ignore localStorage errors
    }
  },
})));

// Subscribe to combat:hit events to set alertLevel when player buildings are attacked
gameEventBus.on('combat:hit', (event) => {
  const data = event.data as { targetId?: string; damage?: number; position?: { x: number; y: number } } | undefined;
  if (!data?.targetId) return;
  const state = useGameStore.getState();
  if (!state.currentPlayer) return;
  // Check if the target is a player building
  const isPlayerBuilding = state.currentPlayer.buildings.some(b => b.id === data.targetId);
  if (isPlayerBuilding) {
    useGameStore.setState({ alertLevel: 'high', alertClearTimer: 5 });
    gameEventBus.emit('alert:baseUnderAttack', { faction: state.currentPlayer.faction, position: data.position });
  }
  // Check if the target is a player unit near the command center
  const isPlayerUnit = state.currentPlayer.units.some(u => u.id === data.targetId);
  if (isPlayerUnit) {
    const commandCenter = state.currentPlayer.buildings.find(b => b.type === BuildingType.COMMAND);
    if (commandCenter && data.position) {
      const dx = data.position.x - commandCenter.position.x;
      const dy = data.position.y - commandCenter.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < GAME_CONFIG.TILE_SIZE * 10) {
        useGameStore.setState({ alertLevel: 'low', alertClearTimer: 5 });
      }
    }
  }
});

// Expose store for E2E testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__ZUSTAND_STORE__ = useGameStore;

