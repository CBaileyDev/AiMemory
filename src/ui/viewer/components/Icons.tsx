import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  stroke?: number;
}

const I: React.FC<IconProps & { children: React.ReactNode; fill?: string }> = ({
  size = 16,
  className,
  stroke = 1.6,
  fill = 'none',
  children
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={fill}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Icons = {
  Search: (p: IconProps) => (
    <I {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </I>
  ),
  Feed: (p: IconProps) => (
    <I {...p}>
      <path d="M3 6h18M3 12h18M3 18h12" />
    </I>
  ),
  Graph: (p: IconProps) => (
    <I {...p}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7.4 7.4 10.6 16.6M16.6 7.4 13.4 16.6M8 6h8" />
    </I>
  ),
  Sources: (p: IconProps) => (
    <I {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </I>
  ),
  Settings: (p: IconProps) => (
    <I {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </I>
  ),
  Bolt: (p: IconProps) => (
    <I {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </I>
  ),
  Spark: (p: IconProps) => (
    <I {...p}>
      <path d="m12 2 2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 16.4 6.4 19.5 7.8 13 3 8.6l6.4-.6L12 2z" />
    </I>
  ),
  Plus: (p: IconProps) => (
    <I {...p}>
      <path d="M12 5v14M5 12h14" />
    </I>
  ),
  Minus: (p: IconProps) => (
    <I {...p}>
      <path d="M5 12h14" />
    </I>
  ),
  Fit: (p: IconProps) => (
    <I {...p}>
      <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4" />
    </I>
  ),
  Logs: (p: IconProps) => (
    <I {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m7 8 3 3-3 3M13 14h4" />
    </I>
  ),
  Refresh: (p: IconProps) => (
    <I {...p}>
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
    </I>
  ),
  Filter: (p: IconProps) => (
    <I {...p}>
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </I>
  ),
  Eye: (p: IconProps) => (
    <I {...p}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </I>
  ),
  Cite: (p: IconProps) => (
    <I {...p}>
      <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13c0 2 1 4 4 4M13 13c0 2 1 4 4 4" />
    </I>
  ),
  Close: (p: IconProps) => (
    <I {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </I>
  ),
  Chevron: (p: IconProps) => (
    <I {...p}>
      <path d="m9 6 6 6-6 6" />
    </I>
  ),
  Pulse: (p: IconProps) => (
    <I {...p}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </I>
  ),
  Cmd: (p: IconProps) => (
    <I {...p}>
      <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />
    </I>
  ),
  Ask: (p: IconProps) => (
    <I {...p}>
      <path d="M12 3a9 9 0 1 0 4.5 16.8L21 21l-1.2-4.5A9 9 0 0 0 12 3z" />
      <path d="M9.5 10a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17h.01" />
    </I>
  ),
  Folder: (p: IconProps) => (
    <I {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </I>
  ),
  Clock: (p: IconProps) => (
    <I {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </I>
  ),
  Arrow: (p: IconProps) => (
    <I {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </I>
  ),
  Bug: (p: IconProps) => (
    <I {...p}>
      <path d="M9 7V5a3 3 0 1 1 6 0v2M5 11h14M5 15h14M12 7v14M5 11a4 4 0 0 0 4-4h6a4 4 0 0 0 4 4M3 13H1M23 13h-2M3 18h2M19 18h2" />
    </I>
  ),
  Star: (p: IconProps) => (
    <I {...p}>
      <path d="m12 2 2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 16.4 6.4 19.5 7.8 13 3 8.6l6.4-.6L12 2z" />
    </I>
  ),
  Layers: (p: IconProps) => (
    <I {...p}>
      <path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5" />
    </I>
  ),
  Shield: (p: IconProps) => (
    <I {...p}>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    </I>
  ),
  Database: (p: IconProps) => (
    <I {...p}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
    </I>
  )
};

export type IconKey = keyof typeof Icons;
