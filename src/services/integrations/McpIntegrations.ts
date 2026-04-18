/**
 * McpIntegrations — backwards-compatible shim over the per-IDE files in
 * `./mcp/`. New code should import from `./mcp/` directly.
 */

import { MCP_INTEGRATIONS } from './mcp/index.js';

// Re-export the registry directly. Signature: `() => Promise<number>`, 0 on success, 1 on failure.
export const MCP_IDE_INSTALLERS: Record<string, () => Promise<number>> = Object
  .fromEntries(
    Object.entries(MCP_INTEGRATIONS).map(([id, integration]) => [
      id,
      () => integration.install(),
    ]),
  );

/**
 * Companion to `MCP_IDE_INSTALLERS`: the uninstaller dispatch map.
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
