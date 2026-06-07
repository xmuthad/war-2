import Phaser from 'phaser';

export interface CameraConfig {
  minZoom: number;
  maxZoom: number;
  zoomSpeed: number;
  panSpeed: number;
  edgeScrollMargin: number;
  edgeScrollSpeed: number;
  worldBoundsPadding: number;
}

export const CAMERA_CONFIG: CameraConfig = {
  minZoom: 0.5,
  maxZoom: 2.0,
  zoomSpeed: 0.001,
  panSpeed: 400,
  edgeScrollMargin: 50,
  edgeScrollSpeed: 300,
  worldBoundsPadding: 100
};

export class GameCamera {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private worldWidth: number = 0;
  private worldHeight: number = 0;
  private config: CameraConfig;

  constructor(scene: Phaser.Scene, config: Partial<CameraConfig> = {}) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.config = { ...CAMERA_CONFIG, ...config };
    this.setupCamera();
  }

  private setupCamera(): void {
    this.camera.setZoom(1);
    this.camera.setRoundPixels(true);
  }

  setWorldBounds(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  update(delta: number): void {
    if (!this.scene.input.activePointer.isDown) {
      this.handleEdgeScroll(delta);
    }
    this.clampCameraToWorld();
  }

  private handleEdgeScroll(delta: number): void {
    const pointer = this.scene.input.activePointer;
    const speed = this.config.edgeScrollSpeed * (delta / 1000);

    let dx = 0;
    let dy = 0;

    if (pointer.x < this.config.edgeScrollMargin) {
      dx = -speed;
    } else if (pointer.x > this.camera.width - this.config.edgeScrollMargin) {
      dx = speed;
    }

    if (pointer.y < this.config.edgeScrollMargin) {
      dy = -speed;
    } else if (pointer.y > this.camera.height - this.config.edgeScrollMargin) {
      dy = speed;
    }

    if (dx !== 0 || dy !== 0) {
      this.camera.scrollX += dx;
      this.camera.scrollY += dy;
    }
  }

  private clampCameraToWorld(): void {
    const zoom = this.camera.zoom;
    const viewWidth = this.camera.width / zoom;
    const viewHeight = this.camera.height / zoom;

    const minX = this.config.worldBoundsPadding;
    const maxX = Math.max(minX, this.worldWidth - viewWidth - this.config.worldBoundsPadding);
    const minY = this.config.worldBoundsPadding;
    const maxY = Math.max(minY, this.worldHeight - viewHeight - this.config.worldBoundsPadding);

    this.camera.scrollX = Phaser.Math.Clamp(this.camera.scrollX, minX, maxX);
    this.camera.scrollY = Phaser.Math.Clamp(this.camera.scrollY, minY, maxY);
  }

  handleWheelZoom(delta: number): void {
    const zoomDelta = delta * this.config.zoomSpeed;
    const newZoom = Phaser.Math.Clamp(
      this.camera.zoom - zoomDelta,
      this.config.minZoom,
      this.config.maxZoom
    );
    this.camera.setZoom(newZoom);
  }

  panTo(x: number, y: number, duration: number = 500): void {
    const targetX = x - this.camera.width / (2 * this.camera.zoom);
    const targetY = y - this.camera.height / (2 * this.camera.zoom);

    this.scene.tweens.add({
      targets: this.camera,
      scrollX: targetX,
      scrollY: targetY,
      duration,
      ease: 'Power2'
    });
  }

  centerOn(x: number, y: number): void {
    this.camera.centerOn(x, y);
  }

  followTarget(target: Phaser.GameObjects.GameObject, lerp: number = 0.1): void {
    this.camera.startFollow(target, true, lerp, lerp);
  }

  stopFollow(): void {
    this.camera.stopFollow();
  }

  getZoom(): number {
    return this.camera.zoom;
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return this.camera.getWorldPoint(screenX, screenY);
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: this.camera.scrollX + (worldX - this.camera.scrollX) * this.camera.zoom,
      y: this.camera.scrollY + (worldY - this.camera.scrollY) * this.camera.zoom
    };
  }

  isInView(x: number, y: number, margin: number = 100): boolean {
    const viewBounds = this.getViewBounds();
    return (
      x >= viewBounds.x - margin &&
      x <= viewBounds.x + viewBounds.width + margin &&
      y >= viewBounds.y - margin &&
      y <= viewBounds.y + viewBounds.height + margin
    );
  }

  getViewBounds(): { x: number; y: number; width: number; height: number } {
    const zoom = this.camera.zoom;
    return {
      x: this.camera.scrollX,
      y: this.camera.scrollY,
      width: this.camera.width / zoom,
      height: this.camera.height / zoom
    };
  }

  setBoundsEnabled(enabled: boolean): void {
    if (enabled && this.worldWidth > 0 && this.worldHeight > 0) {
      this.camera.setBounds(
        -this.config.worldBoundsPadding,
        -this.config.worldBoundsPadding,
        this.worldWidth + this.config.worldBoundsPadding * 2,
        this.worldHeight + this.config.worldBoundsPadding * 2
      );
    } else {
      this.camera.setBounds(0, 0, 0, 0);
    }
  }
}