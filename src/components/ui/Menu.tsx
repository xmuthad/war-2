import React from 'react';
import { useGameStore, GameSettings } from '../../store/gameStore';
import { Faction, Difficulty, GameState, GameMapData, PlayerSlot, PLAYER_COLORS } from '../../types';
import { mapPresets, MapPreset } from '../../game/map/MapPresets';
import { MapEditor } from './MapEditor';
import { PlayerSetup } from './PlayerSetup';
import { MapPreview } from './MapPreview';
import { ACHIEVEMENTS } from '../../game/data/achievements';
import './Menu.css';

export const Menu: React.FC = () => {
  const setGameState = useGameStore(s => s.setGameState);
  const initializeGame = useGameStore(s => s.initializeGame);
  const gameSettings = useGameStore(s => s.gameSettings);
  const setGameSettings = useGameStore(s => s.setGameSettings);
  const unlockedAchievements = useGameStore(s => s.unlockedAchievements);
  const startTutorial = useGameStore(s => s.startTutorial);
  const [selectedFaction, setSelectedFaction] = React.useState<Faction>(Faction.USA);
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<Difficulty>(Difficulty.NORMAL);
  const [selectedMap, setSelectedMap] = React.useState<MapPreset | null>(mapPresets[0]);
  const [customMap, setCustomMap] = React.useState<GameMapData | null>(null);
  const [showEditor, setShowEditor] = React.useState(false);
  const [showPlayerSetup, setShowPlayerSetup] = React.useState(false);
  const [customMaps, setCustomMaps] = React.useState<GameMapData[]>([]);
  const [editingMap, setEditingMap] = React.useState<GameMapData | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showAchievements, setShowAchievements] = React.useState(false);
  const [tutorialCompleted, setTutorialCompleted] = React.useState(() => {
    return localStorage.getItem('ra2_tutorial_completed') === 'true';
  });
  // Cache for map preview data (generate once per preset)
  const [previewMaps, setPreviewMaps] = React.useState<Map<string, GameMapData>>(new Map());

  React.useEffect(() => {
    const saved = localStorage.getItem('customMaps');
    if (saved) {
      setCustomMaps(JSON.parse(saved));
    }
  }, []);

  // Generate preview map data for each preset
  React.useEffect(() => {
    const previews = new Map<string, GameMapData>();
    for (const preset of mapPresets) {
      const mapData = preset.createMap(preset.width, preset.height);
      previews.set(preset.id, mapData);
    }
    setPreviewMaps(previews);
  }, []);

  const handleStartGame = (mapData?: GameMapData) => {
    let map: GameMapData;
    if (mapData) {
      map = mapData;
    } else if (customMap) {
      map = customMap;
    } else if (selectedMap) {
      map = selectedMap.createMap(selectedMap.width, selectedMap.height);
    } else {
      map = mapPresets[0].createMap(mapPresets[0].width, mapPresets[0].height);
    }

    const aiFaction = selectedFaction === Faction.USA ? Faction.SOVIET : Faction.USA;

    const playerSlot: PlayerSlot = {
      id: 'player',
      faction: selectedFaction,
      difficulty: selectedDifficulty,
      isAI: false,
      name: '指挥官',
      teamId: 1,
      color: PLAYER_COLORS[0],
    };

    const aiSlots: PlayerSlot[] = [
      {
        id: 'ai_1',
        faction: aiFaction,
        difficulty: selectedDifficulty,
        isAI: true,
        name: 'AI-1',
        teamId: 2,
        color: PLAYER_COLORS[1],
      },
    ];

    initializeGame(playerSlot, aiSlots, map);
    setGameState(GameState.PLAYING);
  };

  const handleObserverMode = (mapData?: GameMapData) => {
    let map: GameMapData;
    if (mapData) {
      map = mapData;
    } else if (customMap) {
      map = customMap;
    } else if (selectedMap) {
      map = selectedMap.createMap(selectedMap.width, selectedMap.height);
    } else {
      map = mapPresets[0].createMap(mapPresets[0].width, mapPresets[0].height);
    }

    // Observer mode: 2 AI players (one Allied, one Soviet)
    const playerSlot: PlayerSlot = {
      id: 'observer',
      faction: Faction.NEUTRAL,
      difficulty: selectedDifficulty,
      isAI: false,
      name: '观战者',
      teamId: 0,
      color: '#888888',
    };

    const aiSlots: PlayerSlot[] = [
      {
        id: 'ai_allied',
        faction: Faction.USA,
        difficulty: selectedDifficulty,
        isAI: true,
        name: '盟军AI',
        teamId: 1,
        color: PLAYER_COLORS[0],
      },
      {
        id: 'ai_soviet',
        faction: Faction.SOVIET,
        difficulty: selectedDifficulty,
        isAI: true,
        name: '苏军AI',
        teamId: 2,
        color: PLAYER_COLORS[1],
      },
    ];

    initializeGame(playerSlot, aiSlots, map, true);
    setGameState(GameState.PLAYING);
  };

  const handleMultiplayerStart = (playerSlot: PlayerSlot, aiSlots: PlayerSlot[], map: GameMapData) => {
    initializeGame(playerSlot, aiSlots, map);
    setGameState(GameState.PLAYING);
  };

  const handleEditMap = (map: GameMapData) => {
    setEditingMap(map);
    setShowEditor(true);
  };

  const handleDeleteMap = (mapId: string) => {
    const updated = customMaps.filter(m => m.id !== mapId);
    setCustomMaps(updated);
    localStorage.setItem('customMaps', JSON.stringify(updated));
    if (customMap?.id === mapId) {
      setCustomMap(null);
    }
  };

  const handleEditorSave = (map: GameMapData) => {
    let updated: GameMapData[];
    setCustomMaps(prev => {
      const existing = prev.findIndex(m => m.id === map.id);
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = map;
      } else {
        updated = [...prev, map];
      }
      return updated;
    });
    localStorage.setItem('customMaps', JSON.stringify(updated!));
    setShowEditor(false);
    setEditingMap(null);
  };

  const handleEditorPlay = (map: GameMapData) => {
    const aiFaction = selectedFaction === Faction.USA ? Faction.SOVIET : Faction.USA;
    const playerSlot: PlayerSlot = {
      id: 'player',
      faction: selectedFaction,
      difficulty: selectedDifficulty,
      isAI: false,
      name: '指挥官',
      teamId: 1,
      color: PLAYER_COLORS[0],
    };
    const aiSlots: PlayerSlot[] = [
      {
        id: 'ai_1',
        faction: aiFaction,
        difficulty: selectedDifficulty,
        isAI: true,
        name: 'AI-1',
        teamId: 2,
        color: PLAYER_COLORS[1],
      },
    ];
    initializeGame(playerSlot, aiSlots, map);
    setGameState(GameState.PLAYING);
  };

  const handleStartTutorial = () => {
    const map = selectedMap
      ? selectedMap.createMap(selectedMap.width, selectedMap.height)
      : mapPresets[0].createMap(mapPresets[0].width, mapPresets[0].height);

    const aiFaction = selectedFaction === Faction.USA ? Faction.SOVIET : Faction.USA;

    const playerSlot: PlayerSlot = {
      id: 'player',
      faction: selectedFaction,
      difficulty: Difficulty.EASY,
      isAI: false,
      name: '指挥官',
      teamId: 1,
      color: PLAYER_COLORS[0],
    };

    const aiSlots: PlayerSlot[] = [
      {
        id: 'ai_1',
        faction: aiFaction,
        difficulty: Difficulty.EASY,
        isAI: true,
        name: 'AI-1',
        teamId: 2,
        color: PLAYER_COLORS[1],
      },
    ];

    // Give extra starting resources for tutorial
    setGameSettings({ startingResources: 10000 });
    initializeGame(playerSlot, aiSlots, map);
    startTutorial();
    setGameState(GameState.PLAYING);
  };

  if (showEditor) {
    return (
      <MapEditor
        initialMap={editingMap ? {
          tiles: editingMap.tiles,
          spawnPoints: editingMap.spawnPoints,
          navalSpawnPoints: editingMap.navalSpawnPoints || [],
          resourceNodes: editingMap.resourceNodes,
          name: editingMap.name,
          width: editingMap.width,
          height: editingMap.height,
        } : undefined}
        onSave={handleEditorSave}
        onPlay={handleEditorPlay}
        onBack={() => {
          setShowEditor(false);
          setEditingMap(null);
        }}
      />
    );
  }

  if (showPlayerSetup) {
    return (
      <PlayerSetup
        onStart={handleMultiplayerStart}
        onBack={() => setShowPlayerSetup(false)}
      />
    );
  }

  return (
    <div className="menu-container">
      <div className="menu-background">
        <div className="menu-overlay"></div>
      </div>

      <div className="menu-content">
        <h1 className="game-title">红色警戒 2</h1>
        <p className="game-subtitle">网页版</p>

        <div className="menu-section">
          <h2 className="section-title">选择阵营</h2>
          <div className="faction-buttons">
            <button
              className={`faction-button ${selectedFaction === Faction.USA ? 'selected' : ''}`}
              onClick={() => setSelectedFaction(Faction.USA)}
            >
              <div className="faction-icon allied"></div>
              <div className="faction-info">
                <h3>盟军</h3>
                <p>科技先进、装甲强大</p>
              </div>
            </button>

            <button
              className={`faction-button ${selectedFaction === Faction.SOVIET ? 'selected' : ''}`}
              onClick={() => setSelectedFaction(Faction.SOVIET)}
            >
              <div className="faction-icon soviet"></div>
              <div className="faction-info">
                <h3>苏军</h3>
                <p>火力凶猛、数量优势</p>
              </div>
            </button>
          </div>
        </div>

        <div className="menu-section">
          <h2 className="section-title">选择难度</h2>
          <div className="difficulty-buttons">
            <button
              className={`difficulty-button ${selectedDifficulty === Difficulty.EASY ? 'selected' : ''}`}
              onClick={() => setSelectedDifficulty(Difficulty.EASY)}
            >
              简单
            </button>
            <button
              className={`difficulty-button ${selectedDifficulty === Difficulty.NORMAL ? 'selected' : ''}`}
              onClick={() => setSelectedDifficulty(Difficulty.NORMAL)}
            >
              普通
            </button>
            <button
              className={`difficulty-button ${selectedDifficulty === Difficulty.HARD ? 'selected' : ''}`}
              onClick={() => setSelectedDifficulty(Difficulty.HARD)}
            >
              困难
            </button>
          </div>
        </div>

        <div className="menu-section">
          <div className="section-header">
            <h2 className="section-title">选择地图</h2>
            <button className="editor-button" onClick={() => setShowEditor(true)}>
              + 创建地图
            </button>
          </div>

          <div className="map-tabs">
            <button 
              className={`map-tab ${!customMap ? 'active' : ''}`}
              onClick={() => {
                setCustomMap(null);
                if (!selectedMap) {
                  setSelectedMap(mapPresets[0]);
                }
              }}
            >
              预设地图
            </button>
            <button 
              className={`map-tab ${customMap ? 'active' : ''}`}
              onClick={() => {
                if (customMaps.length > 0) {
                  setCustomMap(customMaps[0]);
                  setSelectedMap(null);
                }
              }}
            >
              自定义地图 ({customMaps.length})
            </button>
          </div>

          {!customMap ? (
            <div className="map-selection-layout">
              {/* Left: Map list */}
              <div className="map-list">
                {mapPresets.map(preset => (
                  <button
                    key={preset.id}
                    className={`map-list-item ${selectedMap?.id === preset.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedMap(preset);
                      setCustomMap(null);
                    }}
                  >
                    <div className={`map-icon-small ${preset.size}`}></div>
                    <div className="map-list-info">
                      <h4>{preset.name}</h4>
                      <span className="map-size-label">{
                        preset.size === 'small' ? '小型' :
                        preset.size === 'medium' ? '中型' : '大型'
                      } {preset.width}x{preset.height}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Right: Large preview */}
              <div className="map-preview-large">
                {selectedMap && previewMaps.get(selectedMap.id) && (
                  <>
                    <MapPreview 
                      mapData={previewMaps.get(selectedMap.id)!} 
                      width={300} 
                      height={300} 
                      className="large-map-preview"
                    />
                    <div className="map-preview-info">
                      <h3>{selectedMap.name}</h3>
                      <p>{selectedMap.description}</p>
                      <div className="map-preview-details">
                        <span>尺寸: {selectedMap.width}x{selectedMap.height}</span>
                        <span>资源: {previewMaps.get(selectedMap.id)!.resourceNodes.length}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="map-selection-layout">
              <div className="map-list">
                {customMaps.map(map => (
                  <button
                    key={map.id}
                    className={`map-list-item ${customMap?.id === map.id ? 'selected' : ''}`}
                    onClick={() => setCustomMap(map)}
                  >
                    <div className="map-icon-small custom"></div>
                    <div className="map-list-info">
                      <h4>{map.name}</h4>
                      <span className="map-size-label">{map.width}x{map.height}</span>
                    </div>
                  </button>
                ))}
                {customMaps.length === 0 && (
                  <div className="no-maps">
                    <p>暂无自定义地图</p>
                    <button onClick={() => setShowEditor(true)}>创建第一个地图</button>
                  </div>
                )}
              </div>

              <div className="map-preview-large">
                {customMap && (
                  <>
                    <MapPreview mapData={customMap} width={300} height={300} className="large-map-preview" />
                    <div className="map-preview-info">
                      <h3>{customMap.name}</h3>
                      <div className="map-preview-details">
                        <span>尺寸: {customMap.width}x{customMap.height}</span>
                        <span>资源点: {customMap.resourceNodes.length}</span>
                        <span>出生点: {customMap.spawnPoints.length}</span>
                      </div>
                      <div className="map-preview-actions">
                        <button onClick={() => handleEditMap(customMap)}>编辑</button>
                        <button onClick={() => handleDeleteMap(customMap.id)} className="delete-btn">删除</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="menu-section">
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} 高级设置
          </button>
          {showAdvanced && (
            <div className="advanced-settings">
              <div className="advanced-row">
                <label className="advanced-label">初始资金</label>
                <input
                  type="range"
                  min={1000}
                  max={10000}
                  step={500}
                  value={gameSettings.startingResources}
                  onChange={e => setGameSettings({ startingResources: Number(e.target.value) })}
                  className="advanced-slider"
                />
                <span className="advanced-value">${gameSettings.startingResources.toLocaleString()}</span>
              </div>
              <div className="advanced-row">
                <label className="advanced-label">游戏速度</label>
                <select
                  value={gameSettings.gameSpeed}
                  onChange={e => setGameSettings({ gameSpeed: Number(e.target.value) as 1 | 2 | 3 })}
                  className="advanced-select"
                >
                  <option value={1}>慢速</option>
                  <option value={2}>正常</option>
                  <option value={3}>快速</option>
                </select>
              </div>
              <div className="advanced-row">
                <label className="advanced-label">战争迷雾</label>
                <button
                  className={`advanced-toggle-btn ${gameSettings.fogOfWarEnabled ? 'on' : 'off'}`}
                  onClick={() => setGameSettings({ fogOfWarEnabled: !gameSettings.fogOfWarEnabled })}
                >
                  {gameSettings.fogOfWarEnabled ? '开启' : '关闭'}
                </button>
              </div>
              <div className="advanced-row">
                <label className="advanced-label">超级武器</label>
                <button
                  className={`advanced-toggle-btn ${gameSettings.superweaponsEnabled ? 'on' : 'off'}`}
                  onClick={() => setGameSettings({ superweaponsEnabled: !gameSettings.superweaponsEnabled })}
                >
                  {gameSettings.superweaponsEnabled ? '开启' : '关闭'}
                </button>
              </div>
              <div className="advanced-row">
                <label className="advanced-label">矿石再生</label>
                <select
                  value={gameSettings.oreRegenRate}
                  onChange={e => setGameSettings({ oreRegenRate: Number(e.target.value) })}
                  className="advanced-select"
                >
                  <option value={0}>无</option>
                  <option value={1}>缓慢</option>
                  <option value={2}>正常</option>
                  <option value={3}>快速</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="start-buttons">
          <div className="start-buttons-group start-buttons-primary">
            <button className="start-button" onClick={() => handleStartGame()}>
              快速开始
            </button>
            <button
              className={`start-button ${!tutorialCompleted ? 'tutorial-highlight' : ''}`}
              onClick={handleStartTutorial}
              style={{ background: 'linear-gradient(135deg, #1a5a2a, #2a8a4a)' }}
            >
              📖 新手教程
            </button>
            <button className="start-button" onClick={() => setGameState(GameState.CAMPAIGN_SELECT)} style={{ background: 'linear-gradient(135deg, #8B4513, #D2691E)' }}>
              战役模式
            </button>
          </div>
          <div className="start-buttons-group start-buttons-secondary">
            <button className="multiplayer-button" onClick={() => setShowPlayerSetup(true)}>
              多人对战
            </button>
            <button className="observer-button" onClick={() => handleObserverMode()}>
              观战模式
            </button>
            <button className="achievement-button" onClick={() => setShowAchievements(true)}>
              🏆 成就 ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
            </button>
          </div>
        </div>

        <div className="menu-footer">
          <p>快捷键提示</p>
          <ul>
            <li>鼠标左键：选择单位/建筑</li>
            <li>鼠标右键：移动/攻击</li>
            <li>空格键：暂停/继续</li>
            <li>ESC：取消选择</li>
            <li>1-9：选择单位编队</li>
          </ul>
        </div>
      </div>

      {showAchievements && (
        <div className="achievement-modal-overlay" onClick={() => setShowAchievements(false)}>
          <div className="achievement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="achievement-modal-header">
              <h2>🏆 成就</h2>
              <span className="achievement-modal-count">{unlockedAchievements.length}/{ACHIEVEMENTS.length}</span>
              <button className="achievement-modal-close" onClick={() => setShowAchievements(false)}>✕</button>
            </div>
            <div className="achievement-modal-list">
              {ACHIEVEMENTS.map((achievement) => {
                const isUnlocked = unlockedAchievements.includes(achievement.id);
                return (
                  <div key={achievement.id} className={`achievement-modal-item ${isUnlocked ? 'unlocked' : 'locked'}`}>
                    <span className="achievement-modal-icon">{isUnlocked ? achievement.icon : '🔒'}</span>
                    <div className="achievement-modal-info">
                      <div className="achievement-modal-name">{isUnlocked ? achievement.name : '???'}</div>
                      <div className="achievement-modal-desc">{isUnlocked ? achievement.description : '未解锁'}</div>
                    </div>
                    {isUnlocked && <span className="achievement-modal-check">✅</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
