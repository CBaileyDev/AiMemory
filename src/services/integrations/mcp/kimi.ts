/**
 * Kimi (Moonshot) — MCP integration.
 *
 * Writes `~/.kimi/mcp.json`. This file is shared between:
 *   - Kimi Code CLI (`kimi mcp add/remove` reads/writes it natively)
 *   - Kimi Code for VS Code extension
 *
 * One config file covers both client and IDE surfaces.
 * Sources:
 *   https://moonshotai.github.io/kimi-cli/en/configuration/data-locations.html
 *   https://moonshotai.github.io/kimi-cli/en/customization/mcp.html
 */

import path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { buildJsonMcpIntegration } from './_shared.js';
import type { Integration } from '../types.js';

export const kimiIntegration: Integration = buildJsonMcpIntegration({
  id: 'kimi',
  label: 'Kimi (CLI + VS Code)',
  tier: 2,
  configPath: () => path.join(homedir(), '.kimi', 'mcp.json'),
  configKey: 'mcpServers',
  async detect() {
    const p = path.join(homedir(), '.kimi');
    return {
      detected: existsSync(p),
      reason: existsSync(p) ? `${p} exists` : `${p} not found`,
    };
  },
});
