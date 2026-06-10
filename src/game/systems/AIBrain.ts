import type { AIContext } from './AITypes';
import type { BehaviorNode, BehaviorNodeStatus } from './AITypes';
import {
  AIAction,
  AIActionType,
  createConditionCheck,
  prioritizeTargets,
  findDefensivePosition
} from './AITasks';
import { calculateThreatLevel } from './AIUtils';
import {
  SequenceNode,
  SelectorNode,
  ActionNode
} from './AIBehaviorTree';
import { getDistance, getDifficultyConfig } from './AIUtils';
import { AI_CONFIG } from '../config/AIConfig';
import { UnitType, BuildingType, UnitState, Vector2, UpgradeType, FactionGroup, getFactionGroup, Faction, BuildingData, GameMapData } from '../../types';
import { UNITS_BY_FACTION, BUILDINGS_BY_FACTION } from './AIUnitLookup';
import { useGameStore, UNIT_UPGRADE_REQUIREMENTS } from '../../store/gameStore';
import { getUpgradesByFactionGroup } from '../data/upgrades';
import { GAME_CONFIG } from '../config/GameConfig';

export interface AIDifficultyParams {
  buildDelay: number;        // Delay between build decisions (seconds)
  attackWaveSize: number;    // Minimum units before attacking
  expandTiming: number;      // When to expand (game time in seconds)
  reactionTime: number;      // Delay before reacting to threats
  economyFocus: number;      // 0-1, how much AI focuses on economy vs military
  techRush: boolean;         // Whether AI rushes tech tree
  superweaponUse: boolean;   // Whether AI uses superweapons
  maxUnits: number;          // Maximum units AI will build
}

const DIFFICULTY_PRESETS: Record<string, AIDifficultyParams> = {
  easy: {
    buildDelay: 5,
    attackWaveSize: 8,
    expandTiming: 300,
    reactionTime: 3,
    economyFocus: 0.7,
    techRush: false,
    superweaponUse: false,
    maxUnits: 30,
  },
  normal: {
    buildDelay: 3,
    attackWaveSize: 5,
    expandTiming: 180,
    reactionTime: 1.5,
    economyFocus: 0.5,
    techRush: false,
    superweaponUse: true,
    maxUnits: 50,
  },
  hard: {
    buildDelay: 1,
    attackWaveSize: 3,
    expandTiming: 120,
    reactionTime: 0.5,
    economyFocus: 0.3,
    techRush: true,
    superweaponUse: true,
    maxUnits: 80,
  },
  brutal: {
    buildDelay: 0,
    attackWaveSize: 2,
    expandTiming: 60,
    reactionTime: 0,
    economyFocus: 0.2,
    techRush: true,
    superweaponUse: true,
    maxUnits: 120,
  },
};

export type AICombatStrategy = 'rush' | 'turtle' | 'balanced' | 'naval';

export interface AIBrainConfig {
  difficulty: 'easy' | 'normal' | 'hard' | 'brutal';
  aggressionLevel: number;
  defensiveLevel: number;
  economicLevel: number;
  reactionTime: number;
}

export class AIBrain {
  private rootBehavior: BehaviorNode;
  private config: AIBrainConfig;
  private difficultyParams: AIDifficultyParams;
  private combatStrategy: AICombatStrategy = 'balanced';
  private pendingActions: AIAction[] = [];
  private actionCooldowns: Map<string, number> = new Map();
  private lastScoutTime: number = 0;
  private lastUpdate: number = 0;
  private lastBuildDecisionTime: number = 0;
  private strategyEvaluated: boolean = false;

  /** Get game time in milliseconds (consistent with gameTime, pauses with game) */
  private getGameTimeMs(): number {
    return useGameStore.getState().gameTime * 1000;
  }

  constructor(config: Partial<AIBrainConfig> = {}) {
    this.config = {
      difficulty: config.difficulty || 'normal',
      aggressionLevel: config.aggressionLevel ?? 0.5,
      defensiveLevel: config.defensiveLevel ?? 0.5,
      economicLevel: config.economicLevel ?? 0.5,
      reactionTime: config.reactionTime ?? 500
    };

    this.difficultyParams = DIFFICULTY_PRESETS[this.config.difficulty] || DIFFICULTY_PRESETS.normal;

    this.rootBehavior = this.buildBehaviorTree();
  }

  private buildBehaviorTree(): BehaviorNode {
    const root = new SelectorNode('root', 'AI Main Behavior');

    root.addChild(
      new SequenceNode('emergency', 'Emergency Response', [
        createConditionCheck('has_critical_threat', 'Has Critical Threat', 
          (ctx) => ctx.threatLevel === 'critical'),
        this.buildEmergencyResponse()
      ])
    );

    root.addChild(
      new SequenceNode('defense', 'Defensive Behavior', [
        createConditionCheck('has_threat', 'Has Any Threat',
          (ctx) => ctx.threatLevel !== 'none'),
        this.buildDefenseTree()
      ])
    );

    root.addChild(
      new SequenceNode('production', 'Production Phase', [
        this.buildProductionTree()
      ])
    );

    root.addChild(
      new SequenceNode('research', 'Research Upgrades', [
        createConditionCheck('can_research', 'Can Research Upgrade',
          (ctx) => this.canResearchUpgrade(ctx)),
        this.createResearchSequence()
      ])
    );

    root.addChild(
      new SequenceNode('offense', 'Offensive Behavior', [
        createConditionCheck('has_offensive_power', 'Has Offensive Power',
          (ctx) => ctx.aiPlayer.offensivePower > 20),
        this.buildOffenseTree()
      ])
    );

    root.addChild(
      new SequenceNode('economy', 'Economic Management', [
        this.buildEconomyTree()
      ])
    );

    root.addChild(
      new SequenceNode('scout', 'Scouting', [
        createConditionCheck('should_scout', 'Should Scout',
          (ctx) => this.shouldScout(ctx)),
        this.createScoutSequence()
      ])
    );

    root.addChild(
      new SequenceNode('superweapon', 'Superweapon Management', [
        createConditionCheck('can_build_superweapon', 'Can Build Superweapon',
          (ctx) => this.canBuildSuperweapon(ctx)),
        this.createSuperweaponSequence()
      ])
    );

    root.addChild(
      new SequenceNode('garrison', 'Garrison Infantry', [
        createConditionCheck('can_garrison', 'Has Infantry Near Garrisonable Building',
          (ctx) => this.canGarrison(ctx)),
        this.createGarrisonSequence()
      ])
    );

    root.addChild(
      new SequenceNode('deploy', 'Deploy MCV', [
        createConditionCheck('can_deploy_mcv', 'Has Deployable Unit',
          (ctx) => this.canDeployMCV(ctx)),
        this.createDeploySequence()
      ])
    );

    root.addChild(
      new SequenceNode('repair_bridge', 'Repair Destroyed Bridge', [
        createConditionCheck('can_repair_bridge', 'Has Engineers and Destroyed Bridges',
          (ctx) => this.canRepairBridge(ctx)),
        this.createRepairBridgeSequence()
      ])
    );

    root.addChild(
      new SequenceNode('spy_infiltrate', 'Spy Infiltration', [
        createConditionCheck('has_spy', 'Has Spy Unit',
          (ctx) => ctx.aiPlayer.units.some(u => u.type === UnitType.SPY)),
        this.createSpyInfiltrateSequence()
      ])
    );

    root.addChild(
      new SequenceNode('chrono_ambush', 'Chrono Ambush', [
        createConditionCheck('has_chrono', 'Has Chrono Unit',
          (ctx) => ctx.aiPlayer.units.some(u => u.type === UnitType.CHRONO)),
        this.createChronoAmbushSequence()
      ])
    );

    root.addChild(
      new SequenceNode('ivan_sabotage', 'Ivan Sabotage', [
        createConditionCheck('has_ivan', 'Has Ivan Unit',
          (ctx) => ctx.aiPlayer.units.some(u => u.type === UnitType.IVAN)),
        this.createIvanSabotageSequence()
      ])
    );

    root.addChild(
      new SequenceNode('desolator_deploy', 'Desolator Deploy', [
        createConditionCheck('has_desolator', 'Has Desolator Unit',
          (ctx) => ctx.aiPlayer.units.some(u => u.type === UnitType.ROCKET && u.special === '辐射部署')),
        this.createDesolatorDeploySequence()
      ])
    );

    root.addChild(
      new SequenceNode('naval_assault', 'Naval Assault', [
        createConditionCheck('has_naval', 'Has Naval Units',
          (ctx) => this.hasNavalUnits(ctx)),
        this.createNavalAssaultSequence()
      ])
    );

    return root;
  }

  private buildEmergencyResponse(): BehaviorNode {
    const emergency = new SelectorNode('emergency_response', 'Emergency Response');

    emergency.addChild(
      new SequenceNode('retreat', 'Retreat Damaged Units', [
        createConditionCheck('has_damaged_units', 'Has Damaged Units',
          (ctx) => ctx.aiPlayer.units.some(u => u.health < u.maxHealth * 0.3)),
        this.createRetreatSequence()
      ])
    );

    emergency.addChild(
      new SequenceNode('scatter', 'Scatter From Threat', [
        createConditionCheck('should_scatter', 'Should Scatter',
          (ctx) => ctx.threatLevel === 'critical'),
        this.createScatterSequence()
      ])
    );

    return emergency;
  }

  private createRetreatSequence(): BehaviorNode {
    const sequence = new SequenceNode('retreat_sequence', 'Retreat Sequence');

    sequence.addChild(
      new ActionNode('find_safe_position', 'Find Safe Position', (ctx: AIContext): BehaviorNodeStatus => {
        const damagedUnits = ctx.aiPlayer.units.filter(u => u.health < u.maxHealth * 0.3);

        for (const unit of damagedUnits) {
          // Find the nearest enemy to retreat away from
          const nearestEnemy = ctx.enemyPlayer.units
            .filter(e => getDistance(e.position, unit.position) < 300)
            .sort((a, b) => getDistance(a.position, unit.position) - getDistance(b.position, unit.position))[0];

          let safeLocation: Vector2;
          if (nearestEnemy) {
            // Retreat in the opposite direction from the nearest enemy
            const dx = unit.position.x - nearestEnemy.position.x;
            const dy = unit.position.y - nearestEnemy.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const retreatDist = 200;
            safeLocation = {
              x: Math.max(0, Math.min(ctx.gameMap.width * 64, unit.position.x + (dx / dist) * retreatDist)),
              y: Math.max(0, Math.min(ctx.gameMap.height * 64, unit.position.y + (dy / dist) * retreatDist)),
            };
          } else {
            // No nearby enemy, retreat to base
            safeLocation = ctx.gameMap.friendlyBaseLocation ||
              ctx.aiPlayer.buildings.find(b => b.type === BuildingType.COMMAND)?.position ||
              { x: ctx.gameMap.width / 2, y: ctx.gameMap.height / 2 };
          }

          this.pendingActions.push({
            type: 'retreat',
            unitId: unit.id,
            position: safeLocation,
            priority: 10
          });
        }

        return damagedUnits.length > 0 ? 'success' : 'failure';
      })
    );

    return sequence;
  }

  private createScatterSequence(): BehaviorNode {
    const sequence = new SequenceNode('scatter_sequence', 'Scatter Sequence');

    sequence.addChild(
      new ActionNode('scatter_units', 'Scatter Units', (ctx: AIContext): BehaviorNodeStatus => {
        const _threatCenter = this.calculateThreatCenter(ctx);
        const mapW = ctx.gameMap.width * GAME_CONFIG.TILE_SIZE;
        const mapH = ctx.gameMap.height * GAME_CONFIG.TILE_SIZE;

        for (const unit of ctx.aiPlayer.units) {
          if (unit.data?.canAttack) {
            const scatterDir = Math.random() * Math.PI * 2;
            const scatterDist = AI_CONFIG.SCATTER_DISTANCE_MIN + Math.random() * AI_CONFIG.SCATTER_DISTANCE_RANGE;
            const newPos = {
              x: Math.max(0, Math.min(mapW - GAME_CONFIG.TILE_SIZE, unit.position.x + Math.cos(scatterDir) * scatterDist)),
              y: Math.max(0, Math.min(mapH - GAME_CONFIG.TILE_SIZE, unit.position.y + Math.sin(scatterDir) * scatterDist))
            };

            this.pendingActions.push({
              type: 'scatter',
              unitId: unit.id,
              position: newPos,
              priority: 10
            });
          }
        }

        return 'success';
      })
    );

    return sequence;
  }

  private shouldScout(ctx: AIContext): boolean {
    // Don't scout if under threat
    if (ctx.threatLevel === 'critical' || ctx.threatLevel === 'high') return false;

    // Need at least some military units before scouting
    const combatUnits = ctx.aiPlayer.units.filter(u => u.data?.canAttack && !u.transportId);
    if (combatUnits.length < 3) return false;

    // Cooldown: don't scout too frequently
    const cooldownKey = 'scout';
    if (this.actionCooldowns.has(cooldownKey)) return false;

    // Deterministic scouting: every 45-90 seconds based on aggression
    const scoutInterval = (90 - this.config.aggressionLevel * 45) * 1000;
    const lastScoutTime = this.lastScoutTime || 0;
    if (this.getGameTimeMs() - lastScoutTime < scoutInterval) return false;

    return true;
  }

  private createScoutSequence(): BehaviorNode {
    const sequence = new SequenceNode('scout_seq', 'Scout Sequence');

    sequence.addChild(
      new ActionNode('scout_action', 'Send Scout', (ctx: AIContext): BehaviorNodeStatus => {
        // Find fast idle units for scouting (prefer airborne or fast units)
        const candidates = ctx.aiPlayer.units.filter(u =>
          u.data?.canAttack && !u.transportId &&
          (u.state === 'idle' || u.state === 'defending') &&
          u.health > u.maxHealth * 0.8
        );

        if (candidates.length === 0) return 'failure';

        // Prefer fast/airborne units for scouting
        const scout = candidates.sort((a, b) => {
          const aScore = (a.isAirborne ? 100 : 0) + (a.speed || 0) * 10;
          const bScore = (b.isAirborne ? 100 : 0) + (b.speed || 0) * 10;
          return bScore - aScore;
        })[0];

        // Pick a scouting destination: unexplored areas or enemy base direction
        const basePos = ctx.gameMap.friendlyBaseLocation || scout.position;
        const mapW = ctx.gameMap.width * GAME_CONFIG.TILE_SIZE;
        const mapH = ctx.gameMap.height * GAME_CONFIG.TILE_SIZE;

        // Generate candidate scout positions in different directions
        const scoutPositions: Vector2[] = [];
        const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
        for (const angle of angles) {
          const dist = 300 + Math.random() * 400;
          const pos = {
            x: Math.max(GAME_CONFIG.TILE_SIZE, Math.min(mapW - GAME_CONFIG.TILE_SIZE,
              basePos.x + Math.cos(angle) * dist)),
            y: Math.max(GAME_CONFIG.TILE_SIZE, Math.min(mapH - GAME_CONFIG.TILE_SIZE,
              basePos.y + Math.sin(angle) * dist)),
          };
          scoutPositions.push(pos);
        }

        // If we know enemy base location, strongly prefer scouting toward it
        let targetPos: Vector2;
        if (ctx.gameMap.enemyBaseLocation) {
          // Scout toward enemy base with some offset for variety
          const dx = ctx.gameMap.enemyBaseLocation.x - basePos.x;
          const dy = ctx.gameMap.enemyBaseLocation.y - basePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const offset = (Math.random() - 0.5) * 200;
          targetPos = {
            x: Math.max(GAME_CONFIG.TILE_SIZE, Math.min(mapW - GAME_CONFIG.TILE_SIZE,
              basePos.x + (dx / dist) * (dist * 0.6) + offset)),
            y: Math.max(GAME_CONFIG.TILE_SIZE, Math.min(mapH - GAME_CONFIG.TILE_SIZE,
              basePos.y + (dy / dist) * (dist * 0.6) + offset)),
          };
        } else {
          // No known enemy base: pick a random scout position
          targetPos = scoutPositions[Math.floor(Math.random() * scoutPositions.length)];
        }

        this.pendingActions.push({
          type: 'patrol',
          unitId: scout.id,
          position: targetPos,
          priority: 3
        });

        // Set cooldown: 15-30 seconds between scouts
        this.actionCooldowns.set('scout', this.getGameTimeMs() + 15000 + Math.random() * 15000);
        this.lastScoutTime = this.getGameTimeMs();

        return 'success';
      })
    );

    return sequence;
  }

  private buildDefenseTree(): BehaviorNode {
    const defense = new SelectorNode('defense', 'Defense Tree');

    defense.addChild(
      new SequenceNode('defend_base', 'Defend Base', [
        createConditionCheck('base_under_attack', 'Base Under Attack',
          (ctx) => this.isBaseUnderAttack(ctx)),
        this.createDefendBaseSequence()
      ])
    );

    defense.addChild(
      new SequenceNode('defend_units', 'Defend Units', [
        createConditionCheck('units_under_attack', 'Units Under Attack',
          (ctx) => ctx.aiPlayer.units.some(u => ctx.enemyPlayer.units.some(e => 
            getDistance(u.position, e.position) < 200 && e.state === 'attacking'
          ))),
        this.createDefendUnitsSequence()
      ])
    );

    defense.addChild(
      new SequenceNode('patrol', 'Patrol', [
        createConditionCheck('should_patrol', 'Should Patrol',
          (ctx) => ctx.threatLevel === 'low' && ctx.aiPlayer.units.length > 5),
        this.createPatrolSequence()
      ])
    );

    return defense;
  }

  private createDefendBaseSequence(): BehaviorNode {
    const sequence = new SequenceNode('defend_base_seq', 'Defend Base Sequence');

    sequence.addChild(
      new ActionNode('defend_base_action', 'Defend Base', (ctx: AIContext): BehaviorNodeStatus => {
        const baseLocation = ctx.gameMap.friendlyBaseLocation;
        if (!baseLocation) return 'failure';

        const defenders = ctx.aiPlayer.units.filter(u => 
          u.data?.canAttack && u.state !== 'retreating'
        );

        const targetPosition = findDefensivePosition(ctx, baseLocation);

        for (const defender of defenders.slice(0, Math.ceil(defenders.length / 2))) {
          this.pendingActions.push({
            type: 'defend',
            unitId: defender.id,
            position: targetPosition,
            priority: 8
          });
        }

        return 'success';
      })
    );

    return sequence;
  }

  private createDefendUnitsSequence(): BehaviorNode {
    const sequence = new SequenceNode('defend_units_seq', 'Defend Units Sequence');

    sequence.addChild(
      new ActionNode('defend_units_action', 'Defend Units', (ctx: AIContext): BehaviorNodeStatus => {
        const threatenedUnits = ctx.aiPlayer.units.filter(u => 
          ctx.enemyPlayer.units.some(e => 
            getDistance(u.position, e.position) < 200 && e.state === 'attacking'
          )
        );

        const defenders = ctx.aiPlayer.units.filter(u => 
          u.data?.canAttack && !threatenedUnits.some(t => t.id === u.id)
        );

        for (const threatened of threatenedUnits) {
          const nearestEnemy = ctx.enemyPlayer.units.find(e =>
            getDistance(e.position, threatened.position) < 200
          );
          if (!nearestEnemy) continue;

          const closestDefender = defenders.find(d =>
            getDistance(d.position, threatened.position) <
            getDistance(d.position, nearestEnemy.position)
          );

          if (closestDefender) {
            const enemy = ctx.enemyPlayer.units.find(e => 
              getDistance(e.position, threatened.position) < 200
            );

            if (enemy) {
              this.pendingActions.push({
                type: 'attack',
                unitId: closestDefender.id,
                targetId: enemy.id,
                priority: 9
              });
            }
          }
        }

        return threatenedUnits.length > 0 ? 'success' : 'failure';
      })
    );

    return sequence;
  }

  private createPatrolSequence(): BehaviorNode {
    const sequence = new SequenceNode('patrol_seq', 'Patrol Sequence');

    sequence.addChild(
      new ActionNode('patrol_action', 'Patrol', (ctx: AIContext): BehaviorNodeStatus => {
        const patrolUnits = ctx.aiPlayer.units.filter(u => 
          u.data?.canAttack && u.state === 'idle'
        ).slice(0, 3);

        const patrolPoints = this.generatePatrolPoints(ctx);

        for (const unit of patrolUnits) {
          this.pendingActions.push({
            type: 'patrol',
            unitId: unit.id,
            position: patrolPoints[0],
            priority: 2
          });
        }

        return patrolUnits.length > 0 ? 'success' : 'failure';
      })
    );

    return sequence;
  }

  private buildProductionTree(): BehaviorNode {
    const production = new SelectorNode('production', 'Production Tree');

    production.addChild(
      new SequenceNode('build_structures', 'Build Structures', [
        createConditionCheck('can_build_structures', 'Can Build Structures',
          (ctx) => this.canBuildStructures(ctx)),
        this.createBuildStructuresSequence()
      ])
    );

    production.addChild(
      new SequenceNode('produce_units', 'Produce Units', [
        createConditionCheck('can_produce_units', 'Can Produce Units',
          (ctx) => this.canProduceUnits(ctx)),
        this.createProduceUnitsSequence()
      ])
    );

    production.addChild(
      new SequenceNode('produce_harvesters', 'Produce Harvesters', [
        createConditionCheck('need_harvesters', 'Need Harvesters',
          (ctx) => this.needHarvesters(ctx)),
        this.createProduceHarvestersSequence()
      ])
    );

    return production;
  }

  private canBuildStructures(ctx: AIContext): boolean {
    return ctx.resources.money > 500;
  }

  private createBuildStructuresSequence(): BehaviorNode {
    const sequence = new SequenceNode('build_structures_seq', 'Build Structures Sequence');

    sequence.addChild(
      new ActionNode('build_structures_action', 'Build Structures', (ctx: AIContext): BehaviorNodeStatus => {
        // Apply buildDelay from difficulty params
        const gameTimeSec = ctx.currentTime;
        if (gameTimeSec - this.lastBuildDecisionTime < this.difficultyParams.buildDelay) {
          return 'failure';
        }
        this.lastBuildDecisionTime = gameTimeSec;

        const buildings = ctx.aiPlayer.buildings;
        const money = ctx.resources.money;

        const hasRefinery = buildings.some(b => b.type === BuildingType.REFINERY && b.isConstructed);
        const hasWarFactory = buildings.some(b => b.type === BuildingType.WARFACTORY && b.isConstructed);
        const hasRadar = buildings.some(b => b.type === BuildingType.RADAR && b.isConstructed);
        const hasTech = buildings.some(b => b.type === BuildingType.TECH && b.isConstructed);
        const hasNavalShipyard = buildings.some(b => b.type === BuildingType.NAVAL_SHIPYARD && b.isConstructed);
        const powerCount = buildings.filter(b => b.type === BuildingType.POWER).length;

        // Build priority order
        let targetStructure: string | null = null;

        // Tech rush: prioritize TECH building early if difficulty enables it
        if (this.difficultyParams.techRush && !hasTech && hasRadar && money >= 2500) {
          targetStructure = BuildingType.TECH;
        }
        // 1. Build refinery if none exists and we have money
        else if (!hasRefinery && money >= 2000) {
          targetStructure = BuildingType.REFINERY;
        }
        // 2. Build more power if less than 3
        else if (powerCount < 3 && money >= 800) {
          targetStructure = BuildingType.POWER;
        }
        // 3. Build war factory
        else if (!hasWarFactory && hasRefinery && money >= 3000) {
          targetStructure = BuildingType.WARFACTORY;
        }
        // 4. Build radar
        else if (!hasRadar && hasWarFactory && money >= 1500) {
          targetStructure = BuildingType.RADAR;
        }
        // 5. Build tech center
        else if (!hasTech && hasRadar && money >= 2500) {
          targetStructure = BuildingType.TECH;
        }
        // 6. Build naval shipyard (late game, if we have radar and enough money)
        else if (!hasNavalShipyard && hasRadar && money >= 2000) {
          targetStructure = BuildingType.NAVAL_SHIPYARD;
        }

        if (!targetStructure) return 'failure';

        // Find best placement position using smart positioning
        const position = this.findBestBuildingPosition(targetStructure as BuildingType, ctx);
        if (!position) return 'failure';

        this.pendingActions.push({
          type: 'build',
          buildingId: targetStructure,
          position,
          priority: 4
        });

        return 'success';
      })
    );

    return sequence;
  }

  private createProduceUnitsSequence(): BehaviorNode {
    const sequence = new SequenceNode('produce_units_seq', 'Produce Units Sequence');

    sequence.addChild(
      new ActionNode('produce_units_action', 'Produce Units', (ctx: AIContext): BehaviorNodeStatus => {
        const unitType = this.selectUnitToProduce(ctx);
        if (!unitType) return 'failure';

        // Find the appropriate production building for this unit type
        const factionBuildings = BUILDINGS_BY_FACTION[ctx.aiPlayer.faction as Faction] || {};
        const productionBuildings = ctx.aiPlayer.buildings.filter(b => {
          if (!b.isConstructed || !b.isPowered) return false;
          const buildingData = factionBuildings[b.type as BuildingType] as BuildingData | undefined;
          const canProduce = (buildingData?.canProduce || b.canProduce || []) as readonly UnitType[];
          return canProduce.includes(unitType as UnitType) && b.productionQueue.length < 3;
        });

        for (const building of productionBuildings) {
          this.pendingActions.push({
            type: 'produce',
            buildingId: building.id,
            unitType: unitType as UnitType,
            position: { x: 0, y: 0 },
            priority: 3
          });
          return 'success';
        }

        return 'failure';
      })
    );

    return sequence;
  }

  private createProduceHarvestersSequence(): BehaviorNode {
    const sequence = new SequenceNode('produce_harvesters_seq', 'Produce Harvesters Sequence');

    sequence.addChild(
      new ActionNode('produce_harvesters_action', 'Produce Harvesters', (ctx: AIContext): BehaviorNodeStatus => {
        const currentHarvesters = ctx.aiPlayer.units.filter(u =>
          u.type === 'miner'
        ).length;

        const neededHarvesters = Math.max(0, AI_CONFIG.DESIRED_MINER_COUNT - currentHarvesters);

        if (neededHarvesters > 0) {
          // Find a building that can produce miners (war factory)
          const factionBuildings = BUILDINGS_BY_FACTION[ctx.aiPlayer.faction as Faction] || {};
          const producerBuilding = ctx.aiPlayer.buildings.find(b => {
            if (!b.isConstructed || !b.isPowered) return false;
            const buildingData = factionBuildings[b.type as BuildingType] as BuildingData | undefined;
            const canProduce = (buildingData?.canProduce || b.canProduce || []) as readonly UnitType[];
            return canProduce.includes(UnitType.MINER) && b.productionQueue.length < 3;
          });

          if (producerBuilding) {
            this.pendingActions.push({
              type: 'produce',
              buildingId: producerBuilding.id,
              unitType: UnitType.MINER,
              position: { x: 0, y: 0 },
              priority: 5
            });
          }
        }

        return neededHarvesters > 0 ? 'success' : 'failure';
      })
    );

    return sequence;
  }

  private buildOffenseTree(): BehaviorNode {
    const offense = new SelectorNode('offense', 'Offense Tree');

    offense.addChild(
      new SequenceNode('attack', 'Attack Enemy', [
        createConditionCheck('should_attack', 'Should Attack',
          (ctx) => this.shouldAttack(ctx)),
        this.createAttackSequence()
      ])
    );

    return offense;
  }

  private createAttackSequence(): BehaviorNode {
    const sequence = new SequenceNode('attack_seq', 'Attack Sequence');

    sequence.addChild(
      new ActionNode('attack_action', 'Attack', (ctx: AIContext): BehaviorNodeStatus => {
        const attackers = ctx.aiPlayer.units.filter(u =>
          u.data?.canAttack && u.state !== 'retreating' && u.health > u.maxHealth * 0.5
        );

        if (attackers.length === 0) return 'failure';

        // Apply combat strategy to determine attack behavior
        let attackSize: number;
        switch (this.combatStrategy) {
          case 'rush':
            // Rush: send most units aggressively
            attackSize = Math.ceil(attackers.length * 0.8);
            break;
          case 'turtle':
            // Turtle: send fewer units, keep more for defense
            attackSize = Math.ceil(attackers.length * 0.3);
            break;
          case 'naval':
            // Naval: only send naval-capable units
            attackSize = Math.ceil(attackers.length * 0.5);
            break;
          case 'balanced':
          default:
            attackSize = Math.ceil(attackers.length * this.config.aggressionLevel);
            break;
        }

        const activeAttackers = attackers.slice(0, attackSize);

        // Focus fire: target the most dangerous enemy first
        const focusTargetId = this.selectFocusFireTarget(ctx);

        if (focusTargetId) {
          // Assign first half of attackers to focus fire on the most dangerous target
          const focusFireCount = Math.ceil(activeAttackers.length * 0.6);
          for (let i = 0; i < focusFireCount && i < activeAttackers.length; i++) {
            this.pendingActions.push({
              type: 'attack',
              unitId: activeAttackers[i].id,
              targetId: focusTargetId,
              priority: 6
            });
          }
          // Remaining attackers target other enemies
          const targets = prioritizeTargets(ctx);
          for (let i = focusFireCount; i < activeAttackers.length; i++) {
            const targetIndex = (i - focusFireCount) % targets.length;
            const target = targets[targetIndex];
            if (target) {
              this.pendingActions.push({
                type: 'attack',
                unitId: activeAttackers[i].id,
                targetId: target.id,
                priority: 6
              });
            }
          }
        } else {
          // No focus target: distribute across targets normally
          const targets = prioritizeTargets(ctx);
          if (targets.length === 0) return 'failure';
          for (let i = 0; i < activeAttackers.length; i++) {
            const targetIndex = i < targets.length ? i : 0;
            const target = targets[targetIndex];
            this.pendingActions.push({
              type: 'attack',
              unitId: activeAttackers[i].id,
              targetId: target.id,
              priority: 6
            });
          }
        }

        return 'success';
      })
    );

    return sequence;
  }

  private canResearchUpgrade(ctx: AIContext): boolean {
    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction);
    if (!aiPlayer) return false;

    // Already researching something
    if (aiPlayer.researchQueue.length > 0) return false;

    // Need some money reserve
    if (aiPlayer.money < 800) return false;

    // Check if there are any available upgrades
    const factionGroup = getFactionGroup(aiPlayer.faction as import('../../types').Faction);
    const availableUpgrades = getUpgradesByFactionGroup(factionGroup);
    const researched = new Set(aiPlayer.researchedUpgrades);
    const researching = new Set(aiPlayer.researchQueue.map(q => q.upgradeType));

    const hasAvailable = availableUpgrades.some(u =>
      !researched.has(u.type) &&
      !researching.has(u.type) &&
      u.requiredBuildings.every(req =>
        aiPlayer.buildings.some(b => b.type === req && b.isConstructed)
      )
    );

    return hasAvailable;
  }

  private createResearchSequence(): BehaviorNode {
    const sequence = new SequenceNode('research_seq', 'Research Sequence');

    sequence.addChild(
      new ActionNode('research_action', 'Research Upgrade', (ctx: AIContext): BehaviorNodeStatus => {
        const upgradeType = this.decideResearchUpgrade(ctx);
        if (!upgradeType) return 'failure';

        this.pendingActions.push({
          type: 'research',
          upgradeType,
          priority: 4
        });

        return 'success';
      })
    );

    return sequence;
  }

  private decideResearchUpgrade(ctx: AIContext): UpgradeType | null {
    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction);
    if (!aiPlayer) return null;

    // Already researching something
    if (aiPlayer.researchQueue.length > 0) return null;

    const factionGroup = getFactionGroup(aiPlayer.faction as import('../../types').Faction);
    const allUpgrades = getUpgradesByFactionGroup(factionGroup);
    const researched = new Set(aiPlayer.researchedUpgrades);
    const researching = new Set(aiPlayer.researchQueue.map(q => q.upgradeType));
    const moneyReserve = 500;
    const availableMoney = aiPlayer.money - moneyReserve;

    // Filter out already researched and currently researching
    const candidates = allUpgrades.filter(u =>
      !researched.has(u.type) && !researching.has(u.type)
    );

    // Filter out upgrades whose requiredBuildings aren't met
    const buildingMet = candidates.filter(u =>
      u.requiredBuildings.every(req =>
        aiPlayer.buildings.some(b => b.type === req && b.isConstructed)
      )
    );

    if (buildingMet.length === 0) return null;

    // Filter out upgrades the AI can't afford (with reserve)
    const affordable = buildingMet.filter(u => u.cost <= availableMoney);

    if (affordable.length === 0) return null;

    // Determine game phase based on current time (in seconds)
    const gameTimeSeconds = ctx.currentTime;
    const isEarly = gameTimeSeconds < 180;  // < 3 min
    const isMid = gameTimeSeconds >= 180 && gameTimeSeconds < 480; // 3-8 min
    // Late game: >= 480 seconds (8 min)

    // Assign priority based on game phase and upgrade category
    const getUpgradePriority = (upgrade: typeof affordable[0]): number => {
      let priority = 0;

      // Power upgrades
      if (upgrade.type === UpgradeType.ADVANCED_POWER || upgrade.type === UpgradeType.NUCLEAR_POWER) {
        priority = isEarly ? 10 : (isMid ? 5 : 2);
        // Extra priority if power is negative
        if (aiPlayer.power < 0) priority += 5;
      }
      // Economy upgrades
      else if (upgrade.type === UpgradeType.ORE_COMPRESSION || upgrade.type === UpgradeType.GOLD_REFINING) {
        priority = isEarly ? 9 : (isMid ? 6 : 3);
      }
      // Infantry attack upgrades
      else if (upgrade.type === UpgradeType.INFANTRY_ATTACK || upgrade.type === UpgradeType.CONSCRIPT_ATTACK) {
        priority = isEarly ? 4 : (isMid ? 8 : 5);
      }
      // Rocket range
      else if (upgrade.type === UpgradeType.ROCKET_RANGE) {
        priority = isMid ? 7 : (isEarly ? 3 : 4);
      }
      // Vehicle armor upgrades
      else if (upgrade.type === UpgradeType.ARMOR_REINFORCE || upgrade.type === UpgradeType.HEAVY_ARMOR) {
        priority = isMid ? 7 : (isEarly ? 2 : 6);
      }
      // Vehicle speed upgrades
      else if (upgrade.type === UpgradeType.ENGINE_OPTIMIZE || upgrade.type === UpgradeType.TURBO_ENGINE) {
        priority = isMid ? 6 : (isEarly ? 2 : 5);
      }
      // Vehicle damage upgrades
      else if (upgrade.type === UpgradeType.ADVANCED_ARTILLERY) {
        priority = isMid ? 8 : (isEarly ? 2 : 6);
      }
      // Tech unlock upgrades (late game)
      else if (upgrade.type === UpgradeType.PRISM_TECH || upgrade.type === UpgradeType.TESLA_WEAPONS || upgrade.type === UpgradeType.ELITE_FORCES || upgrade.type === UpgradeType.EMP_TECH || upgrade.type === UpgradeType.CHRONO_TECH) {
        priority = isEarly ? 1 : (isMid ? 4 : 9);
      }
      // Spy satellite
      else if (upgrade.type === UpgradeType.SPY_SATELLITE) {
        priority = isMid ? 3 : (isEarly ? 0 : 5);
      }

      // Prefer cheaper upgrades when money is tight
      if (availableMoney < 1500) {
        priority -= upgrade.cost > 1500 ? 2 : 0;
      }

      return priority;
    };

    // Sort by priority (highest first), then by cost (cheaper first for same priority)
    affordable.sort((a, b) => {
      const pa = getUpgradePriority(a);
      const pb = getUpgradePriority(b);
      if (pa !== pb) return pb - pa;
      return a.cost - b.cost;
    });

    return affordable[0].type;
  }

  private buildEconomyTree(): BehaviorNode {
    const economy = new SelectorNode('economy', 'Economy Tree');

    economy.addChild(
      new SequenceNode('harvest', 'Harvest Resources', [
        createConditionCheck('has_harvesters', 'Has Harvesters',
          (ctx) => ctx.aiPlayer.units.some(u => u.data?.canHarvest)),
        this.createHarvestSequence()
      ])
    );

    economy.addChild(
      new SequenceNode('build', 'Build Structures', [
        createConditionCheck('should_build', 'Should Build',
          (ctx) => this.shouldBuild(ctx)),
        this.createBuildSequence()
      ])
    );

    economy.addChild(
      new SequenceNode('repair', 'Repair Structures', [
        createConditionCheck('needs_repair', 'Needs Repair',
          (ctx) => ctx.aiPlayer.buildings.some(b => 
            b.isConstructed && b.health < b.maxHealth * 0.7
          )),
        this.createRepairSequence()
      ])
    );

    economy.addChild(
      new SequenceNode('capture', 'Capture Buildings', [
        createConditionCheck('can_capture', 'Can Capture',
          (ctx) => this.canCaptureBuildings(ctx)),
        this.createCaptureSequence()
      ])
    );

    return economy;
  }

  private createHarvestSequence(): BehaviorNode {
    const sequence = new SequenceNode('harvest_seq', 'Harvest Sequence');

    sequence.addChild(
      new ActionNode('harvest_action', 'Harvest', (ctx: AIContext): BehaviorNodeStatus => {
        const harvesters = ctx.aiPlayer.units.filter(u => u.data?.canHarvest);
        const assignedResourceIds = new Set<string>();

        // Track which resources are already targeted by active harvesters
        for (const h of harvesters) {
          if (h.state !== 'idle' && h.target) {
            assignedResourceIds.add(h.target);
          }
        }

        for (const harvester of harvesters) {
          if (harvester.state === 'idle') {
            // Find nearest unassigned resource by distance
            const availableResources = ctx.gameMap.resourceNodes.filter(r =>
              r.amount > 0 && !assignedResourceIds.has(r.id)
            );

            if (availableResources.length === 0) continue;

            // Sort by distance to harvester
            availableResources.sort((a, b) => {
              const distA = getDistance(harvester.position, a.position);
              const distB = getDistance(harvester.position, b.position);
              return distA - distB;
            });

            const nearestResource = availableResources[0];
            assignedResourceIds.add(nearestResource.id);

            this.pendingActions.push({
              type: 'harvest',
              unitId: harvester.id,
              targetId: nearestResource.id,
              position: nearestResource.position,
              priority: 4
            });
          }
        }

        return harvesters.length > 0 ? 'success' : 'failure';
      })
    );

    return sequence;
  }

  private createBuildSequence(): BehaviorNode {
    const sequence = new SequenceNode('build_seq', 'Build Sequence');

    sequence.addChild(
      new ActionNode('build_action', 'Build', (ctx: AIContext): BehaviorNodeStatus => {
        const buildPlan = this.determineBuildPriority(ctx);

        for (const item of buildPlan) {
          if (ctx.resources.money >= item.cost) {
            this.pendingActions.push({
              type: 'build',
              buildingId: item.type,
              position: item.position,
              priority: 3
            });
          }
        }

        return buildPlan.length > 0 ? 'success' : 'failure';
      })
    );

    return sequence;
  }

  private createRepairSequence(): BehaviorNode {
    const sequence = new SequenceNode('repair_seq', 'Repair Sequence');

    sequence.addChild(
      new ActionNode('repair_action', 'Repair', (ctx: AIContext): BehaviorNodeStatus => {
        const damagedBuildings = ctx.aiPlayer.buildings.filter(b =>
          b.isConstructed && b.health < b.maxHealth * 0.7
        );

        if (damagedBuildings.length === 0) return 'failure';

        // Sort by priority: command center first, then production, then defense, then others
        const BUILDING_REPAIR_PRIORITY: Record<string, number> = {
          [BuildingType.COMMAND]: 10,
          [BuildingType.BARRACKS]: 8,
          [BuildingType.WARFACTORY]: 8,
          [BuildingType.REFINERY]: 7,
          [BuildingType.POWER]: 6,
          [BuildingType.TECH]: 6,
          [BuildingType.DEFENSE]: 5,
          [BuildingType.TURRET]: 5,
          [BuildingType.TESLA_COIL]: 5,
          [BuildingType.FLAME_TOWER]: 5,
          [BuildingType.RADAR]: 4,
          [BuildingType.REPAIR]: 3,
        };

        // Sort: highest priority first, then lowest health percentage first
        damagedBuildings.sort((a, b) => {
          const priA = BUILDING_REPAIR_PRIORITY[a.type] || 1;
          const priB = BUILDING_REPAIR_PRIORITY[b.type] || 1;
          if (priA !== priB) return priB - priA;
          return (a.health / a.maxHealth) - (b.health / b.maxHealth);
        });

        // Repair the highest priority building (limit to 1 per tick to avoid spending too much)
        const topBuilding = damagedBuildings[0];
        if (ctx.resources.money >= AI_CONFIG.REPAIR_COST_THRESHOLD) {
          this.pendingActions.push({
            type: 'repair',
            buildingId: topBuilding.id,
            priority: 5
          });
        }

        return 'success';
      })
    );

    return sequence;
  }

  private canCaptureBuildings(ctx: AIContext): boolean {
    // Check if there are engineer units available
    const engineers = ctx.aiPlayer.units.filter(u => u.type === UnitType.ENGINEER);
    if (engineers.length > 0) {
      return this.findCaptureTarget(ctx) !== null;
    }
    // Check if we can produce an engineer
    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction as string);
    if (!aiPlayer) return false;

    const barracks = aiPlayer.buildings.find(
      b => b.isConstructed && b.isPowered && b.type === BuildingType.BARRACKS && b.newUnitCooldown <= 0
    );
    if (!barracks) return false;

    const factionUnits = UNITS_BY_FACTION[aiPlayer.faction as keyof typeof UNITS_BY_FACTION];
    const engineerData = factionUnits?.[UnitType.ENGINEER] as { cost?: number } | undefined;
    const engCost = engineerData?.cost ?? 300;
    return ctx.resources.money >= engCost;
  }

  private findCaptureTarget(ctx: AIContext): { buildingId: string; position: Vector2 } | null {
    const allPlayers = [ctx.enemyPlayer];
    // Also check neutral buildings from the store
    const store = useGameStore.getState();
    const targets: { buildingId: string; position: Vector2; dist: number }[] = [];

    for (const player of allPlayers) {
      for (const b of player.buildings) {
        if (!b.isConstructed || b.type === BuildingType.WALL) continue;
        const dx = b.position.x - (ctx.aiPlayer.buildings[0]?.position.x || 0);
        const dy = b.position.y - (ctx.aiPlayer.buildings[0]?.position.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 800) {
          targets.push({ buildingId: b.id, position: b.position, dist });
        }
      }
    }
    // Check neutral buildings
    const neutralBuildings = (store as { neutralBuildings?: Array<{ id: string; position: Vector2; type: string; isConstructed: boolean }> }).neutralBuildings || [];
    for (const b of neutralBuildings) {
      const dx = b.position.x - (ctx.aiPlayer.buildings[0]?.position.x || 0);
      const dy = b.position.y - (ctx.aiPlayer.buildings[0]?.position.y || 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 800) {
        targets.push({ buildingId: b.id, position: b.position, dist });
      }
    }

    if (targets.length === 0) return null;
    targets.sort((a, b) => a.dist - b.dist);
    return { buildingId: targets[0].buildingId, position: targets[0].position };
  }

  private createCaptureSequence(): BehaviorNode {
    const sequence = new SequenceNode('capture_seq', 'Capture Sequence');

    sequence.addChild(
      new ActionNode('capture_action', 'Capture Building', (ctx: AIContext): BehaviorNodeStatus => {
        const target = this.findCaptureTarget(ctx);
        if (!target) return 'failure';

        // Find an idle engineer
        let engineer = ctx.aiPlayer.units.find(
          u => u.type === UnitType.ENGINEER && u.state === UnitState.IDLE
        );
        if (!engineer) {
          engineer = ctx.aiPlayer.units.find(u => u.type === UnitType.ENGINEER);
        }

        if (engineer) {
          // Move engineer to capture target
          this.pendingActions.push({
            type: 'capture',
            unitId: engineer.id,
            targetId: target.buildingId,
            position: target.position,
            priority: 6
          });
          return 'success';
        }

        // No engineer - produce one
        const store2 = useGameStore.getState();
        const aiPlayer2 = store2.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction as string);
        if (!aiPlayer2) return 'failure';

        const barracks = aiPlayer2.buildings.find(
          b => b.type === BuildingType.BARRACKS && b.isConstructed && b.isPowered && b.newUnitCooldown <= 0
        );
        if (!barracks) return 'failure';

        const factionUnits = UNITS_BY_FACTION[aiPlayer2.faction as keyof typeof UNITS_BY_FACTION];
        const engineerData = factionUnits?.[UnitType.ENGINEER] as { cost?: number } | undefined;
        const engCost = engineerData?.cost ?? 300;
        if (ctx.resources.money < engCost) return 'failure';

        this.pendingActions.push({
          type: 'produce',
          buildingId: barracks.id,
          unitType: UnitType.ENGINEER,
          priority: 5
        });
        return 'success';
      })
    );

    return sequence;
  }

  public update(context: AIContext): AIAction[] {
    // Use difficulty-based reactionTime (in seconds, convert to ms)
    const reactionTimeMs = this.difficultyParams.reactionTime * 1000;
    if (this.getGameTimeMs() - this.lastUpdate < reactionTimeMs) {
      return this.pendingActions;
    }

    this.lastUpdate = this.getGameTimeMs();
    context.threatLevel = calculateThreatLevel(context);

    // Evaluate combat strategy once based on map and difficulty
    if (!this.strategyEvaluated) {
      this.evaluateCombatStrategy(context);
      this.strategyEvaluated = true;
    }

    this.rootBehavior.execute(context);

    // Manage transport loading/unloading
    const transportActions = this.manageTransports(context);
    this.pendingActions.push(...transportActions);

    // Activate ready superweapons (respect superweaponUse difficulty param)
    if (this.difficultyParams.superweaponUse) {
      const superweaponActions = this.manageSuperweapons(context);
      this.pendingActions.push(...superweaponActions);
    }

    // Respond to enemy superweapon threats
    const threatActions = this.respondToSuperweaponThreat(context);
    this.pendingActions.push(...threatActions);

    // Use Chrono Legionnaire chrono shift ability
    const chronoActions = this.manageChronoAbilities(context);
    this.pendingActions.push(...chronoActions);

    // Sell low-value buildings when low on funds
    const sellActions = this.manageSellBuildings(context);
    this.pendingActions.push(...sellActions);

    // Apply retreat logic: when outnumbered 2:1, retreat to base
    const retreatActions = this.evaluateRetreat(context);
    this.pendingActions.push(...retreatActions);

    this.cleanupCooldowns();

    const actions = [...this.pendingActions];
    this.pendingActions = [];

    return actions.sort((a, b) => b.priority - a.priority);
  }

  public reset(): void {
    this.pendingActions = [];
    this.actionCooldowns.clear();
  }

  public setDifficulty(difficulty: 'easy' | 'normal' | 'hard' | 'brutal'): void {
    this.config.difficulty = difficulty;
    const config = getDifficultyConfig(difficulty);
    this.config.aggressionLevel = config.aggressionLevel;
    this.config.defensiveLevel = config.defensiveLevel;
    this.config.economicLevel = config.economicLevel;
    this.config.reactionTime = config.reactionTime;
    this.difficultyParams = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.normal;
  }

  // === Combat Strategy System ===

  private evaluateCombatStrategy(ctx: AIContext): void {
    // Check if map has water (naval potential)
    const hasNavalShipyard = ctx.aiPlayer.buildings.some(b => b.type === BuildingType.NAVAL_SHIPYARD);
    const mapHasWater = hasNavalShipyard || ctx.gameMap.resourceNodes.some(n =>
      n.position.x > ctx.gameMap.width * 64 * 0.3 && n.position.y > ctx.gameMap.height * 64 * 0.3
    );

    const difficulty = this.config.difficulty;

    if (mapHasWater && (difficulty === 'hard' || difficulty === 'brutal')) {
      // On water maps at high difficulty, consider naval strategy
      this.combatStrategy = Math.random() < 0.3 ? 'naval' : 'balanced';
    } else if (difficulty === 'easy') {
      // Easy AI plays defensively
      this.combatStrategy = 'turtle';
    } else if (difficulty === 'hard' || difficulty === 'brutal') {
      // Hard/Brutal: pick from rush, turtle, balanced based on personality
      const roll = Math.random();
      if (roll < 0.35) {
        this.combatStrategy = 'rush';
      } else if (roll < 0.55) {
        this.combatStrategy = 'turtle';
      } else {
        this.combatStrategy = 'balanced';
      }
    } else {
      this.combatStrategy = 'balanced';
    }
  }

  public getCombatStrategy(): AICombatStrategy {
    return this.combatStrategy;
  }

  /** Evaluate whether units should retreat based on being outnumbered 2:1 */
  private evaluateRetreat(ctx: AIContext): AIAction[] {
    const actions: AIAction[] = [];

    // Find combat units that are currently attacking or idle near enemies
    const combatUnits = ctx.aiPlayer.units.filter(u =>
      u.data?.canAttack && (u.state === 'attacking' || u.state === 'idle')
    );

    if (combatUnits.length === 0) return actions;

    // Group nearby enemy units around each combat unit
    for (const unit of combatUnits) {
      const nearbyEnemies = ctx.enemyPlayer.units.filter(e =>
        getDistance(e.position, unit.position) < 300 && e.data?.canAttack
      );
      const nearbyAllies = combatUnits.filter(a =>
        a.id !== unit.id && getDistance(a.position, unit.position) < 300
      );

      const allyCount = nearbyAllies.length + 1; // +1 for self
      const enemyCount = nearbyEnemies.length;

      // Retreat when outnumbered 2:1
      if (enemyCount >= allyCount * 2) {
        const baseLocation = ctx.gameMap.friendlyBaseLocation ||
          ctx.aiPlayer.buildings.find(b => b.type === BuildingType.COMMAND)?.position;

        if (baseLocation) {
          actions.push({
            type: 'retreat',
            unitId: unit.id,
            position: baseLocation,
            priority: 9
          });
        }
      }
    }

    return actions;
  }

  /** Select the most dangerous enemy target for focus fire */
  private selectFocusFireTarget(ctx: AIContext): string | null {
    const enemies = ctx.enemyPlayer.units.filter(u => u.health > 0 && u.data?.canAttack);
    if (enemies.length === 0) return null;

    // Score each enemy: prioritize low health (easy kill) + high damage (dangerous)
    let bestTarget: { id: string; score: number } | null = null;

    for (const enemy of enemies) {
      const healthRatio = enemy.health / enemy.maxHealth;
      const damageScore = enemy.attack || 1;
      // Lower health = higher priority (easy kill), higher damage = higher priority (dangerous)
      const score = (1 - healthRatio) * 5 + damageScore * 0.5;

      if (!bestTarget || score > bestTarget.score) {
        bestTarget = { id: enemy.id, score };
      }
    }

    return bestTarget?.id || null;
  }

  private isBaseUnderAttack(context: AIContext): boolean {
    const baseLocation = context.gameMap.friendlyBaseLocation;
    if (!baseLocation) return false;

    return context.enemyPlayer.units.some(u => 
      getDistance(u.position, baseLocation) < AI_CONFIG.DEFENSE_DISTANCE
    );
  }

  private calculateThreatCenter(ctx: AIContext): { x: number; y: number } {
    const enemies = ctx.enemyPlayer.units.filter(u => u.state === 'attacking');
    if (enemies.length === 0) return { x: 0, y: 0 };

    const sum = enemies.reduce((acc, e) => ({
      x: acc.x + e.position.x,
      y: acc.y + e.position.y
    }), { x: 0, y: 0 });

    return {
      x: sum.x / enemies.length,
      y: sum.y / enemies.length
    };
  }

  private generatePatrolPoints(ctx: AIContext): { x: number; y: number }[] {
    const base = ctx.gameMap.friendlyBaseLocation || 
      ctx.aiPlayer.buildings.find(b => b.type === 'command')?.position ||
      { x: ctx.gameMap.width / 2, y: ctx.gameMap.height / 2 };

    const radius = AI_CONFIG.PATROL_RADIUS;
    return [
      { x: base.x + radius, y: base.y },
      { x: base.x - radius, y: base.y },
      { x: base.x, y: base.y + radius },
      { x: base.x, y: base.y - radius }
    ];
  }

  private canProduceUnits(ctx: AIContext): boolean {
    const factionBuildings = BUILDINGS_BY_FACTION[ctx.aiPlayer.faction as Faction] || {};
    return ctx.aiPlayer.buildings.some(b => {
      if (!b.isConstructed || !b.isPowered) return false;
      const buildingData = factionBuildings[b.type as BuildingType] as BuildingData | undefined;
      const canProduce = (buildingData?.canProduce || b.canProduce || []) as readonly UnitType[];
      return canProduce.length > 0;
    });
  }

  private needHarvesters(ctx: AIContext): boolean {
    const harvesters = ctx.aiPlayer.units.filter(u => u.data?.canHarvest).length;
    const refineries = ctx.aiPlayer.buildings.filter(b => b.isConstructed && b.type === BuildingType.REFINERY).length;

    // Economy focus influences desired harvester count
    const desiredPerRefinery = 2 + Math.floor(this.difficultyParams.economyFocus * 2);
    return harvesters < refineries * desiredPerRefinery && refineries > 0;
  }

  private shouldAttack(ctx: AIContext): boolean {
    if (ctx.threatLevel === 'high' || ctx.threatLevel === 'critical') {
      return false;
    }

    const idleAttackers = ctx.aiPlayer.units.filter(u =>
      u.data?.canAttack && u.state === 'idle'
    );

    // Use difficulty-based attackWaveSize instead of aggressionLevel calculation
    return idleAttackers.length >= this.difficultyParams.attackWaveSize;
  }

  private shouldBuild(ctx: AIContext): boolean {
    const currentBuildings = ctx.aiPlayer.buildings.filter(b => b.isConstructed).length;
    const neededPower = ctx.aiPlayer.powerBalance < 0;
    const lowFunds = ctx.resources.money < AI_CONFIG.LOW_MONEY_THRESHOLD;

    return !lowFunds && (neededPower || currentBuildings < 5);
  }

  private selectUnitToProduce(ctx: AIContext): string | null {
    if (ctx.aiPlayer.powerBalance < -20) {
      return null;
    }

    // Enforce maxUnits limit from difficulty params
    const currentUnitCount = ctx.aiPlayer.units.length;
    if (currentUnitCount >= this.difficultyParams.maxUnits) {
      return null;
    }

    const aiPlayer = ctx.aiPlayer;
    const faction = aiPlayer.faction;

    // Get available unit types from building canProduce data
    const store = useGameStore.getState();
    const storeAiPlayer = store.aiPlayers.find(p => p.faction === faction);
    const researchedUpgrades = new Set(storeAiPlayer?.researchedUpgrades || []);

    const factionBuildings = BUILDINGS_BY_FACTION[faction as Faction] || {};
    const availableUnits: UnitType[] = [];

    // Collect all producible units from constructed buildings
    for (const building of aiPlayer.buildings) {
      if (!building.isConstructed || !building.isPowered) continue;

      // Get canProduce from building data (faction-specific)
      const buildingData = factionBuildings[building.type as BuildingType] as BuildingData | undefined;
      const canProduce = (buildingData?.canProduce || building.canProduce || []) as readonly UnitType[];

      for (const unitType of canProduce) {
        if (!availableUnits.includes(unitType)) {
          // Check tech unlock requirements
          const requiredUpgrade = this.getRequiredUpgradeForUnit(unitType);
          if (requiredUpgrade && !researchedUpgrades.has(requiredUpgrade)) continue;
          availableUnits.push(unitType);
        }
      }
    }

    if (availableUnits.length === 0) return null;

    // Strategic weighting based on game state
    const enemyAirUnits = ctx.enemyPlayer.units.filter(u => u.isAirborne);
    const needsAntiAir = enemyAirUnits.length > 0;
    const minerCount = aiPlayer.units.filter(u => u.type === UnitType.MINER).length;
    const needsMiners = minerCount < 3;
    const engineerCount = aiPlayer.units.filter(u => u.type === UnitType.ENGINEER).length;
    const needsEngineers = engineerCount < 1;

    // Apply economyFocus from difficulty params: higher economyFocus = more harvesters, fewer combat units
    const economyFocus = this.difficultyParams.economyFocus;

    // Weighted selection
    const weighted: Array<{type: UnitType; weight: number}> = [];
    for (const unitType of availableUnits) {
      let weight = 1;
      if (unitType === UnitType.MINER) {
        // Economy focus increases harvester weight
        weight = needsMiners ? (3 + economyFocus * 4) : (0.3 + economyFocus * 0.5);
      }
      if (unitType === UnitType.ROCKET && needsAntiAir) weight = 3;
      if (unitType === UnitType.FLAKINFANTRY && needsAntiAir) weight = 4;
      if (unitType === UnitType.FLAK && needsAntiAir) weight = 4;
      if (unitType === UnitType.ENGINEER) weight = needsEngineers ? 2 : 0.3;
      // Combat units get reduced weight with higher economyFocus
      const militaryMultiplier = 1 - economyFocus * 0.5;
      if (unitType === UnitType.PRISM || unitType === UnitType.APOCALYPSE) weight = 2 * militaryMultiplier;
      if (unitType === UnitType.TESLA || unitType === UnitType.PHANTOM) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.CHRONO) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.GUARDIAN) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.DESPOT) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.APC) weight = 1 * militaryMultiplier;
      if (unitType === UnitType.HELICOPTER) weight = (needsAntiAir ? 1.5 : 1) * militaryMultiplier;
      if (unitType === UnitType.BLACKHAWK) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.KIROV) weight = 1.2 * militaryMultiplier;
      if (unitType === UnitType.YAK) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.DESTROYER) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.SUBMARINE) weight = 1.5 * militaryMultiplier;
      if (unitType === UnitType.TRANSPORT_SHIP) weight = 0.8 * militaryMultiplier;
      if (unitType === UnitType.SOLDIER || unitType === UnitType.CONSCRIPT) weight = 1 * militaryMultiplier;
      if (unitType === UnitType.SNIPER) weight = 1.2 * militaryMultiplier;
      if (unitType === UnitType.TANYA || unitType === UnitType.SEAL) weight = 0.8 * militaryMultiplier;
      if (unitType === UnitType.SPY) weight = 0.5;
      if (unitType === UnitType.TERRORIST) weight = 1 * militaryMultiplier;
      if (unitType === UnitType.IVAN) weight = 0.8 * militaryMultiplier;
      weighted.push({ type: unitType, weight });
    }

    // Weighted random selection
    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.type;
    }
    return weighted[weighted.length - 1].type;
  }

  private getRequiredUpgradeForUnit(unitType: UnitType): UpgradeType | null {
    return UNIT_UPGRADE_REQUIREMENTS[unitType] || null;
  }

  private determineBuildPriority(ctx: AIContext): { type: BuildingType; position: { x: number; y: number }; cost: number }[] {
    const plan: { type: BuildingType; position: { x: number; y: number }; cost: number }[] = [];
    const buildings = ctx.aiPlayer.buildings;
    const money = ctx.resources.money;
    const gameTimeSec = ctx.currentTime;

    const hasBarracks = buildings.some(b => b.type === BuildingType.BARRACKS && b.isConstructed);
    const hasRefinery = buildings.some(b => b.type === BuildingType.REFINERY && b.isConstructed);
    const hasWarFactory = buildings.some(b => b.type === BuildingType.WARFACTORY && b.isConstructed);
    const hasRadar = buildings.some(b => b.type === BuildingType.RADAR && b.isConstructed);
    const hasTech = buildings.some(b => b.type === BuildingType.TECH && b.isConstructed);
    const hasRepair = buildings.some(b => b.type === BuildingType.REPAIR && b.isConstructed);
    const hasHelipad = buildings.some(b => b.type === BuildingType.HELIPAD && b.isConstructed);
    const hasNavalShipyard = buildings.some(b => b.type === BuildingType.NAVAL_SHIPYARD && b.isConstructed);
    const refineryCount = buildings.filter(b => b.type === BuildingType.REFINERY && b.isConstructed).length;
    const powerCount = buildings.filter(b => b.type === BuildingType.POWER).length;
    const defenseCount = buildings.filter(b =>
      [BuildingType.TURRET, BuildingType.TESLA_COIL, BuildingType.FLAME_TOWER, BuildingType.DEFENSE, BuildingType.WALL].includes(b.type as BuildingType) && b.isConstructed
    ).length;

    // 1. Power when negative balance
    if (ctx.aiPlayer.powerBalance < 0) {
      const pos = this.findBestBuildingPosition(BuildingType.POWER, ctx);
      if (pos) plan.push({ type: BuildingType.POWER, position: pos, cost: 600 });
    }

    // 2. First barracks
    if (!hasBarracks) {
      const pos = this.findBestBuildingPosition(BuildingType.BARRACKS, ctx);
      if (pos) plan.push({ type: BuildingType.BARRACKS, position: pos, cost: 500 });
    }

    // 3. First refinery (economy is critical)
    if (!hasRefinery && money >= 2000) {
      const pos = this.findBestBuildingPosition(BuildingType.REFINERY, ctx);
      if (pos) plan.push({ type: BuildingType.REFINERY, position: pos, cost: 2000 });
    }

    // 4. Second refinery for better economy (influenced by economyFocus)
    if (hasRefinery && refineryCount < 2 && money >= 2000) {
      // Higher economyFocus = more likely to build 2nd refinery earlier
      const shouldBuildSecondRefinery = this.difficultyParams.economyFocus > 0.4 ||
        gameTimeSec > this.difficultyParams.expandTiming;
      if (shouldBuildSecondRefinery) {
        const pos = this.findBestBuildingPosition(BuildingType.REFINERY, ctx);
        if (pos) plan.push({ type: BuildingType.REFINERY, position: pos, cost: 2000 });
      }
    }

    // 5. War factory
    if (!hasWarFactory && hasRefinery && money >= 3000) {
      const pos = this.findBestBuildingPosition(BuildingType.WARFACTORY, ctx);
      if (pos) plan.push({ type: BuildingType.WARFACTORY, position: pos, cost: 3000 });
    }

    // 6. Radar
    if (!hasRadar && hasWarFactory && money >= 1500) {
      const pos = this.findBestBuildingPosition(BuildingType.RADAR, ctx);
      if (pos) plan.push({ type: BuildingType.RADAR, position: pos, cost: 1500 });
    }

    // 7. Tech center (techRush: build earlier; otherwise normal timing)
    if (!hasTech && hasRadar && money >= 2500) {
      // Tech rush: build tech as soon as radar is up
      // Non-tech-rush: wait until mid game
      if (this.difficultyParams.techRush || gameTimeSec > 300) {
        const pos = this.findBestBuildingPosition(BuildingType.TECH, ctx);
        if (pos) plan.push({ type: BuildingType.TECH, position: pos, cost: 2500 });
      }
    }

    // 8. Helipad (if faction has one)
    if (!hasHelipad && hasWarFactory && money >= 1000) {
      const pos = this.findBestBuildingPosition(BuildingType.HELIPAD, ctx);
      if (pos) plan.push({ type: BuildingType.HELIPAD, position: pos, cost: 1000 });
    }

    // 9. Repair facility
    if (!hasRepair && hasWarFactory && money >= 1500) {
      const pos = this.findBestBuildingPosition(BuildingType.REPAIR, ctx);
      if (pos) plan.push({ type: BuildingType.REPAIR, position: pos, cost: 1500 });
    }

    // 10. Naval shipyard (late game, based on expandTiming)
    if (!hasNavalShipyard && hasRadar && money >= 2000 && gameTimeSec > this.difficultyParams.expandTiming) {
      const pos = this.findBestBuildingPosition(BuildingType.NAVAL_SHIPYARD, ctx);
      if (pos) plan.push({ type: BuildingType.NAVAL_SHIPYARD, position: pos, cost: 1500 });
    }

    // 11. Defense buildings (turtle strategy builds more defenses)
    const desiredDefenseCount = this.combatStrategy === 'turtle' ? 5 : 3;
    if (defenseCount < desiredDefenseCount && hasBarracks && money >= 600) {
      const defenseType = this.selectDefenseBuilding(ctx);
      if (defenseType) {
        const pos = this.findBestBuildingPosition(defenseType, ctx);
        if (pos) plan.push({ type: defenseType, position: pos, cost: 800 });
      }
    }

    // 12. Extra power for late game
    if (powerCount < 5 && money >= 800) {
      const pos = this.findBestBuildingPosition(BuildingType.POWER, ctx);
      if (pos) plan.push({ type: BuildingType.POWER, position: pos, cost: 800 });
    }

    // 13. Third refinery for late game economy (based on expandTiming)
    if (refineryCount >= 2 && refineryCount < 3 && hasWarFactory && money >= 2000 &&
        gameTimeSec > this.difficultyParams.expandTiming) {
      const pos = this.findBestBuildingPosition(BuildingType.REFINERY, ctx);
      if (pos) plan.push({ type: BuildingType.REFINERY, position: pos, cost: 2000 });
    }

    return plan;
  }

  private selectDefenseBuilding(ctx: AIContext): BuildingType | null {
    const factionGroup = getFactionGroup(ctx.aiPlayer.faction as import('../../types').Faction);
    // Soviet factions: flame tower and tesla coil
    if (factionGroup === FactionGroup.SOVIET) {
      return Math.random() < 0.5 ? BuildingType.FLAME_TOWER : BuildingType.TESLA_COIL;
    }
    // Allied factions: turret and defense (patriot missile)
    return Math.random() < 0.6 ? BuildingType.TURRET : BuildingType.DEFENSE;
  }

  /**
   * Find the best position to place a building, avoiding overlaps and blocking paths.
   * Scores candidate positions based on adjacency, distance to key buildings, and path blocking.
   */
  private findBestBuildingPosition(
    buildingType: BuildingType,
    ctx: AIContext
  ): Vector2 | null {
    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction);
    if (!aiPlayer) return null;

    const map = store.map;
    if (!map) return null;

    // Get building dimensions from faction data
    const buildingData = BUILDINGS_BY_FACTION[aiPlayer.faction as Faction]?.[buildingType] as BuildingData | undefined;
    const buildingWidth = buildingData?.width ?? 2;
    const buildingHeight = buildingData?.height ?? 2;

    const existingBuildings = aiPlayer.buildings.filter(b => b.isConstructed);
    if (existingBuildings.length === 0) return null;

    const candidates: Array<{ pos: Vector2; score: number }> = [];

    for (const existing of existingBuildings) {
      // Try positions around the existing building (in tile units, then convert to world)
      const existingTileX = Math.floor(existing.position.x / GAME_CONFIG.TILE_SIZE);
      const existingTileY = Math.floor(existing.position.y / GAME_CONFIG.TILE_SIZE);
      const existingTileW = existing.width;
      const existingTileH = existing.height;

      const offsets = [
        { x: -(buildingWidth), y: 0 },                    // Left
        { x: existingTileW, y: 0 },                       // Right
        { x: 0, y: -(buildingHeight) },                   // Above
        { x: 0, y: existingTileH },                       // Below
        { x: -(buildingWidth), y: -(buildingHeight) },    // Top-left
        { x: existingTileW, y: -(buildingHeight) },       // Top-right
        { x: -(buildingWidth), y: existingTileH },        // Bottom-left
        { x: existingTileW, y: existingTileH },           // Bottom-right
      ];

      for (const offset of offsets) {
        const candidateTileX = existingTileX + offset.x;
        const candidateTileY = existingTileY + offset.y;

        // Check bounds
        if (candidateTileX < 0 || candidateTileY < 0) continue;
        if (candidateTileX + buildingWidth > map.width) continue;
        if (candidateTileY + buildingHeight > map.height) continue;

        const candidateX = candidateTileX * GAME_CONFIG.TILE_SIZE;
        const candidateY = candidateTileY * GAME_CONFIG.TILE_SIZE;

        // Check overlap with existing buildings
        const overlaps = existingBuildings.some(b => {
          const bRight = b.position.x + b.width * GAME_CONFIG.TILE_SIZE;
          const bBottom = b.position.y + b.height * GAME_CONFIG.TILE_SIZE;
          const cRight = candidateX + buildingWidth * GAME_CONFIG.TILE_SIZE;
          const cBottom = candidateY + buildingHeight * GAME_CONFIG.TILE_SIZE;
          return candidateX < bRight && cRight > b.position.x &&
                 candidateY < bBottom && cBottom > b.position.y;
        });
        if (overlaps) continue;

        // Check if buildable terrain
        let allBuildable = true;
        for (let dy = 0; dy < buildingHeight; dy++) {
          for (let dx = 0; dx < buildingWidth; dx++) {
            const tile = map.tiles[candidateTileY + dy]?.[candidateTileX + dx];
            if (!tile || !tile.buildable) {
              allBuildable = false;
              break;
            }
          }
          if (!allBuildable) break;
        }
        if (!allBuildable) continue;

        // Score this position
        let score = 0;

        // Find command center for distance calculations
        const commandCenter = existingBuildings.find(b => b.type === BuildingType.COMMAND);

        // Prefer positions close to command center (compact base)
        if (commandCenter) {
          const distToCC = Math.abs(candidateX - commandCenter.position.x) + Math.abs(candidateY - commandCenter.position.y);
          score -= distToCC * 0.01;
        }

        // Defense buildings prefer to be on the perimeter
        const isDefense = [BuildingType.TURRET, BuildingType.TESLA_COIL, BuildingType.FLAME_TOWER, BuildingType.DEFENSE, BuildingType.WALL].includes(buildingType);
        if (isDefense && commandCenter) {
          const distToCC = Math.abs(candidateX - commandCenter.position.x) + Math.abs(candidateY - commandCenter.position.y);
          score += distToCC * 0.005;
        }

        // Economic buildings prefer to be near refineries
        const isEconomic = [BuildingType.REFINERY, BuildingType.POWER, BuildingType.OIL_DERRICK].includes(buildingType);
        if (isEconomic) {
          const refineries = existingBuildings.filter(b => b.type === BuildingType.REFINERY);
          if (refineries.length > 0) {
            const nearestRefineryDist = Math.min(...refineries.map(r =>
              Math.abs(candidateX - r.position.x) + Math.abs(candidateY - r.position.y)
            ));
            score -= nearestRefineryDist * 0.005;
          }
        }

        // Refineries strongly prefer positions near unharvested resource nodes
        if (buildingType === BuildingType.REFINERY) {
          const resourceNodes = ctx.gameMap.resourceNodes;
          if (resourceNodes.length > 0) {
            // Find nearest resource node to this candidate position
            let nearestResourceDist = Infinity;
            for (const node of resourceNodes) {
              const nodeWorldX = node.position.x * GAME_CONFIG.TILE_SIZE;
              const nodeWorldY = node.position.y * GAME_CONFIG.TILE_SIZE;
              const dist = Math.abs(candidateX - nodeWorldX) + Math.abs(candidateY - nodeWorldY);
              if (dist < nearestResourceDist) {
                nearestResourceDist = dist;
              }
            }
            // Strong bonus for being close to resources (overrides compact base preference)
            score += Math.max(0, 50 - nearestResourceDist * 0.02);
          }
        }

        // Penalize positions that block paths between command center and resource nodes
        const resourceNodes = ctx.gameMap.resourceNodes;
        if (commandCenter && resourceNodes.length > 0) {
          for (const node of resourceNodes) {
            const nodeWorldX = node.position.x;
            const nodeWorldY = node.position.y;
            const ccToNodeDist = Math.abs(commandCenter.position.x - nodeWorldX) + Math.abs(commandCenter.position.y - nodeWorldY);
            const ccToCandidateDist = Math.abs(commandCenter.position.x - candidateX) + Math.abs(commandCenter.position.y - candidateY);
            const candidateToNodeDist = Math.abs(candidateX - nodeWorldX) + Math.abs(candidateY - nodeWorldY);
            // If candidate is roughly on the path between CC and resource, penalize
            if (ccToCandidateDist + candidateToNodeDist < ccToNodeDist * 1.3) {
              score -= 5;
            }
          }
        }

        // Prefer positions adjacent to more existing buildings (compact base)
        const adjacentCount = existingBuildings.filter(b => {
          const dist = Math.abs(candidateX - b.position.x) + Math.abs(candidateY - b.position.y);
          return dist < GAME_CONFIG.TILE_SIZE * 4; // Within 4 tiles
        }).length;
        score += adjacentCount * 0.5;

        candidates.push({ pos: { x: candidateX, y: candidateY }, score });
      }
    }

    // For refineries, also consider positions near distant resource nodes (expansion)
    if (buildingType === BuildingType.REFINERY) {
      const resourceNodes = ctx.gameMap.resourceNodes;
      for (const node of resourceNodes) {
        const nodeWorldX = node.position.x * GAME_CONFIG.TILE_SIZE;
        const nodeWorldY = node.position.y * GAME_CONFIG.TILE_SIZE;
        const nodeTileX = Math.floor(node.position.x);
        const nodeTileY = Math.floor(node.position.y);

        // Try positions adjacent to the resource node
        const nodeOffsets = [
          { x: -(buildingWidth), y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: -(buildingHeight) },
          { x: 0, y: 1 },
        ];

        for (const offset of nodeOffsets) {
          const candidateTileX = nodeTileX + offset.x;
          const candidateTileY = nodeTileY + offset.y;

          if (candidateTileX < 0 || candidateTileY < 0) continue;
          if (candidateTileX + buildingWidth > map.width) continue;
          if (candidateTileY + buildingHeight > map.height) continue;

          const candidateX = candidateTileX * GAME_CONFIG.TILE_SIZE;
          const candidateY = candidateTileY * GAME_CONFIG.TILE_SIZE;

          // Check overlap
          const overlaps = existingBuildings.some(b => {
            const bRight = b.position.x + b.width * GAME_CONFIG.TILE_SIZE;
            const bBottom = b.position.y + b.height * GAME_CONFIG.TILE_SIZE;
            const cRight = candidateX + buildingWidth * GAME_CONFIG.TILE_SIZE;
            const cBottom = candidateY + buildingHeight * GAME_CONFIG.TILE_SIZE;
            return candidateX < bRight && cRight > b.position.x &&
                   candidateY < bBottom && cBottom > b.position.y;
          });
          if (overlaps) continue;

          // Check buildable
          let allBuildable = true;
          for (let dy = 0; dy < buildingHeight; dy++) {
            for (let dx = 0; dx < buildingWidth; dx++) {
              const tile = map.tiles[candidateTileY + dy]?.[candidateTileX + dx];
              if (!tile || !tile.buildable) {
                allBuildable = false;
                break;
              }
            }
            if (!allBuildable) break;
          }
          if (!allBuildable) continue;

          // Score: very close to resource node = high score
          let score = 80; // Base score for being next to a resource node
          // Small penalty for being far from existing base (need some base connection)
          const commandCenter = existingBuildings.find(b => b.type === BuildingType.COMMAND);
          if (commandCenter) {
            const distToCC = Math.abs(candidateX - commandCenter.position.x) + Math.abs(candidateY - commandCenter.position.y);
            score -= distToCC * 0.003; // Mild penalty for distance
          }
          // Bonus for adjacency to any existing building
          const adjacentCount = existingBuildings.filter(b => {
            const dist = Math.abs(candidateX - b.position.x) + Math.abs(candidateY - b.position.y);
            return dist < GAME_CONFIG.TILE_SIZE * 6;
          }).length;
          score += adjacentCount * 0.3;

          candidates.push({ pos: { x: candidateX, y: candidateY }, score });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by score (highest first) and return the best position
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].pos;
  }

  private cleanupCooldowns(): void {
    const now = this.getGameTimeMs();
    for (const [key, time] of this.actionCooldowns.entries()) {
      if (now > time) {
        this.actionCooldowns.delete(key);
      }
    }
  }

  private canBuildSuperweapon(ctx: AIContext): boolean {
    // Difficulty check: some difficulties don't use superweapons
    if (!this.difficultyParams.superweaponUse) return false;

    const hasTech = ctx.aiPlayer.buildings.some(b => b.type === BuildingType.TECH && b.isConstructed);
    if (!hasTech) return false;

    const factionGroup = getFactionGroup(ctx.aiPlayer.faction as import('../../types').Faction);
    const superweaponTypes = factionGroup === FactionGroup.SOVIET
      ? [BuildingType.NUCLEAR_SILO, BuildingType.IRON_CURTAIN]
      : [BuildingType.CHRONOSPHERE];

    const hasSuperweapon = ctx.aiPlayer.buildings.some(b =>
      superweaponTypes.includes(b.type as BuildingType)
    );

    // Can build if we don't have one yet and have enough money
    return !hasSuperweapon && ctx.resources.money >= 2500;
  }

  private createSuperweaponSequence(): BehaviorNode {
    const sequence = new SequenceNode('superweapon_seq', 'Superweapon Sequence');

    sequence.addChild(
      new ActionNode('build_superweapon', 'Build Superweapon', (ctx: AIContext): BehaviorNodeStatus => {
        const factionGroup = getFactionGroup(ctx.aiPlayer.faction as import('../../types').Faction);
        let targetBuilding: BuildingType;

        if (factionGroup === FactionGroup.SOVIET) {
          // Prefer nuke if we have lots of money, iron curtain otherwise
          targetBuilding = ctx.resources.money >= 5000 ? BuildingType.NUCLEAR_SILO : BuildingType.IRON_CURTAIN;
        } else {
          targetBuilding = BuildingType.CHRONOSPHERE;
        }

        // Find best placement position using smart positioning
        const position = this.findBestBuildingPosition(targetBuilding, ctx);
        if (!position) return 'failure';

        this.pendingActions.push({
          type: 'build',
          buildingId: targetBuilding,
          position,
          priority: 5
        });

        return 'success';
      })
    );

    return sequence;
  }

  private manageTransports(ctx: AIContext): AIAction[] {
    const actions: AIAction[] = [];
    const aiPlayer = ctx.aiPlayer;

    // Find empty idle transports
    const transports = aiPlayer.units.filter(u =>
      u.maxPassengers && (!u.passengers || u.passengers.length === 0) && u.state === 'idle'
    );

    // Find full or near-enemy-base transports that should unload
    const fullTransports = aiPlayer.units.filter(u =>
      u.maxPassengers && u.passengers && u.passengers.length > 0 && u.state === 'idle'
    );

    // Unload transports that are full or near enemy base
    for (const transport of fullTransports) {
      const isFull = transport.passengers && transport.passengers.length >= (transport.maxPassengers || 0);
      const enemyBase = ctx.gameMap.enemyBaseLocation;
      const nearEnemyBase = enemyBase && getDistance(transport.position, enemyBase) < 300;

      if (isFull || nearEnemyBase) {
        actions.push({
          type: 'unloadTransport',
          transportId: transport.id,
          position: { ...transport.position },
          priority: 4
        });
      }
    }

    if (transports.length === 0) return actions;

    // Find infantry not in a transport (idle, defending, or moving - not attacking/retreating)
    const infantryTypes = new Set([
      UnitType.SOLDIER, UnitType.ENGINEER, UnitType.ROCKET, UnitType.SNIPER,
      UnitType.TANYA, UnitType.SEAL, UnitType.CONSCRIPT, UnitType.FLAKINFANTRY,
      UnitType.TERRORIST, UnitType.IVAN, UnitType.CHRONO, UnitType.SPY,
    ]);
    const infantry = aiPlayer.units.filter(u =>
      infantryTypes.has(u.type as UnitType) && !u.transportId &&
      (u.state === 'idle' || u.state === 'defending' || u.state === 'moving')
    );

    if (infantry.length === 0) return actions;

    // Load nearest infantry into nearest transport
    for (const transport of transports) {
      const nearbyInfantry = infantry
        .filter(i => getDistance(i.position, transport.position) < 200)
        .slice(0, transport.maxPassengers!);

      for (const inf of nearbyInfantry) {
        actions.push({
          type: 'loadTransport',
          infantryId: inf.id,
          transportId: transport.id,
          priority: 3
        });
      }
    }

    return actions;
  }

  private manageSuperweapons(ctx: AIContext): AIAction[] {
    const actions: AIAction[] = [];
    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction);
    if (!aiPlayer) return actions;

    for (const building of aiPlayer.buildings) {
      if (!building.superweaponReady || !building.isConstructed) continue;

      // Cooldown: don't activate too frequently
      const cooldownKey = `superweapon_${building.id}`;
      if (this.actionCooldowns.has(cooldownKey)) continue;

      if (building.type === BuildingType.NUCLEAR_SILO) {
        // Target enemy base
        const enemyBase = ctx.gameMap.enemyBaseLocation;
        if (enemyBase) {
          actions.push({
            type: 'activateSuperweapon',
            buildingId: building.id,
            position: enemyBase,
            priority: 8
          });
          this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 10000);
        }
      } else if (building.type === BuildingType.IRON_CURTAIN) {
        // Target cluster of friendly units near enemy base
        const combatUnits = aiPlayer.units.filter(u =>
          u.data?.canAttack && u.state !== 'idle'
        );
        if (combatUnits.length >= 3) {
          // Find center of combat units
          const centerX = combatUnits.reduce((s, u) => s + u.position.x, 0) / combatUnits.length;
          const centerY = combatUnits.reduce((s, u) => s + u.position.y, 0) / combatUnits.length;
          actions.push({
            type: 'activateSuperweapon',
            buildingId: building.id,
            position: { x: centerX, y: centerY },
            priority: 7
          });
          this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 10000);
        }
      } else if (building.type === BuildingType.CHRONOSPHERE) {
        // Teleport units from base to near enemy base
        const enemyBase = ctx.gameMap.enemyBaseLocation;
        const friendlyBase = ctx.gameMap.friendlyBaseLocation;
        if (enemyBase && friendlyBase) {
          const idleCombatUnits = aiPlayer.units.filter(u =>
            u.data?.canAttack && u.state === 'idle' &&
            getDistance(u.position, friendlyBase) < 300
          );
          if (idleCombatUnits.length >= 3) {
            actions.push({
              type: 'activateChronosphere',
              buildingId: building.id,
              position: friendlyBase,
              targetPosition: { x: enemyBase.x - 100, y: enemyBase.y - 100 },
              priority: 8
            });
            this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 10000);
          }
        }
      }
    }

    return actions;
  }

  private respondToSuperweaponThreat(ctx: AIContext): AIAction[] {
    const actions: AIAction[] = [];
    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction);
    if (!aiPlayer) return actions;

    // Check if any enemy player has a ready superweapon
    const enemyPlayers = [store.currentPlayer, ...store.aiPlayers].filter(
      p => p && p.id !== aiPlayer.id && !p.isDefeated &&
        getFactionGroup(p.faction as Faction) !== getFactionGroup(aiPlayer.faction as Faction)
    );

    for (const enemy of enemyPlayers) {
      const readySuperweapons = enemy.buildings.filter(b => b.superweaponReady && b.isConstructed);
      for (const sw of readySuperweapons) {
        const cooldownKey = `evade_sw_${sw.id}`;
        if (this.actionCooldowns.has(cooldownKey)) continue;

        // Nuclear silo: evacuate units near base center
        if (sw.type === BuildingType.NUCLEAR_SILO) {
          const baseCenter = ctx.gameMap.friendlyBaseLocation;
          if (!baseCenter) continue;

          const unitsNearBase = aiPlayer.units.filter(u =>
            u.data?.canAttack && u.state !== 'attacking' &&
            getDistance(u.position, baseCenter) < 300
          );

          if (unitsNearBase.length >= 2) {
            for (const unit of unitsNearBase.slice(0, 6)) {
              actions.push({
                type: 'scatter',
                unitId: unit.id,
                position: unit.position,
                priority: 9
              });
            }
            this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 15000);
          }
        }
        // Chronosphere: reinforce base defense
        else if (sw.type === BuildingType.CHRONOSPHERE) {
          const baseCenter = ctx.gameMap.friendlyBaseLocation;
          if (!baseCenter) continue;

          // Move idle defenders toward base
          const idleDefenders = aiPlayer.units.filter(u =>
            u.data?.canAttack && u.state === 'idle' &&
            getDistance(u.position, baseCenter) > 200
          );

          if (idleDefenders.length >= 2) {
            for (const unit of idleDefenders.slice(0, 4)) {
              actions.push({
                type: 'defend',
                unitId: unit.id,
                position: baseCenter,
                priority: 7
              });
            }
            this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 20000);
          }
        }
        // Iron Curtain: prepare to focus fire on invulnerable units after effect ends
        else if (sw.type === BuildingType.IRON_CURTAIN) {
          // No immediate action needed - iron curtain is short duration
          // Just set a cooldown to avoid repeated checks
          this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 20000);
        }
      }
    }

    return actions;
  }

  private manageSellBuildings(ctx: AIContext): AIAction[] {
    const actions: AIAction[] = [];
    // Only sell when critically low on funds
    if (ctx.resources.money > 500) return actions;

    const cooldownKey = 'sell_buildings';
    if (this.actionCooldowns.has(cooldownKey)) return actions;

    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction);
    if (!aiPlayer) return actions;

    // Find heavily damaged or redundant buildings to sell
    const sellableBuildings = aiPlayer.buildings.filter(b =>
      b.isConstructed && b.type !== BuildingType.COMMAND &&
      b.type !== BuildingType.BARRACKS && b.type !== BuildingType.WARFACTORY &&
      b.type !== BuildingType.REFINERY && b.type !== BuildingType.POWER
    );

    // Sort by health ratio (sell most damaged first) then by cost (sell cheapest first)
    sellableBuildings.sort((a, b) => {
      const healthRatioA = a.health / a.maxHealth;
      const healthRatioB = b.health / b.maxHealth;
      if (healthRatioA !== healthRatioB) return healthRatioA - healthRatioB;
      return (a.data.cost || 0) - (b.data.cost || 0);
    });

    // Sell up to 2 buildings
    for (let i = 0; i < Math.min(2, sellableBuildings.length); i++) {
      const building = sellableBuildings[i];
      actions.push({
        type: 'sellBuilding' as AIActionType,
        buildingId: building.id,
        priority: 3
      });
    }

    if (actions.length > 0) {
      this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 30000);
    }

    return actions;
  }

  private manageChronoAbilities(ctx: AIContext): AIAction[] {
    const actions: AIAction[] = [];
    const store = useGameStore.getState();
    const aiPlayer = store.aiPlayers.find(p => p.faction === ctx.aiPlayer.faction);
    if (!aiPlayer) return actions;

    // Find Chrono Legionnaires that are idle and not on cooldown
    const chronoUnits = aiPlayer.units.filter(u =>
      u.type === UnitType.CHRONO && !u.isChronoShifting && !u.isChronoCooldown &&
      (u.state === 'idle' || u.state === UnitState.GUARDING)
    );

    if (chronoUnits.length === 0) return actions;

    // Cooldown: don't chrono shift too frequently
    const cooldownKey = 'chrono_shift';
    if (this.actionCooldowns.has(cooldownKey)) return actions;

    for (const chrono of chronoUnits) {
      // Find enemy units or buildings to teleport near
      const enemyTargets = ctx.enemyPlayer.units.filter(u =>
        u.data?.canAttack && u.health > u.maxHealth * 0.3
      );

      if (enemyTargets.length === 0) continue;

      // Find the nearest enemy cluster
      const target = enemyTargets.reduce((best, enemy) => {
        const nearbyEnemies = enemyTargets.filter(e =>
          getDistance(e.position, enemy.position) < 200
        );
        if (nearbyEnemies.length > best.count) {
          return { enemy, count: nearbyEnemies.length };
        }
        return best;
      }, { enemy: enemyTargets[0], count: 0 });

      if (target.count >= 2) {
        // Teleport to a position near the enemy cluster but at attack range
        const targetPos = target.enemy.position;
        const dx = chrono.position.x - targetPos.x;
        const dy = chrono.position.y - targetPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Only chrono shift if far enough away to make it worthwhile
        if (dist > 400) {
          const chronoRange = (chrono.attackRange || 6) * GAME_CONFIG.TILE_SIZE;
          const shiftPos = {
            x: Math.max(0, Math.min(ctx.gameMap.width * GAME_CONFIG.TILE_SIZE,
              targetPos.x + (dx / dist) * chronoRange)),
            y: Math.max(0, Math.min(ctx.gameMap.height * GAME_CONFIG.TILE_SIZE,
              targetPos.y + (dy / dist) * chronoRange)),
          };

          actions.push({
            type: 'chronoShift',
            unitId: chrono.id,
            position: shiftPos,
            priority: 6
          });
          this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 8000);
          break; // Only one chrono shift per update cycle
        }
      }
    }

    return actions;
  }

  // === Garrison System ===

  private canGarrison(ctx: AIContext): boolean {
    const infantryUnits = ctx.aiPlayer.units.filter(u =>
      u.data.canGarrison && u.state === UnitState.IDLE
    );
    if (infantryUnits.length === 0) return false;

    const allBuildings = [
      ...ctx.aiPlayer.buildings,
      ...ctx.neutralBuildings,
    ].filter(b => b.isGarrisonable && (b.garrisonedUnits?.length ?? 0) < (b.maxGarrison ?? 0));

    return allBuildings.length > 0;
  }

  private createGarrisonSequence(): BehaviorNode {
    return new ActionNode('garrison_infantry', 'Garrison Infantry in Buildings', (ctx) => {
      const actions: AIAction[] = [];
      const infantryUnits = ctx.aiPlayer.units.filter(u =>
        u.data.canGarrison && u.state === UnitState.IDLE
      );

      const garrisonableBuildings = [
        ...ctx.aiPlayer.buildings,
        ...ctx.neutralBuildings,
      ].filter(b => b.isGarrisonable && (b.garrisonedUnits?.length ?? 0) < (b.maxGarrison ?? 0));

      for (const building of garrisonableBuildings) {
        const remaining = (building.maxGarrison ?? 0) - (building.garrisonedUnits?.length ?? 0);
        const nearbyInfantry = infantryUnits
          .filter(u => !u.garrisonedBuildingId)
          .sort((a, b) => getDistance(a.position, building.position) - getDistance(b.position, building.position))
          .slice(0, remaining);

        for (const unit of nearbyInfantry) {
          actions.push({
            type: 'garrison' as AIActionType,
            unitId: unit.id,
            buildingId: building.id,
            priority: 4
          });
        }
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }

  // === Deploy System ===

  private canDeployMCV(ctx: AIContext): boolean {
    return ctx.aiPlayer.units.some(u => u.data.canDeploy && u.state === UnitState.IDLE);
  }

  private createDeploySequence(): BehaviorNode {
    return new ActionNode('deploy_mcv', 'Deploy MCV to Establish Forward Base', (ctx) => {
      const actions: AIAction[] = [];
      const deployableUnits = ctx.aiPlayer.units.filter(u =>
        u.data.canDeploy && u.state === UnitState.IDLE
      );

      for (const unit of deployableUnits) {
        // Only deploy if we don't already have the building type
        const buildingType = unit.data.deployBuildingType;
        if (buildingType) {
          const hasBuilding = ctx.aiPlayer.buildings.some(b => b.type === buildingType && b.isConstructed);
          // Deploy MCV only if we lost our command center or want a forward base
          if (!hasBuilding || ctx.aiPlayer.buildings.filter(b => b.type === buildingType).length < 2) {
            actions.push({
              type: 'deploy' as AIActionType,
              unitId: unit.id,
              priority: 8
            });
          }
        }
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }

  private canRepairBridge(ctx: AIContext): boolean {
    // Check if there are destroyed bridges and we have engineers
    const hasEngineers = ctx.aiPlayer.units.some(u => u.data.canCapture);
    const hasDestroyedBridges = ctx.neutralBuildings?.some(b => b.isBridge && b.isBridgeDestroyed) || false;
    return hasEngineers && hasDestroyedBridges;
  }

  private createRepairBridgeSequence(): BehaviorNode {
    return new ActionNode('repair_bridge', 'Repair Destroyed Bridge', (ctx) => {
      const actions: AIAction[] = [];
      const destroyedBridges = ctx.neutralBuildings?.filter(b => b.isBridge && b.isBridgeDestroyed) || [];

      for (const bridge of destroyedBridges) {
        // Find nearest engineer
        const engineers = ctx.aiPlayer.units.filter(u =>
          u.data.canCapture && u.state === UnitState.IDLE
        );
        if (engineers.length > 0) {
          let nearestEngineer = engineers[0];
          let nearestDist = Infinity;
          for (const eng of engineers) {
            const dist = getDistance(eng.position, bridge.position);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestEngineer = eng;
            }
          }
          actions.push({
            type: 'repairBridge' as AIActionType,
            unitId: nearestEngineer.id,
            buildingId: bridge.id,
            priority: 5
          });
        }
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }

  // === Spy Infiltration System ===

  private createSpyInfiltrateSequence(): BehaviorNode {
    return new ActionNode('spy_infiltrate', 'Spy Infiltration', (ctx) => {
      const actions: AIAction[] = [];
      const spies = ctx.aiPlayer.units.filter(u =>
        u.type === UnitType.SPY && (u.state === 'idle' || u.state === 'defending')
      );

      if (spies.length === 0) return 'failure';

      // Priority: REFINERY > POWER > TECH > WARFACTORY > BARRACKS
      const INFILTRATE_PRIORITY: Record<string, number> = {
        [BuildingType.REFINERY]: 5,
        [BuildingType.POWER]: 4,
        [BuildingType.TECH]: 3,
        [BuildingType.WARFACTORY]: 2,
        [BuildingType.BARRACKS]: 1,
      };

      const enemyBuildings = ctx.enemyPlayer.buildings.filter(b => b.isConstructed);
      const targetBuildings = enemyBuildings
        .filter(b => INFILTRATE_PRIORITY[b.type] !== undefined)
        .sort((a, b) => (INFILTRATE_PRIORITY[b.type] || 0) - (INFILTRATE_PRIORITY[a.type] || 0));

      if (targetBuildings.length === 0) return 'failure';

      const target = targetBuildings[0];

      for (const spy of spies) {
        actions.push({
          type: 'spyInfiltrate' as AIActionType,
          unitId: spy.id,
          targetId: target.id,
          position: target.position,
          priority: 6
        });
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }

  // === Chrono Ambush System ===

  private createChronoAmbushSequence(): BehaviorNode {
    return new ActionNode('chrono_ambush', 'Chrono Ambush', (ctx) => {
      const actions: AIAction[] = [];
      const chronoUnits = ctx.aiPlayer.units.filter(u =>
        u.type === UnitType.CHRONO && !u.isChronoShifting && !u.isChronoCooldown &&
        (u.state === 'idle' || u.state === 'defending')
      );

      if (chronoUnits.length === 0) return 'failure';

      // Cooldown: don't chrono ambush too frequently
      const cooldownKey = 'chrono_ambush';
      if (this.actionCooldowns.has(cooldownKey)) return 'failure';

      // Find enemy unit clusters
      const enemyUnits = ctx.enemyPlayer.units.filter(u => u.health > 0);
      if (enemyUnits.length === 0) return 'failure';

      // Priority targets: harvesters, artillery units
      const PRIORITY_TARGETS = new Set([UnitType.MINER, UnitType.WAR_MINER, UnitType.SLAVE_MINER, UnitType.KIROV, UnitType.DREADNOUGHT]);

      // Find best cluster to ambush
      let bestTarget: { position: Vector2; score: number } | null = null;

      for (const enemy of enemyUnits) {
        const nearbyEnemies = enemyUnits.filter(e =>
          getDistance(e.position, enemy.position) < 200
        );

        let score = nearbyEnemies.length;
        // Bonus for priority targets in cluster
        if (PRIORITY_TARGETS.has(enemy.type as UnitType)) {
          score += 5;
        }

        if (!bestTarget || score > bestTarget.score) {
          bestTarget = { position: enemy.position, score };
        }
      }

      if (!bestTarget) return 'failure';

      for (const chrono of chronoUnits.slice(0, 1)) { // Only one chrono shift per cycle
        // Teleport behind enemy lines
        const dx = chrono.position.x - bestTarget.position.x;
        const dy = chrono.position.y - bestTarget.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Only chrono shift if far enough to be worthwhile
        if (dist > 300) {
          const chronoRange = (chrono.range || 6) * GAME_CONFIG.TILE_SIZE;
          const shiftPos = {
            x: Math.max(0, Math.min(ctx.gameMap.width * GAME_CONFIG.TILE_SIZE,
              bestTarget.position.x + (dx / dist) * chronoRange)),
            y: Math.max(0, Math.min(ctx.gameMap.height * GAME_CONFIG.TILE_SIZE,
              bestTarget.position.y + (dy / dist) * chronoRange)),
          };

          actions.push({
            type: 'chronoAmbush' as AIActionType,
            unitId: chrono.id,
            position: shiftPos,
            priority: 7
          });
          this.actionCooldowns.set(cooldownKey, this.getGameTimeMs() + 10000);
        }
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }

  // === Ivan Sabotage System ===

  private createIvanSabotageSequence(): BehaviorNode {
    return new ActionNode('ivan_sabotage', 'Ivan Sabotage', (ctx) => {
      const actions: AIAction[] = [];
      const ivanUnits = ctx.aiPlayer.units.filter(u =>
        u.type === UnitType.IVAN && (u.state === 'idle' || u.state === 'defending')
      );

      if (ivanUnits.length === 0) return 'failure';

      // Find high-value enemy buildings or unit clusters
      const enemyBuildings = ctx.enemyPlayer.buildings.filter(b => b.isConstructed);
      const enemyUnits = ctx.enemyPlayer.units.filter(u => u.health > 0);

      // Priority: buildings with low health, or clusters of units
      let bestTarget: { id: string; position: Vector2; score: number } | null = null;

      // Check buildings
      for (const building of enemyBuildings) {
        const healthRatio = building.health / building.maxHealth;
        const score = 10 - healthRatio * 5; // Lower health = higher priority
        if (!bestTarget || score > bestTarget.score) {
          bestTarget = { id: building.id, position: building.position, score };
        }
      }

      // Check unit clusters
      for (const unit of enemyUnits) {
        const nearby = enemyUnits.filter(e => getDistance(e.position, unit.position) < 100);
        const score = nearby.length * 2;
        if (score > (bestTarget?.score ?? 0)) {
          bestTarget = { id: unit.id, position: unit.position, score };
        }
      }

      if (!bestTarget) return 'failure';

      for (const ivan of ivanUnits) {
        actions.push({
          type: 'ivanSabotage' as AIActionType,
          unitId: ivan.id,
          targetId: bestTarget.id,
          position: bestTarget.position,
          priority: 6
        });
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }

  // === Desolator Deploy System ===

  private createDesolatorDeploySequence(): BehaviorNode {
    return new ActionNode('desolator_deploy', 'Desolator Deploy Radiation', (ctx) => {
      const actions: AIAction[] = [];
      const desolators = ctx.aiPlayer.units.filter(u =>
        u.type === UnitType.ROCKET && u.special === '辐射部署' && !u.isRadiationDeployed
      );

      if (desolators.length === 0) return 'failure';

      // Find enemy infantry clusters near desolators
      for (const desolator of desolators) {
        const nearbyEnemyInfantry = ctx.enemyPlayer.units.filter(e =>
          e.isInfantry && getDistance(e.position, desolator.position) < 200
        );

        if (nearbyEnemyInfantry.length >= 3) {
          actions.push({
            type: 'desolatorDeploy' as AIActionType,
            unitId: desolator.id,
            position: { ...desolator.position },
            priority: 7
          });
        }
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }

  // === Naval Assault System ===

  private hasNavalUnits(ctx: AIContext): boolean {
    const NAVAL_TYPES = new Set([UnitType.DESTROYER, UnitType.SUBMARINE, UnitType.TRANSPORT_SHIP, UnitType.AEGIS, UnitType.DOLPHIN, UnitType.SQUID, UnitType.DREADNOUGHT, UnitType.CARRIER, UnitType.BOOMER]);
    return ctx.aiPlayer.units.some(u => NAVAL_TYPES.has(u.type as UnitType));
  }

  private createNavalAssaultSequence(): BehaviorNode {
    return new ActionNode('naval_assault', 'Naval Assault', (ctx) => {
      const actions: AIAction[] = [];
      const NAVAL_TYPES = new Set([UnitType.DESTROYER, UnitType.SUBMARINE, UnitType.TRANSPORT_SHIP, UnitType.AEGIS, UnitType.DOLPHIN, UnitType.SQUID, UnitType.DREADNOUGHT, UnitType.CARRIER, UnitType.BOOMER]);

      const navalUnits = ctx.aiPlayer.units.filter(u =>
        NAVAL_TYPES.has(u.type as UnitType) && (u.state === 'idle' || u.state === 'defending')
      );

      if (navalUnits.length === 0) return 'failure';

      // Find enemy coastal buildings or units
      const enemyBuildings = ctx.enemyPlayer.buildings.filter(b => b.isConstructed);
      const enemyUnits = ctx.enemyPlayer.units.filter(u => u.health > 0);

      // Submarines prioritize enemy naval units
      const enemyNavalUnits = enemyUnits.filter(u => NAVAL_TYPES.has(u.type as UnitType));

      // Dolphins prioritize enemy submarines
      const enemySubmarines = enemyUnits.filter(u => u.type === UnitType.SUBMARINE || u.type === UnitType.BOOMER);

      for (const unit of navalUnits) {
        if (unit.type === UnitType.SUBMARINE && enemyNavalUnits.length > 0) {
          // Submarines target enemy naval units
          const nearest = enemyNavalUnits.sort((a, b) =>
            getDistance(a.position, unit.position) - getDistance(b.position, unit.position)
          )[0];
          actions.push({
            type: 'navalAssault' as AIActionType,
            unitId: unit.id,
            targetId: nearest.id,
            position: nearest.position,
            priority: 6
          });
        } else if (unit.type === UnitType.DOLPHIN && enemySubmarines.length > 0) {
          // Dolphins target enemy submarines
          const nearest = enemySubmarines.sort((a, b) =>
            getDistance(a.position, unit.position) - getDistance(b.position, unit.position)
          )[0];
          actions.push({
            type: 'navalAssault' as AIActionType,
            unitId: unit.id,
            targetId: nearest.id,
            position: nearest.position,
            priority: 6
          });
        } else {
          // Other naval units target enemy coastal buildings or nearest enemy
          const coastalTarget = enemyBuildings[0] || enemyUnits[0];
          if (coastalTarget) {
            actions.push({
              type: 'navalAssault' as AIActionType,
              unitId: unit.id,
              targetId: coastalTarget.id,
              position: coastalTarget.position,
              priority: 5
            });
          }
        }
      }

      this.pendingActions.push(...actions);
      return actions.length > 0 ? 'success' : 'failure';
    });
  }
}
