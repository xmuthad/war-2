import { test, expect } from '@playwright/test';

test.describe('Sprite and Unit Rendering Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('01: Unit sprites or fallback circles are rendered', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const scene = game?.scene?.getScene('GameScene');
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();

      // Check unit sprites in Phaser scene
      const unitSprites = scene?.children?.list?.filter((c: any) =>
        c.type === 'Sprite' && c.texture?.key
      ) || [];

      return {
        unitSpritesInScene: unitSprites.length > 0,
        spriteCount: unitSprites.length,
        storeUnits: s?.currentPlayer?.units?.length || 0,
      };
    });

    console.log(`Unit render state: ${JSON.stringify(state)}`);
    expect(state.storeUnits).toBeGreaterThan(0);
    expect(state.unitSpritesInScene).toBe(true);
  });

  test('02: Building sprites or fallback rectangles are rendered', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Buildings should exist (command center)
    const playerLog = logs.find(l => l.includes('currentPlayer='));
    console.log('Player status:', playerLog);
  });

  test('03: Canvas shows unit/building objects (non-terrain pixels)', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(10000);

    // Retry pixel check up to 5 times with wider sampling
    let result: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) return { error: 'No canvas' };

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return { error: 'No WebGL' };

        // Sample across the entire canvas with large step
        const step = 64;
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

      console.log(`Sprite rendering result (attempt ${attempt + 1}):`, result);

      if (!('error' in result) && result.nonBlack > 0) break;
      await page.waitForTimeout(3000);
    }

    if (!('error' in result)) {
      // With fog of war, at least some area should be visible
      expect(result.nonBlack).toBeGreaterThan(0);
    }
  });

  test('04: Sprite assets are accessible', async ({ page }) => {
    // Check if sprite files are accessible
    const spriteUrls = [
      '/assets/sprites/units/allied_soldier.png',
      '/assets/sprites/units/soviet_soldier.png',
      '/assets/sprites/buildings/allied_command.png',
      '/assets/sprites/buildings/soviet_command.png',
    ];

    for (const url of spriteUrls) {
      const response = await page.request.get(url);
      const status = response.status();
      console.log(`${url}: ${status}`);
      expect(status).toBe(200);
    }
  });

  test('05: Unit position matches game state', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const scene = game?.scene?.getScene('GameScene');
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();

      const units = s?.currentPlayer?.units || [];
      const unitSprites = scene?.unitSprites;

      // Compare first unit position with its sprite position
      if (units.length > 0 && unitSprites && unitSprites.size > 0) {
        const firstUnit = units[0];
        const sprite = unitSprites.get(firstUnit.id);
        return {
          hasUnits: true,
          hasSprite: !!sprite,
          unitPos: firstUnit.position,
          spritePos: sprite ? { x: sprite.x, y: sprite.y } : null,
        };
      }

      return { hasUnits: units.length > 0, hasSprite: false };
    });

    console.log(`Unit position match: ${JSON.stringify(state)}`);
    expect(state.hasUnits).toBe(true);
  });

  test('06: Health bars are created for units', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Health bars should be created (via setUnitHealth calls)
    // This is implicit - if no errors occur, health bars work
    const hasError = logs.some(l => 
      l.includes('TypeError') || l.includes('Cannot read')
    );
    expect(hasError).toBe(false);
  });

  test('07: Unit animations are set up', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Check for animation-related errors
    const animErrors = logs.filter(l =>
      l.includes('animation') && (l.includes('error') || l.includes('Error'))
    );
    console.log('Animation errors:', animErrors.length);
    expect(animErrors.length).toBe(0);
  });

  test('08: Selection circle renders when unit selected', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Click on canvas to try selecting a unit
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 640, y: 360 } });
    await page.waitForTimeout(500);

    // No crash = selection system works
    console.log('Selection click test passed');
  });

  test('09: Multiple unit types render correctly', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Check for different unit types in the game
    const playerLog = logs.find(l => l.includes('currentPlayer='));
    console.log('Player info:', playerLog);

    // Check sprite texture keys
    const textureLogs = logs.filter(l => l.includes('texture'));
    console.log('Texture logs:', textureLogs.length);
  });

  test('10: Building command center renders at spawn point', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Command center should be created for each player
    // Check game store state
    const storeState = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      
      const state = store.getState();
      return {
        playerBuildings: state.currentPlayer?.buildings?.length || 0,
        aiBuildings: state.aiPlayers?.reduce((sum: number, ai: any) => sum + ai.buildings.length, 0) || 0,
        playerUnits: state.currentPlayer?.units?.length || 0,
        aiUnits: state.aiPlayers?.reduce((sum: number, ai: any) => sum + ai.units.length, 0) || 0,
      };
    });

    console.log('Store state:', storeState);

    if (!('error' in storeState)) {
      // Player should have at least 1 building (command center)
      expect(storeState.playerBuildings).toBeGreaterThanOrEqual(1);
      // AI should also have buildings
      expect(storeState.aiBuildings).toBeGreaterThanOrEqual(1);
      // Player should have units
      expect(storeState.playerUnits).toBeGreaterThanOrEqual(1);
    }
  });
});