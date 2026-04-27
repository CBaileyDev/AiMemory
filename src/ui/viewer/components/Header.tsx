import React from 'react';
import type { NeonScheme } from '../hooks/useTheme';
import { useSpinningFavicon } from '../hooks/useSpinningFavicon';
import type { Route } from '../hooks/useRoute';
import { WindowControls } from './WindowControls';

interface HeaderProps {
  route: Route;
  onRouteChange: (r: Route) => void;
  isConnected: boolean;
  isProcessing: boolean;
  queueDepth: number;
  scheme: NeonScheme;
  onSchemeChange: (t: NeonScheme) => void;
  onOpenPalette: () => void;
  onOpenHelp: () => void;
  onToggleConsole: () => void;
  consoleOpen: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  workerPort: number;
}

const ICONS = {
  search: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  bug: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 7V5a3 3 0 1 1 6 0v2M5 11h14M5 15h14M12 7v14M5 11a4 4 0 0 0 4-4h6a4 4 0 0 0 4 4M3 13H1M23 13h-2M3 18h2M19 18h2" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
    </svg>
  ),
  logs: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m7 8 3 3-3 3M13 14h4" />
    </svg>
  )
};

export function Header({
  isConnected,
  isProcessing,
  onOpenPalette,
  onToggleConsole,
  consoleOpen,
  workerPort
}: HeaderProps) {
  useSpinningFavicon(isProcessing);

  const status: 'ok' | 'warn' | 'err' = isConnected ? 'ok' : 'err';
  const statusColor =
    status === 'ok' ? 'var(--ok)' : status === 'warn' ? 'var(--warn)' : 'var(--err)';
  const statusText =
    status === 'ok'
      ? `worker live · :${workerPort}`
      : status === 'warn'
        ? 'reconnecting…'
        : 'offline';

  return (
    <header className="hdr" data-tauri-drag-region>
      <button type="button" className="hdr-search" onClick={onOpenPalette}>
        <span className="hdr-search-icon">{ICONS.search}</span>
        <span className="hdr-search-text">Ask, search memory, or run a command…</span>
        <span className="hdr-search-shortcut">
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </button>

      <div className="hdr-actions">
        <button type="button" className="hdr-btn" title="Run doctor">
          {ICONS.bug} Doctor
        </button>
        <button type="button" className="hdr-btn" title="Force resync">
          {ICONS.refresh} Sync
        </button>
        <button
          type="button"
          className={`hdr-btn ${consoleOpen ? 'is-pressed' : ''}`}
          onClick={onToggleConsole}
          title="Worker console (⌘\\)"
        >
          {ICONS.logs} Console
        </button>
        <span style={{ width: 1, height: 20, background: 'var(--line-2)', margin: '0 4px' }} />
        <span
          className="src"
          aria-live="polite"
          style={{ fontSize: 12, color: statusColor, fontFamily: 'var(--font-mono)' }}
        >
          <span
            className={`dot ${status === 'ok' ? 'ok live' : status === 'warn' ? 'warn' : 'err'}`}
            style={{ color: statusColor }}
            aria-hidden="true"
          />
          {statusText}
        </span>
        <WindowControls variant="header" />
      </div>
    </header>
  );
}
