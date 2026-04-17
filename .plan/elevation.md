# Plan: Elevation — From "Installed Everywhere" to "Relied On Everywhere"

## Context

The previous plan (`.plan/npx-distribution.md`) has landed Phases 1–9: npx CLI, build pipeline, Gemini CLI, OpenCode, Windsurf, Codex CLI, OpenClaw, and six MCP-tier IDEs. Phase 10 (cross-platform end‑to‑end verification) is the only remaining gap.

claude-mem now **reaches** ~12 AI coding tools. What it does not yet do is **earn trust** across them. The goal of this plan is to turn wide IDE coverage into a dependable, observable, delightful product — so users pick claude-mem because it's the highest-quality persistent-memory layer in the ecosystem, not because it's the only one their tool supports.

## Problem statement

The current state has five concrete weaknesses, each supported by evidence in the repo:

1. **No automated verification that integrations actually work across platforms.** Ten IDE adapters/installers ship with unit tests only (`tests/` is unit-level), but there's no end-to-end smoke harness that installs into `~/.gemini/`, `~/.codeium/`, etc. and asserts the hook script executes.
2. **Quality per integration is uneven.** Some installers (e.g. `CursorHooksInstaller.ts` 671 lines, `WindsurfHooksInstaller.ts` 514 lines) are mature. Others (`McpIntegrations.ts`, a single 358‑line file covering six IDEs) are shallow. There's no "integration-level" checklist enforced uniformly.
3. **Observability is thin.** The worker at `src/services/worker-service.ts` logs, but there is no built-in way to answer "did my Windsurf session actually flow into memory?" without opening SQLite. Users cannot self-diagnose.
4. **The install UX is a one-shot script, not a lifecycle.** `src/npx-cli/commands/install.ts` is 564 lines that run top‑to‑bottom. There is no `doctor` command, no `repair`, no idempotent re-run story, and uninstall only loosely undoes what install did.
5. **Memory quality is invisible.** The viewer (`plugin/ui/viewer.html`) shows observations, but there's no product-level surface for *why this memory was recalled*, *what got dropped*, or *how much signal vs noise* is being captured per IDE. Users can't tell if it's working well.

The plan below addresses each of these directly, in phases that can be executed one-at-a-time in new chat contexts.

## Non-goals

- **Rewriting the worker or DB layer.** `src/services/worker-service.ts` and `src/services/sqlite/` are stable; this plan only adds surfaces on top of them.
- **Adding more IDEs.** The out-of-scope list from `.plan/npx-distribution.md` (JetBrains, Zed, Neovim, Aider, Continue.dev, Amazon Q/Kiro) stays out of scope.
- **Pro features.** Per `CLAUDE.md`, Pro features live outside this repo. Nothing here depends on license state.
- **Changing the privacy model.** `<private>` tag stripping at `src/utils/tag-stripping.ts` stays as-is.

## Platform support

All phases must continue to work on macOS, Linux, and Windows. Existing rules from `src/npx-cli/utils/paths.ts` apply: use `os.homedir()`, use `path.join()`, treat `fs.chmod` as a no-op on Windows, match `bun-runner.js`-style Bun resolution.

---

## Phase 0: Documentation Discovery (research only)

Before any implementation, a subagent must produce a single "current-state audit" document at `.plan/elevation-phase0.md`. This audit is the source of truth every later phase cites.

### What to gather

1. **Integration inventory** — For each of the 10 currently-implemented IDE integrations, record:
   - Installer file path and line count
   - Adapter file path (if any)
   - Whether it writes to user-level, workspace-level, or both
   - Whether it merges or overwrites
   - Whether there is an uninstaller symmetric to the installer
   - Whether there is a `tests/` file that actually exercises it
   - One known hole (e.g. "OpenCode plugin ships as `.js` but file-copy target is `.ts` — verify OpenCode loads `.js`")

2. **Hook payload verification** — For each Tier 1 IDE (Claude Code, Gemini CLI, Windsurf, OpenCode, Codex, OpenClaw):
   - Cite the current upstream docs URL for hook schemas
   - Note any divergence between the adapter in `src/cli/adapters/*.ts` and the upstream docs
   - Flag any hook event that was mapped but whose payload shape has since changed

3. **Worker API inventory** — List every route in `src/services/worker/http/routes/*.ts` with method + path + input + output. This becomes the contract for the doctor command and the dashboard.

4. **Test coverage map** — For each installer, note which tests in `tests/` cover it (by file name) and mark "covered" / "shallow" / "none".

5. **Known anti-patterns already hit** — Grep `.plan/npx-distribution.md` and the `CHANGELOG.md` for "do NOT" / "fixed" entries. These are real mistakes; the new plan must guard against them.

### Subagent reporting contract (required)

Each subagent response must include:
1. Sources consulted (files/URLs) and what was read
2. Concrete findings (exact API names/signatures; exact file paths/line numbers)
3. Copy-ready snippet locations (where to copy from)
4. Confidence note + known gaps

Reject and redeploy if a subagent reports conclusions without sources.

### Deliverable

A single `.plan/elevation-phase0.md` that subsequent phases reference by line. No code changes in Phase 0.

### Verification

- `.plan/elevation-phase0.md` exists
- It contains 10 integration rows, 6 hook-payload rows, a complete worker-route list, and a test-coverage matrix
- Every claim cites a file path or URL

---

## Phase 1: End-to-End Integration Smoke Harness

### Why this first

Phase 10 of the prior plan ("final verification") is the unfinished piece. Every other elevation phase will want to assert "this still works after my change." You need the harness before the other work to avoid regressing existing IDE integrations.

### What to implement

1. **Create `tests/e2e/` directory** (does not yet exist; `tests/integration/` is a separate unit-level suite).

2. **Create a per-IDE sandbox harness** at `tests/e2e/harness.ts`:
   - Uses a `TMPDIR`-rooted fake HOME (set `HOME` / `USERPROFILE` env var for the spawned process)
   - Runs `node dist/npx-cli/index.js install --ide <id>` against that fake HOME
   - Asserts: expected config file exists, has expected keys, does not contain unexpected keys
   - Runs `node dist/npx-cli/index.js uninstall` and asserts the config is restored to the pre-install state (this is the key regression surface — most installers are asymmetric)

3. **Per-IDE smoke tests** at `tests/e2e/<ide>.e2e.test.ts`:
   - One file per IDE: `claude-code`, `cursor`, `gemini-cli`, `opencode`, `windsurf`, `codex-cli`, `openclaw`, `copilot-cli`, `antigravity`, `goose`, `crush`, `roo-code`, `warp`
   - Each test: (a) install into fake HOME, (b) feed a fake hook payload matching the IDE's real schema to the adapter/script, (c) assert the worker DB (an in-memory SQLite for tests) received the expected observation row, (d) uninstall, (e) assert cleanup

4. **Hook-replay fixtures** at `tests/e2e/fixtures/<ide>/`:
   - Real JSON payloads for each hook event the IDE emits, captured from upstream docs / sample transcripts
   - These fixtures are the single source of truth for "does our adapter still understand this IDE's hook format?"

5. **Wire into CI** at `.github/workflows/`:
   - Add a new workflow `e2e.yml` that runs on `pull_request` and `push` to `main`
   - Matrix across `os: [ubuntu-latest, macos-latest, windows-latest]`
   - Runs `npm run build && npm run test:e2e`
   - Must pass before `npm-publish.yml` runs

6. **Add `npm run test:e2e` script** in `package.json`.

### Patterns to follow

- Existing test style in `tests/cursor-hooks-json-utils.test.ts`, `tests/gemini-cli-compat.test.ts`, and `tests/install-non-tty.test.ts`
- Fake-HOME pattern already present in `tests/` (see how `cursor-registry.test.ts` isolates its writes)

### Verification

- `npm run test:e2e` produces 13 green per-IDE smoke files locally on macOS, Linux, Windows
- Deleting a line from e.g. `GeminiCliHooksInstaller.ts` causes the Gemini e2e test to fail
- The CI workflow runs the matrix and blocks merges on red

### Anti-patterns

- Do NOT touch the user's real `~/.gemini/`, `~/.codeium/`, etc. Every test must use a fake HOME.
- Do NOT depend on a real worker daemon on port 37777 — instantiate the worker's HTTP app directly against an in-memory DB for tests.
- Do NOT use snapshot tests for the installer outputs — IDE config files may legitimately evolve. Assert the *semantic* invariant ("MCP block is present", "hook is registered") not the full JSON blob.

---

## Phase 2: Integration Quality Bar — Uniform Installer Contract

### Why now

Once the harness exists (Phase 1), the uneven quality across installers becomes actionable. `McpIntegrations.ts` cramming six IDEs into 358 lines is the outlier. Uniform contract = easier review, easier testing, easier future additions.

### What to implement

1. **Define `Integration` interface** at `src/services/integrations/types.ts` (file exists, 27 lines — expand it):
   ```typescript
   export interface Integration {
     id: string;                   // 'gemini-cli'
     label: string;                // 'Gemini CLI'
     tier: 1 | 2 | 3;              // Hook/Plugin | MCP | Transcript
     detect(): Promise<DetectionResult>;
     install(opts: InstallOpts): Promise<InstallResult>;
     uninstall(opts: UninstallOpts): Promise<UninstallResult>;
     doctor(): Promise<DoctorReport>;         // new — Phase 3 uses this
     backupPaths(): string[];                 // which files this installer touches
   }
   ```

2. **Split `McpIntegrations.ts`** into one file per IDE under `src/services/integrations/mcp/`:
   - `CopilotCliInstaller.ts`, `AntigravityInstaller.ts`, `GooseInstaller.ts`, `CrushInstaller.ts`, `RooCodeInstaller.ts`, `WarpInstaller.ts`
   - Each conforms to `Integration`
   - The registry `MCP_IDE_INSTALLERS` in `McpIntegrations.ts` becomes a thin re-export

3. **Backup-before-write** — Add a shared helper at `src/services/integrations/_backup.ts`:
   - Before any write to a user config file, copy the current file to `~/.claude-mem/backups/<YYYYMMDD-HHMMSS>/<original-path>`
   - Uninstall can restore from backup instead of hand-unwinding edits
   - Backup directory is auto-pruned to the most recent 10 installs

4. **Symmetric uninstall for every IDE** — Audit each installer against Phase 1's e2e test for idempotent uninstall. Any IDE that fails the "install → uninstall → assert clean" test gets a fix in this phase.

5. **`doctor()` stub on every installer** — Phase 3 fills these in. For Phase 2, just return a stub with `{ status: 'unknown' }`.

### Patterns to follow

- `CursorHooksInstaller.ts` is the reference for a mature, multi-step installer
- `json-utils.ts` (`readJsonSafe`, `writeJsonFileAtomic`) already exists — use it everywhere instead of ad-hoc `JSON.parse` / `fs.writeFileSync`

### Verification

- `rg "JSON.parse\(readFileSync" src/services/integrations` returns no results (all reads go through `readJsonSafe`)
- Every installer imports from `_backup.ts` at least once
- Every Phase 1 e2e test for `install → uninstall → assert clean` passes
- Every Integration in a new `src/services/integrations/registry.ts` exposes `detect/install/uninstall/doctor/backupPaths`

### Anti-patterns

- Do NOT remove `McpIntegrations.ts` entirely — keep it as the registry entry point to avoid breaking existing imports from `src/npx-cli/commands/install.ts`
- Do NOT put file-system backup code in each installer — share it in `_backup.ts`
- Do NOT block uninstall on backup restore if the backup is missing; fall back to hand-removal with a warning

---

## Phase 3: `npx claude-mem doctor` — First-Class Self-Diagnosis

### Why

Today, when memory "isn't working," the user's path is: read logs manually, open SQLite, maybe open an issue. This is the biggest UX cliff in claude-mem right now. A single command should tell the user exactly what's broken and how to fix it.

### What to implement

1. **Add `doctor` command** at `src/npx-cli/commands/doctor.ts`, registered in `src/npx-cli/index.ts`:
   - `npx claude-mem doctor` — full system check
   - `npx claude-mem doctor --ide <id>` — single-IDE deep check
   - `npx claude-mem doctor --fix` — attempt auto-repair of safe issues

2. **Checks performed:**
   - **Environment**: Bun available (use `utils/bun-resolver.ts`), uv available, Node version, writable HOME
   - **Plugin install**: `~/.claude/plugins/marketplaces/thedotmack/` exists, `plugin.json` readable, version matches npm package
   - **Worker**: hit `GET localhost:37777/api/health` (it exists — `src/services/worker/http/routes/`); print PID, uptime, DB row count
   - **Database**: `~/.claude-mem/claude-mem.db` exists, passes `PRAGMA integrity_check`, returns last observation timestamp
   - **Chroma**: `~/.claude-mem/chroma/` exists, collection count matches observation count
   - **Per-IDE**: call each installed IDE's `doctor()` from Phase 2, which should:
     - Assert the config file exists and contains the claude-mem block
     - Assert the hook script path is still valid
     - Assert the last observation from this IDE is < 48h old (warn if older, not fail)
     - For MCP-tier: attempt an MCP handshake against `plugin/scripts/mcp-server.cjs` and confirm the `claude_mem_search` tool is advertised

3. **Output format:**
   - TTY: colored sections with green/yellow/red dots, actionable suggestions
   - Non-TTY or `--json`: structured JSON for downstream tools
   - Non-zero exit code if any check fails (for CI use: `npx claude-mem doctor --json | jq`)

4. **`--fix` actions (safe only):**
   - Missing `~/.claude-mem/` directory → create
   - Worker not running → `npx claude-mem start`
   - Chroma collection out of sync → trigger re-index (hit existing worker endpoint)
   - Dead hook script paths → re-run the IDE's installer
   - **Never** delete user data. **Never** overwrite user config without backup.

### Patterns to follow

- `src/npx-cli/commands/install.ts` for the `@clack/prompts` + non-TTY fallback style
- `src/services/worker/http/routes/` for route paths to hit
- `plugin/scripts/mcp-server.cjs` for MCP handshake reference

### Verification

- `npx claude-mem doctor` returns exit 0 on a healthy install
- Deleting the Gemini hook from `~/.gemini/settings.json` and rerunning doctor shows RED for Gemini
- `npx claude-mem doctor --fix` re-installs the missing hook
- `npx claude-mem doctor --json` produces schema that matches `src/npx-cli/commands/doctor-schema.json` (checked in)
- Works offline (no network calls)

### Anti-patterns

- Do NOT make doctor require the worker to be running to print anything. Partial results are still useful.
- Do NOT `--fix` destructive actions. Auto-repair is additive only.
- Do NOT re-implement MCP handshake from scratch — import the existing MCP server's tool-discovery path.

---

## Phase 4: Per-IDE Telemetry Dashboard

### Why

Users can't tell if claude-mem is working well per IDE. Today, everything flows into one table. We need a "scoreboard" that answers "how much signal is claude-mem capturing from each of my tools?"

### What to implement

1. **Source tag at ingestion** — The worker already accepts a `source` field in hook payloads (noted in the prior plan). Audit `src/services/worker/` and make the source field:
   - Required on all observation inserts (non-null column in SQLite)
   - Constrained to the 12 known IDE ids plus `unknown`
   - Backfilled for historical rows via a migration in `src/services/sqlite/migrations/`

2. **`/api/dashboard` route** at `src/services/worker/http/routes/DashboardRoutes.ts`:
   - `GET /api/dashboard/sources` — returns per-source row counts, last-seen timestamps, and 7-day activity histogram
   - `GET /api/dashboard/health` — aggregated signal: observations/day trend, % of sessions that produced ≥1 summary, Chroma embedding lag
   - `GET /api/dashboard/session/:id` — drill-down

3. **Viewer tab "Sources"** — Extend `src/ui/viewer/` (React app) with a new tab that consumes `/api/dashboard/sources`:
   - One row per IDE with: name, row count, last activity, 7-day sparkline, health dot
   - Click-through to observation list filtered by source
   - Respect the "open-source viewer" constraint from `CLAUDE.md` (no Pro gating)

4. **Event bus hookup** — The worker already has SSE via `SSEBroadcaster.ts`. Emit a `source-update` event when a new observation arrives so the dashboard is live without polling.

### Patterns to follow

- Existing routes in `src/services/worker/http/routes/SearchRoutes.ts` for BaseRouteHandler extension
- `src/ui/viewer/` React structure for new tab addition
- Migration style in `src/services/sqlite/migrations/`

### Verification

- Fresh install, run a Claude Code + Gemini CLI session each → dashboard shows both sources with correct row counts
- Uninstall Gemini CLI integration → dashboard still shows the historical Gemini rows (data is retained; only ingestion stops)
- `/api/dashboard/sources` returns a response in < 100ms on a DB with 100k observations
- Non-claude-code sources are visible in the open-source viewer (no Pro gating)

### Anti-patterns

- Do NOT break existing observation queries — add `source` column as NULL-default first, backfill, then add NOT NULL constraint in a follow-up migration
- Do NOT ship a dashboard that requires the Pro Memory Stream UI
- Do NOT store PII in the source tag. The source tag is *only* the IDE id.

---

## Phase 5: Memory Quality — Signal/Noise Metrics and Tuning

### Why

"More observations" is not the goal. "More *useful* observations" is. Today there's no metric for memory quality. This phase adds one, then uses it to tune ingestion per IDE.

### What to implement

1. **Define quality metrics** at `src/services/quality/metrics.ts`:
   - **Recall**: of all `mem-search` queries in the last 30 days, what % returned a result the session actually acted on? (Needs a "search result was useful" signal — Phase 5a adds a thumbs-up / thumbs-down action on each search result.)
   - **Precision**: of all observations ingested, what % were recalled within 30 days? (Orphan rate.)
   - **Dedupe ratio**: how many incoming observations are near-duplicates of existing ones? (Uses Chroma similarity on ingest.)
   - **Per-source signal score**: weighted combination of the above, per IDE.

2. **Phase 5a — Feedback surface**:
   - `POST /api/search/:id/feedback` with `{ useful: boolean }`
   - Wire a `useful?` column into the search results in the viewer
   - Wire into the MCP server tool definition so agents (not just the user) can self-report feedback
   - This is a *self-improving* loop: high-quality observations get upranked, low-quality ones get deprioritized

3. **Phase 5b — Per-IDE tuning config** at `~/.claude-mem/settings.json` (file already exists per `CLAUDE.md`):
   ```json
   {
     "sources": {
       "windsurf": { "captureFileReads": false, "summarizeThreshold": 20 },
       "gemini-cli": { "captureAfterTool": true, "captureAfterAgent": true }
     }
   }
   ```
   - Adapters respect these settings before emitting observations
   - Defaults are tuned based on Phase 5 metrics observed during dog-fooding

4. **Phase 5c — Dedupe on ingest**:
   - Before inserting an observation, compute its Chroma embedding
   - If cosine similarity > 0.95 to an observation in the last 24h, update the existing row's `last_seen` instead of creating a duplicate
   - Record the dedupe count per source (feeds Phase 4's dashboard)

### Patterns to follow

- `src/services/sync/ChromaSync.ts` for embedding access
- `src/services/worker/Search.ts` for query augmentation
- `src/services/sqlite/observations/store.ts` for insertion point

### Verification

- Dedupe ratio on a typical Claude Code session is reported as a number (e.g. "15% of observations were near-duplicates")
- Turning `captureFileReads: false` for Windsurf actually reduces Windsurf's row count per session by a measurable amount
- A thumbs-up in the viewer updates the observation's `useful` column and is visible via `/api/search`
- Per-source signal score is displayed in the Phase 4 dashboard

### Anti-patterns

- Do NOT auto-delete "low-quality" observations. Dedupe is additive; pruning is a separate user-triggered action.
- Do NOT hardcode quality thresholds per IDE; put them in `~/.claude-mem/settings.json` so users can tune.
- Do NOT compute embeddings synchronously on the hot ingestion path — queue them (`src/services/queue/SessionQueueProcessor.ts` is the existing queue; extend it).

---

## Phase 6: Search & Recall — Promote the Hidden Superpower

### Why

`/mem-search` is the highest-value surface in claude-mem. Today it's a CLI + MCP tool. Per the worker-route list, it's already routable at `localhost:37777/api/search`. The work here is to make it **easy to use well** everywhere a user might need it.

### What to implement

1. **`npx claude-mem ask <question>`** (new command):
   - Wraps search with an LLM-backed answer layer — takes natural language, not keywords
   - Uses the existing `src/services/worker/agents/` (SDKAgent or OpenRouterAgent) to synthesize an answer from search results
   - Streams to stdout for terminal use
   - `--model` flag to pick the agent

2. **Search ranking improvements** in `src/services/worker/Search.ts`:
   - Boost observations from the current project (use `src/utils/project-name.ts` to scope)
   - Boost observations marked `useful` (from Phase 5)
   - Decay by age with a configurable half-life in `~/.claude-mem/settings.json`
   - Dedupe near-identical results in the response (complement to Phase 5 ingest dedupe)

3. **Cross-session threading**:
   - When returning a result, include a `related` array of observations that share ≥2 concepts with the match
   - The `mem-search` skill already exposes this as a tool; ensure the result payload supports it

4. **Universal `/mem-search` slash command** across IDE integrations:
   - Currently lives in the Claude Code plugin as `plugin/skills/mem-search/SKILL.md`
   - Replicate the entry point for Cursor (via `.cursor/rules/*.mdc`), Windsurf (via `.windsurf/rules/*.md`), OpenCode (custom tool already planned), and Gemini CLI
   - Each IDE invokes the same `/api/search` — no per-IDE search logic

### Patterns to follow

- `src/services/worker/agents/SDKAgent.ts` and `OpenRouterAgent.ts` for the agent wrapper
- Existing MCP tool definition in `plugin/scripts/mcp-server.cjs`
- `plugin/skills/mem-search/SKILL.md` as the canonical skill spec

### Verification

- `npx claude-mem ask "how did I handle the migration last week?"` returns a synthesized answer with citations to specific observation IDs
- Running `/mem-search` inside Cursor / Windsurf / OpenCode / Gemini CLI returns results from the same `/api/search` backend
- Sorting a result set without the boost and with the boost shows a visible difference in ranking on a seeded DB
- `related` array is non-empty for results that share concepts

### Anti-patterns

- Do NOT create a separate search endpoint per IDE. One endpoint, many entry points.
- Do NOT make `ask` require a paid model. Default to a free/local model with an opt-in override.
- Do NOT break the existing `/api/search` response shape. Additions only.

---

## Phase 7: Context Injection Hygiene

### Why

Every Tier 1 IDE install writes a context section to a file (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `.windsurf/rules/`, `.codex/AGENTS.md`, `MEMORY.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `WARP.md`, `.roo/rules/`). That's 10+ files written across 12 IDEs. Today, the write format is slightly different per installer — a maintenance trap. Make it uniform, lightweight, and non-destructive.

### What to implement

1. **Shared context-block format** at `src/utils/context-injection.ts` (file exists — generalize it):
   - All claude-mem context lives between `<claude-mem-context>` and `</claude-mem-context>` tags (pattern already in `CursorHooksInstaller.ts` and `GeminiCliHooksInstaller.ts`)
   - Inside the block: no free-form prose. Machine-readable YAML frontmatter + a short preamble.
   - Bytes budget: ≤ 1 KB per file to fit Windsurf's 6 KB rule-file cap with room for user rules

2. **Content strategy**:
   - Drop per-session "last activity" dumps (noise)
   - Keep: the `/mem-search` invocation hint, the skill file paths, and a ≤ 5-item "what I'm good at recalling" list auto-generated from the highest-signal concepts in the DB
   - Refresh on-demand via `npx claude-mem refresh-context`, not on every session

3. **Audit every IDE's context file write** — For each installer: confirm (a) merges with existing user content outside the tagged block, (b) preserves user-authored content verbatim, (c) is reversible by uninstall.

4. **Add `tests/e2e/context-injection.e2e.test.ts`**:
   - Seeds a user file with custom content
   - Runs install
   - Asserts: user content is intact, claude-mem block is added
   - Runs uninstall
   - Asserts: claude-mem block is gone, user content is still intact

### Patterns to follow

- Existing tag-based insertion in `src/utils/claude-md-utils.ts` and `src/utils/agents-md-utils.ts`
- `context-injection.test.ts` already exists — extend it

### Verification

- All 10 context files produced by the installers are under 1 KB
- User content outside the `<claude-mem-context>` tag is byte-identical before install and after uninstall
- `npx claude-mem refresh-context` updates the content in-place without duplicating the block
- The e2e test catches a regression where an installer writes outside the tagged block

### Anti-patterns

- Do NOT inject per-session activity logs into context files. That's what the worker API is for.
- Do NOT use a different tag name per IDE. One tag, everywhere.
- Do NOT truncate by character count mid-word — truncate at YAML boundary.

---

## Phase 8: Distribution Hardening

### Why

The npm package is the install surface for everything. Today there's no check that `npm pack` produces a working install on Windows. No size budget. No signature.

### What to implement

1. **Package size budget**:
   - Add `scripts/check-package-size.js` to `prepublishOnly`
   - Fail the build if `npm pack --dry-run` exceeds a configured size (start at current size + 10%)
   - This prevents accidental `node_modules/` or `.git` inclusion

2. **Smoke install on all platforms in CI**:
   - Add to `.github/workflows/e2e.yml` (from Phase 1) a step that:
     - Packs with `npm pack`
     - Installs the tarball into a fresh fake HOME: `npm install -g ./claude-mem-<v>.tgz`
     - Runs `claude-mem version && claude-mem doctor --json`
     - Matrix on macOS, Linux, Windows
   - This is the only true "does install work end-to-end" check

3. **Npm package provenance**:
   - Enable `--provenance` on `npm publish` (supported by GitHub-hosted runners)
   - Update `.github/workflows/npm-publish.yml`

4. **Version drift guard**:
   - Add `scripts/check-version-consistency.js` that verifies `package.json`, `plugin/.claude-plugin/plugin.json`, and `openclaw/package.json` all agree
   - Run in `prepublishOnly`

5. **Release notes automation**:
   - Per `CLAUDE.md`: "No need to edit the changelog ever, it's generated automatically." Verify the automation is correctly summarizing the IDE-expansion changes. If not, improve the generator.

### Patterns to follow

- `scripts/build-hooks.js` is the build entry; add size check as a post-step
- Existing `.github/workflows/npm-publish.yml`

### Verification

- `npm pack --dry-run` size is reported in CI logs and fails on regression
- `npm-publish.yml` publishes with provenance (visible on npm)
- Fresh Windows runner can `npm i -g claude-mem && claude-mem doctor` successfully
- Version drift between the three `package.json`-ish files causes `prepublishOnly` to fail

### Anti-patterns

- Do NOT bump the size budget silently — require a PR note justifying any increase
- Do NOT skip the Windows install matrix. It's the platform most likely to break.
- Do NOT publish without provenance once enabled.

---

## Phase 9: Developer Experience — Single Command to Contribute

### Why

Right now, bootstrapping a dev environment requires understanding Bun vs Node, the plugin marketplace, worker ports, and Chroma. The instructions in `CLAUDE.md` ("Build Commands: `npm run build-and-sync`") help but don't cover everything.

### What to implement

1. **`npm run dev`** — a single command that:
   - Builds
   - Starts the worker on a separate port (`37780` by default, configurable) so it doesn't collide with the user's real worker
   - Points it at a separate dev DB (`~/.claude-mem-dev/`)
   - Watches `src/**` and rebuilds on change
   - Tails worker logs

2. **Dev fixtures** at `scripts/seed-dev-db.js`:
   - Seeds the dev DB with ~500 realistic observations across 5 sources
   - Makes the viewer actually usable during development

3. **`npm run smoke`** — runs the Phase 1 harness against the dev build with fake HOMEs. One command to check "did I break anything?"

4. **`docs/public/CONTRIBUTING.md`** (new):
   - Architecture at-a-glance (reuse `CLAUDE.md`'s overview)
   - "Add a new IDE" walkthrough that points at the `Integration` contract from Phase 2
   - "Add a new route" walkthrough that points at `BaseRouteHandler`
   - "Test your change" walkthrough that runs `npm run smoke`

5. **`npm run check`** — one command that runs: tsc, lint (if configured), `npm run test`, `npm run smoke`. Intended as the pre-commit / pre-PR gate.

### Patterns to follow

- Existing scripts in `scripts/`
- `CLAUDE.md` overview style

### Verification

- A new contributor can `git clone && npm i && npm run dev` and see the viewer with seeded data in < 3 minutes
- `npm run check` fails on any TS error, test failure, or smoke regression
- CONTRIBUTING.md is linked from README.md

### Anti-patterns

- Do NOT make `npm run dev` overwrite the user's production claude-mem install. Separate port + separate DB dir.
- Do NOT require secrets for contributors to run the dev environment.

---

## Phase 10: Verification — Cross-Platform, End-to-End, Observable

This replaces (and completes) Phase 10 of the prior plan.

### What to verify

1. **All Phase 1 e2e smoke tests pass** on macOS, Linux, Windows via CI matrix
2. **`npx claude-mem doctor`** returns green on a fresh install of every supported IDE on each platform
3. **Dashboard** shows non-zero signal per IDE after running a seeded session on each
4. **Search/ask** returns relevant results across sessions
5. **Install / uninstall** is fully reversible per Phase 1 harness (backup + restore)
6. **Package provenance** is attested for the published tarball
7. **Contributor path**: fresh clone → `npm run check` → green

### Per-integration verification matrix

Extend the matrix from `.plan/npx-distribution.md` Phase 10 with three new columns:

| Integration | Captures Sessions | Search via MCP | Context Injection | **Doctor Green** | **Uninstall Symmetric** | **Dashboard Visible** |
|-------------|-------------------|----------------|-------------------|------------------|--------------------------|------------------------|
| Claude Code | … | … | … | ✔ | ✔ | ✔ |
| Gemini CLI | … | … | … | ✔ | ✔ | ✔ |
| …           | … | … | … | ✔ | ✔ | ✔ |

All three new columns must be ✔ before the phase is declared complete.

### Anti-patterns

- Do NOT declare Phase 10 complete based on one platform
- Do NOT skip the uninstall-symmetry check — it's the single most important regression surface
- Do NOT merge a new IDE integration in the future without extending this matrix

---

## Priority and sequencing

| Phase | Deliverable | Depends on | Unblocks |
|-------|-------------|------------|----------|
| 0 | Current-state audit | — | All |
| 1 | E2E smoke harness + CI | 0 | 2, 8, 10 |
| 2 | Uniform Integration contract + backup | 0, 1 | 3 |
| 3 | `doctor` command | 2 | 10 |
| 4 | Per-IDE telemetry dashboard | 0, 2 | 5 |
| 5 | Memory quality metrics + tuning | 4 | 6 |
| 6 | Search/`ask` elevation | 5 | 10 |
| 7 | Context injection hygiene | 2 | 10 |
| 8 | Distribution hardening | 1 | 10 |
| 9 | Dev experience | 1 | — |
| 10 | Cross-platform verification | 1, 3, 4, 6, 7, 8 | Ship |

A reasonable order to execute: 0 → 1 → 2 → 3 → 7 → 4 → 5 → 6 → 8 → 9 → 10.

Phases can ship incrementally — each one is useful on its own.

## Out of scope (explicit)

- Adding new IDE integrations beyond the 12 already planned
- Rewriting the worker, the SQLite layer, or Chroma
- Pro-only features (gated UI, tunnel provisioning) — live outside this repo per `CLAUDE.md`
- Changing the on-disk data model in backwards-incompatible ways
- Removing Bun as the runtime for the worker (still required by `bun:sqlite`)
- JetBrains, Zed, Neovim, Emacs, Aider, Continue.dev, Amazon Q / Kiro (inherited from the prior plan)
