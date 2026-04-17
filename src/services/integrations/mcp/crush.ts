/**
 * Crush — MCP integration. JSON config only (no context file).
 */

import path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { buildJsonMcpIntegration } from './_shared.js';
import type { Integration } from '../types.js';

export const crushIntegration: Integration = buildJsonMcpIntegration({
  id: 'crush',
  label: 'Crush',
  tier: 2,
  configPath: () => path.join(homedir(), '.config', 'crush', 'mcp.json'),
  configKey: 'mcpServers',
  async detect() {
    const p = path.join(homedir(), '.config', 'crush');
    return {
      detected: existsSync(p),
      reason: existsSync(p) ? `${p} exists` : `${p} not found`,
    };
  },
});
