import { useEffect, useState } from "react";
import { api, type BarDrink, type Branch, type StockSubmission, type BarShift } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = ["Beer", "Wine", "Spirit", "Soft Drink", "Water", "Energy Drink", "Other"];

const emptyForm = {
  branchId: "",
  name: "",
  category: "Beer",
  brand: "",
  sellingPrice: "",
  quantityAvailable: "0",
  lowStockThreshold: "5",
  barcode: "",
  imageUrl: "",
  status: "available",
};

export default function BarInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManage = user?.role === "admin" || user?.role === "supervisor";
  const [drinks, setDrinks] = useState<BarDrink[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<BarDrink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BarDrink | null>(null);
  const [stockTarget, setStockTarget] = useState<BarDrink | null>(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [pendingStock, setPendingStock] = useState<StockSubmission[]>([]);
  const [activeShift, setActiveShift] = useState<BarShift | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function load(branch?: string) {
    api.getBarDrinks(isAdmin ? branch : undefined).then(setDrinks).catch(e => setError(e.message));
    if (isAdmin) api.getBranches().then(setBranches).catch(() => {});
    else setForm(f => ({ ...f, branchId: user?.branchId || "" }));
    if (user?.role === "bar_attendant") {
      api.getPendingStock().then(setPendingStock).catch(e => setError(e.message));
      api.getCurrentBarShift().then(setActiveShift).catch(() => setActiveShift(null));
    }
  }

  useEffect(() => {
    load(filterBranch || undefined);
    if (user?.role !== "bar_attendant") return;
    const refresh = setInterval(() => load(filterBranch || undefined), 15000);
    return () => clearInterval(refresh);
  }, [filterBranch, user?.role]);

  const filtered = drinks.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) || (d.brand || "").toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === "All" || d.category === filterCat;
    return matchesSearch && matchesCat;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await api.createBarDrink({
        ...form,
        sellingPrice: Number(form.sellingPrice),
        quantityAvailable: 0,
        lowStockThreshold: Number(form.lowStockThreshold),
        brand: form.brand || undefined,
        barcode: form.barcode || undefined,
        imageUrl: form.imageUrl || undefined,
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
      await api.updateBarDrink(editing.id, {
        name: editForm.name,
        category: editForm.category as any,
        brand: editForm.brand || undefined,
        sellingPrice: Number(editForm.sellingPrice),
        quantityAvailable: Number(editForm.quantityAvailable),
        lowStockThreshold: Number(editForm.lowStockThreshold),
        barcode: editForm.barcode || undefined,
        imageUrl: editForm.imageUrl || undefined,
        status: editForm.status as any,
      } as any);
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleSubmitStock(e: React.FormEvent) {
    e.preventDefault();
    if (!stockTarget) return;
    setError(""); setSaving(true);
    try {
      await api.submitStock({
        department: "bar",
        itemId: stockTarget.id,
        branchId: stockTarget.branchId,
        quantity: Number(stockQuantity),
        note: stockNote.trim() || undefined,
        requestKey: crypto.randomUUID(),
      });
      setStockTarget(null);
      setStockQuantity("");
      setStockNote("");
      load(filterBranch || undefined);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleAcceptStock(submission: StockSubmission) {
    setError(""); setAcceptingId(submission.id);
    try {
      await api.acceptStock(submission.id);
      setPendingStock(items => items.filter(item => item.id !== submission.id));
      load(filterBranch || undefined);
    } catch (e: any) { setError(e.message); }
    finally { setAcceptingId(null); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteBarDrink(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(false); }
  }

  function openEdit(d: BarDrink) {
    setEditing(d);
    setEditForm({
      branchId: d.branchId,
      name: d.name, category: d.category, brand: d.brand || "",
      sellingPrice: d.sellingPrice, quantityAvailable: String(d.quantityAvailable),
      lowStockThreshold: String(d.lowStockThreshold), barcode: d.barcode || "",
      imageUrl: d.imageUrl || "", status: d.status,
    });
  }

  const fmt = (p: string) => `₦${Number(p).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bar Inventory</h1>
          <p className="page-sub">Manage drink stock and pricing</p>
        </div>
        {canManage && <button className="btn" onClick={() => setShowNew(true)}>+ Add Drink</button>}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          className="search-input"
          placeholder="Search drinks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
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

      {user?.role === "bar_attendant" && (
        <section className="glass" style={{ borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Stock Awaiting Acceptance</h2>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
                {activeShift ? `Accepted stock will be recorded on your active shift.` : "Start a Bar shift before accepting stock."}
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

      <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr>
              {["Name", "Category", "Brand", "Price", "Stock", "Low Stock At", "Status", canManage ? "Actions" : ""].filter(Boolean).map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No drinks found</td></tr>
            )}
            {filtered.map(d => (
              <tr key={d.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.name}</td>
                <td style={{ padding: "10px 14px" }}>{d.category}</td>
                <td style={{ padding: "10px 14px", color: "var(--muted)" }}>{d.brand || "—"}</td>
                <td style={{ padding: "10px 14px" }}>{fmt(d.sellingPrice)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ color: d.quantityAvailable <= d.lowStockThreshold ? "#f59e0b" : "inherit", fontWeight: d.quantityAvailable <= d.lowStockThreshold ? 700 : 400 }}>
                    {d.quantityAvailable}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--muted)" }}>{d.lowStockThreshold}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
                    background: d.status === "available" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                    color: d.status === "available" ? "#4ade80" : "#f87171",
                  }}>{d.status === "available" ? "Available" : "Out of Stock"}</span>
                </td>
              {canManage && (
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn secondary" style={{ padding: "4px 12px", fontSize: "0.8rem" }} onClick={() => { setStockTarget(d); setStockQuantity(""); setStockNote(""); }}>Add Stock</button>
                      <button className="btn secondary" style={{ padding: "4px 12px", fontSize: "0.8rem" }} onClick={() => openEdit(d)}>Edit</button>
                      <button className="btn danger" style={{ padding: "4px 12px", fontSize: "0.8rem" }} onClick={() => setDeleteTarget(d)}>Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Drink Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal glass" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2>Add New Drink</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {isAdmin && <div className="field" style={{ gridColumn: "1/-1" }}>
                  <label>Branch</label>
                  <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} required>
                    <option value="">Select branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>}
                <div className="field">
                  <label>Drink Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Category *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Brand</label>
                  <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Selling Price (₦) *</label>
                  <input type="number" min="0" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Low Stock Alert At</label>
                  <input type="number" min="0" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Barcode (optional)</label>
                  <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Image URL (optional)</label>
                  <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
                </div>
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Saving..." : "Add Drink"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Drink Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal glass" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2>Edit Drink</h2>
            <form onSubmit={handleUpdate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field" style={{ gridColumn: "1/-1" }}>
                  <label>Drink Name *</label>
                  <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Brand</label>
                  <input value={editForm.brand} onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Selling Price (₦)</label>
                  <input type="number" min="0" value={editForm.sellingPrice} onChange={e => setEditForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Active Stock (lower only)</label>
                  <input type="number" min="0" max={editing.quantityAvailable} value={editForm.quantityAvailable} onChange={e => setEditForm(f => ({ ...f, quantityAvailable: e.target.value }))} />
                  <small style={{ color: "var(--muted)" }}>To increase stock, submit it for acceptance.</small>
                </div>
                <div className="field">
                  <label>Low Stock Alert At</label>
                  <input type="number" min="0" value={editForm.lowStockThreshold} onChange={e => setEditForm(f => ({ ...f, lowStockThreshold: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Barcode</label>
                  <input value={editForm.barcode} onChange={e => setEditForm(f => ({ ...f, barcode: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Image URL</label>
                  <input value={editForm.imageUrl} onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="available">Available</option>
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

      {stockTarget && (
        <div className="modal-overlay" onClick={() => setStockTarget(null)}>
          <div className="modal glass" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2>Submit Bar Stock</h2>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>
              {stockTarget.name} will remain pending until a Bar Attendant accepts it on an active shift.
            </p>
            <form onSubmit={handleSubmitStock}>
              <div className="field">
                <label>Quantity (whole units) *</label>
                <input type="number" min="1" step="1" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} required />
              </div>
              <div className="field">
                <label>Note</label>
                <input value={stockNote} onChange={e => setStockNote(e.target.value)} placeholder="Optional delivery or reference note" />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setStockTarget(null)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Submitting…" : "Submit for acceptance"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Delete Drink?</h2>
            <p>Remove <strong>{deleteTarget.name}</strong> from inventory? This cannot be undone.</p>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
