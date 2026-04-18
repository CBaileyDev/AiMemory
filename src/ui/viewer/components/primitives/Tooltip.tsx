import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom';
}

/** Simple CSS-powered tooltip wrapper. */
export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span role="tooltip" style={{
          position: 'absolute',
          [placement === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-bg-tooltip)',
          color: 'var(--color-text-inverse)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--text-xs)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 'var(--z-tooltip, 1000)' as React.CSSProperties['zIndex'],
          boxShadow: 'var(--elev-2)',
        }}>
          {content}
        </span>
      )}
    </span>
  );
}
