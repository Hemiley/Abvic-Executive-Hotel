import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api, type KitchenOrder, type KitchenOrderItem, type StockSubmission } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS: Record<string, string> = {
  new: "#6366f1", accepted: "#3b82f6", preparing: "#f59e0b",
  ready: "#4ade80", served: "#94a3b8", cancelled: "#f87171",
};

/** Parse unit price from the note string written by FoodOrderPage (e.g. "₦1,500/kg"). */
function parseUnitPrice(notes: string | null | undefined): number {
  if (!notes) return 0;
  const m = notes.match(/₦([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

function orderTotal(items: KitchenOrderItem[]): number {
  return items.reduce((sum, it) => sum + parseUnitPrice(it.notes) * it.quantity, 0);
}

const fmt = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dayRange(date: string) {
  return {
    from: new Date(date + "T00:00:00").toISOString(),
    to: new Date(date + "T23:59:59.999").toISOString(),
  };
}

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";

  // Hotel summary (admin/supervisor only)
  const [summary, setSummary] = useState<any>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [stockRows, setStockRows] = useState<StockSubmission[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");

  // Food sales
  const [foodDate, setFoodDate] = useState(todayStr());
  const [foodOrders, setFoodOrders] = useState<(KitchenOrder & { items: KitchenOrderItem[] })[] | null>(null);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    setError("");
    api
      .getReportsSummary({ from: fromDate || undefined, to: toDate || undefined })
      .then(setSummary)
      .catch((err) => setError(err.message || "Failed to load report"));
  }, [fromDate, toDate, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadStock = () => {
      setStockLoading(true);
      setStockError("");
      api.getStockSubmissions({ from: fromDate || undefined, to: toDate || undefined })
        .then(setStockRows)
        .catch(err => setStockError(err.message || "Failed to load stock submissions"))
        .finally(() => setStockLoading(false));
    };
    loadStock();
    const refresh = setInterval(loadStock, 30000);
    return () => clearInterval(refresh);
  }, [fromDate, toDate, isAdmin]);

  useEffect(() => {
    setFoodLoading(true);
    setFoodError("");
    const { from, to } = dayRange(foodDate);
    api
      .getFoodSalesByDateRange("reception", from, to)
      .then(setFoodOrders)
      .catch((e) => setFoodError(e.message || "Failed to load food sales"))
      .finally(() => setFoodLoading(false));
  }, [foodDate]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const qs = params.toString();
    window.open(`/api/reports/export.csv${qs ? `?${qs}` : ""}`, "_blank");
  }

  function exportStockCsv() {
    const headers = ["Department", "Submitted By", "Item", "Quantity", "Submitted At", "Status", "Accepted By", "Accepted At", "Note"];
    const rows = stockRows.map(item => [
      item.department, item.submittedByName, item.itemName, `${item.quantity} ${item.unit}`,
      new Date(item.submittedAt).toLocaleString("en-NG"), item.status,
      item.acceptedByName || "", item.acceptedAt ? new Date(item.acceptedAt).toLocaleString("en-NG") : "", item.note || "",
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `stock-submissions${fromDate ? `-${fromDate}` : ""}${toDate ? `-to-${toDate}` : ""}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function exportFoodExcel() {
    if (!foodOrders) return;
    const wb = XLSX.utils.book_new();

    const served = foodOrders.filter(o => o.status === "served").length;
    const cancelled = foodOrders.filter(o => o.status === "cancelled").length;
    const grandTotal = foodOrders.reduce((s, o) => s + orderTotal(o.items ?? []), 0);
    const summaryData = [
      ["Reception Food Sales — Daily Report"],
      ["Date", foodDate],
      ["Generated", new Date().toLocaleString("en-NG")],
      [],
      ["Total Orders", foodOrders.length],
      ["Served", served],
      ["Cancelled", cancelled],
      ["Active / Pending", foodOrders.length - served - cancelled],
      ["Grand Total (₦)", grandTotal],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    const orderHeaders = ["Order #", "Customer", "Table / Room", "Staff / Waiter", "Priority", "Status", "Items", "Amount (₦)", "Time"];
    const orderRows = foodOrders.map(o => [
      o.orderNumber, o.customerName ?? "", o.tableOrRoom ?? "",
      o.staffName, o.priority, o.status,
      o.items?.length ?? 0,
      orderTotal(o.items ?? []),
      new Date(o.createdAt).toLocaleString("en-NG"),
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
    ws2["!cols"] = orderHeaders.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws2, "Orders");

    const itemHeaders = ["Order #", "Staff / Waiter", "Meal", "Qty", "Unit Price (₦)", "Subtotal (₦)", "Notes"];
    const itemRows: (string | number)[][] = [];
    for (const o of foodOrders) {
      for (const it of o.items ?? []) {
        const up = parseUnitPrice(it.notes);
        itemRows.push([o.orderNumber, o.staffName, it.mealName, it.quantity, up, up * it.quantity, it.notes ?? ""]);
      }
    }
    const ws3 = XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows]);
    ws3["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Items Detail");

    XLSX.writeFile(wb, `food-sales-reception-${foodDate}.xlsx`);
  }

  function exportFoodCsv() {
    if (!foodOrders) return;
    const header = "Order #,Customer,Table / Room,Staff / Waiter,Priority,Status,Items,Amount (₦),Time\n";
    const rows = foodOrders.map(o =>
      [o.orderNumber, o.customerName ?? "", o.tableOrRoom ?? "", o.staffName, o.priority, o.status,
        o.items?.length ?? 0, orderTotal(o.items ?? []), new Date(o.createdAt).toLocaleString("en-NG")]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `food-sales-reception-${foodDate}.csv`;
    a.click();
  }

  const cards = summary
    ? [
        { label: "Total Bookings", value: summary.totalBookings },
        { label: "Total Reservations", value: summary.totalReservations },
        { label: "Guest Check-ins", value: summary.checkIns },
        { label: "Guest Check-outs", value: summary.checkOuts },
        { label: "Occupancy Rate", value: `${summary.occupancyRate}%` },
        { label: "Revenue Summary", value: `₦${summary.totalRevenue.toFixed(2)}` },
      ]
    : [];

  return (
    <div>
      {/* ── Hotel Summary (admin/supervisor only) ── */}
      {isAdmin && (
        <>
          <div className="page-header">
            <div>
              <h1>Reports</h1>
              <p className="page-sub">Daily sales, bookings, occupancy, and revenue summaries</p>
            </div>
            <button className="btn" onClick={exportCsv}>Export CSV</button>
          </div>

          <div className="card glass" style={{ marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate || undefined} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate || undefined} />
            </div>
            {(fromDate || toDate) && (
              <button type="button" className="btn" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</button>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="stat-grid" style={{ marginBottom: 32 }}>
            {cards.map((c) => (
              <div key={c.label} className="stat-card glass">
                <div>
                  <div className="stat-value">{c.value}</div>
                  <div className="stat-label">{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          <section style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>📦 Stock Submissions</h2>
                <p className="page-sub" style={{ margin: "4px 0 0" }}>Submitted stock, current acceptance status, and the staff member who accepted it.</p>
              </div>
              {stockRows.length > 0 && <button className="btn secondary" onClick={exportStockCsv}>Download Stock CSV</button>}
            </div>
            {stockError && <p className="error-text">{stockError}</p>}
            {stockLoading && <p style={{ color: "var(--muted)" }}>Loading stock submissions…</p>}
            {!stockLoading && stockRows.length === 0 && !stockError && (
              <div className="glass" style={{ borderRadius: 12, padding: 24, textAlign: "center", color: "var(--muted)" }}>No stock submissions in this date range.</div>
            )}
            {!stockLoading && stockRows.length > 0 && (
              <div className="glass" style={{ borderRadius: 12, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".84rem", minWidth: 900 }}>
                  <thead>
                    <tr>
                      {["Area", "Submitted By", "Item", "Quantity", "Submitted", "Status", "Accepted By", "Accepted At", "Note"].map(header => (
                        <th key={header} style={{ padding: "10px 12px", textAlign: "left", background: "rgba(255,255,255,.05)", color: "var(--muted)", fontSize: ".72rem", textTransform: "uppercase" }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map(item => (
                      <tr key={item.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        <td style={{ padding: "9px 12px", textTransform: "capitalize" }}>{item.department}</td>
                        <td style={{ padding: "9px 12px", fontWeight: 600 }}>{item.submittedByName}</td>
                        <td style={{ padding: "9px 12px" }}>{item.itemName}</td>
                        <td style={{ padding: "9px 12px" }}>{item.quantity} {item.unit}</td>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>{new Date(item.submittedAt).toLocaleString("en-NG")}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ color: item.status === "accepted" ? "#4ade80" : "#f59e0b", fontWeight: 700, textTransform: "capitalize" }}>{item.status}</span>
                        </td>
                        <td style={{ padding: "9px 12px" }}>{item.acceptedByName || "—"}</td>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>{item.acceptedAt ? new Date(item.acceptedAt).toLocaleString("en-NG") : "—"}</td>
                        <td style={{ padding: "9px 12px" }}>{item.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Daily Food Sales ── */}
      <div>
        {!isAdmin && (
          <div className="page-header">
            <div>
              <h1>Reports</h1>
              <p className="page-sub">Daily food order sales from reception</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>🍽️ Daily Food Sales</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={foodDate}
              onChange={(e) => setFoodDate(e.target.value)}
              max={todayStr()}
              style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "inherit" }}
            />
            {foodOrders && foodOrders.length > 0 && (
              <>
                <button className="btn secondary" style={{ padding: "6px 14px", fontSize: "0.85rem" }} onClick={exportFoodExcel}>📊 Excel</button>
                <button className="btn secondary" style={{ padding: "6px 14px", fontSize: "0.85rem" }} onClick={exportFoodCsv}>📄 CSV</button>
              </>
            )}
          </div>
        </div>

        {/* Summary cards */}
        {foodOrders && foodOrders.length > 0 && (
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            {[
              { label: "Total Orders", value: foodOrders.length, icon: "📋" },
              { label: "Total Amount", value: fmt(foodOrders.reduce((s, o) => s + orderTotal(o.items ?? []), 0)), icon: "💰" },
              { label: "Served", value: foodOrders.filter(o => o.status === "served").length, icon: "✅" },
              { label: "Cancelled", value: foodOrders.filter(o => o.status === "cancelled").length, icon: "❌" },
            ].map(c => (
              <div key={c.label} className="stat-card glass">
                <div className="stat-icon">{c.icon}</div>
                <div><div className="stat-value">{c.value}</div><div className="stat-label">{c.label}</div></div>
              </div>
            ))}
          </div>
        )}

        {foodError && <p className="error-text" style={{ marginBottom: 12 }}>{foodError}</p>}
        {foodLoading && <p style={{ color: "var(--muted)" }}>Loading food sales...</p>}

        {!foodLoading && foodOrders && foodOrders.length === 0 && (
          <div className="glass" style={{ padding: 40, borderRadius: 12, textAlign: "center", color: "var(--muted)" }}>
            No food orders from reception on {foodDate}.
          </div>
        )}

        {!foodLoading && foodOrders && foodOrders.length > 0 && (
          <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  {["Order #", "Customer", "Table / Room", "Staff / Waiter", "Priority", "Status", "Items", "Amount", "Time"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foodOrders.map(o => {
                  const total = orderTotal(o.items ?? []);
                  return (
                    <tr key={o.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "8px 14px", fontFamily: "monospace", fontSize: "0.8rem" }}>#{o.orderNumber}</td>
                      <td style={{ padding: "8px 14px" }}>{o.customerName || "—"}</td>
                      <td style={{ padding: "8px 14px" }}>{o.tableOrRoom || "—"}</td>
                      <td style={{ padding: "8px 14px", fontWeight: 600 }}>{o.staffName}</td>
                      <td style={{ padding: "8px 14px", textTransform: "capitalize" }}>
                        <span style={{ fontWeight: o.priority !== "normal" ? 700 : 400, color: o.priority === "vip" ? "#f59e0b" : o.priority === "urgent" ? "#f87171" : "inherit" }}>{o.priority}</span>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <span style={{ color: STATUS_COLORS[o.status] ?? "inherit", fontWeight: 600, textTransform: "capitalize" }}>{o.status}</span>
                      </td>
                      <td style={{ padding: "8px 14px" }}>{o.items?.length ?? 0}</td>
                      <td style={{ padding: "8px 14px", fontWeight: 700, color: total > 0 ? "#6366f1" : "var(--muted)" }}>
                        {total > 0 ? fmt(total) : "—"}
                      </td>
                      <td style={{ padding: "8px 14px", color: "var(--muted)", fontSize: "0.8rem" }}>{new Date(o.createdAt).toLocaleTimeString("en-NG")}</td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)" }}>
                  <td colSpan={7} style={{ padding: "10px 14px", fontWeight: 700, color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase" }}>Total</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "#6366f1" }}>
                    {fmt(foodOrders.reduce((s, o) => s + orderTotal(o.items ?? []), 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
