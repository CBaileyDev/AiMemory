/**
 * McpIntegrations — backwards-compatible shim over the per-IDE files in
 * `./mcp/`. Kept so existing imports (e.g. from `src/npx-cli/commands/install.ts`)
 * continue to work after the Phase 2 split.
 *
 * New code should import from `./mcp/` directly.
 */

import { MCP_INTEGRATIONS } from './mcp/index.js';

// Re-export the registry directly. Preserve the pre-Phase-2 signature:
//   `() => Promise<number>` that returns 0 on success, 1 on failure.
export const MCP_IDE_INSTALLERS: Record<string, () => Promise<number>> = Object
  .fromEntries(
    Object.entries(MCP_INTEGRATIONS).map(([id, integration]) => [
      id,
      () => integration.install(),
    ]),
  );

/**
 * Companion to `MCP_IDE_INSTALLERS`: the uninstaller dispatch map. This is
 * the new Phase 2 export and closes the symmetric-uninstall gap for MCP IDEs.
 */
export const MCP_IDE_UNINSTALLERS: Record<string, () => Promise<number>> = Object
  .fromEntries(
    Object.entries(MCP_INTEGRATIONS)
      .filter(([, integration]) => typeof integration.uninstall === 'function')
      .map(([id, integration]) => [id, () => integration.uninstall!()]),
  );

/**
 * @deprecated Import `gooseIntegration` from `./mcp/goose.js` instead.
 */
export async function installGooseMcpIntegration(): Promise<number> {
  return MCP_INTEGRATIONS.goose.install();
}

export { MCP_INTEGRATIONS };
