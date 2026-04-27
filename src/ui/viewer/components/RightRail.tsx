import React, { useMemo } from 'react';

interface SourceRow {
  id: string;
  total: number;
  sevenDay: number[];
  lastSeenMs: number | null;
  wowDelta: number | null;
}

interface RightRailProps {
  totalMemories: number;
  todayCount: number;
  projectCount: number;
  totalsSpark: number[];
  activeSources: number;
  totalSources: number;
  sourceRows: SourceRow[];
  lastSeenMs: number | null;
  isConnected: boolean;
  workerPort: number;
}

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

function relativeShort(ms: number | null): string {
  if (ms == null) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return 'now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function sparkPath(values: number[], w: number, h: number, pad = 3): string {
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

function areaPath(values: number[], w: number, h: number, pad = 3): string {
  const path = sparkPath(values, w, h, pad);
  return `${path} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;
}

export function RightRail({
  totalMemories,
  todayCount,
  projectCount,
  totalsSpark,
  activeSources,
  totalSources,
  sourceRows,
  lastSeenMs,
  isConnected,
  workerPort
}: RightRailProps) {
  const sparkP = useMemo(() => sparkPath(totalsSpark, 96, 44, 3), [totalsSpark]);
  const sparkA = useMemo(() => areaPath(totalsSpark, 96, 44, 3), [totalsSpark]);
  const gradId = useMemo(() => `g_kpi_${Math.random().toString(36).slice(2, 7)}`, []);

  const top12 = useMemo(() => {
    const sorted = [...sourceRows].sort((a, b) => b.total - a.total).slice(0, 12);
    const max = Math.max(...sorted.map((r) => r.total), 1);
    return sorted.map((r) => ({
      id: r.id,
      heightPct: 20 + (r.total / max) * 70,
      color: SOURCE_COLORS[r.id] ?? 'var(--ink-2)',
      isOff: r.total === 0
    }));
  }, [sourceRows]);

  const offlineCount = Math.max(0, totalSources - activeSources);
  const staleCount = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return sourceRows.filter((r) => r.lastSeenMs != null && now - r.lastSeenMs > dayMs).length;
  }, [sourceRows]);
  const lastSyncStr = relativeShort(lastSeenMs);

  const syncPct = isConnected ? 0.82 : 0.12;
  const circ = 2 * Math.PI * 18;
  const dashOffset = circ * (1 - syncPct);

  return (
    <div className="kpi-stack">
      <div className="kpi">
        <div>
          <div className="kpi-label">Total memories</div>
          <div className="kpi-value tnum">{totalMemories.toLocaleString('en-US')}</div>
          <div className="kpi-meta">▲ {todayCount} today · {projectCount} {projectCount === 1 ? 'project' : 'projects'}</div>
        </div>
        <svg className="kpi-spark" viewBox="0 0 96 44" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cyan-300)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--cyan-300)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {sparkA && <path d={sparkA} fill={`url(#${gradId})`} />}
          {sparkP && <path d={sparkP} fill="none" stroke="var(--cyan-300)" strokeWidth="1.5" />}
        </svg>
      </div>

      <div className="kpi">
        <div>
          <div className="kpi-label">Active sources</div>
          <div className="kpi-value tnum">
            {activeSources}<span className="muted" style={{ fontSize: 18 }}>/{totalSources}</span>
          </div>
          <div className="kpi-meta">
            {(() => {
              const parts: string[] = [];
              if (staleCount > 0) parts.push(`${staleCount} stale`);
              if (offlineCount > 0) parts.push(`${offlineCount} not installed`);
              return parts.length > 0 ? parts.join(' · ') : 'all healthy';
            })()}
          </div>
        </div>
        <div className="kpi-bars" aria-hidden="true">
          {top12.map((b) => (
            <i
              key={b.id}
              style={{
                height: `${b.heightPct}%`,
                background: b.color,
                opacity: b.isOff ? 0.18 : 0.85
              }}
            />
          ))}
        </div>
      </div>

      <div className="kpi">
        <div>
          <div className="kpi-label">Last sync</div>
          <div className="kpi-value tnum" style={{ fontSize: 22 }}>{lastSyncStr}</div>
          <div className="kpi-meta">
            <span style={{ color: isConnected ? 'var(--ok)' : 'var(--err)' }}>● {isConnected ? 'live' : 'offline'}</span> · :{workerPort}
          </div>
        </div>
        <div style={{ position: 'relative', width: 96, height: 44, display: 'grid', placeItems: 'center' }}>
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bg-3)" strokeWidth="3" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--cyan-300)"
              strokeWidth="3"
              strokeDasharray={`${circ}`}
              strokeDashoffset={`${dashOffset}`}
              transform="rotate(-90 22 22)"
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 480ms ease' }}
            />
          </svg>
          <span style={{ position: 'absolute', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan-200)' }}>
            {Math.round(syncPct * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
