import React, { useMemo } from 'react';
import { useSourcesDashboard } from '../hooks/useSourcesDashboard';
import { SourceDot } from './primitives/SourceDot';

const KNOWN_SOURCES = [
  'claude-code', 'claude-desktop', 'codex-cli', 'codex-vscode',
  'gemini-cli', 'gemini-vscode', 'kimi', 'kimi-code', 'cursor',
  'windsurf', 'opencode', 'openclaw', 'copilot-cli', 'antigravity',
  'goose', 'crush', 'roo-code', 'warp'
];

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function formatRelative(ms: number | null): string {
  if (!ms) return 'never';
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function healthClass(lastSeenMs: number | null): string {
  if (!lastSeenMs) return 'is-stale';
  const age = Date.now() - lastSeenMs;
  if (age < 86_400_000) return '';
  if (age < 7 * 86_400_000) return 'is-warn';
  return 'is-stale';
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const width = 100;
  const height = 22;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <polyline className="am-dash__spark" points={points} />
    </svg>
  );
}

export function SourcesDashboard() {
  const { data, loading, error, refresh } = useSourcesDashboard(true);

  const { active, notInstalled } = useMemo(() => {
    if (!data) return { active: [], notInstalled: KNOWN_SOURCES };
    const seen = new Set(data.sources.map(s => s.id));
    const notInstalled = KNOWN_SOURCES.filter(s => !seen.has(s));
    return { active: data.sources, notInstalled };
  }, [data]);

  return (
    <div className="am-dash">
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-text-primary)' }}>
          Sources
        </h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            padding: '0.375rem 0.75rem',
            fontSize: 'var(--text-xs)',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <div className="am-offline">Unable to reach worker — {error} <button onClick={refresh}>Retry</button></div>}

      <div className="am-dash__totals">
        <div className="am-dash__stat">
          <div className="am-dash__stat-label">Observations</div>
          <div className="am-dash__stat-value">{data ? formatCount(data.totals.total) : '—'}</div>
        </div>
        <div className="am-dash__stat">
          <div className="am-dash__stat-label">This week</div>
          <div className="am-dash__stat-value">{data ? formatCount(data.totals.thisWeek) : '—'}</div>
          {data && (
            <div className={`am-dash__stat-delta ${data.totals.wowDelta > 0 ? 'is-up' : data.totals.wowDelta < 0 ? 'is-down' : ''}`}>
              {data.totals.wowDelta === 0 ? '—' : `${data.totals.wowDelta > 0 ? '▲' : '▼'} ${Math.abs(Math.round(data.totals.wowDelta * 100))}% WoW`}
            </div>
          )}
        </div>
        <div className="am-dash__stat">
          <div className="am-dash__stat-label">Active sources</div>
          <div className="am-dash__stat-value">
            {data ? `${data.totals.activeSources} / ${data.totals.totalSources}` : '—'}
          </div>
        </div>
        <div className="am-dash__stat">
          <div className="am-dash__stat-label">Last event</div>
          <div className="am-dash__stat-value" style={{ fontSize: 'var(--text-lg)' }}>
            {data ? formatRelative(data.totals.lastSeenMs) : '—'}
          </div>
        </div>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {active.length === 0 && !loading && (
          <div className="am-empty">
            <div className="am-empty__headline">No sources producing data yet</div>
            <div className="am-empty__sub">Install AiMemory in any supported IDE to start capturing memories.</div>
          </div>
        )}
        {active.map((s) => (
          <div
            key={s.id}
            className={`am-dash__row ${s.lastSeenMs && Date.now() - s.lastSeenMs > 7 * 86_400_000 ? 'am-dash__row--inactive' : ''}`}
          >
            <div className={`am-dash__health ${healthClass(s.lastSeenMs)}`} aria-hidden="true" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <SourceDot source={s.id} />
              <span className="am-dash__label">{s.id}</span>
              {s.wowDelta != null && s.wowDelta !== 0 && (
                <span className={`am-dash__stat-delta ${s.wowDelta > 0 ? 'is-up' : 'is-down'}`}>
                  {s.wowDelta > 0 ? '▲' : '▼'} {Math.abs(Math.round(s.wowDelta * 100))}%
                </span>
              )}
            </div>
            <div className="am-dash__count">{formatCount(s.total)}</div>
            <div className="am-dash__spark"><Sparkline values={s.sevenDay} /></div>
            <div className="am-dash__last">{formatRelative(s.lastSeenMs)}</div>
          </div>
        ))}
      </section>

      {notInstalled.length > 0 && (
        <section>
          <h3 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: '0 0 var(--space-2)' }}>
            Not set up
          </h3>
          <div className="am-dash__notinstalled">
            {notInstalled.join(' · ')}
          </div>
        </section>
      )}
    </div>
  );
}
