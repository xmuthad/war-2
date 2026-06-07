import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TileType, Tile, GameMapData, Vector2, ResourceNode } from '../../types';
import { TILE_INFO } from '../../game/config/TerrainConfig';
import { generateId } from '../../utils/uiHelpers';
import './MapEditor.css';

const TILE_COLORS: Record<TileType, string> = Object.fromEntries(
  Object.entries(TILE_INFO).map(([key, info]) => [key, '#' + info.color.toString(16).padStart(6, '0')])
) as Record<TileType, string>;

type ToolType = 'brush' | 'spawn' | 'navalSpawn' | 'resource' | 'eraser' | 'fill';

interface EditorMap {
  tiles: Tile[][];
  spawnPoints: Vector2[];
  navalSpawnPoints: Vector2[];
  resourceNodes: ResourceNode[];
  name: string;
  width: number;
  height: number;
}

interface HistoryEntry {
  tiles: Tile[][];
  spawnPoints: Vector2[];
  navalSpawnPoints: Vector2[];
  resourceNodes: ResourceNode[];
}

const MAX_HISTORY = 50;

export const MapEditor: React.FC<{
  onSave?: (map: GameMapData) => void;
  onPlay?: (map: GameMapData) => void;
  onBack?: () => void;
  initialMap?: EditorMap;
}> = ({ onSave, onPlay, onBack, initialMap }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapName, setMapName] = useState(initialMap?.name || '我的地图');
  const [mapWidth, setMapWidth] = useState(initialMap?.width || 48);
  const [mapHeight, setMapHeight] = useState(initialMap?.height || 48);
  const [selectedTool, setSelectedTool] = useState<TileType | ToolType>('brush');
  const [selectedBrush, setSelectedBrush] = useState<TileType>(TileType.GRASS);
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<Vector2 | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [spawnPoints, setSpawnPoints] = useState<Vector2[]>(initialMap?.spawnPoints || [
    { x: 3, y: 3 },
    { x: 44, y: 44 },
  ]);
  const [navalSpawnPoints, setNavalSpawnPoints] = useState<Vector2[]>(initialMap?.navalSpawnPoints || []);
  const [resourceNodes, setResourceNodes] = useState<ResourceNode[]>(initialMap?.resourceNodes || []);
  const [tiles, setTiles] = useState<Tile[][]>(() => {
    if (initialMap?.tiles) return initialMap.tiles;
    return createEmptyTiles(48, 48);
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [notification, setNotification] = useState<{message: string; type: 'error' | 'success' | 'info'} | null>(null);
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  function createEmptyTiles(width: number, height: number): Tile[][] {
    const newTiles: Tile[][] = [];
    for (let y = 0; y < height; y++) {
      newTiles[y] = [];
      for (let x = 0; x < width; x++) {
        newTiles[y][x] = {
          type: TileType.GRASS,
          walkable: true,
          buildable: true,
          movementCost: 1,
        };
      }
    }
    return newTiles;
  }

  const pushHistory = useCallback((currentTiles: Tile[][], currentSpawns: Vector2[], currentNavalSpawns: Vector2[], currentResources: ResourceNode[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({
        tiles: currentTiles.map(row => row.map(t => ({ ...t }))),
        spawnPoints: [...currentSpawns],
        navalSpawnPoints: [...currentNavalSpawns],
        resourceNodes: currentResources.map(r => ({ ...r })),
      });
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prevEntry = history[historyIndex - 1];
    setTiles(prevEntry.tiles);
    setSpawnPoints(prevEntry.spawnPoints);
    setNavalSpawnPoints(prevEntry.navalSpawnPoints);
    setResourceNodes(prevEntry.resourceNodes);
    setHistoryIndex(prev => prev - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextEntry = history[historyIndex + 1];
    setTiles(nextEntry.tiles);
    setSpawnPoints(nextEntry.spawnPoints);
    setNavalSpawnPoints(nextEntry.navalSpawnPoints);
    setResourceNodes(nextEntry.resourceNodes);
    setHistoryIndex(prev => prev + 1);
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (initialMap?.tiles) {
      setTiles(initialMap.tiles);
      setSpawnPoints(initialMap.spawnPoints);
      setNavalSpawnPoints(initialMap.navalSpawnPoints);
      setResourceNodes(initialMap.resourceNodes);
    }
  }, [initialMap]);

  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.floor(rect.width - 20),
          height: Math.floor(rect.height - 20)
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    const newTiles = createEmptyTiles(mapWidth, mapHeight);
    for (let y = 0; y < Math.min(tiles.length, mapHeight); y++) {
      for (let x = 0; x < Math.min(tiles[0]?.length || 0, mapWidth); x++) {
        newTiles[y][x] = { ...tiles[y][x] };
      }
    }
    setTiles(newTiles);
  }, [mapWidth, mapHeight]); // eslint-disable-line react-hooks/exhaustive-deps -- tiles is intentionally excluded to avoid infinite loop; we only want to resize when dimensions change

  const getTileSize = useCallback(() => {
    return Math.max(2, Math.min(
      Math.floor(canvasSize.width / mapWidth),
      Math.floor(canvasSize.height / mapHeight)
    ));
  }, [canvasSize, mapWidth, mapHeight]);

  const getOffset = useCallback(() => {
    const tileSize = getTileSize();
    return {
      x: Math.floor((canvasSize.width - tileSize * mapWidth) / 2),
      y: Math.floor((canvasSize.height - tileSize * mapHeight) / 2)
    };
  }, [canvasSize, mapWidth, mapHeight, getTileSize]);

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileSize = getTileSize();
    const offset = getOffset();

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = tiles[y]?.[x];
        if (tile) {
          const px = offset.x + x * tileSize;
          const py = offset.y + y * tileSize;

          ctx.fillStyle = TILE_COLORS[tile.type];
          ctx.fillRect(px, py, tileSize, tileSize);

          if (tileSize >= 8) {
            if (tile.type === TileType.FOREST) {
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.fillRect(px + tileSize * 0.3, py + tileSize * 0.1, tileSize * 0.4, tileSize * 0.8);
            } else if (tile.type === TileType.WATER) {
              ctx.fillStyle = 'rgba(255,255,255,0.1)';
              ctx.fillRect(px, py + tileSize * 0.4, tileSize, tileSize * 0.2);
            } else if (tile.type === TileType.ORE) {
              ctx.fillStyle = '#8B4513';
              const inset = tileSize * 0.25;
              ctx.fillRect(px + inset, py + inset, tileSize - inset * 2, tileSize - inset * 2);
            } else if (tile.type === TileType.MOUNTAIN) {
              ctx.fillStyle = 'rgba(255,255,255,0.15)';
              ctx.beginPath();
              ctx.moveTo(px + tileSize * 0.5, py + tileSize * 0.15);
              ctx.lineTo(px + tileSize * 0.85, py + tileSize * 0.85);
              ctx.lineTo(px + tileSize * 0.15, py + tileSize * 0.85);
              ctx.closePath();
              ctx.fill();
            }
          }

          if (showOverlay && tileSize >= 6) {
            if (!tile.walkable) {
              ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
              ctx.fillRect(px, py, tileSize, tileSize);
            } else if (tile.buildable) {
              ctx.fillStyle = 'rgba(0, 255, 0, 0.08)';
              ctx.fillRect(px, py, tileSize, tileSize);
            }
          }
        }
      }
    }

    if (showGrid && tileSize >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= mapWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(offset.x + x * tileSize, offset.y);
        ctx.lineTo(offset.x + x * tileSize, offset.y + mapHeight * tileSize);
        ctx.stroke();
      }
      for (let y = 0; y <= mapHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(offset.x, offset.y + y * tileSize);
        ctx.lineTo(offset.x + mapWidth * tileSize, offset.y + y * tileSize);
        ctx.stroke();
      }
    }

    resourceNodes.forEach((node, index) => {
      const px = offset.x + node.position.x * tileSize + tileSize / 2;
      const py = offset.y + node.position.y * tileSize + tileSize / 2;
      const radius = Math.max(3, tileSize * 0.35);

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.max(1, tileSize * 0.06);
      ctx.stroke();

      if (tileSize >= 12) {
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(8, tileSize * 0.35)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(index + 1), px, py);
      }
    });

    spawnPoints.forEach((point, index) => {
      const px = offset.x + point.x * tileSize + tileSize / 2;
      const py = offset.y + point.y * tileSize + tileSize / 2;
      const radius = Math.max(4, tileSize * 0.5);
      const color = index === 0 ? '#0078D7' : '#CC0000';

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color + '33';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, tileSize * 0.08);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(8, tileSize * 0.4)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${index + 1}`, px, py);
    });

    navalSpawnPoints.forEach((point, index) => {
      const px = offset.x + point.x * tileSize + tileSize / 2;
      const py = offset.y + point.y * tileSize + tileSize / 2;
      const radius = Math.max(4, tileSize * 0.5);
      const color = '#00BFFF';

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color + '33';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, tileSize * 0.08);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(8, tileSize * 0.35)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`N${index + 1}`, px, py);
    });

    if (hoveredTile && tileSize >= 4) {
      const hx = offset.x + hoveredTile.x * tileSize;
      const hy = offset.y + hoveredTile.y * tileSize;

      if (selectedTool === 'brush' || selectedTool === 'eraser') {
        const halfBrush = Math.floor(brushSize / 2);
        ctx.strokeStyle = selectedTool === 'eraser' ? 'rgba(255,100,100,0.8)' : 'rgba(255,215,0,0.8)';
        ctx.lineWidth = 1.5;
        for (let dy = -halfBrush; dy <= halfBrush; dy++) {
          for (let dx = -halfBrush; dx <= halfBrush; dx++) {
            if (Math.abs(dx) + Math.abs(dy) <= halfBrush + 1) {
              const nx = hoveredTile.x + dx;
              const ny = hoveredTile.y + dy;
              if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
                ctx.strokeRect(
                  offset.x + nx * tileSize,
                  offset.y + ny * tileSize,
                  tileSize,
                  tileSize
                );
              }
            }
          }
        }
      } else {
        ctx.strokeStyle = 'rgba(255,215,0,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx, hy, tileSize, tileSize);
      }
    }
  }, [tiles, mapWidth, mapHeight, spawnPoints, navalSpawnPoints, resourceNodes, showGrid, showOverlay, hoveredTile, selectedTool, brushSize, getTileSize, getOffset]);

  useEffect(() => {
    drawMap();
  }, [drawMap]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const getTileAt = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Vector2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const tileSize = getTileSize();
    const offset = getOffset();

    const tileX = Math.floor((x - offset.x) / tileSize);
    const tileY = Math.floor((y - offset.y) / tileSize);

    if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight) {
      return { x: tileX, y: tileY };
    }
    return null;
  }, [mapWidth, mapHeight, getTileSize, getOffset]);

  const paintTile = (x: number, y: number, type: TileType) => {
    const halfBrush = Math.floor(brushSize / 2);
    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
          if (Math.abs(dx) + Math.abs(dy) <= halfBrush + 1) {
            tiles[ny][nx] = {
              type,
              walkable: TILE_INFO[type].walkable,
              buildable: TILE_INFO[type].buildable,
              movementCost: TILE_INFO[type].cost,
            };
          }
        }
      }
    }
    setTiles([...tiles]);
  };

  const eraseTile = (x: number, y: number) => {
    const halfBrush = Math.floor(brushSize / 2);
    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
          if (Math.abs(dx) + Math.abs(dy) <= halfBrush + 1) {
            tiles[ny][nx] = {
              type: TileType.GRASS,
              walkable: true,
              buildable: true,
              movementCost: 1,
            };
          }
        }
      }
    }
    setTiles([...tiles]);
  };

  const fillAll = (type: TileType) => {
    pushHistory(tiles, spawnPoints, navalSpawnPoints, resourceNodes);
    const newTiles: Tile[][] = [];
    for (let y = 0; y < mapHeight; y++) {
      newTiles[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        newTiles[y][x] = {
          type,
          walkable: TILE_INFO[type].walkable,
          buildable: TILE_INFO[type].buildable,
          movementCost: TILE_INFO[type].cost,
        };
      }
    }
    setTiles(newTiles);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getTileAt(e);
    if (!pos) return;

    setIsDrawing(true);
    pushHistory(tiles, spawnPoints, navalSpawnPoints, resourceNodes);

    if (selectedTool === 'brush') {
      paintTile(pos.x, pos.y, selectedBrush);
    } else if (selectedTool === 'eraser') {
      eraseTile(pos.x, pos.y);
    } else if (selectedTool === 'fill') {
      floodFill(pos.x, pos.y, selectedBrush);
    } else if (selectedTool === 'spawn') {
      if (spawnPoints.length < 4) {
        setSpawnPoints([...spawnPoints, { x: pos.x, y: pos.y }]);
      }
    } else if (selectedTool === 'navalSpawn') {
      if (navalSpawnPoints.length < 4) {
        setNavalSpawnPoints([...navalSpawnPoints, { x: pos.x, y: pos.y }]);
      }
    } else if (selectedTool === 'resource') {
      setResourceNodes([...resourceNodes, {
        id: generateId(),
        position: { x: pos.x, y: pos.y },
        amount: 1000,
        maxAmount: 2000,
      }]);
    }
  };

  const floodFill = (startX: number, startY: number, fillType: TileType) => {
    const targetTile = tiles[startY]?.[startX]?.type;
    if (targetTile === fillType) return;

    const visited = new Set<string>();
    const queue: Vector2[] = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const pos = queue.shift()!;
      const key = `${pos.x},${pos.y}`;

      if (visited.has(key)) continue;
      if (pos.x < 0 || pos.x >= mapWidth || pos.y < 0 || pos.y >= mapHeight) continue;
      if (tiles[pos.y][pos.x].type !== targetTile) continue;

      visited.add(key);
      tiles[pos.y][pos.x] = {
        type: fillType,
        walkable: TILE_INFO[fillType].walkable,
        buildable: TILE_INFO[fillType].buildable,
        movementCost: TILE_INFO[fillType].cost,
      };

      queue.push({ x: pos.x + 1, y: pos.y });
      queue.push({ x: pos.x - 1, y: pos.y });
      queue.push({ x: pos.x, y: pos.y + 1 });
      queue.push({ x: pos.x, y: pos.y - 1 });
    }

    setTiles([...tiles]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getTileAt(e);
    setHoveredTile(pos);

    if (!isDrawing || !pos) return;

    if (selectedTool === 'brush') {
      paintTile(pos.x, pos.y, selectedBrush);
    } else if (selectedTool === 'eraser') {
      eraseTile(pos.x, pos.y);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
    setHoveredTile(null);
  };

  const removeLastResource = () => {
    if (resourceNodes.length > 0) {
      setResourceNodes(resourceNodes.slice(0, -1));
    }
  };

  const handleSave = () => {
    const mapData: GameMapData = {
      id: generateId(),
      name: mapName,
      width: mapWidth,
      height: mapHeight,
      tiles,
      spawnPoints,
      navalSpawnPoints,
      resourceNodes,
    };
    onSave?.(mapData);

    try {
      const savedMaps = JSON.parse(localStorage.getItem('customMaps') || '[]');
      if (savedMaps.length >= 20) savedMaps.shift();
      savedMaps.push(mapData);
      localStorage.setItem('customMaps', JSON.stringify(savedMaps));
    } catch {
      // storage full or unavailable
    }
  };

  const handleExport = () => {
    const mapData: GameMapData = {
      id: generateId(),
      name: mapName,
      width: mapWidth,
      height: mapHeight,
      tiles,
      spawnPoints,
      navalSpawnPoints,
      resourceNodes,
    };
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const mapData = JSON.parse(ev.target?.result as string) as GameMapData;
          if (!mapData.tiles || !mapData.width || !mapData.height) {
            setNotification({message: '无效的地图文件', type: 'error'});
            return;
          }
          setTiles(mapData.tiles);
          setSpawnPoints(mapData.spawnPoints || []);
          setNavalSpawnPoints(mapData.navalSpawnPoints || []);
          setResourceNodes(mapData.resourceNodes || []);
          setMapWidth(mapData.width);
          setMapHeight(mapData.height);
          setMapName(mapData.name || '导入地图');
          pushHistory(tiles, spawnPoints, navalSpawnPoints, resourceNodes);
        } catch {
          setNotification({message: '无法解析地图文件', type: 'error'});
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleLoadSaved = () => {
    try {
      const savedMaps: GameMapData[] = JSON.parse(localStorage.getItem('customMaps') || '[]');
      if (savedMaps.length === 0) {
        setNotification({message: '没有已保存的地图', type: 'info'});
        return;
      }
      setShowLoadDialog(true);
    } catch {
      setNotification({message: '加载失败', type: 'error'});
    }
  };

  const handleLoadMapByIndex = (index: number) => {
    try {
      const savedMaps: GameMapData[] = JSON.parse(localStorage.getItem('customMaps') || '[]');
      const mapData = savedMaps[index];
      if (!mapData) return;
      setTiles(mapData.tiles);
      setSpawnPoints(mapData.spawnPoints || []);
      setNavalSpawnPoints(mapData.navalSpawnPoints || []);
      setResourceNodes(mapData.resourceNodes || []);
      setMapWidth(mapData.width);
      setMapHeight(mapData.height);
      setMapName(mapData.name || '加载地图');
      pushHistory(tiles, spawnPoints, navalSpawnPoints, resourceNodes);
      setShowLoadDialog(false);
      setNotification({message: '地图加载成功', type: 'success'});
    } catch {
      setNotification({message: '加载失败', type: 'error'});
      setShowLoadDialog(false);
    }
  };

  const handlePlay = () => {
    const mapData: GameMapData = {
      id: generateId(),
      name: mapName,
      width: mapWidth,
      height: mapHeight,
      tiles,
      spawnPoints,
      navalSpawnPoints,
      resourceNodes,
    };
    onPlay?.(mapData);
  };

  const getHoveredTileInfo = (): string | null => {
    if (!hoveredTile) return null;
    const tile = tiles[hoveredTile.y]?.[hoveredTile.x];
    if (!tile) return null;
    const info = TILE_INFO[tile.type];
    return `${info.name} (${hoveredTile.x}, ${hoveredTile.y})${info.walkable ? '' : ' ✗不可通行'}${info.buildable ? ' ✓可建造' : ''}`;
  };

  return (
    <div className="map-editor">
      <div className="editor-header">
        <h2>地图编辑器</h2>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="撤销 (Ctrl+Z)"
          >
            ↩ 撤销
          </button>
          <button
            className="btn-secondary"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="重做 (Ctrl+Shift+Z)"
          >
            ↪ 重做
          </button>
          <button className="btn-secondary" onClick={onBack}>返回</button>
          <button className="btn-secondary" onClick={handleLoadSaved}>加载</button>
          <button className="btn-secondary" onClick={handleImport}>导入</button>
          <button className="btn-secondary" onClick={handleExport}>导出</button>
          <button className="btn-primary" onClick={handleSave}>保存</button>
          <button className="btn-play" onClick={handlePlay}>开始游戏</button>
        </div>
      </div>

      <div className="editor-toolbar">
        <div className="tool-section">
          <label>地图名称</label>
          <input
            type="text"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            className="map-name-input"
          />
        </div>

        <div className="tool-section">
          <label>尺寸</label>
          <div className="size-inputs">
            <input
              type="number"
              min="16"
              max="128"
              value={mapWidth}
              onChange={(e) => setMapWidth(Math.max(16, Math.min(128, parseInt(e.target.value) || 32)))}
            />
            <span>x</span>
            <input
              type="number"
              min="16"
              max="128"
              value={mapHeight}
              onChange={(e) => setMapHeight(Math.max(16, Math.min(128, parseInt(e.target.value) || 32)))}
            />
          </div>
        </div>

        <div className="tool-section">
          <label>工具</label>
          <div className="tool-buttons">
            <button
              className={`tool-btn ${selectedTool === 'brush' ? 'active' : ''}`}
              onClick={() => setSelectedTool('brush')}
            >
              🖌️ 画笔
            </button>
            <button
              className={`tool-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
              onClick={() => setSelectedTool('eraser')}
            >
              🧹 橡皮擦
            </button>
            <button
              className={`tool-btn ${selectedTool === 'fill' ? 'active' : ''}`}
              onClick={() => setSelectedTool('fill')}
            >
              🪣 填充
            </button>
            <button
              className={`tool-btn ${selectedTool === 'spawn' ? 'active' : ''}`}
              onClick={() => setSelectedTool('spawn')}
            >
              🏁 出生点
            </button>
            <button
              className={`tool-btn ${selectedTool === 'navalSpawn' ? 'active' : ''}`}
              onClick={() => setSelectedTool('navalSpawn')}
            >
              🚢 海军出生点
            </button>
            <button
              className={`tool-btn ${selectedTool === 'resource' ? 'active' : ''}`}
              onClick={() => setSelectedTool('resource')}
            >
              💎 资源点
            </button>
          </div>
        </div>

        {(selectedTool === 'brush' || selectedTool === 'eraser' || selectedTool === 'fill') && (
          <div className="tool-section">
            <label>笔刷大小: {brushSize}</label>
            <input
              type="range"
              min="1"
              max="10"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
            />
          </div>
        )}

        {(selectedTool === 'brush' || selectedTool === 'fill') && (
          <div className="tool-section">
            <label>地形类型</label>
            <div className="terrain-buttons">
              {Object.values(TileType).map((type) => (
                <button
                  key={type}
                  className={`terrain-btn ${selectedBrush === type ? 'active' : ''}`}
                  onClick={() => setSelectedBrush(type)}
                  style={{ backgroundColor: TILE_COLORS[type] }}
                  title={TILE_INFO[type].name}
                >
                  {TILE_INFO[type].name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="tool-section">
          <label>显示</label>
          <div className="toggle-buttons">
            <button
              className={`toggle-btn ${showGrid ? 'active' : ''}`}
              onClick={() => setShowGrid(!showGrid)}
            >
              网格
            </button>
            <button
              className={`toggle-btn ${showOverlay ? 'active' : ''}`}
              onClick={() => setShowOverlay(!showOverlay)}
            >
              通行性
            </button>
          </div>
        </div>

        <div className="tool-section">
          <label>快捷填充</label>
          <div className="fill-buttons">
            {Object.values(TileType).map((type) => (
              <button
                key={type}
                className="fill-btn"
                onClick={() => fillAll(type)}
                style={{ backgroundColor: TILE_COLORS[type] }}
                title={TILE_INFO[type].name}
              />
            ))}
          </div>
        </div>

        <div className="tool-section info">
          {spawnPoints.map((point, index) => (
            <div key={index} className="info-item">
              <span className={`spawn-indicator p${index + 1}`}></span>
              <span>P{index + 1}: ({point.x}, {point.y})</span>
            </div>
          ))}
          {navalSpawnPoints.map((point, index) => (
            <div key={`naval-${index}`} className="info-item">
              <span className="spawn-indicator" style={{ backgroundColor: '#00BFFF' }}></span>
              <span>N{index + 1}: ({point.x}, {point.y})</span>
            </div>
          ))}
          <div className="info-item">
            <span>💎 资源点: {resourceNodes.length}</span>
            <button className="remove-btn" onClick={removeLastResource} disabled={resourceNodes.length === 0}>-</button>
          </div>
        </div>
      </div>

      <div className="editor-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        {hoveredTile && (
          <div className="tile-info-bar">
            {getHoveredTileInfo()}
          </div>
        )}
      </div>

      <div className="editor-legend">
        {Object.values(TileType).map((type) => (
          <div key={type} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: TILE_COLORS[type] }}></span>
            <span>{TILE_INFO[type].name}</span>
            <span className="legend-desc">
              {TILE_INFO[type].walkable ? '可通行' : '不可通行'}
              {TILE_INFO[type].buildable ? ' | 可建造' : ''}
            </span>
          </div>
        ))}
      </div>

      {notification && (
        <div className={`map-editor-notification map-editor-notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {showLoadDialog && (
        <div className="map-editor-dialog-overlay" onClick={() => setShowLoadDialog(false)}>
          <div className="map-editor-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>选择要加载的地图</h3>
            <div className="map-editor-dialog-list">
              {(() => {
                try {
                  const savedMaps: GameMapData[] = JSON.parse(localStorage.getItem('customMaps') || '[]');
                  return savedMaps.map((m, i) => (
                    <div
                      key={i}
                      className="map-editor-dialog-item"
                      onClick={() => handleLoadMapByIndex(i)}
                    >
                      <span>{i + 1}. {m.name}</span>
                      <span className="map-editor-dialog-item-size">{m.width}x{m.height}</span>
                    </div>
                  ));
                } catch {
                  return <div>无法读取地图列表</div>;
                }
              })()}
            </div>
            <button className="btn-secondary" onClick={() => setShowLoadDialog(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapEditor;
