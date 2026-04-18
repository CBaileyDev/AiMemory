import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a local form state has diverged from the last saved baseline.
 *
 * Usage:
 *   const { isDirty, snapshot, reset } = useUnsavedChanges(current, baseline);
 *
 * - Call `reset(next)` after a successful save to adopt `next` as the new
 *   baseline.
 * - The hook installs a `beforeunload` handler while dirty so full page
 *   reloads prompt for confirmation.
 */
export function useUnsavedChanges<T>(current: T, baseline: T) {
  const baselineRef = useRef<T>(baseline);
  const [isDirty, setIsDirty] = useState(false);

  // Re-anchor baseline any time it changes upstream (e.g. initial load).
  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  useEffect(() => {
    setIsDirty(!shallowEqual(current, baselineRef.current));
  }, [current]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const reset = useCallback((next: T) => {
    baselineRef.current = next;
    setIsDirty(false);
  }, []);

  const snapshot = useCallback(() => baselineRef.current, []);

  return { isDirty, reset, snapshot };
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}
