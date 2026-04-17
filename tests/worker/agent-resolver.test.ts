import { describe, it, expect, beforeEach, mock } from 'bun:test';

let openRouterSelected = false;
let openRouterAvailable = false;
let geminiSelected = false;
let geminiAvailable = false;

const debugCalls: any[][] = [];
const warnCalls: any[][] = [];

mock.module('../../src/services/worker/SDKAgent.js', () => ({
  SDKAgent: class FakeSDKAgent {},
}));

mock.module('../../src/services/worker/GeminiAgent.js', () => ({
  GeminiAgent: class FakeGeminiAgent {},
  isGeminiSelected: () => geminiSelected,
  isGeminiAvailable: () => geminiAvailable,
}));

mock.module('../../src/services/worker/OpenRouterAgent.js', () => ({
  OpenRouterAgent: class FakeOpenRouterAgent {},
  isOpenRouterSelected: () => openRouterSelected,
  isOpenRouterAvailable: () => openRouterAvailable,
}));

mock.module('../../src/utils/logger.js', () => ({
  logger: {
    debug: (...args: any[]) => debugCalls.push(args),
    warn: (...args: any[]) => warnCalls.push(args),
    info: () => {},
    error: () => {},
  },
}));

import { resolveActiveAgent, resolveActiveAgentSafe } from '../../src/services/worker/agent-resolver.js';
import { SDKAgent } from '../../src/services/worker/SDKAgent.js';
import { GeminiAgent } from '../../src/services/worker/GeminiAgent.js';
import { OpenRouterAgent } from '../../src/services/worker/OpenRouterAgent.js';

describe('agent-resolver', () => {
  beforeEach(() => {
    openRouterSelected = false;
    openRouterAvailable = false;
    geminiSelected = false;
    geminiAvailable = false;
    debugCalls.length = 0;
    warnCalls.length = 0;
  });

  function createAgents() {
    return {
      sdkAgent: new SDKAgent() as SDKAgent,
      geminiAgent: new GeminiAgent() as GeminiAgent,
      openRouterAgent: new OpenRouterAgent() as OpenRouterAgent,
    };
  }

  it('resolveActiveAgent returns Gemini when selected and configured', () => {
    geminiSelected = true;
    geminiAvailable = true;

    const agents = createAgents();
    const result = resolveActiveAgent(agents);

    expect(result).toBe(agents.geminiAgent);
    expect(debugCalls[0]?.[1]).toBe('Using Gemini agent');
  });

  it('resolveActiveAgent throws when OpenRouter is selected but unavailable', () => {
    openRouterSelected = true;
    openRouterAvailable = false;

    expect(() => resolveActiveAgent(createAgents())).toThrow(/OpenRouter provider selected but no API key configured/);
  });

  it('resolveActiveAgentSafe warns and falls back to Claude SDK for unavailable Gemini', () => {
    geminiSelected = true;
    geminiAvailable = false;

    const agents = createAgents();
    const result = resolveActiveAgentSafe({ ...agents, component: 'SYSTEM' });

    expect(result).toBe(agents.sdkAgent);
    expect(warnCalls[0]?.[0]).toBe('SYSTEM');
    expect(warnCalls[0]?.[1]).toBe('Gemini provider selected but unavailable; falling back to Claude SDK');
    expect(debugCalls[0]?.[1]).toBe('Using Claude SDK agent');
  });

  it('resolveActiveAgentSafe prefers OpenRouter over Gemini when both selection predicates are true', () => {
    openRouterSelected = true;
    openRouterAvailable = true;
    geminiSelected = true;
    geminiAvailable = true;

    const agents = createAgents();
    const result = resolveActiveAgentSafe(agents);

    expect(result).toBe(agents.openRouterAgent);
    expect(debugCalls[0]?.[1]).toBe('Using OpenRouter agent');
  });
});
