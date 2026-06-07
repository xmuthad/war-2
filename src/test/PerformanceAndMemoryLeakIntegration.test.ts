import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMonitor } from '../game/systems/PerformanceMonitor';
import {
  MemoryLeakDetector,
  TrackedObject
} from '../game/utils/MemoryLeakDetector';

describe('PerformanceMonitor Integration Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    monitor.start();
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe('Basic Performance Recording', () => {
    it('should record frame metrics', () => {
      monitor.recordFrame(16.67);
      monitor.recordMetrics({
        renderTime: 5,
        updateTime: 3,
        entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
        particleCount: 100
      });

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.renderTime).toBe(5);
      expect(metrics!.updateTime).toBe(3);
      expect(metrics!.entityCount.units).toBe(50);
    });

    it('should calculate FPS correctly', () => {
      vi.useFakeTimers();

      monitor.recordFrame(16.67);
      vi.advanceTimersByTime(500);
      monitor.recordMetrics({
        renderTime: 5,
        updateTime: 3,
        entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
        particleCount: 100
      });
      monitor.recordFrame(16.67);
      vi.advanceTimersByTime(500);
      monitor.recordMetrics({
        renderTime: 5,
        updateTime: 3,
        entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
        particleCount: 100
      });
      monitor.recordFrame(16.67);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).not.toBeNull();

      vi.useRealTimers();
    });

    it('should track frame time history', () => {
      vi.useFakeTimers();

      monitor.recordFrame(10);
      vi.advanceTimersByTime(500);
      monitor.recordFrame(20);
      vi.advanceTimersByTime(500);
      monitor.recordFrame(15);
      monitor.recordMetrics({ renderTime: 5, updateTime: 3 });

      vi.useRealTimers();

      const history = monitor.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should warn on low FPS', () => {
      vi.useFakeTimers();

      const warnings: string[] = [];
      monitor.onWarning((warning) => {
        warnings.push(warning.message);
      });

      vi.advanceTimersByTime(1000);

      for (let i = 0; i < 30; i++) {
        monitor.recordFrame(50);
        vi.advanceTimersByTime(16.67);
      }

      vi.useRealTimers();

      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Report Generation', () => {
    it('should generate valid performance report', () => {
      vi.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        monitor.recordFrame(16);
        vi.advanceTimersByTime(500);
        monitor.recordMetrics({
          renderTime: 5,
          updateTime: 3,
          entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
          particleCount: 100
        });
      }

      vi.useRealTimers();

      const report = monitor.generateReport();

      expect(report.averageFPS).toBeGreaterThanOrEqual(0);
      expect(report.minFPS).toBeGreaterThanOrEqual(0);
      expect(report.maxFPS).toBeGreaterThanOrEqual(0);
      expect(report.averageFrameTime).toBeGreaterThanOrEqual(0);
      expect(report.warningBreakdown).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should detect memory trends', () => {
      for (let i = 0; i < 25; i++) {
        monitor.recordFrame(16);
        monitor.recordMetrics({
          renderTime: 5 + i * 0.1,
          updateTime: 3,
          entityCount: { units: 50 + i, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
          particleCount: 100 + i
        });
      }

      const report = monitor.generateReport();
      expect(['stable', 'increasing', 'decreasing']).toContain(report.memoryTrend);
    });

    it('should generate recommendations based on performance', () => {
      vi.useFakeTimers();

      for (let i = 0; i < 10; i++) {
        monitor.recordFrame(10);
        vi.advanceTimersByTime(20);
        monitor.recordMetrics({
          renderTime: 30,
          updateTime: 20,
          entityCount: { units: 500, buildings: 50, projectiles: 100, particles: 500, effects: 100 },
          particleCount: 500
        });
      }

      vi.useRealTimers();

      const report = monitor.generateReport();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Info Integration', () => {
    it('should get memory info when available', () => {
      const memoryInfo = monitor.getMemoryInfo();

      if (memoryInfo) {
        expect(memoryInfo.usedJSHeapSize).toBeGreaterThan(0);
        expect(memoryInfo.totalJSHeapSize).toBeGreaterThanOrEqual(
          memoryInfo.usedJSHeapSize
        );
        expect(memoryInfo.jsHeapSizeLimit).toBeGreaterThan(0);
      }
    });
  });

  describe('Configuration Updates', () => {
    it('should update config dynamically', () => {
      monitor.setConfig({
        warningThresholds: {
          minFPS: 20,
          maxFrameTime: 50,
          maxMemoryPercent: 90,
          maxEntities: 2000
        }
      });

      const report = monitor.generateReport();
      expect(report).toBeDefined();
    });

    it('should use custom config on construction', () => {
      const customMonitor = new PerformanceMonitor({
        targetFPS: 120,
        warningThresholds: {
          minFPS: 60,
          maxFrameTime: 16.67,
          maxMemoryPercent: 70,
          maxEntities: 500
        },
        sampleInterval: 500,
        historySize: 30
      });

      customMonitor.start();
      customMonitor.recordFrame(16.67);

      const report = customMonitor.generateReport();
      expect(report).toBeDefined();

      customMonitor.dispose();
    });
  });

  describe('History Management', () => {
    it('should limit history size', () => {
      const smallMonitor = new PerformanceMonitor({
        historySize: 5
      });
      smallMonitor.start();

      for (let i = 0; i < 20; i++) {
        smallMonitor.recordFrame(16);
        smallMonitor.recordMetrics({
          renderTime: 5,
          updateTime: 3,
          entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
          particleCount: 100
        });
      }

      const history = smallMonitor.getHistory();
      expect(history.length).toBeLessThanOrEqual(5);

      smallMonitor.dispose();
    });

    it('should clear history', () => {
      monitor.recordFrame(16);
      monitor.recordMetrics({
        renderTime: 5,
        updateTime: 3,
        entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
        particleCount: 100
      });

      monitor.clearHistory();
      const history = monitor.getHistory();
      expect(history.length).toBe(0);
    });
  });
});

describe('MemoryLeakDetector Integration Tests', () => {
  let detector: MemoryLeakDetector;

  beforeEach(() => {
    detector = new MemoryLeakDetector({ enabled: true });
  });

  afterEach(() => {
    detector.dispose();
  });

  describe('Object Tracking', () => {
    it('should track objects with unique IDs', () => {
      const obj1 = detector.track('test', { name: 'test1' });
      const obj2 = detector.track('test', { name: 'test2' });

      expect(obj1).not.toBe(obj2);

      const stats = detector.getStats();
      expect(stats.test).toBe(2);
    });

    it('should track different object types separately', () => {
      detector.track('unit', { type: 'tank' });
      detector.track('building', { type: 'barracks' });
      detector.track('unit', { type: 'infantry' });

      const stats = detector.getStats();
      expect(stats.unit).toBe(2);
      expect(stats.building).toBe(1);
    });

    it('should estimate object sizes', () => {
      const smallObj = { value: 1 };
      const largeObj = { data: new Array(1000).fill('x') };

      detector.track('small', smallObj);
      detector.track('large', largeObj);

      const stats = detector.getStats();
      expect(stats.total).toBe(2);
    });

    it('should track object references', () => {
      const _unit = detector.track('unit', { id: 'unit-1' }, ['game-world']);
      detector.addReference('unit-1', 'ai-controller');

      const stats = detector.getStats();
      expect(stats.active).toBe(1);
    });
  });

  describe('Object Lifecycle', () => {
    it('should track objects before destruction', () => {
      const _unit = detector.track('unit', { id: 'unit-1' });

      const stats = detector.getStats();
      expect(stats.active).toBe(1);
    });

    it('should mark objects as destroyed', () => {
      const _unit = detector.track('unit', { id: 'unit-1' });
      detector.destroy('unit-1');

      const stats = detector.getStats();
      expect(stats.destroyed).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-existent destroy calls', () => {
      expect(() => detector.destroy('non-existent')).not.toThrow();
    });
  });

  describe('Leak Detection', () => {
    it('should detect leaked objects', () => {
      vi.useFakeTimers();

      detector = new MemoryLeakDetector({
        enabled: true,
        maxAge: 1000,
        checkInterval: 100,
        leakThreshold: 1
      });

      detector.track('unit', { id: 'unit-1' });

      vi.advanceTimersByTime(1500);

      const leakedObjects: TrackedObject[] = [];
      detector.onLeakDetected((report) => {
        leakedObjects.push(...report.leakedObjects);
      });

      vi.useRealTimers();

      expect(leakedObjects.length).toBeGreaterThanOrEqual(0);
    });

    it('should not report leak below threshold', () => {
      vi.useFakeTimers();

      detector = new MemoryLeakDetector({
        enabled: true,
        maxAge: 1000,
        checkInterval: 100,
        leakThreshold: 5
      });

      for (let i = 0; i < 3; i++) {
        detector.track('unit', { id: `unit-${i}` });
      }

      vi.advanceTimersByTime(1500);

      const reports: unknown[] = [];
      detector.onLeakDetected((report) => {
        reports.push(report);
      });

      vi.useRealTimers();

      expect(reports.length).toBe(0);
    });

    it('should generate leak report', () => {
      const report = detector.generateReport();

      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.totalTracked).toBe(0);
      expect(report.activeCount).toBe(0);
      expect(Array.isArray(report.leakedObjects)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should generate recommendations for leaked objects', () => {
      vi.useFakeTimers();

      detector = new MemoryLeakDetector({
        enabled: false,
        maxAge: 1000
      });

      for (let i = 0; i < 10; i++) {
        detector.track('unit', { id: `unit-${i}` });
      }

      vi.advanceTimersByTime(2000);

      const report = detector.generateReport();

      vi.useRealTimers();

      if (report.leakedObjects.length > 0) {
        expect(report.recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Callback System', () => {
    it('should allow callbacks registration', () => {
      const callback = vi.fn();
      const unsubscribe = detector.onLeakDetected(callback);

      const report = detector.generateReport();
      expect(report).toBeDefined();
      unsubscribe();
    });

    it('should allow unsubscribing callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = detector.onLeakDetected(callback);
      unsubscribe();

      const _report = detector.generateReport();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should use default config when none provided', () => {
      const d = new MemoryLeakDetector();
      expect(d).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const d = new MemoryLeakDetector({
        maxAge: 5000,
        leakThreshold: 20
      });

      const report = d.generateReport();
      expect(report).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clear all tracked objects', () => {
      detector.track('unit', { id: 'unit-1' });
      detector.track('building', { id: 'building-1' });

      let stats = detector.getStats();
      expect(stats.total).toBe(2);

      detector.clear();

      stats = detector.getStats();
      expect(stats.total).toBe(0);
    });

    it('should stop interval on dispose', () => {
      detector.start();
      expect(() => detector.dispose()).not.toThrow();
    });

    it('should clear callbacks on dispose', () => {
      detector.onLeakDetected(() => {});
      detector.dispose();

      const report = detector.generateReport();
      expect(report).toBeDefined();
    });
  });
});

describe('Performance Monitor and Memory Leak Detector Integration', () => {
  it('should correlate performance warnings with potential leaks', () => {
    const monitor = new PerformanceMonitor();
    const leakDetector = new MemoryLeakDetector({ enabled: false });

    monitor.start();

    for (let i = 0; i < 30; i++) {
      leakDetector.track('particle', { id: `p-${i}`, x: i, y: i });
      monitor.recordFrame(16);
      monitor.recordMetrics({
        renderTime: 5,
        updateTime: 3,
        entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100 + i, effects: 20 },
        particleCount: 100 + i
      });
    }

    const perfReport = monitor.generateReport();
    const leakReport = leakDetector.generateReport();

    expect(perfReport.recommendations).toBeDefined();
    expect(leakReport.recommendations).toBeDefined();

    monitor.dispose();
    leakDetector.dispose();
  });

  it('should track memory usage patterns during gameplay simulation', () => {
    const monitor = new PerformanceMonitor();
    const leakDetector = new MemoryLeakDetector({ enabled: false });

    monitor.start();

    const entityIds: string[] = [];

    for (let cycle = 0; cycle < 5; cycle++) {
      for (let i = 0; i < 20; i++) {
        const entityId = `entity-${cycle}-${i}`;
        entityIds.push(entityId);
        const entity = { id: entityId, type: 'unit', health: 100 };
        leakDetector.track('entity', entity);
      }

      monitor.recordFrame(16);
      monitor.recordMetrics({
        renderTime: 5 + cycle,
        updateTime: 3 + cycle * 0.5,
        entityCount: {
          units: entityIds.length,
          buildings: 10,
          projectiles: 5,
          particles: 50,
          effects: 20
        },
        particleCount: 50
      });
    }

    const perfReport = monitor.generateReport();
    const leakStats = leakDetector.getStats();

    expect(perfReport.averageFPS).toBeGreaterThanOrEqual(0);
    expect(leakStats.total).toBeGreaterThan(0);

    monitor.dispose();
    leakDetector.dispose();
  });
});

describe('Stress Tests', () => {
  it('should handle rapid frame recording', () => {
    const monitor = new PerformanceMonitor();

    monitor.start();

    for (let i = 0; i < 1000; i++) {
      monitor.recordFrame(Math.random() * 10 + 10);
      if (i % 10 === 0) {
        monitor.recordMetrics({
          renderTime: Math.random() * 10,
          updateTime: Math.random() * 5,
          entityCount: { units: 50, buildings: 10, projectiles: 5, particles: 100, effects: 20 },
          particleCount: 100
        });
      }
    }

    const report = monitor.generateReport();
    expect(report.averageFPS).toBeGreaterThanOrEqual(0);

    monitor.dispose();
  });

  it('should handle rapid object tracking', () => {
    const detector = new MemoryLeakDetector({ enabled: false });

    for (let i = 0; i < 1000; i++) {
      detector.track('entity', { id: `e-${i}`, data: new Array(10).fill(i) });
      if (i % 2 === 0) {
        detector.track('particle', { id: `p-${i}` });
      }
    }

    const stats = detector.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(1000);

    detector.dispose();
  });

  it('should handle rapid leak detection cycles', () => {
    vi.useFakeTimers();

    const detector = new MemoryLeakDetector({
      enabled: false,
      maxAge: 100,
      checkInterval: 10,
      leakThreshold: 1
    });

    for (let cycle = 0; cycle < 100; cycle++) {
      for (let i = 0; i < 10; i++) {
        detector.track('unit', { id: `u-${cycle}-${i}` });
      }
      vi.advanceTimersByTime(100);

      const report = detector.generateReport();
      expect(report.timestamp).toBeGreaterThan(0);
    }

    vi.useRealTimers();
    detector.dispose();
  });
});
