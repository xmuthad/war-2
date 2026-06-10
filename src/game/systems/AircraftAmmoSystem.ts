import type { Unit, Building, Vector2 } from '../../types';
import { UnitState, BuildingType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';

function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class AircraftAmmoSystem {
  update(deltaTime: number, units: Unit[], buildings: Building[], _store: any): void {
    for (const unit of units) {
      // Only process airborne units with maxAmmo defined
      if (!unit.isAirborne || unit.data.maxAmmo === undefined) continue;

      // Initialize ammo if undefined
      if (unit.ammo === undefined) {
        unit.ammo = unit.data.maxAmmo;
      }

      // Handle return to base and rearm
      if (unit.isReturningToBase) {
        // Find nearest friendly HELIPAD or AIRFIELD
        const rearmBuildings = buildings.filter(b =>
          b.isConstructed && (b.type === BuildingType.HELIPAD || b.type === BuildingType.AIRFIELD)
        );

        if (rearmBuildings.length === 0) {
          // No rearm facility: just go idle
          unit.state = UnitState.IDLE;
          unit.target = null;
          unit.isReturningToBase = false;
          continue;
        }

        // Find closest rearm building
        let closestBuilding = rearmBuildings[0];
        let closestDist = distance(unit.position, closestBuilding.position);
        for (let i = 1; i < rearmBuildings.length; i++) {
          const d = distance(unit.position, rearmBuildings[i].position);
          if (d < closestDist) {
            closestDist = d;
            closestBuilding = rearmBuildings[i];
          }
        }

        const rearmThreshold = GAME_CONFIG.TILE_SIZE * 1.5;

        if (closestDist <= rearmThreshold) {
          // At base: rearm gradually (maxAmmo / 3 per second = 3 seconds to fully rearm)
          const rearmRate = unit.data.maxAmmo / 3;
          unit.ammo = Math.min(unit.data.maxAmmo, unit.ammo + rearmRate * deltaTime);

          if (unit.ammo >= unit.data.maxAmmo) {
            unit.ammo = unit.data.maxAmmo;
            unit.isReturningToBase = false;
            unit.state = UnitState.IDLE;
            unit.target = null;
            unit.waypoints = [];
          }
        } else {
          // Not at base yet: set waypoints toward the building
          const lastWaypoint = unit.waypoints[unit.waypoints.length - 1];
          if (!lastWaypoint || lastWaypoint.x !== closestBuilding.position.x || lastWaypoint.y !== closestBuilding.position.y) {
            unit.waypoints = [{ x: closestBuilding.position.x, y: closestBuilding.position.y }];
          }
        }
      }
    }
  }
}
