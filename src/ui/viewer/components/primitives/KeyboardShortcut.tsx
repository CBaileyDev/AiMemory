import React from 'react';

interface KeyboardShortcutProps {
  keys: string[];
  style?: React.CSSProperties;
}

/**
 * Monospace key hint chip group.
 * @example <KeyboardShortcut keys={['⌘', 'K']} />
 */
export function KeyboardShortcut({ keys, style }: KeyboardShortcutProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.1875rem',
        fontFamily: 'var(--font-mono)',
        ...style
      }}
    >
      {keys.map((k, i) => (
        <kbd
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '1.25rem',
            height: '1.25rem',
            padding: '0 0.3125rem',
            borderRadius: '4px',
            background: 'var(--color-bg-card)',
            color: 'var(--color-text-tertiary)',
            border: '1px solid var(--color-border-primary)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            lineHeight: 1
          }}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
