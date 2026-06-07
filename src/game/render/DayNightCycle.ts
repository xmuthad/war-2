import Phaser from 'phaser';

export interface DayNightConfig {
  dayLength: number;
  nightLength: number;
  dawnDuration: number;
  duskDuration: number;
  baseAmbientLight: number;
  baseSunLight: number;
  enableWeather: boolean;
}

export const DEFAULT_DAY_NIGHT_CONFIG: DayNightConfig = {
  dayLength: 120000,
  nightLength: 60000,
  dawnDuration: 10000,
  duskDuration: 10000,
  baseAmbientLight: 0.8,
  baseSunLight: 1.0,
  enableWeather: true
};

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface TimeState {
  currentTime: TimeOfDay;
  dayProgress: number;
  ambientLight: number;
  sunLight: number;
  skyColor: number;
  fogColor: number;
}

export class DayNightCycle {
  private scene: Phaser.Scene;
  private config: DayNightConfig;
  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private currentTime: number = 0;
  private timeOfDay: TimeOfDay = 'day';
  private paused: boolean = false;
  private enabled: boolean = true;

  private onTimeChangeCallbacks: Set<(state: TimeState) => void> = new Set();

  constructor(scene: Phaser.Scene, config: Partial<DayNightConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_DAY_NIGHT_CONFIG, ...config };
  }

  create(): void {
    this.overlay = this.scene.add.rectangle(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      this.scene.cameras.main.width * 2,
      this.scene.cameras.main.height * 2,
      0x000000,
      0
    );
    this.overlay.setDepth(1790);
    this.overlay.setScrollFactor(0);
    this.overlay.setBlendMode(Phaser.BlendModes.DARKEN);
  }

  start(): void {
    this.currentTime = 0;
    this.paused = false;
    this.updateTimeOfDay();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.overlay) {
      this.overlay.setAlpha(0);
    }
  }

  private updateTimeOfDay(): void {
    const totalDayLength = this.config.dayLength + this.config.dawnDuration;
    const totalNightLength = this.config.nightLength + this.config.duskDuration;
    const totalCycleLength = totalDayLength + totalNightLength;

    const previousTimeOfDay = this.timeOfDay;

    const cycleProgress = this.currentTime % totalCycleLength;

    if (cycleProgress < this.config.dawnDuration) {
      this.timeOfDay = 'dawn';
    } else if (cycleProgress < totalDayLength) {
      this.timeOfDay = 'day';
    } else if (cycleProgress < totalDayLength + this.config.duskDuration) {
      this.timeOfDay = 'dusk';
    } else {
      this.timeOfDay = 'night';
    }

    if (previousTimeOfDay !== this.timeOfDay) {
      this.notifyTimeChange();
    }
  }

  private getTimeState(): TimeState {
    const totalDayLength = this.config.dayLength + this.config.dawnDuration;
    const totalNightLength = this.config.nightLength + this.config.duskDuration;
    const totalCycleLength = totalDayLength + totalNightLength;

    const cycleProgress = this.currentTime % totalCycleLength;

    let ambientLight: number;
    let sunLight: number;
    let skyColor: number;
    let fogColor: number;
    let dayProgress: number;

    if (cycleProgress < this.config.dawnDuration) {
      const progress = cycleProgress / this.config.dawnDuration;
      ambientLight = this.config.baseAmbientLight * (0.3 + progress * 0.7);
      sunLight = progress;
      skyColor = 0x1e3a5f;
      fogColor = 0x332244;
      dayProgress = 0;
    } else if (cycleProgress < totalDayLength) {
      ambientLight = this.config.baseAmbientLight;
      sunLight = this.config.baseSunLight;
      skyColor = 0x87ceeb;
      fogColor = 0x88aaff;
      dayProgress = (cycleProgress - this.config.dawnDuration) / this.config.dayLength;
    } else if (cycleProgress < totalDayLength + this.config.duskDuration) {
      const progress = (cycleProgress - totalDayLength) / this.config.duskDuration;
      ambientLight = this.config.baseAmbientLight * (1 - progress * 0.7);
      sunLight = 1 - progress;
      skyColor = 0x4a3a5f;
      fogColor = 0x442233;
      dayProgress = 0.5 + progress * 0.25;
    } else {
      const progress = (cycleProgress - totalDayLength - this.config.duskDuration) / this.config.nightLength;
      ambientLight = this.config.baseAmbientLight * 0.3;
      sunLight = 0;
      skyColor = 0x141428;
      fogColor = 0x111122;
      dayProgress = 0.75 + progress * 0.25;
    }

    return {
      currentTime: this.timeOfDay,
      dayProgress,
      ambientLight,
      sunLight,
      skyColor,
      fogColor
    };
  }

  private applyTimeState(state: TimeState): void {
    if (!this.overlay || !this.enabled) return;

    const darkness = 1 - state.ambientLight;
    this.overlay.setAlpha(darkness * 0.5);

    const r = ((state.skyColor >> 16) & 0xff) / 255;
    const g = ((state.skyColor >> 8) & 0xff) / 255;
    const b = (state.skyColor & 0xff) / 255;

    this.overlay.setFillStyle(
      Phaser.Display.Color.GetColor(r * 255, g * 255, b * 255),
      darkness * 0.3
    );
  }

  onTimeChange(callback: (state: TimeState) => void): () => void {
    this.onTimeChangeCallbacks.add(callback);
    return () => {
      this.onTimeChangeCallbacks.delete(callback);
    };
  }

  private notifyTimeChange(): void {
    const state = this.getTimeState();
    this.applyTimeState(state);
    this.onTimeChangeCallbacks.forEach(cb => cb(state));
  }

  update(delta: number): void {
    if (this.paused || !this.enabled) return;

    this.currentTime += delta;
    this.updateTimeOfDay();

    const state = this.getTimeState();
    this.applyTimeState(state);
  }

  getCurrentTimeOfDay(): TimeOfDay {
    return this.timeOfDay;
  }

  getDayProgress(): number {
    return this.getTimeState().dayProgress;
  }

  isNight(): boolean {
    return this.timeOfDay === 'night';
  }

  isDay(): boolean {
    return this.timeOfDay === 'day';
  }

  dispose(): void {
    this.overlay?.destroy();
    this.onTimeChangeCallbacks.clear();
  }
}
