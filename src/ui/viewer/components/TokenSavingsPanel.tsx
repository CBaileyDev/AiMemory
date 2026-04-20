import React, { useMemo } from 'react';
import { SourceDot } from './primitives/SourceDot';

const TOKENS_PER_MEMORY = 800;
const AVG_REUSE = 3.2;
const warnedMissingPricing = new Set<string>();

interface Row {
  id: string;
  total: number;
}

interface PricingMeta {
  name: string;
  inputPer1k: number;
  outputPer1k: number;
  source: string;
}

const DEFAULT_PRICING: PricingMeta = {
  name: 'Claude Sonnet',
  inputPer1k: 0.003,
  outputPer1k: 0.015,
  source: 'claude-code'
};

const MODEL_PRICING: Record<string, PricingMeta> = {
  claude: { name: 'Claude Sonnet', inputPer1k: 0.003, outputPer1k: 0.015, source: 'claude-code' },
  'claude-code': { name: 'Claude Sonnet', inputPer1k: 0.003, outputPer1k: 0.015, source: 'claude-code' },
  'claude-desktop': { name: 'Claude Sonnet', inputPer1k: 0.003, outputPer1k: 0.015, source: 'claude-code' },
  cursor: { name: 'Cursor (GPT-4o)', inputPer1k: 0.005, outputPer1k: 0.015, source: 'cursor' },
  windsurf: { name: 'Windsurf (Claude)', inputPer1k: 0.003, outputPer1k: 0.015, source: 'windsurf' },
  codex: { name: 'Codex (GPT-4o)', inputPer1k: 0.005, outputPer1k: 0.015, source: 'codex-cli' },
  'codex-cli': { name: 'Codex (GPT-4o)', inputPer1k: 0.005, outputPer1k: 0.015, source: 'codex-cli' },
  'codex-vscode': { name: 'Codex (GPT-4o)', inputPer1k: 0.005, outputPer1k: 0.015, source: 'codex-cli' },
  gemini: { name: 'Gemini 2.5 Pro', inputPer1k: 0.00125, outputPer1k: 0.01, source: 'gemini-cli' },
  'gemini-cli': { name: 'Gemini 2.5 Pro', inputPer1k: 0.00125, outputPer1k: 0.01, source: 'gemini-cli' },
  'gemini-vscode': { name: 'Gemini 2.5 Pro', inputPer1k: 0.00125, outputPer1k: 0.01, source: 'gemini-cli' },
  copilot: { name: 'Copilot (GPT-4o)', inputPer1k: 0.005, outputPer1k: 0.015, source: 'copilot-cli' },
  'copilot-cli': { name: 'Copilot (GPT-4o)', inputPer1k: 0.005, outputPer1k: 0.015, source: 'copilot-cli' },
  roo: { name: 'Roo (Claude)', inputPer1k: 0.003, outputPer1k: 0.015, source: 'roo-code' },
  'roo-code': { name: 'Roo (Claude)', inputPer1k: 0.003, outputPer1k: 0.015, source: 'roo-code' },
  goose: { name: 'Goose (Claude)', inputPer1k: 0.003, outputPer1k: 0.015, source: 'goose' },
  kimi: { name: 'Kimi', inputPer1k: 0.003, outputPer1k: 0.015, source: 'kimi' },
  'kimi-code': { name: 'Kimi', inputPer1k: 0.003, outputPer1k: 0.015, source: 'kimi' },
  opencode: { name: 'OpenCode', inputPer1k: 0.003, outputPer1k: 0.015, source: 'opencode' },
  openclaw: { name: 'OpenClaw', inputPer1k: 0.003, outputPer1k: 0.015, source: 'openclaw' },
  antigravity: { name: 'Antigravity', inputPer1k: 0.003, outputPer1k: 0.015, source: 'antigravity' },
  crush: { name: 'Crush', inputPer1k: 0.003, outputPer1k: 0.015, source: 'crush' },
  warp: { name: 'Warp', inputPer1k: 0.003, outputPer1k: 0.015, source: 'warp' }
};

function titleizeSource(id: string): string {
  return id
    .split('-')
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ');
}

function getPricingMeta(id: string): PricingMeta {
  const found = MODEL_PRICING[id];
  if (found) return found;

  if (!warnedMissingPricing.has(id)) {
    warnedMissingPricing.add(id);
    console.warn(`[TokenSavingsPanel] Missing pricing metadata for source "${id}", using Claude fallback.`);
  }

  return {
    ...DEFAULT_PRICING,
    name: titleizeSource(id),
    source: id
  };
}

function formatHeadlineTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(Math.round(tokens));
}

function formatCompactTokens(tokens: number): string {
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return String(Math.round(tokens));
}

interface TokenSavingsPanelProps {
  sourceRows: Row[];
}

export function TokenSavingsPanel({ sourceRows }: TokenSavingsPanelProps) {
  const model = useMemo(() => {
    const entries = sourceRows
      .filter(row => row.total > 0)
      .map(row => {
        const meta = getPricingMeta(row.id);
        const tokens = row.total * TOKENS_PER_MEMORY * AVG_REUSE;
        const blendedRate = (meta.inputPer1k + meta.outputPer1k) / 2;
        const dollars = (tokens / 1000) * blendedRate;
        return {
          id: row.id,
          label: meta.name,
          source: meta.source,
          tokens,
          dollars
        };
      })
      .sort((a, b) => b.tokens - a.tokens);

    const totalTokens = entries.reduce((sum, entry) => sum + entry.tokens, 0);
    const totalDollars = entries.reduce((sum, entry) => sum + entry.dollars, 0);

    return { entries, totalTokens, totalDollars };
  }, [sourceRows]);

  const maxTokens = model.entries[0]?.tokens || 1;

  return (
    <section className="am-token-panel" aria-label="Estimated token savings">
      <div className="am-token-panel__header">
        <div className="am-token-panel__lead">
          <div className="am-token-panel__eyebrow">Estimated Token Savings</div>
          <div className="am-token-panel__headline">
            <span className="am-token-panel__headline-value am-mono">{formatHeadlineTokens(model.totalTokens)}</span>
            <span className="am-token-panel__headline-unit">tokens saved</span>
          </div>
        </div>
        <div className="am-token-panel__side">
          <div className="am-token-panel__side-label">Cost Savings</div>
          <div className="am-token-panel__side-figure">
            <span className="am-token-panel__side-value am-mono">${model.totalDollars.toFixed(2)}</span>
            <span className="am-token-panel__side-unit">est.</span>
          </div>
        </div>
      </div>

      <div className="am-token-panel__rows">
        {model.entries.slice(0, 8).map((entry) => {
          const width = Math.max(4, (entry.tokens / maxTokens) * 100);
          return (
            <div
              key={entry.id}
              className="am-token-panel__row"
              style={{
                ['--source-color' as const]: `var(--source-${entry.source}, var(--accent-primary))`
              } as React.CSSProperties}
            >
              <div className="am-token-panel__source">
                <SourceDot source={entry.source} glow />
                <span>{entry.label}</span>
              </div>
              <div className="am-token-panel__track" aria-hidden="true">
                <div
                  className="am-token-panel__fill"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, color-mix(in srgb, var(--source-color) 55%, transparent), var(--source-color))`
                  }}
                />
              </div>
              <div className="am-token-panel__token am-mono">{formatCompactTokens(entry.tokens)}</div>
              <div className="am-token-panel__usd am-mono">${entry.dollars.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
