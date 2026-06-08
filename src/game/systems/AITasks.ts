import type {
  AIContext,
  AIUnit,
  AIBuilding,
} from './AITypes';
import {
  ActionNode,
  ConditionNode,
  InverterNode,
} from './AIBehaviorTree';
import { getDistance } from './AIUtils';

export type {
  AIContext,
  AIUnit,
  AIBuilding,
  AIResourceNode,
} from './AITypes';

export {
  ActionNode,
  SequenceNode,
  SelectorNode,
  ConditionNode,
  InverterNode,
} from './AIBehaviorTree';

export interface AITaskResult {
  success: boolean;
  action?: AIAction;
  target?: string;
  position?: { x: number; y: number };
  message?: string;
}

export interface AIAction {
  type: AIActionType;
  unitId?: string;
  buildingId?: string;
  targetId?: string;
  position?: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  priority: number;
  upgradeType?: import('../../types').UpgradeType;
  unitType?: import('../../types').UnitType;
  infantryId?: string;
  transportId?: string;
}

export type AIActionType =
  | 'move'
  | 'attack'
  | 'harvest'
  | 'return'
  | 'build'
  | 'repair'
  | 'patrol'
  | 'defend'
  | 'retreat'
  | 'produce'
  | 'upgrade'
  | 'scatter'
  | 'rally'
  | 'capture'
  | 'research'
  | 'loadTransport'
  | 'unloadTransport'
  | 'activateSuperweapon'
  | 'activateChronosphere'
  | 'chronoShift'
  | 'sellBuilding';

export const createConditionCheck = (
  id: string,
  name: string,
  condition: (context: AIContext) => boolean
): ConditionNode => {
  return new ConditionNode(id, name, condition);
};

export const createInverter = (
  id: string,
  name: string,
  child: ConditionNode | ActionNode
): InverterNode => {
  return new InverterNode(id, name, child);
};

export function prioritizeTargets(context: AIContext): AIUnit[] {
  return context.enemyPlayer.units
    .filter(u => u.health > 0)
    .sort((a, b) => {
      const aThreat = calculateUnitThreat(a, context);
      const bThreat = calculateUnitThreat(b, context);
      return bThreat - aThreat;
    });
}

function calculateUnitThreat(unit: AIUnit, context: AIContext): number {
  let threat = unit.health / unit.maxHealth;

  const baseThreats: Record<string, number> = {
    soldier: 1,
    rocket: 3,
    tank: 5,
    helicopter: 4,
    miner: 1,
    engineer: 1
  };

  threat *= baseThreats[unit.type] || 1;

  const distanceToBase = context.gameMap.friendlyBaseLocation
    ? getDistance(unit.position, context.gameMap.friendlyBaseLocation)
    : Infinity;

  if (distanceToBase < 300) {
    threat *= 2;
  }

  return threat;
}

export function findDefensivePosition(
  context: AIContext,
  targetPosition: { x: number; y: number }
): { x: number; y: number } {
  const buildings = context.aiPlayer.buildings.filter(b => b.isConstructed);
  
  if (buildings.length === 0) {
    return targetPosition;
  }

  let bestPosition = targetPosition;
  let maxCover = 0;

  for (let dx = -100; dx <= 100; dx += 50) {
    for (let dy = -100; dy <= 100; dy += 50) {
      const pos = { x: targetPosition.x + dx, y: targetPosition.y + dy };
      const cover = countNearbyBuildings(pos, buildings);
      const distance = getDistance(pos, targetPosition);

      if (cover > maxCover || (cover === maxCover && distance < getDistance(bestPosition, targetPosition))) {
        maxCover = cover;
        bestPosition = pos;
      }
    }
  }

  return bestPosition;
}

function countNearbyBuildings(
  position: { x: number; y: number },
  buildings: AIBuilding[]
): number {
  return buildings.filter(b => getDistance(position, b.position) < 150).length;
}

export function shouldRetreat(unit: AIUnit, context: AIContext): boolean {
  const healthPercent = unit.health / unit.maxHealth;
  const nearbyEnemies = context.enemyPlayer.units.filter(e => 
    getDistance(unit.position, e.position) < 200
  );

  const enemyPower = nearbyEnemies.reduce((sum, e) => sum + e.attack, 0);

  if (healthPercent < 0.3) return true;
  if (healthPercent < 0.5 && enemyPower > unit.attack * 2) return true;

  return false;
}
