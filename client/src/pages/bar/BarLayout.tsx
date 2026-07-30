import { NavLink, useNavigate } from "react-router-dom";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useNotifications } from "../../context/NotificationsContext";
import { api, type BarShift } from "../../lib/api";

const BAR_NAV = [
  { to: "/bar", label: "Dashboard", icon: "🍺", end: true },
  { to: "/bar/sales", label: "New Sale (POS)", icon: "🧾" },
  { to: "/bar/food-order", label: "Order Food", icon: "🍽️" },
  { to: "/bar/inventory", label: "Inventory", icon: "📦" },
  { to: "/bar/reports", label: "Reports", icon: "📊" },
  { to: "/bar/shifts", label: "Shift History", icon: "🕐" },
];

const SUPERVISOR_BAR_NAV = [
  { to: "/bar", label: "Dashboard", icon: "🍺", end: true },
  { to: "/bar/sales", label: "New Sale (POS)", icon: "🧾" },
  { to: "/bar/food-order", label: "Order Food", icon: "🍽️" },
  { to: "/bar/inventory", label: "Inventory", icon: "📦" },
  { to: "/bar/waiters", label: "Waiters", icon: "👤" },
  { to: "/bar/reports", label: "Reports", icon: "📊" },
  { to: "/bar/shifts", label: "Shift History", icon: "🕐" },
];

const ADMIN_BAR_NAV = [
  { to: "/bar", label: "Bar Dashboard", icon: "🍺", end: true },
  { to: "/bar/inventory", label: "Bar Inventory", icon: "📦" },
  { to: "/bar/waiters", label: "Waiters", icon: "👤" },
  { to: "/bar/reports", label: "Bar Reports", icon: "📊" },
  { to: "/bar/shifts", label: "Shift History", icon: "🕐" },
  { to: "/abvichoteldashboard", label: "← Hotel Dashboard", icon: "🏨" },
];

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const NOTIF_ICONS: Record<string, string> = {
  low_stock: "⚠️", new_order: "🛒", kitchen_order: "🍽️",
  payment: "💳", shift: "🕐", system: "⚙️",
};

export default function BarLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [barShift, setBarShift] = useState<BarShift | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    api.getCurrentBarShift().then(setBarShift).catch(() => {});
    const iv = setInterval(() => {
      api.getCurrentBarShift().then(setBarShift).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // Close topbar dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const navItems = user?.role === "admin"
    ? ADMIN_BAR_NAV
    : user?.role === "supervisor"
    ? SUPERVISOR_BAR_NAV
    : BAR_NAV;

  return (
    <div className="app-shell">
      <aside className="sidebar glass">
        <div className="brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Hotel logo" className="brand-logo" />
          ) : (
            <span className="brand-icon">🍺</span>
          )}
          <span>Bar Portal</span>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {/* Notifications — full page link */}
          <NavLink
            to="/bar/notifications"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center" }}
          >
            <span className="nav-icon">🔔</span>
            <span style={{ flex: 1 }}>Notifications</span>
            {unread > 0 && (
              <span style={{
                background: "var(--danger)", color: "#fff",
                fontSize: 10, borderRadius: 999, padding: "1px 6px",
                fontWeight: 700, marginLeft: 4,
              }}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </NavLink>
        </nav>
        <div className="shift-pill">
          <span className={`dot ${barShift ? "dot-active" : "dot-inactive"}`} />
          Bar Shift {barShift ? "Active" : "Closed"}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar glass">
          <div className="topbar-title">
            {user?.role === "admin" ? "Admin — Bar Portal" : user?.role === "supervisor" ? "Supervisor Console" : "Bar Attendant Console"}
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {/* Topbar notification bell — quick-peek dropdown */}
            <div className="notif-wrap" ref={notifRef}>
              <button
                className="icon-btn"
                onClick={() => setNotifOpen(o => !o)}
                title="Notifications"
                style={{ fontSize: 18, cursor: "pointer" }}
              >
                🔔
                {unread > 0 && (
                  <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span>
                      Notifications
                      {unread > 0 && (
                        <span className="notif-header-badge" style={{ marginLeft: 8 }}>{unread} unread</span>
                      )}
                    </span>
                    {unread > 0 && (
                      <button
                        className="btn secondary"
                        style={{ fontSize: "0.72rem", padding: "2px 10px" }}
                        onClick={() => markAllRead()}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="notif-empty">🎉 You're all caught up!</div>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${!n.read ? "unread" : ""}`}
                        onClick={() => { if (!n.read) markRead(n.id); setNotifOpen(false); navigate("/bar/notifications"); }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>
                            {NOTIF_ICONS[n.type] || "🔔"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div>{n.message}</div>
                            <div className="notif-time">{relativeTime(n.createdAt)}</div>
                          </div>
                          {!n.read && (
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 4 }} />
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  <div style={{ borderTop: "1px solid var(--glass-border)", padding: "8px 12px 4px" }}>
                    <button
                      className="btn secondary full"
                      style={{ fontSize: "0.8rem" }}
                      onClick={() => { setNotifOpen(false); navigate("/bar/notifications"); }}
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="user-chip">
              <div className="avatar">{user?.fullName?.charAt(0) || "B"}</div>
              <div>
                <div className="user-name">{user?.fullName}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            </div>
            <button className="btn secondary" onClick={handleLogout}>Log out</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
