import React from 'react';
import { SettingsSection, SettingsGroup } from './SettingsSection';
import { SettingsField } from './SettingsField';
import { SECTION_CONTEXT } from '../../state/settingsSchema';
import type { SettingsField as FieldDef, ValidationIssue } from '../../state/settingsSchema';
import { Stack } from '../primitives/Stack';
import { Panel } from '../primitives/Panel';
import { useContextPreview } from '../../hooks/useContextPreview';
import { TerminalPreview } from '../TerminalPreview';
import type { Settings } from '../../types';

interface Props {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  issues: ValidationIssue[];
  settings: Settings;
}

function isFieldVisible(f: FieldDef, values: Record<string, string>): boolean {
  if (f.visibleWhen) {
    const depVal = values[String(f.visibleWhen.key)] ?? '';
    if (depVal !== f.visibleWhen.equals) return false;
  }
  if (f.visibleWhenIn) {
    const depVal = values[String(f.visibleWhenIn.key)] ?? '';
    if (!f.visibleWhenIn.in.includes(depVal)) return false;
  }
  return true;
}

export function SectionContextInjection({ values, onChange, issues, settings }: Props) {
  const issueByKey = new Map(issues.map(i => [i.key, i]));
  const {
    preview,
    isLoading,
    error,
    projects,
    sources,
    selectedSource,
    setSelectedSource,
    selectedProject,
    setSelectedProject
  } = useContextPreview(settings);

  return (
    <SettingsSection
      id={SECTION_CONTEXT.id}
      title={SECTION_CONTEXT.title}
      description={SECTION_CONTEXT.description}
    >
      <Stack gap="5">
        {(SECTION_CONTEXT.groups ?? []).map(group => (
          <SettingsGroup
            key={group.id}
            id={group.id}
            title={group.title}
            description={group.description}
          >
            {group.fields.filter(f => isFieldVisible(f, values)).map(f => (
              <SettingsField
                key={f.id}
                field={f}
                value={values[String(f.key)] ?? ''}
                onChange={v => onChange(String(f.key), v)}
                issue={issueByKey.get(String(f.key)) ?? null}
              />
            ))}
          </SettingsGroup>
        ))}

        <Panel elevation={0} padding="3" radius="md" style={{ overflow: 'hidden' }}>
          <Stack gap="2">
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Live preview
            </div>

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                flexWrap: 'wrap'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                Source
                <select
                  value={selectedSource || ''}
                  onChange={e => setSelectedSource(e.target.value)}
                  disabled={sources.length === 0}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-primary)',
                    background: 'var(--color-bg-input)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-xs)'
                  }}
                >
                  {sources.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                  flex: 1,
                  minWidth: '200px'
                }}
              >
                Project
                <select
                  value={selectedProject || ''}
                  onChange={e => setSelectedProject(e.target.value)}
                  disabled={projects.length === 0}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-primary)',
                    background: 'var(--color-bg-input)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-xs)'
                  }}
                >
                  {projects.map(project => (
                    <option key={project} value={project}>{project}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ height: '280px', position: 'relative' }}>
              {error ? (
                <div style={{ color: 'var(--accent-error)', fontSize: 'var(--text-sm)' }}>
                  Error loading preview: {error}
                </div>
              ) : (
                <TerminalPreview content={preview} isLoading={isLoading} />
              )}
            </div>
          </Stack>
        </Panel>
      </Stack>
    </SettingsSection>
  );
}
