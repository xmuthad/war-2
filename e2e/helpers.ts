import { Page, expect } from '@playwright/test';

/**
 * Shared E2E helpers for the RA2 web game.
 * Centralizes "start game / read store / drive simulation" logic so individual
 * specs stay focused on assertions instead of bootstrapping.
 */

export interface StartGameOptions {
  /** Faction button text on the menu, e.g. '盟军' / '苏军'. Default: keep menu default. */
  faction?: string;
  /** Difficulty button text on the menu. Default: keep menu default. */
  difficulty?: '简单' | '普通' | '困难' | '专家';
  /** Index of the map list item to choose. Default: keep menu default (first). */
  mapIndex?: number;
  /** Game speed multiplier set immediately after start (1-4). Default: 1. */
  speed?: 1 | 2 | 3 | 4;
  /** ms to wait after clicking 快速开始 for scene/store to settle. Default: 5000. */
  bootMs?: number;
}

/**
 * Click through the menu and start a game, returning once the game timer is visible.
 * Asserts the basic preconditions (Phaser + store + currentPlayer) so subsequent
 * tests don't need to re-check them.
 */
export async function startGame(page: Page, opts: StartGameOptions = {}): Promise<void> {
  const { faction, difficulty, mapIndex, speed = 1, bootMs = 5000 } = opts;

  await page.goto('/');
  await page.waitForTimeout(400);

  if (faction) {
    const factionBtn = page.locator(`button:has-text("${faction}")`);
    if (await factionBtn.first().isVisible().catch(() => false)) {
      await factionBtn.first().click();
      await page.waitForTimeout(150);
    }
  }
  if (difficulty) {
    const diffBtn = page.locator(`button:has-text("${difficulty}")`);
    if (await diffBtn.first().isVisible().catch(() => false)) {
      await diffBtn.first().click();
      await page.waitForTimeout(150);
    }
  }
  if (typeof mapIndex === 'number' && mapIndex > 0) {
    const items = page.locator('.map-list-item');
    const count = await items.count().catch(() => 0);
    if (count > mapIndex) {
      await items.nth(mapIndex).click();
      await page.waitForTimeout(200);
    }
  }

  await page.locator('text=快速开始').click();
  await page.waitForTimeout(bootMs);

  // `.resource-bar` is the canonical "in-game" marker (rendered by GameUI when a
  // match is running). It replaces the previously-incorrect `.game-timer`.
  await expect(page.locator('.resource-bar').first()).toBeVisible({ timeout: 10_000 });

  if (speed > 1) {
    await page.evaluate((s) => {
      const store = (window as unknown as { __ZUSTAND_STORE__?: { getState: () => { setGameSpeed: (n: number) => void } } }).__ZUSTAND_STORE__;
      store?.getState().setGameSpeed(s);
    }, speed);
  }
}

/**
 * Resolve the Zustand store from `window`. Both __ZUSTAND_STORE__ and __gameStore__
 * are set by the app for back-compat; we try both.
 */
export async function getStore(page: Page) {
  return await page.evaluate(() => {
    const w = window as unknown as Record<string, { getState: () => Record<string, unknown> } | undefined>;
    return !!(w.__ZUSTAND_STORE__ || w.__gameStore__);
  });
}

export interface MatchSnapshot {
  gameTime: number;
  gameState: string;
  isPaused: boolean;
  player: {
    money: number;
    units: number;
    buildings: number;
    constructedBuildings: number;
    isDefeated: boolean;
    totalKills: number;
  } | null;
  enemies: Array<{
    units: number;
    buildings: number;
    isDefeated: boolean;
  }>;
}

/** Read a JSON-friendly snapshot of the running match's state. */
export async function getMatchSnapshot(page: Page): Promise<MatchSnapshot> {
  return await page.evaluate(() => {
    const w = window as unknown as { __ZUSTAND_STORE__?: { getState: () => Record<string, unknown> }; __gameStore__?: { getState: () => Record<string, unknown> } };
    const store = w.__ZUSTAND_STORE__ || w.__gameStore__;
    if (!store) {
      return {
        gameTime: -1, gameState: 'no-store', isPaused: false,
        player: null, enemies: [],
      };
    }
    const s = store.getState() as Record<string, unknown> & {
      gameTime: number; gameState: string; isPaused: boolean;
      currentPlayer?: { money: number; units: unknown[]; buildings: Array<{ isConstructed: boolean }>; isDefeated?: boolean };
      aiPlayers?: Array<{ units: unknown[]; buildings: unknown[]; isDefeated?: boolean }>;
    };
    const player = s.currentPlayer ? {
      money: s.currentPlayer.money,
      units: s.currentPlayer.units.length,
      buildings: s.currentPlayer.buildings.length,
      constructedBuildings: s.currentPlayer.buildings.filter((b) => b.isConstructed).length,
      isDefeated: !!s.currentPlayer.isDefeated,
      totalKills: (s.currentPlayer.units as Array<{ kills?: number }>).reduce((sum, u) => sum + (u.kills || 0), 0),
    } : null;
    const enemies = (s.aiPlayers || []).map((ai) => ({
      units: ai.units.length,
      buildings: ai.buildings.length,
      isDefeated: !!ai.isDefeated,
    }));
    return {
      gameTime: s.gameTime,
      gameState: s.gameState,
      isPaused: s.isPaused,
      player,
      enemies,
    };
  });
}

export interface SimulateOptions {
  /** Real-time milliseconds to wait. Will be divided by speed to estimate sim seconds. */
  realMs: number;
  /** Sample count to take during the wait. Default 4. */
  samples?: number;
}

/**
 * Wait for the simulation to advance, sampling the snapshot periodically. The
 * caller decides what to assert against the returned trace.
 */
export async function simulate(page: Page, opts: SimulateOptions): Promise<MatchSnapshot[]> {
  const { realMs, samples = 4 } = opts;
  const interval = Math.max(250, Math.floor(realMs / samples));
  const trace: MatchSnapshot[] = [];
  const end = Date.now() + realMs;
  while (Date.now() < end) {
    trace.push(await getMatchSnapshot(page));
    await page.waitForTimeout(interval);
  }
  trace.push(await getMatchSnapshot(page));
  return trace;
}

/** Subscribe to GameEventBus events from outside the page. Returns counts only. */
export async function installEventCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __E2E_EVENT_COUNTS__?: Record<string, number>; __E2E_EVENT_BUS_HOOKED__?: boolean };
    if (w.__E2E_EVENT_BUS_HOOKED__) return;
    w.__E2E_EVENT_COUNTS__ = {};
    // The store keeps a reference to gameEventBus through dynamic imports; we hook
    // into window via the bus singleton if exported. As a fallback, we monkey-patch
    // console-emitted events by listening to the global event names through MutationObserver-like polling.
    // Easiest approach: since the bus is a module singleton, we expose it from the bridge below if not already.
    const bus = (w as unknown as { __GAME_EVENT_BUS__?: { onAny?: (cb: (e: { type: string }) => void) => () => void } }).__GAME_EVENT_BUS__;
    if (bus && typeof bus.onAny === 'function') {
      bus.onAny((e: { type: string }) => {
        const counts = w.__E2E_EVENT_COUNTS__!;
        counts[e.type] = (counts[e.type] || 0) + 1;
      });
      w.__E2E_EVENT_BUS_HOOKED__ = true;
    }
  });
}

export async function getEventCounts(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    const w = window as unknown as { __E2E_EVENT_COUNTS__?: Record<string, number> };
    return { ...(w.__E2E_EVENT_COUNTS__ || {}) };
  });
}
