# Contributing to claude-mem

## Prerequisites

- **Node.js** ≥ 18 (see `engines.node` in `package.json`)
- **Bun** ≥ 1.0 (see `engines.bun` in `package.json`) — install via `curl -fsSL https://bun.sh/install | bash`
- **uv** — Python environment manager for Chroma; auto-installed by the worker on first run, or manually via `curl -LsSf https://astral.sh/uv/install.sh | sh`

```bash
git clone https://github.com/thedotmack/claude-mem.git
cd claude-mem
npm install
```

## Development workflow

**Build and sync to local plugin installation:**
```bash
npm run build-and-sync
```
This runs `build → sync-marketplace → worker:restart`.

**Typecheck (no emit):**
```bash
npm run typecheck
```

**Run unit tests:**
```bash
npm test          # all tests via bun test
npm run test:sqlite
npm run test:agents
npm run test:search
npm run test:context
npm run test:infra
npm run test:server
```

**Run e2e tests:**
```bash
npm run test:e2e
```

**Run Playwright (viewer UI) tests:**
```bash
npm run test:viewer
```

**Verify package before publishing:**
```bash
npm run check:dist   # version consistency + bundle size
npm run verify       # full verification matrix
```

## CI gates

Every PR and push to `main` runs the **Quality** workflow (`.github/workflows/quality.yml`):

1. `npm run typecheck` — must exit 0
2. `npm test` — must exit 0

Both gates must pass before a PR can be merged. Fix typecheck errors and failing tests before opening a PR. There is a known baseline of typecheck errors documented in [`.claude/typecheck-baseline.md`](.claude/typecheck-baseline.md) — do not add new ones.

## Branch and PR conventions

- Branch names: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>`
- PR titles: conventional-commit format — `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `ci:`, `test:`
- Keep PRs focused. A PR that mixes a bug fix, a refactor, and a new feature is hard to review and hard to revert. Prefer smaller, single-purpose PRs.
- Exceptions: large mechanical renames or file-moves that are trivially reviewable can be bundled if splitting them would create intermediate broken states.

## The "no correctness for aesthetics" rule

Every cleanup or refactor PR must meet at least one of these bars:

- **Reduces duplication** — removes a concrete instance of repeated logic
- **Reduces complexity** — simplifies control flow, removes indirection, or shrinks a module's surface area
- **Improves reliability** — fixes a latent bug, removes a footgun, or improves error handling

Aesthetic changes alone (renaming for style, reordering imports, reformatting) are not sufficient justification. If your PR is purely cosmetic, combine it with a substantive improvement or don't open it.

## E2E tests and package verification

```bash
# Full end-to-end check
npm run smoke          # runs test:e2e
npm run check:viewer-size  # verifies viewer bundle is within budget
npm run check:dist    # version consistency + size checks

# Before publishing
npm run prepublishOnly  # build + check:dist
```

## Roadmap

Track priorities via [GitHub issues](https://github.com/thedotmack/claude-mem/issues) and project discussions.
