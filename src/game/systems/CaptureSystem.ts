import { Player, UnitState, Building } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

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
  private readonly CAPTURE_TIME = 3; // seconds to capture
  private captureProgress: Map<string, { buildingId: string; progress: number }> = new Map();

  update(player: Player, allPlayers: Player[], neutralBuildings: Building[], deltaTime: number, onCapture: (event: CaptureEvent) => void): void {
    const engineers = player.units.filter(u =>
      u.data.canCapture && (u.state === UnitState.IDLE || u.state === UnitState.CAPTURING)
    );

    for (const engineer of engineers) {
      let targetBuilding: Building | null = null;
      let targetOwnerId: string = 'neutral';

      // Check neutral buildings
      for (const neutralBuilding of neutralBuildings) {
        if (!neutralBuilding.isConstructed) continue;
        const distance = getDistance(engineer.position, {
          x: neutralBuilding.position.x + (neutralBuilding.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2,
          y: neutralBuilding.position.y + (neutralBuilding.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2,
        });
        if (distance < this.CAPTURE_RANGE) {
          targetBuilding = neutralBuilding;
          targetOwnerId = 'neutral';
          break;
        }
      }

      // Check enemy player buildings (skip allies on the same team)
      if (!targetBuilding) {
        for (const otherPlayer of allPlayers) {
          if (otherPlayer.id === player.id) continue;
          if (player.teamId !== undefined && otherPlayer.teamId === player.teamId) continue;

          const found = otherPlayer.buildings.find(b =>
            b.isConstructed && getDistance(engineer.position, {
              x: b.position.x + (b.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2,
              y: b.position.y + (b.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2,
            }) < this.CAPTURE_RANGE
          );

          if (found) {
            targetBuilding = found;
            targetOwnerId = otherPlayer.id;
            break;
          }
        }
      }

      if (targetBuilding) {
        // Start or continue capturing
        engineer.state = UnitState.CAPTURING;
        const progress = this.captureProgress.get(engineer.id);
        if (progress && progress.buildingId === targetBuilding.id) {
          progress.progress += deltaTime;
          if (progress.progress >= this.CAPTURE_TIME) {
            // Check if building was already captured by another engineer
            const currentOwner = allPlayers.find(p => p.buildings.some(b => b.id === targetBuilding.id));
            if (currentOwner && currentOwner.id === player.id) {
              // Already captured by our team - reset progress
              this.captureProgress.delete(engineer.id);
              engineer.state = UnitState.IDLE;
            } else {
              onCapture({
                engineerId: engineer.id,
                buildingId: targetBuilding.id,
                oldOwnerId: targetOwnerId,
                newOwnerId: player.id,
              });
              this.captureProgress.delete(engineer.id);
              engineer.state = UnitState.IDLE;
            }
          }
        } else {
          // New target or target changed
          this.captureProgress.set(engineer.id, { buildingId: targetBuilding.id, progress: 0 });
        }
      } else {
        // No target in range - reset capture progress
        if (this.captureProgress.has(engineer.id)) {
          this.captureProgress.delete(engineer.id);
        }
        if (engineer.state === UnitState.CAPTURING) {
          engineer.state = UnitState.IDLE;
        }
      }
    }
  }

  /** Reset all capture progress (called on game reset) */
  reset(): void {
    this.captureProgress.clear();
  }

  /** Get capture progress for an engineer (0-1) */
  getCaptureProgress(engineerId: string): number {
    const progress = this.captureProgress.get(engineerId);
    if (!progress) return 0;
    return Math.min(1, progress.progress / this.CAPTURE_TIME);
  }

  /** Get all active capture targets mapped by building ID with their progress */
  getActiveCaptures(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [, value] of this.captureProgress) {
      const existing = result.get(value.buildingId);
      const progress = Math.min(1, value.progress / this.CAPTURE_TIME);
      if (existing === undefined || progress > existing) {
        result.set(value.buildingId, progress);
      }
    }
    return result;
  }
}

export const captureSystem = new CaptureSystem();