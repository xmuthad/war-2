import { TileType, BuildingType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';

class MinHeap<T> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parent]) < 0) {
        [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
        index = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest !== index) {
        [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
        index = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Represents a single node in the pathfinding grid
 * @public
 */
export interface PathNode {
  /** Grid X coordinate */
  x: number;
  /** Grid Y coordinate */
  y: number;
  /** Cost from start to this node */
  g: number;
  /** Heuristic cost from this node to goal */
  h: number;
  /** Total cost (g + h) */
  f: number;
  /** Parent node in the path */
  parent: PathNode | null;
}

/**
 * Result of a pathfinding operation
 * @public
 */
export interface PathResult {
  /** Array of world coordinates representing the path */
  path: { x: number; y: number }[];
  /** Whether a path was successfully found */
  success: boolean;
  /** Total path cost (Infinity if no path found) */
  cost: number;
  /** Number of nodes explored during search */
  nodesExplored: number;
}

/**
 * Configuration for the pathfinding system
 * @public
 */
export interface PathfindingConfig {
  /** Enable diagonal movement */
  enableDiagonal: boolean;
  /** Weight multiplier for heuristic (higher = faster but less optimal) */
  heuristicWeight: number;
  /** Maximum iterations before aborting search */
  maxIterations: number;
  /** Movement cost for diagonal tiles */
  tileCostDiagonal: number;
  /** Movement cost for straight tiles */
  tileCostStraight: number;
  /** Allow cutting corners (moving diagonally through adjacent obstacles) */
  allowCornerCutting: boolean;
  /** Enable path caching for repeated searches */
  cacheResults: boolean;
  /** Maximum number of cached paths */
  cacheSize: number;
}

export const PATHFINDING_CONFIG: PathfindingConfig = {
  enableDiagonal: true,
  heuristicWeight: 1.0,
  maxIterations: 10000,
  tileCostDiagonal: 1.414,
  tileCostStraight: 1.0,
  allowCornerCutting: false,
  cacheResults: true,
  cacheSize: 500
};

export class PathfindingGrid {
  private width: number = 0;
  private height: number = 0;
  private walkable: Set<string> = new Set();
  private movementCost: Map<string, number> = new Map();
  private tileTypes: Map<string, TileType> = new Map();
  private tileSize: number = 32;

  initialize(
    mapData: {
      width: number;
      height: number;
      tiles?: Array<Array<{ type?: TileType }>>;
    },
    options?: {
      impassableTypes?: TileType[];
      tileSize?: number;
    }
  ): void {
    this.width = mapData.width;
    this.height = mapData.height;
    this.tileSize = options?.tileSize || 32;
    this.walkable.clear();
    this.movementCost.clear();
    this.tileTypes.clear();

    const impassableTypes = new Set(options?.impassableTypes || [TileType.WATER, TileType.BRIDGE_DESTROYED]);

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const key = `${x},${y}`;
        const tile = mapData.tiles?.[y]?.[x];

        if (tile?.type && impassableTypes.has(tile.type)) {
          this.movementCost.set(key, Infinity);
          this.tileTypes.set(key, tile.type);
        } else {
          this.walkable.add(key);

          let cost = 1;
          if (tile?.type) {
            this.tileTypes.set(key, tile.type);
            switch (tile.type) {
              case TileType.ROAD:
                cost = 0.5;
                break;
              case TileType.FOREST:
                cost = 1.5;
                break;
              case TileType.ORE:
                cost = 2.0;
                break;
              case TileType.SAND:
                cost = 1.3;
                break;
              case TileType.ICE:
                cost = 0.8;
                break;
              case TileType.MUD:
                cost = 2.0;
                break;
              case TileType.RUBBLE:
                cost = 1.5;
                break;
              case TileType.CRATER:
                cost = 1.5;
                break;
              case TileType.BRIDGE:
                cost = 0.8;
                break;
              default:
                cost = 1.0;
            }
          }
          this.movementCost.set(key, cost);
        }
      }
    }
  }

  isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    const key = `${x},${y}`;
    const cost = this.movementCost.get(key);
    return cost !== undefined && cost < Infinity;
  }

  getMovementCost(x: number, y: number): number {
    const key = `${x},${y}`;
    return this.movementCost.get(key) || 1;
  }

  getTileType(x: number, y: number): TileType | undefined {
    const key = `${x},${y}`;
    return this.tileTypes.get(key);
  }

  setObstacle(x: number, y: number, passable: boolean): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    const key = `${x},${y}`;
    if (passable) {
      this.movementCost.set(key, 1);
    } else {
      this.movementCost.set(key, Infinity);
    }
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize)
    };
  }

  gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: gridX * this.tileSize + this.tileSize / 2,
      y: gridY * this.tileSize + this.tileSize / 2
    };
  }
}

export class AStarPathfinder {
  private grid: PathfindingGrid;
  private config: PathfindingConfig;
  private cache: Map<string, PathResult> = new Map();
  private cacheAccessOrder: string[] = [];

  constructor(
    grid: PathfindingGrid,
    config: Partial<PathfindingConfig> = {}
  ) {
    this.grid = grid;
    this.config = { ...PATHFINDING_CONFIG, ...config };
  }

  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    unitSize: number = 1
  ): PathResult {
    const cacheKey = this.getCacheKey(startX, startY, endX, endY, unitSize);

    if (this.config.cacheResults && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      cached.nodesExplored = Math.floor(cached.nodesExplored / 2);
      return cached;
    }

    const startGrid = this.grid.worldToGrid(startX, startY);
    const endGrid = this.grid.worldToGrid(endX, endY);

    if (!this.grid.isWalkable(endGrid.x, endGrid.y)) {
      const nearestWalkable = this.findNearestWalkable(endGrid.x, endGrid.y);
      if (nearestWalkable) {
        return this.findPathInternal(
          startGrid.x,
          startGrid.y,
          nearestWalkable.x,
          nearestWalkable.y,
          unitSize
        );
      }
      return this.createFailedResult(cacheKey);
    }

    return this.findPathInternal(
      startGrid.x,
      startGrid.y,
      endGrid.x,
      endGrid.y,
      unitSize,
      cacheKey
    );
  }

  private findPathInternal(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    unitSize: number,
    cacheKey?: string
  ): PathResult {
    const openList = new MinHeap<PathNode>((a, b) => a.f - b.f);
    const openMap: Map<string, PathNode> = new Map();
    const closedSet: Set<string> = new Set();
    let iterations = 0;
    let nodesExplored = 0;

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, endX, endY),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h * this.config.heuristicWeight;

    openList.push(startNode);
    openMap.set(`${startX},${startY}`, startNode);

    while (openList.size > 0 && iterations < this.config.maxIterations) {
      iterations++;
      nodesExplored++;

      const current = openList.pop()!;
      const currentKey = `${current.x},${current.y}`;
      openMap.delete(currentKey);

      if (current.x === endX && current.y === endY) {
        const path = this.reconstructPath(current);
        const result: PathResult = {
          path,
          success: true,
          cost: current.g,
          nodesExplored
        };

        if (cacheKey && this.config.cacheResults) {
          this.addToCache(cacheKey, result);
        }

        return result;
      }

      closedSet.add(currentKey);

      const neighbors = this.getNeighbors(current.x, current.y, unitSize);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        if (closedSet.has(neighborKey)) continue;
        if (!this.isAreaWalkable(neighbor.x, neighbor.y, unitSize)) continue;

        const moveCost = this.getMoveCost(current.x, current.y, neighbor.x, neighbor.y);
        const tentativeG = current.g + moveCost * this.grid.getMovementCost(neighbor.x, neighbor.y);

        const existing = openMap.get(neighborKey);

        if (!existing) {
          const neighborNode: PathNode = {
            x: neighbor.x,
            y: neighbor.y,
            g: tentativeG,
            h: this.heuristic(neighbor.x, neighbor.y, endX, endY),
            f: 0,
            parent: current
          };
          neighborNode.f = neighborNode.g + neighborNode.h * this.config.heuristicWeight;
          openList.push(neighborNode);
          openMap.set(neighborKey, neighborNode);
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h * this.config.heuristicWeight;
          existing.parent = current;
          openList.push(existing);
        }
      }
    }

    const result = this.createFailedResult(cacheKey, nodesExplored);
    return result;
  }

  private getNeighbors(x: number, y: number, _unitSize: number): { x: number; y: number }[] {
    const neighbors: { x: number; y: number }[] = [];

    neighbors.push({ x: x, y: y - 1 });
    neighbors.push({ x: x + 1, y: y });
    neighbors.push({ x: x, y: y + 1 });
    neighbors.push({ x: x - 1, y: y });

    if (this.config.enableDiagonal) {
      neighbors.push({ x: x - 1, y: y - 1 });
      neighbors.push({ x: x + 1, y: y - 1 });
      neighbors.push({ x: x - 1, y: y + 1 });
      neighbors.push({ x: x + 1, y: y + 1 });
    }

    return neighbors.filter(n => {
      if (n.x === x - 1 && n.y === y - 1) {
        return this.config.allowCornerCutting ||
          (this.grid.isWalkable(x - 1, y) && this.grid.isWalkable(x, y - 1));
      }
      if (n.x === x + 1 && n.y === y - 1) {
        return this.config.allowCornerCutting ||
          (this.grid.isWalkable(x + 1, y) && this.grid.isWalkable(x, y - 1));
      }
      if (n.x === x - 1 && n.y === y + 1) {
        return this.config.allowCornerCutting ||
          (this.grid.isWalkable(x - 1, y) && this.grid.isWalkable(x, y + 1));
      }
      if (n.x === x + 1 && n.y === y + 1) {
        return this.config.allowCornerCutting ||
          (this.grid.isWalkable(x + 1, y) && this.grid.isWalkable(x, y + 1));
      }
      return true;
    });
  }

  private getMoveCost(fromX: number, fromY: number, toX: number, toY: number): number {
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);

    if (dx > 0 && dy > 0) {
      return this.config.tileCostDiagonal;
    }
    return this.config.tileCostStraight;
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);

    if (this.config.enableDiagonal) {
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    }
    return dx + dy;
  }

  private isAreaWalkable(x: number, y: number, unitSize: number): boolean {
    for (let dx = 0; dx < unitSize; dx++) {
      for (let dy = 0; dy < unitSize; dy++) {
        if (!this.grid.isWalkable(x + dx, y + dy)) {
          return false;
        }
      }
    }
    return true;
  }

  private findNearestWalkable(x: number, y: number): { x: number; y: number } | null {
    for (let radius = 1; radius <= Math.max(this.grid.getWidth(), this.grid.getHeight()); radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

          const nx = x + dx;
          const ny = y + dy;

          if (this.grid.isWalkable(nx, ny)) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return null;
  }

  private reconstructPath(node: PathNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: PathNode | null = node;

    while (current) {
      path.unshift(this.grid.gridToWorld(current.x, current.y));
      current = current.parent;
    }

    return path;
  }

  private getCacheKey(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    unitSize: number
  ): string {
    return `${startX},${startY}|${endX},${endY}|${unitSize}`;
  }

  private addToCache(key: string, result: PathResult): void {
    if (this.cache.size >= this.config.cacheSize) {
      const oldestKey = this.cacheAccessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, result);
    this.cacheAccessOrder.push(key);
  }

  private createFailedResult(cacheKey?: string, nodesExplored: number = 0): PathResult {
    const result: PathResult = {
      path: [],
      success: false,
      cost: Infinity,
      nodesExplored
    };

    if (cacheKey && this.config.cacheResults) {
      this.addToCache(cacheKey, result);
    }

    return result;
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheAccessOrder = [];
  }

  /**
   * Export cache to JSON for persistence
   * @returns JSON string representation of the cache
   */
  exportCache(): string {
    const cacheData = {
      entries: Array.from(this.cache.entries()),
      accessOrder: this.cacheAccessOrder
    };
    return JSON.stringify(cacheData);
  }

  /**
   * Import cache from JSON
   * @param json - JSON string from exportCache()
   * @returns true if successful
   */
  importCache(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.entries && Array.isArray(data.entries)) {
        this.cache = new Map(data.entries);
        this.cacheAccessOrder = data.accessOrder || [];
        return true;
      }
      return false;
    } catch {
      console.error('Failed to import pathfinding cache');
      return false;
    }
  }

  updateConfig(config: Partial<PathfindingConfig>): void {
    this.config = { ...this.config, ...config };
    if (!this.config.cacheResults) {
      this.clearCache();
    }
  }
}

export class PathfindingManager {
  private grid: PathfindingGrid;
  private pathfinder: AStarPathfinder;
  private activePaths: Map<string, {
    path: { x: number; y: number }[];
    currentIndex: number;
    speed: number;
  }> = new Map();

  // 动态障碍物：其他单位的占据位置
  private dynamicObstacles: Map<string, { x: number; y: number; radius: number }> = new Map();

  constructor(
    grid?: PathfindingGrid,
    config?: Partial<PathfindingConfig>
  ) {
    this.grid = grid || new PathfindingGrid();
    this.pathfinder = new AStarPathfinder(this.grid, config);
  }

  getGrid(): PathfindingGrid {
    return this.grid;
  }

  initialize(
    mapData: {
      width: number;
      height: number;
      tiles?: Array<Array<{ type?: TileType }>>;
    },
    options?: {
      impassableTypes?: TileType[];
      tileSize?: number;
    }
  ): void {
    this.grid.initialize(mapData, options);
  }

  updateObstacles(buildings: Array<{position: {x: number, y: number}, width: number, height: number, type: string}>): void {
    // Reset all cells that aren't inherently impassable terrain, then re-apply wall obstacles
    for (let y = 0; y < this.grid.getHeight(); y++) {
      for (let x = 0; x < this.grid.getWidth(); x++) {
        const tileType = this.grid.getTileType(x, y);
        // Only reset cells that aren't inherently impassable terrain
        if (tileType !== TileType.WATER && tileType !== TileType.MOUNTAIN && tileType !== TileType.CLIFF) {
          // Check if this cell is occupied by a wall
          const isWallOccupied = buildings.some(b => {
            if (b.type !== BuildingType.WALL) return false;
            const startTileX = Math.floor(b.position.x / GAME_CONFIG.TILE_SIZE);
            const startTileY = Math.floor(b.position.y / GAME_CONFIG.TILE_SIZE);
            return x >= startTileX && x < startTileX + b.width &&
                   y >= startTileY && y < startTileY + b.height;
          });
          this.grid.setObstacle(x, y, !isWallOccupied);
        }
      }
    }
    // Clear pathfinder cache since grid changed
    this.pathfinder.clearCache();
    // Invalidate active paths so units re-pathfind around new obstacles
    this.activePaths.clear();
  }

  // 更新动态障碍物（每帧调用）
  updateDynamicObstacles(units: Array<{ id: string; position: { x: number; y: number }; isAirborne: boolean; isNaval: boolean }>): void {
    this.dynamicObstacles.clear();
    for (const unit of units) {
      // 空军不作为地面障碍物
      if (unit.isAirborne) continue;
      const gridPos = this.grid.worldToGrid(unit.position.x, unit.position.y);
      this.dynamicObstacles.set(unit.id, {
        x: gridPos.x,
        y: gridPos.y,
        radius: 1, // 占据1格
      });
    }
  }

  // 检查某个格子是否被动态障碍物占据
  isDynamicObstacle(gridX: number, gridY: number, excludeUnitId?: string): boolean {
    for (const [id, obstacle] of this.dynamicObstacles) {
      if (id === excludeUnitId) continue;
      const dx = Math.abs(gridX - obstacle.x);
      const dy = Math.abs(gridY - obstacle.y);
      if (dx <= obstacle.radius - 1 && dy <= obstacle.radius - 1) {
        return true;
      }
    }
    return false;
  }

  // 路径平滑：使用视线检测移除不必要的中间节点
  smoothPath(path: { x: number; y: number }[]): { x: number; y: number }[] {
    if (path.length <= 2) return path;

    const smoothed: { x: number; y: number }[] = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
      // 从最远的点开始检查是否有直线视线
      let farthest = current + 1;
      for (let i = path.length - 1; i > current + 1; i--) {
        if (this.findLineOfSight(path[current].x, path[current].y, path[i].x, path[i].y)) {
          farthest = i;
          break;
        }
      }
      smoothed.push(path[farthest]);
      current = farthest;
    }

    return smoothed;
  }

  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    unitSize: number = 1,
    isAirborne: boolean = false,
    isNaval: boolean = false,
    excludeUnitId?: string,  // 排除自身单位
    isAmphibious: boolean = false  // 两栖单位（运输船）
  ): PathResult {
    if (isAirborne) {
      // Air units fly straight - no terrain avoidance needed
      return {
        path: [
          { x: startX, y: startY },
          { x: endX, y: endY }
        ],
        success: true,
        cost: Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2),
        nodesExplored: 0
      };
    }
    if (isAmphibious) {
      return this.findPathAmphibious(startX, startY, endX, endY, unitSize, excludeUnitId);
    }
    if (isNaval) {
      return this.findPathNaval(startX, startY, endX, endY, unitSize, excludeUnitId);
    }

    const result = this.pathfinder.findPath(startX, startY, endX, endY, unitSize);

    // Apply path smoothing
    if (result.success && result.path.length > 2) {
      result.path = this.smoothPath(result.path);
    }

    return result;
  }

  private findPathNaval(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    unitSize: number,
    _excludeUnitId?: string
  ): PathResult {
    const startGrid = this.grid.worldToGrid(startX, startY);
    const endGrid = this.grid.worldToGrid(endX, endY);

    if (!this.isNavalWalkable(endGrid.x, endGrid.y)) {
      const nearestWater = this.findNearestNavalWalkable(endGrid.x, endGrid.y);
      if (nearestWater) {
        endGrid.x = nearestWater.x;
        endGrid.y = nearestWater.y;
      } else {
        return { path: [], success: false, cost: Infinity, nodesExplored: 0 };
      }
    }

    const openList = new MinHeap<PathNode>((a, b) => a.f - b.f);
    const openMap: Map<string, PathNode> = new Map();
    const closedSet: Set<string> = new Set();
    let nodesExplored = 0;
    const maxIter = 10000;

    const startNode: PathNode = {
      x: startGrid.x, y: startGrid.y, g: 0,
      h: Math.max(Math.abs(endGrid.x - startGrid.x), Math.abs(endGrid.y - startGrid.y)) +
         (Math.SQRT2 - 1) * Math.min(Math.abs(endGrid.x - startGrid.x), Math.abs(endGrid.y - startGrid.y)),
      f: 0, parent: null
    };
    startNode.f = startNode.g + startNode.h;

    openList.push(startNode);
    openMap.set(`${startGrid.x},${startGrid.y}`, startNode);

    const dirs = [
      {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0},
      {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}, {dx: 1, dy: 1}
    ];

    while (openList.size > 0 && nodesExplored < maxIter) {
      nodesExplored++;
      const current = openList.pop()!;
      const currentKey = `${current.x},${current.y}`;
      openMap.delete(currentKey);

      if (current.x === endGrid.x && current.y === endGrid.y) {
        const path = this.reconstructNavalPath(current);
        return { path, success: true, cost: current.g, nodesExplored };
      }

      closedSet.add(currentKey);

      for (const dir of dirs) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const nKey = `${nx},${ny}`;

        if (closedSet.has(nKey)) continue;
        if (!this.isNavalAreaWalkable(nx, ny, unitSize)) continue;

        const isDiag = dir.dx !== 0 && dir.dy !== 0;
        const moveCost = isDiag ? 1.414 : 1.0;
        const tentativeG = current.g + moveCost;

        const existing = openMap.get(nKey);
        if (!existing) {
          const h = Math.max(Math.abs(endGrid.x - nx), Math.abs(endGrid.y - ny)) +
                    (Math.SQRT2 - 1) * Math.min(Math.abs(endGrid.x - nx), Math.abs(endGrid.y - ny));
          const node: PathNode = { x: nx, y: ny, g: tentativeG, h, f: tentativeG + h, parent: current };
          openList.push(node);
          openMap.set(nKey, node);
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
          openList.push(existing);
        }
      }
    }

    return { path: [], success: false, cost: Infinity, nodesExplored };
  }

  private isNavalWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.grid.getWidth() || y < 0 || y >= this.grid.getHeight()) return false;
    return this.grid.getTileType(x, y) === TileType.WATER;
  }

  /** Check if a tile is walkable for amphibious units (water or walkable land, excluding mountains/forests/cliffs) */
  private isAmphibiousWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.grid.getWidth() || y < 0 || y >= this.grid.getHeight()) return false;
    const tileType = this.grid.getTileType(x, y);
    if (!tileType) return false;
    // Water is walkable
    if (tileType === TileType.WATER) return true;
    // Mountains, forests, and cliffs are NOT walkable for amphibious units
    if (tileType === TileType.MOUNTAIN || tileType === TileType.FOREST || tileType === TileType.CLIFF) return false;
    // All other land tiles are walkable (grass, sand, road, ore, ice, mud, rubble, crater, bridge)
    return this.grid.isWalkable(x, y);
  }

  private isAmphibiousAreaWalkable(x: number, y: number, unitSize: number): boolean {
    for (let dx = 0; dx < unitSize; dx++) {
      for (let dy = 0; dy < unitSize; dy++) {
        if (!this.isAmphibiousWalkable(x + dx, y + dy)) return false;
      }
    }
    return true;
  }

  private findNearestAmphibiousWalkable(x: number, y: number): { x: number; y: number } | null {
    for (let radius = 1; radius <= Math.max(this.grid.getWidth(), this.grid.getHeight()); radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          if (this.isAmphibiousWalkable(x + dx, y + dy)) {
            return { x: x + dx, y: y + dy };
          }
        }
      }
    }
    return null;
  }

  /** Find path for amphibious units (transport ships) that can traverse both water and walkable land */
  private findPathAmphibious(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    unitSize: number,
    _excludeUnitId?: string
  ): PathResult {
    const startGrid = this.grid.worldToGrid(startX, startY);
    const endGrid = this.grid.worldToGrid(endX, endY);

    if (!this.isAmphibiousAreaWalkable(endGrid.x, endGrid.y, unitSize)) {
      const nearest = this.findNearestAmphibiousWalkable(endGrid.x, endGrid.y);
      if (nearest) {
        endGrid.x = nearest.x;
        endGrid.y = nearest.y;
      } else {
        return { path: [], success: false, cost: Infinity, nodesExplored: 0 };
      }
    }

    const openList = new MinHeap<PathNode>((a, b) => a.f - b.f);
    const openMap: Map<string, PathNode> = new Map();
    const closedSet: Set<string> = new Set();
    let nodesExplored = 0;
    const maxIter = 10000;

    const startNode: PathNode = {
      x: startGrid.x, y: startGrid.y, g: 0,
      h: Math.max(Math.abs(endGrid.x - startGrid.x), Math.abs(endGrid.y - startGrid.y)) +
         (Math.SQRT2 - 1) * Math.min(Math.abs(endGrid.x - startGrid.x), Math.abs(endGrid.y - startGrid.y)),
      f: 0, parent: null
    };
    startNode.f = startNode.g + startNode.h;

    openList.push(startNode);
    openMap.set(`${startGrid.x},${startGrid.y}`, startNode);

    const dirs = [
      {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0},
      {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}, {dx: 1, dy: 1}
    ];

    while (openList.size > 0 && nodesExplored < maxIter) {
      nodesExplored++;
      const current = openList.pop()!;
      const currentKey = `${current.x},${current.y}`;
      openMap.delete(currentKey);

      if (current.x === endGrid.x && current.y === endGrid.y) {
        const path = this.reconstructNavalPath(current);
        return { path, success: true, cost: current.g, nodesExplored };
      }

      closedSet.add(currentKey);

      for (const dir of dirs) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const nKey = `${nx},${ny}`;

        if (closedSet.has(nKey)) continue;
        if (!this.isAmphibiousAreaWalkable(nx, ny, unitSize)) continue;

        const isDiag = dir.dx !== 0 && dir.dy !== 0;
        let moveCost = isDiag ? 1.414 : 1.0;
        // Land tiles cost double for amphibious units (half speed on land)
        const tileType = this.grid.getTileType(nx, ny);
        if (tileType !== TileType.WATER) {
          moveCost *= 2;
        }
        const tentativeG = current.g + moveCost;

        const existing = openMap.get(nKey);
        if (!existing) {
          const h = Math.max(Math.abs(endGrid.x - nx), Math.abs(endGrid.y - ny)) +
                    (Math.SQRT2 - 1) * Math.min(Math.abs(endGrid.x - nx), Math.abs(endGrid.y - ny));
          const node: PathNode = { x: nx, y: ny, g: tentativeG, h, f: tentativeG + h, parent: current };
          openList.push(node);
          openMap.set(nKey, node);
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
          openList.push(existing);
        }
      }
    }

    return { path: [], success: false, cost: Infinity, nodesExplored };
  }

  private isNavalAreaWalkable(x: number, y: number, unitSize: number): boolean {
    for (let dx = 0; dx < unitSize; dx++) {
      for (let dy = 0; dy < unitSize; dy++) {
        if (!this.isNavalWalkable(x + dx, y + dy)) return false;
      }
    }
    return true;
  }

  private findNearestNavalWalkable(x: number, y: number): { x: number; y: number } | null {
    for (let radius = 1; radius <= Math.max(this.grid.getWidth(), this.grid.getHeight()); radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          if (this.isNavalWalkable(x + dx, y + dy)) {
            return { x: x + dx, y: y + dy };
          }
        }
      }
    }
    return null;
  }

  private reconstructNavalPath(node: PathNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: PathNode | null = node;
    while (current) {
      path.unshift(this.grid.gridToWorld(current.x, current.y));
      current = current.parent;
    }
    return path;
  }

  setWalkable(tileX: number, tileY: number, walkable: boolean): void {
    this.grid.setObstacle(tileX, tileY, walkable);
  }

  startPathFollowing(
    unitId: string,
    path: { x: number; y: number }[],
    speed: number = 100
  ): void {
    if (path.length === 0) return;

    this.activePaths.set(unitId, {
      path,
      currentIndex: 0,
      speed
    });
  }

  stopPathFollowing(unitId: string): void {
    this.activePaths.delete(unitId);
  }

  updatePathFollowing(
    unitId: string,
    currentX: number,
    currentY: number,
    deltaTime: number
  ): { x: number; y: number; reachedEnd: boolean; pathIndex: number } | null {
    const pathData = this.activePaths.get(unitId);
    if (!pathData || pathData.currentIndex >= pathData.path.length) {
      this.activePaths.delete(unitId);
      return null;
    }

    const target = pathData.path[pathData.currentIndex];
    const dx = target.x - currentX;
    const dy = target.y - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const moveDistance = pathData.speed * (deltaTime / 1000);

    if (distance <= moveDistance) {
      const reachedEnd = pathData.currentIndex >= pathData.path.length - 1;
      pathData.currentIndex++;

      if (pathData.currentIndex >= pathData.path.length) {
        this.activePaths.delete(unitId);
      }

      return {
        x: target.x,
        y: target.y,
        reachedEnd,
        pathIndex: pathData.currentIndex
      };
    }

    const ratio = moveDistance / distance;
    return {
      x: currentX + dx * ratio,
      y: currentY + dy * ratio,
      reachedEnd: false,
      pathIndex: pathData.currentIndex
    };
  }

  isFollowingPath(unitId: string): boolean {
    return this.activePaths.has(unitId);
  }

  getPathProgress(unitId: string): number {
    const pathData = this.activePaths.get(unitId);
    if (!pathData || pathData.path.length === 0) return 0;

    return pathData.currentIndex / (pathData.path.length - 1);
  }

  findLineOfSight(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): boolean {
    const startGrid = this.grid.worldToGrid(startX, startY);
    const endGrid = this.grid.worldToGrid(endX, endY);

    const dx = Math.abs(endGrid.x - startGrid.x);
    const dy = Math.abs(endGrid.y - startGrid.y);
    const sx = startGrid.x < endGrid.x ? 1 : -1;
    const sy = startGrid.y < endGrid.y ? 1 : -1;

    let err = dx - dy;
    let x = startGrid.x;
    let y = startGrid.y;

    while (true) {
      if (!this.grid.isWalkable(x, y)) {
        return false;
      }

      if (x === endGrid.x && y === endGrid.y) {
        return true;
      }

      const e2 = 2 * err;

      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }

      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  getReachableTiles(
    startX: number,
    startY: number,
    maxCost: number
  ): { x: number; y: number; cost: number }[] {
    const reachable: { x: number; y: number; cost: number }[] = [];
    const visited: Set<string> = new Set();
    const queue: { x: number; y: number; cost: number }[] = [];

    const startKey = `${startX},${startY}`;
    visited.add(startKey);
    queue.push({ x: startX, y: startY, cost: 0 });

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.cost > 0) {
        reachable.push({ x: current.x, y: current.y, cost: current.cost });
      }

      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 }
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;

        if (visited.has(key)) continue;
        if (!this.grid.isWalkable(neighbor.x, neighbor.y)) continue;

        const moveCost = this.grid.getMovementCost(neighbor.x, neighbor.y);
        const totalCost = current.cost + moveCost;

        if (totalCost > maxCost) continue;

        visited.add(key);
        queue.push({ x: neighbor.x, y: neighbor.y, cost: totalCost });
      }
    }

    return reachable;
  }

  clearCache(): void {
    this.pathfinder.clearCache();
  }

  dispose(): void {
    this.activePaths.clear();
    this.dynamicObstacles.clear();
    this.pathfinder.clearCache();
  }
}
