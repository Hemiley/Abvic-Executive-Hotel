import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Reports() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.getReportsSummary().then(setSummary).catch(() => {});
  }, []);

  function exportCsv() {
    window.open("/api/reports/export.csv", "_blank");
  }

  const cards = summary
    ? [
        { label: "Total Bookings", value: summary.totalBookings },
        { label: "Total Reservations", value: summary.totalReservations },
        { label: "Guest Check-ins", value: summary.checkIns },
        { label: "Guest Check-outs", value: summary.checkOuts },
        { label: "Occupancy Rate", value: `${summary.occupancyRate}%` },
        { label: "Revenue Summary", value: `$${summary.totalRevenue.toFixed(2)}` },
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
