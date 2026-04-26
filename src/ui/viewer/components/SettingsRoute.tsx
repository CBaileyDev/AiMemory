import React, { useMemo, useState } from 'react';
import { Icons } from './Icons';
import type { Settings } from '../types';

interface SettingsRouteProps {
  settings: Settings | null;
  scheme: string;
  onSchemeChange: (s: string) => void;
  onSave: (next: Settings) => Promise<unknown> | void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  detectedSources: string[];
  workerVersion: string;
  totals: { total: number; activeSources: number; totalSources: number } | null;
}

interface SectionKey {
  k: 'identity' | 'worker' | 'storage' | 'privacy' | 'search' | 'integrations' | 'keyboard' | 'diagnostics';
  l: string;
  i: React.ReactNode;
}

const SECTIONS: SectionKey[] = [
  { k: 'identity', l: 'Identity & theme', i: <Icons.Star size={14} /> },
  { k: 'worker', l: 'Worker & ports', i: <Icons.Pulse size={14} /> },
  { k: 'storage', l: 'Memory storage', i: <Icons.Database size={14} /> },
  { k: 'privacy', l: 'Privacy & redaction', i: <Icons.Shield size={14} /> },
  { k: 'search', l: 'Search & ranking', i: <Icons.Search size={14} /> },
  { k: 'integrations', l: 'Integrations', i: <Icons.Sources size={14} /> },
  { k: 'keyboard', l: 'Keyboard', i: <Icons.Cmd size={14} /> },
  { k: 'diagnostics', l: 'Diagnostics', i: <Icons.Bug size={14} /> }
];

export function SettingsRoute({
  settings,
  scheme,
  onSchemeChange,
  onSave,
  saveStatus,
  detectedSources,
  workerVersion,
  totals
}: SettingsRouteProps) {
  const [active, setActive] = useState<SectionKey['k']>('identity');
  const [draft, setDraft] = useState<Settings | null>(settings);
  const [reduceMotion, setReduceMotion] = useState(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Keep draft in sync if upstream settings change
  React.useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const isDirty = useMemo(() => {
    if (!draft || !settings) return false;
    return JSON.stringify(draft) !== JSON.stringify(settings);
  }, [draft, settings]);

  const update = (k: keyof Settings, v: string) => {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
  };

  const toggleStr = (k: keyof Settings) => {
    if (!draft) return;
    const cur = (draft as any)[k] === 'true';
    setDraft({ ...draft, [k]: cur ? 'false' : 'true' } as Settings);
  };

  const isOn = (k: keyof Settings, fallback = false) => {
    if (!draft) return fallback;
    const v = (draft as any)[k];
    if (v === undefined) return fallback;
    return v === 'true';
  };

  return (
    <div className="route">
      <div className="route-head">
        <h1 className="route-title">Settings</h1>
        <span className="route-sub mono">
          ~/.claude-mem/settings.json · {workerVersion}
          {totals && ` · ${totals.total.toLocaleString()} memories`}
        </span>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(s => (
            <button
              key={s.k}
              type="button"
              className={`nav-item ${active === s.k ? 'is-active' : ''}`}
              onClick={() => setActive(s.k)}
            >
              <span className="icon">{s.i}</span>
              <span className="nav-item-label">{s.l}</span>
            </button>
          ))}
        </nav>

        <div>
          {active === 'identity' && (
            <section className="settings-section">
              <h2>Identity & theme</h2>
              <p className="lede">
                Visual direction of the local viewer. Source colors stay constant across themes —
                only the brand accent retokenizes.
              </p>

              <FieldRow
                label="Accent scheme"
                help="Cyan Pulse is the default. Each option re-tokens only --cyan-* and the brand glow; semantic ok / warn / err stay the same."
              >
                <div className="swatchgroup">
                  <button
                    type="button"
                    title="Cyan Pulse"
                    className={scheme === 'cyan' || scheme === 'default' ? 'is-active' : ''}
                    onClick={() => onSchemeChange('cyan')}
                    style={{ background: 'linear-gradient(135deg, #5fe2ff, #0e7490)' }}
                  />
                  <button
                    type="button"
                    title="Violet"
                    className={scheme === 'violet' ? 'is-active' : ''}
                    onClick={() => onSchemeChange('violet')}
                    style={{ background: 'linear-gradient(135deg, #c084fc, #6d28d9)' }}
                  />
                  <button
                    type="button"
                    title="Neon Matrix"
                    className={scheme === 'matrix' ? 'is-active' : ''}
                    onClick={() => onSchemeChange('matrix')}
                    style={{ background: 'linear-gradient(135deg, #4ade80, #047857)' }}
                  />
                </div>
                <div className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  active: {scheme}
                </div>
              </FieldRow>

              <FieldRow
                label="Reduced motion"
                help="Disables the live pulse, scanline, and ring-in animations. Honors OS-level prefers-reduced-motion automatically."
              >
                <button
                  type="button"
                  className={`toggle ${reduceMotion ? 'on' : ''}`}
                  aria-pressed={reduceMotion}
                  onClick={() => setReduceMotion(v => !v)}
                />
              </FieldRow>

              <FieldRow label="Density" help="Compact reduces row height and metadata padding.">
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn">
                    Comfortable
                  </button>
                  <button type="button" className="btn ghost">
                    Compact
                  </button>
                </div>
              </FieldRow>
            </section>
          )}

          {active === 'worker' && (
            <section className="settings-section">
              <h2>Worker & ports</h2>
              <p className="lede">The local worker daemon. Bound to 127.0.0.1 only.</p>

              <FieldRow label="Listen port" help="Default 37777. Restart required.">
                <input
                  className="input"
                  style={{ width: 120 }}
                  value={draft?.CLAUDE_MEM_WORKER_PORT ?? '37777'}
                  onChange={e => update('CLAUDE_MEM_WORKER_PORT', e.target.value)}
                />
              </FieldRow>

              <FieldRow
                label="Bind host"
                help="Use 127.0.0.1 to keep the worker private to your machine."
              >
                <input
                  className="input"
                  style={{ width: 220 }}
                  value={draft?.CLAUDE_MEM_WORKER_HOST ?? '127.0.0.1'}
                  onChange={e => update('CLAUDE_MEM_WORKER_HOST', e.target.value)}
                />
              </FieldRow>

              <FieldRow
                label="Compression model"
                help="The Anthropic model the worker calls to compress observations."
              >
                <input
                  className="input"
                  style={{ width: 280 }}
                  value={draft?.CLAUDE_MEM_MODEL ?? ''}
                  onChange={e => update('CLAUDE_MEM_MODEL', e.target.value)}
                  placeholder="claude-sonnet-4-6"
                />
              </FieldRow>

              <FieldRow
                label="Context observations"
                help="How many recent observations to pull into each session start prompt."
              >
                <input
                  className="input"
                  style={{ width: 120 }}
                  value={draft?.CLAUDE_MEM_CONTEXT_OBSERVATIONS ?? '40'}
                  onChange={e => update('CLAUDE_MEM_CONTEXT_OBSERVATIONS', e.target.value)}
                />
              </FieldRow>
            </section>
          )}

          {active === 'storage' && (
            <section className="settings-section">
              <h2>Storage</h2>
              <p className="lede">SQLite + FTS5 on disk. No remote calls.</p>
              <FieldRow label="Database path" help="Bun's bun:sqlite driver.">
                <div className="code">
                  ~/.claude-mem/<span className="k">claude-mem.db</span>{' '}
                  <span className="c">— {totals?.total.toLocaleString() ?? '—'} rows</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button type="button" className="btn">
                    <Icons.Refresh size={12} /> Run vacuum
                  </button>
                  <button type="button" className="btn ghost">
                    Export snapshot
                  </button>
                  <button type="button" className="btn ghost" style={{ color: 'var(--err)' }}>
                    Reset…
                  </button>
                </div>
              </FieldRow>
            </section>
          )}

          {active === 'privacy' && (
            <section className="settings-section">
              <h2>Privacy & redaction</h2>
              <p className="lede">
                All redaction happens at the hook layer, before anything is written to SQLite or
                Chroma.
              </p>
              <FieldRow
                label="Redaction tag"
                help="Anything wrapped is stripped before the worker sees it."
              >
                <div className="code">
                  <span className="c">{'// in any prompt or file'}</span>
                  {'\n'}
                  &lt;<span className="k">private</span>&gt;your secret here&lt;/
                  <span className="k">private</span>&gt;
                </div>
              </FieldRow>
              <FieldRow
                label="Auto-redact patterns"
                help="Regexes applied at hook ingest. One per line."
              >
                <div className="code">
                  {'sk-[a-zA-Z0-9]{20,}    '}
                  <span className="c"># API keys</span>
                  {'\nghp_[a-zA-Z0-9]{36}     '}
                  <span className="c"># GH tokens</span>
                  {'\n[a-z0-9._%+-]+@[a-z0-9.-]+ '}
                  <span className="c"># emails</span>
                </div>
              </FieldRow>
            </section>
          )}

          {active === 'search' && (
            <section className="settings-section">
              <h2>Search & ranking</h2>
              <p className="lede">FTS5 with BM25 reranking and recency decay.</p>
              <FieldRow label="Project default" help="Project filter applied on first load.">
                <input className="input" style={{ width: 280 }} placeholder="all" disabled />
              </FieldRow>
              <FieldRow
                label="Vector mirroring"
                help="Mirrors observations into Chroma for semantic search."
              >
                <button
                  type="button"
                  className={`toggle ${isOn('CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY' as any, true) ? 'on' : ''}`}
                  aria-pressed
                  onClick={() => toggleStr('CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY' as any)}
                />
                <div className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  enabled — Chroma at ~/.claude-mem/chroma/
                </div>
              </FieldRow>
            </section>
          )}

          {active === 'integrations' && (
            <section className="settings-section">
              <h2>Integrations</h2>
              <p className="lede">Sources currently detected on this machine.</p>
              <FieldRow
                label="Detected"
                help="Hook installers run during claude-mem install. Re-run via Doctor to refresh."
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {detectedSources.length === 0 && (
                    <span className="muted" style={{ fontSize: 13 }}>
                      No sources reported. Try{' '}
                      <span className="mono">claude-mem doctor</span>.
                    </span>
                  )}
                  {detectedSources.map(s => (
                    <span key={s} className="chip" style={{ height: 24 }}>
                      <Icons.Sources size={11} /> {s}
                    </span>
                  ))}
                </div>
              </FieldRow>
            </section>
          )}

          {active === 'keyboard' && (
            <section className="settings-section">
              <h2>Keyboard</h2>
              <p className="lede">Global shortcuts. All actions are also keyboard-reachable from
                the command palette.</p>
              <FieldRow label="Open command palette" help="From anywhere, scopes default to memory.">
                <span>
                  <span className="kbd">⌘</span> <span className="kbd">K</span>
                </span>
              </FieldRow>
              <FieldRow label="Toggle worker console" help="Drawer at the bottom of the viewport.">
                <span>
                  <span className="kbd">⌘</span> <span className="kbd">\</span>
                </span>
              </FieldRow>
              <FieldRow label="Quick navigation" help="Tap g then a route key.">
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>
                    <span className="kbd">g</span> <span className="kbd">h</span> feed
                  </span>
                  <span>
                    <span className="kbd">g</span> <span className="kbd">v</span> graph
                  </span>
                  <span>
                    <span className="kbd">g</span> <span className="kbd">s</span> sources
                  </span>
                  <span>
                    <span className="kbd">g</span> <span className="kbd">c</span> settings
                  </span>
                </span>
              </FieldRow>
            </section>
          )}

          {active === 'diagnostics' && (
            <section className="settings-section">
              <h2>Diagnostics</h2>
              <p className="lede">Quick health snapshot.</p>
              <FieldRow label="Version" help="Plugin and worker version pinned together.">
                <span className="mono">{workerVersion}</span>
              </FieldRow>
              <FieldRow label="Sources detected" help="Hook installers report at startup.">
                <span className="mono">
                  {totals?.activeSources ?? 0} / {totals?.totalSources ?? 0}
                </span>
              </FieldRow>
              <FieldRow label="Run doctor" help="Surfaces any port mismatch or missing hooks.">
                <button type="button" className="btn">
                  <Icons.Bug size={12} /> claude-mem doctor
                </button>
              </FieldRow>
            </section>
          )}

          {isDirty && draft && (
            <div
              style={{
                position: 'sticky',
                bottom: 0,
                marginTop: 24,
                padding: '12px 16px',
                background: 'var(--bg-2)',
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--r-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: 'var(--shadow-2)'
              }}
            >
              <span style={{ flex: 1, fontSize: 13 }}>
                {saveStatus === 'saving'
                  ? 'Saving…'
                  : saveStatus === 'error'
                    ? 'Save failed — retry?'
                    : 'You have unsaved changes.'}
              </span>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDraft(settings)}
                disabled={saveStatus === 'saving'}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => onSave(draft)}
                disabled={saveStatus === 'saving'}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  help,
  children
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field-row">
      <div>
        <div className="field-label">{label}</div>
        {help && <div className="field-help">{help}</div>}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}
