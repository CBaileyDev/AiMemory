import React, { useMemo } from 'react';
import { useSourcesDashboard } from '../hooks/useSourcesDashboard';
import { SourceDot } from './primitives/SourceDot';
import { formatDashboardCount, formatDashboardRelative } from '../utils/dashboardFormat';

const KNOWN_SOURCES = [
  'claude-code', 'claude-desktop', 'codex-cli', 'codex-vscode',
  'gemini-cli', 'gemini-vscode', 'kimi', 'kimi-code', 'cursor',
  'windsurf', 'opencode', 'openclaw', 'copilot-cli', 'antigravity',
  'goose', 'crush', 'roo-code', 'warp'
];

function canonicalSource(sourceId: string): string {
  switch (sourceId) {
    case 'claude':
      return 'claude-code';
    case 'codex':
      return 'codex-cli';
    case 'gemini':
      return 'gemini-cli';
    case 'copilot':
      return 'copilot-cli';
    case 'roo':
      return 'roo-code';
    default:
      return sourceId;
  }
}

function healthClass(lastSeenMs: number | null): 'is-ok' | 'is-warn' | 'is-stale' {
  if (!lastSeenMs) return 'is-stale';
  const age = Date.now() - lastSeenMs;
  if (age < 86_400_000) return 'is-ok';
  if (age < 7 * 86_400_000) return 'is-warn';
  return 'is-stale';
}

function formatWowDelta(delta: number | null): string | null {
  if (delta == null || delta === 0) return null;
  const pct = Math.abs(Math.round(delta * 100));
  return `${delta > 0 ? '▲' : '▼'} ${pct}%`;
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const width = 96;
  const height = 20;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" className="am-dash__sparkline">
      <polyline className="am-dash__spark" points={points} />
    </svg>
  );
}

export function SourcesDashboard() {
  const { data, loading, error, refresh } = useSourcesDashboard(true);

  const { active, notInstalled } = useMemo(() => {
    if (!data) return { active: [], notInstalled: KNOWN_SOURCES };
    const seen = new Set(data.sources.map(s => canonicalSource(s.id)));
    const notInstalled = KNOWN_SOURCES.filter(s => !seen.has(s));
    return { active: data.sources, notInstalled };
  }, [data]);

  const stats = useMemo(() => {
    if (!data) {
      return [
        { label: 'Total', value: '—', sub: null },
        { label: 'This Week', value: '—', sub: null },
        { label: 'Active', value: '—', sub: null }
      ];
    }

    return [
      {
        label: 'Total',
        value: formatDashboardCount(data.totals.total),
        sub: `${data.totals.totalSources} configured sources`
      },
      {
        label: 'This Week',
        value: formatDashboardCount(data.totals.thisWeek),
        sub:
          data.totals.wowDelta === 0
            ? 'Flat vs last week'
            : `${data.totals.wowDelta > 0 ? '▲' : '▼'} ${Math.abs(Math.round(data.totals.wowDelta * 100))}% vs last week`
      },
      {
        label: 'Active',
        value: `${data.totals.activeSources} / ${data.totals.totalSources}`,
        sub: `Last event ${formatDashboardRelative(data.totals.lastSeenMs)}`
      }
    ];
  }, [data]);

  return (
    <div className="am-dash">
      <header className="am-dash__header">
        <div className="am-dash__heading">
          <h1 className="am-dash__title">Sources</h1>
          <p className="am-dash__description">Live capture health across connected editors and agents.</p>
        </div>
        <button
          type="button"
          className="am-dash__refresh"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="am-offline">
          Unable to reach worker — {error} <button onClick={refresh}>Retry</button>
        </div>
      )}

      <div className="am-dash__totals">
        {stats.map((stat) => (
          <div key={stat.label} className="am-dash__stat">
            <div className="am-dash__stat-label">{stat.label}</div>
            <div className="am-dash__stat-value">{stat.value}</div>
            {stat.sub && (
              <div className={`am-dash__stat-delta${stat.sub.startsWith('▲') ? ' is-up' : stat.sub.startsWith('▼') ? ' is-down' : ''}`}>
                {stat.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="am-dash__list">
        {active.length === 0 && !loading && (
          <div className="am-empty">
            <div className="am-empty__headline">No sources producing data yet</div>
            <div className="am-empty__sub">Install AiMemory in any supported IDE to start capturing memories.</div>
          </div>
        )}

        {active.map((source) => {
          const wow = formatWowDelta(source.wowDelta);
          const health = healthClass(source.lastSeenMs);
          const canonicalId = canonicalSource(source.id);
          return (
            <div
              key={source.id}
              className={`am-dash__row ${health === 'is-stale' ? 'am-dash__row--inactive' : ''}`}
              style={{ ['--source-color' as const]: `var(--source-${canonicalId}, var(--accent-primary))` } as React.CSSProperties}
            >
              <div className="am-dash__source">
                <SourceDot source={canonicalId} glow />
                <div className="am-dash__source-copy">
                  <span className="am-dash__label">{source.id}</span>
                  {wow && (
                    <span className={`am-dash__row-delta ${source.wowDelta && source.wowDelta > 0 ? 'is-up' : 'is-down'}`}>
                      {wow} WoW
                    </span>
                  )}
                </div>
              </div>
              <div className="am-dash__spark-wrap">
                <Sparkline values={source.sevenDay} />
              </div>
              <div className="am-dash__count">{formatDashboardCount(source.total)}</div>
              <div className="am-dash__last">{formatDashboardRelative(source.lastSeenMs)}</div>
              <div className={`am-dash__health ${health}`} aria-label={`Health ${health.replace('is-', '')}`} />
            </div>
          );
        })}
      </section>

      {notInstalled.length > 0 && (
        <section className="am-dash__not-setup">
          <h3 className="am-dash__not-setup-title">Not set up</h3>
          <div className="am-dash__notinstalled">
            {notInstalled.join(' · ')}
          </div>
        </section>
      )}
    </div>
  );
}
