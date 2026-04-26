import React from 'react';

interface StatusBarProps {
  workerPort: number;
  isConnected: boolean;
  rowCount: number;
  chromaIndexed: boolean;
  sseSubscribers: number;
  consoleOpen: boolean;
  onOpenConsole: () => void;
}

function formatNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const ICON_LOGS = (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m7 8 3 3-3 3M13 14h4" />
  </svg>
);

export function StatusBar({
  workerPort,
  isConnected,
  rowCount,
  chromaIndexed,
  sseSubscribers,
  consoleOpen,
  onOpenConsole
}: StatusBarProps) {
  const [now, setNow] = React.useState<string>(formatNow);

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(formatNow()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <footer className="statusbar">
      <span className="seg">
        <span
          className={`dot ${isConnected ? 'ok live' : 'err'}`}
          style={{ color: isConnected ? 'var(--ok)' : 'var(--err)' }}
        />
        <b>worker</b> :{workerPort}
      </span>
      <span className="sep">|</span>
      <span className="seg">SQLite <b>{rowCount.toLocaleString('en-US')}</b> rows</span>
      <span className="sep">|</span>
      <span className="seg">Chroma <b>{chromaIndexed ? 'indexed' : 'pending'}</b></span>
      <span className="sep">|</span>
      <span className="seg">FTS5 <b>BM25+rerank</b></span>
      <span className="sep">|</span>
      <span className="seg">SSE <b>{sseSubscribers}</b> subs</span>

      <div className="right">
        <span className="seg">{now}</span>
        <button
          type="button"
          className={`console-btn ${consoleOpen ? 'is-active' : ''}`}
          onClick={onOpenConsole}
        >
          {ICON_LOGS} console <span className="kbd" style={{ height: 14, fontSize: 9.5 }}>⌘\</span>
        </button>
      </div>
    </footer>
  );
}
