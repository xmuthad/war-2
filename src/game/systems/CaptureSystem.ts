import { Player, UnitState, Building } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface CaptureEvent {
  engineerId: string;
  buildingId: string;
  oldOwnerId: string;
  newOwnerId: string;
}

export class CaptureSystem {
  private readonly CAPTURE_RANGE = GAME_CONFIG.TILE_SIZE * 2;

  update(player: Player, allPlayers: Player[], neutralBuildings: Building[], onCapture: (event: CaptureEvent) => void): void {
    const engineers = player.units.filter(u =>
      u.data.canCapture && u.state === UnitState.IDLE
    );

    for (const engineer of engineers) {
      // Check neutral buildings
      for (const neutralBuilding of neutralBuildings) {
        if (!neutralBuilding.isConstructed) continue;
        const distance = getDistance(engineer.position, {
          x: neutralBuilding.position.x + (neutralBuilding.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2,
          y: neutralBuilding.position.y + (neutralBuilding.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2,
        });
        if (distance < this.CAPTURE_RANGE) {
          onCapture({
            engineerId: engineer.id,
            buildingId: neutralBuilding.id,
            oldOwnerId: 'neutral',
            newOwnerId: player.id,
          });
          break;
        }
      }

      // Check enemy player buildings
      for (const otherPlayer of allPlayers) {
        if (otherPlayer.id === player.id) continue;

        const targetBuilding = otherPlayer.buildings.find(b =>
          b.isConstructed && getDistance(engineer.position, {
            x: b.position.x + (b.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2,
            y: b.position.y + (b.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2,
          }) < this.CAPTURE_RANGE
        );

        if (targetBuilding) {
          onCapture({
            engineerId: engineer.id,
            buildingId: targetBuilding.id,
            oldOwnerId: otherPlayer.id,
            newOwnerId: player.id,
          });
          break;
        }
      }
    }
  }
}

export const captureSystem = new CaptureSystem();