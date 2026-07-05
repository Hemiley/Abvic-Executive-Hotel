import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type DashboardSummary, type Shift, type Payment, type Reservation, type Guest, type Room, type HotelSettings } from "../lib/api";

// ── HTML escape helper — prevents XSS from user-controlled data in report ─────
function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Printable report generator ────────────────────────────────────────────────
function generateReportHtml(data: {
  shift: Shift;
  payments: Payment[];
  reservations: (Reservation & { guest?: Guest; room?: Room })[];
  settings: HotelSettings;
}): string {
  const { shift, payments, reservations, settings } = data;
  const fmt = (n: string | number | null | undefined) =>
    `₦${Number(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString("en-NG") : "—";
  const payTotal = payments.filter((p) => p.type === "payment").reduce((s, p) => s + Number(p.amount), 0);
  const refTotal = payments.filter((p) => p.type === "refund").reduce((s, p) => s + Number(p.amount), 0);

  const bookingRows = reservations
    .map(
      (r) => `
      <tr>
        <td>${esc(r.room?.roomNumber ?? "—")}</td>
        <td>${esc(r.room?.roomType ?? "—")}</td>
        <td>${esc(r.guest?.fullName ?? "—")}</td>
        <td>${r.stayType === "short_rest" ? `Short Rest (${esc(r.durationHours ?? 1)}h)` : "Lodge"}</td>
        <td>${esc(r.checkInDate)}</td>
        <td>${esc(r.checkOutDate)}</td>
        <td style="text-align:right">${fmt(payments.filter((p) => p.reservationId === r.id && p.type === "payment").reduce((s, p) => s + Number(p.amount), 0))}</td>
      </tr>`
    )
    .join("");

  const paymentRows = payments
    .map(
      (p) => `
      <tr>
        <td>${esc(fmtDate(p.createdAt))}</td>
        <td style="text-transform:capitalize">${esc(p.method.replace(/_/g, " "))}</td>
        <td style="text-transform:capitalize">${esc(p.type)}</td>
        <td style="text-align:right">${fmt(p.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Shift Report — ${esc(settings.hotelName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:32px;font-size:13px}
  h1{font-size:22px;margin-bottom:2px}
  h2{font-size:15px;margin:24px 0 8px;border-bottom:2px solid #1a1a2e;padding-bottom:4px;color:#1a1a2e}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #1a1a2e;padding-bottom:16px}
  .hotel-name{font-size:24px;font-weight:700;color:#1a1a2e}
  .report-title{font-size:13px;color:#555;margin-top:4px}
  .badge{display:inline-block;background:#1a1a2e;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px}
  .meta{font-size:12px;color:#555;text-align:right}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
  .summary-card{border:1px solid #ddd;border-radius:8px;padding:12px}
  .summary-card .label{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.5px}
  .summary-card .value{font-size:18px;font-weight:700;margin-top:4px}
  .breakdown{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .breakdown-item{border:1px solid #eee;border-radius:6px;padding:10px}
  .breakdown-item .label{font-size:11px;color:#777}
  .breakdown-item .value{font-weight:600;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-top:4px;font-size:12px}
  th{background:#1a1a2e;color:#fff;padding:7px 10px;text-align:left;font-weight:600}
  td{padding:6px 10px;border-bottom:1px solid #eee}
  tr:nth-child(even) td{background:#f8f8f8}
  .variance-ok{color:#16a34a;font-weight:600}
  .variance-bad{color:#dc2626;font-weight:600}
  .footer{margin-top:32px;border-top:1px solid #ddd;padding-top:12px;font-size:11px;color:#888;display:flex;justify-content:space-between}
  @media print{
    body{padding:16px}
    @page{margin:1.5cm}
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="hotel-name">${esc(settings.hotelName)}</div>
    <div class="report-title">End-of-Shift Report &nbsp;<span class="badge">OFFICIAL</span></div>
  </div>
  <div class="meta">
    <div><strong>Receptionist:</strong> ${esc(shift.receptionistName)}</div>
    <div><strong>Shift Start:</strong> ${esc(fmtDate(shift.loginTime))}</div>
    <div><strong>Shift End:</strong> ${esc(fmtDate(shift.logoutTime))}</div>
    <div><strong>Report Generated:</strong> ${esc(new Date().toLocaleString("en-NG"))}</div>
  </div>
</div>

<h2>Shift Summary</h2>
<div class="summary">
  <div class="summary-card">
    <div class="label">Guests Served</div>
    <div class="value">${shift.guestsServed}</div>
  </div>
  <div class="summary-card">
    <div class="label">Rooms Booked</div>
    <div class="value">${shift.roomsBooked}</div>
  </div>
  <div class="summary-card">
    <div class="label">Total Revenue</div>
    <div class="value">${fmt(shift.totalSales)}</div>
  </div>
</div>

<h2>Cash Reconciliation</h2>
<div class="breakdown">
  <div class="breakdown-item">
    <div class="label">Opening Balance</div>
    <div class="value">${fmt(shift.openingBalance)}</div>
  </div>
  <div class="breakdown-item">
    <div class="label">Closing Balance</div>
    <div class="value">${fmt(shift.closingBalance)}</div>
  </div>
  <div class="breakdown-item">
    <div class="label">Cash Variance</div>
    <div class="value ${Number(shift.cashVariance ?? 0) >= 0 ? "variance-ok" : "variance-bad"}">${fmt(shift.cashVariance)}</div>
  </div>
</div>

<h2>Sales Breakdown</h2>
<div class="breakdown" style="margin-top:4px">
  <div class="breakdown-item">
    <div class="label">Cash Sales</div>
    <div class="value">${fmt(shift.cashSales)}</div>
  </div>
  <div class="breakdown-item">
    <div class="label">Card / POS Sales</div>
    <div class="value">${fmt(shift.cardSales)}</div>
  </div>
  <div class="breakdown-item">
    <div class="label">Bank Transfer</div>
    <div class="value">${fmt(shift.transferSales)}</div>
  </div>
  <div class="breakdown-item">
    <div class="label">Discounts Given</div>
    <div class="value">${fmt(shift.discountsGiven)}</div>
  </div>
  <div class="breakdown-item">
    <div class="label">Refunds Issued</div>
    <div class="value">${fmt(shift.refundsIssued)}</div>
  </div>
  <div class="breakdown-item">
    <div class="label">Net Revenue</div>
    <div class="value">${fmt(payTotal - refTotal)}</div>
  </div>
</div>

${reservations.length > 0 ? `
<h2>Bookings This Shift (${reservations.length})</h2>
<table>
  <thead><tr>
    <th>Room</th><th>Type</th><th>Guest</th><th>Stay</th><th>Check-in</th><th>Check-out</th><th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>${bookingRows}</tbody>
</table>` : ""}

${payments.length > 0 ? `
<h2>Payment Transactions (${payments.length})</h2>
<table>
  <thead><tr>
    <th>Date / Time</th><th>Method</th><th>Type</th><th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>${paymentRows}</tbody>
</table>` : ""}

<div class="footer">
  <span>${esc(settings.hotelName)} — Confidential Shift Report</span>
  <span>Receptionist Signature: ___________________________</span>
</div>
</body>
</html>`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { shift, refreshShift } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<{
    shift: Shift;
    payments: Payment[];
    reservations: (Reservation & { guest?: Guest; room?: Room })[];
    settings: HotelSettings;
  } | null>(null);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("0");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  function load() {
    api.getDashboardSummary().then(setSummary).catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleStartShift() {
    setBusy(true);
    setError("");
    try {
      await api.startShift(Number(openingBalance) || 0);
      await refreshShift();
      setShowStartModal(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseShift() {
    if (!shift) return;
    setBusy(true);
    setError("");
    try {
      const closedShift = await api.closeShift(shift.id, Number(closingBalance) || 0);
      // Fetch the full report before refreshing the auth shift (which clears it)
      setLoadingReport(true);
      const report = await api.getShiftReport(closedShift.id);
      setReportData(report);
      await refreshShift();
      setShowCloseModal(false);
      setShowReportModal(true);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setLoadingReport(false);
    }
  }

  function handlePrintReport() {
    if (!reportData) return;
    const html = generateReportHtml(reportData);
    // noopener prevents the report window from accessing window.opener
    const win = window.open("", "_blank", "width=900,height=700,noopener,noreferrer");
    if (!win) return;
    win.opener = null;
    win.document.write(html);
    win.document.close();
    win.focus();
    // Small delay so styles render before print dialog
    setTimeout(() => {
      win.print();
    }, 400);
  }

  // Pure SpreadsheetML Excel export — no npm dependency needed
  function handleDownloadExcel() {
    if (!reportData) return;
    const { shift, payments, reservations, settings } = reportData;
    const date = new Date(shift.loginTime).toISOString().slice(0, 10);
    const fmtNum = (n: string | number | null | undefined) => Number(n ?? 0);
    const fmtDate = (d: string | null | undefined) =>
      d ? new Date(d).toLocaleString("en-NG") : "";

    // SpreadsheetML cell helpers
    const xmlEsc = (v: string | number | null | undefined) =>
      String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const str = (v: string | number | null | undefined) =>
      `<Cell><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`;
    const num = (v: string | number | null | undefined) =>
      `<Cell><Data ss:Type="Number">${fmtNum(v)}</Data></Cell>`;
    const header = (v: string) =>
      `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`;
    const row = (...cells: string[]) => `<Row>${cells.join("")}</Row>`;
    const emptyRow = () => `<Row/>`;

    const netRevenue =
      payments.filter(p => p.type === "payment").reduce((s, p) => s + Number(p.amount), 0) -
      payments.filter(p => p.type === "refund").reduce((s, p) => s + Number(p.amount), 0);

    // ── Sheet 1: Summary ──────────────────────────────────────────────────────
    const summarySheet = `
    <Worksheet ss:Name="Summary">
      <Table ss:DefaultColumnWidth="160">
        ${row(str(settings.hotelName))}
        ${row(str("End-of-Shift Report"))}
        ${emptyRow()}
        ${row(str("Receptionist"), str(shift.receptionistName))}
        ${row(str("Shift Start"), str(fmtDate(shift.loginTime)))}
        ${row(str("Shift End"), str(fmtDate(shift.logoutTime)))}
        ${row(str("Report Date"), str(fmtDate(new Date().toISOString())))}
        ${emptyRow()}
        ${row(str("SHIFT SUMMARY"))}
        ${row(str("Guests Served"), num(shift.guestsServed))}
        ${row(str("Rooms Booked"), num(shift.roomsBooked))}
        ${row(str("Reservations Processed"), num(shift.reservationsProcessed))}
        ${emptyRow()}
        ${row(str("CASH RECONCILIATION"))}
        ${row(str("Opening Balance (N)"), num(shift.openingBalance))}
        ${row(str("Closing Balance (N)"), num(shift.closingBalance))}
        ${row(str("Cash Variance (N)"), num(shift.cashVariance))}
        ${emptyRow()}
        ${row(str("SALES BREAKDOWN"))}
        ${row(str("Total Sales (N)"), num(shift.totalSales))}
        ${row(str("Cash Sales (N)"), num(shift.cashSales))}
        ${row(str("Card / POS Sales (N)"), num(shift.cardSales))}
        ${row(str("Bank Transfer Sales (N)"), num(shift.transferSales))}
        ${row(str("Discounts Given (N)"), num(shift.discountsGiven))}
        ${row(str("Refunds Issued (N)"), num(shift.refundsIssued))}
        ${row(str("Net Revenue (N)"), num(netRevenue))}
      </Table>
    </Worksheet>`;

    // ── Sheet 2: Bookings ─────────────────────────────────────────────────────
    const bookingRows = reservations.map(r => {
      const paid = payments
        .filter(p => p.reservationId === r.id && p.type === "payment")
        .reduce((s, p) => s + Number(p.amount), 0);
      return row(
        str(r.room?.roomNumber ?? ""),
        str(r.room?.roomType ?? ""),
        str(r.guest?.fullName ?? ""),
        str(r.guest?.phone ?? ""),
        str(r.stayType === "short_rest" ? "Short Rest" : "Lodge"),
        str(r.checkInDate),
        str(r.checkOutDate),
        r.stayType === "short_rest" ? num(r.durationHours ?? 1) : str(""),
        num(paid),
      );
    }).join("\n");

    const bookingsSheet = `
    <Worksheet ss:Name="Bookings">
      <Table ss:DefaultColumnWidth="120">
        ${row(header("Room No."), header("Room Type"), header("Guest Name"), header("Phone"), header("Stay Type"), header("Check-in"), header("Check-out"), header("Duration (hrs)"), header("Amount Paid (N)"))}
        ${bookingRows}
      </Table>
    </Worksheet>`;

    // ── Sheet 3: Payments ─────────────────────────────────────────────────────
    const payRows = payments.map(p =>
      row(
        str(fmtDate(p.createdAt)),
        str(p.method.replace(/_/g, " ")),
        str(p.type),
        num(p.amount),
        str(p.transactionId ?? ""),
        str(p.receptionistName),
      )
    ).join("\n");

    const paymentsSheet = `
    <Worksheet ss:Name="Payments">
      <Table ss:DefaultColumnWidth="130">
        ${row(header("Date / Time"), header("Method"), header("Type"), header("Amount (N)"), header("Transaction ID"), header("Receptionist"))}
        ${payRows}
      </Table>
    </Worksheet>`;

    // ── Assemble workbook XML ─────────────────────────────────────────────────
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles>
  <Style ss:ID="header">
    <Font ss:Bold="1"/>
    <Interior ss:Color="#1a1a2e" ss:Pattern="Solid"/>
    <Font ss:Bold="1" ss:Color="#FFFFFF"/>
  </Style>
</Styles>
${summarySheet}
${bookingsSheet}
${paymentsSheet}
</Workbook>`;

    // ── Trigger download ──────────────────────────────────────────────────────
    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = `shift-report-${shift.receptionistName.replace(/\s+/g, "-")}-${date}.xls`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = summary
    ? [
        { label: summary.shiftActive ? "Check-ins This Shift" : "Today's Check-ins", value: summary.todaysCheckIns, icon: "🛎️" },
        { label: summary.shiftActive ? "Check-outs This Shift" : "Today's Check-outs", value: summary.todaysCheckOuts, icon: "🚪" },
        { label: summary.shiftActive ? "Walk-in Guests This Shift" : "Walk-in Guests Today", value: summary.walkInGuests, icon: "🚶" },
        { label: summary.shiftActive ? "Short Rest This Shift" : "Short Rest Today", value: summary.shortRestGuests, icon: "⏱️" },
        { label: "Pending Reservations", value: summary.pendingReservations, icon: "⏳" },
        { label: "Occupied Rooms", value: summary.occupiedRooms, icon: "🛏️" },
        { label: "Available Rooms", value: summary.availableRooms, icon: "✅" },
        { label: "Reserved Rooms", value: summary.reservedRooms, icon: "📌" },
        { label: summary.shiftActive ? "Sales This Shift" : "Total Sales Today", value: `₦${summary.totalSalesToday.toFixed(2)}`, icon: "💰" },
        { label: summary.shiftActive ? "Payments This Shift" : "Payments Received", value: summary.paymentsReceived, icon: "💳" },
        { label: "Outstanding Payments", value: summary.outstandingPayments, icon: "⚠️" },
      ]
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p className="page-sub">Real-time snapshot of front desk operations</p>
        </div>
        {shift ? (
          <button className="btn danger" onClick={() => setShowCloseModal(true)}>
            Close Shift
          </button>
        ) : (
          <button className="btn" onClick={() => setShowStartModal(true)}>
            Start Shift
          </button>
        )}
      </div>

      <div className={`shift-banner glass ${shift ? "active" : "inactive"}`}>
        <span className={`dot ${shift ? "dot-active" : "dot-inactive"}`} />
        {shift ? (
          <span>
            Shift active since {new Date(shift.loginTime).toLocaleTimeString()} — Opening balance ₦
            {Number(shift.openingBalance).toFixed(2)}
          </span>
        ) : (
          <span>No active shift. Start a shift to begin recording transactions.</span>
        )}
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card glass">
            <div className="stat-icon">{c.icon}</div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Start Shift Modal ── */}
      {showStartModal && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Start Shift</h2>
            <p className="page-sub">Enter your opening cash drawer balance to begin.</p>
            <div className="field">
              <label>Opening Balance (₦)</label>
              <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowStartModal(false)}>Cancel</button>
              <button className="btn" onClick={handleStartShift} disabled={busy}>
                {busy ? "Starting..." : "Start Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Shift Modal ── */}
      {showCloseModal && shift && (
        <div className="modal-overlay" onClick={() => !busy && setShowCloseModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Close Shift — Summary</h2>
            <div className="summary-grid">
              <div><span>Receptionist</span><strong>{shift.receptionistName}</strong></div>
              <div><span>Login Time</span><strong>{new Date(shift.loginTime).toLocaleString()}</strong></div>
              <div><span>Guests Served</span><strong>{shift.guestsServed}</strong></div>
              <div><span>Rooms Booked</span><strong>{shift.roomsBooked}</strong></div>
              <div><span>Reservations Processed</span><strong>{shift.reservationsProcessed}</strong></div>
              <div><span>Total Sales</span><strong>₦{Number(shift.totalSales).toFixed(2)}</strong></div>
              <div><span>Cash Sales</span><strong>₦{Number(shift.cashSales).toFixed(2)}</strong></div>
              <div><span>Card Sales</span><strong>₦{Number(shift.cardSales).toFixed(2)}</strong></div>
              <div><span>Transfer Sales</span><strong>₦{Number(shift.transferSales).toFixed(2)}</strong></div>
              <div><span>Discounts Given</span><strong>₦{Number(shift.discountsGiven).toFixed(2)}</strong></div>
              <div><span>Refunds Issued</span><strong>₦{Number(shift.refundsIssued).toFixed(2)}</strong></div>
            </div>
            <div className="field">
              <label>Closing Balance (₦)</label>
              <input type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowCloseModal(false)} disabled={busy}>Cancel</button>
              <button className="btn danger" onClick={handleCloseShift} disabled={busy}>
                {loadingReport ? "Generating Report…" : busy ? "Closing…" : "Confirm & Close Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shift Report Modal ── */}
      {showReportModal && reportData && (
        <div className="modal-overlay">
          <div
            className="modal glass"
            style={{ maxWidth: 640, width: "95%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <h2 style={{ marginBottom: 4 }}>Shift Closed Successfully</h2>
              <p className="page-sub">Download or print your end-of-shift report before starting a new shift.</p>
            </div>

            {/* Quick stats recap */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Guests Served", value: reportData.shift.guestsServed },
                { label: "Rooms Booked", value: reportData.shift.roomsBooked },
                { label: "Bookings", value: reportData.reservations.length },
                { label: "Cash Sales", value: `₦${Number(reportData.shift.cashSales).toLocaleString()}` },
                { label: "Card Sales", value: `₦${Number(reportData.shift.cardSales).toLocaleString()}` },
                { label: "Total Revenue", value: `₦${Number(reportData.shift.totalSales).toLocaleString()}` },
              ].map((s) => (
                <div key={s.label} className="glass" style={{ padding: "10px 14px", borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Cash reconciliation */}
            <div className="glass" style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Opening Balance</span>
                <strong>₦{Number(reportData.shift.openingBalance).toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Closing Balance</span>
                <strong>₦{Number(reportData.shift.closingBalance ?? 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Cash Variance</span>
                <strong style={{ color: Number(reportData.shift.cashVariance ?? 0) >= 0 ? "var(--success, #4ade80)" : "var(--danger, #f87171)" }}>
                  {Number(reportData.shift.cashVariance ?? 0) >= 0 ? "+" : ""}
                  ₦{Number(reportData.shift.cashVariance ?? 0).toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Bookings list preview */}
            {reportData.reservations.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: "0.85rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  Bookings ({reportData.reservations.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {reportData.reservations.slice(0, 5).map((r) => (
                    <div key={r.id} className="glass" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem" }}>
                      <div>
                        <strong>Room {r.room?.roomNumber}</strong>
                        <span style={{ color: "var(--muted)", marginLeft: 8 }}>{r.guest?.fullName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "var(--muted)" }}>{r.stayType === "short_rest" ? `Short Rest ${r.durationHours}h` : "Lodge"}</span>
                        <strong>
                          ₦{reportData.payments
                              .filter((p) => p.reservationId === r.id && p.type === "payment")
                              .reduce((s, p) => s + Number(p.amount), 0)
                              .toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  ))}
                  {reportData.reservations.length > 5 && (
                    <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
                      + {reportData.reservations.length - 5} more — see full report
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button className="btn" style={{ flex: 1 }} onClick={handlePrintReport}>
                🖨️ Print Report
              </button>
              <button className="btn secondary" style={{ flex: 1 }} onClick={handleDownloadExcel}>
                📊 Download Excel
              </button>
            </div>

            <button
              className="btn secondary full"
              onClick={() => {
                setShowReportModal(false);
                setReportData(null);
                setShowStartModal(true);
              }}
            >
              Start New Shift →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
