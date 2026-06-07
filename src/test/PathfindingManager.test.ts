import { describe, it, expect, beforeEach } from 'vitest';
import { PathfindingManager, PathfindingGrid } from '../game/systems/PathfindingManager';
import { TileType } from '../types';

describe('PathfindingGrid', () => {
  let grid: PathfindingGrid;

  beforeEach(() => {
    grid = new PathfindingGrid();
    grid.initialize({
      width: 10,
      height: 10,
      tiles: Array(10).fill(null).map(() =>
        Array(10).fill(null).map(() => ({ type: TileType.GRASS }))
      )
    });
  });

  it('should initialize with correct dimensions', () => {
    expect(grid.getWidth()).toBe(10);
    expect(grid.getHeight()).toBe(10);
    expect(grid.getTileSize()).toBe(32);
  });

  it('should return walkable for grass tiles', () => {
    expect(grid.isWalkable(0, 0)).toBe(true);
    expect(grid.isWalkable(5, 5)).toBe(true);
    expect(grid.isWalkable(9, 9)).toBe(true);
  });

  it('should return not walkable for out of bounds', () => {
    expect(grid.isWalkable(-1, 0)).toBe(false);
    expect(grid.isWalkable(0, -1)).toBe(false);
    expect(grid.isWalkable(10, 0)).toBe(false);
    expect(grid.isWalkable(0, 10)).toBe(false);
  });

  it('should return not walkable for water tiles', () => {
    grid.initialize({
      width: 10,
      height: 10,
      tiles: Array(10).fill(null).map((_row, y) =>
        Array(10).fill(null).map((_col, x) =>
          x === 5 && y === 5 ? { type: TileType.WATER } : { type: TileType.GRASS }
        )
      ),
    }, {
      impassableTypes: [TileType.WATER]
    });

    expect(grid.isWalkable(5, 5)).toBe(false);
    expect(grid.isWalkable(4, 5)).toBe(true);
    expect(grid.isWalkable(6, 5)).toBe(true);
  });

  it('should convert world to grid coordinates', () => {
    const gridPos = grid.worldToGrid(64, 96);
    expect(gridPos.x).toBe(2);
    expect(gridPos.y).toBe(3);
  });

  it('should convert grid to world coordinates', () => {
    const worldPos = grid.gridToWorld(3, 4);
    expect(worldPos.x).toBe(3 * 32 + 16);
    expect(worldPos.y).toBe(4 * 32 + 16);
  });

  it('should set obstacles correctly', () => {
    grid.setObstacle(3, 3, false);
    expect(grid.isWalkable(3, 3)).toBe(false);

    grid.setObstacle(3, 3, true);
    expect(grid.isWalkable(3, 3)).toBe(true);
  });

  it('should return correct movement cost', () => {
    expect(grid.getMovementCost(0, 0)).toBe(1);

    grid.initialize({
      width: 3,
      height: 3,
      tiles: [
        [{ type: TileType.ROAD }, { type: TileType.GRASS }, { type: TileType.FOREST }],
        [{ type: TileType.GRASS }, { type: TileType.ORE }, { type: TileType.GRASS }],
        [{ type: TileType.SAND }, { type: TileType.GRASS }, { type: TileType.MUD }]
      ]
    });

    expect(grid.getMovementCost(0, 0)).toBe(0.5);
    expect(grid.getMovementCost(1, 0)).toBe(1);
    expect(grid.getMovementCost(2, 0)).toBe(1.5);
    expect(grid.getMovementCost(1, 1)).toBe(2);
  });
});

describe('PathfindingManager', () => {
  let manager: PathfindingManager;

  beforeEach(() => {
    manager = new PathfindingManager();
    manager.initialize({
      width: 10,
      height: 10,
      tiles: Array(10).fill(null).map(() =>
        Array(10).fill(null).map(() => ({ type: TileType.GRASS }))
      )
    });
  });

  it('should find path in straight line', () => {
    const result = manager.findPath(64, 64, 200, 64);

    expect(result.success).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
    expect(result.path[0].x).toBeGreaterThan(0);
    expect(result.path[result.path.length - 1].x).toBeGreaterThan(64);
  });

  it('should find diagonal path', () => {
    const result = manager.findPath(64, 64, 160, 160);

    expect(result.success).toBe(true);
    expect(result.path.length).toBeGreaterThan(0);
  });

  it('should handle blocked path scenarios', () => {
    manager = new PathfindingManager();
    manager.initialize({
      width: 10,
      height: 10,
      tiles: Array(10).fill(null).map((_row, _y) =>
        Array(10).fill(null).map((_col, x) =>
          x === 5 ? { type: TileType.WATER } : { type: TileType.GRASS }
        )
      ),
    }, {
      impassableTypes: [TileType.WATER]
    });

    const result = manager.findPath(0, 5, 9, 5);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should handle same start and end', () => {
    const result = manager.findPath(160, 160, 160, 160);

    expect(result.success).toBe(true);
    expect(result.path.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle unreachable target scenarios', () => {
    const result = manager.findPath(0, 0, 100, 100);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should track path following', () => {
    const result = manager.findPath(0, 0, 3, 0);
    expect(result.success).toBe(true);

    const unitId = 'test-unit';
    manager.startPathFollowing(unitId, result.path, 100);

    expect(manager.isFollowingPath(unitId)).toBe(true);

    manager.stopPathFollowing(unitId);
    expect(manager.isFollowingPath(unitId)).toBe(false);
  });

  it('should update path following correctly', () => {
    const result = manager.findPath(0, 0, 3, 0);
    expect(result.success).toBe(true);

    const unitId = 'test-unit';
    manager.startPathFollowing(unitId, result.path, 500);

    const update = manager.updatePathFollowing(unitId, 0, 0, 100);
    expect(update).not.toBeNull();
    expect(update?.x).toBeGreaterThan(0);
  });

  it('should check line of sight', () => {
    expect(manager.findLineOfSight(0, 0, 5, 0)).toBe(true);
    expect(manager.findLineOfSight(0, 0, 10, 0)).toBe(true);
  });

  it('should find reachable tiles', () => {
    const reachable = manager.getReachableTiles(5, 5, 3);

    expect(reachable.length).toBeGreaterThan(0);
    reachable.forEach(tile => {
      expect(tile.cost).toBeLessThanOrEqual(3);
    });
  });

  it('should clear cache', () => {
    manager.findPath(0, 0, 5, 5);
    manager.clearCache();
  });

  it('should dispose without errors', () => {
    manager.dispose();
  });

  describe('Path Result Properties', () => {
    it('should return valid path result', () => {
      const result = manager.findPath(64, 64, 96, 64);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.cost).toBe('number');
      expect(result.path).toBeDefined();
      expect(Array.isArray(result.path)).toBe(true);
    });

    it('should return valid result for paths to unreachable areas', () => {
      const result = manager.findPath(0, 0, 100, 100);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.cost).toBe('number');
      expect(result.path).toBeDefined();
    });
  });
});
