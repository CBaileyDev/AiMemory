/**
 * Roo Code — MCP integration. Workspace-scoped config under `.roo/`.
 */

import path from 'path';
import { existsSync } from 'fs';
import { buildJsonMcpIntegration } from './_shared.js';
import type { Integration } from '../types.js';

export const rooCodeIntegration: Integration = buildJsonMcpIntegration({
  id: 'roo-code',
  label: 'Roo Code',
  tier: 2,
  configPath: ({ cwd }) => path.join(cwd, '.roo', 'mcp.json'),
  configKey: 'mcpServers',
  contextFile: ({ cwd }) => path.join(cwd, '.roo', 'rules', 'claude-mem-context.md'),
  async detect() {
    const p = path.join(process.cwd(), '.roo');
    return {
      detected: existsSync(p),
      reason: existsSync(p) ? `${p} exists` : `${p} not found`,
    };
  },
});
