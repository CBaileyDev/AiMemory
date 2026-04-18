/**
 * Playwright configuration — Phase 12 viewer test suite.
 *
 * The suite targets the dev worker (port 37780) seeded from
 * scripts/seed-dev-db.js. Global setup starts the worker; global
 * teardown stops it. Tests run against Chromium only — Firefox and
 * WebKit add no signal for an app bundled by esbuild since every
 * engine uses the same JS runtime here.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.CLAUDE_MEM_VIEWER_TEST_PORT ?? '37781';

export default defineConfig({
  testDir: './tests/viewer',
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,     // single dev worker; serialize specs
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 }
  },
  globalSetup: './tests/viewer/global-setup.ts',
  globalTeardown: './tests/viewer/global-teardown.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
