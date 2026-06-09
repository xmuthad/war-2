import { describe, it, expect, beforeEach } from 'vitest';
import {
  SequenceNode,
  SelectorNode,
  ActionNode,
  ConditionNode,
} from '../game/systems/AIBehaviorTree';
import type {
  AIContext,
  AIPlayerState,
  AIGameMap,
  AIResources,
  AIObjective,
  AIDifficulty,
  ThreatLevel
} from '../game/systems/AITypes';
import { PathfindingManager } from '../game/systems/PathfindingManager';
import { TileType } from '../types';

function createMockContext(): AIContext {
  const aiPlayer: AIPlayerState = {
    faction: 'allied_usa',
    units: [
      {
        id: 'unit-1',
        type: 'tank',
        position: { x: 64, y: 64 },
        health: 100,
        maxHealth: 100,
        attack: 20,
        defense: 10,
        speed: 5,
        range: 200,
        state: 'idle',
        data: { canAttack: true, canHarvest: false, canCapture: false }
      },
      {
        id: 'unit-2',
        type: 'infantry',
        position: { x: 96, y: 64 },
        health: 50,
        maxHealth: 50,
        attack: 10,
        defense: 5,
        speed: 3,
        range: 150,
        state: 'idle'
      }
    ],
    buildings: [
      {
        id: 'building-1',
        type: 'barracks',
        position: { x: 32, y: 32 },
        health: 500,
        maxHealth: 500,
        isConstructed: true,
        productionQueue: [],
        isActive: true
      }
    ],
    powerBalance: 100,
    defenseLevel: 3,
    offensivePower: 50
  };

  const enemyPlayer: AIPlayerState = {
    ...aiPlayer,
    faction: 'soviet_ussr',
    units: [
      {
        id: 'enemy-1',
        type: 'rhino_tank',
        position: { x: 500, y: 500 },
        health: 100,
        maxHealth: 100,
        attack: 25,
        defense: 15,
        speed: 4,
        range: 180,
        state: 'idle'
      }
    ],
    buildings: [],
    powerBalance: 80,
    defenseLevel: 2,
    offensivePower: 60
  };

  const gameMap: AIGameMap = {
    width: 20,
    height: 20,
    resourceNodes: [
      { id: 'ore-1', position: { x: 200, y: 200 }, type: 'ore', amount: 500 },
      { id: 'ore-2', position: { x: 400, y: 400 }, type: 'ore', amount: 300 }
    ],
    enemyBaseLocation: { x: 500, y: 500 },
    friendlyBaseLocation: { x: 64, y: 64 }
  };

  const resources: AIResources = {
    money: 1000,
    power: 100,
    ore: 500
  };

  const objectives: AIObjective[] = [
    {
      id: 'obj-1',
      type: 'primary',
      priority: 1,
      status: 'pending',
      targetId: 'enemy-1'
    }
  ];

  return {
    aiPlayer,
    enemyPlayer,
    gameMap,
    resources,
    objectives,
    currentTime: Date.now(),
    difficulty: 'normal' as AIDifficulty,
    threatLevel: 'medium' as ThreatLevel
  };
}

function createTestMap(width: number, height: number): PathfindingManager {
  const manager = new PathfindingManager();
  const tiles = Array(height).fill(null).map((_row, _y) =>
    Array(width).fill(null).map((_col, _x) => ({ type: TileType.GRASS }))
  );
  manager.initialize({ width, height, tiles });
  return manager;
}

describe('AI Behavior Tree Integration Tests', () => {
  let context: AIContext;
  let pathfindingManager: PathfindingManager;

  beforeEach(() => {
    context = createMockContext();
    pathfindingManager = createTestMap(20, 20);
  });

  describe('Sequence and Pathfinding Integration', () => {
    it('should find path when unit needs to move', () => {
      const unit = context.aiPlayer.units[0];
      const targetPos = { x: 300, y: 300 };

      const hasUnit = new ConditionNode(
        'has-unit',
        'Has Unit',
        (ctx) => ctx.aiPlayer.units.length > 0
      );

      const findPath = new ActionNode(
        'find-path',
        'Find Path',
        (_ctx) => {
          const result = pathfindingManager.findPath(
            unit.position.x,
            unit.position.y,
            targetPos.x,
            targetPos.y
          );
          return result.success ? 'success' : 'failure';
        }
      );

      const sequence = new SequenceNode('move-sequence', 'Move Sequence', [
        hasUnit,
        findPath
      ]);

      const status = sequence.execute(context);
      expect(status).toBe('success');
    });

    it('should handle blocked path scenarios', () => {
      const blockedMap = new PathfindingManager();
      const tiles = Array(20).fill(null).map((_, y) =>
        Array(20).fill(null).map((_, x) =>
          (x >= 5 && x <= 14 && y >= 5 && y <= 14) || x < 2 || x > 17 || y < 2 || y > 17
            ? { type: TileType.WATER }
            : { type: TileType.GRASS }
        )
      );
      blockedMap.initialize({ width: 20, height: 20, tiles }, { impassableTypes: [TileType.WATER] });

      const result = blockedMap.findPath(100, 100, 500, 500);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should update unit position along path', () => {
      const unit = context.aiPlayer.units[0];
      const targetPos = { x: 150, y: 64 };

      const pathResult = pathfindingManager.findPath(
        unit.position.x,
        unit.position.y,
        targetPos.x,
        targetPos.y
      );

      expect(pathResult.success).toBe(true);
      expect(pathResult.path.length).toBeGreaterThan(0);

      pathfindingManager.startPathFollowing('unit-1', pathResult.path, 300);

      let update = pathfindingManager.updatePathFollowing('unit-1', unit.position.x, unit.position.y, 50);
      expect(update).not.toBeNull();
      expect(update?.reachedEnd).toBe(false);

      for (let i = 0; i < 20; i++) {
        update = pathfindingManager.updatePathFollowing(
          'unit-1',
          update!.x,
          update!.y,
          100
        );
        if (update?.reachedEnd) break;
      }
      expect(update?.reachedEnd).toBe(true);
    });
  });

  describe('Selector with Combat Conditions', () => {
    it('should select attack action when enemy is in range', () => {
      context.aiPlayer.units[0].position = { x: 100, y: 100 };
      context.enemyPlayer.units[0].position = { x: 250, y: 100 };

      const checkEnemiesInRange = new SequenceNode('check-enemies', 'Check Enemies in Range', [
        new ConditionNode(
          'has-enemies',
          'Has Enemies in Range',
          (ctx) => {
            const myUnit = ctx.aiPlayer.units[0];
            const enemy = ctx.enemyPlayer.units[0];
            const distance = Math.sqrt(
              Math.pow(enemy.position.x - myUnit.position.x, 2) +
              Math.pow(enemy.position.y - myUnit.position.y, 2)
            );
            return distance <= myUnit.range;
          }
        ),
        new ActionNode('attack', 'Attack', (ctx) => {
          ctx.aiPlayer.units[0].state = 'attacking';
          return 'success';
        })
      ]);

      const moveAction = new ActionNode('move', 'Move', (ctx) => {
        ctx.aiPlayer.units[0].state = 'moving';
        return 'success';
      });

      const combatSelector = new SelectorNode('combat-selector', 'Combat Selector', [
        checkEnemiesInRange,
        moveAction
      ]);

      const status = combatSelector.execute(context);
      expect(status).toBe('success');
      expect(context.aiPlayer.units[0].state).toBe('attacking');
    });

    it('should select move action when no enemy in range', () => {
      context.aiPlayer.units[0].position = { x: 100, y: 100 };
      context.enemyPlayer.units[0].position = { x: 1000, y: 1000 };

      const hasEnemies = new ConditionNode(
        'has-enemies',
        'Has Enemies in Range',
        (ctx) => {
          const myUnit = ctx.aiPlayer.units[0];
          const enemy = ctx.enemyPlayer.units[0];
          const distance = Math.sqrt(
            Math.pow(enemy.position.x - myUnit.position.x, 2) +
            Math.pow(enemy.position.y - myUnit.position.y, 2)
          );
          return distance <= myUnit.range;
        }
      );

      const attackAction = new ActionNode('attack', 'Attack', () => 'failure');
      const moveAction = new ActionNode('move', 'Move', () => {
        context.aiPlayer.units[0].state = 'moving';
        return 'success';
      });

      const combatSelector = new SelectorNode('combat-selector', 'Combat Selector', [
        hasEnemies,
        attackAction,
        moveAction
      ]);

      const status = combatSelector.execute(context);
      expect(status).toBe('success');
      expect(context.aiPlayer.units[0].state).toBe('moving');
    });
  });

  describe('Resource Gathering Integration', () => {
    it('should find nearest resource node', () => {
      context.aiPlayer.units[0].position = { x: 100, y: 100 };

      const findResource = new ActionNode('find-resource', 'Find Resource', (ctx) => {
        let nearestDist = Infinity;
        let nearestNode = ctx.gameMap.resourceNodes[0];

        for (const node of ctx.gameMap.resourceNodes) {
          const dist = Math.sqrt(
            Math.pow(node.position.x - ctx.aiPlayer.units[0].position.x, 2) +
            Math.pow(node.position.y - ctx.aiPlayer.units[0].position.y, 2)
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestNode = node;
          }
        }

        ctx.aiPlayer.units[0].targetPosition = nearestNode.position;
        return 'success';
      });

      const status = findResource.execute(context);
      expect(status).toBe('success');
      expect(context.aiPlayer.units[0].targetPosition).toBeDefined();
      expect(context.aiPlayer.units[0].targetPosition!.x).toBe(200);
      expect(context.aiPlayer.units[0].targetPosition!.y).toBe(200);
    });

    it('should check line of sight to resource nodes', () => {
      context.aiPlayer.units[0].position = { x: 100, y: 100 };
      const resourceNode = context.gameMap.resourceNodes[0];

      const hasLOS = pathfindingManager.findLineOfSight(
        context.aiPlayer.units[0].position.x,
        context.aiPlayer.units[0].position.y,
        resourceNode.position.x,
        resourceNode.position.y
      );

      expect(hasLOS).toBe(true);
    });
  });

  describe('Building Production Integration', () => {
    it('should queue units when resources available', () => {
      context.resources.money = 500;

      const hasResources = new ConditionNode(
        'has-resources',
        'Has Enough Resources',
        (ctx) => ctx.resources.money >= 300
      );

      const queueUnit = new ActionNode('queue-unit', 'Queue Unit', (ctx) => {
        ctx.aiPlayer.buildings[0].productionQueue.push('infantry');
        ctx.resources.money -= 300;
        return 'success';
      });

      const sequence = new SequenceNode('production-sequence', 'Production Sequence', [
        hasResources,
        queueUnit
      ]);

      const status = sequence.execute(context);
      expect(status).toBe('success');
      expect(context.aiPlayer.buildings[0].productionQueue).toContain('infantry');
      expect(context.resources.money).toBe(200);
    });

    it('should not queue units when insufficient resources', () => {
      context.resources.money = 100;

      const hasResources = new ConditionNode(
        'has-resources',
        'Has Enough Resources',
        (ctx) => ctx.resources.money >= 300
      );

      const queueUnit = new ActionNode('queue-unit', 'Queue Unit', () => 'success');

      const sequence = new SequenceNode('production-sequence', 'Production Sequence', [
        hasResources,
        queueUnit
      ]);

      const status = sequence.execute(context);
      expect(status).toBe('failure');
      expect(context.aiPlayer.buildings[0].productionQueue).toHaveLength(0);
    });
  });

  describe('Threat Assessment Integration', () => {
    it('should retreat when threat level is critical', () => {
      context.threatLevel = 'critical';
      context.aiPlayer.units[0].health = 20;

      const checkAndRetreat = new SequenceNode('check-retreat', 'Check and Retreat', [
        new ConditionNode(
          'is-threatened',
          'Is Threatened',
          (ctx) => ctx.threatLevel === 'critical' || ctx.aiPlayer.units[0].health < 50
        ),
        new ActionNode('retreat', 'Retreat', (ctx) => {
          ctx.aiPlayer.units[0].state = 'retreating';
          return 'success';
        })
      ]);

      const attackAction = new ActionNode('attack', 'Attack', (ctx) => {
        ctx.aiPlayer.units[0].state = 'attacking';
        return 'success';
      });

      const survivalSelector = new SelectorNode('survival-selector', 'Survival Selector', [
        checkAndRetreat,
        attackAction
      ]);

      const status = survivalSelector.execute(context);
      expect(status).toBe('success');
      expect(context.aiPlayer.units[0].state).toBe('retreating');
    });

    it('should attack aggressively when threat is low', () => {
      context.threatLevel = 'low';
      context.aiPlayer.units[0].health = 100;

      const isThreatened = new ConditionNode(
        'is-threatened',
        'Is Threatened',
        (ctx) => ctx.threatLevel === 'critical' || ctx.aiPlayer.units[0].health < 50
      );

      const retreat = new ActionNode('retreat', 'Retreat', () => 'failure');
      const attack = new ActionNode('attack', 'Attack', (ctx) => {
        ctx.aiPlayer.units[0].state = 'attacking';
        return 'success';
      });

      const survivalSelector = new SelectorNode('survival-selector', 'Survival Selector', [
        isThreatened,
        retreat,
        attack
      ]);

      const status = survivalSelector.execute(context);
      expect(status).toBe('success');
      expect(context.aiPlayer.units[0].state).toBe('attacking');
    });
  });

  describe('Objective Completion Integration', () => {
    it('should update objective status when target is destroyed', () => {
      const objective = context.objectives[0];
      expect(objective.status).toBe('pending');

      context.enemyPlayer.units[0].health = 0;

      const checkObjective = new ActionNode('check-objective', 'Check Objective', (ctx) => {
        const target = ctx.enemyPlayer.units.find(u => u.id === ctx.objectives[0].targetId);
        if (!target || target.health <= 0) {
          ctx.objectives[0].status = 'completed';
          return 'success';
        }
        return 'running';
      });

      const status = checkObjective.execute(context);
      expect(status).toBe('success');
      expect(context.objectives[0].status).toBe('completed');
    });

    it('should mark objective as failed when unit is destroyed', () => {
      const _myUnit = context.aiPlayer.units[0];
      const initialUnitCount = context.aiPlayer.units.length;

      const checkUnitLost = new ActionNode('check-unit-lost', 'Check Unit Lost', (ctx) => {
        if (ctx.aiPlayer.units.length < initialUnitCount) {
          ctx.objectives[0].status = 'failed';
          return 'success';
        }
        return 'running';
      });

      const status = checkUnitLost.execute(context);
      expect(status).toBe('running');
      expect(context.objectives[0].status).toBe('pending');
    });
  });

  describe('Difficulty Scaling Integration', () => {
    it('should adjust behavior based on difficulty', () => {
      const difficulties: AIDifficulty[] = ['easy', 'normal', 'hard', 'brutal'];
      const expectedCounts = [0, 1, 2, 2];

      for (let i = 0; i < difficulties.length; i++) {
        const ctx = createMockContext();
        const initialCount = ctx.aiPlayer.units.length;
        ctx.difficulty = difficulties[i];
        ctx.resources.money = 1000;

        const hasResources = new ConditionNode(
          'has-resources',
          'Has Resources',
          (c) => c.resources.money >= 500
        );

        const buildUnits = new ActionNode('build-units', 'Build Units', (c) => {
          const unitCount = difficulties[i] === 'brutal' ? 2 :
                          difficulties[i] === 'hard' ? 2 :
                          difficulties[i] === 'normal' ? 1 : 0;

          for (let j = 0; j < unitCount; j++) {
            c.aiPlayer.units.push({
              id: `temp-unit-${difficulties[i]}-${j}`,
              type: 'infantry',
              position: { x: 0, y: 0 },
              health: 50,
              maxHealth: 50,
              attack: 10,
              defense: 5,
              speed: 3,
              range: 150,
              state: 'idle'
            });
          }
          return 'success';
        });

        const sequence = new SequenceNode('difficulty-test', 'Difficulty Test', [
          hasResources,
          buildUnits
        ]);

        sequence.execute(ctx);

        expect(ctx.aiPlayer.units.length).toBe(initialCount + expectedCounts[i]);
      }
    });
  });
});

describe('Pathfinding Performance Tests', () => {
  it('should handle large maps efficiently', () => {
    const manager = new PathfindingManager();
    const size = 50;
    const tiles = Array(size).fill(null).map(() =>
      Array(size).fill(null).map(() => ({ type: TileType.GRASS }))
    );
    manager.initialize({ width: size, height: size, tiles });

    const startTime = performance.now();
    const result = manager.findPath(64, 64, 1500, 1500);
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(100);
  });

  it('should use cache for repeated pathfinding', () => {
    const manager = createTestMap(20, 20);

    const result1 = manager.findPath(64, 64, 300, 300);
    const result2 = manager.findPath(64, 64, 300, 300);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.path).toEqual(result2.path);
  });

  it('should find reachable tiles within range', () => {
    const manager = createTestMap(20, 20);

    const reachable = manager.getReachableTiles(10, 10, 5);

    expect(reachable.length).toBeGreaterThan(0);
    reachable.forEach(tile => {
      expect(tile.cost).toBeLessThanOrEqual(5);
    });
  });
});

describe('Multi-Unit Coordination Tests', () => {
  it('should coordinate multiple units movement', () => {
    const manager = createTestMap(20, 20);
    const units = [
      { id: 'unit-a', position: { x: 64, y: 64 } },
      { id: 'unit-b', position: { x: 96, y: 64 } },
      { id: 'unit-c', position: { x: 128, y: 64 } }
    ];
    const target = { x: 400, y: 400 };

    const paths = units.map(unit =>
      manager.findPath(unit.position.x, unit.position.y, target.x, target.y)
    );

    expect(paths.every(p => p.success)).toBe(true);

    paths.forEach((path, index) => {
      manager.startPathFollowing(units[index].id, path.path, 150);
      expect(manager.isFollowingPath(units[index].id)).toBe(true);
    });

    units.forEach(unit => {
      manager.stopPathFollowing(unit.id);
      expect(manager.isFollowingPath(unit.id)).toBe(false);
    });
  });

  it('should avoid collisions when following paths', () => {
    const manager = createTestMap(20, 20);

    const path1 = manager.findPath(64, 64, 200, 200);
    const path2 = manager.findPath(96, 64, 200, 200);

    manager.startPathFollowing('unit-1', path1.path, 100);
    manager.startPathFollowing('unit-2', path2.path, 100);

    const update1 = manager.updatePathFollowing('unit-1', 64, 64, 50);
    const update2 = manager.updatePathFollowing('unit-2', 96, 64, 50);

    expect(update1).not.toBeNull();
    expect(update2).not.toBeNull();

    if (update1 && update2) {
      const dx = update1.x - update2.x;
      const dy = update1.y - update2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeGreaterThan(0);
    }

    manager.dispose();
  });
});
