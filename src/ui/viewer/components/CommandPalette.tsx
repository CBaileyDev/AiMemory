import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Observation } from '../types';
import { fuzzyMatch } from '../utils/fuzzy';
import { SourceDot } from './primitives/SourceDot';
import { KeyboardShortcut } from './primitives/KeyboardShortcut';

export interface PaletteAction {
  id: string;
  label: string;
  shortcut?: string[];
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  observations: Observation[];
  actions: PaletteAction[];
  onJumpToObservation: (id: number) => void;
  onAsk: (question: string) => void;
}

type PaletteItem =
  | { kind: 'observation'; obs: Observation; score: number }
  | { kind: 'action'; action: PaletteAction; score: number }
  | { kind: 'ask'; question: string; score: number };

export function CommandPalette({
  isOpen, onClose, observations, actions, onJumpToObservation, onAsk
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 0);
      setQuery('');
      setActive(0);
    } else {
      previousFocus.current?.focus?.();
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    if (!isOpen) return [];
    const trimmed = query.trim();
    const isAsk = trimmed.startsWith('?');
    if (isAsk) {
      const q = trimmed.slice(1).trim();
      return [{ kind: 'ask', question: q, score: 0 }];
    }
    if (!trimmed) {
      // default view: 5 most recent observations + all actions
      const recent: PaletteItem[] = observations.slice(0, 5).map(obs =>
        ({ kind: 'observation', obs, score: 0 })
      );
      const acts: PaletteItem[] = actions.map(action =>
        ({ kind: 'action', action, score: 0 })
      );
      return [...recent, ...acts];
    }
    const obsScored: PaletteItem[] = [];
    for (const obs of observations) {
      const haystack = `${obs.title ?? ''} ${obs.subtitle ?? ''} ${obs.project} obs#${obs.id}`;
      const score = fuzzyMatch(trimmed, haystack);
      if (score !== null) obsScored.push({ kind: 'observation', obs, score });
    }
    obsScored.sort((a, b) => b.score - a.score);
    const actScored: PaletteItem[] = [];
    for (const action of actions) {
      const score = fuzzyMatch(trimmed, action.label);
      if (score !== null) actScored.push({ kind: 'action', action, score });
    }
    actScored.sort((a, b) => b.score - a.score);
    return [...obsScored.slice(0, 10), ...actScored.slice(0, 8)];
  }, [isOpen, query, observations, actions]);

  useEffect(() => { setActive(0); }, [query]);

  const runItem = useCallback((item: PaletteItem) => {
    if (item.kind === 'observation') onJumpToObservation(item.obs.id);
    else if (item.kind === 'action')  item.action.run();
    else if (item.kind === 'ask')     onAsk(item.question);
    onClose();
  }, [onClose, onJumpToObservation, onAsk]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      runItem(items[active]);
    }
  }, [active, items, onClose, runItem]);

  if (!isOpen) return null;

  const groupedIndices: { label: string; indices: number[] }[] = [];
  let currentGroup: string | null = null;
  items.forEach((item, idx) => {
    const label = item.kind === 'observation' ? 'Memory' : item.kind === 'action' ? 'Actions' : 'Ask';
    if (label !== currentGroup) {
      groupedIndices.push({ label, indices: [] });
      currentGroup = label;
    }
    groupedIndices[groupedIndices.length - 1].indices.push(idx);
  });

  return (
    <div className="am-palette-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="am-palette" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="am-palette__input"
          placeholder="Search memory or press ? then Space to ask"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-controls="am-palette-results"
          aria-activedescendant={`am-palette-item-${active}`}
        />
        <div className="am-palette__results" id="am-palette-results" role="listbox">
          {items.length === 0 && (
            <div className="am-palette__empty">
              No matches. Press <KeyboardShortcut keys={['?', 'space']} /> to ask a question instead.
            </div>
          )}
          {groupedIndices.map(group => (
            <React.Fragment key={group.label}>
              <div className="am-palette__group-label">{group.label}</div>
              {group.indices.map(idx => {
                const item = items[idx];
                const isActive = idx === active;
                return (
                  <div
                    key={idx}
                    id={`am-palette-item-${idx}`}
                    role="option"
                    aria-selected={isActive}
                    className={`am-palette__item ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runItem(item)}
                  >
                    {item.kind === 'observation' && (
                      <>
                        <SourceDot source={item.obs.platform_source} />
                        <span>{item.obs.title || 'Untitled'}</span>
                        <span className="am-palette__sub">obs#{item.obs.id}</span>
                      </>
                    )}
                    {item.kind === 'action' && (
                      <>
                        <span aria-hidden>→</span>
                        <span>{item.action.label}</span>
                        {item.action.shortcut && (
                          <span className="am-palette__sub">
                            <KeyboardShortcut keys={item.action.shortcut} />
                          </span>
                        )}
                      </>
                    )}
                    {item.kind === 'ask' && (
                      <>
                        <span aria-hidden>?</span>
                        <span>
                          {item.question
                            ? `Ask: ${item.question}`
                            : 'Type a question and press Enter'}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
