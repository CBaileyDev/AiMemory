import { useState, useEffect } from 'react';
import { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../constants/settings';
import { API_ENDPOINTS } from '../constants/api';
import { TIMING } from '../constants/timing';

type SettingsPayload = Record<string, unknown>;

interface SaveSettingsResponse {
  success: boolean;
  error?: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch(API_ENDPOINTS.SETTINGS)
      .then(res => res.json())
      .then(raw => {
        if (cancelled) return;

        const data = raw as unknown as SettingsPayload;

        // Preserve EVERY key the server returns (server may include keys
        // that predate or post-date the typed Settings interface).
        // ?? (nullish coalescing) keeps falsy values like
        // '0', 'false', '' from being silently replaced with defaults.
        const merged: Record<string, string> = {};
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
          const serverValue = data[k];
          merged[k] = typeof serverValue === 'string' ? serverValue : v;
        }
        for (const [k, v] of Object.entries(data ?? {})) {
          if (!(k in merged) && typeof v === 'string') {
            merged[k] = v;
          }
        }
        setSettings(merged as unknown as Settings);
      })
      .catch(error => {
        console.error('Failed to load settings:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = async (newSettings: Settings) => {
    setIsSaving(true);
    setSaveStatus('Saving...');

    const response = await fetch(API_ENDPOINTS.SETTINGS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });

    const result = (await response.json()) as unknown as SaveSettingsResponse;

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
