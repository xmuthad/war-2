import { useGameStore } from '../../store/gameStore';
import { Vector2, Unit } from '../../types';

export class InputManager {
  private canvas: HTMLCanvasElement | null = null;
  private isDragging: boolean = false;
  private dragStart: Vector2 = { x: 0, y: 0 };
  private dragEnd: Vector2 = { x: 0, y: 0 };
  private selectedUnits: Set<string> = new Set();
  private rightClickAction: ((position: Vector2) => void) | null = null;
  private leftClickAction: ((position: Vector2) => void) | null = null;
  private boundHandlers: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    contextmenu: (e: MouseEvent) => void;
    wheel: (e: WheelEvent) => void;
    keydown: (e: KeyboardEvent) => void;
    keyup: (e: KeyboardEvent) => void;
  } | null = null;

  initialize(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  /** Register only keyboard shortcuts (no mouse events - those are handled by usePhaser) */
  registerKeyboard(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.boundHandlers = {
      mousedown: () => {},
      mousemove: () => {},
      mouseup: () => {},
      contextmenu: () => {},
      wheel: () => {},
      keydown: this.handleKeyDown,
      keyup: this.handleKeyUp,
    };
    document.addEventListener('keydown', this.boundHandlers.keydown);
    document.addEventListener('keyup', this.boundHandlers.keyup);
  }

  private setupEventListeners() {
    if (!this.canvas) return;

    this.boundHandlers = {
      mousedown: this.handleMouseDown,
      mousemove: this.handleMouseMove,
      mouseup: this.handleMouseUp,
      contextmenu: this.handleRightClick,
      wheel: this.handleWheel,
      keydown: this.handleKeyDown,
      keyup: this.handleKeyUp,
    };

    this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
    this.canvas.addEventListener('mousemove', this.boundHandlers.mousemove);
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseup);
    this.canvas.addEventListener('contextmenu', this.boundHandlers.contextmenu);
    this.canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });

    document.addEventListener('keydown', this.boundHandlers.keydown);
    document.addEventListener('keyup', this.boundHandlers.keyup);
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isDragging = true;
      this.dragStart = this.getMousePosition(e);
      this.dragEnd = this.dragStart;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.isDragging) {
      this.dragEnd = this.getMousePosition(e);
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0 && this.isDragging) {
      this.isDragging = false;
      const selectionBox = this.getSelectionBox();

      if (selectionBox.width > 5 || selectionBox.height > 5) {
        this.selectUnitsInBox(selectionBox);
      } else {
        this.handleLeftClick(selectionBox.x, selectionBox.y);
      }
    }
  };

  private handleRightClick = (e: MouseEvent) => {
    e.preventDefault();
    const position = this.getMousePosition(e);
    this.rightClickAction?.(position);
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const store = useGameStore.getState();

    switch (e.key) {
      case 'Escape':
        store.selectUnits([]);
        store.selectBuilding(null);
        break;
      case ' ':
        e.preventDefault();
        store.setPaused(!store.isPaused);
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        this.selectUnitByIndex(parseInt(e.key) - 1);
        break;
    }
  };

  private handleKeyUp = (_e: KeyboardEvent) => {
    // Handle key release events
  };

  private getMousePosition(e: MouseEvent): Vector2 {
    if (!this.canvas) return { x: 0, y: 0 };

    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private getSelectionBox() {
    return {
      x: Math.min(this.dragStart.x, this.dragEnd.x),
      y: Math.min(this.dragStart.y, this.dragEnd.y),
      width: Math.abs(this.dragEnd.x - this.dragStart.x),
      height: Math.abs(this.dragEnd.y - this.dragStart.y),
    };
  }

  private selectUnitsInBox(box: { x: number; y: number; width: number; height: number }) {
    const store = useGameStore.getState();
    const { currentPlayer } = store;

    if (!currentPlayer) return;

    const selected: Unit[] = [];

    currentPlayer.units.forEach(unit => {
      const unitCenterX = unit.position.x;
      const unitCenterY = unit.position.y;

      if (
        unitCenterX >= box.x &&
        unitCenterX <= box.x + box.width &&
        unitCenterY >= box.y &&
        unitCenterY <= box.y + box.height
      ) {
        selected.push(unit);
        this.selectedUnits.add(unit.id);
      } else {
        this.selectedUnits.delete(unit.id);
      }
    });

    store.selectUnits(selected);
  }

  private handleLeftClick(x: number, y: number) {
    const store = useGameStore.getState();
    const { currentPlayer } = store;

    if (!currentPlayer) return;

    let clickedUnit = false;
    let selectedUnit: Unit | null = null;

    for (const unit of currentPlayer.units) {
      const dx = unit.position.x - x;
      const dy = unit.position.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 20) {
        selectedUnit = unit;
        clickedUnit = true;
        break;
      }
    }

    if (selectedUnit) {
      store.selectUnits([selectedUnit]);
      return;
    }

    if (!clickedUnit) {
      for (const building of currentPlayer.buildings) {
        const bx = building.position.x + (building.width * 32) / 2;
        const by = building.position.y + (building.height * 32) / 2;
        const dx = bx - x;
        const dy = by - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (building.width * 32) / 2) {
          store.selectBuilding(building);
          clickedUnit = true;
          break;
        }
      }
    }

    if (!clickedUnit) {
      store.selectUnits([]);
      store.selectBuilding(null);
    }
  }

  private selectUnitByIndex(index: number) {
    const store = useGameStore.getState();
    const { currentPlayer } = store;

    if (!currentPlayer) return;

    const units = currentPlayer.units;
    if (index < units.length) {
      const unit = units[index];
      store.selectUnits([unit]);
    }
  }

  setRightClickAction(action: (position: Vector2) => void) {
    this.rightClickAction = action;
  }

  setLeftClickAction(action: (position: Vector2) => void) {
    this.leftClickAction = action;
  }

  getDragStatus() {
    return {
      isDragging: this.isDragging,
      start: this.dragStart,
      end: this.dragEnd,
    };
  }

  cleanup() {
    if (!this.boundHandlers) return;

    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
      this.canvas.removeEventListener('mousemove', this.boundHandlers.mousemove);
      this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseup);
      this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextmenu);
      this.canvas.removeEventListener('wheel', this.boundHandlers.wheel);
    }

    document.removeEventListener('keydown', this.boundHandlers.keydown);
    document.removeEventListener('keyup', this.boundHandlers.keyup);

    this.boundHandlers = null;
    this.canvas = null;
  }
}

export const inputManager = new InputManager();
