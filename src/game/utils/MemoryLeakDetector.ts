export interface TrackedObject {
  id: string;
  type: string;
  createdAt: number;
  destroyed: boolean;
  destroyedAt?: number;
  references: string[];
  size?: number;
}

export interface MemoryLeakReport {
  timestamp: number;
  totalTracked: number;
  activeCount: number;
  leakedObjects: TrackedObject[];
  recommendations: string[];
}

export interface LeakDetectionConfig {
  enabled: boolean;
  trackSize: boolean;
  maxAge: number;
  checkInterval: number;
  leakThreshold: number;
}

export const DEFAULT_LEAK_CONFIG: LeakDetectionConfig = {
  enabled: true,
  trackSize: true,
  maxAge: 60000,
  checkInterval: 5000,
  leakThreshold: 10
};

export class MemoryLeakDetector {
  private objects: Map<string, TrackedObject> = new Map();
  private config: LeakDetectionConfig;
  private checkIntervalId: number | null = null;
  private callbacks: Set<(report: MemoryLeakReport) => void> = new Set();
  private objectCounter: Map<string, number> = new Map();

  constructor(config: Partial<LeakDetectionConfig> = {}) {
    this.config = { ...DEFAULT_LEAK_CONFIG, ...config };
  }

  public start(): void {
    if (this.config.enabled && !this.checkIntervalId) {
      this.checkIntervalId = window.setInterval(() => {
        this.checkForLeaks();
      }, this.config.checkInterval);
    }
  }

  public stop(): void {
    if (this.checkIntervalId) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  public track<T extends object>(
    type: string,
    instance: T,
    references: string[] = []
  ): T {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const tracked: TrackedObject = {
      id,
      type,
      createdAt: Date.now(),
      destroyed: false,
      references: [...references]
    };

    if (this.config.trackSize) {
      tracked.size = this.estimateSize(instance);
    }

    this.objects.set(id, tracked);
    this.incrementCounter(type);

    return instance;
  }

  public destroy(id: string): void {
    this.objects.delete(id);
  }

  public addReference(id: string, reference: string): void {
    const tracked = this.objects.get(id);
    if (tracked) {
      tracked.references.push(reference);
    }
  }

  public removeReference(id: string, reference: string): void {
    const tracked = this.objects.get(id);
    if (tracked) {
      tracked.references = tracked.references.filter(r => r !== reference);
    }
  }

  private checkForLeaks(): void {
    const now = Date.now();
    const leakedObjects: TrackedObject[] = [];

    this.objects.forEach((obj, _id) => {
      if (!obj.destroyed && (now - obj.createdAt) > this.config.maxAge) {
        leakedObjects.push(obj);
      }
    });

    if (leakedObjects.length >= this.config.leakThreshold) {
      const report = this.generateReport(leakedObjects);
      this.notifyCallbacks(report);
    }
  }

  public generateReport(leakedObjects?: TrackedObject[]): MemoryLeakReport {
    const activeObjects = Array.from(this.objects.values()).filter(o => !o.destroyed);
    const objectsToReport = leakedObjects || this.findLeakedObjects();

    const recommendations = this.generateRecommendations(objectsToReport);

    return {
      timestamp: Date.now(),
      totalTracked: this.objects.size,
      activeCount: activeObjects.length,
      leakedObjects: objectsToReport,
      recommendations
    };
  }

  private findLeakedObjects(): TrackedObject[] {
    const now = Date.now();
    const leaked: TrackedObject[] = [];

    this.objects.forEach((obj) => {
      if (!obj.destroyed && (now - obj.createdAt) > this.config.maxAge) {
        leaked.push(obj);
      }
    });

    return leaked;
  }

  private generateRecommendations(leaked: TrackedObject[]): string[] {
    const recommendations: string[] = [];

    if (leaked.length === 0) {
      recommendations.push('未检测到内存泄漏');
      return recommendations;
    }

    const types = new Set(leaked.map(o => o.type));
    if (types.size > 0) {
      recommendations.push(`检测到 ${leaked.length} 个可能泄漏的对象，涉及 ${types.size} 种类型`);
    }

    const byType = new Map<string, number>();
    leaked.forEach(obj => {
      byType.set(obj.type, (byType.get(obj.type) || 0) + 1);
    });

    byType.forEach((count, type) => {
      if (count > 5) {
        recommendations.push(`${type} 类型存在 ${count} 个未释放对象，请检查 dispose 方法`);
      }
    });

    const orphaned = leaked.filter(o => o.references.length === 0);
    if (orphaned.length > 0) {
      recommendations.push('发现孤立对象，建议检查对象引用管理');
    }

    const largeObjects = leaked.filter(o => (o.size || 0) > 10000);
    if (largeObjects.length > 0) {
      recommendations.push('检测到大型对象未释放，可能影响性能');
    }

    return recommendations;
  }

  private estimateSize(obj: object): number {
    const seen = new WeakSet();
    const stack: object[] = [obj];
    let size = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current);

      if (typeof current === 'object') {
        size += 100;

        Object.keys(current).forEach(key => {
          const value = (current as Record<string, unknown>)[key];
          if (value && typeof value === 'object') {
            stack.push(value);
          } else if (typeof value === 'string') {
            size += value.length * 2;
          } else if (typeof value === 'number') {
            size += 8;
          }
        });
      }
    }

    return size;
  }

  private incrementCounter(type: string): void {
    this.objectCounter.set(type, (this.objectCounter.get(type) || 0) + 1);
  }

  public getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.objects.size,
      active: 0,
      destroyed: 0
    };

    this.objects.forEach(obj => {
      if (obj.destroyed) {
        stats.destroyed++;
      } else {
        stats.active++;
      }
    });

    this.objectCounter.forEach((count, type) => {
      stats[type] = count;
    });

    return stats;
  }

  public onLeakDetected(callback: (report: MemoryLeakReport) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(report: MemoryLeakReport): void {
    console.warn('Memory leak detected:', report);
    this.callbacks.forEach(cb => cb(report));
  }

  public clear(): void {
    this.objects.clear();
    this.objectCounter.clear();
  }

  public dispose(): void {
    this.stop();
    this.clear();
    this.callbacks.clear();
  }
}

export const memoryLeakDetector = new MemoryLeakDetector();
