import Phaser from 'phaser';

export interface IndicatorConfig {
  moveColor: number;
  moveAlpha: number;
  attackColor: number;
  attackAlpha: number;
  gatherColor: number;
  gatherAlpha: number;
  invalidColor: number;
  invalidAlpha: number;
  moveDotSize: number;
  pathLineWidth: number;
  rangeRingWidth: number;
}

export const INDICATOR_CONFIG: IndicatorConfig = {
  moveColor: 0x00ff00,
  moveAlpha: 0.8,
  attackColor: 0xff0000,
  attackAlpha: 0.6,
  gatherColor: 0xffaa00,
  gatherAlpha: 0.7,
  invalidColor: 0xff0000,
  invalidAlpha: 0.3,
  moveDotSize: 6,
  pathLineWidth: 2,
  rangeRingWidth: 1
};

export interface MoveIndicator {
  dots: Phaser.GameObjects.Arc[];
  pathLine?: Phaser.GameObjects.Graphics;
}

export class IndicatorSystem {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private moveIndicators: Map<string, MoveIndicator> = new Map();
  private rangeRings: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private attackRangeGraphics: Phaser.GameObjects.Graphics | null = null;
  private config: IndicatorConfig;
  private isVisible: boolean = true;

  constructor(scene: Phaser.Scene, config: Partial<IndicatorConfig> = {}) {
    this.scene = scene;
    this.config = { ...INDICATOR_CONFIG, ...config };
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(500);
  }

  showMoveIndicator(id: string, waypoints: { x: number; y: number }[]): void {
    this.hideMoveIndicator(id);

    if (waypoints.length === 0) return;

    const dots: Phaser.GameObjects.Arc[] = [];
    const pathLine = this.scene.add.graphics();

    pathLine.lineStyle(this.config.pathLineWidth, this.config.moveColor, this.config.moveAlpha * 0.5);
    pathLine.beginPath();
    pathLine.moveTo(waypoints[0].x, waypoints[0].y);

    for (let i = 1; i < waypoints.length; i++) {
      pathLine.lineTo(waypoints[i].x, waypoints[i].y);
    }
    pathLine.strokePath();

    waypoints.forEach((wp, index) => {
      const dot = this.scene.add.circle(
        wp.x,
        wp.y,
        index === waypoints.length - 1 ? this.config.moveDotSize : this.config.moveDotSize * 0.6,
        this.config.moveColor,
        index === waypoints.length - 1 ? this.config.moveAlpha : this.config.moveAlpha * 0.5
      );
      dot.setDepth(501);
      dots.push(dot);
    });

    this.moveIndicators.set(id, { dots, pathLine });
  }

  hideMoveIndicator(id: string): void {
    const indicator = this.moveIndicators.get(id);
    if (indicator) {
      indicator.dots.forEach(dot => dot.destroy());
      indicator.pathLine?.destroy();
      this.moveIndicators.delete(id);
    }
  }

  hideAllMoveIndicators(): void {
    this.moveIndicators.forEach((_, id) => this.hideMoveIndicator(id));
  }

  showAttackRange(x: number, y: number, range: number): Phaser.GameObjects.Graphics {
    this.hideAttackRange();
    const ring = this.scene.add.graphics();
    ring.lineStyle(this.config.rangeRingWidth, this.config.attackColor, this.config.attackAlpha);
    ring.strokeCircle(x, y, range);
    // Semi-transparent fill for better visibility
    ring.fillStyle(this.config.attackColor, this.config.attackAlpha * 0.15);
    ring.fillCircle(x, y, range);

    ring.setDepth(502);
    this.attackRangeGraphics = ring;
    return ring;
  }

  hideAttackRange(): void {
    if (this.attackRangeGraphics) {
      this.attackRangeGraphics.destroy();
      this.attackRangeGraphics = null;
    }
  }

  showGatherIndicator(x: number, y: number): Phaser.GameObjects.Graphics {
    const indicator = this.scene.add.graphics();
    indicator.setDepth(503);

    const pulseTime = 500;
    this.pulseGatherIndicator(indicator, x, y, pulseTime);

    return indicator;
  }

  private pulseGatherIndicator(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    duration: number
  ): void {
    graphics.clear();

    const time = this.scene.time.now % duration;
    const progress = time / duration;
    const alpha = this.config.gatherAlpha * (0.3 + Math.sin(progress * Math.PI * 2) * 0.3);
    const radius = 20 + Math.sin(progress * Math.PI * 2) * 5;

    graphics.fillStyle(this.config.gatherColor, alpha);
    graphics.fillCircle(x, y, radius);

    graphics.lineStyle(2, this.config.gatherColor, alpha * 1.5);
    graphics.strokeCircle(x, y, radius + 5);

    this.scene.time.delayedCall(duration / 60, () => {
      if (graphics.active) {
        this.pulseGatherIndicator(graphics, x, y, duration);
      }
    });
  }

  showInvalidPosition(x: number, y: number, radius: number): Phaser.GameObjects.Graphics {
    const indicator = this.scene.add.graphics();
    indicator.fillStyle(this.config.invalidColor, this.config.invalidAlpha);
    indicator.fillCircle(x, y, radius);
    indicator.setDepth(504);

    this.scene.tweens.add({
      targets: indicator,
      alpha: 0,
      duration: 300,
      onComplete: () => indicator.destroy()
    });

    return indicator;
  }

  showSelectionBox(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Phaser.GameObjects.Graphics {
    const box = this.scene.add.graphics();
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);

    box.fillStyle(0x00ff00, 0.1);
    box.fillRect(x, y, width, height);

    box.lineStyle(1, 0x00ff00, 0.8);
    box.strokeRect(x, y, width, height);

    box.setDepth(505);
    return box;
  }

  flashPosition(x: number, y: number, color: number, duration: number = 200): void {
    const flash = this.scene.add.graphics();
    flash.fillStyle(color, 0.5);
    flash.fillCircle(x, y, 20);
    flash.setDepth(506);

    this.scene.tweens.add({
      targets: flash,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration,
      onComplete: () => flash.destroy()
    });
  }

  showConstructionPreview(
    x: number,
    y: number,
    width: number,
    height: number,
    isValid: boolean
  ): Phaser.GameObjects.Graphics {
    const preview = this.scene.add.graphics();
    const color = isValid ? 0x00ff00 : 0xff0000;
    const alpha = isValid ? 0.3 : 0.2;

    preview.fillStyle(color, alpha);
    preview.fillRect(x, y, width, height);

    preview.lineStyle(2, color, 0.8);
    preview.strokeRect(x, y, width, height);

    for (let i = 0; i < 4; i++) {
      const cornerX = i % 2 === 0 ? x : x + width;
      const cornerY = i < 2 ? y : y + height;
      preview.fillStyle(color, 1);
      preview.fillCircle(cornerX, cornerY, 4);
    }

    preview.setDepth(507);
    return preview;
  }

  updateConstructionPreview(
    preview: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    isValid: boolean
  ): void {
    preview.clear();
    const color = isValid ? 0x00ff00 : 0xff0000;
    const alpha = isValid ? 0.3 : 0.2;

    preview.fillStyle(color, alpha);
    preview.fillRect(x, y, width, height);

    preview.lineStyle(2, color, 0.8);
    preview.strokeRect(x, y, width, height);
  }

  destroyConstructionPreview(preview: Phaser.GameObjects.Graphics): void {
    preview.destroy();
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.graphics.setVisible(visible);
    this.moveIndicators.forEach(indicator => {
      indicator.dots.forEach(dot => dot.setVisible(visible));
      indicator.pathLine?.setVisible(visible);
    });
    this.rangeRings.forEach(ring => ring.setVisible(visible));
  }

  dispose(): void {
    this.hideAllMoveIndicators();
    this.hideAttackRange();
    this.rangeRings.forEach(ring => ring.destroy());
    this.rangeRings.clear();
    this.graphics.destroy();
  }
}