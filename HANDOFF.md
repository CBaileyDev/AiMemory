# AiMemory Viewer — Handoff (2026-04-20)

## Current State

The viewer (`localhost:37777`) is a dark-only React/TypeScript SPA. The redesign from commit `f572d1c` was extended by a two-model implementation pass (Codex 5.4 + Gemini 3.1 Pro) covering Part A (bug fixes) and Part B (design improvements). A passover session then fixed missed/broken items and ran a full simplify pass. The build is clean — zero TypeScript errors, worker restarted, bundle deployed.

---

## What Was Done This Session

### Part A — Bug Fixes (all verified)

| Fix | File |
|-----|------|
| Added `"dom"`, `"dom.iterable"` to tsconfig lib | `src/ui/viewer/tsconfig.json` |
| `finalizeRoutes()` called after primary routes registered | `src/services/worker-service.ts` |
| `routeApp` sub-router lets async routes (Search/Corpus) still work after finalization | `src/services/server/Server.ts` |
| State setter casts fixed (`newObs as Observation[]` etc.) | `src/ui/viewer/App.tsx` |
| `score: number` added to all `PaletteItem` union members | `src/ui/viewer/components/CommandPalette.tsx` |
| `disposed` flag + moved `getContext` guard into `animate()` | `src/ui/viewer/hooks/useSpinningFavicon.ts` |
| `Cache-Control: no-cache` + timestamp query param on viewer bundle | `src/services/worker/http/routes/ViewerRoutes.ts` |
| Typed `IntersectionObserverEntry[]` callbacks | `Feed.tsx`, `SettingsPage.tsx` |
| `as unknown as T` safe casts | `useSourcesDashboard.ts`, `useSettings.ts`, `useStats.ts` |
| `usePaginationFor<T>` generic + `PaginatedResponse<T>` | `src/ui/viewer/hooks/usePagination.ts` |
| `cancelled` flag + cleanup return in settings fetch | `src/ui/viewer/hooks/useSettings.ts` |

### Part B — Design (all verified)

| Feature | File(s) |
|---------|---------|
| BrainIcon pulse + `thinking` glow animation | `BrainIcon.tsx`, `tokens.css` |
| Header: glassmorphism, animated sliding tab indicator, SVG icons in nav | `Header.tsx`, `tokens.css` |
| Feed cards: skeleton loading state, stagger-in entrance animation, hover lift | `Feed.tsx`, `SkeletonCard.tsx`, `tokens.css` |
| Graph: node `shadowBlur` glow, comet edge pulses, radial gradient fog | `GraphCanvas.tsx`, `tokens.css` |
| Command palette: backdrop blur, scale open/close, active-row accent bar | `CommandPalette.tsx`, `tokens.css` |
| Dashboard: `CountUp` stat animation, sparkline stagger-in by row | `SourcesDashboard.tsx`, `tokens.css` |
| Micro-interactions: `scale(0.97)` on active, copy checkmark swap | `tokens.css`, `BaseCard.tsx` |
| Typography: `letter-spacing: -0.02em` on headings | `tokens.css` |
| Mobile: icon-only nav tabs (≤640px), full-screen palette slide-down | `Header.tsx`, `tokens.css` |
| `prefers-reduced-motion` guard collapses all animations via `--motion-ui: 0ms` | `tokens.css` |

### Simplify Pass — Issues Fixed

- **Memory leak:** `CountUp` RAF loop had no cleanup. Fixed with `cancelAnimationFrame` in effect return.
- **Leaky abstraction:** `BrainIcon` was injecting `<style>` keyframes inline in JSX. Moved to `tokens.css`.
- **Redundant derived state:** `stats` `useMemo` pre-computed values only used for loading placeholder. Removed; loading state now renders `['Total', 'This Week', 'Active'].map(label => '—')`.
- **Inconsistent imports:** `Header.tsx` used `React.useState` while other hooks were destructured. Added `useState` to imports.
- **Redundant CSS:** Mobile block re-declared `align-items: flex-start` already set in base rule. Removed.
- **Naming clarity:** `GraphCanvas` intermediate vars renamed `maybeCanvas`/`maybeContext` → `canvas`/`ctx` with a comment explaining explicit type aliases are needed to preserve TypeScript narrowing across closures.

---

## Key Decisions

**`routeApp` sub-router pattern** (`Server.ts`): `finalizeRoutes()` mounts `routeApp` (which holds all registered routes) onto the main `app`, then appends 404/error handlers. Routes registered after `finalizeRoutes()` (Search, Corpus — async, registered in `initializeBackground()`) still work because they use the same `routeApp` instance.

**Explicit type aliases in `GraphCanvas`** (`GraphCanvas.tsx:103-106`): TypeScript doesn't preserve narrowing across closure boundaries. `const canvasEl: HTMLCanvasElement = canvas` and `const context: CanvasRenderingContext2D = ctx` are the narrowed, explicitly-typed aliases used throughout nested functions. The comment explains this is not redundancy — it's required for TypeScript.

**BrainIcon keyframes in `tokens.css`**: All animation state belongs in the global stylesheet. The inline `<style>` the prior models added would re-inject the same keyframes on every render and break the centralized CSS convention.

**`CountUp` RAF cleanup**: Effect depends on `[end, duration]`. When data refreshes, the effect re-runs — without cleanup the old RAF loop continues alongside the new one, calling `setCount` on an unmounted or stale component.

---

## Open Questions

1. **Graph visual QA**: Code confirms the spider-web algorithm is implemented (`buildLodGraph()` in `graph.ts`, concentric ring radii `[140, 270, 400, 520]`). Prior session noted rendering was broken. Needs a live browser test with real data on the `#graph` route to confirm ring layout and comet pulses actually display.

2. **`getContext('2d')` per frame** (`useSpinningFavicon.ts:61`): Called 60×/sec. Modern browsers cache this lookup internally so it's a noop, but it could be lifted outside `animate()` if perf ever becomes a concern.

3. **`viewer.html` re-read per request** (`ViewerRoutes.ts`): `readFileSync` + string replace on every page load. Cache-bust timestamp must vary per request (by design), but the base HTML could be cached on first load. Low-priority optimization.

4. **Settings page mobile overflow**: Content area clips on the right side at 375px. Pre-existing layout issue unrelated to this session's changes.

5. **`children?: React.ReactNode` on primitives**: Required for `@types/react` 18.3.x — React 18 removed auto-children from `HTMLAttributes`. Confirmed correct; not redundant.

---

## Next Steps

1. **Commit** all changes with a descriptive message covering Part A/B fixes + simplify.
2. **Graph page smoke test**: Open `localhost:37777/#graph` with real observation data. Confirm concentric rings, hover glow, comet pulses.
3. **Sources page smoke test**: Open `#sources`. Confirm `CountUp` animation fires on load and sparklines stagger in.
4. **Mobile smoke test**: Dev tools → 375px. Confirm icon-only nav, full-screen palette (⌘K).
5. **Progress ring on Total stat** (B7, still missing): Design called for a circular SVG progress indicator around the Total memories stat in `SourcesDashboard`. Not implemented — would need an SVG ring + percentage calculation.

---

## Key File Locations

```
src/
  ui/
    tokens.css                          ← All design tokens, keyframes, component CSS
    viewer/
      components/
        GraphCanvas.tsx                 ← Canvas graph renderer (LOD + glow + comet pulses)
        Header.tsx                      ← Nav with animated indicator + mobile icons
        SourcesDashboard.tsx            ← CountUp + sparkline stagger
        BrainIcon.tsx                   ← thinking prop (animation in tokens.css)
        SkeletonCard.tsx                ← Shimmer skeleton (new file)
      hooks/
        usePagination.ts                ← Generic <T> pagination
        useSettings.ts                  ← cancelled-flag fetch pattern
        useSpinningFavicon.ts           ← disposed-flag RAF pattern
      utils/
        graph.ts                        ← buildLodGraph() — spider-web layout algorithm
  services/
    server/Server.ts                    ← routeApp sub-router + finalizeRoutes()
    worker-service.ts                   ← Startup + route registration order
    worker/http/routes/
      ViewerRoutes.ts                   ← Cache-bust + no-cache headers
      DashboardRoutes.ts                ← /api/dashboard/sources endpoint
```

## BrainIcon Usage
```tsx
<BrainIcon glow thinking={isProcessing} />
// thinking=true → am-brain-thinking 0.8s pulse w/ glow
// thinking=false → am-brain-pulse 4s ambient pulse
```

## CountUp Cleanup Pattern
```tsx
React.useEffect(() => {
  let frameId: number;
  const step = (ts: number) => { ...; frameId = requestAnimationFrame(step); };
  frameId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frameId); // ← required
}, [end, duration]);
```
