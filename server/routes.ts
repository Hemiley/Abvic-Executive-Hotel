import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertPageSchema, updatePageSchema, loginSchema } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    adminUsername?: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export function registerRoutes(app: Express) {
  app.post("/api/admin/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid username or password" });
    }
    const { username, password } = parsed.data;
    const admin = await storage.getAdminByUsername(username);
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    res.json({ id: admin.id, username: admin.username });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/admin/me", (req, res) => {
    if (!req.session.adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ id: req.session.adminId, username: req.session.adminUsername });
  });

  app.get("/api/pages", async (req, res) => {
    const allPages = await storage.getPages();
    if (!req.session.adminId) {
      return res.json(allPages.filter((p) => p.published));
    }
    res.json(allPages);
  });

  app.get("/api/pages/slug/:slug", async (req, res) => {
    const page = await storage.getPageBySlug(req.params.slug);
    if (!page || (!page.published && !req.session.adminId)) {
      return res.status(404).json({ message: "Page not found" });
    }
    res.json(page);
  });

  app.get("/api/pages/:id", requireAuth, async (req, res) => {
    const page = await storage.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }
    res.json(page);
  });

  app.post("/api/pages", requireAuth, async (req, res) => {
    const parsed = insertPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid page data" });
    }
    const existing = await storage.getPageBySlug(parsed.data.slug);
    if (existing) {
      return res.status(409).json({ message: "A page with this slug already exists" });
    }
    const page = await storage.createPage(parsed.data);
    res.status(201).json(page);
  });

  app.patch("/api/pages/:id", requireAuth, async (req, res) => {
    const parsed = updatePageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid page data" });
    }
    if (parsed.data.slug) {
      const existing = await storage.getPageBySlug(parsed.data.slug);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ message: "A page with this slug already exists" });
      }
    }
    const page = await storage.updatePage(req.params.id, parsed.data);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }
    res.json(page);
  });

  app.delete("/api/pages/:id", requireAuth, async (req, res) => {
    await storage.deletePage(req.params.id);
    res.status(204).end();
  });
}
