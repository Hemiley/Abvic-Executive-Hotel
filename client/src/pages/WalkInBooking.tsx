import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Room } from "../lib/api";
import { useSettings } from "../context/SettingsContext";

const AMENITY_ICONS: Record<string, string> = {
  "Wi-Fi": "📶",
  TV: "📺",
  AC: "❄️",
  "Mini Bar": "🍹",
  Jacuzzi: "🛁",
  "Butler Service": "🤵",
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "pos", label: "POS / Card", icon: "💳" },
  { value: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
];

export default function WalkInBooking() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);
  const [previewImgIndex, setPreviewImgIndex] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const navigate = useNavigate();
  const { settings } = useSettings();
  const hourlyRate = settings?.shortRestHourlyRate ? parseFloat(settings.shortRestHourlyRate) : 3000;

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    nationality: "",
    idType: "",
    idNumber: "",
    address: "",
    emergencyContact: "",
    checkInDate: new Date().toISOString().slice(0, 10),
    checkOutDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    numGuests: 1,
    specialRequests: "",
    stayType: "lodge" as "lodge" | "short_rest",
    durationHours: 1,
  });

  useEffect(() => {
    api.getRooms().then(setRooms).catch(() => {});
  }, []);

  function update(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setStayType(type: "lodge" | "short_rest") {
    setForm((prev) => ({ ...prev, stayType: type }));
  }

  function toggleRoom(room: Room) {
    setSelectedRooms((prev) =>
      prev.some((r) => r.id === room.id)
        ? prev.filter((r) => r.id !== room.id)
        : [...prev, room]
    );
  }

  function isSelected(room: Room) {
    return selectedRooms.some((r) => r.id === room.id);
  }

  // ── Computed totals ───────────────────────────────────────────────────────
  const lodgeNights = Math.max(
    1,
    Math.round(
      (new Date(form.checkOutDate).getTime() - new Date(form.checkInDate).getTime()) / 86400000
    )
  );

  function roomLodgeTotal(room: Room) {
    return Number(room.pricePerNight) * lodgeNights;
  }

  const lodgeGrandTotal = selectedRooms.reduce((sum, r) => sum + roomLodgeTotal(r), 0);
  const shortRestTotal = hourlyRate * form.durationHours * Math.max(1, selectedRooms.length);
  const totalDue = form.stayType === "lodge" ? lodgeGrandTotal : shortRestTotal;

  const tenderedNum = parseFloat(amountTendered);
  const change =
    paymentMethod === "cash" && amountTendered !== "" && !isNaN(tenderedNum)
      ? tenderedNum - totalDue
      : null;
  const cashInvalid =
    paymentMethod === "cash" &&
    (amountTendered === "" || isNaN(tenderedNum) || tenderedNum < totalDue);

  // ── Step 1: validate and open payment modal ───────────────────────────────
  function handleBookClick(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRooms.length === 0) {
      setError("Please select at least one room before booking.");
      return;
    }
    if (!form.fullName.trim() || !form.phone.trim()) {
      setError("Full name and phone number are required.");
      return;
    }
    setError("");
    setAmountTendered(String(totalDue));
    setShowPaymentModal(true);
  }

  // ── Step 2: confirm → atomically book all rooms, then record payments ────
  async function handleConfirmPayment() {
    if (selectedRooms.length === 0) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. Book all rooms in a single atomic server transaction (all-or-nothing)
      const result = await api.createMultiRoomBooking({
        guest: {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          nationality: form.nationality || undefined,
          idType: form.idType || undefined,
          idNumber: form.idNumber || undefined,
          address: form.address || undefined,
          emergencyContact: form.emergencyContact || undefined,
        },
        roomIds: selectedRooms.map((r) => r.id),
        checkInDate: form.checkInDate,
        checkOutDate: form.stayType === "short_rest" ? form.checkInDate : form.checkOutDate,
        numGuests: Number(form.numGuests),
        specialRequests: form.specialRequests || undefined,
        source: "walk_in",
        stayType: form.stayType,
        durationHours: form.stayType === "short_rest" ? form.durationHours : undefined,
      });

      // 2. Record one payment per reservation (best-effort — the booking is already committed)
      const paymentFailures: string[] = [];
      for (const room of selectedRooms) {
        const reservation = result.reservations.find((r: any) => r.roomId === room.id);
        if (!reservation) continue;
        const roomAmount =
          form.stayType === "lodge" ? roomLodgeTotal(room) : hourlyRate * form.durationHours;
        try {
          await api.createPayment({
            reservationId: reservation.id,
            amount: roomAmount,
            method: paymentMethod,
            type: "payment",
          });
        } catch {
          paymentFailures.push(`Room ${room.roomNumber}`);
        }
      }

      if (paymentFailures.length > 0) {
        // Booking is confirmed; show a warning and redirect after a brief pause
        setError(
          `Booking confirmed, but payment recording failed for: ${paymentFailures.join(", ")}. ` +
            "Please record the payment manually in Reservations."
        );
        setTimeout(() => navigate("/reservations"), 4000);
      } else {
        navigate("/reservations");
      }
    } catch (err: any) {
      // Booking transaction failed atomically — no rooms were marked occupied
      setError(err.message || "Failed to complete booking — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const availableRooms = rooms.filter((r) => r.status === "available");

  // ── Room preview helpers ──────────────────────────────────────────────────
  function openPreview(room: Room) {
    setPreviewRoom(room);
    setPreviewImgIndex(0);
  }

  const previewImages: string[] =
    previewRoom
      ? previewRoom.imageUrls?.length
        ? (previewRoom.imageUrls as string[])
        : previewRoom.imageUrl
        ? [previewRoom.imageUrl]
        : []
      : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Walk-in Guest Booking</h1>
          <p className="page-sub">Book rooms instantly for a guest at the front desk</p>
        </div>
      </div>

      <form onSubmit={handleBookClick}>
        <div className="grid-2">
          {/* ── Left: Guest + Booking details ── */}
          <div className="card glass">
            <h2>Guest Information</h2>
            <div className="field">
              <label>Full Name *</label>
              <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Phone Number *</label>
                <input value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
              </div>
              <div className="field">
                <label>Email Address</label>
                <input value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Nationality</label>
                <input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
              </div>
              <div className="field">
                <label>ID Type</label>
                <input value={form.idType} onChange={(e) => update("idType", e.target.value)} placeholder="Passport, National ID..." />
              </div>
            </div>
            <div className="field">
              <label>ID Number</label>
              <input value={form.idNumber} onChange={(e) => update("idNumber", e.target.value)} />
            </div>
            <div className="field">
              <label>Home Address</label>
              <input value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="field">
              <label>Emergency Contact</label>
              <input value={form.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} />
            </div>

            <h2 style={{ marginTop: 24 }}>Booking Details</h2>

            {/* Stay Type Toggle */}
            <div className="field">
              <label>Stay Type</label>
              <div className="stay-type-toggle">
                <button
                  type="button"
                  className={`stay-type-btn ${form.stayType === "lodge" ? "active" : ""}`}
                  onClick={() => setStayType("lodge")}
                >
                  <span className="stay-type-icon">🛏️</span>
                  <span className="stay-type-name">Lodge</span>
                  <span className="stay-type-desc">Per night</span>
                </button>
                <button
                  type="button"
                  className={`stay-type-btn ${form.stayType === "short_rest" ? "active" : ""}`}
                  onClick={() => setStayType("short_rest")}
                >
                  <span className="stay-type-icon">⏱️</span>
                  <span className="stay-type-name">Short Rest</span>
                  <span className="stay-type-desc">₦{hourlyRate.toLocaleString()}/hr</span>
                </button>
              </div>
            </div>

            {form.stayType === "lodge" ? (
              <div className="field-row">
                <div className="field">
                  <label>Check-in Date</label>
                  <input type="date" value={form.checkInDate} onChange={(e) => update("checkInDate", e.target.value)} />
                </div>
                <div className="field">
                  <label>Check-out Date</label>
                  <input type="date" value={form.checkOutDate} onChange={(e) => update("checkOutDate", e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="field-row">
                <div className="field">
                  <label>Check-in Date</label>
                  <input type="date" value={form.checkInDate} onChange={(e) => update("checkInDate", e.target.value)} />
                </div>
                <div className="field">
                  <label>Duration (hours)</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={form.durationHours}
                    onChange={(e) => update("durationHours", Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label>Number of Guests</label>
              <input type="number" min={1} value={form.numGuests} onChange={(e) => update("numGuests", e.target.value)} />
            </div>
            <div className="field">
              <label>Special Requests</label>
              <textarea value={form.specialRequests} onChange={(e) => update("specialRequests", e.target.value)} />
            </div>

            {/* Pricing summary */}
            {selectedRooms.length > 0 && (
              <div className="booking-price-summary glass" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                {form.stayType === "lodge" ? (
                  <>
                    {selectedRooms.map((room) => (
                      <div key={room.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                        <span>Room {room.roomNumber} × {lodgeNights} night{lodgeNights !== 1 ? "s" : ""}</span>
                        <span>₦{roomLodgeTotal(room).toLocaleString()}</span>
                      </div>
                    ))}
                    {selectedRooms.length > 1 && (
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 6, marginTop: 2 }}>
                        <strong>Total</strong>
                        <strong>₦{lodgeGrandTotal.toLocaleString()}</strong>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>₦{hourlyRate.toLocaleString()} × {form.durationHours} hr{form.durationHours !== 1 ? "s" : ""} × {selectedRooms.length} room{selectedRooms.length !== 1 ? "s" : ""}</span>
                    <strong>₦{shortRestTotal.toLocaleString()}</strong>
                  </div>
                )}
              </div>
            )}

            {error && <p className="error-text">{error}</p>}
            <button className="btn full" type="submit" disabled={submitting}>
              {submitting
                ? "Processing…"
                : selectedRooms.length > 0
                ? `Proceed to Payment — ${selectedRooms.length} Room${selectedRooms.length !== 1 ? "s" : ""} · ₦${totalDue.toLocaleString()}`
                : "Select a room to continue"}
            </button>
          </div>

          {/* ── Right: Room grid ── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Available Rooms</h2>
              {selectedRooms.length > 0 && (
                <span style={{ fontSize: "0.85rem", padding: "4px 10px", background: "var(--accent)", borderRadius: 20, color: "#fff" }}>
                  {selectedRooms.length} selected
                </span>
              )}
            </div>

            <div className="room-grid">
              {availableRooms.map((room) => {
                const selected = isSelected(room);
                return (
                  <div
                    key={room.id}
                    className={`room-card glass ${selected ? "selected" : ""}`}
                    onClick={() => toggleRoom(room)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="room-image">
                      {room.imageUrls?.length ? (
                        <img
                          src={(room.imageUrls as string[])[0]}
                          alt={`Room ${room.roomNumber}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                        />
                      ) : room.imageUrl ? (
                        <img
                          src={room.imageUrl}
                          alt={`Room ${room.roomNumber}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                        />
                      ) : (
                        room.roomType.includes("Suite") ? "🏰" : "🛏️"
                      )}
                    </div>
                    <div className="room-body">
                      <div className="room-title-row">
                        <strong>{room.roomType}</strong>
                        <span className="badge status-available">Available</span>
                      </div>
                      <div className="room-number">Room {room.roomNumber}</div>
                      <div className="room-price">₦{Number(room.pricePerNight).toLocaleString()} / night</div>
                      {form.stayType === "short_rest" && (
                        <div className="room-price" style={{ color: "var(--warn)" }}>
                          ₦{hourlyRate.toLocaleString()} / hr (short rest)
                        </div>
                      )}
                      <div className="room-amenities">
                        {room.amenities.map((a) => (
                          <span key={a} className="amenity-chip">
                            {AMENITY_ICONS[a] || "•"} {a}
                          </span>
                        ))}
                      </div>
                      <div className="room-capacity">👥 Up to {room.capacity} guests</div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ flex: 1, fontSize: "0.8rem", padding: "6px 8px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(room);
                          }}
                        >
                          👁 View Room
                        </button>
                        <button
                          type="button"
                          className={`btn ${selected ? "" : "secondary"}`}
                          style={{ flex: 1, fontSize: "0.8rem", padding: "6px 8px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRoom(room);
                          }}
                        >
                          {selected ? "✓ Selected" : "+ Select"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {availableRooms.length === 0 && <p className="page-sub">No rooms currently available.</p>}
            </div>
          </div>
        </div>
      </form>

      {/* ── Room Preview Modal ── */}
      {previewRoom && (
        <div className="modal-overlay" onClick={() => setPreviewRoom(null)}>
          <div
            className="modal"
            style={{ maxWidth: 560, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image gallery */}
            <div style={{ position: "relative", background: "#111", borderRadius: 12, overflow: "hidden", marginBottom: 20, height: 220 }}>
              {previewImages.length > 0 ? (
                <>
                  <img
                    src={previewImages[previewImgIndex]}
                    alt={`Room ${previewRoom.roomNumber}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {previewImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewImgIndex((i) => (i - 1 + previewImages.length) % previewImages.length)}
                        style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16 }}
                      >‹</button>
                      <button
                        type="button"
                        onClick={() => setPreviewImgIndex((i) => (i + 1) % previewImages.length)}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16 }}
                      >›</button>
                      <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
                        {previewImages.map((_, idx) => (
                          <span
                            key={idx}
                            onClick={() => setPreviewImgIndex(idx)}
                            style={{ width: 8, height: 8, borderRadius: "50%", background: idx === previewImgIndex ? "#fff" : "rgba(255,255,255,0.4)", cursor: "pointer" }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>
                  {previewRoom.roomType.includes("Suite") ? "🏰" : "🛏️"}
                </div>
              )}
            </div>

            {/* Room details */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 4px" }}>{previewRoom.roomType}</h2>
                <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Room {previewRoom.roomNumber}</div>
              </div>
              <span className="badge status-available">Available</span>
            </div>

            <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 2 }}>Per Night</div>
                <strong style={{ fontSize: "1.1rem" }}>₦{Number(previewRoom.pricePerNight).toLocaleString()}</strong>
              </div>
              {form.stayType === "short_rest" && (
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 2 }}>Per Hour</div>
                  <strong style={{ fontSize: "1.1rem", color: "var(--warn)" }}>₦{hourlyRate.toLocaleString()}</strong>
                </div>
              )}
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 2 }}>Capacity</div>
                <strong style={{ fontSize: "1.1rem" }}>👥 {previewRoom.capacity} guests</strong>
              </div>
            </div>

            {previewRoom.amenities.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 6 }}>AMENITIES</div>
                <div className="room-amenities" style={{ flexWrap: "wrap" }}>
                  {previewRoom.amenities.map((a) => (
                    <span key={a} className="amenity-chip" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                      {AMENITY_ICONS[a] || "•"} {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn secondary"
                style={{ flex: 1 }}
                onClick={() => setPreviewRoom(null)}
              >
                Close
              </button>
              <button
                type="button"
                className={`btn ${isSelected(previewRoom) ? "secondary" : ""}`}
                style={{ flex: 2 }}
                onClick={() => {
                  toggleRoom(previewRoom);
                  setPreviewRoom(null);
                }}
              >
                {isSelected(previewRoom) ? "✓ Remove from Selection" : "+ Select This Room"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Confirmation Modal ── */}
      {showPaymentModal && selectedRooms.length > 0 && (
        <div className="modal-overlay" onClick={() => !submitting && setShowPaymentModal(false)}>
          <div className="modal payment-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-modal-header">
              <span className="payment-modal-icon">💳</span>
              <h2>Confirm Payment</h2>
              <p className="page-sub">Collect payment before completing the booking</p>
            </div>

            {/* Booking summary */}
            <div className="payment-booking-summary">
              <div className="pbs-row">
                <span>Guest</span>
                <strong>{form.fullName}</strong>
              </div>
              <div className="pbs-row">
                <span>Rooms</span>
                <strong>
                  {selectedRooms.map((r) => `Room ${r.roomNumber}`).join(", ")}
                </strong>
              </div>
              <div className="pbs-row">
                <span>Stay Type</span>
                <strong>{form.stayType === "lodge" ? "🛏️ Lodge" : "⏱️ Short Rest"}</strong>
              </div>
              {form.stayType === "lodge" ? (
                <div className="pbs-row">
                  <span>Duration</span>
                  <strong>{lodgeNights} night{lodgeNights !== 1 ? "s" : ""}</strong>
                </div>
              ) : (
                <div className="pbs-row">
                  <span>Duration</span>
                  <strong>{form.durationHours} hour{form.durationHours !== 1 ? "s" : ""}</strong>
                </div>
              )}

              {/* Per-room breakdown when multiple rooms */}
              {selectedRooms.length > 1 && form.stayType === "lodge" && (
                <>
                  <div className="pbs-divider" />
                  {selectedRooms.map((room) => (
                    <div key={room.id} className="pbs-row" style={{ fontSize: "0.85rem" }}>
                      <span>Room {room.roomNumber} ({room.roomType})</span>
                      <span>₦{roomLodgeTotal(room).toLocaleString()}</span>
                    </div>
                  ))}
                </>
              )}

              <div className="pbs-divider" />
              <div className="pbs-row pbs-total">
                <span>Total Due</span>
                <strong className="pbs-amount">₦{totalDue.toLocaleString()}</strong>
              </div>
            </div>

            {/* Payment method */}
            <div className="field" style={{ marginTop: 20 }}>
              <label>Payment Method</label>
              <div className="payment-method-grid">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`payment-method-btn ${paymentMethod === m.value ? "active" : ""}`}
                    onClick={() => setPaymentMethod(m.value)}
                  >
                    <span className="pm-icon">{m.icon}</span>
                    <span className="pm-label">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cash change calculator */}
            {paymentMethod === "cash" && (
              <div className="cash-change-section">
                <div className="field">
                  <label>Amount Tendered (₦)</label>
                  <input
                    type="number"
                    min={totalDue}
                    step="50"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                  />
                </div>
                {change !== null && (
                  <div className={`change-display ${change < 0 ? "insufficient" : ""}`}>
                    {change < 0 ? (
                      <>⚠️ Insufficient — short by ₦{Math.abs(change).toLocaleString()}</>
                    ) : (
                      <>💰 Change to return: <strong>₦{change.toLocaleString()}</strong></>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowPaymentModal(false)}
                disabled={submitting}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleConfirmPayment}
                disabled={submitting || cashInvalid}
              >
                {submitting
                  ? `Booking ${selectedRooms.length} room${selectedRooms.length !== 1 ? "s" : ""}…`
                  : `✓ Confirm & Check In (${selectedRooms.length} Room${selectedRooms.length !== 1 ? "s" : ""})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
