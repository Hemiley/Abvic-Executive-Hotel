import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type AttendanceRecord = {
  id: string;
  date: string;
  staffName: string;
  position: string;
  branchId: string;
  signInTime: string;
  signOutTime: string | null;
  status: "signed_in" | "signed_out";
  totalHours: string | null;
  recordedByName: string;
  notes?: string | null;
};

export default function Attendance() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterPosition, setFilterPosition] = useState("");

  // Edit modal
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"records" | "payroll">("records");

  useEffect(() => {
    api.getPublicBranches().then(setBranches).catch(() => {});
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterDate) params.date = filterDate;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      if (filterBranch) params.branchId = filterBranch;
      if (filterStatus) params.status = filterStatus;
      if (filterStaff) params.staffName = filterStaff;
      if (filterPosition) params.position = filterPosition;
      const data = await api.getAttendance(params);
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() { loadRecords(); }
  function clearFilters() {
    setFilterDate(""); setFilterDateFrom(""); setFilterDateTo("");
    setFilterBranch(""); setFilterStatus(""); setFilterStaff(""); setFilterPosition("");
    setTimeout(loadRecords, 50);
  }

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deleteAttendance(id);
      setConfirmDeleteId(null);
      loadRecords();
    } catch { } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveEdit() {
    if (!editRecord) return;
    setSaving(true);
    try {
      await api.updateAttendance(editRecord.id, { notes: editNotes });
      setEditRecord(null);
      loadRecords();
    } catch { } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      const params: Record<string, string> = {};
      if (filterBranch) params.branchId = filterBranch;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      if (filterStatus) params.status = filterStatus;
      const rows: Record<string, string>[] = await api.exportAttendance(params);
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { }
  }

  const stats = {
    total: records.length,
    signedIn: records.filter(r => r.status === "signed_in").length,
    signedOut: records.filter(r => r.status === "signed_out").length,
    avgHours: records.filter(r => r.totalHours).length
      ? (records.reduce((s, r) => s + Number(r.totalHours || 0), 0) / records.filter(r => r.totalHours).length).toFixed(1)
      : "—",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>📊 Attendance Management</h2>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>View, filter and manage all staff attendance records</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn secondary" onClick={() => navigate("/security")}>🛡️ Security Portal</button>
          <button className="btn" onClick={handleExport} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none" }}>
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Records", value: stats.total, color: "#6366f1" },
          { label: "Currently In", value: stats.signedIn, color: "#22c55e" },
          { label: "Signed Out", value: stats.signedOut, color: "#94a3b8" },
          { label: "Avg Hours", value: stats.avgHours, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="glass" style={{ padding: "16px 20px", borderRadius: 12, borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass" style={{ padding: 20, borderRadius: 14, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 12 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Exact Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>From Date</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>To Date</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Branch</label>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="signed_in">Signed In</option>
              <option value="signed_out">Signed Out</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Staff Name</label>
            <input value={filterStaff} onChange={e => setFilterStaff(e.target.value)} placeholder="Search name..." />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Position</label>
            <input value={filterPosition} onChange={e => setFilterPosition(e.target.value)} placeholder="Search position..." />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={applyFilters}>Search</button>
          <button className="btn secondary" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>Loading...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", opacity: 0.5, fontSize: 14 }}>
            No attendance records found. Try adjusting your filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Date", "Staff Name", "Position", "Branch", "Sign In", "Sign Out", "Hours", "Status", "Recorded By", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace", opacity: 0.8 }}>{record.date}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{record.staffName}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, opacity: 0.7 }}>{record.position}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, opacity: 0.7 }}>{branchName(record.branchId)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace" }}>
                      {new Date(record.signInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace" }}>
                      {record.signOutTime
                        ? new Date(record.signOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : <span style={{ opacity: 0.35 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace" }}>
                      {record.totalHours ? `${Number(record.totalHours).toFixed(1)}h` : <span style={{ opacity: 0.35 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px",
                        borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: record.status === "signed_in" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
                        color: record.status === "signed_in" ? "#22c55e" : "#94a3b8",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {record.status === "signed_in" ? "In" : "Out"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, opacity: 0.6 }}>{record.recordedByName}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn secondary"
                          style={{ padding: "4px 10px", fontSize: 11 }}
                          onClick={() => { setEditRecord(record); setEditNotes(record.notes || ""); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn"
                          style={{ padding: "4px 10px", fontSize: 11, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                          onClick={() => setConfirmDeleteId(record.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editRecord && (
        <div className="modal-overlay" onClick={() => setEditRecord(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2 style={{ margin: "0 0 4px" }}>Edit Attendance Record</h2>
            <p style={{ margin: "0 0 20px", opacity: 0.6, fontSize: 13 }}>{editRecord.staffName} · {editRecord.date}</p>
            <div className="field">
              <label>Notes</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Add notes..."
                style={{ width: "100%", resize: "vertical", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "inherit", fontFamily: "inherit", fontSize: 14 }}
              />
            </div>
            <div className="modal-actions" style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button className="btn secondary" onClick={() => setEditRecord(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ margin: "0 0 8px" }}>Delete Record?</h2>
            <p style={{ opacity: 0.7, marginBottom: 20 }}>This action cannot be undone.</p>
            <div className="modal-actions" style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                style={{ background: "rgba(239,68,68,0.8)", border: "none" }}
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
              >
                {deletingId === confirmDeleteId ? "Deleting..." : "Delete"}
              </button>
              <button className="btn secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
