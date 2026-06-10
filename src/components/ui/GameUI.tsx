import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { gameUIController, ContextMenuItem } from '../../game/ui/GameUIController';
import { UnitType, UnitState, UnitRank, UnitData, UnitStance, BuildingType, Faction, getFactionGroup } from '../../types';
import { GAME_CONFIG } from '../../game/config/GameConfig';
import { inputHandler } from '../../game/engine/InputHandler';
import { UNITS_BY_FACTION } from '../../game/systems/AIUnitLookup';
import { gameEventBus } from '../../game/systems/GameEventBus';

const INFANTRY_TYPES = new Set([
  UnitType.SOLDIER, UnitType.ROCKET, UnitType.SNIPER, UnitType.SEAL,
  UnitType.TANYA, UnitType.CONSCRIPT, UnitType.FLAKINFANTRY,
  UnitType.TERRORIST, UnitType.IVAN, UnitType.ENGINEER, UnitType.CHRONO,
]);

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
import { ACHIEVEMENTS } from '../../game/data/achievements';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { Minimap } from './Minimap';
import { SettingsPanel } from './SettingsPanel';
import { SaveLoadPanel } from './SaveLoadPanel';
import { PerformanceOverlay } from './PerformanceOverlay';
import { Scoreboard } from './Scoreboard';
import { ResourceBar } from './ResourceBar';
import './GameUI.css';

const UNIT_PORTRAITS: Record<string, string> = {
  [UnitType.SOLDIER]: '🥷',
  [UnitType.ROCKET]: '🚀',
  [UnitType.ENGINEER]: '🔧',
  [UnitType.SNIPER]: '🎯',
  [UnitType.TANK]: '🔫',
  [UnitType.GUARDIAN]: '🛡️',
  [UnitType.IFV]: '🚙',
  [UnitType.MINER]: '🚛',
  [UnitType.PHANTOM]: '🌴',
  [UnitType.PRISM]: '💎',
  [UnitType.BLACKHAWK]: '🚁',
  [UnitType.TANYA]: '👩‍✈️',
  [UnitType.RHINO]: '🦏',
  [UnitType.APOCALYPSE]: '☢️',
  [UnitType.TERRORIST]: '💣',
  [UnitType.IVAN]: '🧨',
  [UnitType.DESPOT]: '👑',
  [UnitType.CHRONO]: '⏳',
  [UnitType.APC]: '🚌',
  [UnitType.DESTROYER]: '🚢',
  [UnitType.SUBMARINE]: '🐟',
  [UnitType.TRANSPORT_SHIP]: '⛴️',
  [UnitType.HELICOPTER]: '🚁',
  [UnitType.KIROV]: '🎈',
  [UnitType.CONSCRIPT]: '🎖️',
  [UnitType.FLAKINFANTRY]: '🚀',
  [UnitType.SEAL]: '🤿',
  [UnitType.TESLA]: '⚡',
  [UnitType.YAK]: '✈️',
  [UnitType.FLAK]: '🎯',
};

const TUTORIAL_STEPS = [
  {
    title: '欢迎来到红色警戒2',
    text: '这是一款即时战略游戏。让我们学习基本操作！',
    highlight: null as string | null,
  },
  {
    title: '移动视角',
    text: '使用 WASD 或鼠标移动到屏幕边缘来移动视角。滚轮缩放。',
    highlight: null as string | null,
  },
  {
    title: '选择单位',
    text: '左键点击单位选择，拖拽框选多个单位。',
    highlight: null as string | null,
  },
  {
    title: '移动单位',
    text: '选中单位后，右键点击地面移动。右键点击敌人攻击。',
    highlight: null as string | null,
  },
  {
    title: '建造建筑',
    text: '点击下方的建造面板选择建筑，然后点击地图放置。建筑必须建在已有建筑旁边。',
    highlight: 'build-panel' as string | null,
  },
  {
    title: '生产单位',
    text: '选中兵营或战车工厂，在建造面板中选择要生产的单位。',
    highlight: 'build-panel' as string | null,
  },
  {
    title: '采集资源',
    text: '矿车会自动采集矿石并运回精炼厂。矿石是建造和生产的基础。',
    highlight: 'resource-bar' as string | null,
  },
  {
    title: '科技升级',
    text: '建造雷达站解锁科技树。在建造面板的科技标签页中研究升级。',
    highlight: 'build-panel' as string | null,
  },
  {
    title: '快捷键',
    text: '按 F1 查看所有快捷键。S停止、A攻击移动、P巡逻、H保持位置。',
    highlight: null as string | null,
  },
  {
    title: '准备就绪！',
    text: '消灭所有敌方建筑即可获胜。祝你好运，指挥官！',
    highlight: null as string | null,
  },
];

// Unit response text definitions
const UNIT_RESPONSES: Record<string, {
  select: string[];
  move: string[];
  attack: string[];
}> = {
  default: {
    select: ['就绪', '报告', '等待命令'],
    move: ['移动', '收到', '出发'],
    attack: ['攻击', '开火', '消灭他们'],
  },
  [UnitType.SOLDIER]: {
    select: ['士兵就绪', '报告长官'],
    move: ['前进', '收到'],
    attack: ['开火', '冲锋'],
  },
  [UnitType.CONSCRIPT]: {
    select: ['征召兵就位', '服从命令'],
    move: ['是', '移动'],
    attack: ['为了祖国', '开火'],
  },
  [UnitType.TANK]: {
    select: ['坦克就位', '装甲完好'],
    move: ['推进', '收到'],
    attack: ['目标锁定', '开炮'],
  },
  [UnitType.RHINO]: {
    select: ['犀牛坦克就绪', '重甲待命'],
    move: ['推进', '收到'],
    attack: ['主炮瞄准', '开火'],
  },
  [UnitType.APOCALYPSE]: {
    select: ['天启坦克就绪', '毁灭即将来临'],
    move: ['碾压一切', '收到'],
    attack: ['目标锁定', '毁灭他们'],
  },
  [UnitType.PRISM]: {
    select: ['幻影坦克就绪', '光棱充能完毕'],
    move: ['转移', '收到'],
    attack: ['聚焦', '发射'],
  },
  [UnitType.MINER]: {
    select: ['矿车就绪', '准备采集'],
    move: ['出发', '收到'],
    attack: ['自卫模式', '反击'],
  },
  [UnitType.ENGINEER]: {
    select: ['工程师就位', '等待指示'],
    move: ['移动', '收到'],
    attack: ['无法攻击', '撤退'],
  },
  [UnitType.ROCKET]: {
    select: ['火箭兵就位', '导弹装填完毕'],
    move: ['前进', '收到'],
    attack: ['锁定目标', '发射'],
  },
  [UnitType.SNIPER]: {
    select: ['狙击手就位', '目标搜索中'],
    move: ['潜行', '收到'],
    attack: ['目标确认', '扣动扳机'],
  },
  [UnitType.TANYA]: {
    select: ['谭雅就绪', '谁需要帮忙？'],
    move: ['出发', '没问题'],
    attack: ['交给我', '小菜一碟'],
  },
  [UnitType.SEAL]: {
    select: ['海豹突击队就绪', '待命中'],
    move: ['行动', '收到'],
    attack: ['突袭', '消灭目标'],
  },
  [UnitType.TESLA]: {
    select: ['磁暴坦克就绪', '充能完毕'],
    move: ['移动', '收到'],
    attack: ['放电', '电击'],
  },
  [UnitType.IFV]: {
    select: ['步兵战车就绪', '待命'],
    move: ['机动', '收到'],
    attack: ['开火', '锁定'],
  },
  [UnitType.KIROV]: {
    select: ['基洛夫飞艇就绪', '从天而降'],
    move: ['飞往目标', '收到'],
    attack: ['投弹', '轰炸'],
  },
  [UnitType.HELICOPTER]: {
    select: ['直升机就绪', '升空完毕'],
    move: ['飞行', '收到'],
    attack: ['攻击', '开火'],
  },
  [UnitType.FLAK]: {
    select: ['防空车就绪', '对空警戒'],
    move: ['移动', '收到'],
    attack: ['对空开火', '拦截'],
  },
  [UnitType.TERRORIST]: {
    select: ['恐怖分子就绪', '为了胜利'],
    move: ['前进', '收到'],
    attack: ['冲锋', '引爆'],
  },
  [UnitType.IVAN]: {
    select: ['疯狂伊文就绪', '炸弹已装好'],
    move: ['移动', '收到'],
    attack: ['安放炸弹', '爆炸'],
  },
  [UnitType.GUARDIAN]: {
    select: ['守护者就绪', '防御模式'],
    move: ['转移', '收到'],
    attack: ['反击', '开火'],
  },
  [UnitType.DESPOT]: {
    select: ['暴君坦克就绪', '碾压一切'],
    move: ['推进', '收到'],
    attack: ['主炮开火', '毁灭'],
  },
  [UnitType.CHRONO]: {
    select: ['超时空军团就绪', '时空跳跃就绪'],
    move: ['传送', '收到'],
    attack: ['时空锁定', '消除'],
  },
  [UnitType.APC]: {
    select: ['装甲运兵车就绪', '运输模式'],
    move: ['前进', '收到'],
    attack: ['自卫开火', '反击'],
  },
  [UnitType.PHANTOM]: {
    select: ['幻影坦克就绪', '伪装模式'],
    move: ['移动', '收到'],
    attack: ['解除伪装', '开火'],
  },
  [UnitType.FLAKINFANTRY]: {
    select: ['防空步兵就绪', '对空警戒'],
    move: ['前进', '收到'],
    attack: ['对空开火', '拦截'],
  },
  [UnitType.BLACKHAWK]: {
    select: ['黑鹰战机就绪', '空中待命'],
    move: ['飞行', '收到'],
    attack: ['空袭', '发射'],
  },
  [UnitType.YAK]: {
    select: ['雅克战机就绪', '空中待命'],
    move: ['飞行', '收到'],
    attack: ['扫射', '开火'],
  },
};

function getUnitResponse(unitType: UnitType, action: 'select' | 'move' | 'attack'): string {
  const responses = UNIT_RESPONSES[unitType] || UNIT_RESPONSES.default;
  const texts = responses[action];
  return texts[Math.floor(Math.random() * texts.length)];
}

interface ActionButton {
  id: string;
  icon: string;
  label: string;
  hotkey: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  tooltip?: string;
}

// DetailedTooltip: shows full unit/building stats on hover
const DetailedTooltip: React.FC<{
  targetRef: React.RefObject<HTMLElement | null>;
  type: 'unit' | 'building';
  data: Record<string, React.ReactNode>;
}> = ({ targetRef, type, data }) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!targetRef.current) return;
    const rect = targetRef.current.getBoundingClientRect();
    const x = rect.right + 8;
    const y = Math.min(rect.top, window.innerHeight - Object.keys(data).length * 22 - 40);
    setPos({ x: Math.min(x, window.innerWidth - 220), y: Math.max(y, 4) });
  }, [targetRef, data]);

  if (!pos) return null;

  return (
    <div className="detailed-tooltip" style={{ left: pos.x, top: pos.y }}>
      <div className="detailed-tooltip-header">{type === 'unit' ? '单位详情' : '建筑详情'}</div>
      <div className="detailed-tooltip-body">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="detailed-tooltip-row">
            <span className="detailed-tooltip-label">{key}</span>
            <span className="detailed-tooltip-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const GameUI: React.FC = () => {
  const selectedUnits = useGameStore(s => s.selectedUnits);
  const selectedBuilding = useGameStore(s => s.selectedBuilding);
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const alertLevel = useGameStore(s => s.alertLevel);
  const produceUnit = useGameStore(s => s.produceUnit);
  const resources = useGameStore(s => s.resources);
  const isObserverMode = useGameStore(s => s.isObserverMode);
  const isPaused = useGameStore(s => s.isPaused);
  const aiPlayers = useGameStore(s => s.aiPlayers);
  const gameSpeed = useGameStore(s => s.gameSpeed);
  const setGameSpeed = useGameStore(s => s.setGameSpeed);
  const newAchievement = useGameStore(s => s.newAchievement);
  const clearNewAchievement = useGameStore(s => s.clearNewAchievement);
  const tutorialActive = useGameStore(s => s.tutorialActive);
  const tutorialStep = useGameStore(s => s.tutorialStep);
  const startTutorial = useGameStore(s => s.startTutorial);
  const endTutorial = useGameStore(s => s.endTutorial);
  const setTutorialStep = useGameStore(s => s.setTutorialStep);
  const selectIdleMiners = useGameStore(s => s.selectIdleMiners);
  const selectIdleMilitary = useGameStore(s => s.selectIdleMilitary);
  const togglePause = useGameStore(s => s.togglePause);

  const [uiState, setUiState] = useState(() => gameUIController.getState());
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [unitResponse, setUnitResponse] = useState<string | null>(null);
  const responseTimerRef = useRef<number>(0);
  const selectedUnitsRef = useRef(selectedUnits);
  selectedUnitsRef.current = selectedUnits;
  const [showUnitTooltip, setShowUnitTooltip] = useState(false);
  const [showBuildingTooltip, setShowBuildingTooltip] = useState(false);
  const unitPanelRef = useRef<HTMLDivElement | null>(null);
  const buildingPanelRef = useRef<HTMLDivElement | null>(null);
  const [showMenuConfirm, setShowMenuConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = gameUIController.subscribe(setUiState);
    return unsubscribe;
  }, []);

  // Unit selection response
  useEffect(() => {
    if (isObserverMode) return;
    if (selectedUnits.length > 0) {
      const unit = selectedUnits[0];
      const text = getUnitResponse(unit.type, 'select');
      setUnitResponse(text);
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
      }
      responseTimerRef.current = window.setTimeout(() => {
        setUnitResponse(null);
      }, 2000);
    }
  }, [selectedUnits, isObserverMode]);

  // Listen for move/attack events for unit responses
  useEffect(() => {
    if (isObserverMode) return;
    const unsubMove = gameEventBus.on('unit:move', () => {
      const units = selectedUnitsRef.current;
      if (units.length > 0) {
        const unit = units[0];
        const text = getUnitResponse(unit.type, 'move');
        setUnitResponse(text);
        if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
        responseTimerRef.current = window.setTimeout(() => setUnitResponse(null), 2000);
      }
    });
    const unsubAttack = gameEventBus.on('unit:attack', () => {
      const units = selectedUnitsRef.current;
      if (units.length > 0) {
        const unit = units[0];
        const text = getUnitResponse(unit.type, 'attack');
        setUnitResponse(text);
        if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
        responseTimerRef.current = window.setTimeout(() => setUnitResponse(null), 2000);
      }
    });
    return () => {
      unsubMove();
      unsubAttack();
      if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    };
  }, [isObserverMode]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      if (selectedUnits.length > 0) {
        gameUIController.showUnitContextMenu(e.clientX, e.clientY, selectedUnits.length);
      } else if (selectedBuilding) {
        gameUIController.showBuildingContextMenu(e.clientX, e.clientY);
      } else {
        gameUIController.showEmptyContextMenu(e.clientX, e.clientY);
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [selectedUnits.length, selectedBuilding]);

  const getRankLabel = (rank: UnitRank): string => {
    switch (rank) {
      case UnitRank.VETERAN: return '老兵';
      case UnitRank.ELITE: return '精英';
      default: return '新兵';
    }
  };

  const getHealthColor = (percent: number): string => {
    if (percent > 50) return 'var(--health-high)';
    if (percent > 25) return 'var(--health-medium)';
    if (percent > 10) return 'var(--health-low)';
    return 'var(--health-critical)';
  };

  const getActionButtons = useCallback((): ActionButton[] => {
    const store = useGameStore.getState();

    if (selectedUnits.length > 0) {
      const unit = selectedUnits[0];
      const buttons: ActionButton[] = [];

      if (unit.data.canAttack) {
        buttons.push(
          { id: 'move', icon: '🚶', label: '移动', hotkey: 'G', tooltip: '右键点击地图移动单位',
            onClick: () => { setPendingCommand(null); } },
          { id: 'attackMove', icon: '⚔️', label: '攻击移动', hotkey: 'A', tooltip: '移动并攻击沿途敌人，右键点击目标位置',
            active: pendingCommand === 'attackMove',
            onClick: () => {
              setPendingCommand('attackMove');
              inputHandler.setPendingCommandExternal('attackMove');
            } },
          { id: 'patrol', icon: '🔄', label: '巡逻', hotkey: 'P', tooltip: '设置巡逻路线，右键点击路径点',
            active: pendingCommand === 'patrol',
            onClick: () => {
              setPendingCommand('patrol');
              inputHandler.setPendingCommandExternal('patrol');
            } },
          { id: 'defend', icon: '🏰', label: '防守', hotkey: 'F', tooltip: '防守当前位置',
            onClick: () => {
              for (const u of selectedUnits) {
                store.setUnitWaypoints(u.id, [{ ...u.position }], UnitState.GUARDING);
              }
            }
          }
        );
      }

      if (unit.data.canHarvest) {
        buttons.push(
          { id: 'harvest', icon: '⛏️', label: '采集', hotkey: 'H', tooltip: '右键点击资源点进行采集',
            active: pendingCommand === 'harvest',
            onClick: () => { setPendingCommand('harvest'); inputHandler.setPendingCommandExternal('harvest'); } }
        );
      }

      buttons.push(
        { id: 'stop', icon: '⏹️', label: '停止', hotkey: 'S', tooltip: '停止当前动作',
          onClick: () => {
            for (const u of selectedUnits) {
              store.clearUnitWaypoints(u.id);
            }
          }
        },
        { id: 'guard', icon: '🛡️', label: '警戒', hotkey: 'D', tooltip: '警戒模式',
          onClick: () => {
            for (const u of selectedUnits) {
              store.setUnitWaypoints(u.id, [{ ...u.position }], UnitState.GUARDING);
            }
          }
        }
      );

      // Load button: when infantry selected and friendly transport nearby
      if (currentPlayer && INFANTRY_TYPES.has(unit.type) && !unit.transportId) {
        const nearbyTransport = currentPlayer.units.find(u =>
          u.maxPassengers && u.passengers &&
          u.passengers.length < (u.maxPassengers || 0) &&
          !u.transportId &&
          getFactionGroup(u.faction) === getFactionGroup(unit.faction) &&
          getDistance(u.position, unit.position) < 3 * GAME_CONFIG.TILE_SIZE
        );
        if (nearbyTransport) {
          buttons.push(
            { id: 'load', icon: '📥', label: '装载', hotkey: 'T', tooltip: '装载到附近运输载具 (T)',
              onClick: () => {
                for (const u of selectedUnits) {
                  if (INFANTRY_TYPES.has(u.type) && !u.transportId) {
                    const transport = currentPlayer.units.find(t =>
                      t.maxPassengers && t.passengers &&
                      t.passengers.length < (t.maxPassengers || 0) &&
                      !t.transportId &&
                      getFactionGroup(t.faction) === getFactionGroup(u.faction) &&
                      getDistance(t.position, u.position) < 3 * GAME_CONFIG.TILE_SIZE
                    );
                    if (transport) store.loadIntoTransport(u.id, transport.id);
                  }
                }
              }
            }
          );
        }
      }

      // Load button: when transport selected and friendly infantry nearby
      if (currentPlayer && unit.maxPassengers && unit.passengers &&
          unit.passengers.length < (unit.maxPassengers || 0)) {
        const nearbyInfantry = currentPlayer.units.find(u =>
          INFANTRY_TYPES.has(u.type) && !u.transportId &&
          getFactionGroup(u.faction) === getFactionGroup(unit.faction) &&
          getDistance(u.position, unit.position) < 3 * GAME_CONFIG.TILE_SIZE
        );
        if (nearbyInfantry) {
          buttons.push(
            { id: 'loadNearby', icon: '📥', label: '装载', hotkey: 'T', tooltip: '装载附近步兵 (T)',
              onClick: () => {
                const infantryToLoad = currentPlayer.units.filter(u =>
                  INFANTRY_TYPES.has(u.type) && !u.transportId &&
                  getFactionGroup(u.faction) === getFactionGroup(unit.faction) &&
                  getDistance(u.position, unit.position) < 3 * GAME_CONFIG.TILE_SIZE
                ).slice(0, (unit.maxPassengers || 0) - (unit.passengers?.length || 0));
                for (const inf of infantryToLoad) {
                  store.loadIntoTransport(inf.id, unit.id);
                }
              }
            }
          );
        }
      }

      // Unload button for transport vehicles with passengers
      if (unit.passengers && unit.passengers.length > 0) {
        buttons.push(
          { id: 'unload', icon: '🚪', label: '卸载', hotkey: 'U', tooltip: '卸载所有乘客 (U)',
            onClick: () => {
              for (const u of selectedUnits) {
                if (u.passengers && u.passengers.length > 0) {
                  store.unloadFromTransport(u.id);
                }
              }
            }
          }
        );
      }

      // Garrison button for infantry that can garrison buildings
      if (unit.data.canGarrison && !unit.garrisonedBuildingId) {
        buttons.push(
          { id: 'garrison', icon: '🏠', label: '驻扎', hotkey: 'G', tooltip: '进入建筑驻扎 (G)',
            onClick: () => {
              setPendingCommand('garrison');
              inputHandler.setPendingCommandExternal('garrison');
            }
          }
        );
      }

      // Ungarrison button for garrisoned buildings
      if (unit.garrisonedBuildingId) {
        buttons.push(
          { id: 'ungarrison', icon: '🚶', label: '撤离', hotkey: 'G', tooltip: '撤离驻扎建筑 (G)',
            onClick: () => {
              store.ungarrisonBuilding(unit.garrisonedBuildingId!);
            }
          }
        );
      }

      // Deploy button for MCV and other deployable units
      if (unit.data.canDeploy && !unit.isDeploying) {
        buttons.push(
          { id: 'deploy', icon: '🏗️', label: '展开', hotkey: 'D', tooltip: '展开为建筑 (D)',
            onClick: () => {
              store.startDeploy(unit.id);
            }
          }
        );
      }

      // Cancel deploy button
      if (unit.isDeploying) {
        buttons.push(
          { id: 'cancelDeploy', icon: '❌', label: '取消展开', hotkey: 'D', tooltip: '取消展开 (D)',
            onClick: () => {
              store.cancelDeploy(unit.id);
            }
          }
        );
      }

      // Capture button for engineers
      if (unit.data.canCapture) {
        buttons.push(
          { id: 'capture', icon: '🏴', label: '占领', hotkey: 'C', tooltip: '右键点击敌方/中立建筑进行占领 (C)',
            active: pendingCommand === 'capture',
            onClick: () => {
              setPendingCommand('capture');
              inputHandler.setPendingCommandExternal('capture');
            }
          }
        );
      }

      // Repair button for damaged vehicles (not infantry, not airborne, not harvesters)
      const isVehicle = !INFANTRY_TYPES.has(unit.type) && !unit.data.isAirborne && !unit.data.canHarvest;
      if (isVehicle && unit.health < unit.maxHealth) {
        const hasRepairFactory = currentPlayer?.buildings.some(b =>
          b.type === BuildingType.REPAIR && b.isConstructed
        );
        buttons.push(
          { id: 'repairFactory', icon: '🔧', label: '维修', hotkey: 'E', tooltip: '前往维修工厂维修',
            disabled: !hasRepairFactory || unit.isRepairingAtFactory,
            active: unit.isRepairingAtFactory,
            onClick: () => {
              for (const u of selectedUnits) {
                if (u.health < u.maxHealth) {
                  store.sendToRepairFactory(u.id);
                }
              }
            }
          }
        );
      }

      return buttons;
    }

    if (selectedBuilding) {
      const buttons: ActionButton[] = [];

      if (!selectedBuilding.isConstructed) {
        buttons.push(
          { id: 'sell', icon: '💰', label: '取消', hotkey: 'S', tooltip: '取消建造并回收资金',
            onClick: () => { store.sellBuilding(selectedBuilding.id); } }
        );
      } else {
        buttons.push(
          { id: 'repair', icon: '🔧', label: '修理', hotkey: 'R', tooltip: selectedBuilding.isRepairing ? '停止修理' : '修理建筑',
            disabled: selectedBuilding.health >= selectedBuilding.maxHealth && !selectedBuilding.isRepairing,
            active: selectedBuilding.isRepairing,
            onClick: () => { store.repairBuilding(selectedBuilding.id); } },
          { id: 'sell', icon: '💰', label: '出售', hotkey: 'Del', tooltip: '出售建筑回收50%资金',
            onClick: () => { store.sellBuilding(selectedBuilding.id); } },
          { id: 'rally', icon: '📍', label: '集结点', hotkey: 'Q',
            tooltip: '右键点击地图设置集结点',
            active: pendingCommand === 'rally',
            onClick: () => { setPendingCommand('rally'); inputHandler.setPendingCommandExternal('rally'); } }
        );

        // Ungarrison button for garrisoned buildings
        if (selectedBuilding.isGarrisonable && (selectedBuilding.garrisonedUnits?.length ?? 0) > 0) {
          buttons.push(
            { id: 'ungarrison', icon: '🚶', label: `撤离(${selectedBuilding.garrisonedUnits?.length}/${selectedBuilding.maxGarrison})`, hotkey: 'G',
              tooltip: '撤离所有驻扎步兵',
              onClick: () => { store.ungarrisonBuilding(selectedBuilding.id); } }
          );
        }

        // Repair bridge button
        if (selectedBuilding.isBridge && selectedBuilding.isBridgeDestroyed) {
          buttons.push(
            { id: 'repairBridge', icon: '🔨', label: '修复桥梁', hotkey: 'B',
              tooltip: '工程师修复桥梁(500$)',
              disabled: (currentPlayer?.money ?? 0) < 500,
              onClick: () => { store.repairBridge(selectedBuilding.id); } }
          );
        }

        if (selectedBuilding.data.canProduce) {
          const factionUnits = UNITS_BY_FACTION[currentPlayer?.faction || selectedBuilding.faction] || {};
          const hasIndustrialPlant = currentPlayer?.buildings.some(
            b => b.type === BuildingType.INDUSTRIAL_PLANT && b.isConstructed && b.isPowered
          ) || false;
          selectedBuilding.data.canProduce.forEach((itemType) => {
            if (typeof itemType !== 'string') return;
            const unitData = factionUnits[itemType] as UnitData | undefined;
            const name = unitData?.name || itemType;
            const baseCost = unitData?.cost || 0;
            // Industrial Plant: 25% discount for vehicles
            const isVehicle = unitData && !INFANTRY_TYPES.has(itemType as UnitType) && itemType !== UnitType.MINER && !unitData.isNaval;
            const finalCost = (isVehicle && hasIndustrialPlant) ? Math.floor(baseCost * 0.75) : baseCost;
            const discountLabel = (isVehicle && hasIndustrialPlant && baseCost !== finalCost) ? ` ~~$${baseCost}~~` : '';
            buttons.push({
              id: `produce-${itemType}`,
              icon: '🏗️',
              label: name,
              hotkey: '',
              tooltip: `${name} - $${finalCost}${discountLabel}`,
              onClick: () => produceUnit(selectedBuilding.id, itemType as UnitType)
            });
          });
        }

        // Superweapon activation buttons
        if (selectedBuilding.superweaponReady) {
          if (selectedBuilding.type === BuildingType.NUCLEAR_SILO) {
            buttons.push({
              id: 'activateNuke',
              icon: '☢️',
              label: '核弹攻击',
              hotkey: 'N',
              tooltip: '选择目标位置发射核弹',
              onClick: () => {
                inputHandler.setPendingCommandExternal('superweapon_nuke');
              }
            });
          } else if (selectedBuilding.type === BuildingType.IRON_CURTAIN) {
            buttons.push({
              id: 'activateIronCurtain',
              icon: '🛡️',
              label: '铁幕护盾',
              hotkey: 'I',
              tooltip: '选择目标位置施加无敌护盾',
              onClick: () => {
                inputHandler.setPendingCommandExternal('superweapon_ironcurtain');
              }
            });
          } else if (selectedBuilding.type === BuildingType.CHRONOSPHERE) {
            buttons.push({
              id: 'activateChronosphere',
              icon: '🌀',
              label: '超时空传送',
              hotkey: 'C',
              tooltip: '选择源位置和目标位置传送单位',
              onClick: () => {
                inputHandler.setPendingCommandExternal('superweapon_chronosphere');
              }
            });
          }
        }
      }

      return buttons;
    }

    return [];
  }, [selectedUnits, selectedBuilding, produceUnit, currentPlayer?.faction, pendingCommand, currentPlayer?.units]);

  const handleButtonHover = (buttonId: string | null) => {
    setHoveredButton(buttonId);
    if (buttonId) {
      const button = getActionButtons().find(b => b.id === buttonId);
      if (button?.tooltip) {
        const pos = mousePosRef.current;
        const adjustedX = Math.min(pos.x + 15, window.innerWidth - 270);
        const adjustedY = Math.min(pos.y + 15, window.innerHeight - 80);
        gameUIController.showTooltip({
          title: button.label,
          content: button.tooltip,
          position: { x: adjustedX, y: adjustedY },
          type: 'info'
        });
      }
    } else {
      gameUIController.hideTooltip();
    }
  };

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handleDismissNotification = (id: string) => {
    setDismissingIds(prev => new Set(prev).add(id));
    const timer = setTimeout(() => {
      gameUIController.dismissNotification(id);
      setDismissingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
    dismissTimerRef.current.push(timer);
  };

  const renderUnitInfo = () => {
    if (selectedUnits.length === 0) return null;

    const unit = selectedUnits[0];
    const healthPercent = (unit.health / unit.maxHealth) * 100;

    // Group selected units by type for multi-selection display
    const unitTypeGroups = selectedUnits.length > 1
      ? Object.entries(
          selectedUnits.reduce<Record<string, { name: string; count: number }>>((acc, u) => {
            const key = u.type;
            if (!acc[key]) acc[key] = { name: u.data.name || u.type, count: 0 };
            acc[key].count++;
            return acc;
          }, {})
        ).map(([_, v]) => v)
      : [];

    return (
      <div className="game-ui-panel unit-panel" role="region" aria-label="单位信息"
        ref={unitPanelRef}
        onMouseEnter={() => setShowUnitTooltip(true)}
        onMouseLeave={() => setShowUnitTooltip(false)}
      >
        <div className="panel-header">
          <h3>{unit.data.name}</h3>
          <span className="unit-count">
            {selectedUnits.length > 1 && `x${selectedUnits.length}`}
          </span>
        </div>

        {unitTypeGroups.length > 1 && (
          <div className="unit-type-groups">
            {unitTypeGroups.map((g, i) => (
              <span key={i} className="unit-type-group">
                {g.name} x{g.count}
              </span>
            ))}
          </div>
        )}

        <div className="unit-portrait">
          <div
            className="portrait-circle"
            style={{ backgroundColor: currentPlayer?.color }}
            aria-label="单位头像"
          >
            <span className="portrait-icon">
              {UNIT_PORTRAITS[unit.type] || '🪖'}
            </span>
          </div>
          <div className="portrait-ring" style={{ borderColor: currentPlayer?.color }} />
        </div>

        <div className="unit-stats" role="list">
          <div className="stat-row" role="listitem">
            <span className="stat-label">血量</span>
            <div className="health-bar" role="progressbar" aria-valuenow={healthPercent}>
              <div
                className="health-fill"
                style={{
                  width: `${healthPercent}%`,
                  backgroundColor: getHealthColor(healthPercent),
                }}
              />
              <span className="health-text">{unit.health}/{unit.maxHealth}</span>
            </div>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">攻击</span>
            <span className="stat-value stat-attack">{unit.data.attack}</span>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">护甲</span>
            <span className="stat-value stat-armor">{unit.data.armor}</span>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">速度</span>
            <span className="stat-value stat-speed">{unit.data.speed}</span>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">射程</span>
            <span className="stat-value stat-range">{unit.data.attackRange}</span>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">状态</span>
            <span className="stat-value state-badge">{unit.state}</span>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">等级</span>
            <span className={`stat-value rank-badge rank-${UnitRank[unit.rank].toLowerCase()}`}>
              {getRankLabel(unit.rank)}
            </span>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">击杀</span>
            <span className="stat-value stat-kills">{unit.kills}</span>
          </div>

          {unit.data.canHarvest && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">矿石</span>
              <div className="cargo-bar">
                <div
                  className="cargo-fill"
                  style={{ width: `${(unit.cargo / GAME_CONFIG.CARGO_CAPACITY) * 100}%` }}
                />
                <span className="cargo-text">{unit.cargo}/{GAME_CONFIG.CARGO_CAPACITY}</span>
              </div>
            </div>
          )}

          {unit.type === UnitType.CHRONO && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">传送</span>
              {unit.isChronoShifting ? (
                <div className="chrono-status">
                  <span className="chrono-text">传送充能中...</span>
                  <div className="chrono-progress-bar">
                    <div
                      className="chrono-progress-fill"
                      style={{ width: `${Math.max(0, (1 - (unit.chronoShiftTimer || 0) / 2)) * 100}%` }}
                    />
                  </div>
                </div>
              ) : unit.isChronoCooldown ? (
                <div className="chrono-status">
                  <span className="chrono-text cooldown">冷却中 ({Math.ceil(unit.chronoShiftTimer || 0)}s)</span>
                  <div className="chrono-progress-bar cooldown">
                    <div
                      className="chrono-progress-fill cooldown"
                      style={{ width: `${Math.max(0, (1 - (unit.chronoShiftTimer || 0) / 5)) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <span className="stat-value chrono-ready">传送就绪</span>
              )}
            </div>
          )}

          {unit.data.special && (
            <div className="special-ability">
              <span className="special-label">特殊能力</span>
              <span className="special-text">{unit.data.special}</span>
            </div>
          )}

          {unit.isDeploying && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">展开</span>
              <div className="build-progress-bar">
                <div
                  className="build-progress-fill"
                  style={{ width: `${Math.max(0, (1 - (unit.deployTimer || 0) / 5)) * 100}%`, backgroundColor: '#2196F3' }}
                />
                <span className="build-progress-text">
                  🏗️ 展开中 {Math.round(Math.max(0, (1 - (unit.deployTimer || 0) / 5)) * 100)}%
                </span>
              </div>
            </div>
          )}

          {unit.garrisonedBuildingId && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">状态</span>
              <span className="stat-value">🏠 驻扎中</span>
            </div>
          )}

          {unit.data.description && (
            <div className="unit-description">
              <span className="description-text">{unit.data.description}</span>
            </div>
          )}

          {unit.maxPassengers && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">乘客</span>
              <span className="stat-value">{unit.passengers?.length || 0}/{unit.maxPassengers}</span>
            </div>
          )}

          {unit.transportId && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">状态</span>
              <span className="stat-value state-badge">运输中</span>
            </div>
          )}
        </div>

        <div className="action-buttons">
          {getActionButtons().map(button => (
            <button
              key={button.id}
              className={`action-button ${button.disabled ? 'disabled' : ''} ${hoveredButton === button.id ? 'hovered' : ''} ${button.active ? 'active' : ''}`}
              disabled={button.disabled}
              onClick={button.onClick}
              onMouseEnter={() => handleButtonHover(button.id)}
              onMouseLeave={() => handleButtonHover(null)}
              title={`${button.label} (${button.hotkey})`}
              aria-label={button.label}
            >
              <span className="button-icon">{button.icon}</span>
              <span className="button-label">{button.label}</span>
              <span className="button-hotkey">{button.hotkey}</span>
            </button>
          ))}
        </div>

        <div className="stance-buttons">
          <span className="stance-label">姿态</span>
          {([
            { stance: UnitStance.AGGRESSIVE, label: '激进', hotkey: 'ALT+A', icon: '⚔️' },
            { stance: UnitStance.GUARD, label: '防御', hotkey: 'ALT+G', icon: '🛡️' },
            { stance: UnitStance.PASSIVE, label: '被动', hotkey: 'ALT+P', icon: '🕊️' },
          ] as const).map(({ stance, label, hotkey, icon }) => {
            const currentStance = unit.stance || UnitStance.GUARD;
            const isActive = currentStance === stance;
            return (
              <button
                key={stance}
                className={`action-button stance-button ${isActive ? 'active' : ''}`}
                onClick={() => {
                  const store = useGameStore.getState();
                  store.setUnitStance(selectedUnits.map(u => u.id), stance);
                }}
                title={`${label} (${hotkey})`}
                aria-label={label}
              >
                <span className="button-icon">{icon}</span>
                <span className="button-label">{label}</span>
                <span className="button-hotkey">{hotkey}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBuildingInfo = () => {
    if (!selectedBuilding) return null;

    const healthPercent = (selectedBuilding.health / selectedBuilding.maxHealth) * 100;

    return (
      <div className="game-ui-panel building-panel" role="region" aria-label="建筑信息"
        ref={buildingPanelRef}
        onMouseEnter={() => setShowBuildingTooltip(true)}
        onMouseLeave={() => setShowBuildingTooltip(false)}
      >
        <div className="panel-header">
          <h3>{selectedBuilding.data.name}</h3>
        </div>

        <div className="building-portrait">
          <div
            className="portrait-circle"
            style={{ backgroundColor: currentPlayer?.color }}
            aria-label="建筑图标"
          >
            <span className="portrait-icon">🏢</span>
          </div>
          <div className="portrait-ring" style={{ borderColor: currentPlayer?.color }} />
        </div>

        <div className="building-stats" role="list">
          <div className="stat-row" role="listitem">
            <span className="stat-label">血量</span>
            <div className="health-bar" role="progressbar" aria-valuenow={healthPercent}>
              <div
                className="health-fill"
                style={{
                  width: `${healthPercent}%`,
                  backgroundColor: getHealthColor(healthPercent),
                }}
              />
              <span className="health-text">{selectedBuilding.health}/{selectedBuilding.maxHealth}</span>
            </div>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">电力</span>
            <span className={`stat-value ${selectedBuilding.powerOutput - selectedBuilding.powerConsumption < 0 ? 'stat-negative' : 'stat-positive'}`}>
              {selectedBuilding.powerOutput > 0 ? '+' : ''}
              {selectedBuilding.powerOutput - selectedBuilding.powerConsumption}
            </span>
          </div>

          <div className="stat-row" role="listitem">
            <span className="stat-label">状态</span>
            <span className={`stat-value state-badge ${selectedBuilding.isConstructed ? (selectedBuilding.isPowered ? 'state-active' : 'state-warning') : 'state-building'}`}>
              {selectedBuilding.isConstructed
                ? selectedBuilding.isPowered ? '运作中' : '电力不足'
                : `建造中 ${Math.round(selectedBuilding.buildProgress * 100)}%`}
            </span>
          </div>

          {selectedBuilding.isRepairing && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">修理</span>
              <div className="build-progress-bar">
                <div
                  className="build-progress-fill"
                  style={{ width: `${(selectedBuilding.health / selectedBuilding.maxHealth) * 100}%`, backgroundColor: '#4CAF50' }}
                />
                <span className="build-progress-text">
                  🔧 修理中 {Math.round((selectedBuilding.health / selectedBuilding.maxHealth) * 100)}%
                </span>
              </div>
            </div>
          )}

          {selectedBuilding.isGarrisonable && selectedBuilding.isConstructed && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">驻军</span>
              <span className="stat-value">
                🏠 {selectedBuilding.garrisonedUnits?.length || 0}/{selectedBuilding.maxGarrison || selectedBuilding.data?.maxGarrison || 0}
              </span>
            </div>
          )}

          {selectedBuilding.isBridge && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">桥梁</span>
              <span className={`stat-value ${selectedBuilding.isBridgeDestroyed ? 'stat-negative' : 'stat-positive'}`}>
                {selectedBuilding.isBridgeDestroyed ? '❌ 已摧毁' : '✅ 完好'}
              </span>
            </div>
          )}

          {!selectedBuilding.isConstructed && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">建造进度</span>
              <div className="build-progress-bar">
                <div
                  className="build-progress-fill"
                  style={{ width: `${selectedBuilding.buildProgress * 100}%` }}
                />
                <span className="build-progress-text">
                  {Math.round(selectedBuilding.buildProgress * 100)}%
                </span>
              </div>
            </div>
          )}

          {selectedBuilding.superweaponChargeTime && selectedBuilding.isConstructed && (
            <div className="stat-row" role="listitem">
              <span className="stat-label">超武充能</span>
              {selectedBuilding.superweaponReady ? (
                <span className="stat-value superweapon-ready">✅ 就绪</span>
              ) : (
                <div className="build-progress-bar">
                  <div
                    className="build-progress-fill"
                    style={{
                      width: `${((selectedBuilding.superweaponChargeProgress || 0) / selectedBuilding.superweaponChargeTime) * 100}%`,
                      backgroundColor: '#FF6600',
                    }}
                  />
                  <span className="build-progress-text">
                    {Math.round(((selectedBuilding.superweaponChargeProgress || 0) / selectedBuilding.superweaponChargeTime) * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="action-buttons">
          {getActionButtons().map(button => (
            <button
              key={button.id}
              className={`action-button ${button.disabled ? 'disabled' : ''} ${hoveredButton === button.id ? 'hovered' : ''} ${button.active ? 'active' : ''}`}
              disabled={button.disabled}
              onClick={button.onClick}
              onMouseEnter={() => handleButtonHover(button.id)}
              onMouseLeave={() => handleButtonHover(null)}
              title={`${button.label} (${button.hotkey})`}
              aria-label={button.label}
            >
              <span className="button-icon">{button.icon}</span>
              <span className="button-label">{button.label}</span>
              <span className="button-hotkey">{button.hotkey}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderAlertNotification = () => {
    if (!alertLevel || alertLevel === 'none') return null;

    const alertConfig = {
      low: { color: 'var(--health-high)', icon: '💚', text: '低威胁', className: 'alert-low' },
      medium: { color: 'var(--health-medium)', icon: '💛', text: '中威胁', className: 'alert-medium' },
      high: { color: '#FF8800', icon: '🧡', text: '高威胁', className: 'alert-high' },
      critical: { color: 'var(--health-low)', icon: '❤️', text: '严重威胁', className: 'alert-critical' },
      extreme: { color: 'var(--health-critical)', icon: '💔', text: '紧急警报', className: 'alert-extreme' }
    };

    const config = alertConfig[alertLevel];

    return (
      <div
        className={`alert-notification ${config.className}`}
        style={{ borderColor: config.color }}
        role="alert"
        aria-live="polite"
      >
        <span className="alert-icon">{config.icon}</span>
        <span className="alert-text">{config.text}</span>
        <div className="alert-pulse" style={{ backgroundColor: config.color }} />
      </div>
    );
  };

  const renderNotifications = () => {
    if (uiState.notifications.length === 0) return null;

    return (
      <div className="notifications-container" role="log" aria-live="polite">
        {uiState.notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification notification-${notification.type} ${dismissingIds.has(notification.id) ? 'dismissing' : ''}`}
          >
            <span className="notification-icon">
              {notification.type === 'info' && 'ℹ️'}
              {notification.type === 'success' && '✅'}
              {notification.type === 'warning' && '⚠️'}
              {notification.type === 'error' && '❌'}
            </span>
            <span className="notification-message">{notification.message}</span>
            <div className="notification-timer" style={{ animationDuration: `${notification.duration}ms` }} />
            <button
              className="notification-close"
              onClick={() => handleDismissNotification(notification.id)}
              aria-label="关闭通知"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderContextMenu = () => {
    if (!uiState.contextMenu) return null;

    const renderMenuItems = (items: ContextMenuItem[], depth: number = 0) => {
      return items.map(item => (
        <div key={item.id} className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}>
          <button
            className="context-menu-button"
            disabled={item.disabled}
            onClick={() => !item.disabled && item.action()}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
            {item.hotkey && <span className="context-menu-hotkey">{item.hotkey}</span>}
            {item.submenu && <span className="context-menu-arrow">▶</span>}
          </button>
          {item.submenu && depth === 0 && (
            <div className="context-submenu">
              {renderMenuItems(item.submenu, depth + 1)}
            </div>
          )}
        </div>
      ));
    };

    const menuX = Math.min(uiState.contextMenu.x, window.innerWidth - 200);
    const menuY = Math.min(uiState.contextMenu.y, window.innerHeight - 300);

    return (
      <div
        className="context-menu-overlay"
        onClick={() => gameUIController.hideContextMenu()}
      >
        <div
          className="context-menu"
          style={{ left: menuX, top: menuY }}
          onClick={(e) => e.stopPropagation()}
        >
          {renderMenuItems(uiState.contextMenu.items)}
        </div>
      </div>
    );
  };

  const renderTooltip = () => {
    if (!uiState.tooltip) return null;

    let { x, y } = uiState.tooltip.position;

    // Boundary check
    const tooltipWidth = 200; // estimated
    const tooltipHeight = 80; // estimated
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    if (x + tooltipWidth > screenWidth) {
      x = screenWidth - tooltipWidth - 10;
    }
    if (y + tooltipHeight > screenHeight) {
      y = screenHeight - tooltipHeight - 10;
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    return (
      <div
        className={`tooltip tooltip-${uiState.tooltip.type}`}
        style={{
          left: x,
          top: y
        }}
        role="tooltip"
      >
        <div className="tooltip-title">{uiState.tooltip.title}</div>
        <div className="tooltip-content">{uiState.tooltip.content}</div>
      </div>
    );
  };

  const renderDetailedTooltips = () => {
    const tooltips: React.ReactNode[] = [];

    if (showUnitTooltip && selectedUnits.length > 0) {
      const unit = selectedUnits[0];
      const veterancyBonus = unit.rank === UnitRank.VETERAN ? 1.1 : unit.rank === UnitRank.ELITE ? 1.3 : 1;
      const unitType = unit.data.isAirborne ? '空中单位' : unit.data.canHarvest ? '采集单位' : unit.data.canCapture ? '工程单位' : '地面单位';
      const unitData: Record<string, React.ReactNode> = {
        '名称': unit.data.name,
        '类型': unitType,
        '血量': `${Math.round(unit.health)}/${unit.maxHealth}`,
        '攻击': <>{unit.data.attack}{veterancyBonus > 1 && <span style={{ color: '#ffd700' }}> (+{Math.round(unit.data.attack * (veterancyBonus - 1))})</span>}</>,
        '射程': unit.data.attackRange,
        '攻速': unit.data.attackSpeed,
        '护甲': unit.data.armor,
        '速度': unit.data.speed,
        '视野': unit.data.vision,
        '造价': `$${unit.data.cost}`,
      };
      if (unit.data.special) unitData['特殊能力'] = unit.data.special;
      unitData['等级'] = getRankLabel(unit.rank);
      unitData['击杀'] = unit.kills;
      tooltips.push(
        <DetailedTooltip key="unit-tooltip" targetRef={unitPanelRef} type="unit" data={unitData} />
      );
    }

    if (showBuildingTooltip && selectedBuilding) {
      const b = selectedBuilding;
      const buildingData: Record<string, React.ReactNode> = {
        '名称': b.data.name,
        '类型': b.type,
        '血量': `${Math.round(b.health)}/${b.maxHealth}`,
        '电力': `${b.powerOutput > 0 ? '+' + b.powerOutput : ''}${b.powerConsumption > 0 ? '-' + b.powerConsumption : ''}`,
        '造价': `$${b.cost}`,
        '建造时间': `${b.buildTime}s`,
      };
      if (b.data.canProduce && b.data.canProduce.length > 0) {
        const factionUnits = UNITS_BY_FACTION[currentPlayer?.faction || b.faction] || {};
        buildingData['可生产'] = b.data.canProduce.map(t => {
          const ud = factionUnits[t as string] as UnitData | undefined;
          return ud?.name || t;
        }).join(', ');
      }
      if (b.superweaponChargeTime && b.isConstructed) {
        if (b.superweaponReady) {
          buildingData['超武状态'] = '✅ 就绪';
        } else {
          const pct = Math.round(((b.superweaponChargeProgress || 0) / b.superweaponChargeTime) * 100);
          buildingData['超武充能'] = `${pct}%`;
        }
      }
      if (b.oreStorage !== undefined) {
        buildingData['矿石存储'] = `${Math.round(b.oreStorage)}/${b.maxOreStorage || 1000}`;
      }
      tooltips.push(
        <DetailedTooltip key="building-tooltip" targetRef={buildingPanelRef} type="building" data={buildingData} />
      );
    }

    return tooltips;
  };

  const renderObserverPanel = () => {
    if (!isObserverMode) return null;

    return (
      <div className="observer-panel" role="region" aria-label="观战面板">
        <div className="observer-header">
          <h3>👁️ 观战模式</h3>
        </div>
        <div className="observer-players">
          {aiPlayers.map(ai => (
            <div key={ai.id} className={`observer-player ${ai.isDefeated ? 'defeated' : ''}`}>
              <div className="observer-player-header">
                <span className="observer-player-color" style={{ backgroundColor: ai.color }} />
                <span className="observer-player-name">{ai.name}</span>
                {ai.isDefeated && <span className="observer-defeated-tag">已击败</span>}
              </div>
              <div className="observer-player-stats">
                <div className="observer-stat">
                  <span className="observer-stat-label">💰</span>
                  <span className="observer-stat-value">{Math.floor(ai.money)}</span>
                </div>
                <div className="observer-stat">
                  <span className="observer-stat-label">🏭</span>
                  <span className="observer-stat-value">{ai.buildings.filter(b => b.isConstructed).length}</span>
                </div>
                <div className="observer-stat">
                  <span className="observer-stat-label">🎖️</span>
                  <span className="observer-stat-value">{ai.units.length}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="observer-speed">
          <span className="observer-speed-label">速度</span>
          {[1, 2, 3, 4].map(speed => (
            <button
              key={speed}
              className={`observer-speed-btn ${gameSpeed === speed ? 'active' : ''}`}
              onClick={() => setGameSpeed(speed as 1 | 2 | 3 | 4)}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderUnitResponse = () => {
    if (!unitResponse || isObserverMode) return null;

    return (
      <div className="unit-response" key="unit-response">
        {unitResponse}
      </div>
    );
  };

  const renderAchievementNotification = () => {
    if (!newAchievement) return null;

    return (
      <div className="achievement-notification" key={newAchievement.id}>
        <span className="achievement-icon">{newAchievement.icon}</span>
        <div className="achievement-info">
          <div className="achievement-title">{newAchievement.name}</div>
          <div className="achievement-desc">{newAchievement.description}</div>
        </div>
      </div>
    );
  };

  // Auto-dismiss achievement notification after 4 seconds
  useEffect(() => {
    if (newAchievement) {
      const timer = setTimeout(() => {
        clearNewAchievement();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [newAchievement, clearNewAchievement]);

  // Sync pending command state from InputHandler
  useEffect(() => {
    const interval = setInterval(() => {
      const cmd = inputHandler.getPendingCommandType();
      const cmdStr = cmd || null;
      if (cmdStr !== pendingCommand) {
        setPendingCommand(cmdStr);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [pendingCommand]);

  // Cleanup dismiss timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of dismissTimerRef.current) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <>
      {pendingCommand && !isObserverMode && (
        <div className="pending-command-indicator">
          {pendingCommand === 'attackMove' ? '⚔️ 攻击移动 - 右键点击目标位置' :
           pendingCommand === 'patrol' ? '🔄 巡逻 - 右键点击路径点 (Shift+右键追加)' :
           pendingCommand === 'capture' ? '🏴 占领 - 右键点击敌方/中立建筑' :
           pendingCommand === 'harvest' ? '⛏️ 采集 - 右键点击资源点' :
           pendingCommand === 'rally' ? '📍 集结点 - 右键点击地图设置集结点' :
           pendingCommand === 'superweapon_nuke' ? '☢️ 核弹攻击 - 右键点击目标位置' :
           pendingCommand === 'superweapon_ironcurtain' ? '🛡️ 铁幕护盾 - 右键点击目标位置' :
           pendingCommand === 'superweapon_chronosphere' ? '🌀 超时空传送 - 右键点击源位置' :
           pendingCommand === 'superweapon_chronosphere_target' ? '🌀 超时空传送 - 右键点击目标位置' :
           pendingCommand}
          <button className="pending-command-cancel" onClick={() => { setPendingCommand(null); inputHandler.clearPendingCommand(); }}>✕ 取消</button>
        </div>
      )}
      {!isObserverMode && <ResourceBar />}
      {!isObserverMode && (
        <button className="pause-button" onClick={togglePause} title="暂停 (空格键)">
          {isPaused ? '▶' : '⏸'}
        </button>
      )}
      {!isObserverMode && (
        <button className="menu-button" onClick={() => setShowMenuConfirm(true)} title="返回主菜单">
          ☰
        </button>
      )}
      {!isObserverMode && renderAlertNotification()}
      {!isObserverMode && renderUnitInfo()}
      {!isObserverMode && renderBuildingInfo()}
      {renderObserverPanel()}
      {renderUnitResponse()}
      {renderAchievementNotification()}
      {renderNotifications()}
      {renderContextMenu()}
      {renderTooltip()}
      {renderDetailedTooltips()}
      <Minimap />
      {!isObserverMode && (
        <div className="idle-buttons">
          <button className="idle-button idle-miner-button" onClick={selectIdleMiners} title="选择空闲矿车">
            🚛
          </button>
          <button className="idle-button idle-military-button" onClick={selectIdleMilitary} title="选择空闲部队">
            ⚔️
          </button>
        </div>
      )}
      <SettingsPanel />
      <SaveLoadPanel mode="save" />
      <SaveLoadPanel mode="load" />
      <PerformanceOverlay enabled={false} compact />
      <ShortcutsOverlay />
      <Scoreboard />
      {tutorialActive && (
        <div className="tutorial-overlay">
          <div className="tutorial-panel">
            <div className="tutorial-step-indicator">
              {tutorialStep + 1} / {TUTORIAL_STEPS.length}
            </div>
            <h3 className="tutorial-title">{TUTORIAL_STEPS[tutorialStep].title}</h3>
            <p className="tutorial-text">{TUTORIAL_STEPS[tutorialStep].text}</p>
            <div className="tutorial-buttons">
              {tutorialStep > 0 && (
                <button onClick={() => setTutorialStep(tutorialStep - 1)}>上一步</button>
              )}
              {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                <button onClick={() => setTutorialStep(tutorialStep + 1)}>下一步</button>
              ) : (
                <button onClick={endTutorial}>开始游戏</button>
              )}
              <button onClick={endTutorial} className="tutorial-skip">跳过教程</button>
            </div>
          </div>
        </div>
      )}
      {showMenuConfirm && (
        <div className="confirm-modal">
          <div className="confirm-content">
            <p>确定返回主菜单？</p>
            <p className="confirm-hint">当前进度将丢失</p>
            <div className="confirm-buttons">
              <button onClick={() => { useGameStore.getState().resetGame(); setShowMenuConfirm(false); }}>确定</button>
              <button onClick={() => setShowMenuConfirm(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
