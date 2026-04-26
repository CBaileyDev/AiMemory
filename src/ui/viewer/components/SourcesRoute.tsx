import React, { useMemo, useState } from 'react';
import { Icons } from './Icons';
import {
  ALL_SOURCES,
  formatNumber,
  formatRelativeTime,
  sourceMeta
} from './registry';

interface SourceRow {
  id: string;
  total: number;
  sevenDay: number[];
  lastSeenMs: number | null;
  wowDelta: number | null;
}

interface DashboardSnapshot {
  sources: SourceRow[];
  totals: {
    total: number;
    thisWeek: number;
    lastWeek: number;
    wowDelta: number;
    activeSources: number;
    totalSources: number;
    lastSeenMs: number | null;
  };
}

type SourceStatus = 'ok' | 'warn' | 'err' | 'off';

interface SourceCardData {
  id: string;
  name: string;
  short: string;
  color: string;
  kind: string;
  status: SourceStatus;
  total: number;
  lastSeenMs: number | null;
  share: number;
  project: string;
  wowDelta: number | null;
}

interface SourcesRouteProps {
  dashboard: DashboardSnapshot | null;
  detectedSources: string[];
  isConnected: boolean;
}

export function SourcesRoute({ dashboard, detectedSources, isConnected }: SourcesRouteProps) {
  const [tab, setTab] = useState<'all' | 'installed' | 'stale' | 'not-installed'>('all');

  const cards = useMemo<SourceCardData[]>(() => {
    const totalsByCard = dashboard?.sources ?? [];
    const totalAll = totalsByCard.reduce((s, x) => s + x.total, 0) || 1;

    // Build a card per known source. detectedSources tells us which are installed.
    return ALL_SOURCES.map(meta => {
      const row = totalsByCard.find(r => r.id === meta.id);
      const detected = detectedSources.includes(meta.id);
      const total = row?.total ?? 0;
      const share = total / totalAll;
      const lastSeenMs = row?.lastSeenMs ?? null;
      let status: SourceStatus;
      if (!detected && total === 0) {
        status = 'off';
      } else if (lastSeenMs && Date.now() - lastSeenMs > 7 * 86_400_000) {
        status = 'warn';
      } else if (!isConnected && total > 0) {
        status = 'err';
      } else {
        status = 'ok';
      }
      return {
        id: meta.id,
        name: meta.name,
        short: meta.short,
        color: meta.color,
        kind: meta.kind,
        status,
        total,
        lastSeenMs,
        share,
        project: '—',
        wowDelta: row?.wowDelta ?? null
      };
    });
  }, [dashboard, detectedSources, isConnected]);

  const counts = useMemo(() => {
    const installed = cards.filter(c => c.status !== 'off').length;
    const stale = cards.filter(c => c.status === 'warn' || c.status === 'err').length;
    const notInstalled = cards.filter(c => c.status === 'off').length;
    return { all: cards.length, installed, stale, notInstalled };
  }, [cards]);

  const visible = useMemo(() => {
    return cards.filter(c => {
      if (tab === 'all') return true;
      if (tab === 'installed') return c.status !== 'off';
      if (tab === 'stale') return c.status === 'warn' || c.status === 'err';
      if (tab === 'not-installed') return c.status === 'off';
      return true;
    });
  }, [tab, cards]);

  const captureRate = useMemo(() => {
    if (!dashboard?.totals.thisWeek) return 0;
    return Math.round(dashboard.totals.thisWeek / 7 / 24);
  }, [dashboard]);

  const tabs: Array<{ k: typeof tab; l: string; n: number }> = [
    { k: 'all', l: 'All', n: counts.all },
    { k: 'installed', l: 'Installed', n: counts.installed },
    { k: 'stale', l: 'Stale / errored', n: counts.stale },
    { k: 'not-installed', l: 'Not installed', n: counts.notInstalled }
  ];

  return (
    <div className="route">
      <div className="route-head">
        <h1 className="route-title">Sources</h1>
        <span className="route-sub mono">
          {counts.all} integrations · {counts.installed} installed · {counts.stale} stale ·{' '}
          {counts.notInstalled} not installed
        </span>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(t => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={tab === t.k}
            className={`tab ${tab === t.k ? 'is-active' : ''}`}
            onClick={() => setTab(t.k)}
          >
            {t.l}{' '}
            <span className="muted mono" style={{ fontSize: 11, marginLeft: 4 }}>
              {t.n}
            </span>
          </button>
        ))}
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          <HealthStat
            label="Sync health"
            value={
              counts.installed === 0
                ? '—'
                : `${Math.round(((counts.installed - counts.stale) / counts.installed) * 100)}%`
            }
            sub={`${counts.installed - counts.stale}/${counts.installed} ok`}
          />
          <HealthStat
            label="Captures / hour"
            value={captureRate ? formatNumber(captureRate) : '0'}
            sub="last 7d avg"
          />
          <HealthStat
            label="Active sources"
            value={`${dashboard?.totals.activeSources ?? 0}`}
            sub={`of ${dashboard?.totals.totalSources ?? 0} detected`}
          />
          <HealthStat
            label="Doctor verdict"
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`dot ${counts.stale === 0 ? 'ok' : 'warn'}`} />
                <span
                  className="mono"
                  style={{
                    color: counts.stale === 0 ? 'var(--ok)' : 'var(--warn)',
                    fontSize: 14
                  }}
                >
                  {counts.installed - counts.stale} / {counts.installed} OK
                </span>
              </span>
            }
            sub={counts.stale === 0 ? 'all healthy' : `${counts.stale} need attention`}
            valueAsNode
          />
        </div>
      </div>

      <div className="sources-grid">
        {visible.map(c => (
          <SourceCard key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function HealthStat({
  label,
  value,
  sub,
  valueAsNode
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueAsNode?: boolean;
}) {
  return (
    <div>
      <div className="item-label">{label}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginTop: 4
        }}
      >
        {valueAsNode ? (
          value
        ) : (
          <span
            className="tnum"
            style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}
          >
            {value}
          </span>
        )}
        {sub && (
          <span className="muted mono" style={{ fontSize: 11 }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function SourceCard({ card }: { card: SourceCardData }) {
  const sharePct = Math.max(2, Math.round(card.share * 300));
  const lastSync = formatRelativeTime(card.lastSeenMs);
  const cardClass = `src-card ${card.status === 'off' ? 'is-not-installed' : ''} ${
    card.status === 'err' ? 'is-error' : ''
  }`;

  return (
    <div className={cardClass}>
      <div className="src-head">
        <div className="src-mark" style={{ color: card.color }}>
          {card.short}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="src-name">{card.name}</div>
          <div className="src-sub">
            {card.kind} · {card.id}
          </div>
        </div>
        <div className="src-status">
          <SourceStatusPill status={card.status} lastSync={lastSync} />
        </div>
      </div>

      <div className="src-stats">
        <div>
          <div className="lbl">Memories</div>
          <div className="val">{formatNumber(card.total)}</div>
        </div>
        <div>
          <div className="lbl">Last sync</div>
          <div className="val">{lastSync}</div>
        </div>
        <div>
          <div className="lbl">Δ wk</div>
          <div className="val" style={{ color: (card.wowDelta ?? 0) >= 0 ? 'var(--ok)' : 'var(--warn)' }}>
            {card.wowDelta == null
              ? '—'
              : `${card.wowDelta >= 0 ? '+' : ''}${(card.wowDelta * 100).toFixed(1)}%`}
          </div>
        </div>
      </div>

      <div>
        <div className="src-contrib-row">
          <span>Contribution to savings</span>
          <span style={{ color: card.color }}>{(card.share * 100).toFixed(0)}%</span>
        </div>
        <div className="src-bar" style={{ color: card.color }}>
          <i style={{ width: `${Math.min(100, sharePct)}%` }} />
        </div>
      </div>

      <div className="src-foot">
        {card.status === 'off' ? (
          <button type="button" className="btn primary">
            <Icons.Plus size={12} /> Install
          </button>
        ) : (
          <>
            <button type="button" className="btn">
              <Icons.Refresh size={12} /> Resync
            </button>
            <button type="button" className="btn ghost">
              Doctor
            </button>
          </>
        )}
        <span className="src-config">~/.claude-mem/{card.id}.json</span>
      </div>
    </div>
  );
}

function SourceStatusPill({ status, lastSync }: { status: SourceStatus; lastSync: string }) {
  switch (status) {
    case 'ok':
      return (
        <>
          <span className="dot ok live" />
          <span style={{ color: 'var(--ok)' }}>connected</span>
        </>
      );
    case 'warn':
      return (
        <>
          <span className="dot warn" />
          <span style={{ color: 'var(--warn)' }}>stale {lastSync}</span>
        </>
      );
    case 'err':
      return (
        <>
          <span className="dot err" />
          <span style={{ color: 'var(--err)' }}>offline</span>
        </>
      );
    case 'off':
    default:
      return (
        <>
          <span className="dot" style={{ background: 'var(--ink-3)', boxShadow: 'none' }} />
          <span className="muted">not installed</span>
        </>
      );
  }
}
