import { useEffect, useState } from "react";
import { api, type BarWaiter, type Branch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function BarWaiters() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManage = user?.role === "admin" || user?.role === "supervisor";
  const [waiters, setWaiters] = useState<BarWaiter[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ branchId: user?.branchId || "", name: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BarWaiter | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  function load() {
    api.getBarWaiters().then(setWaiters).catch(e => setError(e.message));
    if (isAdmin) api.getBranches().then(setBranches).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  const filtered = waiters.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await api.createBarWaiter({ branchId: form.branchId || user?.branchId || "", name: form.name });
      setForm({ branchId: user?.branchId || "", name: "" });
      setShowNew(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDeactivate() {
    if (!deleteTarget) return;
    try {
      await api.deleteBarWaiter(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Waiters / Waitresses</h1>
          <p className="page-sub">Manage bar service staff for sales tracking</p>
        </div>
        {canManage && <button className="btn" onClick={() => setShowNew(true)}>+ Add Waiter</button>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="search-input" placeholder="Search waiters..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr>
              {["Name", "Status", "Added", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No waiters added yet</td></tr>}
            {filtered.map(w => (
              <tr key={w.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{w.name}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
                    background: w.active ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                    color: w.active ? "#4ade80" : "#f87171",
                  }}>{w.active ? "Active" : "Inactive"}</span>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--muted)", fontSize: "0.8rem" }}>{new Date(w.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: "10px 14px" }}>
                  {w.active && canManage && (
                    <button className="btn danger" style={{ padding: "4px 12px", fontSize: "0.8rem" }} onClick={() => setDeleteTarget(w)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Waiter Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Add Waiter / Waitress</h2>
            <form onSubmit={handleCreate}>
              {isAdmin && (
                <div className="field">
                  <label>Branch</label>
                  <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} required>
                    <option value="">Select branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label>Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. John Doe" />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Saving..." : "Add Waiter"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Remove Waiter?</h2>
            <p>Remove <strong>{deleteTarget.name}</strong> from the waiter list? They will no longer appear in sale options.</p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn danger" onClick={handleDeactivate}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
