/**
 * SettingsPage — sectioned settings UI.
 *
 * Left nav + scrollable
 * right pane. All writes go through useSettings, same hook the legacy
 * modal used. Dirty-state is tracked locally and gates navigation.
 */

import React from 'react';
import type { Settings } from '../../types';
import type { NeonScheme } from '../../hooks/useTheme';
import { SETTINGS_SECTIONS, sectionFields, validateAll } from '../../state/settingsSchema';
import type { ValidationIssue, SettingsSectionDef } from '../../state/settingsSchema';
import { SectionGeneral } from './SectionGeneral';
import { SectionSources } from './SectionSources';
import { SectionSearch } from './SectionSearch';
import { SectionContextInjection } from './SectionContextInjection';
import { SectionPrivacy } from './SectionPrivacy';
import { SectionMcp } from './SectionMcp';
import { SectionAbout } from './SectionAbout';
import { SettingsDirtyBanner } from './SettingsDirtyBanner';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { Row } from '../primitives/Row';
import { Stack } from '../primitives/Stack';
import { Panel } from '../primitives/Panel';
import { IconButton } from '../primitives/IconButton';

interface SettingsPageProps {
  /** Current settings from useSettings. */
  settings: Settings;
  /** Commits to `/api/settings` and updates useSettings state. */
  onSave: (next: Settings) => void;
  isSaving: boolean;
  saveStatus: string;
  /** Appearance / color scheme (General section — not persisted in settings file). */
  scheme: NeonScheme;
  onSchemeChange: (t: NeonScheme) => void;
  /** Full-page route vs modal overlay. */
  variant?: 'modal' | 'page';
  /** Catalog of source ids detected in the live SSE stream. */
  detectedSources: string[];
  /** Invoked when the user explicitly closes the settings surface. */
  onClose: () => void;
}

type SourcesBlock = Record<string, Record<string, unknown>>;
type FormState = Record<string, string> & { __theme: string; __sources: SourcesBlock };

function toFormState(settings: Settings, schemeUi: string, sources: SourcesBlock): FormState {
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (v === undefined || v === null) continue;
    base[k] = String(v);
  }

  // Seed any schema-declared defaults for fields whose key is missing in the
  // settings file. Protects first-run users from being blocked by validation
  // on newly added keys like CLAUDE_MEM_SEARCH_*.
  for (const section of SETTINGS_SECTIONS) {
    for (const field of sectionFields(section)) {
      const key = String(field.key);
      if (key.startsWith('__')) continue;
      if (base[key] === undefined || base[key] === '') {
        if (field.defaultValue !== undefined) base[key] = field.defaultValue;
      }
    }
  }

  return { ...base, __theme: schemeUi, __sources: sources } as FormState;
}

function extractSourcesBlockFromSettings(raw: Record<string, unknown>): SourcesBlock {
  // The server stores the full settings.json verbatim; a top-level `sources`
  // key is honored, nested under whatever shape the adapters produce.
  const v = raw['sources'];
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as SourcesBlock;
  return {};
}

export function SettingsPage(props: SettingsPageProps) {
  const { settings, onSave, isSaving, saveStatus, scheme, onSchemeChange, detectedSources, onClose, variant = 'modal' } = props;

  // Fetch the raw settings file once to pick up the `sources` block that
  // isn't included in the Settings TS type. Posts back the merged object
  // with both the TS-typed keys and the `sources` block.
  const [rawSettings, setRawSettings] = React.useState<Record<string, unknown>>({});
  React.useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === 'object') setRawSettings(data as Record<string, unknown>);
      })
      .catch(() => {
        /* non-fatal; sources section will render with empty block */
      });
  }, []);

  const sourcesBaseline = React.useMemo(() => extractSourcesBlockFromSettings(rawSettings), [rawSettings]);

  const baseline = React.useMemo<FormState>(
    () => toFormState(settings, scheme, sourcesBaseline),
    [settings, scheme, sourcesBaseline]
  );
  const [formState, setFormState] = React.useState<FormState>(baseline);

  // Re-seed local state whenever baseline changes upstream.
  React.useEffect(() => {
    setFormState(baseline);
  }, [baseline]);

  const { isDirty, reset } = useUnsavedChanges<FormState>(formState, baseline);

  const setValue = React.useCallback((key: string, value: string) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const setSources = React.useCallback((next: SourcesBlock) => {
    setFormState(prev => ({ ...prev, __sources: next } as FormState));
  }, []);

  // Run validation across every schema field on every form change.
  const issues = React.useMemo<ValidationIssue[]>(() => {
    const fields = SETTINGS_SECTIONS.flatMap(sectionFields).filter(f => f.key !== '__theme');
    return validateAll(fields, formState as unknown as Record<string, unknown>);
  }, [formState]);

  const hasErrors = issues.length > 0;

  // Active section for left-nav highlighting (via IntersectionObserver).
  const [activeId, setActiveId] = React.useState<string>(SETTINGS_SECTIONS[0].id);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.sectionId;
            if (id) setActiveId(id);
          }
        }
      },
      { root, rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );
    const sections = root.querySelectorAll<HTMLElement>('[data-section-id]');
    sections.forEach((section: HTMLElement) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const handleSectionNavClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const target = scrollerRef.current?.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  // Escape → attempt to close. If dirty, confirm first.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isDirty) {
        const ok = window.confirm('Discard unsaved settings changes?');
        if (!ok) return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDirty, onClose]);

  const handleSave = () => {
    if (hasErrors) return;

    // Persist appearance locally (not in the settings file).
    if (formState.__theme && formState.__theme !== scheme) {
      onSchemeChange(formState.__theme as NeonScheme);
    }

    const nextSettings: Record<string, string> = { ...(settings as unknown as Record<string, string>) };
    for (const key of Object.keys(nextSettings)) {
      const v = formState[key];
      if (v !== undefined) {
        nextSettings[key] = v;
      }
    }

    // Tack the `sources` block onto the POST body — the server writes
    // any JSON-valid keys, and `sources` is recognized by the adapters.
    const merged: Record<string, unknown> = { ...nextSettings };
    if (formState.__sources && Object.keys(formState.__sources).length > 0) {
      merged.sources = formState.__sources;
    }

    onSave(merged as unknown as Settings);

    // Reset baseline tracking to the snapshot we just sent.
    reset(formState);
  };

  const handleDiscard = () => {
    setFormState(baseline);
    reset(baseline);
  };

  const isPage = variant === 'page';

  return (
    <div
      className={`am-settings-page${isPage ? ' am-settings-page--page' : ''}`}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : true}
      aria-labelledby="am-settings-title"
      style={
        isPage
          ? {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--color-bg-primary)'
            }
          : {
              position: 'fixed',
              inset: 0,
              background: 'var(--color-bg-backdrop)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column'
            }
      }
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          margin: isPage ? 0 : 'var(--space-5) auto',
          width: isPage ? '100%' : 'min(1100px, 96vw)',
          maxHeight: isPage ? 'none' : '92vh',
          background: 'var(--color-bg-primary)',
          borderRadius: isPage ? 0 : 'var(--radius-lg)',
          boxShadow: isPage ? 'none' : 'var(--elev-3)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <Row
          gap="3"
          align="center"
          justify="space-between"
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border-primary)',
            background: 'var(--color-bg-header)'
          }}
        >
          <h1
            id="am-settings-title"
            style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-text-title)', fontWeight: 700 }}
          >
            Settings
          </h1>
          <IconButton label="Close settings (Esc)" onClick={onClose} variant="ghost">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </Row>

        {/* Body: left nav + right scroller */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <nav
            aria-label="Settings sections"
            style={{
              flex: '0 0 240px',
              padding: 'var(--space-4)',
              borderRight: '1px solid var(--color-border-primary)',
              background: 'var(--color-bg-secondary)',
              overflowY: 'auto'
            }}
          >
            <Stack gap="1" as="ul" style={{ margin: 0, padding: 0, listStyle: 'none' } as React.CSSProperties}>
              {SETTINGS_SECTIONS.map((s: SettingsSectionDef) => {
                const active = activeId === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#settings-section-${s.id}`}
                      onClick={handleSectionNavClick(s.id)}
                      aria-current={active ? 'page' : undefined}
                      style={{
                        display: 'block',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: active ? 600 : 500,
                        color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                        background: active ? 'var(--accent-primary-soft)' : 'transparent',
                        textDecoration: 'none',
                        transition: `background var(--motion-ui) var(--ease-out), color var(--motion-ui) var(--ease-out)`
                      }}
                    >
                      {s.title}
                    </a>
                  </li>
                );
              })}
            </Stack>
          </nav>

          <div
            ref={scrollerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 'var(--space-5) var(--space-6)'
            }}
          >
            <SettingsDirtyBanner
              visible={isDirty}
              onSave={handleSave}
              onDiscard={handleDiscard}
              isSaving={isSaving}
              saveStatus={saveStatus}
            />

            {hasErrors && (
              <Panel elevation={0} padding="3" radius="md" style={{ marginBottom: 'var(--space-4)', borderLeft: `3px solid var(--accent-error)` }}>
                <Row gap="2" align="center" wrap>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-error)' }}>
                    {issues.length} validation {issues.length === 1 ? 'issue' : 'issues'}
                  </strong>
                  <small style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    Save is disabled until every field is valid.
                  </small>
                </Row>
              </Panel>
            )}

            <Stack gap="5" data-testid="settings-sections">
              <div data-section-id="general" style={{ scrollMarginTop: 'var(--space-9)' }}>
                <SectionGeneral values={formState} onChange={setValue} issues={issues} />
              </div>
              <div data-section-id="sources" style={{ scrollMarginTop: 'var(--space-9)' }}>
                <SectionSources
                  sources={formState.__sources}
                  onChange={setSources}
                  detectedSourceIds={detectedSources}
                />
              </div>
              <div data-section-id="search" style={{ scrollMarginTop: 'var(--space-9)' }}>
                <SectionSearch values={formState} onChange={setValue} issues={issues} />
              </div>
              <div data-section-id="context-injection" style={{ scrollMarginTop: 'var(--space-9)' }}>
                <SectionContextInjection
                  values={formState}
                  onChange={setValue}
                  issues={issues}
                  settings={settings}
                />
              </div>
              <div data-section-id="privacy" style={{ scrollMarginTop: 'var(--space-9)' }}>
                <SectionPrivacy values={formState} onChange={setValue} issues={issues} />
              </div>
              <div data-section-id="mcp" style={{ scrollMarginTop: 'var(--space-9)' }}>
                <SectionMcp />
              </div>
              <div data-section-id="about" style={{ scrollMarginTop: 'var(--space-9)' }}>
                <SectionAbout />
              </div>
            </Stack>
          </div>
        </div>
      </div>
    </div>
  );
}
