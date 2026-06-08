import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { UnitRank } from '../../types';
import './Scoreboard.css';

export const Scoreboard: React.FC = () => {
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const aiPlayers = useGameStore(s => s.aiPlayers);
  const showStats = useGameStore(s => s.showStats);
  const gameTime = useGameStore(s => s.gameTime);

  if (!showStats) return null;

  const allPlayers = [currentPlayer, ...aiPlayers].filter(Boolean);

  const getPlayerStats = (player: typeof allPlayers[0]) => {
    if (!player) return null;
    const units = player.units || [];
    const buildings = player.buildings || [];
    const constructedBuildings = buildings.filter(b => b.isConstructed);
    const totalKills = units.reduce((sum, u) => sum + (u.kills || 0), 0);
    const totalDeaths = player.statistics?.unitsLost || 0;
    const veterans = units.filter(u => u.rank === UnitRank.VETERAN).length;
    const elites = units.filter(u => u.rank === UnitRank.ELITE).length;

    return {
      name: player.name || (player.isAI ? `AI-${(player as unknown as { faction?: string }).faction || '?'}` : '玩家'),
      color: player.color || '#ffffff',
      isAI: player.isAI,
      isDefeated: player.isDefeated || false,
      unitCount: units.length,
      buildingCount: constructedBuildings.length,
      totalKills,
      veterans,
      elites,
      money: player.money || 0,
      totalDeaths,
    };
  };

  const playerStats = allPlayers.map(getPlayerStats).filter(Boolean);

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);

  return (
    <div className="scoreboard-overlay" onClick={() => useGameStore.getState().toggleStats()}>
      <div className="scoreboard-panel" onClick={e => e.stopPropagation()}>
        <div className="scoreboard-header">
          <h2>游戏统计</h2>
          <span className="scoreboard-time">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
          <span className="scoreboard-hint">Tab 关闭</span>
        </div>
        <table className="scoreboard-table">
          <thead>
            <tr>
              <th>玩家</th>
              <th>单位</th>
              <th>建筑</th>
              <th>击杀</th>
              <th>死亡</th>
              <th>老兵</th>
              <th>精英</th>
              <th>资金</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map((stats, i) => (
              <tr key={i} className={stats?.isDefeated ? 'defeated' : ''}>
                <td>
                  <span className="player-color-dot" style={{ backgroundColor: stats?.color }} />
                  {stats?.name}
                  {stats?.isAI ? '' : ' (你)'}
                </td>
                <td>{stats?.unitCount}</td>
                <td>{stats?.buildingCount}</td>
                <td>{stats?.totalKills}</td>
                <td>{stats?.totalDeaths}</td>
                <td>{stats?.veterans}</td>
                <td>{stats?.elites}</td>
                <td>${stats?.money}</td>
                <td>{stats?.isDefeated ? '已消灭' : '存活'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};