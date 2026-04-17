import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SourceDot } from './primitives/SourceDot';
import { Button } from './primitives/Button';

interface Citation {
  id: number;
  title: string | null;
  subtitle: string | null;
  narrative_snippet: string | null;
  project: string;
  platform_source: string;
  type: string;
  created_at_epoch: number;
}

interface AskPanelProps {
  isOpen: boolean;
  initialQuestion?: string;
  onClose: () => void;
  onCiteClick: (observationId: number) => void;
}

const HISTORY_KEY = 'aimemory.ask.history';
const HISTORY_MAX = 25;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch { return []; }
}

function saveHistory(list: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch { /* storage unavailable, ignore */ }
}

export function AskPanel({ isOpen, initialQuestion, onClose, onCiteClick }: AskPanelProps) {
  const [question, setQuestion] = useState(initialQuestion ?? '');
  const [loading, setLoading] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
      if (initialQuestion) setQuestion(initialQuestion);
    }
  }, [isOpen, initialQuestion]);

  const submit = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, limit: 8 })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSynthesis(data.synthesis ?? null);
      setCitations(Array.isArray(data.citations) ? data.citations : []);
      const history = [trimmed, ...loadHistory().filter(h => h !== trimmed)];
      saveHistory(history);
      setHistoryCursor(-1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && initialQuestion) {
      submit(initialQuestion);
    }
  }, [isOpen, initialQuestion, submit]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(question);
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowUp') {
      const history = loadHistory();
      const nextCursor = Math.min(history.length - 1, historyCursor + 1);
      if (nextCursor >= 0 && history[nextCursor]) {
        setQuestion(history[nextCursor]);
        setHistoryCursor(nextCursor);
      }
    } else if (e.key === 'ArrowDown') {
      const history = loadHistory();
      const nextCursor = historyCursor - 1;
      if (nextCursor < 0) {
        setQuestion('');
        setHistoryCursor(-1);
      } else {
        setQuestion(history[nextCursor] ?? '');
        setHistoryCursor(nextCursor);
      }
    }
  }, [historyCursor, onClose, question, submit]);

  return (
    <div className={`am-ask ${isOpen ? 'is-open' : ''}`} role="dialog" aria-label="Ask memory">
      <div className="am-ask__head">
        <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Ask memory</strong>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-md)' }}
          aria-label="Close ask panel"
        >
          ×
        </button>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(question); }}
        style={{ padding: 'var(--space-3) var(--space-5) 0' }}
      >
        <input
          ref={inputRef}
          type="text"
          className="am-ask__input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about your memory — ↑/↓ cycles history"
          aria-label="Question"
        />
      </form>

      <div className="am-ask__body">
        {loading && <div style={{ color: 'var(--color-text-muted)' }}>Searching…</div>}
        {error && <div style={{ color: 'var(--accent-error)' }}>Failed: {error}</div>}

        {synthesis && <div className="am-ask__synthesis">{synthesis}</div>}

        {!loading && !error && citations.length === 0 && question && (
          <div style={{ color: 'var(--color-text-muted)' }}>
            No citations. Try different wording or relax filters.
          </div>
        )}

        {citations.map((c) => (
          <div
            key={c.id}
            className="am-ask__citation"
            role="button"
            tabIndex={0}
            onClick={() => onCiteClick(c.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCiteClick(c.id); }}
          >
            <SourceDot source={c.platform_source} />
            <span className="am-ask__cite-key">obs#{c.id}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{c.title || 'Untitled'}</span>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.narrative_snippet || c.subtitle || '—'}
              </span>
            </div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{c.project}</span>
          </div>
        ))}

        {!loading && !error && citations.length === 0 && !question && (
          <div style={{ color: 'var(--color-text-muted)' }}>
            <p>Ask a question to search across every memory. For example:</p>
            <ul style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-6)' }}>
              <li>how did I fix the migration?</li>
              <li>what did I learn about SSE reconnect?</li>
              <li>decisions about pagination</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
