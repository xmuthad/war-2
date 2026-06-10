import { AIBrain } from './AIBrain';
import type { AIContext } from './AITypes';
import type { ThreatLevel } from './AITypes';
import { AIAction } from './AITasks';
import { getDistance, getDifficultyConfig, calculateThreatLevel } from './AIUtils';
import { Faction, Difficulty, Vector2, UpgradeType, BuildingType } from '../../types';
import { AI_CONFIG } from '../config/AIConfig';
import { useGameStore } from '../../store/gameStore';

/** Building types that provide defensive coverage */
const DEFENSE_BUILDING_TYPES = new Set<string>([
  BuildingType.DEFENSE,
  BuildingType.TURRET,
  BuildingType.TESLA_COIL,
  BuildingType.FLAME_TOWER,
]);

export interface AIControllerConfig {
  faction: Faction;
  difficulty: Difficulty;
  personality?: AIPersonality;
}

export interface AIPersonality {
  aggressionLevel: number;
  defensiveLevel: number;
  economicLevel: number;
  scoutFrequency: number;
  expandSpeed: number;
}

export class AIController {
  private brain: AIBrain;
  private config: AIControllerConfig;
  private personality: AIPersonality;
  private lastTick: number = 0;
  private tickInterval: number;
  private isActive: boolean = false;
  private currentOrders: Map<string, AIOrder> = new Map();
  private lastResearchCheck: number = 0;
  private researchCheckInterval: number;

  /** Get game time in milliseconds (consistent with gameTime, pauses with game) */
  private getGameTimeMs(): number {
    return useGameStore.getState().gameTime * 1000;
  }

  constructor(config: AIControllerConfig) {
    this.config = config;
    this.tickInterval = this.getTickInterval(config.difficulty);
    this.researchCheckInterval = this.getResearchCheckInterval(config.difficulty);

    const difficultyConfig = getDifficultyConfig(config.difficulty as 'easy' | 'normal' | 'hard' | 'brutal');

    this.personality = config.personality || {
      aggressionLevel: difficultyConfig.aggressionLevel,
      defensiveLevel: difficultyConfig.defensiveLevel,
      economicLevel: difficultyConfig.economicLevel,
      scoutFrequency: 0.3,
      expandSpeed: 0.5
    };

    this.brain = new AIBrain({
      difficulty: config.difficulty,
      aggressionLevel: this.personality.aggressionLevel,
      defensiveLevel: this.personality.defensiveLevel,
      economicLevel: this.personality.economicLevel,
      reactionTime: difficultyConfig.reactionTime
    });
  }

  private getTickInterval(difficulty: Difficulty): number {
    switch (difficulty) {
      case 'easy': return AI_CONFIG.TICK_INTERVALS.easy;
      case 'normal': return AI_CONFIG.TICK_INTERVALS.normal;
      case 'hard': return AI_CONFIG.TICK_INTERVALS.hard;
      case 'brutal': return AI_CONFIG.TICK_INTERVALS.brutal;
    }
  }

  private getResearchCheckInterval(difficulty: Difficulty): number {
    switch (difficulty) {
      case 'easy': return 60000;    // 60 seconds
      case 'normal': return 30000;  // 30 seconds
      case 'hard': return 15000;    // 15 seconds
      case 'brutal': return 10000;  // 10 seconds
    }
  }

  public start(): void {
    this.isActive = true;
    this.lastTick = this.getGameTimeMs();
  }

  public stop(): void {
    this.isActive = false;
  }

  public pause(): void {
    this.isActive = false;
  }

  public resume(): void {
    this.isActive = true;
    this.lastTick = this.getGameTimeMs();
  }

  public update(context: AIContext): AIAction[] {
    if (!this.isActive) return [];

    const now = this.getGameTimeMs();
    if (now - this.lastTick < this.tickInterval) {
      return [];
    }

    this.lastTick = now;

    const actions = this.brain.update(context);

    // Filter research actions based on research check interval
    const filteredActions = actions.filter(action => {
      if (action.type === 'research') {
        if (now - this.lastResearchCheck < this.researchCheckInterval) {
          return false;
        }
        this.lastResearchCheck = now;
      }
      return true;
    });

    for (const action of filteredActions) {
      if (action.unitId) {
        this.currentOrders.set(action.unitId, {
          action,
          timestamp: now
        });
      }
    }

    return filteredActions;
  }

  public executeAction(action: AIAction, gameCommands: GameCommands): boolean {
    try {
      switch (action.type) {
        case 'move':
          if (action.unitId && action.position) {
            gameCommands.moveUnit(action.unitId, action.position);
            return true;
          }
          break;

        case 'attack':
          if (action.unitId && action.targetId) {
            gameCommands.attackUnit(action.unitId, action.targetId);
            return true;
          }
          break;

        case 'harvest':
          if (action.unitId && action.targetId) {
            gameCommands.harvestResource(action.unitId, action.targetId);
            return true;
          }
          break;

        case 'return':
          if (action.unitId) {
            gameCommands.returnToBase(action.unitId);
            return true;
          }
          break;

        case 'build':
          if (action.buildingId && action.position) {
            gameCommands.buildStructure(action.buildingId, action.position);
            return true;
          }
          break;

        case 'repair':
          if (action.buildingId) {
            gameCommands.repairBuilding(action.buildingId);
            return true;
          }
          break;

        case 'patrol':
          if (action.unitId && action.position) {
            gameCommands.patrolUnit(action.unitId, action.position);
            return true;
          }
          break;

        case 'defend':
          if (action.unitId && action.position) {
            gameCommands.defendPosition(action.unitId, action.position);
            return true;
          }
          break;

        case 'retreat':
          if (action.unitId && action.position) {
            gameCommands.retreatUnit(action.unitId, action.position);
            return true;
          }
          break;

        case 'produce':
          if (action.buildingId) {
            gameCommands.produceUnit(action.buildingId, action.unitType);
            return true;
          }
          break;

        case 'scatter':
          if (action.unitId && action.position) {
            gameCommands.scatterUnit(action.unitId, action.position);
            return true;
          }
          break;

        case 'rally':
          if (action.buildingId && action.position) {
            gameCommands.setRallyPoint(action.buildingId, action.position);
            return true;
          }
          break;

        case 'upgrade':
          if (action.buildingId) {
            gameCommands.upgradeBuilding(action.buildingId);
            return true;
          }
          break;

        case 'capture':
          if (action.unitId && action.targetId) {
            // First move engineer near the building
            if (action.position) {
              gameCommands.moveUnit(action.unitId, action.position);
            }
            // Then try capture (CaptureSystem will auto-capture when in range)
            gameCommands.captureBuilding(action.unitId, action.targetId);
            return true;
          }
          break;

        case 'research':
          if (action.upgradeType) {
            gameCommands.researchUpgrade(action.upgradeType);
            return true;
          }
          break;

        case 'loadTransport':
          if (action.infantryId && action.transportId) {
            gameCommands.loadIntoTransport(action.infantryId, action.transportId);
            return true;
          }
          break;

        case 'unloadTransport':
          if (action.transportId) {
            gameCommands.unloadFromTransport(action.transportId, action.position);
            return true;
          }
          break;

        case 'activateSuperweapon':
          if (action.buildingId && action.position) {
            gameCommands.activateSuperweapon(action.buildingId, action.position);
            return true;
          }
          break;

        case 'activateChronosphere':
          if (action.buildingId && action.position && action.targetPosition) {
            gameCommands.activateChronosphere(action.buildingId, action.position, action.targetPosition);
            return true;
          }
          break;

        case 'chronoShift':
          if (action.unitId && action.position) {
            gameCommands.chronoShiftUnit(action.unitId, action.position);
            return true;
          }
          break;

        case 'sellBuilding':
          if (action.buildingId) {
            gameCommands.sellBuilding(action.buildingId);
            return true;
          }
          break;

        case 'garrison':
          if (action.unitId && action.buildingId) {
            useGameStore.getState().garrisonUnit(action.unitId, action.buildingId);
            return true;
          }
          break;

        case 'ungarrison':
          if (action.buildingId) {
            useGameStore.getState().ungarrisonBuilding(action.buildingId);
            return true;
          }
          break;

        case 'deploy':
          if (action.unitId) {
            useGameStore.getState().startDeploy(action.unitId);
            return true;
          }
          break;

        case 'repairBridge':
          if (action.buildingId) {
            useGameStore.getState().repairBridge(action.buildingId);
            return true;
          }
          break;
      }

      return false;
    } catch (error) {
      console.error(`AI failed to execute action ${action.type}:`, error);
      return false;
    }
  }

  public getCurrentOrders(): Map<string, AIOrder> {
    return new Map(this.currentOrders);
  }

  public cancelOrder(unitId: string): void {
    this.currentOrders.delete(unitId);
  }

  public cancelAllOrders(): void {
    this.currentOrders.clear();
  }

  public setDifficulty(difficulty: Difficulty): void {
    this.config.difficulty = difficulty;
    this.tickInterval = this.getTickInterval(difficulty);
    this.researchCheckInterval = this.getResearchCheckInterval(difficulty);

    const difficultyConfig = getDifficultyConfig(difficulty as 'easy' | 'normal' | 'hard' | 'brutal');
    this.brain.setDifficulty(difficulty);

    this.personality = {
      aggressionLevel: difficultyConfig.aggressionLevel,
      defensiveLevel: difficultyConfig.defensiveLevel,
      economicLevel: difficultyConfig.economicLevel,
      scoutFrequency: 0.3,
      expandSpeed: 0.5
    };
  }

  public setPersonality(personality: Partial<AIPersonality>): void {
    this.personality = { ...this.personality, ...personality };

    const difficultyConfig = getDifficultyConfig(this.config.difficulty as 'easy' | 'normal' | 'hard' | 'brutal');
    this.brain = new AIBrain({
      difficulty: this.config.difficulty,
      aggressionLevel: this.personality.aggressionLevel,
      defensiveLevel: this.personality.defensiveLevel,
      economicLevel: this.personality.economicLevel,
      reactionTime: difficultyConfig.reactionTime
    });
  }

  public getThreatAssessment(context: AIContext): ThreatAssessment {
    const threatLevel = calculateThreatLevel(context);
    const primaryThreats = this.identifyPrimaryThreats(context);
    const vulnerablePoints = this.identifyVulnerablePoints(context);
    const recommendedResponse = this.getRecommendedResponse(context, threatLevel);

    return {
      level: threatLevel,
      primaryThreats,
      vulnerablePoints,
      recommendedResponse,
      confidence: this.calculateConfidence(context)
    };
  }

  private identifyPrimaryThreats(context: AIContext): Threat[] {
    const threats: Threat[] = [];

    for (const enemy of context.enemyPlayer.units) {
      const distanceToBase = context.gameMap.friendlyBaseLocation
        ? getDistance(enemy.position, context.gameMap.friendlyBaseLocation)
        : Infinity;

      if (distanceToBase < AI_CONFIG.THREAT_DISTANCE) {
        threats.push({
          id: enemy.id,
          type: enemy.type,
          position: enemy.position,
          distanceToBase,
          power: enemy.attack * (enemy.health / enemy.maxHealth)
        });
      }
    }

    return threats.sort((a, b) => a.distanceToBase - b.distanceToBase);
  }

  private identifyVulnerablePoints(context: AIContext): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    const defenses = context.aiPlayer.buildings.filter(b => 
      b.isConstructed && DEFENSE_BUILDING_TYPES.has(b.type)
    );

    for (const building of context.aiPlayer.buildings) {
      if (!building.isConstructed) continue;

      const nearbyDefense = defenses.filter(d => 
        getDistance(d.position, building.position) < AI_CONFIG.DEFENSE_DISTANCE
      ).length;

      if (nearbyDefense < 2 && building.health < building.maxHealth * AI_CONFIG.LOW_HEALTH_THRESHOLD) {
        vulnerabilities.push({
          id: building.id,
          type: building.type,
          position: building.position,
          severity: 1 - (building.health / building.maxHealth),
          nearestDefense: nearbyDefense
        });
      }
    }

    return vulnerabilities.sort((a, b) => b.severity - a.severity);
  }

  private getRecommendedResponse(context: AIContext, threatLevel: ThreatLevel): string[] {
    const responses: string[] = [];

    switch (threatLevel) {
      case 'critical':
        responses.push('立即撤退受损单位');
        responses.push('集中所有防御力量');
        responses.push('请求增援生产');
        break;
      case 'high':
        responses.push('加强防御部署');
        responses.push('保护关键建筑');
        responses.push('准备反击');
        break;
      case 'medium':
        responses.push('保持警戒');
        responses.push('适当增援');
        break;
      case 'low':
        responses.push('继续进攻计划');
        responses.push('保持经济生产');
        break;
      case 'none':
        responses.push('执行扩张计划');
        responses.push('加强攻势');
        break;
    }

    return responses;
  }

  private calculateConfidence(context: AIContext): number {
    let confidence = 0.5;

    if (context.aiPlayer.units.length > 0) confidence += 0.1;
    if (context.aiPlayer.buildings.length > 0) confidence += 0.1;
    if (context.gameMap.resourceNodes.length > 0) confidence += 0.1;

    if (context.threatLevel !== 'none') confidence -= 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  public dispose(): void {
    this.stop();
    this.currentOrders.clear();
  }
}

export interface AIOrder {
  action: AIAction;
  timestamp: number;
}

export interface GameCommands {
  moveUnit: (unitId: string, position: Vector2) => void;
  attackUnit: (unitId: string, targetId: string) => void;
  harvestResource: (unitId: string, resourceId: string) => void;
  returnToBase: (unitId: string) => void;
  buildStructure: (buildingType: string, position: Vector2) => void;
  repairBuilding: (buildingId: string) => void;
  patrolUnit: (unitId: string, position: Vector2) => void;
  defendPosition: (unitId: string, position: Vector2) => void;
  retreatUnit: (unitId: string, position: Vector2) => void;
  produceUnit: (buildingId: string, unitType?: import('../../types').UnitType) => void;
  scatterUnit: (unitId: string, position: Vector2) => void;
  setRallyPoint: (buildingId: string, position: Vector2) => void;
  upgradeBuilding: (buildingId: string) => void;
  captureBuilding: (unitId: string, buildingId: string) => void;
  researchUpgrade: (upgradeType: UpgradeType) => void;
  loadIntoTransport: (infantryId: string, transportId: string) => void;
  unloadFromTransport: (transportId: string, position?: Vector2) => void;
  activateSuperweapon: (buildingId: string, position: Vector2) => void;
  activateChronosphere: (buildingId: string, sourcePosition: Vector2, targetPosition: Vector2) => void;
  chronoShiftUnit: (unitId: string, targetPosition: Vector2) => void;
  sellBuilding: (buildingId: string) => void;
}

export interface ThreatAssessment {
  level: ThreatLevel;
  primaryThreats: Threat[];
  vulnerablePoints: Vulnerability[];
  recommendedResponse: string[];
  confidence: number;
}

export interface Threat {
  id: string;
  type: string;
  position: Vector2;
  distanceToBase: number;
  power: number;
}

export interface Vulnerability {
  id: string;
  type: string;
  position: Vector2;
  severity: number;
  nearestDefense: number;
}
