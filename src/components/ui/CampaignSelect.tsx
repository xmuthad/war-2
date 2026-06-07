import React, { useState } from 'react';
import { Campaign, CampaignProgress, CampaignMission, CAMPAIGN_CAMPAIGNS, campaignToMission } from '../../game/systems/campaigns';
import { Difficulty } from '../../types';
import { MissionBriefing } from './MissionBriefing';
import { getFactionIcon } from '../../utils/uiHelpers';
import './CampaignSelect.css';

interface CampaignSelectProps {
  onSelectMission: (mission: CampaignMission, difficulty: Difficulty) => void;
  onBack: () => void;
  progress?: Record<string, CampaignProgress>;
}

export const CampaignSelect: React.FC<CampaignSelectProps> = ({
  onSelectMission,
  onBack,
  progress = {}
}) => {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [viewingMission, setViewingMission] = useState<CampaignMission | null>(null);
  const [activeTab, setActiveTab] = useState<'allied' | 'soviet' | 'bonus'>('allied');

  const getCampaignsByTab = (tab: 'allied' | 'soviet' | 'bonus'): Campaign[] => {
    return Object.values(CAMPAIGN_CAMPAIGNS).filter(campaign => {
      if (tab === 'allied') {
        return campaign.id.startsWith('allied');
      } else if (tab === 'soviet') {
        return campaign.id.startsWith('soviet');
      } else {
        return campaign.id.startsWith('bonus');
      }
    });
  };

  const getCampaignProgress = (campaignId: string): CampaignProgress | undefined => {
    return progress[campaignId];
  };

  const isMissionUnlocked = (campaign: Campaign): boolean => {
    if (campaign.id === 'allied1' || campaign.id === 'soviet1') {
      return true;
    }
    const campaignProgress = getCampaignProgress(campaign.id);
    return campaignProgress?.unlocked || false;
  };

  const getCompletionPercent = (campaign: Campaign): number => {
    const campaignProgress = getCampaignProgress(campaign.id);
    if (!campaignProgress) return 0;
    return Math.round((campaignProgress.completedMissions.length / campaign.totalMissions) * 100);
  };

  const getFactionColor = (campaign: Campaign): string => {
    if (campaign.id.startsWith('allied')) {
      return '#4A90D9';
    } else if (campaign.id.startsWith('soviet')) {
      return '#D94A4A';
    } else {
      return '#9B59B6';
    }
  };

  const handleCampaignClick = (campaign: Campaign) => {
    if (!isMissionUnlocked(campaign)) return;
    setSelectedCampaign(campaign);
  };

  const handleMissionClick = (missionId: string, missionIndex: number) => {
    if (!selectedCampaign) return;
    const mission = campaignToMission(selectedCampaign, missionId, missionIndex);
    setViewingMission(mission);
  };

  if (viewingMission && selectedCampaign) {
    return (
      <MissionBriefing
        mission={viewingMission}
        onStart={(difficulty) => {
          onSelectMission(viewingMission, difficulty);
        }}
        onBack={() => setViewingMission(null)}
      />
    );
  }

  return (
    <div className="campaign-select">
      <div className="campaign-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <h1>🎮 战役模式</h1>
      </div>

      <div className="campaign-tabs">
        <button
          className={`tab-button ${activeTab === 'allied' ? 'active' : ''}`}
          onClick={() => setActiveTab('allied')}
        >
          🇺🇸 盟军战役
        </button>
        <button
          className={`tab-button ${activeTab === 'soviet' ? 'active' : ''}`}
          onClick={() => setActiveTab('soviet')}
        >
          ☭ 苏联战役
        </button>
        <button
          className={`tab-button ${activeTab === 'bonus' ? 'active' : ''}`}
          onClick={() => setActiveTab('bonus')}
        >
          ⭐ 特殊任务
        </button>
      </div>

      <div className="campaign-grid">
        {getCampaignsByTab(activeTab).map(campaign => {
          const isUnlocked = isMissionUnlocked(campaign);
          const completion = getCompletionPercent(campaign);
          const factionColor = getFactionColor(campaign);

          return (
            <div
              key={campaign.id}
              className={`campaign-card ${!isUnlocked ? 'locked' : ''}`}
              onClick={() => handleCampaignClick(campaign)}
            >
              <div 
                className="campaign-icon"
                style={{ backgroundColor: isUnlocked ? factionColor : '#555' }}
              >
                {isUnlocked ? campaign.icon : '🔒'}
              </div>

              <div className="campaign-info">
                <h3>{campaign.name}</h3>
                <p className="campaign-description">{campaign.description}</p>
                
                <div className="campaign-meta">
                  <span className="faction-badge">
                    {getFactionIcon(campaign.faction)} {campaign.factionName}
                  </span>
                  <span className="mission-count">
                    {campaign.totalMissions} 个任务
                  </span>
                </div>

                {isUnlocked && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                    <span className="progress-text">{completion}% 完成</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCampaign && (
        <div className="mission-select-panel">
          <div className="mission-panel-header">
            <h2>
              {selectedCampaign.icon} {selectedCampaign.name}
            </h2>
            <button 
              className="close-button"
              onClick={() => setSelectedCampaign(null)}
            >
              ✕
            </button>
          </div>

          <div className="mission-list">
            {selectedCampaign.missions.map((missionId, index) => {
              const campaignProgress = getCampaignProgress(selectedCampaign.id);
              const isCompleted = campaignProgress?.completedMissions.includes(missionId) || false;
              const bestTime = campaignProgress?.bestTimes[missionId];

              return (
                <div
                  key={missionId}
                  className={`mission-item ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleMissionClick(missionId, index)}
                >
                  <div className="mission-number">
                    {isCompleted ? '✓' : index + 1}
                  </div>

                  <div className="mission-details">
                    <h4>任务 {index + 1}</h4>
                    {bestTime && (
                      <span className="best-time">
                        ⏱️ 最佳时间: {Math.floor(bestTime / 60)}:{(bestTime % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>

                  <div className="mission-status">
                    {isCompleted ? (
                      <span className="status-completed">已完成 ✓</span>
                    ) : (
                      <span className="status-available">可玩</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignSelect;
