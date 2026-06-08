import React from 'react';
import { useGameStore } from './store/gameStore';
import { GameState } from './types';
import { Menu } from './components/ui/Menu';
import { GameCanvas } from './components/ui/GameCanvas';
import { CampaignSelect } from './components/ui/CampaignSelect';
import { MissionBriefing } from './components/ui/MissionBriefing';
import { MissionDebriefing } from './components/ui/MissionDebriefing';
import { CAMPAIGN_CAMPAIGNS, campaignToMission } from './game/systems/campaigns';
import { ErrorBoundary } from './components/ErrorBoundary';
import './components/ErrorBoundary.css';

function App() {
  const gameState = useGameStore((state) => state.gameState);
  const loadCampaignProgress = useGameStore((state) => state.loadCampaignProgress);

  React.useEffect(() => {
    loadCampaignProgress();
  }, [loadCampaignProgress]);

  return (
    <ErrorBoundary>
      <div className="app">
        {gameState === GameState.MENU ? (
          <Menu />
        ) : gameState === GameState.CAMPAIGN_SELECT ? (
          <CampaignSelectWrapper />
        ) : gameState === GameState.MISSION_BRIEFING ? (
          <MissionBriefingWrapper />
        ) : gameState === GameState.MISSION_DEBRIEFING ? (
          <MissionDebriefingWrapper />
        ) : (
          <ErrorBoundary fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', background: '#1a1a2e' }}>
              <h2>Game Error</h2>
              <p>The game encountered an error. Please try restarting.</p>
              <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 24px', cursor: 'pointer' }}>Reload Game</button>
            </div>
          }>
            <GameCanvas />
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  );
}

const CampaignSelectWrapper: React.FC = () => {
  const setGameState = useGameStore(s => s.setGameState);
  const campaignProgress = useGameStore(s => s.campaignProgress);
  return (
    <CampaignSelect
      onSelectMission={(mission) => {
        useGameStore.getState().selectCampaign(mission.campaign);
        useGameStore.getState().selectMission(mission);
        setGameState(GameState.MISSION_BRIEFING);
      }}
      onBack={() => setGameState(GameState.MENU)}
      progress={campaignProgress}
    />
  );
};

const MissionBriefingWrapper: React.FC = () => {
  const selectedMission = useGameStore(s => s.selectedMission);
  const setGameState = useGameStore(s => s.setGameState);
  if (!selectedMission) {
    setGameState(GameState.CAMPAIGN_SELECT);
    return null;
  }
  return (
    <MissionBriefing
      mission={selectedMission}
      onStart={(difficulty) => {
        useGameStore.getState().startCampaignMission(selectedMission, difficulty);
      }}
      onBack={() => setGameState(GameState.CAMPAIGN_SELECT)}
    />
  );
};

const MissionDebriefingWrapper: React.FC = () => {
  const missionResult = useGameStore(s => s.missionResult);
  const missionStats = useGameStore(s => s.missionStats);
  const selectedMission = useGameStore(s => s.selectedMission);
  const selectedCampaign = useGameStore(s => s.selectedCampaign);
  const setGameState = useGameStore(s => s.setGameState);
  if (!missionResult || !missionStats || !selectedMission) {
    setGameState(GameState.CAMPAIGN_SELECT);
    return null;
  }
  return (
    <MissionDebriefing
      missionId={selectedMission.id}
      missionName={selectedMission.name}
      result={missionResult}
      stats={missionStats}
      rewards={missionResult === 'victory' ? selectedMission.rewards : undefined}
      onContinue={() => {
        if (missionResult === 'victory' && selectedCampaign) {
          const campaign = CAMPAIGN_CAMPAIGNS[selectedCampaign];
          if (campaign) {
            const currentIndex = campaign.missions.indexOf(selectedMission.id);
            if (currentIndex >= 0 && currentIndex < campaign.missions.length - 1) {
              const nextMissionId = campaign.missions[currentIndex + 1];
              const nextMission = campaignToMission(campaign, nextMissionId, currentIndex + 1);
              useGameStore.getState().selectMission(nextMission);
              setGameState(GameState.MISSION_BRIEFING);
              return;
            }
          }
        }
        setGameState(GameState.CAMPAIGN_SELECT);
      }}
      onRetry={() => {
        const lastDifficulty = useGameStore.getState().lastMissionDifficulty;
        useGameStore.getState().startCampaignMission(selectedMission, lastDifficulty);
      }}
    />
  );
};

export default App;
