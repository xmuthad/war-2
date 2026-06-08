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
      store.moveUnit(unitId, position);
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
      store.sellBuildingForPlayer(store.aiPlayers[0]?.id || '', buildingId);
    },
  };
}
