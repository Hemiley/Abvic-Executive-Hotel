import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useNotifications } from "../context/NotificationsContext";

const NAV_ITEMS = [
  { to: "/abvichoteldashboard", label: "Dashboard", icon: "🏨" },
  { to: "/walk-in", label: "Walk-in Booking", icon: "🛎️" },
  { to: "/reservations", label: "Reservations", icon: "📋" },
  { to: "/rooms", label: "Rooms", icon: "🚪" },
  { to: "/reports", label: "Reports", icon: "📊", roles: ["admin", "supervisor", "receptionist"] },
  { to: "/audit-log", label: "Audit Log", icon: "🔒", roles: ["admin", "supervisor"] },
  { to: "/staff", label: "Staff Management", icon: "🧑‍💼", roles: ["admin"] },
  { to: "/branches", label: "Branches", icon: "🏢", roles: ["admin"] },
  { to: "/settings", label: "Hotel Settings", icon: "⚙️", roles: ["admin"] },
  { to: "/food-order", label: "Order Food", icon: "🍽️" },
  { to: "/bar", label: "Bar Portal", icon: "🍺", roles: ["admin"] },
  { to: "/kitchen", label: "Kitchen Portal", icon: "🍳", roles: ["admin"] },
  { to: "/payroll", label: "Payroll", icon: "💰", roles: ["admin"] },
  { to: "/security", label: "Security Portal", icon: "✅", roles: ["admin"] },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, shift, logout } = useAuth();
  const { settings } = useSettings();
  const { unread } = useNotifications();
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
    navigate("/login");
  }

  return (
    <div className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      {/* Mobile overlay backdrop */}
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

      <aside className="sidebar glass">
        <div className="brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Hotel logo" className="brand-logo" />
          ) : (
            <span className="brand-icon">✨</span>
          )}
          <span>{settings?.hotelName || "AEH"}</span>
        </div>
        {/* Close nav links on tap (mobile) */}
        <nav onClick={() => setSidebarOpen(false)}>
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
          <NavLink
            to="/notifications"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon">🔔</span>
            Notifications
            {unread > 0 && <span className="notif-badge sidebar-notif-badge">{unread}</span>}
          </NavLink>
        </nav>
        <div className="shift-pill">
          <span className={`dot ${shift ? "dot-active" : "dot-inactive"}`} />
          Shift {shift ? "Active" : "Closed"}
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
            <div className="topbar-title">{user?.role === "admin" ? "Super Admin Console" : "Receptionist Console"}</div>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <div className="user-chip">
              <div className="avatar">{user?.fullName?.charAt(0) || "R"}</div>
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
