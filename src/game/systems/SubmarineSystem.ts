import type { Unit, Building } from '../../types';
import { UnitType, UnitState, BuildingType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

/** Submarine types that can submerge */
export const SUBMERSIBLE_TYPES = new Set<UnitType>([UnitType.SUBMARINE, UnitType.BOOMER]);

/** Detector building types that can reveal submerged submarines */
export const DETECTOR_BUILDING_TYPES = new Set<BuildingType>([BuildingType.SPY_SATELLITE, BuildingType.RADAR]);

/** Time in seconds before a non-attacking submarine auto-dives */
const AUTO_DIVE_DELAY = 3;

/** Detection ranges in tiles */
export const DOLPHIN_DETECTION_RANGE = 5;
export const SUBMARINE_MUTUAL_DETECTION_RANGE = 3;
export const DETECTOR_BUILDING_RANGE = 10;

export class SubmarineSystem {
  update(deltaTime: number, units: Unit[], _store: any): void {
    for (const unit of units) {
      if (!SUBMERSIBLE_TYPES.has(unit.type)) continue;

      if (unit.state === UnitState.ATTACKING) {
        // Surface when attacking
        if (unit.isSubmerged) {
          unit.isSubmerged = false;
          gameEventBus.emit('sound:play', { key: 'submarineSurface', position: unit.position });
        }
        unit.idleTimer = 0;
      } else {
        // Auto-dive after delay when not attacking
        unit.idleTimer = (unit.idleTimer || 0) + deltaTime;
        if (unit.idleTimer >= AUTO_DIVE_DELAY && !unit.isSubmerged) {
          unit.isSubmerged = true;
          gameEventBus.emit('sound:play', { key: 'submarineDive', position: unit.position });
        }
      }
    }
  }

  /**
   * Check if a submerged submarine is detected by friendly units/buildings.
   * Returns true if the submarine should be visible to the friendly side.
   */
  isSubmarineDetected(submarine: Unit, friendlyUnits: Unit[], friendlyBuildings: Building[]): boolean {
    if (!submarine.isSubmerged) return true;

    const subTileX = submarine.position.x / GAME_CONFIG.TILE_SIZE;
    const subTileY = submarine.position.y / GAME_CONFIG.TILE_SIZE;

    // DOLPHIN detection: within 5 tiles
    for (const unit of friendlyUnits) {
      if (unit.type === UnitType.DOLPHIN) {
        const unitTileX = unit.position.x / GAME_CONFIG.TILE_SIZE;
        const unitTileY = unit.position.y / GAME_CONFIG.TILE_SIZE;
        const dist = Math.sqrt(
          Math.pow(subTileX - unitTileX, 2) + Math.pow(subTileY - unitTileY, 2)
        );
        if (dist <= DOLPHIN_DETECTION_RANGE) return true;
      }
    }

    // Submerged submarine mutual detection: within 3 tiles
    for (const unit of friendlyUnits) {
      if (SUBMERSIBLE_TYPES.has(unit.type) && unit.isSubmerged) {
        const unitTileX = unit.position.x / GAME_CONFIG.TILE_SIZE;
        const unitTileY = unit.position.y / GAME_CONFIG.TILE_SIZE;
        const dist = Math.sqrt(
          Math.pow(subTileX - unitTileX, 2) + Math.pow(subTileY - unitTileY, 2)
        );
        if (dist <= SUBMARINE_MUTUAL_DETECTION_RANGE) return true;
      }
    }

    // Detector buildings (SPY_SATELLITE, RADAR): within 10 tiles
    for (const building of friendlyBuildings) {
      if (
        DETECTOR_BUILDING_TYPES.has(building.type as BuildingType) &&
        building.isConstructed &&
        building.isPowered
      ) {
        const bldTileX = building.position.x / GAME_CONFIG.TILE_SIZE;
        const bldTileY = building.position.y / GAME_CONFIG.TILE_SIZE;
        const dist = Math.sqrt(
          Math.pow(subTileX - bldTileX, 2) + Math.pow(subTileY - bldTileY, 2)
        );
        if (dist <= DETECTOR_BUILDING_RANGE) return true;
      }
    }

    return false;
  }
}

export const submarineSystem = new SubmarineSystem();
