# IDE integration end-to-end tests

Every IDE integration under `src/services/integrations/` computes its write
path from `homedir()` + `process.cwd()` at module load. These tests run each
installer in a **bun subprocess** with a fake `$HOME` / `USERPROFILE` / cwd,
so the installers land inside a throwaway `tmpdir()` sandbox and cannot touch
the developer's real config.

## Run

```bash
npm run test:e2e
```

## Add a new IDE

1. Add its id to `ALL_IDE_IDS` in `harness.ts`.
2. Register its installer (and uninstaller, if any) in `INSTALLERS` /
   `UNINSTALLERS`. Use a module-relative path from the repo root.
3. Add a `describe('IDE: <id>', ...)` block in `per-ide.e2e.test.ts`.

Each block should cover:

- Install → exit 0 + expected config file exists + mentions `claude-mem`.
- Install with a seeded user-authored file → user content preserved.
- Uninstall (if exists) → claude-mem traces gone + user content preserved.

## What this does NOT test

- The worker daemon. See `tests/integration/hook-execution-e2e.test.ts`.
- Hook payload parsing. See `tests/hooks/*.test.ts`.
- The MCP server wire format. See `tests/mcp-integrations.test.ts`.
