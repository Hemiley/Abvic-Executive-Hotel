import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type BarDashboard, type BarShift } from "../../lib/api";

export default function BarDashboard() {
  const [data, setData] = useState<BarDashboard | null>(null);
  const [barShift, setBarShift] = useState<BarShift | null>(null);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function load() {
    api.getBarDashboard().then(d => { setData(d); setBarShift(d.shift); }).catch(() => {});
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, []);

  async function handleStartShift() {
    setStarting(true); setError("");
    try {
      const s = await api.startBarShift();
      setBarShift(s);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setStarting(false); }
  }

  async function handleCloseShift() {
    if (!barShift) return;
    setClosing(true); setError("");
    try {
      await api.closeBarShift(barShift.id);
      setBarShift(null);
      setShowClose(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setClosing(false); }
  }

  const fmt = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bar Dashboard</h1>
          <p className="page-sub">Real-time bar operations overview</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {barShift ? (
            <>
              <button className="btn" onClick={() => navigate("/bar/sales")}>🧾 New Sale</button>
              <button className="btn danger" onClick={() => setShowClose(true)}>Close Shift</button>
            </>
          ) : (
            <button className="btn" onClick={handleStartShift} disabled={starting}>
              {starting ? "Starting..." : "Start Bar Shift"}
            </button>
          )}
        </div>
      </div>

      <div className={`shift-banner glass ${barShift ? "active" : "inactive"}`}>
        <span className={`dot ${barShift ? "dot-active" : "dot-inactive"}`} />
        {barShift
          ? `Bar shift active since ${new Date(barShift.openTime).toLocaleTimeString()} — ${barShift.barAttendantName}`
          : "No active bar shift. Start a shift to begin recording sales."}
      </div>

      {error && <p className="error-text" style={{ margin: "8px 0" }}>{error}</p>}

      {data && (
        <>
          <div className="stat-grid">
            {[
              { label: "Drinks In Stock (bottles)", value: data.totalDrinksInStock, icon: "🍾" },
              { label: "Drink Types", value: data.totalDrinkTypes, icon: "📦" },
              { label: "Low Stock Alerts", value: data.lowStockCount, icon: "⚠️" },
              { label: "Today's Sales", value: data.todaySalesCount, icon: "🧾" },
              { label: "Today's Revenue", value: fmt(data.todayRevenue), icon: "💰" },
              { label: "Shift Status", value: barShift ? "Open" : "Closed", icon: barShift ? "🟢" : "🔴" },
            ].map(c => (
              <div key={c.label} className="stat-card glass">
                <div className="stat-icon">{c.icon}</div>
                <div>
                  <div className="stat-value">{c.value}</div>
                  <div className="stat-label">{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          {data.lowStockDrinks.length > 0 && (
            <div className="glass" style={{ padding: 16, borderRadius: 12, marginBottom: 24, borderLeft: "4px solid #f59e0b" }}>
              <h3 style={{ marginBottom: 8, color: "#f59e0b" }}>⚠️ Low Stock Alerts</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.lowStockDrinks.map(d => (
                  <span key={d.id} style={{ background: "rgba(245,158,11,0.15)", padding: "4px 12px", borderRadius: 20, fontSize: "0.85rem" }}>
                    {d.name} — {d.quantityAvailable} left
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.recentTransactions.length > 0 && (
            <div>
              <h2 style={{ marginBottom: 12 }}>Recent Transactions</h2>
              <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr>
                      {["Invoice", "Waiter", "Method", "Amount", "Time"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTransactions.map(t => (
                      <tr key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "0.8rem" }}>{t.invoiceNumber}</td>
                        <td style={{ padding: "10px 14px" }}>{t.waiterName || "—"}</td>
                        <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>{t.paymentMethod.replace(/_/g, " ")}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmt(Number(t.totalAmount))}</td>
                        <td style={{ padding: "10px 14px", color: "var(--muted)", fontSize: "0.8rem" }}>{new Date(t.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Close Shift Modal */}
      {showClose && barShift && (
        <div className="modal-overlay" onClick={() => !closing && setShowClose(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Close Bar Shift</h2>
            <div className="summary-grid">
              <div><span>Attendant</span><strong>{barShift.barAttendantName}</strong></div>
              <div><span>Started</span><strong>{new Date(barShift.openTime).toLocaleString()}</strong></div>
              <div><span>Total Transactions</span><strong>{barShift.totalTransactions}</strong></div>
              <div><span>Bottles Sold</span><strong>{barShift.totalBottlesSold}</strong></div>
              <div><span>Total Revenue</span><strong>{fmt(Number(barShift.totalRevenue))}</strong></div>
            </div>
            <p className="page-sub" style={{ margin: "12px 0" }}>Closing the shift will lock it and take a closing stock snapshot. Are you sure?</p>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowClose(false)} disabled={closing}>Cancel</button>
              <button className="btn danger" onClick={handleCloseShift} disabled={closing}>
                {closing ? "Closing..." : "Confirm & Close Shift"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
