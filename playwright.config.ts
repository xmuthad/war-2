import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Game shares a single dev server; using 1 worker keeps state isolation simple.
  // CI uses 1 to avoid port contention; local can override via PW_WORKERS env var.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,
  // Per-test timeout (ms). Game scenarios may need long waits for AI / production.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['line', { printSuitesFirst: true }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});