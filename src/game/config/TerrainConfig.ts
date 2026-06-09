import { TileType } from '../../types';

export interface TileInfoEntry {
  name: string;
  walkable: boolean;
  buildable: boolean;
  cost: number;
  color: number;
}

export const TILE_INFO: Record<TileType, TileInfoEntry> = {
  [TileType.GRASS]: { name: '草地', walkable: true, buildable: true, cost: 1, color: 0x4a6741 },
  [TileType.WATER]: { name: '水域', walkable: false, buildable: false, cost: 99, color: 0x1e6db8 },
  [TileType.MOUNTAIN]: { name: '山地', walkable: false, buildable: false, cost: 99, color: 0x8b7355 },
  [TileType.FOREST]: { name: '森林', walkable: true, buildable: false, cost: 1.5, color: 0x228b22 },
  [TileType.ROAD]: { name: '道路', walkable: true, buildable: false, cost: 1, color: 0x8b8b8b },
  [TileType.ORE]: { name: '矿石', walkable: false, buildable: false, cost: 99, color: 0xffd700 },
  [TileType.SAND]: { name: '沙地', walkable: true, buildable: true, cost: 1.2, color: 0xc2b280 },
  [TileType.ICE]: { name: '冰原', walkable: true, buildable: true, cost: 0.8, color: 0xadd8e6 },
  [TileType.MUD]: { name: '泥泞', walkable: true, buildable: false, cost: 2, color: 0x5d4037 },
  [TileType.RUBBLE]: { name: '碎石', walkable: true, buildable: false, cost: 1.5, color: 0x757575 },
  [TileType.CRATER]: { name: '弹坑', walkable: true, buildable: false, cost: 1.8, color: 0x3d3d3d },
  [TileType.CLIFF]: { name: '悬崖', walkable: false, buildable: false, cost: 99, color: 0x5d4e37 },
  [TileType.BRIDGE]: { name: '桥梁', walkable: true, buildable: false, cost: 0.8, color: 0xa0826d },
  [TileType.BRIDGE_DESTROYED]: { name: '摧毁的桥梁', walkable: false, buildable: false, cost: 99, color: 0x4a3c31 },
};

export const TERRAIN_COLORS: Record<TileType, number> = Object.fromEntries(
  Object.entries(TILE_INFO).map(([key, info]) => [key, info.color])
) as Record<TileType, number>;
