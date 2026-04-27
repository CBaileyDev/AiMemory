import { test, expect } from '@playwright/test';

test.describe('Settings and graph polish', () => {
  test('settings presents live worker and database data from the current server', async ({ page }) => {
    await page.goto('/?type=learned#settings');

    const health = await page.evaluate(() => fetch('/api/dashboard/health').then((res) => res.json()));
    const stats = await page.evaluate(() => fetch('/api/stats').then((res) => res.json()).catch(() => null));
    const expectedPort = new URL(page.url()).port;
    const expectedDbPath = String(health.database.path);
    const expectedObservations = stats?.database?.observations ?? 500;

    const healthGrid = page.locator('.am-settings-health-grid');
    await expect(healthGrid).toBeVisible();
    await expect(healthGrid.getByText('Active worker port')).toBeVisible();
    await expect(healthGrid.getByText(`:${expectedPort}`)).toBeVisible();
    await expect(healthGrid.getByText(expectedDbPath)).toBeVisible();
    await expect(healthGrid.getByText(`${expectedObservations.toLocaleString('en-US')} observations`)).toBeVisible();
  });

  test('graph can select an individual memory and jump back to feed', async ({ page }) => {
    await page.goto('/?type=learned#graph');
    await expect(page.locator('.graph-stage')).toBeVisible();

    await page.locator('.graph-zoomstrip').getByText('Memories').click();

    const firstMemoryNode = page.locator('[data-node-kind="leaf"]').first();
    await expect(firstMemoryNode).toBeVisible();
    await firstMemoryNode.click();

    const inspector = page.locator('.graph-inspector');
    await expect(inspector.getByText('SELECTED MEMORY')).toBeVisible();
    await expect(inspector.getByText(/Observation #|Summary #|Prompt #/)).toBeVisible();

    await inspector.getByRole('button', { name: 'Open in Feed' }).click();
    await expect(page.locator('.graph-stage')).toBeHidden();
    await expect(page.locator('.mem').first()).toBeVisible();
  });
});
