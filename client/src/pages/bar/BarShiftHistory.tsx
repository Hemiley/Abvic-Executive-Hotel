import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api, type BarShift, type KitchenOrder, type KitchenOrderItem, type StockSubmission } from "../../lib/api";
import { useSettings } from "../../context/SettingsContext";

function esc(v: string | number | null | undefined) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateShiftReportHtml(shift: BarShift, hotelName: string, acceptedStock: StockSubmission[]) {
  const fmt = (n: string | number | null | undefined) => `₦${Number(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  const openingRows = (shift.openingStockSnapshot as any[]).map(i =>
    `<tr><td>${esc(i.name)}</td><td style="text-align:center">${i.quantity}</td></tr>`).join("");
  const closingRows = (shift.closingStockSnapshot as any[]).map(i =>
    `<tr><td>${esc(i.name)}</td><td style="text-align:center">${i.quantity}</td></tr>`).join("");
  const acceptedRows = acceptedStock.map(item =>
    `<tr><td>${esc(item.itemName)}</td><td style="text-align:center">${esc(item.quantity)} ${esc(item.unit)}</td><td>${esc(item.submittedByName)}</td><td>${esc(item.acceptedByName)}</td><td>${esc(item.acceptedAt ? new Date(item.acceptedAt).toLocaleString("en-NG") : "")}</td></tr>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Bar Shift Report — ${esc(hotelName)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:32px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #1a1a2e;padding-bottom:16px}
.hotel-name{font-size:24px;font-weight:700;color:#1a1a2e}.meta{font-size:12px;color:#555;text-align:right}
h2{font-size:15px;margin:20px 0 8px;border-bottom:2px solid #1a1a2e;padding-bottom:4px;color:#1a1a2e}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
.card{border:1px solid #ddd;border-radius:8px;padding:12px}.card .lbl{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.5px}
.card .val{font-size:18px;font-weight:700;margin-top:4px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
table{width:100%;border-collapse:collapse;margin-top:4px;font-size:12px}
th{background:#1a1a2e;color:#fff;padding:7px 10px;text-align:left;font-weight:600}
td{padding:6px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f8f8f8}
.footer{margin-top:32px;border-top:1px solid #ddd;padding-top:12px;font-size:11px;color:#888;text-align:center}
@media print{body{padding:16px}@page{margin:1.5cm}}</style></head><body>
<div class="header"><div><div class="hotel-name">${esc(hotelName)}</div><div>Bar Shift Summary Report</div></div>
<div class="meta"><div><strong>Attendant:</strong> ${esc(shift.barAttendantName)}</div>
<div><strong>Shift Start:</strong> ${new Date(shift.openTime).toLocaleString("en-NG")}</div>
<div><strong>Shift End:</strong> ${shift.closeTime ? new Date(shift.closeTime).toLocaleString("en-NG") : "Active"}</div></div></div>
<h2>Shift Summary</h2>
<div class="cards">
<div class="card"><div class="lbl">Total Revenue</div><div class="val">${fmt(shift.totalRevenue)}</div></div>
<div class="card"><div class="lbl">Bottles Sold</div><div class="val">${shift.totalBottlesSold}</div></div>
<div class="card"><div class="lbl">Transactions</div><div class="val">${shift.totalTransactions}</div></div>
</div>
<h2>Stock Comparison</h2>
<div class="cols">
<div><h3 style="font-size:13px;margin-bottom:6px">Opening Stock</h3>
<table><thead><tr><th>Drink</th><th style="text-align:center">Qty</th></tr></thead><tbody>${openingRows || "<tr><td colspan='2'>No snapshot</td></tr>"}</tbody></table></div>
<div><h3 style="font-size:13px;margin-bottom:6px">Closing Stock</h3>
<table><thead><tr><th>Drink</th><th style="text-align:center">Qty</th></tr></thead><tbody>${closingRows || "<tr><td colspan='2'>No snapshot</td></tr>"}</tbody></table></div>
</div>
<h2>Stock Received and Accepted During This Shift</h2>
<table><thead><tr><th>Drink</th><th>Quantity</th><th>Submitted By</th><th>Accepted By</th><th>Accepted At</th></tr></thead><tbody>${acceptedRows || "<tr><td colspan='5'>No stock was accepted during this shift.</td></tr>"}</tbody></table>
<div class="footer">${esc(hotelName)} — Bar Shift Report | Confidential</div>
</body></html>`;
}

export default function BarShiftHistory() {
  const { settings } = useSettings();
  const [shifts, setShifts] = useState<BarShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    api.getBarShifts().then(setShifts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function downloadFoodSales(shift: BarShift) {
    if (!shift.closeTime) return;
    setDownloadingId(shift.id);
    try {
      const orders = await api.getFoodSalesByDateRange(
        "bar",
        new Date(shift.openTime).toISOString(),
        new Date(shift.closeTime).toISOString(),
      );
      const hotelName = settings?.hotelName || "AEH";
      const date = new Date(shift.openTime).toISOString().slice(0, 10);
      const safeName = (s: string) => s.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "-");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const totalOrders = orders.length;
      const servedOrders = orders.filter((o: KitchenOrder) => o.status === "served").length;
      const cancelledOrders = orders.filter((o: KitchenOrder) => o.status === "cancelled").length;
      const summaryData = [
        [hotelName],
        ["Bar Food Sales — Shift Summary"],
        [],
        ["Attendant", shift.barAttendantName],
        ["Shift Start", new Date(shift.openTime).toLocaleString("en-NG")],
        ["Shift End", new Date(shift.closeTime).toLocaleString("en-NG")],
        ["Report Date", new Date().toLocaleString("en-NG")],
        [],
        ["Total Food Orders", totalOrders],
        ["Served", servedOrders],
        ["Cancelled", cancelledOrders],
        ["Other", totalOrders - servedOrders - cancelledOrders],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 24 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // Sheet 2: Orders
      const orderHeaders = ["Order #", "Customer", "Table / Room", "Staff", "Priority", "Status", "Items", "Time"];
      const orderRows = (orders as (KitchenOrder & { items: KitchenOrderItem[] })[]).map(o => [
        o.orderNumber,
        o.customerName ?? "",
        o.tableOrRoom ?? "",
        o.staffName,
        o.priority,
        o.status,
        o.items?.length ?? 0,
        new Date(o.createdAt).toLocaleString("en-NG"),
      ]);
      const wsOrders = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
      wsOrders["!cols"] = orderHeaders.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsOrders, "Food Orders");

      // Sheet 3: Items detail
      const itemHeaders = ["Order #", "Meal", "Qty", "Notes"];
      const itemRows: (string | number)[][] = [];
      for (const o of orders as (KitchenOrder & { items: KitchenOrderItem[] })[]) {
        for (const it of o.items ?? []) {
          itemRows.push([o.orderNumber, it.mealName, it.quantity, it.notes ?? ""]);
        }
      }
      const wsItems = XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows]);
      wsItems["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsItems, "Items Detail");

      XLSX.writeFile(wb, `food-sales-bar-${safeName(shift.barAttendantName)}-${date}.xlsx`);
    } catch (e: any) {
      alert("Could not download food sales: " + e.message);
    } finally {
      setDownloadingId(null);
    }
  }

  async function printShift(shift: BarShift) {
    try {
    const report = await api.getBarShiftReport(shift.id);
    const html = generateShiftReportHtml(report.shift, settings?.hotelName || "AEH", report.acceptedStock);
    const win = window.open("", "_blank", "width=900,height=700,noopener,noreferrer");
    if (!win) return;
    win.opener = null;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    } catch (e: any) {
      alert("Could not load shift report: " + e.message);
    }
  }

  async function downloadShiftReport(shift: BarShift) {
    setDownloadingId(shift.id);
    try {
      const report = await api.getBarShiftReport(shift.id);
      const wb = XLSX.utils.book_new();
      const summary = [
        [settings?.hotelName || "AEH"],
        ["Bar Shift Report"],
        ["Attendant", report.shift.barAttendantName],
        ["Shift Start", new Date(report.shift.openTime).toLocaleString("en-NG")],
        ["Shift End", report.shift.closeTime ? new Date(report.shift.closeTime).toLocaleString("en-NG") : "Active"],
        ["Total Revenue", Number(report.shift.totalRevenue)],
        ["Bottles Sold", report.shift.totalBottlesSold],
        ["Transactions", report.shift.totalTransactions],
        ["Stock Accepted", report.acceptedStock.length],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summary);
      summarySheet["!cols"] = [{ wch: 24 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      const stockHeaders = ["Item", "Quantity", "Submitted By", "Submitted At", "Status", "Accepted By", "Accepted At", "Note"];
      const stockRows = report.acceptedStock.map(item => [
        item.itemName, `${item.quantity} ${item.unit}`, item.submittedByName,
        new Date(item.submittedAt).toLocaleString("en-NG"), item.status,
        item.acceptedByName || "", item.acceptedAt ? new Date(item.acceptedAt).toLocaleString("en-NG") : "", item.note || "",
      ]);
      const stockSheet = XLSX.utils.aoa_to_sheet([stockHeaders, ...(stockRows.length ? stockRows : [["No stock accepted during this shift"]])]);
      stockSheet["!cols"] = stockHeaders.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, stockSheet, "Accepted Stock");
      XLSX.writeFile(wb, `bar-shift-${shift.barAttendantName.replace(/[^a-z0-9-]+/gi, "-")}-${new Date(shift.openTime).toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      alert("Could not download shift report: " + e.message);
    } finally {
      setDownloadingId(null);
    }
  }

  const fmt = (n: string | number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="page-header">
        <div><h1>Bar Shift History</h1><p className="page-sub">All past and active bar shifts</p></div>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Loading shifts...</p>}

      {!loading && shifts.length === 0 && (
        <div className="glass" style={{ padding: 40, borderRadius: 12, textAlign: "center", color: "var(--muted)" }}>No bar shifts recorded yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shifts.map(s => (
          <div key={s.id} className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            >
              <span className={`dot ${s.status === "active" ? "dot-active" : "dot-inactive"}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.barAttendantName}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{new Date(s.openTime).toLocaleString()} {s.closeTime ? `→ ${new Date(s.closeTime).toLocaleString()}` : "(active)"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{fmt(s.totalRevenue)}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{s.totalTransactions} transactions · {s.totalBottlesSold} bottles</div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{expandedId === s.id ? "▲" : "▼"}</span>
            </div>

            {expandedId === s.id && (
              <div style={{ padding: "0 18px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, margin: "12px 0" }}>
                  {[
                    { label: "Total Revenue", value: fmt(s.totalRevenue) },
                    { label: "Bottles Sold", value: s.totalBottlesSold },
                    { label: "Transactions", value: s.totalTransactions },
                    { label: "Status", value: s.status === "active" ? "🟢 Active" : "🔴 Closed" },
                  ].map(c => (
                    <div key={c.label} className="glass" style={{ padding: "10px 14px", borderRadius: 10 }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 4 }}>{c.label}</div>
                      <div style={{ fontWeight: 700 }}>{c.value}</div>
                    </div>
                  ))}
                </div>
                {s.status === "closed" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <button className="btn secondary" onClick={() => printShift(s)}>🖨️ Print Shift Report</button>
                    <button className="btn secondary" disabled={downloadingId === s.id} onClick={() => downloadShiftReport(s)}>
                      {downloadingId === s.id ? "Preparing…" : "⬇️ Download Shift Report"}
                    </button>
                    <button
                      className="btn secondary"
                      disabled={downloadingId === s.id}
                      onClick={() => downloadFoodSales(s)}
                    >
                      {downloadingId === s.id ? "Preparing…" : "🍽️ Download Food Sales"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
