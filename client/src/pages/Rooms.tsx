import { useEffect, useState } from "react";
import { api, type Room } from "../lib/api";

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    roomNumber: "",
    roomType: "Standard Room",
    pricePerNight: "80",
    capacity: "2",
    amenities: "Wi-Fi, TV, AC",
  });

  function load() {
    api.getRooms().then(setRooms).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createRoom({
        roomNumber: form.roomNumber,
        roomType: form.roomType,
        pricePerNight: Number(form.pricePerNight) as any,
        capacity: Number(form.capacity) as any,
        amenities: form.amenities.split(",").map((a) => a.trim()).filter(Boolean) as any,
      });
      setShowNew(false);
      setForm({ roomNumber: "", roomType: "Standard Room", pricePerNight: "80", capacity: "2", amenities: "Wi-Fi, TV, AC" });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api.updateRoom(id, { status: status as any });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Room Management</h1>
          <p className="page-sub">Color-coded room status across the property</p>
        </div>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Add Room
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="room-grid">
        {rooms.map((room) => (
          <div key={room.id} className="room-card glass">
            <div className="room-image">{room.roomType.includes("Suite") ? "🏰" : "🛏️"}</div>
            <div className="room-body">
              <div className="room-title-row">
                <strong>{room.roomType}</strong>
                <span className={`badge status-${room.status}`}>{room.status}</span>
              </div>
              <div className="room-number">Room {room.roomNumber}</div>
              <div className="room-price">${Number(room.pricePerNight).toFixed(2)} / night</div>
              <div className="room-amenities">
                {room.amenities.map((a) => (
                  <span key={a} className="amenity-chip">
                    {a}
                  </span>
                ))}
              </div>
              <div className="room-capacity">👥 Up to {room.capacity} guests</div>
              <select value={room.status} onChange={(e) => setStatus(room.id, e.target.value)}>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <form className="modal glass" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h2>Add Room</h2>
            <div className="field-row">
              <div className="field">
                <label>Room Number</label>
                <input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} required />
              </div>
              <div className="field">
                <label>Room Type</label>
                <input value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })} required />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Price / Night ($)</label>
                <input type="number" value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })} />
              </div>
              <div className="field">
                <label>Capacity</label>
                <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Amenities (comma separated)</label>
              <input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Add Room
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
