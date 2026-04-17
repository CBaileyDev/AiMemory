<div align="center">

# AiMemory

**One persistent memory layer for every AI coding assistant.**

Install once, and your context follows you across Claude Code, Claude Desktop, Cursor, Codex, Gemini, Kimi, OpenCode, Windsurf, OpenClaw, Copilot CLI, Antigravity, Goose, Crush, Roo Code, and Warp — both the CLI **and** the IDE surface of each.

[![License: AGPL 3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Node ≥ 18](https://img.shields.io/badge/node-%E2%89%A5%2018-brightgreen.svg)](package.json)
[![Bun ≥ 1.0](https://img.shields.io/badge/bun-%E2%89%A5%201.0-f472b6.svg)](https://bun.sh)
[![15 IDEs](https://img.shields.io/badge/IDE%20integrations-15-8b5cf6.svg)](#supported-ides)
[![Tests](https://img.shields.io/badge/e2e%20tests-105%20passing-22c55e.svg)](#testing)

[Quick start](#quick-start) · [Supported IDEs](#supported-ides) · [CLI reference](#cli-reference) · [Architecture](#architecture) · [Contributing](#contributing) · [License](#license)

</div>

---

## What AiMemory does

Every AI coding tool captures its own sessions locally. Claude Code writes JSONL, Codex writes JSONL, Cursor writes hooks events, Gemini writes hooks events, Windsurf writes Cascade events, and so on. **None of them share this memory with each other.**

AiMemory is a single worker that:

1. **Captures** sessions from every supported IDE via hooks, plugins, or transcript watching — in real time.
2. **Compresses** them into structured observations (decisions, bugfixes, features, refactors, discoveries, changes) with concepts, file refs, and full-text search.
3. **Recalls** them on demand via a natural-language `ask` command, an MCP server that every supported IDE can use, and a local web viewer.

One install writes the right config to every IDE you have. One `uninstall` reverses it. One `doctor` tells you what's broken. One `verify` proves every integration works end-to-end on your machine.

## Quick start

```bash
npx aimemory install
```

That's it. AiMemory auto-detects every supported IDE on your system and offers a multi-select. Pick one or many; the config is merged into the files each IDE already reads, never overwritten.

> The npm package name is still `claude-mem` (see [Upstream attribution](#upstream-attribution)). Invoke any of these interchangeably:
>
> ```bash
> npx aimemory <command>
> npx claude-mem <command>
> ```

### Install for a specific IDE

```bash
npx claude-mem install --ide claude-code
npx claude-mem install --ide claude-desktop
npx claude-mem install --ide cursor
npx claude-mem install --ide gemini-cli       # covers Gemini CLI + Gemini Code Assist VS Code
npx claude-mem install --ide codex-cli        # covers Codex CLI + Codex VS Code extension
npx claude-mem install --ide kimi             # covers Kimi Code CLI + Kimi Code for VS Code
npx claude-mem install --ide windsurf
npx claude-mem install --ide opencode
npx claude-mem install --ide openclaw
npx claude-mem install --ide copilot-cli
npx claude-mem install --ide antigravity
npx claude-mem install --ide goose
npx claude-mem install --ide crush
npx claude-mem install --ide roo-code
npx claude-mem install --ide warp
```

### Start the worker

```bash
npx claude-mem start         # background worker on :37777
npx claude-mem status        # see PID, uptime, DB row count
npx claude-mem stop
```

Open the viewer at `http://localhost:37777/`.

---

## Supported IDEs

AiMemory's guiding principle: **both CLI and IDE surfaces of every vendor are covered, and one install writes both wherever the vendor already shares config.**

| Vendor | CLI | IDE / desktop | How we cover it | Single install? |
|---|---|---|---|---|
| **Claude** | Claude Code (plugin) | Claude Desktop (MCP config) | Marketplace plugin + platform-specific `claude_desktop_config.json` | No — two distinct configs |
| **Codex** | Codex CLI (transcript) | Codex VS Code extension | `~/.codex/config.toml` MCP block + `~/.claude-mem/transcript-watch.json` | **Yes — shared TOML** |
| **Kimi** | Kimi Code CLI | Kimi Code for VS Code | `~/.kimi/mcp.json` | **Yes — shared JSON** |
| **Gemini** | Gemini CLI (hooks) | Gemini Code Assist VS Code | `~/.gemini/settings.json` — hooks for CLI, `mcpServers` for IDE | **Yes — same file** |
| **Cursor** | — | Cursor IDE | `~/.cursor/hooks.json` + `~/.cursor/mcp.json` | IDE-only |
| **OpenCode** | OpenCode CLI | — | Bun plugin at `~/.config/opencode/plugins/claude-mem.js` + `AGENTS.md` | CLI-native |
| **Windsurf** | — | Windsurf IDE | `~/.codeium/windsurf/hooks.json` + `.windsurf/rules/` | IDE-only |
| **OpenClaw** | OpenClaw gateway | — | Pre-built plugin at `~/.openclaw/extensions/claude-mem/` | Gateway |
| **Copilot CLI** | GitHub Copilot CLI | — | `~/.github/copilot/mcp.json` + `.github/copilot-instructions.md` | CLI-only |
| **Antigravity** | — | Antigravity IDE | `~/.gemini/antigravity/mcp_config.json` | IDE |
| **Goose** | Goose CLI | — | `~/.config/goose/config.yaml` | CLI |
| **Crush** | Crush CLI | — | `~/.config/crush/mcp.json` | CLI |
| **Roo Code** | — | Roo Code (VS Code) | `.roo/mcp.json` + `.roo/rules/` | IDE |
| **Warp** | — | Warp terminal | `~/.warp/mcp.json` + `WARP.md` | Terminal |

15 integrations in total. Every one has a symmetric uninstall that restores your pre-install config byte-for-byte.

---

## CLI reference

All commands are exposed under the `claude-mem` binary (invokable as `npx claude-mem ...`).

### Install / lifecycle

| Command | Does |
|---|---|
| `install` | Interactive multi-select across detected IDEs. |
| `install --ide <id>` | Install for one specific IDE. |
| `update` | Re-run install against the latest bundled plugin. |
| `uninstall` | Remove plugin, cache, marketplace registration, and per-IDE configs. Data in `~/.claude-mem/` is preserved. |
| `version` | Print the current version. |

### Worker control

| Command | Does |
|---|---|
| `start` / `stop` / `restart` / `status` | Manage the worker daemon on port 37777. |
| `transcript watch` | Start the transcript-only watcher (for IDEs that don't emit hooks). |

### Memory query

| Command | Does |
|---|---|
| `search <query>` | Raw JSON search result list. |
| `ask <question>` | Natural-language answer built from search results with `[obs#123]` citations that map back to SQLite rows. `--limit`, `--project`, `--model`, `--json`. |

### Diagnostics

| Command | Does |
|---|---|
| `doctor` | System-wide self-diagnosis: environment, plugin install, worker health, and every IDE integration. |
| `doctor --ide <id>` | Check a single IDE. |
| `doctor --fix` | Safe auto-repair — re-runs failing installers, creates missing dirs. Never destructive. |
| `doctor --json` | Machine-readable `DoctorReport` for CI. Exit codes: 0 ok, 1 warn, 2 fail. |

---

## How it works

1. **Hooks or plugins or transcript watchers** capture each IDE session as it happens.
2. The hook sends a JSON payload over a local Unix socket (or TCP 37777) to the worker.
3. The worker normalizes the payload through a **platform adapter** (`src/cli/adapters/`) into a `NormalizedHookInput`.
4. An **event handler** compresses the raw session into observations: decisions, bugfixes, features, refactors, discoveries, changes.
5. Observations are stored in **SQLite** with FTS5 full-text search and mirrored to **Chroma** for semantic vector search.
6. On the next session, the worker **injects context** back into the IDE's native context mechanism (CLAUDE.md, GEMINI.md, `.cursor/rules/`, `AGENTS.md`, `WARP.md`, etc.).
7. The MCP server (`plugin/scripts/mcp-server.cjs`) exposes `search`, `timeline`, and `get_observations` tools to any IDE that speaks MCP.

### The 3-layer search workflow

AiMemory's memory can get large fast. Agents query it efficiently using a three-layer pattern:

```text
1. search(query)         →  ~50-100 tokens per hit, just IDs + titles
2. timeline(around_id)   →  surrounding context for interesting hits
3. get_observations(ids) →  full details ONLY for filtered IDs (~1,000 tokens each)
```

Net: ~10× token savings vs. "dump everything and let the model sort it out."

---

## Architecture

| Layer | Files | Role |
|---|---|---|
| NPX CLI | `src/npx-cli/` | `install` / `uninstall` / `start` / `status` / `ask` / `doctor` / `search` — pure Node, no Bun required. |
| Installer contract | `src/services/integrations/types.ts` | Every IDE conforms to `Integration { detect, install, uninstall, doctor, backupPaths }`. |
| Per-IDE installers | `src/services/integrations/*.ts` + `src/services/integrations/mcp/*.ts` | One file per IDE. Shared backup/restore at `_backup.ts`. |
| Registry | `src/services/integrations/registry.ts` | Central `REGISTRY` map that the npx CLI, `doctor`, and the verification matrix all dispatch through. |
| Platform adapters | `src/cli/adapters/` | Normalize each IDE's hook payload into `NormalizedHookInput`. |
| Worker | `src/services/worker-service.ts` + `src/services/worker/` | Express app on port 37777 with routes for search / data / sessions / memory / corpus / logs / viewer / settings. Bun-managed. |
| SQLite | `src/services/sqlite/` | Schema, migrations, session store, observations, summaries, prompts, FTS5 search. |
| Chroma sync | `src/services/sync/ChromaSync.ts` | Vector embeddings for semantic search. |
| Transcript watcher | `src/services/transcripts/` | Schema-based JSONL tailer used by Codex CLI. |
| Viewer | `src/ui/viewer/` → `plugin/ui/viewer.html` | React app served by the worker. |

Full architectural notes live in `CLAUDE.md` at the repo root.

---

## Privacy

- `<private>content</private>` — anything inside these tags is stripped **before** it reaches the worker or database. The tag-stripping happens at the hook layer (`src/utils/tag-stripping.ts`), not after storage.
- AiMemory runs entirely on your machine. No telemetry, no remote calls, no paid API required for the default `ask` output. The worker binds only to `127.0.0.1`.

---

## Testing

```bash
npm run test        # unit + integration (104 tests)
npm run test:e2e    # IDE integration smoke harness (105 tests across 11 files)
npm run verify      # Phase 10 — install → doctor → uninstall for every IDE
npm run check       # pre-PR gate: typecheck + test + test:e2e + check:dist
```

A typical `npm run verify` run:

```text
  IDE               Captures    Search       Doctor  Uninstall   Passed
  ---------------------------------------------------------------------------
  claude-code       hooks       mcp          ✔       ✔           ✔
  cursor            hooks       mcp          ✔       ✔           ✔
  gemini-cli        hooks       mcp          ✔       ✔           ✔
  windsurf          hooks       mcp          ✔       ✔           ✔
  opencode          plugin      custom-tool  ✔       ✔           ✔
  openclaw          plugin      slash        ✔       ✔           ✔
  codex-cli         transcript  mcp          ✔       ✔           ✔
  copilot-cli       none        mcp          ✔       ✔           ✔
  antigravity       none        mcp          ✔       ✔           ✔
  crush             none        mcp          ✔       ✔           ✔
  roo-code          none        mcp          ✔       ✔           ✔
  warp              none        mcp          ✔       ✔           ✔
  goose             none        mcp          ✔       ✔           ✔
  kimi              none        mcp          ✔       ✔           ✔
  claude-desktop    none        mcp          ✔       ✔           ✔

  OK: 15/15 integrations verified.
```

CI runs the full matrix (e2e + `check:dist` + `verify`) across Ubuntu, macOS, and Windows on every PR — see [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml).

---

## Contributing

Setup takes one command after a clean clone:

```bash
git clone https://github.com/CBaileyDev/AiMemory.git
cd AiMemory
npm install
npm run build
npm run dev:server     # worker on port 37780, data in ~/.claude-mem-dev/, auto-seeded
```

Pre-PR:

```bash
npm run check          # typecheck + unit + e2e + dist
```

Full contributor walkthrough — including **"add a new IDE integration"** and **"add a new worker HTTP route"** — lives in [`docs/public/CONTRIBUTING.md`](docs/public/CONTRIBUTING.md).

### Repo layout at a glance

```text
src/
  npx-cli/           → install, doctor, ask, runtime commands
  services/
    integrations/    → per-IDE installers + Integration contract + backup helper
    sqlite/          → schema, migrations, session/observation stores
    worker/          → HTTP routes, search, knowledge, session manager
    transcripts/     → schema-based JSONL watcher (used by Codex)
    sync/            → Chroma vector sync
  cli/adapters/      → per-IDE hook-payload normalizers
  ui/viewer/         → React web viewer
plugin/              → pre-built runtime (shipped in the npm package)
openclaw/            → pre-built OpenClaw plugin bundle
scripts/
  build-hooks.js             → esbuild pipeline
  seed-dev-db.js             → deterministic dev fixture seeder
  dev-server.js              → dev worker launcher
  check-package-size.js      → tarball size budget guard
  check-version-consistency.js → version-drift guard
  verification-matrix.js     → Phase 10 install/doctor/uninstall gate
tests/
  e2e/               → fake-HOME harness + 11 test files (105 tests)
docs/public/
  CONTRIBUTING.md    → contributor guide
```

---

## System requirements

- **Node.js** ≥ 18
- **Bun** ≥ 1.0 (auto-installed by the installer if missing; required by the worker because it uses `bun:sqlite`)
- **uv** (optional; auto-installed; provides Python for the Chroma embedding path)

macOS, Linux, and Windows are all first-class targets. Every `npm run verify` run exercises platform-specific paths where they matter — e.g. Claude Desktop resolves to `~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows, `~/.config/Claude/` on Linux.

---

## Upstream attribution

AiMemory is a fork of [claude-mem](https://github.com/thedotmack/claude-mem) by Alex Newman ([@thedotmack](https://github.com/thedotmack)), licensed under AGPL-3.0. The upstream project pioneered the core memory-compression architecture, the SQLite + Chroma + FTS5 hybrid search, and the Claude Code plugin model.

This fork adds:

- **Universal IDE coverage** — 15 integrations spanning Claude, Codex, Kimi, Gemini, Cursor, and eight more tools, with both CLI and IDE surfaces covered per vendor.
- A uniform `Integration` contract (detect / install / uninstall / doctor / backupPaths) and a per-IDE backup helper so every installer is symmetric by construction.
- `npx claude-mem doctor` — first-class self-diagnosis with `--fix`, `--ide`, `--json`.
- `npx claude-mem ask` — natural-language memory query with observation citations, no paid API required.
- A search reranker with project / useful-flag / age-decay / near-duplicate-dedupe modifiers.
- `npm run dev:server` / `npm run smoke` / `npm run check` / `npm run verify` — a real contributor pre-PR gate.
- `npm run verify` — the **Phase 10 cross-platform verification matrix** that drives every IDE through install → doctor → uninstall and fails on any residue.
- Distribution hardening: tarball size budget, version-drift guard, `npm publish --provenance`, tarball smoke-install on macOS/Linux/Windows CI.

The npm package name remains `claude-mem` for install-path compatibility. Both `npx aimemory` and `npx claude-mem` resolve to the same binary.

---

## License

[AGPL-3.0](LICENSE). If you deploy a modified version of AiMemory over a network, you must publish the source of that deployment under AGPL-3.0.

Copyright © 2025 Alex Newman (upstream). Fork changes copyright © 2026 CBaileyDev contributors.

The `ragtime/` subdirectory ships under the **PolyForm Noncommercial License 1.0.0** — see [`ragtime/LICENSE`](ragtime/LICENSE).

---

<div align="center">

**[Get started →](#quick-start)**

Built on top of [claude-mem](https://github.com/thedotmack/claude-mem) · Powered by Bun, SQLite, and Chroma · Written in TypeScript

</div>
