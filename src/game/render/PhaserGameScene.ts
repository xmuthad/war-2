import Phaser from 'phaser';
import { GameMapData, TileType, BuildingType, UnitType, Faction, UnitRank, UpgradeType, UnitStance, Player } from '../../types';
import {
  SPRITE_CONFIG,
  RENDER_CONFIG,
  TERRAIN_COLORS,
  RESOURCE_NODE_CONFIG,
  HEALTH_BAR_COLORS,
  SPRITE_PATHS,
  DIRECTION_ANGLES,
  getUnitSpriteKey,
  getBuildingSpriteKey
} from './PhaserConfig';
import { GameRenderer, type Position3D, type Position2D } from './GameRenderer';
import { logicalToRender, renderToLogical, tileDiamond, tileCenterRender, isoBounds } from './IsometricUtils';
import { FogOfWar, type FogOfWarConfig } from './FogOfWar';
import { GameSoundManager, SOUND_CONFIG, type SoundConfig } from '../systems/GameSoundManager';
import { HotkeyManager, HOTKEY_CONFIG, UnitGroupManager, type HotkeyConfig } from '../systems/HotkeyManager';
import { PathfindingManager, PATHFINDING_CONFIG, type PathfindingConfig } from '../systems/PathfindingManager';
import { EffectSystem } from './EffectSystem';
import { IndicatorSystem } from './IndicatorSystem';
import { gameEventBus } from '../systems/GameEventBus';
import { GameUIController } from '../ui/GameUIController';
import { captureSystem } from '../systems/CaptureSystem';
import { gameEventBridge } from '../systems/GameEventBridge';
import { radiationSystem } from '../systems/RadiationSystem';
import { ivanBombSystem } from '../systems/IvanBombSystem';
import { isAlliedFaction } from '../config/FactionTheme';
import { GAME_CONFIG } from '../config/GameConfig';
import { SystemManager } from '../systems/SystemManager';
import type { AlertLevel, AlertEvent, TimeState, WeatherType, MissionConfig, GameStats, CombatStats } from '../systems/SystemManager';
import { useGameStore } from '../../store/gameStore';
import { BUILDINGS_BY_FACTION } from '../systems/AIUnitLookup';
import { inputHandler } from '../engine/InputHandler';

export interface UnitRenderState {
  direction: number;
  isSelected: boolean;
  health: number;
  maxHealth: number;
  rank: UnitRank;
  isInvulnerable?: boolean;
  isDeploying?: boolean;
  deployTimer?: number;
}

export interface BuildingRenderState {
  isSelected: boolean;
  health: number;
  maxHealth: number;
  width: number;
  height: number;
  oreStorage?: number;
  maxOreStorage?: number;
  isConstructed: boolean;
}

function normalizeAngle(angle: number): number {
  if (!isFinite(angle)) return 0;
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function rotationToDirectionIndex(rotation: number): number {
  const normalizedRotation = normalizeAngle(rotation);

  let closestIndex = 0;
  let closestDiff = Math.PI * 2;

  for (let i = 0; i < DIRECTION_ANGLES.length; i++) {
    let diff = Math.abs(normalizeAngle(DIRECTION_ANGLES[i]) - normalizedRotation);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex;
}

function getTerrainColor(tileType: TileType | undefined): number {
  if (!tileType) return TERRAIN_COLORS.grass;

  switch (tileType) {
    case TileType.GRASS: return TERRAIN_COLORS.grass;
    case TileType.WATER: return TERRAIN_COLORS.water;
    case TileType.MOUNTAIN: return TERRAIN_COLORS.mountain;
    case TileType.FOREST: return TERRAIN_COLORS.forest;
    case TileType.ROAD: return TERRAIN_COLORS.road;
    case TileType.ORE: return TERRAIN_COLORS.ore;
    case TileType.SAND: return TERRAIN_COLORS.sand;
    case TileType.ICE: return TERRAIN_COLORS.ice;
    case TileType.MUD: return TERRAIN_COLORS.mud;
    case TileType.RUBBLE: return TERRAIN_COLORS.rubble;
    case TileType.CRATER: return TERRAIN_COLORS.crater;
    case TileType.CLIFF: return TERRAIN_COLORS.cliff;
    default: return TERRAIN_COLORS.grass;
  }
}

function getHealthColor(healthPercent: number): number {
  if (healthPercent <= 0.3) return HEALTH_BAR_COLORS.healthLow;
  if (healthPercent <= 0.6) return HEALTH_BAR_COLORS.healthMedium;
  return HEALTH_BAR_COLORS.healthHigh;
}

function createUnitFallbackSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  faction: Faction
): Phaser.GameObjects.Arc {
  const isAllied = isAlliedFaction(faction);
  const color = isAllied ? RENDER_CONFIG.unitFallbackColorAllied : RENDER_CONFIG.unitFallbackColorSoviet;
  const circle = scene.add.circle(x, y, RENDER_CONFIG.unitFallbackRadius, color);
  circle.setStrokeStyle(1, 0xffffff, 0.5);
  return circle;
}

function createBuildingFallbackSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  faction: Faction
): Phaser.GameObjects.Rectangle {
  const isAllied = isAlliedFaction(faction);
  const color = isAllied ? RENDER_CONFIG.buildingFallbackColorAllied : RENDER_CONFIG.buildingFallbackColorSoviet;
  const rect = scene.add.rectangle(x, y, RENDER_CONFIG.buildingFallbackWidth, RENDER_CONFIG.buildingFallbackHeight, color);
  rect.setStrokeStyle(2, 0xffffff, 0.5);
  return rect;
}

export class PhaserGameScene extends Phaser.Scene implements GameRenderer {
  private unitSprites: Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Shape> = new Map();
  private buildingSprites: Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Shape> = new Map();
  private unitHealthBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private buildingHealthBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private unitGroupBadges: Map<string, Phaser.GameObjects.Text> = new Map();
  private powerWarningIcons: Map<string, Phaser.GameObjects.Text> = new Map();
  private garrisonIndicators: Map<string, Phaser.GameObjects.Container> = new Map();
  private bridgeDestroyedOverlays: Map<string, Phaser.GameObjects.Container> = new Map();
  private psychicSensorRings: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private radiationZoneGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private radiationZoneLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private ivanBombGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private ivanBombLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private submergedSubRipples: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private gapGeneratorOverlays: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private chronoFreezeOverlays: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private movePreviewLine: Phaser.GameObjects.Graphics | null = null;
  private isRightMouseDown: boolean = false;
  private terrainLayer!: Phaser.GameObjects.Container;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private unitStates: Map<string, UnitRenderState> = new Map();
  private buildingStates: Map<string, BuildingRenderState> = new Map();
  private currentMap: GameMapData | null = null;
  private worldWidth: number = 0;
  private worldHeight: number = 0;
  private animationFrame: number = 0;
  private animationTimer: number = 0;
  private eventUnsubscribers: (() => void)[] = [];
  private dynamicObstacleFrame: number = 0;
  private isDestroyed: boolean = false;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private healthBarsDirty: boolean = true;
  private selectionDirty: boolean = true;

  // --- Rendering-related subsystems ---
  private fogOfWar?: FogOfWar;
  private soundManager?: GameSoundManager;
  private hotkeyManager?: HotkeyManager;
  private groupManager?: UnitGroupManager;
  private pathfindingManager?: PathfindingManager;
  private effectSystem?: EffectSystem;
  private indicatorSystem?: IndicatorSystem;

  // Waypoint visualization
  private waypointGraphics?: Phaser.GameObjects.Graphics;
  private waypointLines: Array<{ points: Array<{ x: number; y: number }>; color: number }> = [];
  private crateGraphics?: Phaser.GameObjects.Graphics;

  // --- Non-rendering subsystems (managed by SystemManager) ---
  private systemManager?: SystemManager;

  private fogConfig?: FogOfWarConfig;
  private soundConfig?: SoundConfig;
  private hotkeyConfig?: HotkeyConfig;
  private pathfindingConfig?: PathfindingConfig;

  public onGroupSelected?: (unitIds: string[]) => void;
  public onDeselectAll?: () => void;
  public onFogOfWarUpdate?: (visibleUnits: string[], exploredTiles: Set<string>) => void;
  public onAlertTriggered?: (alert: AlertEvent) => void;
  public onMissionComplete?: (success: boolean) => void;
  public onTimeOfDayChange?: (state: TimeState) => void;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(config?: {
    fogConfig?: FogOfWarConfig;
    soundConfig?: SoundConfig;
    hotkeyConfig?: HotkeyConfig;
    pathfindingConfig?: PathfindingConfig;
  }): void {
    this.fogConfig = config?.fogConfig;
    this.soundConfig = config?.soundConfig;
    this.hotkeyConfig = config?.hotkeyConfig;
    this.pathfindingConfig = config?.pathfindingConfig;

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`Sprite not found, will use fallback: ${file.key}`);
    });

    // Load all unit spritesheets - each key gets its own texture entry
    // (browser caches duplicate HTTP requests, Phaser handles duplicate keys correctly)
    Object.entries(SPRITE_PATHS.units).forEach(([key, path]) => {
      this.load.spritesheet(key, path, {
        frameWidth: SPRITE_CONFIG.frameWidth,
        frameHeight: SPRITE_CONFIG.frameHeight
      });
    });

    // Load all building images
    Object.entries(SPRITE_PATHS.buildings).forEach(([key, path]) => {
      this.load.image(key, path);
    });

    this.load.on('complete', () => {
      this.initializeNewSystems();
    });
  }

  create(): void {
    this.terrainLayer = this.add.container(0, 0);
    this.terrainLayer.setDepth(-10); // Render below other objects
    this.selectionGraphics = this.add.graphics();
    this.selectionGraphics.setDepth(RENDER_CONFIG.selectionDepth);
    this.createAnimations();

    // Setup camera zoom with mouse wheel
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      const camera = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, 0.5, 2.0);
      camera.setZoom(newZoom);
    });

    // Track right mouse button state for move preview line
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.isRightMouseDown = true;
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) {
        this.isRightMouseDown = false;
        this.hideMovePreview();
      }
    });

    // Setup keyboard camera controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      // Camera bookmarks: Ctrl+F2-F5 to save, F2-F5 to load
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        const fKeyMatch = event.key.match(/^F(\d+)$/);
        if (!fKeyMatch) return;
        const fNum = parseInt(fKeyMatch[1]);
        if (fNum < 2 || fNum > 5) return;

        const index = fNum - 2; // F2=0, F3=1, F4=2, F5=3
        event.preventDefault();

        if (event.ctrlKey) {
          // Save camera bookmark
          this.saveCameraBookmark(index);
        } else {
          // Load camera bookmark
          this.loadCameraBookmark(index);
        }
      });
    }

    this.hotkeyManager = new HotkeyManager(this, this.hotkeyConfig || HOTKEY_CONFIG);
    this.groupManager = new UnitGroupManager(this);

    // Initialize non-rendering systems via SystemManager
    this.systemManager = new SystemManager();
    this.systemManager.onAlertTriggered = alert => this.onAlertTriggered?.(alert);
    this.systemManager.onMissionComplete = success => this.onMissionComplete?.(success);
    this.systemManager.onTimeOfDayChange = state => {
      this.onTimeOfDayChange?.(state);
      useGameStore.getState().updateDayNightVisionModifier(state.currentTime);
    };
    this.systemManager.onWeatherChange = weatherType => {
      useGameStore.getState().updateWeatherModifiers(weatherType || 'clear');
    };
    this.systemManager.initialize(this);

    this.effectSystem = new EffectSystem(this);
    this.indicatorSystem = new IndicatorSystem(this);

    this.setupHotkeyCallbacks();
    this.connectEventBridge();

    // Listen for pathfinding obstacle changes (walls placed/destroyed)
    this.eventUnsubscribers.push(
      gameEventBus.on('pathfinding:obstaclesChanged', () => {
        this.updatePathfindingObstaclesFromStore();
      })
    );

    // Listen for minimap ping events and show ping effect in main view
    this.eventUnsubscribers.push(
      gameEventBus.on('map:ping', (event) => {
        const data = event.data as { position: { x: number; y: number } } | undefined;
        if (data?.position) {
          this.showPingEffect(data.position.x, data.position.y);
        }
      })
    );

    // Listen for map reveal events (e.g. reveal crate)
    this.eventUnsubscribers.push(
      gameEventBus.on('map:reveal', (event) => {
        const data = event.data as { position: { x: number; y: number }; radius: number } | undefined;
        if (data && this.fogOfWar) {
          this.fogOfWar.revealArea(data.position.x, data.position.y, data.radius);
        }
      })
    );

    // Listen for camera center events (e.g. Tab cycling units)
    this.eventUnsubscribers.push(
      gameEventBus.on('camera:centerOn', (event) => {
        const data = event.data as { x: number; y: number } | undefined;
        if (data) {
          this.centerCameraOnWorld(data.x, data.y);
        }
      })
    );

    // Show damage numbers and bullet trails on combat hits
    this.eventUnsubscribers.push(
      gameEventBus.on('combat:hit', (event) => {
        const data = event.data as { attackerId: string; damage: number; position: { x: number; y: number } } | undefined;
        if (data && data.damage > 0) {
          this.showDamageNumber(data.damage, data.position.x, data.position.y);

          // Draw bullet trail from attacker to target
          if (this.effectSystem && data.attackerId) {
            const attackerPos = this.findUnitOrBuildingPosition(data.attackerId);
            if (attackerPos) {
              const { x: startX, y: startY } = logicalToRender(attackerPos.x, attackerPos.y);
              const { x: endX, y: endY } = logicalToRender(data.position.x, data.position.y);
              this.effectSystem.playBulletTrail(startX, startY, endX, endY);
            }
          }
        }
      })
    );

    // Emit event so usePhaser knows scene is ready
    this.events.emit('sceneReady');
  }

  private initializeNewSystems(): void {
    this.soundManager = new GameSoundManager(this, this.soundConfig || SOUND_CONFIG);
    this.soundManager.preload();
  }

  private setupHotkeyCallbacks(): void {
    if (!this.hotkeyManager || !this.groupManager) return;

    this.hotkeyManager.onHotkey((action, _event) => {
      this.handleHotkeyAction(action);
    });

    this.groupManager.onGroupChange((groupId, unitIds) => {
      // Update group badges for units in this group
      for (const unitId of unitIds) {
        this.setUnitGroupBadge(unitId, groupId);
      }
    });
  }

  private handleHotkeyAction(action: string): void {
    switch (action) {
      case 'selectGroup1':
      case 'selectGroup2':
      case 'selectGroup3':
      case 'selectGroup4':
      case 'selectGroup5':
      case 'selectGroup6':
      case 'selectGroup7':
      case 'selectGroup8':
      case 'selectGroup9': {
        const groupId = parseInt(action.replace('selectGroup', ''));
        const unitIds = this.groupManager?.selectGroup(groupId) || [];
        this.onGroupSelected?.(unitIds);
        break;
      }
      case 'group1':
      case 'group2':
      case 'group3':
      case 'group4':
      case 'group5':
      case 'group6':
      case 'group7':
      case 'group8':
      case 'group9': {
        const groupId = parseInt(action.replace('group', ''));
        const selectedUnitIds = this.getSelectedUnitIds();
        if (selectedUnitIds.length > 0) {
          this.groupManager?.createGroup(groupId, selectedUnitIds);
        }
        break;
      }
      case 'addToGroup1':
      case 'addToGroup2':
      case 'addToGroup3':
      case 'addToGroup4':
      case 'addToGroup5':
      case 'addToGroup6':
      case 'addToGroup7':
      case 'addToGroup8':
      case 'addToGroup9': {
        const groupId = parseInt(action.replace('addToGroup', ''));
        const selectedUnitIds = this.getSelectedUnitIds();
        if (selectedUnitIds.length > 0) {
          this.groupManager?.addToGroup(groupId, selectedUnitIds);
        }
        break;
      }
      case 'deselect':
        this.onDeselectAll?.();
        break;
      case 'gather':
        inputHandler.gatherUnits();
        break;
      case 'retreat':
        inputHandler.retreatUnits();
        break;
      case 'stop':
        inputHandler.stopUnits();
        break;
      case 'holdPosition':
        inputHandler.holdPositionUnits();
        break;
      case 'selectSameType':
        inputHandler.selectSameTypeUnits();
        break;
      case 'attack':
        if (useGameStore.getState().selectedUnits.length > 0) {
          inputHandler.setPendingCommandExternal('attackMove');
        }
        break;
      case 'attackMove':
        if (useGameStore.getState().selectedUnits.length > 0) {
          inputHandler.setPendingCommandExternal('attackMove');
        }
        break;
      case 'move':
        // Move mode - just clear pending command, right-click will move
        inputHandler.clearPendingCommand();
        break;
      case 'patrol':
        if (useGameStore.getState().selectedUnits.length > 0) {
          inputHandler.setPendingCommandExternal('patrol');
        }
        break;
      case 'unload':
        for (const unit of useGameStore.getState().selectedUnits) {
          if (unit.passengers && unit.passengers.length > 0) {
            useGameStore.getState().unloadFromTransport(unit.id);
          }
        }
        break;
      case 'sell':
        if (useGameStore.getState().selectedBuilding) {
          useGameStore.getState().sellBuilding(useGameStore.getState().selectedBuilding!.id);
        }
        break;
      case 'repair':
        if (useGameStore.getState().selectedBuilding) {
          useGameStore.getState().repairBuilding(useGameStore.getState().selectedBuilding!.id);
        }
        break;
      case 'build':
        GameUIController.getInstance().setActivePanel('build');
        break;
      case 'stanceAggressive':
        if (useGameStore.getState().selectedUnits.length > 0) {
          useGameStore.getState().setUnitStance(
            useGameStore.getState().selectedUnits.map(u => u.id),
            UnitStance.AGGRESSIVE
          );
        }
        break;
      case 'stanceGuard':
        if (useGameStore.getState().selectedUnits.length > 0) {
          useGameStore.getState().setUnitStance(
            useGameStore.getState().selectedUnits.map(u => u.id),
            UnitStance.GUARD
          );
        }
        break;
      case 'stancePassive':
        if (useGameStore.getState().selectedUnits.length > 0) {
          useGameStore.getState().setUnitStance(
            useGameStore.getState().selectedUnits.map(u => u.id),
            UnitStance.PASSIVE
          );
        }
        break;
      case 'cycleNextUnit':
        inputHandler.cycleNextUnit();
        break;
      case 'toggleRallyPoint':
        if (useGameStore.getState().selectedBuilding) {
          inputHandler.setPendingCommandExternal('rally');
        }
        break;
      case 'selectAll': {
        const store = useGameStore.getState();
        if (store.currentPlayer) {
          store.selectUnits(store.currentPlayer.units);
        }
        break;
      }
      case 'split': {
        const store = useGameStore.getState();
        const selected = store.selectedUnits;
        if (selected.length > 1) {
          // Keep first half selected, deselect second half
          const mid = Math.ceil(selected.length / 2);
          store.selectUnits(selected.slice(0, mid));
        }
        break;
      }
      case 'set_formation_1':
      case 'set_formation_2':
      case 'set_formation_3': {
        const formationIndex = parseInt(action.replace('set_formation_', '')) - 1;
        const store = useGameStore.getState();
        if (store.selectedUnits.length > 0) {
          const groupId = formationIndex + 1; // Groups 1-3
          this.groupManager?.createGroup(groupId, store.selectedUnits.map(u => u.id));
          gameEventBus.emit('ui:notification', { message: `编队 ${formationIndex + 1} 已设置`, type: 'info' });
        }
        break;
      }
    }
  }

  private getSelectedUnitIds(): string[] {
    const selectedIds: string[] = [];
    this.unitStates.forEach((state, id) => {
      if (state.isSelected) {
        selectedIds.push(id);
      }
    });
    return selectedIds;
  }

  private connectEventBridge(): void {
    if (this.soundManager && this.effectSystem) {
      gameEventBridge.connect(this.soundManager, this.effectSystem, this);
    }
  }

  private createAnimations(): void {
    Object.keys(SPRITE_PATHS.units).forEach(key => {
      if (!this.textures.exists(key)) return;

      this.anims.create({
        key: `${key}_idle`,
        frames: [{ key, frame: 0 }],
        frameRate: 1,
        repeat: 0
      });

      for (let dir = 0; dir < SPRITE_CONFIG.directions; dir++) {
        const dirFrames: number[] = [];
        for (let frame = 0; frame < SPRITE_CONFIG.frames; frame++) {
          dirFrames.push(dir * SPRITE_CONFIG.frames + frame);
        }
        this.anims.create({
          key: `${key}_dir${dir}`,
          frames: dirFrames.map(f => ({ key, frame: f })),
          frameRate: 8,
          repeat: -1
        });
      }
    });
  }

  update(time: number, delta: number): void {
    if (this.isDestroyed) return;

    // Camera controls: keyboard panning + edge scrolling
    this.updateCameraControls(delta);

    this.animationTimer += delta;
    if (this.animationTimer > RENDER_CONFIG.animationFrameInterval) {
      this.animationFrame = (this.animationFrame + 1) % SPRITE_CONFIG.frames;
      this.animationTimer = 0;
      this.updateUnitAnimations();
    }

    this.selectionGraphics.clear();
    this.updateHealthBars();
    this.updateSelectionVisuals();

    this.renderWaypoints();
    this.renderPlacementPreview();
    this.renderSelectionBox();
    this.renderMovePreview();
    const isPaused = useGameStore.getState().isPaused;
    if (!isPaused) {
      this.systemManager?.update(time, delta);
      this.effectSystem?.updateProjectiles();
      this.updateDynamicObstacles();
    }
    this.updateSoundCameraPosition();
    this.soundManager?.update(time);
    this.updateFogOfWar(time);
    this.updatePsychicSensorRings();
    this.updateRadiationZoneVisuals();
    this.updateIvanBombVisuals();
    this.updateSubmergedSubVisuals();
    this.updateGapGeneratorVisuals();
    this.updateChronoFreezeVisuals();
  }

  private renderPlacementPreview(): void {
    const store = useGameStore.getState();
    if (!store.placementBuildingType || !store.placementPreviewPos) return;

    const pos = store.placementPreviewPos;
    const valid = store.placementValid;

    // Get building size from data
    const factionBuildings = BUILDINGS_BY_FACTION[store.currentPlayer?.faction || 'usa'] || {};
    const buildingData = factionBuildings[store.placementBuildingType];
    if (!buildingData) return;

    const w = (buildingData.width || 2) * GAME_CONFIG.TILE_SIZE;
    const h = (buildingData.height || 2) * GAME_CONFIG.TILE_SIZE;

    // Build a render-space polygon from the 4 logical corners of the
    // placement footprint so the preview matches the iso ground plane.
    const c0 = logicalToRender(pos.x, pos.y);
    const c1 = logicalToRender(pos.x + w, pos.y);
    const c2 = logicalToRender(pos.x + w, pos.y + h);
    const c3 = logicalToRender(pos.x, pos.y + h);

    const graphics = this.selectionGraphics;
    const fillColor = valid ? 0x00ff00 : 0xff0000;
    graphics.fillStyle(fillColor, 0.3);
    graphics.beginPath();
    graphics.moveTo(c0.x, c0.y);
    graphics.lineTo(c1.x, c1.y);
    graphics.lineTo(c2.x, c2.y);
    graphics.lineTo(c3.x, c3.y);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, fillColor, 0.8);
    graphics.beginPath();
    graphics.moveTo(c0.x, c0.y);
    graphics.lineTo(c1.x, c1.y);
    graphics.lineTo(c2.x, c2.y);
    graphics.lineTo(c3.x, c3.y);
    graphics.closePath();
    graphics.strokePath();

    // Draw inner tile grid lines (also projected) so building footprint reads.
    graphics.lineStyle(1, fillColor, 0.15);
    for (let tx = 1; tx < (buildingData.width || 2); tx++) {
      const a = logicalToRender(pos.x + tx * GAME_CONFIG.TILE_SIZE, pos.y);
      const b = logicalToRender(pos.x + tx * GAME_CONFIG.TILE_SIZE, pos.y + h);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let ty = 1; ty < (buildingData.height || 2); ty++) {
      const a = logicalToRender(pos.x, pos.y + ty * GAME_CONFIG.TILE_SIZE);
      const b = logicalToRender(pos.x + w, pos.y + ty * GAME_CONFIG.TILE_SIZE);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  private renderSelectionBox(): void {
    const store = useGameStore.getState();
    if (!store.selectionBox) return;

    const { start, end } = store.selectionBox;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    if (Math.abs(maxX - minX) < 2 && Math.abs(maxY - minY) < 2) return;

    // Project the 4 logical corners to render space and draw a diamond.
    const c0 = logicalToRender(minX, minY);
    const c1 = logicalToRender(maxX, minY);
    const c2 = logicalToRender(maxX, maxY);
    const c3 = logicalToRender(minX, maxY);

    const graphics = this.selectionGraphics;
    graphics.fillStyle(0x00ff00, 0.1);
    graphics.beginPath();
    graphics.moveTo(c0.x, c0.y);
    graphics.lineTo(c1.x, c1.y);
    graphics.lineTo(c2.x, c2.y);
    graphics.lineTo(c3.x, c3.y);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(1, 0x00ff00, 0.6);
    graphics.beginPath();
    graphics.moveTo(c0.x, c0.y);
    graphics.lineTo(c1.x, c1.y);
    graphics.lineTo(c2.x, c2.y);
    graphics.lineTo(c3.x, c3.y);
    graphics.closePath();
    graphics.strokePath();
  }

  private renderMovePreview(): void {
    if (!this.isRightMouseDown) {
      this.hideMovePreview();
      return;
    }

    const store = useGameStore.getState();
    const selectedUnits = store.selectedUnits;
    if (selectedUnits.length === 0) {
      this.hideMovePreview();
      return;
    }

    // Calculate center of selected units in logical space
    let cx = 0, cy = 0;
    for (const unit of selectedUnits) {
      cx += unit.position.x;
      cy += unit.position.y;
    }
    cx /= selectedUnits.length;
    cy /= selectedUnits.length;

    // Get mouse world position via Phaser pointer
    const pointer = this.input.activePointer;
    const worldPos = this.screenToWorld(pointer.x, pointer.y);

    // Project both points to render space
    const from = logicalToRender(cx, cy);
    const to = logicalToRender(worldPos.x, worldPos.y);

    this.showMovePreview(from.x, from.y, to.x, to.y);
  }

  private showMovePreview(fromX: number, fromY: number, toX: number, toY: number): void {
    if (!this.movePreviewLine) {
      this.movePreviewLine = this.add.graphics();
      this.movePreviewLine.setDepth(900);
    }

    this.movePreviewLine.clear();
    this.movePreviewLine.lineStyle(2, 0x00ff88, 0.5);
    this.movePreviewLine.lineBetween(fromX, fromY, toX, toY);

    // Draw a small circle at the target
    this.movePreviewLine.fillStyle(0x00ff88, 0.5);
    this.movePreviewLine.fillCircle(toX, toY, 5);
  }

  private hideMovePreview(): void {
    this.movePreviewLine?.clear();
  }

  private updateUnitAnimations(): void {
    this.unitSprites.forEach((sprite, id) => {
      if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;
      const state = this.unitStates.get(id);
      if (!state) return;

      const animKey = `${sprite.texture.key}_dir${state.direction}`;
      if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== animKey) {
        sprite.play(animKey, true);
      }
    });
  }

  private updateSelectionVisuals(): void {
    this.unitSprites.forEach((sprite, id) => {
      const state = this.unitStates.get(id);
      if (state?.isSelected) {
        this.selectionGraphics.lineStyle(2, HEALTH_BAR_COLORS.selection, 1);
        this.selectionGraphics.strokeCircle(
          sprite.x,
          sprite.y,
          RENDER_CONFIG.selectionCircleRadius
        );
      }
    });

    this.buildingSprites.forEach((sprite, id) => {
      const state = this.buildingStates.get(id);
      if (state?.isSelected) {
        this.selectionGraphics.lineStyle(2, HEALTH_BAR_COLORS.selection, 1);
        this.selectionGraphics.strokeRect(
          sprite.x - state.width / 2,
          sprite.y - state.height / 2,
          state.width,
          state.height
        );
      }
    });
  }

  private updateHealthBars(): void {
    // Check for active captures that need real-time progress updates
    const store = useGameStore.getState();
    const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean) as Player[];
    const hasActiveCapture = allPlayers.some(p =>
      p.units.some(u => u.data.canCapture && u.state === 'capturing')
    );
    if (!this.healthBarsDirty && !hasActiveCapture) return;
    this.unitHealthBars.forEach((graphics, id) => {
      const state = this.unitStates.get(id);
      const sprite = this.unitSprites.get(id);

      graphics.clear();
      if (state && sprite) {
        // Draw invulnerability indicator (Iron Curtain)
        if (state.isInvulnerable) {
          const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 200);
          graphics.lineStyle(2, 0xffd700, pulse);
          graphics.strokeCircle(sprite.x, sprite.y, 18);
        }

        // Draw rank badge above unit
        if (state.rank !== UnitRank.ROOKIE) {
          const badgeY = sprite.y - RENDER_CONFIG.unitHealthBarOffsetY - 10;
          const badgeX = sprite.x;
          const rankColor = 0xffd700;
          graphics.fillStyle(rankColor, 1);
          // Draw star shape
          const starSize = 4;
          const starCount = state.rank === UnitRank.ELITE ? 2 : 1;
          const offsetX = starCount === 2 ? -starSize : 0;
          for (let s = 0; s < starCount; s++) {
            const cx = badgeX + offsetX + s * starSize * 2.5;
            this.drawStar(graphics, cx, badgeY, starSize);
          }
        }

        if (state.health < state.maxHealth) {
          this.drawHealthBar(
            graphics,
            sprite.x,
            sprite.y - RENDER_CONFIG.unitHealthBarOffsetY,
            state.health,
            state.maxHealth
          );
        }

        // Draw deploy progress bar when unit is deploying
        if (state.isDeploying && state.deployTimer !== undefined) {
          const deployTotalTime = 5000; // 5 seconds default deploy time
          const deployElapsed = deployTotalTime - state.deployTimer;
          const deployProgress = Math.max(0, Math.min(1, deployElapsed / deployTotalTime));
          const barY = sprite.y - RENDER_CONFIG.unitHealthBarOffsetY - (state.health < state.maxHealth ? RENDER_CONFIG.healthBarHeight + 4 : 0);
          this.drawDeployBar(graphics, sprite.x, barY, deployProgress);
        }
      }
    });

    this.buildingHealthBars.forEach((graphics, id) => {
      const state = this.buildingStates.get(id);
      const sprite = this.buildingSprites.get(id);

      graphics.clear();
      if (state && sprite) {
        const barY = sprite.y - state.height / 2 - RENDER_CONFIG.buildingHealthBarOffsetY;
        if (state.health < state.maxHealth) {
          this.drawHealthBar(
            graphics,
            sprite.x,
            barY,
            state.health,
            state.maxHealth
          );
        }

        // Building damage smoke effect
        const healthPercent = state.health / state.maxHealth;
        if (healthPercent < 0.75 && state.isConstructed) {
          // Emit smoke particles for damaged buildings
          if (this.effectSystem) {
            const smokeIntensity = healthPercent < 0.25 ? 'heavy' : healthPercent < 0.5 ? 'medium' : 'light';
            const smokeKey = `building_smoke_${id}`;
            // Only emit every ~2 seconds to avoid spam
            const now = this.time.now;
            const lastSmoke = (sprite as Phaser.GameObjects.Image).getData('lastSmokeTime') as number || 0;
            if (now - lastSmoke > 2000) {
              (sprite as Phaser.GameObjects.Image).setData('lastSmokeTime', now);
              this.effectSystem.playSmoke(sprite.x, sprite.y - state.height * 0.3);
              if (smokeIntensity === 'heavy') {
                this.effectSystem.playSmoke(sprite.x - 10, sprite.y - state.height * 0.5);
              }
            }
          }
        }

        // Draw ore storage bar for refineries
        if (state.oreStorage !== undefined && state.maxOreStorage) {
          const oreBarY = barY + (state.health < state.maxHealth ? RENDER_CONFIG.healthBarHeight + 3 : 0);
          this.drawOreBar(
            graphics,
            sprite.x,
            oreBarY,
            state.oreStorage,
            state.maxOreStorage
          );
        }

        // Draw capture progress bar if building is being captured
        const activeCaptures = captureSystem.getActiveCaptures();
        const captureProgress = activeCaptures.get(id) || 0;
        if (captureProgress > 0) {
          const captureBarY = barY + (state.health < state.maxHealth ? RENDER_CONFIG.healthBarHeight + 3 : 0) + (state.oreStorage !== undefined ? 7 : 0);
          this.drawCaptureBar(graphics, sprite.x, captureBarY, captureProgress);
        }
      }
    });
    this.healthBarsDirty = false;
  }

  private drawHealthBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    health: number,
    maxHealth: number
  ): void {
    const { healthBarWidth: width, healthBarHeight: height } = RENDER_CONFIG;
    const healthPercent = Math.max(0, Math.min(1, health / maxHealth));

    graphics.fillStyle(HEALTH_BAR_COLORS.background, HEALTH_BAR_COLORS.backgroundAlpha);
    graphics.fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);

    graphics.fillStyle(HEALTH_BAR_COLORS.barBackground, 1);
    graphics.fillRect(x - width / 2, y, width, height);

    graphics.fillStyle(getHealthColor(healthPercent), 1);
    graphics.fillRect(x - width / 2, y, width * healthPercent, height);
  }

  private drawOreBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    ore: number,
    maxOre: number
  ): void {
    const { healthBarWidth: width } = RENDER_CONFIG;
    const height = 4;
    const orePercent = Math.max(0, Math.min(1, ore / maxOre));

    graphics.fillStyle(HEALTH_BAR_COLORS.background, HEALTH_BAR_COLORS.backgroundAlpha);
    graphics.fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);

    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillRect(x - width / 2, y, width, height);

    // Amber/yellow color for ore
    graphics.fillStyle(0xd4a017, 1);
    graphics.fillRect(x - width / 2, y, width * orePercent, height);
  }

  private drawCaptureBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    progress: number
  ): void {
    const { healthBarWidth: width } = RENDER_CONFIG;
    const height = 4;
    const capturePercent = Math.max(0, Math.min(1, progress));

    graphics.fillStyle(HEALTH_BAR_COLORS.background, HEALTH_BAR_COLORS.backgroundAlpha);
    graphics.fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);

    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillRect(x - width / 2, y, width, height);

    // Red-orange pulsing color for capture progress
    const pulse = 0.8 + Math.sin(this.time.now / 200) * 0.2;
    graphics.fillStyle(0xff6600, pulse);
    graphics.fillRect(x - width / 2, y, width * capturePercent, height);
  }

  private drawDeployBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    progress: number
  ): void {
    const { healthBarWidth: width } = RENDER_CONFIG;
    const height = 4;
    const deployPercent = Math.max(0, Math.min(1, progress));

    graphics.fillStyle(HEALTH_BAR_COLORS.background, HEALTH_BAR_COLORS.backgroundAlpha);
    graphics.fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);

    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillRect(x - width / 2, y, width, height);

    // Blue pulsing color for deploy progress
    const pulse = 0.8 + Math.sin(this.time.now / 300) * 0.2;
    graphics.fillStyle(0x44aaff, pulse);
    graphics.fillRect(x - width / 2, y, width * deployPercent, height);
  }

  private drawStar(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    graphics.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? size : size * 0.4;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) graphics.moveTo(px, py);
      else graphics.lineTo(px, py);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  // Draw a 2:1 diamond path (top, right, bottom, left) without filling/stroking.
  // The caller is expected to invoke fillPath()/strokePath() afterwards.
  private drawDiamondPath(
    graphics: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    halfW: number,
    halfH: number
  ): void {
    graphics.beginPath();
    graphics.moveTo(cx, cy - halfH);
    graphics.lineTo(cx + halfW, cy);
    graphics.lineTo(cx, cy + halfH);
    graphics.lineTo(cx - halfW, cy);
    graphics.closePath();
  }

  // Draw a tile diamond in render space, offset by (-ox, -oy) so the whole
  // figure fits inside a render-texture whose origin is at (ox, oy).
  private fillTileDiamond(
    graphics: Phaser.GameObjects.Graphics,
    tileX: number,
    tileY: number,
    tileSize: number,
    ox: number,
    oy: number
  ): { cx: number; cy: number } {
    const verts = tileDiamond(tileX, tileY, tileSize);
    graphics.beginPath();
    graphics.moveTo(verts[0].x - ox, verts[0].y - oy);
    for (let i = 1; i < verts.length; i++) {
      graphics.lineTo(verts[i].x - ox, verts[i].y - oy);
    }
    graphics.closePath();
    graphics.fillPath();
    return {
      cx: (verts[0].x + verts[2].x) * 0.5 - ox,
      cy: (verts[0].y + verts[2].y) * 0.5 - oy,
    };
  }

  setWaypoints(lines: Array<{ points: Array<{ x: number; y: number }>; color: number }>): void {
    this.waypointLines = lines;
  }

  setCrates(nodes: Array<{ position: { x: number; y: number }; crateType?: string }>): void {
    if (!this.crateGraphics) {
      this.crateGraphics = this.add.graphics();
      this.crateGraphics.setDepth(5);
    }
    const gfx = this.crateGraphics;
    gfx.clear();

    const crateColors: Record<string, number> = {
      money: 0xffd700,
      heal: 0xff4444,
      veterancy: 0x44aaff,
    };
    const { tileSize } = SPRITE_CONFIG;

    for (const node of nodes) {
      // node.position is in tile coordinates; project the tile centre to render space.
      const center = tileCenterRender(node.position.x, node.position.y, tileSize);
      const worldX = center.x;
      const worldY = center.y;
      const color = crateColors[node.crateType || 'money'] || 0xffd700;
      // Draw the crate as a small diamond to match the isometric tile shape.
      const halfW = tileSize * 0.4; // half diamond width in render space
      const halfH = halfW * 0.5;    // 2:1 ratio
      gfx.fillStyle(color, 0.9);
      this.drawDiamondPath(gfx, worldX, worldY, halfW, halfH);
      gfx.fillPath();
      gfx.lineStyle(1, 0xffffff, 0.8);
      this.drawDiamondPath(gfx, worldX, worldY, halfW, halfH);
      gfx.strokePath();
      // X mark inside
      gfx.lineStyle(1, 0xffffff, 0.6);
      gfx.beginPath();
      gfx.moveTo(worldX - halfW * 0.5, worldY - halfH * 0.5);
      gfx.lineTo(worldX + halfW * 0.5, worldY + halfH * 0.5);
      gfx.moveTo(worldX + halfW * 0.5, worldY - halfH * 0.5);
      gfx.lineTo(worldX - halfW * 0.5, worldY + halfH * 0.5);
      gfx.strokePath();
    }
  }

  private renderWaypoints(): void {
    if (!this.waypointGraphics) {
      this.waypointGraphics = this.add.graphics();
      this.waypointGraphics.setDepth(999); // Above everything
    }
    const g = this.waypointGraphics;
    g.clear();

    for (const line of this.waypointLines) {
      if (line.points.length < 2) continue;
      g.lineStyle(1, line.color, 0.6);
      for (let i = 0; i < line.points.length - 1; i++) {
        // points are in logical (orthogonal) px; project into render space.
        // Drawing happens on a world-space graphics object so the camera will
        // apply the rest of the transform.
        const p1 = logicalToRender(line.points[i].x, line.points[i].y);
        const p2 = logicalToRender(line.points[i + 1].x, line.points[i + 1].y);
        // Draw dashed line by alternating draw segments
        const segments = 8;
        for (let s = 0; s < segments; s++) {
          if (s % 2 === 0) {
            const sx = p1.x + (p2.x - p1.x) * (s / segments);
            const sy = p1.y + (p2.y - p1.y) * (s / segments);
            const ex = p1.x + (p2.x - p1.x) * ((s + 1) / segments);
            const ey = p1.y + (p2.y - p1.y) * ((s + 1) / segments);
            g.lineBetween(sx, sy, ex, ey);
          }
        }
      }
    }
  }

  shakeCamera(intensity: number = 0.005, duration: number = 200): void {
    if (this.cameras?.main) {
      this.cameras.main.shake(duration, intensity);
    }
  }

  private showPingEffect(worldX: number, worldY: number): void {
    const { x: renderX, y: renderY } = logicalToRender(worldX, worldY);
    const graphics = this.add.graphics();
    graphics.setDepth(9999);

    const drawCircle = (scale: number, alpha: number) => {
      graphics.clear();
      graphics.lineStyle(3, 0x00ff00, alpha);
      graphics.strokeCircle(renderX, renderY, 20 * scale);
      graphics.fillStyle(0x00ff00, alpha * 0.15);
      graphics.fillCircle(renderX, renderY, 20 * scale);
    };

    drawCircle(1, 1);

    this.tweens.add({
      targets: { scale: 1, alpha: 1 },
      scale: 3,
      alpha: 0,
      duration: 2000,
      onUpdate: (tween) => {
        const progress = tween.progress;
        drawCircle(1 + progress * 2, 1 - progress);
      },
      onComplete: () => {
        graphics.destroy();
      }
    });
  }

  private saveCameraBookmark(index: number): void {
    if (!this.cameras?.main) return;
    const camera = this.cameras.main;
    const x = camera.scrollX + camera.width / 2;
    const y = camera.scrollY + camera.height / 2;
    useGameStore.getState().saveCameraBookmark(index, { x, y });
    gameEventBus.emit('ui:notification', { message: `视角书签 ${index + 1} 已保存`, type: 'info' });
  }

  private loadCameraBookmark(index: number): void {
    const bookmark = useGameStore.getState().loadCameraBookmark(index);
    if (bookmark && this.cameras?.main) {
      this.cameras.main.pan(bookmark.x, bookmark.y, 300);
    }
  }

  private centerCameraOnWorld(worldX: number, worldY: number): void {
    if (!this.cameras?.main) return;
    // Project logical coordinates to render space for camera targeting
    const { x: renderX, y: renderY } = logicalToRender(worldX, worldY);
    this.cameras.main.pan(renderX, renderY, 300);
  }

  getEffectSystem(): EffectSystem | undefined {
    return this.effectSystem;
  }

  dispose(): void {
    this.isDestroyed = true;

    // Stop all active tweens to prevent callbacks on destroyed objects
    this.tweens.killAll();

    // Clean up rankGlowGraphics attached to unit sprites
    this.unitSprites.forEach(sprite => {
      const glow = sprite.getData('rankGlowGraphics');
      if (glow) {
        (glow as Phaser.GameObjects.Arc).destroy();
      }
      sprite.destroy();
    });
    this.buildingSprites.forEach(sprite => sprite.destroy());
    this.unitHealthBars.forEach(graphics => graphics.destroy());
    this.buildingHealthBars.forEach(graphics => graphics.destroy());
    this.unitGroupBadges.forEach(badge => badge.destroy());
    this.powerWarningIcons.forEach(icon => {
      this.tweens.killTweensOf(icon);
      icon.destroy();
    });
    this.garrisonIndicators.forEach(indicator => indicator.destroy());
    this.bridgeDestroyedOverlays.forEach(overlay => overlay.destroy());
    this.psychicSensorRings.forEach(ring => ring.destroy());
    this.radiationZoneGraphics.forEach(gfx => gfx.destroy());
    this.radiationZoneLabels.forEach(label => label.destroy());
    this.ivanBombGraphics.forEach(gfx => gfx.destroy());
    this.ivanBombLabels.forEach(label => label.destroy());
    this.submergedSubRipples.forEach(ripple => ripple.destroy());
    this.gapGeneratorOverlays.forEach(overlay => overlay.destroy());
    this.chronoFreezeOverlays.forEach(overlay => overlay.destroy());

    this.unitSprites.clear();
    this.buildingSprites.clear();
    this.unitHealthBars.clear();
    this.buildingHealthBars.clear();
    this.unitGroupBadges.clear();
    this.powerWarningIcons.clear();
    this.garrisonIndicators.clear();
    this.bridgeDestroyedOverlays.clear();
    this.psychicSensorRings.clear();
    this.radiationZoneGraphics.clear();
    this.radiationZoneLabels.clear();
    this.ivanBombGraphics.clear();
    this.ivanBombLabels.clear();
    this.submergedSubRipples.clear();
    this.gapGeneratorOverlays.clear();
    this.chronoFreezeOverlays.clear();
    this.unitStates.clear();
    this.buildingStates.clear();

    this.terrainLayer?.destroy();
    this.selectionGraphics?.destroy();
    this.movePreviewLine?.destroy();
    this.movePreviewLine = null;
    this.crateGraphics?.destroy();
    this.crateGraphics = undefined;
    this.waypointGraphics?.destroy();
    this.waypointGraphics = undefined;
    this.terrainImage?.destroy();
    this.terrainImage = null;
    this.terrainTexture?.destroy();
    this.terrainTexture = null;

    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];

    this.fogOfWar?.dispose();
    this.soundManager?.dispose();
    this.hotkeyManager?.dispose();
    this.groupManager?.dispose();
    this.pathfindingManager?.dispose();
    this.effectSystem?.dispose();
    this.indicatorSystem?.dispose();
    this.systemManager?.dispose();
    gameEventBridge.dispose();
  }

  createTerrain(map: GameMapData | number, mapHeight?: number): void {
    if (this.isDestroyed) return;

    this.terrainLayer.removeAll(true);

    let mapData: GameMapData;
    if (typeof map === 'number') {
      mapData = this.currentMap || {
        id: 'default',
        name: 'Default Map',
        width: map,
        height: mapHeight || 50,
        tiles: [],
        spawnPoints: [],
        resourceNodes: []
      };
    } else {
      mapData = map;
      this.currentMap = map;
    }

    this.worldWidth = mapData.width * SPRITE_CONFIG.tileSize;
    this.worldHeight = mapData.height * SPRITE_CONFIG.tileSize;

    this.initializeFogOfWar(mapData);
    this.initializePathfinding(mapData);
    this.drawTerrain(mapData);
  }

  private initializeFogOfWar(mapData: GameMapData): void {
    this.fogOfWar = new FogOfWar(this, this.fogConfig);
    this.fogOfWar.create(mapData.width, mapData.height, GAME_CONFIG.TILE_SIZE);
  }

  private updateDynamicObstacles(): void {
    if (!this.pathfindingManager) return;
    // Update every 6 frames (~10Hz at 60fps) to reduce GC pressure from temp arrays
    if (++this.dynamicObstacleFrame % 6 !== 0) return;
    const store = useGameStore.getState();
    const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean) as Player[];
    const allUnits = allPlayers.flatMap(p => p.units);
    this.pathfindingManager.updateDynamicObstacles(
      allUnits.map(u => ({
        id: u.id,
        position: u.position,
        isAirborne: u.isAirborne,
        isNaval: u.isNaval ?? false,
      }))
    );
  }

  private updateSoundCameraPosition(): void {
    if (!this.soundManager || !this.cameras?.main) return;
    const cam = this.cameras.main;
    // Convert render-space camera center to logical space for sound positioning
    const center = renderToLogical(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2);
    this.soundManager.setCameraPosition(center.x, center.y);
  }

  private updateFogOfWar(time: number): void {
    if (!this.fogOfWar) return;

    const store = useGameStore.getState();
    const player = store.currentPlayer;
    if (!player) return;

    // Observer mode: reveal entire map
    if (store.isObserverMode) {
      this.fogOfWar.revealAll();
      this.fogOfWar.update(time);
      return;
    }

    // Fog of War disabled: reveal entire map
    if (!store.gameSettings.fogOfWarEnabled) {
      this.fogOfWar.revealAll();
      this.fogOfWar.update(time);
      return;
    }

    // Spy Satellite: reveal entire map (upgrade-based or building-based)
    const hasSpySatelliteBuilding = player.buildings.some(
      b => b.type === BuildingType.SPY_SATELLITE && b.isConstructed && b.isPowered
    );
    if (player.researchedUpgrades.includes(UpgradeType.SPY_SATELLITE) || hasSpySatelliteBuilding) {
      this.fogOfWar.revealAll();
      this.fogOfWar.update(time);
      return;
    }

    // Combined vision modifier from weather and day/night
    const visionModifier = store.weatherVisionModifier * store.dayNightVisionModifier;

    this.fogOfWar.clearObservers();

    for (const unit of player.units) {
      const tileX = Math.floor(unit.position.x / GAME_CONFIG.TILE_SIZE);
      const tileY = Math.floor(unit.position.y / GAME_CONFIG.TILE_SIZE);
      this.fogOfWar.addObserver(tileX, tileY, unit.vision * visionModifier);
    }

    for (const building of player.buildings) {
      const tileX = Math.floor(building.position.x / GAME_CONFIG.TILE_SIZE);
      const tileY = Math.floor(building.position.y / GAME_CONFIG.TILE_SIZE);
      // Radar buildings provide extended vision
      const visionRadius = building.type === BuildingType.RADAR
        ? GAME_CONFIG.BUILDING_VISION_RADIUS * 2
        : GAME_CONFIG.BUILDING_VISION_RADIUS;
      this.fogOfWar.addObserver(tileX, tileY, visionRadius * visionModifier);
    }

    // Update gap generators from enemy players - they hide areas from this player's vision
    const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean);
    const enemyBuildings: Array<{
      id: string;
      position: { x: number; y: number };
      isConstructed: boolean;
      isPowered: boolean;
      type: string;
      faction: string;
    }> = [];
    for (const p of allPlayers) {
      if (p.id === player.id) continue;
      if (player.teamId !== undefined && p.teamId === player.teamId) continue;
      for (const b of p.buildings) {
        enemyBuildings.push({
          id: b.id,
          position: {
            x: Math.floor(b.position.x / GAME_CONFIG.TILE_SIZE),
            y: Math.floor(b.position.y / GAME_CONFIG.TILE_SIZE),
          },
          isConstructed: b.isConstructed,
          isPowered: b.isPowered,
          type: b.type,
          faction: b.faction,
        });
      }
    }
    this.fogOfWar.updateGapGenerators(enemyBuildings);

    this.fogOfWar.update(time);
  }

  private updatePsychicSensorRings(): void {
    this.psychicSensorRings.forEach((ring, id) => {
      const sprite = this.buildingSprites.get(id);
      if (!sprite) return;
      ring.clear();
      // Pulsing alpha for the detection ring
      const pulse = 0.15 + 0.1 * Math.sin(this.time.now / 800);
      const detectionRadius = 60;
      ring.lineStyle(2, 0xcc44ff, pulse);
      ring.strokeCircle(0, 0, detectionRadius);
      // Inner faint fill
      ring.fillStyle(0xcc44ff, pulse * 0.15);
      ring.fillCircle(0, 0, detectionRadius);
      // Secondary pulsing ring (delayed phase)
      const pulse2 = 0.08 + 0.06 * Math.sin(this.time.now / 800 + Math.PI);
      ring.lineStyle(1, 0xcc44ff, pulse2);
      ring.strokeCircle(0, 0, detectionRadius * 0.7);
    });
  }

  // --- Radiation Zone Visual ---
  private updateRadiationZoneVisuals(): void {
    const zones = radiationSystem.getZones();
    const activeZoneIds = new Set(zones.map(z => z.id));

    // Remove graphics for expired zones
    this.radiationZoneGraphics.forEach((gfx, id) => {
      if (!activeZoneIds.has(id)) {
        gfx.destroy();
        this.radiationZoneGraphics.delete(id);
      }
    });
    this.radiationZoneLabels.forEach((label, id) => {
      if (!activeZoneIds.has(id)) {
        label.destroy();
        this.radiationZoneLabels.delete(id);
      }
    });

    for (const zone of zones) {
      const { x: renderX, y: renderY } = logicalToRender(zone.position.x, zone.position.y);
      const renderRadius = zone.radius * (SPRITE_CONFIG.tileSize / GAME_CONFIG.TILE_SIZE);

      let gfx = this.radiationZoneGraphics.get(zone.id);
      if (!gfx) {
        gfx = this.add.graphics();
        gfx.setDepth(RENDER_CONFIG.unitDepthBase - 2);
        this.radiationZoneGraphics.set(zone.id, gfx);
      }

      let label = this.radiationZoneLabels.get(zone.id);
      if (!label) {
        label = this.add.text(renderX, renderY, '☢', {
          fontSize: '16px',
          color: '#00ff00',
          fontFamily: 'Arial',
          stroke: '#003300',
          strokeThickness: 2,
        });
        label.setOrigin(0.5, 0.5);
        label.setDepth(RENDER_CONFIG.unitDepthBase - 1);
        this.radiationZoneLabels.set(zone.id, label);
      }

      gfx.clear();
      // Pulsing green circle
      const pulse = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(this.time.now / 500));
      gfx.fillStyle(0x00ff00, pulse);
      gfx.fillCircle(renderX, renderY, renderRadius);
      gfx.lineStyle(2, 0x00ff00, pulse + 0.1);
      gfx.strokeCircle(renderX, renderY, renderRadius);

      label.setPosition(renderX, renderY);
      label.setAlpha(pulse + 0.3);
    }
  }

  // --- Ivan Bomb Indicator ---
  private updateIvanBombVisuals(): void {
    const bombs = ivanBombSystem.getBombs();
    const activeBombIds = new Set(bombs.map(b => b.id));

    // Remove graphics for detonated bombs
    this.ivanBombGraphics.forEach((gfx, id) => {
      if (!activeBombIds.has(id)) {
        gfx.destroy();
        this.ivanBombGraphics.delete(id);
      }
    });
    this.ivanBombLabels.forEach((label, id) => {
      if (!activeBombIds.has(id)) {
        label.destroy();
        this.ivanBombLabels.delete(id);
      }
    });

    for (const bomb of bombs) {
      const { x: renderX, y: renderY } = logicalToRender(bomb.targetPosition.x, bomb.targetPosition.y);

      let gfx = this.ivanBombGraphics.get(bomb.id);
      if (!gfx) {
        gfx = this.add.graphics();
        gfx.setDepth(RENDER_CONFIG.healthBarDepth + 1);
        this.ivanBombGraphics.set(bomb.id, gfx);
      }

      let label = this.ivanBombLabels.get(bomb.id);
      if (!label) {
        label = this.add.text(renderX, renderY - 20, '', {
          fontSize: '12px',
          color: '#ff4444',
          fontStyle: 'bold',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        });
        label.setOrigin(0.5, 0.5);
        label.setDepth(RENDER_CONFIG.healthBarDepth + 2);
        this.ivanBombLabels.set(bomb.id, label);
      }

      gfx.clear();
      // Red flashing circle - pulses faster as timer approaches 0
      const speed = Math.max(100, bomb.timer * 150);
      const flash = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.time.now / speed));
      gfx.fillStyle(0xff0000, flash * 0.4);
      gfx.fillCircle(renderX, renderY, 18);
      gfx.lineStyle(2, 0xff0000, flash);
      gfx.strokeCircle(renderX, renderY, 18);

      // Countdown timer text
      const seconds = Math.max(0, Math.ceil(bomb.timer));
      label.setText(`${seconds}s`);
      label.setPosition(renderX, renderY - 28);
      label.setAlpha(flash);
    }
  }

  // --- Submarine Submerged Visual ---
  private updateSubmergedSubVisuals(): void {
    const store = useGameStore.getState();
    const currentPlayer = store.currentPlayer;
    if (!currentPlayer) return;

    const allPlayers = [currentPlayer, ...store.aiPlayers].filter(Boolean) as Player[];

    // Track which subs are currently submerged for ripple cleanup
    const activeSubIds = new Set<string>();

    for (const player of allPlayers) {
      const isOwner = player.id === currentPlayer.id;

      for (const unit of player.units) {
        if (unit.isSubmerged) {
          activeSubIds.add(unit.id);

          const sprite = this.unitSprites.get(unit.id);
          if (sprite) {
            if (isOwner) {
              // Semi-transparent for owning player
              sprite.setAlpha(0.4);
            }
          }

          // Water ripple effect around submerged sub
          let ripple = this.submergedSubRipples.get(unit.id);
          if (!ripple) {
            ripple = this.add.graphics();
            ripple.setDepth(RENDER_CONFIG.unitDepthBase - 1);
            this.submergedSubRipples.set(unit.id, ripple);
          }

          const { x: renderX, y: renderY } = logicalToRender(unit.position.x, unit.position.y);
          ripple.clear();
          const ripplePhase = this.time.now / 600;
          const rippleAlpha = 0.15 + 0.1 * Math.sin(ripplePhase);
          ripple.lineStyle(1, 0x88bbff, rippleAlpha);
          ripple.strokeCircle(renderX, renderY, 12 + 3 * Math.sin(ripplePhase));
          ripple.lineStyle(1, 0x88bbff, rippleAlpha * 0.6);
          ripple.strokeCircle(renderX, renderY, 18 + 2 * Math.sin(ripplePhase + 1));
        } else {
          // Not submerged - restore alpha if it was previously submerged
          const ripple = this.submergedSubRipples.get(unit.id);
          if (ripple) {
            ripple.destroy();
            this.submergedSubRipples.delete(unit.id);
          }
          // Only restore alpha for own units (enemy visibility handled by fog of war)
          if (player.id === currentPlayer.id) {
            const sprite = this.unitSprites.get(unit.id);
            if (sprite) {
              sprite.setAlpha(1.0);
            }
          }
        }
      }
    }

    // Clean up ripples for units no longer submerged
    this.submergedSubRipples.forEach((ripple, id) => {
      if (!activeSubIds.has(id)) {
        ripple.destroy();
        this.submergedSubRipples.delete(id);
      }
    });
  }

  // --- Gap Generator Fog Effect ---
  private updateGapGeneratorVisuals(): void {
    const store = useGameStore.getState();
    const currentPlayer = store.currentPlayer;
    if (!currentPlayer) return;

    const allPlayers = [currentPlayer, ...store.aiPlayers].filter(Boolean) as Player[];
    const activeGapIds = new Set<string>();

    // Find enemy gap generators
    for (const player of allPlayers) {
      if (player.id === currentPlayer.id) continue;
      if (currentPlayer.teamId !== undefined && player.teamId === currentPlayer.teamId) continue;

      for (const building of player.buildings) {
        if (building.type === BuildingType.GAP_GENERATOR && building.isConstructed && building.isPowered) {
          activeGapIds.add(building.id);

          let overlay = this.gapGeneratorOverlays.get(building.id);
          if (!overlay) {
            overlay = this.add.graphics();
            overlay.setDepth(RENDER_CONFIG.unitDepthBase - 3);
            this.gapGeneratorOverlays.set(building.id, overlay);
          }

          const { x: renderX, y: renderY } = logicalToRender(building.position.x, building.position.y);
          // Gap generator radius is 10 tiles
          const gapRadius = 10 * SPRITE_CONFIG.tileSize;
          const pulse = 0.08 + 0.04 * Math.sin(this.time.now / 1200);

          overlay.clear();
          overlay.fillStyle(0x000044, pulse);
          overlay.fillCircle(renderX, renderY, gapRadius);
          overlay.lineStyle(1, 0x000066, pulse + 0.05);
          overlay.strokeCircle(renderX, renderY, gapRadius);
        }
      }
    }

    // Clean up overlays for inactive gap generators
    this.gapGeneratorOverlays.forEach((overlay, id) => {
      if (!activeGapIds.has(id)) {
        overlay.destroy();
        this.gapGeneratorOverlays.delete(id);
      }
    });
  }

  // --- Chrono Freeze Visual ---
  private updateChronoFreezeVisuals(): void {
    const store = useGameStore.getState();
    const currentPlayer = store.currentPlayer;
    if (!currentPlayer) return;

    const allPlayers = [currentPlayer, ...store.aiPlayers].filter(Boolean) as Player[];
    const activeFreezeIds = new Set<string>();

    for (const player of allPlayers) {
      // Check units for freeze progress
      for (const unit of player.units) {
        if (unit.chronoFreezeProgress && unit.chronoFreezeProgress > 0) {
          activeFreezeIds.add(unit.id);
          const sprite = this.unitSprites.get(unit.id);
          if (sprite) {
            // Apply blue tint overlay (only Sprite supports tint, not Shape)
            const alpha = unit.chronoFreezeProgress * 0.6;
            if (sprite instanceof Phaser.GameObjects.Sprite) {
              sprite.setTint(0x4488ff, 0x4488ff, 0x4488ff, 0x4488ff);
            }
            sprite.setAlpha(1 - alpha * 0.3);
          }

          // Draw freeze overlay circle
          let gfx = this.chronoFreezeOverlays.get(unit.id);
          if (!gfx) {
            gfx = this.add.graphics();
            gfx.setDepth(RENDER_CONFIG.unitDepthBase + 1);
            this.chronoFreezeOverlays.set(unit.id, gfx);
          }

          const { x: renderX, y: renderY } = logicalToRender(unit.position.x, unit.position.y);
          gfx.clear();
          const freezeAlpha = unit.chronoFreezeProgress * 0.6;
          const pulse = 0.8 + 0.2 * Math.sin(this.time.now / 400);
          gfx.fillStyle(0x4488ff, freezeAlpha * pulse);
          gfx.fillCircle(renderX, renderY, 16);
          gfx.lineStyle(2, 0x88bbff, freezeAlpha * pulse);
          gfx.strokeCircle(renderX, renderY, 16);
        } else {
          // Not frozen - restore normal appearance
          const sprite = this.unitSprites.get(unit.id);
          if (sprite && player.id === currentPlayer.id) {
            if (sprite instanceof Phaser.GameObjects.Sprite) {
              sprite.clearTint();
            }
            sprite.setAlpha(1.0);
          }
        }
      }

      // Check buildings for freeze progress
      for (const building of player.buildings) {
        if (building.chronoFreezeProgress && building.chronoFreezeProgress > 0) {
          activeFreezeIds.add(building.id);
          const sprite = this.buildingSprites.get(building.id);
          if (sprite) {
            const alpha = building.chronoFreezeProgress * 0.6;
            if (sprite instanceof Phaser.GameObjects.Image) {
              sprite.setTint(0x4488ff);
            }
            sprite.setAlpha(1 - alpha * 0.3);
          }

          let gfx = this.chronoFreezeOverlays.get(building.id);
          if (!gfx) {
            gfx = this.add.graphics();
            gfx.setDepth(RENDER_CONFIG.healthBarDepth + 1);
            this.chronoFreezeOverlays.set(building.id, gfx);
          }

          const { x: renderX, y: renderY } = logicalToRender(building.position.x, building.position.y);
          const bState = this.buildingStates.get(building.id);
          const w = bState?.width || 64;
          const h = bState?.height || 64;
          gfx.clear();
          const freezeAlpha = building.chronoFreezeProgress * 0.6;
          const pulse = 0.8 + 0.2 * Math.sin(this.time.now / 400);
          gfx.fillStyle(0x4488ff, freezeAlpha * pulse);
          gfx.fillRect(renderX - w / 2, renderY - h / 2, w, h);
          gfx.lineStyle(2, 0x88bbff, freezeAlpha * pulse);
          gfx.strokeRect(renderX - w / 2, renderY - h / 2, w, h);
        } else {
          const sprite = this.buildingSprites.get(building.id);
          if (sprite && building.isConstructed && building.isPowered) {
            if (sprite instanceof Phaser.GameObjects.Image) {
              sprite.clearTint();
            }
            sprite.setAlpha(1.0);
          }
        }
      }
    }

    // Clean up overlays for entities no longer frozen
    this.chronoFreezeOverlays.forEach((gfx, id) => {
      if (!activeFreezeIds.has(id)) {
        gfx.destroy();
        this.chronoFreezeOverlays.delete(id);
        // Restore sprite appearance
        const unitSprite = this.unitSprites.get(id);
        if (unitSprite) {
          if (unitSprite instanceof Phaser.GameObjects.Sprite) {
            unitSprite.clearTint();
          }
          unitSprite.setAlpha(1.0);
        }
        const buildingSprite = this.buildingSprites.get(id);
        if (buildingSprite) {
          if (buildingSprite instanceof Phaser.GameObjects.Image) {
            buildingSprite.clearTint();
          }
          buildingSprite.setAlpha(1.0);
        }
      }
    });
  }

  private initializePathfinding(mapData: GameMapData): void {
    if (this.pathfindingManager) {
      this.pathfindingManager.dispose();
    }

    this.pathfindingManager = new PathfindingManager(
      undefined,
      this.pathfindingConfig || PATHFINDING_CONFIG
    );

    this.pathfindingManager.initialize({
      width: mapData.width,
      height: mapData.height,
      tiles: mapData.tiles
    });
  }

  private terrainTexture: Phaser.GameObjects.RenderTexture | null = null;
  private terrainImage: Phaser.GameObjects.Image | null = null;
  private terrainTextureKey = 'terrainTexture';

  private drawTerrain(map: GameMapData): void {
    const { tileSize } = SPRITE_CONFIG;

    // Compute the render-space bounding box of the whole map after isometric
    // projection. The render texture is positioned at (bounds.x, bounds.y) so
    // that the leftmost projected tile (which has a negative render x) is not
    // clipped. All tile coordinates inside the render texture are translated
    // by (-bounds.x, -bounds.y).
    const bounds = isoBounds(map.width, map.height, tileSize);

    // Clean up old terrain
    if (this.terrainImage) {
      this.terrainImage.destroy();
      this.terrainImage = null;
    }
    if (this.terrainTexture) {
      this.terrainTexture.destroy();
      this.terrainTexture = null;
    }

    // Create render texture sized to the iso bounding box.
    this.terrainTexture = this.add.renderTexture(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );
    this.terrainTexture.setOrigin(0, 0);
    this.terrainTexture.setName(this.terrainTextureKey);
    this.terrainTexture.setDepth(-10);

    // --- Pass 1: base terrain diamonds ---
    const terrainGraphics = this.add.graphics();
    // Deterministic detail seed so re-renders look identical.
    const detailSeed = (n: number) => ((n * 2654435761) >>> 0) / 0xffffffff;

    for (let y = 0; y < map.height; y++) {
      const row = map.tiles[y];
      if (!row) continue;
      for (let x = 0; x < map.width; x++) {
        const tile = row[x];
        const tileType = tile?.type;
        const color = getTerrainColor(tileType);

        terrainGraphics.fillStyle(color, 1);
        const center = this.fillTileDiamond(
          terrainGraphics,
          x,
          y,
          tileSize,
          bounds.x,
          bounds.y
        );

        // Subtle dark border so individual diamonds are visible (RA2 has tile
        // edges baked into its art; here we synthesize them).
        terrainGraphics.lineStyle(1, 0x000000, 0.18);
        this.drawDiamondPath(terrainGraphics, center.cx, center.cy, tileSize, tileSize * 0.5);
        terrainGraphics.strokePath();

        // --- Procedural detail per tile type ---
        const seed = detailSeed(x * 73856093 ^ y * 19349663);
        if (tileType === TileType.GRASS || tileType === undefined) {
          // Two darker green flecks per ~4 tiles.
          if (seed > 0.55) {
            terrainGraphics.fillStyle(0x2d6b3a, 0.7);
            const fx1 = center.cx + (seed - 0.5) * tileSize * 0.6;
            const fy1 = center.cy + (seed * 0.7 - 0.35) * tileSize * 0.3;
            terrainGraphics.fillCircle(fx1, fy1, 1.5);
            terrainGraphics.fillCircle(fx1 + 4, fy1 + 2, 1);
          }
          if (seed > 0.85) {
            // Tiny yellow flower
            terrainGraphics.fillStyle(0xf6d65b, 0.8);
            terrainGraphics.fillCircle(center.cx - 4, center.cy + 3, 1);
          }
        } else if (tileType === TileType.WATER) {
          // Two thin highlight lines for water reflection.
          terrainGraphics.lineStyle(1, 0x6fb0e6, 0.55);
          terrainGraphics.lineBetween(
            center.cx - tileSize * 0.4, center.cy + 2,
            center.cx + tileSize * 0.4, center.cy + 2
          );
          terrainGraphics.lineStyle(1, 0xb6dafa, 0.45);
          terrainGraphics.lineBetween(
            center.cx - tileSize * 0.25, center.cy - 4,
            center.cx + tileSize * 0.25, center.cy - 4
          );
        } else if (tileType === TileType.MOUNTAIN || tileType === TileType.CLIFF) {
          // Dark outline + lighter ridge highlight.
          terrainGraphics.lineStyle(2, 0x3a2a18, 0.85);
          this.drawDiamondPath(terrainGraphics, center.cx, center.cy, tileSize, tileSize * 0.5);
          terrainGraphics.strokePath();
          terrainGraphics.lineStyle(1, 0xa6896a, 0.6);
          terrainGraphics.lineBetween(
            center.cx - tileSize * 0.3, center.cy - 4,
            center.cx + tileSize * 0.3, center.cy - 8
          );
        } else if (tileType === TileType.SAND) {
          if (seed > 0.6) {
            terrainGraphics.fillStyle(0xc7a25a, 0.6);
            terrainGraphics.fillCircle(center.cx + 3, center.cy + 2, 1);
          }
        } else if (tileType === TileType.ROAD) {
          // Centre stripe so adjacent road tiles read as a path.
          terrainGraphics.lineStyle(2, 0x6e6660, 0.7);
          terrainGraphics.lineBetween(
            center.cx - tileSize * 0.4, center.cy,
            center.cx + tileSize * 0.4, center.cy
          );
        } else if (tileType === TileType.FOREST) {
          // Two dark-green tree pips.
          terrainGraphics.fillStyle(0x143d1f, 0.85);
          terrainGraphics.fillCircle(center.cx - 4, center.cy - 2, 3);
          terrainGraphics.fillCircle(center.cx + 4, center.cy + 1, 2.5);
          terrainGraphics.fillStyle(0x1f6234, 0.8);
          terrainGraphics.fillCircle(center.cx - 4, center.cy - 3, 1.5);
          terrainGraphics.fillCircle(center.cx + 4, center.cy, 1.2);
        } else if (tileType === TileType.MUD) {
          if (seed > 0.5) {
            terrainGraphics.fillStyle(0x3a2918, 0.5);
            terrainGraphics.fillCircle(center.cx, center.cy + 1, 2);
          }
        } else if (tileType === TileType.RUBBLE || tileType === TileType.CRATER) {
          terrainGraphics.fillStyle(0x2a2420, 0.7);
          terrainGraphics.fillCircle(center.cx - 3, center.cy + 1, 1.5);
          terrainGraphics.fillCircle(center.cx + 4, center.cy - 1, 1.2);
        } else if (tileType === TileType.ICE) {
          terrainGraphics.lineStyle(1, 0xffffff, 0.55);
          terrainGraphics.lineBetween(
            center.cx - tileSize * 0.3, center.cy + 1,
            center.cx + tileSize * 0.3, center.cy + 1
          );
        }
      }
    }

    this.terrainTexture.draw(terrainGraphics, -bounds.x, -bounds.y);
    terrainGraphics.destroy();

    // --- Pass 2: ore / resource crystals (raised gold clusters) ---
    if (map.resourceNodes && map.resourceNodes.length > 0) {
      const resourceGraphics = this.add.graphics();

      for (const node of map.resourceNodes) {
        const center = tileCenterRender(node.position.x, node.position.y, tileSize);
        const cx = center.x - bounds.x;
        const cy = center.y - bounds.y;
        const halfW = tileSize * 0.45;
        const halfH = halfW * 0.5;

        // Dark gold base diamond (shadow plate)
        resourceGraphics.fillStyle(0xa07000, 0.95);
        this.drawDiamondPath(resourceGraphics, cx, cy + 2, halfW, halfH);
        resourceGraphics.fillPath();
        // Bright gold body
        resourceGraphics.fillStyle(RESOURCE_NODE_CONFIG.color, 1);
        this.drawDiamondPath(resourceGraphics, cx, cy, halfW, halfH);
        resourceGraphics.fillPath();
        // Outline
        resourceGraphics.lineStyle(
          RESOURCE_NODE_CONFIG.strokeWidth,
          RESOURCE_NODE_CONFIG.strokeColor,
          1
        );
        this.drawDiamondPath(resourceGraphics, cx, cy, halfW, halfH);
        resourceGraphics.strokePath();
        // Crystals on top: a few small upright diamonds for sparkle.
        const crystalH = halfH * 1.6;
        const crystalW = halfW * 0.35;
        const offsets = [
          { dx: -halfW * 0.35, dy: -2 },
          { dx: halfW * 0.0, dy: -5 },
          { dx: halfW * 0.4, dy: -1 },
        ];
        for (const o of offsets) {
          // Body
          resourceGraphics.fillStyle(0xffe04a, 1);
          resourceGraphics.beginPath();
          resourceGraphics.moveTo(cx + o.dx, cy + o.dy - crystalH);
          resourceGraphics.lineTo(cx + o.dx + crystalW, cy + o.dy);
          resourceGraphics.lineTo(cx + o.dx, cy + o.dy + crystalH * 0.2);
          resourceGraphics.lineTo(cx + o.dx - crystalW, cy + o.dy);
          resourceGraphics.closePath();
          resourceGraphics.fillPath();
          // Highlight
          resourceGraphics.fillStyle(0xffffff, 0.7);
          resourceGraphics.beginPath();
          resourceGraphics.moveTo(cx + o.dx - crystalW * 0.3, cy + o.dy - crystalH * 0.3);
          resourceGraphics.lineTo(cx + o.dx, cy + o.dy - crystalH * 0.7);
          resourceGraphics.lineTo(cx + o.dx + crystalW * 0.1, cy + o.dy - crystalH * 0.3);
          resourceGraphics.closePath();
          resourceGraphics.fillPath();
        }
      }

      this.terrainTexture.draw(resourceGraphics, -bounds.x, -bounds.y);
      resourceGraphics.destroy();
    }

    this.terrainLayer.add(this.terrainTexture);

    // Set camera bounds to the iso bounding box and centre on the player spawn.
    // Phaser's centerOn can clamp scroll incorrectly when bounds.x is negative on
    // some versions, so we compute scroll manually then clamp.
    const camera = this.cameras.main;
    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    const spawn = map.spawnPoints?.[0];
    const focus = spawn
      ? tileCenterRender(spawn.x + 3, spawn.y + 5, tileSize)
      : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const minScrollX = bounds.x;
    const maxScrollX = Math.max(bounds.x, bounds.x + bounds.width - camera.width);
    const minScrollY = bounds.y;
    const maxScrollY = Math.max(bounds.y, bounds.y + bounds.height - camera.height);
    const desiredScrollX = focus.x - camera.width / 2;
    const desiredScrollY = focus.y - camera.height / 2;
    camera.scrollX = Phaser.Math.Clamp(desiredScrollX, minScrollX, maxScrollX);
    camera.scrollY = Phaser.Math.Clamp(desiredScrollY, minScrollY, maxScrollY);
    camera.fadeIn(500);
  }

  updateTileVisual(tileX: number, tileY: number, tileType: TileType): void {
    if (!this.terrainTexture || !this.currentMap) return;
    const { tileSize } = SPRITE_CONFIG;
    const bounds = isoBounds(this.currentMap.width, this.currentMap.height, tileSize);
    const color = getTerrainColor(tileType);
    const gfx = this.add.graphics();
    gfx.fillStyle(color, 1);
    this.fillTileDiamond(gfx, tileX, tileY, tileSize, bounds.x, bounds.y);
    this.terrainTexture.draw(gfx, -bounds.x, -bounds.y);
    gfx.destroy();
  }

  updateUnit(
    id: string,
    type: UnitType,
    faction: Faction,
    position: Position3D,
    rotation: number = 0
  ): void {
    if (this.isDestroyed) return;

    // Logical coordinates (orthogonal). Project to render space for display.
    const lx = position.x * SPRITE_CONFIG.tileSize;
    const ly = (position.z ?? position.y) * SPRITE_CONFIG.tileSize;
    const { x: worldX, y: worldY } = logicalToRender(lx, ly);

    let sprite = this.unitSprites.get(id);

    if (!sprite) {
      const spriteKey = getUnitSpriteKey(faction, type);
      sprite = this.textures.exists(spriteKey)
        ? this.add.sprite(worldX, worldY, spriteKey)
        : createUnitFallbackSprite(this, worldX, worldY, faction);
      sprite.setScale(RENDER_CONFIG.spriteScale);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(RENDER_CONFIG.unitDepthBase);
      this.unitSprites.set(id, sprite);

      const healthBar = this.add.graphics();
      healthBar.setDepth(RENDER_CONFIG.healthBarDepth);
      this.unitHealthBars.set(id, healthBar);
    }

    sprite.setPosition(worldX, worldY);
    // Render-space y already grows top-to-bottom with the iso projection,
    // so using it as depth gives correct overlap order.
    sprite.setDepth(worldY);

    // Update group badge position to follow the sprite
    const groupBadge = this.unitGroupBadges.get(id);
    if (groupBadge) {
      groupBadge.setPosition(worldX + 12, worldY - 16);
      groupBadge.setDepth(RENDER_CONFIG.healthBarDepth);
    }

    // Update rank glow circle position to follow the sprite
    const rankGlow = sprite.getData('rankGlowGraphics') as Phaser.GameObjects.Arc | null;
    if (rankGlow) {
      rankGlow.setPosition(worldX, worldY);
      rankGlow.setDepth(worldY - 1);
    }

    const direction = rotationToDirectionIndex(rotation);
    const currentState = this.unitStates.get(id);

    // Look up deploy state from store
    const unitStore = useGameStore.getState();
    const allUnitPlayers = [unitStore.currentPlayer, ...unitStore.aiPlayers].filter(Boolean) as Player[];
    const unitData = allUnitPlayers.flatMap(p => p.units).find(u => u.id === id);

    this.unitStates.set(id, {
      direction,
      isSelected: currentState?.isSelected || false,
      health: currentState?.health || 100,
      maxHealth: currentState?.maxHealth || 100,
      rank: currentState?.rank || UnitRank.ROOKIE,
      isDeploying: unitData?.isDeploying || false,
      deployTimer: unitData?.deployTimer,
    });
    this.healthBarsDirty = true;

    if (!currentState || currentState.direction !== direction) {
      if (sprite instanceof Phaser.GameObjects.Sprite) {
        sprite.play(`${sprite.texture.key}_dir${direction}`, true);
      }
    }
  }

  setUnitDisguised(id: string, isDisguised: boolean): void {
    const sprite = this.unitSprites.get(id);
    if (sprite) {
      sprite.setAlpha(isDisguised ? 0.4 : 1.0);
    }
  }

  setUnitVisible(id: string, visible: boolean): void {
    if (this.isDestroyed) return;

    const sprite = this.unitSprites.get(id);
    if (sprite) {
      sprite.setVisible(visible);
    }
    const healthBar = this.unitHealthBars.get(id);
    if (healthBar) {
      healthBar.setVisible(visible);
    }
    const groupBadge = this.unitGroupBadges.get(id);
    if (groupBadge) {
      groupBadge.setVisible(visible);
    }
  }

  setBuildingVisible(id: string, visible: boolean): void {
    if (this.isDestroyed) return;

    const sprite = this.buildingSprites.get(id);
    if (sprite) {
      sprite.setVisible(visible);
    }
    const healthBar = this.buildingHealthBars.get(id);
    if (healthBar) {
      healthBar.setVisible(visible);
    }
  }

  updateBuilding(
    id: string,
    type: string,
    faction: Faction,
    position: Position3D,
    isConstructed = true,
    buildProgress = 1,
    isPowered = true
  ): void {
    if (this.isDestroyed) return;

    const lx = position.x * SPRITE_CONFIG.tileSize;
    const ly = (position.z ?? position.y) * SPRITE_CONFIG.tileSize;
    const { x: worldX, y: worldY } = logicalToRender(lx, ly);

    let sprite = this.buildingSprites.get(id);

    if (!sprite) {
      const spriteKey = getBuildingSpriteKey(faction, type as BuildingType);
      sprite = this.textures.exists(spriteKey)
        ? this.add.image(worldX, worldY, spriteKey)
        : createBuildingFallbackSprite(this, worldX, worldY, faction);
      sprite.setScale(RENDER_CONFIG.spriteScale);
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(RENDER_CONFIG.buildingDepthBase);
      this.buildingSprites.set(id, sprite);

      const healthBar = this.add.graphics();
      healthBar.setDepth(RENDER_CONFIG.healthBarDepth - 1);
      this.buildingHealthBars.set(id, healthBar);

      const textureKey = sprite instanceof Phaser.GameObjects.Image ? sprite.texture?.key : undefined;
      const sourceWidth = (textureKey && this.textures.exists(textureKey))
        ? (this.textures.get(textureKey)?.getSourceImage()?.width || 128)
        : RENDER_CONFIG.buildingFallbackWidth;
      const sourceHeight = (textureKey && this.textures.exists(textureKey))
        ? (this.textures.get(textureKey)?.getSourceImage()?.height || 128)
        : RENDER_CONFIG.buildingFallbackHeight;

      this.buildingStates.set(id, {
        isSelected: false,
        health: 100,
        maxHealth: 100,
        width: sourceWidth * RENDER_CONFIG.spriteScale,
        height: sourceHeight * RENDER_CONFIG.spriteScale,
        isConstructed: isConstructed
      });

      // Set initial visual state for unconstructed buildings
      if (!isConstructed) {
        sprite.setAlpha(0.3);
        sprite.setScale(RENDER_CONFIG.spriteScale * 0.8);
      }
    }

    // Construction visual: dull tint with pulse animation
    if (sprite instanceof Phaser.GameObjects.Image) {
      if (!isConstructed) {
        sprite.setTint(0x888888);
        sprite.setAlpha(0.3 + buildProgress * 0.3);
        sprite.setScale(RENDER_CONFIG.spriteScale * 0.8);
      } else if (!isPowered) {
        sprite.setTint(0x666644);
        sprite.setAlpha(0.75);
      } else {
        sprite.clearTint();
        sprite.setAlpha(1);
      }
    }

    // Low power warning icon: flashing lightning bolt above the building
    if (isConstructed && !isPowered) {
      let icon = this.powerWarningIcons.get(id);
      if (!icon) {
        icon = this.add.text(worldX, worldY - 20, '⚡', {
          fontSize: '14px',
          color: '#ffaa00',
        });
        icon.setName('power_warning');
        icon.setOrigin(0.5);
        icon.setDepth(RENDER_CONFIG.healthBarDepth);
        this.powerWarningIcons.set(id, icon);

        // Flash animation
        this.tweens.add({
          targets: icon,
          alpha: 0.3,
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      } else {
        icon.setPosition(worldX, worldY - 20);
      }
    } else {
      const existingIcon = this.powerWarningIcons.get(id);
      if (existingIcon) {
        this.tweens.killTweensOf(existingIcon);
        existingIcon.destroy();
        this.powerWarningIcons.delete(id);
      }
    }

    // --- Garrison indicator: show count badge when building has garrisoned units ---
    const store = useGameStore.getState();
    const allPlayers = [store.currentPlayer, ...store.aiPlayers].filter(Boolean) as Player[];
    const buildingData = allPlayers.flatMap(p => p.buildings).find(b => b.id === id);
    const garrisonCount = buildingData?.garrisonedUnits?.length || 0;

    if (garrisonCount > 0) {
      let indicator = this.garrisonIndicators.get(id);
      if (!indicator) {
        indicator = this.add.container(worldX, worldY);
        indicator.setDepth(RENDER_CONFIG.healthBarDepth);
        indicator.setName('garrison_indicator');
        // Background circle
        const bg = this.add.circle(0, 0, 8, 0x000000, 0.7);
        bg.setStrokeStyle(1, 0x00ff88, 0.8);
        indicator.add(bg);
        // Count text
        const countText = this.add.text(0, 0, String(garrisonCount), {
          fontSize: '10px',
          color: '#00ff88',
          fontStyle: 'bold',
          fontFamily: 'Arial',
        });
        countText.setOrigin(0.5, 0.5);
        indicator.add(countText);
        this.garrisonIndicators.set(id, indicator);
      } else {
        indicator.setPosition(worldX, worldY);
        // Update count text
        const countText = indicator.getAt(1) as Phaser.GameObjects.Text;
        if (countText) {
          countText.setText(String(garrisonCount));
        }
      }
      // Position at top-right corner of building sprite
      const bState = this.buildingStates.get(id);
      if (bState) {
        indicator.setPosition(worldX + bState.width * 0.35, worldY - bState.height * 0.65);
      }
    } else {
      const existingIndicator = this.garrisonIndicators.get(id);
      if (existingIndicator) {
        existingIndicator.destroy();
        this.garrisonIndicators.delete(id);
      }
    }

    // --- Bridge destroyed visual: red tint + X mark overlay ---
    if (buildingData?.isBridge && buildingData?.isBridgeDestroyed) {
      // Tint the sprite red/dark
      if (sprite instanceof Phaser.GameObjects.Image) {
        sprite.setTint(0x882222);
        sprite.setAlpha(0.6);
      }

      let overlay = this.bridgeDestroyedOverlays.get(id);
      if (!overlay) {
        overlay = this.add.container(worldX, worldY);
        overlay.setDepth(RENDER_CONFIG.healthBarDepth);
        overlay.setName('bridge_destroyed_overlay');
        // X mark
        const xGfx = this.add.graphics();
        xGfx.lineStyle(3, 0xff2222, 0.9);
        const s = 14;
        xGfx.beginPath();
        xGfx.moveTo(-s, -s);
        xGfx.lineTo(s, s);
        xGfx.moveTo(s, -s);
        xGfx.lineTo(-s, s);
        xGfx.strokePath();
        overlay.add(xGfx);
        // "DESTROYED" text
        const label = this.add.text(0, 20, 'DESTROYED', {
          fontSize: '8px',
          color: '#ff4444',
          fontStyle: 'bold',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        });
        label.setOrigin(0.5, 0.5);
        overlay.add(label);
        this.bridgeDestroyedOverlays.set(id, overlay);
      } else {
        overlay.setPosition(worldX, worldY);
      }
    } else {
      const existingOverlay = this.bridgeDestroyedOverlays.get(id);
      if (existingOverlay) {
        existingOverlay.destroy();
        this.bridgeDestroyedOverlays.delete(id);
      }
    }

    // --- Psychic sensor detection ring: pulsing circle when constructed + powered ---
    if (type === BuildingType.PSYCHIC_SENSOR && isConstructed && isPowered) {
      let ring = this.psychicSensorRings.get(id);
      if (!ring) {
        ring = this.add.graphics();
        ring.setDepth(worldY - 2);
        ring.setName('psychic_sensor_ring');
        this.psychicSensorRings.set(id, ring);
      }
      ring.setPosition(worldX, worldY);
      ring.setDepth(worldY - 2);
      ring.clear();
      // Pulsing alpha for the detection ring
      const pulse = 0.15 + 0.1 * Math.sin(this.time.now / 800);
      const detectionRadius = 60; // detection range in render pixels
      ring.lineStyle(2, 0xcc44ff, pulse);
      ring.strokeCircle(0, 0, detectionRadius);
      // Inner faint fill
      ring.fillStyle(0xcc44ff, pulse * 0.15);
      ring.fillCircle(0, 0, detectionRadius);
      // Secondary pulsing ring (delayed phase)
      const pulse2 = 0.08 + 0.06 * Math.sin(this.time.now / 800 + Math.PI);
      ring.lineStyle(1, 0xcc44ff, pulse2);
      ring.strokeCircle(0, 0, detectionRadius * 0.7);
    } else {
      const existingRing = this.psychicSensorRings.get(id);
      if (existingRing) {
        existingRing.destroy();
        this.psychicSensorRings.delete(id);
      }
    }

    // Detect construction completion transition and play animation
    const prevState = this.buildingStates.get(id);
    if (prevState && !prevState.isConstructed && isConstructed) {
      this.playBuildingCompleteAnimation(id);
    }
    if (prevState) {
      this.buildingStates.set(id, { ...prevState, isConstructed });
    }

    sprite.setPosition(worldX, worldY);
    sprite.setDepth(worldY - 1);
    this.healthBarsDirty = true;
  }

  removeUnit(id: string): void {
    const sprite = this.unitSprites.get(id);
    if (sprite) {
      // Clean up rank glow
      const existingGlow = sprite.getData('rankGlowGraphics');
      if (existingGlow) {
        (existingGlow as Phaser.GameObjects.Arc).destroy();
      }
      sprite.destroy();
      this.unitSprites.delete(id);
    }
    const healthBar = this.unitHealthBars.get(id);
    if (healthBar) {
      healthBar.destroy();
      this.unitHealthBars.delete(id);
    }
    const groupBadge = this.unitGroupBadges.get(id);
    if (groupBadge) {
      groupBadge.destroy();
      this.unitGroupBadges.delete(id);
    }
    // Clean up unit from control groups
    this.groupManager?.removeUnitFromAllGroups(id);
    this.unitStates.delete(id);
    // Clean up chrono freeze overlay
    const freezeOverlay = this.chronoFreezeOverlays.get(id);
    if (freezeOverlay) {
      freezeOverlay.destroy();
      this.chronoFreezeOverlays.delete(id);
    }
  }

  removeBuilding(id: string): void {
    const sprite = this.buildingSprites.get(id);
    if (sprite) {
      sprite.destroy();
      this.buildingSprites.delete(id);
    }
    const healthBar = this.buildingHealthBars.get(id);
    if (healthBar) {
      healthBar.destroy();
      this.buildingHealthBars.delete(id);
    }
    const powerIcon = this.powerWarningIcons.get(id);
    if (powerIcon) {
      this.tweens.killTweensOf(powerIcon);
      powerIcon.destroy();
      this.powerWarningIcons.delete(id);
    }
    const garrisonIndicator = this.garrisonIndicators.get(id);
    if (garrisonIndicator) {
      garrisonIndicator.destroy();
      this.garrisonIndicators.delete(id);
    }
    const bridgeOverlay = this.bridgeDestroyedOverlays.get(id);
    if (bridgeOverlay) {
      bridgeOverlay.destroy();
      this.bridgeDestroyedOverlays.delete(id);
    }
    const psychicRing = this.psychicSensorRings.get(id);
    if (psychicRing) {
      psychicRing.destroy();
      this.psychicSensorRings.delete(id);
    }
    const freezeOverlay = this.chronoFreezeOverlays.get(id);
    if (freezeOverlay) {
      freezeOverlay.destroy();
      this.chronoFreezeOverlays.delete(id);
    }
    this.buildingStates.delete(id);
  }

  setUnitSelected(id: string, selected: boolean): void {
    const state = this.unitStates.get(id);
    if (state) {
      this.unitStates.set(id, { ...state, isSelected: selected });
      this.selectionDirty = true;
    }
  }

  setBuildingSelected(id: string, selected: boolean): void {
    const state = this.buildingStates.get(id);
    if (state) {
      this.buildingStates.set(id, { ...state, isSelected: selected });
      this.selectionDirty = true;
    }
  }

  showBuildingAttackRange(logicalX: number, logicalY: number, range: number): void {
    if (!this.indicatorSystem) return;
    // Convert logical position to render space for isometric display
    const { x: rx, y: ry } = logicalToRender(logicalX, logicalY);
    this.indicatorSystem.showAttackRange(rx, ry, range);
  }

  hideBuildingAttackRange(): void {
    this.indicatorSystem?.hideAttackRange();
  }

  setUnitHealth(id: string, health: number, maxHealth: number): void {
    const state = this.unitStates.get(id);
    if (state) {
      this.unitStates.set(id, { ...state, health, maxHealth });
      this.healthBarsDirty = true;
    }
  }

  setUnitInvulnerable(id: string, isInvulnerable: boolean): void {
    const state = this.unitStates.get(id);
    if (state) {
      this.unitStates.set(id, { ...state, isInvulnerable });
      this.healthBarsDirty = true;
    }
  }

  setUnitRank(id: string, rank: UnitRank): void {
    const state = this.unitStates.get(id);
    if (state) {
      this.unitStates.set(id, { ...state, rank });
      this.healthBarsDirty = true;
    }

    // Add/remove glow effect for veteran/elite units
    if (rank !== UnitRank.ROOKIE) {
      const sprite = this.unitSprites.get(id);
      if (sprite) {
        const glowColor = rank === UnitRank.ELITE ? 0xff4444 : 0xffd700;
        let glowAdded = false;
        // Try postFX pipeline (only available on Sprite with WebGL renderer)
        if (sprite instanceof Phaser.GameObjects.Sprite) {
          try {
            const fx = (sprite as any).postFX;
            if (fx) {
              fx.clear(); // Clear previous glow before adding new one
              fx.addGlow(glowColor, 0, 0, 1.5, 0.5);
              glowAdded = true;
            }
          } catch (_e) {
            // Glow not supported, use fallback circle
          }
        }
        // Fallback: add a colored circle behind the sprite as glow
        if (!glowAdded) {
          const existingGlow = sprite.getData('rankGlowGraphics');
          if (existingGlow) {
            (existingGlow as Phaser.GameObjects.Arc).destroy();
          }
          const glow = this.add.circle(sprite.x, sprite.y, 14, glowColor, 0.2);
          glow.setDepth(sprite.depth - 1);
          glow.setName(`rank_glow_${id}`);
          sprite.setData('rankGlowGraphics', glow);
        }
      }
    } else {
      // Remove glow for ROOKIE rank
      const sprite = this.unitSprites.get(id);
      if (sprite) {
        if (sprite instanceof Phaser.GameObjects.Sprite) {
          try {
            const fx = (sprite as any).postFX;
            if (fx) {
              fx.clear();
            }
          } catch (_e) {
            // Ignore
          }
        }
        const existingGlow = sprite.getData('rankGlowGraphics');
        if (existingGlow) {
          (existingGlow as Phaser.GameObjects.Arc).destroy();
          sprite.setData('rankGlowGraphics', null);
        }
      }
    }
  }

  playBuildingCompleteAnimation(buildingId: string): void {
    const sprite = this.buildingSprites.get(buildingId);
    if (!sprite) return;

    this.tweens.add({
      targets: sprite,
      alpha: { from: 0.3, to: 1.0 },
      scaleX: { from: RENDER_CONFIG.spriteScale * 0.8, to: RENDER_CONFIG.spriteScale },
      scaleY: { from: RENDER_CONFIG.spriteScale * 0.8, to: RENDER_CONFIG.spriteScale },
      duration: 500,
      ease: 'Back.easeOut',
    });
  }

  setUnitGroupBadge(id: string, groupNumber: number | null): void {
    const sprite = this.unitSprites.get(id);
    if (!sprite) return;

    // Remove existing badge
    const existingBadge = this.unitGroupBadges.get(id);
    if (existingBadge) {
      existingBadge.destroy();
      this.unitGroupBadges.delete(id);
    }

    if (groupNumber === null) return;

    // Create group number badge positioned relative to the sprite
    const badge = this.add.text(sprite.x + 12, sprite.y - 16, String(groupNumber), {
      fontSize: '8px',
      color: '#00ffff',
      fontStyle: 'bold',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 2, y: 1 },
    });
    badge.setName('group_badge');
    badge.setOrigin(0.5);
    badge.setDepth(RENDER_CONFIG.healthBarDepth);
    this.unitGroupBadges.set(id, badge);
  }

  setBuildingHealth(id: string, health: number, maxHealth: number, oreStorage?: number, maxOreStorage?: number): void {
    const state = this.buildingStates.get(id);
    if (state) {
      this.buildingStates.set(id, { ...state, health, maxHealth, oreStorage, maxOreStorage });
      this.healthBarsDirty = true;
    }
  }

  private findUnitOrBuildingPosition(entityId: string): { x: number; y: number } | null {
    const state = useGameStore.getState();
    const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Player[];
    for (const player of allPlayers) {
      const unit = player.units.find(u => u.id === entityId);
      if (unit) return { ...unit.position };
      const building = player.buildings.find(b => b.id === entityId);
      if (building) return { x: building.position.x + (building.width || 2) * GAME_CONFIG.TILE_SIZE / 2, y: building.position.y + (building.height || 2) * GAME_CONFIG.TILE_SIZE / 2 };
    }
    return null;
  }

  private showDamageNumber(damage: number, worldX: number, worldY: number): void {
    if (this.isDestroyed) return;

    // Check user setting
    const settings = useGameStore.getState().gameSettings;
    if (settings && 'showDamageNumbers' in settings && !settings.showDamageNumbers) return;

    // Project logical position to render space
    const { x: renderX, y: renderY } = logicalToRender(worldX, worldY);

    const textObj = this.add.text(renderX, renderY - 10, `-${damage}`, {
      fontSize: '14px',
      color: '#ff4444',
      fontFamily: 'Arial Black',
      stroke: '#000000',
      strokeThickness: 2,
    });
    textObj.setOrigin(0.5, 0.5);
    textObj.setDepth(901);

    const offsetX = (Math.random() - 0.5) * 20;
    this.tweens.add({
      targets: textObj,
      y: renderY - 50,
      x: renderX + offsetX,
      alpha: 0,
      scale: 0.8,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => {
        if (!this.scene?.isActive()) return;
        textObj.destroy();
      },
    });
  }

  private updateCameraControls(delta: number): void {
    const camera = this.cameras.main;
    const speed = 300 * (delta / 1000);
    let dx = 0;
    let dy = 0;

    // When units are selected, A key should trigger attack-move (handled by
    // InputHandler), not camera movement. Only use A for camera when no units
    // are selected.
    const hasSelectedUnits = useGameStore.getState().selectedUnits.length > 0;

    // Keyboard camera panning (arrow keys + WASD)
    if (this.cursors) {
      if (this.cursors.left.isDown || (this.wasdKeys?.A.isDown && !hasSelectedUnits)) dx = -speed;
      else if (this.cursors.right.isDown || this.wasdKeys?.D.isDown) dx = speed;
      if (this.cursors.up.isDown || (this.wasdKeys?.W.isDown && !hasSelectedUnits)) dy = -speed;
      else if (this.cursors.down.isDown || (this.wasdKeys?.S.isDown && !hasSelectedUnits)) dy = speed;
    }

    // Edge scrolling (when mouse is near screen edge).
    // Skip when the pointer is still sitting at the default (0,0) position —
    // Phaser initialises the activePointer there and Playwright never moves the
    // mouse, which would otherwise drag the camera into the left/top bounds.
    const pointer = this.input.activePointer;
    const margin = 20;
    const pointerIsActive = pointer && isFinite(pointer.x) && isFinite(pointer.y)
      && (pointer.x !== 0 || pointer.y !== 0);
    if (pointerIsActive) {
      if (!this.cursors?.left.isDown && !this.cursors?.right.isDown && !(this.wasdKeys?.A.isDown && !hasSelectedUnits) && !this.wasdKeys?.D.isDown) {
        if (pointer.x < margin) dx = -speed;
        else if (pointer.x > camera.width - margin) dx = speed;
      }
      if (!this.cursors?.up.isDown && !this.cursors?.down.isDown && !(this.wasdKeys?.W.isDown && !hasSelectedUnits) && !(this.wasdKeys?.S.isDown && !hasSelectedUnits)) {
        if (pointer.y < margin) dy = -speed;
        else if (pointer.y > camera.height - margin) dy = speed;
      }
    }

    if (dx !== 0 || dy !== 0) {
      // Manual bounds clamping
      const bounds = camera.getBounds();
      camera.scrollX = Phaser.Math.Clamp(camera.scrollX + dx, bounds.x, bounds.right - camera.width);
      camera.scrollY = Phaser.Math.Clamp(camera.scrollY + dy, bounds.y, bounds.bottom - camera.height);
    }
  }

  worldToScreen(worldX: number, worldY: number): Position2D {
    // Inputs are render-space coordinates (i.e. a sprite's actual x/y after
    // isometric projection). Apply only the camera transform so callers can
    // turn a sprite position into a screen pixel. Use logicalToRender first
    // when projecting from logical-tile coordinates.
    const camera = this.cameras.main;
    return {
      x: (worldX - camera.scrollX) * camera.zoom + (camera.width / 2) * (1 - camera.zoom),
      y: (worldY - camera.scrollY) * camera.zoom + (camera.height / 2) * (1 - camera.zoom),
    };
  }

  screenToWorld(screenX: number, screenY: number): Position2D {
    // Outputs are in logical (orthogonal) px. Reverse the camera transform
    // first, then de-project from render space.
    const camera = this.cameras.main;
    const rx = screenX / camera.zoom + camera.scrollX - (camera.width / 2) * (1 - camera.zoom) / camera.zoom;
    const ry = screenY / camera.zoom + camera.scrollY - (camera.height / 2) * (1 - camera.zoom) / camera.zoom;
    const l = renderToLogical(rx, ry);
    return { x: l.x, y: l.y };
  }

  getWorldBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: 0,
      y: 0,
      width: this.worldWidth,
      height: this.worldHeight,
    };
  }

  initialize(map: GameMapData): void {
    if (!this.isDestroyed) {
      this.createTerrain(map);
    }
  }

  render(): void {}

  getFogOfWar(): FogOfWar | undefined {
    return this.fogOfWar;
  }

  getSoundManager(): GameSoundManager | undefined {
    return this.soundManager;
  }

  getHotkeyManager(): HotkeyManager | undefined {
    return this.hotkeyManager;
  }

  getGroupManager(): UnitGroupManager | undefined {
    return this.groupManager;
  }

  getPathfindingManager(): PathfindingManager | undefined {
    return this.pathfindingManager;
  }

  playSound(sfxKey: string, options?: {
    volume?: number;
    rate?: number;
    loops?: boolean;
    forceRestart?: boolean;
  }): void {
    this.soundManager?.play(sfxKey, options);
  }

  playVoice(voiceKey: string, forcePlay: boolean = false): void {
    this.soundManager?.playVoice(voiceKey, forcePlay);
  }

  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    unitSize: number = 1,
    isAirborne: boolean = false,
    isNaval: boolean = false
  ) {
    return this.pathfindingManager?.findPath(startX, startY, endX, endY, unitSize, isAirborne, isNaval);
  }

  updatePathfindingObstacles(buildings: Array<{position: {x: number, y: number}, width: number, height: number, type: string}>): void {
    this.pathfindingManager?.updateObstacles(buildings);
  }

  private updatePathfindingObstaclesFromStore(): void {
    const state = useGameStore.getState();
    const allPlayers = [state.currentPlayer, ...state.aiPlayers].filter(Boolean) as Array<{buildings: Array<{position: {x: number, y: number}, width: number, height: number, type: string}>}>;
    const allBuildings = allPlayers.flatMap(p => p.buildings);
    this.pathfindingManager?.updateObstacles(allBuildings);
  }

  isPositionVisible(worldX: number, worldY: number): boolean {
    return this.fogOfWar?.isVisible(worldX, worldY) ?? true;
  }

  isPositionExplored(worldX: number, worldY: number): boolean {
    return this.fogOfWar?.isExplored(worldX, worldY) ?? true;
  }

  revealArea(worldX: number, worldY: number, radius: number): void {
    this.fogOfWar?.addObserver(worldX, worldY, radius);
  }

  selectGroup(groupId: number): string[] {
    return this.groupManager?.selectGroup(groupId) || [];
  }

  createGroup(groupId: number, unitIds: string[]): void {
    this.groupManager?.createGroup(groupId, unitIds);
  }

  addToGroup(groupId: number, unitIds: string[]): void {
    this.groupManager?.addToGroup(groupId, unitIds);
  }

  setGroupHotkeyEnabled(enabled: boolean): void {
    this.hotkeyManager?.setEnabled(enabled);
  }

  getWeatherSystem() {
    return this.systemManager?.getWeatherSystem();
  }

  getDayNightCycle() {
    return this.systemManager?.getDayNightCycle();
  }

  getRadarSystem() {
    return this.systemManager?.getRadarSystem();
  }

  getAlertSystem() {
    return this.systemManager?.getAlertSystem();
  }

  getMissionSystem() {
    return this.systemManager?.getMissionSystem();
  }

  getStatisticsSystem() {
    return this.systemManager?.getStatisticsSystem();
  }

  startWeather(type: WeatherType, intensity: number = 0.5, duration: number = 60000): void {
    this.systemManager?.startWeather(type, intensity, duration);
  }

  stopWeather(): void {
    this.systemManager?.stopWeather();
  }

  triggerAlert(level: AlertLevel, message: string, position?: Position2D): string {
    return this.systemManager?.triggerAlert(level, message, position) || '';
  }

  startMission(config: MissionConfig): void {
    this.systemManager?.startMission(config);
  }

  updateObjectiveProgress(objectiveId: string, value: number): void {
    this.systemManager?.updateObjectiveProgress(objectiveId, value);
  }

  incrementObjectiveProgress(objectiveId: string, amount: number = 1): void {
    this.systemManager?.incrementObjectiveProgress(objectiveId, amount);
  }

  getGameStats(): GameStats | undefined {
    return this.systemManager?.getGameStats();
  }

  getCombatStats(): CombatStats | undefined {
    return this.systemManager?.getCombatStats();
  }

  recordKill(killerId: string, killerType: string, victimId: string, victimType: string, weapon: string, damage: number): void {
    this.systemManager?.recordKill(killerId, killerType, victimId, victimType, weapon, damage);
  }

  recordDamageDealt(damage: number, isCritical: boolean = false): void {
    this.systemManager?.recordDamageDealt(damage, isCritical);
  }

  recordResourcesGathered(resourceType: string, amount: number): void {
    this.systemManager?.recordResourcesGathered(resourceType, amount);
  }

  recordResourcesSpent(resourceType: string, amount: number): void {
    this.systemManager?.recordResourcesSpent(resourceType, amount);
  }

  getCurrentTimeOfDay(): 'dawn' | 'day' | 'dusk' | 'night' {
    return this.systemManager?.getCurrentTimeOfDay() || 'day';
  }

  isNight(): boolean {
    return this.systemManager?.isNight() || false;
  }
}