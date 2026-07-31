import { useState, useEffect } from "react";
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

export default function SecurityHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const branchId = user?.role === "admin" ? undefined : user?.branchId || undefined;

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => {});
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    try {
      const params: Record<string, string> = { date: today };
      if (branchId) params.branchId = branchId;
      const data = await api.getAttendance(params);
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;
  const isAdmin = user?.role === "admin";

  const signedIn = records.filter(r => r.status === "signed_in").length;
  const signedOut = records.filter(r => r.status === "signed_out").length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px" }}>📋 Today's Attendance Log</h2>
        <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Records", value: records.length, color: "#6366f1" },
          { label: "Currently In", value: signedIn, color: "#22c55e" },
          { label: "Signed Out", value: signedOut, color: "#94a3b8" },
        ].map(stat => (
          <div key={stat.label} className="glass" style={{ padding: "16px 20px", borderRadius: 12, borderLeft: `3px solid ${stat.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>Loading...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", opacity: 0.5, fontSize: 14 }}>
            No attendance records for today yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Staff Name", "Position", isAdmin && "Branch", "Sign In", "Sign Out", "Hours", "Status"].filter(Boolean).map(h => (
                    <th key={h as string} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>{record.staffName}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, opacity: 0.7 }}>{record.position}</td>
                    {isAdmin && <td style={{ padding: "12px 16px", fontSize: 13, opacity: 0.7 }}>{branchName(record.branchId)}</td>}
                    <td style={{ padding: "12px 16px", fontSize: 13, opacity: 0.8, fontFamily: "monospace" }}>
                      {new Date(record.signInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, opacity: 0.8, fontFamily: "monospace" }}>
                      {record.signOutTime
                        ? new Date(record.signOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "monospace" }}>
                      {record.totalHours ? `${Number(record.totalHours).toFixed(1)}h` : <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: record.status === "signed_in" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
                        color: record.status === "signed_in" ? "#22c55e" : "#94a3b8",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {record.status === "signed_in" ? "Signed In" : "Signed Out"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
