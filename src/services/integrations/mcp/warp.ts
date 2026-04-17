/**
 * Warp — MCP integration.
 *
 * If `~/.warp/` does not exist (typical Warp 2 Drive-only configuration),
 * skip the JSON config write. WARP.md is still written to the workspace —
 * Warp reads it natively like CLAUDE.md.
 */

import path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { buildJsonMcpIntegration } from './_shared.js';
import type { Integration } from '../types.js';

export const warpIntegration: Integration = buildJsonMcpIntegration({
  id: 'warp',
  label: 'Warp',
  tier: 2,
  configPath: () => path.join(homedir(), '.warp', 'mcp.json'),
  configKey: 'mcpServers',
  contextFile: ({ cwd }) => path.join(cwd, 'WARP.md'),
  skipConfigIf() {
    const warpDir = path.join(homedir(), '.warp');
    if (existsSync(warpDir)) return { skipConfig: false };
    return {
      skipConfig: true,
      reason: '~/.warp/ not found. MCP may need to be configured via Warp Drive UI.',
    };
  },
  async detect() {
    const p = path.join(homedir(), '.warp');
    return {
      detected: existsSync(p),
      reason: existsSync(p) ? `${p} exists` : `${p} not found`,
    };
  },
});
