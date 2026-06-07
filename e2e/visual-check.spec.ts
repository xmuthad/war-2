import { test } from '@playwright/test';

test('visual: screenshot game state', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'log') logs.push(msg.text());
  });

  await page.goto('/');
  await page.waitForTimeout(1000);

  // Screenshot menu
  await page.screenshot({ path: 'test-output/visual-menu.png', fullPage: true });

  // Start game
  await page.locator('text=快速开始').click();
  await page.waitForTimeout(8000);

  // Screenshot game
  await page.screenshot({ path: 'test-output/visual-game.png', fullPage: true });

  // Check for double initialization
  const phaserCreated = logs.filter(l => l.includes('Phaser.Game created'));
  console.log(`Phaser.Game created count: ${phaserCreated.length}`);

  // Check rendering pipeline
  const terrainCreated = logs.some(l => l.includes('Terrain texture created'));
  const terrainTiles = logs.some(l => l.includes('Terrain tiles drawn'));
  const fogInit = logs.some(l => l.includes('FogOfWar initialized'));
  const unitsUpdated = logs.some(l => l.includes('updateUnits called'));

  console.log(`Terrain created: ${terrainCreated}`);
  console.log(`Terrain tiles drawn: ${terrainTiles}`);
  console.log(`Fog initialized: ${fogInit}`);
  console.log(`Units updated: ${unitsUpdated}`);

  // Check fog state
  const fogState = await page.evaluate(() => {
    const store = (window as any).__ZUSTAND_STORE__;
    if (!store) return { error: 'No store' };
    
    const state = store.getState();
    return {
      gameState: state.gameState,
      playerUnits: state.currentPlayer?.units?.length || 0,
      playerBuildings: state.currentPlayer?.buildings?.length || 0,
      aiUnits: state.aiPlayers?.reduce((sum: number, ai: any) => sum + ai.units.length, 0) || 0,
    };
  });
  console.log('Game state:', fogState);

  // Check fog observers
  const fogInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return { error: 'No canvas' };
    
    // Check if fog image is visible
    const phaserContainer = document.querySelector('.phaser-container');
    if (!phaserContainer) return { error: 'No phaser container' };
    
    return {
      containerChildren: phaserContainer.children.length,
      canvasSize: `${canvas.width}x${canvas.height}`,
    };
  });
  console.log('Fog info:', fogInfo);

  // Check pixel content across entire canvas
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return { error: 'No canvas' };

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'No WebGL' };

    // Read entire canvas (sample every 32 pixels)
    const step = 32;
    const w = canvas.width;
    const h = canvas.height;
    const samples: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const pixels = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        samples.push({ x, y, r: pixels[0], g: pixels[1], b: pixels[2] });
      }
    }

    // Count terrain types
    let grass = 0, water = 0, mountain = 0, forest = 0, ore = 0, fog = 0, other = 0;
    const unknownColors: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
    for (const s of samples) {
      // Black/dark = fog
      if (s.r < 10 && s.g < 10 && s.b < 10) { fog++; continue; }
      // Grass: 0x4a6741 => (74, 103, 65)
      if (s.g > s.r && s.g > s.b && s.g > 40 && s.g < 130 && s.r < 100) grass++;
      // Water: 0x1e6db8 => (30, 109, 184)
      else if (s.b > s.g && s.b > s.r && s.b > 80) water++;
      // Mountain: 0x8b7355 => (139, 115, 85)
      else if (s.r > 100 && s.g > 70 && s.b < 100 && s.r > s.b) mountain++;
      // Forest: 0x228b22 => (34, 139, 34)
      else if (s.g > 100 && s.r < 60 && s.b < 60) forest++;
      // Ore: 0xffd700 => (255, 215, 0)
      else if (s.r > 200 && s.g > 150 && s.b < 50) ore++;
      else { other++; if (unknownColors.length < 10) unknownColors.push(s); }
    }

    const total = samples.length;

    return {
      total,
      grass,
      water,
      mountain,
      forest,
      ore,
      fog,
      other,
      grassPct: ((grass / total) * 100).toFixed(1),
      waterPct: ((water / total) * 100).toFixed(1),
      fogPct: ((fog / total) * 100).toFixed(1),
      unknownColors,
    };
  });

  console.log('Pixel analysis:', JSON.stringify(result, null, 2));
});
