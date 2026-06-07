import { GameSoundManager } from './GameSoundManager';
import { EffectSystem } from '../render/EffectSystem';
import { gameEventBus, GameEvent, GameEventType } from './GameEventBus';
import { gameUIController } from '../ui/GameUIController';
import { UNITS_BY_FACTION } from './AIUnitLookup';
import { useGameStore } from '../../store/gameStore';
import type { Faction, UnitType, UnitData, BuildingType } from '../../types';
import type { PhaserGameScene } from '../render/PhaserGameScene';

const SOUND_EVENT_MAP: Partial<Record<GameEventType, string>> = {
  'unit:attack': 'unitAttack',
  'unit:destroyed': 'unitDestroyed',
  'unit:move': 'unitMove',
  'unit:select': 'unitSelect',
  'unit:produced': 'unitProduced',
  'building:constructed': 'buildingPlace',
  'building:destroyed': 'buildingDestroyed',
  'building:damaged': 'buildingHit',
  'resource:collected': 'resourceCollect',
  'resource:deposited': 'oreDeposit',
  'resource:depleted': 'resourceDepleted',
  'combat:hit': 'bullet',
  'combat:projectile': 'bullet',
  'combat:explosion': 'explosion',
  'combat:emp': 'empAttack',
  'game:victory': 'upgradeComplete',
  'game:defeat': 'alert',
  'game:alert': 'alert',
  'alert:lowPower': 'lowPower',
  'alert:baseUnderAttack': 'baseUnderAttack',
  'power:low': 'lowPower',
  'power:restored': 'upgradeComplete',
  'upgrade:completed': 'upgradeComplete',
  'upgrade:started': 'upgradeStarted',
  'transport:load': 'unitMove',
  'transport:unload': 'unitMove',
  'unit:teleport': 'chronoShift',
};

export class GameEventBridge {
  private soundManager: GameSoundManager | null = null;
  private effectSystem: EffectSystem | null = null;
  private scene: PhaserGameScene | null = null;
  private unsubscribe: (() => void) | null = null;
  // Throttle high-frequency player feedback to avoid spam
  private lastPlayerLossNotice: number = 0;
  private playerLossCounter: number = 0;
  private lastPowerNotice: number = 0;

  private getPlayerFaction(): Faction | null {
    try {
      return useGameStore.getState().currentPlayer?.faction ?? null;
    } catch {
      return null;
    }
  }

  connect(soundManager: GameSoundManager, effectSystem: EffectSystem, scene?: PhaserGameScene): void {
    this.soundManager = soundManager;
    this.effectSystem = effectSystem;
    this.scene = scene || null;
    this.unsubscribe = gameEventBus.onAny((event: GameEvent) => {
      this.handleSoundEvent(event);
      this.handleEffectEvent(event);
      this.handleNotification(event);
      this.handleShakeEvent(event);
    });
  }

  private handleNotification(event: GameEvent): void {
    switch (event.type) {
      case 'unit:produced': {
        const unitType = event.data?.unitType as UnitType | undefined;
        const faction = event.data?.faction as Faction | undefined;
        if (unitType && faction) {
          const factionUnits = UNITS_BY_FACTION[faction] || {};
          const unitData = factionUnits[unitType] as UnitData | undefined;
          const name = unitData?.name || unitType;
          gameUIController.showNotification(`${name} 生产完成`, 'success', 2000);
        }
        break;
      }
      case 'building:constructed': {
        const bType = event.data?.type as string | undefined;
        if (bType) {
          gameUIController.showNotification(`建筑 ${bType} 建造完成`, 'success', 2000);
        }
        break;
      }
      case 'unit:destroyed': {
        // Only notify when player's own unit is lost, with throttling to avoid spam
        const faction = event.data?.faction as Faction | undefined;
        const playerFaction = this.getPlayerFaction();
        if (!faction || !playerFaction || faction !== playerFaction) break;
        const now = Date.now();
        this.playerLossCounter++;
        if (now - this.lastPlayerLossNotice >= 4000) {
          const count = this.playerLossCounter;
          this.playerLossCounter = 0;
          this.lastPlayerLossNotice = now;
          const msg = count > 1 ? `⚠ 损失了 ${count} 个单位` : `⚠ 单位被消灭`;
          gameUIController.showNotification(msg, 'warning', 2500);
        }
        break;
      }
      case 'building:destroyed': {
        const faction = event.data?.faction as Faction | undefined;
        const bType = event.data?.type as BuildingType | undefined;
        const playerFaction = this.getPlayerFaction();
        if (!faction || !bType) break;
        if (faction === playerFaction) {
          gameUIController.showNotification(`🔥 我方 ${bType} 被摧毁！`, 'error', 4000);
        } else if (playerFaction) {
          // Brief notice when an enemy building falls (less prominent)
          gameUIController.showNotification(`敌方 ${bType} 已摧毁`, 'success', 2000);
        }
        break;
      }
      case 'game:victory': {
        gameUIController.showNotification('🏆 胜利！所有敌人已被消灭', 'success', 6000);
        break;
      }
      case 'game:defeat': {
        gameUIController.showNotification('💀 战败！基地已被摧毁', 'error', 6000);
        break;
      }
      case 'power:low': {
        const faction = event.data?.faction as Faction | undefined;
        const playerFaction = this.getPlayerFaction();
        if (faction !== playerFaction) break;
        const now = Date.now();
        if (now - this.lastPowerNotice < 8000) break;
        this.lastPowerNotice = now;
        gameUIController.showNotification('⚡ 电力不足，建造与生产将变慢', 'warning', 3500);
        break;
      }
      case 'power:restored': {
        const faction = event.data?.faction as Faction | undefined;
        const playerFaction = this.getPlayerFaction();
        if (faction !== playerFaction) break;
        const now = Date.now();
        if (now - this.lastPowerNotice < 8000) break;
        this.lastPowerNotice = now;
        gameUIController.showNotification('⚡ 电力已恢复', 'success', 2000);
        break;
      }
      case 'ui:notification': {
        const message = event.data?.message as string | undefined;
        const notifType = (event.data?.type as string || 'info') as 'info' | 'success' | 'warning' | 'error';
        if (message) {
          gameUIController.showNotification(message, notifType, 3000);
        }
        break;
      }
      case 'combat:emp': {
        gameUIController.showNotification('EMP瘫痪效果生效', 'warning', 2500);
        break;
      }
      case 'upgrade:completed': {
        const upgradeName = event.data?.upgradeName as string | undefined;
        gameUIController.showNotification(`研究完成: ${upgradeName || '未知'}`, 'success', 3000);
        break;
      }
      case 'transport:load': {
        gameUIController.showNotification('单位已装载', 'info', 2000);
        break;
      }
      case 'transport:unload': {
        gameUIController.showNotification('单位已卸载', 'info', 2000);
        break;
      }
      case 'building:damaged': {
        gameUIController.showNotification('建筑受到攻击', 'warning', 2500);
        break;
      }
      case 'resource:depleted': {
        gameUIController.showNotification('矿脉已耗尽', 'warning', 3000);
        break;
      }
      case 'unit:teleport': {
        gameUIController.showNotification('超时空传送完成', 'success', 2500);
        break;
      }
      case 'alert:lowPower': {
        const faction = event.data?.faction as Faction | undefined;
        const playerFaction = this.getPlayerFaction();
        if (faction !== playerFaction) break;
        gameUIController.showNotification('⚡ 电力不足警告！', 'warning', 3000);
        break;
      }
      case 'alert:baseUnderAttack': {
        const faction = event.data?.faction as Faction | undefined;
        const playerFaction = this.getPlayerFaction();
        if (faction !== playerFaction) break;
        gameUIController.showNotification('🚨 基地遭到攻击！', 'error', 4000);
        break;
      }
      case 'upgrade:started': {
        const upgradeName = event.data?.upgradeName as string | undefined;
        gameUIController.showNotification(`开始研究: ${upgradeName || '未知'}`, 'info', 2500);
        break;
      }
      case 'resource:deposited': {
        const amount = event.data?.amount as number | undefined;
        if (amount) {
          gameUIController.showNotification(`💰 矿石入库 +$${amount}`, 'success', 1500);
        }
        break;
      }
    }
  }

  disconnect(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private handleSoundEvent(event: GameEvent): void {
    if (!this.soundManager) return;

    // Extract position from event data for distance attenuation
    const position = event.data?.position as { x: number; y: number } | undefined;

    // Handle generic sound:play event with explicit key
    if (event.type === 'sound:play') {
      const soundKey = event.data?.key as string | undefined;
      if (soundKey) {
        this.soundManager.play(soundKey, { position });
      }
      return;
    }

    const soundKey = SOUND_EVENT_MAP[event.type];
    if (soundKey) {
      this.soundManager.play(soundKey, { position });
    }

    // Special handling for superweapon: play specific sound based on type
    if (event.type === 'superweapon:activated') {
      const swType = event.data?.type as string | undefined;
      if (swType === 'nuclear_silo') {
        this.soundManager.play('nukeExplosion', { position });
      } else if (swType === 'iron_curtain') {
        this.soundManager.play('ironCurtain', { position });
      } else if (swType === 'chronosphere') {
        this.soundManager.play('chronosphere', { position });
      } else {
        this.soundManager.play('superweaponLaunch', { position });
      }
    }

    // Special handling for projectile sounds based on type
    if (event.type === 'combat:projectile') {
      const projType = event.data?.projectileType as string | undefined;
      if (projType === 'shell') {
        this.soundManager.play('unitAttack', { position });
      } else if (projType === 'missile') {
        this.soundManager.play('unitAttack', { position });
      }
      // bullet and beam use the default from SOUND_EVENT_MAP
    }

    if (event.type === 'unit:attack') {
      this.soundManager.playRandomVoice('attack');
    } else if (event.type === 'unit:move') {
      this.soundManager.playRandomVoice('command');
    } else if (event.type === 'unit:destroyed') {
      this.soundManager.playRandomVoice('death');
    } else if (event.type === 'game:alert' || event.type === 'power:low' || event.type === 'alert:lowPower' || event.type === 'alert:baseUnderAttack') {
      this.soundManager.playRandomVoice('help');
    }
  }

  private handleEffectEvent(event: GameEvent): void {
    if (!this.effectSystem) return;

    const position = event.data?.position as { x: number; y: number } | undefined;
    if (!position) return;

    switch (event.type) {
      case 'combat:explosion':
        this.effectSystem.playExplosion(position.x, position.y);
        break;
      case 'combat:hit':
        this.effectSystem.playMuzzleFlash(position.x, position.y, 0);
        break;
      case 'combat:emp':
        this.effectSystem.playTeslaZap(position.x, position.y, position.x, position.y);
        break;
      case 'building:constructed':
      case 'unit:produced':
        this.effectSystem.playBuildEffect(position.x, position.y);
        break;
      case 'unit:levelUp':
      case 'unit:promoted':
        this.effectSystem.playHealEffect(position.x, position.y);
        break;
      case 'building:destroyed': {
        this.effectSystem.playExplosion(position.x, position.y, 1.5);
        this.effectSystem.playSmoke(position.x, position.y);
        const buildingSize = (event.data?.size as number) || 2;
        this.effectSystem.playBuildingRubble(position.x, position.y, buildingSize);
        break;
      }
      case 'unit:destroyed': {
        const unitType = (event.data?.unitType as string) || '';
        this.effectSystem.playUnitDeathEffect(position.x, position.y, unitType);
        break;
      }
      case 'transport:load':
      case 'transport:unload':
        this.effectSystem.playMuzzleFlash(position.x, position.y, 0);
        break;
      case 'unit:teleport':
        this.effectSystem.playChronoShiftEffect(position.x, position.y);
        break;
    }
  }

  private handleShakeEvent(event: GameEvent): void {
    if (!this.scene) return;

    switch (event.type) {
      case 'unit:destroyed': {
        const unitType = (event.data?.unitType as string) || '';
        const isNaval = ['destroyer', 'submarine', 'transport_ship'].includes(unitType);
        const isVehicle = !['soldier', 'rocketeer', 'engineer', 'sniper', 'tanya', 'terrorist', 'crazy_ivan', 'chrono', 'desolator', 'conscript', 'flakinfantry', 'seal'].includes(unitType);
        if (isNaval || isVehicle) {
          this.scene.shakeCamera(0.003, 150);
        }
        break;
      }
      case 'building:destroyed':
        this.scene.shakeCamera(0.005, 250);
        break;
      case 'superweapon:activated':
        this.scene.shakeCamera(0.01, 500);
        break;
      case 'combat:hit': {
        const targetIsBuilding = event.data?.targetIsBuilding as boolean | undefined;
        if (targetIsBuilding) {
          this.scene.shakeCamera(0.002, 100);
        }
        break;
      }
    }
  }

  dispose(): void {
    this.disconnect();
    this.soundManager = null;
    this.effectSystem = null;
    this.scene = null;
  }
}

export const gameEventBridge = new GameEventBridge();
