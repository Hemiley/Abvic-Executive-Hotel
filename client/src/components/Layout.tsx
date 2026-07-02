import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { api, type Notification } from "../lib/api";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "🏨" },
  { to: "/walk-in", label: "Walk-in Booking", icon: "🛎️" },
  { to: "/reservations", label: "Reservations", icon: "📋" },
  { to: "/rooms", label: "Rooms", icon: "🚪" },
  { to: "/reports", label: "Reports", icon: "📊" },
  { to: "/audit-log", label: "Audit Log", icon: "🔒", roles: ["admin", "supervisor"] },
  { to: "/staff", label: "Staff Management", icon: "🧑‍💼", roles: ["admin"] },
  { to: "/settings", label: "Hotel Settings", icon: "⚙️", roles: ["admin"] },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, shift, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    function load() {
      api.getNotifications().then(setNotifications).catch(() => {});
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close the panel when clicking outside it
  useEffect(() => {
    if (!showNotifs) return;
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showNotifs]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="app-shell">
      <aside className="sidebar glass">
        <div className="brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Hotel logo" className="brand-logo" />
          ) : (
            <span className="brand-icon">✨</span>
          )}
          <span>{settings?.hotelName || "Grand Hotel"}</span>
        </div>
        <nav>
          {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role || "")).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="shift-pill">
          <span className={`dot ${shift ? "dot-active" : "dot-inactive"}`} />
          Shift {shift ? "Active" : "Closed"}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar glass">
          <div className="topbar-title">Receptionist Console</div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {/* Notification bell */}
            <div className="notif-wrap" ref={notifRef}>
              <button
                className="icon-btn"
                onClick={() => setShowNotifs((s) => !s)}
                aria-label="Notifications"
              >
                🔔
                {unread > 0 && <span className="notif-badge">{unread}</span>}
              </button>

              {showNotifs && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span>Notifications</span>
                    {unread > 0 && (
                      <span className="notif-header-badge">{unread} unread</span>
                    )}
                  </div>
                  {notifications.length === 0 && (
                    <div className="notif-empty">No notifications yet</div>
                  )}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.read ? "" : "unread"}`}
                      onClick={() =>
                        api.markNotificationRead(n.id).then(() =>
                          setNotifications((prev) =>
                            prev.map((p) => (p.id === n.id ? { ...p, read: true } : p))
                          )
                        )
                      }
                    >
                      <div className="notif-msg">{n.message}</div>
                      <div className="notif-time">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="user-chip">
              <div className="avatar">{user?.fullName?.charAt(0) || "R"}</div>
              <div>
                <div className="user-name">{user?.fullName}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            </div>
            <button className="btn secondary" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
