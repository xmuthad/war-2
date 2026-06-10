import { GameCommands } from './AIController';
import { useGameStore } from '../../store/gameStore';
import { UnitType, BuildingType, Vector2, Faction, UnitState, UpgradeType } from '../../types';
import { UNITS_BY_FACTION } from './AIUnitLookup';
import { BUILDINGS_BY_FACTION } from './AIUnitLookup';

function getStore() {
  return useGameStore.getState();
}

function findAIPlayerByFaction(faction: Faction) {
  const store = getStore();
  return store.aiPlayers.find(p => p.faction === faction) || null;
}

function findNearestRefineryPosition(unitId: string): Vector2 | null {
  const store = getStore();
  const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean);
  let unit = null;
  let unitFaction: Faction | null = null;

  for (const player of allPlayers) {
    const u = player.units.find(u => u.id === unitId);
    if (u) {
      unit = u;
      unitFaction = player.faction as Faction;
      break;
    }
  }

  if (!unit || !unitFaction) return null;

  const aiPlayer = findAIPlayerByFaction(unitFaction);
  const buildings = aiPlayer
    ? aiPlayer.buildings
    : store.currentPlayer?.buildings || [];

  let nearest: Vector2 | null = null;
  let minDist = Infinity;

  for (const b of buildings) {
    if (b.type === BuildingType.REFINERY && b.isConstructed && b.isPowered) {
      const dx = b.position.x - unit.position.x;
      const dy = b.position.y - unit.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = b.position;
      }
    }
  }

  return nearest;
}

// === Smart Build Order System ===

export type BuildOrderPhase = 'early' | 'mid' | 'late';
export type BuildOrderVariation = 'rush' | 'turtle' | 'tech' | 'standard';

interface BuildOrderStep {
  buildingType: BuildingType;
  condition?: (buildings: Array<{ type: string; isConstructed: boolean }>) => boolean;
}

/** Get the current game phase based on game time in seconds */
export function getGamePhase(gameTimeSec: number): BuildOrderPhase {
  if (gameTimeSec < 120) return 'early';
  if (gameTimeSec < 300) return 'mid';
  return 'late';
}

/** Get the standard build order for a given game phase */
export function getBuildOrderForPhase(phase: BuildOrderPhase): BuildOrderStep[] {
  switch (phase) {
    case 'early':
      // Early game (0-2min): Power → Barracks → Refinery → 2nd Miner
      return [
        { buildingType: BuildingType.POWER },
        { buildingType: BuildingType.BARRACKS },
        { buildingType: BuildingType.REFINERY },
        // 2nd miner is a unit, not a building - handled by AIBrain
      ];
    case 'mid':
      // Mid game (2-5min): War Factory → Radar → More Miners → Defense
      return [
        { buildingType: BuildingType.WARFACTORY, condition: (b) => b.some(x => x.type === BuildingType.REFINERY && x.isConstructed) },
        { buildingType: BuildingType.RADAR, condition: (b) => b.some(x => x.type === BuildingType.WARFACTORY && x.isConstructed) },
        { buildingType: BuildingType.REFINERY, condition: (b) => b.filter(x => x.type === BuildingType.REFINERY && x.isConstructed).length < 2 },
        { buildingType: BuildingType.TURRET, condition: (b) => b.filter(x => [BuildingType.TURRET, BuildingType.TESLA_COIL, BuildingType.FLAME_TOWER, BuildingType.DEFENSE].includes(x.type as BuildingType) && x.isConstructed).length < 2 },
      ];
    case 'late':
      // Late game (5min+): Tech → Superweapons → Advanced Units
      return [
        { buildingType: BuildingType.TECH, condition: (b) => b.some(x => x.type === BuildingType.RADAR && x.isConstructed) && !b.some(x => x.type === BuildingType.TECH && x.isConstructed) },
        { buildingType: BuildingType.REFINERY, condition: (b) => b.filter(x => x.type === BuildingType.REFINERY && x.isConstructed).length < 3 },
        { buildingType: BuildingType.REPAIR, condition: (b) => !b.some(x => x.type === BuildingType.REPAIR && x.isConstructed) },
        { buildingType: BuildingType.POWER, condition: () => true },
      ];
  }
}

/** Get build order variation for HARD/BRUTAL difficulty */
export function getBuildOrderVariation(variation: BuildOrderVariation): BuildOrderStep[] {
  switch (variation) {
    case 'rush':
      // Rush: fast barracks, skip refinery, go straight for war factory
      return [
        { buildingType: BuildingType.POWER },
        { buildingType: BuildingType.BARRACKS },
        { buildingType: BuildingType.BARRACKS, condition: (b) => b.filter(x => x.type === BuildingType.BARRACKS && x.isConstructed).length < 2 },
        { buildingType: BuildingType.REFINERY },
        { buildingType: BuildingType.WARFACTORY, condition: (b) => b.some(x => x.type === BuildingType.REFINERY && x.isConstructed) },
      ];
    case 'turtle':
      // Turtle: heavy defense, multiple power, slow tech
      return [
        { buildingType: BuildingType.POWER },
        { buildingType: BuildingType.POWER, condition: (b) => b.filter(x => x.type === BuildingType.POWER).length < 2 },
        { buildingType: BuildingType.BARRACKS },
        { buildingType: BuildingType.REFINERY },
        { buildingType: BuildingType.TURRET, condition: (b) => b.some(x => x.type === BuildingType.BARRACKS && x.isConstructed) },
        { buildingType: BuildingType.REFINERY, condition: (b) => b.filter(x => x.type === BuildingType.REFINERY && x.isConstructed).length < 2 },
        { buildingType: BuildingType.WARFACTORY, condition: (b) => b.some(x => x.type === BuildingType.REFINERY && x.isConstructed) },
        { buildingType: BuildingType.TESLA_COIL, condition: (b) => b.some(x => x.type === BuildingType.WARFACTORY && x.isConstructed) },
      ];
    case 'tech':
      // Tech rush: minimal military, fast tech center
      return [
        { buildingType: BuildingType.POWER },
        { buildingType: BuildingType.BARRACKS },
        { buildingType: BuildingType.REFINERY },
        { buildingType: BuildingType.WARFACTORY, condition: (b) => b.some(x => x.type === BuildingType.REFINERY && x.isConstructed) },
        { buildingType: BuildingType.RADAR, condition: (b) => b.some(x => x.type === BuildingType.WARFACTORY && x.isConstructed) },
        { buildingType: BuildingType.TECH, condition: (b) => b.some(x => x.type === BuildingType.RADAR && x.isConstructed) },
      ];
    case 'standard':
    default:
      return getBuildOrderForPhase('early');
  }
}

/** Counter-building logic: detect enemy composition and return recommended unit types */
export function getCounterBuildUnits(enemyUnits: Array<{ type: string; isAirborne?: boolean; isInfantry?: boolean }>): UnitType[] {
  const counters: UnitType[] = [];

  const enemyAirCount = enemyUnits.filter(u => u.isAirborne).length;
  const enemyInfantryCount = enemyUnits.filter(u => u.isInfantry).length;
  const enemyTankCount = enemyUnits.filter(u =>
    !u.isAirborne && !u.isInfantry &&
    [UnitType.TANK, UnitType.RHINO, UnitType.APOCALYPSE, UnitType.PRISM, UnitType.GUARDIAN, UnitType.GRIZZLY, UnitType.LASH].includes(u.type as UnitType)
  ).length;

  // Counter air units with anti-air
  if (enemyAirCount >= 2) {
    counters.push(UnitType.ROCKET);
    counters.push(UnitType.FLAKINFANTRY);
    counters.push(UnitType.FLAK);
  }

  // Counter tanks with anti-tank (rocket infantry, tesla, prism)
  if (enemyTankCount >= 3) {
    counters.push(UnitType.ROCKET);
    counters.push(UnitType.TESLA);
    counters.push(UnitType.PRISM);
  }

  // Counter infantry with anti-infantry
  if (enemyInfantryCount >= 4) {
    counters.push(UnitType.SNIPER);
    counters.push(UnitType.GATTLING_TANK);
  }

  return counters;
}

/** Get the next recommended building from the smart build order */
export function getNextBuildOrderBuilding(
  faction: Faction,
  gameTimeSec: number,
  difficulty: 'easy' | 'normal' | 'hard' | 'brutal',
  existingBuildings: Array<{ type: string; isConstructed: boolean }>
): BuildingType | null {
  // For HARD/BRUTAL, pick a build order variation
  if (difficulty === 'hard' || difficulty === 'brutal') {
    const variations: BuildOrderVariation[] = ['rush', 'turtle', 'tech'];
    // Deterministic selection based on game time to avoid randomness
    const variationIndex = Math.floor(gameTimeSec / 120) % variations.length;
    const variation = variations[variationIndex];
    const order = getBuildOrderVariation(variation);

    for (const step of order) {
      const alreadyHas = existingBuildings.some(b => b.type === step.buildingType && b.isConstructed);
      if (!alreadyHas) {
        if (!step.condition || step.condition(existingBuildings)) {
          return step.buildingType;
        }
      }
    }
  }

  // Standard: use phase-based build order
  const phase = getGamePhase(gameTimeSec);
  const order = getBuildOrderForPhase(phase);

  for (const step of order) {
    const alreadyHas = existingBuildings.some(b => b.type === step.buildingType && b.isConstructed);
    if (!alreadyHas) {
      if (!step.condition || step.condition(existingBuildings)) {
        return step.buildingType;
      }
    }
  }

  return null;
}

export function createGameCommands(faction: Faction): GameCommands {
  return {
    moveUnit(unitId: string, position: Vector2): void {
      const store = getStore();
      store.moveUnit(unitId, position);
    },

    attackUnit(unitId: string, targetId: string): void {
      const store = getStore();
      store.attackUnit(unitId, targetId);
    },

    harvestResource(unitId: string, resourceId: string): void {
      const store = getStore();
      store.harvestResource(unitId, resourceId);
    },

    returnToBase(unitId: string): void {
      const refineryPos = findNearestRefineryPosition(unitId);
      if (!refineryPos) return;

      const store = getStore();
      store.setUnitWaypoints(unitId, [refineryPos], UnitState.RETURNING);
    },

    buildStructure(buildingType: string, position: Vector2): void {
      const aiPlayer = findAIPlayerByFaction(faction);
      if (!aiPlayer) return;

      // Pre-check affordability before calling store
      const factionBuildings = BUILDINGS_BY_FACTION[faction] || {};
      const buildingData = factionBuildings[buildingType as BuildingType] as { cost?: number } | undefined;
      if (buildingData && buildingData.cost && aiPlayer.money < buildingData.cost) return;

      const store = getStore();
      store.buildStructureForPlayer(aiPlayer.id, buildingType as BuildingType, position);
    },

    repairBuilding(buildingId: string): void {
      const store = getStore();
      const owner = store.findBuildingOwner(buildingId);
      if (!owner) return;

      store.repairBuildingForPlayer(owner.id, buildingId);
    },

    patrolUnit(unitId: string, position: Vector2): void {
      const store = getStore();
      const owner = store.findUnitOwner(unitId);
      if (!owner) return;

      const unit = owner.units.find(u => u.id === unitId);
      if (!unit) return;

      store.setUnitWaypoints(unitId, [position, { ...unit.position }], UnitState.PATROLLING);
    },

    defendPosition(unitId: string, position: Vector2): void {
      const store = getStore();
      store.setUnitWaypoints(unitId, [position], UnitState.GUARDING);
    },

    retreatUnit(unitId: string, position: Vector2): void {
      const store = getStore();
      store.setUnitWaypoints(unitId, [position], UnitState.RETREATING);
    },

    produceUnit(buildingId: string, unitType?: UnitType): void {
      const store = getStore();
      const owner = store.findBuildingOwner(buildingId);
      if (!owner) return;

      const building = owner.buildings.find(b => b.id === buildingId);
      if (!building || building.productionQueue.length >= 3) return;

      const factionUnits = UNITS_BY_FACTION[owner.faction as Faction] || {};

      // If a specific unit type was requested, use it directly
      let selectedType: UnitType | null = unitType || null;

      // Validate that the building can produce this unit type
      if (selectedType) {
        if (!building.canProduce.includes(selectedType)) {
          selectedType = null;
        }
        // Check if the faction has data for this unit
        if (selectedType && !factionUnits[selectedType]) {
          selectedType = null;
        }
        // Check upgrade requirements
        if (selectedType) {
          const UNIT_UPGRADE_REQUIREMENTS: Partial<Record<UnitType, UpgradeType>> = {
            [UnitType.PRISM]: UpgradeType.PRISM_TECH,
            [UnitType.TESLA]: UpgradeType.TESLA_WEAPONS,
            [UnitType.DESPOT]: UpgradeType.ELITE_FORCES,
            [UnitType.CHRONO]: UpgradeType.CHRONO_TECH,
          };
          const requiredUpgrade = UNIT_UPGRADE_REQUIREMENTS[selectedType];
          if (requiredUpgrade && !owner.researchedUpgrades.includes(requiredUpgrade)) {
            selectedType = null;
          }
        }
        // Check if AI can afford it
        if (selectedType) {
          const unitData = factionUnits[selectedType];
          if (!unitData || owner.money < (unitData as { cost: number }).cost) {
            selectedType = null;
          }
        }
      }

      // Fallback: pick randomly from available types
      if (!selectedType) {
        const availableTypes = building.canProduce.filter(
          t => factionUnits[t as UnitType]
        ) as UnitType[];

        if (availableTypes.length === 0) return;

        selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      }

      const unitData = factionUnits[selectedType];

      if (!unitData || owner.money < (unitData as { cost: number }).cost) return;

      store.produceUnitForPlayer(owner.id, buildingId, selectedType);
    },

    scatterUnit(unitId: string, position: Vector2): void {
      const scatterAngle = Math.random() * Math.PI * 2;
      const scatterDist = 100 + Math.random() * 100;
      const store = getStore();
      const map = store.map;
      const mapW = map ? map.width * 64 : Infinity;
      const mapH = map ? map.height * 64 : Infinity;
      const newPos = {
        x: Math.max(0, Math.min(mapW - 64, position.x + Math.cos(scatterAngle) * scatterDist)),
        y: Math.max(0, Math.min(mapH - 64, position.y + Math.sin(scatterAngle) * scatterDist)),
      };

      store.moveUnit(unitId, newPos);
    },

    setRallyPoint(buildingId: string, position: Vector2): void {
      const store = getStore();
      const owner = store.findBuildingOwner(buildingId);
      if (!owner) return;

      store.setRallyPointForPlayer(owner.id, buildingId, position);
    },

    upgradeBuilding(buildingId: string): void {
      const store = getStore();
      const owner = store.findBuildingOwner(buildingId);
      if (!owner) return;

      store.upgradeBuildingForPlayer(owner.id, buildingId);
    },

    captureBuilding(unitId: string, buildingId: string): void {
      const store = getStore();
      store.captureBuilding(unitId, buildingId);
    },

    researchUpgrade(upgradeType: UpgradeType): void {
      const aiPlayer = findAIPlayerByFaction(faction);
      if (!aiPlayer) return;

      const store = getStore();
      store.researchUpgradeForPlayer(aiPlayer.id, upgradeType);
    },

    loadIntoTransport(infantryId: string, transportId: string): void {
      const store = getStore();
      store.loadIntoTransport(infantryId, transportId);
    },

    unloadFromTransport: (transportId: string, position?: Vector2): void => {
      const store = getStore();
      store.unloadFromTransport(transportId, position);
    },

    activateSuperweapon: (buildingId: string, position: Vector2): void => {
      const store = getStore();
      const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean);
      for (const player of allPlayers) {
        const building = player.buildings.find(b => b.id === buildingId);
        if (!building) continue;

        if (building.type === BuildingType.NUCLEAR_SILO) {
          store.activateNuclearSilo(buildingId, position);
        } else if (building.type === BuildingType.IRON_CURTAIN) {
          store.activateIronCurtain(buildingId, position);
        }
        break;
      }
    },

    activateChronosphere: (buildingId: string, sourcePosition: Vector2, targetPosition: Vector2): void => {
      const store = getStore();
      store.activateChronosphere(buildingId, sourcePosition, targetPosition);
    },

    chronoShiftUnit: (unitId: string, targetPosition: Vector2): void => {
      const store = getStore();
      const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean);
      for (const player of allPlayers) {
        const unit = player.units.find(u => u.id === unitId);
        if (unit && !unit.isChronoShifting && !unit.isChronoCooldown) {
          unit.chronoShiftTarget = { ...targetPosition };
          unit.chronoShiftTimer = 2.0;
          unit.isChronoShifting = true;
          break;
        }
      }
    },

    sellBuilding: (buildingId: string): void => {
      const store = getStore();
      const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean);
      const owner = allPlayers.find(p => p.buildings.some(b => b.id === buildingId));
      if (owner) {
        store.sellBuildingForPlayer(owner.id, buildingId);
      }
    },
  };
}
