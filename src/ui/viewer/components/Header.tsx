import React, { useState, useCallback, useRef, useEffect } from 'react';
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

  const navRef = useRef<HTMLElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0 });

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const activeTab = nav.querySelector('.am-topnav__link.is-active') as HTMLElement;
    if (activeTab) {
      setIndicatorStyle({
        width: `${activeTab.offsetWidth}px`,
        transform: `translateX(${activeTab.offsetLeft}px)`,
        opacity: 1
      });
    }
  }, [route]);

  const mkNavHandler = useCallback((r: Route) => () => onRouteChange(r), [onRouteChange]);

  return (
    <div className="header am-header-neon" style={{ gap: 'var(--space-4)' }}>
      <div className="header-main" style={{ gap: 'var(--space-5)' }}>
        <div className="am-header-neon__brand">
          <h1 className="am-logo-lockup">
            <span className="am-logo-mark-wrap">
              <BrainIcon 
                className="logomark logo-neon" 
                glow 
                thinking={isProcessing} 
              />
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

        <nav className="am-topnav" aria-label="Primary" ref={navRef} style={{ position: 'relative' }}>
          <div className="am-topnav__indicator" style={indicatorStyle} />
          <button type="button" className={`am-topnav__link ${route === 'feed' ? 'is-active' : ''}`} onClick={mkNavHandler('feed')} title="Feed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <span className="am-nav-label">Feed</span>
          </button>
          <button type="button" className={`am-topnav__link ${route === 'graph' ? 'is-active' : ''}`} onClick={mkNavHandler('graph')} title="Graph">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            <span className="am-nav-label">Graph</span>
          </button>
          <button type="button" className={`am-topnav__link ${route === 'sources' ? 'is-active' : ''}`} onClick={mkNavHandler('sources')} title="Sources">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            <span className="am-nav-label">Sources</span>
          </button>
          <button type="button" className={`am-topnav__link ${route === 'settings' ? 'is-active' : ''}`} onClick={mkNavHandler('settings')} title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            <span className="am-nav-label">Settings</span>
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
