---
title: Viewer performance
description: Performance targets, budgets, and measurement tools for the AiMemory viewer.
---

# Viewer performance

AiMemory's viewer is the surface users spend the most time in. This
document records the performance contract it is held to, the tools that
measure it, and how to reproduce every gate locally.

## Contract (Phase 12 targets)

| Metric | Target | Enforced by |
|--------|--------|-------------|
| First contentful paint of the feed | ≤ 1500 ms with the seeded dev DB | `tests/viewer/feed-loads.spec.ts` |
| Playwright viewer suite | 15/15 passing | `npm run test:viewer` + CI |
| Axe serious / critical violations | Zero beyond the documented waivers | `tests/viewer/axe-audit.spec.ts` |
| Bundle size (minified / gzipped) | ≤ 400 KB / 130 KB | `scripts/viewer-bundle-budget.js` |
| Lighthouse Performance (soft) | ≥ 80 on CI-class hardware | `scripts/viewer-lighthouse.js` |
| Lighthouse Accessibility | ≥ 98 | `scripts/viewer-lighthouse.js` |
| Lighthouse Best Practices | ≥ 95 | `scripts/viewer-lighthouse.js` |
| SSE throughput | 1,000 rows / 60s with ≥ 90% delivery | `scripts/viewer-sse-load-test.js` |

The Playwright + bundle + axe gates run on every PR that touches
`src/ui/**` or the related tooling (see `.github/workflows/viewer.yml`).
The Lighthouse + SSE scripts are opt-in locally and in performance CI
runs; they are not gated on every PR because browser-driven measurements
tend to be flaky on shared runners.

## Running each gate

```bash
# 1. Seed the dev DB into an isolated data dir.
CLAUDE_MEM_DATA_DIR=~/.claude-mem-dev npm run dev:seed:fresh

# 2. Start the dev worker on port 37780.
npm run dev:server &

# 3. Playwright + axe
npm run test:viewer

# 4. Bundle budget
npm run check:viewer-size

# 5. SSE throughput
node scripts/viewer-sse-load-test.js --url http://localhost:37780 --rows 1000 --window-ms 60000

# 6. Lighthouse (set LIGHTHOUSE_STRICT=1 to fail below thresholds)
npm install --no-save lighthouse
VIEWER_URL=http://localhost:37780 node scripts/viewer-lighthouse.js
```

## Current baseline

- **Bundle**: 322 KB minified / 101 KB gzipped (as of Phase 12 merge).
- **Axe waivers**: 34–80 `color-contrast` violations per view that
  predate Phase 12 — token system muted text sits just below WCAG AA
  4.5:1. Tracked as a follow-up token pass; `tests/viewer/axe-audit.spec.ts`
  caps each waiver so regressions still fail.
- **SSE**: Local laptop run delivers 1,000 rows in under 60s with zero
  drops and no perceived UI jank.

## What to do when a gate fails

1. **Playwright specs** — rerun locally with `npm run test:viewer:ui` to
   step through. Playwright traces, screenshots, and videos for failing
   CI runs are attached to the workflow artifact `playwright-report`.
2. **Bundle budget** — the script prints both minified and gzipped
   measurements. If the regression is intentional (e.g. a new feature
   shipping an extra dependency), raise the values in
   `.viewer-size-budget.json` and note the change in the PR. Otherwise
   run `npx esbuild --analyze` on `src/ui/viewer/index.tsx` to find the
   regression.
3. **Axe** — if a new serious/critical violation appears on a surface
   that did not previously regress, fix the underlying issue. Do not
   add the violation to the waiver list in `axe-audit.spec.ts` without
   a tracked follow-up ticket.
4. **SSE load test** — the script prints dropped-row counts. Drops
   usually indicate SSE back-pressure or a memory-intensive render
   regression; try reproducing with a smaller `--rows` value first.
5. **Lighthouse** — re-run locally on the same machine twice; if
   both runs are below threshold, profile with Chrome DevTools
   Performance tab and address before merging.
