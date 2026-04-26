import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from './Icons';
import type { Route } from '../hooks/useRoute';
import type { FeedItem } from './feedTypes';
import { sourceMeta, typeMeta, normalizeTypeKey } from './registry';

export interface PaletteAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (r: Route) => void;
  onJump: (id: number) => void;
  onAsk: (question: string) => void;
  onCycleScheme: () => void;
  onToggleConsole: () => void;
  items: FeedItem[];
}

export function CommandPaletteV2({
  open,
  onClose,
  onNavigate,
  onJump,
  onAsk,
  onCycleScheme,
  onToggleConsole,
  items
}: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const navActions: PaletteAction[] = useMemo(
    () => [
      {
        id: 'go-feed',
        label: 'Go to Feed',
        icon: <Icons.Feed size={14} />,
        shortcut: 'g h',
        run: () => onNavigate('feed')
      },
      {
        id: 'go-graph',
        label: 'Open Memory Graph',
        icon: <Icons.Graph size={14} />,
        shortcut: 'g v',
        run: () => onNavigate('graph')
      },
      {
        id: 'go-sources',
        label: 'Sources',
        icon: <Icons.Sources size={14} />,
        shortcut: 'g s',
        run: () => onNavigate('sources')
      },
      {
        id: 'go-settings',
        label: 'Settings',
        icon: <Icons.Settings size={14} />,
        shortcut: 'g c',
        run: () => onNavigate('settings')
      }
    ],
    [onNavigate]
  );

  const actActions: PaletteAction[] = useMemo(
    () => [
      {
        id: 'console',
        label: 'Toggle worker console',
        icon: <Icons.Logs size={14} />,
        shortcut: '⌘ \\',
        run: onToggleConsole
      },
      {
        id: 'scheme',
        label: 'Cycle accent scheme',
        icon: <Icons.Star size={14} />,
        run: onCycleScheme
      },
      {
        id: 'doctor',
        label: 'Run doctor',
        icon: <Icons.Bug size={14} />,
        run: () => {
          // placeholder hook — wired to the Doctor button on the header
          window.dispatchEvent(new CustomEvent('aimemory:doctor'));
        }
      }
    ],
    [onCycleScheme, onToggleConsole]
  );

  const matchingMems = useMemo(() => {
    if (!q) return items.slice(0, 6);
    const lower = q.toLowerCase();
    return items
      .filter(it => {
        return (
          it.title.toLowerCase().includes(lower) ||
          (it.summary || '').toLowerCase().includes(lower) ||
          it.platform_source.toLowerCase().includes(lower) ||
          (it.project || '').toLowerCase().includes(lower) ||
          `obs#${it.id}`.includes(lower)
        );
      })
      .slice(0, 8);
  }, [q, items]);

  const filteredNav = useMemo(
    () =>
      !q
        ? navActions
        : navActions.filter(a => a.label.toLowerCase().includes(q.toLowerCase())),
    [q, navActions]
  );

  const filteredAct = useMemo(
    () =>
      !q
        ? actActions
        : actActions.filter(a => a.label.toLowerCase().includes(q.toLowerCase())),
    [q, actActions]
  );

  const flat = useMemo(
    () => [
      ...filteredNav.map(a => ({ kind: 'nav' as const, action: a, id: a.id, label: a.label })),
      ...filteredAct.map(a => ({ kind: 'act' as const, action: a, id: a.id, label: a.label })),
      ...matchingMems.map(m => ({
        kind: 'mem' as const,
        item: m,
        id: `mem-${m.id}`,
        label: m.title
      })),
      // Ask-as-question fallback
      ...(q.trim().length > 0
        ? [{ kind: 'ask' as const, id: 'ask', label: `Ask: "${q.trim()}"` }]
        : [])
    ],
    [filteredNav, filteredAct, matchingMems, q]
  );

  useEffect(() => {
    setActive(0);
  }, [q]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => (flat.length === 0 ? 0 : (a + 1) % flat.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => (flat.length === 0 ? 0 : (a - 1 + flat.length) % flat.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      runEntry(active);
    }
  };

  const runEntry = (idx: number) => {
    const entry = flat[idx];
    if (!entry) return;
    if (entry.kind === 'mem') {
      onJump(entry.item.id);
    } else if (entry.kind === 'ask') {
      onAsk(q.trim());
    } else {
      entry.action.run();
    }
    onClose();
  };

  const navStart = 0;
  const navEnd = filteredNav.length;
  const actStart = navEnd;
  const actEnd = actStart + filteredAct.length;
  const memStart = actEnd;

  return (
    <div className="palette-scrim" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <div className="palette-input">
          <Icons.Cmd size={16} />
          <span className="scope">memory</span>
          <input
            ref={inputRef}
            placeholder="Ask, search, or run a command…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Command palette query"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list" role="listbox">
          {filteredNav.length > 0 && (
            <>
              <div className="palette-section-title">Navigate</div>
              {filteredNav.map((a, i) => (
                <PaletteRow
                  key={a.id}
                  active={active === navStart + i}
                  onHover={() => setActive(navStart + i)}
                  onClick={() => runEntry(navStart + i)}
                  icon={a.icon || <Icons.Arrow size={14} />}
                  label={a.label}
                  meta={a.shortcut}
                />
              ))}
            </>
          )}

          {filteredAct.length > 0 && (
            <>
              <div className="palette-section-title">Actions</div>
              {filteredAct.map((a, i) => (
                <PaletteRow
                  key={a.id}
                  active={active === actStart + i}
                  onHover={() => setActive(actStart + i)}
                  onClick={() => runEntry(actStart + i)}
                  icon={a.icon || <Icons.Spark size={14} />}
                  label={a.label}
                  meta={a.shortcut}
                />
              ))}
            </>
          )}

          {matchingMems.length > 0 && (
            <>
              <div className="palette-section-title">
                {q ? 'Matching memories' : 'Recent memories'}
              </div>
              {matchingMems.map((m, i) => {
                const t = typeMeta(m.type);
                const src = sourceMeta(m.platform_source);
                return (
                  <PaletteRow
                    key={`mem-${m.id}`}
                    active={active === memStart + i}
                    onHover={() => setActive(memStart + i)}
                    onClick={() => runEntry(memStart + i)}
                    icon={
                      <span style={{ color: t.color, display: 'inline-flex' }}>
                        <Icons.Star size={14} />
                      </span>
                    }
                    label={m.title}
                    meta={`obs#${m.id}`}
                    preview={`${src.name} · ${normalizeTypeKey(m.type)}`}
                  />
                );
              })}
            </>
          )}

          {q.trim().length > 0 && (
            <>
              <div className="palette-section-title">Ask AiMemory</div>
              <PaletteRow
                active={active === flat.length - 1}
                onHover={() => setActive(flat.length - 1)}
                onClick={() => runEntry(flat.length - 1)}
                icon={<Icons.Ask size={14} />}
                label={`Ask: "${q.trim()}"`}
                meta="↵"
              />
            </>
          )}

          {flat.length === 0 && (
            <div className="palette-section-title">No matches</div>
          )}
        </div>
        <div className="palette-foot">
          <span className="seg">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span className="seg">
            <span className="kbd">↵</span> open
          </span>
          <span className="seg">
            <span className="kbd">esc</span> close
          </span>
          <span className="right seg">
            try <span className="mono">obs#</span> · <span className="mono">cluster:</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PaletteRow({
  active,
  onHover,
  onClick,
  icon,
  label,
  meta,
  preview
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  meta?: string;
  preview?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={`palette-row ${active ? 'is-active' : ''}`}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      <span className="icon">{icon}</span>
      {preview ? (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </div>
          <div className="preview">{preview}</div>
        </div>
      ) : (
        <span className="label">{label}</span>
      )}
      {meta && <span className="meta">{meta}</span>}
    </button>
  );
}
