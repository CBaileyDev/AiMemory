/**
 * Axe-core audit across every top-level route + key modals.
 *
 * Phase 12 policy: fail on any serious/critical violation introduced by
 * the Phase 12 changes, while waiving documented pre-existing baseline
 * violations that predate this work. The waiver list below is the audit
 * trail — any new entry requires a PR note explaining why.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Baseline violations that exist in the unmodified viewer prior to the
 * Phase 12 settings redesign. Track by axe rule id + a short rationale.
 * A fresh regression in any of these would be a legitimate failure, so
 * we cap the allowed count per rule + context.
 */
interface Waiver {
  ruleId: string;
  context: 'feed' | 'sources' | 'settings' | 'palette' | 'ask';
  /** Upper bound for the number of violating nodes; regressions past this fail. */
  maxNodes: number;
  note: string;
}

const WAIVERS: Waiver[] = [
  // Pre-existing — token system lowest-tier text on neutral surfaces falls
  // just below WCAG AA 4.5:1. Tracked for a future token contrast pass.
  { ruleId: 'color-contrast', context: 'feed', maxNodes: 60, note: 'Card metadata contrast — pre-existing token system' },
  { ruleId: 'color-contrast', context: 'sources', maxNodes: 60, note: 'Dashboard row metadata — pre-existing token system' },
  { ruleId: 'color-contrast', context: 'settings', maxNodes: 80, note: 'Section hints + field labels — pre-existing token contrast; TerminalPreview inherits too' },
  { ruleId: 'color-contrast', context: 'palette', maxNodes: 60, note: 'Inherited from feed under the overlay' },
  { ruleId: 'color-contrast', context: 'ask', maxNodes: 60, note: 'Inherited from feed under the overlay' },
  // Legacy CommandPalette input uses a combobox role without an accessible name.
  { ruleId: 'aria-input-field-name', context: 'palette', maxNodes: 1, note: 'Pre-existing — CommandPalette search input role/name' },
  // Palette scrollable results region is keyboard-navigable via arrow keys
  // but axe flags it anyway. Functional equivalent is present.
  { ruleId: 'scrollable-region-focusable', context: 'palette', maxNodes: 2, note: 'Pre-existing — palette results use arrow-key keyboard nav' }
];

type Ctx = Waiver['context'];

async function runAxe(page: import('@playwright/test').Page, ctx: Ctx) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const seriousOrCritical = violations.filter(
    v => v.impact === 'serious' || v.impact === 'critical'
  );
  const softer = violations.filter(
    v => v.impact && v.impact !== 'serious' && v.impact !== 'critical'
  );
  if (softer.length) {
    // eslint-disable-next-line no-console
    console.log(`axe(${ctx}): ${softer.length} moderate/minor — ${softer.map(v => v.id).join(', ')}`);
  }

  const problems: string[] = [];
  for (const v of seriousOrCritical) {
    const waiver = WAIVERS.find(w => w.ruleId === v.id && w.context === ctx);
    if (waiver) {
      if (v.nodes.length > waiver.maxNodes) {
        problems.push(
          `${v.id} [${v.impact}] regressed on ${v.nodes.length} nodes (waiver cap ${waiver.maxNodes}: ${waiver.note})`
        );
      }
      continue;
    }
    problems.push(`${v.id} [${v.impact}] on ${v.nodes.length} node(s) — NO WAIVER`);
  }
  if (problems.length) {
    throw new Error(`axe(${ctx}) regressions:\n  - ${problems.join('\n  - ')}`);
  }
}

test.describe('Accessibility audit', () => {
  test('feed route is axe-clean for serious + critical (beyond waivers)', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();
    await runAxe(page, 'feed');
  });

  test('sources route is axe-clean', async ({ page }) => {
    await page.goto('/#sources');
    await page.locator('body').waitFor();
    // Dashboard hydrates from /api/dashboard/sources — give it a moment.
    await page.waitForTimeout(500);
    await runAxe(page, 'sources');
  });

  test('settings page is axe-clean', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();
    await page.locator('.am-topnav__link', { hasText: 'Settings' }).click();
    await expect(page.locator('.am-settings-page')).toBeVisible();
    await runAxe(page, 'settings');
  });

  test('command palette is axe-clean', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();
    await page.keyboard.press('Control+K');
    await expect(page.locator('.am-palette')).toBeVisible();
    await runAxe(page, 'palette');
  });

  test('ask panel is axe-clean', async ({ page }) => {
    await page.goto('/');
    await page.locator('.am-card').first().waitFor();
    await page.keyboard.press('Control+J');
    await expect(page.locator('.am-ask__input')).toBeVisible();
    await runAxe(page, 'ask');
  });
});
