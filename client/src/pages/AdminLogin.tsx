import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { api } from "../lib/api";

type ResetStep = "idle" | "form" | "success";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Forgot-password state
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetUsername, setResetUsername] = useState("");
  const [resetCurrent, setResetCurrent] = useState("");
  const [resetNew, setResetNew] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const { login, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await login(username, password);
      if (result?.role !== "admin") {
        await logout().catch(() => {});
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

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setResetError("");
    if (resetNew !== resetConfirm) {
      setResetError("New passwords do not match.");
      return;
    }
    if (resetNew.length < 8) {
      setResetError("New password must be at least 8 characters.");
      return;
    }
    setResetSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetUsername,
          currentPassword: resetCurrent,
          newPassword: resetNew,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed.");
      setResetStep("success");
    } catch (err: any) {
      setResetError(err.message || "Reset failed.");
    } finally {
      setResetSubmitting(false);
    }
  }

  function openReset() {
    setResetStep("form");
    setResetUsername(username); // pre-fill from login form if typed
    setResetCurrent("");
    setResetNew("");
    setResetConfirm("");
    setResetError("");
  }

  function closeReset() {
    setResetStep("idle");
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
          <button type="button" className="login-switch-link" onClick={openReset}>
            Forgot password?
          </button>
        </div>

        <div className="login-footer" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="login-switch-link"
            onClick={() => navigate("/login")}
          >
            ← Back to Receptionist Login
          </button>
        </div>
      </form>

      {/* ── Forgot-password modal ── */}
      {resetStep !== "idle" && (
        <div className="modal-overlay" onClick={closeReset}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            {resetStep === "success" ? (
              <>
                <h2>Password Updated</h2>
                <p className="login-sub" style={{ marginTop: 8 }}>
                  Your administrator password has been changed successfully.
                  Please sign in with your new password.
                </p>
                <div className="modal-actions" style={{ marginTop: 20 }}>
                  <button
                    className="btn full btn-admin"
                    onClick={() => {
                      closeReset();
                      setPassword("");
                    }}
                  >
                    Back to Login
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Reset Admin Password</h2>
                <p className="login-sub" style={{ marginTop: 4 }}>
                  Verify your identity with your current password, then set a new one.
                </p>

                <form onSubmit={handleReset} style={{ marginTop: 16 }}>
                  <div className="field">
                    <label>Admin Username</label>
                    <input
                      value={resetUsername}
                      onChange={(e) => setResetUsername(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={resetCurrent}
                      onChange={(e) => setResetCurrent(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={resetNew}
                      onChange={(e) => setResetNew(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="field">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  {resetError && <p className="error-text">{resetError}</p>}

                  <div className="modal-actions" style={{ marginTop: 16, gap: 10 }}>
                    <button
                      type="submit"
                      className="btn full btn-admin"
                      disabled={resetSubmitting}
                    >
                      {resetSubmitting ? "Updating..." : "Update Password"}
                    </button>
                    <button
                      type="button"
                      className="btn full"
                      onClick={closeReset}
                      style={{ marginTop: 8 }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
