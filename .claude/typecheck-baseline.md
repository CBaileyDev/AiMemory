# Typecheck Baseline — 2026-04-18

**Total errors: 394**

## Error counts by code

| Code | Count | Description |
|------|-------|-------------|
| TS2345 | 168 | Argument type mismatch |
| TS2304 | 69 | Cannot find name (missing DOM lib / undeclared names) |
| TS2339 | 39 | Property does not exist on type |
| TS2322 | 29 | Type not assignable |
| TS2812 | 27 | Property does not exist (lib target mismatch — needs `dom`) |
| TS2307 | 23 | Cannot find module |
| TS2584 | 14 | Cannot find name (document/window — needs `dom` lib) |
| TS18046 | 9 | Value is of type 'unknown' |
| TS18047 | 7 | Value is possibly 'null' |
| TS7006 | 3 | Parameter implicitly has 'any' type |
| TS2769 | 2 | No overload matches this call |
| TS2367 | 2 | Comparison overlap |
| TS2352 | 1 | Conversion that may be a mistake |
| TS1117 | 1 | Duplicate identifier |

## Error counts by source area

| Area | Count |
|------|-------|
| src/ui/viewer | 168 |
| src/services/worker | 138 |
| src/services/sqlite | 22 |
| src/services/integrations | 21 |
| src/services/transcripts | 10 |
| src/services/worker-service.ts | 9 |
| src/utils/project-name.ts | 3 |
| src/utils/cursor-utils.ts | 3 |
| src/services/smart-file-read | 3 |
| src/utils/claude-md-utils.ts | 2 |
| src/shared/tokenizer.ts | 2 |
| src/shared/EnvManager.ts | 2 |
| src/services/infrastructure | 2 |
| src/npx-cli/commands | 2 |
| src/cli/handlers | 2 |
| (other) | 5 |

## Top categories

1. **DOM lib missing (TS2304/TS2584/TS2812)** — ~110 errors: `src/ui/viewer` uses `document`, `window`, `localStorage`, `requestAnimationFrame`, etc. but `tsconfig.json` doesn't include `"dom"` in `lib`. Viewer files were likely added without updating the tsconfig.
2. **Argument type mismatch (TS2345)** — 168 errors: Heavy in `src/services/worker` and `src/ui/viewer`; many are `Component` union type narrowing issues and `unknown` values being passed without narrowing.
3. **Missing modules (TS2307)** — 23 errors: Import paths that can't be resolved (likely missing type declarations or path aliases not recognised by tsc).
4. **Null/unknown not narrowed (TS18046/TS18047)** — 16 errors: `result` typed as `unknown` from fetch calls, and possibly-null refs not guarded.

## Notes

- Errors are NOT fixed in this baseline; this file is purely a snapshot.
- Command used: `npm run typecheck` (which runs `tsc --noEmit`).
- Fix strategy: address DOM lib in tsconfig first (removes ~110 viewer errors), then tackle worker type mismatches.
