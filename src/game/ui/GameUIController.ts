import { HotkeyManager, HotkeyAction, HotkeyBinding } from '../systems/HotkeyManager';

export interface TooltipData {
  title: string;
  content: string;
  position: { x: number; y: number };
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface NotificationData {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  duration: number;
  timestamp: number;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  hotkey?: string;
  disabled?: boolean;
  action: () => void;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuData {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export type UIPanel = 'none' | 'unit' | 'building' | 'build' | 'minimap';

export interface GameUIState {
  activePanel: UIPanel;
  tooltip: TooltipData | null;
  notifications: NotificationData[];
  contextMenu: ContextMenuData | null;
  showShortcutsOverlay: boolean;
  showMinimapExpanded: boolean;
  panelPositions: Record<UIPanel, { x: number; y: number }>;
  animationsEnabled: boolean;
}

const DEFAULT_UI_STATE: GameUIState = {
  activePanel: 'none',
  tooltip: null,
  notifications: [],
  contextMenu: null,
  showShortcutsOverlay: false,
  showMinimapExpanded: false,
  panelPositions: {
    none: { x: 0, y: 0 },
    unit: { x: 20, y: 70 },
    building: { x: 20, y: 70 },
    build: { x: 20, y: 70 },
    minimap: { x: 20, y: 70 }
  },
  animationsEnabled: true
};

const MAX_NOTIFICATIONS = 5;
const DEDUP_INTERVAL = 2000; // 2 seconds

/**
 * Manages UI-specific state (active panel, tooltips, notifications, context menus, etc.)
 * that is separate from game state.
 *
 * Uses its own pub/sub pattern rather than GameEventBus because:
 * - UI state changes are local to the UI layer and don't need cross-system broadcasting
 * - The listener pattern provides synchronous, deterministic updates for UI rendering
 * - GameEventBus is designed for game-level events (combat, resources, etc.),
 *   while this controller manages ephemeral UI concerns like hover state and notifications
 */
export class GameUIController {
  private static instance: GameUIController;
  private state: GameUIState = { ...DEFAULT_UI_STATE };
  private listeners: Set<(state: GameUIState) => void> = new Set();
  private notificationIdCounter: number = 0;
  private tooltipTimeoutId: number | null = null;
  private hotkeyManager: HotkeyManager | null = null;
  private contextMenuCloseHandler: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): GameUIController {
    if (!GameUIController.instance) {
      GameUIController.instance = new GameUIController();
    }
    return GameUIController.instance;
  }

  private hotkeyUnsub?: () => void;

  public initialize(hotkeyManager: HotkeyManager): void {
    // Prevent duplicate initialization
    if (this.hotkeyUnsub) {
      this.hotkeyUnsub();
      this.hotkeyUnsub = undefined;
    }
    this.hotkeyManager = hotkeyManager;
    this.setupHotkeyListeners();
  }

  private setupHotkeyListeners(): void {
    if (!this.hotkeyManager) return;

    this.hotkeyUnsub = this.hotkeyManager.onHotkey((action: HotkeyAction) => {
      switch (action) {
        case 'deselect':
          this.hideContextMenu();
          break;
        case 'build':
          this.setActivePanel('build');
          break;
        case 'sell':
        case 'repair':
          this.setActivePanel('building');
          break;
        case 'upgrade':
          this.setActivePanel('building');
          break;
        default:
          break;
      }
    });
  }

  public getState(): GameUIState {
    return { ...this.state };
  }

  public subscribe(listener: (state: GameUIState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  public setActivePanel(panel: UIPanel): void {
    if (this.state.activePanel !== panel) {
      this.state.activePanel = panel;
      this.notifyListeners();
    }
  }

  public showTooltip(data: TooltipData): void {
    if (this.tooltipTimeoutId) {
      clearTimeout(this.tooltipTimeoutId);
    }

    this.state.tooltip = data;
    this.notifyListeners();

    this.tooltipTimeoutId = window.setTimeout(() => {
      this.hideTooltip();
    }, 5000);
  }

  public hideTooltip(): void {
    if (this.tooltipTimeoutId) {
      clearTimeout(this.tooltipTimeoutId);
      this.tooltipTimeoutId = null;
    }
    this.state.tooltip = null;
    this.notifyListeners();
  }

  public showNotification(
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
    duration: number = 3000
  ): string {
    // Deduplication: skip if same message appeared within DEDUP_INTERVAL
    const now = Date.now();
    const isDuplicate = this.state.notifications.some(n =>
      n.message === message && now - n.timestamp < DEDUP_INTERVAL
    );
    if (isDuplicate) return '';

    const id = `notification_${++this.notificationIdCounter}`;
    const notification: NotificationData = {
      id,
      message,
      type,
      duration,
      timestamp: now
    };

    this.state.notifications.push(notification);

    // Cap: remove oldest if over max
    while (this.state.notifications.length > MAX_NOTIFICATIONS) {
      this.state.notifications.shift();
    }

    this.notifyListeners();

    if (duration > 0) {
      window.setTimeout(() => {
        this.dismissNotification(id);
      }, duration);
    }

    return id;
  }

  public dismissNotification(id: string): void {
    const index = this.state.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.state.notifications.splice(index, 1);
      this.notifyListeners();
    }
  }

  public showContextMenu(data: ContextMenuData): void {
    this.removeContextMenuCloseHandler();

    this.state.contextMenu = data;
    this.notifyListeners();

    this.contextMenuCloseHandler = () => {
      this.hideContextMenu();
    };

    setTimeout(() => {
      if (this.contextMenuCloseHandler) {
        document.addEventListener('click', this.contextMenuCloseHandler);
      }
    }, 0);
  }

  public hideContextMenu(): void {
    this.removeContextMenuCloseHandler();
    this.state.contextMenu = null;
    this.notifyListeners();
  }

  private removeContextMenuCloseHandler(): void {
    if (this.contextMenuCloseHandler) {
      document.removeEventListener('click', this.contextMenuCloseHandler);
      this.contextMenuCloseHandler = null;
    }
  }

  public toggleShortcutsOverlay(): void {
    this.state.showShortcutsOverlay = !this.state.showShortcutsOverlay;
    this.notifyListeners();
  }

  public toggleMinimapExpanded(): void {
    this.state.showMinimapExpanded = !this.state.showMinimapExpanded;
    this.notifyListeners();
  }

  public toggleAnimations(): void {
    this.state.animationsEnabled = !this.state.animationsEnabled;
    this.notifyListeners();

    if (this.state.animationsEnabled) {
      document.body.classList.remove('no-animations');
    } else {
      document.body.classList.add('no-animations');
    }
  }

  public updatePanelPosition(panel: UIPanel, x: number, y: number): void {
    this.state.panelPositions[panel] = { x, y };
    this.notifyListeners();
  }

  public getHotkeyForAction(actionId: string): string | null {
    if (!this.hotkeyManager) return null;
    const binding = this.hotkeyManager.getBindingForAction(actionId as HotkeyAction);
    if (!binding) return null;
    return this.hotkeyManager.getKeyDisplayString(actionId as HotkeyAction);
  }

  public getAllHotkeys(): HotkeyBinding[] {
    if (!this.hotkeyManager) return [];
    return this.hotkeyManager.getAllBindings();
  }

  public showUnitContextMenu(x: number, y: number, unitCount: number): void {
    const items: ContextMenuItem[] = [
      {
        id: 'move',
        label: '移动',
        icon: '🚶',
        hotkey: 'G',
        action: () => this.emitAction('move')
      },
      {
        id: 'attack',
        label: '攻击',
        icon: '⚔️',
        hotkey: 'A',
        action: () => this.emitAction('attack')
      },
      {
        id: 'patrol',
        label: '巡逻',
        icon: '🔄',
        hotkey: 'P',
        action: () => this.emitAction('patrol')
      },
      {
        id: 'stop',
        label: '停止',
        icon: '⏹️',
        hotkey: 'S',
        action: () => this.emitAction('stop')
      }
    ];

    if (unitCount > 1) {
      items.splice(2, 0, {
        id: 'split',
        label: '分裂选择',
        icon: '📋',
        action: () => this.emitAction('split')
      });
    }

    items.push({
      id: 'formations',
      label: '编队',
      icon: '📑',
      action: () => {},
      submenu: [
        {
          id: 'formation_1',
          label: '编队 1',
          hotkey: 'Ctrl+1',
          action: () => this.emitAction('set_formation_1')
        },
        {
          id: 'formation_2',
          label: '编队 2',
          hotkey: 'Ctrl+2',
          action: () => this.emitAction('set_formation_2')
        },
        {
          id: 'formation_3',
          label: '编队 3',
          hotkey: 'Ctrl+3',
          action: () => this.emitAction('set_formation_3')
        }
      ]
    });

    this.showContextMenu({ x, y, items });
  }

  public showBuildingContextMenu(x: number, y: number): void {
    const items: ContextMenuItem[] = [
      {
        id: 'sell',
        label: '出售',
        icon: '💰',
        hotkey: 'S',
        action: () => this.emitAction('sell')
      },
      {
        id: 'repair',
        label: '修理',
        icon: '🔧',
        hotkey: 'R',
        action: () => this.emitAction('repair')
      },
      {
        id: 'rally',
        label: '设置集结点',
        icon: '📍',
        hotkey: 'Q',
        action: () => this.emitAction('rally')
      }
    ];

    this.showContextMenu({ x, y, items });
  }

  public showEmptyContextMenu(x: number, y: number): void {
    const items: ContextMenuItem[] = [
      {
        id: 'build',
        label: '建造',
        icon: '🏗️',
        hotkey: 'B',
        action: () => {
          this.setActivePanel('build');
          this.emitAction('open_build_menu');
        }
      },
      {
        id: 'options',
        label: '选项',
        icon: '⚙️',
        action: () => this.emitAction('open_options')
      }
    ];

    this.showContextMenu({ x, y, items });
  }

  private actionListeners: Set<(action: string) => void> = new Set();

  public onAction(listener: (action: string) => void): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  private emitAction(action: string): void {
    this.actionListeners.forEach(listener => listener(action));
    this.hideContextMenu();
  }

  public reset(): void {
    this.state = { ...DEFAULT_UI_STATE };
    this.notifyListeners();
  }

  public dispose(): void {
    if (this.tooltipTimeoutId) {
      clearTimeout(this.tooltipTimeoutId);
      this.tooltipTimeoutId = null;
    }
    if (this.hotkeyUnsub) {
      this.hotkeyUnsub();
      this.hotkeyUnsub = undefined;
    }
    this.removeContextMenuCloseHandler();
    this.reset();
    this.listeners.clear();
    this.actionListeners.clear();
    this.hotkeyManager = null;
  }
}

export const gameUIController = GameUIController.getInstance();
