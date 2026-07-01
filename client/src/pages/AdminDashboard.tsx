import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type Page } from "../lib/api";

export default function AdminDashboard() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api
      .getPages()
      .then(setPages)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this page? This cannot be undone.")) return;
    await api.deletePage(id);
    load();
  }

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <h2>Super Admin</h2>
        <div className="user-info">Signed in as {user?.username}</div>
        <button className="btn secondary" style={{ width: "100%" }} onClick={handleLogout}>
          Log out
        </button>
      </aside>
      <main className="admin-main">
        <div className="toolbar">
          <h1>Pages</h1>
          <Link to="/admin/pages/new" className="btn">
            + New page
          </Link>
        </div>
        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>/{p.slug}</td>
                    <td>
                      <span className={`badge ${p.published ? "published" : "draft"}`}>
                        {p.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>{new Date(p.updatedAt).toLocaleString()}</td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/admin/pages/${p.id}`} className="btn secondary">
                          Edit
                        </Link>
                        <button className="btn danger" onClick={() => handleDelete(p.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan={5}>No pages yet. Create your first page.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
