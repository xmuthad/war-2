import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GAME_CONFIG } from '../../game/config/GameConfig';
import { BuildingType } from '../../types';
import './ResourceBar.css';

const SUPERWEAPON_INFO: Record<string, { icon: string; name: string }> = {
  [BuildingType.NUCLEAR_SILO]: { icon: '☢️', name: '核弹' },
  [BuildingType.IRON_CURTAIN]: { icon: '🛡️', name: '铁幕' },
  [BuildingType.CHRONOSPHERE]: { icon: '🌀', name: '超时空' },
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const ResourceBar: React.FC = () => {
  const resources = useGameStore(s => s.resources);
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const gameSpeed = useGameStore(s => s.gameSpeed);
  const setGameSpeed = useGameStore(s => s.setGameSpeed);
  const [isCompact, setIsCompact] = useState(false);

  const resourcesDisplay = useMemo(() => {
    if (!resources) return [];
    return [
      {
        id: 'money',
        icon: '💰',
        value: resources.money,
        label: '资金',
        color: 'var(--color-primary)'
      },
      {
        id: 'power',
        icon: '⚡',
        value: resources.power,
        label: '电力',
        color: resources.power < 0 ? 'var(--color-danger)' : resources.power > 50 ? 'var(--color-success)' : 'var(--color-warning)',
        trend: (resources.power < 0 ? 'down' : resources.power > 50 ? 'up' : 'stable') as 'up' | 'down' | 'stable'
      },
      {
        id: 'tech',
        icon: '💎',
        value: resources.techLevel,
        label: '科技',
        color: 'var(--color-info)'
      }
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resources is a new object every frame, using primitive values
  }, [resources?.money, resources?.power, resources?.techLevel]);

  const totalUnits = currentPlayer?.units?.length || 0;
  const totalBuildings = currentPlayer?.buildings?.length || 0;
  const maxUnits = useGameStore(s => s.maxUnits);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return Math.round(num).toString();
  };

  const aiPlayers = useGameStore(s => s.aiPlayers);
  const superweaponsEnabled = useGameStore(s => s.gameSettings.superweaponsEnabled);

  const superweaponStatus = useMemo(() => {
    if (!superweaponsEnabled || !currentPlayer) return [];
    const allPlayers = [currentPlayer, ...aiPlayers].filter(Boolean);
    const result: Array<{
      id: string;
      icon: string;
      name: string;
      ready: boolean;
      progress: number;
      remaining: number;
      isOwn: boolean;
      playerName: string;
      playerColor: string;
    }> = [];
    for (const player of allPlayers) {
      for (const b of player.buildings) {
        if (b.superweaponChargeTime && b.isConstructed) {
          const info = SUPERWEAPON_INFO[b.type];
          if (!info) continue;
          const progress = b.superweaponReady
            ? 1
            : (b.superweaponChargeProgress || 0) / b.superweaponChargeTime;
          const remaining = b.superweaponReady
            ? 0
            : b.superweaponChargeTime - (b.superweaponChargeProgress || 0);
          result.push({
            id: b.id,
            icon: info.icon,
            name: info.name,
            ready: !!b.superweaponReady,
            progress,
            remaining,
            isOwn: player.id === currentPlayer.id,
            playerName: player.name,
            playerColor: player.color,
          });
        }
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superweaponsEnabled, currentPlayer?.id, currentPlayer?.buildings, aiPlayers]);

  const powerResource = resourcesDisplay.find(r => r.id === 'power');
  const maxPower = currentPlayer?.maxPower ?? GAME_CONFIG.STARTING_MAX_POWER;
  const powerPercent = powerResource
    ? Math.min(100, Math.max(0, ((powerResource.value + maxPower) / (maxPower * 2)) * 100))
    : 50;

  return (
    <div className={`resource-bar-container ${isCompact ? 'compact' : ''}`}>
      <div className="resource-bar-header">
        <span className="player-info">
          <span className="player-color" style={{ backgroundColor: currentPlayer?.color }}></span>
          <span className="player-name">{currentPlayer?.name || '玩家'}</span>
        </span>
        <button
          className="compact-toggle"
          onClick={() => setIsCompact(!isCompact)}
          aria-label={isCompact ? '展开资源栏' : '收起资源栏'}
        >
          {isCompact ? '➕' : '➖'}
        </button>
      </div>

      <div className="resource-items">
        {resourcesDisplay.map(resource => (
          <div
            key={resource.id}
            className={`resource-item ${resource.trend ? `trend-${resource.trend}` : ''}`}
            title={`${resource.label}: ${resource.value}`}
          >
            <span className="resource-icon">{resource.icon}</span>
            <div className="resource-details">
              <span className="resource-value" style={{ color: resource.color }}>
                {formatNumber(resource.value)}
              </span>
              {!isCompact && (
                <span className="resource-label">{resource.label}</span>
              )}
            </div>
            {resource.trend && (
              <span className={`trend-indicator ${resource.trend}`}>
                {resource.trend === 'up' ? '▲' : resource.trend === 'down' ? '▼' : '─'}
              </span>
            )}
          </div>
        ))}
      </div>

      {!isCompact && powerResource && (
        <div className="power-bar-section">
          <div className="power-bar-label">
            <span>电力</span>
            <span className={`power-value ${powerResource.value < 0 ? 'negative' : 'positive'}`}>
              {powerResource.value > 0 ? '+' : ''}{powerResource.value}
            </span>
          </div>
          <div className="power-bar">
            <div
              className={`power-fill ${powerResource.value < 0 ? 'deficit' : powerResource.value < 30 ? 'low' : 'normal'}`}
              style={{ width: `${powerPercent}%` }}
            />
            <div className="power-bar-center" />
          </div>
        </div>
      )}

      {!isCompact && (
        <div className="unit-counts">
          <div className="count-item">
            <span className="count-icon">👥</span>
            <span className={`count-value ${totalUnits >= maxUnits ? 'at-cap' : ''}`}>{totalUnits}/{maxUnits}</span>
            <span className="count-label">单位</span>
          </div>
          <div className="count-item">
            <span className="count-icon">🏢</span>
            <span className="count-value">{totalBuildings}</span>
            <span className="count-label">建筑</span>
          </div>
          <div className={`count-item speed-${gameSpeed}`} onClick={() => setGameSpeed(((gameSpeed % 4) + 1) as 1 | 2 | 3 | 4)} title="点击切换游戏速度" style={{ cursor: 'pointer' }}>
            <span className="count-icon">{gameSpeed >= 4 ? '⚡⚡' : gameSpeed >= 3 ? '⚡' : '⏵'}</span>
            <span className="count-value">{gameSpeed}x</span>
            <span className="count-label">速度</span>
          </div>
          <div className="count-item surrender-btn" onClick={() => { if (window.confirm('确定要投降吗？')) useGameStore.getState().surrender(); }} title="投降" style={{ cursor: 'pointer' }}>
            <span className="count-icon">🏳️</span>
            <span className="count-label">投降</span>
          </div>
        </div>
      )}

      {resources?.techLevel && (
        <div className="tech-level">
          <span className="tech-icon">🔬</span>
          <span className="tech-label">科技等级</span>
          <div className="tech-bar">
            {[1, 2, 3, 4, 5].map(level => (
              <div
                key={level}
                className={`tech-pip ${level <= resources.techLevel ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {!isCompact && superweaponStatus.length > 0 && (
        <div className="superweapon-section">
          <div className="superweapon-header">
            <span className="superweapon-title">⚠️ 超级武器</span>
          </div>
          {superweaponStatus.map(sw => (
            <div key={sw.id} className={`superweapon-item ${sw.ready ? 'ready' : ''} ${sw.isOwn ? 'own' : 'enemy'}`}>
              <div className="superweapon-info">
                <span className="superweapon-icon">{sw.icon}</span>
                <span className="superweapon-name">{sw.name}</span>
                {!sw.isOwn && (
                  <span className="superweapon-player" style={{ color: sw.playerColor }}>
                    {sw.playerName}
                  </span>
                )}
              </div>
              {sw.ready ? (
                <span className="superweapon-ready-text">就绪</span>
              ) : (
                <div className="superweapon-charge">
                  <div className="superweapon-bar">
                    <div
                      className={`superweapon-fill ${sw.progress > 0.8 ? 'high' : sw.progress > 0.5 ? 'mid' : 'low'}`}
                      style={{ width: `${Math.min(100, sw.progress * 100)}%` }}
                    />
                  </div>
                  <span className="superweapon-time">{formatTime(sw.remaining)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
