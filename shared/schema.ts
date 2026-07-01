import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  published: boolean("published").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and dashes"),
  title: z.string().min(1).max(300),
  content: z.string().default(""),
  published: z.boolean().default(true),
});

export const updatePageSchema = insertPageSchema.partial();

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type Admin = typeof admins.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type UpdatePage = z.infer<typeof updatePageSchema>;
