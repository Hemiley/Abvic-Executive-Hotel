import { useState, useEffect } from "react";
import { api } from "../lib/api";

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
  notes?: string | null;
};

type PayrollRow = {
  staffName: string;
  position: string;
  branchId: string;
  totalDays: number;
  totalHours: number;
  signedOutDays: number;
};

export default function Payroll() {
  const [tab, setTab] = useState<"logs" | "salary">("logs");

  // --- Logs state ---
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterLogBranch, setFilterLogBranch] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // --- Salary calculator state ---
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterCalcBranch, setFilterCalcBranch] = useState("");
  const [dailyRate, setDailyRate] = useState<string>("");

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => {});
    loadLogs();
  }, []);

  // ── Logs ──────────────────────────────────────────────────────────────────
  async function loadLogs() {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterDate) params.date = filterDate;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      if (filterLogBranch) params.branchId = filterLogBranch;
      if (filterStatus) params.status = filterStatus;
      if (filterStaff) params.staffName = filterStaff;
      const data = await api.getAttendance(params);
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLogsLoading(false);
    }
  }

  function clearLogFilters() {
    setFilterDate(""); setFilterDateFrom(""); setFilterDateTo("");
    setFilterLogBranch(""); setFilterStatus(""); setFilterStaff("");
    setTimeout(loadLogs, 50);
  }

  async function handleExportLogs() {
    try {
      const params: Record<string, string> = {};
      if (filterLogBranch) params.branchId = filterLogBranch;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      if (filterStatus) params.status = filterStatus;
      const rows: Record<string, string>[] = await api.exportAttendance(params);
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `attendance_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch {}
  }

  const logStats = {
    total: records.length,
    signedIn: records.filter(r => r.status === "signed_in").length,
    signedOut: records.filter(r => r.status === "signed_out").length,
    avgHours: records.filter(r => r.totalHours).length
      ? (records.reduce((s, r) => s + Number(r.totalHours || 0), 0) / records.filter(r => r.totalHours).length).toFixed(1)
      : "—",
  };

  // ── Salary calculator ──────────────────────────────────────────────────────
  async function loadPayroll() {
    setPayrollLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterCalcBranch) params.branchId = filterCalcBranch;
      if (filterMonth) params.month = filterMonth;
      const data = await api.getAttendancePayroll(params);
      setPayrollRows(data);
    } catch {
      setPayrollRows([]);
    } finally {
      setPayrollLoading(false);
    }
  }

  const rate = parseFloat(dailyRate) || 0;

  function calcSalary(days: number) {
    return rate * days;
  }

  function formatCurrency(n: number) {
    return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const totalPayroll = payrollRows.reduce((s, r) => s + calcSalary(r.totalDays), 0);

  function handleExportSalary() {
    if (!payrollRows.length) return;
    const headers = ["Staff Name", "Position", "Branch", "Days Worked", "Daily Rate (₦)", "Total Salary (₦)"];
    const csv = [
      headers.join(","),
      ...payrollRows.map(r => [
        `"${r.staffName}"`,
        `"${r.position}"`,
        `"${branchName(r.branchId)}"`,
        r.totalDays,
        rate.toFixed(2),
        calcSalary(r.totalDays).toFixed(2),
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `salary_calculation_${filterMonth}.csv`;
    a.click();
  }

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>💰 Payroll</h2>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>Staff attendance logs and salary calculations</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {tab === "logs" && (
            <button className="btn" onClick={handleExportLogs} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none" }}>
              ⬇️ Export CSV
            </button>
          )}
          {tab === "salary" && payrollRows.length > 0 && (
            <button className="btn" onClick={handleExportSalary} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none" }}>
              ⬇️ Export Salary CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {([["logs", "📋 Sign In / Out Logs"], ["salary", "💵 Salary Calculator"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); if (key === "salary" && !payrollRows.length) loadPayroll(); }}
            style={{
              padding: "8px 20px", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: tab === key ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
              color: tab === key ? "#fff" : "var(--muted)",
              transition: "all 0.2s",
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── TAB: LOGS ──────────────────────────────────────────────────────────── */}
      {tab === "logs" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Records", value: logStats.total, color: "#6366f1" },
              { label: "Currently In", value: logStats.signedIn, color: "#22c55e" },
              { label: "Signed Out", value: logStats.signedOut, color: "#94a3b8" },
              { label: "Avg Hours", value: logStats.avgHours + (logStats.avgHours !== "—" ? "h" : ""), color: "#f59e0b" },
            ].map(s => (
              <div key={s.label} className="glass" style={{ padding: "16px 20px", borderRadius: 12, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="glass" style={{ padding: 18, borderRadius: 14, marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 12 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Exact Date</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>From Date</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>To Date</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Branch</label>
                <select value={filterLogBranch} onChange={e => setFilterLogBranch(e.target.value)}>
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Staff Name</label>
                <input value={filterStaff} onChange={e => setFilterStaff(e.target.value)} placeholder="Search name…" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="signed_in">Signed In</option>
                  <option value="signed_out">Signed Out</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={loadLogs}>Apply Filters</button>
              <button className="btn secondary" onClick={clearLogFilters}>Clear</button>
            </div>
          </div>

          {/* Table */}
          <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
            {logsLoading ? (
              <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>Loading logs…</div>
            ) : records.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", opacity: 0.5, fontSize: 14 }}>No records found for the selected filters.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Date", "Staff Name", "Position", "Branch", "Sign In", "Sign Out", "Hours", "Status", "Recorded By"].map(h => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, opacity: 0.55, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "11px 14px", fontSize: 13 }}>{fmtDate(r.date)}</td>
                        <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13 }}>{r.staffName}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, opacity: 0.7 }}>{r.position}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, opacity: 0.7 }}>{branchName(r.branchId)}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "monospace", color: "#22c55e" }}>{fmt(r.signInTime)}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "monospace", color: r.signOutTime ? "#94a3b8" : "#f59e0b" }}>{fmt(r.signOutTime)}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "monospace" }}>{r.totalHours ? Number(r.totalHours).toFixed(1) + "h" : "—"}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{
                            padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                            background: r.status === "signed_in" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
                            color: r.status === "signed_in" ? "#22c55e" : "#94a3b8",
                          }}>
                            {r.status === "signed_in" ? "Signed In" : "Signed Out"}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 12, opacity: 0.55 }}>{r.recordedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: SALARY CALCULATOR ─────────────────────────────────────────────── */}
      {tab === "salary" && (
        <>
          {/* Calculator input bar */}
          <div className="glass" style={{ padding: 20, borderRadius: 14, marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Month</label>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 160 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Branch</label>
              <select value={filterCalcBranch} onChange={e => setFilterCalcBranch(e.target.value)} style={{ width: 180 }}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <button className="btn" onClick={loadPayroll}>Load Staff</button>

            {payrollRows.length > 0 && (
              <div className="field" style={{ margin: 0, marginLeft: "auto" }}>
                <label style={{ color: "#f59e0b", fontWeight: 700 }}>Daily Rate (₦) — applied to all staff</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={dailyRate}
                  onChange={e => setDailyRate(e.target.value)}
                  placeholder="e.g. 5000"
                  style={{ width: 200, fontWeight: 700, fontSize: 16 }}
                />
              </div>
            )}
          </div>

          {/* Summary stats */}
          {payrollRows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Staff Members", value: payrollRows.length, color: "#6366f1" },
                { label: "Total Man-Days", value: payrollRows.reduce((s, r) => s + r.totalDays, 0), color: "#22c55e" },
                { label: "Total Payroll", value: rate > 0 ? formatCurrency(totalPayroll) : "Enter daily rate", color: "#f59e0b" },
              ].map(s => (
                <div key={s.label} className="glass" style={{ padding: "16px 20px", borderRadius: 12, borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: rate > 0 && s.label === "Total Payroll" ? 20 : 26, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Salary table */}
          <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
            {payrollLoading ? (
              <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>Loading staff data…</div>
            ) : payrollRows.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", opacity: 0.5, fontSize: 14 }}>
                Select a month and click <strong>Load Staff</strong> to calculate salaries.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["#", "Staff Name", "Position", "Branch", "Days Worked", "Hours Worked", "Daily Rate", "Total Salary"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, opacity: 0.55, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRows.map((row, i) => {
                      const salary = calcSalary(row.totalDays);
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "13px 16px", opacity: 0.4, fontSize: 12 }}>{i + 1}</td>
                          <td style={{ padding: "13px 16px", fontWeight: 700, fontSize: 14 }}>{row.staffName}</td>
                          <td style={{ padding: "13px 16px", fontSize: 13, opacity: 0.7 }}>{row.position}</td>
                          <td style={{ padding: "13px 16px", fontSize: 13, opacity: 0.7 }}>{branchName(row.branchId)}</td>
                          <td style={{ padding: "13px 16px" }}>
                            <span style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                              {row.totalDays}d
                            </span>
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, fontFamily: "monospace", color: "#f59e0b" }}>
                            {row.totalHours.toFixed(1)}h
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, fontFamily: "monospace", opacity: rate > 0 ? 1 : 0.4 }}>
                            {rate > 0 ? formatCurrency(rate) : "—"}
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            {rate > 0 ? (
                              <span style={{
                                background: "rgba(34,197,94,0.15)", color: "#22c55e",
                                padding: "5px 12px", borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                              }}>
                                {formatCurrency(salary)}
                              </span>
                            ) : (
                              <span style={{ opacity: 0.35, fontSize: 13 }}>Enter daily rate ↑</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {rate > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                        <td colSpan={7} style={{ padding: "14px 16px", fontWeight: 700, fontSize: 13, textAlign: "right", opacity: 0.7 }}>
                          Total Payroll for {new Date(filterMonth + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            background: "rgba(245,158,11,0.2)", color: "#fbbf24",
                            padding: "6px 14px", borderRadius: 8, fontSize: 15, fontWeight: 800, fontFamily: "monospace",
                          }}>
                            {formatCurrency(totalPayroll)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
