import { useEffect, useState } from "react";
import { api, type Branch } from "../lib/api";

const emptyForm = { name: "", code: "" };

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: "", code: "", active: true });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function load() {
    api.getBranches().then(setBranches).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createBranch({ name: form.name, code: form.code || undefined });
      setShowNew(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setEditForm({ name: branch.name, code: branch.code || "", active: branch.active });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setSaving(true);
    try {
      await api.updateBranch(editing.id, { name: editForm.name, code: editForm.code, active: editForm.active });
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await api.deleteBranch(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Branch Management</h1>
          <p className="page-sub">Create and manage the hotel's branches — rooms and staff are each assigned to one</p>
        </div>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Add Branch
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card glass">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id}>
                <td>{branch.name}</td>
                <td className="muted">{branch.code || "—"}</td>
                <td>
                  <span className={`badge ${branch.active ? "status-available" : "status-cancelled"}`}>
                    {branch.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn secondary" onClick={() => openEdit(branch)}>
                      Edit
                    </button>
                    <button className="btn danger" onClick={() => { setDeleteError(""); setDeleteTarget(branch); }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={4}>No branches yet. Add your first branch (e.g. "Annex 1") to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Branch</h2>
            <p style={{ margin: "12px 0 20px" }}>
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            {deleteError && <p className="error-text">{deleteError}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Branch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <form className="modal glass" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h2>Add Branch</h2>
            <div className="field">
              <label>Branch Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Annex 2"
                required
              />
            </div>
            <div className="field">
              <label>Short Code (optional)</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. ANNEX-2"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving..." : "Add Branch"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <form className="modal glass" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSave}>
            <h2>Edit {editing.name}</h2>
            <div className="field">
              <label>Branch Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Short Code</label>
              <input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
            </div>
            <div className="field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                />{" "}
                Branch active
              </label>
            </div>
            {error && <p className="error-text">{error}</p>}
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
