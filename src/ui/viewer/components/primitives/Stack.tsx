import React from 'react';

type GapToken =
  | '0'
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
  | 'card-gap'
  | 'section-gap'
  | 'feed-gutter';

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: GapToken;
  align?: 'stretch' | 'start' | 'center' | 'end';
  as?: keyof JSX.IntrinsicElements;
}

function gapVar(gap: GapToken): string {
  if (gap === '0') return '0';
  if (gap === 'card-gap') return 'var(--space-card-gap)';
  if (gap === 'section-gap') return 'var(--space-section-gap)';
  if (gap === 'feed-gutter') return 'var(--space-feed-gutter)';
  return `var(--space-${gap})`;
}

/**
 * Vertical flex layout primitive.
 * @example <Stack gap="card-gap">...</Stack>
 */
export function Stack({
  gap = '3',
  align = 'stretch',
  as: Tag = 'div',
  style,
  children,
  ...rest
}: StackProps) {
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      {...rest}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align,
        gap: gapVar(gap),
        ...style
      }}
    >
      {children}
    </Comp>
  );
}
