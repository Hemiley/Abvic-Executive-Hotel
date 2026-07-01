import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Page } from "../lib/api";

export default function PublicPage() {
  const params = useParams();
  const slug = params.slug || "home";
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(null);
    setError("");
    api
      .getPageBySlug(slug)
      .then(setPage)
      .catch(() => setError("This page could not be found."));
  }, [slug]);

  return (
    <div>
      <header className="site-header">
        <Link to="/">My Site</Link>
        <nav>
          <Link to="/page/home">Home</Link>
          <Link to="/page/about">About</Link>
          <Link to="/admin/login">Admin</Link>
        </nav>
      </header>
      <div className="container">
        <div className="card">
          {error && <p className="error-text">{error}</p>}
          {!error && !page && <p>Loading...</p>}
          {page && (
            <>
              <h1>{page.title}</h1>
              <div className="page-content">{page.content}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
