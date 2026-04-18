# AiMemory — Project Plan & Architecture

> **Audience.** This document is the single source of truth for any engineer — human or AI agent — picking up work on AiMemory. It describes what is built, how it is wired, every major surface by file path, and exactly what remains to be done in **Phase 12**. Treat every file path, route, token, and prop signature here as **verified against the repository at the time of writing** (commit `46ae78b` on `main`).

---

## 0. How to use this document

1. **Orienting yourself.** Read §1 (Mission) and §2 (Current State) first. Then skim §3 (Architecture) and §4 (Directory Map) to get a mental model.
2. **Making changes.** If you are adding or modifying a feature, find the matching subsystem in §3–§9 and look up the concrete file paths before touching code.
3. **Executing Phase 12.** §11 is an executable spec. Every task has: file paths to touch, contracts to honor, acceptance criteria, and anti-patterns to avoid. You should be able to start a subagent with one sub-task from §11 and have them succeed without additional context.
4. **Don't repeat history.** §10 (Branch Consolidation Record) is a permanent audit trail of which branches became `main` and which were archived. Do not resurrect deleted branches — cherry-pick from `main` history instead.

Conventions used in this document:

- File paths are **always** relative to the repo root unless explicitly marked `~/...` (user home) or `/...` (absolute).
- Code identifiers appear in `backticks`.
- Every claim that names a line of code cites a file; do not trust any claim that does not.
- When this document says "the viewer" it means the React app under `src/ui/viewer/`, served by the worker.
- When it says "the worker" it means the Express service in `src/services/worker-service.ts` plus its domain modules under `src/services/worker/`.

---

## 1. Mission

claude-mem is a Claude Code plugin providing persistent, cross-session memory. It captures tool usage, compresses observations via the Claude Agent SDK, and injects relevant context into future sessions. **AiMemory** extends that core with:

- A local HTTP worker on **port 37777** that processes observations and serves a React viewer.
- **SQLite** for durable state and **Chroma** for vector embeddings and semantic retrieval.
- A uniform `Integration` contract so **15+ IDE / CLI surfaces** can feed the same memory pipeline.
- An `npx claude-mem` CLI that installs, diagnoses (`doctor`), queries (`ask`, `search`), and manages the worker across macOS / Linux / Windows.

The product promise is: _no matter which editor or agent stack you use today, your memory is there tomorrow, and you can see exactly what was captured and why._

---

## 2. Current State (as of April 18, 2026)

### 2.1 Shipped and verified

**Core plugin + worker**

- Claude Code plugin hooks (`plugin/hooks/hooks.json`) registered for `Setup`, `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PreToolUse` (Read), `Stop`, `SessionEnd`.
- Worker service on port 37777 (`src/services/worker-service.ts`) with background initialization, readiness endpoint, SSE broadcaster (`src/services/worker/SSEBroadcaster.ts`), session manager, database manager, and 10 route handlers (see §5).
- SQLite store under `~/.claude-mem/claude-mem.db` with migrations (`src/services/sqlite/migrations/runner.ts`) and per-domain stores: `SessionStore`, `Observations`, `Summaries`, `Prompts`, `Timeline`, `PendingMessageStore`, `SessionSearch`.
- Chroma embeddings under `~/.claude-mem/chroma/` kept in sync by `src/services/sync/ChromaSync.ts`.

**IDE and CLI coverage (Elevation work — fully absorbed into `main`)**

- Tier-1 installers: `src/services/integrations/{CursorHooksInstaller,GeminiCliHooksInstaller,WindsurfHooksInstaller,OpenCodeInstaller,CodexCliInstaller,OpenClawInstaller}.ts` + `src/services/integrations/registry.ts` registry.
- Tier-2 MCP integrations split one-file-per-IDE in `src/services/integrations/mcp/`: `antigravity`, `claude-desktop`, `copilot-cli`, `crush`, `goose`, `kimi`, `roo-code`, `warp` + `_shared.ts`.
- Uniform `Integration` contract in `src/services/integrations/types.ts` with `detect / install / uninstall / doctor / backupPaths`.
- Shared backup helper at `src/services/integrations/_backup.ts` (symmetric install/uninstall via `~/.claude-mem/backups/<ts>/`).
- npx CLI commands under `src/npx-cli/commands/`: `install.ts`, `uninstall.ts`, `doctor.ts` (with `--ide`, `--fix`, `--json`), `ask.ts`, `runtime.ts`, `ide-detection.ts`.
- End-to-end harness at `tests/e2e/harness.ts` plus per-phase e2e specs (`phase2-backup`, `phase2-uninstall`, `phase3-doctor`, `phase6-ask`, `phase6-reranker`, `phase8-dist-checks`, `phase9-dev-experience`, `phase10-verification-matrix`, `per-ide`, `universal-coverage`, `adapter-fixtures`). The verification matrix asserts 15/15.

**Viewer UI 2.0 — Phases 0–11 merged**

- Tokens: `src/ui/tokens.css` is the single source of truth (neutral scale, accent, 18 `--source-*` hues, semantic surfaces including `--color-bg-tooltip`, motion tokens with `--duration-ui` alias, elevation `--elev-0..3`, type + spacing scales, `prefers-reduced-motion` respected).
- App shell: `src/ui/viewer/App.tsx` composes `Header`, `SourceStrip`, `FilterSummary`, `Feed`, `SourcesDashboard`, `CommandPalette`, `AskPanel`, `KeyboardHelpModal`, `ContextSettingsModal`, `LogsDrawer`, `ScrollToTop`.
- Primitives: `src/ui/viewer/components/primitives/` exports `Stack`, `Row`, `Panel`, `Badge`, `Chip`, `Button`, `Divider`, `KeyboardShortcut`, `SourceDot`, `IconButton`, `Tooltip`.
- State and routing: `src/ui/viewer/state/filterReducer.ts` (URL-serialized filter state), `src/ui/viewer/hooks/useRoute.ts` (`feed` | `sources`), `useFilterState.ts`, `useSSE.ts`, `useSettings.ts`, `useSourcesDashboard.ts`, `useTheme.ts`, `usePagination.ts`, `useGitHubStars.ts`, `useSpinningFavicon.ts`, `useStats.ts`, `useContextPreview.ts`.
- Cards: `BaseCard.tsx`, `ObservationCard.tsx`, `SummaryCard.tsx`, `PromptCard.tsx` consume tokens and primitives.
- Dashboard + Ask: `SourcesDashboard.tsx` consumes `GET /api/dashboard/sources` and `/api/dashboard/health`; `AskPanel.tsx` consumes `POST /api/ask`. `CommandPalette.tsx` powers `⌘K`, `AskPanel` powers `⌘J`, `KeyboardHelpModal` powers `?`.
- Dev workflow: `scripts/seed-dev-db.js` (500-row realistic seed into `~/.claude-mem-dev/`) + `scripts/dev-server.js` (starts worker on dev port `37780` against the dev DB, seeds on first run).

**Test status (elevation work as merged)**

- Unit + integration suite under `tests/` (domains include `sqlite/`, `worker/`, `context/`, `servers/`, `sdk/`, `infrastructure/`, `integration/`, `hooks/`, `shared/`, `supervisor/`, `services/`, `utils/`). 1538 passing, 18 pre-existing failing (logger coverage, observation I/O handlers, worker-json-status — all unrelated to the viewer and tracked for a future pass).
- End-to-end suite: 104 passing, 1 pre-existing failure (`Phase 8: package-size check` — package is ~6.9 MB vs 3 MB budget; baseline regression predating Phase 12 and separate from viewer scope).
- **Viewer Playwright suite (Phase 12)**: 15 passing in `tests/viewer/` covering feed load, palette, theme, URL filter roundtrip, settings persistence, ask panel, and axe-core audits across five routes.
- Verification matrix (`scripts/verification-matrix.js` + `tests/e2e/phase10-verification-matrix.e2e.test.ts`): **15/15** integrations green for `Captures Sessions / Search via MCP / Context Injection / Doctor Green / Uninstall Symmetric / Dashboard Visible`.

### 2.2 What is explicitly **not** complete (the Phase 12 surface)

Anything in §11 is considered "not done". In short:

1. **Settings redesign** — the current `src/ui/viewer/components/ContextSettingsModal.tsx` is still a 504-line modal with three collapsible sections ("Loading", "Display", "Advanced") concentrated on context-injection knobs. It does not yet expose every settings domain from §6.4 as a sectioned page, does not cover per-IDE tuning (`~/.claude-mem/settings.json#sources`), and does not surface Privacy, MCP, About, or Export as first-class sections. This is the Viewer 2.0 Phase 8 scope from `.plan/viewer-ui.md`.
2. **Testing / a11y / performance bar** — there is no viewer-specific Playwright suite, no axe-core audit, no Lighthouse budget, no `esbuild --analyze` bundle budget, no SSE load test script. This is the Viewer 2.0 Phase 10 scope from `.plan/viewer-ui.md`.

Phase 12 consolidates both into a single executable scope. See §11 for the full task breakdown.

---

## 3. Architecture Overview

### 3.1 The five Claude Code lifecycle hooks

Registered in `plugin/hooks/hooks.json`:

| Hook name | Matcher | Runs |
|-----------|---------|------|
| `Setup` | `*` | `scripts/smart-install.js` (Bun / uv bootstrap) |
| `SessionStart` | `startup\|clear\|compact` | smart-install ensure, worker start + readiness poll on `GET /health`, then `hook claude-code context` |
| `UserPromptSubmit` | — | `hook claude-code session-init` |
| `PostToolUse` | `*` | `hook claude-code observation` |
| `PreToolUse` | `Read` | `hook claude-code file-context` (2s timeout — latency-sensitive) |
| `Stop` | — | `hook claude-code summarize` |
| `SessionEnd` | — | `hook claude-code session-complete` |

Hook responses use `STANDARD_HOOK_RESPONSE` from `src/hooks/hook-response.ts` (`{ continue: true, suppressOutput: true }`). `SessionStart`'s context hook constructs its own response with `hookSpecificOutput` for context injection.

Non-Claude IDEs reach the same worker via the adapters in `src/cli/adapters/` (`claude-code.ts`, `cursor.ts`, `gemini-cli.ts`, `windsurf.ts`, `raw.ts`) plus the installers in `src/services/integrations/` + `src/services/integrations/mcp/`.

### 3.2 Worker service

`src/services/worker-service.ts` is a thin orchestrator over domain services in `src/services/worker/`:

- `DatabaseManager` (owns `SessionStore`, `Observations`, `Summaries`, `Prompts`, `Timeline`, `ChromaSync`).
- `SessionManager` (event-driven lifecycle, active-session tracking, queue depth, emits SSE events).
- `SearchManager` / `Search.ts` (hybrid search with reranker — boosts by project, `useful`, and time decay).
- `ContextGenerator` (rich date-grouped timeline formatting).
- `SSEBroadcaster` (`/api/stream`).
- `PaginationHelper` (LIMIT+1 cursor pagination shared by all list routes).
- Agents: `SDKAgent` (observer-only event-driven query loop), `GeminiAgent`, `OpenRouterAgent`, `BaseRESTAgent`.
- `ModeManager`, `SettingsManager`, `BranchManager`, `ProcessRegistry`, `FormattingService`.

The worker boots via `plugin/scripts/worker-service.cjs` (run through `bun-runner.js`). Startup is two-phase: HTTP is available immediately at `/health` (503 until ready), background init then becomes green. This matters for hook scripts that poll readiness.

### 3.3 Storage

- **SQLite**: `~/.claude-mem/claude-mem.db` via `src/services/sqlite/Database.ts` + per-domain stores. Migration runner at `src/services/sqlite/migrations/runner.ts`. Notable: `sdk_sessions.platform_source` (NOT NULL DEFAULT `'claude'`) and index `idx_sdk_sessions_platform_source` (migration 24) are what enable per-source dashboard queries (see `DashboardRoutes.ts`).
- **Chroma**: `~/.claude-mem/chroma/` managed by `ChromaSync`, instantiated in `DatabaseManager`'s constructor.
- **Settings**: `~/.claude-mem/settings.json` — the runtime configuration; read/written by `GET|POST /api/settings` and also consumed by adapters/agents.
- **Backups**: `~/.claude-mem/backups/<YYYYMMDD-HHMMSS>/` — populated by `_backup.ts` on every IDE install.
- **Dev environment**: `~/.claude-mem-dev/` (seeded by `scripts/seed-dev-db.js`), worker runs on port `37780` via `scripts/dev-server.js`.

### 3.4 Data flow

```text
┌──────────────┐      stdin/stdout JSON       ┌──────────────────┐
│ IDE / CLI    │ ───────────────────────────► │  Adapter         │
│ hook event   │                              │  src/cli/adapters│
└──────────────┘                              └────────┬─────────┘
                                                       │ HTTP
                                                       ▼
                                          ┌──────────────────────┐
                                          │  Worker (port 37777) │
                                          │  src/services/worker │
                                          └────────┬──────┬──────┘
                                                   │      │
                                                   ▼      ▼
                                      ┌─────────────┐  ┌──────────┐
                                      │ SQLite      │  │ Chroma   │
                                      │ store       │  │ vectors  │
                                      └─────┬───────┘  └────┬─────┘
                                            │               │
                                            ▼               ▼
                                    ┌──────────────────────────────┐
                                    │ Search / Ask / Dashboard     │
                                    │ + SSE broadcast              │
                                    └──────────────┬───────────────┘
                                                   │  HTTP / SSE
                                                   ▼
                                         ┌────────────────────┐
                                         │ Viewer (React)     │
                                         │ http://localhost:  │
                                         │         37777/     │
                                         └────────────────────┘
```

### 3.5 Privacy model

- `<private>…</private>` tags are stripped **at the hook layer** (edge) before the payload ever reaches the worker. Shared utilities: `src/utils/tag-stripping.ts`. Do not move stripping deeper into the worker; the guarantee is that private content never touches the database.
- Hook exit codes follow Claude Code's contract:
  - `0` — success or graceful shutdown.
  - `1` — non-blocking error (stderr shown; session continues).
  - `2` — blocking error (stderr surfaced to Claude for correction).
  - Worker/hook failures at the edge generally still exit `0` to avoid Windows Terminal tab accumulation; diagnostics remain in logs.

---

## 4. Directory Map (top-level orientation)

```text
<repo root>
├── src/
│   ├── cli/adapters/            # Per-IDE hook payload normalizers (claude-code, cursor, gemini-cli, windsurf, raw)
│   ├── hooks/                   # Shared hook response helpers
│   ├── npx-cli/commands/        # install, uninstall, doctor, ask, runtime, ide-detection
│   ├── services/
│   │   ├── worker/              # Orchestrator + domain services + HTTP routes
│   │   │   ├── http/routes/     # 10 BaseRouteHandler subclasses (see §5)
│   │   │   ├── agents/          # SDKAgent, GeminiAgent, OpenRouterAgent, BaseRESTAgent
│   │   │   ├── events/          # SSE + event bus internals
│   │   │   ├── knowledge/       # Context injection helpers
│   │   │   ├── search/          # Hybrid search internals
│   │   │   └── session/         # Session lifecycle
│   │   ├── integrations/        # 6 Tier-1 installers + mcp/ (8 Tier-2) + shared _backup/types/registry
│   │   ├── sqlite/              # Stores + migrations (runner.ts)
│   │   ├── sync/ChromaSync.ts   # Vector sync
│   │   ├── queue/               # SessionQueueProcessor
│   │   ├── transcripts/         # Transcript watcher
│   │   └── worker-service.ts    # Top-level orchestrator
│   ├── shared/                  # paths, SettingsDefaultsManager, worker-utils
│   ├── ui/
│   │   ├── tokens.css           # Single source of truth for design tokens
│   │   ├── viewer-template.html # Built into plugin/ui/viewer.html
│   │   └── viewer/              # React app (App.tsx, components/, hooks/, state/, utils/, constants/)
│   └── utils/                   # tag-stripping, logger, json-utils, bun-resolver, paths
├── plugin/                      # Pre-built plugin that ships with npm (hooks.json, scripts, skills, modes, ui)
├── openclaw/                    # Pre-built OpenClaw plugin (ships in npm package)
├── scripts/                     # Build, dev, seed, verification-matrix, changelog, sync-marketplace
├── tests/
│   ├── e2e/                     # End-to-end harness + per-IDE and per-phase specs (105 passing)
│   └── (many per-domain suites)
├── docs/                        # Public docs source (Mintlify)
├── .plan/                       # Historical plan documents (elevation, npx-distribution, viewer-ui*)
├── CLAUDE.md                    # Project-level agent guidance
└── PLAN.md                      # <-- you are here
```

---

## 5. Worker HTTP API (verified)

All routes live under `src/services/worker/http/routes/`. Each route handler extends `BaseRouteHandler` (`src/services/worker/http/BaseRouteHandler.ts`) which provides `wrapHandler`, `badRequest`, and other helpers.

### 5.1 Health / static

- `GET /health` — readiness; returns 503 until background init completes, 200 after.
- `ViewerRoutes.ts` mounts `express.static()` for the built viewer under `plugin/ui/`.

### 5.2 `DataRoutes.ts`

`GET /api/observations` · `GET /api/summaries` · `GET /api/prompts` · `GET /api/observation/:id` · `GET /api/observations/by-file` · `POST /api/observations/batch` · `GET /api/session/:id` · `POST /api/sdk-sessions/batch` · `GET /api/prompt/:id` · `GET /api/stats` · `GET /api/projects` · `GET /api/processing-status` · `POST /api/processing` · `GET /api/pending-queue` · `POST /api/pending-queue/process` · `DELETE /api/pending-queue/failed` · `DELETE /api/pending-queue/all` · `POST /api/import`.

### 5.3 `SearchRoutes.ts`

`GET /api/search` (unified) · `GET /api/timeline` · `GET /api/decisions` · `GET /api/changes` · `GET /api/how-it-works` · `GET /api/search/observations` · `GET /api/search/sessions` · `GET /api/search/prompts` · `GET /api/search/by-concept` · `GET /api/search/by-file` · `GET /api/search/by-type` · `GET /api/context/recent` · `GET /api/context/timeline` · `GET /api/context/preview` · `GET /api/context/inject` · `POST /api/context/semantic` · `GET /api/timeline/by-query` · `GET /api/search/help`.

### 5.4 `DashboardRoutes.ts`

- `GET /api/dashboard/sources` →
  ```ts
  {
    sources: { id: string; total: number; sevenDay: number[]; lastSeenMs: number | null; wowDelta: number | null }[];
    totals: { total: number; thisWeek: number; lastWeek: number; wowDelta: number; activeSources: number; totalSources: number; lastSeenMs: number | null };
  }
  ```
  Aggregation uses `observations JOIN sdk_sessions ON memory_session_id` with `COALESCE(s.platform_source, 'claude')`. The 7-day sparkline is a `GROUP BY days_ago` bucket of `(now - created_at_epoch) / 86_400_000`. `Cache-Control: no-store`.
- `GET /api/dashboard/health` → `{ worker: { uptime, activeSessions, sseClients }, database: { path, size }, queue: { depth } }`.

### 5.5 `AskRoutes.ts`

- `POST /api/ask` with body `{ question: string; limit?: number (1..20, default 8); project?: string }` returns `{ synthesis: null, citations: AskCitation[] }` where
  ```ts
  interface AskCitation {
    id: number; title: string | null; subtitle: string | null;
    narrative_snippet: string | null; project: string;
    platform_source: string; type: string; created_at_epoch: number;
  }
  ```
  `synthesis` is **always null** on the open-source default path. Model-gated synthesis is allowed but must not regress the citation-only default.

### 5.6 `SessionRoutes.ts` (hook pipeline)

Internal (by `sessionDbId`): `POST /sessions/:sessionDbId/init`, `/observations`, `/summarize`, `/complete`; `GET /sessions/:sessionDbId/status`; `DELETE /sessions/:sessionDbId`.

Claude-ID-keyed: `POST /api/sessions/init`, `/observations`, `/summarize`, `/complete`; `GET /api/sessions/status`.

### 5.7 `SettingsRoutes.ts`

- `GET|POST /api/settings` — full settings object at `~/.claude-mem/settings.json` (validated on write).
- `GET /api/mcp/status`, `POST /api/mcp/toggle` — MCP server enable/disable.
- `GET /api/branch/status`, `POST /api/branch/switch`, `POST /api/branch/update` — branch switcher backend (no frontend UI exists yet — see §12 out-of-scope list, and do NOT re-expose this until product decides otherwise).

### 5.8 Other

- `CorpusRoutes.ts` — corpus CRUD (`POST /api/corpus`, `GET /api/corpus`, `GET /api/corpus/:name`, `DELETE /api/corpus/:name`, `POST /api/corpus/:name/rebuild|prime|query|reprime`).
- `LogsRoutes.ts` — `GET /api/logs`, `POST /api/logs/clear` (via `readLastLines` helper).
- `MemoryRoutes.ts` — `POST /api/memory/save`.
- SSE stream — `GET /api/stream` (broadcasted by `SSEBroadcaster`): `initial_load`, `new_observation`, `new_summary`, `new_prompt`, `processing_status`, `source-update`.

### 5.9 Contract notes

- Live data sets `Cache-Control: no-store`. Aggregated dashboard data may set a short (~10s) cache with an etag.
- All list endpoints use `PaginationHelper` (LIMIT+1) — do not re-implement pagination inline.
- Every handler must go through `wrapHandler` so errors surface uniformly.

---

## 6. Viewer UI (verified)

### 6.1 App shell

`src/ui/viewer/App.tsx` manages all routes (`feed` | `sources`) via `useRoute`, global keyboard (⌘K palette, ⌘J ask, `?` help, `/` focus search, `g h|s|c` navigation), and orchestrates the SSE stream + pagination merge through `useSSE` and `usePagination`. SSE-inserted rows are flagged "fresh" for 4 seconds via the `freshIds` set (pulse accent).

### 6.2 Component inventory

**Top-level components** (`src/ui/viewer/components/`):

- `Header.tsx`, `Feed.tsx`, `SourceStrip.tsx`, `FilterSummary.tsx`, `SourcesDashboard.tsx`.
- `CommandPalette.tsx` (191 lines), `AskPanel.tsx` (189), `KeyboardHelpModal.tsx`.
- Cards: `BaseCard.tsx`, `ObservationCard.tsx`, `SummaryCard.tsx`, `PromptCard.tsx`.
- Supporting: `ContextSettingsModal.tsx` (504 lines — Phase 12 target), `LogsModal.tsx` (exports `LogsDrawer`), `TerminalPreview.tsx`, `GitHubStarsButton.tsx`, `ScrollToTop.tsx`, `ThemeToggle.tsx`, `ErrorBoundary.tsx`.

**Primitives** (`components/primitives/`): `Stack`, `Row`, `Panel`, `Badge`, `Chip`, `Button`, `Divider`, `KeyboardShortcut`, `SourceDot`, `IconButton`, `Tooltip` — full prop signatures in §8.

**Hooks** (`src/ui/viewer/hooks/`): `useSSE`, `useSettings`, `useStats`, `useTheme`, `usePagination`, `useRoute`, `useFilterState`, `useGitHubStars`, `useSpinningFavicon`, `useContextPreview`, `useSourcesDashboard`.

**State** (`src/ui/viewer/state/filterReducer.ts`):

```ts
interface FilterState {
  sources: string[];   // [] = all
  types: string[];
  projects: string[];
  query: string;
  since: number | null; // epoch ms
  until: number | null;
}
```
Actions: `toggleSource|toggleType|toggleProject` (each with optional `exclusive`), `setQuery`, `setRange`, `removeSource|removeType|removeProject`, `clearAll`, `replace`. Serialized to `?src=&type=&proj=&q=&since=&until=` via `encodeFilterState` / `decodeFilterState`. Predicate: `matchesFilter(item, state)`.

### 6.3 Viewer types (`src/ui/viewer/types.ts`)

Key types: `Observation`, `Summary`, `UserPrompt`, `FeedItem`, `StreamEvent`, `ProjectCatalog`, `Settings`, `WorkerStats`, `DatabaseStats`, `Stats`.

`Observation` columns: `id, memory_session_id, project, platform_source, type, title, subtitle, narrative, text, facts, concepts, files_read, files_modified, prompt_number, created_at, created_at_epoch`.

### 6.4 Current `Settings` shape (`types.ts`)

All keys are strings to match `~/.claude-mem/settings.json` on disk:

| Key | Purpose |
|-----|---------|
| `CLAUDE_MEM_MODEL` | Default agent model id |
| `CLAUDE_MEM_CONTEXT_OBSERVATIONS` | # observations to inject |
| `CLAUDE_MEM_WORKER_PORT` | 37777 by default |
| `CLAUDE_MEM_WORKER_HOST` | localhost by default |
| `CLAUDE_MEM_PROVIDER` | `claude` \| `gemini` \| `openrouter` |
| `CLAUDE_MEM_GEMINI_API_KEY`, `CLAUDE_MEM_GEMINI_MODEL`, `CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED` | Gemini agent |
| `CLAUDE_MEM_OPENROUTER_API_KEY`, `CLAUDE_MEM_OPENROUTER_MODEL`, `CLAUDE_MEM_OPENROUTER_SITE_URL`, `CLAUDE_MEM_OPENROUTER_APP_NAME` | OpenRouter agent |
| `CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS / WORK_TOKENS / SAVINGS_AMOUNT / SAVINGS_PERCENT` | Token economics display |
| `CLAUDE_MEM_CONTEXT_FULL_COUNT / FULL_FIELD / SESSION_COUNT` | Display configuration |
| `CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY / LAST_MESSAGE` | Feature toggles |

Settings **not yet in `types.ts`** but on the roadmap (see §11): per-source tuning (`sources.<ide>.{captureFileReads,summarizeThreshold,captureAfterTool,captureAfterAgent}`), search reranker tuning (`searchRerankerHalfLifeDays`, `searchUsefulBoost`, `searchProjectBoost`), privacy retention policy.

### 6.5 Current `ContextSettingsModal.tsx` structure (baseline for Phase 12)

Three `CollapsibleSection` blocks: **Loading**, **Display**, **Advanced**. Each section contains `FormField` children with tooltips. This is the component Phase 12 replaces — keep the hook integration (`useSettings`, `useContextPreview`, `TerminalPreview`) and the save / save-status plumbing; replace only the component tree and styling.

---

## 7. Design Tokens (verified against `src/ui/tokens.css`)

### 7.1 Invariants

- **No hex literals outside `tokens.css`.** `grep -E '#[0-9a-fA-F]{3,6}'` outside `:root` / `[data-theme="dark"]` must return zero hits.
- **No raw pixel values** in components (other than 1px borders and rem-anchored constants). Consume `--space-*` / `--text-*` / `--radius-*` tokens.
- **Every light token has a dark mirror.** Dark mode at `[data-theme="dark"]` plus a `prefers-color-scheme: dark` fallback block (for `:root:not([data-theme])`).
- **`prefers-reduced-motion: reduce`** collapses `--motion-ui`, `--motion-card`, `--motion-modal` to `0ms` and sets `animation-duration: 0s` and `transition-duration: 0s` globally.

### 7.2 Token families

| Family | Tokens |
|--------|--------|
| **Neutral scale** | `--neutral-50` … `--neutral-900` (light + dark mirror) |
| **Accent / feedback** | `--accent-primary`, `--accent-primary-hover`, `--accent-primary-soft`, `--accent-primary-ring`, `--accent-success`, `--accent-warning`, `--accent-error`, `--accent-info` |
| **Source hues (18)** | `--source-claude-code`, `--source-claude-desktop`, `--source-codex-cli`, `--source-codex-vscode`, `--source-gemini-cli`, `--source-gemini-vscode`, `--source-kimi`, `--source-kimi-code`, `--source-cursor`, `--source-windsurf`, `--source-opencode`, `--source-openclaw`, `--source-copilot-cli`, `--source-antigravity`, `--source-goose`, `--source-crush`, `--source-roo-code`, `--source-warp`, plus `--source-all`, `--source-default` |
| **Surfaces** | `--color-bg-primary / -secondary / -tertiary / -header / -card / -card-hover / -input / -overlay / -backdrop / -tooltip` |
| **Borders** | `--color-border-primary / -secondary / -strong / -focus / -hover / -summary / -prompt / -observation` (legacy preserved) |
| **Text** | `--color-text-primary / -secondary / -tertiary / -muted / -inverse / -header / -title / -subtitle / -logo / -button / -observation / -summary` |
| **Typography** | `--font-ui`, `--font-mono`, `--font-terminal`; `--text-xs / -sm / -base / -md / -lg / -xl / -2xl / -3xl` |
| **Spacing** | `--space-1..10` and semantic aliases `--space-card-padding`, `--space-card-gap`, `--space-section-gap`, `--space-feed-gutter` |
| **Radii** | `--radius-sm / -md / -lg / -pill` |
| **Motion** | `--motion-ui` (120ms), `--motion-card` (180ms), `--motion-modal` (240ms); `--duration-ui` = `var(--motion-ui)` alias; `--ease-in`, `--ease-out` |
| **Elevation** | `--elev-0` (1px ring), `--elev-1` (raised card), `--elev-2` (modal), `--elev-3` (overlay/palette); dark mode uses violet bloom. `--shadow-focus` = 3px accent ring |
| **Source dots (CSS)** | `.source-dot` + `.source-dot[data-source="<id>"]` rules map each source id to its `--source-*` hue |

### 7.3 Token grep gates (apply in Phase 12)

Ship with these guardrails in CI (already feasible today):

- `rg -n '#[0-9a-fA-F]{3,6}' src/ui/viewer src/ui/viewer-template.html` must match only the tokens file.
- `rg -n '\b[0-9]+px\b' src/ui/viewer` must return only rem-anchored or 1px-border lines.

---

## 8. Primitive component library (verified against source)

Path: `src/ui/viewer/components/primitives/`.

### 8.1 Barrel

```ts
export { Stack } from './Stack';
export { Row } from './Row';
export { Panel } from './Panel';
export { Badge } from './Badge';
export { Chip } from './Chip';
export { Button } from './Button';
export { Divider } from './Divider';
export { KeyboardShortcut } from './KeyboardShortcut';
export { SourceDot } from './SourceDot';
export { IconButton } from './IconButton';
export { Tooltip } from './Tooltip';
```

### 8.2 Signatures

```ts
// Stack — vertical flex
type StackGap = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'card-gap'|'section-gap'|'feed-gutter';
interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: StackGap;            // default '3'
  align?: 'stretch'|'start'|'center'|'end'; // default 'stretch'
  as?: keyof JSX.IntrinsicElements;         // default 'div'
}

// Row — horizontal flex
type RowGap = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'card-gap'|'feed-gutter';
interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: RowGap;              // default '2'
  align?: 'stretch'|'start'|'center'|'end'|'baseline'; // default 'center'
  justify?: 'start'|'center'|'end'|'space-between'|'space-around';
  wrap?: boolean;
}

// Panel — tokenized surface
type PanelPad = '0'|'2'|'3'|'4'|'5'|'6'|'7'|'card-padding';
interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 0|1|2|3;       // default 1
  padding?: PanelPad;        // default 'card-padding'
  radius?: 'sm'|'md'|'lg';   // default 'md'
  as?: keyof JSX.IntrinsicElements;
}

// Badge — soft pill
type BadgeTone = 'neutral'|'accent'|'success'|'warning'|'error'|'info';
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;          // default 'neutral'
  subtle?: boolean;          // default true
  mono?: boolean;
}

// Chip — toggleable interactive pill
interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
}

// Button
type ButtonVariant = 'primary'|'secondary'|'ghost'|'danger';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;   // default 'secondary'
  size?: 'sm'|'md';          // default 'md'
  icon?: React.ReactNode;
}

// Divider
interface DividerProps {
  orientation?: 'horizontal'|'vertical'; // default 'horizontal'
  style?: React.CSSProperties;
}

// KeyboardShortcut
interface KeyboardShortcutProps { keys: string[]; style?: React.CSSProperties; }

// SourceDot
interface SourceDotProps {
  source: string | null | undefined;
  size?: number;             // default 8 (px)
  title?: string;
  style?: React.CSSProperties;
}

// IconButton — square, accessible
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;             // sets aria-label + title
  size?: 'sm'|'md'|'lg';     // sm 28, md 34, lg 40 (px)
  variant?: 'ghost'|'secondary';
  children: React.ReactNode;
}

// Tooltip — CSS-powered, no external lib
interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: 'top'|'bottom'; // default 'top'
}
```

All primitives are pure visual: no hooks, no data fetching, no side effects. Keep each ≤ 60 lines. Add new primitives only when ≥ 3 call sites would consume them.

---

## 9. Development workflow (verified against `package.json`)

Key scripts:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Alias for `build-and-sync` |
| `npm run build` | `scripts/sync-plugin-manifests.js` + `scripts/build-hooks.js` |
| `npm run build-and-sync` | Build → sync to marketplace → wait → `worker:restart` |
| `npm run sync-marketplace` / `--force` | `scripts/sync-marketplace.cjs` |
| `npm run dev:seed` / `:fresh` | Seed `~/.claude-mem-dev/` (500 observations across 5 sources) |
| `npm run dev:server` | Start worker on port `37780` against `~/.claude-mem-dev/` |
| `npm run worker:start / :stop / :restart / :status` | Bun-managed worker via `plugin/scripts/worker-service.cjs` |
| `npm run worker:logs / :tail` | Tail `~/.claude-mem/logs/worker-<date>.log` |
| `npm run queue / :process / :clear` | Inspect / flush pending queue |
| `npm test` | `bun test` |
| `npm run test:sqlite / :agents / :search / :context / :infra / :server / :e2e` | Scoped `bun test` |
| `npm run test:e2e` / `npm run smoke` | End-to-end suite (`tests/e2e/`) |
| `npm run check` | `typecheck && test && test:e2e && check:dist` — the pre-commit / pre-PR gate |
| `npm run changelog:generate` | `scripts/generate-changelog.js` (do not hand-edit changelog) |

### 9.1 First-time contributor flow

```bash
git clone <fork>
npm install
npm run dev:seed:fresh   # creates ~/.claude-mem-dev/claude-mem.db
npm run dev:server       # worker on 37780 against the dev DB
# open http://localhost:37780/
```

The dev flow must never write to `~/.claude-mem/`; `scripts/dev-server.js` refuses if `CLAUDE_MEM_DATA_DIR` equals the production dir.

---

## 10. Branch Consolidation Record

This is the permanent audit trail. The current `main` tip is `46ae78b` and was force-pushed in the consolidation operation. Do not resurrect deleted branches; cherry-pick from `main` history instead.

| Branch | Role | Absorbed? | Contribution / reason |
|--------|------|-----------|-----------------------|
| `cursor/viewer-ui-2-40d8` | **Best base** | Yes (full history on `main`) | Elevation infrastructure + Viewer UI 2.0 phases 0–10. Unique artifacts (now on main): `FilterSummary.tsx`, `KeyboardHelpModal.tsx`, `SourceDot.tsx`, `useRoute.ts`, `useSourcesDashboard.ts`, `fuzzy.ts`. |
| `cursor/elevation-plan-cb87` | Elevation | Fully absorbed via 40d8 | 12 commits / 51 files. Delivered universal IDE coverage, e2e smoke harness, hook-payload fixtures, uniform Integration contract, `npx claude-mem doctor --ide/--fix/--json`, search reranker, distribution hardening, `dev:server + seed + check`, 15/15 verification matrix. |
| `cursor/viewer-ui-2-1657` | Parallel Viewer 2 | Partially absorbed (cherry-picked) | 18 commits / 87 files. On main: `IconButton.tsx`, `Tooltip.tsx`, `--color-bg-tooltip`, `--duration-ui`. Remaining deltas superseded by 40d8. |
| `cursor/viewer-ui-2-4bc6` | Earlier consolidated UI attempt | Superseded | Replaced by 40d8. |
| `cursor/viewer-ui-2-8f17` | Broad UI spike | Superseded | Replaced by 40d8. |
| `cursor/viewer-ui-2-ada9` | Earliest UI/API spike | Superseded | Replaced by 40d8. |
| `cursor/viewer-ui-2-0-0d12` | Legacy / unverified | Deleted | Remote branch removed during consolidation. |

**Current canonical state:** all the above remote branches were deleted via `git push origin --delete`; `git branch -r` returns `origin/main` only. `main`'s tip (`46ae78b`) adds `PLAN.md` on top of `2a26787` which added the `IconButton`/`Tooltip`/tooltip tokens from 1657 on top of the full 40d8 history.

---

## 11. Phase 12 — Executable specification

Phase 12 has two workstreams. They can run in parallel on separate branches; they share the same Phase-0 visual direction (`.plan/viewer-ui-direction.md`) and must not regress any existing e2e test.

**Branch convention for Phase 12 subagents.** Work on branches prefixed `cursor/` and suffixed with the agent id — e.g. `cursor/phase-12-settings-<id>`, `cursor/phase-12-tests-<id>`. Base on `main`. Open a draft PR into `main`.

### 11.A — Settings redesign (supersedes `.plan/viewer-ui.md` Phase 8)

**Goal.** Replace `src/ui/viewer/components/ContextSettingsModal.tsx` with a sectioned settings page that exposes every settings domain with parity to the CLI + worker, uses primitives + tokens exclusively, and round-trips through `GET|POST /api/settings` with full unsaved-changes protection.

**Deliverables (files to create).**

1. `src/ui/viewer/components/settings/SettingsPage.tsx` — top-level container. Layout: left nav (section list, `Panel` elevation 0, fixed width ~240px) + right content pane (scrollable). Replace the modal dialog chrome; mount as its own route when `?view=settings` is present, **and** keep the existing `ContextSettingsModal` entry point open by routing to `SettingsPage` in a full-height drawer for backwards compatibility until the next release. Remove `ContextSettingsModal.tsx` only after compat period.
2. `src/ui/viewer/components/settings/SettingsSection.tsx` — primitive for a section: `Panel` + header row + optional description + children. Accepts `title: string`, `description?: string`, `children: ReactNode`.
3. `src/ui/viewer/components/settings/SettingsField.tsx` — labeled field wrapper with inline hint (never a tooltip). Supports `<input>`, `<select>`, `<textarea>` slots and a right-aligned slot for unit text ("seconds", "observations").
4. `src/ui/viewer/components/settings/SectionGeneral.tsx`, `SectionSources.tsx`, `SectionSearch.tsx`, `SectionContextInjection.tsx`, `SectionPrivacy.tsx`, `SectionMcp.tsx`, `SectionAbout.tsx` — one file per section (see table below).
5. `src/ui/viewer/hooks/useUnsavedChanges.ts` — tracks dirty state, returns `{ isDirty, reset, snapshot }`; used to gate navigation and show banner.
6. `src/ui/viewer/components/settings/SettingsDirtyBanner.tsx` — sticky top banner showing "Unsaved changes — Save | Discard" when dirty.
7. `src/ui/viewer/state/settingsSchema.ts` — TS-level schema describing field types, labels, hints, and valid ranges; drives both the forms and client-side validation.

**Sections and fields.**

| Section | Fields (all read/write through `/api/settings`) |
|---------|-------------------------------------------------|
| **General** | Theme (`auto / light / dark`) — uses `useTheme`; `CLAUDE_MEM_WORKER_PORT` (display only if worker is bound, with restart hint); log level (from settings file if present); version (from `DashboardRoutes.health`). |
| **Sources** | Per-IDE list (all 18 ids from §7.2). Each row: enabled toggle, per-source tuning `{ captureFileReads, summarizeThreshold, captureAfterTool, captureAfterAgent }`. Server wires these into `~/.claude-mem/settings.json#sources.<id>`; the adapters read them. Show a "copy JSON" button for the full `sources` block. |
| **Search** | Reranker: project boost, useful boost, half-life days; dedupe threshold. Settings keys prefixed `CLAUDE_MEM_SEARCH_*`. |
| **Context injection** | `CLAUDE_MEM_CONTEXT_OBSERVATIONS`, `CLAUDE_MEM_CONTEXT_FULL_COUNT`, `CLAUDE_MEM_CONTEXT_FULL_FIELD`, `CLAUDE_MEM_CONTEXT_SESSION_COUNT`, `CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY`, `CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE`, token-economics toggles. Mount `TerminalPreview` on the right as live preview (reuse `useContextPreview`). |
| **Privacy** | Read-only explainer: `<private>` stripping is always-on at the hook layer (`src/utils/tag-stripping.ts`). Retention policy setting (days). Export button → POST to new `/api/export` if it exists, otherwise call existing `import/export` scripts via a CLI hint. Delete-all-data button that requires typed confirmation and hits `DELETE /api/pending-queue/all` + a documented SQL truncation path; must not silently drop production data. |
| **MCP** | `GET /api/mcp/status`, `POST /api/mcp/toggle`. List IDEs currently consuming MCP (derived from `src/services/integrations/mcp/` registry). Per-tool enablement: `claude_mem_search`, `claude_mem_timeline`, `claude_mem_ask` (surface only — do not invent new MCP tools). |
| **About** | Worker uptime + PID from `/api/dashboard/health`; DB path + size; Chroma collection count (may need a small `GET /api/chroma/status` — if adding, keep behind an MCP health probe); link to docs; "Run `npm run verify`" action hint (no SSE hookup required unless trivial). |

**Save semantics.**

- All writes optimistic. Reads via `useSettings()` (already exists; do not replace). Write via the hook's `saveSettings(nextSettings)` which posts to `/api/settings`.
- Fields push into a local state object; `isDirty` diffed against the last successful save.
- On successful save → show toast-style confirmation (reuse existing save-status UI pattern).
- Navigating away while dirty → confirmation dialog.

**Token + primitive invariants.**

- No hex literals in any new settings file (enforce via the §7.3 grep gate).
- No raw pixel values outside the primitive props (`IconButton` sizes are an allowed exception).
- All layout uses `Stack`, `Row`, `Panel`, `Divider`, `Badge`, `Chip`, `Button`, `IconButton`, `Tooltip`.
- Section titles use `--text-lg`; section description `--text-sm`; field labels `--text-sm` bold; help text `--text-xs`.

**Accessibility.**

- Every field has a `<label htmlFor>` pointing to an `id` on the input.
- The left nav is a `<nav aria-label="Settings sections">` with `<a href="#section-id">` or `<button>` entries; `aria-current="page"` on active.
- Banner dialogs use `role="alert"`.
- Escape closes the settings drawer (or routes back to `feed`) without discarding the dirty state.

**Acceptance criteria.**

1. Every existing field from `ContextSettingsModal.tsx` is present and saves to the same key.
2. Mutate one value in each section → reload → value persists (tested automatically in 11.B.1 Playwright suite and manually).
3. Navigation with dirty state prompts a confirm.
4. `rg -n '#[0-9a-fA-F]{3,6}' src/ui/viewer/components/settings` returns zero hits.
5. Axe-core audit on the Settings page reports **zero serious** violations and ≤ 2 moderate (waivers documented in the PR).
6. Deleting `ContextSettingsModal.tsx` does not break any existing test (update imports in `App.tsx`).

**Anti-patterns.**

- Do not split sections into more than one file each — one component, one file.
- Do not add a client-side settings cache layer — `useSettings` is already the cache.
- Do not introduce a form library. Controlled inputs + `settingsSchema.ts` are enough.
- Do not gate any field behind "Advanced". Power users read; show everything.

---

### 11.B — Testing / a11y / performance bar (supersedes `.plan/viewer-ui.md` Phase 10)

**Goal.** Add a viewer-specific Playwright suite, an axe-core audit, a Lighthouse budget, a bundle budget, and an SSE load test. Wire them into CI.

**Deliverables.**

1. **Playwright suite** at `tests/viewer/` with a shared fixture that:
   - Spawns `scripts/dev-server.js` on port `37780` with `CLAUDE_MEM_DATA_DIR` pointing at a tmpdir-seeded copy of the dev DB (fresh per spec).
   - Uses Playwright's Chromium engine.
   - 6 required flows (one `.spec.ts` each):
     1. `feed-loads.spec.ts` — load `/`, assert ≥ 50 cards render in < 1500ms on the fixture.
     2. `palette-flow.spec.ts` — open `⌘K`, type `mig`, `Enter`, assert the feed scrolls to a matching observation (freshId pulse visible).
     3. `theme-toggle.spec.ts` — toggle theme, assert no FOUC (compare first-paint background to post-toggle background).
     4. `url-filter-roundtrip.spec.ts` — apply 3 filters, capture URL, reload, assert state restored (matches §6.2 reducer serialization).
     5. `settings-persist.spec.ts` — open settings, change reranker half-life (Phase 11.A Search section), save, reload, assert persistence (via `/api/settings`).
     6. `ask-panel.spec.ts` — open ask panel, submit `what is claude-mem?`, assert cite list renders, click a cite, assert feed scrolls + pulses.
2. **Axe-core audit** at `tests/viewer/axe-audit.ts` — wraps Playwright pages and runs `axe.run()` on each route (`feed`, `sources`, `settings`, with palette + ask panel overlays). Fails if any **serious** or **critical** violation is found. Moderate/minor reported with waiver comments.
3. **Lighthouse gate** at `scripts/viewer-lighthouse.js` — runs on the built viewer served by `scripts/dev-server.js`. Targets: Performance ≥ 95, Accessibility ≥ 98, Best Practices ≥ 95, FCP ≤ 800ms. Fail CI on miss.
4. **Bundle budget** at `scripts/viewer-bundle-budget.js` — runs `esbuild --analyze` on `src/ui/viewer-template.html`'s bundle entry and compares the minified gzipped size to `.viewer-size-budget.json` (starter budget: current + 10%). Fail on regression; require a PR note to raise the budget.
5. **SSE load test** at `scripts/sse-load-test.js` — pumps 1,000 synthetic observations through the dev worker in 60 seconds and asserts the viewer (headless Chromium) stays connected, drops zero messages, and keeps `document.querySelectorAll('.am-card').length` growing monotonically.
6. **CI workflow** at `.github/workflows/viewer.yml` — runs 1–4 on `ubuntu-latest` for every PR touching `src/ui/**`, `tests/viewer/**`, or `scripts/viewer-*.js`. Uses the same Node/Bun versions as the existing e2e workflow. Step order: install → build → `dev:seed:fresh` → `dev:server` (background) → wait for `/health` → Playwright → axe → Lighthouse → bundle budget.
7. **Docs** at `docs/public/PERFORMANCE.md` — captures the Lighthouse targets, a sample bundle breakdown, and the SSE load-test methodology. Linked from `README.md` under a new "Viewer performance" section.

**Test invariants.**

- No test depends on the production `~/.claude-mem/` — always the dev DB copy.
- No test asserts a specific row count. Assert `≥` bounds.
- No test waits on `setTimeout` > 2s. Use `page.waitForSelector` / `waitForFunction`.
- SSE reconnection behavior is tested — kill the worker mid-run, verify the viewer reconnects within the existing `useSSE` backoff.

**Acceptance criteria.**

1. All 6 Playwright specs pass locally and in CI.
2. Axe audit returns zero serious/critical violations across all routes.
3. Lighthouse scores meet the targets above.
4. Bundle size is below the current budget in `.viewer-size-budget.json`.
5. SSE load test completes with zero message loss.
6. CI workflow blocks merges on any of the above failing.

**Anti-patterns.**

- Do not add a second test runner (no Jest, no Vitest). Use `bun test` for unit/integration; Playwright for viewer e2e.
- Do not snapshot full DOM trees (tests brittle). Snapshot stable fragments only.
- Do not mock the worker — run the real dev server against the seeded DB.
- Do not add new dashboards just for these tests; they already have `DashboardRoutes`.

---

### 11.C — Cross-cutting acceptance (both workstreams)

Run before declaring Phase 12 complete:

1. `npm run check` green on `main` post-merge.
2. `npm run test:e2e` still reports 105 passing (no regressions).
3. Verification matrix `scripts/verification-matrix.js` still 15/15.
4. `PLAN.md` updated: flip Phase 12 to **Complete** in §13 and link the PRs.

---

## 12. Roadmap beyond Phase 12

### 12.1 Near-term

- **Distribution hardening** per `.plan/elevation.md` Phase 8: reproducible installs, `--provenance` on publish, `prepublishOnly` size budget (already present at `scripts/check-package-size.js`; extend to gate on a versioned budget).
- **Memory quality metrics** per `.plan/elevation.md` Phase 5: `useful` feedback column on observations, dedupe-on-ingest via Chroma similarity, per-source signal score surfaced on the Sources dashboard.
- **Context injection hygiene** per `.plan/elevation.md` Phase 7: uniform `<claude-mem-context>` tag format across all 10 IDE context files, refresh on demand via `npx claude-mem refresh-context`.

### 12.2 Long-term

- **Pro Memory Stream UI** — commercial surface that attaches to the same `localhost:37777` API (no fork; license gate at the UI only).
- **Advanced filtering and timeline scrubbing** — Pro-tier UX on top of existing `/api/timeline` endpoints.
- **Plugin marketplace improvements** — discovery, per-IDE doctor runs from the viewer, one-click install prompts.

### 12.3 Out of scope (explicit)

- New IDE integrations beyond the 18 supported sources.
- Rewriting the worker, the SQLite layer, or Chroma.
- Removing Bun as the worker runtime (`bun:sqlite` is required).
- Branch switcher UI (backend exists in `SettingsRoutes.ts` but surfaces none; keep hidden until product decides).
- JetBrains / Zed / Neovim / Emacs / Aider / Continue.dev / Amazon Q / Kiro (inherited from prior plans).

---

## 13. Phase Status (living)

| Phase | Name | Status |
|-------|------|--------|
| 0 | Visual direction | **Complete** — `.plan/viewer-ui-direction.md` |
| 1 | Design tokens | **Complete** — `src/ui/tokens.css` |
| 2 | Layout primitives | **Complete** — 11 primitives in `components/primitives/` |
| 3 | Card system refactor | **Complete** — `BaseCard.tsx` + 3 consumers |
| 4 | Source-aware feed + filter reducer | **Complete** — `filterReducer.ts`, `SourceStrip.tsx`, `FilterSummary.tsx` |
| 5 | Sources Dashboard | **Complete** — `SourcesDashboard.tsx` + `DashboardRoutes.ts` |
| 6 | Command Palette | **Complete** — `CommandPalette.tsx` (⌘K) + `fuzzy.ts` |
| 7 | Ask Panel | **Complete** — `AskPanel.tsx` (⌘J) + `AskRoutes.ts` |
| 8 | URL-synced filters | **Complete** — `encodeFilterState / decodeFilterState` |
| 9 | Dashboard + Ask API | **Complete** — `DashboardRoutes.ts`, `AskRoutes.ts` |
| 10 | Seed script / schema migration | **Complete** — `scripts/seed-dev-db.js`, `scripts/dev-server.js`, migration 24 |
| 11 | Polish pass | **Complete** — empty states, keyboard help, SSE fresh pulse, `IconButton` + `Tooltip` |
| 12 | Settings redesign + testing/a11y/perf bar | **Complete** — PR [#2](https://github.com/CBaileyDev/AiMemory/pull/2); see §11 for scope. Sectioned `SettingsPage` replaces `ContextSettingsModal`; viewer Playwright suite (15/15 passing) + axe-core audit + bundle budget + SSE load test + Lighthouse script + CI workflow (`.github/workflows/viewer.yml`) landed. |

---

## 14. File-location quick reference

| Thing | Path |
|-------|------|
| Project source | `src/` |
| Built plugin | `plugin/` |
| Installed plugin (user) | `~/.claude/plugins/marketplaces/thedotmack/` |
| Production DB | `~/.claude-mem/claude-mem.db` |
| Chroma vectors | `~/.claude-mem/chroma/` |
| Settings | `~/.claude-mem/settings.json` |
| Install backups | `~/.claude-mem/backups/<timestamp>/` |
| Dev DB | `~/.claude-mem-dev/claude-mem.db` |
| Dev worker port | `37780` |
| Production worker port | `37777` |
| Tokens source of truth | `src/ui/tokens.css` |
| Viewer entry | `src/ui/viewer/index.tsx` → `App.tsx` |
| Worker entry | `src/services/worker-service.ts` |
| Hook adapters | `src/cli/adapters/` |
| Integration contract | `src/services/integrations/types.ts` |
| Integration registry | `src/services/integrations/registry.ts` |
| Backup helper | `src/services/integrations/_backup.ts` |
| Plan history | `.plan/elevation.md`, `.plan/npx-distribution.md`, `.plan/viewer-ui.md`, `.plan/viewer-ui-direction.md` |

---

_End of PLAN.md._
