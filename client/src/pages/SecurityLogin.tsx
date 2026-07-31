import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { api } from "../lib/api";

export default function SecurityLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!branchId) {
      setError("Please select your branch.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(username, password, branchId);
      if (result?.role !== "security" && result?.role !== "admin") {
        await logout().catch(() => {});
        setError("Access denied. This portal is for security personnel only.");
        return;
      }
      if (result?.role === "admin") {
        navigate("/security");
      } else {
        navigate("/security");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-decor" />
      <form className="login-card glass" onSubmit={handleSubmit}>
        <div className="login-brand">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Hotel logo" className="login-brand-logo" />
          ) : (
            "✨"
          )}
          <span>{settings?.hotelName || "AEH"}</span>
        </div>

        <div className="admin-badge" style={{ background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)", color: "#22c55e" }}>
          <span className="admin-badge-icon">🛡️</span>
          Security Portal
        </div>

        <h1>Security Login</h1>
        <p className="login-sub">Sign in to access the attendance system</p>

        <div className="field">
          <label>Branch</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="" disabled>Select your branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          className="btn full"
          type="submit"
          disabled={submitting}
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none" }}
        >
          {submitting ? "Signing in..." : "Sign in to Security Portal"}
        </button>

        <div className="login-admin-switch">
          <button type="button" className="login-switch-link" onClick={() => navigate("/login")}>
            ← Back to Main Login
          </button>
        </div>
      </form>
    </div>
  );
}
