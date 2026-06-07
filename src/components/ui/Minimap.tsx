import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TileType, BuildingType, Building, Unit } from '../../types';
import { GAME_CONFIG } from '../../game/config/GameConfig';
import { TILE_INFO } from '../../game/config/TerrainConfig';
import { gameEventBus } from '../../game/systems/GameEventBus';
import './Minimap.css';

const TERRAIN_MINIMAP_COLORS: Record<TileType, string> =
  Object.fromEntries(
    Object.entries(TILE_INFO).map(([key, info]) => [
      key,
      '#' + info.color.toString(16).padStart(6, '0')
    ])
  ) as Record<TileType, string>;

interface MinimapConfig {
  width: number;
  height: number;
  showUnits: boolean;
  showBuildings: boolean;
  showResources: boolean;
}

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredTileRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const combatAlertsRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const {
    currentPlayer,
    aiPlayers,
    neutralBuildings,
    map,
    cameraPosition,
    cameraViewport,
    setCameraPosition,
    fogVisibleTiles
  } = useGameStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [pings, setPings] = useState<Array<{ x: number; y: number; time: number }>>([]);
  const [config, setConfig] = useState<MinimapConfig>({
    width: 180,
    height: 130,
    showUnits: true,
    showBuildings: true,
    showResources: true
  });

  const mapWidth = (map?.width || 32) * GAME_CONFIG.TILE_SIZE;
  const mapHeight = (map?.height || 32) * GAME_CONFIG.TILE_SIZE;
  const scaleX = config.width / mapWidth;
  const scaleY = config.height / mapHeight;

  const worldToMinimap = useCallback((wx: number, wy: number) => ({
    x: wx * scaleX,
    y: wy * scaleY
  }), [scaleX, scaleY]);

  const isPositionFogVisible = useCallback((worldX: number, worldY: number): boolean => {
    const tileX = Math.floor(worldX / GAME_CONFIG.TILE_SIZE);
    const tileY = Math.floor(worldY / GAME_CONFIG.TILE_SIZE);
    return fogVisibleTiles.has(`${tileX},${tileY}`);
  }, [fogVisibleTiles]);

  const minimapToWorld = useCallback((mx: number, my: number) => ({
    x: mx / scaleX,
    y: my / scaleY
  }), [scaleX, scaleY]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, config.width, config.height);

    if (map.tiles) {
      const tileDrawSize = Math.max(1, Math.ceil(32 * scaleX));
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const tile = map.tiles[y]?.[x];
          if (tile) {
            ctx.fillStyle = TERRAIN_MINIMAP_COLORS[tile.type] || '#4a6741';
            ctx.fillRect(
              Math.floor(x * GAME_CONFIG.TILE_SIZE * scaleX),
              Math.floor(y * GAME_CONFIG.TILE_SIZE * scaleY),
              tileDrawSize,
              tileDrawSize
            );
          }
        }
      }
    } else {
      ctx.fillStyle = '#4a6741';
      ctx.fillRect(0, 0, config.width, config.height);
    }

    if (config.showResources && map.resourceNodes) {
      map.resourceNodes.forEach(resource => {
        const pos = worldToMinimap(resource.position.x * GAME_CONFIG.TILE_SIZE, resource.position.y * GAME_CONFIG.TILE_SIZE);
        const radius = Math.max(2, 3 * scaleX * GAME_CONFIG.TILE_SIZE);

        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#cc9900';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    if (config.showBuildings) {
      const drawBuilding = (building: Building, isAlly: boolean, enemyColor: string) => {
        const pos = worldToMinimap(building.position.x, building.position.y);
        const size = Math.max(3, 5 * scaleX * GAME_CONFIG.TILE_SIZE);

        ctx.fillStyle = isAlly ? '#00b4ff' : enemyColor;
        ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);

        if (building.type === BuildingType.COMMAND) {
          ctx.strokeStyle = isAlly ? '#66d4ff' : enemyColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(pos.x - size / 2 - 1, pos.y - size / 2 - 1, size + 2, size + 2);
        }
      };

      currentPlayer?.buildings?.forEach(b => drawBuilding(b, true, ''));

      aiPlayers.forEach(player => {
        const isAlly = player.teamId === currentPlayer?.teamId;
        player.buildings?.forEach(b => {
          if (!isAlly && !isPositionFogVisible(b.position.x, b.position.y)) return;
          drawBuilding(b, isAlly, player.color);
        });
      });

      // Draw neutral buildings (white/gray)
      if (neutralBuildings && neutralBuildings.length > 0) {
        neutralBuildings.forEach(b => {
          if (!isPositionFogVisible(b.position.x, b.position.y)) return;
          const pos = worldToMinimap(b.position.x, b.position.y);
          const size = Math.max(3, 5 * scaleX * GAME_CONFIG.TILE_SIZE);
          ctx.fillStyle = '#cccccc';
          ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
          ctx.strokeStyle = '#888888';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
        });
      }
    }

    if (config.showUnits) {
      const drawUnit = (unit: Unit, isAlly: boolean, enemyColor: string) => {
        const pos = worldToMinimap(unit.position.x, unit.position.y);
        const radius = Math.max(1.5, 2.5 * scaleX * GAME_CONFIG.TILE_SIZE);

        ctx.fillStyle = isAlly
          ? (unit.isSelected ? '#ffd700' : '#44ff44')
          : enemyColor;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
      };

      currentPlayer?.units?.forEach(u => drawUnit(u, true, ''));

      aiPlayers.forEach(player => {
        const isAlly = player.teamId === currentPlayer?.teamId;
        player.units?.forEach(u => {
          if (!isAlly && !isPositionFogVisible(u.position.x, u.position.y)) return;
          drawUnit(u, isAlly, player.color);
        });
      });
    }

    const activeHover = hoveredTileRef.current;
    if (activeHover) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      const hx = activeHover.x * GAME_CONFIG.TILE_SIZE * scaleX;
      const hy = activeHover.y * GAME_CONFIG.TILE_SIZE * scaleY;
      ctx.fillRect(hx, hy, GAME_CONFIG.TILE_SIZE * scaleX, GAME_CONFIG.TILE_SIZE * scaleY);
    }

    // Draw combat alert flashes
    const now = Date.now();
    const alerts = combatAlertsRef.current.filter(a => now - a.time < 2000);
    combatAlertsRef.current = alerts;
    for (const alert of alerts) {
      const age = now - alert.time;
      const alpha = Math.max(0, 1 - age / 2000);
      const alertX = alert.x * scaleX;
      const alertY = alert.y * scaleY;
      const alertRadius = Math.max(3, 5 * scaleX * GAME_CONFIG.TILE_SIZE);
      ctx.fillStyle = `rgba(255, 30, 30, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(alertX, alertY, alertRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 80, 80, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(alertX, alertY, alertRadius + 1, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw pings (expanding green circles that fade out)
    for (const ping of pings) {
      const age = now - ping.time;
      const progress = age / 3000; // 0 to 1 over 3 seconds
      const alpha = Math.max(0, 1 - progress);
      const pingX = ping.x * scaleX;
      const pingY = ping.y * scaleY;
      const baseRadius = Math.max(3, 5 * scaleX * GAME_CONFIG.TILE_SIZE);
      const radius = baseRadius * (1 + progress * 2);
      ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pingX, pingY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(0, 255, 0, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(pingX, pingY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const vpX = cameraPosition.x * scaleX;
    const vpY = cameraPosition.y * scaleY;
    const vpW = cameraViewport.width * scaleX;
    const vpH = cameraViewport.height * scaleY;

    ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
    ctx.fillRect(vpX, vpY, vpW, vpH);

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(vpX, vpY, vpW, vpH);
    ctx.setLineDash([]);

    const cornerLen = Math.min(8, vpW / 4, vpH / 4);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vpX, vpY + cornerLen); ctx.lineTo(vpX, vpY); ctx.lineTo(vpX + cornerLen, vpY);
    ctx.moveTo(vpX + vpW - cornerLen, vpY); ctx.lineTo(vpX + vpW, vpY); ctx.lineTo(vpX + vpW, vpY + cornerLen);
    ctx.moveTo(vpX + vpW, vpY + vpH - cornerLen); ctx.lineTo(vpX + vpW, vpY + vpH); ctx.lineTo(vpX + vpW - cornerLen, vpY + vpH);
    ctx.moveTo(vpX + cornerLen, vpY + vpH); ctx.lineTo(vpX, vpY + vpH); ctx.lineTo(vpX, vpY + vpH - cornerLen);
    ctx.stroke();
  }, [config, currentPlayer, aiPlayers, neutralBuildings, map, worldToMinimap, isPositionFogVisible, cameraPosition, cameraViewport, scaleX, scaleY, pings]);

  // Reactive draw: only redraw when game state or config changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Periodic redraw for combat alert animation and ping animation
  useEffect(() => {
    let frameId: number;
    const tick = () => {
      if (combatAlertsRef.current.length > 0 || pings.length > 0) {
        draw();
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [draw, pings.length]);

  // Subscribe to combat events for minimap alerts
  useEffect(() => {
    const unsub = gameEventBus.on('combat:hit', (event) => {
      const pos = event.data?.position as { x: number; y: number } | undefined;
      if (pos) {
        combatAlertsRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
        // Keep max 10 alerts
        if (combatAlertsRef.current.length > 10) {
          combatAlertsRef.current = combatAlertsRef.current.slice(-10);
        }
      }
    });
    return unsub;
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleMinimapRightClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldPos = minimapToWorld(mx, my);

    const store = useGameStore.getState();
    const { selectedUnits } = store;
    if (selectedUnits.length > 0) {
      const unitIds = selectedUnits.map(u => u.id);
      store.moveUnitsToTarget(unitIds, { x: worldPos.x, y: worldPos.y });
    }
  }, [minimapToWorld]);

  const addPing = useCallback((position: { x: number; y: number }) => {
    const newPing = { x: position.x, y: position.y, time: Date.now() };
    setPings(prev => [...prev, newPing]);
    // Emit ping event for main game view
    gameEventBus.emit('map:ping', { position: { x: position.x, y: position.y } });
    // Remove ping after 3 seconds
    setTimeout(() => {
      setPings(prev => prev.filter(p => p.time !== newPing.time));
    }, 3000);
  }, []);

  const handleMinimapAltClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!e.altKey) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !map) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const worldX = (x / rect.width) * map.width * GAME_CONFIG.TILE_SIZE;
    const worldY = (y / rect.height) * map.height * GAME_CONFIG.TILE_SIZE;

    addPing({ x: worldX, y: worldY });
  }, [map, addPing]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldPos = minimapToWorld(mx, my);

    setCameraPosition({
      x: Math.max(0, Math.min(mapWidth - cameraViewport.width, worldPos.x - cameraViewport.width / 2)),
      y: Math.max(0, Math.min(mapHeight - cameraViewport.height, worldPos.y - cameraViewport.height / 2))
    });
  }, [minimapToWorld, mapWidth, mapHeight, cameraViewport, setCameraPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      if (e.altKey) {
        handleMinimapAltClick(e);
        return;
      }
      isDraggingRef.current = true;
      handleCanvasClick(e);
    }
  }, [handleCanvasClick, handleMinimapAltClick]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldPos = minimapToWorld(mx, my);
    const tileX = Math.floor(worldPos.x / GAME_CONFIG.TILE_SIZE);
    const tileY = Math.floor(worldPos.y / GAME_CONFIG.TILE_SIZE);

    if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
      hoveredTileRef.current = { x: tileX, y: tileY };
    } else {
      hoveredTileRef.current = null;
    }

    // RAF-throttled redraw for hover feedback
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        draw();
      });
    }

    if (isDraggingRef.current) {
      handleCanvasClick(e);
    }
  }, [map, minimapToWorld, draw, handleCanvasClick]);

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
    setHoveredTile(hoveredTileRef.current ? { ...hoveredTileRef.current } : null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    hoveredTileRef.current = null;
    setShowTooltip(false);
    setHoveredTile(null);
    draw();
  }, [draw]);

  const toggleExpanded = () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    setConfig(prev => ({
      ...prev,
      width: nextExpanded ? 280 : 150,
      height: nextExpanded ? 210 : 110
    }));
  };

  const toggleLayer = (layer: keyof Pick<MinimapConfig, 'showUnits' | 'showBuildings' | 'showResources'>) => {
    setConfig(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

  const getHoveredTileInfo = (): string | null => {
    if (!hoveredTile || !map?.tiles) return null;
    const tile = map.tiles[hoveredTile.y]?.[hoveredTile.x];
    if (!tile) return null;
    return `(${hoveredTile.x}, ${hoveredTile.y})`;
  };

  return (
    <div
      className={`minimap-container ${isExpanded ? 'expanded' : ''}`}
    >
      <div className="minimap-header">
        <span className="minimap-title">小地图</span>
        <div className="minimap-controls">
          <button
            className={`control-btn ${config.showUnits ? 'active' : ''}`}
            onClick={() => toggleLayer('showUnits')}
            title="显示单位"
            aria-label="切换单位显示"
          >
            👥
          </button>
          <button
            className={`control-btn ${config.showBuildings ? 'active' : ''}`}
            onClick={() => toggleLayer('showBuildings')}
            title="显示建筑"
            aria-label="切换建筑显示"
          >
            🏢
          </button>
          <button
            className={`control-btn ${config.showResources ? 'active' : ''}`}
            onClick={() => toggleLayer('showResources')}
            title="显示资源"
            aria-label="切换资源显示"
          >
            💎
          </button>
          <button
            className="expand-btn"
            onClick={toggleExpanded}
            title={isExpanded ? '收起' : '展开'}
            aria-label={isExpanded ? '收起小地图' : '展开小地图'}
          >
            {isExpanded ? '➖' : '➕'}
          </button>
        </div>
      </div>

      <div className="minimap-canvas-wrapper" onMouseEnter={handleMouseEnter}>
        <canvas
          ref={canvasRef}
          width={config.width}
          height={config.height}
          className="minimap-canvas"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          onContextMenu={handleMinimapRightClick}
        />
        {showTooltip && hoveredTile && (
          <div className="minimap-tooltip">
            {getHoveredTileInfo()}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="minimap-legend">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#44ff44' }}></span>
            <span>我方单位</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#ffd700' }}></span>
            <span>已选单位</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#00b4ff' }}></span>
            <span>我方建筑</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#ff4444' }}></span>
            <span>敌方</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#ffd700' }}></span>
            <span>资源</span>
          </div>
        </div>
      )}

      <div className="minimap-footer">
        <span className="minimap-hint">左键移动视角 · 右键移动单位 · Alt+左键标记</span>
        {map && (
          <span className="minimap-size">{map.width}×{map.height}</span>
        )}
      </div>
    </div>
  );
};
