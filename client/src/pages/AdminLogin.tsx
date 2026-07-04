import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(username, password);
      if (user?.role !== "admin") {
        setError("Access denied. This portal is for administrators only.");
        return;
      }
      navigate("/abvichoteldashboard");
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
          )}{" "}
          {settings?.hotelName || "Grand Hotel"}
        </div>

        <div className="admin-badge">
          <span className="admin-badge-icon">🔐</span>
          Admin Portal
        </div>

        <h1>Administrator Login</h1>
        <p className="login-sub">Restricted access · Authorised personnel only</p>

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

        <button className="btn full btn-admin" type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in as Admin"}
        </button>

        <div className="login-footer">
          <button
            type="button"
            className="login-switch-link"
            onClick={() => navigate("/login")}
          >
            ← Back to Receptionist Login
          </button>
        </div>
      </form>
    </div>
  );
}
