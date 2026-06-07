import Phaser from 'phaser';
import { tileDiamond } from './IsometricUtils';

export type FogState = 'hidden' | 'explored' | 'visible';

export interface FogTile {
  state: FogState;
  exploredTime: number;
}

export interface FogOfWarConfig {
  revealRadius: number;
  exploreSpeed: number;
  fogColor: number;
  exploredAlpha: number;
  hiddenAlpha: number;
  updateInterval: number;
  edgeSmoothness: number;
}

export const FOG_OF_WAR_CONFIG: FogOfWarConfig = {
  revealRadius: 10,
  exploreSpeed: 0.05,
  fogColor: 0x000000,
  exploredAlpha: 0.5,
  hiddenAlpha: 0.95,
  updateInterval: 100,
  edgeSmoothness: 0.3
};

export class FogOfWar {
  private scene: Phaser.Scene;
  private fogLayer!: Phaser.GameObjects.Graphics;
  private fogTiles: Map<string, FogTile> = new Map();
  private config: FogOfWarConfig;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private tileSize: number = 32;
  private lastUpdateTime: number = 0;
  private observers: Set<{ x: number; y: number; radius: number }> = new Set();
  private isDirty: boolean = false;
  private dirtyTiles: Set<string> = new Set();

  constructor(scene: Phaser.Scene, config: Partial<FogOfWarConfig> = {}) {
    this.scene = scene;
    this.config = { ...FOG_OF_WAR_CONFIG, ...config };
  }

  create(mapWidth: number, mapHeight: number, tileSize: number = 32): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.tileSize = tileSize;
    this.fogTiles.clear();
    this.dirtyTiles.clear();

    this.fogLayer = this.scene.add.graphics();
    this.fogLayer.setDepth(1500);
    this.fogLayer.setBlendMode(Phaser.BlendModes.NORMAL);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const key = `${x},${y}`;
        this.fogTiles.set(key, {
          state: 'hidden',
          exploredTime: 0
        });
      }
    }

    this.isDirty = true;
    console.log('FogOfWar initialized');
  }

  getObserverCount(): number {
    return this.observers.size;
  }

  addObserver(x: number, y: number, radius: number = this.config.revealRadius): void {
    this.observers.add({ x, y, radius });
    this.isDirty = true;
    this.dirtyTiles.clear(); // Force full recalculation
  }

  removeObserver(x: number, y: number): void {
    for (const observer of this.observers) {
      if (observer.x === x && observer.y === y) {
        this.observers.delete(observer);
        this.isDirty = true;
        this.dirtyTiles.clear(); // Force full recalculation
        break;
      }
    }
  }

  clearObservers(): void {
    this.observers.clear();
    this.isDirty = true;
    this.dirtyTiles.clear(); // Force full recalculation
  }

  update(time: number): void {
    if (time - this.lastUpdateTime < this.config.updateInterval && !this.isDirty) {
      return;
    }
    this.lastUpdateTime = time;
    this.updateVisibility();
    if (this.isDirty) {
      this.render();
      this.isDirty = false;
      this.dirtyTiles.clear();
    }
  }

  private updateVisibility(): void {
    // Compute the set of tiles that should be visible based on observers
    const shouldBeVisible = new Set<string>();
    for (const observer of this.observers) {
      const minX = Math.max(0, Math.floor(observer.x - observer.radius));
      const maxX = Math.min(this.mapWidth - 1, Math.ceil(observer.x + observer.radius));
      const minY = Math.max(0, Math.floor(observer.y - observer.radius));
      const maxY = Math.min(this.mapHeight - 1, Math.ceil(observer.y + observer.radius));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const distance = Math.sqrt(
            Math.pow(x - observer.x, 2) + Math.pow(y - observer.y, 2)
          );
          if (distance <= observer.radius) {
            shouldBeVisible.add(`${x},${y}`);
          }
        }
      }
    }

    // Update tile states, only changing tiles that actually need to change
    this.fogTiles.forEach((tile, key) => {
      if (shouldBeVisible.has(key)) {
        // Tile should be visible
        if (tile.state !== 'visible') {
          tile.state = 'visible';
          tile.exploredTime = this.scene.time.now;
          this.isDirty = true;
          this.dirtyTiles.add(key);
        }
      } else if (tile.state === 'visible') {
        // Tile was visible but no longer in range → demote to explored
        tile.state = 'explored';
        this.isDirty = true;
        this.dirtyTiles.add(key);
      }
    });
  }

  private revealArea(centerX: number, centerY: number, radius: number): void {
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.mapWidth - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.mapHeight - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        );
        if (distance <= radius) {
          const key = `${x},${y}`;
          const tile = this.fogTiles.get(key);
          if (tile) {
            if (tile.state !== 'visible') {
              tile.state = 'visible';
              this.isDirty = true;
            }
            tile.exploredTime = this.scene.time.now;
          }
        }
      }
    }
  }

  private getTileAlpha(tileKey: string): number {
    const tile = this.fogTiles.get(tileKey);
    if (!tile) return this.config.hiddenAlpha;

    switch (tile.state) {
      case 'visible':
        return 0; // 完全可见
      case 'explored':
        return this.config.exploredAlpha * 0.7; // 比之前更透明，让地形轮廓可见
      case 'hidden':
      default:
        return this.config.hiddenAlpha;
    }
  }

  private getSmoothedAlpha(x: number, y: number): number {
    const key = `${x},${y}`;
    const baseAlpha = this.getTileAlpha(key);

    // If this tile is fully visible or fully hidden, no smoothing needed
    if (baseAlpha === 0 || baseAlpha >= this.config.hiddenAlpha) return baseAlpha;

    // Check neighbors for visible tiles (edge detection)
    const neighbors = [
      `${x-1},${y}`, `${x+1},${y}`,
      `${x},${y-1}`, `${x},${y+1}`,
    ];

    let visibleNeighborCount = 0;
    for (const nKey of neighbors) {
      const nTile = this.fogTiles.get(nKey);
      if (nTile && nTile.state === 'visible') {
        visibleNeighborCount++;
      }
    }

    // If adjacent to visible tiles, reduce alpha for smooth transition
    if (visibleNeighborCount > 0) {
      const smoothFactor = this.config.edgeSmoothness * (visibleNeighborCount / 4);
      return Math.max(0, baseAlpha - smoothFactor);
    }

    return baseAlpha;
  }

  private render(): void {
    // If there are few dirty tiles, do a targeted redraw; otherwise full redraw
    if (this.dirtyTiles.size > 0 && this.dirtyTiles.size < this.fogTiles.size * 0.3) {
      // Targeted redraw: only update tiles that changed
      for (const key of this.dirtyTiles) {
        const tile = this.fogTiles.get(key);
        if (!tile) continue;

        const commaIdx = key.indexOf(',');
        const x = parseInt(key.substring(0, commaIdx), 10);
        const y = parseInt(key.substring(commaIdx + 1), 10);

        if (tile.state === 'visible') {
          // Tile became visible - need full redraw to clear old fog
          this.renderFull();
          return;
        }

        // Draw fog for this tile (explored or hidden)
        const diamond = tileDiamond(x, y, this.tileSize);
        const alpha = this.getSmoothedAlpha(x, y);

        this.fogLayer.fillStyle(this.config.fogColor, alpha);
        this.fogLayer.beginPath();
        this.fogLayer.moveTo(diamond[0].x, diamond[0].y);
        this.fogLayer.lineTo(diamond[1].x, diamond[1].y);
        this.fogLayer.lineTo(diamond[2].x, diamond[2].y);
        this.fogLayer.lineTo(diamond[3].x, diamond[3].y);
        this.fogLayer.closePath();
        this.fogLayer.fillPath();
      }
    } else {
      this.renderFull();
    }
  }

  private renderFull(): void {
    this.fogLayer.clear();

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const key = `${x},${y}`;
        const tile = this.fogTiles.get(key);
        if (!tile || tile.state === 'visible') continue;

        const diamond = tileDiamond(x, y, this.tileSize);
        const alpha = this.getSmoothedAlpha(x, y);

        this.fogLayer.fillStyle(this.config.fogColor, alpha);
        this.fogLayer.beginPath();
        this.fogLayer.moveTo(diamond[0].x, diamond[0].y);
        this.fogLayer.lineTo(diamond[1].x, diamond[1].y);
        this.fogLayer.lineTo(diamond[2].x, diamond[2].y);
        this.fogLayer.lineTo(diamond[3].x, diamond[3].y);
        this.fogLayer.closePath();
        this.fogLayer.fillPath();
      }
    }
  }

  getTileState(x: number, y: number): FogState {
    const key = `${x},${y}`;
    const tile = this.fogTiles.get(key);
    return tile?.state || 'hidden';
  }

  isTileVisible(tileX: number, tileY: number): boolean {
    return this.getTileState(tileX, tileY) === 'visible';
  }

  isVisible(x: number, y: number): boolean {
    return this.getTileState(x, y) === 'visible';
  }

  isExplored(x: number, y: number): boolean {
    const state = this.getTileState(x, y);
    return state === 'visible' || state === 'explored';
  }

  isHidden(x: number, y: number): boolean {
    return this.getTileState(x, y) === 'hidden';
  }

  setTileRevealed(x: number, y: number, explored: boolean): void {
    const key = `${x},${y}`;
    const tile = this.fogTiles.get(key);
    if (tile) {
      const newState = explored ? 'explored' : 'hidden';
      if (tile.state !== newState) {
        tile.state = newState;
        this.isDirty = true;
        this.dirtyTiles.add(key);
      }
    }
  }

  revealAll(): void {
    this.fogTiles.forEach((tile, key) => {
      if (tile.state !== 'visible') {
        this.dirtyTiles.add(key);
      }
      tile.state = 'visible';
      tile.exploredTime = this.scene.time.now;
    });
    this.isDirty = true;
  }

  reset(): void {
    this.fogTiles.forEach((tile, key) => {
      if (tile.state !== 'hidden') {
        this.dirtyTiles.add(key);
      }
      tile.state = 'hidden';
      tile.exploredTime = 0;
    });
    this.observers.clear();
    this.isDirty = true;
  }

  dispose(): void {
    this.fogTiles.clear();
    this.observers.clear();
    this.fogLayer?.destroy();
  }
}
