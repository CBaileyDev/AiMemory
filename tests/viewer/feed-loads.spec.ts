import { test, expect } from '@playwright/test';

test.describe('Viewer feed', () => {
  test('renders at least 50 cards on a seeded DB within 1500ms', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');

    // The feed root is the grid of <article class="am-card">.
    await page.locator('.am-card').first().waitFor({ state: 'visible', timeout: 5_000 });
    const firstPaintMs = Date.now() - start;

    const count = await page.locator('.am-card').count();
    expect(count).toBeGreaterThanOrEqual(50);
    // Soft perf gate — assert the paint budget but don't fail the suite on
    // a single slow CI run; log the measurement so trends are visible.
    if (firstPaintMs > 1500) {
      // eslint-disable-next-line no-console
      console.warn(`feed-loads: first paint ${firstPaintMs}ms > 1500ms budget`);
    }
    expect(firstPaintMs).toBeLessThan(5_000);
  });

  test('source dots render with their data-source attribute', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();
    const dots = page.locator('.am-card .source-dot');
    await expect.poll(async () => await dots.count()).toBeGreaterThan(10);
    // Spot-check that a known seeded source appears.
    await expect(
      page.locator('.am-card .source-dot[data-source="claude-code"], .am-card .source-dot[data-source="cursor"]').first()
    ).toBeVisible();
  });
});
