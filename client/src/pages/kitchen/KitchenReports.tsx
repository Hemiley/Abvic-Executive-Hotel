import { useEffect, useState } from "react";
import { api, type KitchenReportData } from "../../lib/api";

export default function KitchenReports() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<KitchenReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true); setError("");
    api.getKitchenReports(from, to).then(setReport).catch(e => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [from, to]);

  function exportCSV() {
    if (!report) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Orders", report.totalOrders],
      ["Completed Orders", report.completedOrders],
      ["Cancelled Orders", report.cancelledOrders],
      ["Total Meals Prepared", report.totalMeals],
      ["", ""],
      ["Top Meals", "Count"],
      ...report.topMeals.map((m: any) => [m.mealName, m.count]),
      ["", ""],
      ["Stock Used", "Quantity"],
      ...report.stockUsage.map((s: any) => [`${s.itemName} (${s.unit})`, s.totalUsed]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `kitchen-report-${from}-${to}.csv`;
    a.click();
  }

  function exportPDF() { window.print(); }

  return (
    <div>
      <div className="page-header">
        <div><h1>Kitchen Reports</h1><p className="page-sub">Production, usage, and performance reports</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn secondary" onClick={exportCSV}>CSV</button>
          <button className="btn secondary" onClick={exportPDF}>PDF</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      {loading && <p style={{ color: "var(--muted)", marginBottom: 12 }}>Loading...</p>}

      {report && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
            {[
              { icon: "📋", label: "Total Orders", val: report.totalOrders },
              { icon: "✅", label: "Completed", val: report.completedOrders },
              { icon: "❌", label: "Cancelled", val: report.cancelledOrders },
              { icon: "🍽️", label: "Meals Prepared", val: report.totalMeals },
              { icon: "👨‍🍳", label: "Shifts", val: report.totalShifts },
            ].map(({ icon, label, val }) => (
              <div key={label} className="glass" style={{ borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{val}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Top Meals */}
            <div className="glass" style={{ borderRadius: 12, padding: 20 }}>
              <h3 style={{ marginBottom: 16 }}>🍽️ Most Ordered Meals</h3>
              {report.topMeals.length === 0
                ? <p style={{ color: "var(--muted)" }}>No data for this period</p>
                : report.topMeals.map((m: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "0.875rem" }}>
                    <span>{m.mealName}</span>
                    <strong>{m.count}×</strong>
                  </div>
                ))}
            </div>

            {/* Stock Usage */}
            <div className="glass" style={{ borderRadius: 12, padding: 20 }}>
              <h3 style={{ marginBottom: 16 }}>🥩 Ingredient Usage</h3>
              {report.stockUsage.length === 0
                ? <p style={{ color: "var(--muted)" }}>No stock movements in this period</p>
                : report.stockUsage.map((s: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "0.875rem" }}>
                    <span>{s.itemName}</span>
                    <strong>{Number(s.totalUsed).toFixed(2)} {s.unit}</strong>
                  </div>
                ))}
            </div>
          </div>

          {/* Shift performance */}
          {report.shifts.length > 0 && (
            <div className="glass" style={{ borderRadius: 12, padding: 20, marginTop: 20 }}>
              <h3 style={{ marginBottom: 16 }}>👨‍🍳 Shift Performance</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr>
                    {["Chef", "Date", "Duration", "Orders Completed", "Notes"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.shifts.map((s: any) => {
                    const dur = s.endTime
                      ? Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)
                      : null;
                    return (
                      <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{s.chefName}</td>
                        <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{new Date(s.startTime).toLocaleDateString()}</td>
                        <td style={{ padding: "8px 12px" }}>{dur ? `${Math.floor(dur / 60)}h ${dur % 60}m` : "Active"}</td>
                        <td style={{ padding: "8px 12px" }}>{s.ordersCompleted}</td>
                        <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{s.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
