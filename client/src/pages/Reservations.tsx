import { useEffect, useMemo, useState } from "react";
import { api, type Reservation } from "../lib/api";

const STATUS_OPTIONS = ["pending", "confirmed", "checked_in", "checked_out", "cancelled"];
const PAYMENT_METHODS = ["cash", "pos", "bank_transfer", "card", "flutterwave", "paystack", "stripe"];

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [payTarget, setPayTarget] = useState<Reservation | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payType, setPayType] = useState("payment");
  const [payTxn, setPayTxn] = useState("");
  const [receiptData, setReceiptData] = useState<any>(null);

  function load() {
    api.getReservations().then(setReservations).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.guest?.fullName || ""} ${r.guest?.phone || ""} ${r.room?.roomNumber || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, search, statusFilter]);

  async function updateStatus(id: string, status: string) {
    try {
      await api.updateReservation(id, { status: status as any });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function openPayment(r: Reservation) {
    setPayTarget(r);
    const nights = Math.max(
      1,
      Math.round((new Date(r.checkOutDate).getTime() - new Date(r.checkInDate).getTime()) / 86400000)
    );
    const total = r.room ? Number(r.room.pricePerNight) * nights : 0;
    setPayAmount(total.toFixed(2));
    setPayMethod("cash");
    setPayType("payment");
    setPayTxn("");
  }

  async function submitPayment() {
    if (!payTarget) return;
    try {
      const payment = await api.createPayment({
        reservationId: payTarget.id,
        amount: Number(payAmount),
        method: payMethod,
        type: payType,
        transactionId: payTxn || undefined,
      });
      setReceiptData({ payment, reservation: payTarget });
      setPayTarget(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reservation Management</h1>
          <p className="page-sub">Search, approve, assign, and manage all guest reservations</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search by guest name, phone, or room..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card glass">
        <table className="table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Room</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Status</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <div>{r.guest?.fullName}</div>
                  <div className="muted">{r.guest?.phone}</div>
                </td>
                <td>
                  {r.room?.roomNumber} <span className="muted">({r.room?.roomType})</span>
                </td>
                <td>{r.checkInDate}</td>
                <td>{r.checkOutDate}</td>
                <td>
                  <span className={`badge status-${r.status}`}>{r.status.replace("_", " ")}</span>
                </td>
                <td className="muted">{r.source.replace("_", " ")}</td>
                <td>
                  <div className="row-actions">
                    {r.status === "pending" && (
                      <button className="btn secondary" onClick={() => updateStatus(r.id, "confirmed")}>
                        Approve
                      </button>
                    )}
                    {(r.status === "confirmed" || r.status === "pending") && (
                      <button className="btn secondary" onClick={() => updateStatus(r.id, "checked_in")}>
                        Check In
                      </button>
                    )}
                    {r.status === "checked_in" && (
                      <button className="btn secondary" onClick={() => updateStatus(r.id, "checked_out")}>
                        Check Out
                      </button>
                    )}
                    {r.status !== "cancelled" && r.status !== "checked_out" && (
                      <button className="btn danger" onClick={() => updateStatus(r.id, "cancelled")}>
                        Cancel
                      </button>
                    )}
                    <button className="btn" onClick={() => openPayment(r)}>
                      Payment
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>No reservations found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payTarget && (
        <div className="modal-overlay" onClick={() => setPayTarget(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Record Payment</h2>
            <p className="page-sub">
              {payTarget.guest?.fullName} — Room {payTarget.room?.roomNumber}
            </p>
            <div className="field-row">
              <div className="field">
                <label>Type</label>
                <select value={payType} onChange={(e) => setPayType(e.target.value)}>
                  <option value="payment">Payment</option>
                  <option value="refund">Refund</option>
                  <option value="discount">Discount</option>
                </select>
              </div>
              <div className="field">
                <label>Amount ($)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Transaction ID (optional)</label>
              <input value={payTxn} onChange={(e) => setPayTxn(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPayTarget(null)}>
                Cancel
              </button>
              <button className="btn" onClick={submitPayment}>
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptData && (
        <div className="modal-overlay" onClick={() => setReceiptData(null)}>
          <div className="modal glass receipt" onClick={(e) => e.stopPropagation()}>
            <h2>Payment Receipt</h2>
            <div className="receipt-row">
              <span>Guest</span>
              <strong>{receiptData.reservation.guest?.fullName}</strong>
            </div>
            <div className="receipt-row">
              <span>Room</span>
              <strong>{receiptData.reservation.room?.roomNumber}</strong>
            </div>
            <div className="receipt-row">
              <span>Amount</span>
              <strong>${Number(receiptData.payment.amount).toFixed(2)}</strong>
            </div>
            <div className="receipt-row">
              <span>Method</span>
              <strong>{receiptData.payment.method}</strong>
            </div>
            <div className="receipt-row">
              <span>Transaction ID</span>
              <strong>{receiptData.payment.transactionId || "—"}</strong>
            </div>
            <div className="receipt-row">
              <span>Time</span>
              <strong>{new Date(receiptData.payment.createdAt).toLocaleString()}</strong>
            </div>
            <button className="btn full" onClick={() => setReceiptData(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
