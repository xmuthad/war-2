import React, { useState } from 'react';
import { Faction, Difficulty } from '../../types';
import { getFactionIcon, getDifficultyColor } from '../../utils/uiHelpers';
import './MultiplayerLobby.css';

export interface LobbyRoom {
  id: string;
  name: string;
  host: string;
  mapName: string;
  players: { name: string; faction: Faction; ready: boolean }[];
  maxPlayers: number;
  isPrivate: boolean;
  difficulty: Difficulty;
  hasPassword: boolean;
}

interface MultiplayerLobbyProps {
  onCreateRoom: (config: {
    name: string;
    mapName: string;
    maxPlayers: number;
    difficulty: Difficulty;
    isPrivate: boolean;
    password?: string;
  }) => void;
  onJoinRoom: (roomId: string, password?: string) => void;
  onLeaveRoom: () => void;
  onStartGame: () => void;
  onBack: () => void;
  currentRoom?: LobbyRoom;
  playerName: string;
  playerFaction: Faction;
  rooms?: LobbyRoom[];
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStartGame,
  onBack,
  currentRoom,
  playerName,
  rooms = []
}) => {
  const [view, setView] = useState<'list' | 'create' | 'room'>('list');
  const [joinPassword, setJoinPassword] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    name: `${playerName}的房间`,
    mapName: '岛屿争锋',
    maxPlayers: 4,
    difficulty: 'normal' as Difficulty,
    isPrivate: false,
    password: ''
  });

  const handleCreateRoom = () => {
    if (!createForm.name.trim()) return;
    onCreateRoom(createForm);
    setView('room');
  };

  const handleJoinRoom = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (room?.hasPassword && !joinPassword) {
      setSelectedRoom(roomId);
      return;
    }
    onJoinRoom(roomId, joinPassword || undefined);
    setJoinPassword('');
    setSelectedRoom(null);
  };

  const renderListView = () => (
    <>
      <div className="lobby-header">
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
        <h1>🌐 多人游戏大厅</h1>
        <button className="create-button" onClick={() => setView('create')}>
          + 创建房间
        </button>
      </div>

      <div className="rooms-list">
        {rooms.length === 0 ? (
          <div className="no-rooms">
            <span className="no-rooms-icon">🔍</span>
            <p>当前没有可用房间</p>
            <button onClick={() => setView('create')}>创建第一个房间</button>
          </div>
        ) : (
          rooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-header">
                <h3>{room.name}</h3>
                {room.hasPassword && <span className="lock-icon">🔒</span>}
              </div>
              
              <div className="room-info">
                <span className="info-item">
                  👤 房主: {room.host}
                </span>
                <span className="info-item">
                  🗺️ {room.mapName}
                </span>
                <span className="info-item">
                  👥 {room.players.length}/{room.maxPlayers}
                </span>
              </div>

              <div className="room-players">
                {room.players.map((player, idx) => (
                  <div key={idx} className="player-badge">
                    <span>{getFactionIcon(player.faction)}</span>
                    <span className={player.ready ? 'ready' : ''}>
                      {player.name}
                    </span>
                  </div>
                ))}
              </div>

              <button 
                className="join-button"
                onClick={() => handleJoinRoom(room.id)}
                disabled={room.players.length >= room.maxPlayers}
              >
                {room.players.length >= room.maxPlayers ? '已满' : '加入'}
              </button>
            </div>
          ))
        )}
      </div>

      {selectedRoom && (
        <div className="password-modal">
          <div className="password-content">
            <h3>🔐 输入房间密码</h3>
            <input
              type="password"
              value={joinPassword}
              onChange={e => setJoinPassword(e.target.value)}
              placeholder="请输入密码..."
            />
            <div className="password-actions">
              <button onClick={() => setSelectedRoom(null)}>取消</button>
              <button 
                className="primary"
                onClick={() => handleJoinRoom(selectedRoom)}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderCreateView = () => (
    <>
      <div className="lobby-header">
        <button className="back-button" onClick={() => setView('list')}>
          ← 返回
        </button>
        <h1>🏗️ 创建房间</h1>
      </div>

      <div className="create-form">
        <div className="form-group">
          <label>房间名称</label>
          <input
            type="text"
            value={createForm.name}
            onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="输入房间名称..."
          />
        </div>

        <div className="form-group">
          <label>地图</label>
          <select
            value={createForm.mapName}
            onChange={e => setCreateForm({ ...createForm, mapName: e.target.value })}
          >
            <option value="岛屿争锋">岛屿争锋</option>
            <option value="陆地大战">陆地大战</option>
            <option value="城市巷战">城市巷战</option>
            <option value="沙漠风暴">沙漠风暴</option>
          </select>
        </div>

        <div className="form-group">
          <label>最大玩家数</label>
          <select
            value={createForm.maxPlayers}
            onChange={e => setCreateForm({ ...createForm, maxPlayers: parseInt(e.target.value) })}
          >
            <option value="2">2人</option>
            <option value="4">4人</option>
            <option value="6">6人</option>
            <option value="8">8人</option>
          </select>
        </div>

        <div className="form-group">
          <label>难度</label>
          <select
            value={createForm.difficulty}
            onChange={e => setCreateForm({ ...createForm, difficulty: e.target.value as Difficulty })}
          >
            <option value="easy">简单</option>
            <option value="normal">普通</option>
            <option value="hard">困难</option>
            <option value="brutal">残酷</option>
          </select>
        </div>

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={createForm.isPrivate}
              onChange={e => setCreateForm({ ...createForm, isPrivate: e.target.checked })}
            />
            私人房间（需要密码）
          </label>
        </div>

        {createForm.isPrivate && (
          <div className="form-group">
            <label>房间密码</label>
            <input
              type="password"
              value={createForm.password}
              onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="设置房间密码..."
            />
          </div>
        )}

        <button 
          className="create-submit"
          onClick={handleCreateRoom}
          disabled={!createForm.name.trim()}
        >
          创建房间
        </button>
      </div>
    </>
  );

  const renderRoomView = () => {
    if (!currentRoom) return null;

    const isHost = currentRoom.host === playerName;
    const allReady = currentRoom.players.every(p => p.ready);

    return (
      <>
        <div className="lobby-header">
          <button className="back-button" onClick={onLeaveRoom}>
            ← 离开房间
          </button>
          <h1>🎮 {currentRoom.name}</h1>
          {isHost && (
            <button 
              className="start-button"
              onClick={onStartGame}
              disabled={!allReady || currentRoom.players.length < 2}
            >
              开始游戏
            </button>
          )}
        </div>

        <div className="room-details">
          <div className="room-info-panel">
            <div className="info-row">
              <span className="info-label">地图</span>
              <span className="info-value">{currentRoom.mapName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">难度</span>
              <span 
                className="info-value difficulty"
                style={{ color: getDifficultyColor(currentRoom.difficulty) }}
              >
                {currentRoom.difficulty}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">玩家</span>
              <span className="info-value">
                {currentRoom.players.length}/{currentRoom.maxPlayers}
              </span>
            </div>
          </div>

          <div className="players-grid">
            {Array.from({ length: currentRoom.maxPlayers }).map((_, idx) => {
              const player = currentRoom.players[idx];
              
              return (
                <div 
                  key={idx} 
                  className={`player-slot ${player ? 'occupied' : 'empty'}`}
                >
                  {player ? (
                    <>
                      <div className="player-faction">
                        {getFactionIcon(player.faction)}
                      </div>
                      <div className="player-name">{player.name}</div>
                      <div className={`player-status ${player.ready ? 'ready' : ''}`}>
                        {player.ready ? '✓ 已准备' : '等待准备'}
                      </div>
                      {isHost && player.name !== playerName && (
                        <button className="kick-button">踢出</button>
                      )}
                    </>
                  ) : (
                    <div className="empty-slot">等待加入...</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="room-actions">
            <button className="ready-button ready">
              ✓ 我已准备
            </button>
            <button className="ready-button">
              🔀 更换阵营
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="multiplayer-lobby">
      <div className="lobby-container">
        {view === 'list' && renderListView()}
        {view === 'create' && renderCreateView()}
        {view === 'room' && renderRoomView()}
      </div>
    </div>
  );
};

export default MultiplayerLobby;
