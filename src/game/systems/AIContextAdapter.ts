import type {
  AIContext,
  AIPlayerState,
  AIUnit,
  AIBuilding,
  AIGameMap,
  AIResourceNode,
  AIObjective,
  AIResources,
  AIDifficulty,
  UnitAIState,
} from './AITypes';
import { calculateThreatLevel } from './AIUtils';
import {
  Player,
  Unit,
  Building,
  GameMapData,
  UnitState,
  Difficulty,
  UnitType,
} from '../../types';

const INFANTRY_TYPES = new Set([
  UnitType.SOLDIER, UnitType.ROCKET, UnitType.SNIPER, UnitType.SEAL,
  UnitType.TANYA, UnitType.CONSCRIPT, UnitType.FLAKINFANTRY,
  UnitType.TERRORIST, UnitType.IVAN, UnitType.ENGINEER, UnitType.CHRONO,
]);
import { GAME_CONFIG } from '../config/GameConfig';

function mapUnitStateToAI(state: UnitState): UnitAIState {
  switch (state) {
    case UnitState.IDLE: return 'idle';
    case UnitState.MOVING: return 'moving';
    case UnitState.ATTACKING: return 'attacking';
    case UnitState.HARVESTING: return 'harvesting';
    case UnitState.RETURNING: return 'returning';
    case UnitState.PATROLLING: return 'patrolling';
    case UnitState.GUARDING: return 'defending';
    case UnitState.REPAIRING: return 'defending';
    case UnitState.BUILDING: return 'idle';
    default: return 'idle';
  }
}

function mapDifficultyToAI(difficulty: Difficulty): AIDifficulty {
  return difficulty as AIDifficulty;
}

export function convertUnitToAIUnit(unit: Unit): AIUnit {
  return {
    id: unit.id,
    type: unit.type,
    position: { ...unit.position },
    health: unit.health,
    maxHealth: unit.maxHealth,
    attack: unit.attack,
    defense: unit.armor,
    speed: unit.speed,
    range: unit.attackRange,
    state: mapUnitStateToAI(unit.state),
    target: unit.target || undefined,
    targetPosition: unit.waypoints.length > 0 ? { ...unit.waypoints[0] } : undefined,
    cargo: unit.cargo,
    isInfantry: INFANTRY_TYPES.has(unit.type),
    transportId: unit.transportId,
    passengers: unit.passengers ? [...unit.passengers] : undefined,
    maxPassengers: unit.maxPassengers,
    data: {
      canAttack: unit.data.canAttack,
      canHarvest: unit.data.canHarvest,
      canBuild: unit.data.canBuild,
      canCapture: unit.data.canCapture,
    },
  };
}

export function convertBuildingToAIBuilding(building: Building): AIBuilding {
  return {
    id: building.id,
    type: building.type,
    position: { ...building.position },
    health: building.health,
    maxHealth: building.maxHealth,
    isConstructed: building.isConstructed,
    productionQueue: building.productionQueue.map(item => String(item.type)),
    isActive: building.isActive && building.isPowered,
    rallyPoint: building.rallyPoint ? { ...building.rallyPoint } : undefined,
  };
}

export function convertPlayerToAIPlayerState(player: Player): AIPlayerState {
  const constructedBuildings = player.buildings.filter(b => b.isConstructed);
  const combatUnits = player.units.filter(u => u.data.canAttack !== false);

  const defenseLevel = constructedBuildings.reduce((sum, b) => {
    const healthRatio = b.health / b.maxHealth;
    const isDefense = b.type === 'turret' || b.type === 'tesla_coil' || b.type === 'flame_tower';
    return sum + (isDefense ? healthRatio * 3 : healthRatio);
  }, 0);

  const offensivePower = combatUnits.reduce((sum, u) => {
    const healthRatio = u.health / u.maxHealth;
    return sum + u.attack * healthRatio;
  }, 0);

  return {
    faction: player.faction,
    units: player.units.map(convertUnitToAIUnit),
    buildings: player.buildings.map(convertBuildingToAIBuilding),
    powerBalance: player.power,
    defenseLevel,
    offensivePower,
  };
}

export function convertMapToAIGameMap(
  map: GameMapData,
  aiPlayer: Player,
  enemyPlayer: Player
): AIGameMap {
  const aiCommand = aiPlayer.buildings.find(b => b.type === 'command' && b.isConstructed);
  const enemyCommand = enemyPlayer.buildings.find(b => b.type === 'command' && b.isConstructed);

  const resourceNodes: AIResourceNode[] = map.resourceNodes
    .filter(r => r.amount > 0)
    .map(r => ({
      id: r.id,
      position: { x: r.position.x * GAME_CONFIG.TILE_SIZE, y: r.position.y * GAME_CONFIG.TILE_SIZE },
      type: r.resourceType || 'ore',
      amount: r.amount,
    }));

  return {
    width: map.width * GAME_CONFIG.TILE_SIZE,
    height: map.height * GAME_CONFIG.TILE_SIZE,
    resourceNodes,
    enemyBaseLocation: enemyCommand ? { ...enemyCommand.position } : undefined,
    friendlyBaseLocation: aiCommand ? { ...aiCommand.position } : undefined,
  };
}

export function buildAIResources(player: Player): AIResources {
  return {
    money: player.money,
    power: player.power,
    ore: player.units
      .filter(u => u.data.canHarvest)
      .reduce((sum, u) => sum + u.cargo, 0),
  };
}

export function buildAIObjectives(
  aiPlayer: Player,
  enemyPlayer: Player,
  map: GameMapData
): AIObjective[] {
  const objectives: AIObjective[] = [];

  objectives.push({
    id: 'destroy_enemy_base',
    type: 'primary',
    priority: 10,
    status: enemyPlayer.buildings.some(b => b.type === 'command' && b.isConstructed)
      ? 'in_progress'
      : 'completed',
    location: map.resourceNodes.length > 0
      ? { x: map.resourceNodes[0].position.x * GAME_CONFIG.TILE_SIZE, y: map.resourceNodes[0].position.y * GAME_CONFIG.TILE_SIZE }
      : undefined,
  });

  const harvesters = aiPlayer.units.filter(u => u.data.canHarvest);
  objectives.push({
    id: 'gather_resources',
    type: 'primary',
    priority: 8,
    status: harvesters.some(h => h.state === UnitState.HARVESTING || h.state === UnitState.RETURNING)
      ? 'in_progress'
      : 'pending',
  });

  const damagedBuildings = aiPlayer.buildings.filter(
    b => b.isConstructed && b.health < b.maxHealth * 0.7
  );
  if (damagedBuildings.length > 0) {
    objectives.push({
      id: 'repair_buildings',
      type: 'secondary',
      priority: 5,
      status: 'pending',
      targetId: damagedBuildings[0].id,
      location: { ...damagedBuildings[0].position },
    });
  }

  if (aiPlayer.power < 0) {
    objectives.push({
      id: 'build_power',
      type: 'secondary',
      priority: 7,
      status: 'pending',
    });
  }

  return objectives;
}

export function buildAIContext(
  aiPlayer: Player,
  enemyPlayer: Player,
  map: GameMapData,
  gameTime: number,
  difficulty: Difficulty
): AIContext {
  const aiPlayerState = convertPlayerToAIPlayerState(aiPlayer);
  const enemyPlayerState = convertPlayerToAIPlayerState(enemyPlayer);
  const gameMap = convertMapToAIGameMap(map, aiPlayer, enemyPlayer);
  const resources = buildAIResources(aiPlayer);
  const objectives = buildAIObjectives(aiPlayer, enemyPlayer, map);

  const tempContext: AIContext = {
    aiPlayer: aiPlayerState,
    enemyPlayer: enemyPlayerState,
    gameMap,
    resources,
    objectives,
    currentTime: gameTime,
    difficulty: mapDifficultyToAI(difficulty),
    threatLevel: 'none',
  };

  tempContext.threatLevel = calculateThreatLevel(tempContext);

  return tempContext;
}
