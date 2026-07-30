import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api, type BarReport, type BarSale, type BarSaleItem, type KitchenOrder, type KitchenOrderItem } from "../../lib/api";
import { useSettings } from "../../context/SettingsContext";

const FOOD_STATUS_COLORS: Record<string, string> = {
  new: "#6366f1", accepted: "#3b82f6", preparing: "#f59e0b",
  ready: "#4ade80", served: "#94a3b8", cancelled: "#f87171",
};

function parseUnitPrice(notes: string | null | undefined): number {
  if (!notes) return 0;
  const m = notes.match(/₦([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

function foodOrderTotal(items: KitchenOrderItem[]): number {
  return items.reduce((sum, it) => sum + parseUnitPrice(it.notes) * it.quantity, 0);
}

const fmtFood = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Range = { from: string; to: string; label: string };

function todayRange(): { from: string; to: string } {
  const t = new Date().toISOString().slice(0, 10);
  return { from: t, to: t };
}

function esc(v: string | number | null | undefined) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateBarReportHtml(data: BarReport, range: Range, hotelName: string) {
  const fmt = (n: number | string) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  const topRows = data.topSelling.map(d => `<tr><td>${esc(d.name)}</td><td>${esc(d.category)}</td><td style="text-align:center">${d.qty}</td><td style="text-align:right">${fmt(d.revenue)}</td></tr>`).join("");
  const waiterRows = data.salesByWaiter.map(w => `<tr><td>${esc(w.name)}</td><td style="text-align:center">${w.sales}</td><td style="text-align:right">${fmt(w.revenue)}</td></tr>`).join("");
  const txRows = data.sales.slice(0, 50).map(s => `<tr><td>${esc(s.invoiceNumber)}</td><td>${esc(s.waiterName || "—")}</td><td>${esc(s.paymentMethod)}</td><td style="text-align:right">${fmt(s.totalAmount)}</td><td>${esc(new Date(s.createdAt).toLocaleString("en-NG"))}</td></tr>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Bar Report — ${esc(hotelName)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:32px;font-size:13px}
h1{font-size:22px;margin-bottom:2px}h2{font-size:15px;margin:24px 0 8px;border-bottom:2px solid #1a1a2e;padding-bottom:4px;color:#1a1a2e}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #1a1a2e;padding-bottom:16px}
.hotel-name{font-size:24px;font-weight:700;color:#1a1a2e}.meta{font-size:12px;color:#555;text-align:right}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
.summary-card{border:1px solid #ddd;border-radius:8px;padding:12px}.summary-card .label{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.5px}
.summary-card .value{font-size:18px;font-weight:700;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:4px;font-size:12px}th{background:#1a1a2e;color:#fff;padding:7px 10px;text-align:left;font-weight:600}
td{padding:6px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f8f8f8}
.footer{margin-top:32px;border-top:1px solid #ddd;padding-top:12px;font-size:11px;color:#888;display:flex;justify-content:space-between}
@media print{body{padding:16px}@page{margin:1.5cm}}</style></head><body>
<div class="header"><div><div class="hotel-name">${esc(hotelName)}</div><div>Bar Sales Report — ${esc(range.label)}</div></div>
<div class="meta"><div><strong>Period:</strong> ${esc(range.from)} to ${esc(range.to)}</div><div><strong>Generated:</strong> ${new Date().toLocaleString("en-NG")}</div></div></div>
<h2>Summary</h2>
<div class="summary">
<div class="summary-card"><div class="label">Total Revenue</div><div class="value">${fmt(data.totalRevenue)}</div></div>
<div class="summary-card"><div class="label">Transactions</div><div class="value">${data.totalTransactions}</div></div>
<div class="summary-card"><div class="label">Bottles Sold</div><div class="value">${data.totalBottlesSold}</div></div>
</div>
<h2>Top Selling Drinks</h2>
<table><thead><tr><th>Drink</th><th>Category</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${topRows}</tbody></table>
<h2>Sales by Waiter/Waitress</h2>
<table><thead><tr><th>Waiter</th><th style="text-align:center">Transactions</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${waiterRows}</tbody></table>
<h2>Transactions</h2>
<table><thead><tr><th>Invoice</th><th>Waiter</th><th>Method</th><th style="text-align:right">Amount</th><th>Date/Time</th></tr></thead><tbody>${txRows}</tbody></table>
${data.sales.length > 50 ? `<p style="color:#777;margin-top:8px;font-size:11px">Showing first 50 of ${data.sales.length} transactions.</p>` : ""}
<div class="footer"><span>${esc(hotelName)} — Confidential Bar Report</span><span>Generated: ${new Date().toLocaleString("en-NG")}</span></div>
</body></html>`;
}

export default function BarReports() {
  const { settings } = useSettings();
  const [report, setReport] = useState<BarReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>({ ...todayRange(), label: "Today" });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [error, setError] = useState("");

  // Food orders
  const [foodOrders, setFoodOrders] = useState<(KitchenOrder & { items: KitchenOrderItem[] })[] | null>(null);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState("");

  function applyPreset(label: string) {
    const today = new Date();
    const pad = (d: Date) => d.toISOString().slice(0, 10);
    if (label === "Today") { setRange({ from: pad(today), to: pad(today), label }); return; }
    if (label === "Yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      setRange({ from: pad(y), to: pad(y), label }); return;
    }
    if (label === "This Week") {
      const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
      setRange({ from: pad(mon), to: pad(today), label }); return;
    }
    if (label === "This Month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setRange({ from: pad(first), to: pad(today), label }); return;
    }
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setRange({ from: customFrom, to: customTo, label: `${customFrom} – ${customTo}` });
  }

  useEffect(() => {
    setLoading(true); setError("");
    api.getBarReports({ from: range.from, to: range.to })
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    setFoodLoading(true); setFoodError("");
    const fromISO = new Date(range.from + "T00:00:00").toISOString();
    const toISO = new Date(range.to + "T23:59:59.999").toISOString();
    api.getFoodSalesByDateRange("bar", fromISO, toISO)
      .then(setFoodOrders)
      .catch(e => setFoodError(e.message))
      .finally(() => setFoodLoading(false));
  }, [range.from, range.to]);

  const fmt = (n: number | string) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  function handlePrint() {
    if (!report) return;
    const html = generateBarReportHtml(report, range, settings?.hotelName || "AEH");
    const win = window.open("", "_blank", "width=960,height=700,noopener,noreferrer");
    if (!win) return;
    win.opener = null;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  function handleExportExcel() {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
      [settings?.hotelName || "AEH"],
      ["Bar Sales Report", range.label],
      [],
      ["Total Revenue (₦)", report.totalRevenue],
      ["Total Transactions", report.totalTransactions],
      ["Total Bottles Sold", report.totalBottlesSold],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    const topHeaders = ["Drink", "Category", "Qty Sold", "Revenue (₦)"];
    const topRows = report.topSelling.map(d => [d.name, d.category, d.qty, d.revenue]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([topHeaders, ...topRows]), "Top Selling");

    const waiterHeaders = ["Waiter", "Transactions", "Revenue (₦)"];
    const waiterRows = report.salesByWaiter.map(w => [w.name, w.sales, w.revenue]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([waiterHeaders, ...waiterRows]), "By Waiter");

    const txHeaders = ["Invoice", "Waiter", "Method", "Amount (₦)", "Date/Time", "Attendant"];
    const txRows = report.sales.map(s => [s.invoiceNumber, s.waiterName || "", s.paymentMethod, Number(s.totalAmount), new Date(s.createdAt).toLocaleString("en-NG"), s.barAttendantName]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]), "Transactions");

    XLSX.writeFile(wb, `bar-report-${range.from}-to-${range.to}.xlsx`);
  }

  function handleExportCSV() {
    if (!report) return;
    const header = "Invoice,Waiter,Method,Amount,Attendant,Date\n";
    const rows = report.sales.map(s => `${s.invoiceNumber},${s.waiterName || ""},${s.paymentMethod},${s.totalAmount},${s.barAttendantName},${s.createdAt}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bar-report-${range.from}-to-${range.to}.csv`;
    a.click();
  }

  function handleWaiterExportExcel() {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    const headers = ["Waiter/Waitress", "Transactions", "Revenue (₦)"];
    const rows = report.salesByWaiter.map(w => [w.name, w.sales, Number(w.revenue)]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Waiter Sales");
    XLSX.writeFile(wb, `waiter-sales-${range.from}-to-${range.to}.xlsx`);
  }

  function handleWaiterExportCSV() {
    if (!report) return;
    const header = "Waiter/Waitress,Transactions,Revenue (₦)\n";
    const rows = report.salesByWaiter.map(w => `${w.name},${w.sales},${w.revenue}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `waiter-sales-${range.from}-to-${range.to}.csv`;
    a.click();
  }

  function exportFoodExcel() {
    if (!foodOrders) return;
    const wb = XLSX.utils.book_new();
    const hotelName = settings?.hotelName || "AEH";
    const served = foodOrders.filter(o => o.status === "served").length;
    const cancelled = foodOrders.filter(o => o.status === "cancelled").length;
    const grandTotal = foodOrders.reduce((s, o) => s + foodOrderTotal(o.items ?? []), 0);
    // Build per-staff breakdown
    const staffMap = new Map<string, { orders: number; total: number }>();
    for (const o of foodOrders) {
      const name = o.staffName || "Unknown";
      const entry = staffMap.get(name) ?? { orders: 0, total: 0 };
      entry.orders += 1;
      entry.total += foodOrderTotal(o.items ?? []);
      staffMap.set(name, entry);
    }
    const staffRows: (string | number)[][] = Array.from(staffMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, v]) => [name, v.orders, v.total]);

    const summaryData = [
      [hotelName],
      ["Bar Food Sales Report", range.label],
      ["Period", `${range.from} to ${range.to}`],
      ["Generated", new Date().toLocaleString("en-NG")],
      [],
      ["Total Orders", foodOrders.length],
      ["Served", served],
      ["Cancelled", cancelled],
      ["Active / Pending", foodOrders.length - served - cancelled],
      ["Grand Total (₦)", grandTotal],
      [],
      ["Staff / Waiter Breakdown"],
      ["Name", "Orders", "Amount (₦)"],
      ...staffRows,
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1["!cols"] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    const orderHeaders = ["Order #", "Customer", "Table / Room", "Staff / Waiter", "Priority", "Status", "Items", "Amount (₦)", "Time"];
    const orderRows = foodOrders.map(o => [
      o.orderNumber, o.customerName ?? "", o.tableOrRoom ?? "",
      o.staffName, o.priority, o.status, o.items?.length ?? 0,
      foodOrderTotal(o.items ?? []),
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

    XLSX.writeFile(wb, `food-sales-bar-${range.from}-to-${range.to}.xlsx`);
  }

  function exportFoodCsv() {
    if (!foodOrders) return;
    const header = "Order #,Customer,Table / Room,Staff / Waiter,Priority,Status,Items,Amount (₦),Time\n";
    const rows = foodOrders.map(o =>
      [o.orderNumber, o.customerName ?? "", o.tableOrRoom ?? "", o.staffName, o.priority, o.status,
        o.items?.length ?? 0, foodOrderTotal(o.items ?? []), new Date(o.createdAt).toLocaleString("en-NG")]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `food-sales-bar-${range.from}-to-${range.to}.csv`;
    a.click();
  }

  function downloadWaiterDetail(waiterName: string) {
    if (!report) return;
    // Server groups null/empty waiter names as "Direct" — mirror that here
    const waiterSales = report.sales.filter(s => (s.waiterName || "Direct") === waiterName);
    const fmt2 = (n: number | string) => Number(n).toFixed(2);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summary = report.salesByWaiter.find(w => w.name === waiterName);
    const summaryData = [
      ["Waiter/Waitress", waiterName],
      ["Period", `${range.from} to ${range.to}`],
      ["Total Transactions", summary?.sales ?? waiterSales.length],
      ["Total Revenue (₦)", summary ? Number(summary.revenue) : waiterSales.reduce((s, x) => s + Number(x.totalAmount), 0)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    // Sheet 2: Transaction detail (one row per sale item)
    const detailHeaders = ["Invoice", "Date/Time", "Drink", "Category", "Qty", "Unit Price (₦)", "Subtotal (₦)", "Payment Method", "Attendant"];
    const detailRows: (string | number)[][] = [];
    for (const sale of waiterSales) {
      for (const item of sale.items) {
        detailRows.push([
          sale.invoiceNumber,
          new Date(sale.createdAt).toLocaleString("en-NG"),
          item.drinkName,
          item.category,
          item.quantity,
          Number(fmt2(item.unitPrice)),
          Number(fmt2(item.subtotal)),
          sale.paymentMethod,
          sale.barAttendantName,
        ]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]), "Transactions");

    XLSX.writeFile(wb, `${waiterName.replace(/\s+/g, "-")}-sales-${range.from}-to-${range.to}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Bar Reports</h1><p className="page-sub">Sales, revenue, and stock analysis</p></div>
        {report && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn secondary" onClick={handlePrint}>🖨️ Print</button>
            <button className="btn secondary" onClick={handleExportExcel}>📊 Excel</button>
            <button className="btn secondary" onClick={handleExportCSV}>📄 CSV</button>
          </div>
        )}
      </div>

      {/* Date Filters */}
      <div className="glass" style={{ padding: 16, borderRadius: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          {["Today", "Yesterday", "This Week", "This Month"].map(p => (
            <button key={p} className={`btn ${range.label === p ? "" : "secondary"}`} style={{ padding: "6px 16px" }} onClick={() => applyPreset(p)}>{p}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "inherit" }} />
          <span style={{ color: "var(--muted)" }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "inherit" }} />
          <button className="btn" style={{ padding: "6px 16px" }} onClick={applyCustom}>Apply</button>
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      {loading && <p style={{ color: "var(--muted)" }}>Loading report...</p>}

      {report && !loading && (
        <>
          {/* Summary Cards */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            {[
              { label: "Total Revenue", value: fmt(report.totalRevenue), icon: "💰" },
              { label: "Transactions", value: report.totalTransactions, icon: "🧾" },
              { label: "Bottles Sold", value: report.totalBottlesSold, icon: "🍾" },
              { label: "Low Stock Items", value: report.lowStockDrinks.length, icon: "⚠️" },
            ].map(c => (
              <div key={c.label} className="stat-card glass">
                <div className="stat-icon">{c.icon}</div>
                <div><div className="stat-value">{c.value}</div><div className="stat-label">{c.label}</div></div>
              </div>
            ))}
          </div>

          {/* Top Selling */}
          {report.topSelling.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 12 }}>Top Selling Drinks</h2>
              <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead><tr>{["Drink", "Category", "Qty Sold", "Revenue"].map(h => <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.topSelling.map((d, i) => (
                      <tr key={d.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                          <span style={{ color: "var(--muted)", marginRight: 8 }}>#{i + 1}</span>{d.name}
                        </td>
                        <td style={{ padding: "10px 14px" }}>{d.category}</td>
                        <td style={{ padding: "10px 14px" }}>{d.qty}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmt(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sales by Waiter */}
          {report.salesByWaiter.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2>Sales by Waiter/Waitress</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn secondary" style={{ fontSize: "0.8rem", padding: "5px 12px" }} onClick={handleWaiterExportExcel}>📊 Excel</button>
                  <button className="btn secondary" style={{ fontSize: "0.8rem", padding: "5px 12px" }} onClick={handleWaiterExportCSV}>📄 CSV</button>
                </div>
              </div>
              <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead><tr>{["Waiter", "Transactions", "Revenue"].map(h => <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.salesByWaiter.map(w => (
                      <tr key={w.name} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {w.name}
                            <button
                              onClick={() => downloadWaiterDetail(w.name)}
                              title={`Download ${w.name}'s sales as Excel`}
                              style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.5)", borderRadius: 6, cursor: "pointer", color: "#a5b4fc", fontSize: "0.72rem", padding: "2px 8px", fontWeight: 700, lineHeight: 1.6, whiteSpace: "nowrap", flexShrink: 0 }}
                            >
                              ⬇ Excel
                            </button>
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>{w.sales}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmt(w.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Low Stock */}
          {report.lowStockDrinks.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 12, color: "#f59e0b" }}>⚠️ Low Stock Items</h2>
              <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead><tr>{["Drink", "Category", "Qty Left", "Threshold"].map(h => <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.lowStockDrinks.map(d => (
                      <tr key={d.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.name}</td>
                        <td style={{ padding: "10px 14px" }}>{d.category}</td>
                        <td style={{ padding: "10px 14px", color: "#f59e0b", fontWeight: 700 }}>{d.quantityAvailable}</td>
                        <td style={{ padding: "10px 14px", color: "var(--muted)" }}>{d.lowStockThreshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions */}
          {report.sales.length > 0 && (
            <div>
              <h2 style={{ marginBottom: 12 }}>All Transactions ({report.sales.length})</h2>
              <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead><tr>{["Invoice", "Waiter", "Method", "Amount", "Attendant", "Date/Time"].map(h => <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.sales.map(s => (
                      <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "8px 14px", fontFamily: "monospace", fontSize: "0.8rem" }}>{s.invoiceNumber}</td>
                        <td style={{ padding: "8px 14px" }}>{s.waiterName || "—"}</td>
                        <td style={{ padding: "8px 14px", textTransform: "capitalize" }}>{s.paymentMethod.replace(/_/g, " ")}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600 }}>{fmt(s.totalAmount)}</td>
                        <td style={{ padding: "8px 14px", color: "var(--muted)" }}>{s.barAttendantName}</td>
                        <td style={{ padding: "8px 14px", color: "var(--muted)", fontSize: "0.8rem" }}>{new Date(s.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.sales.length === 0 && (
            <div className="glass" style={{ padding: 40, borderRadius: 12, textAlign: "center", color: "var(--muted)" }}>
              No sales data for {range.label}
            </div>
          )}
        </>
      )}

      {/* ── Food Orders ── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>🍽️ Food Orders from Bar — {range.label}</h2>
          {foodOrders && foodOrders.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn secondary" style={{ fontSize: "0.8rem", padding: "5px 12px" }} onClick={exportFoodExcel}>📊 Excel</button>
              <button className="btn secondary" style={{ fontSize: "0.8rem", padding: "5px 12px" }} onClick={exportFoodCsv}>📄 CSV</button>
            </div>
          )}
        </div>

        {foodOrders && foodOrders.length > 0 && (
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            {[
              { label: "Total Orders", value: foodOrders.length, icon: "📋" },
              { label: "Total Amount", value: fmtFood(foodOrders.reduce((s, o) => s + foodOrderTotal(o.items ?? []), 0)), icon: "💰" },
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
        {foodLoading && <p style={{ color: "var(--muted)" }}>Loading food orders...</p>}

        {!foodLoading && foodOrders && foodOrders.length === 0 && (
          <div className="glass" style={{ padding: 32, borderRadius: 12, textAlign: "center", color: "var(--muted)" }}>
            No food orders from bar for {range.label}.
          </div>
        )}

        {!foodLoading && foodOrders && foodOrders.length > 0 && (
          <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {["Order #", "Customer", "Table / Room", "Staff / Waiter", "Priority", "Status", "Items", "Amount", "Time"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foodOrders.map(o => {
                  const total = foodOrderTotal(o.items ?? []);
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
                        <span style={{ color: FOOD_STATUS_COLORS[o.status] ?? "inherit", fontWeight: 600, textTransform: "capitalize" }}>{o.status}</span>
                      </td>
                      <td style={{ padding: "8px 14px" }}>{o.items?.length ?? 0}</td>
                      <td style={{ padding: "8px 14px", fontWeight: 700, color: total > 0 ? "#6366f1" : "var(--muted)" }}>
                        {total > 0 ? fmtFood(total) : "—"}
                      </td>
                      <td style={{ padding: "8px 14px", color: "var(--muted)", fontSize: "0.8rem" }}>{new Date(o.createdAt).toLocaleString("en-NG")}</td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)" }}>
                  <td colSpan={7} style={{ padding: "10px 14px", fontWeight: 700, color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase" }}>Total</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "#6366f1" }}>
                    {fmtFood(foodOrders.reduce((s, o) => s + foodOrderTotal(o.items ?? []), 0))}
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
