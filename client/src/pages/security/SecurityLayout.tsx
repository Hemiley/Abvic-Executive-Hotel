import { NavLink, useNavigate } from "react-router-dom";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";

const SECURITY_NAV = [
  { to: "/security", label: "Sign In / Out", icon: "✅", end: true },
  { to: "/security/history", label: "Today's Log", icon: "📋" },
  { to: "/security/shifts", label: "Shift History", icon: "📁" },
];

const ADMIN_SECURITY_NAV = [
  { to: "/security", label: "Sign In / Out", icon: "✅", end: true },
  { to: "/security/history", label: "Today's Log", icon: "📋" },
  { to: "/security/shifts", label: "Shift History", icon: "📁" },
  { to: "/abvichoteldashboard", label: "← Hotel Dashboard", icon: "🏨" },
];

export default function SecurityLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  async function handleLogout() {
    await logout();
    navigate("/security-login");
  }

  const navItems = user?.role === "admin" ? ADMIN_SECURITY_NAV : SECURITY_NAV;

  return (
    <div className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

      <aside className="sidebar glass">
        <div className="brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Hotel logo" className="brand-logo" />
          ) : (
            <span className="brand-icon">🛡️</span>
          )}
          <span>Security Portal</span>
        </div>
        <nav onClick={() => setSidebarOpen(false)}>
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
        <div className="shift-pill" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
          <span className="dot dot-active" style={{ background: "#22c55e" }} />
          Security Active
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar glass">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
              <span className="menu-btn-bar" />
              <span className="menu-btn-bar" />
              <span className="menu-btn-bar" />
            </button>
            <div className="topbar-title">
              {user?.role === "admin" ? "Admin — Security Portal" : "Security Officer Console"}
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <div className="user-chip">
              <div className="avatar">{user?.fullName?.charAt(0) || "S"}</div>
              <div className="user-chip-text">
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
