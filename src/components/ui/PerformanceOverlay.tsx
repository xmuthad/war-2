import React, { useState, useEffect } from 'react';
import { performanceMonitor, PerformanceMetrics, PerformanceReport } from '../../game/systems/PerformanceMonitor';
import './PerformanceOverlay.css';

interface PerformanceOverlayProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showWarnings?: boolean;
  compact?: boolean;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  enabled = false,
  position = 'top-left',
  showWarnings = true,
  compact = false
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    performanceMonitor.start();

    const unsubscribe = performanceMonitor.onWarning((warning) => {
      setWarnings(prev => [...prev.slice(-4), warning.message]);
    });

    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getCurrentMetrics());
      setReport(performanceMonitor.generateReport());
    }, 500);

    return () => {
      unsubscribe();
      clearInterval(interval);
      performanceMonitor.stop();
    };
  }, [enabled]);

  if (!enabled || !metrics) return null;

  const getFPSColor = (fps: number): string => {
    if (fps >= 55) return '#44FF44';
    if (fps >= 30) return '#FFFF44';
    return '#FF4444';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMemoryColor = (percent: number): string => {
    if (percent < 50) return '#44FF44';
    if (percent < 80) return '#FFFF44';
    return '#FF4444';
  };

  const memoryPercent = metrics.memoryUsage
    ? (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100
    : 0;

  return (
    <div className={`performance-overlay ${position} ${compact ? 'compact' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div className="overlay-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="header-title">性能</span>
        <span 
          className="fps-display"
          style={{ color: getFPSColor(metrics.fps) }}
        >
          {metrics.fps.toFixed(0)} FPS
        </span>
        {warnings.length > 0 && (
          <span className="warning-badge">{warnings.length}</span>
        )}
      </div>

      {isExpanded && (
        <div className="overlay-content">
          <div className="metric-row">
            <span className="metric-label">帧时间</span>
            <span className="metric-value">{metrics.frameTime.toFixed(2)} ms</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">内存</span>
            <span 
              className="metric-value"
              style={{ color: getMemoryColor(memoryPercent) }}
            >
              {metrics.memoryUsage ? formatBytes(metrics.memoryUsage.usedJSHeapSize) : 'N/A'}
            </span>
          </div>

          <div className="metric-row">
            <span className="metric-label">单位</span>
            <span className="metric-value">{metrics.entityCount.units}</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">建筑</span>
            <span className="metric-value">{metrics.entityCount.buildings}</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">粒子</span>
            <span className="metric-value">{metrics.particleCount}</span>
          </div>

          {report && (
            <>
              <div className="section-divider" />
              
              <div className="metric-row">
                <span className="metric-label">平均FPS</span>
                <span className="metric-value">{report.averageFPS.toFixed(0)}</span>
              </div>

              <div className="metric-row">
                <span className="metric-label">最低FPS</span>
                <span className="metric-value">{report.minFPS.toFixed(0)}</span>
              </div>

              <div className="metric-row">
                <span className="metric-label">警告数</span>
                <span className={`metric-value ${report.totalWarnings > 0 ? 'warning' : ''}`}>
                  {report.totalWarnings}
                </span>
              </div>

              <div className="metric-row">
                <span className="metric-label">内存趋势</span>
                <span className={`metric-value ${report.memoryTrend}`}>
                  {report.memoryTrend === 'stable' ? '稳定' : 
                   report.memoryTrend === 'increasing' ? '上升' : '下降'}
                </span>
              </div>
            </>
          )}

          {showWarnings && warnings.length > 0 && (
            <>
              <div className="section-divider" />
              <div className="warnings-section">
                <span className="warnings-title">警告</span>
                {warnings.slice(-3).map((warning, index) => (
                  <div key={index} className="warning-item">
                    ⚠️ {warning}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceOverlay;
