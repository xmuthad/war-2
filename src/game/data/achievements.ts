import { PlayerStatistics } from '../../types';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: PlayerStatistics) => boolean;
  hidden?: boolean;
  category?: 'combat' | 'economy' | 'building' | 'campaign' | 'faction' | 'survival';
  factionRequired?: 'allied' | 'soviet';
}

export const ACHIEVEMENTS: Achievement[] = [
  // 战斗成就
  { id: 'first_blood', name: '初战告捷', description: '消灭第一个敌方单位', icon: '🎯', condition: (s) => s.enemiesDestroyed >= 1, category: 'combat' },
  { id: 'warrior', name: '战士', description: '消灭10个敌方单位', icon: '⚔️', condition: (s) => s.enemiesDestroyed >= 10, category: 'combat' },
  { id: 'conqueror', name: '征服者', description: '消灭50个敌方单位', icon: '👑', condition: (s) => s.enemiesDestroyed >= 50, category: 'combat' },
  // 建筑成就
  { id: 'builder', name: '建设者', description: '建造5座建筑', icon: '🏗️', condition: (s) => s.buildingsBuilt >= 5, category: 'building' },
  { id: 'architect', name: '建筑师', description: '建造20座建筑', icon: '🏛️', condition: (s) => s.buildingsBuilt >= 20, category: 'building' },
  // 经济成就
  { id: 'tycoon', name: '大亨', description: '累计采集10000矿石', icon: '💰', condition: (s) => s.resourcesGathered >= 10000, category: 'economy' },
  // 生产成就
  { id: 'commander', name: '指挥官', description: '生产20个单位', icon: '🎖️', condition: (s) => s.unitsProduced >= 20, category: 'combat' },
  { id: 'general', name: '将军', description: '生产100个单位', icon: '⭐', condition: (s) => s.unitsProduced >= 100, category: 'combat' },
  // 生存成就
  { id: 'survivor', name: '幸存者', description: '损失50个单位', icon: '🛡️', condition: (s) => s.unitsLost >= 50, category: 'survival' },
  { id: 'iron_will', name: '钢铁意志', description: '损失20座建筑', icon: '🔥', condition: (s) => s.buildingsLost >= 20, category: 'survival' },

  // 隐藏成就
  { id: 'blitzkrieg', name: '闪电战', description: '消灭100个敌方单位', icon: '⚡', condition: (s) => s.enemiesDestroyed >= 100, hidden: true, category: 'combat' },
  { id: 'fortress', name: '铁壁', description: '建造50座建筑', icon: '🏰', condition: (s) => s.buildingsBuilt >= 50, hidden: true, category: 'building' },
  { id: 'mogul', name: '巨头', description: '累计采集100000矿石', icon: '💎', condition: (s) => s.resourcesGathered >= 100000, hidden: true, category: 'economy' },
  { id: 'war_lord', name: '军阀', description: '生产500个单位', icon: '🗡️', condition: (s) => s.unitsProduced >= 500, hidden: true, category: 'combat' },
  { id: 'phoenix', name: '凤凰', description: '损失200个单位后仍获胜', icon: '🔥', condition: (s) => s.unitsLost >= 200, hidden: true, category: 'survival' },

  // 战役成就
  { id: 'campaign_rookie', name: '新兵入伍', description: '完成第一个战役任务', icon: '📜', condition: (s) => s.enemiesDestroyed >= 1 && s.buildingsBuilt >= 1, category: 'campaign' },
  { id: 'campaign_veteran', name: '沙场老兵', description: '消灭200个敌方单位', icon: '🏅', condition: (s) => s.enemiesDestroyed >= 200, category: 'campaign' },
  { id: 'campaign_hero', name: '战争英雄', description: '消灭500个敌方单位', icon: '🏆', condition: (s) => s.enemiesDestroyed >= 500, category: 'campaign' },

  // 阵营专属成就
  { id: 'allied_pride', name: '盟军之荣', description: '作为盟军消灭100个敌方单位', icon: '🦅', condition: (s) => s.enemiesDestroyed >= 100, category: 'faction', factionRequired: 'allied' },
  { id: 'soviet_might', name: '苏维埃之力', description: '作为苏军消灭100个敌方单位', icon: '🔨', condition: (s) => s.enemiesDestroyed >= 100, category: 'faction', factionRequired: 'soviet' },
  { id: 'air_supremacy', name: '制空权', description: '生产30个单位', icon: '✈️', condition: (s) => s.unitsProduced >= 30, category: 'faction', factionRequired: 'allied' },
  { id: 'armor_division', name: '装甲师', description: '生产50个单位', icon: '🪖', condition: (s) => s.unitsProduced >= 50, category: 'faction', factionRequired: 'soviet' },

  // 经济成就（扩展）
  { id: 'resource_hoarder', name: '囤积者', description: '累计采集50000矿石', icon: '🏦', condition: (s) => s.resourcesGathered >= 50000, category: 'economy' },
  { id: 'efficient_economy', name: '经济大师', description: '累计采集25000矿石且损失少于10座建筑', icon: '📊', condition: (s) => s.resourcesGathered >= 25000 && s.buildingsLost < 10, category: 'economy' },

  // 生存成就（扩展）
  { id: 'last_stand', name: '最后的防线', description: '损失100个单位但仍在战斗', icon: '⚔️', condition: (s) => s.unitsLost >= 100, category: 'survival' },
  { id: 'untouchable', name: '金身不破', description: '损失少于5个单位且消灭20个敌人', icon: '✨', condition: (s) => s.unitsLost < 5 && s.enemiesDestroyed >= 20, category: 'survival' },
];

export const ACHIEVEMENT_KEY = 'ra2_achievements';

export function loadUnlockedAchievements(): string[] {
  try {
    const saved = localStorage.getItem(ACHIEVEMENT_KEY);
    if (saved) return JSON.parse(saved) as string[];
  } catch {
    // ignore
  }
  return [];
}

export function saveUnlockedAchievements(ids: string[]): void {
  try {
    localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}
