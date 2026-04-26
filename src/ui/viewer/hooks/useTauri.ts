import { useEffect, useState } from 'react';

export type DesktopPlatform = 'mac' | 'win' | 'linux' | 'web';

interface TauriRuntime {
  isTauri: boolean;
  platform: DesktopPlatform;
}

function detectPlatform(): DesktopPlatform {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform || navigator.platform || '';
  const haystack = `${platform} ${ua}`.toLowerCase();
  if (haystack.includes('mac')) return 'mac';
  if (haystack.includes('win')) return 'win';
  if (haystack.includes('linux') || haystack.includes('x11')) return 'linux';
  return 'web';
}

function detectTauri(): boolean {
  if (typeof window === 'undefined') return false;
  // Tauri 2 injects __TAURI_INTERNALS__ before the document loads. The
  // legacy __TAURI__ global is also present when withGlobalTauri is on.
  const w = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

export function useTauri(): TauriRuntime {
  const [runtime] = useState<TauriRuntime>(() => ({
    isTauri: detectTauri(),
    platform: detectPlatform()
  }));

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (runtime.isTauri) html.dataset.tauri = 'true';
    html.dataset.platform = runtime.platform;
  }, [runtime.isTauri, runtime.platform]);

  return runtime;
}

interface TauriWindowApi {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  close: () => Promise<void>;
  startDragging: () => Promise<void>;
  onResized: (cb: () => void) => Promise<() => void>;
}

interface TauriEventApi {
  listen: <T>(event: string, cb: (payload: T) => void) => Promise<() => void>;
}

function tauriGlobals():
  | { window: TauriWindowApi; event: TauriEventApi }
  | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    __TAURI__?: {
      window?: { getCurrentWindow?: () => unknown };
      event?: { listen?: unknown };
    };
  };
  const api = w.__TAURI__;
  if (!api?.window?.getCurrentWindow || !api.event?.listen) return null;

  const current = api.window.getCurrentWindow() as {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    close: () => Promise<void>;
    startDragging: () => Promise<void>;
    onResized: (cb: () => void) => Promise<() => void>;
  };

  return {
    window: {
      minimize: () => current.minimize(),
      toggleMaximize: () => current.toggleMaximize(),
      isMaximized: () => current.isMaximized(),
      close: () => current.close(),
      startDragging: () => current.startDragging(),
      onResized: (cb) => current.onResized(cb)
    },
    event: {
      listen: <T,>(event: string, cb: (payload: T) => void) => {
        const listenFn = api.event!.listen as <P>(
          name: string,
          handler: (event: { payload: P }) => void
        ) => Promise<() => void>;
        return listenFn<T>(event, (e) => cb(e.payload));
      }
    }
  };
}

export function useMaximizedState(isTauri: boolean): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    const api = tauriGlobals();
    if (!api) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    api.window
      .isMaximized()
      .then((v) => {
        if (!cancelled) setMaximized(v);
      })
      .catch(() => {});

    api.window
      .onResized(() => {
        api.window
          .isMaximized()
          .then((v) => {
            if (!cancelled) setMaximized(v);
          })
          .catch(() => {});
      })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else cleanup = unlisten;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isTauri]);

  return maximized;
}

export const tauri = {
  minimize: () => tauriGlobals()?.window.minimize(),
  toggleMaximize: () => tauriGlobals()?.window.toggleMaximize(),
  close: () => tauriGlobals()?.window.close(),
  listen: <T,>(event: string, cb: (payload: T) => void) =>
    tauriGlobals()?.event.listen(event, cb) ?? Promise.resolve(() => {})
};
