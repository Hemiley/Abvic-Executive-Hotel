import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Reports() {
  const [summary, setSummary] = useState<any>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .getReportsSummary({ from: fromDate || undefined, to: toDate || undefined })
      .then(setSummary)
      .catch((err) => setError(err.message || "Failed to load report"));
  }, [fromDate, toDate]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const qs = params.toString();
    window.open(`/api/reports/export.csv${qs ? `?${qs}` : ""}`, "_blank");
  }

  function clearDates() {
    setFromDate("");
    setToDate("");
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
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-sub">Daily sales, bookings, occupancy, and revenue summaries</p>
        </div>
        <button className="btn" onClick={exportCsv}>
          Export CSV
        </button>
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
          <button type="button" className="btn" onClick={clearDates}>
            Clear
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card glass">
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card glass" style={{ marginTop: 24 }}>
        <p className="page-sub">
          PDF and Excel exports are on the roadmap — CSV export is available now and can be opened directly in
          Excel or Google Sheets.
        </p>
      </div>
    </div>
  );
}
