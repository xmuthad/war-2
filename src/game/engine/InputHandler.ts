import { useGameStore, calculateFormation, MAX_SELECTION_COUNT } from '../../store/gameStore';
import type { Unit, Player, ResourceNode, GameMapData } from '../../types';
import { UnitType, UnitState, BuildingType } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { gameEventBus } from '../systems/GameEventBus';

const INFANTRY_TYPES = new Set([
  UnitType.SOLDIER, UnitType.ROCKET, UnitType.SNIPER, UnitType.SEAL,
  UnitType.TANYA, UnitType.CONSCRIPT, UnitType.FLAKINFANTRY,
  UnitType.TERRORIST, UnitType.IVAN, UnitType.ENGINEER, UnitType.CHRONO,
]);

export type PendingCommand = null | 'attackMove' | 'patrol' | 'capture' | 'harvest' | 'rally' | 'superweapon_nuke' | 'superweapon_ironcurtain' | 'superweapon_chronosphere' | 'superweapon_chronosphere_target';

export class InputHandler {
  private pendingCommand: PendingCommand = null;
  private chronosphereSourcePosition: { x: number; y: number } | null = null;
  private cycleUnitIndex: number = -1;

  // Double-click detection
  private lastClickTime: number = 0;
  private lastClickedUnitId: string | null = null;
  private readonly DOUBLE_CLICK_THRESHOLD = 300; // ms

  // Reference to Phaser scene for camera bounds (set from GameCanvas)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private phaserScene: any = null;

  private getStore() {
    return useGameStore.getState();
  }

  setPhaserScene(scene: unknown): void {
    this.phaserScene = scene;
  }

  handleWorldClick(worldX: number, worldY: number, shiftKey = false, ctrlKey = false): void {
    const store = this.getStore();

    // Building placement mode
    if (store.placementBuildingType) {
      store.confirmBuildingPlacement();
      return;
    }

    const { currentPlayer, selectUnits } = store;
    const clickedUnit = currentPlayer?.units.find(u => {
      const dx = u.position.x - worldX;
      const dy = u.position.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.UNIT_CLICK_RADIUS;
    });

    if (clickedUnit) {
      if (ctrlKey) {
        // Ctrl+click: select all same-type units on entire map
        const sameTypeUnits = currentPlayer.units.filter(u =>
          u.type === clickedUnit.type && !u.transportId
        );
        selectUnits(sameTypeUnits);
        this.lastClickTime = 0;
        this.lastClickedUnitId = null;
      } else if (shiftKey) {
        // Shift+click: toggle unit in existing selection
        const { selectedUnits } = store;
        const isAlreadySelected = selectedUnits.some(u => u.id === clickedUnit.id);
        if (isAlreadySelected) {
          // Remove from selection
          const newSelection = selectedUnits.filter(u => u.id !== clickedUnit.id);
          selectUnits(newSelection);
        } else {
          // Add to selection
          selectUnits([...selectedUnits, clickedUnit]);
        }
        this.lastClickTime = 0;
        this.lastClickedUnitId = null;
      } else {
        // Check for double-click
        const now = Date.now();
        if (now - this.lastClickTime < this.DOUBLE_CLICK_THRESHOLD &&
            this.lastClickedUnitId === clickedUnit.id) {
          // Double click: select all same-type units on screen
          this.selectSameTypeOnScreen(clickedUnit.id);
          this.lastClickTime = 0;
          this.lastClickedUnitId = null;
        } else {
          // Single click: select just this unit
          selectUnits([clickedUnit]);
          this.lastClickTime = now;
          this.lastClickedUnitId = clickedUnit.id;
        }
      }
    } else {
      // Also check for building click
      const clickedBuilding = currentPlayer?.buildings.find(b => {
        const bx = b.position.x + (b.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2;
        const by = b.position.y + (b.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2;
        const dx = bx - worldX;
        const dy = by - worldY;
        return Math.abs(dx) < (b.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2 &&
               Math.abs(dy) < (b.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2;
      });
      if (clickedBuilding) {
        store.selectBuilding(clickedBuilding);
        store.selectUnits([]);
      } else {
        // Click on empty ground: deselect all
        store.selectUnits([]);
        store.selectBuilding(null);
      }
    }
  }

  handleWorldRightClick(worldX: number, worldY: number, shiftKey = false): void {
    const store = this.getStore();

    // Cancel placement on right click
    if (store.placementBuildingType) {
      store.cancelBuildingPlacement();
      return;
    }

    // Handle pending command (attack-move or patrol)
    if (this.pendingCommand) {
      this.executePendingCommand(worldX, worldY, shiftKey);
      return;
    }

    const { selectedUnits, selectedBuilding, currentPlayer, aiPlayers, map, moveUnit, attackUnit, harvestResource } = store;

    // If a building is selected and no units, set rally point
    if (selectedBuilding && selectedUnits.length === 0) {
      store.setRallyPoint(selectedBuilding.id, { x: worldX, y: worldY });
      return;
    }

    if (selectedUnits.length === 0) return;

    // Check if clicking on an enemy unit
    const targetUnit = this.findUnitAtPosition(worldX, worldY, currentPlayer, aiPlayers);
    if (targetUnit) {
      // Check if clicking on a friendly transport with infantry selected → load
      if (currentPlayer && targetUnit.faction === currentPlayer.faction &&
          targetUnit.maxPassengers && targetUnit.passengers &&
          selectedUnits.some(u => INFANTRY_TYPES.has(u.type))) {
        for (const unit of selectedUnits) {
          if (INFANTRY_TYPES.has(unit.type) && !unit.transportId) {
            store.loadIntoTransport(unit.id, targetUnit.id);
          }
        }
        return;
      }

      for (const unit of selectedUnits) {
        if (unit.data.attack > 0) {
          attackUnit(unit.id, targetUnit.id);
        }
      }
      return;
    }

    // Check if clicking on an enemy building
    const targetBuilding = this.findBuildingAtPosition(worldX, worldY, aiPlayers);
    if (targetBuilding) {
      for (const unit of selectedUnits) {
        if (unit.data.attack > 0 && !unit.data.canCapture) {
          attackUnit(unit.id, targetBuilding.id);
        }
      }
      return;
    }

    // Check if clicking on a friendly building with engineers for repair
    const friendlyBuilding = currentPlayer?.buildings.find(b => {
      const w = (b.data.width || 2) * GAME_CONFIG.TILE_SIZE;
      const h = (b.data.height || 2) * GAME_CONFIG.TILE_SIZE;
      return b.isConstructed && b.health < b.maxHealth &&
        worldX >= b.position.x && worldX <= b.position.x + w &&
        worldY >= b.position.y && worldY <= b.position.y + h;
    });
    if (friendlyBuilding && selectedUnits.some(u => u.data.canCapture)) {
      for (const unit of selectedUnits) {
        if (unit.data.canCapture) {
          store.repairUnitBuilding(unit.id, friendlyBuilding.id);
        }
      }
      return;
    }

    // Check if clicking on a resource
    const targetResource = this.findResourceAtPosition(worldX, worldY, map);
    if (targetResource) {
      for (const unit of selectedUnits) {
        if (unit.data.canHarvest) {
          harvestResource(unit.id, targetResource.id);
        } else if (unit.data.attack > 0) {
          moveUnit(unit.id, { x: worldX, y: worldY });
        }
      }
      return;
    }

    // Default: move in formation
    const unitIds = selectedUnits.map(u => u.id);
    store.moveUnitsToTarget(unitIds, { x: worldX, y: worldY });
  }

  handleKeyDown(key: string, event?: KeyboardEvent): void {
    const store = this.getStore();
    if (key === 'Escape') {
      if (store.placementBuildingType) {
        store.cancelBuildingPlacement();
        return;
      }
      // Cancel pending command on Escape
      if (this.pendingCommand) {
        this.pendingCommand = null;
        return;
      }
      store.selectUnits([]);
      store.selectBuilding(null);
      return;
    }

    // Unload transport (U key)
    if (key === 'u' || key === 'U') {
      for (const unit of store.selectedUnits) {
        if (unit.passengers && unit.passengers.length > 0) {
          store.unloadFromTransport(unit.id);
        }
      }
      return;
    }

    // Load into transport (T key)
    if (key === 't' || key === 'T') {
      const { currentPlayer, selectedUnits } = store;
      if (currentPlayer && selectedUnits.length > 0) {
        for (const unit of selectedUnits) {
          if (INFANTRY_TYPES.has(unit.type) && !unit.transportId) {
            const transport = currentPlayer.units.find(t =>
              t.maxPassengers && t.passengers &&
              t.passengers.length < (t.maxPassengers || 0) &&
              !t.transportId &&
              Math.sqrt((t.position.x - unit.position.x) ** 2 + (t.position.y - unit.position.y) ** 2) < 3 * GAME_CONFIG.TILE_SIZE
            );
            if (transport) store.loadIntoTransport(unit.id, transport.id);
          }
        }
      }
      return;
    }

    // Capture command (C key for engineers)
    if (key === 'c' || key === 'C') {
      if (store.selectedUnits.some(u => u.data.canCapture)) {
        this.pendingCommand = 'capture';
      }
      return;
    }

    // Retreat / Repair (R key) - context-sensitive
    if (key === 'r' || key === 'R') {
      if (store.selectedBuilding) {
        store.repairBuilding(store.selectedBuilding.id);
      } else {
        this.retreatUnits();
      }
      return;
    }

    // Pause / resume
    if (key === ' ') {
      event?.preventDefault();
      store.setPaused(!store.isPaused);
      return;
    }

    // Game speed hotkeys
    if (key === '=' || key === '+') {
      const currentSpeed = store.gameSpeed;
      const newSpeed = Math.min(4, currentSpeed + 1) as 1 | 2 | 3 | 4;
      store.setGameSpeed(newSpeed);
      const speedLabel = newSpeed === 1 ? '正常' : newSpeed === 2 ? '快速' : newSpeed === 3 ? '极快' : `${newSpeed}x`;
      gameEventBus.emit('ui:notification', { message: `游戏速度: ${speedLabel}`, type: 'info' });
      return;
    }
    if (key === '-' || key === '_') {
      const currentSpeed = store.gameSpeed;
      const newSpeed = Math.max(1, currentSpeed - 1) as 1 | 2 | 3 | 4;
      store.setGameSpeed(newSpeed);
      const speedLabel = newSpeed === 1 ? '正常' : newSpeed === 2 ? '快速' : newSpeed === 3 ? '极快' : `${newSpeed}x`;
      gameEventBus.emit('ui:notification', { message: `游戏速度: ${speedLabel}`, type: 'info' });
      return;
    }
    if (key === '0' || key === 'Backspace') {
      store.setGameSpeed(1);
      gameEventBus.emit('ui:notification', { message: '游戏速度: 正常', type: 'info' });
      return;
    }
    if (key === 'Tab') {
      event?.preventDefault();
      this.cycleNextUnit();
      return;
    }
  }

  getPendingCommandType(): PendingCommand {
    return this.pendingCommand;
  }

  setPendingCommandExternal(command: PendingCommand): void {
    this.pendingCommand = command;
  }

  clearPendingCommand(): void {
    this.pendingCommand = null;
    this.chronosphereSourcePosition = null;
  }

  gatherUnits(): void {
    const store = this.getStore();
    const { selectedUnits, selectedBuilding, moveUnit } = store;

    if (selectedUnits.length <= 1 && !selectedBuilding) return;

    // If a building is selected, gather at the building's center
    if (selectedBuilding) {
      const bx = selectedBuilding.position.x + (selectedBuilding.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2;
      const by = selectedBuilding.position.y + (selectedBuilding.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2;
      for (const unit of selectedUnits) {
        moveUnit(unit.id, { x: bx, y: by });
      }
      return;
    }

    // Move all units to the first selected unit's position
    const rallyPoint = selectedUnits[0].position;
    for (let i = 1; i < selectedUnits.length; i++) {
      moveUnit(selectedUnits[i].id, { x: rallyPoint.x, y: rallyPoint.y });
    }
  }

  retreatUnits(): void {
    const store = this.getStore();
    const { selectedUnits, currentPlayer, moveUnit } = store;

    if (selectedUnits.length === 0 || !currentPlayer) return;

    // Find the nearest friendly building (prefer command center, then barracks)
    const buildings = currentPlayer.buildings.filter(b => b.isConstructed);
    const commandCenter = buildings.find(b => b.type === BuildingType.COMMAND);
    const barracks = buildings.find(b => b.type === BuildingType.BARRACKS);
    const target = commandCenter || barracks || buildings[0];

    if (!target) return;

    const bx = target.position.x + (target.data.width || 2) * GAME_CONFIG.TILE_SIZE / 2;
    const by = target.position.y + (target.data.height || 2) * GAME_CONFIG.TILE_SIZE / 2;

    for (const unit of selectedUnits) {
      moveUnit(unit.id, { x: bx, y: by });
    }
  }

  stopUnits(): void {
    const store = this.getStore();
    const { selectedUnits } = store;

    for (const unit of selectedUnits) {
      store.clearUnitWaypoints(unit.id);
    }
  }

  holdPositionUnits(): void {
    const store = this.getStore();
    const { selectedUnits } = store;

    for (const unit of selectedUnits) {
      store.setUnitWaypoints(unit.id, [], UnitState.GUARDING);
    }
  }

  cycleNextUnit(): void {
    const store = this.getStore();
    const player = store.currentPlayer;
    if (!player || player.units.length === 0) return;

    // Get all non-transported units
    const availableUnits = player.units.filter(u => !u.transportId);
    if (availableUnits.length === 0) return;

    // If a unit is currently selected, find the next one
    let nextIndex = 0;
    if (store.selectedUnits.length > 0) {
      const currentId = store.selectedUnits[0].id;
      const currentIndex = availableUnits.findIndex(u => u.id === currentId);
      if (currentIndex >= 0) {
        nextIndex = (currentIndex + 1) % availableUnits.length;
      } else {
        nextIndex = (this.cycleUnitIndex + 1) % availableUnits.length;
      }
    } else {
      nextIndex = (this.cycleUnitIndex + 1) % availableUnits.length;
    }

    this.cycleUnitIndex = nextIndex;
    const nextUnit = availableUnits[nextIndex];
    store.selectUnits([nextUnit]);

    // Center camera on the selected unit via event bus
    if (nextUnit.position) {
      gameEventBus.emit('camera:centerOn', { x: nextUnit.position.x, y: nextUnit.position.y });
    }
  }

  selectSameTypeUnits(): void {
    const store = this.getStore();
    const { selectedUnits, currentPlayer } = store;

    if (selectedUnits.length === 0 || !currentPlayer) return;

    // Collect the types of currently selected units
    const selectedTypes = new Set(selectedUnits.map(u => u.type));

    // Find all units of the same type(s) that belong to the current player
    let sameTypeUnits = currentPlayer.units.filter(u =>
      selectedTypes.has(u.type) && !u.transportId
    );

    if (sameTypeUnits.length > MAX_SELECTION_COUNT) {
      sameTypeUnits = sameTypeUnits.slice(0, MAX_SELECTION_COUNT);
    }

    if (sameTypeUnits.length > 0) {
      store.selectUnits(sameTypeUnits);
    }
  }

  selectSameTypeOnScreen(unitId: string): void {
    const store = this.getStore();
    const unit = store.currentPlayer?.units.find(u => u.id === unitId);
    if (!unit) return;

    // Get camera bounds from Phaser scene
    if (!this.phaserScene?.cameras?.main) {
      // Fallback: select all same-type if no camera available
      let sameTypeUnits = store.currentPlayer!.units.filter(u =>
        u.type === unit.type && !u.transportId
      );
      if (sameTypeUnits.length > MAX_SELECTION_COUNT) {
        sameTypeUnits = sameTypeUnits.slice(0, MAX_SELECTION_COUNT);
      }
      store.selectUnits(sameTypeUnits);
      return;
    }

    const camera = this.phaserScene.cameras.main;

    // Convert camera corners to logical space using screenToWorld
    const topLeft = this.phaserScene.screenToWorld(0, 0);
    const bottomRight = this.phaserScene.screenToWorld(camera.width, camera.height);

    if (!topLeft || !bottomRight) {
      let sameTypeUnits = store.currentPlayer!.units.filter(u =>
        u.type === unit.type && !u.transportId
      );
      if (sameTypeUnits.length > MAX_SELECTION_COUNT) {
        sameTypeUnits = sameTypeUnits.slice(0, MAX_SELECTION_COUNT);
      }
      store.selectUnits(sameTypeUnits);
      return;
    }

    const screenLeft = topLeft.x;
    const screenTop = topLeft.y;
    const screenRight = bottomRight.x;
    const screenBottom = bottomRight.y;

    // Select all same-type units within screen bounds
    let sameTypeOnScreen = store.currentPlayer!.units.filter(u =>
      u.type === unit.type &&
      !u.transportId &&
      u.position.x >= screenLeft && u.position.x <= screenRight &&
      u.position.y >= screenTop && u.position.y <= screenBottom
    );

    if (sameTypeOnScreen.length > MAX_SELECTION_COUNT) {
      sameTypeOnScreen = sameTypeOnScreen.slice(0, MAX_SELECTION_COUNT);
    }

    store.selectUnits(sameTypeOnScreen);
  }

  private executePendingCommand(worldX: number, worldY: number, shiftKey: boolean): void {
    const store = this.getStore();
    const { selectedUnits, selectedBuilding } = store;

    if (this.pendingCommand === 'attackMove') {
      const unitIds = selectedUnits.map(u => u.id);
      store.attackMoveUnitsToTarget(unitIds, { x: worldX, y: worldY });
    } else if (this.pendingCommand === 'capture') {
      // Move engineers to the clicked position (CaptureSystem will auto-capture when in range)
      for (const unit of selectedUnits) {
        if (unit.data.canCapture) {
          store.moveUnit(unit.id, { x: worldX, y: worldY });
        }
      }
    } else if (this.pendingCommand === 'harvest') {
      // Move harvester to clicked position (HarvestSystem will auto-harvest when near resource)
      for (const unit of selectedUnits) {
        if (unit.data.canHarvest) {
          store.moveUnit(unit.id, { x: worldX, y: worldY });
        }
      }
    } else if (this.pendingCommand === 'rally') {
      // Set rally point for selected building
      if (selectedBuilding) {
        store.setRallyPoint(selectedBuilding.id, { x: worldX, y: worldY });
      }
    } else if (this.pendingCommand === 'patrol') {
      if (selectedUnits.length > 1) {
        // Formation-based patrol for multiple units
        const formationMap = calculateFormation({ x: worldX, y: worldY }, selectedUnits);
        for (const unit of selectedUnits) {
          const pos = formationMap.get(unit.id);
          if (!pos) continue;
          if (shiftKey && unit.state === UnitState.PATROLLING) {
            store.setUnitWaypoints(unit.id, [...unit.waypoints, { ...pos }], UnitState.PATROLLING);
          } else {
            store.setUnitWaypoints(unit.id, [
              { x: unit.position.x, y: unit.position.y },
              { ...pos },
            ], UnitState.PATROLLING);
          }
        }
      } else {
        for (const unit of selectedUnits) {
          if (shiftKey && unit.state === UnitState.PATROLLING) {
            store.setUnitWaypoints(unit.id, [...unit.waypoints, { x: worldX, y: worldY }], UnitState.PATROLLING);
          } else {
            store.setUnitWaypoints(unit.id, [
              { x: unit.position.x, y: unit.position.y },
              { x: worldX, y: worldY },
            ], UnitState.PATROLLING);
          }
        }
      }
    } else if (this.pendingCommand === 'superweapon_nuke') {
      if (selectedBuilding && selectedBuilding.type === BuildingType.NUCLEAR_SILO) {
        store.activateNuclearSilo(selectedBuilding.id, { x: worldX, y: worldY });
      }
    } else if (this.pendingCommand === 'superweapon_ironcurtain') {
      if (selectedBuilding && selectedBuilding.type === BuildingType.IRON_CURTAIN) {
        store.activateIronCurtain(selectedBuilding.id, { x: worldX, y: worldY });
      }
    } else if (this.pendingCommand === 'superweapon_chronosphere') {
      // First click: select source position
      this.chronosphereSourcePosition = { x: worldX, y: worldY };
      this.pendingCommand = 'superweapon_chronosphere_target';
      return; // Don't clear the command yet
    } else if (this.pendingCommand === 'superweapon_chronosphere_target') {
      // Second click: select target position and activate
      if (selectedBuilding && selectedBuilding.type === BuildingType.CHRONOSPHERE && this.chronosphereSourcePosition) {
        store.activateChronosphere(selectedBuilding.id, this.chronosphereSourcePosition, { x: worldX, y: worldY });
      }
      this.chronosphereSourcePosition = null;
    }

    this.pendingCommand = null;
  }

  handleMouseMove(worldX: number, worldY: number): void {
    const store = this.getStore();
    if (store.placementBuildingType) {
      store.updatePlacementPreview({ x: worldX, y: worldY });
    }
    if (store.selectionBox) {
      store.updateDragSelection({ x: worldX, y: worldY });
    }
  }

  private findUnitAtPosition(worldX: number, worldY: number, currentPlayer: Player | null, aiPlayers: Player[]): Unit | null {
    const found = currentPlayer?.units.find((u: Unit) => {
      const dx = u.position.x - worldX;
      const dy = u.position.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.UNIT_CLICK_RADIUS;
    });
    if (found) return found;

    return aiPlayers.flatMap((p: Player) => p.units).find((u: Unit) => {
      const dx = u.position.x - worldX;
      const dy = u.position.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.UNIT_CLICK_RADIUS;
    }) || null;
  }

  private findBuildingAtPosition(worldX: number, worldY: number, aiPlayers: Player[]): import('../../types').Building | null {
    for (const player of aiPlayers) {
      const building = player.buildings.find(b => {
        const w = (b.data.width || 2) * GAME_CONFIG.TILE_SIZE;
        const h = (b.data.height || 2) * GAME_CONFIG.TILE_SIZE;
        return worldX >= b.position.x && worldX <= b.position.x + w &&
               worldY >= b.position.y && worldY <= b.position.y + h;
      });
      if (building) return building;
    }
    return null;
  }

  private findResourceAtPosition(worldX: number, worldY: number, map: GameMapData | null): ResourceNode | null {
    if (!map) return null;
    return map.resourceNodes.find(r => {
      const rx = r.position.x * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
      const ry = r.position.y * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
      const dx = rx - worldX;
      const dy = ry - worldY;
      return Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.RESOURCE_CLICK_RADIUS;
    }) || null;
  }
}

export const inputHandler = new InputHandler();
