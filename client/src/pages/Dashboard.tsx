import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type DashboardSummary } from "../lib/api";

export default function Dashboard() {
  const { shift, refreshShift } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("0");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      await api.closeShift(shift.id, Number(closingBalance) || 0);
      await refreshShift();
      setShowCloseModal(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const cards = summary
    ? [
        { label: "Today's Check-ins", value: summary.todaysCheckIns, icon: "🛎️" },
        { label: "Today's Check-outs", value: summary.todaysCheckOuts, icon: "🚪" },
        { label: "Walk-in Guests", value: summary.walkInGuests, icon: "🚶" },
        { label: "Pending Reservations", value: summary.pendingReservations, icon: "⏳" },
        { label: "Occupied Rooms", value: summary.occupiedRooms, icon: "🛏️" },
        { label: "Available Rooms", value: summary.availableRooms, icon: "✅" },
        { label: "Reserved Rooms", value: summary.reservedRooms, icon: "📌" },
        { label: "Total Sales Today", value: `$${summary.totalSalesToday.toFixed(2)}`, icon: "💰" },
        { label: "Payments Received", value: summary.paymentsReceived, icon: "💳" },
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
            Shift active since {new Date(shift.loginTime).toLocaleTimeString()} — Opening balance $
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

      {showStartModal && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Start Shift</h2>
            <p className="page-sub">Enter your opening cash drawer balance to begin.</p>
            <div className="field">
              <label>Opening Balance ($)</label>
              <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowStartModal(false)}>
                Cancel
              </button>
              <button className="btn" onClick={handleStartShift} disabled={busy}>
                {busy ? "Starting..." : "Start Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && shift && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Close Shift — Summary</h2>
            <div className="summary-grid">
              <div>
                <span>Receptionist</span>
                <strong>{shift.receptionistName}</strong>
              </div>
              <div>
                <span>Login Time</span>
                <strong>{new Date(shift.loginTime).toLocaleString()}</strong>
              </div>
              <div>
                <span>Guests Served</span>
                <strong>{shift.guestsServed}</strong>
              </div>
              <div>
                <span>Rooms Booked</span>
                <strong>{shift.roomsBooked}</strong>
              </div>
              <div>
                <span>Reservations Processed</span>
                <strong>{shift.reservationsProcessed}</strong>
              </div>
              <div>
                <span>Total Sales</span>
                <strong>${Number(shift.totalSales).toFixed(2)}</strong>
              </div>
              <div>
                <span>Cash Sales</span>
                <strong>${Number(shift.cashSales).toFixed(2)}</strong>
              </div>
              <div>
                <span>Card Sales</span>
                <strong>${Number(shift.cardSales).toFixed(2)}</strong>
              </div>
              <div>
                <span>Transfer Sales</span>
                <strong>${Number(shift.transferSales).toFixed(2)}</strong>
              </div>
              <div>
                <span>Discounts Given</span>
                <strong>${Number(shift.discountsGiven).toFixed(2)}</strong>
              </div>
              <div>
                <span>Refunds Issued</span>
                <strong>${Number(shift.refundsIssued).toFixed(2)}</strong>
              </div>
            </div>
            <div className="field">
              <label>Closing Balance ($)</label>
              <input type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowCloseModal(false)}>
                Cancel
              </button>
              <button className="btn danger" onClick={handleCloseShift} disabled={busy}>
                {busy ? "Closing..." : "Confirm & Close Shift"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
