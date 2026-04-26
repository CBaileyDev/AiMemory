import React from 'react';
import { tauri, useMaximizedState, useTauri } from '../hooks/useTauri';

const ICONS = {
  minimize: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  maximize: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  restore: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 3V2.5C2 2.22 2.22 2 2.5 2H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="m3 3 4 4M7 3l-4 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
};

interface WindowControlsProps {
  /** Match parent surface for macOS spacer width. */
  variant?: 'header' | 'titlebar';
}

/**
 * Native window controls for the Tauri webview.
 * - macOS: returns null (Tauri overlays its native traffic lights). The
 *   surrounding layout is responsible for reserving space via `data-tlc`.
 * - Windows / Linux: renders our own minimize / maximize / close cluster.
 * - Web: returns null.
 */
export function WindowControls(_props: WindowControlsProps): JSX.Element | null {
  const { isTauri, platform } = useTauri();
  const maximized = useMaximizedState(isTauri);

  if (!isTauri) return null;
  if (platform === 'mac') return null;

  const onMinimize = () => {
    void tauri.minimize();
  };
  const onToggleMax = () => {
    void tauri.toggleMaximize();
  };
  const onClose = () => {
    void tauri.close();
  };

  return (
    <div
      className="winctl"
      data-platform={platform}
      data-tauri-drag-region={false}
      role="group"
      aria-label="Window controls"
    >
      <button
        type="button"
        className="winctl-btn"
        title="Minimize"
        aria-label="Minimize window"
        onClick={onMinimize}
      >
        {ICONS.minimize}
      </button>
      <button
        type="button"
        className="winctl-btn"
        title={maximized ? 'Restore' : 'Maximize'}
        aria-label={maximized ? 'Restore window' : 'Maximize window'}
        onClick={onToggleMax}
      >
        {maximized ? ICONS.restore : ICONS.maximize}
      </button>
      <button
        type="button"
        className="winctl-btn winctl-btn--close"
        title="Close"
        aria-label="Close window"
        onClick={onClose}
      >
        {ICONS.close}
      </button>
    </div>
  );
}

/**
 * Reserves horizontal space at the start of the rail brand to clear macOS
 * traffic lights (which Tauri renders natively over the webview at 18,20).
 * Returns null on non-Tauri or non-mac surfaces.
 */
export function TrafficLightSpacer(): JSX.Element | null {
  const { isTauri, platform } = useTauri();
  if (!isTauri || platform !== 'mac') return null;
  return <span className="traffic-light-spacer" aria-hidden="true" />;
}
