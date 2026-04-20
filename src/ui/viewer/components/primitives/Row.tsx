import React from 'react';

type GapToken =
  | '0'
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
  | 'card-gap'
  | 'feed-gutter';

interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: GapToken;
  align?: 'stretch' | 'start' | 'center' | 'end' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  wrap?: boolean;
  children?: React.ReactNode;
}

function gapVar(gap: GapToken): string {
  if (gap === '0') return '0';
  if (gap === 'card-gap') return 'var(--space-card-gap)';
  if (gap === 'feed-gutter') return 'var(--space-feed-gutter)';
  return `var(--space-${gap})`;
}

/**
 * Horizontal flex layout primitive.
 * @example <Row gap="2" align="center" justify="space-between">...</Row>
 */
export function Row({
  gap = '2',
  align = 'center',
  justify = 'start',
  wrap = false,
  style,
  children,
  ...rest
}: RowProps) {
  return (
    <div
      {...rest}
      style={{
        display: 'flex',
        alignItems: align,
        justifyContent: justify,
        gap: gapVar(gap),
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style
      }}
    >
      {children}
    </div>
  );
}
