import { useEffect, useState } from "react";
import { api, type Staff as StaffMember, type Branch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { fileToResizedDataUrl } from "../lib/image";

const emptyCreateForm = {
  username: "",
  password: "",
  fullName: "",
  email: "",
  role: "receptionist",
  avatarUrl: "",
  branchId: "",
};

export default function Staff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    role: "receptionist",
    avatarUrl: "",
    active: true,
    password: "",
    branchId: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const branchName = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name : null) || "—";

  function load() {
    api.getStaff().then(setStaff).catch((e) => setError(e.message));
    api.getBranches().then((list) => {
      setBranches(list);
      setCreateForm((f) => ({ ...f, branchId: f.branchId || list[0]?.id || "" }));
    }).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>, target: "create" | "edit") {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 300, 0.85);
      if (target === "create") setCreateForm((f) => ({ ...f, avatarUrl: dataUrl }));
      else setEditForm((f) => ({ ...f, avatarUrl: dataUrl }));
    } catch (err: any) {
      setError(err.message || "Could not process image");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (createForm.role !== "admin" && !createForm.branchId) {
      setError("Please select a branch for this staff member.");
      return;
    }
    setSaving(true);
    try {
      await api.createStaff({
        username: createForm.username,
        password: createForm.password,
        fullName: createForm.fullName,
        email: createForm.email || undefined,
        role: createForm.role,
        avatarUrl: createForm.avatarUrl || undefined,
        branchId: createForm.role === "admin" ? undefined : createForm.branchId,
      });
      setShowNew(false);
      setCreateForm({ ...emptyCreateForm, branchId: createForm.branchId });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(member: StaffMember) {
    setEditing(member);
    setEditForm({
      fullName: member.fullName,
      email: member.email || "",
      role: member.role,
      avatarUrl: member.avatarUrl || "",
      active: member.active,
      password: "",
      branchId: member.branchId || branches[0]?.id || "",
    });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    if (editForm.role !== "admin" && !editForm.branchId) {
      setError("Please select a branch for this staff member.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
        avatarUrl: editForm.avatarUrl,
        active: editForm.active,
        branchId: editForm.role === "admin" ? null : editForm.branchId,
      };
      if (editForm.password) payload.password = editForm.password;
      await api.updateStaff(editing.id, payload);
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
    setError("");
    setDeleting(true);
    try {
      await api.deleteStaff(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const isSelf = (member: StaffMember) => member.id === user?.id;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff Management</h1>
          <p className="page-sub">Create receptionist accounts and manage staff profiles</p>
        </div>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Add Staff
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card glass">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.fullName} className="avatar-img" />
                  ) : (
                    <div className="avatar">{member.fullName.charAt(0)}</div>
                  )}
                </td>
                <td>{member.fullName}{isSelf(member) && <span className="muted" style={{ marginLeft: 6 }}>(you)</span>}</td>
                <td className="muted">{member.username}</td>
                <td className="muted">{member.email || "—"}</td>
                <td>
                  <span className="badge status-confirmed">{member.role}</span>
                </td>
                <td className="muted">{member.role === "admin" ? "All branches" : branchName(member.branchId)}</td>
                <td>
                  <span className={`badge ${member.active ? "status-available" : "status-cancelled"}`}>
                    {member.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn secondary" onClick={() => openEdit(member)}>
                      Edit
                    </button>
                    {!isSelf(member) && (
                      <button
                        className="btn danger"
                        onClick={() => setDeleteTarget(member)}
                        title="Delete staff account"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={8}>No staff members yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Staff Account</h2>
            <p style={{ margin: "12px 0 20px" }}>
              Are you sure you want to permanently delete{" "}
              <strong>{deleteTarget.fullName}</strong> ({deleteTarget.username})?
              This action cannot be undone.
            </p>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <form className="modal glass" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h2>Add Staff Account</h2>
            <div className="avatar-upload-row">
              {createForm.avatarUrl ? (
                <img src={createForm.avatarUrl} alt="Avatar preview" className="avatar-img large" />
              ) : (
                <div className="avatar large">{createForm.fullName.charAt(0) || "?"}</div>
              )}
              <label className="btn secondary file-btn">
                Upload Photo
                <input type="file" accept="image/*" onChange={(e) => handleAvatarChange(e, "create")} hidden />
              </label>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Full Name</label>
                <input
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="receptionist">Receptionist</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="bar_attendant">Bar Attendant</option>
                  <option value="chef">Chef</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Username</label>
                <input
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                  minLength={3}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div className="field">
              <label>Email (optional)</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            {createForm.role !== "admin" && (
              <div className="field">
                <label>Branch</label>
                <select value={createForm.branchId} onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })} required>
                  <option value="" disabled>Select a branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {branches.length === 0 && (
                  <p className="field-hint">No branches yet — create one under Branches first.</p>
                )}
              </div>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <form className="modal glass" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSave}>
            <h2>Edit {editing.fullName}</h2>
            <div className="avatar-upload-row">
              {editForm.avatarUrl ? (
                <img src={editForm.avatarUrl} alt="Avatar preview" className="avatar-img large" />
              ) : (
                <div className="avatar large">{editForm.fullName.charAt(0) || "?"}</div>
              )}
              <label className="btn secondary file-btn">
                Change Photo
                <input type="file" accept="image/*" onChange={(e) => handleAvatarChange(e, "edit")} hidden />
              </label>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Full Name</label>
                <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} required />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="receptionist">Receptionist</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="bar_attendant">Bar Attendant</option>
                  <option value="chef">Chef</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="field">
              <label>New Password (leave blank to keep current)</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                minLength={6}
              />
            </div>
            {editForm.role !== "admin" && (
              <div className="field">
                <label>Branch</label>
                <select value={editForm.branchId} onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })} required>
                  <option value="" disabled>Select a branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                />{" "}
                Account active
              </label>
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
