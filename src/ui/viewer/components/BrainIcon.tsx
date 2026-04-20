import React from 'react';

interface BrainIconProps {
  className?: string;
  glow?: boolean;
}

/** Hexagonal neural-core logomark (design handoff — not a literal brain silhouette). */
export function BrainIcon({ className, glow = false }: BrainIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={glow ? { filter: 'drop-shadow(0 0 10px currentColor) drop-shadow(0 0 2px currentColor)' } : undefined}
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity={0.25}
        strokeDasharray="1 3"
      />
      <path
        d="M16 5 L24 10 L24 20 L16 25 L8 20 L8 10 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <path
        d="M16 5 L16 25 M8 10 L24 20 M24 10 L8 20"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity={0.5}
      />
      <circle cx="16" cy="15" r="2.5" fill="currentColor" opacity={0.95} />
      <circle cx="16" cy="15" r="4.5" stroke="currentColor" strokeWidth="0.5" opacity={0.4} />
      <circle cx="16" cy="5" r="1.4" fill="currentColor" />
      <circle cx="24" cy="10" r="1.4" fill="currentColor" />
      <circle cx="24" cy="20" r="1.4" fill="currentColor" />
      <circle cx="16" cy="25" r="1.4" fill="currentColor" />
      <circle cx="8" cy="20" r="1.4" fill="currentColor" />
      <circle cx="8" cy="10" r="1.4" fill="currentColor" />
      <circle cx="30" cy="16" r="0.8" fill="currentColor" opacity={0.5} />
      <circle cx="2" cy="16" r="0.8" fill="currentColor" opacity={0.5} />
      <circle cx="16" cy="1.5" r="0.6" fill="currentColor" opacity={0.4} />
      <circle cx="16" cy="30.5" r="0.6" fill="currentColor" opacity={0.4} />
    </svg>
  );
}
