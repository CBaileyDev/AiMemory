import React from 'react';
import type { SettingsField as Field, ValidationIssue } from '../../state/settingsSchema';
import { Row } from '../primitives/Row';
import { Stack } from '../primitives/Stack';

interface SettingsFieldProps {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  issue?: ValidationIssue | null;
  disabled?: boolean;
}

/**
 * Labeled field wrapper. Renders the appropriate control based on `field.kind`
 * and emits changes through a single onChange callback. Inline hint text —
 * never a tooltip — keeps visibility high on every field.
 */
export function SettingsField({ field, value, onChange, issue, disabled }: SettingsFieldProps) {
  const inputId = field.id;
  const hintId = field.hint ? `${field.id}-hint` : undefined;
  const errorId = issue ? `${field.id}-error` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // Controls shared style + layout.
  const control = renderControl({
    field,
    value,
    onChange,
    inputId,
    disabled: Boolean(disabled),
    describedBy,
    invalid: Boolean(issue)
  });

  return (
    <Stack gap="1" className="am-settings-field" data-field-id={field.id}>
      <Row gap="3" align="center" justify="space-between" wrap>
        <label
          htmlFor={inputId}
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.3
          }}
        >
          {field.label}
        </label>

        {field.kind === 'toggle' ? (
          <span>{control}</span>
        ) : (
          <span style={{ flex: 1, maxWidth: 'min(420px, 65%)', minWidth: '160px' }}>{control}</span>
        )}
      </Row>

      {field.hint && (
        <small
          id={hintId}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            lineHeight: 1.45
          }}
        >
          {field.hint}
        </small>
      )}
      {issue && (
        <small
          id={errorId}
          role="alert"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--accent-error)',
            lineHeight: 1.45
          }}
        >
          {issue.message}
        </small>
      )}
    </Stack>
  );
}

function renderControl(args: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  inputId: string;
  disabled: boolean;
  describedBy?: string;
  invalid: boolean;
}) {
  const { field, value, onChange, inputId, disabled, describedBy, invalid } = args;
  const commonInput: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${invalid ? 'var(--accent-error)' : 'var(--color-border-primary)'}`,
    background: 'var(--color-bg-input)',
    color: 'var(--color-text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'inherit',
    lineHeight: 1.4
  };

  switch (field.kind) {
    case 'text':
    case 'password':
    case 'number':
      return (
        <input
          id={inputId}
          type={field.kind}
          value={value}
          placeholder={field.placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          {...(field.kind === 'number' && field.number
            ? {
                min: field.number.min,
                max: field.number.max,
                step: field.number.step
              }
            : {})}
          onChange={e => onChange(e.target.value)}
          style={commonInput}
        />
      );

    case 'textarea':
      return (
        <textarea
          id={inputId}
          value={value}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={field.multiline?.rows ?? 3}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={e => onChange(e.target.value)}
          style={{
            ...commonInput,
            fontFamily: 'var(--font-mono)',
            resize: 'vertical'
          }}
        />
      );

    case 'select':
      return (
        <select
          id={inputId}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={e => onChange(e.target.value)}
          style={commonInput}
        >
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case 'toggle': {
      const on = value === 'true';
      return (
        <button
          id={inputId}
          type="button"
          role="switch"
          aria-checked={on}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => onChange(on ? 'false' : 'true')}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            width: '40px',
            height: '22px',
            padding: '2px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-border-primary)',
            background: on ? 'var(--accent-primary)' : 'var(--color-bg-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: `background var(--motion-ui) var(--ease-out)`
          }}
        >
          <span
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'var(--color-bg-card)',
              boxShadow: 'var(--elev-1)',
              transform: on ? 'translateX(18px)' : 'translateX(0)',
              transition: `transform var(--motion-ui) var(--ease-out)`
            }}
          />
        </button>
      );
    }
  }
}
