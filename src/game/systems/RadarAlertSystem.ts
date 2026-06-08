export type AlertLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

// --- UI Renderer Interface (decouple game logic from Phaser UI) ---

export interface RadarBlipRenderData {
  id: string;
  x: number;
  y: number;
  type: 'unit' | 'building' | 'resource';
  faction?: 'allied' | 'enemy' | 'neutral';
  intensity: number;
}

export interface RadarRenderState {
  scanAngle: number;
  blips: RadarBlipRenderData[];
  config: RadarConfig;
  minimapScale: number;
  centerX: number;
  centerY: number;
}

export interface AlertRenderData {
  id: string;
  level: AlertLevel;
  message: string;
  duration: number;
}

export interface RadarAlertUIRenderer {
  // Radar operations
  initRadar(minimapScale: number, centerX: number, centerY: number): void;
  addBlipGraphics(blipId: string): void;
  removeBlipGraphics(blipId: string): void;
  setRadarVisible(visible: boolean): void;
  updateRadar(state: RadarRenderState): void;
  showRadarPing(centerX: number, centerY: number, radius: number, duration: number): void;

  // Alert operations
  initAlertDisplay(x: number, y: number): void;
  showAlert(data: AlertRenderData): void;
  clearAlerts(): void;

  dispose(): void;
}

export interface AlertEvent {
  id: string;
  level: AlertLevel;
  message: string;
  position: { x: number; y: number };
  timestamp: number;
  duration: number;
  acknowledged: boolean;
}

export interface RadarConfig {
  scanRadius: number;
  scanSpeed: number;
  pingInterval: number;
  blipLifetime: number;
  enemyColor: number;
  allyColor: number;
  resourceColor: number;
  structureColor: number;
}

export const RADAR_CONFIG: RadarConfig = {
  scanRadius: 500,
  scanSpeed: 2,
  pingInterval: 5000,
  blipLifetime: 3000,
  enemyColor: 0xff0000,
  allyColor: 0x00ff00,
  resourceColor: 0xffaa00,
  structureColor: 0x4488ff
};

export interface RadarBlip {
  id: string;
  x: number;
  y: number;
  type: 'unit' | 'building' | 'resource';
  faction?: 'allied' | 'enemy' | 'neutral';
  lastSeen: number;
  intensity: number;
}

export class RadarSystem {
  private uiRenderer?: RadarAlertUIRenderer;
  private config: RadarConfig;
  private blips: Map<string, RadarBlip> = new Map();
  private scanAngle: number = 0;
  private lastPingTime: number = 0;
  private enabled: boolean = true;
  private elapsedTime: number = 0;
  private minimapScale: number = 1;
  private centerX: number = 0;
  private centerY: number = 0;

  constructor(config: Partial<RadarConfig> = {}) {
    this.config = { ...RADAR_CONFIG, ...config };
  }

  setUIRenderer(renderer?: RadarAlertUIRenderer): void {
    this.uiRenderer = renderer;
  }

  create(minimapScale: number = 1, centerX: number = 0, centerY: number = 0): void {
    this.minimapScale = minimapScale;
    this.centerX = centerX;
    this.centerY = centerY;

    this.uiRenderer?.initRadar(minimapScale, centerX, centerY);
  }

  addBlip(blip: Omit<RadarBlip, 'lastSeen' | 'intensity'>): void {
    const newBlip: RadarBlip = {
      ...blip,
      lastSeen: this.elapsedTime,
      intensity: 1
    };

    this.blips.set(blip.id, newBlip);
    this.uiRenderer?.addBlipGraphics(blip.id);
  }

  removeBlip(id: string): void {
    this.blips.delete(id);
    this.uiRenderer?.removeBlipGraphics(id);
  }

  updateBlipPosition(id: string, x: number, y: number): void {
    const blip = this.blips.get(id);
    if (blip) {
      blip.x = x;
      blip.y = y;
      blip.lastSeen = this.elapsedTime;
      blip.intensity = 1;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.uiRenderer?.setRadarVisible(enabled);
  }

  update(delta: number): void {
    if (!this.enabled) return;

    this.elapsedTime += delta;

    this.scanAngle += this.config.scanSpeed * (delta / 1000);
    if (this.scanAngle >= Math.PI * 2) {
      this.scanAngle -= Math.PI * 2;
    }

    const now = this.elapsedTime;

    const expiredIds: string[] = [];
    this.blips.forEach((blip, id) => {
      const age = now - blip.lastSeen;
      if (age > this.config.blipLifetime) {
        expiredIds.push(id);
      } else {
        blip.intensity = 1 - (age / this.config.blipLifetime);
      }
    });
    expiredIds.forEach(id => this.removeBlip(id));

    this.uiRenderer?.updateRadar({
      scanAngle: this.scanAngle,
      blips: this.getBlipsRenderData(),
      config: this.config,
      minimapScale: this.minimapScale,
      centerX: this.centerX,
      centerY: this.centerY
    });

    if (now - this.lastPingTime > this.config.pingInterval) {
      this.lastPingTime = now;
      this.uiRenderer?.showRadarPing(
        this.centerX,
        this.centerY,
        this.config.scanRadius * this.minimapScale,
        this.config.scanSpeed * 1000
      );
    }
  }

  private getBlipsRenderData(): RadarBlipRenderData[] {
    return Array.from(this.blips.values()).map(blip => ({
      id: blip.id,
      x: blip.x,
      y: blip.y,
      type: blip.type,
      faction: blip.faction,
      intensity: blip.intensity
    }));
  }

  getBlips(): RadarBlip[] {
    return Array.from(this.blips.values());
  }

  getBlipsInRadius(x: number, y: number, radius: number): RadarBlip[] {
    return this.getBlips().filter(blip => {
      const dx = blip.x - x;
      const dy = blip.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  dispose(): void {
    this.blips.clear();
    this.uiRenderer?.dispose();
  }
}

export class AlertSystem {
  private uiRenderer?: RadarAlertUIRenderer;
  private alerts: Map<string, AlertEvent> = new Map();
  private alertIdCounter: number = 0;
  private maxActiveAlerts: number = 5;
  private onAlertCallbacks: Set<(alert: AlertEvent) => void> = new Set();

  constructor() {}

  setUIRenderer(renderer?: RadarAlertUIRenderer): void {
    this.uiRenderer = renderer;
  }

  create(): void {
    this.uiRenderer?.initAlertDisplay(0, 20);
  }

  triggerAlert(
    level: AlertLevel,
    message: string,
    position?: { x: number; y: number },
    duration: number = 3000
  ): string {
    const id = `alert_${this.alertIdCounter++}`;

    const alert: AlertEvent = {
      id,
      level,
      message,
      position: position || { x: 0, y: 0 },
      timestamp: Date.now(),
      duration,
      acknowledged: false
    };

    this.alerts.set(id, alert);

    this.uiRenderer?.showAlert({
      id: alert.id,
      level: alert.level,
      message: alert.message,
      duration: alert.duration
    });

    this.notifyAlert(alert);

    this.cleanupOldAlerts();

    return id;
  }

  private cleanupOldAlerts(): void {
    while (this.alerts.size > this.maxActiveAlerts) {
      const oldestId = this.alerts.keys().next().value;
      if (oldestId) {
        this.alerts.delete(oldestId);
      }
    }
  }

  acknowledgeAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  clearAllAlerts(): void {
    this.alerts.clear();
    this.uiRenderer?.clearAlerts();
  }

  onAlert(callback: (alert: AlertEvent) => void): () => void {
    this.onAlertCallbacks.add(callback);
    return () => {
      this.onAlertCallbacks.delete(callback);
    };
  }

  private notifyAlert(alert: AlertEvent): void {
    this.onAlertCallbacks.forEach(cb => cb(alert));
  }

  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.alerts.values());
  }

  getAlertsByLevel(level: AlertLevel): AlertEvent[] {
    return this.getActiveAlerts().filter(a => a.level === level);
  }

  hasUnacknowledgedAlerts(): boolean {
    return Array.from(this.alerts.values()).some(a => !a.acknowledged);
  }

  dispose(): void {
    this.alerts.clear();
    this.uiRenderer?.dispose();
    this.onAlertCallbacks.clear();
  }
}
