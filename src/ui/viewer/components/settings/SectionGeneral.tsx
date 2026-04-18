import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SettingsField } from './SettingsField';
import { SECTION_GENERAL, sectionFields } from '../../state/settingsSchema';
import type { ValidationIssue } from '../../state/settingsSchema';
import { Stack } from '../primitives/Stack';

interface Props {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  issues: ValidationIssue[];
}

export function SectionGeneral({ values, onChange, issues }: Props) {
  const issueByKey = new Map(issues.map(i => [i.key, i]));
  const fields = sectionFields(SECTION_GENERAL);
  return (
    <SettingsSection id={SECTION_GENERAL.id} title={SECTION_GENERAL.title} description={SECTION_GENERAL.description}>
      <Stack gap="3">
        {fields.map(f => (
          <SettingsField
            key={f.id}
            field={f}
            value={values[String(f.key)] ?? ''}
            onChange={v => onChange(String(f.key), v)}
            issue={issueByKey.get(String(f.key)) ?? null}
          />
        ))}
      </Stack>
    </SettingsSection>
  );
}
