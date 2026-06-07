import type { Player, VictoryCondition, Vector2, BuildingType } from '../../types';
import { VictoryConditionType, BuildingType as BT } from '../../types';

export interface VictoryResult {
  playerDefeated: boolean;
  allEnemiesDefeated: boolean;
  defeatedAiIds: string[];
  victoryConditionMet?: VictoryConditionType;
  surrenderAvailable?: boolean;
  drawAvailable?: boolean;
}

export class VictoryConditionSystem {
  private conditions: VictoryCondition[] = [];
  private gameTime: number = 0;
  private capturedTargetBuildings: Set<string> = new Set(); // Track captured target buildings

  setConditions(conditions: VictoryCondition[]): void {
    this.conditions = conditions;
  }

  getConditions(): VictoryCondition[] {
    return this.conditions;
  }

  setGameTime(time: number): void {
    this.gameTime = time;
  }

  check(currentPlayer: Player, aiPlayers: Player[]): VictoryResult {
    const result: VictoryResult = {
      playerDefeated: false,
      allEnemiesDefeated: false,
      defeatedAiIds: [],
      surrenderAvailable: false,
      drawAvailable: false,
    };

    // Check player defeat - player loses when ALL buildings are destroyed
    const hasAnyBuilding = currentPlayer.buildings.some(b => b.isConstructed);
    if (!hasAnyBuilding) {
      result.playerDefeated = true;
      return result;
    }

    // Check AI defeat
    const defeatedAiIds: string[] = [];
    for (const ai of aiPlayers) {
      if (ai.isDefeated) continue;
      const aiHasAnyBuilding = ai.buildings.some(b => b.isConstructed);
      if (!aiHasAnyBuilding) {
        defeatedAiIds.push(ai.id);
      }
    }
    result.defeatedAiIds = defeatedAiIds;

    // Check if all active enemies are defeated
    const activeEnemies = aiPlayers.filter(ai => {
      if (ai.isDefeated || defeatedAiIds.includes(ai.id)) return false;
      if (ai.teamId === currentPlayer.teamId) return false;
      return true;
    });

    if (activeEnemies.length === 0 && aiPlayers.some(ai => !ai.isDefeated || defeatedAiIds.includes(ai.id))) {
      result.allEnemiesDefeated = true;
    }

    // Check custom victory conditions
    for (const condition of this.conditions) {
      const met = this.checkCondition(condition, currentPlayer, aiPlayers, activeEnemies);
      if (met) {
        result.victoryConditionMet = condition.type;
        result.allEnemiesDefeated = true; // Treat as victory
        break;
      }
    }

    // Check timed survival defeat
    for (const condition of this.conditions) {
      if (condition.type === VictoryConditionType.TIMED_SURVIVAL && condition.timeLimit) {
        if (this.gameTime >= condition.timeLimit) {
          // Player survived! This is a victory
          result.victoryConditionMet = VictoryConditionType.TIMED_SURVIVAL;
          result.allEnemiesDefeated = true;
        }
      }
    }

    // Surrender is available when player has buildings but is clearly losing
    result.surrenderAvailable = !result.playerDefeated && hasAnyBuilding;

    // Draw: if all players are defeated simultaneously (rare edge case)
    if (result.playerDefeated && activeEnemies.length === 0) {
      result.drawAvailable = true;
    }

    return result;
  }

  private checkCondition(
    condition: VictoryCondition,
    currentPlayer: Player,
    aiPlayers: Player[],
    activeEnemies: Player[]
  ): boolean {
    switch (condition.type) {
      case VictoryConditionType.ANNIHILATION:
        return activeEnemies.length === 0;

      case VictoryConditionType.COMMAND_CENTER:
        // Check if all enemy command centers are destroyed
        return activeEnemies.every(enemy =>
          !enemy.buildings.some(b => b.type === BT.COMMAND && b.isConstructed)
        );

      case VictoryConditionType.CAPTURE_BUILDING:
        // Check if player has captured the target building
        if (condition.targetResourceId) {
          return currentPlayer.buildings.some(b =>
            b.id === condition.targetResourceId && b.isConstructed
          );
        }
        if (condition.targetBuildingType) {
          return currentPlayer.buildings.some(b =>
            b.type === condition.targetBuildingType && b.isConstructed
          );
        }
        return false;

      case VictoryConditionType.ESCORT:
        // Check if the escort unit reached the target
        if (condition.escortUnitId && condition.escortTarget) {
          const escortUnit = currentPlayer.units.find(u => u.id === condition.escortUnitId);
          if (!escortUnit) return false; // Unit died - not a victory
          const dist = Math.sqrt(
            (escortUnit.position.x - condition.escortTarget.x) ** 2 +
            (escortUnit.position.y - condition.escortTarget.y) ** 2
          );
          return dist < 64; // Within 2 tiles
        }
        return false;

      case VictoryConditionType.ECONOMIC:
        // Check if player has gathered enough resources
        if (condition.resourceTarget) {
          return currentPlayer.statistics.resourcesGathered >= condition.resourceTarget;
        }
        return false;

      default:
        return false;
    }
  }

  reset(): void {
    this.conditions = [];
    this.gameTime = 0;
    this.capturedTargetBuildings.clear();
  }
}
