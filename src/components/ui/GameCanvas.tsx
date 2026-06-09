import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GameState, UnitType, TileType } from '../../types';
import { usePhaser } from '../../game/render/usePhaser';
import { gameEngine } from '../../game/engine/GameEngine';
import { GAME_CONFIG } from '../../game/config/GameConfig';
import { inputHandler } from '../../game/engine/InputHandler';
import { gameEventBus } from '../../game/systems/GameEventBus';
import { formatTime } from '../../utils/uiHelpers';
import { ResourceBar } from './ResourceBar';
import { BuildPanel } from './BuildPanel';
import { GameUI } from './GameUI';
import './GameCanvas.css';

const USE_PHASER = true;

export const GameCanvas: React.FC = () => {
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const aiPlayers = useGameStore(s => s.aiPlayers);
  const neutralBuildings = useGameStore(s => s.neutralBuildings);
  const map = useGameStore(s => s.map);
  const isPaused = useGameStore(s => s.isPaused);
  const gameState = useGameStore(s => s.gameState);
  const gameTime = useGameStore(s => s.gameTime);
  const isObserverMode = useGameStore(s => s.isObserverMode);
  const startDrag = useGameStore.getState().startDragSelection;
  const endDrag = useGameStore.getState().endDragSelection;
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      gameEngine.start();
    } else {
      gameEngine.stop();
    }
    return () => gameEngine.stop();
  }, [gameState]);

  const handleWorldClick = (worldX: number, worldY: number, shiftKey = false, ctrlKey = false) => {
    inputHandler.handleWorldClick(worldX, worldY, shiftKey, ctrlKey);
  };

  const handleWorldRightClick = (worldX: number, worldY: number, shiftKey = false) => {
    inputHandler.handleWorldRightClick(worldX, worldY, shiftKey);
  };

  const handleMouseMove = (worldX: number, worldY: number) => {
    inputHandler.handleMouseMove(worldX, worldY);
  };

  const handleMouseDown = (worldX: number, worldY: number) => {
    startDrag({ x: worldX, y: worldY });
  };

  const handleMouseUp = () => {
    endDrag();
  };

  const { containerRef, sceneRef, sceneReady } = usePhaser({
    map: map || null,
    onWorldClick: USE_PHASER ? handleWorldClick : undefined,
    onWorldRightClick: USE_PHASER ? handleWorldRightClick : undefined,
    onMouseMove: handleMouseMove,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp
  });

  // Set InputHandler's Phaser scene reference for camera bounds
  useEffect(() => {
    if (sceneReady && sceneRef.current) {
      inputHandler.setPhaserScene(sceneRef.current);
    }
  }, [sceneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect to update units and buildings when scene is ready
  useEffect(() => {
    if (!sceneReady || !sceneRef.current) {
      return;
    }

    const scene = sceneRef.current;
    if (!map) {
      return;
    }

    const isTileVisible = (worldX: number, worldY: number): boolean => {
      const tileX = Math.floor(worldX / GAME_CONFIG.TILE_SIZE);
      const tileY = Math.floor(worldY / GAME_CONFIG.TILE_SIZE);
      const fogOfWar = scene.getFogOfWar();
      return fogOfWar?.isTileVisible(tileX, tileY) ?? true;
    };

    const updateUnits = (units: typeof currentPlayer.units, isEnemy: boolean) => {
      units.forEach(unit => {
        if (isEnemy && !isObserverMode) {
          const visible = isTileVisible(unit.position.x, unit.position.y);
          if (!visible) {
            scene.setUnitVisible(unit.id, false);
            return;
          }
          // Submerged enemy submarines are invisible even in visible tiles
          if (unit.isSubmerged) {
            scene.setUnitVisible(unit.id, false);
            return;
          }
          scene.setUnitVisible(unit.id, true);
        }
        // Units inside a transport should be hidden and skip position updates
        if (unit.transportId) {
          scene.setUnitVisible(unit.id, false);
          return;
        }
        scene.updateUnit(
          unit.id,
          unit.type as UnitType,
          unit.faction,
          { x: unit.position.x / GAME_CONFIG.TILE_SIZE, y: 0, z: unit.position.y / GAME_CONFIG.TILE_SIZE },
          unit.direction
        );
        scene.setUnitSelected(unit.id, unit.isSelected);
        scene.setUnitHealth(unit.id, unit.health, unit.maxHealth);
        if (scene.setUnitInvulnerable) {
          scene.setUnitInvulnerable(unit.id, !!unit.isInvulnerable);
        }
        scene.setUnitRank(unit.id, unit.rank);
        if (unit.type === UnitType.PHANTOM || unit.type === UnitType.SPY) {
          scene.setUnitDisguised(unit.id, unit.isDisguised || false);
        }
        if (unit.type === UnitType.CHRONO) {
          scene.setUnitDisguised(unit.id, !!unit.isChronoShifting);
        }
        // Update group badge
        const groupManager = scene.getGroupManager?.();
        if (groupManager && scene.setUnitGroupBadge) {
          let unitGroup: number | null = null;
          for (let g = 1; g <= 9; g++) {
            if (groupManager.isUnitInGroup(g, unit.id)) {
              unitGroup = g;
              break;
            }
          }
          scene.setUnitGroupBadge(unit.id, unitGroup);
        }
        scene.setUnitVisible(unit.id, true);
      });
    };

    const updateBuildings = (buildings: typeof currentPlayer.buildings, isEnemy: boolean) => {
      buildings.forEach(building => {
        if (isEnemy && !isObserverMode) {
          const visible = isTileVisible(building.position.x, building.position.y);
          if (!visible) {
            scene.setBuildingVisible(building.id, false);
            return;
          }
          scene.setBuildingVisible(building.id, true);
        }
        scene.updateBuilding(
          building.id,
          building.type,
          building.faction,
          { x: building.position.x / GAME_CONFIG.TILE_SIZE, y: 0, z: building.position.y / GAME_CONFIG.TILE_SIZE },
          building.isConstructed,
          building.buildProgress || 0,
          building.isPowered
        );
        scene.setBuildingSelected(building.id, building.isSelected);
        scene.setBuildingHealth(building.id, building.health, building.maxHealth, building.oreStorage, building.maxOreStorage);
      });
    };

    if (currentPlayer) {
      updateUnits(currentPlayer.units, false);
      updateBuildings(currentPlayer.buildings, false);
    }

    if (aiPlayers.length > 0) {
      for (const ai of aiPlayers) {
        updateUnits(ai.units, true);
        updateBuildings(ai.buildings, true);
      }
    }

    if (neutralBuildings.length > 0) {
      updateBuildings(neutralBuildings, true);
    }

    // Defense building attack range indicator
    const selectedBuilding = useGameStore.getState().selectedBuilding;
    if (selectedBuilding && selectedBuilding.attack && selectedBuilding.attack > 0 && selectedBuilding.attackRange && selectedBuilding.attackRange > 0) {
      const bx = selectedBuilding.position.x + (selectedBuilding.width || 2) * GAME_CONFIG.TILE_SIZE / 2;
      const by = selectedBuilding.position.y + (selectedBuilding.height || 2) * GAME_CONFIG.TILE_SIZE / 2;
      scene.showBuildingAttackRange(bx, by, selectedBuilding.attackRange * GAME_CONFIG.TILE_SIZE);
    } else {
      scene.hideBuildingAttackRange();
    }

    // Update waypoint visualization for patrol units
    const allUnits = [
      ...currentPlayer.units,
      ...aiPlayers.flatMap(ai => ai.units),
    ];
    const waypointLines: Array<{ points: Array<{ x: number; y: number }>; color: number }> = [];
    for (const unit of allUnits) {
      if ((unit.state === 'patrolling' || unit.state === 'guarding') && unit.waypoints && unit.waypoints.length > 0) {
        waypointLines.push({
          points: [unit.position, ...unit.waypoints],
          color: 0x00ff00, // Green for patrol
        });
      }
    }
    scene.setWaypoints(waypointLines);

    // Update crate visuals
    const crateNodes = map.resourceNodes.filter(r => r.resourceType === 'crate');
    scene.setCrates(crateNodes);
  }, [sceneReady, currentPlayer, aiPlayers, neutralBuildings, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update fog visibility on a 200ms interval instead of every render
  useEffect(() => {
    if (!sceneReady || !sceneRef.current) return;

    const updateFog = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      const fogOfWar = scene.getFogOfWar();
      useGameStore.getState().updateFogVisibility(fogOfWar);
    };

    updateFog();
    const intervalId = setInterval(updateFog, 200);
    return () => clearInterval(intervalId);
  }, [sceneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for terrain tile changes (ore depletion)
  useEffect(() => {
    const unsub = gameEventBus.on('terrain:tilesChanged', (event) => {
      const tiles = event.data?.tiles as Array<{ x: number; y: number; type: string }> | undefined;
      if (tiles && sceneRef.current) {
        for (const tile of tiles) {
          sceneRef.current.updateTileVisual(tile.x, tile.y, tile.type as TileType);
        }
      }
    });
    return unsub;
  }, [sceneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      inputHandler.handleKeyDown(e.key, e);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (gameState === GameState.VICTORY) {
    const stats = currentPlayer?.statistics;
    return (
      <div className="game-over-screen victory">
        <div className="victory-particles" />
        <div className="game-over-content">
          <h1 className="game-over-title">胜利!</h1>
          <p className="game-over-subtitle">你成功击败了敌人!</p>
          <div className="game-over-stats">
            <div className="stat-item">
              <span className="stat-item-label">用时</span>
              <span className="stat-item-value">{formatTime(gameTime)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">生产单位</span>
              <span className="stat-item-value">{stats?.unitsProduced ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">消灭敌人</span>
              <span className="stat-item-value">{stats?.enemiesDestroyed ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">单位损失</span>
              <span className="stat-item-value">{stats?.unitsLost ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">建造建筑</span>
              <span className="stat-item-value">{stats?.buildingsBuilt ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">采集资源</span>
              <span className="stat-item-value">{stats?.resourcesGathered ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">剩余单位</span>
              <span className="stat-item-value">{currentPlayer?.units.length || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">剩余建筑</span>
              <span className="stat-item-value">{currentPlayer?.buildings.length || 0}</span>
            </div>
          </div>
          <button className="game-over-button" onClick={() => useGameStore.getState().resetGame()}>
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.DEFEAT) {
    const stats = currentPlayer?.statistics;
    return (
      <div className="game-over-screen defeat">
        <div className="defeat-overlay" />
        <div className="game-over-content">
          <h1 className="game-over-title">失败</h1>
          <p className="game-over-subtitle">你的基地被摧毁了。</p>
          <div className="game-over-stats">
            <div className="stat-item">
              <span className="stat-item-label">用时</span>
              <span className="stat-item-value">{formatTime(gameTime)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">生产单位</span>
              <span className="stat-item-value">{stats?.unitsProduced ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">消灭敌人</span>
              <span className="stat-item-value">{stats?.enemiesDestroyed ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">单位损失</span>
              <span className="stat-item-value">{stats?.unitsLost ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">建造建筑</span>
              <span className="stat-item-value">{stats?.buildingsBuilt ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">采集资源</span>
              <span className="stat-item-value">{stats?.resourcesGathered ?? 0}</span>
            </div>
          </div>
          <button className="game-over-button" onClick={() => useGameStore.getState().resetGame()}>
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-canvas-container" id="game-canvas-container">
      <div
        ref={containerRef}
        className="phaser-container"
        style={{
          width: '100vw',
          height: '100vh',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />

      {!sceneReady && (
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-title">红色警戒2</div>
            <div className="loading-subtitle">正在部署部队...</div>
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
          </div>
        </div>
      )}

      {!isObserverMode && <ResourceBar />}
      {!isObserverMode && <BuildPanel />}
      <GameUI />

      <div className="game-timer">
        <span className="timer-icon">⏱️</span>
        <span className="timer-value">{formatTime(gameTime)}</span>
      </div>

      {isPaused && (
        <div className="pause-overlay" role="dialog" aria-label="游戏暂停">
          <div className="pause-content">
            <h2 className="pause-title">游戏暂停</h2>
            <div className="pause-actions">
              <button
                className="pause-button primary"
                onClick={() => useGameStore.getState().setPaused(false)}
              >
                ▶ 继续游戏
              </button>
              <button
                className="pause-button"
                onClick={() => setShowStats(!showStats)}
              >
                📊 战况统计
              </button>
              <button
                className="pause-button"
                onClick={() => useGameStore.getState().resetGame()}
              >
                🚪 退出游戏
              </button>
            </div>
            {showStats && (
              <div className="pause-stats">
                <div className="pause-stat-row">
                  <span>游戏时间</span>
                  <span>{formatTime(gameTime)}</span>
                </div>
                <div className="pause-stat-row">
                  <span>我方单位</span>
                  <span>{currentPlayer?.units.length || 0}</span>
                </div>
                <div className="pause-stat-row">
                  <span>我方建筑</span>
                  <span>{currentPlayer?.buildings.length || 0}</span>
                </div>
                <div className="pause-stat-row">
                  <span>敌方单位</span>
                  <span>{aiPlayers.reduce((sum, ai) => sum + ai.units.length, 0)}</span>
                </div>
                <div className="pause-stat-row">
                  <span>敌方建筑</span>
                  <span>{aiPlayers.reduce((sum, ai) => sum + ai.buildings.length, 0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
