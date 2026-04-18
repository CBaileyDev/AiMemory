import { useState, useEffect } from 'react';
import { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../constants/settings';
import { API_ENDPOINTS } from '../constants/api';
import { TIMING } from '../constants/timing';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    fetch(API_ENDPOINTS.SETTINGS)
      .then(res => res.json())
      .then(data => {
        // Preserve EVERY key the server returns (server may include keys
        // that predate or post-date the typed Settings interface, e.g.
        // CLAUDE_MEM_SEMANTIC_INJECT / CLAUDE_MEM_SEARCH_* introduced in
        // Phase 12). ?? (nullish coalescing) keeps falsy values like
        // '0', 'false', '' from being silently replaced with defaults.
        const merged: Record<string, string> = {};
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
          merged[k] = data[k] ?? v;
        }
        for (const [k, v] of Object.entries(data ?? {})) {
          if (!(k in merged) && typeof v === 'string') {
            merged[k] = v;
          }
        }
        setSettings(merged as Settings);
      })
      .catch(error => {
        console.error('Failed to load settings:', error);
      });
  }, []);

  const saveSettings = async (newSettings: Settings) => {
    setIsSaving(true);
    setSaveStatus('Saving...');

    const response = await fetch(API_ENDPOINTS.SETTINGS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });

    const result = await response.json();

    if (result.success) {
      setSettings(newSettings);
      setSaveStatus('✓ Saved');
      setTimeout(() => setSaveStatus(''), TIMING.SAVE_STATUS_DISPLAY_DURATION_MS);
    } else {
      setSaveStatus(`✗ Error: ${result.error}`);
    }

    setIsSaving(false);
  };

  return { settings, saveSettings, isSaving, saveStatus };
}
