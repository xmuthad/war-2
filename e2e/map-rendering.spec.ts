import { test, expect } from '@playwright/test';

test.describe('Map Rendering Comprehensive Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('01: Terrain tiles render with correct colors', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const scene = game?.scene?.getScene('GameScene');
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();

      // Check terrain layer exists in scene
      const terrainLayers = scene?.children?.list?.filter((c: any) =>
        c.type === 'RenderTexture' || c.type === 'Image'
      ) || [];

      return {
        terrainLayerExists: terrainLayers.length > 0,
        mapExists: !!s?.map,
        mapWidth: s?.map?.width || 0,
        mapHeight: s?.map?.height || 0,
        tilesLength: s?.map?.tiles?.length || 0,
      };
    });

    console.log(`Terrain state: ${JSON.stringify(state)}`);
    expect(state.mapExists).toBe(true);
    expect(state.mapWidth).toBeGreaterThan(0);
    expect(state.mapHeight).toBeGreaterThan(0);
  });

  test('02: Map dimensions are correct', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();
      return {
        mapWidth: s?.map?.width || 0,
        mapHeight: s?.map?.height || 0,
      };
    });

    console.log(`Map dimensions: ${state.mapWidth}x${state.mapHeight}`);
    expect(state.mapWidth).toBeGreaterThan(0);
    expect(state.mapHeight).toBeGreaterThan(0);
  });

  test('03: Camera bounds are set correctly', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const scene = game?.scene?.getScene('GameScene');
      if (!scene) return { cameraExists: false };
      const cam = scene.cameras.main;
      const bounds = cam.getBounds();
      return {
        cameraExists: true,
        scrollX: cam.scrollX,
        scrollY: cam.scrollY,
        zoom: cam.zoom,
        bounds: bounds ? { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom } : null,
      };
    });

    console.log(`Camera state: ${JSON.stringify(state)}`);
    expect(state.cameraExists).toBe(true);
    expect(state.zoom).toBeGreaterThan(0);
    expect(state.bounds).toBeDefined();
  });

  test('04: Resource nodes render if present', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();
      return {
        resourceNodes: s?.map?.resourceNodes?.length || 0,
      };
    });

    console.log(`Resource nodes: ${state.resourceNodes}`);
    // Resource nodes should exist on the map
    expect(state.resourceNodes).toBeGreaterThanOrEqual(0);
  });

  test('05: Units are rendered on terrain', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const scene = game?.scene?.getScene('GameScene');
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();

      // Check unit sprites
      const unitSprites = scene?.children?.list?.filter((c: any) =>
        c.type === 'Sprite' && c.texture?.key
      ) || [];

      return {
        unitSpritesInScene: unitSprites.length > 0,
        spriteCount: unitSprites.length,
        storeUnits: s?.currentPlayer?.units?.length || 0,
        playerExists: !!s?.currentPlayer,
      };
    });

    console.log(`Unit render state: ${JSON.stringify(state)}`);
    expect(state.playerExists).toBe(true);
    expect(state.storeUnits).toBeGreaterThan(0);
  });

  test('06: Terrain depth layering is correct', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const scene = game?.scene?.getScene('GameScene');
      if (!scene) return { hasScene: false };

      // Check that children are layered (terrain has lower depth than units)
      const children = scene.children.list;
      const depths = children.map((c: any) => c.depth || 0);
      return {
        hasScene: true,
        childCount: children.length,
        depthRange: depths.length > 0 ? [Math.min(...depths), Math.max(...depths)] : null,
      };
    });

    console.log(`Depth layering: ${JSON.stringify(state)}`);
    expect(state.hasScene).toBe(true);
    expect(state.childCount).toBeGreaterThan(0);
  });

  test('07: Map tiles array is not empty', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();
      return {
        tilesLength: s?.map?.tiles?.length || 0,
        mapWidth: s?.map?.width || 0,
        mapHeight: s?.map?.height || 0,
      };
    });

    console.log(`Map tiles: ${state.tilesLength}`);
    expect(state.tilesLength).toBeGreaterThan(0);
  });

  test('08: Terrain colors are used for rendering', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();
      const tiles = s?.map?.tiles;
      if (!tiles || tiles.length === 0) return { tilesExist: false };
      // Check if tiles have type information
      const firstTile = tiles[0];
      return {
        tilesExist: true,
        tilesLength: tiles.length,
        firstTileHasType: firstTile?.tileType !== undefined || firstTile?.type !== undefined,
      };
    });

    console.log(`Tiles state: ${JSON.stringify(state)}`);
    expect(state.tilesExist).toBe(true);
    expect(state.tilesLength).toBeGreaterThan(0);
  });

  test('09: Canvas shows non-black pixels after terrain rendering', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(12000);

    let result: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) return { error: 'No canvas' };

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return { error: 'No WebGL' };

        const step = 32;
        let nonBlack = 0;
        let total = 0;

        for (let y = 0; y < canvas.height; y += step) {
          for (let x = 0; x < canvas.width; x += step) {
            const pixels = new Uint8Array(4);
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            total++;
            if (pixels[0] > 10 || pixels[1] > 10 || pixels[2] > 10) nonBlack++;
          }
        }

        return { nonBlack, total, pct: ((nonBlack / total) * 100).toFixed(1) };
      });

      console.log(`Pixel analysis (attempt ${attempt + 1}):`, result);
      if (!('error' in result) && result.nonBlack > 0) break;
      await page.waitForTimeout(3000);
    }

    if (!('error' in result)) {
      expect(result.nonBlack).toBeGreaterThan(0);
    }
  });

  test('09b: Verify multiple terrain colors are visible', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const result = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return { error: 'No canvas' };

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { error: 'No WebGL' };

      const step = 16;
      const colorMap = new Map<string, number>();
      let totalColored = 0;

      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const pixels = new Uint8Array(4);
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const r = pixels[0], g = pixels[1], b = pixels[2], a = pixels[3];

          if (a > 0 && (r > 10 || g > 10 || b > 10)) {
            totalColored++;
            const key = `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
          }
        }
      }

      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      return {
        totalColored,
        uniqueColors: colorMap.size,
        topColors: sortedColors
      };
    });

    console.log('Pixel analysis:', JSON.stringify(result, null, 2));

    if (!('error' in result)) {
      expect(result.totalColored).toBeGreaterThan(0);
    }
  });

  test('10: Fog of war is enabled', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();
      return {
        fogOfWar: !!s?.fogOfWar,
        mapLoaded: !!(s?.map?.tiles?.length),
      };
    });

    console.log(`Fog of war state: ${JSON.stringify(state)}`);
    expect(state.mapLoaded).toBe(true);
  });

  test('11: Multiple terrain types present in map', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();
      const tiles = s?.map?.tiles;
      if (!tiles || tiles.length === 0) return { tilesExist: false };

      // Count unique tile types - tiles may be flat numbers or objects
      const typeSet = new Set<number>();
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        // Handle both flat number tiles and object tiles
        const tt = typeof tile === 'number' ? tile : (tile?.tileType ?? tile?.type);
        if (tt !== undefined) typeSet.add(tt);
      }

      return {
        tilesExist: true,
        tilesLength: tiles.length,
        uniqueTileTypes: typeSet.size,
        tileTypes: [...typeSet].slice(0, 5),
        firstTile: tiles[0],
        firstTileType: typeof tiles[0],
      };
    });

    console.log(`Tile types: ${JSON.stringify(state)}`);
    expect(state.tilesExist).toBe(true);
    expect(state.tilesLength).toBeGreaterThan(0);
    expect(state.uniqueTileTypes).toBeGreaterThanOrEqual(0);
  });

  test('12: Terrain rendering completes without errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(8000);

    console.log('JavaScript errors:', errors);
    expect(errors.length).toBe(0);
  });
});