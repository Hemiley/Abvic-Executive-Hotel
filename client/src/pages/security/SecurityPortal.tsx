import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { api, type SecurityShift } from "../../lib/api";

type AttendanceRecord = {
  id: string;
  date: string;
  staffName: string;
  position: string;
  branchId: string;
  signInTime: string;
  signOutTime: string | null;
  status: "signed_in" | "signed_out";
  totalHours: string | null;
  recordedByName: string;
};

const POSITIONS = [
  "Receptionist", "Supervisor", "Bar Attendant", "Chef", "Security Officer",
  "Housekeeper", "Driver", "Maintenance", "Manager", "Accountant",
  "Waiter", "Cleaner", "Porter", "Other",
];

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(start: string) {
  const ms = Date.now() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SecurityPortal() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // Shift state
  const [currentShift, setCurrentShift] = useState<SecurityShift | null | undefined>(undefined);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [startingShift, setStartingShift] = useState(false);
  const [endingShift, setEndingShift] = useState(false);
  const [shiftError, setShiftError] = useState("");
  const [shiftBranchId, setShiftBranchId] = useState(user?.branchId || "");
  const [tick, setTick] = useState(0);

  // Sign-In form
  const [staffName, setStaffName] = useState("");
  const [position, setPosition] = useState("");
  const [branchId, setBranchId] = useState(user?.branchId || "");
  const [signInError, setSignInError] = useState("");
  const [signInSuccess, setSignInSuccess] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Today's active records (signed in)
  const [activeRecords, setActiveRecords] = useState<AttendanceRecord[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [signOutSuccess, setSignOutSuccess] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [signingOutId, setSigningOutId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => {});
    if (!branchId && user?.branchId) {
      setBranchId(user.branchId);
      setShiftBranchId(user.branchId);
    }
  }, [user]);

  useEffect(() => {
    loadCurrentShift();
  }, [branchId]);

  useEffect(() => {
    loadActive();
  }, [branchId]);

  // Tick every 30s so duration display stays fresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function loadCurrentShift() {
    setShiftLoading(true);
    try {
      const effectiveBranch = branchId || shiftBranchId;
      const shift = await api.getCurrentSecurityShift(isAdmin ? effectiveBranch || undefined : undefined);
      setCurrentShift(shift);
    } catch {
      setCurrentShift(null);
    } finally {
      setShiftLoading(false);
    }
  }

  async function loadActive() {
    setLoadingActive(true);
    try {
      const params: Record<string, string> = { date: today, status: "signed_in" };
      if (branchId) params.branchId = branchId;
      const records = await api.getAttendance(params);
      setActiveRecords(records);
    } catch {
      setActiveRecords([]);
    } finally {
      setLoadingActive(false);
    }
  }

  async function handleStartShift() {
    setShiftError("");
    const bid = branchId || shiftBranchId;
    if (!bid) return setShiftError("Please select a branch first.");
    setStartingShift(true);
    try {
      const shift = await api.startSecurityShift(bid);
      setCurrentShift(shift);
    } catch (err: any) {
      setShiftError(err.message || "Failed to start shift.");
    } finally {
      setStartingShift(false);
    }
  }

  async function handleEndShift() {
    if (!currentShift) return;
    if (!confirm("End this shift? All attendance activity will be saved and locked to this shift.")) return;
    setEndingShift(true);
    setShiftError("");
    try {
      await api.endSecurityShift(currentShift.id);
      setCurrentShift(null);
    } catch (err: any) {
      setShiftError(err.message || "Failed to end shift.");
    } finally {
      setEndingShift(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSignInError("");
    setSignInSuccess("");
    if (!staffName.trim()) return setSignInError("Please enter the staff member's name.");
    if (!position) return setSignInError("Please select a position.");
    if (!branchId) return setSignInError("Please select a branch.");
    if (!currentShift) return setSignInError("Please start a shift before signing in staff.");
    setSigningIn(true);
    try {
      await api.signInAttendance({ staffName: staffName.trim(), position, branchId });
      setSignInSuccess(`✅ ${staffName.trim()} has been signed in successfully.`);
      setStaffName("");
      setPosition("");
      loadActive();
    } catch (err: any) {
      setSignInError(err.message || "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut(record: AttendanceRecord) {
    setSignOutError("");
    setSignOutSuccess("");
    setSigningOutId(record.id);
    try {
      await api.signOutAttendance(record.id);
      setSignOutSuccess(`✅ ${record.staffName} has been signed out successfully.`);
      loadActive();
    } catch (err: any) {
      setSignOutError(err.message || "Sign-out failed.");
    } finally {
      setSigningOutId(null);
    }
  }

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;

  // ── Shift Banner ────────────────────────────────────────────────────────────
  const ShiftBanner = () => {
    if (shiftLoading) {
      return (
        <div className="glass" style={{ padding: "16px 24px", borderRadius: 14, marginBottom: 20, opacity: 0.6, fontSize: 13 }}>
          Checking shift status...
        </div>
      );
    }

    if (!currentShift) {
      return (
        <div
          className="glass"
          style={{
            padding: "20px 24px",
            borderRadius: 14,
            marginBottom: 20,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.07)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
                <span>🔴</span> No Active Shift
              </div>
              <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>
                Start a shift to begin signing in staff members.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isAdmin && (
                <select
                  value={shiftBranchId}
                  onChange={e => setShiftBranchId(e.target.value)}
                  style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "inherit" }}
                >
                  <option value="">Select branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              <button
                className="btn"
                onClick={handleStartShift}
                disabled={startingShift}
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none", padding: "8px 20px", fontSize: 13, whiteSpace: "nowrap" }}
              >
                {startingShift ? "Starting..." : "▶ Start Shift"}
              </button>
            </div>
          </div>
          {shiftError && (
            <div style={{ marginTop: 10, color: "#f87171", fontSize: 13 }}>{shiftError}</div>
          )}
        </div>
      );
    }

    // Active shift
    const duration = fmtDuration(currentShift.startTime);
    return (
      <div
        className="glass"
        style={{
          padding: "16px 24px",
          borderRadius: 14,
          marginBottom: 20,
          border: "1px solid rgba(34,197,94,0.3)",
          background: "rgba(34,197,94,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 0 4px rgba(34,197,94,0.25)",
              animation: "pulse 2s infinite",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#4ade80" }}>
              Shift Active — {duration}
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
              Started {fmt(currentShift.startTime)} by {currentShift.officerName}
              {isAdmin && ` · ${branchName(currentShift.branchId)}`}
              {" · "}{currentShift.attendanceCount} sign-ins recorded
            </div>
          </div>
        </div>
        <button
          className="btn secondary"
          onClick={handleEndShift}
          disabled={endingShift}
          style={{ fontSize: 13, padding: "8px 18px", whiteSpace: "nowrap", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}
        >
          {endingShift ? "Ending..." : "⏹ End Shift"}
        </button>
      </div>
    );
  };

  return (
    <div>
      <ShiftBanner />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* ── Sign-In Panel ── */}
        <div className="glass" style={{ padding: 28, borderRadius: 16 }}>
          <h2 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <span>✅</span> Staff Sign-In
          </h2>
          <p style={{ margin: "0 0 20px", opacity: 0.6, fontSize: 13 }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>

          {!currentShift && !shiftLoading && (
            <div style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
              ⚠️ Start a shift above before signing in staff members.
            </div>
          )}

          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isAdmin && (
              <div className="field">
                <label>Branch</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
                  <option value="">Select branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Staff Member Name</label>
              <input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Type full name..."
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label>Position / Role</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} required>
                <option value="">Select position</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {signInError && (
              <div style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                {signInError}
              </div>
            )}
            {signInSuccess && (
              <div style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                {signInSuccess}
              </div>
            )}

            <button
              type="submit"
              className="btn"
              disabled={signingIn || !currentShift}
              style={{ background: currentShift ? "linear-gradient(135deg, #22c55e, #16a34a)" : undefined, border: "none", padding: "12px", fontSize: 15, marginTop: 4 }}
            >
              {signingIn ? "Signing In..." : "Sign In Staff Member"}
            </button>
          </form>
        </div>

        {/* ── Currently Signed In ── */}
        <div className="glass" style={{ padding: 28, borderRadius: 16 }}>
          <h2 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🕐</span> Currently Signed In
          </h2>
          <p style={{ margin: "0 0 20px", opacity: 0.6, fontSize: 13 }}>
            {activeRecords.length} staff member{activeRecords.length !== 1 ? "s" : ""} on premises
          </p>

          {signOutError && (
            <div style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {signOutError}
            </div>
          )}
          {signOutSuccess && (
            <div style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {signOutSuccess}
            </div>
          )}

          {loadingActive ? (
            <div style={{ opacity: 0.5, textAlign: "center", padding: 24 }}>Loading...</div>
          ) : activeRecords.length === 0 ? (
            <div style={{ opacity: 0.5, textAlign: "center", padding: 24, fontSize: 13 }}>
              No staff currently signed in.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
              {activeRecords.map(record => (
                <div
                  key={record.id}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "rgba(34,197,94,0.2)", color: "#22c55e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 15, flexShrink: 0,
                    }}
                  >
                    {record.staffName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{record.staffName}</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      {record.position}
                      {isAdmin && ` · ${branchName(record.branchId)}`}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                      In: {fmt(record.signInTime)} · {fmtDuration(record.signInTime)} ago
                    </div>
                  </div>
                  <button
                    className="btn secondary"
                    style={{ fontSize: 12, padding: "6px 12px", flexShrink: 0 }}
                    onClick={() => handleSignOut(record)}
                    disabled={signingOutId === record.id}
                  >
                    {signingOutId === record.id ? "..." : "Sign Out"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
