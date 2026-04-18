# Viewer test suite (Phase 12)

End-to-end Playwright tests for the React viewer. Complements the existing
`tests/e2e/` harness that covers the CLI and worker contracts.

## Running

```bash
# one-off: install the bundled Chromium
npx playwright install chromium

# run the suite
npm run test:viewer

# axe audit only
npm run test:viewer:axe
```

## What the suite covers

Six specs (§11.B of `PLAN.md`):

| Spec | Flow |
|------|------|
| `feed-loads.spec.ts` | Seeded DB renders ≥ 50 cards within 1500ms. |
| `palette-flow.spec.ts` | ⌘K → type → Enter jumps the feed to a matching observation. |
| `theme-toggle.spec.ts` | Theme toggle updates `data-theme` without FOUC. |
| `url-filter-roundtrip.spec.ts` | Apply filters → reload → state restored from URL. |
| `settings-persist.spec.ts` | Edit a setting → Save → reload → value persists. |
| `ask-panel.spec.ts` | ⌘J → submit → citations render → clicking cite scrolls feed. |

Plus `axe-audit.ts`, which runs axe-core against every route and fails on any
**serious** or **critical** violation.

## Fixtures

`global-setup.ts` seeds an isolated tmpdir via `scripts/seed-dev-db.js` and
spawns `scripts/dev-server.js` on port `37781` (override with
`CLAUDE_MEM_VIEWER_TEST_PORT`). `global-teardown.ts` kills the worker and
removes the tmp dir.

## Invariants

- Never touch `~/.claude-mem/`. All writes are tmpdir-scoped.
- No test asserts an exact row count; assert `≥` bounds.
- No `setTimeout` > 2s. Use `page.waitForSelector` / `waitForFunction`.
