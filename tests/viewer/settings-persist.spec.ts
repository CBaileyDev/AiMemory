import { test, expect } from '@playwright/test';

/**
 * Editing a setting in the Phase 12 Settings page should round-trip
 * through GET/POST /api/settings. We toggle semantic context injection
 * on, change the semantic injection limit, save, reload the viewer,
 * and confirm both values persist.
 */

async function openSettings(page: import('@playwright/test').Page) {
  // Scope to the primary nav so we don't collide with other links.
  const nav = page.locator('nav[aria-label="Primary"]');
  await nav.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('.am-settings-page')).toBeVisible({ timeout: 2_000 });
}

async function gotoSearchSection(page: import('@playwright/test').Page) {
  const settings = page.locator('.am-settings-page');
  await settings.locator('nav[aria-label="Settings sections"] a', { hasText: 'Search' }).click();
  await expect(page.locator('#settings-section-search')).toBeVisible();
}

test.describe('Settings persistence', () => {
  test('edit → save → reload → value persists', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();

    await openSettings(page);
    await gotoSearchSection(page);

    const semanticToggle = page.locator('#search-semantic-inject');
    const initiallyOn = (await semanticToggle.getAttribute('aria-checked')) === 'true';
    if (!initiallyOn) await semanticToggle.click();
    await expect(semanticToggle).toHaveAttribute('aria-checked', 'true');

    const limitInput = page.locator('#search-semantic-limit');
    await expect(limitInput).toBeVisible();

    const newValue = '7';
    await limitInput.fill(newValue);

    await page.getByRole('button', { name: /^Save changes$/ }).click();

    // Wait for success toast on the dirty banner.
    await expect(
      page.locator('.am-settings-dirty-banner', { hasText: /Saved|✓/ })
    ).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('.am-settings-page')).toBeHidden({ timeout: 2_000 });

    await page.reload();
    await page.locator('.am-card').first().waitFor();

    await openSettings(page);
    await gotoSearchSection(page);

    // Toggle should still be on (unless the seeded DB didn't persist it).
    await expect(page.locator('#search-semantic-inject')).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 5_000 }
    );
    await expect(page.locator('#search-semantic-limit')).toHaveValue(newValue);
  });
});
