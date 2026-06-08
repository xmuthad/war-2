import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { combatSystem, ProjectileType, DamageType } from '../systems/CombatSystem';
import { logicalToRender } from './IsometricUtils';

export type EffectType = 'explosion' | 'muzzleFlash' | 'smoke' | 'spark' | 'bulletTrail' | 'heal' | 'build' | 'tesla' | 'chrono';

export interface EffectConfig {
  explosion: {
    duration: number;
    particleCount: number;
    colors: number[];
    minSpeed: number;
    maxSpeed: number;
    minScale: number;
    maxScale: number;
  };
  muzzleFlash: {
    duration: number;
    colors: number[];
    minSize: number;
    maxSize: number;
  };
  smoke: {
    duration: number;
    particleCount: number;
    color: number;
    minSpeed: number;
    maxSpeed: number;
  };
  spark: {
    duration: number;
    particleCount: number;
    colors: number[];
  };
  bulletTrail: {
    duration: number;
    color: number;
    width: number;
  };
  heal: {
    duration: number;
    particleCount: number;
    color: number;
  };
  build: {
    duration: number;
    particleCount: number;
    color: number;
  };
  tesla: {
    duration: number;
    color: number;
    segments: number;
  };
  chrono: {
    duration: number;
    particleCount: number;
    colors: number[];
  };
}

export const EFFECT_CONFIG: EffectConfig = {
  explosion: {
    duration: 600,
    particleCount: 20,
    colors: [0xff6600, 0xff9900, 0xffcc00, 0xff3300],
    minSpeed: 50,
    maxSpeed: 200,
    minScale: 0.2,
    maxScale: 1.0
  },
  muzzleFlash: {
    duration: 100,
    colors: [0xffff00, 0xffffff, 0xff9900],
    minSize: 5,
    maxSize: 15
  },
  smoke: {
    duration: 1500,
    particleCount: 10,
    color: 0x555555,
    minSpeed: 10,
    maxSpeed: 40
  },
  spark: {
    duration: 300,
    particleCount: 8,
    colors: [0x00ffff, 0xffffff, 0x00aaff]
  },
  bulletTrail: {
    duration: 150,
    color: 0xffff00,
    width: 2
  },
  heal: {
    duration: 1000,
    particleCount: 15,
    color: 0x00ff00
  },
  build: {
    duration: 800,
    particleCount: 12,
    color: 0xffaa00
  },
  tesla: {
    duration: 300,
    color: 0x00aaff,
    segments: 8
  },
  chrono: {
    duration: 800,
    particleCount: 16,
    colors: [0x0088ff, 0x00ccff, 0x44aaff, 0xffffff]
  }
};

const MAX_ACTIVE_EFFECTS = 80;

// Effect priority: higher = less likely to be culled
const EFFECT_PRIORITY: Record<string, number> = {
  explosion: 10,
  buildingRubble: 9,
  smoke: 5,
  muzzleFlash: 3,
  buildEffect: 4,
  healEffect: 3,
  teslaZap: 6,
  chronoShift: 7,
  unitDeath: 8,
};

export class EffectSystem {
  private scene: Phaser.Scene;
  private effects: Map<string, Phaser.GameObjects.GameObject> = new Map();
  private effectCreationTimes: Map<string, number> = new Map();
  private effectTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
  private effectIdCounter: number = 0;
  private projectileGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private removeOldestEffect(): void {
    let bestCandidate: string | null = null;
    let bestScore = Infinity; // lower score = more likely to be removed

    this.effectCreationTimes.forEach((time, id) => {
      // Extract effect type from id (e.g., "explosion_5" -> "explosion")
      const type = id.split('_')[0];
      const priority = EFFECT_PRIORITY[type] || 1;
      // Score = time / priority: older and lower priority = lower score = removed first
      const score = time / priority;
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = id;
      }
    });
    if (bestCandidate !== null) {
      this.stopEffect(bestCandidate);
    }
  }

  private enforceEffectLimit(): void {
    while (this.effects.size >= MAX_ACTIVE_EFFECTS) {
      this.removeOldestEffect();
    }
  }

  playExplosion(x: number, y: number, scale: number = 1): string {
    this.enforceEffectLimit();
    const id = `explosion_${this.effectIdCounter++}`;
    const container = this.scene.add.container(x, y);
    const config = EFFECT_CONFIG.explosion;

    for (let i = 0; i < config.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / config.particleCount + Math.random() * 0.5;
      const speed = Phaser.Math.Between(config.minSpeed, config.maxSpeed) * scale;
      const size = Phaser.Math.FloatBetween(config.minScale, config.maxScale) * scale * 20;
      const color = Phaser.Utils.Array.GetRandom(config.colors);
      const lifetime = config.duration * (0.5 + Math.random() * 0.5);

      const particle = this.scene.add.circle(0, 0, size, color);
      container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        x: Math.cos(angle) * speed * 0.5,
        y: Math.sin(angle) * speed * 0.5,
        alpha: 0,
        scale: 0,
        duration: lifetime,
        ease: 'Power2',
        onComplete: () => {
          if (!this.scene || !this.scene.scene.isActive()) return;
          particle.destroy();
        }
      });
    }

    const flash = this.scene.add.circle(0, 0, 30 * scale, 0xffffff, 0.8);
    container.add(flash);
    this.scene.tweens.add({
      targets: flash,
      scale: 3,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        if (!this.scene || !this.scene.scene.isActive()) return;
        flash.destroy();
      }
    });

    const shockwave = this.scene.add.circle(0, 0, 20 * scale);
    shockwave.setStrokeStyle(3, 0xffcc00, 0.6);
    container.add(shockwave);
    this.scene.tweens.add({
      targets: shockwave,
      scale: 4,
      alpha: 0,
      duration: config.duration,
      ease: 'Power2',
      onComplete: () => {
        if (!this.scene || !this.scene.scene.isActive()) return;
        shockwave.destroy();
      }
    });

    container.setDepth(800);
    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);

    const timer = this.scene.time.delayedCall(config.duration, () => {
      container.destroy();
      this.effects.delete(id);
      this.effectCreationTimes.delete(id);
      this.effectTimers.delete(id);
    });
    this.effectTimers.set(id, timer);

    return id;
  }

  playMuzzleFlash(x: number, y: number, angle: number): string {
    this.enforceEffectLimit();
    const id = `muzzle_${this.effectIdCounter++}`;
    const container = this.scene.add.container(x, y);
    const config = EFFECT_CONFIG.muzzleFlash;

    container.setRotation(angle);

    const flash = this.scene.add.graphics();
    const size = Phaser.Math.FloatBetween(config.minSize, config.maxSize);

    config.colors.forEach((color, i) => {
      flash.fillStyle(color, 1 - i * 0.3);
      flash.fillCircle(0, 0, size - i * 3);
    });

    container.add(flash);
    container.setDepth(801);

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);

    this.scene.tweens.add({
      targets: container,
      scale: 1.5,
      alpha: 0,
      duration: config.duration,
      ease: 'Power2',
      onComplete: () => {
        if (!this.scene || !this.scene.scene.isActive()) return;
        container.destroy();
        this.effects.delete(id);
        this.effectCreationTimes.delete(id);
      }
    });

    return id;
  }

  playBulletTrail(startX: number, startY: number, endX: number, endY: number): string {
    this.enforceEffectLimit();
    const id = `trail_${this.effectIdCounter++}`;
    const config = EFFECT_CONFIG.bulletTrail;

    const trail = this.scene.add.graphics();
    trail.lineStyle(config.width, config.color, 0.8);
    trail.lineBetween(startX, startY, endX, endY);
    trail.setDepth(700);

    this.effects.set(id, trail);
    this.effectCreationTimes.set(id, this.scene.time.now);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: config.duration,
      ease: 'Power2',
      onComplete: () => {
        if (!this.scene || !this.scene.scene.isActive()) return;
        trail.destroy();
        this.effects.delete(id);
        this.effectCreationTimes.delete(id);
      }
    });

    const impact = this.scene.add.circle(endX, endY, 5, config.color, 0.8);
    impact.setDepth(701);
    this.effects.set(`${id}_impact`, impact);
    this.effectCreationTimes.set(`${id}_impact`, this.scene.time.now);
    this.scene.tweens.add({
      targets: impact,
      scale: 2,
      alpha: 0,
      duration: config.duration,
      ease: 'Power2',
      onComplete: () => {
        if (!this.scene || !this.scene.scene.isActive()) return;
        impact.destroy();
        this.effects.delete(`${id}_impact`);
        this.effectCreationTimes.delete(`${id}_impact`);
      }
    });

    return id;
  }

  playTeslaZap(x1: number, y1: number, x2: number, y2: number): string {
    this.enforceEffectLimit();
    const id = `tesla_${this.effectIdCounter++}`;
    const config = EFFECT_CONFIG.tesla;

    const graphics = this.scene.add.graphics();
    graphics.setDepth(802);

    this.effects.set(id, graphics);
    this.effectCreationTimes.set(id, this.scene.time.now);

    const drawZap = () => {
      graphics.clear();
      graphics.lineStyle(3, config.color, 0.9);

      let px = x1;
      let py = y1;
      graphics.beginPath();
      graphics.moveTo(px, py);

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const segments = Math.min(config.segments, Math.floor(dist / 20));

      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const offset = i < segments ? (Math.random() - 0.5) * 30 : 0;
        px = x1 + dx * t + offset * (dy / dist);
        py = y1 + dy * t - offset * (dx / dist);
        graphics.lineTo(px, py);
      }
      graphics.strokePath();

      graphics.lineStyle(1, 0xffffff, 0.5);
      graphics.beginPath();
      graphics.moveTo(x1, y1);
      graphics.lineTo(px, py);
      graphics.strokePath();
    };

    drawZap();

    const startTime = this.scene.time.now;
    const flashInterval = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        drawZap();
        if (this.scene.time.now - startTime >= config.duration) {
          flashInterval.destroy();
          this.effectTimers.delete(id);
          graphics.destroy();
          this.effects.delete(id);
          this.effectCreationTimes.delete(id);
        }
      },
      loop: true
    });
    this.effectTimers.set(id, flashInterval);

    return id;
  }

  playHealEffect(x: number, y: number): string {
    this.enforceEffectLimit();
    const id = `heal_${this.effectIdCounter++}`;
    const config = EFFECT_CONFIG.heal;
    const container = this.scene.add.container(x, y);
    container.setDepth(803);

    for (let i = 0; i < config.particleCount; i++) {
      const particle = this.scene.add.circle(
        Phaser.Math.Between(-30, 30),
        0,
        4,
        config.color,
        0.8
      );
      container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        y: -60 - Math.random() * 40,
        x: particle.x + Phaser.Math.Between(-20, 20),
        alpha: 0,
        duration: config.duration * 0.6,
        delay: i * 50,
        ease: 'Power2',
        onComplete: () => {
          if (!this.scene || !this.scene.scene.isActive()) return;
          particle.destroy();
        }
      });
    }

    const ring = this.scene.add.circle(0, 0, 25);
    ring.setStrokeStyle(3, config.color, 0.6);
    container.add(ring);

    this.scene.tweens.add({
      targets: ring,
        scale: 2,
      alpha: 0,
      duration: config.duration,
      ease: 'Power2'
    });

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);

    const timer1 = this.scene.time.delayedCall(config.duration, () => {
      container.destroy();
      this.effects.delete(id);
      this.effectCreationTimes.delete(id);
      this.effectTimers.delete(id);
    });
    this.effectTimers.set(id, timer1);

    return id;
  }

  playBuildEffect(x: number, y: number): string {
    this.enforceEffectLimit();
    const id = `build_${this.effectIdCounter++}`;
    const config = EFFECT_CONFIG.build;
    const container = this.scene.add.container(x, y);
    container.setDepth(804);

    for (let i = 0; i < config.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / config.particleCount;
      const startDist = 40;
      const particle = this.scene.add.circle(
        Math.cos(angle) * startDist,
        Math.sin(angle) * startDist,
        3,
        config.color,
        0.9
      );
      container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        x: 0,
        y: 0,
        alpha: 0,
        duration: config.duration,
        delay: i * 30,
        ease: 'Power2',
        onComplete: () => {
          if (!this.scene || !this.scene.scene.isActive()) return;
          particle.destroy();
        }
      });
    }

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);

    const timer2 = this.scene.time.delayedCall(config.duration, () => {
      container.destroy();
      this.effects.delete(id);
      this.effectCreationTimes.delete(id);
      this.effectTimers.delete(id);
    });
    this.effectTimers.set(id, timer2);

    return id;
  }

  playChronoShiftEffect(x: number, y: number): string {
    this.enforceEffectLimit();
    const id = `chrono_${this.effectIdCounter++}`;
    const config = EFFECT_CONFIG.chrono;
    const container = this.scene.add.container(x, y);
    container.setDepth(804);

    // Blue expanding ring
    const ring = this.scene.add.circle(0, 0, 5, 0x0088ff, 0.6);
    ring.setStrokeStyle(2, 0x00ccff, 0.8);
    container.add(ring);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 4,
      scaleY: 2,
      alpha: 0,
      duration: config.duration,
      ease: 'Power2',
      onComplete: () => { if (!this.scene?.scene?.isActive()) return; ring.destroy(); }
    });

    // Blue particles spiraling inward
    for (let i = 0; i < config.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / config.particleCount;
      const color = config.colors[i % config.colors.length];
      const startDist = 30 + Math.random() * 20;
      const particle = this.scene.add.circle(
        Math.cos(angle) * startDist,
        Math.sin(angle) * startDist,
        2 + Math.random() * 2,
        color,
        0.9
      );
      container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        x: 0,
        y: 0,
        alpha: 0,
        duration: config.duration,
        delay: i * 40,
        ease: 'Power2',
        onComplete: () => { if (!this.scene?.scene?.isActive()) return; particle.destroy(); }
      });
    }

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);

    const timer3 = this.scene.time.delayedCall(config.duration + config.particleCount * 40, () => {
      container.destroy();
      this.effects.delete(id);
      this.effectCreationTimes.delete(id);
      this.effectTimers.delete(id);
    });
    this.effectTimers.set(id, timer3);

    return id;
  }

  playUnitDeathEffect(x: number, y: number, unitType: string): string {
    this.enforceEffectLimit();
    const id = `death_${this.effectIdCounter++}`;
    const container = this.scene.add.container(x, y);
    container.setDepth(803);

    const isInfantry = ['soldier', 'rocketeer', 'engineer', 'sniper', 'tanya', 'terrorist', 'crazy_ivan', 'chrono', 'desolator', 'conscript', 'flakinfantry', 'seal'].includes(unitType);
    const isNaval = ['destroyer', 'submarine', 'transport_ship'].includes(unitType);
    const isAirborne = ['helicopter', 'blackhawk', 'kirov', 'yak'].includes(unitType);

    if (isInfantry) {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const particle = this.scene.add.circle(
          Math.cos(angle) * 3, Math.sin(angle) * 3,
          2, 0xff3333, 0.8
        );
        container.add(particle);
        this.scene.tweens.add({
          targets: particle,
          x: Math.cos(angle) * 15,
          y: Math.sin(angle) * 15,
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => { if (!this.scene?.scene?.isActive()) return; particle.destroy(); }
        });
      }
    } else if (isNaval) {
      const splash = this.scene.add.circle(0, 0, 10, 0x4488ff, 0.6);
      container.add(splash);
      this.scene.tweens.add({
        targets: splash,
        scaleX: 3, scaleY: 3, alpha: 0,
        duration: 600, ease: 'Power2',
        onComplete: () => { if (!this.scene?.scene?.isActive()) return; splash.destroy(); }
      });
      this.scene.time.delayedCall(200, () => {
        if (!this.scene?.scene?.isActive()) return;
        this.playExplosion(x, y);
      });
    } else if (isAirborne) {
      const explosion = this.scene.add.circle(0, 0, 8, 0xff8800, 0.9);
      container.add(explosion);
      this.scene.tweens.add({
        targets: explosion,
        scaleX: 3, scaleY: 3, alpha: 0,
        duration: 500, ease: 'Power2',
        onComplete: () => { if (!this.scene?.scene?.isActive()) return; explosion.destroy(); }
      });
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 15 + Math.random() * 25;
        const debris = this.scene.add.rectangle(0, 0, 3, 3, 0x888888, 0.8);
        container.add(debris);
        this.scene.tweens.add({
          targets: debris,
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed + 40,
          alpha: 0,
          duration: 800 + Math.random() * 200,
          ease: 'Power2',
          onComplete: () => { if (!this.scene?.scene?.isActive()) return; debris.destroy(); }
        });
      }
    } else {
      const explosion = this.scene.add.circle(0, 0, 8, 0xff8800, 0.9);
      container.add(explosion);
      this.scene.tweens.add({
        targets: explosion,
        scaleX: 3, scaleY: 3, alpha: 0,
        duration: 500, ease: 'Power2',
        onComplete: () => { if (!this.scene?.scene?.isActive()) return; explosion.destroy(); }
      });
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 30;
        const debris = this.scene.add.rectangle(0, 0, 3, 3, 0x666666, 0.8);
        container.add(debris);
        this.scene.tweens.add({
          targets: debris,
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed - 10,
          alpha: 0,
          duration: 600 + Math.random() * 200,
          ease: 'Power2',
          onComplete: () => { if (!this.scene?.scene?.isActive()) return; debris.destroy(); }
        });
      }
    }

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);
    const timer4 = this.scene.time.delayedCall(800, () => {
      container.destroy();
      this.effects.delete(id);
      this.effectCreationTimes.delete(id);
      this.effectTimers.delete(id);
    });
    this.effectTimers.set(id, timer4);
    return id;
  }

  playBuildingRubble(x: number, y: number, size: number): string {
    this.enforceEffectLimit();
    const id = `rubble_${this.effectIdCounter++}`;
    const container = this.scene.add.container(x, y);
    container.setDepth(1);

    const pieceCount = size * 3;
    for (let i = 0; i < pieceCount; i++) {
      const px = (Math.random() - 0.5) * size * GAME_CONFIG.TILE_SIZE * 0.8;
      const py = (Math.random() - 0.5) * size * GAME_CONFIG.TILE_SIZE * 0.4;
      const piece = this.scene.add.rectangle(
        px, py,
        4 + Math.random() * 6, 3 + Math.random() * 4,
        0x555555, 0.6 + Math.random() * 0.3
      );
      container.add(piece);
    }

    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      delay: 25000,
      duration: 5000,
      onComplete: () => {
        if (!this.scene?.scene?.isActive()) return;
        container.destroy();
        this.effects.delete(id);
        this.effectCreationTimes.delete(id);
      }
    });

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);
    return id;
  }

  playVehicleWreckage(x: number, y: number): string {
    this.enforceEffectLimit();
    const id = `wreckage_${this.effectIdCounter++}`;
    const container = this.scene.add.container(x, y);
    container.setDepth(2);

    // Main hull piece (dark gray, larger)
    const hull = this.scene.add.rectangle(0, 0, 12, 8, 0x444444, 0.7);
    container.add(hull);

    // Turret remnant (smaller, slightly lighter)
    const turret = this.scene.add.rectangle(-3, -2, 6, 4, 0x555555, 0.6);
    container.add(turret);

    // Scattered debris pieces
    for (let i = 0; i < 4; i++) {
      const px = (Math.random() - 0.5) * 20;
      const py = (Math.random() - 0.5) * 14;
      const piece = this.scene.add.rectangle(
        px, py,
        2 + Math.random() * 3, 2 + Math.random() * 2,
        0x3a3a3a, 0.5 + Math.random() * 0.2
      );
      container.add(piece);
    }

    // Small smoke wisp on top
    const smoke = this.scene.add.circle(0, -4, 3, 0x666666, 0.3);
    container.add(smoke);
    this.scene.tweens.add({
      targets: smoke,
      y: -12,
      alpha: 0,
      duration: 2000,
      ease: 'Power1',
      onComplete: () => { if (!this.scene?.scene?.isActive()) return; smoke.destroy(); }
    });

    // Fade out wreckage after 20 seconds
    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      delay: 20000,
      duration: 3000,
      onComplete: () => {
        if (!this.scene?.scene?.isActive()) return;
        container.destroy();
        this.effects.delete(id);
        this.effectCreationTimes.delete(id);
      }
    });

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);
    return id;
  }

  playSmoke(x: number, y: number): string {
    this.enforceEffectLimit();
    const id = `smoke_${this.effectIdCounter++}`;
    const config = EFFECT_CONFIG.smoke;
    const container = this.scene.add.container(x, y);
    container.setDepth(600);

    for (let i = 0; i < config.particleCount; i++) {
      const particle = this.scene.add.circle(
        Phaser.Math.Between(-10, 10),
        0,
        Phaser.Math.Between(8, 15),
        config.color,
        0.4
      );
      container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        y: -30 - Math.random() * 20,
        x: particle.x + Phaser.Math.Between(-15, 15),
        scale: 1.5,
        alpha: 0,
        duration: config.duration + Math.random() * 500,
        delay: i * 100,
        ease: 'Power2',
        onComplete: () => {
          if (!this.scene || !this.scene.scene.isActive()) return;
          particle.destroy();
        }
      });
    }

    this.effects.set(id, container);
    this.effectCreationTimes.set(id, this.scene.time.now);

    const timer5 = this.scene.time.delayedCall(config.duration + config.particleCount * 100, () => {
      container.destroy();
      this.effects.delete(id);
      this.effectCreationTimes.delete(id);
      this.effectTimers.delete(id);
    });
    this.effectTimers.set(id, timer5);

    return id;
  }

  updateProjectiles(): void {
    if (!this.projectileGraphics) {
      this.projectileGraphics = this.scene.add.graphics();
    }

    this.projectileGraphics.clear();

    const projectiles = combatSystem.getProjectiles();
    for (const proj of projectiles) {
      if (proj.isFinished) continue;

      const renderPos = logicalToRender(proj.position.x, proj.position.y);
      const targetRenderPos = logicalToRender(proj.target.x, proj.target.y);

      switch (proj.type) {
        case ProjectileType.BULLET:
          this.projectileGraphics.fillStyle(0xFFFF00, 1);
          this.projectileGraphics.fillCircle(renderPos.x, renderPos.y, 2);
          break;
        case ProjectileType.SHELL:
          this.projectileGraphics.fillStyle(0xFFAA00, 1);
          this.projectileGraphics.fillCircle(renderPos.x, renderPos.y, 4);
          this.projectileGraphics.lineStyle(1, 0xFFAA00, 0.5);
          this.projectileGraphics.lineBetween(renderPos.x, renderPos.y, targetRenderPos.x, targetRenderPos.y);
          break;
        case ProjectileType.MISSILE:
          this.projectileGraphics.fillStyle(0xFF4400, 1);
          this.projectileGraphics.fillCircle(renderPos.x, renderPos.y, 3);
          this.projectileGraphics.lineStyle(2, 0x888888, 0.4);
          this.projectileGraphics.lineBetween(renderPos.x, renderPos.y, targetRenderPos.x, targetRenderPos.y);
          break;
        case ProjectileType.BEAM: {
          const beamColor = proj.damageType === DamageType.ENERGY ? 0x00FFFF : 0xFF0000;
          this.projectileGraphics.lineStyle(2, beamColor, 0.8);
          this.projectileGraphics.lineBetween(renderPos.x, renderPos.y, targetRenderPos.x, targetRenderPos.y);
          break;
        }
      }
    }
  }

  stopEffect(id: string): void {
    const timer = this.effectTimers.get(id);
    if (timer) {
      timer.destroy();
      this.effectTimers.delete(id);
    }
    const effect = this.effects.get(id);
    if (effect) {
      effect.destroy();
      this.effects.delete(id);
      this.effectCreationTimes.delete(id);
    }
  }

  stopAllEffects(): void {
    this.effectTimers.forEach(timer => timer.destroy());
    this.effectTimers.clear();
    this.effects.forEach(effect => effect.destroy());
    this.effects.clear();
    this.effectCreationTimes.clear();
  }

  dispose(): void {
    this.stopAllEffects();
    if (this.projectileGraphics) {
      this.projectileGraphics.destroy();
      this.projectileGraphics = null;
    }
  }
}