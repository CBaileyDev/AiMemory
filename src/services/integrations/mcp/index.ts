/**
 * MCP IDE integrations — one `Integration` per IDE.
 *
 * This module is the single source of truth for MCP-tier integrations.
 * `src/services/integrations/McpIntegrations.ts` re-exports from here for
 * backwards compatibility with the old `MCP_IDE_INSTALLERS` map.
 */

import type { Integration } from '../types.js';
import { copilotCliIntegration } from './copilot-cli.js';
import { antigravityIntegration } from './antigravity.js';
import { crushIntegration } from './crush.js';
import { rooCodeIntegration } from './roo-code.js';
import { warpIntegration } from './warp.js';
import { gooseIntegration } from './goose.js';

export const MCP_INTEGRATIONS: Record<string, Integration> = {
  'copilot-cli': copilotCliIntegration,
  antigravity: antigravityIntegration,
  crush: crushIntegration,
  'roo-code': rooCodeIntegration,
  warp: warpIntegration,
  goose: gooseIntegration,
};

export {
  copilotCliIntegration,
  antigravityIntegration,
  crushIntegration,
  rooCodeIntegration,
  warpIntegration,
  gooseIntegration,
};
