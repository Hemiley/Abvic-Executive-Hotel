import { NavLink, useNavigate } from "react-router-dom";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useNotifications } from "../../context/NotificationsContext";
import { api, type KitchenShift } from "../../lib/api";

const CHEF_NAV = [
  { to: "/kitchen", label: "Dashboard", icon: "🍳", end: true },
  { to: "/kitchen/orders", label: "Orders", icon: "📋" },
  { to: "/kitchen/inventory", label: "Inventory", icon: "🥩" },
  { to: "/kitchen/shifts", label: "Shift History", icon: "🕐" },
  { to: "/kitchen/reports", label: "Reports", icon: "📊" },
];

const ADMIN_KITCHEN_NAV = [
  { to: "/kitchen", label: "Kitchen Dashboard", icon: "🍳", end: true },
  { to: "/kitchen/orders", label: "Orders", icon: "📋" },
  { to: "/kitchen/inventory", label: "Inventory", icon: "🥩" },
  { to: "/kitchen/shifts", label: "Shift History", icon: "🕐" },
  { to: "/kitchen/reports", label: "Reports", icon: "📊" },
  { to: "/bar", label: "Bar Portal", icon: "🍺" },
  { to: "/abvichoteldashboard", label: "← Hotel Dashboard", icon: "🏨" },
];

export default function KitchenLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const [activeShift, setActiveShift] = useState<KitchenShift | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    api.getActiveKitchenShift().then(setActiveShift).catch(() => {});
    const iv = setInterval(() => {
      api.getActiveKitchenShift().then(setActiveShift).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const navItems = user?.role === "admin" ? ADMIN_KITCHEN_NAV : CHEF_NAV;

  return (
    <div className="app-shell">
      <aside className="sidebar glass">
        <div className="brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Hotel logo" className="brand-logo" />
          ) : (
            <span className="brand-icon">🍽️</span>
          )}
          <span>Kitchen Portal</span>
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
            to="/kitchen/notifications"
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
          <span className={`dot ${activeShift ? "dot-active" : "dot-inactive"}`} />
          Kitchen Shift {activeShift ? "Active" : "Closed"}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar glass">
          <div className="topbar-title">
            {user?.role === "admin" ? "Admin — Kitchen Portal" : "Chef Console"}
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <div className="user-chip">
              <div className="avatar">{user?.fullName?.charAt(0) || "C"}</div>
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
