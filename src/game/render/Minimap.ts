import Phaser from 'phaser';
import { getFactionColors } from '../config/FactionTheme';
import { Faction } from '../../types';

export interface MinimapConfig {
  width: number;
  height: number;
  x: number;
  y: number;
  backgroundColor: number;
  backgroundAlpha: number;
  borderColor: number;
  borderWidth: number;
  terrainColors: Record<string, number>;
  unitSize: number;
  buildingSize: number;
  viewportColor: number;
  viewportAlpha: number;
  resourceColor: number;
  opacity: number;
}

export const MINIMAP_CONFIG: MinimapConfig = {
  width: 200,
  height: 150,
  x: -10,
  y: -10,
  backgroundColor: 0x1a1a1a,
  backgroundAlpha: 0.9,
  borderColor: 0x444444,
  borderWidth: 2,
  terrainColors: {
    grass: 0x2d5016,
    water: 0x1a4d7c,
    road: 0x8b7355,
    ore: 0xff6b35,
    forest: 0x1e4d2b
  },
  unitSize: 4,
  buildingSize: 6,
  viewportColor: 0xffffff,
  viewportAlpha: 0.3,
  resourceColor: 0xffaa00,
  opacity: 0.95
};

export interface MinimapEntity {
  id: string;
  x: number;
  y: number;
  type: 'unit' | 'building' | 'resource';
  faction?: Faction;
}

export class Minimap {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private viewportRect!: Phaser.GameObjects.Rectangle;
  private container: Phaser.GameObjects.Container;
  private entities: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private config: MinimapConfig;
  private worldWidth: number = 1000;
  private worldHeight: number = 1000;
  private minimapX: number = 0;
  private minimapY: number = 0;
  private scaleX: number = 1;
  private scaleY: number = 1;
  private isDragging: boolean = false;
  private onViewportClick?: (worldX: number, worldY: number) => void;

  constructor(
    scene: Phaser.Scene,
    config: Partial<MinimapConfig> = {},
    onViewportClick?: (worldX: number, worldY: number) => void
  ) {
    this.scene = scene;
    this.config = { ...MINIMAP_CONFIG, ...config };
    this.onViewportClick = onViewportClick;

    this.container = scene.add.container(
      this.config.x,
      this.config.y
    );
    this.container.setDepth(2000);
    this.container.setScrollFactor(0);

    const bg = scene.add.rectangle(
      0,
      0,
      this.config.width + this.config.borderWidth * 2,
      this.config.height + this.config.borderWidth * 2
    );
    bg.setFillStyle(this.config.borderColor);
    bg.setOrigin(0, 0);
    bg.setPosition(-this.config.borderWidth, -this.config.borderWidth);
    this.container.add(bg);

    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);

    this.viewportRect = scene.add.rectangle(
      0,
      0,
      this.config.width,
      this.config.height
    );
    this.viewportRect.setStrokeStyle(1, this.config.viewportColor, 0.5);
    this.viewportRect.setFillStyle(this.config.viewportColor, this.config.viewportAlpha);
    this.viewportRect.setOrigin(0, 0);
    this.container.add(this.viewportRect);

    this.setupInteraction();
    this.drawBorder();
  }

  private setupInteraction(): void {
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.config.width, this.config.height),
      Phaser.Geom.Rectangle.Contains
    );

    this.container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.handleClick(pointer);
    });

    this.container.on('pointerup', () => {
      this.isDragging = false;
    });

    this.container.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.handleClick(pointer);
      }
    });

    this.container.on('pointerout', () => {
      this.isDragging = false;
    });
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    const localX = pointer.x - this.container.x;
    const localY = pointer.y - this.container.y;

    if (
      localX >= 0 &&
      localX <= this.config.width &&
      localY >= 0 &&
      localY <= this.config.height
    ) {
      const worldX = (localX / this.scaleX) + this.minimapX;
      const worldY = (localY / this.scaleY) + this.minimapY;

      if (this.onViewportClick) {
        this.onViewportClick(worldX, worldY);
      }
    }
  }

  setWorldBounds(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
    this.scaleX = this.config.width / width;
    this.scaleY = this.config.height / height;
  }

  updateTerrain(map: {
    width: number;
    height: number;
    tiles?: Array<Array<{ type: string }>>;
  }): void {
    this.graphics.clear();

    this.graphics.fillStyle(this.config.backgroundColor, this.config.backgroundAlpha);
    this.graphics.fillRect(0, 0, this.config.width, this.config.height);

    if (map.tiles) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const tile = map.tiles[y]?.[x];
          if (tile) {
            const color = this.config.terrainColors[tile.type] || this.config.terrainColors.grass;
            const px = x * this.scaleX;
            const py = y * this.scaleY;
            this.graphics.fillStyle(color, 0.6);
            this.graphics.fillRect(px, py, this.scaleX + 0.5, this.scaleY + 0.5);
          }
        }
      }
    }
  }

  updateEntity(entity: MinimapEntity): void {
    const worldX = entity.x * this.scaleX;
    const worldY = entity.y * this.scaleY;

    let marker = this.entities.get(entity.id);

    if (!marker) {
      marker = this.scene.add.graphics();
      this.container.add(marker);
      this.entities.set(entity.id, marker);
    }

    marker.clear();

    let color: number;
    let size: number;

    switch (entity.type) {
      case 'unit':
        size = this.config.unitSize;
        color = entity.faction ? getFactionColors(entity.faction).primary : 0x888888;
        break;
      case 'building':
        size = this.config.buildingSize;
        color = entity.faction ? getFactionColors(entity.faction).primary : 0x888888;
        break;
      case 'resource':
        size = this.config.unitSize + 2;
        color = this.config.resourceColor;
        break;
      default:
        size = this.config.unitSize;
        color = 0xffffff;
    }

    marker.fillStyle(color, 1);
    if (entity.type === 'unit') {
      marker.fillCircle(worldX, worldY, size / 2);
    } else {
      marker.fillRect(
        worldX - size / 2,
        worldY - size / 2,
        size,
        size
      );
    }

    marker.setPosition(0, 0);
  }

  removeEntity(id: string): void {
    const marker = this.entities.get(id);
    if (marker) {
      this.container.remove(marker);
      marker.destroy();
      this.entities.delete(id);
    }
  }

  clearEntities(): void {
    this.entities.forEach((marker) => {
      this.container.remove(marker);
      marker.destroy();
    });
    this.entities.clear();
  }

  updateViewport(camera: Phaser.Cameras.Scene2D.Camera): void {
    const viewX = (camera.scrollX - this.minimapX) * this.scaleX;
    const viewY = (camera.scrollY - this.minimapY) * this.scaleY;
    const viewWidth = (camera.width / camera.zoom) * this.scaleX;
    const viewHeight = (camera.height / camera.zoom) * this.scaleY;

    this.viewportRect.setPosition(viewX, viewY);
    this.viewportRect.setDisplaySize(viewWidth, viewHeight);
    this.viewportRect.setStrokeStyle(2, this.config.viewportColor, 0.8);
  }

  private drawBorder(): void {
    const bg = this.scene.add.rectangle(
      0,
      0,
      this.config.width,
      this.config.height
    );
    bg.setStrokeStyle(this.config.borderWidth, this.config.borderColor);
    bg.setOrigin(0, 0);
    this.container.add(bg);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  setSize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.scaleX = width / this.worldWidth;
    this.scaleY = height / this.worldHeight;
    this.graphics.clear();
    this.graphics.fillStyle(this.config.backgroundColor, this.config.backgroundAlpha);
    this.graphics.fillRect(0, 0, width, height);
  }

  addMarker(x: number, y: number, color: number, label?: string): void {
    const markerX = x * this.scaleX;
    const markerY = y * this.scaleY;

    const marker = this.scene.add.graphics();
    marker.fillStyle(color, 1);
    marker.lineStyle(2, 0xffffff);
    marker.strokeCircle(markerX, markerY, 8);
    marker.setDepth(2001);
    this.container.add(marker);

    if (label) {
      const text = this.scene.add.text(markerX, markerY - 15, label, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial'
      });
      text.setOrigin(0.5, 1);
      text.setDepth(2001);
      this.container.add(text);
    }
  }

  flashPosition(x: number, y: number, color: number = 0xff0000): void {
    const markerX = x * this.scaleX;
    const markerY = y * this.scaleY;

    const marker = this.scene.add.graphics();
    marker.setDepth(2001);
    this.container.add(marker);

    const drawCircle = (scale: number, alpha: number) => {
      marker.clear();
      marker.fillStyle(color, alpha);
      marker.fillCircle(markerX, markerY, 10 * scale);
    };

    drawCircle(1, 0.5);

    this.scene.tweens.add({
      targets: { scale: 1, alpha: 1 },
      scale: 3,
      alpha: 0,
      duration: 500,
      onUpdate: (tween) => {
        const progress = tween.progress;
        drawCircle(1 + progress * 2, 0.5 * (1 - progress));
      },
      onComplete: () => {
        this.container.remove(marker);
        marker.destroy();
      }
    });
  }

  dispose(): void {
    this.clearEntities();
    this.container.destroy();
  }
}