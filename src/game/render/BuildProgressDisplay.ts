import Phaser from 'phaser';

export interface BuildProgressConfig {
  barWidth: number;
  barHeight: number;
  backgroundColor: number;
  backgroundAlpha: number;
  progressColor: number;
  completeColor: number;
  textColor: string;
  fontSize: number;
  animationDuration: number;
}

export const BUILD_PROGRESS_CONFIG: BuildProgressConfig = {
  barWidth: 80,
  barHeight: 10,
  backgroundColor: 0x333333,
  backgroundAlpha: 0.8,
  progressColor: 0xffaa00,
  completeColor: 0x00ff00,
  textColor: '#ffffff',
  fontSize: 12,
  animationDuration: 300
};

export interface HarvestAnimationConfig {
  beamColor: number;
  beamAlpha: number;
  beamWidth: number;
  resourceGlowColor: number;
  particleCount: number;
  particleColor: number;
  pulseDuration: number;
}

export const HARVEST_CONFIG: HarvestAnimationConfig = {
  beamColor: 0xffaa00,
  beamAlpha: 0.6,
  beamWidth: 3,
  resourceGlowColor: 0xffcc00,
  particleCount: 5,
  particleColor: 0xffdd44,
  pulseDuration: 800
};

export interface ProductionQueueConfig {
  iconSize: number;
  iconSpacing: number;
  maxVisible: number;
  animationDuration: number;
}

export const PRODUCTION_QUEUE_CONFIG: ProductionQueueConfig = {
  iconSize: 24,
  iconSpacing: 28,
  maxVisible: 5,
  animationDuration: 200
};

export class BuildProgressDisplay {
  private scene: Phaser.Scene;
  private progressBars: Map<string, Phaser.GameObjects.Container> = new Map();
  private config: BuildProgressConfig;

  constructor(scene: Phaser.Scene, config: Partial<BuildProgressConfig> = {}) {
    this.scene = scene;
    this.config = { ...BUILD_PROGRESS_CONFIG, ...config };
  }

  showBuildProgress(
    id: string,
    x: number,
    y: number,
    progress: number,
    maxProgress: number,
    label?: string
  ): void {
    this.hideBuildProgress(id);

    const container = this.scene.add.container(x, y);
    const { barWidth, barHeight, backgroundColor, backgroundAlpha, progressColor } = this.config;

    const background = this.scene.add.rectangle(
      0,
      0,
      barWidth,
      barHeight,
      backgroundColor,
      backgroundAlpha
    );
    container.add(background);

    const progressWidth = (progress / maxProgress) * barWidth;
    const progressBar = this.scene.add.rectangle(
      -barWidth / 2,
      0,
      progressWidth,
      barHeight - 2,
      progressColor,
      1
    );
    progressBar.setOrigin(0, 0.5);
    container.add(progressBar);

    const border = this.scene.add.rectangle(0, 0, barWidth, barHeight);
    border.setStrokeStyle(1, 0xffffff, 0.5);
    container.add(border);

    if (label) {
      const text = this.scene.add.text(0, -barHeight - 8, label, {
        fontSize: `${this.config.fontSize}px`,
        color: this.config.textColor,
        fontFamily: 'Arial'
      });
      text.setOrigin(0.5, 0.5);
      container.add(text);
    }

    const percentText = this.scene.add.text(0, 0, `${Math.floor((progress / maxProgress) * 100)}%`, {
      fontSize: `${this.config.fontSize - 2}px`,
      color: '#ffffff',
      fontFamily: 'Arial'
    });
    percentText.setOrigin(0.5, 0.5);
    container.add(percentText);

    container.setDepth(600);
    this.progressBars.set(id, container);
  }

  updateBuildProgress(id: string, progress: number, maxProgress: number): void {
    const container = this.progressBars.get(id);
    if (!container) return;

    const children = container.list;
    const progressBar = children.find(c =>
      c instanceof Phaser.GameObjects.Rectangle && c.fillColor !== this.config.backgroundColor
    ) as Phaser.GameObjects.Rectangle;

    const percentText = children.find(c =>
      c instanceof Phaser.GameObjects.Text
    ) as Phaser.GameObjects.Text;

    if (progressBar) {
      const { barWidth, completeColor } = this.config;
      const newWidth = Math.max(0, Math.min(barWidth, (progress / maxProgress) * barWidth));
      progressBar.setDisplaySize(newWidth, this.config.barHeight - 2);

      if (progress >= maxProgress) {
        progressBar.setFillStyle(completeColor);
      }
    }

    if (percentText) {
      percentText.setText(`${Math.floor((progress / maxProgress) * 100)}%`);
    }
  }

  completeBuild(id: string): void {
    const container = this.progressBars.get(id);
    if (!container) return;

    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 20,
      duration: this.config.animationDuration,
      ease: 'Power2',
      onComplete: () => {
        container.destroy();
        this.progressBars.delete(id);
      }
    });
  }

  hideBuildProgress(id: string): void {
    const container = this.progressBars.get(id);
    if (container) {
      container.destroy();
      this.progressBars.delete(id);
    }
  }

  hideAllProgress(): void {
    this.progressBars.forEach(container => container.destroy());
    this.progressBars.clear();
  }

  dispose(): void {
    this.hideAllProgress();
  }
}

export class HarvestAnimation {
  private scene: Phaser.Scene;
  private harvestEffects: Map<string, Phaser.GameObjects.Container> = new Map();
  private config: HarvestAnimationConfig;

  constructor(scene: Phaser.Scene, config: Partial<HarvestAnimationConfig> = {}) {
    this.scene = scene;
    this.config = { ...HARVEST_CONFIG, ...config };
  }

  startHarvest(
    id: string,
    unitX: number,
    unitY: number,
    resourceX: number,
    resourceY: number
  ): void {
    this.stopHarvest(id);

    const container = this.scene.add.container(0, 0);
    container.setDepth(590);

    const drawBeam = () => {
      const graphics = this.scene.add.graphics();
      graphics.lineStyle(this.config.beamWidth, this.config.beamColor, this.config.beamAlpha);

      const midX = (unitX + resourceX) / 2;
      const midY = (unitY + resourceY) / 2;

      graphics.beginPath();
      graphics.moveTo(unitX, unitY);
      graphics.lineTo(midX + (Math.random() - 0.5) * 10, midY + (Math.random() - 0.5) * 10);
      graphics.lineTo(resourceX, resourceY);
      graphics.strokePath();

      container.add(graphics);
    };

    drawBeam();
    this.scene.time.addEvent({
      delay: 100,
      callback: drawBeam,
      loop: true
    });

    const resourceGlow = this.scene.add.circle(resourceX, resourceY, 25);
    resourceGlow.setFillStyle(this.config.resourceGlowColor, 0.3);
    container.add(resourceGlow);

    this.scene.tweens.add({
      targets: resourceGlow,
      scale: 1.3,
      alpha: 0.6,
      duration: this.config.pulseDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.harvestEffects.set(id, container);
  }

  updateHarvestPosition(
    id: string,
    unitX: number,
    unitY: number,
    resourceX: number,
    resourceY: number
  ): void {
    const container = this.harvestEffects.get(id);
    if (!container) return;

    const graphics = container.list.find(c => c instanceof Phaser.GameObjects.Graphics) as Phaser.GameObjects.Graphics;
    if (graphics) {
      graphics.clear();
      graphics.lineStyle(this.config.beamWidth, this.config.beamColor, this.config.beamAlpha);

      const midX = (unitX + resourceX) / 2;
      const midY = (unitY + resourceY) / 2;

      graphics.beginPath();
      graphics.moveTo(unitX, unitY);
      graphics.lineTo(midX + (Math.random() - 0.5) * 10, midY + (Math.random() - 0.5) * 10);
      graphics.lineTo(resourceX, resourceY);
      graphics.strokePath();
    }
  }

  playResourcePickup(id: string, resourceX: number, resourceY: number): void {
    const container = this.harvestEffects.get(id);
    if (!container) return;

    for (let i = 0; i < this.config.particleCount; i++) {
      const particle = this.scene.add.circle(
        resourceX + (Math.random() - 0.5) * 20,
        resourceY + (Math.random() - 0.5) * 20,
        3,
        this.config.particleColor,
        0.9
      );
      container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        y: particle.y - 30 - Math.random() * 20,
        x: particle.x + (Math.random() - 0.5) * 40,
        alpha: 0,
        scale: 0.5,
        duration: 400,
        delay: i * 30,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  stopHarvest(id: string): void {
    const container = this.harvestEffects.get(id);
    if (container) {
      container.destroy();
      this.harvestEffects.delete(id);
    }
  }

  stopAllHarvest(): void {
    this.harvestEffects.forEach(container => container.destroy());
    this.harvestEffects.clear();
  }

  dispose(): void {
    this.stopAllHarvest();
  }
}

export class ProductionQueueDisplay {
  private scene: Phaser.Scene;
  private queues: Map<string, Phaser.GameObjects.Container> = new Map();
  private config: ProductionQueueConfig;

  constructor(scene: Phaser.Scene, config: Partial<ProductionQueueConfig> = {}) {
    this.scene = scene;
    this.config = { ...PRODUCTION_QUEUE_CONFIG, ...config };
  }

  showQueue(
    id: string,
    x: number,
    y: number,
    items: { type: string; progress: number; total: number }[]
  ): void {
    this.hideQueue(id);

    const container = this.scene.add.container(x, y);
    const { iconSize, maxVisible } = this.config;

    const visibleItems = items.slice(0, maxVisible);
    const totalWidth = visibleItems.length * this.config.iconSpacing;

    visibleItems.forEach((item, index) => {
      const iconX = -totalWidth / 2 + index * this.config.iconSpacing + iconSize / 2;
      const iconY = 0;

      const bg = this.scene.add.rectangle(
        iconX,
        iconY,
        iconSize,
        iconSize,
        0x333333,
        0.8
      );
      bg.setStrokeStyle(1, 0x666666);
      container.add(bg);

      const typeLabel = this.scene.add.text(iconX, iconY - 8, item.type.substring(0, 3), {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial'
      });
      typeLabel.setOrigin(0.5);
      container.add(typeLabel);

      const progressBg = this.scene.add.rectangle(
        iconX,
        iconY + iconSize / 2 + 4,
        iconSize,
        4,
        0x000000,
        0.6
      );
      container.add(progressBg);

      const progressWidth = (item.progress / item.total) * iconSize;
      const progressFill = this.scene.add.rectangle(
        iconX - iconSize / 2,
        iconY + iconSize / 2 + 4,
        progressWidth,
        4,
        0x00ff00,
        1
      );
      progressFill.setOrigin(0, 0.5);
      container.add(progressFill);
    });

    if (items.length > maxVisible) {
      const moreText = this.scene.add.text(
        x + totalWidth / 2 + 15,
        y,
        `+${items.length - maxVisible}`,
        {
          fontSize: '12px',
          color: '#aaaaaa',
          fontFamily: 'Arial'
        }
      );
      moreText.setOrigin(0, 0.5);
      container.add(moreText);
    }

    container.setDepth(610);
    this.queues.set(id, container);
  }

  updateQueue(
    id: string,
    items: { type: string; progress: number; total: number }[]
  ): void {
    this.showQueue(id, this.queues.get(id)?.x || 0, this.queues.get(id)?.y || 0, items);
  }

  hideQueue(id: string): void {
    const queue = this.queues.get(id);
    if (queue) {
      queue.destroy();
      this.queues.delete(id);
    }
  }

  hideAllQueues(): void {
    this.queues.forEach(queue => queue.destroy());
    this.queues.clear();
  }

  dispose(): void {
    this.hideAllQueues();
  }
}