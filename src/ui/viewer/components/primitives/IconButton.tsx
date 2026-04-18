import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'secondary';
  children: React.ReactNode;
}

const sizeMap = { sm: '28px', md: '34px', lg: '40px' };

/** Square icon-only button with accessible label. */
export function IconButton({ label, size = 'md', variant = 'ghost', children, style, ...props }: IconButtonProps) {
  const dim = sizeMap[size];
  return (
    <button
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        borderRadius: 'var(--radius-md)',
        border: variant === 'secondary' ? '1px solid var(--color-border-primary)' : '1px solid transparent',
        background: variant === 'secondary' ? 'var(--color-bg-secondary)' : 'transparent',
        color: 'var(--color-text-secondary)',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        transition: `background var(--duration-ui), color var(--duration-ui)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
