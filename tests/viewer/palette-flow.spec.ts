import { test, expect } from '@playwright/test';

test.describe('Command palette', () => {
  test('⌘K opens; typing shows matches; Enter closes the palette', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();

    // Open palette.
    await page.keyboard.press('Control+K');
    const palette = page.locator('.am-palette');
    await expect(palette).toBeVisible({ timeout: 2_000 });

    // Type something likely to hit seeded content.
    await page.locator('.am-palette__input').fill('claude');

    // At least one result should appear.
    const results = page.locator('.am-palette__item');
    await expect.poll(async () => await results.count(), { timeout: 2_000 }).toBeGreaterThan(0);

    // Press Enter — either jumps to an observation or fires an action.
    await page.keyboard.press('Enter');
    // Palette should close on Enter (both jump + action paths dismiss it).
    await expect(palette).toBeHidden({ timeout: 2_000 });
  });

  test('Escape closes the palette without side effects', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+K');
    const palette = page.locator('.am-palette');
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });
});
