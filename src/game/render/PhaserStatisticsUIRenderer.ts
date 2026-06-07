import Phaser from 'phaser';
import { StatisticsUIRenderer } from '../systems/StatisticsSystem';

export class PhaserStatisticsUIRenderer implements StatisticsUIRenderer {
  private scene: Phaser.Scene;
  private statsDisplayContainer: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(showDebugInfo: boolean): void {
    this.statsDisplayContainer = this.scene.add.container(0, 0);
    this.statsDisplayContainer.setDepth(1850);
    this.statsDisplayContainer.setScrollFactor(0);
    this.statsDisplayContainer.setVisible(showDebugInfo);
  }

  setShowDebugInfo(show: boolean): void {
    this.statsDisplayContainer?.setVisible(show);
  }

  showDebugInfo(stats: Record<string, number>): void {
    if (!this.statsDisplayContainer) return;
    this.statsDisplayContainer.removeAll(true);

    let yOffset = 0;
    for (const [key, value] of Object.entries(stats)) {
      const text = this.scene.add.text(10, yOffset, `${key}: ${value}`, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 }
      });
      this.statsDisplayContainer.add(text);
      yOffset += 20;
    }

    this.statsDisplayContainer.setVisible(true);
  }

  hideDebugInfo(): void {
    this.statsDisplayContainer?.setVisible(false);
  }

  dispose(): void {
    this.statsDisplayContainer?.destroy();
    this.statsDisplayContainer = null;
  }
}
