import { test, expect } from '@playwright/test';

test.describe('Combat System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('01: attackUnit sets attacker state to ATTACKING', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const playerUnit = state.currentPlayer?.units?.[0];
      const aiUnit = state.aiPlayers?.[0]?.units?.[0];
      if (!playerUnit || !aiUnit) return { error: 'Missing units', playerUnits: state.currentPlayer?.units?.length, aiUnits: state.aiPlayers?.[0]?.units?.length };

      store.getState().attackUnit(playerUnit.id, aiUnit.id);

      const updatedState = store.getState();
      const attacker = updatedState.currentPlayer?.units?.find((u: any) => u.id === playerUnit.id);

      return {
        attackerState: attacker?.state,
        attackerTarget: attacker?.target,
        attackerWaypoints: attacker?.waypoints?.length,
      };
    });

    console.log('Attack result:', result);
    expect(result.attackerState).toBe('attacking');
    expect(result.attackerTarget).toBeDefined();
  });

  test('02: damageUnit reduces health', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const unit = state.currentPlayer?.units?.[0];
      if (!unit) return { error: 'No unit' };

      const healthBefore = unit.health;
      const armor = unit.armor || 0;
      // Armor reduction formula: actualDamage = max(1, damage * (1 - armor/(armor+100)))
      const armorReduction = 1 - armor / (armor + 100);
      const expectedDamage = Math.max(1, Math.round(50 * armorReduction * 100) / 100);

      store.getState().damageUnit(unit.id, 50);

      const updatedState = store.getState();
      const updatedUnit = updatedState.currentPlayer?.units?.find((u: any) => u.id === unit.id);

      return {
        healthBefore,
        healthAfter: updatedUnit?.health,
        armor,
        expectedDamage,
        actualDamage: Math.round((healthBefore - (updatedUnit?.health || 0)) * 100) / 100,
        damageDealt: healthBefore > (updatedUnit?.health || 0),
      };
    });

    console.log('Damage result:', result);
    if (!('error' in result)) {
      expect(result.damageDealt).toBe(true);
      expect(result.actualDamage).toBeGreaterThan(0);
    }
  });

  test('03: damageUnit minimum damage is 1', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const unit = state.currentPlayer?.units?.[0];
      if (!unit) return { error: 'No unit' };

      const healthBefore = unit.health;
      // Even with 0.1 damage, minimum should be 1
      store.getState().damageUnit(unit.id, 0.1);

      const updatedState = store.getState();
      const updatedUnit = updatedState.currentPlayer?.units?.find((u: any) => u.id === unit.id);

      return {
        healthBefore,
        healthAfter: updatedUnit?.health,
        actualDamage: healthBefore - (updatedUnit?.health || 0),
      };
    });

    console.log('Min damage result:', result);
    if (!('error' in result)) {
      expect(result.actualDamage).toBeGreaterThanOrEqual(1);
    }
  });

  test('04: destroyUnit removes unit from player', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const unit = state.currentPlayer?.units?.[0];
      if (!unit) return { error: 'No unit' };

      const unitCountBefore = state.currentPlayer.units.length;
      const unitId = unit.id;

      store.getState().destroyUnit(unitId);

      const updatedState = store.getState();
      const unitExists = updatedState.currentPlayer?.units?.some((u: any) => u.id === unitId);

      return {
        unitCountBefore,
        unitCountAfter: updatedState.currentPlayer?.units?.length,
        unitExists,
      };
    });

    console.log('Destroy unit result:', result);
    expect(result.unitExists).toBe(false);
    expect(result.unitCountAfter).toBe(result.unitCountBefore - 1);
  });

  test('05: destroyUnit removes from selectedUnits', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const unit = state.currentPlayer?.units?.[0];
      if (!unit) return { error: 'No unit' };

      // Select the unit first
      store.getState().selectUnits([unit]);
      const selectedBefore = store.getState().selectedUnits.length;

      // Destroy it
      store.getState().destroyUnit(unit.id);
      const selectedAfter = store.getState().selectedUnits.length;

      return { selectedBefore, selectedAfter };
    });

    console.log('Selected removal result:', result);
    expect(result.selectedBefore).toBe(1);
    expect(result.selectedAfter).toBe(0);
  });

  test('06: damageBuilding has no armor reduction', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const building = state.currentPlayer?.buildings?.[0];
      if (!building) return { error: 'No building' };

      const healthBefore = building.health;
      store.getState().damageBuilding(building.id, 30);

      const updatedState = store.getState();
      const updatedBuilding = updatedState.currentPlayer?.buildings?.find((b: any) => b.id === building.id);

      return {
        healthBefore,
        healthAfter: updatedBuilding?.health,
        actualDamage: healthBefore - (updatedBuilding?.health || 0),
      };
    });

    console.log('Building damage result:', result);
    if (!('error' in result)) {
      // Buildings have no armor reduction - damage should be exact
      expect(result.actualDamage).toBe(30);
    }
  });

  test('07: destroyBuilding removes building', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      // Use AI building to avoid triggering defeat
      const building = state.aiPlayers?.[0]?.buildings?.[0];
      if (!building) return { error: 'No AI building' };

      const buildingCountBefore = state.aiPlayers[0].buildings.length;
      const buildingId = building.id;

      store.getState().destroyBuilding(buildingId);

      const updatedState = store.getState();
      const buildingExists = updatedState.aiPlayers?.[0]?.buildings?.some((b: any) => b.id === buildingId);

      return {
        buildingCountBefore,
        buildingCountAfter: updatedState.aiPlayers?.[0]?.buildings?.length,
        buildingExists,
      };
    });

    console.log('Destroy building result:', result);
    if (!('error' in result)) {
      expect(result.buildingExists).toBe(false);
      expect(result.buildingCountAfter).toBe(result.buildingCountBefore - 1);
    }
  });

  test('08: damageUnit kills unit when health reaches 0', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const unit = state.currentPlayer?.units?.[0];
      if (!unit) return { error: 'No unit' };

      const unitId = unit.id;
      // Apply damage equal to health to kill it
      store.getState().damageUnit(unit.id, unit.health + 100);

      const updatedState = store.getState();
      const unitExists = updatedState.currentPlayer?.units?.some((u: any) => u.id === unitId);

      return { unitExists, healthBefore: unit.health };
    });

    console.log('Kill unit result:', result);
    expect(result.unitExists).toBe(false);
  });

  test('09: damageBuilding destroys building when health reaches 0', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      // Use AI building to avoid triggering defeat
      const building = state.aiPlayers?.[0]?.buildings?.[0];
      if (!building) return { error: 'No AI building' };

      const buildingId = building.id;
      store.getState().damageBuilding(building.id, building.health + 100);

      const updatedState = store.getState();
      const buildingExists = updatedState.aiPlayers?.[0]?.buildings?.some((b: any) => b.id === buildingId);

      return { buildingExists, healthBefore: building.health };
    });

    console.log('Kill building result:', result);
    if (!('error' in result)) {
      expect(result.buildingExists).toBe(false);
    }
  });

  test('10: sellBuilding returns money and removes building', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const _state = store.getState();

      // Build a power plant first so we have a non-command building to sell
      const positions = [
        { x: 5 * 32, y: 5 * 32 },
        { x: 10 * 32, y: 10 * 32 },
        { x: 20 * 32, y: 20 * 32 },
      ];

      let powerBuilding: any = null;
      for (const pos of positions) {
        store.getState().buildStructure('power', pos);
        powerBuilding = store.getState().currentPlayer?.buildings?.find((b: any) => b.type === 'power');
        if (powerBuilding) break;
      }

      if (!powerBuilding) return { error: 'Could not build power plant' };

      const moneyBefore = store.getState().currentPlayer.money;
      const healthRatio = powerBuilding.health / powerBuilding.maxHealth;
      const expectedSellValue = Math.floor(powerBuilding.data.cost * 0.5 * healthRatio);

      store.getState().sellBuilding(powerBuilding.id);

      const updatedState = store.getState();
      const moneyAfter = updatedState.currentPlayer.money;
      const buildingExists = updatedState.currentPlayer?.buildings?.some((b: any) => b.id === powerBuilding.id);

      return {
        moneyBefore,
        moneyAfter,
        moneyGained: moneyAfter - moneyBefore,
        expectedSellValue,
        buildingExists,
        buildingCost: powerBuilding.data.cost,
        healthRatio,
      };
    });

    console.log('Sell building result:', result);
    if (!('error' in result)) {
      expect(result.buildingExists).toBe(false);
      expect(result.moneyGained).toBe(result.expectedSellValue);
    }
  });

  test('11: repairBuilding fully restores health', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();

      // Use AI building to avoid issues
      const building = state.aiPlayers?.[0]?.buildings?.[0];
      if (!building) return { error: 'No AI building' };

      // Damage the building first
      store.getState().damageBuilding(building.id, 50);
      const damagedBuilding = store.getState().aiPlayers?.[0]?.buildings?.find((b: any) => b.id === building.id);
      if (!damagedBuilding) return { error: 'Building destroyed' };

      const _healthBeforeRepair = damagedBuilding.health;

      // Repair it (need money for player, but AI building repair may work differently)
      // Use player building instead
      const playerBuilding = store.getState().currentPlayer?.buildings?.[0];
      if (!playerBuilding) return { error: 'No player building' };

      store.getState().damageBuilding(playerBuilding.id, 50);
      const damagedPlayerBuilding = store.getState().currentPlayer?.buildings?.find((b: any) => b.id === playerBuilding.id);
      if (!damagedPlayerBuilding) return { error: 'Player building destroyed' };

      const moneyBefore = store.getState().currentPlayer.money;
      store.getState().repairBuilding(playerBuilding.id);

      const repairedBuilding = store.getState().currentPlayer?.buildings?.find((b: any) => b.id === playerBuilding.id);
      const moneyAfter = store.getState().currentPlayer.money;

      return {
        healthBeforeRepair: damagedPlayerBuilding.health,
        healthAfterRepair: repairedBuilding?.health,
        maxHealth: repairedBuilding?.maxHealth,
        moneySpent: moneyBefore - moneyAfter,
        fullyRepaired: repairedBuilding?.health === repairedBuilding?.maxHealth,
      };
    });

    console.log('Repair building result:', result);
    if (!('error' in result)) {
      expect(result.fullyRepaired).toBe(true);
      expect(result.moneySpent).toBeGreaterThan(0);
    }
  });

  test('12: attackUnit can target buildings', async ({ page }) => {
    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();
      const playerUnit = state.currentPlayer?.units?.find((u: any) => u.data.attack > 0);
      const aiBuilding = state.aiPlayers?.[0]?.buildings?.[0];
      if (!playerUnit || !aiBuilding) return { error: 'Missing unit or building' };

      store.getState().attackUnit(playerUnit.id, aiBuilding.id);

      const updatedState = store.getState();
      const attacker = updatedState.currentPlayer?.units?.find((u: any) => u.id === playerUnit.id);

      return {
        attackerState: attacker?.state,
        attackerTarget: attacker?.target,
      };
    });

    console.log('Attack building result:', result);
    if (!('error' in result)) {
      expect(result.attackerState).toBe('attacking');
      expect(result.attackerTarget).toBeDefined();
    }
  });

  test('13: No JS errors during combat operations', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.locator('text=快速开始').click();
    await page.waitForTimeout(6000);

    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (!store) return;
      const state = store.getState();
      const playerUnit = state.currentPlayer?.units?.[0];
      const aiUnit = state.aiPlayers?.[0]?.units?.[0];
      const aiBuilding = state.aiPlayers?.[0]?.buildings?.[0];

      if (playerUnit) {
        if (aiUnit) store.getState().attackUnit(playerUnit.id, aiUnit.id);
        if (aiBuilding) store.getState().attackUnit(playerUnit.id, aiBuilding.id);
        store.getState().damageUnit(playerUnit.id, 10);
      }
      if (aiUnit) {
        store.getState().damageUnit(aiUnit.id, 20);
      }
      if (aiBuilding) {
        store.getState().damageBuilding(aiBuilding.id, 30);
      }
    });

    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') || e.includes('Cannot read') || e.includes('is not a function')
    );
    expect(criticalErrors.length).toBe(0);
  });
});
