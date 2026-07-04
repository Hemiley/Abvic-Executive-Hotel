import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Reservation } from "../lib/api";
import { useSettings } from "../context/SettingsContext";
import { useNotifications } from "../context/NotificationsContext";

const STATUS_OPTIONS = ["pending", "confirmed", "checked_in", "checked_out", "cancelled"];
const PAYMENT_METHODS = ["cash", "pos", "bank_transfer", "card", "flutterwave", "paystack", "stripe"];

// ── Short Rest Countdown ────────────────────────────────────────────────────
function ShortRestCountdown({
  reservation,
  onExpire,
}: {
  reservation: Reservation;
  onExpire: (r: Reservation) => void;
}) {
  const durationMs = (reservation.durationHours ?? 1) * 3600 * 1000;
  // updatedAt is the last status-change time — used as check-in timestamp
  const checkInAt = new Date(reservation.updatedAt).getTime();
  const endsAt = checkInAt + durationMs;

  const firedRef = useRef(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()));

  useEffect(() => {
    // If the timer was already past when the component mounts, fire immediately
    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire(reservation);
    }

    const id = setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire(reservation);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining === 0) {
    return (
      <div className="sr-countdown sr-countdown-expired">
        <span className="sr-countdown-icon">⏰</span>
        <span className="sr-countdown-label">Time&apos;s Up!</span>
      </div>
    );
  }

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pct = Math.max(0, (remaining / durationMs) * 100);
  const urgent = pct < 15; // last 15%

  return (
    <div className={`sr-countdown ${urgent ? "sr-countdown-urgent" : ""}`}>
      <div className="sr-countdown-ring-wrap">
        <svg className="sr-countdown-ring" viewBox="0 0 36 36">
          <circle className="sr-ring-bg" cx="18" cy="18" r="15.9" />
          <circle
            className="sr-ring-fill"
            cx="18"
            cy="18"
            r="15.9"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset="25"
          />
        </svg>
        <span className="sr-ring-pct">{Math.round(pct)}%</span>
      </div>
      <div className="sr-countdown-time">
        {h > 0 && <span>{String(h).padStart(2, "0")}h </span>}
        <span>{String(m).padStart(2, "0")}m </span>
        <span className={urgent ? "sr-sec-urgent" : ""}>{String(s).padStart(2, "0")}s</span>
      </div>
      <div className="sr-countdown-sublabel">remaining</div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stayFilter, setStayFilter] = useState("all");
  const [error, setError] = useState("");
  const [payTarget, setPayTarget] = useState<Reservation | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payType, setPayType] = useState("payment");
  const [payTxn, setPayTxn] = useState("");
  const [receiptData, setReceiptData] = useState<any>(null);
  const [expiredAlert, setExpiredAlert] = useState<Reservation | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [guestDetail, setGuestDetail] = useState<Reservation | null>(null);
  const { settings } = useSettings();
  const { reload: reloadNotifs } = useNotifications();
  const hourlyRate = settings?.shortRestHourlyRate ? parseFloat(settings.shortRestHourlyRate) : 3000;
  // Track which IDs have already fired the expiry notification (survive re-renders)
  const notifiedRef = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem("sr_notified") ?? "[]")
  ));

  function load() {
    api.getReservations().then(setReservations).catch((e) => setError(e.message));
    api.getPayments().then((payments) => {
      const paid = new Set(
        payments.filter((p) => p.type === "payment").map((p) => p.reservationId)
      );
      setPaidIds(paid);
    }).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (stayFilter !== "all" && r.stayType !== stayFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.guest?.fullName || ""} ${r.guest?.phone || ""} ${r.room?.roomNumber || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, search, statusFilter, stayFilter]);

  async function handleExpire(r: Reservation) {
    // Only fire once per reservation across renders
    if (notifiedRef.current.has(r.id)) return;
    notifiedRef.current.add(r.id);
    const arr = Array.from(notifiedRef.current);
    localStorage.setItem("sr_notified", JSON.stringify(arr.slice(-50))); // keep last 50

    // Show the in-page alert banner
    setExpiredAlert(r);

    // Push a checkout notification into the system
    try {
      await api.createNotification({
        type: "checkout",
        message: `⏰ Short rest time expired — ${r.guest?.fullName ?? "Guest"} (Room ${r.room?.roomNumber ?? "?"}) should check out now.`,
      });
      reloadNotifs(); // refresh sidebar badge
    } catch (_) {}
  }

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
    let amount = 0;
    if (r.stayType === "short_rest") {
      amount = (r.durationHours ?? 1) * hourlyRate;
    } else {
      const nights = Math.max(
        1,
        Math.round((new Date(r.checkOutDate).getTime() - new Date(r.checkInDate).getTime()) / 86400000)
      );
      amount = r.room ? Number(r.room.pricePerNight) * nights : 0;
    }
    setPayAmount(amount.toFixed(2));
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

      {/* Time's-up alert banner */}
      {expiredAlert && (
        <div className="sr-expiry-banner">
          <span className="sr-expiry-icon">⏰</span>
          <div className="sr-expiry-text">
            <strong>Short rest ended</strong>
            <span>
              {expiredAlert.guest?.fullName} in Room {expiredAlert.room?.roomNumber} — time is up. Please proceed with check-out.
            </span>
          </div>
          <button
            className="btn secondary"
            onClick={() => { updateStatus(expiredAlert.id, "checked_out"); setExpiredAlert(null); }}
          >
            Check Out Now
          </button>
          <button className="sr-expiry-close" onClick={() => setExpiredAlert(null)}>✕</button>
        </div>
      )}

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
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select value={stayFilter} onChange={(e) => setStayFilter(e.target.value)}>
          <option value="all">All stay types</option>
          <option value="lodge">Lodge</option>
          <option value="short_rest">Short Rest</option>
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card glass">
        <table className="table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Room</th>
              <th>Stay Type</th>
              <th>Check-in</th>
              <th>Duration / Check-out</th>
              <th>Status</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <button
                    className="guest-link-btn"
                    onClick={() => setGuestDetail(r)}
                    title="View guest details"
                  >
                    <div className="guest-link-name">{r.guest?.fullName}</div>
                    <div className="muted">{r.guest?.phone}</div>
                  </button>
                </td>
                <td>
                  {r.room?.roomNumber} <span className="muted">({r.room?.roomType})</span>
                </td>
                <td>
                  {r.stayType === "short_rest" ? (
                    <span className="badge" style={{ background: "rgba(255,178,87,0.18)", color: "var(--warn)" }}>
                      ⏱️ Short Rest
                    </span>
                  ) : (
                    <span className="badge" style={{ background: "rgba(55,226,163,0.15)", color: "var(--success)" }}>
                      🛏️ Lodge
                    </span>
                  )}
                </td>
                <td>{r.checkInDate}</td>
                <td>
                  {r.stayType === "short_rest" && r.status === "checked_in" ? (
                    <ShortRestCountdown reservation={r} onExpire={handleExpire} />
                  ) : r.stayType === "short_rest" ? (
                    <span className="muted">
                      {r.durationHours ?? 1} hr{(r.durationHours ?? 1) !== 1 ? "s" : ""}
                      {" "}· ₦{((r.durationHours ?? 1) * hourlyRate).toLocaleString()}
                    </span>
                  ) : (
                    r.checkOutDate
                  )}
                </td>
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
                    <button
                      className={`btn${paidIds.has(r.id) ? " success" : ""}`}
                      onClick={() => openPayment(r)}
                    >
                      {paidIds.has(r.id) ? "✓ Paid" : "Payment"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>No reservations found.</td>
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
              {payTarget.stayType === "short_rest" && (
                <span className="badge" style={{ marginLeft: 8, background: "rgba(255,178,87,0.18)", color: "var(--warn)" }}>
                  ⏱️ Short Rest · {payTarget.durationHours ?? 1}h
                </span>
              )}
            </p>
            {payTarget.stayType === "short_rest" && (
              <div className="booking-price-summary glass" style={{ marginBottom: 16 }}>
                <span>₦{hourlyRate.toLocaleString()} × {payTarget.durationHours ?? 1} hr{(payTarget.durationHours ?? 1) !== 1 ? "s" : ""}</span>
                <strong>₦{((payTarget.durationHours ?? 1) * hourlyRate).toLocaleString()}</strong>
              </div>
            )}
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
                <label>Amount (₦)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Transaction ID (optional)</label>
              <input value={payTxn} onChange={(e) => setPayTxn(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPayTarget(null)}>Cancel</button>
              <button className="btn" onClick={submitPayment}>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {guestDetail && (
        <div className="modal-overlay" onClick={() => setGuestDetail(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Guest Details</h2>
            <p className="page-sub">
              Booking reference · Room {guestDetail.room?.roomNumber}{" "}
              <span className="muted">({guestDetail.room?.roomType})</span>
            </p>
            <div className="guest-detail-grid">
              <div className="guest-detail-row">
                <span>Full Name</span>
                <strong>{guestDetail.guest?.fullName || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Phone</span>
                <strong>{guestDetail.guest?.phone || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Email</span>
                <strong>{guestDetail.guest?.email || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Nationality</span>
                <strong>{guestDetail.guest?.nationality || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>ID Type</span>
                <strong>{guestDetail.guest?.idType || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>ID Number</span>
                <strong>{guestDetail.guest?.idNumber || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Address</span>
                <strong>{guestDetail.guest?.address || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Emergency Contact</span>
                <strong>{guestDetail.guest?.emergencyContact || "—"}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Stay Type</span>
                <strong>
                  {guestDetail.stayType === "short_rest"
                    ? `Short Rest (${guestDetail.durationHours ?? 1}h)`
                    : "Lodge"}
                </strong>
              </div>
              <div className="guest-detail-row">
                <span>Check-in</span>
                <strong>{guestDetail.checkInDate}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Check-out</span>
                <strong>{guestDetail.stayType === "short_rest" ? "Same day" : guestDetail.checkOutDate}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Source</span>
                <strong>{guestDetail.source.replace("_", " ")}</strong>
              </div>
              <div className="guest-detail-row">
                <span>Status</span>
                <strong>
                  <span className={`badge status-${guestDetail.status}`}>
                    {guestDetail.status.replace("_", " ")}
                  </span>
                </strong>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn full" onClick={() => setGuestDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {receiptData && (
        <div className="modal-overlay" onClick={() => setReceiptData(null)}>
          <div className="modal glass receipt" onClick={(e) => e.stopPropagation()}>
            <h2>Payment Receipt</h2>
            <div className="receipt-row"><span>Guest</span><strong>{receiptData.reservation.guest?.fullName}</strong></div>
            <div className="receipt-row"><span>Room</span><strong>{receiptData.reservation.room?.roomNumber}</strong></div>
            <div className="receipt-row">
              <span>Stay Type</span>
              <strong>
                {receiptData.reservation.stayType === "short_rest"
                  ? `Short Rest (${receiptData.reservation.durationHours ?? 1}h)`
                  : "Lodge"}
              </strong>
            </div>
            <div className="receipt-row"><span>Amount</span><strong>₦{Number(receiptData.payment.amount).toFixed(2)}</strong></div>
            <div className="receipt-row"><span>Method</span><strong>{receiptData.payment.method}</strong></div>
            <div className="receipt-row"><span>Transaction ID</span><strong>{receiptData.payment.transactionId || "—"}</strong></div>
            <div className="receipt-row"><span>Time</span><strong>{new Date(receiptData.payment.createdAt).toLocaleString()}</strong></div>
            <button className="btn full" onClick={() => setReceiptData(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
