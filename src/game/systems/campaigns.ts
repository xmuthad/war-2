import { Faction, Difficulty, GameMapData } from '../../types';
import { mapPresets } from '../map/MapPresets';

export interface MissionObjective {
  id: string;
  type: 'primary' | 'secondary' | 'bonus';
  title: string;
  description: string;
  completed: boolean;
  reward?: { credits: number; exp: number };
}

export interface MissionIntel {
  title: string;
  description: string;
  briefing: string;
  objectives: MissionObjective[];
  hints?: string[];
  victoryConditions: string[];
  defeatConditions: string[];
}

export interface MissionRewards {
  credits: number;
  experience: number;
  unlockUnits?: string[];
  unlockBuildings?: string[];
  unlockAbilities?: string[];
}

export interface CampaignMission {
  id: string;
  campaign: CampaignId;
  name: string;
  description: string;
  difficulty: Difficulty;
  faction: Faction;
  map: GameMapData;
  intel: MissionIntel;
  rewards: MissionRewards;
  prerequisites: string[];
  timeLimit?: number;
  parTime?: number;
}

export type CampaignId = 
  | 'allied1' | 'allied2' | 'allied3' | 'allied4' | 'allied5'
  | 'soviet1' | 'soviet2' | 'soviet3' | 'soviet4' | 'soviet5'
  | 'bonus1' | 'bonus2' | 'bonus3';

export interface Campaign {
  id: CampaignId;
  name: string;
  description: string;
  faction: Faction;
  factionName: string;
  missions: string[];
  totalMissions: number;
  completedMissions: number;
  unlocked: boolean;
  icon: string;
}

export interface CampaignProgress {
  campaignId: CampaignId;
  completedMissions: string[];
  currentMission?: string;
  totalScore: number;
  bestTimes: Record<string, number>;
  unlocked: boolean;
  lastPlayed?: number;
}

export interface SaveGame {
  id: string;
  name: string;
  missionId: string;
  campaignId: CampaignId;
  timestamp: number;
  playTime: number;
  difficulty: Difficulty;
  screenshot?: string;
}

export const CAMPAIGN_CAMPAIGNS: Record<CampaignId, Campaign> = {
  allied1: {
    id: 'allied1',
    name: '黎明行动',
    description: '盟军第一幕：反击的开始',
    faction: Faction.USA,
    factionName: '美国',
    missions: ['allied1_1', 'allied1_2', 'allied1_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: true,
    icon: '🇺🇸'
  },
  allied2: {
    id: 'allied2',
    name: '不列颠风暴',
    description: '盟军第二幕：解放英国',
    faction: Faction.BRITAIN,
    factionName: '英国',
    missions: ['allied2_1', 'allied2_2', 'allied2_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '🇬🇧'
  },
  allied3: {
    id: 'allied3',
    name: '铁幕攻势',
    description: '盟军第三幕：对抗铁幕',
    faction: Faction.GERMANY,
    factionName: '德国',
    missions: ['allied3_1', 'allied3_2', 'allied3_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '🇩🇪'
  },
  allied4: {
    id: 'allied4',
    name: '自由钟声',
    description: '盟军第四幕：决战时刻',
    faction: Faction.FRANCE,
    factionName: '法国',
    missions: ['allied4_1', 'allied4_2', 'allied4_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '🇫🇷'
  },
  allied5: {
    id: 'allied5',
    name: '胜利之路',
    description: '盟军第五幕：最终胜利',
    faction: Faction.KOREA,
    factionName: '韩国',
    missions: ['allied5_1', 'allied5_2', 'allied5_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '🇰🇷'
  },
  soviet1: {
    id: 'soviet1',
    name: '红色黎明',
    description: '苏联第一幕：扩张势力',
    faction: Faction.SOVIET,
    factionName: '苏联',
    missions: ['soviet1_1', 'soviet1_2', 'soviet1_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: true,
    icon: '☭'
  },
  soviet2: {
    id: 'soviet2',
    name: '加勒比危机',
    description: '苏联第二幕：加勒比海战略',
    faction: Faction.CUBA,
    factionName: '古巴',
    missions: ['soviet2_1', 'soviet2_2', 'soviet2_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '🏴'
  },
  soviet3: {
    id: 'soviet3',
    name: '沙漠之怒',
    description: '苏联第三幕：控制石油',
    faction: Faction.LIBYA,
    factionName: '利比亚',
    missions: ['soviet3_1', 'soviet3_2', 'soviet3_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '🏜️'
  },
  soviet4: {
    id: 'soviet4',
    name: '中东风暴',
    description: '苏联第四幕：中东局势',
    faction: Faction.IRAQ,
    factionName: '伊拉克',
    missions: ['soviet4_1', 'soviet4_2', 'soviet4_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '🌙'
  },
  soviet5: {
    id: 'soviet5',
    name: '世界革命',
    description: '苏联第五幕：全球统治',
    faction: Faction.SOVIET,
    factionName: '苏联',
    missions: ['soviet5_1', 'soviet5_2', 'soviet5_3'],
    totalMissions: 3,
    completedMissions: 0,
    unlocked: false,
    icon: '⭐'
  },
  bonus1: {
    id: 'bonus1',
    name: '特殊行动',
    description: '隐藏任务包',
    faction: Faction.USA,
    factionName: '盟军',
    missions: ['bonus1_1', 'bonus1_2'],
    totalMissions: 2,
    completedMissions: 0,
    unlocked: false,
    icon: '🔒'
  },
  bonus2: {
    id: 'bonus2',
    name: '残酷挑战',
    description: '高难度挑战任务',
    faction: Faction.SOVIET,
    factionName: '苏联',
    missions: ['bonus2_1', 'bonus2_2'],
    totalMissions: 2,
    completedMissions: 0,
    unlocked: false,
    icon: '💀'
  },
  bonus3: {
    id: 'bonus3',
    name: '阵营对决',
    description: '盟军vs苏联史诗战役',
    faction: Faction.USA,
    factionName: '混合',
    missions: ['bonus3_1'],
    totalMissions: 1,
    completedMissions: 0,
    unlocked: false,
    icon: '⚔️'
  }
};

export function createDefaultCampaignProgress(): Record<CampaignId, CampaignProgress> {
  const progress: Partial<Record<CampaignId, CampaignProgress>> = {};
  
  Object.values(CAMPAIGN_CAMPAIGNS).forEach(campaign => {
    progress[campaign.id] = {
      campaignId: campaign.id,
      completedMissions: [],
      totalScore: 0,
      bestTimes: {},
      unlocked: campaign.id === 'allied1' || campaign.id === 'soviet1'
    };
  });
  
  return progress as Record<CampaignId, CampaignProgress>;
}

export function unlockCampaign(
  progress: Record<CampaignId, CampaignProgress>,
  campaignId: CampaignId
): Record<CampaignId, CampaignProgress> {
  const newProgress = { ...progress };
  if (newProgress[campaignId]) {
    newProgress[campaignId] = { ...newProgress[campaignId], unlocked: true };
  }
  return newProgress;
}

export function completeMission(
  progress: Record<CampaignId, CampaignProgress>,
  campaignId: CampaignId,
  missionId: string,
  score: number = 0,
  time: number = 0
): Record<CampaignId, CampaignProgress> {
  const newProgress = { ...progress };
  const campaign = newProgress[campaignId];
  
  if (campaign) {
    if (!campaign.completedMissions.includes(missionId)) {
      campaign.completedMissions.push(missionId);
    }
    campaign.totalScore += score;
    
    if (!campaign.bestTimes[missionId] || time < campaign.bestTimes[missionId]) {
      campaign.bestTimes[missionId] = time;
    }
    
    const nextCampaignIndex = Object.keys(CAMPAIGN_CAMPAIGNS).indexOf(campaignId) + 1;
    const nextCampaignId = Object.keys(CAMPAIGN_CAMPAIGNS)[nextCampaignIndex] as CampaignId;
    if (nextCampaignId && !newProgress[nextCampaignId]?.unlocked) {
      newProgress[nextCampaignId] = { 
        ...newProgress[nextCampaignId], 
        unlocked: true 
      };
    }
  }
  
  return newProgress;
}

export function isCampaignCompleted(
  progress: Record<CampaignId, CampaignProgress>,
  campaignId: CampaignId
): boolean {
  const campaign = CAMPAIGN_CAMPAIGNS[campaignId];
  const campaignProgress = progress[campaignId];
  
  return campaignProgress?.completedMissions.length === campaign.totalMissions;
}

export function getCampaignCompletionPercent(
  progress: Record<CampaignId, CampaignProgress>,
  campaignId: CampaignId
): number {
  const campaign = CAMPAIGN_CAMPAIGNS[campaignId];
  const campaignProgress = progress[campaignId];

  if (!campaignProgress) return 0;
  return Math.round((campaignProgress.completedMissions.length / campaign.totalMissions) * 100);
}

const CAMPAIGN_MAP_PRESETS: Record<string, string[]> = {
  allied1: ['standard', 'river', 'urban'],
  allied2: ['river', 'standard', 'islands'],
  allied3: ['urban', 'standard', 'river'],
  allied4: ['standard', 'urban', 'river'],
  allied5: ['islands', 'standard', 'river'],
  soviet1: ['ice', 'desert', 'standard'],
  soviet2: ['islands', 'desert', 'ice'],
  soviet3: ['desert', 'ice', 'standard'],
  soviet4: ['desert', 'standard', 'ice'],
  soviet5: ['standard', 'ice', 'desert'],
  bonus1: ['urban', 'river'],
  bonus2: ['ice', 'desert'],
  bonus3: ['river'],
};

function getMapForCampaign(campaignId: string, missionIndex: number): GameMapData {
  const presetIds = CAMPAIGN_MAP_PRESETS[campaignId] || ['standard'];
  const presetId = presetIds[missionIndex % presetIds.length];
  const preset = mapPresets.find(p => p.id === presetId) || mapPresets[0];
  return preset.createMap(preset.width, preset.height);
}

export function campaignToMission(
  campaign: { id: string; name: string; description: string; faction: Faction; factionName: string },
  missionId: string,
  missionIndex: number
): CampaignMission {
  const missionNumber = missionIndex + 1;
  const mapData = getMapForCampaign(campaign.id, missionIndex);

  return {
    id: missionId,
    campaign: campaign.id as CampaignId,
    name: `${campaign.name} - 任务${missionNumber}`,
    description: `${campaign.description}：第${missionNumber}个任务`,
    difficulty: 'normal' as Difficulty,
    faction: campaign.faction,
    map: {
      ...mapData,
      id: missionId,
      name: `${campaign.name} - 地图${missionNumber}`,
    },
    intel: {
      title: `${campaign.name} - 任务${missionNumber}`,
      description: `在${campaign.name}中的第${missionNumber}个任务`,
      briefing: `指挥部已部署到${campaign.factionName}的前线基地。\n\n根据情报，敌人在该区域有重要据点。\n\n你的任务是清除威胁并建立防线。\n\n小心行事，指挥官。`,
      objectives: [
        { id: 'primary1', type: 'primary', title: '摧毁敌方基地', description: '消灭所有敌方建筑和单位', completed: false },
        { id: 'secondary1', type: 'secondary', title: '保护己方指挥中心', description: '确保指挥中心存活', completed: false },
        { id: 'bonus1', type: 'bonus', title: '时间挑战', description: '在5分钟内完成任务', reward: { credits: 500, exp: 200 }, completed: false }
      ],
      victoryConditions: ['摧毁所有敌方建筑', '至少有一个己方建筑存活'],
      defeatConditions: ['己方指挥中心被摧毁']
    },
    rewards: { credits: 2000, experience: 500, unlockUnits: [], unlockBuildings: [], unlockAbilities: [] },
    prerequisites: [],
    parTime: 300
  };
}
