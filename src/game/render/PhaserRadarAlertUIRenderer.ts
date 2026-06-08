import Phaser from 'phaser';
import {
  RadarAlertUIRenderer,
  RadarRenderState,
  AlertRenderData,
  type AlertLevel,
} from '../systems/RadarAlertSystem';

export class PhaserRadarAlertUIRenderer implements RadarAlertUIRenderer {
  private scene: Phaser.Scene;

  // Radar state
  private radarContainer: Phaser.GameObjects.Container | null = null;
  private scanLine: Phaser.GameObjects.Graphics | null = null;
  private blipGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();

  // Alert state
  private alertDisplayContainer: Phaser.GameObjects.Container | null = null;
  private activeAlertCount: number = 0;

  private disposed: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // --- Radar operations ---

  initRadar(_minimapScale: number, _centerX: number, _centerY: number): void {
    if (this.disposed) return;

    this.radarContainer = this.scene.add.container(0, 0);
    this.radarContainer.setDepth(1950);

    this.scanLine = this.scene.add.graphics();
    this.radarContainer.add(this.scanLine);
  }

  addBlipGraphics(blipId: string): void {
    if (this.disposed) return;

    if (!this.blipGraphics.has(blipId)) {
      const graphics = this.scene.add.graphics();
      this.blipGraphics.set(blipId, graphics);
      this.radarContainer?.add(graphics);
    }
  }

  removeBlipGraphics(blipId: string): void {
    const graphics = this.blipGraphics.get(blipId);
    if (graphics) {
      graphics.destroy();
      this.blipGraphics.delete(blipId);
    }
  }

  setRadarVisible(visible: boolean): void {
    this.radarContainer?.setVisible(visible);
  }

  updateRadar(state: RadarRenderState): void {
    if (this.disposed || !this.scanLine) return;

    const { scanAngle, blips, config, minimapScale, centerX, centerY } = state;

    this.scanLine.clear();
    this.scanLine.lineStyle(1, 0x00ff00, 0.3);
    this.scanLine.lineBetween(
      centerX,
      centerY,
      centerX + Math.cos(scanAngle) * config.scanRadius * minimapScale,
      centerY + Math.sin(scanAngle) * config.scanRadius * minimapScale
    );

    blips.forEach(blip => {
      const graphics = this.blipGraphics.get(blip.id);
      if (!graphics) return;

      graphics.clear();

      let color: number;
      switch (blip.type) {
        case 'unit':
          color = blip.faction === 'enemy' ? config.enemyColor :
                  blip.faction === 'allied' ? config.allyColor : 0x888888;
          graphics.fillStyle(color, blip.intensity);
          graphics.fillCircle(blip.x * minimapScale, blip.y * minimapScale, 3);
          break;
        case 'building':
          color = blip.faction === 'enemy' ? config.enemyColor :
                  blip.faction === 'allied' ? config.structureColor : 0x888888;
          graphics.fillStyle(color, blip.intensity);
          graphics.fillRect(
            blip.x * minimapScale - 4,
            blip.y * minimapScale - 4,
            8,
            8
          );
          break;
        case 'resource':
          graphics.fillStyle(config.resourceColor, blip.intensity * 0.8);
          graphics.fillTriangle(
            blip.x * minimapScale,
            (blip.y - 5) * minimapScale,
            (blip.x - 4) * minimapScale,
            (blip.y + 3) * minimapScale,
            (blip.x + 4) * minimapScale,
            (blip.y + 3) * minimapScale
          );
          break;
      }
    });
  }

  showRadarPing(centerX: number, centerY: number, radius: number, duration: number): void {
    if (this.disposed) return;

    const ping = this.scene.add.circle(
      centerX,
      centerY,
      5,
      0x00ff00,
      0.8
    );
    ping.setDepth(1951);

    this.scene.tweens.add({
      targets: ping,
      radius: radius,
      alpha: 0,
      duration: duration,
      ease: 'Power2',
      onComplete: () => { if (!this.scene?.scene?.isActive()) return; ping.destroy(); }
    });
  }

  // --- Alert operations ---

  initAlertDisplay(_x: number, _y: number): void {
    if (this.disposed) return;

    this.alertDisplayContainer = this.scene.add.container(
      this.scene.cameras.main.width - 220,
      20
    );
    this.alertDisplayContainer.setDepth(2000);
    this.alertDisplayContainer.setScrollFactor(0);
  }

  showAlert(data: AlertRenderData): void {
    if (this.disposed || !this.alertDisplayContainer) return;

    const yOffset = this.activeAlertCount * 60;

    const alertGraphics = this.scene.add.graphics();
    alertGraphics.setDepth(2001);

    const bgColor = this.getAlertColor(data.level);
    const borderColor = 0xffffff;

    alertGraphics.fillStyle(bgColor, 0.9);
    alertGraphics.fillRoundedRect(0, 0, 200, 50, 5);
    alertGraphics.lineStyle(2, borderColor, 0.8);
    alertGraphics.strokeRoundedRect(0, 0, 200, 50, 5);

    const iconY = 25;
    alertGraphics.fillStyle(borderColor, 1);

    switch (data.level) {
      case 'critical':
        alertGraphics.fillCircle(25, iconY, 8);
        alertGraphics.fillStyle(bgColor, 1);
        alertGraphics.fillTriangle(25, iconY - 4, 25 - 4, iconY + 4, 25 + 4, iconY + 4);
        break;
      case 'high':
        alertGraphics.fillStyle(bgColor, 1);
        alertGraphics.fillRect(20, iconY - 6, 10, 12);
        alertGraphics.fillTriangle(25, iconY - 10, 20, iconY - 4, 30, iconY - 4);
        break;
      case 'medium':
        alertGraphics.fillStyle(bgColor, 1);
        alertGraphics.fillCircle(25, iconY, 6);
        break;
      case 'low':
        alertGraphics.lineStyle(3, bgColor, 1);
        alertGraphics.lineBetween(20, iconY, 30, iconY);
        break;
    }

    const text = this.scene.add.text(45, 10, data.message, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: 150 }
    });
    text.setDepth(2001);

    const container = this.scene.add.container(0, yOffset);
    container.setDepth(2000);
    container.add([alertGraphics, text]);

    this.alertDisplayContainer.add(container);

    container.setX(220);
    container.setAlpha(0);
    container.setScale(0.8);

    this.activeAlertCount++;

    this.scene.tweens.add({
      targets: container,
      x: 0,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    this.scene.time.delayedCall(data.duration, () => {
      this.scene.tweens.add({
        targets: container,
        x: 220,
        alpha: 0,
        scale: 0.8,
        duration: 200,
        ease: 'Back.easeIn',
        onComplete: () => {
          if (!this.scene?.scene?.isActive()) return;
          container.destroy();
          this.activeAlertCount = Math.max(0, this.activeAlertCount - 1);
        }
      });
    });

    if (data.level === 'critical' || data.level === 'high') {
      this.scene.cameras.main.flash(100, 255, 0, 0, false);
    }
  }

  clearAlerts(): void {
    if (this.alertDisplayContainer) {
      this.alertDisplayContainer.removeAll(true);
    }
    this.activeAlertCount = 0;
  }

  private getAlertColor(level: AlertLevel): number {
    switch (level) {
      case 'critical': return 0xff0000;
      case 'high': return 0xff4400;
      case 'medium': return 0xffaa00;
      case 'low': return 0x44aaff;
      default: return 0x888888;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Radar cleanup
    this.blipGraphics.forEach(g => g.destroy());
    this.blipGraphics.clear();
    this.radarContainer?.destroy();
    this.radarContainer = null;
    this.scanLine = null;

    // Alert cleanup
    this.alertDisplayContainer?.destroy();
    this.alertDisplayContainer = null;
    this.activeAlertCount = 0;
  }
}
