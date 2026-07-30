import { useEffect, useState } from "react";
import { api, type KitchenDashboard, type KitchenShift } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function KitchenDashboard() {
  const { user } = useAuth();
  const [dash, setDash] = useState<KitchenDashboard | null>(null);
  const [activeShift, setActiveShift] = useState<KitchenShift | null>(null);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [showClose, setShowClose] = useState(false);
  const [error, setError] = useState("");

  function load() {
    api.getKitchenDashboard().then(setDash).catch(e => setError(e.message));
    api.getActiveKitchenShift().then(setActiveShift).catch(() => setActiveShift(null));
  }

  useEffect(() => { load(); }, []);

  async function handleStartShift() {
    setError(""); setStarting(true);
    try {
      await api.startKitchenShift();
      load();
    } catch (e: any) { setError(e.message); }
    finally { setStarting(false); }
  }

  async function handleCloseShift() {
    if (!activeShift) return;
    setError(""); setClosing(true);
    try {
      await api.closeKitchenShift(activeShift.id, closeNotes);
      setShowClose(false);
      setCloseNotes("");
      load();
    } catch (e: any) { setError(e.message); }
    finally { setClosing(false); }
  }

  const statCard = (icon: string, label: string, value: string | number, color?: string) => (
    <div className="glass" style={{ borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: "2rem" }}>{icon}</span>
      <div>
        <div style={{ fontSize: "1.6rem", fontWeight: 700, color: color || "inherit" }}>{value}</div>
        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Kitchen Dashboard</h1>
          <p className="page-sub">Real-time kitchen operations overview</p>
        </div>
        {user?.role !== "admin" && (
          activeShift
            ? <button className="btn danger" onClick={() => setShowClose(true)}>End Shift</button>
            : <button className="btn" onClick={handleStartShift} disabled={starting}>{starting ? "Starting..." : "Start Shift"}</button>
        )}
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      {activeShift && (
        <div className="glass" style={{ borderRadius: 10, padding: "12px 18px", marginBottom: 20, display: "flex", gap: 24, flexWrap: "wrap", fontSize: "0.875rem" }}>
          <span>🟢 <strong>Shift Active</strong></span>
          <span>Chef: <strong>{activeShift.chefName}</strong></span>
          <span>Started: <strong>{new Date(activeShift.startTime).toLocaleTimeString()}</strong></span>
          <span>Orders Completed: <strong>{activeShift.ordersCompleted}</strong></span>
        </div>
      )}

      {!activeShift && user?.role !== "admin" && (
        <div className="glass" style={{ borderRadius: 10, padding: "12px 18px", marginBottom: 20, color: "var(--muted)", fontSize: "0.875rem" }}>
          🔴 No active shift. Start a shift to begin managing kitchen operations.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {statCard("🆕", "New Orders", dash?.newOrders ?? 0, "#6366f1")}
        {statCard("⏳", "Preparing", dash?.preparingOrders ?? 0, "#f59e0b")}
        {statCard("✅", "Ready for Pickup", dash?.readyOrders ?? 0, "#4ade80")}
        {statCard("🍽️", "Completed Today", dash?.completedToday ?? 0)}
        {statCard("❌", "Cancelled Today", dash?.cancelledToday ?? 0, "#f87171")}
        {statCard("🥩", "Low Stock Items", dash?.lowStockItems ?? 0, "#f59e0b")}
        {statCard("🚫", "Out of Stock", dash?.outOfStockItems ?? 0, "#f87171")}
        {statCard("👨‍🍳", "Staff on Duty", dash?.staffOnDuty ?? 0, "#4ade80")}
      </div>

      {(dash?.lowStockAlerts ?? []).length > 0 && (
        <div className="glass" style={{ borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, color: "#f59e0b" }}>⚠️ Low Stock Alerts</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {dash!.lowStockAlerts.map((item: any) => (
              <span key={item.id} style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "4px 12px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600 }}>
                {item.name} — {item.currentStock} {item.unit} left
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showClose && (
        <div className="modal-overlay" onClick={() => setShowClose(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>End Kitchen Shift</h2>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>Add any handover notes before closing this shift.</p>
            <div className="field">
              <label>Shift Notes (optional)</label>
              <textarea
                value={closeNotes}
                onChange={e => setCloseNotes(e.target.value)}
                rows={4}
                placeholder="Ingredients running low, pending orders, handover info..."
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowClose(false)}>Cancel</button>
              <button className="btn danger" onClick={handleCloseShift} disabled={closing}>{closing ? "Closing..." : "End Shift"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
