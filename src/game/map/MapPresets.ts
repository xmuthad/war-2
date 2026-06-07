import { GameMapData, Tile, TileType, ResourceNode } from '../../types';
import { getTileProperties } from './MapManager';

const generateId = () => Math.random().toString(36).substr(2, 9);

function makeTile(type: TileType): Tile {
  const props = getTileProperties(type);
  return { type, ...props };
}

export interface MapPreset {
  id: string;
  name: string;
  description: string;
  size: 'small' | 'medium' | 'large';
  thumbnail: string;
  width: number;
  height: number;
  createMap: (width: number, height: number) => GameMapData;
}

function generateTiles(width: number, height: number, config: {
  waterChance?: number;
  mountainChance?: number;
  forestChance?: number;
  roadChance?: number;
  oreCount?: number;
  sandChance?: number;
  mudChance?: number;
  rubbleChance?: number;
  craterChance?: number;
  iceChance?: number;
  cliffChance?: number;
  spawn1Clear?: number;
  spawn2Clear?: number;
}): Tile[][] {
  const {
    waterChance = 0.02,
    mountainChance = 0.03,
    forestChance = 0.1,
    roadChance: _roadChance = 0,
    oreCount = 20,
    sandChance = 0.03,
    mudChance = 0.02,
    rubbleChance = 0.01,
    craterChance = 0.01,
    iceChance = 0.01,
    cliffChance = 0.01,
    spawn1Clear = 5,
    spawn2Clear = 5,
  } = config;

  const tiles: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rand = Math.random();
      let cumulativeChance = 0;

      cumulativeChance += waterChance;
      if (rand < cumulativeChance && y > 5 && y < height - 5) {
        tiles[y][x] = makeTile(TileType.WATER);
        if (x > 0 && y > 0) tiles[y-1][x] = makeTile(TileType.WATER);
        if (x < width - 1 && y < height - 1) tiles[y+1][x] = makeTile(TileType.WATER);
        continue;
      }

      cumulativeChance += forestChance;
      if (rand < cumulativeChance) {
        tiles[y][x] = makeTile(TileType.FOREST);
        continue;
      }

      cumulativeChance += mountainChance;
      if (rand < cumulativeChance) {
        tiles[y][x] = makeTile(TileType.MOUNTAIN);
        continue;
      }

      cumulativeChance += sandChance;
      if (rand < cumulativeChance) {
        tiles[y][x] = makeTile(TileType.SAND);
        continue;
      }

      cumulativeChance += mudChance;
      if (rand < cumulativeChance) {
        tiles[y][x] = makeTile(TileType.MUD);
        continue;
      }

      cumulativeChance += rubbleChance;
      if (rand < cumulativeChance) {
        tiles[y][x] = makeTile(TileType.RUBBLE);
        continue;
      }

      cumulativeChance += craterChance;
      if (rand < cumulativeChance) {
        tiles[y][x] = makeTile(TileType.CRATER);
        continue;
      }

      cumulativeChance += iceChance;
      if (rand < cumulativeChance) {
        tiles[y][x] = makeTile(TileType.ICE);
        continue;
      }

      cumulativeChance += cliffChance;
      if (rand < cumulativeChance && x > 0 && x < width - 1) {
        tiles[y][x] = makeTile(TileType.CLIFF);
        continue;
      }

      // Default: GRASS (already set in initialization)
    }
  }

  const resourceNodes: ResourceNode[] = [];
  for (let i = 0; i < oreCount; i++) {
    let rx, ry;
    let attempts = 0;
    do {
      rx = Math.floor(Math.random() * (width - 10)) + 5;
      ry = Math.floor(Math.random() * (height - 10)) + 5;
      attempts++;
    } while (
      attempts < 50 && (
        (rx < spawn1Clear && ry < spawn1Clear) ||
        (rx > width - spawn2Clear && ry > height - spawn2Clear) ||
        tiles[ry][rx].type === TileType.WATER
      )
    );

    const tileX = Math.floor(rx / 2) * 2;
    const tileY = Math.floor(ry / 2) * 2;

    if (tiles[tileY] && tiles[tileY][tileX] && tiles[tileY][tileX].type !== TileType.WATER) {
      tiles[tileY][tileX] = makeTile(TileType.ORE);

      if (tileY + 1 < height && tiles[tileY + 1][tileX].type !== TileType.WATER) tiles[tileY + 1][tileX] = makeTile(TileType.ORE);
      if (tileX + 1 < width && tiles[tileY][tileX + 1].type !== TileType.WATER) tiles[tileY][tileX + 1] = makeTile(TileType.ORE);
      if (tileY + 1 < height && tileX + 1 < width && tiles[tileY + 1][tileX + 1].type !== TileType.WATER) {
        tiles[tileY + 1][tileX + 1] = makeTile(TileType.ORE);
      }
    }

    const resourceType = Math.random() < 0.15 ? 'gem' : Math.random() < 0.05 ? 'crate' : 'ore';
    const amountByType: Record<string, number> = {
      ore: 1000 + Math.floor(Math.random() * 1000),
      gem: 800 + Math.floor(Math.random() * 600),
      crate: 300 + Math.floor(Math.random() * 200),
    };

    resourceNodes.push({
      id: generateId(),
      position: { x: tileX, y: tileY },
      amount: amountByType[resourceType],
      maxAmount: resourceType === 'ore' ? 2000 : resourceType === 'gem' ? 1500 : 500,
      resourceType: resourceType as 'ore' | 'gem' | 'crate',
    });
  }

  for (let y = 0; y < spawn1Clear; y++) {
    for (let x = 0; x < spawn1Clear; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  for (let y = height - spawn2Clear; y < height; y++) {
    for (let x = width - spawn2Clear; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  return tiles;
}

function createStandardMap(width: number, height: number): GameMapData {
    const tiles = generateTiles(width, height, {
        oreCount: 35,
        waterChance: 0.03,
        forestChance: 0.15,
        mountainChance: 0.04,
        sandChance: 0.05,
        rubbleChance: 0.02,
        craterChance: 0.01,
        mudChance: 0.02,
        iceChance: 0.01,
        cliffChance: 0.01,
        spawn1Clear: 8,
        spawn2Clear: 8,
    });

    const resourceNodes: ResourceNode[] = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (tiles[y][x].type === TileType.ORE) {
                const existing = resourceNodes.find(r => 
                    Math.abs(r.position.x - x) < 3 && Math.abs(r.position.y - y) < 3
                );
                if (!existing) {
                    resourceNodes.push({
                        id: generateId(),
                        position: { x, y },
                        amount: 1500 + Math.floor(Math.random() * 1000),
                        maxAmount: 2500,
                    });
                }
            }
        }
    }

    return {
        id: generateId(),
        name: '标准地图',
        width,
        height,
        tiles,
        spawnPoints: [
            { x: 5, y: 5 },
            { x: width - 6, y: height - 6 },
        ],
        resourceNodes,
    };
}

function createRiverMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  const riverCenterX = Math.floor(width / 2);
  const riverWidth = 3;
  for (let y = 0; y < height; y++) {
    for (let dx = -riverWidth; dx <= riverWidth; dx++) {
      const x = riverCenterX + dx + Math.floor(Math.sin(y * 0.3) * 2);
      if (x >= 0 && x < width) {
        tiles[y][x] = makeTile(TileType.WATER);
      }
    }
  }

  const resourceNodes: ResourceNode[] = [];
  const orePositions = [
    { x: Math.floor(riverCenterX / 2) - 2, y: Math.floor(height / 4) },
    { x: Math.floor(riverCenterX / 2), y: Math.floor(height / 4) + 2 },
    { x: Math.floor(riverCenterX * 1.5), y: Math.floor(height * 3 / 4) },
    { x: Math.floor(riverCenterX * 1.5) + 2, y: Math.floor(height * 3 / 4) - 2 },
    { x: 8, y: 10 },
    { x: width - 9, y: height - 11 },
    { x: 12, y: 6 },
    { x: width - 13, y: height - 8 },
    { x: 6, y: height / 2 },
    { x: width - 7, y: height / 2 },
    { x: riverCenterX - 6, y: 8 },
    { x: riverCenterX + 5, y: height - 10 },
  ];

  orePositions.forEach(({ x, y }) => {
    if (x >= 0 && x < width && y >= 0 && y < height && tiles[y][x].type !== TileType.WATER) {
      tiles[y][x] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x, y },
        amount: 1000 + Math.floor(Math.random() * 1000),
        maxAmount: 2000,
      });
      if (x + 1 < width && tiles[y][x + 1].type !== TileType.WATER) {
        tiles[y][x + 1] = makeTile(TileType.ORE);
      }
    }
  });

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }
  for (let y = height - 5; y < height; y++) {
    for (let x = width - 5; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  for (let y = Math.floor(height / 2) - 1; y <= Math.floor(height / 2) + 1; y++) {
    const bridgeX = riverCenterX + Math.floor(Math.sin(y * 0.3) * 2);
    if (bridgeX >= 0 && bridgeX < width) {
      tiles[y][bridgeX] = makeTile(TileType.ROAD);
    }
  }

  return {
    id: generateId(),
    name: '河流地图',
    width,
    height,
    tiles,
    spawnPoints: [
      { x: 3, y: 3 },
      { x: width - 4, y: height - 4 },
    ],
    resourceNodes,
  };
}

function createDesertMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.SAND);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < 0.15) {
        tiles[y][x] = makeTile(TileType.MOUNTAIN);
      }

      if (Math.random() < 0.05) {
        tiles[y][x] = makeTile(TileType.RUBBLE);
      }

      if (Math.random() < 0.03 && y > 5 && y < height - 5) {
        const oasisX = x;
        const oasisY = y;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = oasisX + dx;
            const ny = oasisY + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              tiles[ny][nx] = makeTile(TileType.WATER);
            }
          }
        }
      }

      if (Math.random() < 0.02) {
        tiles[y][x] = makeTile(TileType.CRATER);
      }

      if (Math.random() < 0.02) {
        tiles[y][x] = makeTile(TileType.MUD);
      }
    }
  }

  const resourceNodes: ResourceNode[] = [];
  for (let i = 0; i < 25; i++) {
    let rx, ry;
    let attempts = 0;
    do {
      rx = Math.floor(Math.random() * (width - 10)) + 5;
      ry = Math.floor(Math.random() * (height - 10)) + 5;
      attempts++;
    } while (attempts < 50 && (
      (rx < 5 && ry < 5) ||
      (rx > width - 5 && ry > height - 5) ||
      tiles[ry][rx].type === TileType.WATER
    ));

    const tileX = Math.floor(rx / 2) * 2;
    const tileY = Math.floor(ry / 2) * 2;

    if (tiles[tileY] && tiles[tileY][tileX] && tiles[tileY][tileX].type !== TileType.WATER) {
      tiles[tileY][tileX] = makeTile(TileType.ORE);
      if (tileY + 1 < height && tiles[tileY + 1][tileX].type !== TileType.WATER) tiles[tileY + 1][tileX] = makeTile(TileType.ORE);
      if (tileX + 1 < width && tiles[tileY][tileX + 1].type !== TileType.WATER) tiles[tileY][tileX + 1] = makeTile(TileType.ORE);
      if (tileY + 1 < height && tileX + 1 < width && tiles[tileY + 1][tileX + 1].type !== TileType.WATER) {
        tiles[tileY + 1][tileX + 1] = makeTile(TileType.ORE);
      }
      resourceNodes.push({
        id: generateId(),
        position: { x: tileX, y: tileY },
        amount: 1000 + Math.floor(Math.random() * 1000),
        maxAmount: 2000,
      });
    }
  }

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }
  for (let y = height - 5; y < height; y++) {
    for (let x = width - 5; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  return {
    id: generateId(),
    name: '沙漠地图',
    width,
    height,
    tiles,
    spawnPoints: [
      { x: 3, y: 3 },
      { x: width - 4, y: height - 4 },
    ],
    resourceNodes,
  };
}

function createIslandMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.WATER);
    }
  }

  function setTile(x: number, y: number, tile: Tile) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
      tiles[iy][ix] = tile;
    }
  }

  function createIsland(cx: number, cy: number, radius: number) {
    for (let iy = 0; iy < height; iy++) {
      for (let ix = 0; ix < width; ix++) {
        const dist = Math.sqrt((ix - cx) ** 2 + (iy - cy) ** 2);
        if (dist < radius) {
          let newTile: Tile;

          if (dist < radius * 0.4 && Math.random() < 0.3) {
            newTile = makeTile(TileType.ORE);
          } else if (dist > radius * 0.7 && Math.random() < 0.2) {
            newTile = makeTile(TileType.FOREST);
          } else {
            newTile = makeTile(TileType.GRASS);
          }

          setTile(ix, iy, newTile);
        }
      }
    }
  }

  const islandRadius = Math.min(width, height) / 8;
  createIsland(Math.floor(width / 4), Math.floor(height / 4), islandRadius);
  createIsland(Math.floor(width * 3 / 4), Math.floor(height * 3 / 4), islandRadius);
  createIsland(Math.floor(width / 2), Math.floor(height / 2), islandRadius * 0.7);

  const resourceNodes: ResourceNode[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].type === TileType.ORE) {
        resourceNodes.push({
          id: generateId(),
          position: { x, y },
          amount: 800 + Math.floor(Math.random() * 800),
          maxAmount: 1600,
        });
      }
    }
  }

  return {
    id: generateId(),
    name: '岛屿地图',
    width,
    height,
    tiles,
    spawnPoints: [
      { x: Math.floor(width / 4) - 2, y: Math.floor(height / 4) - 2 },
      { x: Math.floor(width * 3 / 4) - 2, y: Math.floor(height * 3 / 4) - 2 },
    ],
    resourceNodes,
  };
}

function createUrbanMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.ROAD);
    }
  }

  for (let by = 3; by < height - 3; by += 6) {
    for (let bx = 3; bx < width - 3; bx += 6) {
      for (let y = by; y < Math.min(by + 4, height - 1); y++) {
        for (let x = bx; x < Math.min(bx + 4, width - 1); x++) {
          if (x === bx && y === by) {
            tiles[y][x] = makeTile(TileType.MOUNTAIN);
          } else {
            tiles[y][x] = makeTile(TileType.GRASS);
          }
        }
      }
    }
  }

  const resourceNodes: ResourceNode[] = [];
  for (let i = 0; i < 16; i++) {
    const rx = Math.floor(Math.random() * (width - 6)) + 3;
    const ry = Math.floor(Math.random() * (height - 6)) + 3;
    if (tiles[ry][rx].type === TileType.GRASS && tiles[ry][rx].buildable) {
      tiles[ry][rx] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x: rx, y: ry },
        amount: 1000 + Math.floor(Math.random() * 1000),
        maxAmount: 2000,
      });
    }
  }

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }
  for (let y = height - 5; y < height; y++) {
    for (let x = width - 5; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  return {
    id: generateId(),
    name: '城市地图',
    width,
    height,
    tiles,
    spawnPoints: [
      { x: 3, y: 3 },
      { x: width - 4, y: height - 4 },
    ],
    resourceNodes,
  };
}

function createIceMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.ICE);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < 0.1) {
        tiles[y][x] = makeTile(TileType.MOUNTAIN);
      }

      if (Math.random() < 0.05) {
        tiles[y][x] = makeTile(TileType.CLIFF);
      }

      if (Math.random() < 0.08) {
        tiles[y][x] = makeTile(TileType.CRATER);
      }
    }
  }

  const resourceNodes: ResourceNode[] = [];
  for (let i = 0; i < 20; i++) {
    let rx, ry;
    let attempts = 0;
    do {
      rx = Math.floor(Math.random() * (width - 6)) + 3;
      ry = Math.floor(Math.random() * (height - 6)) + 3;
      attempts++;
    } while (attempts < 50 && (
      (rx < 5 && ry < 5) ||
      (rx > width - 5 && ry > height - 5) ||
      tiles[ry][rx].type === TileType.CLIFF
    ));

    if (tiles[ry][rx].type === TileType.ICE || tiles[ry][rx].type === TileType.CRATER) {
      tiles[ry][rx] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x: rx, y: ry },
        amount: 1000 + Math.floor(Math.random() * 1000),
        maxAmount: 2000,
      });
    }
  }

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }
  for (let y = height - 5; y < height; y++) {
    for (let x = width - 5; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  return {
    id: generateId(),
    name: '冰原地图',
    width,
    height,
    tiles,
    spawnPoints: [
      { x: 3, y: 3 },
      { x: width - 4, y: height - 4 },
    ],
    resourceNodes,
  };
}

export const mapPresets: MapPreset[] = [
  {
    id: 'standard',
    name: '标准地图',
    description: '经典的对称地形，适合新手练习',
    size: 'medium',
    thumbnail: '/assets/sprites/map-thumbnails/standard.png',
    width: 48,
    height: 48,
    createMap: createStandardMap,
  },
  {
    id: 'river',
    name: '河流地图',
    description: '一条河流贯穿地图中部，需要桥梁通过',
    size: 'medium',
    thumbnail: '/assets/sprites/map-thumbnails/river.png',
    width: 48,
    height: 48,
    createMap: createRiverMap,
  },
  {
    id: 'desert',
    name: '沙漠地图',
    description: '广袤的沙漠地形，散布着绿洲和岩石山丘',
    size: 'large',
    thumbnail: '/assets/sprites/map-thumbnails/desert.png',
    width: 64,
    height: 64,
    createMap: createDesertMap,
  },
  {
    id: 'islands',
    name: '岛屿地图',
    description: '多个岛屿被水域分隔，需要控制海面',
    size: 'medium',
    thumbnail: '/assets/sprites/map-thumbnails/islands.png',
    width: 48,
    height: 48,
    createMap: createIslandMap,
  },
  {
    id: 'urban',
    name: '城市地图',
    description: '密集的城市街区，道路网络四通八达',
    size: 'small',
    thumbnail: '/assets/sprites/map-thumbnails/urban.png',
    width: 32,
    height: 32,
    createMap: createUrbanMap,
  },
  {
    id: 'ice',
    name: '冰原地图',
    description: '寒冷的冰原地形，机动速度更快',
    size: 'medium',
    thumbnail: '/assets/sprites/map-thumbnails/ice.png',
    width: 48,
    height: 48,
    createMap: createIceMap,
  },
];
