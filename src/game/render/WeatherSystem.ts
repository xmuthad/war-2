import Phaser from 'phaser';

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm' | 'sandstorm';

export interface WeatherConfig {
  type: WeatherType;
  intensity: number;
  duration: number;
  windDirection: number;
  windSpeed: number;
}

export const WEATHER_CONFIGS: Record<WeatherType, Omit<WeatherConfig, 'duration'>> = {
  clear: {
    type: 'clear',
    intensity: 0,
    windDirection: 0,
    windSpeed: 0
  },
  cloudy: {
    type: 'cloudy',
    intensity: 0.3,
    windDirection: 180,
    windSpeed: 3
  },
  rain: {
    type: 'rain',
    intensity: 0.5,
    windDirection: 270,
    windSpeed: 5
  },
  snow: {
    type: 'snow',
    intensity: 0.3,
    windDirection: 315,
    windSpeed: 2
  },
  fog: {
    type: 'fog',
    intensity: 0.6,
    windDirection: 90,
    windSpeed: 1
  },
  storm: {
    type: 'storm',
    intensity: 0.9,
    windDirection: 180,
    windSpeed: 10
  },
  sandstorm: {
    type: 'sandstorm',
    intensity: 0.7,
    windDirection: 45,
    windSpeed: 8
  }
};

export class WeatherSystem {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private weatherOverlay: Phaser.GameObjects.Rectangle | null = null;
  private currentWeather: WeatherConfig | null = null;
  private weatherTimer: number = 0;
  private enabled: boolean = true;

  private weatherParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private snowflakes: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  public onWeatherEnd?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    this.weatherOverlay = this.scene.add.rectangle(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      this.scene.cameras.main.width * 2,
      this.scene.cameras.main.height * 2,
      0x000000,
      0
    );
    this.weatherOverlay.setDepth(1800);
    this.weatherOverlay.setScrollFactor(0);
    this.weatherOverlay.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  startWeather(weather: WeatherConfig): void {
    this.stopWeather();

    this.currentWeather = { ...weather };
    this.weatherTimer = 0;

    this.applyWeatherEffects();
  }

  private applyWeatherEffects(): void {
    if (!this.currentWeather || !this.enabled) return;

    const intensity = this.currentWeather.intensity;

    switch (this.currentWeather.type) {
      case 'cloudy':
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0x888899, intensity * 0.15);
        }
        break;

      case 'rain':
        this.createRainParticles(intensity);
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0x0000aa, intensity * 0.1);
        }
        break;

      case 'snow':
        this.createSnowParticles(intensity);
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0xffffff, intensity * 0.05);
        }
        break;

      case 'fog':
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0x888888, intensity * 0.3);
        }
        break;

      case 'storm':
        this.createRainParticles(intensity * 1.5);
        this.createLightning();
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0x111144, intensity * 0.2);
        }
        break;

      case 'sandstorm':
        this.createSandParticles(intensity);
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0xaa8844, intensity * 0.2);
        }
        break;

      case 'clear':
      default:
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0x000000, 0);
        }
        break;
    }
  }

  private createRainParticles(intensity: number): void {
    const count = Math.min(Math.floor(intensity * 100), 50);
    const windX = (this.currentWeather?.windSpeed || 5) * 2;

    const rainGraphics = this.scene.add.graphics();
    rainGraphics.fillStyle(0x6688ff, 0.6);
    rainGraphics.fillRect(0, 0, 1, 10);
    rainGraphics.generateTexture('rain_drop', 1, 10);
    rainGraphics.destroy();

    const emitter = this.scene.add.particles(
      this.scene.cameras.main.width / 2, -20, 'rain_drop', {
        quantity: count,
        speedY: { min: 500, max: 800 },
        speedX: { min: windX - 20, max: windX + 20 },
        lifespan: { min: 600, max: 1200 },
        alpha: { start: 0.6, end: 0 },
        scale: { start: 1, end: 1.5 },
        emitZone: {
          source: new Phaser.Geom.Rectangle(-this.scene.cameras.main.width / 2, 0, this.scene.cameras.main.width, 20),
          type: 'random',
        },
        frequency: 30,
      }
    );
    emitter.setDepth(1799);
    this.weatherParticles.push(emitter);
  }

  private createSnowParticles(intensity: number): void {
    const count = Math.min(Math.floor(intensity * 50), 30);
    const windX = (this.currentWeather?.windSpeed || 2) * 5;

    const snowGraphics = this.scene.add.graphics();
    snowGraphics.fillStyle(0xffffff, 0.8);
    snowGraphics.fillCircle(3, 3, 3);
    snowGraphics.generateTexture('snow_flake', 6, 6);
    snowGraphics.destroy();

    const emitter = this.scene.add.particles(
      this.scene.cameras.main.width / 2, -10, 'snow_flake', {
        quantity: count,
        speedY: { min: 30, max: 80 },
        speedX: { min: windX - 15, max: windX + 15 },
        lifespan: { min: 4000, max: 8000 },
        alpha: { start: 0.8, end: 0.2 },
        scale: { start: 0.5, end: 1.2 },
        rotate: { start: 0, end: 360 },
        emitZone: {
          source: new Phaser.Geom.Rectangle(-this.scene.cameras.main.width / 2, 0, this.scene.cameras.main.width, 10),
          type: 'random',
        },
        frequency: 80,
      }
    );
    emitter.setDepth(1799);
    this.snowflakes.push(emitter);
  }

  private createSandParticles(intensity: number): void {
    const count = Math.min(Math.floor(intensity * 80), 40);
    const windX = (this.currentWeather?.windSpeed || 8) * 10;

    const sandGraphics = this.scene.add.graphics();
    sandGraphics.fillStyle(0xddaa66, 0.6);
    sandGraphics.fillRect(0, 0, 3, 3);
    sandGraphics.generateTexture('sand_grain', 3, 3);
    sandGraphics.destroy();

    const emitter = this.scene.add.particles(
      -20, this.scene.cameras.main.height / 2, 'sand_grain', {
        quantity: count,
        speedX: { min: windX * 0.5, max: windX },
        speedY: { min: -50, max: 50 },
        lifespan: { min: 2000, max: 4000 },
        alpha: { start: 0.6, end: 0 },
        scale: { start: 0.8, end: 1.5 },
        emitZone: {
          source: new Phaser.Geom.Rectangle(0, -this.scene.cameras.main.height / 2, 10, this.scene.cameras.main.height),
          type: 'random',
        },
        frequency: 40,
      }
    );
    emitter.setDepth(1799);
    this.weatherParticles.push(emitter);
  }

  private createLightning(): void {
    if (!this.currentWeather || this.currentWeather.type !== 'storm') return;

    this.scene.time.delayedCall(Phaser.Math.Between(2000, 5000), () => {
      if (!this.currentWeather || this.currentWeather.type !== 'storm' || !this.enabled) return;
      if (!this.scene || !this.scene.scene.isActive()) return;

      if (this.weatherOverlay) {
        this.weatherOverlay.setFillStyle(0xffffff, 0.5);

        this.scene.time.delayedCall(100, () => {
          if (this.weatherOverlay && this.currentWeather) {
            this.weatherOverlay.setFillStyle(0x111144, this.currentWeather.intensity * 0.2);
          }
        });
      }

      this.scene.cameras.main.shake(200, 0.005);

      this.createLightning();
    });
  }

  stopWeather(): void {
    this.weatherParticles.forEach(particle => {
      this.scene.tweens.killTweensOf(particle);
      particle.destroy();
    });
    this.weatherParticles = [];

    this.snowflakes.forEach(flake => {
      this.scene.tweens.killTweensOf(flake);
      flake.destroy();
    });
    this.snowflakes = [];

    this.currentWeather = null;
    this.weatherTimer = 0;

    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0x000000, 0);
    }
  }

  setWeatherIntensity(intensity: number): void {
    if (this.currentWeather) {
      this.currentWeather.intensity = Math.max(0, Math.min(1, intensity));
      this.applyWeatherEffects();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopWeather();
    }
  }

  getCurrentWeather(): WeatherConfig | null {
    return this.currentWeather ? { ...this.currentWeather } : null;
  }

  update(delta: number): void {
    if (!this.enabled || !this.currentWeather) return;

    this.weatherTimer += delta;

    if (this.weatherTimer >= this.currentWeather.duration) {
      this.stopWeather();
      this.onWeatherEnd?.();
    }
  }

  dispose(): void {
    this.stopWeather();
    this.weatherOverlay?.destroy();
    this.particles?.destroy();
  }
}
