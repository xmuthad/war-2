import React, { useState, useEffect } from 'react';
import { formatTime } from '../../utils/uiHelpers';
import './MissionDebriefing.css';

export type MissionResult = 'victory' | 'defeat' | 'timeout';

interface MissionStats {
  time: number;
  unitsProduced: number;
  unitsLost: number;
  enemiesDestroyed: number;
  buildingsBuilt: number;
  buildingsLost: number;
  resourcesGathered: number;
  rating: number;
}

interface MissionDebriefingProps {
  missionId: string;
  missionName: string;
  result: MissionResult;
  stats: MissionStats;
  rewards?: { credits: number; experience: number };
  onContinue: () => void;
  onRetry: () => void;
}

export const MissionDebriefing: React.FC<MissionDebriefingProps> = ({
  missionName,
  result,
  stats,
  rewards,
  onContinue,
  onRetry
}) => {
  const [animatedStats, setAnimatedStats] = useState<MissionStats>({
    time: 0,
    unitsProduced: 0,
    unitsLost: 0,
    enemiesDestroyed: 0,
    buildingsBuilt: 0,
    buildingsLost: 0,
    resourcesGathered: 0,
    rating: 0
  });
  const [showRewards, setShowRewards] = useState(false);

  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedStats({
        time: Math.floor(stats.time * eased),
        unitsProduced: Math.floor(stats.unitsProduced * eased),
        unitsLost: Math.floor(stats.unitsLost * eased),
        enemiesDestroyed: Math.floor(stats.enemiesDestroyed * eased),
        buildingsBuilt: Math.floor(stats.buildingsBuilt * eased),
        buildingsLost: Math.floor(stats.buildingsLost * eased),
        resourcesGathered: Math.floor(stats.resourcesGathered * eased),
        rating: Math.floor(stats.rating * eased * 10) / 10
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (result === 'victory') {
        setTimeout(() => setShowRewards(true), 300);
      }
    };

    requestAnimationFrame(animate);
  }, [stats, result]);

  const getRatingStars = (rating: number): string => {
    const fullStars = Math.floor(rating);
    const halfStar = rating - fullStars >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    return '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
  };

  const getResultMessage = (): { title: string; subtitle: string } => {
    switch (result) {
      case 'victory':
        return {
          title: '任务胜利!',
          subtitle: '指挥官，你的任务圆满完成'
        };
      case 'defeat':
        return {
          title: '任务失败',
          subtitle: '不要气馁，总结经验再来'
        };
      case 'timeout':
        return {
          title: '时间耗尽',
          subtitle: '任务超时，请加快行动速度'
        };
    }
  };

  const resultInfo = getResultMessage();

  return (
    <div className="mission-debriefing">
      <div className="debriefing-backdrop" />

      <div className="debriefing-content">
        <div className={`result-header ${result}`}>
          <h1 className="result-title">{resultInfo.title}</h1>
          <p className="result-subtitle">{resultInfo.subtitle}</p>
        </div>

        <div className="mission-info">
          <span className="mission-name">{missionName}</span>
        </div>

        {result === 'victory' && (
          <div className="rating-section">
            <div className="rating-label">任务评级</div>
            <div className="rating-stars">{getRatingStars(animatedStats.rating)}</div>
            <div className="rating-value">{animatedStats.rating.toFixed(1)} / 5.0</div>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">{formatTime(animatedStats.time)}</div>
            <div className="stat-label">用时</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💀</div>
            <div className="stat-value">{animatedStats.enemiesDestroyed}</div>
            <div className="stat-label">消灭敌人</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚔️</div>
            <div className="stat-value">{animatedStats.unitsProduced}</div>
            <div className="stat-label">生产单位</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💔</div>
            <div className="stat-value loss">{animatedStats.unitsLost}</div>
            <div className="stat-label">单位损失</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏗️</div>
            <div className="stat-value">{animatedStats.buildingsBuilt}</div>
            <div className="stat-label">建造建筑</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">{animatedStats.resourcesGathered}</div>
            <div className="stat-label">采集资源</div>
          </div>
        </div>

        {showRewards && rewards && (
          <div className="rewards-section">
            <h3>🎁 任务奖励</h3>
            <div className="rewards-grid">
              <div className="reward-item">
                <span className="reward-icon">💰</span>
                <span className="reward-value">+{rewards.credits}</span>
                <span className="reward-label">资金</span>
              </div>
              <div className="reward-item">
                <span className="reward-icon">⭐</span>
                <span className="reward-value">+{rewards.experience}</span>
                <span className="reward-label">经验</span>
              </div>
            </div>
          </div>
        )}

        <div className="action-buttons">
          {result !== 'victory' && (
            <button className="retry-button" onClick={onRetry}>
              🔄 重试任务
            </button>
          )}
          <button className="continue-button" onClick={onContinue}>
            {result === 'victory' ? '继续' : '返回'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionDebriefing;
