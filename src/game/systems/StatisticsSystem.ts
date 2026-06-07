// --- UI Renderer Interface (decouple game logic from Phaser UI) ---

export interface StatisticsUIRenderer {
  create(showDebugInfo: boolean): void;
  setShowDebugInfo(show: boolean): void;
  showDebugInfo(stats: Record<string, number>): void;
  hideDebugInfo(): void;
  dispose(): void;
}

export interface GameStats {
  unitsCreated: number;
  unitsLost: number;
  unitsDestroyed: number;
  buildingsBuilt: number;
  buildingsLost: number;
  buildingsDestroyed: number;
  resourcesGathered: Record<string, number>;
  resourcesSpent: Record<string, number>;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  unitsHealed: number;
  missionsCompleted: number;
  missionsFailed: number;
  playTime: number;
  unitsCurrent: number;
  buildingsCurrent: number;
  resourcesCurrent: Record<string, number>;
}

export interface CombatStats {
  totalKills: number;
  killByUnitType: Record<string, number>;
  killByWeapon: Record<string, number>;
  deaths: number;
  deathByUnitType: Record<string, number>;
  bestKillStreak: number;
  currentKillStreak: number;
  totalDamageDealt: number;
  criticalHits: number;
  dodges: number;
  blocks: number;
}

export interface EconomyStats {
  incomeTotal: Record<string, number>;
  expensesTotal: Record<string, number>;
  netIncome: Record<string, number>;
  peakCredits: number;
  peakResources: Record<string, number>;
  unitsProduced: number;
  upgradesCompleted: number;
}

export interface UnitKillEvent {
  timestamp: number;
  killerId: string;
  killerType: string;
  victimId: string;
  victimType: string;
  weapon: string;
  damage: number;
  position: { x: number; y: number };
}

export class StatisticsSystem {
  private uiRenderer?: StatisticsUIRenderer;
  private gameStats: GameStats;
  private combatStats: CombatStats;
  private economyStats: EconomyStats;
  private recentKills: UnitKillEvent[] = [];
  private maxRecentKills: number = 50;
  private onStatUpdateCallbacks: Set<(stats: GameStats) => void> = new Set();
  private showDebugInfoFlag: boolean = false;

  constructor() {
    this.resetStats();
  }

  setUIRenderer(renderer?: StatisticsUIRenderer): void {
    this.uiRenderer = renderer;
  }

  create(): void {
    this.uiRenderer?.create(this.showDebugInfoFlag);
  }

  private resetStats(): void {
    this.gameStats = {
      unitsCreated: 0,
      unitsLost: 0,
      unitsDestroyed: 0,
      buildingsBuilt: 0,
      buildingsLost: 0,
      buildingsDestroyed: 0,
      resourcesGathered: {},
      resourcesSpent: {},
      damageDealt: 0,
      damageTaken: 0,
      healingDone: 0,
      unitsHealed: 0,
      missionsCompleted: 0,
      missionsFailed: 0,
      playTime: 0,
      unitsCurrent: 0,
      buildingsCurrent: 0,
      resourcesCurrent: {}
    };

    this.combatStats = {
      totalKills: 0,
      killByUnitType: {},
      killByWeapon: {},
      deaths: 0,
      deathByUnitType: {},
      bestKillStreak: 0,
      currentKillStreak: 0,
      totalDamageDealt: 0,
      criticalHits: 0,
      dodges: 0,
      blocks: 0
    };

    this.economyStats = {
      incomeTotal: {},
      expensesTotal: {},
      netIncome: {},
      peakCredits: 0,
      peakResources: {},
      unitsProduced: 0,
      upgradesCompleted: 0
    };
  }

  setShowDebugInfo(show: boolean): void {
    this.showDebugInfoFlag = show;
    this.uiRenderer?.setShowDebugInfo(show);
  }

  unitCreated(_unitId: string, _unitType: string): void {
    this.gameStats.unitsCreated++;
    this.gameStats.unitsCurrent++;
    this.notifyStatUpdate();
  }

  unitDestroyed(unitId: string, unitType: string, killedBy?: { id: string; type: string }): void {
    this.gameStats.unitsCurrent--;
    this.gameStats.unitsDestroyed++;

    if (killedBy) {
      this.recordKill(killedBy.id, killedBy.type, unitId, unitType, 'unknown', 0);
    } else {
      this.combatStats.deaths++;
      this.combatStats.currentKillStreak = 0;

      if (!this.combatStats.deathByUnitType[unitType]) {
        this.combatStats.deathByUnitType[unitType] = 0;
      }
      this.combatStats.deathByUnitType[unitType]++;
    }

    this.notifyStatUpdate();
  }

  unitLost(_unitId: string, _unitType: string): void {
    this.gameStats.unitsLost++;
    this.gameStats.unitsCurrent--;
    this.notifyStatUpdate();
  }

  buildingBuilt(_buildingId: string, _buildingType: string): void {
    this.gameStats.buildingsBuilt++;
    this.gameStats.buildingsCurrent++;
    this.economyStats.unitsProduced++;
    this.notifyStatUpdate();
  }

  buildingDestroyed(_buildingId: string, _buildingType: string): void {
    this.gameStats.buildingsCurrent--;
    this.gameStats.buildingsDestroyed++;
    this.notifyStatUpdate();
  }

  buildingLost(_buildingId: string, _buildingType: string): void {
    this.gameStats.buildingsLost++;
    this.gameStats.buildingsCurrent--;
    this.notifyStatUpdate();
  }

  recordKill(
    killerId: string,
    killerType: string,
    victimId: string,
    victimType: string,
    weapon: string,
    damage: number
  ): void {
    const event: UnitKillEvent = {
      timestamp: Date.now(),
      killerId,
      killerType,
      victimId,
      victimType,
      weapon,
      damage,
      position: { x: 0, y: 0 }
    };

    this.recentKills.push(event);
    if (this.recentKills.length > this.maxRecentKills) {
      this.recentKills.shift();
    }

    this.combatStats.totalKills++;
    this.combatStats.currentKillStreak++;

    if (this.combatStats.currentKillStreak > this.combatStats.bestKillStreak) {
      this.combatStats.bestKillStreak = this.combatStats.currentKillStreak;
    }

    if (!this.combatStats.killByUnitType[killerType]) {
      this.combatStats.killByUnitType[killerType] = 0;
    }
    this.combatStats.killByUnitType[killerType]++;

    if (!this.combatStats.killByWeapon[weapon]) {
      this.combatStats.killByWeapon[weapon] = 0;
    }
    this.combatStats.killByWeapon[weapon]++;

    this.notifyStatUpdate();
  }

  recordDamageDealt(damage: number, isCritical: boolean = false): void {
    this.gameStats.damageDealt += damage;
    this.combatStats.totalDamageDealt += damage;

    if (isCritical) {
      this.combatStats.criticalHits++;
    }

    this.notifyStatUpdate();
  }

  recordDamageTaken(damage: number): void {
    this.gameStats.damageTaken += damage;
    this.notifyStatUpdate();
  }

  recordHealing(amount: number): void {
    this.gameStats.healingDone += amount;
    this.gameStats.unitsHealed++;
    this.notifyStatUpdate();
  }

  recordResourcesGathered(resourceType: string, amount: number): void {
    if (!this.gameStats.resourcesGathered[resourceType]) {
      this.gameStats.resourcesGathered[resourceType] = 0;
    }
    this.gameStats.resourcesGathered[resourceType] += amount;

    if (!this.economyStats.incomeTotal[resourceType]) {
      this.economyStats.incomeTotal[resourceType] = 0;
    }
    this.economyStats.incomeTotal[resourceType] += amount;

    const current = this.gameStats.resourcesCurrent[resourceType] || 0;
    const newTotal = current + amount;
    this.gameStats.resourcesCurrent[resourceType] = newTotal;

    if (resourceType === 'credits' && newTotal > this.economyStats.peakCredits) {
      this.economyStats.peakCredits = newTotal;
    } else if (newTotal > (this.economyStats.peakResources[resourceType] || 0)) {
      this.economyStats.peakResources[resourceType] = newTotal;
    }

    this.notifyStatUpdate();
  }

  recordResourcesSpent(resourceType: string, amount: number): void {
    if (!this.gameStats.resourcesSpent[resourceType]) {
      this.gameStats.resourcesSpent[resourceType] = 0;
    }
    this.gameStats.resourcesSpent[resourceType] += amount;

    if (!this.economyStats.expensesTotal[resourceType]) {
      this.economyStats.expensesTotal[resourceType] = 0;
    }
    this.economyStats.expensesTotal[resourceType] += amount;

    const current = this.gameStats.resourcesCurrent[resourceType] || 0;
    this.gameStats.resourcesCurrent[resourceType] = Math.max(0, current - amount);

    this.notifyStatUpdate();
  }

  missionCompleted(): void {
    this.gameStats.missionsCompleted++;
    this.notifyStatUpdate();
  }

  missionFailed(): void {
    this.gameStats.missionsFailed++;
    this.notifyStatUpdate();
  }

  upgradeCompleted(): void {
    this.economyStats.upgradesCompleted++;
    this.notifyStatUpdate();
  }

  update(delta: number): void {
    this.gameStats.playTime += delta / 1000;
  }

  private notifyStatUpdate(): void {
    this.onStatUpdateCallbacks.forEach(cb => cb(this.getGameStats()));
  }

  onStatUpdate(callback: (stats: GameStats) => void): () => void {
    this.onStatUpdateCallbacks.add(callback);
    return () => {
      this.onStatUpdateCallbacks.delete(callback);
    };
  }

  getGameStats(): GameStats {
    return { ...this.gameStats };
  }

  getCombatStats(): CombatStats {
    return { ...this.combatStats };
  }

  getEconomyStats(): EconomyStats {
    return { ...this.economyStats };
  }

  getRecentKills(count: number = 10): UnitKillEvent[] {
    return this.recentKills.slice(-count);
  }

  getKillRate(): number {
    if (this.gameStats.playTime === 0) return 0;
    return (this.combatStats.totalKills / this.gameStats.playTime) * 60;
  }

  getDeathRate(): number {
    if (this.gameStats.playTime === 0) return 0;
    return (this.combatStats.deaths / this.gameStats.playTime) * 60;
  }

  getKD(): number {
    if (this.combatStats.deaths === 0) return this.combatStats.totalKills;
    return this.combatStats.totalKills / this.combatStats.deaths;
  }

  getEfficiency(): number {
    const created = this.gameStats.unitsCreated + this.gameStats.unitsLost;
    if (created === 0) return 0;
    return (this.gameStats.unitsDestroyed / created) * 100;
  }

  getResourceEfficiency(): Record<string, number> {
    const efficiency: Record<string, number> = {};

    Object.keys(this.economyStats.incomeTotal).forEach(resource => {
      const income = this.economyStats.incomeTotal[resource];
      const expenses = this.economyStats.expensesTotal[resource] || 0;

      if (income > 0) {
        efficiency[resource] = ((income - expenses) / income) * 100;
      } else {
        efficiency[resource] = 0;
      }
    });

    return efficiency;
  }

  getSummary(): string {
    const stats = this.gameStats;
    const combat = this.combatStats;
    const minutes = Math.floor(stats.playTime / 60);
    const seconds = Math.floor(stats.playTime % 60);

    return [
      '=== 游戏统计 ===',
      '',
      `游戏时间: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      '',
      '--- 单位 ---',
      `创建: ${stats.unitsCreated} | 损失: ${stats.unitsLost} | 击杀: ${combat.totalKills}`,
      `死亡: ${combat.deaths} | 当前: ${stats.unitsCurrent}`,
      `K/D: ${this.getKD().toFixed(2)} | 效率: ${this.getEfficiency().toFixed(1)}%`,
      '',
      '--- 建筑 ---',
      `建造: ${stats.buildingsBuilt} | 损失: ${stats.buildingsLost} | 摧毁: ${stats.buildingsDestroyed}`,
      `当前: ${stats.buildingsCurrent}`,
      '',
      '--- 战斗 ---',
      `伤害输出: ${stats.damageDealt.toFixed(0)} | 承受: ${stats.damageTaken.toFixed(0)}`,
      `暴击: ${combat.criticalHits} | 治疗: ${stats.healingDone.toFixed(0)}`,
      `最高连杀: ${combat.bestKillStreak}`,
      '',
      '--- 经济 ---',
      Object.entries(stats.resourcesGathered).map(([r, v]) => `${r}: +${v}`).join(' | '),
      '',
      '--- 任务 ---',
      `完成: ${stats.missionsCompleted} | 失败: ${stats.missionsFailed}`
    ].join('\n');
  }

  exportStats(): string {
    return JSON.stringify({
      gameStats: this.gameStats,
      combatStats: this.combatStats,
      economyStats: this.economyStats,
      recentKills: this.recentKills,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  importStats(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);

      if (data.gameStats) this.gameStats = data.gameStats;
      if (data.combatStats) this.combatStats = data.combatStats;
      if (data.economyStats) this.economyStats = data.economyStats;
      if (data.recentKills) this.recentKills = data.recentKills;

      this.notifyStatUpdate();
      return true;
    } catch {
      console.error('Failed to import stats');
      return false;
    }
  }

  reset(): void {
    this.resetStats();
    this.recentKills = [];
    this.notifyStatUpdate();
  }

  dispose(): void {
    this.onStatUpdateCallbacks.clear();
    this.uiRenderer?.dispose();
  }
}
