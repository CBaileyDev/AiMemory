import { test, expect } from '@playwright/test';

/**
 * Filter state roundtrips through the URL. We exercise two paths:
 *
 * 1. Typing into the header search box causes the reducer to write the
 *    value into the page URL (as `?q=…` after the pathname+search or
 *    on the route fragment hash).
 * 2. Navigating directly to a URL with a pre-baked `?q=` or a
 *    `#sources?q=` hash causes the search input to hydrate with that
 *    value on mount (the canonical roundtrip the reducer is designed
 *    for).
 */

const SEARCH_VALUE = 'claude';

test.describe('URL filter roundtrip', () => {
  test('typing updates URL', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();

    await page.locator('.am-search input[type="search"]').fill(SEARCH_VALUE);

    await page.waitForFunction(
      (val) => {
        const href = window.location.href;
        return href.includes(`q=${encodeURIComponent(val)}`) || href.includes(`q=${val}`);
      },
      SEARCH_VALUE,
      { timeout: 5_000 }
    );
    expect(page.url()).toMatch(new RegExp(`q=${SEARCH_VALUE}`));
  });

  test('hydrates search state from hash on load', async ({ page }) => {
    await page.goto(`/#sources?q=${SEARCH_VALUE}`);
    // The filter state read happens on mount; input should be primed.
    await expect(page.locator('.am-search input[type="search"]')).toHaveValue(SEARCH_VALUE, {
      timeout: 5_000
    });
  });
});
