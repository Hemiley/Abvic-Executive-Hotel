import { useEffect, useState } from "react";
import { api, type KitchenInventoryItem, type Branch, type StockSubmission, type KitchenShift } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = ["Meat", "Poultry", "Seafood", "Grains", "Vegetables", "Oils & Fats", "Seasonings", "Drinks", "Frozen", "Other"];
const UNITS = ["kg", "liters", "cartons", "pieces", "packs", "bags", "bottles"];

const emptyForm = {
  branchId: "",
  name: "",
  category: "Meat",
  unit: "kg",
  pricePerUnit: "",
  openingStock: "0",
  stockReceived: "0",
  minimumStock: "0",
  status: "available" as const,
};

export default function KitchenInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManage = isAdmin || user?.role === "supervisor";
  const canTrackStock = canManage || user?.role === "chef";
  const [items, setItems] = useState<KitchenInventoryItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<KitchenInventoryItem | null>(null);
  const [stockModal, setStockModal] = useState<KitchenInventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KitchenInventoryItem | null>(null);
  const [pendingStock, setPendingStock] = useState<StockSubmission[]>([]);
  const [activeShift, setActiveShift] = useState<KitchenShift | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockType, setStockType] = useState<"received" | "used" | "waste" | "adjustment">("received");
  const [stockNote, setStockNote] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  function load() {
    api.getKitchenInventory(isAdmin ? filterBranch || undefined : undefined).then(setItems).catch(e => setError(e.message));
    if (isAdmin) api.getBranches().then(setBranches).catch(() => {});
    else setForm(f => ({ ...f, branchId: user?.branchId || "" }));
    if (user?.role === "chef") {
      api.getPendingStock().then(setPendingStock).catch(e => setError(e.message));
      api.getActiveKitchenShift().then(setActiveShift).catch(() => setActiveShift(null));
    }
  }

  useEffect(() => {
    load();
    if (user?.role !== "chef") return;
    const refresh = setInterval(load, 15000);
    return () => clearInterval(refresh);
  }, [filterBranch, user?.role]);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return (filterCat === "All" || i.category === filterCat) &&
        i.name.toLowerCase().includes(q);
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await api.createKitchenInventoryItem({
        ...form,
        pricePerUnit: Number(form.pricePerUnit) || 0,
        openingStock: 0,
        stockReceived: 0,
        minimumStock: Number(form.minimumStock),
        branchId: isAdmin ? form.branchId : (user?.branchId || ""),
      } as any);
      setShowNew(false);
      setForm(emptyForm);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(""); setSaving(true);
    try {
      await api.updateKitchenInventoryItem(editing.id, {
        name: editForm.name,
        category: editForm.category as any,
        unit: editForm.unit as any,
        pricePerUnit: Number(editForm.pricePerUnit) || 0,
        minimumStock: Number(editForm.minimumStock),
        status: editForm.status,
      } as any);
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await api.deleteKitchenInventoryItem(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setDeleteError(e.message || "Could not delete this item.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleStockMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!stockModal) return;
    setError(""); setSaving(true);
    try {
      if (stockType === "received") {
        await api.submitStock({
          department: "kitchen",
          itemId: stockModal.id,
          branchId: stockModal.branchId,
          quantity: Number(stockQty),
          note: stockNote.trim() || undefined,
          requestKey: crypto.randomUUID(),
        });
      } else {
        await api.recordKitchenStockMovement({
          itemId: stockModal.id,
          type: stockType,
          quantity: Number(stockQty),
          note: stockNote,
        });
      }
      setStockModal(null);
      setStockQty("");
      setStockNote("");
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  function openStock(item: KitchenInventoryItem) {
    setStockModal(item);
    setStockType(canManage ? "received" : "used");
    setStockQty("");
    setStockNote("");
  }

  async function handleAcceptStock(submission: StockSubmission) {
    setError(""); setAcceptingId(submission.id);
    try {
      await api.acceptStock(submission.id);
      setPendingStock(current => current.filter(item => item.id !== submission.id));
      load();
    } catch (e: any) { setError(e.message); }
    finally { setAcceptingId(null); }
  }

  function openEdit(item: KitchenInventoryItem) {
    setEditing(item);
    setEditForm({
      branchId: item.branchId,
      name: item.name,
      category: item.category,
      unit: item.unit,
      pricePerUnit: item.pricePerUnit,
      openingStock: item.openingStock,
      stockReceived: item.stockReceived,
      minimumStock: item.minimumStock,
      status: item.status as any,
    });
  }

  const statusColor = (s: string) => s === "available" ? "#4ade80" : s === "low_stock" ? "#f59e0b" : "#f87171";
  const fmt = (v: string | number) => `₦${Number(v).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="page-header">
        <div><h1>Kitchen Inventory</h1><p className="page-sub">Manage kitchen ingredients and stock</p></div>
        {canManage && <button className="btn" onClick={() => setShowNew(true)}>+ Add Item</button>}
      </div>

      {user?.role === "chef" && (
        <section className="glass" style={{ borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Stock Awaiting Acceptance</h2>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
                {activeShift ? "Accepted stock will be recorded on your active shift." : "Start a Kitchen shift before accepting stock."}
              </p>
            </div>
            <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{pendingStock.length} pending</span>
          </div>
          {pendingStock.length === 0 ? <p style={{ color: "var(--muted)", margin: 0 }}>No stock is waiting for acceptance.</p> : (
            <div style={{ display: "grid", gap: 8 }}>
              {pendingStock.map(submission => (
                <div key={submission.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 10 }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <strong>{submission.itemName}</strong>
                    <div style={{ color: "var(--muted)", fontSize: ".82rem" }}>
                      {submission.quantity} {submission.unit} · submitted by {submission.submittedByName} · {new Date(submission.submittedAt).toLocaleString()}
                    </div>
                    {submission.note && <div style={{ color: "var(--muted)", fontSize: ".82rem" }}>{submission.note}</div>}
                  </div>
                  <button className="btn" disabled={!activeShift || acceptingId === submission.id} onClick={() => handleAcceptStock(submission)}>
                    {acceptingId === submission.id ? "Accepting…" : "Accept stock"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input className="search-input" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        {isAdmin && (
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ minWidth: 140 }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              {["Name", "Category", "Unit", "Price/Unit", "Current Stock", "Min. Stock", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No items found</td></tr>}
            {filtered.map(item => (
              <tr key={item.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{item.name}</td>
                <td style={{ padding: "10px 12px" }}>{item.category}</td>
                <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{item.unit}</td>
                <td style={{ padding: "10px 12px" }}>{fmt(item.pricePerUnit)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ color: Number(item.currentStock) <= Number(item.minimumStock) ? "#f59e0b" : "inherit", fontWeight: Number(item.currentStock) <= Number(item.minimumStock) ? 700 : 400 }}>
                    {item.currentStock} {item.unit}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{item.minimumStock} {item.unit}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, background: `${statusColor(item.status)}22`, color: statusColor(item.status) }}>
                    {item.status.replace("_", " ")}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {canTrackStock && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn secondary" style={{ padding: "3px 10px", fontSize: "0.78rem" }} onClick={() => openStock(item)}>Stock</button>
                      {canManage && <button className="btn secondary" style={{ padding: "3px 10px", fontSize: "0.78rem" }} onClick={() => openEdit(item)}>Edit</button>}
                      {canManage && (
                        <button
                          type="button"
                          className="btn danger"
                          style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                          onClick={() => { setDeleteError(""); setDeleteTarget(item); }}
                          aria-label={`Delete ${item.name}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Item Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal glass" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>Add Kitchen Item</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {isAdmin && (
                  <div className="field" style={{ gridColumn: "1/-1" }}>
                    <label>Branch *</label>
                    <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} required>
                      <option value="">Select branch</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="field"><label>Item Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div className="field"><label>Category *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field"><label>Unit *</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field"><label>Price per Unit (₦)</label><input type="number" min="0" value={form.pricePerUnit} onChange={e => setForm(f => ({ ...f, pricePerUnit: e.target.value }))} /></div>
                <div className="field"><label>Minimum Stock Level</label><input type="number" min="0" value={form.minimumStock} onChange={e => setForm(f => ({ ...f, minimumStock: e.target.value }))} /></div>
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Saving..." : "Add Item"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal glass" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2>Edit: {editing.name}</h2>
            <form onSubmit={handleUpdate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field" style={{ gridColumn: "1/-1" }}><label>Item Name *</label><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div className="field"><label>Category</label>
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field"><label>Unit</label>
                  <select value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field"><label>Price per Unit (₦)</label><input type="number" min="0" value={editForm.pricePerUnit} onChange={e => setEditForm(f => ({ ...f, pricePerUnit: e.target.value }))} /></div>
                <div className="field"><label>Min. Stock Level</label><input type="number" min="0" value={editForm.minimumStock} onChange={e => setEditForm(f => ({ ...f, minimumStock: e.target.value }))} /></div>
                <div className="field"><label>Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as any }))}>
                    <option value="available">Available</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {stockModal && (
        <div className="modal-overlay" onClick={() => setStockModal(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Update Stock: {stockModal.name}</h2>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>Current: <strong>{stockModal.currentStock} {stockModal.unit}</strong></p>
            <form onSubmit={handleStockMovement}>
              <div className="field">
                <label>Movement Type</label>
                <select value={stockType} onChange={e => setStockType(e.target.value as any)}>
                  {canManage && <option value="received">Submit Stock for Acceptance</option>}
                  <option value="used">Used in Kitchen</option>
                  <option value="waste">Waste / Spoilage</option>
                  <option value="adjustment">Manual Adjustment</option>
                </select>
              </div>
              <div className="field">
                <label>Quantity ({stockModal.unit}) *</label>
                <input type="number" min={stockType === "adjustment" ? "0" : "0.01"} step="0.01" value={stockQty} onChange={e => setStockQty(e.target.value)} required />
              </div>
              <div className="field">
                <label>Note</label>
                <input value={stockNote} onChange={e => setStockNote(e.target.value)} placeholder="Optional note..." />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setStockModal(null)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Saving..." : "Update Stock"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft-delete confirmation. Historical stock movements are retained. */}
      {canManage && deleteTarget && (
        <div
          className="modal-overlay"
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
        >
          <div
            className="modal glass"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-kitchen-item-title"
            aria-describedby="delete-kitchen-item-description"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="delete-kitchen-item-title">Delete kitchen item?</h2>
            <p id="delete-kitchen-item-description">
              Remove <strong>{deleteTarget.name}</strong> from active inventory and ingredient menus?
              Existing stock history will be kept.
            </p>
            {deleteError && <p className="error-text">{deleteError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
