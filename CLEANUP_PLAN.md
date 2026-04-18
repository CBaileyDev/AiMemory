
# AiMemory Cleanup & Professionalization Plan

## Summary

Goal: turn the repo into a professional, installable, contributor-friendly project by removing historical clutter, completing the public rename to AiMemory, restoring a green static-quality baseline, trimming shipped package contents, and simplifying the highest-risk code paths without behavior regressions.

**Chosen defaults:**
- Delete stale plan/report/history files instead of archiving them
- Keep checked-in runtime artifacts (`plugin/`, `openclaw/`) in git
- Simplify only when the new version is behaviorally equivalent or measurably better and is covered by tests

**Order matters:** repo-surface cleanup runs in parallel with restoring a green typecheck baseline; rename comes next (with migration upgrader as a hard prerequisite of the runtime rename); then packaging/CI hardening; then structural refactors.

---

## Phase 0 — Baseline (do before anything else, run in parallel)

### 0a. Audit current typecheck error count
Before any rename or refactor, run `npm run typecheck` and record the full error list. The current tsconfig has `lib: ["ES2022"]` and `types: ["node"]` only — the viewer code uses React JSX and DOM APIs (missing from that lib list) and the worker uses Bun-native APIs (also missing). You need this baseline so rename-induced regressions can be distinguished from pre-existing failures.

### 0b. Add the CI quality gate on day one
Add a PR `quality` workflow on `ubuntu-latest` running `npm run typecheck && npm test` **before any other phase lands.** Currently `typecheck` appears zero times in `e2e.yml`, `npm-publish.yml`, or `viewer.yml`. Nothing enforces a green typecheck on push. This gate must exist first.

---

## Phase 1 — Repo-surface cleanup

1. **Delete stale tracked history and clutter:** remove `PLAN.md`, `CodexPlan.md`, `GeminiPlan.md`, `KimiPlan.md`, `.plan/*`, `.claude/reports/*`, `plugin/hooks/bugfixes-2026-01-10.md`, `.translation-cache.json`, and any other tracked one-off audits/reports not referenced by current docs, tests, or runtime code.

2. **Collapse CLAUDE.md sprawl (use a named list, not a rule):** audit which `CLAUDE.md` files are listed in `package.json`'s `files` array before deleting anything — `plugin/CLAUDE.md` ships in the npm tarball and is read by Claude Code at install time. Produce an explicit list of files safe to delete vs. runtime-consumed, then remove only the safe ones. Internal `src/**/CLAUDE.md` and `tests/**/CLAUDE.md` files are candidates; packaged `plugin/**/CLAUDE.md` files must be verified first.

3. **Move install/runtime templates to a named template directory:** move `WARP.md` and the Copilot instructions file into `src/integrations/templates/`. Workspace files are generated from there during install. "A dedicated source-of-truth template directory under the integration layer" = `src/integrations/templates/`. Update any installer code that currently reads from the repo root.

4. **Create `CONTRIBUTING.md` from scratch** (the file does not currently exist). Include: dev setup, the new typecheck + test gate requirements, branch/PR conventions, and the "no correctness for aesthetics" rule that should appear on every refactor PR.

5. **Clean up comments aggressively:** delete stale phase/issue/PR-history comments, outdated file headers, and "monolith was refactored" narrative comments. Keep only invariant comments, platform gotchas, and contracts the code cannot make obvious by itself.

---

## Phase 2 — Restore static-quality baseline

6. **Fix the TypeScript config split:** split `tsconfig.json` into a shared base plus separate server/Bun and browser/viewer configs. Add the correct DOM and Bun type surfaces to each target. Fix all current typecheck failures (audited in step 0a) before any large rename or refactor lands.

7. **Normalize logger/component typing:** replace ad-hoc string unions or drifting enums with a single authoritative component-name taxonomy consumed by both source and tests.

---

## Phase 3 — Rename (public then runtime, with hard prerequisite gate)

> **Gate:** Step 9 (migration upgrader) **must be merged before step 8 ships to any published version.** If the runtime rename ships before the upgrader, existing users will get a fresh `~/.aimemory` while their data is orphaned in `~/.claude-mem`.

8. **Rename the public product (separate PR):** update `package.json` name/bin fields, CLI help/output, manifests under `plugin/.claude-plugin`, the OpenClaw package/commands, README, badges, workflow names, and all user-facing docs from `claude-mem` → `AiMemory`/`aimemory`.
   - **Decide the npm transition strategy first** (this is a one-way door): you cannot rename a package on npm — you publish a new one and deprecate the old. Answer before opening the PR: new package name (`aimemory` or scoped `@thedotmack/aimemory`?), deprecation timeline for `claude-mem`, and what happens to the marketplace slug `thedotmack` in `scripts/sync-marketplace.cjs` which is baked to that path.

9. **Implement the migration upgrader (prerequisite of step 8 publishing):** one-time upgrader that imports legacy data/settings/transcript-watch/backups from `~/.claude-mem` on first run and rewrites per-IDE config entries from old identifiers to new ones. Do not dual-write indefinitely.

10. **Rename the runtime surface (separate PR, after step 9 is merged):** change `~/.claude-mem` → `~/.aimemory`, `CLAUDE_MEM_*` → `AIMEMORY_*`, log/database filenames, transcript-watch paths, and installer-written identifiers. Old names become migration inputs only.

---

## Phase 4 — Packaging & CI hardening

11. **Tighten `npm pack` contents:** narrow `package.json.files` so the tarball excludes OpenClaw tests/docs, internal CLAUDE docs, stale bugfix/history markdown, and other non-runtime files while preserving the current install flow.

12. **Formalize the checked-in artifact policy:** keep `plugin/` and `openclaw/` in git, but make each packaged copy generated from one source file or build step, with sync tests preventing hand-edited drift. `scripts/smart-install.js` vs `plugin/scripts/smart-install.js` is the first required consolidation.

---

## Phase 5 — Structural refactors (each as its own PR)

> Every simplification must pass existing behavioral tests before legacy code is deleted. If coverage is missing for a hotspot, add the test first, then simplify.

13. **Database.ts as sole migration authority (own PR, before 14–16):** make `src/services/sqlite/Database.ts` and `MigrationRunner` the only migration authority. Remove duplicated schema/migration logic from `SessionStore`; keep `SessionStore` only as a thin compatibility facade if still needed. Push CRUD into already-split sqlite submodules.

14. **Finish the search refactor:** `SearchManager` stops owning semantic/search-path orchestration directly. Parameter coercion moves into shared route/schema helpers. Deprecated `queryChroma()` disappears. The wrapper only coordinates formatting/backward-compatible entrypoints.

15. **Split `worker-service.ts` across three PRs** (currently 1,252 lines, not the ~300-line orchestrator its comments claim):
    - PR A: extract background initialization + transcript integration (highest risk — touches startup ordering)
    - PR B: extract route composition
    - PR C: extract bootstrap/health as cleanup; update misleading comments

16. **Split oversized route handlers (own PR per handler):** start with `SessionRoutes` and `SettingsRoutes`. Route handlers stop doing direct JSON/file persistence and instead call dedicated services for settings, branch/MCP operations, and session lifecycle.

17. **Unify duplicate transcript parsers:** extract shared parsing primitives from `src/utils/transcript-parser.ts` (266 lines) and `src/shared/transcript-parser.ts` (144 lines). **Caution:** these likely serve different module contexts (hooks/ESM vs. shared/worker). Before merging, verify that a single shared primitive can be imported in both contexts without creating a circular dependency or a Bun-vs-Node bundling conflict.

---

## Public Interface Changes

- **Package/CLI:** `aimemory` is the canonical package/binary name; `claude-mem` is deprecated with a published timeline.
- **Runtime/config:** `~/.aimemory`, `AIMEMORY_*`, renamed DB/log/transcript files, renamed plugin IDs and integration-written identifiers.
- **Templates:** runtime context templates sourced from `src/integrations/templates/`, not top-level repo files.
- **Contributor contract:** CI enforces `npm run typecheck && npm test` as first-class required checks (added in phase 0).

---

## Test Plan

**Sequencing rule:** the PR quality workflow must exist before any phase 1–5 PR is opened. Tests for each phase must be green before that phase's legacy code is deleted.

- `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run verify`, and viewer/package checks all green from a clean checkout.
- Migration tests covering: fresh install, upgrade from existing `~/.claude-mem`, env-var fallback/import, **per-IDE config file rewrite** (Cursor `.cursor/mcp.json`, Claude Code hooks config — a passing SQLite migration test that misses IDE config rewrite is insufficient), and no data loss for SQLite/logs/backups/transcript-watch config.
- Tarball allowlist tests using `npm pack --json --dry-run` proving known junk is excluded (including `plugin/hooks/bugfixes-2026-01-10.md`, internal CLAUDE docs, OpenClaw test assets).
- **npm publish smoke test:** after the rename, verify `npx aimemory` resolves to the right binary — add to `dist-checks` alongside the current `claude-mem version` smoke test.
- Search output parity tests: define the oracle explicitly (snapshots captured before the refactor, stored in `tests/fixtures/search-snapshots/`) rather than leaving "search output parity" underspecified.
- Refactor parity tests: session lifecycle behavior, settings endpoint behavior, transcript parsing equivalence, generated-script sync checks for packaged artifacts.

---

## Assumptions

- Aggressive deletion is intentional: implemented plans, internal reports, and stale audits are removed rather than archived.
- Checked-in runtime artifacts stay in git, but package contents are aggressively curated so git-tracked does not imply npm-shipped.
- Immediate rename means the public name changes now, but the migration upgrader is a hard prerequisite of the runtime rename shipping to users.
- External slugs that cannot be changed atomically may stay temporarily only where an external system requires them; user-facing product, docs, identifiers, and installed runtime names use AiMemory.
- No cleanup step is allowed to trade correctness for aesthetics; the replacement must either reduce duplication/complexity or improve reliability while matching or exceeding current behavior.
