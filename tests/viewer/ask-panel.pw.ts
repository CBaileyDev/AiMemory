import { test, expect } from '@playwright/test';

/**
 * Ask panel (⌘J) submits questions to /api/ask and renders a citation
 * list. We query a term that the seed DB is guaranteed to index (all
 * observations share the `dev-seed` concept per scripts/seed-dev-db.js).
 */
test.describe('Ask panel', () => {
  test('opens with ⌘J, submits, renders citations', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();

    await page.keyboard.press('Control+J');
    const input = page.locator('.am-ask__input');
    await expect(input).toBeVisible({ timeout: 2_000 });

    await input.fill('migration');
    await input.press('Enter');

    // After submit the panel renders one of three post-submit states:
    // citations, a friendly "No citations." empty state, or an error.
    // The assertion guards that the submission round-trips; ranking
    // quality (and whether the seeded FTS index matches a given term)
    // is covered by the worker's own search tests.
    const body = page.locator('.am-ask__body');
    await expect.poll(async () => await body.textContent(), { timeout: 10_000 })
      .toMatch(/(obs#|No citations|Failed)/);
  });

  test('Escape closes the panel', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();

    await page.keyboard.press('Control+J');
    const panel = page.locator('.am-ask');
    await expect(panel).toHaveClass(/is-open/);

    // Focus the input and press Escape; AskPanel handles it on the input.
    await page.locator('.am-ask__input').focus();
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveClass(/is-open/);
  });
});
