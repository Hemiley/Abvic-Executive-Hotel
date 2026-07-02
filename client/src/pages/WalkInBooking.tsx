import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Room } from "../lib/api";

const AMENITY_ICONS: Record<string, string> = {
  "Wi-Fi": "📶",
  TV: "📺",
  AC: "❄️",
  "Mini Bar": "🍹",
  Jacuzzi: "🛁",
  "Butler Service": "🤵",
};

export default function WalkInBooking() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

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
  });

  useEffect(() => {
    api.getRooms().then(setRooms).catch(() => {});
  }, []);

  function update(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom) {
      setError("Please select a room before booking.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.createBooking({
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
        roomId: selectedRoom.id,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        numGuests: Number(form.numGuests),
        specialRequests: form.specialRequests || undefined,
        source: "walk_in",
      });
      navigate("/reservations");
    } catch (err: any) {
      setError(err.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  }

  const availableRooms = rooms.filter((r) => r.status === "available");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Walk-in Guest Booking</h1>
          <p className="page-sub">Book a room instantly for a guest at the front desk</p>
        </div>
      </div>

      <form onSubmit={handleBook}>
        <div className="grid-2">
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
            <div className="field">
              <label>Number of Guests</label>
              <input type="number" min={1} value={form.numGuests} onChange={(e) => update("numGuests", e.target.value)} />
            </div>
            <div className="field">
              <label>Special Requests</label>
              <textarea value={form.specialRequests} onChange={(e) => update("specialRequests", e.target.value)} />
            </div>

            {error && <p className="error-text">{error}</p>}
            <button className="btn full" type="submit" disabled={submitting}>
              {submitting ? "Booking..." : selectedRoom ? `Confirm Booking — Room ${selectedRoom.roomNumber}` : "Select a room to continue"}
            </button>
          </div>

          <div>
            <h2>Available Rooms</h2>
            <div className="room-grid">
              {availableRooms.map((room) => (
                <div
                  key={room.id}
                  className={`room-card glass ${selectedRoom?.id === room.id ? "selected" : ""}`}
                  onClick={() => setSelectedRoom(room)}
                >
                  <div className="room-image">{room.roomType.includes("Suite") ? "🏰" : "🛏️"}</div>
                  <div className="room-body">
                    <div className="room-title-row">
                      <strong>{room.roomType}</strong>
                      <span className="badge status-available">Available</span>
                    </div>
                    <div className="room-number">Room {room.roomNumber}</div>
                    <div className="room-price">${Number(room.pricePerNight).toFixed(2)} / night</div>
                    <div className="room-amenities">
                      {room.amenities.map((a) => (
                        <span key={a} className="amenity-chip">
                          {AMENITY_ICONS[a] || "•"} {a}
                        </span>
                      ))}
                    </div>
                    <div className="room-capacity">👥 Up to {room.capacity} guests</div>
                    <button
                      type="button"
                      className={`btn ${selectedRoom?.id === room.id ? "" : "secondary"} full`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      {selectedRoom?.id === room.id ? "Selected" : "Book Now"}
                    </button>
                  </div>
                </div>
              ))}
              {availableRooms.length === 0 && <p className="page-sub">No rooms currently available.</p>}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
