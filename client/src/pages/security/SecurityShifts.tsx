import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { api, type SecurityShift } from "../../lib/api";
import * as XLSX from "xlsx";

function fmt(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function duration(start: string, end: string | null) {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function SecurityShifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<SecurityShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => {});
    loadShifts();
  }, []);

  async function loadShifts() {
    setLoading(true);
    try {
      const data = await api.getSecurityShifts(isAdmin ? undefined : undefined);
      setShifts(data);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }

  async function downloadShift(shift: SecurityShift) {
    setDownloading(shift.id);
    try {
      const { rows } = await api.getSecurityShiftAttendance(shift.id);

      const branchLabel = branches.find(b => b.id === shift.branchId)?.name ?? shift.branchId;
      const startLabel = new Date(shift.startTime).toLocaleString("en-GB");
      const endLabel = shift.endTime ? new Date(shift.endTime).toLocaleString("en-GB") : "Still Active";
      const dur = duration(shift.startTime, shift.endTime);

      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Shift Summary + embedded attendance table ──────────────────
      const COLS = ["#", "Staff Name", "Position", "Branch", "Date", "Sign-In Time", "Sign-Out Time", "Total Hours", "Status", "Recorded By"];

      const summaryRows: (string | number)[][] = [
        ["SECURITY SHIFT REPORT"],
        [],
        ["Officer",                  shift.officerName],
        ["Branch",                   branchLabel],
        ["Shift Start",              startLabel],
        ["Shift End",                endLabel],
        ["Duration",                 dur],
        ["Total Staff Sign-Ins",     shift.attendanceCount],
        ["Shift Status",             shift.status === "active" ? "Active" : "Closed"],
        [],
        ["─── ATTENDANCE LOG ───"],
        [],
        COLS,
      ];

      if (rows.length === 0) {
        summaryRows.push(["", "No attendance records were captured during this shift.", ...Array(COLS.length - 2).fill("")]);
      } else {
        rows.forEach((r, i) => {
          summaryRows.push([
            i + 1,
            r["Staff Name"]   ?? "",
            r["Position"]     ?? "",
            r["Branch"]       ?? "",
            r["Date"]         ?? "",
            r["Sign In"]      ?? "",
            r["Sign Out"]     ?? "",
            r["Total Hours"]  ?? "",
            r["Status"]       ?? "",
            r["Recorded By"]  ?? "",
          ]);
        });
      }

      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      ws1["!cols"] = [
        { wch: 4 },   // #
        { wch: 24 },  // Staff Name
        { wch: 20 },  // Position
        { wch: 18 },  // Branch
        { wch: 14 },  // Date
        { wch: 16 },  // Sign-In
        { wch: 16 },  // Sign-Out
        { wch: 14 },  // Hours
        { wch: 16 },  // Status
        { wch: 22 },  // Recorded By
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "Shift Report");

      // ── Sheet 2: Raw Attendance Log (data-only for filtering/pivot) ─────────
      const logRows: (string | number)[][] = [COLS];
      if (rows.length === 0) {
        logRows.push(["", "No attendance records for this shift.", ...Array(COLS.length - 2).fill("")]);
      } else {
        rows.forEach((r, i) => {
          logRows.push([
            i + 1,
            r["Staff Name"]   ?? "",
            r["Position"]     ?? "",
            r["Branch"]       ?? "",
            r["Date"]         ?? "",
            r["Sign In"]      ?? "",
            r["Sign Out"]     ?? "",
            r["Total Hours"]  ?? "",
            r["Status"]       ?? "",
            r["Recorded By"]  ?? "",
          ]);
        });
      }
      const ws2 = XLSX.utils.aoa_to_sheet(logRows);
      ws2["!cols"] = ws1["!cols"];
      XLSX.utils.book_append_sheet(wb, ws2, "Attendance Log");

      const dateStr = new Date(shift.startTime).toISOString().slice(0, 10);
      const officerSlug = shift.officerName.replace(/\s+/g, "_");
      XLSX.writeFile(wb, `security-shift-${dateStr}-${officerSlug}.xlsx`);
    } catch (err: any) {
      alert("Download failed: " + (err.message ?? "Unknown error"));
    } finally {
      setDownloading(null);
    }
  }

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;

  const filtered = filterBranch ? shifts.filter(s => s.branchId === filterBranch) : shifts;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Shift History</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.6, fontSize: 13 }}>
            All security officer shifts — download any shift as an Excel attendance report.
          </p>
        </div>
        {isAdmin && branches.length > 0 && (
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            style={{ fontSize: 13, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "inherit" }}
          >
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="glass" style={{ padding: 40, textAlign: "center", borderRadius: 16, opacity: 0.5 }}>
          Loading shifts...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass" style={{ padding: 48, textAlign: "center", borderRadius: 16, opacity: 0.5 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
          <div style={{ fontWeight: 600 }}>No shifts yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Shifts appear here once an officer starts one from the Sign In / Out page.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(shift => {
            const isActive = shift.status === "active";
            return (
              <div
                key={shift.id}
                className="glass"
                style={{
                  borderRadius: 14,
                  padding: "18px 22px",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  border: isActive ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  background: isActive ? "rgba(34,197,94,0.05)" : undefined,
                }}
              >
                {/* Status dot */}
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 52 }}>
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: isActive ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {isActive ? "🟢" : "🔒"}
                  </div>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                      color: isActive ? "#4ade80" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {isActive ? "Active" : "Closed"}
                  </span>
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {shift.officerName}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                    {isAdmin && <>{branchName(shift.branchId)} · </>}
                    {fmt(shift.startTime)}
                    {shift.endTime ? ` → ${fmt(shift.endTime)}` : " → now"}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <Stat label="Duration" value={duration(shift.startTime, shift.endTime)} />
                    <Stat label="Staff Signed In" value={String(shift.attendanceCount)} />
                  </div>
                </div>

                {/* Download */}
                <button
                  className="btn"
                  onClick={() => downloadShift(shift)}
                  disabled={downloading === shift.id}
                  style={{
                    flexShrink: 0,
                    fontSize: 13,
                    padding: "9px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    border: "none",
                  }}
                >
                  {downloading === shift.id ? (
                    "Preparing..."
                  ) : (
                    <><span>📥</span> Download Excel</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
