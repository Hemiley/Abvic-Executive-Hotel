import { NavLink, useNavigate } from "react-router-dom";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { api, type BarShift } from "../../lib/api";

const BAR_NAV = [
  { to: "/bar", label: "Dashboard", icon: "🍺", end: true },
  { to: "/bar/sales", label: "New Sale (POS)", icon: "🧾" },
  { to: "/bar/inventory", label: "Inventory", icon: "📦" },
  { to: "/bar/reports", label: "Reports", icon: "📊" },
  { to: "/bar/shifts", label: "Shift History", icon: "🕐" },
];

const SUPERVISOR_BAR_NAV = [
  { to: "/bar", label: "Dashboard", icon: "🍺", end: true },
  { to: "/bar/sales", label: "New Sale (POS)", icon: "🧾" },
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

export default function BarLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [barShift, setBarShift] = useState<BarShift | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );

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
