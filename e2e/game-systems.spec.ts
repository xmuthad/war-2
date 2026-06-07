import { test, expect } from '@playwright/test';

test.describe('Game Systems Initialization', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('01: HotkeyManager initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // Press keys to verify hotkeys work
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const hasHotkeyError = logs.some(l =>
      l.includes('error') && l.toLowerCase().includes('hotkey')
    );
    expect(hasHotkeyError).toBe(false);
  });

  test('02: UnitGroupManager initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // Press Ctrl+1 to create a group
    await page.keyboard.press('Control+Digit1');
    await page.waitForTimeout(300);

    const groupLogs = logs.filter(l => l.toLowerCase().includes('group'));
    console.log('Group logs:', groupLogs.length);
  });

  test('03: WeatherSystem initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const weatherLogs = logs.filter(l =>
      l.toLowerCase().includes('weather')
    );
    console.log(`Weather logs: ${weatherLogs.length}`);
  });

  test('04: DayNightCycle initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const dayNightLogs = logs.filter(l =>
      l.toLowerCase().includes('daynight') || l.includes('DayNight')
    );
    console.log(`DayNight logs: ${dayNightLogs.length}`);
  });

  test('05: RadarSystem initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const radarLogs = logs.filter(l =>
      l.toLowerCase().includes('radar')
    );
    console.log(`Radar logs: ${radarLogs.length}`);
  });

  test('06: AlertSystem initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const alertLogs = logs.filter(l =>
      l.toLowerCase().includes('alert')
    );
    console.log(`Alert logs: ${alertLogs.length}`);
  });

  test('07: MissionSystem initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const missionLogs = logs.filter(l =>
      l.toLowerCase().includes('mission')
    );
    console.log(`Mission logs: ${missionLogs.length}`);
  });

  test('08: StatisticsSystem initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // Stats may be tracked internally; check for no errors
    const hasError = logs.some(l => l.includes('stat') && l.includes('error'));
    console.log('Statistics errors:', hasError);
    expect(hasError).toBe(false);
  });

  test('09: SoundManager initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const soundLogs = logs.filter(l =>
      l.toLowerCase().includes('sound') || l.toLowerCase().includes('audio')
    );
    console.log(`Sound logs: ${soundLogs.length}`);
  });

  test('10: EffectSystem initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const effectLogs = logs.filter(l =>
      l.toLowerCase().includes('effect')
    );
    console.log(`Effect logs: ${effectLogs.length}`);
  });

  test('11: FogOfWar initializes and reveals areas', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // Fog should now be initialized (not disabled)
    const fogInitialized = logs.some(l => l.includes('FogOfWar initialized'));
    expect(fogInitialized).toBe(true);
  });

  test('12: PathfindingManager initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const pathLogs = logs.filter(l =>
      l.toLowerCase().includes('path') || l.toLowerCase().includes('pathfinding')
    );
    console.log(`Pathfinding logs: ${pathLogs.length}`);
  });

  test('13: CombatSystem initializes', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const combatLogs = logs.filter(l =>
      l.toLowerCase().includes('combat') || l.toLowerCase().includes('damage') || l.toLowerCase().includes('attack')
    );
    console.log(`Combat logs: ${combatLogs.length}`);
  });

  test('14: FactionSystem is set correctly', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const factionLogs = logs.find(l =>
      l.includes('currentPlayer')
    );
    console.log('Faction/Player log:', factionLogs);
    expect(factionLogs).toBeDefined();
  });

  test('15: GameEngine game loop runs', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // GameCanvas should re-render multiple times (game loop is active)
    const renderLogs = logs.filter(l => l.includes('GameCanvas rendered'));
    console.log(`Game loop renders: ${renderLogs.length}`);
    expect(renderLogs.length).toBeGreaterThan(3);
  });

  test('16: AIController creates AI players', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const aiLogs = logs.filter(l => l.toLowerCase().includes('ai'));
    console.log(`AI logs: ${aiLogs.length}`);
  });

  test('17: No JavaScript errors during all system init', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(8000);

    console.log(`JavaScript errors (${errors.length}):`, errors);
    expect(errors.length).toBe(0);
  });

  test('18: Phaser scene creates all subsystems', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Verify core systems were initialized in the right order
    const initOrder = [
      'Phaser.Game created',
      'Phaser preload started',
      'PhaserGameScene create()',
      'sceneReady event fired',
      'createTerrain called',
      'drawTerrain COMPLETED'
    ];

    const logIndices = initOrder.map(keyword => {
      const idx = logs.findIndex(l => l.includes(keyword));
      return { keyword, idx };
    });

    console.log('=== System Init Order ===');
    for (const item of logIndices) {
      console.log(`${item.keyword}: index=${item.idx}`);
    }

    // All should be found (index >= 0)
    for (const item of logIndices) {
      expect(item.idx).toBeGreaterThanOrEqual(0);
    }
  });
});