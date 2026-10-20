import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api, type KitchenShift } from "../../lib/api";

export default function KitchenShifts() {
  const [shifts, setShifts] = useState<KitchenShift[]>([]);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    api.getKitchenShifts().then(setShifts).catch(e => setError(e.message));
  }, []);

  async function downloadShiftReport(shift: KitchenShift) {
    setError("");
    setDownloadingId(shift.id);
    try {
      const report = await api.getKitchenShiftReport(shift.id);
      const wb = XLSX.utils.book_new();
      const summary = [
        ["Kitchen Shift Report"],
        ["Chef", report.shift.chefName],
        ["Shift Start", new Date(report.shift.startTime).toLocaleString("en-NG")],
        ["Shift End", report.shift.endTime ? new Date(report.shift.endTime).toLocaleString("en-NG") : "Active"],
        ["Orders Completed", report.shift.ordersCompleted],
        ["Meals Cooked", report.shift.mealsCooked],
        ["Shift Notes", report.shift.notes || ""],
        ["Stock Accepted", report.acceptedStock.length],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summary);
      summarySheet["!cols"] = [{ wch: 24 }, { wch: 36 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      const headers = ["Item", "Quantity", "Submitted By", "Submitted At", "Status", "Accepted By", "Accepted At", "Note"];
      const rows = report.acceptedStock.map(item => [
        item.itemName, `${item.quantity} ${item.unit}`, item.submittedByName,
        new Date(item.submittedAt).toLocaleString("en-NG"), item.status,
        item.acceptedByName || "", item.acceptedAt ? new Date(item.acceptedAt).toLocaleString("en-NG") : "", item.note || "",
      ]);
      const stockSheet = XLSX.utils.aoa_to_sheet([headers, ...(rows.length ? rows : [["No stock accepted during this shift"]])]);
      stockSheet["!cols"] = headers.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, stockSheet, "Accepted Stock");
      XLSX.writeFile(wb, `kitchen-shift-${shift.chefName.replace(/[^a-z0-9-]+/gi, "-")}-${new Date(shift.startTime).toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      setError(e.message || "Could not download shift report.");
    } finally {
      setDownloadingId(null);
    }
  }

  function duration(start: string, end?: string | null) {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const mins = Math.floor((e - s) / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h}h ${m}m`;
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Shift History</h1><p className="page-sub">Kitchen shift records and performance</p></div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr>
              {["Chef", "Start Time", "End Time", "Duration", "Orders", "Status", "Notes", "Report"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No shifts recorded yet</td></tr>
            )}
            {shifts.map(shift => (
              <tr key={shift.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{shift.chefName}</td>
                <td style={{ padding: "10px 14px", color: "var(--muted)" }}>{new Date(shift.startTime).toLocaleString()}</td>
                <td style={{ padding: "10px 14px", color: "var(--muted)" }}>{shift.endTime ? new Date(shift.endTime).toLocaleString() : "—"}</td>
                <td style={{ padding: "10px 14px" }}>{duration(shift.startTime, shift.endTime)}</td>
                <td style={{ padding: "10px 14px" }}>{shift.ordersCompleted}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
                    background: shift.status === "active" ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.15)",
                    color: shift.status === "active" ? "#4ade80" : "#94a3b8",
                  }}>{shift.status === "active" ? "Active" : "Closed"}</span>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {shift.notes || "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {shift.status === "closed" ? (
                    <button className="btn secondary" style={{ padding: "4px 10px", fontSize: ".78rem" }} disabled={downloadingId === shift.id} onClick={() => downloadShiftReport(shift)}>
                      {downloadingId === shift.id ? "Preparing…" : "Download"}
                    </button>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
