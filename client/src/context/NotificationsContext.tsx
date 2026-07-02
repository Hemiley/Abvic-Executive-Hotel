import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Notification } from "../lib/api";

type NotificationsContextValue = {
  notifications: Notification[];
  unread: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reload: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(() => {
    api.getNotifications().then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => api.markNotificationRead(n.id)));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [notifications]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unread, markRead, markAllRead, reload: load }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
