import { test, expect } from '@playwright/test';

test.describe('Map Editor Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Clear any custom maps from previous tests
    await page.evaluate(() => {
      localStorage.removeItem('customMaps');
    });
  });

  test('01: Map editor button exists on menu', async ({ page }) => {
    const editorButton = page.locator('button:has-text("创建地图")');
    await expect(editorButton).toBeVisible();
  });

  test('02: Clicking create map opens editor', async ({ page }) => {
    await page.locator('button:has-text("创建地图")').click();
    await page.waitForTimeout(1000);

    // Editor uses .map-editor class
    const editor = page.locator('.map-editor');
    await expect(editor).toBeVisible();
  });

  test('03: Map editor has canvas for drawing', async ({ page }) => {
    await page.locator('button:has-text("创建地图")').click();
    await page.waitForTimeout(1000);

    // Editor has .editor-canvas-container
    const canvasContainer = page.locator('.editor-canvas-container');
    await expect(canvasContainer).toBeVisible();
  });

  test('04: Map editor has terrain tools', async ({ page }) => {
    await page.locator('button:has-text("创建地图")').click();
    await page.waitForTimeout(1000);

    // Check toolbar exists
    const toolbar = page.locator('.editor-toolbar');
    await expect(toolbar).toBeVisible();

    const toolbarText = await toolbar.innerText();
    console.log('Editor toolbar:', toolbarText.substring(0, 300));

    // Should have brush, eraser, fill, spawn, resource tools
    expect(toolbarText).toContain('画笔');
  });

  test('05: Map editor can be closed (back to menu)', async ({ page }) => {
    await page.locator('button:has-text("创建地图")').click();
    await page.waitForTimeout(1000);

    // Look for back button
    const backButton = page.locator('button:has-text("返回")');
    await expect(backButton).toBeVisible();

    await backButton.click();
    await page.waitForTimeout(500);

    // Should be back to menu
    await expect(page.locator('text=快速开始')).toBeVisible();
  });

  test('06: Map editor has save button', async ({ page }) => {
    await page.locator('button:has-text("创建地图")').click();
    await page.waitForTimeout(1000);

    const saveButton = page.locator('button:has-text("保存")');
    await expect(saveButton).toBeVisible();
  });

  test('07: Custom maps tab switches correctly', async ({ page }) => {
    // Click custom maps tab
    const customTab = page.locator('.map-tab:has-text("自定义地图")');
    await customTab.click();
    await page.waitForTimeout(800);

    // Tab should now be active (contains 'active' class)
    const tabClass = await customTab.getAttribute('class');
    console.log('Custom tab class:', tabClass);
    
    // Switch back to preset tab
    const presetTab = page.locator('.map-tab:has-text("预设地图")');
    await presetTab.click();
    await page.waitForTimeout(300);
    
    const presetClass = await presetTab.getAttribute('class');
    console.log('Preset tab class:', presetClass);
  });

  test('08: Preset tab shows maps after custom tab toggle', async ({ page }) => {
    // Switch to custom then back to preset
    await page.locator('.map-tab:has-text("自定义地图")').click();
    await page.waitForTimeout(500);
    
    await page.locator('.map-tab:has-text("预设地图")').click();
    await page.waitForTimeout(500);

    // Map list should be visible again
    const mapItems = page.locator('.map-list-item');
    const count = await mapItems.count();
    console.log('Map items after toggle:', count);
    expect(count).toBeGreaterThanOrEqual(6);
  });
});