import React from 'react';
import type { NeonScheme } from '../hooks/useTheme';

interface SchemeToggleProps {
  scheme: NeonScheme;
  onSchemeChange: (scheme: NeonScheme) => void;
}

const ORDER: NeonScheme[] = ['cyan', 'violet', 'neon-matrix'];

export function ThemeToggle({ scheme, onSchemeChange }: SchemeToggleProps) {
  const cycle = () => {
    const i = ORDER.indexOf(scheme);
    onSchemeChange(ORDER[(i + 1) % ORDER.length]);
  };

  const title =
    scheme === 'cyan'
      ? 'Color scheme: Cyan Pulse (click for next)'
      : scheme === 'violet'
        ? 'Color scheme: Violet Storm (click for next)'
        : 'Color scheme: Neon Matrix (click for next)';

  return (
    <button type="button" className="theme-toggle-btn" onClick={cycle} title={title} aria-label={title}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}
