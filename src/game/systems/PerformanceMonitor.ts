export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: MemoryInfo | null;
  renderTime: number;
  updateTime: number;
  entityCount: EntityCount;
  particleCount: number;
  networkLatency?: number;
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface EntityCount {
  units: number;
  buildings: number;
  projectiles: number;
  particles: number;
  effects: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetrics;
  warnings: PerformanceWarning[];
}

export interface PerformanceWarning {
  type: WarningType;
  message: string;
  value: number;
  threshold: number;
}

export type WarningType = 
  | 'low_fps'
  | 'high_frame_time'
  | 'high_memory'
  | 'high_entity_count'
  | 'memory_leak_suspected';

export interface PerformanceConfig {
  targetFPS: number;
  warningThresholds: {
    minFPS: number;
    maxFrameTime: number;
    maxMemoryPercent: number;
    maxEntities: number;
  };
  sampleInterval: number;
  historySize: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  targetFPS: 60,
  warningThresholds: {
    minFPS: 30,
    maxFrameTime: 33.33,
    maxMemoryPercent: 80,
    maxEntities: 1000
  },
  sampleInterval: 1000,
  historySize: 60
};

export interface PerformanceReport {
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  percentile50: number;
  percentile90: number;
  percentile95: number;
  averageFrameTime: number;
  totalWarnings: number;
  warningBreakdown: Record<WarningType, number>;
  memoryTrend: 'stable' | 'increasing' | 'decreasing';
  performanceTrend: 'stable' | 'improving' | 'degrading';
  recommendations: string[];
}

export interface RenderStats {
  triangles: number;
  drawCalls: number;
  textures: number;
  shaders: number;
  batches: number;
}

export interface GameLoopStats {
  deltaTime: number;
  fixedDeltaTime: number;
  maxDeltaTime: number;
  accumulator: number;
  framesWithDeltaOverMax: number;
  totalFrames: number;
}

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private history: PerformanceSnapshot[] = [];
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateInterval: number = 500;
  private lastFPSUpdate: number = 0;
  private currentFPS: number = 0;
  private warnings: PerformanceWarning[] = [];
  private callbacks: Set<(warning: PerformanceWarning) => void> = new Set();
  private isMonitoring: boolean = false;
  private frameTimeHistory: number[] = [];
  private memoryHistory: number[] = [];
  private lastEntityCount: number = 0;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  }

  public start(): void {
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    this.lastFPSUpdate = performance.now();
    this.frameCount = 0;
  }

  public stop(): void {
    this.isMonitoring = false;
  }

  public recordFrame(deltaTime: number): void {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const frameTime = deltaTime * 1000;

    this.frameCount++;
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.config.historySize) {
      this.frameTimeHistory.shift();
    }

    if (now - this.lastFPSUpdate >= this.fpsUpdateInterval) {
      this.currentFPS = (this.frameCount * 1000) / (now - this.lastFPSUpdate);
      this.frameCount = 0;
      this.lastFPSUpdate = now;
    }

    this.checkPerformance(frameTime);
  }

  public recordMetrics(metrics: Partial<PerformanceMetrics>): void {
    if (!this.isMonitoring) return;

    const fullMetrics: PerformanceMetrics = {
      fps: this.currentFPS,
      frameTime: this.frameTimeHistory[this.frameTimeHistory.length - 1] || 16.67,
      memoryUsage: this.getMemoryInfo(),
      renderTime: metrics.renderTime || 0,
      updateTime: metrics.updateTime || 0,
      entityCount: metrics.entityCount || { units: 0, buildings: 0, projectiles: 0, particles: 0, effects: 0 },
      particleCount: metrics.particleCount || 0,
      networkLatency: metrics.networkLatency
    };

    this.lastEntityCount = this.getEntityCount(fullMetrics.entityCount);

    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      metrics: fullMetrics,
      warnings: [...this.warnings]
    };

    this.history.push(snapshot);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }

    if (fullMetrics.memoryUsage) {
      this.memoryHistory.push(fullMetrics.memoryUsage.usedJSHeapSize);
      if (this.memoryHistory.length > this.config.historySize) {
        this.memoryHistory.shift();
      }
    }

    this.warnings = [];
  }

  private checkPerformance(frameTime: number): void {
    const minFPS = this.config.warningThresholds.minFPS;
    const maxFrameTime = this.config.warningThresholds.maxFrameTime;
    const maxMemory = this.config.warningThresholds.maxMemoryPercent;

    if (this.currentFPS < minFPS && this.currentFPS > 0) {
      this.addWarning('low_fps', 'FPS过低', this.currentFPS, minFPS);
    }

    if (frameTime > maxFrameTime) {
      this.addWarning('high_frame_time', '帧时间过长', frameTime, maxFrameTime);
    }

    const memory = this.getMemoryInfo();
    if (memory) {
      const memoryPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (memoryPercent > maxMemory) {
        this.addWarning('high_memory', '内存使用过高', memoryPercent, maxMemory);
      }
    }

    const entityCount = this.lastEntityCount;
    const maxEntities = this.config.warningThresholds.maxEntities;
    if (entityCount > maxEntities) {
      this.addWarning('high_entity_count', `实体数量过高: ${entityCount}`, entityCount, maxEntities);
    }

    this.checkMemoryLeak();
  }

  private checkMemoryLeak(): void {
    if (this.memoryHistory.length < 10) return;

    const recent = this.memoryHistory.slice(-10);
    const older = this.memoryHistory.slice(-20, -10);

    if (older.length === 0) return;

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const growthRate = (recentAvg - olderAvg) / olderAvg;

    if (growthRate > 0.1) {
      this.addWarning(
        'memory_leak_suspected',
        '可能存在内存泄漏',
        growthRate * 100,
        10
      );
    }
  }

  private addWarning(type: WarningType, message: string, value: number, threshold: number): void {
    const warning: PerformanceWarning = { type, message, value, threshold };
    this.warnings.push(warning);

    this.callbacks.forEach(callback => callback(warning));
  }

  public getMemoryInfo(): MemoryInfo | null {
    const performance = window.performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }

    return null;
  }

  private getEntityCount(entityCount: EntityCount): number {
    return entityCount.units + entityCount.buildings + entityCount.projectiles + entityCount.particles + entityCount.effects;
  }

  public onWarning(callback: (warning: PerformanceWarning) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  public generateReport(): PerformanceReport {
    const fpsValues = this.history.map(s => s.metrics.fps).filter(f => f > 0);
    const frameTimeValues = this.history.map(s => s.metrics.frameTime);

    const sortedFPS = [...fpsValues].sort((a, b) => a - b);
    const percentile50 = this.calculatePercentile(sortedFPS, 50);
    const percentile90 = this.calculatePercentile(sortedFPS, 90);
    const percentile95 = this.calculatePercentile(sortedFPS, 95);

    const allWarnings = this.history.flatMap(s => s.warnings);
    const warningBreakdown: Record<WarningType, number> = {
      low_fps: 0,
      high_frame_time: 0,
      high_memory: 0,
      high_entity_count: 0,
      memory_leak_suspected: 0
    };

    allWarnings.forEach(w => {
      warningBreakdown[w.type]++;
    });

    let memoryTrend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-5);
      const older = this.memoryHistory.slice(-10, -5);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

      if (recentAvg > olderAvg * 1.05) memoryTrend = 'increasing';
      else if (recentAvg < olderAvg * 0.95) memoryTrend = 'decreasing';
    }

    let performanceTrend: 'stable' | 'improving' | 'degrading' = 'stable';
    if (this.frameTimeHistory.length >= 10) {
      const recentFrameTime = this.frameTimeHistory.slice(-5);
      const olderFrameTime = this.frameTimeHistory.slice(-10, -5);
      const recentAvg = recentFrameTime.reduce((a, b) => a + b, 0) / recentFrameTime.length;
      const olderAvg = olderFrameTime.reduce((a, b) => a + b, 0) / olderFrameTime.length;

      if (recentAvg < olderAvg * 0.95) performanceTrend = 'improving';
      else if (recentAvg > olderAvg * 1.05) performanceTrend = 'degrading';
    }

    const recommendations = this.generateRecommendations(
      fpsValues,
      warningBreakdown,
      memoryTrend,
      performanceTrend
    );

    return {
      averageFPS: fpsValues.length > 0 
        ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length 
        : 0,
      minFPS: fpsValues.length > 0 ? Math.min(...fpsValues) : 0,
      maxFPS: fpsValues.length > 0 ? Math.max(...fpsValues) : 0,
      percentile50,
      percentile90,
      percentile95,
      averageFrameTime: frameTimeValues.length > 0
        ? frameTimeValues.reduce((a, b) => a + b, 0) / frameTimeValues.length
        : 0,
      totalWarnings: allWarnings.length,
      warningBreakdown,
      memoryTrend,
      performanceTrend,
      recommendations
    };
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) return sortedValues[lower];
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private generateRecommendations(
    fpsValues: number[],
    warnings: Record<WarningType, number>,
    memoryTrend: 'stable' | 'increasing' | 'decreasing',
    performanceTrend: 'stable' | 'improving' | 'degrading'
  ): string[] {
    const recommendations: string[] = [];

    if (warnings.low_fps > 5) {
      recommendations.push('考虑降低图形质量或减少单位数量');
    }

    if (warnings.high_frame_time > 5) {
      recommendations.push('优化渲染管线或减少后处理效果');
    }

    if (memoryTrend === 'increasing' || warnings.memory_leak_suspected > 0) {
      recommendations.push('检查对象池实现，确保对象被正确回收');
      recommendations.push('考虑增加垃圾回收触发频率');
    }

    if (warnings.high_entity_count > 0) {
      recommendations.push('减少同屏单位数量或实现LOD系统');
    }

    if (performanceTrend === 'degrading') {
      recommendations.push('检测到性能下降趋势，建议检查最近的代码变更');
    }

    const avgFPS = fpsValues.length > 0 
      ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length 
      : 60;

    if (avgFPS > 55 && fpsValues.length > 0) {
      recommendations.push('性能表现优秀，可以适当增加视觉效果');
    }

    return recommendations;
  }

  public getCurrentMetrics(): PerformanceMetrics | null {
    if (this.history.length === 0) return null;
    return this.history[this.history.length - 1].metrics;
  }

  public getHistory(): PerformanceSnapshot[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
    this.frameTimeHistory = [];
    this.memoryHistory = [];
  }

  public setConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public dispose(): void {
    this.stop();
    this.callbacks.clear();
    this.history = [];
    this.frameTimeHistory = [];
    this.memoryHistory = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();
