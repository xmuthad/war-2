import { Faction } from '../../types';

export interface FactionColors {
  primary: number;
  secondary: number;
  accent: number;
  uiPrimary: string;
  uiSecondary: string;
}

const FACTION_COLORS: Record<Faction, FactionColors> = {
  [Faction.USA]: {
    primary: 0x4169E1,
    secondary: 0x6495ED,
    accent: 0x87CEEB,
    uiPrimary: '#4169E1',
    uiSecondary: '#6495ED',
  },
  [Faction.SOVIET]: {
    primary: 0xDC143C,
    secondary: 0xB22222,
    accent: 0xFF6347,
    uiPrimary: '#DC143C',
    uiSecondary: '#B22222',
  },
  [Faction.BRITAIN]: {
    primary: 0x4169E1,
    secondary: 0x6495ED,
    accent: 0x87CEEB,
    uiPrimary: '#4169E1',
    uiSecondary: '#6495ED',
  },
  [Faction.GERMANY]: {
    primary: 0x4169E1,
    secondary: 0x6495ED,
    accent: 0x87CEEB,
    uiPrimary: '#4169E1',
    uiSecondary: '#6495ED',
  },
  [Faction.FRANCE]: {
    primary: 0x4169E1,
    secondary: 0x6495ED,
    accent: 0x87CEEB,
    uiPrimary: '#4169E1',
    uiSecondary: '#6495ED',
  },
  [Faction.KOREA]: {
    primary: 0x4169E1,
    secondary: 0x6495ED,
    accent: 0x87CEEB,
    uiPrimary: '#4169E1',
    uiSecondary: '#6495ED',
  },
  [Faction.CUBA]: {
    primary: 0xDC143C,
    secondary: 0xB22222,
    accent: 0xFF6347,
    uiPrimary: '#DC143C',
    uiSecondary: '#B22222',
  },
  [Faction.LIBYA]: {
    primary: 0xDC143C,
    secondary: 0xB22222,
    accent: 0xFF6347,
    uiPrimary: '#DC143C',
    uiSecondary: '#B22222',
  },
  [Faction.IRAQ]: {
    primary: 0xDC143C,
    secondary: 0xB22222,
    accent: 0xFF6347,
    uiPrimary: '#DC143C',
    uiSecondary: '#B22222',
  },
  [Faction.NEUTRAL]: {
    primary: 0x888888,
    secondary: 0xAAAAAA,
    accent: 0xCCCCCC,
    uiPrimary: '#888888',
    uiSecondary: '#AAAAAA',
  },
};

export function getFactionColors(faction: Faction): FactionColors {
  return FACTION_COLORS[faction] || FACTION_COLORS[Faction.NEUTRAL];
}

export function isAlliedFaction(faction: Faction): boolean {
  return [Faction.USA, Faction.BRITAIN, Faction.GERMANY, Faction.FRANCE, Faction.KOREA].includes(faction);
}

export { FACTION_COLORS };
