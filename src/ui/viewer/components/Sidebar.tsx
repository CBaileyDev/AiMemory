import React, { useMemo } from 'react';
import type { Route } from '../hooks/useRoute';

interface SidebarProps {
  route: Route;
  onRouteChange: (r: Route) => void;
  isConnected: boolean;
  totalMemories: number;
  graphCount: number;
  activeSources: number;
  totalSources: number;
  projectCounts: Array<{ name: string; count: number }>;
  selectedProject: string | null;
  onProjectChange: (project: string | null) => void;
  workerPort: number;
  workerUptimeMs: number | null;
  pendingJobs: number;
  dbSizeBytes: number | null;
  appVersion: string;
}

const ICON_SIZE = 16;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return String(n);
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatUptime(ms: number | null): string {
  if (ms == null || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSec}s`;
}

const ICONS = {
  feed: (
    <svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h12" />
    </svg>
  ),
  graph: (
    <svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7.4 7.4 10.6 16.6M16.6 7.4 13.4 16.6M8 6h8" />
    </svg>
  ),
  sources: (
    <svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
};

export function Sidebar({
  route,
  onRouteChange,
  isConnected,
  totalMemories,
  graphCount,
  activeSources,
  totalSources,
  projectCounts,
  selectedProject,
  onProjectChange,
  workerPort,
  workerUptimeMs,
  pendingJobs,
  dbSizeBytes,
  appVersion
}: SidebarProps) {
  const sortedProjects = useMemo(
    () => [...projectCounts].sort((a, b) => b.count - a.count).slice(0, 8),
    [projectCounts]
  );

  const dotState = isConnected ? 'ok' : 'err';
  const workerLabel = isConnected ? 'Worker live' : 'Offline';

  return (
    <aside className="rail" aria-label="Workspace navigation">
      <div className="rail-brand">
        <div className="rail-mark" aria-hidden="true" />
        <div className="rail-name"><b>Ai</b><span>Memory</span></div>
        <span className="rail-build">v{appVersion}</span>
      </div>

      <div className="rail-section">
        <div className="rail-section-title">Workspace</div>
        <div
          className={`nav-item ${route === 'feed' ? 'is-active' : ''}`}
          onClick={() => onRouteChange('feed')}
          role="button"
          tabIndex={0}
          aria-current={route === 'feed' ? 'page' : undefined}
        >
          <span className="icon">{ICONS.feed}</span>
          <span className="nav-item-label">Feed</span>
          <span className="nav-item-meta">{formatCount(totalMemories)}</span>
        </div>
        <div
          className={`nav-item ${route === 'graph' ? 'is-active' : ''}`}
          onClick={() => onRouteChange('graph')}
          role="button"
          tabIndex={0}
          aria-current={route === 'graph' ? 'page' : undefined}
        >
          <span className="icon">{ICONS.graph}</span>
          <span className="nav-item-label">Graph</span>
          <span className="nav-item-meta">{formatCount(graphCount)}</span>
        </div>
        <div
          className={`nav-item ${route === 'sources' ? 'is-active' : ''}`}
          onClick={() => onRouteChange('sources')}
          role="button"
          tabIndex={0}
          aria-current={route === 'sources' ? 'page' : undefined}
        >
          <span className="icon">{ICONS.sources}</span>
          <span className="nav-item-label">Sources</span>
          <span className="nav-item-meta">{activeSources}/{totalSources}</span>
        </div>
        <div
          className={`nav-item ${route === 'settings' ? 'is-active' : ''}`}
          onClick={() => onRouteChange('settings')}
          role="button"
          tabIndex={0}
          aria-current={route === 'settings' ? 'page' : undefined}
        >
          <span className="icon">{ICONS.settings}</span>
          <span className="nav-item-label">Settings</span>
        </div>
      </div>

      {sortedProjects.length > 0 && (
        <div className="rail-section">
          <div className="rail-section-title">Projects</div>
          {sortedProjects.map((p) => (
            <div
              key={p.name}
              className={`nav-item ${selectedProject === p.name ? 'is-active' : ''}`}
              onClick={() => onProjectChange(selectedProject === p.name ? null : p.name)}
              role="button"
              tabIndex={0}
              title={p.name}
            >
              <span className="icon">{ICONS.folder}</span>
              <span className="nav-item-label">{p.name}</span>
              <span className="nav-item-meta">{p.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rail-foot">
        <div className="worker">
          <div className="worker-row">
            <span
              className={`dot ${dotState}${isConnected ? ' live' : ''}`}
              style={{ color: isConnected ? 'var(--ok)' : 'var(--err)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--ink-0)', fontWeight: 500 }}>
              {workerLabel}
            </span>
            <span className="worker-value">:{workerPort}</span>
          </div>
          <div className="worker-row">
            <span className="worker-label">Uptime</span>
            <span className="worker-value">{formatUptime(workerUptimeMs)}</span>
          </div>
          <div className="worker-row">
            <span className="worker-label">Pending</span>
            <span className="worker-value">{pendingJobs} jobs</span>
          </div>
          <div className="worker-row">
            <span className="worker-label">DB</span>
            <span className="worker-value">{formatBytes(dbSizeBytes)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
