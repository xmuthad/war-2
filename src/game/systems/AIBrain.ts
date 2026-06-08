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
  private pendingActions: AIAction[] = [];
  private actionCooldowns: Map<string, number> = new Map();
  private lastScoutTime: number = 0;
  private lastUpdate: number = 0;

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

        // 1. Build refinery if none exists and we have money
        if (!hasRefinery && money >= 2000) {
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
        const targets = prioritizeTargets(ctx);
        const attackers = ctx.aiPlayer.units.filter(u =>
          u.data?.canAttack && u.state !== 'retreating' && u.health > u.maxHealth * 0.5
        );

        if (targets.length === 0 || attackers.length === 0) return 'failure';

        const attackSize = Math.ceil(attackers.length * this.config.aggressionLevel);
        const activeAttackers = attackers.slice(0, attackSize);

        // Distribute attackers across targets, concentrating fire on high-priority targets
        for (let i = 0; i < activeAttackers.length; i++) {
          const attacker = activeAttackers[i];
          // Assign to highest priority target first, then cycle through remaining targets
          const targetIndex = i < targets.length ? i : 0;
          const target = targets[targetIndex];

          this.pendingActions.push({
            type: 'attack',
            unitId: attacker.id,
            targetId: target.id,
            priority: 6
          });
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
    if (this.getGameTimeMs() - this.lastUpdate < this.config.reactionTime) {
      return this.pendingActions;
    }

    this.lastUpdate = this.getGameTimeMs();
    context.threatLevel = calculateThreatLevel(context);

    this.rootBehavior.execute(context);

    // Manage transport loading/unloading
    const transportActions = this.manageTransports(context);
    this.pendingActions.push(...transportActions);

    // Activate ready superweapons
    const superweaponActions = this.manageSuperweapons(context);
    this.pendingActions.push(...superweaponActions);

    // Respond to enemy superweapon threats
    const threatActions = this.respondToSuperweaponThreat(context);
    this.pendingActions.push(...threatActions);

    // Use Chrono Legionnaire chrono shift ability
    const chronoActions = this.manageChronoAbilities(context);
    this.pendingActions.push(...chronoActions);

    // Sell low-value buildings when low on funds
    const sellActions = this.manageSellBuildings(context);
    this.pendingActions.push(...sellActions);

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

    return harvesters < refineries * 2 && refineries > 0;
  }

  private shouldAttack(ctx: AIContext): boolean {
    if (ctx.threatLevel === 'high' || ctx.threatLevel === 'critical') {
      return false;
    }

    const idleAttackers = ctx.aiPlayer.units.filter(u => 
      u.data?.canAttack && u.state === 'idle'
    );

    return idleAttackers.length >= Math.ceil(5 / this.config.aggressionLevel);
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

    // Weighted selection
    const weighted: Array<{type: UnitType; weight: number}> = [];
    for (const unitType of availableUnits) {
      let weight = 1;
      if (unitType === UnitType.MINER) weight = needsMiners ? 5 : 0.5;
      if (unitType === UnitType.ROCKET && needsAntiAir) weight = 3;
      if (unitType === UnitType.FLAKINFANTRY && needsAntiAir) weight = 4;
      if (unitType === UnitType.FLAK && needsAntiAir) weight = 4;
      if (unitType === UnitType.ENGINEER) weight = needsEngineers ? 2 : 0.3;
      if (unitType === UnitType.PRISM || unitType === UnitType.APOCALYPSE) weight = 2;
      if (unitType === UnitType.TESLA || unitType === UnitType.PHANTOM) weight = 1.5;
      if (unitType === UnitType.CHRONO) weight = 1.5;
      if (unitType === UnitType.GUARDIAN) weight = 1.5;
      if (unitType === UnitType.DESPOT) weight = 1.5;
      if (unitType === UnitType.APC) weight = 1;
      if (unitType === UnitType.HELICOPTER) weight = needsAntiAir ? 1.5 : 1;
      if (unitType === UnitType.BLACKHAWK) weight = 1.5;
      if (unitType === UnitType.KIROV) weight = 1.2;
      if (unitType === UnitType.YAK) weight = 1.5;
      if (unitType === UnitType.DESTROYER) weight = 1.5;
      if (unitType === UnitType.SUBMARINE) weight = 1.5;
      if (unitType === UnitType.TRANSPORT_SHIP) weight = 0.8;
      if (unitType === UnitType.SOLDIER || unitType === UnitType.CONSCRIPT) weight = 1;
      if (unitType === UnitType.SNIPER) weight = 1.2;
      if (unitType === UnitType.TANYA || unitType === UnitType.SEAL) weight = 0.8;
      if (unitType === UnitType.TERRORIST) weight = 1;
      if (unitType === UnitType.IVAN) weight = 0.8;
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

    // 4. Second refinery for better economy
    if (hasRefinery && refineryCount < 2 && money >= 2000) {
      const pos = this.findBestBuildingPosition(BuildingType.REFINERY, ctx);
      if (pos) plan.push({ type: BuildingType.REFINERY, position: pos, cost: 2000 });
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

    // 7. Helipad (if faction has one)
    if (!hasHelipad && hasWarFactory && money >= 1000) {
      const pos = this.findBestBuildingPosition(BuildingType.HELIPAD, ctx);
      if (pos) plan.push({ type: BuildingType.HELIPAD, position: pos, cost: 1000 });
    }

    // 8. Tech center
    if (!hasTech && hasRadar && money >= 2500) {
      const pos = this.findBestBuildingPosition(BuildingType.TECH, ctx);
      if (pos) plan.push({ type: BuildingType.TECH, position: pos, cost: 2500 });
    }

    // 9. Repair facility
    if (!hasRepair && hasWarFactory && money >= 1500) {
      const pos = this.findBestBuildingPosition(BuildingType.REPAIR, ctx);
      if (pos) plan.push({ type: BuildingType.REPAIR, position: pos, cost: 1500 });
    }

    // 10. Naval shipyard (late game)
    if (!hasNavalShipyard && hasRadar && money >= 2000) {
      const pos = this.findBestBuildingPosition(BuildingType.NAVAL_SHIPYARD, ctx);
      if (pos) plan.push({ type: BuildingType.NAVAL_SHIPYARD, position: pos, cost: 1500 });
    }

    // 11. Defense buildings (when base is established)
    if (defenseCount < 3 && hasBarracks && money >= 600) {
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

    // 13. Third refinery for late game economy
    if (refineryCount >= 2 && refineryCount < 3 && hasWarFactory && money >= 2000) {
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
    const infantry = aiPlayer.units.filter(u =>
      u.isInfantry && !u.transportId &&
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
          const chronoRange = (chrono.data?.attackRange || 6) * GAME_CONFIG.TILE_SIZE;
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
}
