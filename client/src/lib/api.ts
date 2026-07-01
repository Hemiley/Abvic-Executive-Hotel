export type Page = {
  id: string;
  slug: string;
  title: string;
  content: string;
  published: boolean;
  updatedAt: string;
  createdAt: string;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    credentials: "include",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ id: string; username: string }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request("/api/admin/logout", { method: "POST" }),
  me: () => request<{ id: string; username: string }>("/api/admin/me"),
  getPages: () => request<Page[]>("/api/pages"),
  getPageBySlug: (slug: string) => request<Page>(`/api/pages/slug/${slug}`),
  getPageById: (id: string) => request<Page>(`/api/pages/${id}`),
  createPage: (data: Partial<Page>) =>
    request<Page>("/api/pages", { method: "POST", body: JSON.stringify(data) }),
  updatePage: (id: string, data: Partial<Page>) =>
    request<Page>(`/api/pages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePage: (id: string) => request<void>(`/api/pages/${id}`, { method: "DELETE" }),
};
