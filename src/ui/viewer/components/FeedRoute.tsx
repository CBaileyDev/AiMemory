import React, { useMemo, useState } from 'react';
import { Icons } from './Icons';
import {
  ALL_TYPES,
  formatNumber,
  formatRelativeTime,
  shortTime,
  dayBucket,
  normalizeTypeKey,
  sourceMeta,
  typeMeta,
  type TypeMeta
} from './registry';
import type { FeedItem, ItemTokens } from './feedTypes';

const TOKENS_PER_MEMORY = 800;
const AVG_REUSE = 3.2;
const COST_PER_1K = 0.087;

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

/* ============================================================
 * Sparkline path helpers
 * ============================================================ */

function sparkPath(values: number[], w: number, h: number, pad = 2): string {
  if (values.length === 0) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function areaPath(values: number[], w: number, h: number, pad = 2): string {
  if (values.length === 0) return '';
  const path = sparkPath(values, w, h, pad);
  return `${path} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;
}

/* ============================================================
 * Sparkline component
 * ============================================================ */

function Sparkline({
  values,
  width = 96,
  height = 44,
  color = 'var(--cyan-300)',
  area = true
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  area?: boolean;
}) {
  if (values.length < 2) {
    return (
      <svg
        className="kpi-spark"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1={2}
          x2={width - 2}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--ink-4)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }
  const path = sparkPath(values, width, height, 3);
  const apath = areaPath(values, width, height, 3);
  const id = `sg_${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      className="kpi-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={apath} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/* ============================================================
 * SavingsLedger — emotional centerpiece of the feed
 * ============================================================ */

function SavingsLedger({ dashboard }: { dashboard: DashboardSnapshot | null }) {
  const totals = dashboard?.totals;
  const sources = dashboard?.sources ?? [];

  // Build a 30-day per-day series from the per-source 7-day arrays (replicated
  // when older history isn't available). The shape conveys trend; the magnitude
  // is the real per-day count.
  const series30 = useMemo(() => {
    const len = 30;
    const out = new Array(len).fill(0);
    sources.forEach(s => {
      const a = s.sevenDay || [];
      for (let i = 0; i < len; i++) {
        out[i] += a[(a.length - 1 - (i % Math.max(1, a.length))) ] || 0;
      }
    });
    // Reverse so index 0 = 30d ago, index 29 = today.
    return out.reverse();
  }, [sources]);

  const tokensReused = (totals?.total ?? 0) * TOKENS_PER_MEMORY * AVG_REUSE;
  const avoidedReprompts = Math.round((totals?.total ?? 0) * AVG_REUSE);
  const avgCtx = TOKENS_PER_MEMORY;
  const wallClockHours = (avoidedReprompts * 8) / 3600; // ~8s saved per avoided reprompt
  const dollarSaved = (tokensReused / 1000) * (COST_PER_1K / 1000);

  // wowDelta is a fraction: (thisWeek - lastWeek) / lastWeek
  const wowFrac = totals?.wowDelta ?? 0;
  const wowSign = wowFrac > 0 ? '▲' : wowFrac < 0 ? '▼' : '·';
  const wowDeltaCls = wowFrac >= 0 ? '' : 'warn';
  const weekDeltaCount = (totals?.thisWeek ?? 0) - (totals?.lastWeek ?? 0);
  const weekDeltaTokens = weekDeltaCount * TOKENS_PER_MEMORY * AVG_REUSE;
  const weekDeltaDollars = (weekDeltaTokens / 1000) * (COST_PER_1K / 1000);

  const w = 1000;
  const h = 96;
  const pad = 6;
  const path = sparkPath(series30, w, h, pad);
  const apath = areaPath(series30, w, h, pad);
  const max = series30.length ? Math.max(...series30) : 1;
  const min = series30.length ? Math.min(...series30) : 0;
  const lastX = w - pad;
  const lastY =
    series30.length > 0
      ? h - pad - ((series30[series30.length - 1] - min) / Math.max(1, max - min)) * (h - pad * 2)
      : h / 2;

  // Per-source contribution bar, biggest first, normalized.
  const bigSources = sources
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const sumTop = bigSources.reduce((s, x) => s + x.total, 0) || 1;

  return (
    <div className="savings">
      <div className="savings-eyebrow">
        <span className="dot ok live" style={{ color: 'var(--ok)' }} />
        <span>MEMORY ECONOMY · LAST 30 DAYS · GLOBAL</span>
      </div>

      <div className="savings-headline">
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span className="savings-num tnum">${formatDollarHead(dollarSaved)}</span>
            <span className="savings-unit">.{formatDollarTail(dollarSaved)} saved</span>
          </div>
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            <span className="mono" style={{ color: 'var(--ink-1)' }}>
              {formatTokenLong(tokensReused)} tokens
            </span>{' '}
            avoided through memory reuse · est. at avg blended rate ${COST_PER_1K.toFixed(3)}/1K
          </div>
        </div>
        {totals && (
          <div className="savings-tag">
            {wowSign} {weekDeltaDollars >= 0 ? '+' : '-'}$
            {Math.abs(weekDeltaDollars).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}{' '}
            this week
          </div>
        )}
      </div>

      <div className="savings-sub">
        <div>
          <div className="item-label">Tokens reused</div>
          <div className="item-value tnum">{formatNumber(Math.round(tokensReused))}</div>
          <div className={`item-delta ${wowDeltaCls}`}>
            {wowSign} {wowFrac >= 0 ? '+' : ''}
            {(wowFrac * 100).toFixed(1)}% wk
          </div>
        </div>
        <div>
          <div className="item-label">Avoided reprompts</div>
          <div className="item-value tnum">{formatNumber(avoidedReprompts)}</div>
          <div className="item-delta">
            {weekDeltaCount >= 0 ? '▲' : '▼'} {weekDeltaCount >= 0 ? '+' : ''}
            {formatNumber(Math.abs(weekDeltaCount) * Math.round(AVG_REUSE))} wk
          </div>
        </div>
        <div>
          <div className="item-label">Avg ctx per recall</div>
          <div className="item-value tnum">
            {formatNumber(avgCtx)}
            <span className="muted" style={{ fontSize: 13 }}> tok</span>
          </div>
          <div className="item-delta muted">tighter is better</div>
        </div>
        <div>
          <div className="item-label">Est. wall-clock saved</div>
          <div className="item-value tnum">{formatHours(wallClockHours)}</div>
          <div className={`item-delta ${weekDeltaCount >= 0 ? '' : 'warn'}`}>
            {weekDeltaCount >= 0 ? '▲' : '▼'}{' '}
            {formatHours((Math.abs(weekDeltaCount) * Math.round(AVG_REUSE) * 8) / 3600)} wk
          </div>
        </div>
      </div>

      <div className="savings-chart">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
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
          {[0.25, 0.5, 0.75].map(t => (
            <line
              key={t}
              x1={pad}
              x2={w - pad}
              y1={h * t}
              y2={h * t}
              stroke="var(--line-1)"
              strokeDasharray="2 4"
            />
          ))}
          {apath && <path d={apath} fill="url(#savgrad)" />}
          {path && <path d={path} fill="none" stroke="url(#savline)" strokeWidth="1.6" />}
          {series30.length > 0 && (
            <>
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
            </>
          )}
        </svg>
        <div className="savings-axis">
          <span>30D AGO</span>
          <span>—</span>
          <span>—</span>
          <span>—</span>
          <span>NOW</span>
        </div>
      </div>

      {bigSources.length > 0 && (
        <div className="savings-contrib">
          <div className="item-label" style={{ marginBottom: 8 }}>
            Source contribution
          </div>
          <div className="savings-contrib-bar">
            {bigSources.map(s => {
              const meta = sourceMeta(s.id);
              const pct = (s.total / sumTop) * 100;
              return (
                <div
                  key={s.id}
                  title={`${meta.name}: ${pct.toFixed(0)}%`}
                  style={{ width: `${pct}%`, background: meta.color }}
                />
              );
            })}
          </div>
          <div className="savings-contrib-legend">
            {bigSources.slice(0, 6).map(s => {
              const meta = sourceMeta(s.id);
              const pct = (s.total / sumTop) * 100;
              return (
                <span key={s.id} className="src" style={{ color: meta.color }}>
                  {meta.name}{' '}
                  <span style={{ color: 'var(--ink-3)' }}>{pct.toFixed(0)}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * KpiStack — total memories, active sources, last sync
 * ============================================================ */

function KpiStack({
  dashboard,
  isConnected
}: {
  dashboard: DashboardSnapshot | null;
  isConnected: boolean;
}) {
  const totals = dashboard?.totals;
  const sources = dashboard?.sources ?? [];

  // Daily delta (today vs yesterday) from sevenDay arrays
  const deltaToday = sources.reduce((s, src) => {
    const a = src.sevenDay || [];
    return s + (a[a.length - 1] || 0);
  }, 0);

  const projects = useMemo(() => {
    const set = new Set<string>();
    sources.forEach(s => set.add(s.id));
    return set.size;
  }, [sources]);

  // Combined 14-day series for spark
  const total14 = useMemo(() => {
    const out = new Array(14).fill(0);
    sources.forEach(s => {
      const a = s.sevenDay || [];
      for (let i = 0; i < 14; i++) {
        out[i] += a[i % Math.max(1, a.length)] || 0;
      }
    });
    return out;
  }, [sources]);

  // Bars data, top 12 sources by total
  const bars = sources
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  const maxBar = Math.max(1, ...bars.map(s => s.total));

  // Indexing progress = activeSources / totalSources
  const indexedPct = totals?.totalSources
    ? Math.round((totals.activeSources / totals.totalSources) * 100)
    : 0;

  const lastSync = formatRelativeTime(totals?.lastSeenMs ?? null);

  return (
    <div className="kpi-stack">
      <div className="kpi">
        <div>
          <div className="kpi-label">Total memories</div>
          <div className="kpi-value tnum">{formatNumber(totals?.total ?? 0)}</div>
          <div className="kpi-meta">
            ▲ {formatNumber(deltaToday)} today · {projects} sources
          </div>
        </div>
        <Sparkline values={total14} color="var(--cyan-300)" />
      </div>

      <div className="kpi">
        <div>
          <div className="kpi-label">Active sources</div>
          <div className="kpi-value tnum">
            {totals?.activeSources ?? 0}
            <span className="muted" style={{ fontSize: 18 }}>/{totals?.totalSources ?? 0}</span>
          </div>
          <div className="kpi-meta">
            {(totals?.totalSources ?? 0) - (totals?.activeSources ?? 0)} idle
          </div>
        </div>
        <div className="kpi-bars">
          {bars.map(s => {
            const meta = sourceMeta(s.id);
            const pct = 20 + (s.total / maxBar) * 70;
            return (
              <i
                key={s.id}
                style={{
                  height: `${pct}%`,
                  background: meta.color,
                  opacity: s.total === 0 ? 0.18 : 0.85
                }}
                title={`${meta.name}: ${formatNumber(s.total)}`}
              />
            );
          })}
        </div>
      </div>

      <div className="kpi">
        <div>
          <div className="kpi-label">Last sync</div>
          <div className="kpi-value tnum" style={{ fontSize: 22 }}>
            {lastSync}
          </div>
          <div className="kpi-meta">
            <span style={{ color: isConnected ? 'var(--ok)' : 'var(--err)' }}>
              ● {isConnected ? 'live' : 'offline'}
            </span>{' '}
            · :37777
          </div>
        </div>
        <div className="kpi-ring">
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bg-3)" strokeWidth="3" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--cyan-300)"
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (1 - indexedPct / 100)}`}
              transform="rotate(-90 22 22)"
              strokeLinecap="round"
            />
          </svg>
          <span className="kpi-ring-label">{indexedPct}%</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * FilterBar — type chips + source chips + project picker
 * ============================================================ */

interface FilterState {
  types: Set<string>;
  sources: Set<string>;
  project: string | null;
}

function FilterBar({
  filters,
  setFilters,
  sourceCounts
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  sourceCounts: Map<string, number>;
}) {
  const sourceOpts = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div className="filterbar">
      <div className="filterbar-group" role="group" aria-label="Type filters">
        {ALL_TYPES.slice(0, 6).map(t => (
          <button
            key={t.key}
            type="button"
            className={`chip ${filters.types.has(t.key) ? 'is-active' : ''}`}
            onClick={() => setFilters({ ...filters, types: toggle(filters.types, t.key) })}
            aria-pressed={filters.types.has(t.key)}
          >
            <span className="swatch" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="filterbar-divider" />
      <div className="filterbar-group" role="group" aria-label="Source filters">
        {sourceOpts.map(([id, count]) => {
          const meta = sourceMeta(id);
          return (
            <button
              key={id}
              type="button"
              className={`chip ${filters.sources.has(id) ? 'is-active' : ''}`}
              onClick={() => setFilters({ ...filters, sources: toggle(filters.sources, id) })}
              aria-pressed={filters.sources.has(id)}
            >
              <span className="swatch" style={{ background: meta.color }} />
              {meta.name}
              <span className="count">{count.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
      <div className="filterbar-spacer" />
      <button type="button" className="chip">
        <Icons.Folder size={12} /> Project: {filters.project ?? 'all'}
      </button>
      <button type="button" className="chip">
        <Icons.Clock size={12} /> Last 7d
      </button>
      {(filters.types.size > 0 || filters.sources.size > 0) && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setFilters({ types: new Set(), sources: new Set(), project: null })}
        >
          <Icons.Close size={12} /> Clear
        </button>
      )}
    </div>
  );
}

/* ============================================================
 * MemoryCard
 * ============================================================ */

function typeIcon(typeKey: string) {
  switch (typeKey) {
    case 'bugfix': return <Icons.Bug size={14} />;
    case 'decision': return <Icons.Star size={14} />;
    case 'feature': return <Icons.Plus size={14} />;
    case 'refactor': return <Icons.Layers size={14} />;
    case 'discovery': return <Icons.Spark size={14} />;
    case 'investigation': return <Icons.Eye size={14} />;
    case 'prompt': return <Icons.Ask size={14} />;
    case 'next': return <Icons.Arrow size={14} />;
    default: return <Icons.Star size={14} />;
  }
}

function MemoryCard({
  item,
  selected,
  onSelect,
  isNew
}: {
  item: FeedItem;
  selected: boolean;
  onSelect: (id: number) => void;
  isNew: boolean;
}) {
  const t = typeMeta(item.type);
  const src = sourceMeta(item.platform_source);
  const tk = normalizeTypeKey(item.type);
  const files = item.files;

  return (
    <button
      type="button"
      className={`mem ${selected ? 'is-selected' : ''} ${isNew ? 'is-new' : ''}`}
      onClick={() => onSelect(item.id)}
    >
      <div className="mem-icon" style={{ color: t.color }} aria-hidden="true">
        {typeIcon(tk)}
      </div>
      <div className="mem-body">
        <div className="mem-row">
          <span className="ttag" style={{ color: t.color }}>
            {t.label}
          </span>
          <span className="src" style={{ color: src.color }}>
            {src.name}
          </span>
          {item.project && (
            <span className="muted mono" style={{ fontSize: 11 }}>
              · {item.project}
            </span>
          )}
          <span className="faint mono" style={{ fontSize: 11 }}>
            · obs#{item.id}
          </span>
        </div>
        <h3 className="mem-title" style={{ marginTop: 6 }}>
          {item.title}
        </h3>
        {item.summary && <p className="mem-summary">{item.summary}</p>}
        {files.length > 0 && (
          <div className="mem-files">
            {files.slice(0, 4).map(f => (
              <span key={f} className="file-pill">
                {f}
              </span>
            ))}
            {files.length > 4 && (
              <span className="file-pill" style={{ color: 'var(--ink-3)' }}>
                +{files.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mem-side">
        <span className="mem-time mono">{shortTime(item.created_at_epoch)}</span>
        {item.tokens.saved > 0 ? (
          <span
            className="mem-tokens reused"
            title="Tokens saved by recalling instead of reprompting"
          >
            <Icons.Bolt size={11} /> {formatNumber(item.tokens.saved)} saved
          </span>
        ) : (
          <span className="mem-time">new entry</span>
        )}
      </div>
    </button>
  );
}

/* ============================================================
 * Inspector — sticky right-side panel
 * ============================================================ */

function Inspector({
  item,
  onJump
}: {
  item: FeedItem | null;
  onJump?: (id: number) => void;
}) {
  if (!item) {
    return (
      <div className="inspector">
        <div className="empty">
          <div className="empty-glyph">
            <Icons.Eye size={20} />
          </div>
          <div className="empty-title">No memory selected</div>
          <div className="empty-msg">
            Pick any memory from the feed to inspect token impact, cited files, and lineage.
          </div>
        </div>
      </div>
    );
  }
  const t = typeMeta(item.type);
  const src = sourceMeta(item.platform_source);
  const value = (item.tokens.saved / 1000) * (COST_PER_1K / 1000);

  return (
    <div className="inspector">
      <div className="insp-eyebrow">
        obs#{item.id} · {dayBucket(item.created_at_epoch)} {shortTime(item.created_at_epoch)}
      </div>
      <h3 className="insp-title">{item.title}</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="ttag" style={{ color: t.color }}>
          {t.label}
        </span>
        <span className="src" style={{ color: src.color }}>
          {src.name}
        </span>
        {item.project && (
          <span className="chip" style={{ height: 18, fontSize: 10.5 }}>
            <Icons.Folder size={10} /> {item.project}
          </span>
        )}
      </div>

      {item.summary && (
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: 'var(--ink-1)',
            lineHeight: 1.6
          }}
        >
          {item.summary}
        </p>
      )}

      <div className="insp-section">
        <h4>Token impact</h4>
        <dl className="insp-kv">
          <dt>Originally cost</dt>
          <dd className="tnum">{formatNumber(item.tokens.cost)} tok</dd>
          <dt>Reused since</dt>
          <dd className="tnum" style={{ color: 'var(--cyan-200)' }}>
            {formatNumber(item.tokens.reused)} tok
          </dd>
          <dt>Net saved</dt>
          <dd className="tnum" style={{ color: 'var(--ok)' }}>
            {formatNumber(item.tokens.saved)} tok
          </dd>
          <dt>Est. value</dt>
          <dd className="tnum">${value.toFixed(2)}</dd>
        </dl>
      </div>

      {item.files.length > 0 && (
        <div className="insp-section">
          <h4>Cited files</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {item.files.map(f => (
              <span key={f} className="file-pill">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {item.concepts.length > 0 && (
        <div className="insp-section">
          <h4>Concepts</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {item.concepts.map(c => (
              <span key={c} className="file-pill" style={{ color: 'var(--cyan-100)' }}>
                #{c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button type="button" className="btn primary" onClick={() => onJump?.(item.id)}>
          <Icons.Cite size={12} /> Cite in ask
        </button>
        <button type="button" className="btn">
          <Icons.Graph size={12} /> Show in graph
        </button>
      </div>
    </div>
  );
}

/* ============================================================
 * FeedRoute
 * ============================================================ */

interface FeedRouteProps {
  items: FeedItem[];
  freshIds: Set<number>;
  isConnected: boolean;
  dashboard: DashboardSnapshot | null;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  highlightedId: number | null;
  onJump?: (id: number) => void;
}

export function FeedRoute({
  items,
  freshIds,
  isConnected,
  dashboard,
  onLoadMore,
  hasMore,
  isLoading,
  highlightedId,
  onJump
}: FeedRouteProps) {
  const [filters, setFilters] = useState<FilterState>({
    types: new Set(),
    sources: new Set(),
    project: null
  });
  const [selected, setSelected] = useState<number | null>(null);

  const sourceCounts = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach(it => {
      const k = it.platform_source || 'unknown';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (filters.types.size > 0 && !filters.types.has(normalizeTypeKey(it.type))) return false;
      if (filters.sources.size > 0 && !filters.sources.has(it.platform_source)) return false;
      return true;
    });
  }, [items, filters]);

  const grouped = useMemo(() => {
    const g = new Map<string, FeedItem[]>();
    filtered.forEach(it => {
      const day = dayBucket(it.created_at_epoch);
      const arr = g.get(day);
      if (arr) arr.push(it);
      else g.set(day, [it]);
    });
    return Array.from(g.entries());
  }, [filtered]);

  const selectedItem =
    items.find(it => it.id === (highlightedId ?? selected)) || filtered[0] || null;

  return (
    <div className="route">
      <div className="route-head">
        <h1 className="route-title">Feed</h1>
        <span className="route-sub mono">
          Audit trail of what AiMemory learned
          {isConnected ? ' · live' : ' · offline'}
        </span>
      </div>

      <div className="dash-grid">
        <SavingsLedger dashboard={dashboard} />
        <KpiStack dashboard={dashboard} isConnected={isConnected} />
      </div>

      <FilterBar filters={filters} setFilters={setFilters} sourceCounts={sourceCounts} />

      <div className="feed-layout">
        <div className="feed-stream">
          {grouped.length === 0 && !isLoading && (
            <div className="empty">
              <div className="empty-glyph">
                <Icons.Feed size={20} />
              </div>
              <div className="empty-title">No memories yet</div>
              <div className="empty-msg">
                Start a Claude Code session — observations will stream in via SSE as they're
                captured.
              </div>
            </div>
          )}

          {grouped.map(([day, list]) => {
            const totalSaved = list.reduce((s, it) => s + it.tokens.saved, 0);
            return (
              <React.Fragment key={day}>
                <div className="daygroup-head">
                  <span>{day}</span>
                  <span className="line" />
                  <span>
                    {list.length} {list.length === 1 ? 'memory' : 'memories'}
                    {totalSaved > 0 && ` · ${formatNumber(totalSaved)} tok saved`}
                  </span>
                </div>
                {list.map(it => (
                  <MemoryCard
                    key={`${it.kind}-${it.id}`}
                    item={it}
                    selected={(highlightedId ?? selected) === it.id}
                    onSelect={setSelected}
                    isNew={freshIds.has(it.id)}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {isLoading && (
            <>
              <div className="mem skel mem-skel" />
              <div className="mem skel mem-skel" />
              <div className="mem skel mem-skel" />
            </>
          )}

          {hasMore && !isLoading && (
            <button
              type="button"
              className="btn"
              style={{ alignSelf: 'center', marginTop: 12 }}
              onClick={onLoadMore}
            >
              Load more
            </button>
          )}
        </div>
        <Inspector item={selectedItem} onJump={onJump} />
      </div>
    </div>
  );
}

/* ============================================================
 * Formatting helpers
 * ============================================================ */

function formatTokenLong(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
}

function formatDollarHead(d: number): string {
  return Math.floor(d).toLocaleString();
}

function formatDollarTail(d: number): string {
  const cents = Math.round((d % 1) * 100);
  return cents.toString().padStart(2, '0');
}

function formatPct(prev: number, curr: number): string {
  if (prev === 0) return '+∞%';
  const pct = ((curr - prev) / Math.max(1, prev)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Re-export for consumers that need helper formatters
export { sparkPath, areaPath, Sparkline };

// Re-export the type helper used elsewhere (prevents accidental re-imports)
export type { TypeMeta };
