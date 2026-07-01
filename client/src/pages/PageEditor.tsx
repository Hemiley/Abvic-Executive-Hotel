import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function PageEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) return;
    api
      .getPageById(id!)
      .then((page) => {
        setTitle(page.title);
        setSlug(page.slug);
        setContent(page.content);
        setPublished(page.published);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isNew) {
        await api.createPage({ title, slug, content, published });
      } else {
        await api.updatePage(id!, { title, slug, content, published });
      }
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Failed to save page");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <h2>Super Admin</h2>
        <Link to="/admin" className="btn secondary" style={{ width: "100%", textAlign: "center", display: "block" }}>
          Back to pages
        </Link>
      </aside>
      <main className="admin-main">
        <h1>{isNew ? "New Page" : "Edit Page"}</h1>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
            <div className="field">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="field">
              <label>Slug (URL path)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                required
              />
            </div>
            <div className="field">
              <label>Content</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  style={{ width: "auto", marginRight: 8 }}
                />
                Published
              </label>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save page"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
