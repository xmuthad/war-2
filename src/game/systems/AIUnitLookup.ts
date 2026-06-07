import { Faction, UnitType, BuildingType, UnitData, BuildingData } from '../../types';
import {
  USA_UNITS, BRITAIN_UNITS, GERMANY_UNITS, FRANCE_UNITS, KOREA_UNITS,
  SOVIET_UNITS, CUBA_UNITS, LIBYA_UNITS, IRAQ_UNITS
} from '../../game/data/units';
import {
  USA_BUILDINGS, BRITAIN_BUILDINGS, GERMANY_BUILDINGS, FRANCE_BUILDINGS, KOREA_BUILDINGS,
  SOVIET_BUILDINGS, CUBA_BUILDINGS, LIBYA_BUILDINGS, IRAQ_BUILDINGS
} from '../../game/data/buildings';

export const UNITS_BY_FACTION: Record<Faction, Partial<Record<UnitType, UnitData>>> = {
  [Faction.USA]: USA_UNITS,
  [Faction.BRITAIN]: BRITAIN_UNITS,
  [Faction.GERMANY]: GERMANY_UNITS,
  [Faction.FRANCE]: FRANCE_UNITS,
  [Faction.KOREA]: KOREA_UNITS,
  [Faction.SOVIET]: SOVIET_UNITS,
  [Faction.CUBA]: CUBA_UNITS,
  [Faction.LIBYA]: LIBYA_UNITS,
  [Faction.IRAQ]: IRAQ_UNITS,
  [Faction.NEUTRAL]: {},
};

export const BUILDINGS_BY_FACTION: Record<Faction, Partial<Record<BuildingType, BuildingData>>> = {
  [Faction.USA]: USA_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.BRITAIN]: BRITAIN_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.GERMANY]: GERMANY_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.FRANCE]: FRANCE_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.KOREA]: KOREA_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.SOVIET]: SOVIET_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.CUBA]: CUBA_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.LIBYA]: LIBYA_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.IRAQ]: IRAQ_BUILDINGS as Partial<Record<BuildingType, BuildingData>>,
  [Faction.NEUTRAL]: {},
};

export function getCheapestUnit(faction: Faction): UnitType | null {
  const units = UNITS_BY_FACTION[faction];
  if (!units) return null;

  let cheapest: UnitType | null = null;
  let minCost = Infinity;

  for (const [type, data] of Object.entries(units)) {
    if ((data as UnitData).cost < minCost) {
      minCost = (data as UnitData).cost;
      cheapest = type as UnitType;
    }
  }

  return cheapest;
}

export function getCombatUnits(faction: Faction): UnitType[] {
  const units = UNITS_BY_FACTION[faction];
  if (!units) return [];

  return Object.entries(units)
    .filter(([, data]) => (data as UnitData).canAttack !== false)
    .map(([type]) => type as UnitType);
}

export function getHarvesterUnit(faction: Faction): UnitType | null {
  const units = UNITS_BY_FACTION[faction];
  if (!units) return null;

  for (const [type, data] of Object.entries(units)) {
    if ((data as UnitData).canHarvest) {
      return type as UnitType;
    }
  }

  return null;
}

export function getProductionBuildings(faction: Faction): BuildingType[] {
  const buildings = BUILDINGS_BY_FACTION[faction];
  if (!buildings) return [];

  return Object.entries(buildings)
    .filter(([, data]) => (data as BuildingData).canProduce.length > 0)
    .map(([type]) => type as BuildingType);
}
