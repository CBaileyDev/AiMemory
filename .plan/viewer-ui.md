# Plan: AiMemory Viewer UI 2.0 — Custom Brand, Dense Information, Real Polish

## Orientation

The viewer is a React app bundled via esbuild into a single `plugin/ui/viewer.html` + `viewer-bundle.js` pair served by the worker at `http://localhost:37777/`. The current surface ships **12 components** (`Header`, `Feed`, `ObservationCard`, `SummaryCard`, `PromptCard`, `ContextSettingsModal`, `LogsModal`, `TerminalPreview`, `GitHubStarsButton`, `ThemeToggle`, `ScrollToTop`, `ErrorBoundary`), **8 hooks** (`useSSE`, `useSettings`, `useStats`, `useTheme`, `usePagination`, `useGitHubStars`, `useSpinningFavicon`, `useContextPreview`), a token-based CSS system inside `viewer-template.html` with ~2,900 lines of styles, Monaspace Radon as the sole typeface, and an SSE-driven feed that merges live data with paginated history.

The worker already exposes **~40 route patterns** including `/api/search`, `/api/stats`, `/api/timeline`, `/api/observations[/batch|/by-file]`, `/api/context/{preview,inject,recent,semantic,timeline}`, `/api/sessions/*`, `/api/pending-queue/*`, `/api/settings`, `/api/mcp/*`, and `/api/branch/*`. The UI currently uses a fraction of these.

The claude-mem upstream UI was built for a single product surface. This fork — AiMemory — supports **15 IDE integrations across 5 vendor families** (Claude Code + Claude Desktop, Codex CLI + Codex VS Code, Kimi CLI + Kimi Code VS Code, Gemini CLI + Gemini Code Assist VS Code, Cursor, and 10 more). The current viewer does not surface any of this. That gap is the single biggest reason the UI feels generic.

**This plan rebuilds the viewer around AiMemory's actual identity** — a universal, multi-source, diagnosable memory layer — without throwing away the hooks, the SSE pipeline, or the token CSS system that already work.

---

## North star

A contributor or power user opens `http://localhost:37777/` and within **five seconds** can answer:

1. **"Is my memory working?"** — visible, at-a-glance health of the worker, the DB, and every IDE source.
2. **"What did I learn recently?"** — the memory feed, filtered by IDE / project / type, with keyboard-first navigation.
3. **"What do I know about X?"** — inline search and `ask` with citations that deep-link to observation rows.
4. **"How does this work?"** — a tour / help surface that explains the 3-layer workflow (`search` → `timeline` → `get_observations`) without leaving the UI.

All four answers must be reachable in ≤ 2 clicks from the initial page load. Every answer must be legible at 1440×900, 1024×768 (typical secondary monitor), and 375px wide (phone / tablet viewport for sanity). Every interactive element must be reachable with keyboard only.

---

## Multi-model execution loadout

You will use Cursor's multi-model mode. Assign models to phases by strength:

| Model | Slot count | Best at | Assigned phases |
|---|---|---|---|
| **Composer 2** | 3 parallel workers | Fast, repetitive component scaffolding and CSS token migrations; near-zero-thought "apply the pattern across 8 files" | Phase 1 (design tokens), Phase 2 (layout primitives), Phase 3 (card system refactor) |
| **Claude Sonnet 4.6 (high)** | 1 | Systems thinking on React state + dataflow, careful refactors that touch hooks + components together | Phase 4 (source-aware feed + filters), Phase 5 (Sources dashboard), Phase 6 (command palette) |
| **Claude Opus 4.7 (high)** | 1 | Deep design intuition, copy polish, micro-interaction design, taste-sensitive calls (typography, whitespace, motion) | Phase 0 (visual direction), Phase 7 (ask panel + citations), Phase 8 (settings redesign), Phase 11 (polish pass) |
| **GPT 5.4 (high)** | 1 | End-to-end architectural thinking, API contract design, long-form planning, cross-cutting concerns | Phase 9 (API gaps + new routes), Phase 10 (testing + Playwright / accessibility audits) |

**Orchestration pattern:**

Each phase has an **owner model** and a **reviewer model**. The owner writes the diff, the reviewer proofs it in a fresh context with only the phase prompt + diff attached (no other context). Cursor's multi-model UI is built for this — use it. No phase lands without the reviewer's sign-off.

**Phase dependency graph (execute in this order, but parallelize where stated):**

```
Phase 0 (design direction)  — Opus, solo, sequential
   │
   ▼
Phase 1 (design tokens)  ─┐
Phase 2 (layout primitives)├─ Composer 2 × 3, parallel
Phase 3 (card refactor)  ─┘
   │
   ▼
Phase 4 (feed + source filters)  — Sonnet, sequential
   │
   ▼
Phase 5 (Sources dashboard)  — Sonnet, sequential
   │
   ├─► Phase 9 (API additions)  — GPT 5.4, parallel with 6
   ├─► Phase 6 (command palette)  — Sonnet, parallel with 9
   │
   ▼
Phase 7 (ask panel + citations)  — Opus, sequential, needs 9
   │
   ▼
Phase 8 (settings redesign)  — Opus, sequential
   │
   ▼
Phase 10 (testing + a11y + perf)  — GPT 5.4, sequential
   │
   ▼
Phase 11 (polish + motion + copy)  — Opus, sequential
```

Total: **12 phases**, each independently reviewable and shippable. An operator in Cursor can run phases 1/2/3 in three parallel Composer windows; 6/9 in parallel Sonnet+GPT windows; everything else sequentially in a single window of the assigned model.

---

## Non-goals (explicit)

- **No framework migration.** Stay on React 18 + esbuild. No Next.js, no Remix, no Vite unless Phase 10 discovers an esbuild-specific blocker.
- **No CSS framework.** No Tailwind, no shadcn/ui, no MUI. The token-based CSS system in `viewer-template.html` is good; we extend it, not replace it. Reasoning: zero runtime deps, zero JS bundle weight, the bundle is already 270 KB and we want to *reduce* that.
- **No backend rewrites.** The worker API is stable; Phase 9 adds a handful of focused endpoints, but does not touch the core DB or search stack.
- **No lock-in to upstream branding.** We already did the README rebrand to "AiMemory." The UI must match.
- **No LLM-in-the-loop features that require paid API keys by default.** `ask` already works without one — do not regress that.
- **Pro-feature surfaces stay out.** Per `CLAUDE.md` the viewer is open-source; Pro features live in a separate, unlisted repo.

---

## Phase 0: Visual direction (Opus, solo)

### Deliverable

A single `.plan/viewer-ui-direction.md` plus one set of screenshots (`/opt/cursor/artifacts/viewer-direction-*.png`) that establish:

1. **Brand colors.** The current viewer uses GitHub-blue (`#0969da`) as the accent. AiMemory is a universal-memory product — the palette must feel sharper than generic IDE chrome and clearly different from the upstream. Proposed base:
   - **Primary accent:** deep violet `#7c3aed` (sits between Kimi's purple and Gemini's blue; reads as "neutral AI" without being any one vendor)
   - **Success:** `#10b981` (cooler than GitHub green)
   - **Warning:** `#f59e0b`
   - **Error:** `#ef4444`
   - **Info:** `#3b82f6`
   - **Source accents** (per-IDE hue for the source dots / chips — must be visually distinct at 10px):
     - `claude-code` / `claude-desktop` — `#ff9d3b` (Anthropic orange)
     - `codex-cli` — `#10a37f` (OpenAI teal)
     - `gemini-cli` — `#4285f4` (Google blue)
     - `kimi` — `#a78bfa` (Moonshot purple)
     - `cursor` — `#0a0a0a` / `#f4f4f5` (mono)
     - `windsurf` — `#22c55e`
     - `opencode` — `#f97316`
     - `openclaw` — `#84cc16`
     - `copilot-cli` — `#6e56cf`
     - `antigravity` — `#ec4899`
     - `goose` — `#eab308`
     - `crush` — `#06b6d4`
     - `roo-code` — `#14b8a6`
     - `warp` — `#f43f5e`

2. **Typography scale.** Monaspace Radon stays — it's the product's visual signature. Add one companion sans for headings and UI chrome to pull body weight away from mono:
   - **Heading font:** Inter Variable (already widely shipped, no license friction, variable weight 100–900)
   - **Body / UI:** Inter Variable at 14px base, 1.55 line-height
   - **Code / data:** Monaspace Radon at 13px, 1.45 line-height
   - **Type scale:** 12 / 13 / 14 / 16 / 18 / 22 / 28 / 36 (strict — no off-scale sizes)

3. **Spacing scale.** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80 (rem-anchored; current viewer has ad-hoc pixel values). Every margin/padding in the new viewer must snap to this scale.

4. **Motion language.** Subtle, purposeful, never decorative. Durations: 120ms (ui), 180ms (cards), 240ms (modals). Easing: `cubic-bezier(0.16, 1, 0.3, 1)` for in, `cubic-bezier(0.4, 0, 0.2, 1)` for out. Prefers-reduced-motion respected everywhere.

5. **Elevation.** Replace the current box-shadow stack with a 4-tier shadow scale: ambient (0), raised (1, cards), floating (2, modals), overlay (3, command palette). Dark mode uses blurred colored bloom instead of flat black shadow.

### Screens to produce in Phase 0 (as Figma-less ASCII wireframes inside the doc, not images)

- Home / feed (populated)
- Home / feed (empty state — fresh install, zero observations)
- Sources dashboard
- Ask panel — inline + expanded
- Command palette
- Settings redesign
- Mobile (375px) main feed
- Dark mode for every screen above

### Rationale

Opus is the right choice for Phase 0 because every subsequent phase inherits these decisions. One wrong call here (e.g. a palette that doesn't scale to 15 sources, a type scale that makes code illegible next to headings) cascades through 12 components. Sonnet would produce a plausible direction that doesn't survive contact with the messy multi-source reality; Composer would produce a generic direction.

**Acceptance**: the direction doc lists every token with its light + dark value, every type pair with a visual example, a spacing table, motion constants, and one annotated wireframe per screen. Every downstream phase cites it by line number.

---

## Phase 1: Design tokens (Composer 2, parallel)

### Scope

Replace the ad-hoc token set in `src/ui/viewer-template.html` (`:root` block, ~240 variables) with a structured system:

```css
/* src/ui/viewer-template.html */

:root {
  /* Base scale — never used directly. Only composed. */
  --scale-0: 0rem;   --scale-1: 0.25rem;  --scale-2: 0.5rem;
  --scale-3: 0.75rem; --scale-4: 1rem;    --scale-5: 1.25rem;
  --scale-6: 1.5rem;  --scale-7: 2rem;    --scale-8: 2.5rem;
  --scale-9: 3.5rem;  --scale-10: 5rem;

  /* Semantic spacing — what components actually consume. */
  --space-card-padding: var(--scale-5);
  --space-card-gap: var(--scale-4);
  --space-section-gap: var(--scale-7);
  --space-feed-gutter: var(--scale-6);

  /* Type scale */
  --text-xs: 0.75rem;   --text-sm: 0.8125rem;  --text-base: 0.875rem;
  --text-md: 1rem;      --text-lg: 1.125rem;   --text-xl: 1.375rem;
  --text-2xl: 1.75rem;  --text-3xl: 2.25rem;

  /* Source hues — 15 integrations + "all" */
  --source-claude-code: #ff9d3b;
  --source-codex-cli:   #10a37f;
  --source-gemini-cli:  #4285f4;
  --source-kimi:        #a78bfa;
  /* ... full 15, see Phase 0 */
  --source-all:         var(--color-text-tertiary);

  /* Elevation */
  --elev-0: 0 0 0 1px var(--color-border-primary);
  --elev-1: 0 1px 2px rgb(0 0 0 / 4%), 0 4px 12px rgb(0 0 0 / 4%);
  --elev-2: 0 8px 24px rgb(0 0 0 / 8%), 0 2px 8px rgb(0 0 0 / 6%);
  --elev-3: 0 24px 48px rgb(0 0 0 / 16%), 0 8px 24px rgb(0 0 0 / 12%);
}
```

### What the three Composer workers do in parallel

- **Worker A — token definitions.** Extracts the current `:root` blocks, consolidates them against Phase 0's palette, writes the new token set to a **single `src/ui/tokens.css` file** and has `viewer-template.html` `@import` it. This file becomes the design system's single source of truth.
- **Worker B — dark mode tokens.** Produces the full dark counterpart, with elevation expressed as colored bloom rather than flat shadow. Every light token must have exactly one dark mirror; Worker B runs a grep-based sanity check at the end.
- **Worker C — token consumers.** Does a find-and-replace pass across `viewer-template.html` styles and any inline styles in `components/*.tsx` to consume the new semantic tokens. Flags every hard-coded hex value or pixel number for manual review.

Runs in three parallel Cursor composer windows, ~10 minutes each.

### Verification

- `grep -E '#[0-9a-fA-F]{3,6}' src/ui/viewer-template.html` returns zero hits outside the `:root` + `[data-theme="dark"]` blocks.
- `grep -E '\bpx\b' src/ui/viewer-template.html` returns zero hits outside the token definitions themselves (everything else is rem-anchored via tokens).
- Light/dark toggle still works end-to-end.
- Existing e2e tests under `tests/e2e/` still pass (UI is not test-covered today, so this is the build-survives bar).

### Anti-patterns

- Do NOT introduce Tailwind, PostCSS, or a CSS-in-JS library.
- Do NOT rename tokens mid-migration — if a name is wrong, fix it in Phase 0 instead.
- Do NOT ship gradient-heavy palettes. Flat, high-contrast, one accent. Gradients are decoration; AiMemory is a tool.

---

## Phase 2: Layout primitives (Composer 2, parallel)

### Scope

Introduce three layout primitives that every higher-level component consumes. Put them in `src/ui/viewer/components/primitives/`:

```tsx
// Stack.tsx — vertical flex with a semantic gap token
<Stack gap="card-gap">...</Stack>

// Row.tsx — horizontal flex with alignment props
<Row align="center" justify="space-between" gap="4">...</Row>

// Panel.tsx — elevation + padding + border radius in one
<Panel elevation={1} padding="card-padding">...</Panel>
```

Plus `Grid.tsx`, `Divider.tsx`, `Badge.tsx`, `Chip.tsx`, `Button.tsx`, `IconButton.tsx`, `Tooltip.tsx`, `KeyboardShortcut.tsx`.

All primitives are pure visual components: no data, no hooks, no side effects. Every primitive is ≤ 60 lines, typed strictly, and documented via one usage example in a JSDoc block.

### What the three Composer workers do

- **Worker A** writes `Stack`, `Row`, `Grid`, `Divider`, `Panel`.
- **Worker B** writes `Badge`, `Chip`, `Button`, `IconButton`.
- **Worker C** writes `Tooltip`, `KeyboardShortcut`, plus a `primitives/index.ts` barrel and a single `PRIMITIVES.md` cheat-sheet inside the directory.

### Verification

- `Stack` / `Row` replace ≥ 50 `<div style={{ display: 'flex' }}>` usages across existing components. Run `rg 'display: .flex' src/ui/viewer/components` before and after; expected delta ≥ 50.
- Every primitive has at least one test fixture in `tests/e2e/viewer/primitives.test.tsx` that renders it headlessly via `bun test`.

### Anti-patterns

- Do NOT accept any prop whose type is `any`.
- Do NOT ship primitives that only work with one consumer — that's over-extraction. If `Panel` has three variants, keep three props, not three components.

---

## Phase 3: Card system refactor (Composer 2, parallel)

### Scope

Rebuild `ObservationCard`, `SummaryCard`, `PromptCard` on top of Phase 2 primitives. Current cards carry duplicated layout logic (`flex` rows, inline styles, per-type borders) — each is ~100–150 lines. Target: one `BaseCard` primitive + three ≤ 80-line consumers.

New card anatomy:

```
┌─────────────────────────────────────────────────────────┐
│ [source-dot] project / type / timestamp      [id badge] │
│                                                         │
│  Title of the observation                               │
│  Optional subtitle                                      │
│                                                         │
│  Short excerpt of the narrative or facts,               │
│  collapsed to 3 lines in the feed.                      │
│                                                         │
│  ┌──────────────┐  ┌────────┐  ┌───────┐                │
│  │ #concept-tag │  │ file.ts│  │ other │                │
│  └──────────────┘  └────────┘  └───────┘                │
└─────────────────────────────────────────────────────────┘
```

Every card must:

1. Display its **source** via a colored dot from Phase 0's source hue tokens (the current viewer has source tabs but no per-card source indicator — a major info loss when "All" is selected).
2. Display its **id** in a small monospace chip top-right — click copies `obs#N` to clipboard.
3. Collapse long narratives to 3 lines with "Show more" expansion. Keyboard-accessible.
4. Have keyboard shortcuts when focused: `Enter` expands, `Space` copies cite key, `y` yanks the full row as JSON to clipboard, `t` opens the timeline around this observation, `f` filters the feed to this project.
5. Be fully memoized — the SSE feed will push 100+ new rows per session and unnecessary re-renders will kill perceived performance.

### Composer assignment

- **Worker A** extracts `BaseCard.tsx` from the shared bits of the three current cards, deduplicating the footer / concept-chip / file-list / type-badge logic.
- **Worker B** rebuilds `ObservationCard.tsx` and `PromptCard.tsx` on `BaseCard`.
- **Worker C** rebuilds `SummaryCard.tsx` and writes a `CARDS.md` that documents the keyboard shortcuts + the anatomy diagram.

### Verification

- All three cards ≤ 80 lines each.
- A React Profiler trace on a feed of 200 cards shows no card re-rendering when an unrelated row is added via SSE. (Memoize on id + mutable field list — ignore `live` fields.)
- `aria-label`s on every interactive region; `role=`"`article`" on the card wrapper.
- Keyboard shortcuts work with `tabindex="0"` on the card root — no focus-trap hacks.

### Anti-patterns

- Do NOT nest `BaseCard` inside `ObservationCard` inside `ListItem`. Flat composition: one `<article>` per card.
- Do NOT re-compute `new Date(created_at_epoch).toLocaleString()` on every render. Use a `useRelativeTime` hook that updates once a minute.

---

## Phase 4: Source-aware feed + smart filters (Sonnet, sequential)

### Scope

Rebuild `App.tsx` + `Feed.tsx` + `Header.tsx` around **first-class multi-source awareness**. Today the viewer treats `claude` and `codex` as hardcoded sources. AiMemory has 15. The feed must:

1. Replace the hardcoded source tabs with a **scrollable source strip** that lists every source that has ever produced an observation, each with its Phase 0 color dot + count.
2. Pin the currently-selected source and allow multi-select (hold Shift-click, or press digit keys 1–9 for the top 9 sources). Selecting nothing = "All."
3. Add **type filters** (decision / bugfix / feature / refactor / discovery / change) as a secondary strip, operating independently of source filters.
4. Add a **date-range scrubber** with presets (last hour, today, this week, all time) plus a custom range picker.
5. Add a **search field** in the header that debounces at 200ms and hits `/api/search?query=...` for instant narrow-down (the feed is server-side so we don't ship 10k rows to the client — replace the current in-memory filter).
6. Show, under the active filters, a **filter summary chip row** that shows every active filter with an × to remove — clicking clears that filter, pressing `Escape` while focused clears all.

### Wiring

- Expose new worker-service queries (Phase 9 adds the sibling endpoints):
  - `GET /api/observations?sources=a,b&types=c,d&since=epoch&until=epoch&limit=50&cursor=...`
- Reactify filter state into a single reducer in `src/ui/viewer/state/filterReducer.ts` so it can be serialized to the URL (`?src=gemini-cli,cursor&type=bugfix&q=migration`) and shared.

### Verification

- URL round-trip: apply filters → copy URL → paste in new tab → identical feed renders.
- 10,000 synthetic rows from the Phase 9 dev-seed paginate smoothly; initial paint ≤ 150ms on mid-tier hardware.
- `useSSE` hook only appends rows that match current filters; no "SSE delivers a row, then feed hides it" flicker.

### Anti-patterns

- Do NOT store filter state in 9 separate `useState` calls. Reducer only.
- Do NOT ship a filter that doesn't serialize to the URL.

---

## Phase 5: Sources dashboard (Sonnet, sequential)

### Scope

A new top-level tab/route (`/#sources`) that answers "is every IDE producing data?" without a CLI. Replaces the vague "status" corner of the header with a real at-a-glance health view.

### Layout

```
┌─────────────────────────── Sources ──────────────────────────────┐
│                                                                  │
│   Total observations:  12,487       This week: 1,203  ▲ 18%      │
│   Active sources:      7 of 15      Last event: 2 minutes ago    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [claude-code] 4,102 obs   ● last event 12s ago   ▇▇▇▇▇▇▇▇▇▇     │
│  [gemini-cli]  2,041 obs   ● last event 2m ago    ▇▇▇▇▇▇           │
│  [cursor]      1,820 obs   ● last event 8m ago    ▇▇▇▇             │
│  [codex-cli]   1,400 obs   ● last event 1h ago    ▇▇▇              │
│  [kimi]          920 obs   ● last event 3h ago    ▇▇               │
│  [windsurf]      445 obs   ○ last event 2d ago    ▇                │
│  [opencode]      310 obs   ○ last event 5d ago    ▇                │
│                                                                  │
│  [openclaw]       —   not installed                              │
│  [openai codex vs code] —   not installed                        │
│  ...                                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

For each source:

- Colored dot + source label
- Lifetime observation count
- Seven-day count with week-over-week delta arrow + percent
- Last event timestamp, live-updated via SSE
- An inline 7-day activity sparkline (SVG, no chart lib — a simple `<path>` is ≤ 30 LOC)
- **Health dot:** green if last event < 24h, amber if < 7d, grey if > 7d, red if install is detected but the source has never produced data
- Not-installed sources are listed in a collapsed "not set up" section with a one-click "Install" button that shells out through the worker to `npx claude-mem install --ide <id>` — or links to the docs when the command requires interactive input.

### Data

Worker endpoints to add (Phase 9):

- `GET /api/dashboard/sources` → `[{ id, total, lastSeenMs, sevenDay: [n1..n7], wowDelta }]`
- `GET /api/dashboard/health` → worker uptime, DB size, Chroma collection size, pending-queue depth, recent errors

### Verification

- Kill the worker mid-view → the dashboard shows a red "worker unreachable" banner with a `Retry` button. Click restores without a full reload.
- Uninstall one IDE's hooks via `npx claude-mem uninstall` → dashboard re-detects within the SSE reconnect cycle and moves it to "not installed."

### Anti-patterns

- Do NOT pull a chart library for one sparkline type.
- Do NOT poll `/api/dashboard/sources` faster than once per minute. The SSE stream already informs the UI of new rows; the dashboard uses SSE to invalidate and refetch, not to replace the endpoint.

---

## Phase 6: Command palette (Sonnet, parallel with Phase 9)

### Scope

A `⌘K` / `Ctrl+K` command palette is the single most high-leverage addition for a developer-facing tool. It must cover:

1. **Search** — types the user's query and hits `/api/search`; results link to the observation drawer.
2. **Ask** — typing starts with `? ` (or pressing `Tab` after opening) routes to `/api/ask` (Phase 9 adds `POST /api/ask`); results appear inline with citations.
3. **Jump to source** — typing a source name or prefix matches and focuses the Sources dashboard filter.
4. **Actions** — explicit actions surfaced by item: `Open viewer`, `Open logs`, `Restart worker`, `Copy worker URL`, `Toggle theme`, `Open settings`, `Install IDE: <name>`, `Verify all (runs npm run verify)`.
5. **Recent** — shows 5 most recent observations when the palette first opens with no query.

### UX rules

- Opens in ≤ 80ms on any device (Opus + Sonnet both sign off that snappiness is non-negotiable).
- Arrow keys + `Enter` always work; mouse is optional.
- Fuzzy match using a tiny in-tree matcher (e.g. port `fzf`-style scoring to TS, ~100 lines) — no dependency.
- Result groups are collapsible with `Tab`. Sticky section headers ("Memory," "Actions," "Sources").
- Dismissed with `Escape`. Focus returns to the previously-focused element.

### Verification

- Playwright smoke (Phase 10): open palette → type `mig` → first result is observation containing "migration" → press Enter → focuses the matching card in the feed.
- Palette keystroke latency ≤ 16ms per keypress (measured via React Profiler on 10k observations indexed).

### Anti-patterns

- Do NOT ship a cloud search dependency. Palette search hits the local worker only.
- Do NOT replicate every feature in the palette and menus. Once a command is in the palette, the menu version can be removed.

---

## Phase 7: Ask panel + citation surface (Opus, sequential)

### Scope

`npx claude-mem ask` already works. The viewer needs its equivalent surface so users don't drop to the terminal for questions. The panel:

1. Fixed bottom sheet (40% of viewport height by default, drag-resizable) with one input and one results area.
2. `⌘K` opens the palette; `⌘J` opens the ask panel directly.
3. Question submit hits `POST /api/ask { question, limit, project? }` (Phase 9).
4. Results render exactly like the CLI: a synthesized answer (if a model is configured in settings) or a cite-list fallback, with **citations that are clickable and deep-link to the corresponding observation card in the feed**. Hovering a citation highlights the source card.
5. History of questions stored locally in `localStorage` (`aimemory.ask.history`); arrow-up in the input cycles through them.

### Citation-card coupling

Citation chips render as `[obs#42]` with the Phase 0 source hue as a left-border accent. Clicking scrolls the feed to the card, pulsing it for 1.2s so the user can re-find it.

### Verification

- User types "how did I fix the migration?" → panel shows a bullet list of 5 cited observations. Clicking `[obs#42]` scrolls the feed to observation 42 and pulses it.
- 200 characters of narrative fit without horizontal scroll at 1024px wide.
- `aimemory.ask.history` survives page reload.

### Anti-patterns

- Do NOT paywall the synthesized answer. Default is the cite list; `--model` is strictly opt-in.
- Do NOT fetch citations twice (once for ask, once for the feed). The panel reuses the feed's cache keyed by observation id.

---

## Phase 8: Settings redesign (Opus, sequential)

### Scope

The current `ContextSettingsModal` is a 504-line monolith. Replace it with a sectioned left-nav settings page:

| Section | Settings surfaced |
|---|---|
| **General** | Theme (auto / light / dark / sepia), viewer port, logs verbosity |
| **Sources** | Per-IDE enable, per-IDE tuning (e.g. `captureFileReads`) — see `.plan/elevation.md` Phase 5 — with a copy button for the underlying `~/.claude-mem/settings.json` snippet |
| **Search** | Reranker toggles (project boost, useful boost, half-life days), dedupe threshold |
| **Context injection** | Max bytes, freshness window, excluded projects, what to include |
| **Privacy** | Tag-stripping controls (read-only info; the default is always-on), retention policy, data export / delete |
| **MCP** | Enable / disable the MCP server, list of IDEs currently consuming MCP, per-tool enablement |
| **About** | Version, worker uptime, DB size, "Run `npm run verify`" action button |

All sections read/write through `GET|PUT /api/settings` (already exists). Changes are optimistic with toast-style confirmations and a visible "unsaved changes" banner when the user navigates away.

### Information density

Section headers are ≤ 20px, section bodies grouped in `Panel` primitives with `space-card-gap` between fields. No accordion — users complain. Every field has an inline hint, not a tooltip.

### Verification

- Mutate every setting in the UI → refresh page → mutation persists.
- Navigate between sections with unsaved changes → confirmation prompt blocks loss.
- Export-data action produces a downloadable JSON with all observations for the selected project.

### Anti-patterns

- Do NOT gate any existing setting behind "Advanced." Show everything; power users read more than they click.
- Do NOT break settings into 12 files. One `SettingsPage.tsx` + one `SettingsSection.tsx` primitive.

---

## Phase 9: API additions (GPT 5.4, parallel with Phase 6)

### Scope

New endpoints needed by phases 4–8. GPT 5.4 writes them with full thinking about pagination, cursor semantics, filter composition, and rate-limiting implications. The routes live in `src/services/worker/http/routes/`.

| Method | Path | Purpose | Phase |
|---|---|---|---|
| `GET` | `/api/dashboard/sources` | Per-source lifetime + 7-day counts + last-seen + WoW delta | 5 |
| `GET` | `/api/dashboard/health` | Worker uptime, DB size, Chroma size, pending-queue depth, recent error count | 5 |
| `GET` | `/api/observations?sources=&types=&since=&until=&q=&cursor=&limit=` | Unified filtered feed with cursor pagination; supersedes the ad-hoc filter logic in `App.tsx` | 4 |
| `POST` | `/api/ask` | `{ question, limit?, project?, model? }` → `{ synthesis | null, citations }`; default path returns citations only | 7 |
| `GET` | `/api/mcp/status/detailed` | Which IDEs currently reference `claude-mem` in their MCP configs, via a filesystem probe of each integration's paths | 5, 8 |
| `POST` | `/api/actions/verify` | SSE endpoint that shells out to `npm run verify --json` and streams each row as it completes | 5 |

### Contract notes

- Every endpoint accepts `Accept: text/event-stream` where it makes sense (dashboard refresh, verify progress).
- Every endpoint is idempotent except `POST /api/ask` and `POST /api/actions/verify`.
- Every endpoint sets `Cache-Control: no-store` for live data; static-ish data (e.g. `/api/dashboard/sources` with a fresh etag) can set a 10-second cache.

### Testing

- One unit test per endpoint under `tests/worker/http/` asserting the shape of a successful response.
- One e2e test under `tests/e2e/` that seeds the dev DB with 500 rows (Phase 9 seeder exists), hits each endpoint, and snapshots the top-level shape.

### Anti-patterns

- Do NOT put pagination logic in the route; reuse `PaginationHelper` from `src/services/worker/PaginationHelper.ts`.
- Do NOT expose the worker PID without a local-origin check; the middleware `requireLocalhost` covers this.

---

## Phase 10: Testing, a11y, performance (GPT 5.4, sequential)

### Scope

1. **Playwright smoke** under `tests/viewer/` — 6 flows:
   - Load feed with seeded dev DB; assert 50 cards render in < 1500ms.
   - Open command palette, type `mig`, press Enter, assert feed scrolled to a matching observation.
   - Toggle theme; assert no FOUC.
   - Apply three filters; reload; assert state restored from URL.
   - Open settings, change reranker half-life, save, reload, assert persistence.
   - Open ask panel, submit "what is claude-mem?"; assert cite list renders.

2. **Axe-core accessibility audit** on every route. Target: zero serious violations, ≤ 2 moderate (with documented waivers).

3. **Lighthouse** run on the served HTML. Targets:
   - Performance ≥ 95
   - Accessibility ≥ 98
   - Best Practices ≥ 95
   - First Contentful Paint ≤ 800ms

4. **Bundle audit.** `esbuild --analyze` on the viewer. Target: ≤ 220 KB minified (current is ~270 KB; remove GitHub-star button baggage, replace icons with a single-file SVG sprite, tree-shake moment-style date libs).

5. **SSE load test.** A short script that fires 1,000 synthetic observations through the worker in 60 seconds; the viewer must keep up without dropped messages or perceptible jank.

### Deliverables

- `tests/viewer/` populated with the six Playwright specs and an `axe-audit.ts`.
- `docs/public/PERFORMANCE.md` with the Lighthouse scores, bundle breakdown, and SSE load-test methodology.
- CI workflow `.github/workflows/viewer.yml` that runs the Playwright suite on Ubuntu (Playwright on macOS/Windows is slow and redundant given the viewer runs in the same browser engine across OSes).

### Anti-patterns

- Do NOT bring in Jest or Vitest. `bun test` covers unit/integration; Playwright covers e2e in a real browser. Two runners, not three.
- Do NOT write smoke tests that depend on a specific row count. Seed → assert "≥ 50" not "= 50."

---

## Phase 11: Polish + motion + copy (Opus, sequential)

### Scope

The hardest-to-delegate phase. Opus does a taste pass over every screen shipped in phases 1–8, focusing on:

### 11.a — Micro-interactions

- Card expansion uses the Phase 0 in-easing (160ms). Collapsed-to-expanded height change uses a CSS grid row animation (no `max-height` hack).
- Source strip scroll indicators fade in/out on edge proximity.
- Theme toggle cross-fades root colors rather than flashing; uses `view-transitions` API on browsers that support it, falls back to an opacity swap.
- Scroll-to-top button slides in from below after 600px of scroll, not at 0 scroll.
- SSE new-row insertion animation: card expands from 0 height with a 4px left accent-color border that fades to the resting color over 800ms — a subtle "fresh" tint.

### 11.b — Empty states

- Fresh install feed: a single large centered block that reads "No memories yet." under a 72px source strip showing every detected IDE with a dotted outline (not-yet-producing). Bullet list under it: "Start a session in any of these tools. Memories appear here live."
- Search with zero hits: "No matches. Try `⌘K` to ask a question instead." with a pre-filled ask input prompt.
- Offline state (worker down): banner at top with a spinning retry indicator; feed remains visible but greyscaled.

### 11.c — Copy

Every string in the UI goes through one Opus pass. Rules:

- No "Oops" / "Whoops" / "Uh-oh." Tool language.
- No exclamation marks outside success toasts.
- Verb-first for action labels ("Run verification" not "Verification runner").
- Accurate: "247 observations across 5 sources" not "Lots of memories!"
- Error text ends with an actionable suggestion, never only a diagnosis.

### 11.d — Keyboard

Full keyboard map surfaced in a `?`-key help modal:

```
Global
  ⌘K / Ctrl-K     Command palette
  ⌘J / Ctrl-J     Ask panel
  ⌘,             Open settings
  ?              Show keyboard shortcuts
  g then h       Go to home (feed)
  g then s       Go to sources
  g then c       Go to configuration

Feed
  j / k          Next / previous card
  Enter          Expand card
  y              Copy cite key (obs#N)
  o              Open observation detail
  t              Open timeline around observation
  f              Filter feed to this observation's project
  /              Focus search

Filters
  1..9           Toggle top-N sources
  Shift-click    Multi-select sources
  Esc            Clear all filters

Modals
  Esc            Close
  ⌘↵              Submit (in ask panel / settings)
```

### Deliverable

A final commit titled `polish: Phase 11 — motion, empty states, copy, keyboard` with an **artifact video** showing all six flows from Phase 10's Playwright suite at 60fps. Video lives at `/opt/cursor/artifacts/viewer-2-walkthrough.mp4`.

### Verification

- Every keybinding in the help modal actually works end-to-end.
- `prefers-reduced-motion: reduce` turns every animation into an instant transition.
- Lighthouse "Best Practices" score still ≥ 95 after motion additions.

---

## Delivery checklist

Each phase lands as its own commit. Tag the full rollup as `viewer-2.0`.

| Phase | Owner | Reviewer | LOC budget | Acceptance |
|---|---|---|---|---|
| 0 | Opus | Sonnet | — (doc) | `.plan/viewer-ui-direction.md` committed |
| 1 | Composer ×3 | Sonnet | ≤ 400 in `tokens.css` | `grep` gates pass |
| 2 | Composer ×3 | Opus | ≤ 800 in `primitives/` | ≥ 50 flex usages replaced |
| 3 | Composer ×3 | Opus | ≤ 400 total across 4 card files | React Profiler trace |
| 4 | Sonnet | Opus | ≤ 600 | URL round-trip works |
| 5 | Sonnet | Opus | ≤ 500 | Sources dashboard passes the 7 unit assertions |
| 6 | Sonnet | GPT 5.4 | ≤ 500 | Palette opens in ≤ 80ms on the SSE stress seed |
| 7 | Opus | Sonnet | ≤ 450 | Ask citations deep-link + pulse |
| 8 | Opus | Sonnet | ≤ 800 | Settings persist + every toggle round-trips |
| 9 | GPT 5.4 | Sonnet | ≤ 700 across ≤ 5 files | Unit test per endpoint passes |
| 10 | GPT 5.4 | Opus | ≤ 1200 in `tests/viewer/` | Playwright + Axe + Lighthouse targets met |
| 11 | Opus | GPT 5.4 | ≤ 500 | Walkthrough video attached |

**Total LOC budget**: ≤ 7,500 across source + tests. If any phase exceeds its budget, it stops and merges what exists; follow-up work gets a new phase number.

---

## Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Phase 0's palette doesn't survive 15 sources at 10px dot size | High | Opus ships a 10px-scale swatch contact sheet as part of Phase 0; reviewer (Sonnet) validates with a physics-engine squint test. Fallback: reduce source dot resolution to tier buckets (Claude family, Codex family, Gemini family, Kimi, Cursor, OSS). |
| Parallel Composer windows introduce merge conflicts | Medium | Token, primitive, and card work live in disjoint directories — tokens.css, `primitives/`, `cards/` — so conflicts are bounded. Worker A finishes tokens first and the rest rebase. |
| `/api/dashboard/sources` is too slow on a DB with 10k+ rows | Medium | Phase 9 pre-aggregates into a materialized-view-style SQLite table that the SSE pipeline keeps in sync on insert. Dashboard queries become O(sources), not O(rows). |
| Playwright against the Bun-served bundle is flaky | Medium | Use the Chromium engine in headless mode with a fixed viewport and a fake clock. Snapshot the DB to disk before each spec. |
| Opus runs out of time in Phase 11 | Low-medium | Phase 11 is last; if cut short, 11.a + 11.b are mandatory, 11.c + 11.d are "nice to have" (keyboard map can ship as a separate follow-up). |

---

## Why this plan

Every phase ties back to a specific, observable UI failure of the current viewer:

- Generic GitHub-blue accent and no per-source visual identity → Phase 0 + Phase 1 + Phase 3 card dots
- Hardcoded two-source tabs despite shipping 15 integrations → Phase 4 + Phase 5
- No way to get from "I vaguely remember fixing this" to an observation without SQL or terminal → Phase 6 + Phase 7
- Settings modal that's a 504-line wall → Phase 8
- No story for "is memory working?" without logs → Phase 5 + Phase 9
- No test story → Phase 10
- Feels hand-built, not crafted → Phase 11

The multi-model loadout is chosen for the shape of each phase, not model hype: Composer for repetitive migrations that need zero invention, Sonnet for careful multi-file refactors, Opus for taste-heavy visual work, GPT 5.4 for architectural breadth and end-to-end concerns. The dependency graph is the shortest path through the work that still allows parallelism. Every budget is tight enough to force good decisions and loose enough that a phase can breathe.

If every phase ships as specified, the viewer becomes the *strongest* surface of AiMemory — the thing people open Cursor to screenshot.
