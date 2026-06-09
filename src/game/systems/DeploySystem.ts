import type { Player, Unit, Building, UnitState, BuildingType, Vector2, GameMapData } from '../../types';
import { UnitState as UnitStateEnum, BuildingType as BuildingTypeEnum } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from './GameEventBus';

export class DeploySystem {
  readonly DEPLOY_RANGE = 16;
  readonly DEFAULT_DEPLOY_TIME = 10;

  update(
    player: Player,
    allPlayers: Player[],
    deltaTime: number,
    onDeployComplete: (buildingData: { type: BuildingType; faction: Player['faction']; position: Vector2; unitId: string }) => void,
  ): void {
    const deployingUnits = player.units.filter(u => u.isDeploying);

    for (const unit of deployingUnits) {
      unit.deployTimer = (unit.deployTimer ?? this.DEFAULT_DEPLOY_TIME) - deltaTime;

      if (unit.deployTimer! <= 0) {
        const deployBuildingType = unit.data.deployBuildingType ?? unit.deployBuildingType;
        if (!deployBuildingType) continue;

        const buildingPosition: Vector2 = { x: unit.position.x, y: unit.position.y };

        // Remove the unit from player's units
        const unitIndex = player.units.indexOf(unit);
        if (unitIndex !== -1) {
          player.units.splice(unitIndex, 1);
        }

        // Create new building data and notify via callback
        const newBuildingData = {
          type: deployBuildingType,
          faction: unit.faction,
          position: buildingPosition,
          unitId: unit.id,
        };
        onDeployComplete(newBuildingData);

        // Emit events
        gameEventBus.emit('unit:deployed', {
          unitId: unit.id,
          unitType: unit.type,
          buildingType: deployBuildingType,
          position: buildingPosition,
          faction: unit.faction,
        });

        gameEventBus.emit('building:constructed', {
          buildingType: deployBuildingType,
          position: buildingPosition,
          faction: unit.faction,
        });
      }
    }
  }

  startDeploy(unitId: string, player: Player): boolean {
    const unit = player.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Check unit can deploy
    if (!unit.data.canDeploy && !unit.canDeploy) return false;

    // Check unit is not moving
    if (unit.state !== UnitStateEnum.IDLE && unit.state !== UnitStateEnum.GUARDING) return false;

    unit.isDeploying = true;
    unit.deployTimer = unit.data.deployTime ?? this.DEFAULT_DEPLOY_TIME;
    unit.state = UnitStateEnum.DEPLOYING;

    gameEventBus.emit('unit:deployStart', {
      unitId: unit.id,
      unitType: unit.type,
      deployTime: unit.deployTimer,
      position: unit.position,
    });

    return true;
  }

  cancelDeploy(unitId: string, player: Player): boolean {
    const unit = player.units.find(u => u.id === unitId);
    if (!unit || !unit.isDeploying) return false;

    unit.isDeploying = false;
    unit.deployTimer = 0;
    unit.state = UnitStateEnum.IDLE;

    return true;
  }

  canDeployAt(unit: Unit, position: Vector2, map: GameMapData): boolean {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const deployBuildingType = unit.data.deployBuildingType ?? unit.deployBuildingType;
    if (!deployBuildingType) return false;

    // Determine building footprint — default 2x2 if unknown
    const buildingWidth = 2;
    const buildingHeight = 2;

    // Convert pixel position to tile coordinates
    const startTileX = Math.floor(position.x / tileSize);
    const startTileY = Math.floor(position.y / tileSize);

    // Check terrain is buildable for the entire building footprint
    for (let dy = 0; dy < buildingHeight; dy++) {
      for (let dx = 0; dx < buildingWidth; dx++) {
        const tileX = startTileX + dx;
        const tileY = startTileY + dy;

        if (tileY < 0 || tileY >= map.height || tileX < 0 || tileX >= map.width) return false;

        const tile = map.tiles[tileY]?.[tileX];
        if (!tile || !tile.buildable) return false;
      }
    }

    // Check no other buildings overlap
    const buildingPixelWidth = buildingWidth * tileSize;
    const buildingPixelHeight = buildingHeight * tileSize;

    for (const player of [] as Player[]) {
      for (const building of player.buildings) {
        const bWidth = building.width * tileSize;
        const bHeight = building.height * tileSize;

        const overlaps =
          position.x < building.position.x + bWidth &&
          position.x + buildingPixelWidth > building.position.x &&
          position.y < building.position.y + bHeight &&
          position.y + buildingPixelHeight > building.position.y;

        if (overlaps) return false;
      }
    }

    // For MCV → COMMAND, check building would be adjacent to existing buildings
    if (deployBuildingType === BuildingTypeEnum.COMMAND) {
      // MCV first deploy: no adjacency requirement (it's the first building)
      // This check is only meaningful if the player already has buildings
      // For initial MCV deploy, adjacency is not required
    }

    return true;
  }

  getDeployProgress(unitId: string, player: Player): number {
    const unit = player.units.find(u => u.id === unitId);
    if (!unit || !unit.isDeploying) return 0;

    const totalTime = unit.data.deployTime ?? this.DEFAULT_DEPLOY_TIME;
    const remaining = unit.deployTimer ?? 0;

    return Math.max(0, Math.min(1, 1 - remaining / totalTime));
  }
}

export const deploySystem = new DeploySystem();
