import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { api } from "../lib/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [adminRedirect, setAdminRedirect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAdminRedirect(false);
    setSubmitting(true);
    try {
      const result = await api.login(username, password);
      if (result?.role === "admin") {
        await api.logout().catch(() => {});
        setAdminRedirect(true);
        return;
      }
      await login(username, password);
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
        <h1>Receptionist Login</h1>
        <p className="login-sub">Sign in to access the front desk console</p>
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
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
        {adminRedirect && (
          <div className="admin-redirect-box">
            <p>Administrator accounts must use the Admin Login portal.</p>
            <button
              type="button"
              className="btn-admin-switch"
              onClick={() => navigate("/admin-login")}
            >
              🔐 Go to Admin Login
            </button>
          </div>
        )}
        <button className="btn full" type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
        <div className="login-admin-switch">
          <button
            type="button"
            className="btn-admin-switch"
            onClick={() => navigate("/admin-login")}
          >
            🔐 Admin Login
          </button>
        </div>
      </form>
    </div>
  );
}
