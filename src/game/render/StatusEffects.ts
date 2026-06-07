import Phaser from 'phaser';

export type UnitStatusType = 'moving' | 'attacking' | 'harvesting' | 'building' | 'healing' | 'stunned' | 'lowHealth' | 'selected';

export interface StatusIconConfig {
  iconSize: number;
  iconSpacing: number;
  maxIconsPerRow: number;
  yOffset: number;
  animationDuration: number;
  lowHealthThreshold: number;
  colors: Record<UnitStatusType, number>;
}

export const STATUS_ICON_CONFIG: StatusIconConfig = {
  iconSize: 14,
  iconSpacing: 16,
  maxIconsPerRow: 4,
  yOffset: -45,
  animationDuration: 200,
  lowHealthThreshold: 0.3,
  colors: {
    moving: 0x00aaff,
    attacking: 0xff4444,
    harvesting: 0xffaa00,
    building: 0xffcc00,
    healing: 0x00ff00,
    stunned: 0xaa00ff,
    lowHealth: 0xff0000,
    selected: 0x00ff00
  }
};

export interface FloatingTextConfig {
  fontSize: number;
  color: number;
  outlineColor: number;
  outlineWidth: number;
  duration: number;
  floatDistance: number;
  fadeStart: number;
}

export const FLOATING_TEXT_CONFIG: FloatingTextConfig = {
  fontSize: 16,
  color: 0xffffff,
  outlineColor: 0x000000,
  outlineWidth: 2,
  duration: 1500,
  floatDistance: 50,
  fadeStart: 0.7
};

export interface DamageNumberConfig {
  criticalColor: number;
  healColor: number;
  missColor: number;
  fontSizeSmall: number;
  fontSizeLarge: number;
}

export const DAMAGE_NUMBER_CONFIG: DamageNumberConfig = {
  criticalColor: 0xff6600,
  healColor: 0x00ff00,
  missColor: 0x888888,
  fontSizeSmall: 14,
  fontSizeLarge: 20
};

export class UnitStatusIcons {
  private scene: Phaser.Scene;
  private statusIcons: Map<string, Phaser.GameObjects.Container> = new Map();
  private config: StatusIconConfig;

  constructor(scene: Phaser.Scene, config: Partial<StatusIconConfig> = {}) {
    this.scene = scene;
    this.config = { ...STATUS_ICON_CONFIG, ...config };
  }

  showStatus(id: string, x: number, y: number, status: UnitStatusType): void {
    const container = this.statusIcons.get(id) || this.createContainer(id, x, y);
    const existingIcon = container.list.find(c => (c as Phaser.GameObjects.Graphics & { statusType?: UnitStatusType }).statusType === status);
    if (existingIcon) return;

    const icon = this.createIcon(status);
    const iconIndex = container.list.filter(c => c instanceof Phaser.GameObjects.Graphics).length;
    const row = Math.floor(iconIndex / this.config.maxIconsPerRow);
    const col = iconIndex % this.config.maxIconsPerRow;
    icon.setPosition(
      (col - this.config.maxIconsPerRow / 2 + 0.5) * this.config.iconSpacing,
      row * this.config.iconSize
    );
    container.add(icon);
  }

  hideStatus(id: string, status: UnitStatusType): void {
    const container = this.statusIcons.get(id);
    if (!container) return;

    const icon = container.list.find(c => (c as Phaser.GameObjects.Graphics & { statusType?: UnitStatusType }).statusType === status);
    if (icon) {
      this.scene.tweens.add({
        targets: icon,
        alpha: 0,
        scale: 0,
        duration: this.config.animationDuration,
        onComplete: () => {
          container.remove(icon);
          icon.destroy();
        }
      });
    }
  }

  hideAllStatus(id: string): void {
    const container = this.statusIcons.get(id);
    if (container) {
      container.destroy();
      this.statusIcons.delete(id);
    }
  }

  updatePosition(id: string, x: number, y: number): void {
    const container = this.statusIcons.get(id);
    if (container) {
      container.setPosition(x, y + this.config.yOffset);
    }
  }

  private createContainer(id: string, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y + this.config.yOffset);
    container.setDepth(650);
    this.statusIcons.set(id, container);
    return container;
  }

  private createIcon(status: UnitStatusType): Phaser.GameObjects.Graphics {
    const icon = this.scene.add.graphics();
    (icon as Phaser.GameObjects.Graphics & { statusType: UnitStatusType }).statusType = status;
    const size = this.config.iconSize;
    const half = size / 2;

    icon.fillStyle(this.config.colors[status], 0.9);
    icon.fillCircle(0, 0, half);

    icon.lineStyle(1, 0xffffff, 0.6);
    icon.strokeCircle(0, 0, half);

    switch (status) {
      case 'moving':
        icon.fillStyle(0xffffff, 1);
        icon.fillTriangle(-3, 2, 3, 2, 0, -3);
        break;
      case 'attacking':
        icon.fillStyle(0xffffff, 1);
        icon.fillRect(-4, -2, 8, 4);
        icon.fillTriangle(4, 0, 8, -3, 8, 3);
        break;
      case 'harvesting':
        icon.fillStyle(0xffffff, 1);
        icon.fillRect(-3, -4, 6, 8);
        icon.fillCircle(0, 4, 3);
        break;
      case 'building':
        icon.fillStyle(0xffffff, 1);
        icon.fillRect(-4, -2, 8, 8);
        icon.lineStyle(2, 0x000000);
        icon.strokeRect(-4, -2, 8, 8);
        break;
      case 'healing':
        icon.fillStyle(0xffffff, 1);
        icon.fillRect(-2, -5, 4, 10);
        icon.fillRect(-5, -2, 10, 4);
        break;
      case 'stunned':
        icon.fillStyle(0xffffff, 1);
        icon.fillCircle(-2, -2, 2);
        icon.fillCircle(2, -2, 2);
        break;
      case 'lowHealth':
        icon.lineStyle(2, 0xffffff);
        icon.strokeCircle(0, 0, half - 2);
        icon.lineBetween(-3, 3, 3, -3);
        break;
      case 'selected':
        icon.lineStyle(2, 0xffffff, 0.8);
        icon.strokeCircle(0, 0, half - 1);
        break;
    }

    icon.setScale(0);
    this.scene.tweens.add({
      targets: icon,
      scale: 1,
      duration: this.config.animationDuration,
      ease: 'Back.easeOut'
    });

    return icon;
  }

  dispose(): void {
    this.statusIcons.forEach(container => container.destroy());
    this.statusIcons.clear();
  }
}

export class FloatingText {
  private scene: Phaser.Scene;
  private floatingTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private config: FloatingTextConfig;

  constructor(scene: Phaser.Scene, config: Partial<FloatingTextConfig> = {}) {
    this.scene = scene;
    this.config = { ...FLOATING_TEXT_CONFIG, ...config };
  }

  show(
    id: string,
    x: number,
    y: number,
    text: string,
    color?: number
  ): void {
    if (this.floatingTexts.has(id)) {
      this.hide(id);
    }

    const hexColor = color
      ? `#${color.toString(16).padStart(6, '0')}`
      : '#ffffff';

    const textObj = this.scene.add.text(x, y, text, {
      fontSize: `${this.config.fontSize}px`,
      color: hexColor,
      fontFamily: 'Arial Black',
      stroke: `#${this.config.outlineColor.toString(16).padStart(6, '0')}`,
      strokeThickness: this.config.outlineWidth
    });
    textObj.setOrigin(0.5, 0.5);
    textObj.setDepth(900);

    const endY = y - this.config.floatDistance;

    this.scene.tweens.add({
      targets: textObj,
      y: endY,
      alpha: 0,
      duration: this.config.duration,
      ease: 'Power2',
      onComplete: () => {
        textObj.destroy();
        this.floatingTexts.delete(id);
      }
    });

    this.floatingTexts.set(id, textObj);
  }

  hide(id: string): void {
    const text = this.floatingTexts.get(id);
    if (text) {
      this.scene.tweens.killTweensOf(text);
      text.destroy();
      this.floatingTexts.delete(id);
    }
  }

  dispose(): void {
    this.floatingTexts.forEach(text => text.destroy());
    this.floatingTexts.clear();
  }
}

export class DamageNumbers {
  private scene: Phaser.Scene;
  private damageNumberId: number = 0;
  private config: FloatingTextConfig;
  private damageConfig: DamageNumberConfig;

  constructor(
    scene: Phaser.Scene,
    config: Partial<FloatingTextConfig> = {},
    damageConfig: Partial<DamageNumberConfig> = {}
  ) {
    this.scene = scene;
    this.config = { ...FLOATING_TEXT_CONFIG, ...config };
    this.damageConfig = { ...DAMAGE_NUMBER_CONFIG, ...damageConfig };
  }

  showDamage(
    x: number,
    y: number,
    damage: number,
    isCritical: boolean = false,
    isHeal: boolean = false
  ): void {
    const _id = `damage_${this.damageNumberId++}`;
    const color = isHeal
      ? this.damageConfig.healColor
      : isCritical
        ? this.damageConfig.criticalColor
        : 0xffffff;
    const text = isHeal ? `+${damage}` : `-${damage}`;
    const fontSize = isCritical ? this.damageConfig.fontSizeLarge : this.damageConfig.fontSizeSmall;

    const hexColor = `#${color.toString(16).padStart(6, '0')}`;

    const textObj = this.scene.add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      color: hexColor,
      fontFamily: 'Arial Black',
      stroke: '#000000',
      strokeThickness: 2
    });
    textObj.setOrigin(0.5, 0.5);
    textObj.setDepth(901);

    const offsetX = (Math.random() - 0.5) * 30;
    const endY = y - this.config.floatDistance * (isCritical ? 1.5 : 1);
    const endScale = isCritical ? 1 : 0.8;

    this.scene.tweens.add({
      targets: textObj,
      y: endY,
      x: x + offsetX,
      alpha: 0,
      scale: endScale,
      duration: this.config.duration,
      ease: 'Power2',
      onComplete: () => textObj.destroy()
    });
  }

  showMiss(x: number, y: number): void {
    const textObj = this.scene.add.text(x, y, 'MISS', {
      fontSize: `${this.damageConfig.fontSizeSmall}px`,
      color: `#${this.damageConfig.missColor.toString(16).padStart(6, '0')}`,
      fontFamily: 'Arial',
      fontStyle: 'italic'
    });
    textObj.setOrigin(0.5, 0.5);
    textObj.setDepth(901);

    this.scene.tweens.add({
      targets: textObj,
      y: y - 20,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => textObj.destroy()
    });
  }
}

export class HitEffect {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  flash(target: Phaser.GameObjects.GameObject, color: number = 0xff0000): void {
    if (target instanceof Phaser.GameObjects.Sprite) {
      target.setTint(color);
      this.scene.tweens.add({
        targets: target,
        alpha: 0.5,
        duration: 50,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          target.clearTint();
          target.setAlpha(1);
        }
      });
    } else {
      this.scene.tweens.add({
        targets: target,
        alpha: 0.3,
        duration: 50,
        yoyo: true,
        repeat: 1
      });
    }
  }

  screenShake(intensity: number = 5, duration: number = 200): void {
    const camera = this.scene.cameras.main;
    camera.shake(duration, intensity / 1000);
  }

  showHitSparks(x: number, y: number, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      const spark = this.scene.add.circle(x, y, 2, 0xffff00);
      spark.setDepth(850);

      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      const endX = x + Math.cos(angle) * speed * 0.3;
      const endY = y + Math.sin(angle) * speed * 0.3;

      this.scene.tweens.add({
        targets: spark,
        x: endX,
        y: endY,
        alpha: 0,
        scale: 0,
        duration: 200 + Math.random() * 100,
        ease: 'Power2',
        onComplete: () => spark.destroy()
      });
    }
  }

  showBlockEffect(x: number, y: number): void {
    const shield = this.scene.add.graphics();
    shield.setDepth(851);

    shield.lineStyle(3, 0x4488ff, 0.8);
    shield.strokeCircle(x, y, 20);
    shield.lineStyle(1, 0x88ccff, 0.5);
    shield.strokeCircle(x, y, 25);

    this.scene.tweens.add({
      targets: shield,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => shield.destroy()
    });
  }
}