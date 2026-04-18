---

# AiMemory — Project Plan & Architecture

## Mission

claude-mem is a Claude Code plugin providing persistent, cross-session memory. It captures tool usage, compresses observations via the Claude Agent SDK, and injects relevant context into future sessions. AiMemory builds on that core with a local worker, SQLite and Chroma persistence, and support for **15+** IDE and CLI integrations through a unified hook and viewer stack.

---

## Current State (as of April 18, 2026)

**Shipped and working**

- Claude Code plugin hooks, worker service, SQLite persistence, Chroma-backed semantic sync, and the React viewer served at `http://localhost:37777`.
- **Elevation / integration work**: universal IDE coverage, shared integration contract, `npx claude-mem doctor` with IDE-oriented diagnostics, e2e smoke harness, hook payload tests, search reranking, and distribution-oriented developer commands (`dev:server`, seed, `check`).
- **Viewer UI 2.0 (phases 0–11)**: design tokens, layout and card primitives, source-aware feed, filter reducer and URL sync, Sources dashboard, command palette, Ask panel, dashboard and Ask API routes, dev seed/migrations path, polish (empty states, keyboard help, feed improvements), plus **IconButton** and **Tooltip** primitives and tooltip-related tokens merged from the parallel `viewer-ui-2-1657` line.

**Tests**

- End-to-end suite: **105 passing**; verification matrix **15/15** as exercised by the elevation plan.

**Remaining / gaps**

- **Phase 12** (see below): finish-line items from the original 12-phase Viewer 2.0 plan that extend beyond what is already merged—principally the **Settings redesign** (Phase 8 in `.plan/viewer-ui.md`) and the **full Phase 10** testing and performance bar (Playwright viewer specs, axe, Lighthouse, bundle budget, SSE stress) where not yet fully satisfied.
- Any minor UI or API drift versus `.plan/viewer-ui.md` should be tracked against those documents.

## Architecture Overview

**Lifecycle hooks (five stages)** — executed in order for each session:

1. **SessionStart** — session begins; hook runs before user interaction.
2. **UserPromptSubmit** — user prompt submitted; can observe or shape submission.
3. **PostToolUse** — after tool execution; captures tool outcomes for memory.
4. **Summary** — compression / summarization window for observations.
5. **SessionEnd** — teardown and flush for the session.

**Worker service** — Express HTTP API on **port 37777**, **Bun-managed** (`src/services/worker-service.ts`). Handles async AI processing, API routes, and serving the viewer.

**SQLite** — `~/.claude-mem/claude-mem.db` via `src/services/sqlite/`.

**Chroma** — `ChromaSync` (`src/services/sync/ChromaSync.ts`) keeps vector embeddings aligned for semantic search.

**Viewer** — React app under `src/ui/viewer/`, built into `plugin/ui/viewer.html` and loaded at **http://localhost:37777**.

**Data flow (high level)**

```text
┌──────┐     ┌─────────────┐     ┌─────────┐     ┌────────┐     ┌────────────┐
│ Hook │ ──► │ Worker API  │ ──► │ SQLite  │     │ Chroma │     │ Viewer UI  │
└──────┘     └─────────────┘     └─────────┘     └────────┘     └────────────┘
                  │                    │               ▲                │
                  │                    └───────────────┴────────────────┘
                  │                         embeddings / search
                  └────────────────────────────────────────────────────►
```

Hook events and payloads reach the worker; durable state lives in SQLite; Chroma holds embeddings for retrieval; the viewer reads the same APIs and SSE streams for the live feed.

## Branch Consolidation Record

| Branch | Role | Incorporated into main? | Contribution / notes |
|--------|------|-------------------------|----------------------|
| **cursor/viewer-ui-2-40d8** | Best base | Yes (history absorbed) | **Base consolidation**: elevation infrastructure plus Viewer UI 2.0 phases **0–10**. Unique artifacts on that line included `FilterSummary.tsx`, `KeyboardHelpModal.tsx`, `SourceDot.tsx`, `useRoute.ts`, `useSourcesDashboard.ts`, `fuzzy.ts`. |
| **cursor/elevation-plan-cb87** | Elevation | Fully absorbed via 40d8 | **12 commits / 51 files**: IDE coverage (Claude, Codex, Kimi, Gemini, Cursor, etc.), e2e smoke, hook fixtures, uniform Integration contract, `npx claude-mem doctor --ide/--fix/--json`, search reranker, distribution hardening, `dev:server` + seed + check, verification matrix (**105 e2e**, **15/15**). No separate retention needed once 40d8 landed. |
| **cursor/viewer-ui-2-1657** | Parallel Viewer 2 | Partially absorbed | **18 commits / 87 files** parallel track. **Cherry-picked into main**: `IconButton.tsx`, `Tooltip.tsx`, `--color-bg-tooltip`, `--duration-ui` alias. Other deltas superseded by 40d8. |
| **cursor/viewer-ui-2-4bc6** | Earlier UI consolidation | Superseded | Earlier consolidated UI attempt; replaced by 40d8. |
| **cursor/viewer-ui-2-8f17** | Broad UI spike | Superseded | Superseded by later consolidation. |
| **cursor/viewer-ui-2-ada9** | Earliest UI/API spike | Superseded | Superseded by 40d8 line. |
| **cursor/viewer-ui-2-0-0d12** | Legacy / unknown | Excluded / cleanup | Listed for remote deletion if present; content unverified. |

**Why main is canonical:** Local `main` at **`2a26787`** stacks the full **40d8** history (including **elevation-plan-cb87**), completes Viewer 2.0 through **phase 11** in product terms, and adds **1657** primitives and tokens named above.

## Viewer UI 2.0 — Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 0 | Visual direction | **Complete** (`.plan/viewer-ui-direction.md`) |
| 1 | Design tokens | **Complete** (`src/ui/tokens.css`) |
| 2 | Layout primitives | **Complete** |
| 3 | Card system refactor | **Complete** |
| 4 | Filter state reducer | **Complete** |
| 5 | Sources Dashboard | **Complete** |
| 6 | Command Palette | **Complete** |
| 7 | Ask Panel | **Complete** |
| 8 | URL-synced filters | **Complete** |
| 9 | Dashboard + Ask API endpoints | **Complete** |
| 10 | Seed script / schema migration | **Complete** |
| 11 | Polish (empty states, keyboard shortcuts, feed improvements) | **Complete** |
| 12 | Settings redesign & full test/perf bar (see `.plan/viewer-ui.md` Phases 8 & 10 scope) | **Planned** — sectioned Settings page replacing the large modal; Playwright viewer flows, axe, Lighthouse, bundle/SSE budgets where not already met. `.plan/viewer-ui-direction.md` covers Phase **0** only (visual grammar). |

## Integration Matrix

Statuses reflect the elevation/universal-integration effort: integrations are first-class in hooks, doctor, and viewer source styling unless noted.

| Integration | ID / notes | Status |
|-------------|------------|--------|
| Claude Code | `claude-code` | Supported |
| Claude Desktop | `claude-desktop` | Supported |
| Codex CLI | `codex-cli` | Supported |
| Codex VS Code | `codex-vscode` | Supported |
| Gemini CLI | `gemini-cli` | Supported |
| Gemini VS Code | `gemini-vscode` | Supported |
| Kimi | `kimi` | Supported |
| Kimi Code | `kimi-code` | Supported |
| Cursor | `cursor` | Supported |
| Windsurf | `windsurf` | Supported |
| OpenCode | `opencode` | Supported |
| OpenClaw | `openclaw` | Supported |
| Copilot CLI | `copilot-cli` | Supported |
| Antigravity | `antigravity` | Supported |
| Goose | `goose` | Supported |
| Crush | `crush` | Supported |
| Roo Code | `roo-code` | Supported |
| Warp | `warp` | Supported |

## Development Workflow

| Task | Command / notes |
|------|-----------------|
| Build and sync plugin + restart worker | `npm run build-and-sync` |
| Run worker (Bun, port **37777**) | `npm run worker:start` or marketplace `worker:restart` after sync; entry via `plugin/scripts/worker-service.cjs` |
| Seed dev database | `npm run dev:seed` (fresh: `npm run dev:seed:fresh`) |
| Dev server (Phase 9 workflow) | `npm run dev:server` |
| E2e tests | `npm run test:e2e` (alias: `npm run smoke`) |
| Full check | `npm run check` (typecheck, tests, e2e, dist check) |

## Primitive Component Library

Path: `src/ui/viewer/components/primitives/`

Exports (from `index.ts`): **Stack**, **Row**, **Panel**, **Badge**, **Chip**, **Button**, **Divider**, **KeyboardShortcut**, **SourceDot**, **IconButton**, **Tooltip**.

### Stack

`interface StackProps extends React.HTMLAttributes<HTMLDivElement>`

- `gap?: '0' \| '1' \| … \| '8' \| 'card-gap' \| 'section-gap' \| 'feed-gutter'`
- `align?: 'stretch' \| 'start' \| 'center' \| 'end'`
- `as?: keyof JSX.IntrinsicElements` (default `'div'`)

### Row

`interface RowProps extends React.HTMLAttributes<HTMLDivElement>`

- `gap?:` same token set as Stack except `section-gap`
- `align?: 'stretch' \| 'start' \| 'center' \| 'end' \| 'baseline'`
- `justify?: 'start' \| 'center' \| 'end' \| 'space-between' \| 'space-around'`
- `wrap?: boolean`

### Panel

`interface PanelProps extends React.HTMLAttributes<HTMLDivElement>`

- `elevation?: 0 \| 1 \| 2 \| 3`
- `padding?: '0' \| '2' \| … \| '7' \| 'card-padding'`
- `radius?: 'sm' \| 'md' \| 'lg'`
- `as?: keyof JSX.IntrinsicElements`

### Badge

`interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>`

- `tone?: 'neutral' \| 'accent' \| 'success' \| 'warning' \| 'error' \| 'info'`
- `subtle?: boolean`
- `mono?: boolean`

### Chip

`interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`

- `active?: boolean`
- `icon?: React.ReactNode`
- `removable?: boolean`
- `onRemove?: () => void`

### Button

`interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`

- `variant?: 'primary' \| 'secondary' \| 'ghost' \| 'danger'`
- `size?: 'sm' \| 'md'`
- `icon?: React.ReactNode`

### Divider

`interface DividerProps`

- `orientation?: 'horizontal' \| 'vertical'`
- `style?: React.CSSProperties`

### KeyboardShortcut

`interface KeyboardShortcutProps`

- `keys: string[]`
- `style?: React.CSSProperties`

### SourceDot

`interface SourceDotProps`

- `source: string | null | undefined`
- `size?: number` (default `8`)
- `title?: string`
- `style?: React.CSSProperties`

### IconButton

`interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`

- `label: string` (accessibility; sets `aria-label`)
- `size?: 'sm' \| 'md' \| 'lg'`
- `variant?: 'ghost' \| 'secondary'`
- `children: React.ReactNode`

### Tooltip

`interface TooltipProps`

- `content: string`
- `children: React.ReactElement`
- `placement?: 'top' \| 'bottom'`

## Design Token Reference

**Source file:** `src/ui/tokens.css` — single source of truth; no hex literals outside this file per project rules.

**Semantic colors**

- **Surfaces:** `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-bg-header`, `--color-bg-card`, `--color-bg-card-hover`, `--color-bg-input`, `--color-bg-overlay`, `--color-bg-backdrop`, `--color-bg-tooltip`
- **Borders:** `--color-border-primary`, `--color-border-secondary`, `--color-border-strong`, `--color-border-focus` (+ legacy `--color-border-*` for summary/prompt/observation where still referenced)
- **Text:** `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-text-muted`, `--color-text-inverse`, plus header/title/subtitle/logo/button variants

**Motion**

- `--motion-ui` (120ms), `--motion-card` (180ms), `--motion-modal` (240ms)
- `--duration-ui` — alias of `--motion-ui` for consumers such as IconButton
- `--ease-in`, `--ease-out`; `prefers-reduced-motion: reduce` forces motion tokens to `0ms`

**Elevation**

- `--elev-0` … `--elev-3` — layered shadows; dark theme uses violet-tinted bloom per direction doc
- `--shadow-focus` — focus ring

**Source hues**

- `--source-claude-code`, `--source-claude-desktop`, `--source-codex-cli`, `--source-codex-vscode`, `--source-gemini-cli`, `--source-gemini-vscode`, `--source-kimi`, `--source-kimi-code`, `--source-cursor`, `--source-windsurf`, `--source-opencode`, `--source-openclaw`, `--source-copilot-cli`, `--source-antigravity`, `--source-goose`, `--source-crush`, `--source-roo-code`, `--source-warp`, `--source-all`, `--source-default`

**Typography**

- `--font-ui`, `--font-mono`, `--font-terminal`
- Scale: `--text-xs` through `--text-3xl`

**Spacing / radii**

- `--space-1` … `--space-10`, semantic aliases `--space-card-padding`, `--space-card-gap`, `--space-section-gap`, `--space-feed-gutter`
- `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`

## Roadmap

### Immediate (Phase 12 completion)

Per `.plan/viewer-ui.md` (Phases **8** and **10** as originally scoped): ship the **sectioned Settings experience** (left nav, grouped panels, persistence guarantees) and close the **testing / a11y / performance** checklist (viewer Playwright flows, axe, Lighthouse targets, bundle analysis, SSE load characterization) wherever gaps remain versus that document.

### Near-term

- Continue **distribution hardening** implied by elevation phases **8–10** in the broader plan: reproducible installs, doctor-driven fixes, CI-friendly verification.
- **Pro features** remain **headless** in this repo: same `localhost:37777` API surface; commercial UI layers attach externally and validate licenses without closing core endpoints.

### Long-term

- **Memory Stream UI (Pro)** — enhanced timeline aligned with Pro architecture in `CLAUDE.md`
- **Advanced filtering and timeline scrubbing** (Pro-tier UX)
- **Plugin marketplace** improvements for discovery and updates

## Privacy & Security

**`<private>…</private>` tags** — User-controlled regions that must not be stored. Stripping runs at the **hook layer** (edge) before payloads reach the worker or database. Shared helpers: `src/utils/tag-stripping.ts`.

**Hook exit codes** (Claude Code contract)

| Code | Meaning |
|------|---------|
| **0** | Success or graceful shutdown |
| **1** | Non-blocking error (stderr shown; session continues) |
| **2** | Blocking error (stderr surfaced to Claude for correction) |

Worker-side failures often still exit **0** at the hook boundary to avoid bad Windows Terminal behavior; logging retains ERROR-level detail. See `private/context/claude-code/exit-codes.md` for the full matrix.

## File Structure Reference

| Path | Purpose |
|------|---------|
| `<project-root>/src/` | Application and viewer source |
| `<project-root>/plugin/` | Built plugin (hooks, scripts, UI bundle, skills) |
| `~/.claude/plugins/marketplaces/thedotmack/` | Installed marketplace copy after sync |
| `~/.claude-mem/claude-mem.db` | SQLite database |
| `~/.claude-mem/chroma/` | Chroma vector store |
| `~/.claude-mem/settings.json` | Runtime settings |

---
