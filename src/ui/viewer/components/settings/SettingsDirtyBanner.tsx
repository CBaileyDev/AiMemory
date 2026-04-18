import React from 'react';
import { Button } from '../primitives/Button';
import { Row } from '../primitives/Row';

interface SettingsDirtyBannerProps {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
  saveStatus: string;
}

/**
 * Sticky banner at the top of the settings page that appears when the form
 * has diverged from the last saved snapshot. Announces itself via
 * role="status" so assistive tech hears the state change.
 */
export function SettingsDirtyBanner({
  visible,
  onSave,
  onDiscard,
  isSaving,
  saveStatus
}: SettingsDirtyBannerProps) {
  const tone = saveStatus.startsWith('✗') ? 'error' : 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className="am-settings-dirty-banner"
      data-visible={visible || !!saveStatus}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: visible
          ? 'var(--accent-primary-soft)'
          : tone === 'error'
            ? 'rgb(239 68 68 / 12%)'
            : 'rgb(16 185 129 / 12%)',
        border: `1px solid ${visible
          ? 'var(--accent-primary)'
          : tone === 'error'
            ? 'var(--accent-error)'
            : 'var(--accent-success)'}`,
        color: visible
          ? 'var(--accent-primary)'
          : tone === 'error'
            ? 'var(--accent-error)'
            : 'var(--accent-success)',
        display: visible || saveStatus ? 'block' : 'none'
      }}
    >
      <Row gap="3" align="center" justify="space-between" wrap>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          {visible
            ? 'Unsaved changes — save to persist, or discard to revert.'
            : saveStatus || ''}
        </span>
        {visible && (
          <Row gap="2" align="center">
            <Button variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving}>
              Discard
            </Button>
            <Button variant="primary" size="sm" onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </Row>
        )}
      </Row>
    </div>
  );
}
