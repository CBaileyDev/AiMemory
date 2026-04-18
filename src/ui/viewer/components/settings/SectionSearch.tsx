import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SettingsField } from './SettingsField';
import { SECTION_SEARCH, sectionFields } from '../../state/settingsSchema';
import type { ValidationIssue } from '../../state/settingsSchema';
import { Stack } from '../primitives/Stack';

interface Props {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  issues: ValidationIssue[];
}

export function SectionSearch({ values, onChange, issues }: Props) {
  const issueByKey = new Map(issues.map(i => [i.key, i]));
  const fields = sectionFields(SECTION_SEARCH);
  return (
    <SettingsSection id={SECTION_SEARCH.id} title={SECTION_SEARCH.title} description={SECTION_SEARCH.description}>
      <Stack gap="3">
        {fields.map(f => {
          if (f.visibleWhen) {
            const depVal = values[String(f.visibleWhen.key)] ?? '';
            if (depVal !== f.visibleWhen.equals) return null;
          }
          return (
            <SettingsField
              key={f.id}
              field={f}
              value={values[String(f.key)] ?? ''}
              onChange={v => onChange(String(f.key), v)}
              issue={issueByKey.get(String(f.key)) ?? null}
            />
          );
        })}
      </Stack>
    </SettingsSection>
  );
}
