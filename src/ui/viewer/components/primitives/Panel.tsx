import React from 'react';

type PadToken =
  | '0' | '2' | '3' | '4' | '5' | '6' | '7'
  | 'card-padding';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 0 | 1 | 2 | 3;
  padding?: PadToken;
  radius?: 'sm' | 'md' | 'lg';
  as?: keyof JSX.IntrinsicElements;
}

function padVar(p: PadToken): string {
  if (p === '0') return '0';
  if (p === 'card-padding') return 'var(--space-card-padding)';
  return `var(--space-${p})`;
}

/**
 * Surface primitive with tokenized elevation, padding, and radius.
 * @example <Panel elevation={1} padding="card-padding">...</Panel>
 */
export function Panel({
  elevation = 1,
  padding = 'card-padding',
  radius = 'md',
  as: Tag = 'div',
  style,
  children,
  ...rest
}: PanelProps) {
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      {...rest}
      style={{
        background: 'var(--color-bg-card)',
        color: 'var(--color-text-primary)',
        borderRadius: `var(--radius-${radius})`,
        padding: padVar(padding),
        boxShadow: `var(--elev-${elevation})`,
        ...style
      }}
    >
      {children}
    </Comp>
  );
}
