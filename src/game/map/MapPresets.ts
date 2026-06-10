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

  // Bridge 1: center of the map
  for (let y = Math.floor(height / 2) - 1; y <= Math.floor(height / 2) + 1; y++) {
    const bridgeX = riverCenterX + Math.floor(Math.sin(y * 0.3) * 2);
    if (bridgeX >= 0 && bridgeX < width) {
      tiles[y][bridgeX] = makeTile(TileType.BRIDGE);
    }
  }

  // Bridge 2: upper quarter of the map
  const bridge2Y = Math.floor(height / 4);
  for (let y = bridge2Y - 1; y <= bridge2Y + 1; y++) {
    const bridgeX = riverCenterX + Math.floor(Math.sin(y * 0.3) * 2);
    if (bridgeX >= 0 && bridgeX < width && y >= 0 && y < height) {
      tiles[y][bridgeX] = makeTile(TileType.BRIDGE);
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

  const spawn1 = { x: Math.floor(width / 4) - 2, y: Math.floor(height / 4) - 2 };
  const spawn2 = { x: Math.floor(width * 3 / 4) - 2, y: Math.floor(height * 3 / 4) - 2 };

  // Ensure water tiles near each spawn point so naval buildings (shipyard) can be placed.
  // Place water along the island edge closest to the map center for each spawn.
  for (const spawn of [spawn1, spawn2]) {
    const islandCx = spawn.x + 2;
    const islandCy = spawn.y + 2;
    // Find the edge of the island in the direction toward the map center
    const mapCx = width / 2;
    const mapCy = height / 2;
    const dx = mapCx - islandCx;
    const dy = mapCy - islandCy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ndx = len > 0 ? dx / len : 1;
    const ndy = len > 0 ? dy / len : 0;

    // Walk from spawn toward map center to find the coast, then add a water strip
    for (let step = 3; step < islandRadius + 4; step++) {
      const cx = Math.floor(islandCx + ndx * step);
      const cy = Math.floor(islandCy + ndy * step);
      if (cx >= 0 && cx < width && cy >= 0 && cy < height && tiles[cy][cx].type === TileType.WATER) {
        // Found water — ensure a 2x3 water patch here for shipyard placement
        for (let wy = -1; wy <= 1; wy++) {
          for (let wx = 0; wx <= 1; wx++) {
            const nx = cx + wx;
            const ny = cy + wy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              tiles[ny][nx] = makeTile(TileType.WATER);
            }
          }
        }
        break;
      }
    }
  }

  return {
    id: generateId(),
    name: '岛屿地图',
    width,
    height,
    tiles,
    spawnPoints: [spawn1, spawn2],
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

function createBayMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  // Create a large bay in the center
  const bayCenterX = Math.floor(width / 2);
  const bayCenterY = Math.floor(height / 2);
  const bayRadiusX = Math.floor(width * 0.3);
  const bayRadiusY = Math.floor(height * 0.25);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - bayCenterX) / bayRadiusX;
      const dy = (y - bayCenterY) / bayRadiusY;
      const dist = dx * dx + dy * dy;
      if (dist < 1.0) {
        tiles[y][x] = makeTile(TileType.WATER);
      } else if (dist < 1.15) {
        // Sandy shoreline around the bay
        tiles[y][x] = makeTile(TileType.SAND);
      }
    }
  }

  // Open the bay to the south (water passage)
  for (let y = bayCenterY + Math.floor(bayRadiusY * 0.6); y < height; y++) {
    const halfWidth = Math.max(2, Math.floor(bayRadiusX * 0.3 * (1 - (y - bayCenterY) / (height - bayCenterY))));
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const x = bayCenterX + dx;
      if (x >= 0 && x < width) {
        tiles[y][x] = makeTile(TileType.WATER);
      }
    }
  }

  // Add forests on left landmass
  for (let y = 5; y < height - 5; y++) {
    for (let x = 3; x < bayCenterX - bayRadiusX - 2; x++) {
      if (Math.random() < 0.15) {
        tiles[y][x] = makeTile(TileType.FOREST);
      }
    }
  }

  // Add forests on right landmass
  for (let y = 5; y < height - 5; y++) {
    for (let x = bayCenterX + bayRadiusX + 2; x < width - 3; x++) {
      if (Math.random() < 0.15) {
        tiles[y][x] = makeTile(TileType.FOREST);
      }
    }
  }

  // Add some sand patches on both landmasses
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].type === TileType.GRASS && Math.random() < 0.03) {
        tiles[y][x] = makeTile(TileType.SAND);
      }
    }
  }

  // Bridge connecting the two landmasses (north side of the bay)
  const bridgeY = bayCenterY - Math.floor(bayRadiusY * 0.8);
  for (let x = bayCenterX - bayRadiusX - 1; x <= bayCenterX + bayRadiusX + 1; x++) {
    if (x >= 0 && x < width && bridgeY >= 0 && bridgeY < height) {
      if (tiles[bridgeY][x].type === TileType.WATER || tiles[bridgeY][x].type === TileType.SAND) {
        tiles[bridgeY][x] = makeTile(TileType.BRIDGE);
      }
    }
  }

  // Bridge on the south passage
  const southBridgeY = bayCenterY + Math.floor(bayRadiusY * 0.8);
  for (let x = bayCenterX - 3; x <= bayCenterX + 3; x++) {
    if (x >= 0 && x < width && southBridgeY >= 0 && southBridgeY < height) {
      if (tiles[southBridgeY][x].type === TileType.WATER) {
        tiles[southBridgeY][x] = makeTile(TileType.BRIDGE);
      }
    }
  }

  // Resource nodes on left landmass
  const resourceNodes: ResourceNode[] = [];
  const leftResources = [
    { x: 8, y: 10 },
    { x: 12, y: 20 },
    { x: 6, y: 35 },
    { x: 15, y: 50 },
    { x: 10, y: 55 },
  ];
  leftResources.forEach(({ x, y }) => {
    if (x >= 0 && x < width && y >= 0 && y < height && tiles[y][x].type !== TileType.WATER) {
      tiles[y][x] = makeTile(TileType.ORE);
      if (x + 1 < width && tiles[y][x + 1].type !== TileType.WATER) tiles[y][x + 1] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x, y },
        amount: 1200 + Math.floor(Math.random() * 800),
        maxAmount: 2000,
      });
    }
  });

  // Resource nodes on right landmass
  const rightResources = [
    { x: width - 9, y: 10 },
    { x: width - 13, y: 20 },
    { x: width - 7, y: 35 },
    { x: width - 16, y: 50 },
    { x: width - 11, y: 55 },
  ];
  rightResources.forEach(({ x, y }) => {
    if (x >= 0 && x < width && y >= 0 && y < height && tiles[y][x].type !== TileType.WATER) {
      tiles[y][x] = makeTile(TileType.ORE);
      if (x + 1 < width && tiles[y][x + 1].type !== TileType.WATER) tiles[y][x + 1] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x, y },
        amount: 1200 + Math.floor(Math.random() * 800),
        maxAmount: 2000,
      });
    }
  });

  // Clear spawn areas
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }
  for (let y = height - 6; y < height; y++) {
    for (let x = width - 6; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  return {
    id: generateId(),
    name: '海湾地图',
    width,
    height,
    tiles,
    spawnPoints: [
      { x: 3, y: 3 },
      { x: width - 4, y: height - 4 },
    ],
    navalSpawnPoints: [
      { x: bayCenterX - 2, y: bayCenterY },
      { x: bayCenterX + 2, y: bayCenterY },
    ],
    resourceNodes,
  };
}

function createCanalMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  // Two parallel canals running vertically
  const canal1X = Math.floor(width * 0.33);
  const canal2X = Math.floor(width * 0.67);
  const canalWidth = 3;

  for (let y = 0; y < height; y++) {
    for (let dx = -canalWidth; dx <= canalWidth; dx++) {
      // Canal 1 with slight meander
      const x1 = canal1X + dx + Math.floor(Math.sin(y * 0.15) * 1.5);
      if (x1 >= 0 && x1 < width) {
        tiles[y][x1] = makeTile(TileType.WATER);
      }
      // Canal 2 with slight meander (different phase)
      const x2 = canal2X + dx + Math.floor(Math.sin(y * 0.15 + 2) * 1.5);
      if (x2 >= 0 && x2 < width) {
        tiles[y][x2] = makeTile(TileType.WATER);
      }
    }
  }

  // Bridges across Canal 1 at strategic points
  const bridgePositions1 = [
    Math.floor(height * 0.2),
    Math.floor(height * 0.5),
    Math.floor(height * 0.8),
  ];
  for (const bridgeY of bridgePositions1) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = bridgeY + dy;
      if (y >= 0 && y < height) {
        const x = canal1X + Math.floor(Math.sin(y * 0.15) * 1.5);
        if (x >= 0 && x < width) {
          tiles[y][x] = makeTile(TileType.BRIDGE);
        }
      }
    }
  }

  // Bridges across Canal 2
  const bridgePositions2 = [
    Math.floor(height * 0.25),
    Math.floor(height * 0.55),
    Math.floor(height * 0.75),
  ];
  for (const bridgeY of bridgePositions2) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = bridgeY + dy;
      if (y >= 0 && y < height) {
        const x = canal2X + Math.floor(Math.sin(y * 0.15 + 2) * 1.5);
        if (x >= 0 && x < width) {
          tiles[y][x] = makeTile(TileType.BRIDGE);
        }
      }
    }
  }

  // Add forests and mountains on landmasses
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].type === TileType.GRASS) {
        if (Math.random() < 0.12) {
          tiles[y][x] = makeTile(TileType.FOREST);
        } else if (Math.random() < 0.03) {
          tiles[y][x] = makeTile(TileType.MOUNTAIN);
        }
      }
    }
  }

  // Heavy resource distribution across all three landmasses
  const resourceNodes: ResourceNode[] = [];
  const orePositions = [
    // Left landmass
    { x: 5, y: 8 },
    { x: 8, y: 20 },
    { x: 6, y: 32 },
    { x: 10, y: 45 },
    { x: 7, y: 56 },
    // Center landmass
    { x: Math.floor(width * 0.5), y: 8 },
    { x: Math.floor(width * 0.5) - 3, y: 22 },
    { x: Math.floor(width * 0.5) + 2, y: 38 },
    { x: Math.floor(width * 0.5), y: 52 },
    // Right landmass
    { x: width - 6, y: 8 },
    { x: width - 9, y: 20 },
    { x: width - 7, y: 32 },
    { x: width - 11, y: 45 },
    { x: width - 8, y: 56 },
  ];

  orePositions.forEach(({ x, y }) => {
    if (x >= 0 && x < width && y >= 0 && y < height && tiles[y][x].type !== TileType.WATER) {
      tiles[y][x] = makeTile(TileType.ORE);
      if (x + 1 < width && tiles[y][x + 1].type !== TileType.WATER) tiles[y][x + 1] = makeTile(TileType.ORE);
      if (y + 1 < height && tiles[y + 1][x].type !== TileType.WATER) tiles[y + 1][x] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x, y },
        amount: 1000 + Math.floor(Math.random() * 1000),
        maxAmount: 2000,
      });
    }
  });

  // Clear spawn areas (4 corners)
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }
  for (let y = 0; y < 5; y++) {
    for (let x = width - 5; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }
  for (let y = height - 5; y < height; y++) {
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
    name: '运河地图',
    width,
    height,
    tiles,
    spawnPoints: [
      { x: 3, y: 3 },
      { x: width - 4, y: 3 },
      { x: 3, y: height - 4 },
      { x: width - 4, y: height - 4 },
    ],
    resourceNodes,
  };
}

function createTournamentMap(width: number, height: number): GameMapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = makeTile(TileType.GRASS);
    }
  }

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  // Symmetric chokepoints with forest/mountain
  // North chokepoint
  for (let y = centerY - 8; y <= centerY - 5; y++) {
    for (let x = centerX - 3; x <= centerX + 3; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles[y][x] = makeTile(TileType.FOREST);
      }
    }
  }
  // South chokepoint
  for (let y = centerY + 5; y <= centerY + 8; y++) {
    for (let x = centerX - 3; x <= centerX + 3; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles[y][x] = makeTile(TileType.FOREST);
      }
    }
  }
  // West chokepoint
  for (let x = centerX - 8; x <= centerX - 5; x++) {
    for (let y = centerY - 3; y <= centerY + 3; y++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles[y][x] = makeTile(TileType.MOUNTAIN);
      }
    }
  }
  // East chokepoint
  for (let x = centerX + 5; x <= centerX + 8; x++) {
    for (let y = centerY - 3; y <= centerY + 3; y++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles[y][x] = makeTile(TileType.MOUNTAIN);
      }
    }
  }

  // Symmetric forest patches (mirror-image)
  const forestPositions = [
    // Top-left forests (mirrored to bottom-right)
    { x: 8, y: 8 }, { x: 12, y: 6 }, { x: 6, y: 14 },
    { x: 15, y: 12 }, { x: 10, y: 18 },
  ];
  forestPositions.forEach(({ x, y }) => {
    // Top-left
    if (x < width && y < height) tiles[y][x] = makeTile(TileType.FOREST);
    // Bottom-right mirror
    const mx = width - 1 - x;
    const my = height - 1 - y;
    if (mx >= 0 && my >= 0) tiles[my][mx] = makeTile(TileType.FOREST);
  });

  // Symmetric mountain patches
  const mountainPositions = [
    { x: 18, y: 8 }, { x: 8, y: 20 },
  ];
  mountainPositions.forEach(({ x, y }) => {
    if (x < width && y < height) tiles[y][x] = makeTile(TileType.MOUNTAIN);
    const mx = width - 1 - x;
    const my = height - 1 - y;
    if (mx >= 0 && my >= 0) tiles[my][mx] = makeTile(TileType.MOUNTAIN);
  });

  // Central resource field
  const resourceNodes: ResourceNode[] = [];
  const centralOrePositions = [
    { x: centerX - 2, y: centerY - 2 },
    { x: centerX, y: centerY - 2 },
    { x: centerX + 1, y: centerY - 1 },
    { x: centerX - 2, y: centerY },
    { x: centerX, y: centerY },
    { x: centerX + 1, y: centerY + 1 },
    { x: centerX - 1, y: centerY + 1 },
    { x: centerX - 2, y: centerY + 2 },
  ];
  centralOrePositions.forEach(({ x, y }) => {
    if (x >= 0 && x < width && y >= 0 && y < height && tiles[y][x].type !== TileType.FOREST && tiles[y][x].type !== TileType.MOUNTAIN) {
      tiles[y][x] = makeTile(TileType.ORE);
    }
  });
  resourceNodes.push({
    id: generateId(),
    position: { x: centerX - 2, y: centerY - 2 },
    amount: 2000 + Math.floor(Math.random() * 1000),
    maxAmount: 3000,
  });

  // Mirror-image resource nodes near each starting position
  const startResources = [
    { x: 6, y: 6 }, { x: 10, y: 4 }, { x: 4, y: 10 },
  ];
  startResources.forEach(({ x, y }) => {
    // Top-left resources
    if (x >= 0 && x < width && y >= 0 && y < height && tiles[y][x].type === TileType.GRASS) {
      tiles[y][x] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x, y },
        amount: 1500 + Math.floor(Math.random() * 500),
        maxAmount: 2000,
      });
    }
    // Bottom-right mirror resources
    const mx = width - 1 - x;
    const my = height - 1 - y;
    if (mx >= 0 && mx < width && my >= 0 && my < height && tiles[my][mx].type === TileType.GRASS) {
      tiles[my][mx] = makeTile(TileType.ORE);
      resourceNodes.push({
        id: generateId(),
        position: { x: mx, y: my },
        amount: 1500 + Math.floor(Math.random() * 500),
        maxAmount: 2000,
      });
    }
  });

  // Clear spawn areas (opposite corners)
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
    name: '竞技地图',
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
  {
    id: 'bay',
    name: '海湾地图',
    description: '中央大型海湾，两块陆地由桥梁连接，适合海陆协同作战',
    size: 'large',
    thumbnail: '/assets/sprites/map-thumbnails/bay.png',
    width: 64,
    height: 64,
    createMap: createBayMap,
  },
  {
    id: 'canal',
    name: '运河地图',
    description: '两条平行运河纵贯地图，三块陆地由桥梁相连，四人对战',
    size: 'large',
    thumbnail: '/assets/sprites/map-thumbnails/canal.png',
    width: 64,
    height: 64,
    createMap: createCanalMap,
  },
  {
    id: 'tournament',
    name: '竞技地图',
    description: '对称竞技布局，中央资源区，镜像起始位置，适合公平对战',
    size: 'small',
    thumbnail: '/assets/sprites/map-thumbnails/tournament.png',
    width: 48,
    height: 48,
    createMap: createTournamentMap,
  },
];
