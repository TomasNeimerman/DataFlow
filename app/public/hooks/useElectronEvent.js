import { useEffect } from 'react';

export function useElectronEvent(channel, handler) {
  useEffect(() => {
    if (window?.api?.on) {
      window.api.on(channel, handler);
      return () => window.api.off?.(channel, handler);
    }
    // Fallback a eventos del DOM
    const h = (e) => handler(e.detail);
    window.addEventListener(channel, h);
    return () => window.removeEventListener(channel, h);
  }, [channel, handler]);
}