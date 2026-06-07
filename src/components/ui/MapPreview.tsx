import React, { useRef, useEffect } from 'react';
import { GameMapData, TileType } from '../../types';
import { TERRAIN_COLORS } from '../../game/render/PhaserConfig';

interface MapPreviewProps {
  mapData: GameMapData;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Renders a minimap preview using canvas for the menu selection screen.
 * Shows terrain colors for different tile types.
 */
export const MapPreview: React.FC<MapPreviewProps> = ({ 
  mapData, 
  width = 120, 
  height = 120,
  className 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const { tiles, width: mapWidth, height: mapHeight } = mapData;
    
    // Calculate tile size to fit the preview
    const tileW = width / mapWidth;
    const tileH = height / mapHeight;
    const tileSize = Math.min(tileW, tileH);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw terrain tiles
    for (let y = 0; y < mapHeight; y++) {
      const row = tiles[y];
      if (!row) continue;

      for (let x = 0; x < mapWidth; x++) {
        const tile = row[x];
        const tileType = tile?.type;
        const color = TERRAIN_COLORS[tileType ?? TileType.GRASS] || TERRAIN_COLORS[TileType.GRASS];
        
        // Convert hex color to CSS color string
        const colorStr = `#${color.toString(16).padStart(6, '0')}`;
        
        ctx.fillStyle = colorStr;
        ctx.fillRect(
          x * tileSize,
          y * tileSize,
          tileSize + 1,  // +1 to avoid gaps
          tileSize + 1
        );
      }
    }

    // Draw resource nodes if present
    if (mapData.resourceNodes && mapData.resourceNodes.length > 0) {
      ctx.fillStyle = '#FFD700';
      for (const node of mapData.resourceNodes) {
        ctx.beginPath();
        ctx.arc(
          node.position.x * tileSize + tileSize / 2,
          node.position.y * tileSize + tileSize / 2,
          tileSize * 0.8,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Draw spawn points
    if (mapData.spawnPoints && mapData.spawnPoints.length > 0) {
      for (const spawn of mapData.spawnPoints) {
        ctx.fillStyle = spawn === mapData.spawnPoints[0] ? '#00FF00' : '#FF0000';
        ctx.fillRect(
          spawn.x * tileSize,
          spawn.y * tileSize,
          tileSize * 3,
          tileSize * 3
        );
      }
    }

  }, [mapData, width, height]);

  return (
    <canvas 
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        imageRendering: 'pixelated'
      }}
    />
  );
};
