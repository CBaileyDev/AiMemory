import React, { useCallback } from 'react';
import type { NeonScheme } from '../hooks/useTheme';
import { useSpinningFavicon } from '../hooks/useSpinningFavicon';
import type { Route } from '../hooks/useRoute';
import { KeyboardShortcut } from './primitives/KeyboardShortcut';
import { BrainIcon } from './BrainIcon';
import { SchemePicker } from './primitives/SchemePicker';

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
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

function StatusPulse({ active }: { active: boolean }) {
  return (
    <span
      className={`am-status-pulse ${active ? 'is-active' : 'is-offline'}`}
      aria-hidden="true"
    >
      <span className="am-status-pulse__ring" />
      <span className="am-status-pulse__dot" />
    </span>
  );
}

export function Header({
  route,
  onRouteChange,
  isConnected,
  isProcessing,
  queueDepth,
  scheme,
  onSchemeChange,
  onOpenPalette,
  onOpenHelp,
  searchQuery,
  onSearchChange
}: HeaderProps) {
  useSpinningFavicon(isProcessing);

  const mkNavHandler = useCallback((r: Route) => () => onRouteChange(r), [onRouteChange]);

  return (
    <div className="header am-header-neon" style={{ gap: 'var(--space-4)' }}>
      <div className="header-main" style={{ gap: 'var(--space-5)' }}>
        <div className="am-header-neon__brand">
          <h1 className="am-logo-lockup">
            <span className="am-logo-mark-wrap">
              <BrainIcon className={`logomark logo-neon ${isProcessing ? 'spinning' : ''}`} glow />
              {queueDepth > 0 && <span className="queue-bubble">{queueDepth}</span>}
            </span>
            <span className="am-logo-copy">
              <span className="am-logo-wordmark">aimemory</span>
              <span className="am-header-neon__connection" aria-live="polite">
                <StatusPulse active={isConnected} />
                <span className="am-visually-hidden">
                  {isConnected ? 'Worker connected' : 'Worker offline'}
                </span>
                {!isConnected && <span className="am-header-neon__offline">offline</span>}
              </span>
            </span>
          </h1>
        </div>

        <nav className="am-topnav" aria-label="Primary">
          <button type="button" className={`am-topnav__link ${route === 'feed' ? 'is-active' : ''}`} onClick={mkNavHandler('feed')}>
            Feed
          </button>
          <button type="button" className={`am-topnav__link ${route === 'graph' ? 'is-active' : ''}`} onClick={mkNavHandler('graph')}>
            Graph
          </button>
          <button type="button" className={`am-topnav__link ${route === 'sources' ? 'is-active' : ''}`} onClick={mkNavHandler('sources')}>
            Sources
          </button>
          <button type="button" className={`am-topnav__link ${route === 'settings' ? 'is-active' : ''}`} onClick={mkNavHandler('settings')}>
            Settings
          </button>
        </nav>
      </div>

      <div className="status am-header-neon__tools" style={{ gap: 'var(--space-3)' }}>
        <div className="am-search am-header-neon__search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            placeholder="Search memory…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search memory"
          />
          <span className="am-search__hint am-mono" aria-hidden="true">
            ⌘K
          </span>
        </div>

        <div className="am-header-neon__actions">
          <SchemePicker
            scheme={scheme}
            onSchemeChange={onSchemeChange}
            className="am-header-neon__scheme-picker"
            label="Header accent scheme"
          />

          <button
            type="button"
            onClick={onOpenPalette}
            className="am-topnav__link am-header-neon__toolbtn"
            title="Open command palette (⌘K)"
            aria-label="Open command palette"
          >
            <KeyboardShortcut keys={['⌘', 'K']} />
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            className="am-topnav__link am-header-neon__toolbtn"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
