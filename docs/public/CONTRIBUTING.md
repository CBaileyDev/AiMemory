# Contributing to claude-mem

claude-mem is an AGPL-licensed memory-compression layer that plugs into every
major AI coding tool. This doc is the one-page "how do I get productive"
guide.

If you're looking for the architectural overview, `CLAUDE.md` at the repo
root is the source of truth — it describes the 5-hook lifecycle, the
worker-service, the SQLite schema, and the privacy model in four pages.

## Prerequisites

- **Node ≥ 18** — required by the npx CLI and the build scripts.
- **Bun ≥ 1.0** — required by the worker (`bun:sqlite`) and the e2e test
  runner (`bun test`).
- **uv** (optional) — only needed if you hack on the Chroma embedding
  path; the worker auto-installs it on first run otherwise.

## One-command setup

```bash
git clone https://github.com/thedotmack/claude-mem.git
cd claude-mem
npm install
npm run build
npm run dev:server   # starts the worker against a dev DB on port 37780
```

`dev:server` isolates your development environment from any real
claude-mem install:

| | Production | Dev |
|---|---|---|
| Data dir | `~/.claude-mem/` | `~/.claude-mem-dev/` |
| Worker port | `37777` | `37780` |
| Viewer | `http://localhost:37777/` | `http://localhost:37780/` |

On first run, `dev:server` calls `scripts/seed-dev-db.js` with
`--fresh`, which populates the dev DB with ~500 realistic observations
across five IDE sources so the viewer is immediately useful.

## The pre-PR gate

```bash
npm run check
```

runs, in order:

1. `npm run typecheck` — `tsc --noEmit`.
2. `npm run test` — the full unit + integration test suite.
3. `npm run test:e2e` — the IDE-integration smoke harness (see below).
4. `npm run check:dist` — package size + version-drift guards.

If `npm run check` is green, your change is unlikely to regress anything
the existing reviewers care about. If it's red, the failure message will
point you at the exact file and line.

For a slimmer loop during development:

```bash
npm run smoke       # alias for `npm run test:e2e`, ~3s
npm run verify      # Phase 10 per-IDE install/uninstall matrix, ~30s
npm run check:dist  # size + version drift, ~2s
```

## Add a new IDE integration

Every IDE integration conforms to the `Integration` contract in
`src/services/integrations/types.ts`:

```ts
interface Integration {
  id: string;                         // 'your-ide'
  label: string;                      // 'Your IDE'
  tier: 1 | 2 | 3;                    // hook/plugin | MCP | transcript
  detect(): Promise<DetectionResult>;
  install(opts?: InstallOpts): Promise<ExitCode>;
  uninstall?(opts?: UninstallOpts): Promise<ExitCode>;
  doctor(): Promise<DoctorReport>;
  backupPaths(): string[];
}
```

### Step-by-step

1. **Decide which tier you need.**
   - Tier 1 = real-time hook/plugin (highest fidelity; see
     `GeminiCliHooksInstaller.ts` as a reference).
   - Tier 2 = MCP-only (search + context injection; see
     `mcp/kimi.ts` for the minimal template).
   - Tier 3 = transcript watching (passive; see `CodexCliInstaller.ts`).

2. **For MCP-tier IDEs, copy `src/services/integrations/mcp/kimi.ts`.**
   ```ts
   export const yourIdeIntegration: Integration = buildJsonMcpIntegration({
     id: 'your-ide',
     label: 'Your IDE',
     tier: 2,
     configPath: () => path.join(homedir(), '.your-ide', 'mcp.json'),
     configKey: 'mcpServers',
     async detect() {
       const p = path.join(homedir(), '.your-ide');
       return existsSync(p)
         ? { detected: true, reason: `${p} exists` }
         : { detected: false, reason: `${p} not found` };
     },
   });
   ```
   The shared helper at `mcp/_shared.ts` gives you install, uninstall,
   doctor, and backup/restore for free.

3. **Register it.** Add one line to
   `src/services/integrations/mcp/index.ts` and the IDE will flow
   through to `REGISTRY`, `MCP_IDE_INSTALLERS`, and `MCP_IDE_UNINSTALLERS`.

4. **Wire detection.** Add a new entry to `detectInstalledIDEs()` in
   `src/npx-cli/commands/ide-detection.ts`.

5. **Add the ID to the install dispatch.** In
   `src/npx-cli/commands/install.ts`, add your id to the `case`
   fall-through list for MCP-tier IDEs, or add a dedicated case if
   you're Tier 1 or 3.

6. **Extend the e2e harness.** Add the id to `ALL_IDE_IDS` in
   `tests/e2e/harness.ts` and, if the IDE has a dedicated uninstaller,
   to the `UNINSTALLERS` table.

7. **Write an e2e test.** Copy a block from
   `tests/e2e/per-ide.e2e.test.ts` — install → assert config written
   → uninstall → assert config cleaned. One happy-path test plus one
   "user content preserved" test is the bar.

8. **Run the verification matrix.**
   ```bash
   npm run verify -- --ide your-ide
   ```
   Must pass before you open a PR.

## Add a new worker HTTP route

1. Copy an existing route module from
   `src/services/worker/http/routes/` (e.g. `DataRoutes.ts`).
2. Extend `BaseRouteHandler` and implement `getRoutes()`.
3. Register it in `src/services/worker-service.ts` the same way the
   existing routes are registered.
4. Add a unit test under `tests/worker/http/`.

## Test your change

- **Unit / integration tests:** `npm run test` runs `bun test tests/`.
  Stay under the existing files where possible — the CLAUDE.md files
  under each test directory document the conventions.
- **E2E IDE tests:** `npm run test:e2e` runs the full harness in ~4s
  and exercises every installer in a sandboxed fake HOME. Your new
  IDE must land a test here.
- **Verification matrix:** `npm run verify` runs install → doctor →
  uninstall for every integration and confirms no residue. Run locally
  before PR.
- **Package size:** `npm run check:size` ensures the npm tarball stays
  under the budget in `.package-size-budget.json`.

## Anti-patterns

- Do **not** require Bun for install-time logic. The npx CLI entry
  point is pure Node.
- Do **not** clone the repo at install time. The npm package ships
  pre-built artifacts.
- Do **not** import from `bun:sqlite` outside the worker.
- Do **not** overwrite user config files — always merge. Every
  installer uses `src/services/integrations/_backup.ts` to snapshot
  pre-install state first.
- Do **not** use a different context-tag name per IDE.
  `<claude-mem-context>` is the standard.

## Releasing

Releases are cut from `main` via `np`:

```bash
npm run release:patch
```

`prepublishOnly` runs `build` and `check:dist`; `npm publish` runs
with `--provenance`. The CI workflow at `.github/workflows/npm-publish.yml`
is the authoritative release path.

## Where to ask for help

- Open an issue at https://github.com/thedotmack/claude-mem/issues.
- For design questions on a phase still in the plan file, comment
  on the plan doc (`.plan/`) rather than opening a code PR.
