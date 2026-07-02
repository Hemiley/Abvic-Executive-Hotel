import { useEffect, useState } from "react";
import { api, type Room } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { fileToResizedDataUrl } from "../lib/image";

export default function Rooms() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    roomNumber: "",
    roomType: "Standard Room",
    pricePerNight: "80",
    capacity: "2",
    amenities: "Wi-Fi, TV, AC",
  });
  const [editForm, setEditForm] = useState({
    roomType: "",
    pricePerNight: "",
    capacity: "",
    amenities: "",
    imageUrl: "",
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

  function openEdit(room: Room) {
    setEditing(room);
    setEditForm({
      roomType: room.roomType,
      pricePerNight: room.pricePerNight,
      capacity: String(room.capacity),
      amenities: room.amenities.join(", "),
      imageUrl: room.imageUrl || "",
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 480, 0.82);
      setEditForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch (err: any) {
      setError(err.message || "Could not process image");
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api.updateRoom(editing.id, {
        roomType: editForm.roomType,
        pricePerNight: Number(editForm.pricePerNight) as any,
        capacity: Number(editForm.capacity) as any,
        amenities: editForm.amenities.split(",").map((a) => a.trim()).filter(Boolean) as any,
        imageUrl: editForm.imageUrl,
      });
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Room Management</h1>
          <p className="page-sub">Color-coded room status across the property</p>
        </div>
        {isAdmin && (
          <button className="btn" onClick={() => setShowNew(true)}>
            + Add Room
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="room-grid">
        {rooms.map((room) => (
          <div key={room.id} className="room-card glass">
            <div className="room-image" style={room.imageUrl ? { backgroundImage: `url(${room.imageUrl})` } : undefined}>
              {!room.imageUrl && (room.roomType.includes("Suite") ? "🏰" : "🛏️")}
            </div>
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
              {isAdmin && (
                <button className="btn secondary full room-edit-btn" onClick={() => openEdit(room)}>
                  Edit Room
                </button>
              )}
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

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <form className="modal glass" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSave}>
            <h2>Edit Room {editing.roomNumber}</h2>
            <div className="avatar-upload-row">
              {editForm.imageUrl ? (
                <img src={editForm.imageUrl} alt="Room preview" className="room-image-preview" />
              ) : (
                <div className="room-image-preview room-image-preview-empty">🛏️</div>
              )}
              <label className="btn secondary file-btn">
                Upload Photo
                <input type="file" accept="image/*" onChange={handleImageChange} hidden />
              </label>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Room Name / Type</label>
                <input value={editForm.roomType} onChange={(e) => setEditForm({ ...editForm, roomType: e.target.value })} required />
              </div>
              <div className="field">
                <label>Price / Night ($)</label>
                <input
                  type="number"
                  value={editForm.pricePerNight}
                  onChange={(e) => setEditForm({ ...editForm, pricePerNight: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Capacity</label>
              <input type="number" value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
            </div>
            <div className="field">
              <label>Amenities (comma separated)</label>
              <input value={editForm.amenities} onChange={(e) => setEditForm({ ...editForm, amenities: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
