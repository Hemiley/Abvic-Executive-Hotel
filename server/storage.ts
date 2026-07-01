import { db } from "./db";
import { admins, pages, type Admin, type Page, type InsertPage, type UpdatePage } from "@shared/schema";
import { eq } from "drizzle-orm";

export const storage = {
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin;
  },

  async createAdmin(username: string, passwordHash: string): Promise<Admin> {
    const [admin] = await db.insert(admins).values({ username, passwordHash }).returning();
    return admin;
  },

  async countAdmins(): Promise<number> {
    const rows = await db.select().from(admins);
    return rows.length;
  },

  async getPages(): Promise<Page[]> {
    return db.select().from(pages).orderBy(pages.updatedAt);
  },

  async getPageBySlug(slug: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
    return page;
  },

  async getPageById(id: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page;
  },

  async createPage(data: InsertPage): Promise<Page> {
    const [page] = await db.insert(pages).values(data).returning();
    return page;
  },

  async updatePage(id: string, data: UpdatePage): Promise<Page | undefined> {
    const [page] = await db
      .update(pages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pages.id, id))
      .returning();
    return page;
  },

  async deletePage(id: string): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  },
};
