import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { PhaserGameScene } from './PhaserGameScene';
import { createPhaserConfig } from './PhaserConfig';
import { inputManager } from '../engine/InputManager';
import { GameMapData } from '../../types';

export interface UsePhaserOptions {
  map: GameMapData | null;
  onWorldClick?: (worldX: number, worldY: number, shiftKey?: boolean, ctrlKey?: boolean) => void;
  onWorldRightClick?: (worldX: number, worldY: number, shiftKey?: boolean) => void;
  onMouseMove?: (worldX: number, worldY: number) => void;
  onMouseDown?: (worldX: number, worldY: number) => void;
  onMouseUp?: () => void;
}

export interface UsePhaserReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  gameRef: React.RefObject<Phaser.Game | null>;
  sceneRef: React.RefObject<PhaserGameScene | null>;
  isReady: boolean;
  isLoading: boolean;
  sceneReady: boolean;
  getScene: () => PhaserGameScene | null;
}

export function usePhaser({ map, onWorldClick, onWorldRightClick, onMouseMove, onMouseDown, onMouseUp }: UsePhaserOptions): UsePhaserReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<PhaserGameScene | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Track scene ready state separately
  const [sceneReady, setSceneReady] = useState(false);
  const mapRef = useRef(map);
  mapRef.current = map;

  // Keep callbacks in refs to avoid re-registering event handlers on every render
  const callbacksRef = useRef({ onWorldClick, onWorldRightClick, onMouseMove, onMouseDown, onMouseUp });
  callbacksRef.current = { onWorldClick, onWorldRightClick, onMouseMove, onMouseDown, onMouseUp };

  const clickHandlersRef = useRef<{
    click: ((e: MouseEvent) => void) | null;
    rightClick: ((e: MouseEvent) => void) | null;
    mouseDown: ((e: MouseEvent) => void) | null;
    mouseUp: ((e: MouseEvent) => void) | null;
    mouseMove: ((e: MouseEvent) => void) | null;
  }>({ click: null, rightClick: null, mouseDown: null, mouseUp: null, mouseMove: null });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const config = createPhaserConfig(
      containerRef.current,
      window.innerWidth,
      window.innerHeight
    );
    config.scene = [PhaserGameScene];

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Expose game instance for E2E testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__PHASER_GAME__ = game;

    game.events.on('ready', () => {
      setIsReady(true);
      setIsLoading(false);

      // Register keyboard shortcuts only (mouse events handled by usePhaser directly)
      const canvas = game.canvas;
      if (canvas) {
        inputManager.registerKeyboard(canvas);
      }
    });

    // Poll for the scene to finish create(). We can't rely on a 'sceneReady'
    // event because Phaser fires it synchronously inside create(); by the time
    // game.scene.getScene() returns a non-null scene, the event has already
    // been emitted and any listener attached afterwards would never fire.
    let cancelled = false;
    const checkForScene = () => {
      if (cancelled) return;
      const scene = game.scene.getScene('GameScene') as PhaserGameScene | undefined;
      // scene.sys.settings.status === 5 means RUNNING (create() finished)
      const isRunning = !!scene && scene.scene.isActive();
      if (scene && isRunning) {
        sceneRef.current = scene;
        setSceneReady(true);  // This triggers the effect in GameCanvas
        setIsReady(true);
        setIsLoading(false);

        if (mapRef.current) {
          scene.initialize(mapRef.current);
        }
      } else {
        setTimeout(checkForScene, 16);
      }
    };
    checkForScene();

    const handleResize = () => {
      if (game) {
        game.scale.resize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    const container = containerRef.current;
    const clickHandlers = clickHandlersRef.current;

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      inputManager.cleanup();
      if (container) {
        if (clickHandlers.click) {
          container.removeEventListener('click', clickHandlers.click);
        }
        if (clickHandlers.rightClick) {
          container.removeEventListener('contextmenu', clickHandlers.rightClick);
        }
      }
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current && map) {
      sceneRef.current.createTerrain(map);
    }
  }, [map]);

  useEffect(() => {
    if (!containerRef.current || !sceneRef.current) return;
    const container = containerRef.current;
    const scene = sceneRef.current;
    const ch = clickHandlersRef.current;

    const handleClick = (e: MouseEvent) => {
      const { onWorldClick: cb } = callbacksRef.current;
      if (!cb) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const world = scene.screenToWorld(x, y);
      if (world) {
        cb(world.x, world.y, e.shiftKey, e.ctrlKey || e.metaKey);
      }
    };

    const handleRightClick = (e: MouseEvent) => {
      e.preventDefault();
      const { onWorldRightClick: cb } = callbacksRef.current;
      if (!cb) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const world = scene.screenToWorld(x, y);
      if (world) {
        cb(world.x, world.y, e.shiftKey);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        const { onMouseDown: cb } = callbacksRef.current;
        if (!cb) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const world = scene.screenToWorld(x, y);
        if (world) {
          cb(world.x, world.y);
        }
      }
    };

    const handleMouseUp = () => {
      callbacksRef.current.onMouseUp?.();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { onMouseMove: cb } = callbacksRef.current;
      if (!cb) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const world = scene.screenToWorld(x, y);
      if (world) {
        cb(world.x, world.y);
      }
    };

    ch.click = handleClick;
    ch.rightClick = handleRightClick;
    ch.mouseDown = handleMouseDown;
    ch.mouseUp = handleMouseUp;
    ch.mouseMove = handleMouseMove;

    container.addEventListener('click', handleClick);
    container.addEventListener('contextmenu', handleRightClick);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('contextmenu', handleRightClick);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousemove', handleMouseMove);
      ch.click = null;
      ch.rightClick = null;
      ch.mouseDown = null;
      ch.mouseUp = null;
      ch.mouseMove = null;
    };
  }, [sceneReady]);

  const getScene = useCallback((): PhaserGameScene | null => {
    return sceneRef.current;
  }, []);

  return {
    containerRef,
    gameRef,
    sceneRef,
    isReady,
    isLoading,
    sceneReady,  // Add sceneReady to return value
    getScene
  };
}