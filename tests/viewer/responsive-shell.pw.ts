import { test, expect, type Page } from '@playwright/test';

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const app = document.querySelector<HTMLElement>('.app');
    const main = document.querySelector<HTMLElement>('.main');
    return {
      viewport: window.innerWidth,
      documentWidth: doc.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      appWidth: app?.scrollWidth ?? 0,
      mainClientWidth: main?.clientWidth ?? 0,
      mainScrollWidth: main?.scrollWidth ?? 0,
    };
  });

  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.appWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.mainScrollWidth).toBeLessThanOrEqual(overflow.mainClientWidth + 1);
}

test.describe('Responsive shell', () => {
  test('mobile viewport keeps navigation visible, reports the actual port, and avoids horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?type=learned');
    await expect(page.locator('.app')).toBeVisible();

    await expect(page.locator('.rail .nav-item', { hasText: 'Feed' }).first()).toBeVisible();
    const port = new URL(page.url()).port;
    await expect(page.locator('.statusbar').getByText(`:${port}`)).toBeVisible();
    await expectNoDocumentOverflow(page);

    await page.locator('.rail .nav-item', { hasText: 'Settings' }).first().click();
    await expect(page.locator('.am-settings-page')).toBeVisible();
    await expectNoDocumentOverflow(page);

    await page.locator('.rail .nav-item', { hasText: 'Graph' }).first().click();
    await expect(page.locator('.graph-stage')).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
});
