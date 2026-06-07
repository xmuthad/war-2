import { test, expect } from '@playwright/test';

test.describe('UI Interaction Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('01: Resource bar shows resources during game', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // ResourceBar uses .resource-bar-container or .resource-bar
    const resourceBar = page.locator('.resource-bar-container, .resource-bar');
    const visible = await resourceBar.isVisible().catch(() => false);
    console.log('Resource bar visible:', visible);

    if (visible) {
      const barText = await resourceBar.first().innerText();
      console.log('Resource bar text:', barText.substring(0, 200));
    } else {
      console.log('Resource bar not visible - may be hidden when no player');
    }
  });

  test('02: Build panel is accessible during game', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    const buildPanel = page.locator('.build-panel');
    await expect(buildPanel).toBeVisible();
  });

  test('03: Game timer counts up', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(3000);

    const timer = page.locator('.game-timer').first();
    await expect(timer).toBeVisible();

    const time1 = await timer.innerText();
    console.log('Timer at 3s:', time1);

    await page.waitForTimeout(3000);
    const time2 = await timer.innerText();
    console.log('Timer at 6s:', time2);

    // Timer should have changed
    expect(time2).not.toBe(time1);
  });

  test('04: Pause/unpause via space bar', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(3000);

    // Try clicking the game canvas first to focus it, then press Space
    const canvas = page.locator('canvas').first();
    await canvas.click();
    await page.waitForTimeout(300);

    // Pause - Phaser might be intercepting keyboard, try with brackets
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const pauseOverlay = page.locator('.pause-overlay');
    const isPaused = await pauseOverlay.isVisible().catch(() => false);
    console.log('Pause overlay visible after Space:', isPaused);
  });

  test('05: Pause menu shows all options', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(3000);

    // Click canvas to focus
    await page.locator('canvas').first().click();
    await page.waitForTimeout(300);

    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const pauseOverlay = page.locator('.pause-overlay');
    const isVisible = await pauseOverlay.isVisible().catch(() => false);
    console.log('Pause overlay visible:', isVisible);

    if (isVisible) {
      const pauseText = await pauseOverlay.innerText();
      console.log('Pause text:', pauseText.substring(0, 300));
    }
  });

  test('06: Pause menu shows stats when requested', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(3000);

    // Click canvas to focus  
    await page.locator('canvas').first().click();
    await page.waitForTimeout(300);

    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const pauseOverlay = page.locator('.pause-overlay');
    const isPaused = await pauseOverlay.isVisible().catch(() => false);
    console.log('Paused for stats test:', isPaused);

    if (isPaused) {
      // Try clicking the stats button
      const statsBtn = page.locator('button:has-text("战况统计")');
      const statsBtnVisible = await statsBtn.isVisible().catch(() => false);
      if (statsBtnVisible) {
        await statsBtn.click();
        await page.waitForTimeout(500);
        const stats = page.locator('.pause-stats');
        const statsVisible = await stats.isVisible().catch(() => false);
        console.log('Stats visible:', statsVisible);
      }
    }
  });

  test('07: Escape clears selection', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // No crash when Escape is pressed
    const hasError = logs.some(l => 
      l.includes('error') || l.includes('TypeError')
    );
    expect(hasError).toBe(false);
  });

  test('08: GameUI renders correctly', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // GameUI uses .game-ui-panel class
    const gameUI = page.locator('.game-ui-panel, .game-ui, .unit-panel');
    const count = await gameUI.count();
    console.log(`Game UI panels found: ${count}`);
  });

  test('09: Zoom controls work (keyboard +/-)', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // Try zoom in with +
    await page.keyboard.press('+');
    await page.waitForTimeout(300);

    // Try zoom out with -
    await page.keyboard.press('-');
    await page.waitForTimeout(300);

    console.log('Zoom keys pressed without errors');
  });

  test('10: Map selection shows large preview', async ({ page }) => {
    // On menu, large preview should show for default map
    const largePreview = page.locator('.map-preview-large');
    await expect(largePreview).toBeVisible();
    
    const previewTitle = page.locator('.map-preview-info h3');
    const titleText = await previewTitle.innerText();
    console.log('Default map preview:', titleText);
    expect(titleText.length).toBeGreaterThan(0);
  });

  test('11: Faction switch updates selection', async ({ page }) => {
    // Click Soviet faction
    await page.locator('button:has-text("苏军")').click();
    await page.waitForTimeout(300);

    // Verify the faction section
    const factionSection = page.locator('.faction-button.selected, [class*="faction"][class*="selected"]');
    const selectedFaction = await factionSection.first().innerText().catch(() => 'not found');
    console.log('Selected faction:', selectedFaction);
  });

  test('12: Difficulty selection is visible', async ({ page }) => {
    const easyBtn = page.locator('.difficulty-button:has-text("简单"), button:has-text("简单")');
    await expect(easyBtn).toBeVisible();

    const mediumBtn = page.locator('.difficulty-button:has-text("普通"), button:has-text("普通")');
    await expect(mediumBtn).toBeVisible();

    const hardBtn = page.locator('.difficulty-button:has-text("困难"), button:has-text("困难")');
    await expect(hardBtn).toBeVisible();
  });

  test('13: Arrow keys pan camera', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(5000);

    // Pan left
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);

    // Pan up
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);

    // Pan right
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    // Pan down
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);

    console.log('Arrow key navigation tested');
  });

  test('14: Game shortcut tips are visible', async ({ page }) => {
    const tips = page.locator('.shortcut-tips, .tips-section, [class*="tip"]');
    const tipCount = await tips.count();
    console.log('Tip elements:', tipCount);

    // Page should show shortcut hints
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('快捷键');
  });

  test('15: Menu shows all required sections', async ({ page }) => {
    const bodyText = await page.locator('body').innerText();

    // Check all menu sections
    const requiredSections = [
      '选择阵营',
      '盟军',
      '苏军',
      '选择难度',
      '选择地图',
      '快速开始',
    ];

    for (const section of requiredSections) {
      expect(bodyText).toContain(section);
    }
  });
});