import React, { useState, useCallback } from 'react';
import {
  Faction,
  Difficulty,
  PlayerSlot,
  PLAYER_COLORS,
  FACTION_INFO,
  GameMapData,
} from '../../types';
import { mapPresets } from '../../game/map/MapPresets';
import { generateId } from '../../utils/uiHelpers';
import './PlayerSetup.css';

const MAX_AI_PLAYERS = 7;
const ALL_FACTIONS = Object.values(Faction).filter(f => f !== Faction.NEUTRAL);
const ALL_DIFFICULTIES: Difficulty[] = [Difficulty.EASY, Difficulty.NORMAL, Difficulty.HARD, Difficulty.BRUTAL];

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  [Difficulty.EASY]: '简单',
  [Difficulty.NORMAL]: '普通',
  [Difficulty.HARD]: '困难',
  [Difficulty.BRUTAL]: '残忍',
};

export const PlayerSetup: React.FC<{
  onStart: (playerSlot: PlayerSlot, aiSlots: PlayerSlot[], map: GameMapData) => void;
  onBack: () => void;
}> = ({ onStart, onBack }) => {
  const [playerFaction, setPlayerFaction] = useState<Faction>(Faction.USA);
  const [playerName, setPlayerName] = useState('指挥官');
  const [playerTeamId, setPlayerTeamId] = useState(1);
  const [aiSlots, setAiSlots] = useState<PlayerSlot[]>([
    {
      id: generateId(),
      faction: Faction.SOVIET,
      difficulty: Difficulty.NORMAL,
      isAI: true,
      name: 'AI-1',
      teamId: 2,
      color: PLAYER_COLORS[1],
    },
  ]);
  const [selectedMapId, setSelectedMapId] = useState(mapPresets[0]?.id || 'standard');

  const addAISlot = useCallback(() => {
    if (aiSlots.length >= MAX_AI_PLAYERS) return;
    const usedFactions = new Set([playerFaction, ...aiSlots.map(s => s.faction)]);
    const availableFaction = ALL_FACTIONS.find(f => !usedFactions.has(f)) || ALL_FACTIONS[Math.floor(Math.random() * ALL_FACTIONS.length)];
    const colorIndex = aiSlots.length + 1;

    setAiSlots(prev => [
      ...prev,
      {
        id: generateId(),
        faction: availableFaction,
        difficulty: Difficulty.NORMAL,
        isAI: true,
        name: `AI-${prev.length + 1}`,
        teamId: 2,
        color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
      },
    ]);
  }, [aiSlots, playerFaction]);

  const removeAISlot = useCallback((slotId: string) => {
    setAiSlots(prev => prev.filter(s => s.id !== slotId));
  }, []);

  const updateAISlot = useCallback((slotId: string, updates: Partial<PlayerSlot>) => {
    setAiSlots(prev =>
      prev.map(s => (s.id === slotId ? { ...s, ...updates } : s))
    );
  }, []);

  const handleStart = useCallback(() => {
    const map = mapPresets.find(p => p.id === selectedMapId)?.createMap(
      mapPresets.find(p => p.id === selectedMapId)?.width || 48,
      mapPresets.find(p => p.id === selectedMapId)?.height || 48
    );
    if (!map) return;

    const playerSlot: PlayerSlot = {
      id: 'player',
      faction: playerFaction,
      difficulty: Difficulty.NORMAL,
      isAI: false,
      name: playerName,
      teamId: playerTeamId,
      color: PLAYER_COLORS[0],
    };

    onStart(playerSlot, aiSlots, map);
  }, [playerFaction, playerName, playerTeamId, aiSlots, selectedMapId, onStart]);

  const selectedMap = mapPresets.find(p => p.id === selectedMapId);

  return (
    <div className="player-setup">
      <div className="player-setup-header">
        <h2>多人对战设置</h2>
        <p className="player-setup-subtitle">配置你的阵营和AI对手</p>
      </div>

      <div className="player-setup-content">
        <div className="player-setup-section">
          <h3>你的设置</h3>
          <div className="player-config-card player-self">
            <div className="player-config-row">
              <label>名称</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={12}
              />
            </div>
            <div className="player-config-row">
              <label>阵营</label>
              <select value={playerFaction} onChange={e => setPlayerFaction(e.target.value as Faction)}>
                {ALL_FACTIONS.map(f => (
                  <option key={f} value={f}>{FACTION_INFO[f].name}</option>
                ))}
              </select>
            </div>
            <div className="player-config-row">
              <label>队伍</label>
              <select value={playerTeamId} onChange={e => setPlayerTeamId(Number(e.target.value))}>
                <option value={1}>队伍 1</option>
                <option value={2}>队伍 2</option>
                <option value={3}>队伍 3</option>
              </select>
            </div>
            <div className="player-color-indicator" style={{ backgroundColor: PLAYER_COLORS[0] }} />
          </div>
        </div>

        <div className="player-setup-section">
          <div className="ai-header">
            <h3>AI 对手 ({aiSlots.length}/{MAX_AI_PLAYERS})</h3>
            <button
              className="btn-add-ai"
              onClick={addAISlot}
              disabled={aiSlots.length >= MAX_AI_PLAYERS}
            >
              + 添加AI
            </button>
          </div>

          {aiSlots.map((slot, index) => (
            <div key={slot.id} className="player-config-card ai-card">
              <div className="ai-card-header">
                <span className="ai-index" style={{ color: slot.color }}>AI-{index + 1}</span>
                <button className="btn-remove-ai" onClick={() => removeAISlot(slot.id)}>✕</button>
              </div>
              <div className="player-config-row">
                <label>阵营</label>
                <select
                  value={slot.faction}
                  onChange={e => updateAISlot(slot.id, { faction: e.target.value as Faction })}
                >
                  {ALL_FACTIONS.map(f => (
                    <option key={f} value={f}>{FACTION_INFO[f].name}</option>
                  ))}
                </select>
              </div>
              <div className="player-config-row">
                <label>难度</label>
                <select
                  value={slot.difficulty}
                  onChange={e => updateAISlot(slot.id, { difficulty: e.target.value as Difficulty })}
                >
                  {ALL_DIFFICULTIES.map(d => (
                    <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                  ))}
                </select>
              </div>
              <div className="player-config-row">
                <label>队伍</label>
                <select
                  value={slot.teamId}
                  onChange={e => updateAISlot(slot.id, { teamId: Number(e.target.value) })}
                >
                  <option value={1}>队伍 1</option>
                  <option value={2}>队伍 2</option>
                  <option value={3}>队伍 3</option>
                </select>
              </div>
              <div className="player-color-indicator" style={{ backgroundColor: slot.color }} />
            </div>
          ))}

          {aiSlots.length === 0 && (
            <div className="no-ai-message">点击"添加AI"按钮添加AI对手</div>
          )}
        </div>

        <div className="player-setup-section">
          <h3>地图选择</h3>
          <div className="map-selector">
            {mapPresets.map(preset => (
              <div
                key={preset.id}
                className={`map-option ${selectedMapId === preset.id ? 'selected' : ''}`}
                onClick={() => setSelectedMapId(preset.id)}
              >
                <div className="map-option-name">{preset.name}</div>
                <div className="map-option-size">{preset.width}×{preset.height}</div>
              </div>
            ))}
          </div>
          {selectedMap && (
            <div className="map-info">
              <p>{selectedMap.description}</p>
              <p className="map-spawns">出生点: {selectedMap.createMap(selectedMap.width, selectedMap.height).spawnPoints.length}个</p>
            </div>
          )}
        </div>
      </div>

      <div className="player-setup-footer">
        <button className="btn-secondary" onClick={onBack}>返回</button>
        <button className="btn-primary" onClick={handleStart} disabled={aiSlots.length === 0}>
          开始游戏
        </button>
      </div>
    </div>
  );
};
