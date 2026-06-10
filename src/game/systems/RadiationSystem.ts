import type { Unit, Vector2, Player } from '../../types';
import { Faction, getFactionGroup } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

export interface RadiationZone {
  id: string;
  position: Vector2;
  radius: number;
  damagePerSecond: number;
  remainingTime: number;
  faction: Faction;
}

export class RadiationSystem {
  private zones: RadiationZone[] = [];
  private deployedUnitIds: Set<string> = new Set();

  deployRadiation(desolator: Unit, _store?: unknown): RadiationZone | null {
    if (this.deployedUnitIds.has(desolator.id)) return null;

    const zone: RadiationZone = {
      id: `radiation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      position: { ...desolator.position },
      radius: 4 * GAME_CONFIG.TILE_SIZE,
      damagePerSecond: 25,
      remainingTime: 30,
      faction: desolator.faction,
    };
    this.zones.push(zone);
    this.deployedUnitIds.add(desolator.id);
    desolator.isDeploying = true;

    gameEventBus.emit('sound:play', { key: 'radiationDeploy', position: desolator.position });

    gameEventBus.emit('radiation:deploy', {
      unitId: desolator.id,
      position: desolator.position,
      faction: desolator.faction,
    });

    return zone;
  }

  undeployRadiation(unitId: string): void {
    this.deployedUnitIds.delete(unitId);
  }

  createRadiationZone(position: Vector2, radius: number, damagePerSecond: number, remainingTime: number, faction: Faction): RadiationZone {
    const zone: RadiationZone = {
      id: `radiation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      position: { ...position },
      radius,
      damagePerSecond,
      remainingTime,
      faction,
    };
    this.zones.push(zone);
    return zone;
  }

  update(deltaTime: number, allPlayers: Player[]): { destroyedUnits: string[] } {
    const destroyedUnits: string[] = [];

    // Decrement zone timers, remove expired
    for (const zone of this.zones) {
      zone.remainingTime -= deltaTime;
    }
    const expiredZones = this.zones.filter(z => z.remainingTime <= 0);
    this.zones = this.zones.filter(z => z.remainingTime > 0);

    // Clean up deployed state for expired zones
    for (const zone of expiredZones) {
      // Find the desolator that created this zone and undeploy
      for (const player of allPlayers) {
        const desolator = player.units.find(u =>
          u.id === [...this.deployedUnitIds].find(id => {
            // Match by proximity - the desolator should be near the zone position
            const dx = u.position.x - zone.position.x;
            const dy = u.position.y - zone.position.y;
            return Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.TILE_SIZE;
          })
        );
        if (desolator) {
          desolator.isDeploying = false;
          this.deployedUnitIds.delete(desolator.id);
        }
      }
    }

    // Damage enemies in active zones
    for (const zone of this.zones) {
      for (const player of allPlayers) {
        // Skip friendly faction - radiation doesn't hurt allies
        if (player.faction === zone.faction) continue;

        // Check faction group alliance
        const zoneFactionGroup = getFactionGroup(zone.faction);
        const playerFactionGroup = getFactionGroup(player.faction);
        if (zoneFactionGroup === playerFactionGroup) continue;

        for (const unit of [...player.units]) {
          // Skip airborne units
          if (unit.isAirborne) continue;

          const dx = unit.position.x - zone.position.x;
          const dy = unit.position.y - zone.position.y;
          if (Math.sqrt(dx * dx + dy * dy) <= zone.radius) {
            const damage = zone.damagePerSecond * deltaTime;
            unit.health -= damage;
            if (unit.health <= 0) {
              destroyedUnits.push(unit.id);
            }
          }
        }
      }
    }

    return { destroyedUnits };
  }

  getZones(): RadiationZone[] {
    return this.zones;
  }

  restoreZones(zones: RadiationZone[]): void {
    this.zones = zones;
  }

  isDeployed(unitId: string): boolean {
    return this.deployedUnitIds.has(unitId);
  }
}

export const radiationSystem = new RadiationSystem();
