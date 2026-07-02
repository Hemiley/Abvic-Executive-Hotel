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
    imageUrls: [] as string[],
  });
  const [editForm, setEditForm] = useState({
    roomType: "",
    pricePerNight: "",
    capacity: "",
    amenities: "",
    imageUrls: [] as string[],
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
        imageUrls: form.imageUrls as any,
        imageUrl: form.imageUrls[0] || undefined,
      });
      setShowNew(false);
      setForm({ roomNumber: "", roomType: "Standard Room", pricePerNight: "80", capacity: "2", amenities: "Wi-Fi, TV, AC", imageUrls: [] });
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
    // Merge imageUrls array with legacy imageUrl for backward compat
    const urls = room.imageUrls && room.imageUrls.length > 0
      ? room.imageUrls
      : room.imageUrl ? [room.imageUrl] : [];
    setEditForm({
      roomType: room.roomType,
      pricePerNight: room.pricePerNight,
      capacity: String(room.capacity),
      amenities: room.amenities.join(", "),
      imageUrls: urls,
    });
  }

  async function addImage(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "create" | "edit"
  ) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const dataUrls = await Promise.all(files.map((f) => fileToResizedDataUrl(f, 480, 0.82)));
      if (target === "create") {
        setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...dataUrls] }));
      } else {
        setEditForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...dataUrls] }));
      }
    } catch (err: any) {
      setError(err.message || "Could not process image");
    }
    // Reset the input so the same file can be re-selected
    e.target.value = "";
  }

  function removeImage(index: number, target: "create" | "edit") {
    if (target === "create") {
      setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((_, i) => i !== index) }));
    } else {
      setEditForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((_, i) => i !== index) }));
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
        imageUrls: editForm.imageUrls as any,
        imageUrl: editForm.imageUrls[0] || null,
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
        {rooms.map((room) => {
          const primaryImage = (room.imageUrls && room.imageUrls.length > 0) ? room.imageUrls[0] : room.imageUrl;
          return (
            <div key={room.id} className="room-card glass">
              <div className="room-image" style={primaryImage ? { backgroundImage: `url(${primaryImage})` } : undefined}>
                {!primaryImage && (room.roomType.includes("Suite") ? "🏰" : "🛏️")}
              </div>
              {room.imageUrls && room.imageUrls.length > 1 && (
                <div className="room-thumb-strip">
                  {room.imageUrls.map((url, i) => (
                    <div
                      key={i}
                      className="room-thumb"
                      style={{ backgroundImage: `url(${url})` }}
                    />
                  ))}
                </div>
              )}
              <div className="room-body">
                <div className="room-title-row">
                  <strong>{room.roomType}</strong>
                  <span className={`badge status-${room.status}`}>{room.status}</span>
                </div>
                <div className="room-number">Room {room.roomNumber}</div>
                <div className="room-price">₦{Number(room.pricePerNight).toFixed(2)} / night</div>
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
          );
        })}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <form className="modal glass" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h2>Add Room</h2>

            {/* Multi-image upload for new room */}
            <div className="field">
              <label>Room Photos</label>
              <div className="multi-image-grid">
                {form.imageUrls.map((url, i) => (
                  <div key={i} className="multi-image-thumb">
                    <img src={url} alt={`Room photo ${i + 1}`} />
                    <button
                      type="button"
                      className="multi-image-remove"
                      onClick={() => removeImage(i, "create")}
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <label className="multi-image-add">
                  <span>+ Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => addImage(e, "create")}
                    hidden
                  />
                </label>
              </div>
            </div>

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
                <label>Price / Night (₦)</label>
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

            {/* Multi-image management */}
            <div className="field">
              <label>Room Photos</label>
              <div className="multi-image-grid">
                {editForm.imageUrls.map((url, i) => (
                  <div key={i} className="multi-image-thumb">
                    <img src={url} alt={`Room photo ${i + 1}`} />
                    {i === 0 && <span className="multi-image-primary-badge">Main</span>}
                    <button
                      type="button"
                      className="multi-image-remove"
                      onClick={() => removeImage(i, "edit")}
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <label className="multi-image-add">
                  <span>+ Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => addImage(e, "edit")}
                    hidden
                  />
                </label>
              </div>
              {editForm.imageUrls.length > 0 && (
                <p className="field-hint">First photo is used as the main card image. Drag to reorder not needed — just remove and re-add.</p>
              )}
            </div>

            <div className="field-row">
              <div className="field">
                <label>Room Name / Type</label>
                <input value={editForm.roomType} onChange={(e) => setEditForm({ ...editForm, roomType: e.target.value })} required />
              </div>
              <div className="field">
                <label>Price / Night (₦)</label>
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
