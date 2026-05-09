import { useEffect, useState } from 'react';
import type { AppPreferences } from '@shared/types';

/**
 * Tiny preferences store. Loads on mount, persists on every patch.
 * No race control beyond "last write wins" — fine for a single Settings window.
 */
export function usePreferences() {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);

  useEffect(() => {
    void window.snapora.preferences.get().then(setPrefs);
  }, []);

  const update = async <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    const next = await window.snapora.preferences.set({ [key]: value } as Partial<AppPreferences>);
    setPrefs(next);
  };

  return { prefs, update };
}
