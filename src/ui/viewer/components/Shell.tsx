import React, { useEffect, useState } from 'react';
import { Icons } from './Icons';
import type { Route } from '../hooks/useRoute';

interface RailProps {
  route: Route;
  setRoute: (r: Route) => void;
  isConnected: boolean;
  totalMemories: number;
  activeSources: number;
  totalSources: number;
  projects: string[];
  projectCounts: Record<string, number>;
  workerVersion: string;
}

export function Rail({
  route,
  setRoute,
  isConnected,
  totalMemories,
  activeSources,
  totalSources,
  projects,
  projectCounts,
  workerVersion
}: RailProps) {
  const items: Array<{ id: Route; label: string; icon: React.ReactNode; meta?: string }> = [
    {
      id: 'feed',
      label: 'Feed',
      icon: <Icons.Feed size={16} />,
      meta: totalMemories ? formatRailCount(totalMemories) : undefined
    },
    {
      id: 'graph',
      label: 'Graph',
      icon: <Icons.Graph size={16} />,
      meta: projects.length ? `${projects.length} ⌜` : undefined
    },
    {
      id: 'sources',
      label: 'Sources',
      icon: <Icons.Sources size={16} />,
      meta: totalSources ? `${activeSources}/${totalSources}` : undefined
    },
    { id: 'settings', label: 'Settings', icon: <Icons.Settings size={16} /> }
  ];

  const visibleProjects = projects
    .slice()
    .sort((a, b) => (projectCounts[b] || 0) - (projectCounts[a] || 0))
    .slice(0, 6);

  return (
    <aside className="rail">
      <div className="rail-brand">
        <div className="rail-mark" aria-hidden="true" />
        <div className="rail-name">
          <b>Ai</b>
          <span>Memory</span>
        </div>
        <span className="rail-build">{workerVersion}</span>
      </div>

      <div className="rail-scroll">
        <div className="rail-section">
          <div className="rail-section-title">Workspace</div>
          {items.map(it => (
            <button
              key={it.id}
              type="button"
              className={`nav-item ${route === it.id ? 'is-active' : ''}`}
              onClick={() => setRoute(it.id)}
              aria-current={route === it.id ? 'page' : undefined}
            >
              <span className="icon">{it.icon}</span>
              <span className="nav-item-label">{it.label}</span>
              {it.meta && <span className="nav-item-meta">{it.meta}</span>}
            </button>
          ))}
        </div>

        {visibleProjects.length > 0 && (
          <div className="rail-section">
            <div className="rail-section-title">Projects</div>
            {visibleProjects.map(p => (
              <div key={p} className="nav-item" role="button">
                <span className="icon">
                  <Icons.Folder size={14} />
                </span>
                <span className="nav-item-label">{p}</span>
                <span className="nav-item-meta">{formatRailCount(projectCounts[p] || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rail-foot">
        <WorkerTile isConnected={isConnected} />
      </div>
    </aside>
  );
}

function WorkerTile({ isConnected }: { isConnected: boolean }) {
  const [uptime, setUptime] = useState('—');
  const [pending, setPending] = useState<number | null>(null);
  const [dbSize, setDbSize] = useState<string>('—');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (typeof json.worker?.uptime === 'number') {
          setUptime(formatUptime(json.worker.uptime));
        }
        if (typeof json.queue?.pending === 'number') {
          setPending(json.queue.pending);
        } else if (typeof json.queueDepth === 'number') {
          setPending(json.queueDepth);
        }
        if (typeof json.database?.size === 'number') {
          setDbSize(formatBytes(json.database.size));
        }
      } catch {
        // Stats endpoint optional — show dashes.
      }
    };
    load();
    const t = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const dotClass = isConnected ? 'ok live' : 'err';
  const label = isConnected ? 'Worker live' : 'Offline';

  return (
    <div className="worker">
      <div className="worker-row">
        <span
          className={`dot ${dotClass}`}
          style={{
            color: isConnected ? 'var(--ok)' : 'var(--err)'
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--ink-0)', fontWeight: 500 }}>{label}</span>
        <span className="worker-value">:37777</span>
      </div>
      <div className="worker-row">
        <span className="worker-label">Uptime</span>
        <span className="worker-value">{uptime}</span>
      </div>
      <div className="worker-row">
        <span className="worker-label">Pending</span>
        <span className="worker-value">{pending == null ? '—' : `${pending} jobs`}</span>
      </div>
      <div className="worker-row">
        <span className="worker-label">DB</span>
        <span className="worker-value">{dbSize}</span>
      </div>
    </div>
  );
}

interface AppHeaderProps {
  isConnected: boolean;
  isProcessing: boolean;
  consoleOpen: boolean;
  onTogglePalette: () => void;
  onToggleConsole: () => void;
  onResync: () => void;
  onDoctor: () => void;
}

export function AppHeader({
  isConnected,
  isProcessing,
  consoleOpen,
  onTogglePalette,
  onToggleConsole,
  onResync,
  onDoctor
}: AppHeaderProps) {
  const status = !isConnected ? 'err' : isProcessing ? 'warn' : 'ok';
  const statusLabel =
    status === 'ok'
      ? 'worker live · :37777'
      : status === 'warn'
        ? 'processing…'
        : 'offline';
  const statusColor =
    status === 'ok' ? 'var(--ok)' : status === 'warn' ? 'var(--warn)' : 'var(--err)';

  return (
    <header className="hdr">
      <button className="hdr-search" type="button" onClick={onTogglePalette}>
        <Icons.Search size={14} className="hdr-search-icon" />
        <span className="hdr-search-text">Ask, search memory, or run a command…</span>
        <span className="hdr-search-shortcut">
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </button>

      <div className="hdr-actions">
        <button className="hdr-btn" type="button" title="Run doctor" onClick={onDoctor}>
          <Icons.Bug size={14} /> Doctor
        </button>
        <button className="hdr-btn" type="button" title="Force resync" onClick={onResync}>
          <Icons.Refresh size={14} /> Sync
        </button>
        <button
          className={`hdr-btn ${consoleOpen ? 'is-pressed' : ''}`}
          type="button"
          onClick={onToggleConsole}
          title="Worker console (⌘\\)"
        >
          <Icons.Logs size={14} /> Console
        </button>
        <span className="hdr-divider" aria-hidden="true" />
        <span className="hdr-status src" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </div>
    </header>
  );
}

interface StatusBarProps {
  isConnected: boolean;
  observationCount: number;
  sseSubs: number;
  consoleOpen: boolean;
  onToggleConsole: () => void;
}

export function StatusBar({
  isConnected,
  observationCount,
  sseSubs,
  consoleOpen,
  onToggleConsole
}: StatusBarProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const dotClass = isConnected ? 'ok live' : 'err';

  return (
    <footer className="statusbar">
      <span className="seg">
        <span
          className={`dot ${dotClass}`}
          style={{ color: isConnected ? 'var(--ok)' : 'var(--err)' }}
        />{' '}
        <b>worker</b> :37777
      </span>
      <span className="sep">|</span>
      <span className="seg">
        SQLite <b>{observationCount.toLocaleString()}</b> rows
      </span>
      <span className="sep">|</span>
      <span className="seg">
        Chroma <b>indexed</b>
      </span>
      <span className="sep">|</span>
      <span className="seg">
        FTS5 <b>BM25+rerank</b>
      </span>
      <span className="sep">|</span>
      <span className="seg">
        SSE <b>{sseSubs}</b> subs
      </span>

      <div className="right">
        <span className="seg">{now.toLocaleTimeString([], { hour12: false })}</span>
        <button
          className={`console-btn ${consoleOpen ? 'is-active' : ''}`}
          type="button"
          onClick={onToggleConsole}
        >
          <Icons.Logs size={11} /> console{' '}
          <span className="kbd" style={{ height: 14, fontSize: 9.5 }}>
            ⌘\
          </span>
        </button>
      </div>
    </footer>
  );
}

interface ConsoleDrawerProps {
  open: boolean;
  isConnected: boolean;
  isProcessing: boolean;
  queueDepth: number;
  recentEvents: ConsoleEvent[];
}

export interface ConsoleEvent {
  ts: number;
  level: 'info' | 'ok' | 'warn' | 'err';
  channel: string;
  message: string;
}

export function ConsoleDrawer({
  open,
  isConnected,
  isProcessing,
  queueDepth,
  recentEvents
}: ConsoleDrawerProps) {
  const [tab, setTab] = useState<'live' | 'errors' | 'doctor' | 'sse'>('live');
  if (!open) return null;

  const filtered =
    tab === 'errors'
      ? recentEvents.filter(e => e.level === 'err' || e.level === 'warn')
      : tab === 'doctor'
        ? recentEvents.filter(e => e.channel === 'doctor')
        : tab === 'sse'
          ? recentEvents.filter(e => e.channel === 'sse')
          : recentEvents;

  const tabs: Array<{ k: typeof tab; l: string }> = [
    { k: 'live', l: 'live' },
    { k: 'errors', l: 'errors' },
    { k: 'doctor', l: 'doctor' },
    { k: 'sse', l: 'SSE' }
  ];

  return (
    <div className="console" role="region" aria-label="Worker console">
      <div className="console-head">
        <Icons.Logs size={14} />
        <strong style={{ fontSize: 12 }}>Worker console</strong>
        <div className="console-tabs">
          {tabs.map(t => (
            <button
              key={t.k}
              type="button"
              className={`t ${tab === t.k ? 'is-active' : ''}`}
              onClick={() => setTab(t.k)}
            >
              {t.l}
            </button>
          ))}
        </div>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)'
          }}
        >
          {isConnected ? `live · queue ${queueDepth}` : 'reconnecting…'}
          {isProcessing && ' · processing'}
        </span>
      </div>
      <div className="console-stream">
        {filtered.length === 0 ? (
          <div className="row">
            <span className="ts">—</span>
            <span className="lvl info">INFO</span>
            <span className="msg">
              <span style={{ color: 'var(--ink-2)' }}>[viewer]</span> no events for this filter yet
            </span>
          </div>
        ) : (
          filtered.map((evt, i) => (
            <div key={`${evt.ts}-${i}`} className="row">
              <span className="ts">{formatLogTime(evt.ts)}</span>
              <span className={`lvl ${evt.level}`}>{evt.level.toUpperCase()}</span>
              <span className="msg">
                <span style={{ color: 'var(--ink-2)' }}>[{evt.channel}]</span> {evt.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface OfflineBannerProps {
  visible: boolean;
  onRetry: () => void;
  onOpenConsole: () => void;
}

export function OfflineBanner({ visible, onRetry, onOpenConsole }: OfflineBannerProps) {
  if (!visible) return null;
  return (
    <div className="banner err" role="alert">
      <span className="dot err" />
      <div>
        <div style={{ fontWeight: 500 }}>Worker unreachable on :37777</div>
        <div className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          cached data shown · reconnecting
        </div>
      </div>
      <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={onRetry}>
        <Icons.Refresh size={12} /> Retry now
      </button>
      <button type="button" className="btn ghost" onClick={onOpenConsole}>
        <Icons.Logs size={12} /> Open console
      </button>
    </div>
  );
}

interface NewMemoryToastProps {
  visible: boolean;
  obsId: number | null;
  source: string | null;
  type: string | null;
  saved: number;
  onView: () => void;
}

export function NewMemoryToast({ visible, obsId, source, type, saved, onView }: NewMemoryToastProps) {
  if (!visible || obsId == null) return null;
  return (
    <button type="button" className="toast" onClick={onView}>
      <span
        className="dot ok live"
        style={{ color: 'var(--cyan-300)', background: 'var(--cyan-300)' }}
      />
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>New memory · obs#{obsId}</div>
        <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {[source, type, saved > 0 ? `saved ${saved.toLocaleString()} tok` : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <span className="btn sm" style={{ pointerEvents: 'none' }}>
        View
      </span>
    </button>
  );
}

function formatRailCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatLogTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const milli = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${milli}`;
}
