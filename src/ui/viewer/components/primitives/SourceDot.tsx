import React from 'react';

interface SourceDotProps {
  source: string | null | undefined;
  size?: number;
  title?: string;
  style?: React.CSSProperties;
  glow?: boolean;
}

/**
 * Colored dot per Phase 0 source hue palette. Consumes --source-* tokens
 * via the .source-dot[data-source="..."] rules in tokens.css.
 */
export function SourceDot({ source, size = 8, title, style, glow = false }: SourceDotProps) {
  const src = source || 'default';
  const slug = String(src).replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'default';
  return (
    <span
      className={`source-dot${glow ? ' source-dot--glow' : ''}`}
      data-source={src}
      aria-hidden={!title}
      title={title ?? src}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...(glow ? { boxShadow: `0 0 ${Math.max(6, size)}px var(--source-${slug}, var(--accent-primary))` } : null),
        ...style
      }}
    />
  );
}
