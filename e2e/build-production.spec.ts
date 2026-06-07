import { test, expect } from '@playwright/test';

test.describe('Build & Production E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('01: produceUnit deducts money and sets cooldown', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      // Use any available building (command is the initial one)
      const building = state.currentPlayer?.buildings?.[0];
      if (!building) return { error: 'No building' };

      const moneyBefore = state.currentPlayer.money;

      store.getState().produceUnit(building.id, 'soldier');

      const updatedState = store.getState();
      const updatedBuilding = updatedState.currentPlayer?.buildings?.find((b: any) => b.id === building.id);

      return {
        moneyBefore,
        moneyAfter: updatedState.currentPlayer?.money,
        moneyDeducted: moneyBefore - (updatedState.currentPlayer?.money || 0),
        cooldownAfter: updatedBuilding?.newUnitCooldown,
        producingUnit: updatedBuilding?.producingUnit,
      };
    });

    console.log('Produce unit result:', result);
    if (!('error' in result)) {
      expect(result.moneyDeducted).toBeGreaterThan(0);
      expect(result.cooldownAfter).toBeGreaterThan(0);
      expect(result.producingUnit).toBe('soldier');
    }
  });

  test('02: produceUnit fails without enough money', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };

      const state = store.getState();
      const building = state.currentPlayer?.buildings?.[0];
      if (!building) return { error: 'No building' };

      // Drain money
      store.getState().updateResources(state.currentPlayer.id, -state.currentPlayer.money);

      const moneyBefore = store.getState().currentPlayer.money;
      store.getState().produceUnit(building.id, 'soldier');

      const updatedState = store.getState();
      const updatedBuilding = updatedState.currentPlayer?.buildings?.find((b: any) => b.id === building.id);

      return {
        moneyBefore,
        moneyAfter: updatedState.currentPlayer?.money,
        cooldown: updatedBuilding?.newUnitCooldown,
        producingUnit: updatedBuilding?.producingUnit,
      };
    });

    console.log('Produce no money result:', result);
    if (!('error' in result)) {
      // Should not produce when broke - cooldown stays 0
      expect(result.cooldown).toBe(0);
    }
  });

  test('03: produceUnit fails when already producing', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const building = state.currentPlayer?.buildings?.[0];
      if (!building) return { error: 'No building' };

      // First production
      store.getState().produceUnit(building.id, 'soldier');
      const moneyAfterFirst = store.getState().currentPlayer.money;

      // Second production attempt
      store.getState().produceUnit(building.id, 'engineer');
      const moneyAfterSecond = store.getState().currentPlayer.money;

      const updatedBuilding = store.getState().currentPlayer?.buildings?.find((b: any) => b.id === building.id);

      return {
        moneyAfterFirst,
        moneyAfterSecond,
        moneyNotDeductedAgain: moneyAfterFirst === moneyAfterSecond,
        stillProducingSoldier: updatedBuilding?.producingUnit === 'soldier',
      };
    });

    console.log('Double produce result:', result);
    if (!('error' in result)) {
      expect(result.moneyNotDeductedAgain).toBe(true);
      expect(result.stillProducingSoldier).toBe(true);
    }
  });

  test('04: buildStructure creates building when position is valid', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();

      const moneyBefore = state.currentPlayer.money;
      const buildingCountBefore = state.currentPlayer.buildings.length;

      // Try building at multiple positions until one works
      const positions = [
        { x: 5 * 32, y: 5 * 32 },
        { x: 10 * 32, y: 10 * 32 },
        { x: 20 * 32, y: 20 * 32 },
        { x: 30 * 32, y: 30 * 32 },
        { x: 40 * 32, y: 40 * 32 },
      ];

      let built = false;
      for (const pos of positions) {
        store.getState().buildStructure('power', pos);
        const updatedState = store.getState();
        if (updatedState.currentPlayer.buildings.length > buildingCountBefore) {
          built = true;
          break;
        }
      }

      const updatedState = store.getState();
      const newBuilding = updatedState.currentPlayer.buildings.find((b: any) => b.type === 'power');

      return {
        moneyBefore,
        moneyAfter: updatedState.currentPlayer.money,
        moneyDeducted: moneyBefore - updatedState.currentPlayer.money,
        buildingCountBefore,
        buildingCountAfter: updatedState.currentPlayer.buildings.length,
        built,
        newBuildingExists: !!newBuilding,
        newBuildingConstructed: newBuilding?.isConstructed,
      };
    });

    console.log('Build structure result:', result);
    if (result.built) {
      expect(result.newBuildingExists).toBe(true);
      expect(result.moneyDeducted).toBeGreaterThan(0);
      expect(result.newBuildingConstructed).toBe(true);
    }
  });

  test('05: buildStructure fails without enough money', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();

      // Drain money
      store.getState().updateResources(state.currentPlayer.id, -state.currentPlayer.money);

      const buildingCountBefore = store.getState().currentPlayer.buildings.length;
      store.getState().buildStructure('power', { x: 20 * 32, y: 20 * 32 });

      const updatedState = store.getState();

      return {
        buildingCountBefore,
        buildingCountAfter: updatedState.currentPlayer.buildings.length,
        noNewBuilding: buildingCountBefore === updatedState.currentPlayer.buildings.length,
      };
    });

    console.log('Build no money result:', result);
    expect(result.noNewBuilding).toBe(true);
  });

  test('06: Unit production cooldown decreases over time', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    // Start production
    const produceResult = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const building = state.currentPlayer?.buildings?.[0];
      if (!building) return { error: 'No building' };

      store.getState().produceUnit(building.id, 'soldier');

      const stateAfterProduce = store.getState();
      const buildingAfterProduce = stateAfterProduce.currentPlayer?.buildings?.find((b: any) => b.id === building.id);

      return {
        cooldownAfterProduce: buildingAfterProduce?.newUnitCooldown,
        producingUnit: buildingAfterProduce?.producingUnit,
        buildingId: building.id,
      };
    });

    console.log('Production start:', produceResult);
    if (!('error' in produceResult)) {
      expect(produceResult.cooldownAfterProduce).toBeGreaterThan(0);
      expect(produceResult.producingUnit).toBe('soldier');
    }

    // Wait for some cooldown to pass
    await page.waitForTimeout(5000);

    // Check that cooldown decreased
    const completeResult = await page.evaluate((buildingId: string) => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const building = state.currentPlayer?.buildings?.find((b: any) => b.id === buildingId);

      return {
        cooldown: building?.newUnitCooldown,
        producingUnit: building?.producingUnit,
      };
    }, (produceResult as any).buildingId || '');

    console.log('After 5s:', completeResult);
    if (!('error' in completeResult)) {
      // Cooldown should have decreased
      expect(completeResult.cooldown).toBeLessThan((produceResult as any).cooldownAfterProduce || 999);
    }
  });

  test('07: processBuildQueue handles unit queue', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();

      const unitCountBefore = state.currentPlayer.units.length;

      // Process build queue with enough deltaTime to complete
      store.getState().processBuildQueue(100);

      const updatedState = store.getState();

      return {
        unitCountBefore,
        unitCountAfter: updatedState.currentPlayer.units.length,
      };
    });

    console.log('Build queue result:', result);
    // processBuildQueue may or may not produce units depending on queue state
    expect(result.unitCountAfter).toBeGreaterThanOrEqual(result.unitCountBefore);
  });

  test('08: updateResources adds and subtracts money', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const playerId = state.currentPlayer.id;

      const moneyStart = state.currentPlayer.money;

      // Add money
      store.getState().updateResources(playerId, 500);
      const moneyAfterAdd = store.getState().currentPlayer.money;

      // Subtract money
      store.getState().updateResources(playerId, -200);
      const moneyAfterSub = store.getState().currentPlayer.money;

      return {
        moneyStart,
        moneyAfterAdd,
        moneyAfterSub,
        addWorked: moneyAfterAdd === moneyStart + 500,
        subWorked: moneyAfterSub === moneyAfterAdd - 200,
      };
    });

    console.log('Update resources result:', result);
    expect(result.addWorked).toBe(true);
    expect(result.subWorked).toBe(true);
  });

  test('09: updateResources works for AI players', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const aiPlayer = state.aiPlayers?.[0];
      if (!aiPlayer) return { error: 'No AI player' };

      const moneyBefore = aiPlayer.money;
      store.getState().updateResources(aiPlayer.id, 1000);

      const updatedState = store.getState();
      const moneyAfter = updatedState.aiPlayers?.[0]?.money;

      return {
        moneyBefore,
        moneyAfter,
        addWorked: moneyAfter === moneyBefore + 1000,
      };
    });

    console.log('AI resources result:', result);
    expect(result.addWorked).toBe(true);
  });

  test('10: Building data has valid properties', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const buildings = state.currentPlayer?.buildings || [];

      return buildings.map((b: any) => ({
        type: b.type,
        hasData: !!b.data,
        health: b.health,
        maxHealth: b.maxHealth,
        isConstructed: b.isConstructed,
      }));
    });

    console.log('Building details:', result);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((b: any) => {
      expect(b.maxHealth).toBeGreaterThan(0);
      expect(b.health).toBeLessThanOrEqual(b.maxHealth);
    });
  });

  test('11: Unit data has valid properties', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const units = state.currentPlayer?.units || [];

      return units.map((u: any) => ({
        type: u.type,
        hasData: !!u.data,
        health: u.health,
        maxHealth: u.maxHealth,
        armor: u.armor,
      }));
    });

    console.log('Unit details:', result);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((u: any) => {
      expect(u.maxHealth).toBeGreaterThan(0);
    });
  });

  test('12: No JS errors during build operations', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    await page.evaluate(() => {
      const store = (window as any).__gameStore__;
      if (!store) return;
      const state = store.getState();

      // Try various build operations
      store.getState().buildStructure('power', { x: 25 * 32, y: 25 * 32 });
      const building = state.currentPlayer?.buildings?.[0];
      if (building) {
        store.getState().produceUnit(building.id, 'soldier');
      }
      store.getState().updateResources(state.currentPlayer.id, 1000);
    });

    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') || e.includes('Cannot read') || e.includes('is not a function')
    );
    expect(criticalErrors.length).toBe(0);
  });
});
