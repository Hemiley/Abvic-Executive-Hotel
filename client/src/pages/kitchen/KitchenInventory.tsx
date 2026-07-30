import { useEffect, useState } from "react";
import { api, type KitchenInventoryItem, type Branch } from "../../lib/api";
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
  supplier: "",
  purchaseCost: "",
  expiryDate: "",
  status: "available" as const,
};

export default function KitchenInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManage = isAdmin || user?.role === "supervisor" || user?.role === "chef";
  const [items, setItems] = useState<KitchenInventoryItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<KitchenInventoryItem | null>(null);
  const [stockModal, setStockModal] = useState<KitchenInventoryItem | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockType, setStockType] = useState<"received" | "used" | "waste" | "adjustment">("received");
  const [stockNote, setStockNote] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    api.getKitchenInventory(isAdmin ? filterBranch || undefined : undefined).then(setItems).catch(e => setError(e.message));
    if (isAdmin) api.getBranches().then(setBranches).catch(() => {});
    else setForm(f => ({ ...f, branchId: user?.branchId || "" }));
  }

  useEffect(() => { load(); }, [filterBranch]);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return (filterCat === "All" || i.category === filterCat) &&
      (i.name.toLowerCase().includes(q) || (i.supplier || "").toLowerCase().includes(q));
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await api.createKitchenInventoryItem({
        ...form,
        pricePerUnit: Number(form.pricePerUnit) || 0,
        openingStock: Number(form.openingStock),
        stockReceived: Number(form.stockReceived),
        minimumStock: Number(form.minimumStock),
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
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
        supplier: editForm.supplier || undefined,
        purchaseCost: editForm.purchaseCost ? Number(editForm.purchaseCost) : undefined,
        expiryDate: editForm.expiryDate || undefined,
        status: editForm.status,
      } as any);
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleStockMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!stockModal) return;
    setError(""); setSaving(true);
    try {
      await api.recordKitchenStockMovement({
        itemId: stockModal.id,
        type: stockType,
        quantity: Number(stockQty),
        note: stockNote,
      });
      setStockModal(null);
      setStockQty("");
      setStockNote("");
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
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
      supplier: item.supplier || "",
      purchaseCost: item.purchaseCost || "",
      expiryDate: item.expiryDate || "",
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
              {["Name", "Category", "Unit", "Price/Unit", "Current Stock", "Min. Stock", "Status", "Expiry", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No items found</td></tr>}
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
                <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: "0.8rem" }}>{item.expiryDate || "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  {canManage && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn secondary" style={{ padding: "3px 10px", fontSize: "0.78rem" }} onClick={() => setStockModal(item)}>Stock</button>
                      <button className="btn secondary" style={{ padding: "3px 10px", fontSize: "0.78rem" }} onClick={() => openEdit(item)}>Edit</button>
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
                <div className="field"><label>Opening Stock</label><input type="number" min="0" value={form.openingStock} onChange={e => setForm(f => ({ ...f, openingStock: e.target.value }))} /></div>
                <div className="field"><label>Stock Received</label><input type="number" min="0" value={form.stockReceived} onChange={e => setForm(f => ({ ...f, stockReceived: e.target.value }))} /></div>
                <div className="field"><label>Minimum Stock Level</label><input type="number" min="0" value={form.minimumStock} onChange={e => setForm(f => ({ ...f, minimumStock: e.target.value }))} /></div>
                <div className="field"><label>Supplier</label><input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
                <div className="field"><label>Purchase Cost (₦)</label><input type="number" min="0" value={form.purchaseCost} onChange={e => setForm(f => ({ ...f, purchaseCost: e.target.value }))} /></div>
                <div className="field"><label>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></div>
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
                <div className="field"><label>Supplier</label><input value={editForm.supplier} onChange={e => setEditForm(f => ({ ...f, supplier: e.target.value }))} /></div>
                <div className="field"><label>Purchase Cost (₦)</label><input type="number" min="0" value={editForm.purchaseCost} onChange={e => setEditForm(f => ({ ...f, purchaseCost: e.target.value }))} /></div>
                <div className="field"><label>Expiry Date</label><input type="date" value={editForm.expiryDate} onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))} /></div>
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
                  <option value="received">Stock Received</option>
                  <option value="used">Used in Kitchen</option>
                  <option value="waste">Waste / Spoilage</option>
                  <option value="adjustment">Manual Adjustment</option>
                </select>
              </div>
              <div className="field">
                <label>Quantity ({stockModal.unit}) *</label>
                <input type="number" min="0.01" step="0.01" value={stockQty} onChange={e => setStockQty(e.target.value)} required />
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
    </div>
  );
}
