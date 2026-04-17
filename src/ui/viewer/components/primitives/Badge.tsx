import React from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  subtle?: boolean;
  mono?: boolean;
}

const TONE_MAP: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--neutral-200)', fg: 'var(--color-text-secondary)' },
  accent:  { bg: 'var(--accent-primary-soft)', fg: 'var(--accent-primary)' },
  success: { bg: 'rgb(16 185 129 / 14%)', fg: 'var(--accent-success)' },
  warning: { bg: 'rgb(245 158 11 / 14%)', fg: 'var(--accent-warning)' },
  error:   { bg: 'rgb(239 68 68 / 14%)', fg: 'var(--accent-error)' },
  info:    { bg: 'rgb(59 130 246 / 14%)', fg: 'var(--accent-info)' }
};

/**
 * Soft badge pill.
 * @example <Badge tone="accent">decision</Badge>
 */
export function Badge({
  tone = 'neutral',
  subtle = true,
  mono = false,
  style,
  children,
  ...rest
}: BadgeProps) {
  const { bg, fg } = TONE_MAP[tone];
  return (
    <span
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: '0.125rem 0.5rem',
        borderRadius: 'var(--radius-pill)',
        background: subtle ? bg : fg,
        color: subtle ? fg : 'var(--color-text-inverse)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        letterSpacing: '0.01em',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      {children}
    </span>
  );
}
