import React, { useState } from 'react';
import { Difficulty } from '../../types';
import { CampaignMission } from '../../game/systems/campaigns';
import { formatTime, getDifficultyColor } from '../../utils/uiHelpers';
import { MapPreview } from './MapPreview';
import './MissionBriefing.css';

interface MissionBriefingProps {
  mission: CampaignMission;
  onStart: (difficulty: Difficulty) => void;
  onBack: () => void;
}

export const MissionBriefing: React.FC<MissionBriefingProps> = ({
  mission,
  onStart,
  onBack
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal' as Difficulty);

  const getDifficultyLabel = (difficulty: Difficulty): string => {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'normal': return '普通';
      case 'hard': return '困难';
      case 'brutal': return '残酷';
      default: return difficulty;
    }
  };

  return (
    <div className="mission-briefing">
      <div className="briefing-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <div className="mission-title">
          <h1>{mission.name}</h1>
          <span className="mission-campaign">{mission.id.split('_')[0].toUpperCase()}</span>
        </div>
      </div>

      <div className="briefing-content">
        <div className="briefing-left">
          <div className="map-preview">
            <MapPreview mapData={mission.map} width={240} height={180} />
          </div>

          <div className="intel-section">
            <h3>📋 情报简报</h3>
            <p className="intel-text">{mission.intel.briefing}</p>
          </div>

          {mission.intel.hints && mission.intel.hints.length > 0 && (
            <div className="hints-section">
              <h3>💡 提示</h3>
              <ul>
                {mission.intel.hints.map((hint, index) => (
                  <li key={index}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="briefing-right">
          <div className="objectives-section">
            <h3>🎯 任务目标</h3>
            <div className="objectives-list">
              {mission.intel.objectives.map((objective, _index) => (
                <div 
                  key={objective.id} 
                  className={`objective-item ${objective.type}`}
                >
                  <span className="objective-icon">
                    {objective.type === 'primary' && '⭐'}
                    {objective.type === 'secondary' && '📌'}
                    {objective.type === 'bonus' && '💎'}
                  </span>
                  <div className="objective-content">
                    <span className="objective-title">{objective.title}</span>
                    <span className="objective-desc">{objective.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="conditions-section">
            <div className="condition-group">
              <h4>✅ 胜利条件</h4>
              <ul>
                {mission.intel.victoryConditions.map((condition, index) => (
                  <li key={index}>{condition}</li>
                ))}
              </ul>
            </div>
            <div className="condition-group">
              <h4>❌ 失败条件</h4>
              <ul>
                {mission.intel.defeatConditions.map((condition, index) => (
                  <li key={index}>{condition}</li>
                ))}
              </ul>
            </div>
          </div>

          {mission.rewards && (
            <div className="rewards-section">
              <h3>🎁 任务奖励</h3>
              <div className="rewards-grid">
                <div className="reward-item">
                  <span className="reward-icon">💰</span>
                  <span className="reward-value">{mission.rewards.credits}</span>
                  <span className="reward-label">资金</span>
                </div>
                <div className="reward-item">
                  <span className="reward-icon">⭐</span>
                  <span className="reward-value">{mission.rewards.experience}</span>
                  <span className="reward-label">经验</span>
                </div>
                {mission.rewards.unlockUnits && mission.rewards.unlockUnits.length > 0 && (
                  <div className="reward-item unlock">
                    <span className="reward-icon">🔓</span>
                    <span className="reward-value">{mission.rewards.unlockUnits.length}</span>
                    <span className="reward-label">解锁单位</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {mission.timeLimit && (
            <div className="time-limit">
              <span className="time-icon">⏱️</span>
              <span>时间限制: {formatTime(mission.timeLimit)}</span>
            </div>
          )}

          {mission.parTime && (
            <div className="par-time">
              <span className="time-icon">🏆</span>
              <span>目标时间: {formatTime(mission.parTime)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="briefing-footer">
        <div className="difficulty-selector">
          <span className="difficulty-label">难度选择:</span>
          {(['easy', 'normal', 'hard', 'brutal'] as Difficulty[]).map(difficulty => (
            <button
              key={difficulty}
              className={`difficulty-button ${selectedDifficulty === difficulty ? 'selected' : ''}`}
              style={{ 
                borderColor: getDifficultyColor(difficulty),
                color: getDifficultyColor(difficulty)
              }}
              onClick={() => setSelectedDifficulty(difficulty)}
            >
              {getDifficultyLabel(difficulty)}
            </button>
          ))}
        </div>

        <button 
          className="start-button"
          onClick={() => onStart(selectedDifficulty)}
        >
          开始任务
        </button>
      </div>
    </div>
  );
};

export default MissionBriefing;
