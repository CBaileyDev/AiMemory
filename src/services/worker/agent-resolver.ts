import { logger } from '../../utils/logger.js';
import type { Component } from '../../utils/logger.js';
import { SDKAgent } from './SDKAgent.js';
import { GeminiAgent, isGeminiAvailable, isGeminiSelected } from './GeminiAgent.js';
import { OpenRouterAgent, isOpenRouterAvailable, isOpenRouterSelected } from './OpenRouterAgent.js';

export type ActiveAgent = SDKAgent | GeminiAgent | OpenRouterAgent;

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}

interface ResolveActiveAgentOptions {
  sdkAgent: SDKAgent;
  geminiAgent: GeminiAgent;
  openRouterAgent: OpenRouterAgent;
  component?: Component;
}

const OPENROUTER_MISCONFIGURED_ERROR =
  'OpenRouter provider selected but no API key configured. Set CLAUDE_MEM_OPENROUTER_API_KEY in settings or OPENROUTER_API_KEY environment variable.';

const GEMINI_MISCONFIGURED_ERROR =
  'Gemini provider selected but no API key configured. Set CLAUDE_MEM_GEMINI_API_KEY in settings or GEMINI_API_KEY environment variable.';

function logSelectedAgent(component: Component, provider: 'claude' | 'gemini' | 'openrouter'): void {
  if (provider === 'openrouter') {
    logger.debug(component, 'Using OpenRouter agent');
    return;
  }

  if (provider === 'gemini') {
    logger.debug(component, 'Using Gemini agent');
    return;
  }

  logger.debug(component, 'Using Claude SDK agent');
}

export function resolveActiveAgent(options: ResolveActiveAgentOptions): ActiveAgent {
  const {
    sdkAgent,
    geminiAgent,
    openRouterAgent,
    component = 'SESSION'
  } = options;

  if (isOpenRouterSelected()) {
    if (!isOpenRouterAvailable()) {
      throw new ProviderConfigurationError(OPENROUTER_MISCONFIGURED_ERROR);
    }

    logSelectedAgent(component, 'openrouter');
    return openRouterAgent;
  }

  if (isGeminiSelected()) {
    if (!isGeminiAvailable()) {
      throw new ProviderConfigurationError(GEMINI_MISCONFIGURED_ERROR);
    }

    logSelectedAgent(component, 'gemini');
    return geminiAgent;
  }

  logSelectedAgent(component, 'claude');
  return sdkAgent;
}

export function isProviderConfigurationError(error: unknown): error is ProviderConfigurationError {
  return error instanceof ProviderConfigurationError;
}

export function resolveActiveAgentSafe(options: ResolveActiveAgentOptions): ActiveAgent {
  const {
    sdkAgent,
    geminiAgent,
    openRouterAgent,
    component = 'SYSTEM'
  } = options;

  if (isOpenRouterSelected()) {
    if (isOpenRouterAvailable()) {
      logSelectedAgent(component, 'openrouter');
      return openRouterAgent;
    }

    logger.warn(component, 'OpenRouter provider selected but unavailable; falling back to Claude SDK');
    logSelectedAgent(component, 'claude');
    return sdkAgent;
  }

  if (isGeminiSelected()) {
    if (isGeminiAvailable()) {
      logSelectedAgent(component, 'gemini');
      return geminiAgent;
    }

    logger.warn(component, 'Gemini provider selected but unavailable; falling back to Claude SDK');
    logSelectedAgent(component, 'claude');
    return sdkAgent;
  }

  logSelectedAgent(component, 'claude');
  return sdkAgent;
}
