import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

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

export default function SecurityPortal() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

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

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => {});
    if (!branchId && user?.branchId) setBranchId(user.branchId);
  }, [user]);

  useEffect(() => {
    loadActive();
  }, [branchId]);

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

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSignInError("");
    setSignInSuccess("");
    if (!staffName.trim()) return setSignInError("Please enter the staff member's name.");
    if (!position) return setSignInError("Please select a position.");
    if (!branchId) return setSignInError("Please select a branch.");
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
  const isAdmin = user?.role === "admin";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
      {/* ── Sign-In Panel ── */}
      <div className="glass" style={{ padding: 28, borderRadius: 16 }}>
        <h2 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✅</span> Staff Sign-In
        </h2>
        <p style={{ margin: "0 0 20px", opacity: 0.6, fontSize: 13 }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>

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
            disabled={signingIn}
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none", padding: "12px", fontSize: 15, marginTop: 4 }}
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
                    In: {new Date(record.signInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
  );
}
