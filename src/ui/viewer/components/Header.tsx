import React, { useCallback } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { ThemePreference } from '../hooks/useTheme';
import { useSpinningFavicon } from '../hooks/useSpinningFavicon';
import type { Route } from '../hooks/useRoute';
import { KeyboardShortcut } from './primitives/KeyboardShortcut';

interface HeaderProps {
  route: Route;
  onRouteChange: (r: Route) => void;
  isConnected: boolean;
  isProcessing: boolean;
  queueDepth: number;
  themePreference: ThemePreference;
  onThemeChange: (t: ThemePreference) => void;
  onOpenPalette: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Header({
  route, onRouteChange, isConnected, isProcessing, queueDepth,
  themePreference, onThemeChange, onOpenPalette, onOpenHelp, onOpenSettings,
  searchQuery, onSearchChange
}: HeaderProps) {
  useSpinningFavicon(isProcessing);

  const mkNavHandler = useCallback((r: Route) => () => onRouteChange(r), [onRouteChange]);

  return (
    <div className="header" style={{ gap: 'var(--space-4)' }}>
      <div className="header-main" style={{ gap: 'var(--space-5)' }}>
        <h1 style={{ gap: 'var(--space-3)' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src="claude-mem-logomark.webp" alt="" className={`logomark ${isProcessing ? 'spinning' : ''}`} />
            {queueDepth > 0 && <div className="queue-bubble">{queueDepth}</div>}
          </div>
          <span className="logo-text">aimemory</span>
          {!isConnected && (
            <span
              title="Worker unreachable"
              aria-live="polite"
              style={{
                marginLeft: 'var(--space-2)',
                padding: '0.125rem 0.5rem',
                borderRadius: 'var(--radius-pill)',
                background: 'rgb(239 68 68 / 12%)',
                color: 'var(--accent-error)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                letterSpacing: '0.02em'
              }}
            >
              offline
            </span>
          )}
        </h1>

        <nav className="am-topnav" aria-label="Primary">
          <button type="button" className={`am-topnav__link ${route === 'feed' ? 'is-active' : ''}`} onClick={mkNavHandler('feed')}>
            Feed
          </button>
          <button type="button" className={`am-topnav__link ${route === 'sources' ? 'is-active' : ''}`} onClick={mkNavHandler('sources')}>
            Sources
          </button>
          <button type="button" className={`am-topnav__link ${route === 'settings' ? 'is-active' : ''}`} onClick={onOpenSettings}>
            Settings
          </button>
        </nav>
      </div>

      <div className="status" style={{ gap: 'var(--space-3)' }}>
        <div className="am-search">
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
        </div>

        <button
          type="button"
          onClick={onOpenPalette}
          className="am-topnav__link"
          style={{ display: 'inline-flex', gap: 'var(--space-2)' }}
          title="Open command palette (⌘K)"
        >
          <KeyboardShortcut keys={['⌘', 'K']} />
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          className="am-topnav__link"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        <ThemeToggle preference={themePreference} onThemeChange={onThemeChange} />
      </div>
    </div>
  );
}
