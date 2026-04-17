import React, { useEffect } from 'react';
import { KeyboardShortcut } from './primitives/KeyboardShortcut';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Shortcut = { keys: string[]; label: string };
type Section = { title: string; shortcuts: Shortcut[] };

const SECTIONS: Section[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], label: 'Command palette' },
      { keys: ['⌘', 'J'], label: 'Ask panel' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['g', 'h'], label: 'Go to feed' },
      { keys: ['g', 's'], label: 'Go to sources' },
      { keys: ['g', 'c'], label: 'Go to settings' },
      { keys: ['Esc'], label: 'Close / clear filters' }
    ]
  },
  {
    title: 'Feed',
    shortcuts: [
      { keys: ['j'], label: 'Next card' },
      { keys: ['k'], label: 'Previous card' },
      { keys: ['Enter'], label: 'Expand card' },
      { keys: ['y'], label: 'Copy cite key (obs#N)' },
      { keys: ['/'], label: 'Focus search' }
    ]
  },
  {
    title: 'Filters',
    shortcuts: [
      { keys: ['1', '..', '9'], label: 'Toggle top-N sources' },
      { keys: ['Shift', 'click'], label: 'Multi-select sources' },
      { keys: ['Esc'], label: 'Clear all filters' }
    ]
  }
];

export function KeyboardHelpModal({ isOpen, onClose }: KeyboardHelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="am-palette-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div
        className="am-palette"
        style={{ padding: 'var(--space-6)', maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-5)', color: 'var(--color-text-primary)' }}>
          Keyboard shortcuts
        </h2>
        <div className="am-help-grid">
          {SECTIONS.map((section) => (
            <React.Fragment key={section.title}>
              <h4>{section.title}</h4>
              {section.shortcuts.map((sc, i) => (
                <React.Fragment key={i}>
                  <KeyboardShortcut keys={sc.keys} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{sc.label}</span>
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
