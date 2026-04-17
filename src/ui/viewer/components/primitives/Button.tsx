import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

const VARIANT: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent-primary)',
    color: 'var(--color-text-inverse)',
    border: '1px solid var(--accent-primary)'
  },
  secondary: {
    background: 'var(--color-bg-card)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-primary)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid transparent'
  },
  danger: {
    background: 'var(--accent-error)',
    color: 'var(--color-text-inverse)',
    border: '1px solid var(--accent-error)'
  }
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  style,
  ...rest
}: ButtonProps) {
  const pad = size === 'sm' ? '0.3125rem 0.625rem' : '0.5rem 0.875rem';
  const fontSize = size === 'sm' ? 'var(--text-xs)' : 'var(--text-base)';
  return (
    <button
      type="button"
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: pad,
        borderRadius: 'var(--radius-md)',
        fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.6 : 1,
        transition: `background var(--motion-ui) var(--ease-out), transform var(--motion-ui) var(--ease-out), box-shadow var(--motion-ui) var(--ease-out)`,
        ...VARIANT[variant],
        ...style
      }}
    >
      {icon}
      {children}
    </button>
  );
}
