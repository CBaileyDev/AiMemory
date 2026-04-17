/**
 * Antigravity — MCP integration.
 *
 * Writes `~/.gemini/antigravity/mcp_config.json`, plus a workspace-local
 * `.agent/rules/claude-mem-context.md` context file.
 */

import path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { buildJsonMcpIntegration } from './_shared.js';
import type { Integration } from '../types.js';

export const antigravityIntegration: Integration = buildJsonMcpIntegration({
  id: 'antigravity',
  label: 'Antigravity',
  tier: 2,
  configPath: () => path.join(homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
  configKey: 'mcpServers',
  contextFile: ({ cwd }) => path.join(cwd, '.agent', 'rules', 'claude-mem-context.md'),
  async detect() {
    const p = path.join(homedir(), '.gemini', 'antigravity');
    return {
      detected: existsSync(p),
      reason: existsSync(p) ? `${p} exists` : `${p} not found`,
    };
  },
});
