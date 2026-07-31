import { useState, useEffect } from "react";
import { api } from "../lib/api";

type PayrollRow = {
  staffName: string;
  position: string;
  branchId: string;
  totalDays: number;
  totalHours: number;
  signedOutDays: number;
};

export default function AttendancePayroll() {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => {});
    loadPayroll();
  }, []);

  async function loadPayroll() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterBranch) params.branchId = filterBranch;
      if (filterMonth) params.month = filterMonth;
      const data = await api.getAttendancePayroll(params);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;

  function handleExportCSV() {
    if (!rows.length) return;
    const headers = ["Staff Name", "Position", "Branch", "Days Present", "Total Hours", "Avg Hours/Day", "Days Signed Out Properly"];
    const csv = [
      headers.join(","),
      ...rows.map(r => [
        `"${r.staffName}"`,
        `"${r.position}"`,
        `"${branchName(r.branchId)}"`,
        r.totalDays,
        r.totalHours.toFixed(2),
        r.totalDays > 0 ? (r.totalHours / r.totalDays).toFixed(2) : "0",
        r.signedOutDays,
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_summary_${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalHours = rows.reduce((s, r) => s + r.totalHours, 0);
  const totalDays = rows.reduce((s, r) => s + r.totalDays, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>💰 Payroll Summary</h2>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>Monthly working hours for salary calculation</p>
        </div>
        <button className="btn" onClick={handleExportCSV} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none" }}>
          ⬇️ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass" style={{ padding: 16, borderRadius: 12, marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Month</label>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 160 }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Branch</label>
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ width: 180 }}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button className="btn" onClick={loadPayroll}>Generate Report</button>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Staff Members", value: rows.length, color: "#6366f1" },
          { label: "Total Man-Days", value: totalDays, color: "#22c55e" },
          { label: "Total Hours Worked", value: totalHours.toFixed(1) + "h", color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="glass" style={{ padding: "16px 20px", borderRadius: 12, borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Payroll Table */}
      <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>Generating payroll summary...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", opacity: 0.5, fontSize: 14 }}>
            No attendance data for the selected month and branch.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Staff Name", "Position", "Branch", "Days Present", "Total Hours", "Avg Hrs/Day", "Days Out Properly"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const avgHours = row.totalDays > 0 ? (row.totalHours / row.totalDays) : 0;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>{row.staffName}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, opacity: 0.7 }}>{row.position}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, opacity: 0.7 }}>{branchName(row.branchId)}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "monospace" }}>{row.totalDays}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: "#f59e0b" }}>
                        {row.totalHours.toFixed(1)}h
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "monospace" }}>
                        {avgHours.toFixed(1)}h
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: row.signedOutDays === row.totalDays ? "rgba(34,197,94,0.15)" : "rgba(251,146,60,0.15)",
                          color: row.signedOutDays === row.totalDays ? "#22c55e" : "#fb923c",
                        }}>
                          {row.signedOutDays}/{row.totalDays}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(99,102,241,0.1)", borderRadius: 10, fontSize: 13, opacity: 0.8 }}>
        💡 <strong>Payroll Note:</strong> Total hours and days present are derived from attendance records logged by security officers.
        Days marked as &quot;Out Properly&quot; have a sign-out time recorded; others may indicate a forgotten sign-out.
        Use this data alongside your payroll system for monthly salary calculations.
      </div>
    </div>
  );
}
