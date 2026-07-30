import { useEffect, useState } from "react";
import { api, type KitchenShift } from "../../lib/api";

export default function KitchenShifts() {
  const [shifts, setShifts] = useState<KitchenShift[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getKitchenShifts().then(setShifts).catch(e => setError(e.message));
  }, []);

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
              {["Chef", "Start Time", "End Time", "Duration", "Orders", "Status", "Notes"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No shifts recorded yet</td></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
