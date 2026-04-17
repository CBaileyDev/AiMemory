import React from 'react';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
}

/**
 * Interactive chip — toggleable + optionally removable.
 * @example <Chip active={selected} onClick={toggle}>bugfix</Chip>
 */
export function Chip({
  active = false,
  icon,
  removable = false,
  onRemove,
  children,
  style,
  className = '',
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`am-chip ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: '0.3125rem 0.75rem',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--color-border-primary)'}`,
        background: active ? 'var(--accent-primary-soft)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        lineHeight: 1,
        cursor: 'pointer',
        transition: `background var(--motion-ui) var(--ease-out), border-color var(--motion-ui) var(--ease-out), color var(--motion-ui) var(--ease-out)`,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      {icon}
      <span>{children}</span>
      {removable && (
        <span
          role="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          style={{
            display: 'inline-flex',
            marginLeft: 'var(--space-1)',
            opacity: 0.7,
            cursor: 'pointer'
          }}
        >
          ×
        </span>
      )}
    </button>
  );
}
