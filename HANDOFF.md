# AiMemory Viewer Redesign — Handoff for Phase 2-8 Implementation

**Project**: AiMemory Viewer — "Tech-breakthrough" dark/neon overhaul  
**Status**: ✅ Phase 1 complete. Phases 2–8 pending.  
**Handoff Date**: 2026-04-19  
**Plan Location**: `/Users/carterbarker/.claude/plans/fetch-this-design-file-nifty-trinket.md` (full 8-phase plan with phased breakdown, critical files, reuse opportunities, deep-dive, risks, verification checklist)

---

## What's Complete

**Phase 1 — Token system cleanup (DONE)**
- `src/ui/tokens.css` rewritten to dark-only (single `:root` block, no light-theme cruft)
- `--neutral-50: #08080c` matches design handoff
- Added `--bg-deep: #08080c` literal
- Space Grotesk + JetBrains Mono fonts pulled into `:root`
- Elevation halos changed to neutral black for all schemes
- Three neon scheme override blocks preserved: `[data-theme="dark"][data-neon-scheme="cyan|violet|neon-matrix"]`
- ✅ Build succeeded (`npm run build-and-sync`), worker restarted

---

## What Remains (Phases 2–8)

| Phase | Scope | Time Est. |
|-------|-------|-----------|
| **2** | BrainIcon (hexagonal core + dashed orbital + glow) + Header (gradient wordmark, StatusPulse animation, 3-swatch scheme picker) | 2–3h |
| **3** | Card restyle (left-border type-colored accent, Badge polish, Feed entrance animations) | 2–3h |
| **4** | GraphCanvas visual flourishes (conic-gradient radar sweep, 6-segment comet trails, hub burst rings, roundRect tooltip, pause on tab hidden) | 3–4h |
| **5** | TokenSavingsPanel polish (dual-rate pricing, per-source bar colors, two-stat header) | 1–2h |
| **6** | SourcesDashboard restyle (per-row health dot, glow on source dots, three-stat header) | 1–2h |
| **7** | Settings + SchemePicker primitive (3-swatch picker in Header + Settings / General, keyboard nav) | 1–2h |
| **8** | Cleanup (delete ThemeToggle, dead light-mode code paths, unused assets) | 30m–1h |

**Total remaining**: ~12–18 hours of implementation + verification.

---

## Critical Context

### What's Already Wired (Don't Regress)

1. **Real data pipeline** — all pages feed from localhost:37777 server:
   - `useSSE()` → observations, summaries, prompts, sources, isProcessing, queueDepth, isConnected
   - `usePagination()` → paginated feed with mergeAndDeduplicateByProject
   - `useSourcesDashboard()` → dashboard data (id, total, sevenDay, lastSeenMs, wowDelta, healthStatus)
   - `useSettings()` → settings schema with 40+ fields (backend persists to `/api/settings`)
   - `useTheme()` → `{ scheme, setScheme, cycleScheme }` with migration for legacy stored values

2. **Routes & page structure** (in App.tsx line 191+):
   - `#feed` → Feed (default)
   - `#graph` → GraphPage (canvas-based neural network)
   - `#sources` → SourcesDashboard
   - `#settings` → SettingsPage
   - Global keyboard shortcuts: `g h|v|s|c`, `⌘K`, `⌘J`, `?`, `Esc`, `/`

3. **Graph infrastructure**:
   - LOD layout: `buildLodGraph` clusters by project (LOD 0) → project+agent (LOD 1) → leaf (LOD 2)
   - Per-node colors via `resolveAgentColor` reading `var(--source-<id>)` (18 sources defined in tokens.css)
   - Camera + drag pan + node drag + scroll zoom + LOD recompute on zoom threshold
   - O(N) hit testing, memory-safe cleanup on unmount

4. **TokenSavingsPanel** — already real-data-wired:
   - Reads `useSourcesDashboard().data.sources` → transforms to `{ id, total }` rows
   - Multiplies by `TOKENS_PER_MEMORY` constant
   - Uses `PRICE_PER_1K_OUTPUT` (needs extension to dual-rate in Phase 5)

5. **Production features** (don't remove):
   - AskPanel (⌘J) + CommandPalette (⌘K) + ContextMenu
   - Settings persistence to backend via `POST /api/settings`
   - Real SSE event streaming (observations, summaries, prompts arriving live)
   - Sparklines in SourcesDashboard (via ECharts)
   - Cite-key copy, expand/collapse cards, freshness pulse

### Design Handoff Location

```
/tmp/design-file/aimemory/
├── README.md                     ← Design bundle instructions
├── chats/chat1.md                ← Design conversation (196 lines, shows intent)
└── project/AiMemory Viewer.html  ← Primary design (637 lines)
    ├── BrainIcon geometry (lines 264–289)
    ├── GraphCanvas visual flourishes (lines 39–258)
    ├── MemoryCard design (lines 320–340)
    ├── TokenSavingsPanel layout (lines 354–424)
    └── MODEL_PRICING table (lines 343–352)
```

**Design features to port**:
- Hexagonal neural core + dashed orbital ring + 6 vertex synapses + 4 satellite dots (BrainIcon)
- Gradient wordmark text (Header)
- Animated pulse-ring connection status dot (Header)
- Left-border type-colored accent on memory cards (3px solid, color-coded by type)
- Type badges with uppercased text, smaller font, tight spacing (learned/completed/investigated/next-steps)
- Card entrance animation: `opacity: 0 → 1; transform: translateY(8px) → 0` at 0.3s ease-in
- Radar-style concentric rings at r=150,280,410,540 (GraphCanvas)
- Conic-gradient scanning sweep (sweeping across full circle, 1.5px leading edge)
- 6-segment comet-trail edge pulses (every third edge, per-edge speed 0.3–0.55s, off-screen most of the time)
- Hub burst rings (expanding stroke when `burstPhase < 0.3`, time-mod-4 per hub)
- Rounded tooltip corners (`roundRect(px, py-12, width+16, 22, 6)`, fallback for older Safari)
- Per-source color bars with gradient fill in TokenSavingsPanel + SourcesDashboard rows
- 3-swatch scheme picker (28×28 rounded squares, active state: white ring + scale 1.15)

---

## File Structure

```
/Users/carterbarker/Documents/AiMemory/
├── src/
│   ├── ui/
│   │   ├── tokens.css                           ← Phase 1 DONE (dark-only)
│   │   └── viewer/
│   │       ├── components/
│   │       │   ├── BrainIcon.tsx               ← Phase 2 (hexagonal core, glow prop)
│   │       │   ├── Header.tsx                  ← Phase 2 (gradient wordmark, StatusPulse, SchemePicker)
│   │       │   ├── GraphCanvas.tsx             ← Phase 4 (sweep, comets, bursts, pause)
│   │       │   ├── GraphPage.tsx               ← Phase 4 (pass accentRgb to canvas)
│   │       │   ├── TokenSavingsPanel.tsx       ← Phase 5 (bars, dual-rate pricing)
│   │       │   ├── SourcesDashboard.tsx        ← Phase 6 (health dot, glow)
│   │       │   ├── BaseCard.tsx                ← Phase 3 (left-border, data-type attr)
│   │       │   ├── ObservationCard.tsx         ← Phase 3 (restyle via BaseCard)
│   │       │   ├── SummaryCard.tsx             ← Phase 3 (restyle via BaseCard)
│   │       │   ├── PromptCard.tsx              ← Phase 3 (restyle via BaseCard)
│   │       │   ├── Feed.tsx                    ← Phase 3 (entrance animations, --bg-deep)
│   │       │   ├── primitives/
│   │       │   │   ├── Badge.tsx               ← Phase 3 (restyle uppercase, tight)
│   │       │   │   ├── SourceDot.tsx           ← Phase 6 (add glow prop)
│   │       │   │   └── SchemePicker.tsx        ← Phase 7 NEW (3-swatch, radiogroup)
│   │       │   ├── settings/
│   │       │   │   ├── SettingsField.tsx       ← Phase 7 (scheme-picker kind)
│   │       │   │   └── SettingsPage.tsx        ← Phase 7 (integrate SchemePicker)
│   │       │   └── ThemeToggle.tsx             ← Phase 8 DELETE (replace with SchemePicker)
│   │       ├── hooks/
│   │       │   ├── useTheme.ts                 ← Exists, already handles schemes
│   │       │   ├── useSSE.ts                   ← Exists, feeds observations/sources/isConnected
│   │       │   └── useSourcesDashboard.ts      ← Exists, feeds TokenSavingsPanel & SourcesDashboard
│   │       ├── state/
│   │       │   └── settingsSchema.ts           ← Phase 7 (add `kind: 'scheme-picker'` or special-case __theme)
│   │       ├── utils/
│   │       │   ├── graph.ts                    ← Phase 4 verify (resolveAgentColor, buildLodGraph)
│   │       │   └── dashboardFormat.ts          ← Phase 5 verify (formatDashboardCount)
│   │       └── assets/
│   │           ├── icon-thick-{learned,completed,investigated,next-steps}.svg
│   │           ├── icon-thin-{learned,completed,investigated,next-steps}.svg
│   │           ├── source hue palette ✅
│   │           └── claude-mem-logomark.webp    ← Phase 8 DELETE (after grepping)
│   └── ...
├── plugin/
│   └── ui/
│       └── viewer.html                         ← Built output (esbuild inlines tokens.css + components)
├── CLAUDE.md                                   ← Project instructions (read for context)
├── HANDOFF.md                                  ← THIS FILE
├── README.md                                   ← Claude-mem README
├── package.json
└── ...
```

---

## Build & Verification

### Build
```bash
cd /Users/carterbarker/Documents/AiMemory
npm run build-and-sync
# Outputs: plugin/ui/viewer.html + viewer-bundle.js
# Syncs to ~/.claude/plugins/marketplaces/thedotmack/
# Restarts worker on port 37777
```

### Verification Checklist (Per Phase)

After each phase, before moving to the next:

- [ ] **No console errors**: Open DevTools (F12), check Console tab
- [ ] **No Babel/build warnings**: `npm run build-and-sync` output clean
- [ ] **No TypeScript errors**: `npm run check:viewer` passes (or just build didn't fail)
- [ ] **Target route renders**: 
  - Phase 2: `#feed` shows Header with BrainIcon + pulse, Header has new theme swatches
  - Phase 3: `#feed` shows memory cards with left border + type badges
  - Phase 4: `#graph` shows canvas with sweep/comet/bursts animating
  - Phase 5: `#feed` shows TokenSavingsPanel with bars + estimates
  - Phase 6: `#sources` shows dashboard with per-row health dots
  - Phase 7: `#settings` shows three scheme swatches in General section
  - Phase 8: `#feed` still renders (cleanup shouldn't break anything)
- [ ] **Hard reload works**: `Cmd+Shift+R` in Chrome, no stale CSS cache
- [ ] **Scheme switching works**: Click swatch in Header, observe `data-neon-scheme` flip in DevTools, colors update everywhere
- [ ] **Keyboard shortcuts unbroken**: `g h`, `g v`, `g s`, `g c`, `⌘K`, `⌘J`, `?`, `Esc`, `/`
- [ ] **Production features intact**:
  - Feed paginates correctly
  - Settings persist (change a field, refresh page, verify it stuck)
  - SSE updates arrive (watch Network tab for EventSource)
  - Graph LOD switches on zoom

### Full Test Suite
```bash
npm run test:viewer                 # Playwright DOM structure
npm run test:viewer:axe             # a11y (SchemePicker needs role="radiogroup")
npm run check:viewer-size           # Bundle size regression
npm run check:viewer-sse            # Live event load rendering
npm run check:viewer-lighthouse     # Perf (expect 2–5pt drop from canvas flourishes)
```

---

## Key Decisions Locked In

1. **Dark-only** — No light theme. No `prefers-color-scheme` media query. Neon schemes on top.
2. **Three schemes** — Cyan (electric #22d3ee), Violet (soft #c4b5fd), Neon Matrix (green #4ade80). Scheme picker in Header + Settings.
3. **No ambient background graph** — Graph only renders on `#graph` route. Other pages show minimal background.
4. **Client-side token estimate** — TokenSavingsPanel multiplies source counts × `TOKENS_PER_MEMORY` × `MODEL_PRICING`. No server changes.
5. **Keep all production wiring** — SSE, pagination, settings persistence, keyboard shortcuts, detail panel, graph selection. Redesign = visual layer only.
6. **18 sources in color palette** — Tokens already define `--source-<id>` for all. Phase 5 TokenSavingsPanel extends `MODEL_PRICING` map with missing ids (defaults).

---

## Common Pitfalls

### Phase 2 (BrainIcon)
- `useSpinningFavicon` may depend on the `.webp` favicon asset, not React component. Don't delete the asset in Phase 2; defer to Phase 8.
- `currentColor` on SVG should propagate the consumer's `color: var(--accent-primary)`. Verify with `color: red` inline on Header's BrainIcon call as a test.

### Phase 3 (Cards)
- Restyling `Badge` cascades to ALL consumers (settings, ask panel, command palette). Grep before changing: `grep -r "Badge" src/`.
- Type mapping: existing types are `bugfix|decision|feature|refactor|discovery`; prototype uses `learned|completed|investigated|next-steps`. Keep both — check `observation.type` against both sets.
- Card entrance animation: cap to first ~12 cards in paginated feed or use IntersectionObserver — don't stagger 500 cards.

### Phase 4 (GraphCanvas)
- `createConicGradient` clips at small viewports — expected, canvas clears each frame.
- 6-segment trails × edge density: ~36k ops/sec at 300 edges (fine), ~400k at 2000 (jank). Use LOD gate or edge cap.
- Hub bursts can phase-align — jitter already present in `node.pulsePhase`; verify visually.
- `resolveAgentColor` already reads `var(--source-<id>)` and caches — reuse this.
- **Pause on tab hidden** — important for mobile/backgrounded tabs. Use `document.visibilitychange` event.

### Phase 5 (TokenSavingsPanel)
- `useSourcesDashboard` returns 18 sources; prototype mock had 8. Extend `MODEL_PRICING` map gracefully with fallbacks.
- Pricing: upgrade from single `PRICE_PER_1K_OUTPUT` to dual-rate `{ inputPer1k, outputPer1k }`. Blend by averaging per design prototype.
- Per-source bar colors: either inline CSS `background: linear-gradient(90deg, ${sourceColor}88, ${sourceColor})` or read `var(--source-<id>)` via `getComputedStyle`.

### Phase 6 (SourcesDashboard)
- Health status already exists (`healthClass()` on each source); add visual indicator (dot) driven by `--dash-health-ok|warn|stale` tokens.
- Keep the "Not set up" section (real-data feature absent from prototype).

### Phase 7 (SchemePicker)
- Share the same `<SchemePicker>` component between Header and Settings. Both write through `useTheme().setScheme()`.
- Radiogroup semantics: `role="radiogroup"`, arrow keys navigate, Enter/Space selects, `aria-label` on swatches.
- Settings field: add `kind: 'scheme-picker'` to union OR special-case `key === '__theme'` in SettingsField — your call.

### Phase 8 (Cleanup)
- Delete `ThemeToggle.tsx` only after verifying no other consumers via `grep -r "ThemeToggle" src/`.
- Don't bulk-delete assets. Verify each is unreferenced first (`grep -r "claude-mem-logo-for-dark-mode"` etc.).
- Light-mode-only token values (e.g., old `--color-bg-summary: #fffbf0`) become dead — remove after grepping consumers.

---

## Important Files to Reference

- **Full plan**: `/Users/carterbarker/.claude/plans/fetch-this-design-file-nifty-trinket.md` (8-phase breakdown with deep-dive on graph renderer, risks, data integration map, verification matrix)
- **Design prototype**: `/tmp/design-file/aimemory/project/AiMemory Viewer.html` (HTML + CSS + JS mock, shows every visual detail)
- **Design chat**: `/tmp/design-file/aimemory/chats/chat1.md` (user-designer conversation, intent behind decisions)
- **Current codebase**: `/Users/carterbarker/Documents/AiMemory/` (source of truth)

---

## Commands & Shortcuts

```bash
# Build & restart
cd /Users/carterbarker/Documents/AiMemory
npm run build-and-sync

# Open in browser (after build)
open "http://localhost:37777"
# Hard reload in Chrome to skip CSS cache: Cmd+Shift+R

# Check code structure without full read
npm run check:viewer

# Run test suite
npm run test:viewer
npm run test:viewer:axe

# Grep for consumers of a component
grep -r "ThemeToggle" src/
grep -r "Badge" src/

# Check TypeScript
npm run tsc --noEmit

# Run Lighthouse audit (slow)
npm run check:viewer-lighthouse
```

---

## Handoff Notes

- **Codebase state**: Clean, builds successfully. Phase 1 changes committed to working tree (not yet in git — that's up to you).
- **Real data pipeline**: Fully operational. Observer/summary/prompt streams, pagination, settings persistence all working. Don't regress.
- **Design intent**: Neon neural-network visualization with high-tech feel. Three color schemes. Token savings estimation. Obsidian-like graph.
- **Scope**: Visual layer only. All production wiring stays. No new endpoints, no new server logic.
- **Time remaining**: ~12–18 hours of focused implementation + verification across 7 phases.

---

## Next Steps (For Incoming Agent)

1. Read the full plan: `/Users/carterbarker/.claude/plans/fetch-this-design-file-nifty-trinket.md`
2. Skim the design prototype: `/tmp/design-file/aimemory/project/AiMemory Viewer.html`
3. Run a clean build to verify environment: `npm run build-and-sync`
4. Start Phase 2: BrainIcon + Header restyle (2–3 hours)
5. After each phase, run tests + manual verification before moving to next
6. Use the verification checklist above to gate each phase

---

**Good luck! The foundation is solid. Phase 1 proved the build pipeline works and the token system is clean. Phases 2–8 are execution — no surprises expected.** 🚀
