import Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';

/**
 * Available hotkey actions in the game
 * @public
 */
export type HotkeyAction =
  | 'selectAll'
  | 'deselect'
  | 'attack'
  | 'attackMove'
  | 'move'
  | 'stop'
  | 'patrol'
  | 'holdPosition'
  | 'build'
  | 'repair'
  | 'sell'
  | 'upgrade'
  | 'toggleRallyPoint'
  | 'gather'
  | 'retreat'
  | 'unload'
  | 'selectSameType'
  | 'stanceAggressive'
  | 'stanceGuard'
  | 'stancePassive'
  | 'group1'
  | 'group2'
  | 'group3'
  | 'group4'
  | 'group5'
  | 'group6'
  | 'group7'
  | 'group8'
  | 'group9'
  | 'selectGroup1'
  | 'selectGroup2'
  | 'selectGroup3'
  | 'selectGroup4'
  | 'selectGroup5'
  | 'selectGroup6'
  | 'selectGroup7'
  | 'selectGroup8'
  | 'selectGroup9'
  | 'addToGroup1'
  | 'addToGroup2'
  | 'addToGroup3'
  | 'addToGroup4'
  | 'addToGroup5'
  | 'addToGroup6'
  | 'addToGroup7'
  | 'addToGroup8'
  | 'addToGroup9'
  | 'cycleNextUnit';

/**
 * Represents a hotkey binding configuration
 * @public
 */
export interface HotkeyBinding {
  /** The action this binding triggers */
  action: HotkeyAction;
  /** Primary key or array of alternative keys */
  key: string | string[];
  /** Modifier keys required (e.g., Ctrl, Alt, Shift) */
  modifiers?: ('ctrl' | 'alt' | 'shift')[];
  /** Human-readable description of the action */
  description?: string;
  /** Scope where this binding is active */
  scope?: 'global' | 'game' | 'ui';
}

/**
 * Configuration options for hotkey system
 * @public
 */
export interface HotkeyConfig {
  /** Whether hotkeys are enabled */
  enabled: boolean;
  /** Whether to show key hints in UI */
  showKeyHints: boolean;
  /** Delay before key repeat starts (ms) */
  keyRepeatDelay: number;
  /** Interval between key repeats (ms) */
  keyRepeatInterval: number;
}

/**
 * Default hotkey configuration
 * @public
 */
export const HOTKEY_CONFIG: HotkeyConfig = {
  enabled: true,
  showKeyHints: true,
  keyRepeatDelay: 300,
  keyRepeatInterval: 50
};

/**
 * Default hotkey bindings for the game
 * @public
 */
export const DEFAULT_HOTKEY_BINDINGS: HotkeyBinding[] = [
  { action: 'deselect', key: 'ESC', description: '取消选择' },
  { action: 'stop', key: 'S', description: '停止' },
  { action: 'move', key: 'M', description: '移动' },
  { action: 'attackMove', key: 'A', description: '攻击移动' },
  { action: 'patrol', key: 'P', description: '巡逻' },
  { action: 'holdPosition', key: 'H', description: '保持位置' },
  { action: 'build', key: 'B', description: '建造' },
  { action: 'retreat', key: 'R', description: '撤退/维修' },
  { action: 'sell', key: 'DELETE', description: '出售' },
  { action: 'toggleRallyPoint', key: 'Q', description: '集结点' },
  { action: 'gather', key: 'G', description: '集合' },
  { action: 'unload', key: 'U', description: '卸载乘客' },
  { action: 'selectSameType', key: 'E', description: '选择同类型单位' },
  { action: 'stanceAggressive', key: 'ALT+A', description: '激进姿态' },
  { action: 'stanceGuard', key: 'ALT+G', description: '防御姿态' },
  { action: 'stancePassive', key: 'ALT+P', description: '被动姿态' },
  { action: 'group1', key: 'CTRL+1', description: '编队1' },
  { action: 'group2', key: 'CTRL+2', description: '编队2' },
  { action: 'group3', key: 'CTRL+3', description: '编队3' },
  { action: 'group4', key: 'CTRL+4', description: '编队4' },
  { action: 'group5', key: 'CTRL+5', description: '编队5' },
  { action: 'group6', key: 'CTRL+6', description: '编队6' },
  { action: 'group7', key: 'CTRL+7', description: '编队7' },
  { action: 'group8', key: 'CTRL+8', description: '编队8' },
  { action: 'group9', key: 'CTRL+9', description: '编队9' },
  { action: 'selectGroup1', key: '1', description: '选择编队1' },
  { action: 'selectGroup2', key: '2', description: '选择编队2' },
  { action: 'selectGroup3', key: '3', description: '选择编队3' },
  { action: 'selectGroup4', key: '4', description: '选择编队4' },
  { action: 'selectGroup5', key: '5', description: '选择编队5' },
  { action: 'selectGroup6', key: '6', description: '选择编队6' },
  { action: 'selectGroup7', key: '7', description: '选择编队7' },
  { action: 'selectGroup8', key: '8', description: '选择编队8' },
  { action: 'selectGroup9', key: '9', description: '选择编队9' },
  { action: 'addToGroup1', key: 'SHIFT+CTRL+1', description: '添加到编队1' },
  { action: 'addToGroup2', key: 'SHIFT+CTRL+2', description: '添加到编队2' },
  { action: 'addToGroup3', key: 'SHIFT+CTRL+3', description: '添加到编队3' },
  { action: 'addToGroup4', key: 'SHIFT+CTRL+4', description: '添加到编队4' },
  { action: 'addToGroup5', key: 'SHIFT+CTRL+5', description: '添加到编队5' },
  { action: 'addToGroup6', key: 'SHIFT+CTRL+6', description: '添加到编队6' },
  { action: 'addToGroup7', key: 'SHIFT+CTRL+7', description: '添加到编队7' },
  { action: 'addToGroup8', key: 'SHIFT+CTRL+8', description: '添加到编队8' },
  { action: 'addToGroup9', key: 'SHIFT+CTRL+9', description: '添加到编队9' },
  { action: 'cycleNextUnit', key: 'TAB', description: '循环选择单位' }
];

/**
 * Represents a group of units that can be selected together
 * @public
 */
export interface UnitGroup {
  /** Unique identifier for the group (1-9) */
  id: number;
  /** Set of unit IDs in this group */
  unitIds: Set<string>;
  /** Hotkey string for this group */
  hotkey: string;
}

/**
 * Callback function type for hotkey events
 * @public
 */
export type HotkeyCallback = (action: HotkeyAction, event?: unknown) => void;

/**
 * Manages hotkey bindings and keyboard input for the game
 * @public
 */
export class HotkeyManager {
  private scene: Phaser.Scene;
  private config: HotkeyConfig;
  private bindings: Map<string, HotkeyBinding> = new Map();
  private keyMap: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private callbacks: Set<HotkeyCallback> = new Set();
  private enabled: boolean = true;
  private keyRepeatTimers: Map<string, { delay: number; interval: number; lastTime: number }> = new Map();

  /**
   * Creates a new HotkeyManager instance
   * @param scene - The Phaser scene this manager belongs to
   * @param config - Optional configuration overrides
   */
  constructor(scene: Phaser.Scene, config: Partial<HotkeyConfig> = {}) {
    this.scene = scene;
    this.config = { ...HOTKEY_CONFIG, ...config };

    this.setupDefaultBindings();
    this.registerKeys();
  }

  /**
   * Sets up default hotkey bindings
   * @internal
   */
  private setupDefaultBindings(): void {
    DEFAULT_HOTKEY_BINDINGS.forEach(binding => {
      this.bindBinding(binding);
    });
  }

  /**
   * Registers keyboard keys with Phaser
   * @internal
   */
  private registerKeys(): void {
    const keyCodes = [
      'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      'ESC', 'ENTER', 'SPACE', 'BACKSPACE', 'TAB', 'CAPS_LOCK',
      'DELETE', 'INSERT', 'HOME', 'END', 'PAGE_UP', 'PAGE_DOWN',
      'UP', 'DOWN', 'LEFT', 'RIGHT',
      'CTRL', 'ALT', 'SHIFT', 'COMMAND'
    ];

    keyCodes.forEach(key => {
      try {
        const phaserKey = (this.scene.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin).addKey(key);
        this.keyMap.set(key, phaserKey);

        phaserKey.on('down', (event: unknown) => {
          this.handleKeyDown(key, event as { preventDefault?: () => void; stopPropagation?: () => void });
        });
      } catch (error) {
        console.warn(`Failed to register key: ${key}`, error);
      }
    });
  }

  private static readonly PAUSED_ALLOWED_ACTIONS = new Set(['pause', 'deselect', 'selectAll', 'toggleSettings', 'toggleShortcuts']);

  /**
   * Handles key down events
   * @param key - The key that was pressed
   * @param event - The keyboard event
   * @internal
   */
  private handleKeyDown(key: string, event?: { preventDefault?: () => void; stopPropagation?: () => void }): void {
    if (!this.enabled) return;

    const modifiers = this.getActiveModifiers();
    const bindingKey = this.getBindingKey(key, modifiers);
    const binding = this.bindings.get(bindingKey);

    // Check game pause state - allow only UI-related hotkeys when paused
    if (binding) {
      const gameState = useGameStore.getState();
      if (gameState.isPaused) {
        if (!HotkeyManager.PAUSED_ALLOWED_ACTIONS.has(binding.action)) return;
      }
    }

    if (binding) {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      const timerKey = bindingKey;
      const timer = this.keyRepeatTimers.get(timerKey);

      if (timer) {
        const now = Date.now();
        if (now - timer.lastTime < timer.delay) {
          return;
        }
        timer.lastTime = now;
      } else {
        this.keyRepeatTimers.set(timerKey, {
          delay: this.config.keyRepeatDelay,
          interval: this.config.keyRepeatInterval,
          lastTime: Date.now()
        });
      }

      this.callbacks.forEach(callback => {
        callback(binding.action, event);
      });
    }
  }

  /**
   * Gets currently active modifier keys
   * @returns Array of active modifier key names
   * @internal
   */
  private getActiveModifiers(): ('ctrl' | 'alt' | 'shift')[] {
    const modifiers: ('ctrl' | 'alt' | 'shift')[] = [];

    const ctrlKey = this.keyMap.get('CTRL');
    if (ctrlKey?.isDown) modifiers.push('ctrl');

    const altKey = this.keyMap.get('ALT');
    if (altKey?.isDown) modifiers.push('alt');

    const shiftKey = this.keyMap.get('SHIFT');
    if (shiftKey?.isDown) modifiers.push('shift');

    return modifiers;
  }

  /**
   * Creates a binding key from key and modifiers
   * @param key - Base key name
   * @param modifiers - Active modifiers
   * @returns Binding key string
   * @internal
   */
  private getBindingKey(key: string, modifiers: ('ctrl' | 'alt' | 'shift')[]): string {
    const sortedModifiers = [...modifiers].sort();
    if (sortedModifiers.length > 0) {
      return `${sortedModifiers.join('+')}+${key}`;
    }
    return key;
  }

  private bindBinding(binding: HotkeyBinding): void {
    const keys = Array.isArray(binding.key) ? binding.key : [binding.key];

    keys.forEach(key => {
      const normalizedKey = this.normalizeKey(key);
      const modifiers = this.extractModifiers(normalizedKey);
      const baseKey = this.extractBaseKey(normalizedKey);
      const bindingKey = this.getBindingKey(baseKey, modifiers);

      const existing = this.bindings.get(bindingKey);
      if (existing) {
        console.warn(`[HotkeyManager] Key binding conflict: "${bindingKey}" already bound to "${existing.action}", overwriting with "${binding.action}"`);
      }

      this.bindings.set(bindingKey, {
        ...binding,
        key: baseKey,
        modifiers
      });
    });
  }

  /**
   * Normalizes a key string to uppercase without spaces
   * @param key - Key string to normalize
   * @returns Normalized key string
   * @internal
   */
  private normalizeKey(key: string): string {
    return key.toUpperCase().replace(/\s+/g, '');
  }

  /**
   * Extracts modifier keys from a normalized key string
   * @param key - Normalized key string containing modifiers
   * @returns Array of modifier key names
   * @internal
   */
  private extractModifiers(key: string): ('ctrl' | 'alt' | 'shift')[] {
    const modifiers: ('ctrl' | 'alt' | 'shift')[] = [];
    const parts = key.split('+');

    if (parts.includes('CTRL')) modifiers.push('ctrl');
    if (parts.includes('ALT')) modifiers.push('alt');
    if (parts.includes('SHIFT')) modifiers.push('shift');

    return modifiers;
  }

  /**
   * Extracts the base key from a normalized key string
   * @param key - Normalized key string
   * @returns Base key name
   * @internal
   */
  private extractBaseKey(key: string): string {
    const parts = key.split('+');
    return parts[parts.length - 1];
  }

  /**
   * Registers a callback for hotkey events
   * @param callback - Function to call when a hotkey is pressed
   * @returns Unsubscribe function
   */
  onHotkey(callback: HotkeyCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Removes a callback from hotkey events
   * @param callback - Callback function to remove
   */
  offHotkey(callback: HotkeyCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * Enables or disables the hotkey manager
   * @param enabled - Whether hotkeys should be active
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Checks if hotkeys are currently enabled
   * @returns True if hotkeys are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gets the binding for a specific action
   * @param action - The action to get binding for
   * @returns The binding or undefined if not found
   */
  getBindingForAction(action: HotkeyAction): HotkeyBinding | undefined {
    for (const binding of this.bindings.values()) {
      if (binding.action === action) {
        return binding;
      }
    }
    return undefined;
  }

  /**
   * Gets a human-readable string representation of the key binding
   * @param action - The action to get key string for
   * @returns Display string for the key binding
   */
  getKeyDisplayString(action: HotkeyAction): string {
    const binding = this.getBindingForAction(action);
    if (!binding) return '';

    const modifiers = binding.modifiers || [];
    const parts = [...modifiers.map(m => {
      switch (m) {
        case 'ctrl': return 'Ctrl';
        case 'alt': return 'Alt';
        case 'shift': return 'Shift';
        default: return m;
      }
    }), binding.key];

    return parts.join('+');
  }

  /**
   * Gets all registered key bindings
   * @returns Array of all bindings
   */
  getAllBindings(): HotkeyBinding[] {
    return Array.from(this.bindings.values());
  }

  /**
   * Cleans up resources used by this manager
   */
  dispose(): void {
    this.callbacks.clear();
    this.keyMap.forEach(key => key.off('down'));
    this.keyMap.clear();
    this.bindings.clear();
    this.keyRepeatTimers.clear();
  }
}

/**
 * Manages unit groups for selection and control
 * @public
 */
export class UnitGroupManager {
  private scene: Phaser.Scene;
  private groups: Map<number, UnitGroup> = new Map();
  private groupDisplayCounts: Map<number, number> = new Map();
  private onGroupChangeCallbacks: Set<(groupId: number, unitIds: string[]) => void> = new Set();
  private maxGroups: number = 9;

  /**
   * Creates a new UnitGroupManager instance
   * @param scene - The Phaser scene this manager belongs to
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    for (let i = 1; i <= this.maxGroups; i++) {
      this.groups.set(i, {
        id: i,
        unitIds: new Set(),
        hotkey: String(i)
      });
    }
  }

  /**
   * Creates or replaces a unit group
   * @param groupId - Group number (1-9)
   * @param unitIds - Array of unit IDs to include
   */
  createGroup(groupId: number, unitIds: string[]): void {
    if (groupId < 1 || groupId > this.maxGroups) {
      console.warn(`Invalid group ID: ${groupId}. Must be between 1 and ${this.maxGroups}`);
      return;
    }

    const group = this.groups.get(groupId);
    if (!group) return;

    group.unitIds.clear();
    unitIds.forEach(id => group.unitIds.add(id));

    this.groupDisplayCounts.set(groupId, unitIds.length);

    this.notifyGroupChange(groupId, unitIds);
  }

  /**
   * Adds units to an existing group
   * @param groupId - Group number (1-9)
   * @param unitIds - Array of unit IDs to add
   */
  addToGroup(groupId: number, unitIds: string[]): void {
    if (groupId < 1 || groupId > this.maxGroups) return;

    const group = this.groups.get(groupId);
    if (!group) return;

    unitIds.forEach(id => group.unitIds.add(id));

    this.groupDisplayCounts.set(groupId, group.unitIds.size);

    this.notifyGroupChange(groupId, Array.from(group.unitIds));
  }

  /**
   * Removes units from a group
   * @param groupId - Group number (1-9)
   * @param unitIds - Array of unit IDs to remove
   */
  removeFromGroup(groupId: number, unitIds: string[]): void {
    if (groupId < 1 || groupId > this.maxGroups) return;

    const group = this.groups.get(groupId);
    if (!group) return;

    unitIds.forEach(id => group.unitIds.delete(id));

    this.groupDisplayCounts.set(groupId, group.unitIds.size);

    this.notifyGroupChange(groupId, Array.from(group.unitIds));
  }

  /**
   * Clears all units from a group
   * @param groupId - Group number (1-9)
   */
  clearGroup(groupId: number): void {
    if (groupId < 1 || groupId > this.maxGroups) return;

    const group = this.groups.get(groupId);
    if (!group) return;

    group.unitIds.clear();
    this.groupDisplayCounts.set(groupId, 0);

    this.notifyGroupChange(groupId, []);
  }

  /**
   * Gets all unit IDs in a group
   * @param groupId - Group number (1-9)
   * @returns Array of unit IDs
   */
  getGroupUnits(groupId: number): string[] {
    const group = this.groups.get(groupId);
    return group ? Array.from(group.unitIds) : [];
  }

  /**
   * Gets the number of units in a group
   * @param groupId - Group number (1-9)
   * @returns Number of units
   */
  getGroupCount(groupId: number): number {
    return this.groupDisplayCounts.get(groupId) || 0;
  }

  /**
   * Checks if a unit is in a specific group
   * @param groupId - Group number (1-9)
   * @param unitId - Unit ID to check
   * @returns True if unit is in the group
   */
  isUnitInGroup(groupId: number, unitId: string): boolean {
    const group = this.groups.get(groupId);
    return group ? group.unitIds.has(unitId) : false;
  }

  /**
   * Gets all unit IDs in a group (alias for getGroupUnits)
   * @param groupId - Group number (1-9)
   * @returns Array of unit IDs
   */
  selectGroup(groupId: number): string[] {
    return this.getGroupUnits(groupId);
  }

  /**
   * Gets all groups
   * @returns Array of all unit groups
   */
  getAllGroups(): UnitGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Gets group IDs that have at least one unit
   * @returns Array of non-empty group IDs
   */
  getNonEmptyGroups(): number[] {
    const nonEmpty: number[] = [];
    this.groups.forEach((group, id) => {
      if (group.unitIds.size > 0) {
        nonEmpty.push(id);
      }
    });
    return nonEmpty;
  }

  /**
   * Removes a unit from all groups
   * @param unitId - Unit ID to remove
   */
  removeUnitFromAllGroups(unitId: string): void {
    this.groups.forEach((group, id) => {
      if (group.unitIds.has(unitId)) {
        group.unitIds.delete(unitId);
        this.groupDisplayCounts.set(id, group.unitIds.size);
        this.notifyGroupChange(id, Array.from(group.unitIds));
      }
    });
  }

  /**
   * Registers a callback for group change events
   * @param callback - Function to call when a group changes
   * @returns Unsubscribe function
   */
  onGroupChange(callback: (groupId: number, unitIds: string[]) => void): () => void {
    this.onGroupChangeCallbacks.add(callback);
    return () => {
      this.onGroupChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notifies all registered callbacks of a group change
   * @param groupId - Group that changed
   * @param unitIds - New unit IDs in the group
   * @internal
   */
  private notifyGroupChange(groupId: number, unitIds: string[]): void {
    this.onGroupChangeCallbacks.forEach(callback => {
      callback(groupId, unitIds);
    });
  }

  /**
   * Cleans up resources used by this manager
   */
  dispose(): void {
    this.groups.clear();
    this.groupDisplayCounts.clear();
    this.onGroupChangeCallbacks.clear();
  }
}
