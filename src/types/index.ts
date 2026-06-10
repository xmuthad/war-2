export interface Vector2 {
  x: number;
  y: number;
}

export enum FactionGroup {
  ALLIED = 'allied',
  SOVIET = 'soviet',
}

export enum Faction {
  USA = 'usa',
  BRITAIN = 'britain',
  GERMANY = 'germany',
  FRANCE = 'france',
  KOREA = 'korea',
  SOVIET = 'soviet',
  CUBA = 'cuba',
  LIBYA = 'libya',
  IRAQ = 'iraq',
  NEUTRAL = 'neutral',
}

export const FACTION_INFO: Record<Faction, {
  name: string;
  group: FactionGroup;
  color: string;
  secondaryColor: string;
  description: string;
  specialAbility?: string;
}> = {
  [Faction.USA]: {
    name: '美国',
    group: FactionGroup.ALLIED,
    color: '#4169E1',
    secondaryColor: '#27408B',
    description: '综合实力均衡，特种部队海豹突击队',
    specialAbility: 'ninja'
  },
  [Faction.BRITAIN]: {
    name: '英国',
    group: FactionGroup.ALLIED,
    color: '#C41E3A',
    secondaryColor: '#800020',
    description: '狙击手部队，远程火力强大',
    specialAbility: 'sniper'
  },
  [Faction.FRANCE]: {
    name: '法国',
    group: FactionGroup.ALLIED,
    color: '#0055A4',
    secondaryColor: '#FFFFFF',
    description: '幻影坦克，反坦克能力出众',
    specialAbility: 'phantom'
  },
  [Faction.GERMANY]: {
    name: '德国',
    group: FactionGroup.ALLIED,
    color: '#DD0000',
    secondaryColor: '#FFCC00',
    description: '利赛特电磁炮，高科技单位',
    specialAbility: 'tesla'
  },
  [Faction.KOREA]: {
    name: '韩国',
    group: FactionGroup.ALLIED,
    color: '#003478',
    secondaryColor: '#CE1126',
    description: '黑鹰战机，空中优势',
    specialAbility: 'blackhawk'
  },
  [Faction.SOVIET]: {
    name: '苏联',
    group: FactionGroup.SOVIET,
    color: '#CC0000',
    secondaryColor: '#FFD700',
    description: '基础阵营，天启坦克',
    specialAbility: 'apocalypse'
  },
  [Faction.CUBA]: {
    name: '古巴',
    group: FactionGroup.SOVIET,
    color: '#002A5E',
    secondaryColor: '#CF4520',
    description: '恐怖分子，自杀式攻击',
    specialAbility: 'terror'
  },
  [Faction.LIBYA]: {
    name: '利比亚',
    group: FactionGroup.SOVIET,
    color: '#000000',
    secondaryColor: '#006233',
    description: '疯狂伊文，炸弹专家',
    specialAbility: 'ivan'
  },
  [Faction.IRAQ]: {
    name: '伊拉克',
    group: FactionGroup.SOVIET,
    color: '#006633',
    secondaryColor: '#FFFFFF',
    description: '辐射工兵，化学武器',
    specialAbility: 'chemical'
  },
  [Faction.NEUTRAL]: {
    name: '中立',
    group: FactionGroup.ALLIED,
    color: '#888888',
    secondaryColor: '#666666',
    description: '中立单位'
  }
};

export function getFactionGroup(faction: Faction): FactionGroup {
  return FACTION_INFO[faction].group;
}

export function isAllied(faction: Faction): boolean {
  return getFactionGroup(faction) === FactionGroup.ALLIED;
}

export function isSoviet(faction: Faction): boolean {
  return getFactionGroup(faction) === FactionGroup.SOVIET;
}

export function getFactionColor(faction: Faction): string {
  return FACTION_INFO[faction].color;
}

export function getFactionSecondaryColor(faction: Faction): string {
  return FACTION_INFO[faction].secondaryColor;
}

export function getAlliedFactions(): Faction[] {
  return [
    Faction.USA,
    Faction.BRITAIN,
    Faction.GERMANY,
    Faction.FRANCE,
    Faction.KOREA
  ];
}

export function getSovietFactions(): Faction[] {
  return [
    Faction.SOVIET,
    Faction.CUBA,
    Faction.LIBYA,
    Faction.IRAQ
  ];
}

export enum UnitType {
  MINER = 'miner',
  SOLDIER = 'soldier',
  ENGINEER = 'engineer',
  ROCKET = 'rocket',
  SNIPER = 'sniper',
  TANYA = 'tanya',
  SEAL = 'seal',
  TANK = 'tank',
  IFV = 'ifv',
  PHANTOM = 'phantom',
  PRISM = 'prism',
  RHINO = 'rhino',
  APOCALYPSE = 'apocalypse',
  TESLA = 'tesla',
  HELICOPTER = 'helicopter',
  BLACKHAWK = 'blackhawk',
  KIROV = 'kirov',
  YAK = 'yak',
  TERRORIST = 'terrorist',
  IVAN = 'ivan',
  FLAK = 'flak',
  CONSCRIPT = 'conscript',
  FLAKINFANTRY = 'flakinfantry',
  GUARDIAN = 'guardian',
  DESPOT = 'despot',
  CHRONO = 'chrono',
  APC = 'apc',
  DESTROYER = 'destroyer',
  SUBMARINE = 'submarine',
  TRANSPORT_SHIP = 'transport_ship',
  SPY = 'spy',
  // New RA2 units
  MCV = 'mcv',
  ATTACK_DOG = 'attack_dog',
  WAR_MINER = 'war_miner',
  MIRAGE = 'mirage',
  GRIZZLY = 'grizzly',
  LASH = 'lash',
  DREADNOUGHT = 'dreadnought',
  AEGIS = 'aegis',
  GI = 'gi',
  GUARDIAN_GI = 'guardian_gi',
  BRUTE = 'brute',
  DISC = 'disc',
  BOOMER = 'boomer',
  GATTLING_TANK = 'gattling_tank',
  SLAVE_MINER = 'slave_miner',
  DOLPHIN = 'dolphin',
  SQUID = 'squid',
  CARRIER = 'carrier',
  V3_ROCKET = 'v3_rocket',
  CHRONO_MINER = 'chrono_miner',
  HARRIER = 'harrier',
}

export enum BuildingType {
  COMMAND = 'command',
  REFINERY = 'refinery',
  BARRACKS = 'barracks',
  WARFACTORY = 'warfactory',
  POWER = 'power',
  HELIPAD = 'helipad',
  AIRFIELD = 'airfield',
  RADAR = 'radar',
  TECH = 'tech',
  REPAIR = 'repair',
  WALL = 'wall',
  TURRET = 'turret',
  DEFENSE = 'defense',
  FLAME_TOWER = 'flame_tower',
  TESLA_COIL = 'tesla_coil',
  OIL_DERRICK = 'oil_derrick',
  HOSPITAL = 'hospital',
  NUCLEAR_SILO = 'nuclear_silo',
  IRON_CURTAIN = 'iron_curtain',
  CHRONOSPHERE = 'chronosphere',
  NAVAL_SHIPYARD = 'naval_shipyard',
  // New RA2 buildings
  PATRIOT = 'patriot',
  SENTRY_GUN = 'sentry_gun',
  BATTLE_BUNKER = 'battle_bunker',
  CLONING_VATS = 'cloning_vats',
  INDUSTRIAL_PLANT = 'industrial_plant',
  PSYCHIC_SENSOR = 'psychic_sensor',
  BIOLAB = 'biolab',
  MACHINE_SHOP = 'machine_shop',
  CIVILIAN_BUILDING = 'civilian_building',
  BRIDGE = 'bridge',
  BRIDGE_DESTROYED = 'bridge_destroyed',
  GAP_GENERATOR = 'gap_generator',
  NUCLEAR_REACTOR = 'nuclear_reactor',
  FLAK_CANNON = 'flak_cannon',
  SPY_SATELLITE = 'spy_satellite',
  ORE_PURIFIER = 'ore_purifier',
  GRAND_CANNON = 'grand_cannon',
}

export enum TileType {
  GRASS = 'grass',
  WATER = 'water',
  MOUNTAIN = 'mountain',
  FOREST = 'forest',
  ROAD = 'road',
  ORE = 'ore',
  SAND = 'sand',
  ICE = 'ice',
  MUD = 'mud',
  RUBBLE = 'rubble',
  CRATER = 'crater',
  CLIFF = 'cliff',
  BRIDGE = 'bridge',
  BRIDGE_DESTROYED = 'bridge_destroyed',
}

export enum UnitState {
  IDLE = 'idle',
  MOVING = 'moving',
  ATTACKING = 'attacking',
  HARVESTING = 'harvesting',
  RETURNING = 'returning',
  BUILDING = 'building',
  REPAIRING = 'repairing',
  PATROLLING = 'patrolling',
  GUARDING = 'guarding',
  CAPTURING = 'capturing',
  RETREATING = 'retreating',
  GARRISONING = 'garrisoning',
  DEPLOYING = 'deploying',
}

export enum UnitStance {
  AGGRESSIVE = 'aggressive',  // Chase enemies in vision range
  GUARD = 'guard',            // Only attack enemies in attack range
  PASSIVE = 'passive',        // Only return fire, don't initiate
}

export enum GameState {
  MENU = 'menu',
  LOADING = 'loading',
  PLAYING = 'playing',
  PAUSED = 'paused',
  VICTORY = 'victory',
  DEFEAT = 'defeat',
  CAMPAIGN_SELECT = 'campaign_select',
  MISSION_BRIEFING = 'mission_briefing',
  MISSION_DEBRIEFING = 'mission_debriefing',
}

export enum VictoryConditionType {
  ANNIHILATION = 'annihilation',           // 全灭：摧毁所有敌方建筑
  COMMAND_CENTER = 'command_center',       // 摧毁主基地：摧毁敌方主基地即胜利
  CAPTURE_BUILDING = 'capture_building',   // 占领建筑：占领指定中立建筑
  TIMED_SURVIVAL = 'timed_survival',       // 限时生存：在限定时间内存活
  ESCORT = 'escort',                       // 护送：将指定单位护送到目标位置
  ECONOMIC = 'economic',                   // 经济胜利：累计采集指定数量资源
}

export interface VictoryCondition {
  type: VictoryConditionType;
  timeLimit?: number;              // 限时生存的时间限制（秒）
  targetBuildingType?: BuildingType; // 需要占领/摧毁的建筑类型
  targetResourceId?: string;        // 需要占领的建筑ID
  escortUnitId?: string;            // 需要护送的单位ID
  escortTarget?: Vector2;           // 护送目标位置
  resourceTarget?: number;          // 经济胜利的资源目标
}

export enum Difficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  BRUTAL = 'brutal',
}

export interface UnitData {
  type: UnitType;
  faction: Faction;
  name: string;
  health: number;
  armor: number;
  attack: number;
  attackRange: number;
  attackSpeed: number;
  speed: number;
  vision: number;
  cost: number;
  buildTime: number;
  isAirborne: boolean;
  isNaval?: boolean;
  canAttack?: boolean;
  canHarvest: boolean;
  canCapture: boolean;
  special?: string;
  description?: string;
  maxPassengers?: number;
  maxAmmo?: number;        // Aircraft ammo capacity; undefined = infinite ammo
  canDeploy?: boolean;           // Can this unit deploy into a building (MCV)
  deployBuildingType?: BuildingType; // What building type to deploy into
  deployTime?: number;           // Time to deploy in seconds
  canGarrison?: boolean;         // Can this unit garrison buildings
  cargoCapacity?: number;        // Max ore/resources this unit can carry (harvesters)
}

export interface BuildingData {
  type: BuildingType;
  faction: Faction;
  name: string;
  health: number;
  powerOutput: number;
  powerConsumption: number;
  cost: number;
  buildTime: number;
  width: number;
  height: number;
  canProduce: (UnitType | BuildingType)[];
  requiredBuildings: BuildingType[];
  attack?: number;
  attackRange?: number;
  attackSpeed?: number;
  superweaponChargeTime?: number;
  // Garrison system
  maxGarrison?: number;
  isGarrisonable?: boolean;
  // Bridge system
  isBridge?: boolean;
  // Height system
  elevationLevel?: number;
  // Description
  description?: string;
}

export interface Tile {
  type: TileType;
  walkable: boolean;
  buildable: boolean;
  movementCost: number;
  elevation?: number;           // Height level: 0=ground, 1=low cliff, 2=high cliff
  isBridgeTile?: boolean;       // Is this tile part of a bridge
  bridgeId?: string;            // ID of the bridge building this tile belongs to
}

export interface ResourceNode {
  id: string;
  position: Vector2;
  amount: number;
  maxAmount: number;
  resourceType?: 'ore' | 'gem' | 'crate';
  crateType?: 'money' | 'heal' | 'veterancy' | 'reveal';
}

export interface GameMapData {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Tile[][];
  spawnPoints: Vector2[];
  navalSpawnPoints?: Vector2[];
  resourceNodes: ResourceNode[];
}

export interface PendingBomb {
  id: string;
  targetId: string;
  targetPosition: Vector2;
  timer: number;
  damage: number;
  faction: Faction;
}

export interface Unit {
  id: string;
  type: UnitType;
  faction: Faction;
  position: Vector2;
  health: number;
  maxHealth: number;
  armor: number;
  attack: number;
  attackRange: number;
  attackSpeed: number;
  speed: number;
  vision: number;
  cost: number;
  buildTime: number;
  state: UnitState;
  target: string | null;
  waypoints: Vector2[];
  isAirborne: boolean;
  isNaval?: boolean;
  isSelected: boolean;
  isBuilding: boolean;
  buildProgress: number;
  data: UnitData;
  harvestTarget: ResourceNode | null;
  cargo: number;
  cargoCapacity: number;
  kills: number;
  rank: UnitRank;
  direction: number;
  isDisguised?: boolean;
  idleTimer?: number;
  transportId?: string;
  passengers?: string[];
  maxPassengers?: number;
  isAttackMoving?: boolean;
  attackTarget?: string | null;   // Target entity ID for attack-move
  stance?: UnitStance;
  chronoShiftTarget?: Vector2;    // Target position for chrono shift
  chronoShiftTimer?: number;      // Timer for charging (2s) and cooldown (5s)
  isChronoShifting?: boolean;     // Currently charging for teleport
  isChronoCooldown?: boolean;     // On cooldown after teleport
  isRepairingAtFactory?: boolean; // Unit is being repaired at repair factory
  isInvulnerable?: boolean;       // Iron Curtain invulnerability
  invulnerableUntil?: number;     // Timestamp when invulnerability expires
  isSubmerged?: boolean;         // Submarine stealth: submerged = invisible to enemies
  ammo?: number;                 // Current ammo count for aircraft
  isReturningToBase?: boolean;   // Aircraft returning to helipad/airfield to rearm
  _buffUntil?: number;           // gameTime when attack buff expires
  _debuffUntil?: number;         // gameTime when attack debuff expires
  _psychicDetectedUntil?: number; // gameTime when psychic sensor detection expires
  _spyRevealedUntil?: number;    // gameTime when spy map reveal expires
  _grappledBySquid?: string;     // ID of the squid grappling this unit
  _grappleUntil?: number;        // gameTime when grapple effect expires
  // Garrison system
  garrisonedBuildingId?: string; // ID of building this unit is garrisoned in
  // MCV deploy system
  canDeploy?: boolean;           // Can this unit deploy into a building (MCV)
  deployBuildingType?: BuildingType; // What building type to deploy into
  isDeploying?: boolean;         // Currently deploying
  deployTimer?: number;          // Time remaining for deployment
  chronoFreezeProgress?: number; // 0 to 1, when reaches 1 the unit is destroyed by Chrono Legionnaire
}

export enum UnitRank {
  ROOKIE = 0,
  VETERAN = 1,
  ELITE = 2,
}

export interface Building {
  id: string;
  type: BuildingType;
  faction: Faction;
  position: Vector2;
  health: number;
  maxHealth: number;
  powerOutput: number;
  powerConsumption: number;
  cost: number;
  buildTime: number;
  width: number;
  height: number;
  canProduce: (UnitType | BuildingType)[];
  requiredBuildings: BuildingType[];
  isPowered: boolean;
  isSelected: boolean;
  isBuilding: boolean;
  buildProgress: number;
  isConstructed: boolean;
  data: BuildingData;
  productionQueue: BuildQueueItem[];
  rallyPoint: Vector2 | null;
  isActive: boolean;
  newUnitCooldown: number;
  producingUnit: UnitType | null;
  empDisabledUntil?: number;
  attack?: number;
  attackRange?: number;
  attackSpeed?: number;
  attackTarget?: string | null;
  attackCooldown?: number;
  isRepairing?: boolean;
  superweaponChargeTime?: number;    // Total charge time in seconds
  superweaponChargeProgress?: number; // Current progress
  superweaponReady?: boolean;         // Is the superweapon ready to fire?
  oreStorage?: number;                // Ore stored at refinery
  maxOreStorage?: number;             // Max ore storage capacity
  // Garrison system
  garrisonedUnits?: string[];         // IDs of units garrisoned inside
  maxGarrison?: number;               // Max units that can garrison
  isGarrisonable?: boolean;           // Whether this building can be garrisoned
  // Bridge system
  isBridge?: boolean;                 // Is this a bridge building
  isBridgeDestroyed?: boolean;        // Is the bridge destroyed
  bridgeTilePositions?: Vector2[];    // Tile positions this bridge covers
  // Height system
  elevationLevel?: number;
  // Description
  description?: string;
  // Chrono Legionnaire freeze
  chronoFreezeProgress?: number; // 0 to 1, when reaches 1 the building is destroyed by Chrono Legionnaire
}

export interface BuildQueueItem {
  id: string;
  producerId: string;
  type: UnitType | BuildingType;
  progress: number;
  totalTime: number;
  cost: number;
}

export interface PlayerStatistics {
  unitsProduced: number;
  unitsLost: number;
  enemiesDestroyed: number;
  buildingsBuilt: number;
  buildingsLost: number;
  resourcesGathered: number;
}

export interface Player {
  id: string;
  faction: Faction;
  name: string;
  money: number;
  power: number;
  maxPower: number;
  units: Unit[];
  buildings: Building[];
  buildQueue: BuildQueueItem[];
  researchedUpgrades: UpgradeType[];
  researchQueue: ResearchQueueItem[];
  isAI: boolean;
  difficulty: Difficulty;
  color: string;
  isDefeated: boolean;
  isVictorious: boolean;
  teamId?: number;
  statistics: PlayerStatistics;
  _tempSpySatelliteUntil?: number;  // gameTime when temporary spy satellite vision expires
  spyInfiltrationBuffs?: {
    veteranInfantry: boolean;
    veteranVehicles: boolean;
    mapRevealedUntil: number;
  };
}

export interface PlayerSlot {
  id: string;
  faction: Faction;
  difficulty: Difficulty;
  isAI: boolean;
  name: string;
  teamId: number;
  color: string;
}

export const PLAYER_COLORS = [
  '#4169E1',
  '#DC143C',
  '#32CD32',
  '#FFD700',
  '#FF6347',
  '#8A2BE2',
  '#00CED1',
  '#FF69B4',
];

export enum UpgradeType {
  // Allied upgrades
  ADVANCED_POWER = 'advanced_power',        // +50% power output
  ORE_COMPRESSION = 'ore_compression',      // +20% ore value
  INFANTRY_ATTACK = 'infantry_attack',      // +10% infantry attack
  ROCKET_RANGE = 'rocket_range',            // +15% rocket range
  SPY_SATELLITE = 'spy_satellite',          // global vision
  ARMOR_REINFORCE = 'armor_reinforce',      // +20% vehicle armor
  ENGINE_OPTIMIZE = 'engine_optimize',      // +15% vehicle speed
  ADVANCED_ARTILLERY = 'advanced_artillery', // +25% vehicle damage
  PRISM_TECH = 'prism_tech',               // enables prism tank

  // Soviet upgrades
  NUCLEAR_POWER = 'nuclear_power',          // +100% power output
  GOLD_REFINING = 'gold_refining',          // +50% ore value
  CONSCRIPT_ATTACK = 'conscript_attack',    // +15% infantry attack
  TESLA_WEAPONS = 'tesla_weapons',          // enables tesla units
  ELITE_FORCES = 'elite_forces',            // enables special units
  HEAVY_ARMOR = 'heavy_armor',              // +30% vehicle armor
  TURBO_ENGINE = 'turbo_engine',            // +20% vehicle speed
  EMP_TECH = 'emp_tech',                    // enables EMP ability
  CHRONO_TECH = 'chrono_tech',              // enables Chrono Legionnaire
}

export interface Upgrade {
  type: UpgradeType;
  name: string;
  cost: number;
  researchTime: number;
  requiredBuildings: BuildingType[];
  factionGroup: FactionGroup;
  description: string;
  effect: string;
  /** Upgrades that must be researched before this one becomes available */
  prerequisites?: UpgradeType[];
}

export interface ResearchQueueItem {
  id: string;
  upgradeType: UpgradeType;
  progress: number;
  totalTime: number;
  cost: number;
}

export interface Combat {
  attacker: Unit;
  target: Unit | Building;
  attackTimer: number;
  isFinished: boolean;
}
