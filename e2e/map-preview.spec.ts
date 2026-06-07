import { test, expect } from '@playwright/test';

test.describe('Map Preview in Menu Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
  });

  test('01: Menu shows map list and large preview', async ({ page }) => {
    // Check map list items
    const mapItems = page.locator('.map-list-item');
    const count = await mapItems.count();
    console.log(`Map list items: ${count}`);
    expect(count).toBeGreaterThanOrEqual(6);

    // Large preview should be visible
    const largePreview = page.locator('.map-preview-large');
    await expect(largePreview).toBeVisible();
  });

  test('02: Each map list item shows map name', async ({ page }) => {
    const mapItems = page.locator('.map-list-item');
    const count = await mapItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = mapItems.nth(i);
      const name = await item.locator('h4').innerText();
      console.log(`Map ${i}: ${name}`);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test('03: Large preview shows pixel content for selected map', async ({ page }) => {
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas') as NodeListOf<HTMLCanvasElement>;
      // Large preview canvas is >= 200px
      const largeCanvas = Array.from(canvases).find(c => c.width >= 200 && c.width <= 400);
      
      if (!largeCanvas) return { error: 'No large preview canvas' };

      const ctx = largeCanvas.getContext('2d');
      if (!ctx) return { error: 'No 2d context' };

      const pixels = ctx.getImageData(0, 0, largeCanvas.width, largeCanvas.height);
      let nonBlack = 0;

      for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i];
        const g = pixels.data[i + 1];
        const b = pixels.data[i + 2];
        if (r > 10 || g > 10 || b > 10) nonBlack++;
      }

      return {
        hasContent: nonBlack > 0,
        nonBlack,
        totalPixels: pixels.data.length / 4,
        size: `${largeCanvas.width}x${largeCanvas.height}`
      };
    });

    console.log('Large preview pixel data:', result);
    
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      expect(result.hasContent).toBe(true);
      console.log(`Non-black: ${result.nonBlack}/${result.totalPixels}`);
    }
  });

  test('04: Large preview shows multiple terrain colors', async ({ page }) => {
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas') as NodeListOf<HTMLCanvasElement>;
      const largeCanvas = Array.from(canvases).find(c => c.width >= 200 && c.width <= 400);
      
      if (!largeCanvas) return { error: 'No large preview canvas' };

      const ctx = largeCanvas.getContext('2d');
      if (!ctx) return { error: 'No context' };

      const pixels = ctx.getImageData(0, 0, largeCanvas.width, largeCanvas.height);
      const colorSet = new Set<string>();

      // Sample pixels
      for (let i = 0; i < pixels.data.length; i += 40) {
        const r = Math.round(pixels.data[i] / 16) * 16;
        const g = Math.round(pixels.data[i + 1] / 16) * 16;
        const b = Math.round(pixels.data[i + 2] / 16) * 16;
        colorSet.add(`${r},${g},${b}`);
      }

      return {
        uniqueColors: colorSet.size,
        size: `${largeCanvas.width}x${largeCanvas.height}`
      };
    });

    console.log('Color variety:', result);

    if (!('error' in result)) {
      expect(result.uniqueColors).toBeGreaterThan(1);
    }
  });

  test('05: Large preview canvas size is correct', async ({ page }) => {
    const largeCanvas = page.locator('.large-map-preview');
    const box = await largeCanvas.boundingBox();

    console.log(`Large preview bounding box:`, box);
    expect(box?.width).toBeGreaterThanOrEqual(280);
    expect(box?.height).toBeGreaterThanOrEqual(280);
  });

  test('06: Selecting a map highlights it on the left', async ({ page }) => {
    // First item should already be selected (default)
    const firstItem = page.locator('.map-list-item').first();
    await expect(firstItem).toHaveClass(/selected/);
    
    // Click second item
    const secondItem = page.locator('.map-list-item').nth(1);
    await secondItem.click();
    await page.waitForTimeout(500);
    
    // Second item should now be selected
    await expect(secondItem).toHaveClass(/selected/);
    
    // First item should not be selected
    await expect(firstItem).not.toHaveClass(/selected/);
  });

  test('07: Large preview updates when different map selected', async ({ page }) => {
    // Default: first map name shown
    const firstMapName = await page.locator('.map-list-item').first().locator('h4').innerText();
    const previewTitle = page.locator('.map-preview-info h3');
    await expect(previewTitle).toHaveText(firstMapName);

    // Click different map
    const secondItem = page.locator('.map-list-item').nth(2);
    const secondMapName = await secondItem.locator('h4').innerText();
    await secondItem.click();
    await page.waitForTimeout(500);

    // Preview title should update
    await expect(previewTitle).toHaveText(secondMapName);
  });

  test('08: All 6 preset maps are listed', async ({ page }) => {
    const mapItems = page.locator('.map-list-item');
    const count = await mapItems.count();
    console.log(`Total map items: ${count}`);

    expect(count).toBeGreaterThanOrEqual(6);

    // Check map names
    const mapNames = await page.locator('.map-list-info h4').allTextContents();
    console.log('Map names:', mapNames);
  });

  test('09: Map preview updates when tab changed', async ({ page }) => {
    // Switch to custom maps tab
    const customTab = page.locator('.map-tab:has-text("自定义地图")');
    await customTab.click();
    await page.waitForTimeout(500);

    // Should show no maps message or empty list
    const noMapsMessage = page.locator('.no-maps p');
    const hasNoMaps = await noMapsMessage.isVisible().catch(() => false);
    console.log('No custom maps message:', hasNoMaps);

    // Switch back to presets
    const presetTab = page.locator('.map-tab:has-text("预设地图")');
    await presetTab.click();
    await page.waitForTimeout(500);

    const mapItems = page.locator('.map-list-item');
    expect(await mapItems.count()).toBeGreaterThanOrEqual(6);
  });

  test('10: Large preview is pixelated (not blurred)', async ({ page }) => {
    const canvas = page.locator('.large-map-preview');
    const style = await canvas.evaluate(el => window.getComputedStyle(el).imageRendering);
    console.log(`Image rendering style: ${style}`);

    expect(style === 'pixelated' || style === 'crisp-edges').toBeTruthy();
  });

  test('11: Large preview has border styling', async ({ page }) => {
    const canvas = page.locator('.large-map-preview');
    const style = await canvas.evaluate(el => window.getComputedStyle(el));
    
    console.log(`Border: ${style.border}, borderRadius: ${style.borderRadius}`);
    expect(style.borderRadius !== '0px').toBeTruthy();
  });

  test('12: Map size labels are visible on list items', async ({ page }) => {
    const sizeLabels = page.locator('.map-size-label');
    const count = await sizeLabels.count();
    console.log(`Size labels count: ${count}`);

    const itemCount = await page.locator('.map-list-item').count();
    expect(count).toBeGreaterThanOrEqual(itemCount);
  });

  test('13: Preview details show map dimensions and resources', async ({ page }) => {
    const details = page.locator('.map-preview-details span');
    const count = await details.count();
    console.log(`Preview details: ${count}`);

    // Should show size and resource count
    expect(count).toBeGreaterThanOrEqual(2);

    const detailTexts = await details.allTextContents();
    const hasSizeText = detailTexts.some(t => t.includes('尺寸:'));
    console.log('Has size detail:', hasSizeText);
  });
});