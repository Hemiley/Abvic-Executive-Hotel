import { useEffect, useState } from "react";
import { api, type KitchenReportData, type KitchenOrder, type KitchenOrderItem } from "../../lib/api";

type FoodSaleOrder = KitchenOrder & { items: KitchenOrderItem[] };

const SOURCE_LABEL: Record<string, string> = {
  reception: "Receptionist",
  bar: "Waiter / Waitress",
  restaurant: "Restaurant",
  room_service: "Room Service",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "var(--success)",
  cancelled: "var(--danger)",
  preparing: "#f59e0b",
  accepted: "var(--accent)",
  pending: "var(--muted)",
};

export default function KitchenReports() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<KitchenReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Daily food sales state
  const [salesOrders, setSalesOrders] = useState<FoodSaleOrder[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [salesSource, setSalesSource] = useState<"all" | "reception" | "bar">("all");

  function load() {
    setLoading(true); setError("");
    api.getKitchenReports(from, to).then(setReport).catch(e => setError(e.message)).finally(() => setLoading(false));
  }

  function loadSales() {
    setSalesLoading(true); setSalesError("");
    const sources: Array<"reception" | "bar"> =
      salesSource === "all" ? ["reception", "bar"] : [salesSource];
    Promise.all(sources.map(s => api.getFoodSalesByDateRange(s, from, to)))
      .then(results => {
        const merged = results.flat();
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setSalesOrders(merged);
      })
      .catch(e => setSalesError(e.message))
      .finally(() => setSalesLoading(false));
  }

  useEffect(() => { load(); }, [from, to]);
  useEffect(() => { loadSales(); }, [from, to, salesSource]);

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

  function exportSalesCSV() {
    if (salesOrders.length === 0) return;
    const header = ["Order #", "Date & Time", "Source", "Staff", "Table / Room", "Customer", "Items", "Status"];
    const rows = salesOrders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString(),
      SOURCE_LABEL[o.source] ?? o.source,
      o.staffName,
      o.tableOrRoom ?? "—",
      o.customerName ?? "—",
      o.items.map(i => `${i.quantity}× ${i.mealName}`).join("; "),
      o.status,
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `food-sales-${from}-${to}.csv`;
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

      {/* ── Daily Food Sales ─────────────────────────────────────────────── */}
      <div className="glass" style={{ borderRadius: 12, padding: 20, marginTop: 28 }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>🧾 Daily Food Sales</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: 4 }}>
              Food orders placed by receptionists and waiters / waitresses
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Source filter */}
            <select
              value={salesSource}
              onChange={e => setSalesSource(e.target.value as any)}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "6px 10px", color: "inherit", fontSize: "0.85rem",
              }}
            >
              <option value="all">All Sources</option>
              <option value="reception">Receptionist</option>
              <option value="bar">Waiter / Waitress</option>
            </select>
            <button
              className="btn secondary"
              onClick={exportSalesCSV}
              disabled={salesOrders.length === 0}
              style={{ fontSize: "0.85rem" }}
            >
              ⬇ Download CSV
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {salesOrders.length > 0 && (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
            {[
              { label: "Total Orders", val: salesOrders.length },
              { label: "Completed", val: salesOrders.filter(o => o.status === "completed").length },
              { label: "Cancelled", val: salesOrders.filter(o => o.status === "cancelled").length },
              { label: "Total Items", val: salesOrders.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0) },
            ].map(({ label, val }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{val}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {salesError && <p className="error-text" style={{ marginBottom: 12 }}>{salesError}</p>}
        {salesLoading && <p style={{ color: "var(--muted)" }}>Loading sales...</p>}

        {!salesLoading && salesOrders.length === 0 && !salesError && (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>
            No food orders found for this period.
          </p>
        )}

        {salesOrders.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {["Order #", "Time", "Source", "Ordered By", "Table / Room", "Items", "Status"].map(h => (
                    <th key={h} style={{
                      padding: "8px 12px", textAlign: "left",
                      color: "var(--muted)", fontWeight: 600,
                      fontSize: "0.75rem", textTransform: "uppercase",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salesOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
                      {order.orderNumber}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      <div style={{ fontSize: "0.7rem" }}>{new Date(order.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span style={{
                        background: order.source === "reception" ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)",
                        color: order.source === "reception" ? "#a5b4fc" : "#fcd34d",
                        borderRadius: 6, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600,
                      }}>
                        {SOURCE_LABEL[order.source] ?? order.source}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600 }}>{order.staffName || "—"}</div>
                      {order.customerName && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>for {order.customerName}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{order.tableOrRoom || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {order.items.length === 0
                        ? <span style={{ color: "var(--muted)" }}>—</span>
                        : order.items.map((item, i) => (
                          <div key={i} style={{ whiteSpace: "nowrap" }}>
                            <strong>{item.quantity}×</strong> {item.mealName}
                            {item.notes && <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}> ({item.notes})</span>}
                          </div>
                        ))}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span style={{
                        color: STATUS_COLOR[order.status] ?? "var(--muted)",
                        fontWeight: 600, fontSize: "0.8rem", textTransform: "capitalize",
                      }}>
                        {order.status}
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
