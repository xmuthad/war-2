import type { AIContext } from './AITypes';
import type { BehaviorNode, BehaviorNodeStatus } from './AITypes';
import {
  AIAction,
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
import { UnitType, BuildingType, UnitState, Vector2, UpgradeType, FactionGroup, getFactionGroup } from '../../types';
import { UNITS_BY_FACTION } from './AIUnitLookup';
import { useGameStore } from '../../store/gameStore';
import { getUpgradesByFactionGroup } from '../data/upgrades';

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
  private lastUpdate: number = 0;

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
          const safeLocation = ctx.gameMap.friendlyBaseLocation || 
            ctx.aiPlayer.buildings.find(b => b.type === BuildingType.COMMAND)?.position ||
            { x: ctx.gameMap.width / 2, y: ctx.gameMap.height / 2 };

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

        for (const unit of ctx.aiPlayer.units) {
          if (unit.data?.canAttack) {
            const scatterDir = Math.random() * Math.PI * 2;
            const scatterDist = AI_CONFIG.SCATTER_DISTANCE_MIN + Math.random() * AI_CONFIG.SCATTER_DISTANCE_RANGE;
            const newPos = {
              x: unit.position.x + Math.cos(scatterDir) * scatterDist,
              y: unit.position.y + Math.sin(scatterDir) * scatterDist
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
          const closestDefender = defenders.find(d => 
            getDistance(d.position, threatened.position) < 
            getDistance(d.position, ctx.enemyPlayer.units.find(e => 
              getDistance(e.position, threatened.position) < 200
            )!.position)
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

        // Find placement location near command center
        const command = buildings.find(b => b.type === BuildingType.COMMAND);
        if (!command) return 'failure';

        const baseX = Math.floor(command.position.x / 32); // TILE_SIZE
        const baseY = Math.floor(command.position.y / 32);

        // Try positions in a spiral pattern
        const offsets = [
          { x: 6, y: 0 }, { x: 8, y: 2 }, { x: 5, y: 5 },
          { x: 3, y: 6 }, { x: 0, y: 6 }, { x: -3, y: 5 },
          { x: -5, y: 3 }, { x: -6, y: 0 }, { x: -5, y: -4 },
          { x: -2, y: -5 }, { x: 2, y: -5 }, { x: 5, y: -4 },
        ];

        for (const offset of offsets) {
          const bx = baseX + offset.x;
          const by = baseY + offset.y;

          this.pendingActions.push({
            type: 'build',
            buildingId: targetStructure,
            position: { x: bx * 32, y: by * 32 },
            priority: 4
          });
          return 'success';
        }

        return 'failure';
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
        const productionBuildings = ctx.aiPlayer.buildings.filter(b =>
          b.isConstructed && (b.type.includes('barracks') || b.type.includes('warfactory') || b.type.includes('helipad') || b.type.includes('naval_shipyard'))
        );

        for (const building of productionBuildings) {
          if (building.productionQueue.length < 3) {
            this.pendingActions.push({
              type: 'produce',
              buildingId: building.id,
              unitType: unitType as UnitType,
              position: { x: 0, y: 0 },
              priority: 3
            });
            return 'success';
          }
        }

        return productionBuildings.length > 0 ? 'failure' : 'failure';
      })
    );

    return sequence;
  }

  private createProduceHarvestersSequence(): BehaviorNode {
    const sequence = new SequenceNode('produce_harvesters_seq', 'Produce Harvesters Sequence');

    sequence.addChild(
      new ActionNode('produce_harvesters_action', 'Produce Harvesters', (ctx: AIContext): BehaviorNodeStatus => {
        const refinery = ctx.aiPlayer.buildings.find(b => 
          b.isConstructed && b.type === BuildingType.REFINERY
        );

        if (!refinery) return 'failure';

        const currentHarvesters = ctx.aiPlayer.units.filter(u => 
          u.type === 'miner'
        ).length;

        const neededHarvesters = Math.max(0, AI_CONFIG.DESIRED_MINER_COUNT - currentHarvesters);

        if (neededHarvesters > 0) {
          this.pendingActions.push({
            type: 'produce',
            buildingId: refinery.id,
            position: { x: 0, y: 0 },
            priority: 5
          });
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

        for (let i = 0; i < Math.min(attackSize, targets.length); i++) {
          const attacker = attackers[i];
          const target = targets[i];

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

        for (const harvester of harvesters) {
          if (harvester.state === 'idle') {
            const nearestResource = ctx.gameMap.resourceNodes.find(r => 
              r.amount > 0 && !r.assignedHarvester
            );

            if (nearestResource) {
              this.pendingActions.push({
                type: 'harvest',
                unitId: harvester.id,
                targetId: nearestResource.id,
                position: nearestResource.position,
                priority: 4
              });
            }
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

        for (const building of damagedBuildings) {
          if (ctx.resources.money >= AI_CONFIG.REPAIR_COST_THRESHOLD) {
            this.pendingActions.push({
              type: 'repair',
              buildingId: building.id,
              priority: 2
            });
          }
        }

        return damagedBuildings.length > 0 ? 'success' : 'failure';
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
          position: target.position,
          priority: 5
        });
        return 'success';
      })
    );

    return sequence;
  }

  public update(context: AIContext): AIAction[] {
    if (Date.now() - this.lastUpdate < this.config.reactionTime) {
      return this.pendingActions;
    }

    this.lastUpdate = Date.now();
    context.threatLevel = calculateThreatLevel(context);

    this.rootBehavior.execute(context);

    // Manage transport loading/unloading
    const transportActions = this.manageTransports(context);
    this.pendingActions.push(...transportActions);

    // Activate ready superweapons
    const superweaponActions = this.manageSuperweapons(context);
    this.pendingActions.push(...superweaponActions);

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
    return ctx.aiPlayer.buildings.some(b =>
      b.isConstructed && (b.type.includes('barracks') || b.type.includes('warfactory') || b.type.includes('naval_shipyard'))
    );
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
    const factionGroup = getFactionGroup(faction as import('../../types').Faction);

    // Get available unit types based on buildings
    const hasBarracks = aiPlayer.buildings.some(b => b.type === BuildingType.BARRACKS && b.isConstructed);
    const hasWarFactory = aiPlayer.buildings.some(b => b.type === BuildingType.WARFACTORY && b.isConstructed);
    const hasHelipad = aiPlayer.buildings.some(b => b.type === BuildingType.HELIPAD && b.isConstructed);
    const hasTech = aiPlayer.buildings.some(b => b.type === BuildingType.TECH && b.isConstructed);
    const hasNavalShipyard = aiPlayer.buildings.some(b => b.type === BuildingType.NAVAL_SHIPYARD && b.isConstructed);

    // Check researched upgrades from the store
    const store = useGameStore.getState();
    const storeAiPlayer = store.aiPlayers.find(p => p.faction === faction);
    const researchedUpgrades = new Set(storeAiPlayer?.researchedUpgrades || []);

    const availableUnits: UnitType[] = [];

    // Infantry from barracks
    if (hasBarracks) {
      availableUnits.push(UnitType.SOLDIER);
      availableUnits.push(UnitType.ROCKET);
      // Add engineer occasionally
      if (Math.random() < 0.1) availableUnits.push(UnitType.ENGINEER);
    }

    // Vehicles from war factory
    if (hasWarFactory) {
      availableUnits.push(UnitType.TANK);
      availableUnits.push(UnitType.MINER);

      // Advanced units require tech center + upgrade research
      if (hasTech) {
        if (factionGroup === FactionGroup.ALLIED) {
          if (researchedUpgrades.has(UpgradeType.PRISM_TECH)) {
            availableUnits.push(UnitType.PRISM);
          }
          if (researchedUpgrades.has(UpgradeType.CHRONO_TECH)) {
            availableUnits.push(UnitType.CHRONO);
          }
          availableUnits.push(UnitType.PHANTOM);
        } else {
          availableUnits.push(UnitType.APOCALYPSE);
          if (researchedUpgrades.has(UpgradeType.TESLA_WEAPONS)) {
            availableUnits.push(UnitType.TESLA);
          }
          availableUnits.push(UnitType.APC);
        }
      }
    }

    // Air units from helipad
    if (hasHelipad) {
      availableUnits.push(UnitType.HELICOPTER);
    }

    // Naval units from naval shipyard
    if (hasNavalShipyard) {
      if (factionGroup === FactionGroup.ALLIED) {
        availableUnits.push(UnitType.DESTROYER);
        availableUnits.push(UnitType.TRANSPORT_SHIP);
      } else {
        availableUnits.push(UnitType.SUBMARINE);
        availableUnits.push(UnitType.TRANSPORT_SHIP);
      }
    }

    if (availableUnits.length === 0) return null;

    // Strategic weighting based on game state
    const enemyAirUnits = ctx.enemyPlayer.units.filter(u => {
      // Check if unit is airborne by type
      const airTypes: string[] = ['helicopter', 'blackhawk', 'kirov', 'yak'];
      return airTypes.includes(u.type);
    });
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
      if (unitType === UnitType.ENGINEER) weight = needsEngineers ? 2 : 0.3;
      if (unitType === UnitType.PRISM || unitType === UnitType.APOCALYPSE) weight = 2;
      if (unitType === UnitType.TESLA || unitType === UnitType.PHANTOM) weight = 1.5;
      if (unitType === UnitType.CHRONO) weight = 1.5;
      if (unitType === UnitType.APC) weight = 1;
      if (unitType === UnitType.HELICOPTER) weight = needsAntiAir ? 1.5 : 1;
      if (unitType === UnitType.DESTROYER) weight = 1.5;
      if (unitType === UnitType.SUBMARINE) weight = 1.5;
      if (unitType === UnitType.TRANSPORT_SHIP) weight = 0.8;
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

  private determineBuildPriority(ctx: AIContext): { type: string; position: { x: number; y: number }; cost: number }[] {
    const base = ctx.gameMap.friendlyBaseLocation ||
      ctx.aiPlayer.buildings.find(b => b.type === BuildingType.COMMAND)?.position ||
      { x: ctx.gameMap.width / 2, y: ctx.gameMap.height / 2 };

    const plan: { type: string; position: { x: number; y: number }; cost: number }[] = [];

    if (ctx.aiPlayer.powerBalance < 0) {
      plan.push({
        type: BuildingType.POWER,
        position: { x: base.x + 100, y: base.y + 100 },
        cost: 500
      });
    }

    const hasBarracks = ctx.aiPlayer.buildings.some(b => b.type === BuildingType.BARRACKS && b.isConstructed);
    if (!hasBarracks) {
      plan.push({
        type: BuildingType.BARRACKS,
        position: { x: base.x - 100, y: base.y + 100 },
        cost: 800
      });
    }

    return plan;
  }

  private cleanupCooldowns(): void {
    const now = Date.now();
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

        const command = ctx.aiPlayer.buildings.find(b => b.type === BuildingType.COMMAND);
        if (!command) return 'failure';

        const baseX = Math.floor(command.position.x / 32);
        const baseY = Math.floor(command.position.y / 32);

        this.pendingActions.push({
          type: 'build',
          buildingId: targetBuilding,
          position: { x: (baseX + 8) * 32, y: (baseY + 8) * 32 },
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

    // Find idle infantry not in a transport
    const infantry = aiPlayer.units.filter(u =>
      u.isInfantry && !u.transportId && u.state === 'idle'
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
            type: 'activateSuperweapon' as any,
            buildingId: building.id,
            position: enemyBase,
            priority: 8
          });
          this.actionCooldowns.set(cooldownKey, Date.now() + 10000);
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
            type: 'activateSuperweapon' as any,
            buildingId: building.id,
            position: { x: centerX, y: centerY },
            priority: 7
          });
          this.actionCooldowns.set(cooldownKey, Date.now() + 10000);
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
              type: 'activateChronosphere' as any,
              buildingId: building.id,
              position: friendlyBase,
              targetPosition: { x: enemyBase.x - 100, y: enemyBase.y - 100 },
              priority: 8
            });
            this.actionCooldowns.set(cooldownKey, Date.now() + 10000);
          }
        }
      }
    }

    return actions;
  }
}
