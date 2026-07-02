import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type HotelSettings } from "../lib/api";

type SettingsContextValue = {
  settings: HotelSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch {
      // ignore — fall back to defaults in the UI
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return <SettingsContext.Provider value={{ settings, loading, refresh }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
