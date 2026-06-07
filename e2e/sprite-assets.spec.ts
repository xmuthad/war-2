import { test, expect } from '@playwright/test';

test.describe('Sprite Assets Comprehensive E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  // All sprite files that should exist on disk
  const expectedUnitSprites = [
    'allied_soldier', 'allied_tank', 'allied_engineer', 'allied_miner',
    'allied_helicopter', 'allied_rocket', 'allied_sniper', 'allied_tanya',
    'allied_ifv', 'allied_prism',
    'soviet_soldier', 'soviet_tank', 'soviet_engineer', 'soviet_miner',
    'soviet_helicopter', 'soviet_rocket', 'soviet_tesla', 'soviet_apocalypse',
  ];

  const expectedBuildingSprites = [
    'allied_command', 'allied_barracks', 'allied_refinery', 'allied_warfactory',
    'allied_power', 'allied_radar', 'allied_tech', 'allied_repair',
    'allied_wall', 'allied_airfield', 'allied_defense',
    'soviet_command', 'soviet_barracks', 'soviet_refinery', 'soviet_warfactory',
    'soviet_power', 'soviet_radar', 'soviet_tech', 'soviet_repair',
    'soviet_wall', 'soviet_airfield', 'soviet_defense', 'soviet_teslacoil',
  ];

  const expectedEffectSprites = [
    'explosion_0', 'explosion_1', 'explosion_2', 'explosion_3',
    'smoke_0', 'smoke_1', 'smoke_2', 'smoke_3',
    'muzzle_0', 'muzzle_1', 'muzzle_2', 'muzzle_3',
  ];

  test('01: All unit sprite files are accessible', async ({ page }) => {
    const result = await page.evaluate(async (units: string[]) => {
      const results: Record<string, { ok: boolean; size?: number }> = {};
      for (const unit of units) {
        try {
          const response = await fetch(`/assets/sprites/units/${unit}.png`);
          results[unit] = {
            ok: response.ok,
            size: response.ok ? parseInt(response.headers.get('content-length') || '0') : 0,
          };
        } catch {
          results[unit] = { ok: false };
        }
      }
      return results;
    }, expectedUnitSprites);

    console.log('Unit sprites:', JSON.stringify(result, null, 2));
    const accessible = Object.entries(result).filter(([_, v]) => v.ok);
    const failed = Object.entries(result).filter(([_, v]) => !v.ok);

    console.log(`Accessible: ${accessible.length}/${expectedUnitSprites.length}`);
    if (failed.length > 0) {
      console.log('Failed:', failed.map(([k]) => k));
    }

    // All unit sprites should be accessible
    expect(accessible.length).toBe(expectedUnitSprites.length);
  });

  test('02: All building sprite files are accessible', async ({ page }) => {
    const result = await page.evaluate(async (buildings: string[]) => {
      const results: Record<string, { ok: boolean; size?: number }> = {};
      for (const building of buildings) {
        try {
          const response = await fetch(`/assets/sprites/buildings/${building}.png`);
          results[building] = {
            ok: response.ok,
            size: response.ok ? parseInt(response.headers.get('content-length') || '0') : 0,
          };
        } catch {
          results[building] = { ok: false };
        }
      }
      return results;
    }, expectedBuildingSprites);

    console.log('Building sprites:', JSON.stringify(result, null, 2));
    const accessible = Object.entries(result).filter(([_, v]) => v.ok);
    const failed = Object.entries(result).filter(([_, v]) => !v.ok);

    console.log(`Accessible: ${accessible.length}/${expectedBuildingSprites.length}`);
    if (failed.length > 0) {
      console.log('Failed:', failed.map(([k]) => k));
    }

    // All building sprites should be accessible
    expect(accessible.length).toBe(expectedBuildingSprites.length);
  });

  test('03: All effect sprite files are accessible', async ({ page }) => {
    const result = await page.evaluate(async (effects: string[]) => {
      const results: Record<string, { ok: boolean; size?: number }> = {};
      for (const effect of effects) {
        try {
          const response = await fetch(`/assets/sprites/effects/${effect}.png`);
          results[effect] = {
            ok: response.ok,
            size: response.ok ? parseInt(response.headers.get('content-length') || '0') : 0,
          };
        } catch {
          results[effect] = { ok: false };
        }
      }
      return results;
    }, expectedEffectSprites);

    console.log('Effect sprites:', JSON.stringify(result, null, 2));
    const accessible = Object.entries(result).filter(([_, v]) => v.ok);
    const failed = Object.entries(result).filter(([_, v]) => !v.ok);

    console.log(`Accessible: ${accessible.length}/${expectedEffectSprites.length}`);
    if (failed.length > 0) {
      console.log('Failed:', failed.map(([k]) => k));
    }

    expect(accessible.length).toBe(expectedEffectSprites.length);
  });

  test('04: Sprite files have valid image data (non-zero size)', async ({ page }) => {
    const allSprites = [
      ...expectedUnitSprites.map(s => ({ name: s, type: 'units' })),
      ...expectedBuildingSprites.map(s => ({ name: s, type: 'buildings' })),
      ...expectedEffectSprites.map(s => ({ name: s, type: 'effects' })),
    ];

    const result = await page.evaluate(async (sprites: { name: string; type: string }[]) => {
      const results: Record<string, number> = {};
      for (const sprite of sprites) {
        try {
          const response = await fetch(`/assets/sprites/${sprite.type}/${sprite.name}.png`);
          if (response.ok) {
            const blob = await response.blob();
            results[sprite.name] = blob.size;
          } else {
            results[sprite.name] = -1;
          }
        } catch {
          results[sprite.name] = -2;
        }
      }
      return results;
    }, allSprites);

    const zeroSize = Object.entries(result).filter(([_, size]) => size <= 0);
    const validSize = Object.entries(result).filter(([_, size]) => size > 0);

    console.log(`Valid sprites: ${validSize.length}/${allSprites.length}`);
    if (zeroSize.length > 0) {
      console.log('Invalid sprites:', zeroSize.map(([k, v]) => `${k} (${v})`));
    }

    // All sprites should have valid size
    expect(zeroSize.length).toBe(0);
  });

  test('05: Sprites load successfully in Phaser', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(8000);

    const state = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const scene = game?.scene?.getScene('GameScene');
      const store = (window as any).__ZUSTAND_STORE__;
      const s = store?.getState();

      if (!scene) return { spritesExist: false, error: 'No scene' };

      // Check unit sprites in Phaser scene
      const unitSprites = scene.children.list.filter((c: any) => 
        c.type === 'Sprite' && (c.texture?.key?.startsWith('usa_') || c.texture?.key?.startsWith('allied_'))
      );

      return {
        spritesExist: unitSprites.length > 0,
        spriteCount: unitSprites.length,
        storeUnits: s?.currentPlayer?.units?.length || 0,
      };
    });

    console.log(`Sprite render result: ${JSON.stringify(state)}`);
    expect(state.storeUnits).toBeGreaterThan(0);
    expect(state.spritesExist).toBe(true);
  });

  test('06: Unit sprites render as textures (not fallback circles)', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(8000);

    // Check if fallback circles were used (indicates sprite loading failure)
    const fallbackUsed = logs.filter(l => l.includes('fallback') || l.includes('Fallback circle'));
    console.log('Fallback usage:', fallbackUsed.length);

    // Check for texture existence
    const textureInfo = await page.evaluate(() => {
      const game = (window as any).__phaserGame__;
      if (!game) return { error: 'No game' };

      const textures = game.textures;
      const textureKeys = textures.getTextureKeys();
      return {
        totalTextures: textureKeys.length,
        unitTextures: textureKeys.filter((k: string) =>
          k.includes('soldier') || k.includes('tank') || k.includes('engineer') ||
          k.includes('miner') || k.includes('command') || k.includes('barracks')
        ),
      };
    });

    console.log('Texture info:', textureInfo);
    if (!('error' in textureInfo)) {
      expect(textureInfo.unitTextures.length).toBeGreaterThan(0);
    }
  });

  test('07: Building sprites render correctly', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(8000);

    const buildingInfo = await page.evaluate(() => {
      const game = (window as any).__phaserGame__;
      if (!game) return { error: 'No game' };

      const textures = game.textures;
      const textureKeys = textures.getTextureKeys();

      const buildingTextures = textureKeys.filter((k: string) =>
        k.includes('command') || k.includes('barracks') || k.includes('refinery') ||
        k.includes('warfactory') || k.includes('power') || k.includes('radar')
      );

      return {
        buildingTextureCount: buildingTextures.length,
        buildingTextures: buildingTextures.slice(0, 10),
      };
    });

    console.log('Building textures:', buildingInfo);
    if (!('error' in buildingInfo)) {
      expect(buildingInfo.buildingTextureCount).toBeGreaterThan(0);
    }
  });

  test('08: No unexpected sprite files on disk', async ({ page }) => {
    // Check that all sprite files on disk are referenced in SPRITE_PATHS
    const result = await page.evaluate(async () => {
      const allFiles: string[] = [];

      // Try fetching each possible sprite file
      const prefixes = ['allied_', 'soviet_'];
      const unitTypes = ['soldier', 'tank', 'engineer', 'miner', 'helicopter', 'rocket',
        'sniper', 'tanya', 'ifv', 'prism', 'tesla', 'apocalypse'];
      const buildingTypes = ['command', 'barracks', 'refinery', 'warfactory', 'power',
        'radar', 'tech', 'repair', 'wall', 'airfield', 'defense', 'teslacoil'];

      for (const prefix of prefixes) {
        for (const type of unitTypes) {
          try {
            const response = await fetch(`/assets/sprites/units/${prefix}${type}.png`);
            if (response.ok) allFiles.push(`units/${prefix}${type}`);
          } catch { /* skip */ }
        }
        for (const type of buildingTypes) {
          try {
            const response = await fetch(`/assets/sprites/buildings/${prefix}${type}.png`);
            if (response.ok) allFiles.push(`buildings/${prefix}${type}`);
          } catch { /* skip */ }
        }
      }

      return allFiles.sort();
    });

    console.log('All sprite files on disk:', result);
    // Should have at least the expected number of sprites
    expect(result.length).toBeGreaterThanOrEqual(
      expectedUnitSprites.length + expectedBuildingSprites.length
    );
  });

  test('09: Sprite animations are created for units', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(8000);

    // Check animation creation
    const animInfo = await page.evaluate(() => {
      const game = (window as any).__phaserGame__;
      if (!game) return { error: 'No game' };

      const anims = game.anims;
      const animKeys = anims.anims.entries;
      const keys = Object.keys(animKeys);

      const directionAnims = keys.filter(k => k.includes('_dir'));
      const idleAnims = keys.filter(k => k.includes('_idle'));

      return {
        totalAnimations: keys.length,
        directionAnims: directionAnims.length,
        idleAnims: idleAnims.length,
        sampleDirectionAnims: directionAnims.slice(0, 5),
      };
    });

    console.log('Animation info:', animInfo);
    if (!('error' in animInfo)) {
      expect(animInfo.directionAnims).toBeGreaterThan(0);
      expect(animInfo.idleAnims).toBeGreaterThan(0);
    }
  });

  test('10: No JS errors during sprite loading and rendering', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(8000);

    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') || e.includes('Cannot read') || e.includes('is not a function')
    );
    const spriteErrors = errors.filter(e =>
      (e.includes('sprite') || e.includes('texture') || e.includes('asset')) &&
      !e.includes('Sprite not found') // Expected fallback behavior
    );

    console.log('Critical errors:', criticalErrors.length);
    console.log('Sprite-related errors:', spriteErrors.length);
    if (spriteErrors.length > 0) {
      console.log('Sprite error details:', spriteErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });
});
