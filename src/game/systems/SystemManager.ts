import Phaser from 'phaser';
import {
  WeatherSystem,
  WEATHER_CONFIGS,
  type WeatherType
} from '../render/WeatherSystem';
import {
  DayNightCycle,
  DEFAULT_DAY_NIGHT_CONFIG,
  type TimeState
} from '../render/DayNightCycle';
import { RadarSystem, AlertSystem, RADAR_CONFIG, type AlertLevel, type AlertEvent } from './RadarAlertSystem';
import { MissionSystem, type MissionConfig } from './MissionSystem';
import { StatisticsSystem, type GameStats, type CombatStats } from './StatisticsSystem';
import { PhaserMissionUIRenderer } from '../render/PhaserMissionUIRenderer';
import { PhaserRadarAlertUIRenderer } from '../render/PhaserRadarAlertUIRenderer';
import { PhaserStatisticsUIRenderer } from '../render/PhaserStatisticsUIRenderer';
import { useGameStore } from '../../store/gameStore';

// Re-export types for consumers that need them
export type { WeatherType } from '../render/WeatherSystem';
export type { TimeState } from '../render/DayNightCycle';
export type { AlertLevel, AlertEvent } from './RadarAlertSystem';
export type { MissionConfig } from './MissionSystem';
export type { GameStats, CombatStats } from './StatisticsSystem';

export class SystemManager {
  private weatherSystem?: WeatherSystem;
  private dayNightCycle?: DayNightCycle;
  private radarSystem?: RadarSystem;
  private alertSystem?: AlertSystem;
  private missionSystem?: MissionSystem;
  private statisticsSystem?: StatisticsSystem;

  private systems: Map<string, unknown> = new Map();

  // Auto weather cycle
  private autoWeatherTimer: number = 0;
  private nextWeatherChangeAt: number = 0;
  private static readonly WEATHER_TYPES: WeatherType[] = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm', 'sandstorm'];
  private static readonly MIN_WEATHER_INTERVAL = 120000; // 2 minutes
  private static readonly MAX_WEATHER_INTERVAL = 300000; // 5 minutes

  public onAlertTriggered?: (alert: AlertEvent) => void;
  public onMissionComplete?: (success: boolean) => void;
  public onTimeOfDayChange?: (state: TimeState) => void;
  public onWeatherChange?: (weatherType: WeatherType | null) => void;

  initialize(scene: Phaser.Scene): void {
    this.weatherSystem = new WeatherSystem(scene);
    this.weatherSystem.create();
    this.weatherSystem.onWeatherEnd = () => {
      this.onWeatherChange?.(null);
      useGameStore.getState().updateWeatherModifiers('clear');
    };
    this.systems.set('weather', this.weatherSystem);

    this.dayNightCycle = new DayNightCycle(scene, DEFAULT_DAY_NIGHT_CONFIG);
    this.dayNightCycle.create();
    this.dayNightCycle.onTimeChange(state => {
      this.onTimeOfDayChange?.(state);
      useGameStore.getState().updateDayNightVisionModifier(state.currentTime);
    });
    this.systems.set('dayNight', this.dayNightCycle);

    this.radarSystem = new RadarSystem(RADAR_CONFIG);
    this.radarSystem.setUIRenderer(new PhaserRadarAlertUIRenderer(scene));
    this.radarSystem.create(1, scene.scale.width - 110, scene.scale.height - 90);
    this.systems.set('radar', this.radarSystem);

    this.alertSystem = new AlertSystem();
    this.alertSystem.setUIRenderer(new PhaserRadarAlertUIRenderer(scene));
    this.alertSystem.create();
    this.alertSystem.onAlert(alert => this.onAlertTriggered?.(alert));
    this.systems.set('alert', this.alertSystem);

    this.missionSystem = new MissionSystem();
    this.missionSystem.setUIRenderer(new PhaserMissionUIRenderer(scene));
    this.missionSystem.create();
    this.missionSystem.onMissionComplete(success => this.onMissionComplete?.(success));
    this.systems.set('mission', this.missionSystem);

    this.statisticsSystem = new StatisticsSystem();
    this.statisticsSystem.setUIRenderer(new PhaserStatisticsUIRenderer(scene));
    this.statisticsSystem.create();
    this.systems.set('statistics', this.statisticsSystem);

    // Initialize auto weather timer
    this.scheduleNextWeatherChange();
  }

  update(time: number, delta: number): void {
    this.weatherSystem?.update(delta);
    this.dayNightCycle?.update(delta);
    this.radarSystem?.update(delta);
    // AlertSystem uses setTimeout-based expiry, no per-frame update needed
    this.missionSystem?.update(delta);
    this.statisticsSystem?.update(delta);
    this.updateAutoWeather(delta);
  }

  private scheduleNextWeatherChange(): void {
    const { MIN_WEATHER_INTERVAL, MAX_WEATHER_INTERVAL } = SystemManager;
    this.nextWeatherChangeAt = MIN_WEATHER_INTERVAL + Math.random() * (MAX_WEATHER_INTERVAL - MIN_WEATHER_INTERVAL);
    this.autoWeatherTimer = 0;
  }

  private updateAutoWeather(delta: number): void {
    this.autoWeatherTimer += delta;
    if (this.autoWeatherTimer >= this.nextWeatherChangeAt) {
      this.triggerRandomWeather();
      this.scheduleNextWeatherChange();
    }
  }

  private triggerRandomWeather(): void {
    // Weighted random: clear weather is more common
    const weights: Record<WeatherType, number> = {
      clear: 30,
      cloudy: 20,
      rain: 15,
      fog: 12,
      snow: 8,
      storm: 8,
      sandstorm: 7,
    };
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    let selected: WeatherType = 'clear';
    for (const [type, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) {
        selected = type as WeatherType;
        break;
      }
    }
    this.startWeather(selected, 0.3 + Math.random() * 0.5, 60000 + Math.random() * 120000);
  }

  getSystem<T>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  getWeatherSystem(): WeatherSystem | undefined {
    return this.weatherSystem;
  }

  getDayNightCycle(): DayNightCycle | undefined {
    return this.dayNightCycle;
  }

  getRadarSystem(): RadarSystem | undefined {
    return this.radarSystem;
  }

  getAlertSystem(): AlertSystem | undefined {
    return this.alertSystem;
  }

  getMissionSystem(): MissionSystem | undefined {
    return this.missionSystem;
  }

  getStatisticsSystem(): StatisticsSystem | undefined {
    return this.statisticsSystem;
  }

  startWeather(type: WeatherType, _intensity: number = 0.5, duration: number = 60000): void {
    this.weatherSystem?.startWeather({
      ...WEATHER_CONFIGS[type],
      duration
    });
    this.onWeatherChange?.(type);
    useGameStore.getState().updateWeatherModifiers(type);
  }

  stopWeather(): void {
    this.weatherSystem?.stopWeather();
    this.onWeatherChange?.(null);
    useGameStore.getState().updateWeatherModifiers('clear');
  }

  triggerAlert(level: AlertLevel, message: string, position?: { x: number; y: number }): string {
    return this.alertSystem?.triggerAlert(level, message, position) || '';
  }

  startMission(config: MissionConfig): void {
    this.missionSystem?.startMission(config);
  }

  updateObjectiveProgress(objectiveId: string, value: number): void {
    this.missionSystem?.updateObjectiveProgress(objectiveId, value);
  }

  incrementObjectiveProgress(objectiveId: string, amount: number = 1): void {
    this.missionSystem?.incrementObjectiveProgress(objectiveId, amount);
  }

  getGameStats(): GameStats | undefined {
    return this.statisticsSystem?.getGameStats();
  }

  getCombatStats(): CombatStats | undefined {
    return this.statisticsSystem?.getCombatStats();
  }

  recordKill(killerId: string, killerType: string, victimId: string, victimType: string, weapon: string, damage: number): void {
    this.statisticsSystem?.recordKill(killerId, killerType, victimId, victimType, weapon, damage);
  }

  recordDamageDealt(damage: number, isCritical: boolean = false): void {
    this.statisticsSystem?.recordDamageDealt(damage, isCritical);
  }

  recordResourcesGathered(resourceType: string, amount: number): void {
    this.statisticsSystem?.recordResourcesGathered(resourceType, amount);
  }

  recordResourcesSpent(resourceType: string, amount: number): void {
    this.statisticsSystem?.recordResourcesSpent(resourceType, amount);
  }

  getCurrentTimeOfDay(): 'dawn' | 'day' | 'dusk' | 'night' {
    return this.dayNightCycle?.getCurrentTimeOfDay() || 'day';
  }

  isNight(): boolean {
    return this.dayNightCycle?.isNight() || false;
  }

  dispose(): void {
    this.weatherSystem?.dispose();
    this.dayNightCycle?.dispose();
    this.radarSystem?.dispose();
    this.alertSystem?.dispose();
    this.missionSystem?.dispose();
    this.statisticsSystem?.dispose();
    this.systems.clear();
  }
}
