import React, { useMemo } from 'react';

const TOKENS_PER_MEMORY = 800;
const AVG_REUSE = 3.2;
const SECONDS_PER_KTOK = 6;

const SOURCE_COLORS: Record<string, string> = {
  'claude-code': 'var(--src-claude)',
  'claude-desktop': 'var(--src-claude)',
  claude: 'var(--src-claude)',
  'codex-cli': 'var(--src-codex)',
  'codex-vscode': 'var(--src-codex)',
  codex: 'var(--src-codex)',
  cursor: 'var(--src-cursor)',
  'gemini-cli': 'var(--src-gemini)',
  'gemini-vscode': 'var(--src-gemini)',
  gemini: 'var(--src-gemini)',
  kimi: 'var(--src-kimi)',
  'kimi-code': 'var(--src-kimi)',
  windsurf: 'var(--src-windsurf)',
  opencode: 'var(--src-opencode)',
  copilot: 'var(--src-copilot)',
  'copilot-cli': 'var(--src-copilot)',
  warp: 'var(--src-warp)',
  'roo-code': 'var(--src-roo)',
  goose: 'var(--src-goose)',
  crush: 'var(--src-crush)'
};

const SOURCE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'claude-desktop': 'Claude Desktop',
  claude: 'Claude',
  'codex-cli': 'Codex',
  'codex-vscode': 'Codex',
  codex: 'Codex',
  cursor: 'Cursor',
  'gemini-cli': 'Gemini',
  'gemini-vscode': 'Gemini',
  gemini: 'Gemini',
  kimi: 'Kimi Code',
  'kimi-code': 'Kimi Code',
  windsurf: 'Windsurf',
  opencode: 'OpenCode',
  copilot: 'Copilot',
  'copilot-cli': 'Copilot',
  warp: 'Warp',
  'roo-code': 'Roo Code',
  goose: 'Goose',
  crush: 'Crush'
};

const PRICING_BLENDED: Record<string, number> = {
  'claude-code': 0.087,
  'claude-desktop': 0.087,
  claude: 0.087,
  'codex-cli': 0.085,
  'codex-vscode': 0.085,
  codex: 0.085,
  cursor: 0.087,
  windsurf: 0.083,
  kimi: 0.083,
  'kimi-code': 0.083,
  opencode: 0.083,
  'gemini-cli': 0.062,
  'gemini-vscode': 0.062,
  gemini: 0.062,
  'copilot-cli': 0.085,
  warp: 0.083,
  'roo-code': 0.083,
  goose: 0.083,
  crush: 0.083
};

const FALLBACK_RATE = 0.087;

interface SourceRow {
  id: string;
  total: number;
  sevenDay: number[];
  lastSeenMs: number | null;
}

interface MemoryEconomyProps {
  sourceRows: SourceRow[];
  windowDays?: number;
  scope?: string;
  liveBeacon?: boolean;
}

function titleize(id: string): string {
  return SOURCE_LABELS[id] ?? id
    .split('-')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

function formatTokens(t: number): string {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`;
  if (t >= 1000) return `${(t / 1000).toFixed(1)}k`;
  return Math.round(t).toString();
}

function formatHours(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function sparkPath(values: number[], w: number, h: number, pad = 6): string {
  if (values.length === 0) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const step = (w - pad * 2) / Math.max(values.length - 1, 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function areaPath(values: number[], w: number, h: number, pad = 6): string {
  const path = sparkPath(values, w, h, pad);
  return `${path} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;
}

export function MemoryEconomy({
  sourceRows,
  windowDays = 30,
  scope = 'GLOBAL'
}: MemoryEconomyProps) {
  const model = useMemo(() => {
    const filtered = sourceRows.filter((r) => r.total > 0);
    const entries = filtered.map((r) => {
      const tokens = r.total * TOKENS_PER_MEMORY * AVG_REUSE;
      const rate = PRICING_BLENDED[r.id] ?? FALLBACK_RATE;
      const dollars = (tokens / 1000) * rate;
      return { id: r.id, label: titleize(r.id), tokens, dollars, raw: r.total };
    });
    entries.sort((a, b) => b.tokens - a.tokens);
    const totalTokens = entries.reduce((s, e) => s + e.tokens, 0);
    const totalDollars = entries.reduce((s, e) => s + e.dollars, 0);
    const totalRaw = entries.reduce((s, e) => s + e.raw, 0);
    const avgCtx = entries.length ? Math.round(totalTokens / Math.max(1, entries.length * 12)) : 0;
    const wallClockSec = (totalTokens / 1000) * SECONDS_PER_KTOK;
    const withPercent = entries
      .map((e) => ({
        ...e,
        percent: totalTokens > 0 ? (e.tokens / totalTokens) * 100 : 0
      }))
      .filter((e) => e.percent >= 1);

    const weekTokens = sourceRows.reduce((sum, row) => {
      const arr = row.sevenDay ?? [];
      const last7 = arr.slice(-7).reduce((s, v) => s + v, 0);
      return sum + last7 * TOKENS_PER_MEMORY * AVG_REUSE;
    }, 0);
    const weekDollars = (weekTokens / 1000) * FALLBACK_RATE;

    return {
      totalTokens,
      totalDollars,
      totalRaw,
      avgCtx,
      wallClockSec,
      sources: withPercent,
      weekDollars
    };
  }, [sourceRows]);

  const dollars = model.totalDollars;
  const dollarsInt = Math.floor(dollars);
  const dollarsCents = (dollars - dollarsInt).toFixed(2).slice(1);

  const trendValues = useMemo(() => {
    const buckets = new Array<number>(windowDays).fill(0);
    sourceRows.forEach((row) => {
      const arr = row.sevenDay ?? [];
      arr.forEach((v, i) => {
        const bucketIdx = Math.min(buckets.length - 1, Math.max(0, buckets.length - arr.length + i));
        buckets[bucketIdx] += v;
      });
    });
    return buckets;
  }, [sourceRows, windowDays]);

  const w = 1000;
  const h = 96;
  const pad = 6;
  const path = sparkPath(trendValues, w, h, pad);
  const apath = areaPath(trendValues, w, h, pad);

  const lastX = w - pad;
  const max = Math.max(...trendValues, 1);
  const min = Math.min(...trendValues, 0);
  const span = Math.max(max - min, 1);
  const lastY =
    trendValues.length > 0
      ? h - pad - ((trendValues[trendValues.length - 1] - min) / span) * (h - pad * 2)
      : h - pad;

  const wkDelta = Math.max(1, Math.round(model.weekDollars));

  return (
    <div className="savings">
      <div className="savings-eyebrow">
        <span className="dot ok live" style={{ color: 'var(--ok)' }} />
        <span>MEMORY ECONOMY · LAST {windowDays} DAYS · {scope}</span>
      </div>

      <div className="savings-headline">
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span className="savings-num tnum">${dollarsInt.toLocaleString('en-US')}</span>
            <span className="savings-unit">{dollarsCents} saved</span>
          </div>
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            <span className="mono" style={{ color: 'var(--ink-1)' }}>
              {formatTokens(model.totalTokens)} tokens
            </span>{' '}
            avoided through memory reuse instead of reprompting · est. at avg blended rate $0.087/1K
          </div>
        </div>
        <div className="savings-tag">▲ +${wkDelta} this week</div>
      </div>

      <div className="savings-sub">
        <div>
          <div className="item-label">Tokens reused</div>
          <div className="item-value tnum">{Math.round(model.totalTokens).toLocaleString('en-US')}</div>
          <div className="item-delta">▲ memory reuse</div>
        </div>
        <div>
          <div className="item-label">Avoided reprompts</div>
          <div className="item-value tnum">{model.totalRaw.toLocaleString('en-US')}</div>
          <div className="item-delta">▲ {windowDays}d</div>
        </div>
        <div>
          <div className="item-label">Avg ctx per recall</div>
          <div className="item-value tnum">
            {model.avgCtx.toLocaleString('en-US')}
            <span className="muted" style={{ fontSize: 13 }}> tok</span>
          </div>
          <div className="item-delta">▼ tighter</div>
        </div>
        <div>
          <div className="item-label">Est. wall-clock saved</div>
          <div className="item-value tnum">{formatHours(model.wallClockSec)}</div>
          <div className="item-delta">▲ this {windowDays}d</div>
        </div>
      </div>

      <div className="savings-chart">
        {path && (
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="savgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--cyan-300)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--cyan-300)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="savline" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--cyan-400)" />
                <stop offset="100%" stopColor="var(--cyan-200)" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((t) => (
              <line key={t} x1={pad} x2={w - pad} y1={h * t} y2={h * t} stroke="var(--line-1)" strokeDasharray="2 4" />
            ))}
            <path d={apath} fill="url(#savgrad)" />
            <path d={path} fill="none" stroke="url(#savline)" strokeWidth="1.6" />
            <line
              x1={lastX}
              x2={lastX}
              y1={pad}
              y2={h - pad}
              stroke="var(--cyan-300)"
              strokeOpacity="0.4"
              strokeDasharray="2 3"
            />
            <circle cx={lastX} cy={lastY} r="3.2" fill="var(--cyan-200)" />
            <circle cx={lastX} cy={lastY} r="6" fill="none" stroke="var(--cyan-300)" strokeOpacity="0.5">
              <animate attributeName="r" values="3.2;9;3.2" dur="2s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--ink-3)',
            letterSpacing: '0.08em'
          }}
        >
          <span>{windowDays}D AGO</span>
          <span>—</span>
          <span>—</span>
          <span>—</span>
          <span>NOW</span>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="item-label" style={{ marginBottom: 8 }}>Source contribution</div>
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-3)' }}>
          {model.sources.map((s) => (
            <div
              key={s.id}
              title={`${s.label}: ${s.percent.toFixed(0)}%`}
              style={{
                width: `${s.percent}%`,
                background: SOURCE_COLORS[s.id] ?? 'var(--ink-2)'
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            marginTop: 10,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-2)'
          }}
        >
          {model.sources.slice(0, 6).map((s) => (
            <span
              key={s.id}
              className="src"
              style={{ color: SOURCE_COLORS[s.id] ?? 'var(--ink-2)' }}
            >
              {s.label} <span style={{ color: 'var(--ink-3)' }}>{s.percent.toFixed(0)}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
