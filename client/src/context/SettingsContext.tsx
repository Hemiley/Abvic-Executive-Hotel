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

  // Apply background + visual settings as CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    // Remove the old direct body.style.background so ::before takes over
    document.body.style.background = "";

    if (settings?.backgroundStyle) {
      root.style.setProperty("--bg-custom", settings.backgroundStyle);
    } else {
      root.style.removeProperty("--bg-custom");
    }

    const opacity = settings?.bgOpacity != null ? parseFloat(settings.bgOpacity) : 1;
    root.style.setProperty("--bg-opacity", String(opacity));
    root.style.setProperty("--bg-blur", `${settings?.bgBlur ?? 0}px`);

    if (settings?.fontColor) {
      root.style.setProperty("--ui-font-color", settings.fontColor);
    } else {
      root.style.removeProperty("--ui-font-color");
    }

    if (settings?.fontSize) {
      root.style.setProperty("--ui-font-size", `${settings.fontSize}px`);
    } else {
      root.style.removeProperty("--ui-font-size");
    }
  }, [settings?.backgroundStyle, settings?.bgOpacity, settings?.bgBlur, settings?.fontColor, settings?.fontSize]);

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
