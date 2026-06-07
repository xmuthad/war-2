import { GameMapData, Tile, TileType, ResourceNode, Vector2 } from '../../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const createDefaultMap = (width: number = 64, height: number = 64): GameMapData => {
  const tiles: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = {
        type: TileType.GRASS,
        walkable: true,
        buildable: true,
        movementCost: 1,
      };
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < 0.1) {
        tiles[y][x].type = TileType.FOREST;
        tiles[y][x].movementCost = 1.5;
      }

      if (Math.random() < 0.02 && y > 5 && y < height - 5) {
        tiles[y][x].type = TileType.WATER;
        tiles[y][x].walkable = false;
        tiles[y][x].buildable = false;
        tiles[y][x].movementCost = 99;

        if (y > 0) tiles[y - 1][x].type = TileType.WATER;
        if (y < height - 1) tiles[y + 1][x].type = TileType.WATER;
      }

      if (Math.random() < 0.03) {
        tiles[y][x].type = TileType.MOUNTAIN;
        tiles[y][x].walkable = true;
        tiles[y][x].buildable = false;
        tiles[y][x].movementCost = 2;
      }
    }
  }

  const resourceNodes: ResourceNode[] = [];

  for (let i = 0; i < 20; i++) {
    let rx, ry;
    do {
      rx = Math.floor(Math.random() * (width - 10)) + 5;
      ry = Math.floor(Math.random() * (height - 10)) + 5;
    } while (
      (rx < 15 && ry < 15) ||
      (rx > width - 15 && ry > height - 15) ||
      tiles[ry][rx].type === TileType.WATER
    );

    const tileX = Math.floor(rx / 2) * 2;
    const tileY = Math.floor(ry / 2) * 2;

    if (tiles[tileY] && tiles[tileY][tileX]) {
      tiles[tileY][tileX].type = TileType.ORE;
      tiles[tileY][tileX].buildable = false;

      if (tileY + 1 < height) tiles[tileY + 1][tileX].type = TileType.ORE;
      if (tileX + 1 < width) tiles[tileY][tileX + 1].type = TileType.ORE;
      if (tileY + 1 < height && tileX + 1 < width) {
        tiles[tileY + 1][tileX + 1].type = TileType.ORE;
      }
    }

    resourceNodes.push({
      id: generateId(),
      position: { x: tileX, y: tileY },
      amount: 1000 + Math.floor(Math.random() * 1000),
      maxAmount: 2000,
    });
  }

  for (let y = 3; y < 8; y++) {
    for (let x = 3; x < 8; x++) {
      tiles[y][x].type = TileType.GRASS;
      tiles[y][x].walkable = true;
      tiles[y][x].buildable = true;
    }
  }

  for (let y = height - 8; y < height - 3; y++) {
    for (let x = width - 8; x < width - 3; x++) {
      tiles[y][x].type = TileType.GRASS;
      tiles[y][x].walkable = true;
      tiles[y][x].buildable = true;
    }
  }

  const spawnPoints: Vector2[] = [
    { x: 5, y: 5 },
    { x: width - 9, y: height - 9 },
  ];

  return {
    id: generateId(),
    name: '标准地图',
    width,
    height,
    tiles,
    spawnPoints,
    resourceNodes,
  };
};

export const createSmallMap = (): GameMapData => {
  return createDefaultMap(32, 32);
};

export const createLargeMap = (): GameMapData => {
  return createDefaultMap(128, 128);
};
